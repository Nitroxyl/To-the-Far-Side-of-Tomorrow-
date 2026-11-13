import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {computeDamage,makePokemon,makeMove,legalEvs,PERFECT_IVS,effectiveForm} from '../santara-damage-core.js';
import {maxHpV6} from '../pokemon-math.js';
const require=createRequire(import.meta.url);
const calc=require('@smogon/calc');
const pokemon=(name,baseStats,types,ability,level=50)=>({
 name,speciesName:name,speciesKey:name.toLowerCase().replace(/\W+/g,'-'),baseStats,types,ability,level,heldItem:''
});
const lucario=pokemon('Lucario',{hp:70,attack:110,defense:70,specialAttack:115,specialDefense:70,speed:90},['Fighting','Steel'],'Inner Focus');
const scizor=pokemon('Scizor',{hp:70,attack:130,defense:100,specialAttack:55,specialDefense:80,speed:65},['Bug','Steel'],'Technician');
const pikachu=pokemon('Pikachu',{hp:35,attack:55,defense:40,specialAttack:50,specialDefense:50,speed:90},['Electric'],'Static');
const charizard=pokemon('Charizard',{hp:78,attack:84,defense:78,specialAttack:109,specialDefense:85,speed:100},['Fire','Flying'],'Blaze');
const customAbilities=[{name:'Kingdom\'s End'},{name:'Perfected Ninjutsu'},{name:'Apex Predator'},{name:'Sword of Ruin'},{name:'Bastion Furnace'}];
const lookup=calc.Generations.get(9);
test('engine and perfect-IV baseline are present',()=>{
  const made=makePokemon(calc,lookup,lucario,{level:50},customAbilities);
  assert.deepEqual(made.pokemon.ivs,PERFECT_IVS);
  assert.equal(maxHpV6(lucario.baseStats,50),145);
  assert.equal(made.pokemon.rawStats.hp,145);
  assert.equal(maxHpV6({hp:1},100),1);
});
test('validates EV training without exposing IV controls',()=>{
  assert.throws(()=>legalEvs({hp:252,atk:252,def:100}),/510/);
  assert.equal(legalEvs({atk:252,spa:4}).atk,252);
});
test('standard 90 BP Flamethrower calculates real damage on a 4x weak defender',()=>{
  const hit=computeDamage(calc,{attacker:charizard,defender:scizor,moveName:'Flamethrower'});
  assert.ok(hit.min>0 && hit.max>=hit.min,JSON.stringify(hit));
  assert.ok(hit.minPercent>50,JSON.stringify(hit));
  assert.equal(hit.basePower,90);
  assert.equal(hit.meta.category,'Special');
});
test('custom Mega stats and forms override the species correctly',()=>{
  const enhanced={...charizard,megaForm:{slug:'mega-charizard-z',name:'Mega Charizard Z',
    baseStats:{hp:78,attack:63,defense:72,specialAttack:200,specialDefense:70,speed:151},
    types:['fire','dragon'],ability:"Kingdom's End"},megaActive:false};
  assert.equal(effectiveForm(enhanced,true).baseStats.specialAttack,200);
  const standard=computeDamage(calc,{attacker:charizard,defender:scizor,moveName:'Flamethrower'});
  const mega=computeDamage(calc,{attacker:enhanced,defender:scizor,moveName:'Flamethrower',
    attackerSettings:{mega:true},customAbilities});
  assert.ok(mega.min>standard.min,JSON.stringify({mega:mega.min,standard:standard.min}));
  assert.equal(mega.weather,'Calamitous Sun');
});
test('Kingdom\'s End blocks Water moves during Calamitous Sun',()=>{
  const result=computeDamage(calc,{attacker:lucario,defender:charizard,moveName:'Surf',
    weather:'Calamitous Sun'});
  assert.equal(result.max,0);
});
test('custom moves accept custom power, type and category',()=>{
  const customMoves=[{name:'Schradebreaker',type:'fire',category:'Special',power:130,accuracy:90,
    description:'Special Fire attack.',traits:[]}];
  const custom=computeDamage(calc,{attacker:charizard,defender:scizor,
    moveName:'Schradebreaker',customMoves});
  assert.equal(custom.basePower,130);
  assert.equal(custom.meta.type,'Fire');
  assert.ok(custom.min>0);
});
test('Perfected Ninjutsu applies Technician and maximum multi-hit count',()=>{
  const ninja={...lucario,ability:'Perfected Ninjutsu'};
  const result=computeDamage(calc,{attacker:ninja,defender:pikachu,
    moveName:'Water Shuriken',customAbilities});
  assert.equal(result.meta.hits,5);
  assert.ok(result.min>0);
});
test('standard multi-hit moves are not accidentally forced to one hit',()=>{
  const hit=makeMove(calc,lookup,'Bullet Seed',[],'Overgrow',0,false);
  assert.ok(hit.move.hits>=2);
});
test('Apex Predator applies a bonus only against an injured target',()=>{
  const predator={...lucario,ability:'Apex Predator'};
  const full=computeDamage(calc,{attacker:predator,defender:charizard,moveName:'Close Combat',
    customAbilities,defenderSettings:{hpPercent:100}});
  const injured=computeDamage(calc,{attacker:predator,defender:charizard,moveName:'Close Combat',
    customAbilities,defenderSettings:{hpPercent:50}});
  assert.ok(injured.max>full.max);
});
test('unsupported custom ability is warned about rather than silently applied',()=>{
  const attacker={...lucario,ability:'Unimplemented Ability'};
  const result=computeDamage(calc,{attacker,defender:charizard,moveName:'Aura Sphere',
    customAbilities:[...customAbilities,{name:'Unimplemented Ability'}]});
  assert.ok(result.warnings.some(x=>x.includes('not modeled')));
});
test('calculator never writes to Firebase',()=>{
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
  const content=readFileSync(resolve(root,'santara-damage-calculator.js'),'utf8');
  assert.ok(!/\\b(?:setDoc|updateDoc|deleteDoc|addDoc|writeBatch)\\b/.test(content));
});
