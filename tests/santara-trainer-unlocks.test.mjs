import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  initialTrainerUnlocks,readTrainerUnlocks,unlockedValue,unlockedWeather,
  visiblePlayerContent,progressionPayload
} from '../santara-player-unlocks.js';

const raw={tera:true,mega:false,zMove:true,dynamax:false,updatedAt:'legacy'};
const species=[
 {slug:'spinotroleum',name:'Spinotroleum'},
 {slug:'yveltal-eclipse-forme',name:'Yveltal Eclipse Forme'},
 {slug:'mosasord',name:'Mosasord'}
];
const moves=[
 {slug:'infernal-sweep',name:'Infernal Sweep'},
 {slug:'tar-rend',name:'Tar Rend'}
];
test('legacy gimmick-only records retain their original unlocks',()=>{
 const old=readTrainerUnlocks(raw);
 assert.equal(old.tera,true);
 assert.equal(old.zMove,true);
 assert.equal(old.mega,false);
 assert.deepEqual(old.speciesUnlocks,[]);
 assert.deepEqual(old.weatherUnlocks,[]);
 assert.equal(Object.keys(initialTrainerUnlocks()).length,9);
});
test('custom species and moves are locked unless revealed or already owned',()=>{
 const progress=readTrainerUnlocks({speciesUnlocks:['spinotroleum'],moveUnlocks:['tar-rend']});
 assert.deepEqual(visiblePlayerContent('species',species,[],progress).map(x=>x.name),['Spinotroleum']);
 assert.deepEqual(visiblePlayerContent('moves',moves,[],progress).map(x=>x.name),['Tar Rend']);
 assert.equal(unlockedValue(progress,'species',{slug:'yveltal-eclipse-forme'}),false);
});
test('assigned Pokémon and their equipped techniques remain available',()=>{
 const saved=[{speciesKey:'custom:mosasord',speciesName:'Mosasord',moves:['Infernal Sweep'],
  ability:'Apex Predator',megaForm:{slug:'mega-mosasord',ability:'Aurora Chorus'}}];
 assert.deepEqual(visiblePlayerContent('species',species,saved,{}).map(x=>x.name),['Mosasord']);
 assert.deepEqual(visiblePlayerContent('moves',moves,saved,{}).map(x=>x.name),['Infernal Sweep']);
 const abilities=[{slug:'apex-predator',name:'Apex Predator'},{slug:'aurora-chorus',name:'Aurora Chorus'}];
 assert.equal(visiblePlayerContent('abilities',abilities,saved,{}).length,2);
});
test('trainer unlocks isolate features for each user',()=>{
 const a=readTrainerUnlocks({tera:true,speciesUnlocks:['yveltal-eclipse-forme'],weatherUnlocks:['Calamitous Sun']});
 const b=readTrainerUnlocks({tera:false,speciesUnlocks:[],weatherUnlocks:[]});
 assert.equal(unlockedValue(a,'species','yveltal-eclipse-forme'),true);
 assert.equal(unlockedValue(b,'species','yveltal-eclipse-forme'),false);
 assert.equal(unlockedWeather(a,'Calamitous Sun'),true);
 assert.equal(unlockedWeather(b,'Calamitous Sun'),false);
});
test('form saves validated gimmicks and content lists in one document',()=>{
 const checked=new Set(['tera','mega']),lists={
  speciesUnlocks:['spinotroleum'],moveUnlocks:['tar-rend'],megaFormUnlocks:[],
  abilityUnlocks:[],weatherUnlocks:['Royal Tempest']
 };
 const fd={has:k=>checked.has(k),getAll:k=>lists[k]||[]};
 const options={species,moves,megaForms:[],abilities:[],weather:['Calamitous Sun','Royal Tempest']};
 const saved=progressionPayload(fd,options);
 assert.equal(saved.tera,true);
 assert.equal(saved.mega,true);
 assert.equal(saved.zMove,false);
 assert.deepEqual(saved.speciesUnlocks,['spinotroleum']);
 assert.deepEqual(saved.weatherUnlocks,['Royal Tempest']);
 assert.throws(()=>progressionPayload({has:()=>false,getAll:k=>k==='speciesUnlocks'?['secret-other-form']:[]},options),/Unknown species unlock/);
});
test('Player tracker and calculator enforce per-trainer grants',()=>{
 const party=readFileSync(new URL('../pokemon-party.js',import.meta.url),'utf8');
 const calc=readFileSync(new URL('../santara-damage-calculator.js',import.meta.url),'utf8');
 for(const needle of ["visiblePlayerContent('species'","playerProgressionSummary"])assert.ok(party.includes(needle),needle);
 for(const needle of [
  "getDoc(doc(store,'santara_trainer_gimmicks',session.uid))",
  "visiblePlayerContent('moves'","unlockedWeather(playerProgression,name)",
  "megaAllowed=gm||playerProgression.mega",
  "teraAllowed=gm||playerProgression.tera",
  "dynamaxAllowed=gm||playerProgression.dynamax"
 ])assert.ok(calc.includes(needle),needle);
});
