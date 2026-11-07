import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8')
 .replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
const full=['pokemon-action-automation.js','pokemon-gimmicks.js','pokemon-mega-assignments.js','pokemon-combat.js'].map(read).join('\n');
const roster=[
 {id:'riolu1',ownerUid:'owner123456',speciesKey:'riolu',speciesName:'Riolu',level:12,
  moves:['Thunder Wave','Dragon Dance'],ability:'Intimidate',maxHp:100,currentHp:90,status:'None',
  types:['fighting'],baseStats:{hp:40,attack:70,defense:40,specialAttack:35,specialDefense:40,speed:60}},
 {id:'golem2',ownerUid:'other567890',speciesKey:'golem',speciesName:'Golem',level:40,
  moves:['Toxic'],ability:'Sturdy',maxHp:200,currentHp:180,status:'None',
  types:['rock','ground'],baseStats:{hp:80,attack:120,defense:130,specialAttack:55,specialDefense:65,speed:45}}
];
function simulate(mode) {
 const nodes={},queries=[],writes=[];
 const el=id=>nodes[id]||(nodes[id]={innerHTML:'',textContent:'',addEventListener(){}});
 const uid=mode==='gm'?'ctBLgrVgkLOzUJYTyYgU9IwejYx1':'owner123456';
 const api={
  window:{SANTARA_POKEMON_EDITION:mode==='gm'?'gm':'player',SANTARA_FIREBASE_CONFIG:{projectId:'demo'},location:{search:'?actor=riolu1'}},
  document:{getElementById:el},console:{warn(){}},URLSearchParams,confirm:()=>true,
  initializeApp:()=>({}),getApps:()=>[],getApp:()=>({}),getAuth:()=>({}),getFirestore:()=>({}),
  onAuthStateChanged:(_,cb)=>{cb({uid,email:'trainer@example.test',emailVerified:true});return ()=>{}},
  collection:(_,path)=>({path}),doc:(_,path,id)=>({path,id}),where:(field,op,value)=>({field,op,value}),
  query:(collection,filter)=>({...collection,filter}),
  onSnapshot:(ref,cb)=>{
   queries.push(ref);
   if(ref.path==='santara_gm_accounts')cb({exists:()=>false});
   else if(ref.path==='santara_player_access')cb({exists:()=>mode!=='unapproved',data:()=>({enabled:mode!=='unapproved'})});
   else if(ref.path==='santara_pokemon'){
    const list=ref.filter?roster.filter(m=>m.ownerUid===ref.filter.value):roster;
    cb({docs:list.map(m=>({id:m.id,data:()=>m}))});
   }
   else if(['santara_pokemon_mega_assignments','santara_combat_state','santara_combat_profiles'].includes(ref.path))cb({docs:[]});
   else if(ref.path==='santara_trainer_gimmicks')cb(mode==='gm'?{docs:[]}:{exists:()=>false});
   else cb({docs:[]});
   return ()=>{};
  },
  serverTimestamp:()=>({stamp:true}),
  setDoc:async(...args)=>{writes.push(['set',...args])},
  deleteDoc:async(...args)=>{writes.push(['delete',...args])},
  writeBatch:()=>({
   set:(...a)=>writes.push(['batch-set',...a]),
   update:(...a)=>writes.push(['batch-update',...a]),
   commit:async()=>writes.push(['commit'])
  })
 };
 const result=new Function(...Object.keys(api),full+'\nreturn {view,render,apply,nextTurn,currentProfile};')(...Object.values(api));
 return {nodes,queries,writes,result,el};
}
test('GM sees registered opponents and effect profile editor',()=>{
 const x=simulate('gm');
 assert.match(x.el('combat-root').innerHTML,/Thunder Wave/);
 assert.match(x.el('combat-root').innerHTML,/Golem/);
 assert.match(x.el('combat-root').innerHTML,/GM automation library/);
});
test('Player sees own Pokémon only',()=>{
 const x=simulate('player');
 assert.match(x.el('combat-root').innerHTML,/Riolu/);
 assert.doesNotMatch(x.el('combat-root').innerHTML,/Golem/);
 assert.doesNotMatch(x.el('combat-root').innerHTML,/GM automation library/);
 assert.equal(x.queries.find(q=>q.path==='santara_pokemon').filter.value,'owner123456');
});
test('Unapproved account cannot read private Pokémon collections',()=>{
 const x=simulate('unapproved');
 assert.match(x.el('combat-root').innerHTML,/Trainer access required/);
 assert.equal(x.queries.some(q=>q.path==='santara_pokemon'),false);
});
test('GM move effect updates target status and acting Pokémon use atomically',async()=>{
 const x=simulate('gm');
 x.result.view.targetId='golem2';
 await x.result.apply();
 assert.equal(x.writes.filter(w=>w[0]==='commit').length,1);
 const updated=x.writes.find(w=>w[0]==='batch-update');
 assert.equal(updated[1].path,'santara_pokemon');
 assert.equal(updated[2].status,'Paralyzed');
 const state=x.writes.find(w=>w[0]==='batch-set');
 assert.equal(state[1].path,'santara_combat_state');
 assert.equal(state[2].moveRecords[0].uses,1);
});
test('Player cannot apply enemy-target status or alter another Trainer',async()=>{
 const x=simulate('player');
 x.result.view.targetId='golem2';
 await assert.rejects(x.result.apply(),/Enemy effects require GM approval/);
 assert.equal(x.writes.length,0);
});
