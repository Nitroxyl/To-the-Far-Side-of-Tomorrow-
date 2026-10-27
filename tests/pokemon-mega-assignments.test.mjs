import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../pokemon-mega-assignments.js',import.meta.url),'utf8');
const {cleanMegaSnapshot,applyMegaOverlays}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(src));
const charizard={id:'zard01',ownerUid:'gm-user-1234567890',speciesKey:'charizard',speciesName:'Charizard',
 baseStats:{hp:78,attack:84,defense:78,specialAttack:109,specialDefense:85,speed:100},
 slot:1,currentHp:80,maxHp:150,level:45,moves:['Flamethrower']};
const z={slug:'mega-charizard-z',name:'Mega Charizard Z',baseSpeciesKey:'charizard',
 baseStats:{hp:78,attack:104,defense:72,specialAttack:200,specialDefense:70,speed:151},
 types:['fire','dragon'],ability:"Kingdom's End",source:'custom',spriteUrl:'',spriteData:''};

test('Mega Z adds no local-only id to the assignment and retains 200 Sp. Atk',()=>{
 const form=cleanMegaSnapshot(charizard,z);
 assert.equal(form.baseStats.specialAttack,200);
 assert.equal(form.baseSpeciesKey,'charizard');
 assert.ok(!Object.prototype.hasOwnProperty.call(form,'id'));
 assert.deepEqual(Object.keys(form).sort(),[
  'slug','name','baseSpeciesKey','baseStats','types','ability','spriteUrl','spriteData','source'
 ].sort());
});
test('Invalid legacy artwork is excluded without losing custom stats',()=>{
 const bad={...z,spriteData:'data:image/png;base64,AAAA',spriteUrl:'http://example.com/mega.png'};
 const form=cleanMegaSnapshot(charizard,bad);
 assert.equal(form.spriteData,'');
 assert.equal(form.spriteUrl,'');
 assert.equal(form.baseStats.specialAttack,200);
});
test('Owner-visible assigned Mega form and active state do not replace regular stats',()=>{
 const before=[charizard];
 const after=applyMegaOverlays(before,{zard01:{ownerUid:charizard.ownerUid,megaForm:z,megaActive:true}});
 assert.equal(after[0].baseStats.specialAttack,109);
 assert.equal(after[0].megaForm.baseStats.specialAttack,200);
 assert.equal(after[0].megaActive,true);
 assert.equal(charizard.megaForm,undefined);
 assert.strictEqual(applyMegaOverlays(before,{} )[0],charizard);
});
test('Clearing a Mega snapshot is reflected on the sheet',()=>{
 const old={...charizard,megaForm:z,megaActive:true};
 const after=applyMegaOverlays([old],{zard01:{ownerUid:old.ownerUid,megaForm:null,megaActive:false}});
 assert.equal(after[0].megaForm,null);
 assert.equal(after[0].megaActive,false);
});
test('Mismatched Mega species cannot be assigned',()=>{
 assert.throws(()=>cleanMegaSnapshot(charizard,{...z,baseSpeciesKey:'venusaur'}),/must match/);
});
