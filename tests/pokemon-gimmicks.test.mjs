import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../pokemon-gimmicks.js',import.meta.url),'utf8');
const {megaCompatible,effectivePokemon,initialUnlocks}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(code));
const BASE={id:'charizard',speciesKey:'charizard',speciesName:'Charizard',baseStats:{hp:78,attack:84,defense:78,specialAttack:109,specialDefense:85,speed:100},
  types:['fire','flying'],ability:'Blaze',maxHp:150,currentHp:112,teraType:'dragon',megaActive:false,teraActive:false,dynamaxTurns:0};
const MEGA={slug:'mega-charizard-z',name:'Mega Charizard Z',baseSpeciesKey:'charizard',
 baseStats:{hp:78,attack:104,defense:72,specialAttack:200,specialDefense:70,speed:151},
 types:['fire','dragon'],ability:"Kingdom's End",spriteUrl:'',spriteData:'',source:'custom'};
const UNLOCK={tera:true,mega:true,zMove:true,dynamax:true};

test('Unlocked Mega uses the customized form without overwriting base stats',()=>{
 const mon={...BASE,megaForm:MEGA,megaActive:true};
 const transformed=effectivePokemon(mon,UNLOCK);
 assert.equal(transformed.displayName,'Mega Charizard Z');
 assert.equal(transformed.baseStats.specialAttack,200);
 assert.equal(transformed.ability,"Kingdom's End");
 assert.deepEqual(transformed.types,['fire','dragon']);
 assert.equal(transformed.maxHp,150);
 assert.equal(mon.baseStats.specialAttack,109);
 assert.equal(effectivePokemon({...mon,megaActive:false},UNLOCK).baseStats.specialAttack,109);
});

test('Mega requires both unlocked permission and matching base species',()=>{
 const mon={...BASE,megaForm:MEGA,megaActive:true};
 assert.equal(effectivePokemon(mon,initialUnlocks()).baseStats.specialAttack,109);
 assert.equal(megaCompatible(mon,{...MEGA,baseSpeciesKey:'venusaur'}),false);
 assert.equal(effectivePokemon({...mon,megaForm:{...MEGA,baseSpeciesKey:'venusaur'}},UNLOCK).baseStats.specialAttack,109);
});

test('Tera type appears without mutating original typing',()=>{
 const mon={...BASE,teraActive:true,teraType:'dragon'};
 const shown=effectivePokemon(mon,UNLOCK);
 assert.deepEqual(shown.types,['dragon']);
 assert.deepEqual(shown.originalTypes,['fire','flying']);
 assert.deepEqual(mon.types,['fire','flying']);
});

test('Three-turn Dynamax doubles displayed HP without changing the record',()=>{
 const mon={...BASE,dynamaxTurns:3,dynamaxUsed:true};
 const active=effectivePokemon(mon,UNLOCK);
 assert.equal(active.currentHp,224);
 assert.equal(active.maxHp,300);
 assert.equal(mon.maxHp,150);
 assert.equal(effectivePokemon({...mon,dynamaxTurns:0},UNLOCK).maxHp,150);
});
