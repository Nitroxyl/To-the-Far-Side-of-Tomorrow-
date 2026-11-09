import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const load=async path=>import('data:text/javascript;charset=utf-8,'+
 encodeURIComponent(readFileSync(new URL('../'+path,import.meta.url),'utf8')));
const memory=await load('pokemon-move-memory.js');
const forms=await load('pokemon-forms-learnsets.js');
const mon={ownerUid:'trainer-uid-00001',speciesKey:'ceruledge',
 moves:['Bitter Blade','Shadow Sneak'],level:42};
test('Existing moves are seeded once and can be reordered but not expanded without grants',()=>{
 const record=memory.mergeMoveMemory(mon);
 assert.deepEqual(record.unlockedMoves,['Bitter Blade','Shadow Sneak']);
 assert.ok(memory.validEquippedMoves(['Shadow Sneak','Bitter Blade'],record));
 assert.equal(memory.validEquippedMoves(['Bitter Blade','Destiny Bond'],record),false);
 assert.equal(memory.validEquippedMoves(['Bitter Blade','Bitter Blade'],record),false);
 assert.equal(memory.validEquippedMoves(['Bitter Blade','Shadow Sneak','Bitter Blade'],record),false);
 assert.equal(memory.validEquippedMoves(['',''],record),false);
});
test('Moves unlocked from TMs or Egg training are remembered after unequipping',()=>{
 const original=memory.mergeMoveMemory(mon);
 const taught=memory.mergeMoveMemory(mon,original,['Solar Blade'],'tm');
 const egg=memory.mergeMoveMemory({...mon,moves:['Bitter Blade']},taught,['Destiny Bond'],'egg');
 assert.ok(egg.unlockedMoves.includes('Solar Blade'));
 assert.ok(egg.unlockedMoves.includes('Destiny Bond'));
 assert.equal(egg.sources['solar-blade'],'tm');
 assert.equal(egg.sources['destiny-bond'],'egg');
 assert.ok(memory.validEquippedMoves(['Destiny Bond','Solar Blade'],egg));
});
test('Level-up gating uses exact-form requirements and excludes Egg/TM and pre-evolution methods',()=>{
 const official={name:'ceruledge',moves:[
  {move:{name:'bitter-blade'},version_group_details:[{move_learn_method:{name:'level-up'},level_learned_at:48}]},
  {move:{name:'shadow-sneak'},version_group_details:[{move_learn_method:{name:'level-up'},level_learned_at:12}]},
  {move:{name:'solar-blade'},version_group_details:[{move_learn_method:{name:'machine'},level_learned_at:0}]},
  {move:{name:'destiny-bond'},version_group_details:[{move_learn_method:{name:'egg'},level_learned_at:0}]}
 ]};
 const ancestor={name:'charcadet',moves:[
  {move:{name:'early-bird'},version_group_details:[{move_learn_method:{name:'level-up'},level_learned_at:5}]},
  {move:{name:'ancestor-tm'},version_group_details:[{move_learn_method:{name:'machine'},level_learned_at:0}]}
 ]};
 const data=forms.historicalMoveCatalog(official,[ancestor]);
 assert.equal(data.levelUpLevels['bitter-blade'],48);
 assert.equal(data.levelUpLevels['shadow-sneak'],12);
 assert.equal(data.levelUpLevels['early-bird'],undefined);
 assert.deepEqual(memory.eligibleLevelMoves(42,data.levelUpLevels),['Shadow Sneak'.toLowerCase().replace(' ','-')]);
 assert.ok(data.knownMoves.includes('early-bird'));
 assert.equal(data.tmMoves.includes('ancestor-tm'),false);
 assert.equal(data.tmMoves.includes('solar-blade'),true);
 assert.equal(data.tmMoves.includes('destiny-bond'),false);
});
test('GM revocation removes access and the active slot but not unrelated memory',()=>{
 const current=memory.mergeMoveMemory(mon,null,['Solar Blade','Destiny Bond'],'gm');
 const result=memory.removeMoveMemory(mon,current,'Bitter Blade');
 assert.deepEqual(result.moves,['Shadow Sneak']);
 assert.ok(!result.memory.unlockedMoves.includes('Bitter Blade'));
 assert.ok(result.memory.unlockedMoves.includes('Solar Blade'));
 assert.equal(memory.validEquippedMoves(['Bitter Blade'],result.memory),false);
});
test('Species evolution can preserve or reset remembered moves on GM save',()=>{
 const old=memory.mergeMoveMemory({...mon,speciesKey:'charcadet',moves:['Ember']});
 const evo=memory.mergeMoveMemory({...mon,speciesKey:'ceruledge',moves:['Bitter Blade']},old,['Shadow Sneak'],'level-up',true);
 assert.ok(evo.unlockedMoves.includes('Ember'));
 const replacement=memory.mergeMoveMemory({...mon,speciesKey:'pikachu',moves:['Thunder Shock']},old,['Growl'],'level-up',false);
 assert.deepEqual(replacement.unlockedMoves,['Thunder Shock','Growl']);
});
test('Site workflows and security rules keep unlock permissions GM-only',()=>{
 const party=readFileSync(new URL('../pokemon-party.js',import.meta.url),'utf8');
 const inventory=readFileSync(new URL('../santara-inventory.js',import.meta.url),'utf8');
 for(const name of ['manage-moves','memory-slots-form','memory-grant-form','sync-level-moves','revoke-memory'])
  assert.ok(party.includes(name),name);
 assert.ok(party.includes('runTransaction(store'));
 assert.ok(party.includes('ensureMoveMemory('));
 assert.ok(inventory.includes('tmMoves'));
 assert.ok(inventory.includes('santara_pokemon_move_memory'));
 assert.ok(inventory.includes('tx.set(memoryRef,'));
});
