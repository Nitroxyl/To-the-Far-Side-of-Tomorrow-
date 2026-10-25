import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../pokemon-public-party.js',import.meta.url),'utf8');
const {publicPartySlots,partySignature}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(code));

test('fixed six-slot order matches My Pokémon positions',()=>{
 const mon=[
  {slot:5,nickname:'Aura',speciesName:'Riolu',level:12,spriteUrl:'https://assets.example/riolu.png',maxHp:40,notes:'PRIVATE'},
  {slot:2,speciesName:'Spinotroleum',level:34,spriteData:'data:image/webp;base64,AAAA'},
  {slot:0,speciesName:'Pikachu',level:99}
 ];
 const slots=publicPartySlots(mon);
 assert.equal(slots.length,6);
 assert.equal(slots[4].name,'Aura');
 assert.equal(slots[1].species,'Spinotroleum');
 assert.equal(slots[0],null);
 assert.equal(slots[5],null);
});

test('public summary excludes hidden battle mechanics and private notes',()=>{
 const mon=[{slot:1,speciesName:'Charizard',level:50,
   moves:['Schrades End'],notes:'Secret story information',
   megaForm:{name:'Mega Charizard Z'},teraType:'dragon',currentHp:1,
   spriteUrl:'https://assets.example/charizard.png'}];
 const publicData=partySignature(publicPartySlots(mon));
 for(const secret of ['Schrades End','Secret story information','Mega Charizard Z','teraType','currentHp']){
  assert.ok(!publicData.includes(secret),secret+' must not appear in public roster');
 }
});

test('duplicate slots do not create more than six party entries',()=>{
 const slots=publicPartySlots([{slot:1,speciesName:'Riolu',level:5},{slot:1,speciesName:'Pikachu',level:5}]);
 assert.equal(slots.filter(Boolean).length,1);
 assert.equal(slots[0].species,'Riolu');
});
