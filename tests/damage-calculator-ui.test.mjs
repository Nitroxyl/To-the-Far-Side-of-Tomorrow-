import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
  .replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
const bundle=[
 'pokemon-math.js','pokemon-gimmicks.js','pokemon-mega-assignments.js',
 'pokemon-damage.js','damage-calculator.js'
].map(source).join('\n');

const base={hp:78,attack:84,defense:78,specialAttack:109,specialDefense:85,speed:100};
const mons=[
 {id:'charizard1',data:{speciesName:'Charizard',ownerUid:'trainer-owner-1',baseStats:base,
  types:['fire','flying'],maxHp:140,currentHp:100,level:50,moves:['Flamethrower'],ability:'Blaze'}},
 {id:'venusaur2',data:{speciesName:'Venusaur',ownerUid:'other-owner-2',baseStats:{...base,specialDefense:100},
  types:['grass','poison'],maxHp:140,currentHp:100,level:50,moves:['Solar Beam'],ability:'Overgrow'}}
];
function simulate(edition,approved=true){
 const nodes={},queries=[];
 const el=id=>nodes[id]||(nodes[id]={innerHTML:'',textContent:'',addEventListener(){}});
 const mode=edition==='gm',uid=mode?'ctBLgrVgkLOzUJYTyYgU9IwejYx1':'trainer-owner-1';
 const mock={
  window:{SANTARA_POKEMON_EDITION:edition,SANTARA_FIREBASE_CONFIG:{projectId:'test'},location:{search:'?attacker=charizard1'}},
  document:{getElementById:el},console:{warn(){}},URLSearchParams,
  initializeApp:()=>({}),getApps:()=>[],getApp:()=>({}),getAuth:()=>({}),getFirestore:()=>({}),
  onAuthStateChanged:(_auth,cb)=>{cb({uid,email:'trainer@example.test',emailVerified:true});return()=>{}},
  collection:(_db,path)=>({path}),doc:(_db,path)=>({path}),
  where:(field,op,value)=>({field,op,value}),
  query:(collection,filter)=>({...collection,filter}),
  onSnapshot:(ref,callback)=>{
   queries.push(ref);
   if(ref.path==='santara_gm_accounts')callback({exists:()=>false});
   else if(ref.path==='santara_player_access')callback({exists:()=>approved,data:()=>({enabled:approved})});
   else if(ref.path==='santara_pokemon'){
    const data=ref.filter?mons.filter(m=>m.data.ownerUid===ref.filter.value):mons;
    callback({docs:data.map(m=>({id:m.id,data:()=>m.data}))});
   }
   else if(ref.path==='santara_pokemon_mega_assignments')callback({docs:[]});
   else if(ref.path==='santara_battle_rules')callback({exists:()=>false});
   else if(ref.path==='santara_custom_moves')callback({docs:[]});
   else if(ref.path==='santara_trainer_gimmicks')
    callback(mode?{docs:[]}:{exists:()=>false});
   else callback({docs:[]});
   return()=>{};
  },
  fetch:async()=>({ok:false,status:404})
 };
 const run=new Function(...Object.keys(mock),bundle+
  "\nif(eligible){state.moveType='fire';state.category='special';state.dice='3d8';renderResult();}return {eligible};");
 const result=run(...Object.values(mock));
 return {result,root:el('calculator-root').innerHTML,damage:el('damage-result').innerHTML,queries};
}
test('GM sees both Trainers and can calculate damage without writing',()=>{
 const {root,damage,queries,result}=simulate('gm');
 assert.equal(result.eligible,true);
 assert.match(root,/Charizard/);assert.match(root,/Venusaur/);
 assert.match(root,/name="dice"/);assert.match(root,/Battle modifiers/);
 assert.match(damage,/Average dice estimate/);assert.match(damage,/STAB/);
 assert.equal(queries.filter(r=>r.path==='santara_pokemon')[0].filter,undefined);
});
test('Player query is limited to the signed-in Trainer',()=>{
 const {root,queries}=simulate('player');
 assert.match(root,/Charizard/);
 assert.doesNotMatch(root,/Venusaur/);
 assert.equal(queries.find(r=>r.path==='santara_pokemon').filter.value,'trainer-owner-1');
});
test('Unapproved Player cannot subscribe to private Pokémon collection',()=>{
 const {root,queries,result}=simulate('player',false);
 assert.equal(result.eligible,false);
 assert.match(root,/Trainer access required/);
 assert.ok(!queries.some(r=>r.path==='santara_pokemon'));
});
