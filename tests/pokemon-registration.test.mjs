import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const party=readFileSync(new URL('../pokemon-party.js',import.meta.url),'utf8')
  .replace(/^import .*;\s*$/gm,'');
const math=readFileSync(new URL('../pokemon-math.js',import.meta.url),'utf8')
  .replace(/\bexport (const|function)\b/g,'$1');

function setup(){
 const nodes=new Map();
 const element=id=>{
   if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',addEventListener(){}});
   return nodes.get(id);
 };
 const move={slug:'primordial-crush',name:'Primordial Crush',type:'ground',
   category:'Physical',power:90,accuracy:95,dice:'4d8',description:'Ground tremor in a cone.'};
 const ability={slug:'apex-predator',name:'Apex Predator',description:'Boost damage against weakened foes.'};
 const mock={
  document:{getElementById:element},
  window:{SANTARA_POKEMON_EDITION:'gm',SANTARA_FIREBASE_CONFIG:{projectId:'test'}},
  console:{warn(){}},fetch(){throw Error('Unexpected network request')},
  initializeApp:()=>({}),getApps:()=>[],getApp:()=>({}),getAuth:()=>({}),getFirestore:()=>({}),
  onAuthStateChanged:(_,fn)=>{fn({uid:'ctBLgrVgkLOzUJYTyYgU9IwejYx1',emailVerified:true});return ()=>{};},
  collection:(_,path)=>({path}),doc:(_,path)=>({path}),query:x=>x,where:()=>({}),
  onSnapshot:(ref,fn)=>{
   const cases={
    santara_player_access:[{id:'trainer123',data:()=>({email:'email@example.test',enabled:true})}],
    santara_trainer_cards:[{id:'trainer123',data:()=>({trainerName:'Astra'})}],
    santara_custom_moves:[{id:move.slug,data:()=>move}],
    santara_custom_abilities:[{id:ability.slug,data:()=>ability}]
   };
   if(ref.path==='santara_battle_rules')fn({exists:()=>false});
   else fn({docs:cases[ref.path]||[]});
   return ()=>{};
  },
  setDoc:async()=>{},addDoc:async()=>{},deleteDoc:async()=>{},
  updateDoc:async()=>{},writeBatch:()=>{},serverTimestamp:()=>{}
 };
 const fn=new Function(...Object.keys(mock),math+'\n'+party+
   '\nreturn {gmForm,customForm,catalogForm,registrationMoves,detail,lookupMoves};');
 return {api:fn(...Object.values(mock)),move,ability};
}

test('Four separate move slots and Trainer Card name appear in GM registration',()=>{
 const {api}=setup();
 const html=api.gmForm();
 for(let i=1;i<=4;i++)assert.ok(html.includes('name="move'+i+'"'));
 assert.ok(!html.includes('name="moves"'));
 assert.ok(html.includes('>Astra<'));
 assert.ok(!html.includes('email@example.test'));
 assert.ok(html.includes('value="Primordial Crush"'));
});

test('Four individual move values are retained and duplicates rejected',()=>{
 const {api}=setup();
 const fields={move1:'Protect',move2:'Primordial Crush',move3:'Iron Tail',move4:'Quick Attack'};
 assert.deepEqual(api.registrationMoves({get:k=>fields[k]||''}),Object.values(fields));
 assert.throws(()=>api.registrationMoves({get:k=>({move1:'Protect',move2:'protect'})[k]||''}),/same move twice/);
});

test('Custom species abilities have independent input slots',()=>{
 const {api}=setup(),html=api.customForm();
 for(let i=1;i<=3;i++)assert.ok(html.includes('name="speciesAbility'+i+'"'));
});

test('Custom move and ability descriptions appear on a Pokemon sheet',async()=>{
 const {api,move,ability}=setup();
 const sheet={speciesName:'Spinotroleum',source:'custom',
  baseStats:{hp:100,attack:130,defense:90,specialAttack:70,specialDefense:75,speed:95},
  maxHp:100,currentHp:100,level:20,types:['rock','water'],ability:ability.name,
  moves:[move.name],slot:1};
 assert.ok(api.catalogForm('move').includes('name="dice"'));
 assert.ok(api.catalogForm('ability').includes('Ability effect'));
 await api.lookupMoves(sheet.moves);
 const html=api.detail(sheet);
 assert.ok(html.includes(move.description));
 assert.ok(html.includes(ability.description));
 assert.ok(html.includes('4d8'));
});
