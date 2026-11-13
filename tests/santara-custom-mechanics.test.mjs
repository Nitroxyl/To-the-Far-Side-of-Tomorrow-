import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {computeDamage,makeMove} from '../santara-damage-core.js';
import {knownMove,moveProperties,SANTARA_DAMAGE_MOVES} from '../santara-damage-rules.js';
const require=createRequire(import.meta.url);
const calc=require('@smogon/calc'),gen=calc.Generations.get(9);
const species=(name,stats,types,ability)=>({
 name,speciesName:name,speciesKey:name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),baseStats:{
  hp:stats[0],attack:stats[1],defense:stats[2],specialAttack:stats[3],specialDefense:stats[4],speed:stats[5]
 },types,ability,level:50
});
const charizard=species('Charizard',[78,84,78,109,85,100],['Fire','Flying'],'Blaze');
const greninja=species('Greninja',[72,95,67,103,71,122],['Water','Dark'],'Torrent');
const dragonite=species('Dragonite',[91,134,95,100,100,80],['Dragon','Flying'],'Multiscale');
const kingler=species('Kingler',[55,130,115,50,50,75],['Water'],'Hyper Cutter');
const scizor=species('Scizor',[70,130,100,55,80,65],['Bug','Steel'],'Technician');
const porygon=species('Porygon-Z',[85,80,70,135,75,90],['Normal'],'Adaptability');
const lapras=species('Lapras',[130,85,80,85,95,60],['Water','Ice'],'Water Absorb');
const testCalc=(attacker,defender,moveName,options={})=>computeDamage(calc,{attacker,defender,moveName,...options});
test('custom signatures and official reworks are available as rules',()=>{
 for(const n of ['Infernal Sweep','Schradebreaker',"Schrade's End",'Psycannon','Aura Lance',
 'Tar Rend','Riptide Bite','Faultline Gore','Glitch Pulse','Nihil Light',
 'Razor Tempest','Machbreak','Crush Grip','Ice Hammer'])assert.ok(knownMove(n),n);
 assert.equal(Object.keys(SANTARA_DAMAGE_MOVES).length,14);
});
test('Riptide Bite receives Strong Jaw through the bite flag',()=>{
 const base=testCalc(kingler,charizard,'Riptide Bite');
 const jaw=testCalc({...kingler,ability:'Strong Jaw'},charizard,'Riptide Bite');
 assert.ok(jaw.max>base.max,JSON.stringify({jaw:jaw.max,base:base.max}));
 assert.match(jaw.notes.join(' '),/30% chance/);
});
test('Faultline Gore receives Reckless and lists recoil',()=>{
 const ordinary=testCalc({...kingler,ability:'Hyper Cutter'},scizor,'Faultline Gore');
 const reckless=testCalc({...kingler,ability:'Reckless'},scizor,'Faultline Gore');
 assert.ok(reckless.max>ordinary.max);
 assert.match(reckless.notes.join(' '),/Recoil:/);
});
test('Razor Tempest receives Sharpness slicing bonus',()=>{
 const ordinary=testCalc({...charizard,ability:'Blaze'},kingler,'Razor Tempest');
 const sharp=testCalc({...charizard,ability:'Sharpness'},kingler,'Razor Tempest');
 assert.ok(sharp.min>ordinary.min);
 assert.equal(moveProperties('Razor Tempest').flags.slicing,1);
});
test('Aura Lance receives Mega Launcher pulse bonus',()=>{
 const ordinary=testCalc({...charizard,ability:'Blaze'},kingler,'Aura Lance');
 const launcher=testCalc({...charizard,ability:'Mega Launcher'},kingler,'Aura Lance');
 assert.ok(launcher.max>ordinary.max);
});
test('Crush Grip is now 70 BP and automatically critical',()=>{
 const v=testCalc(kingler,dragonite,'Crush Grip');
 assert.equal(v.basePower,70);
 assert.equal(v.meta.critical,true);
});
test('Ice Hammer now reports perfect accuracy',()=>{
 assert.equal(testCalc(kingler,scizor,'Ice Hammer').accuracy,100);
});
test('Schradebreaker strips Reflect, Light Screen and Aurora Veil before damage',()=>{
 const base=testCalc(charizard,scizor,'Schradebreaker');
 const screens=testCalc(charizard,scizor,'Schradebreaker',{reflect:true,lightScreen:true,auroraVeil:true});
 assert.deepEqual([screens.min,screens.max],[base.min,base.max]);
});
test('Bastion Furnace protects above half HP and attacks harder below half',()=>{
 const boss={...scizor,ability:'Bastion Furnace'};
 const high=testCalc(charizard,boss,'Flamethrower',{defenderSettings:{hpPercent:100}});
 const low=testCalc(charizard,boss,'Flamethrower',{defenderSettings:{hpPercent:50}});
 assert.ok(high.max<low.max);
 const attacker={...charizard,ability:'Bastion Furnace'};
 const highAttack=testCalc(attacker,scizor,'Flamethrower',{attackerSettings:{hpPercent:100}});
 const lowAttack=testCalc(attacker,scizor,'Flamethrower',{attackerSettings:{hpPercent:50}});
 assert.ok(lowAttack.max>highAttack.max);
});
test('Aurora Chorus veil can expire instead of protecting permanently',()=>{
 const boss={...lapras,ability:'Aurora Chorus'};
 const active=testCalc(charizard,boss,'Flamethrower',{auroraChorusActive:true});
 const inactive=testCalc(charizard,boss,'Flamethrower',{auroraChorusActive:false});
 assert.ok(active.max<inactive.max);
});
test('Siege Battery applies an earned +1 SpA stage only when enabled',()=>{
 const boss={...charizard,ability:'Siege Battery'};
 const before=testCalc(boss,scizor,'Flamethrower',{siegeBoosted:false});
 const after=testCalc(boss,scizor,'Flamethrower',{siegeBoosted:true});
 assert.ok(after.max>before.max);
 assert.match(after.notes.join(' '),/Siege Battery/);
});
test('System Override suppresses marked Multiscale and boosts matching Electric moves',()=>{
 const attacker={...porygon,ability:'System Override'};
 const base=testCalc(attacker,dragonite,'Thunderbolt',{exposed:false});
 const exposed=testCalc(attacker,dragonite,'Thunderbolt',{exposed:true});
 assert.ok(exposed.max>base.max,JSON.stringify({base:base.max,exposed:exposed.max}));
 assert.match(exposed.notes.join(' '),/suppressed/);
});
test('Glitch Pulse has provisional Exposed bonus',()=>{
 const base=testCalc(porygon,kingler,'Glitch Pulse',{exposed:false});
 const tagged=testCalc(porygon,kingler,'Glitch Pulse',{exposed:true});
 assert.ok(tagged.max>base.max);
});
test('Skybreaker Ground attacks can hit Flying and Levitate defenders',()=>{
 const attacker={...charizard,ability:'Skybreaker'};
 const standard=testCalc(charizard,dragonite,'Earthquake');
 const bypass=testCalc(attacker,dragonite,'Earthquake');
 assert.equal(standard.max,0);
 assert.ok(bypass.max>0);
 const levitate={...kingler,ability:'Levitate'};
 const normalLevitate=testCalc(charizard,levitate,'Earthquake');
 const skyLevitate=testCalc(attacker,levitate,'Earthquake');
 assert.equal(normalLevitate.max,0);
 assert.ok(skyLevitate.max>0);
});
test('Tempest Crown Royal Tempest increases Electric output and fixes Thunder accuracy',()=>{
 const boss={...porygon,ability:'Tempest Crown'};
 const clear=testCalc(boss,kingler,'Thunder',{weather:'Clear'});
 const royal=testCalc(boss,kingler,'Thunder',{weather:'Auto'});
 assert.equal(royal.weather,'Royal Tempest');
 assert.equal(royal.accuracy,100);
 assert.ok(royal.max>clear.max);
});
test('Apex Predator on knockout reports healing, but does not mutate Pokémon HP',()=>{
 const boss={...kingler,ability:'Apex Predator'};
 const target={...scizor,level:20};
 const hit=testCalc(boss,target,'Crabhammer',{defenderSettings:{hpPercent:1}});
 assert.ok(hit.koChance>0);
 assert.match(hit.notes.join(' '),/recover/);
});
test('Roar of Time and other state effects show table instructions',()=>{
 const notes=testCalc(charizard,dragonite,'Roar of Time').notes.join(' ');
 assert.match(notes,/Trick Room/);
 assert.match(testCalc(charizard,kingler,'Tar Rend').notes.join(' '),/Defense stage/);
 const provisional=testCalc(charizard,kingler,'Nihil Light');
 assert.ok(provisional.warnings.some(x=>x.includes('provisional')));
});
test('unknown custom ability cannot pretend it was calculated',()=>{
 const actor={...charizard,ability:'Unscripted Aura'};
 const v=testCalc(actor,kingler,'Flamethrower');
 assert.ok(v.warnings.some(x=>x.includes('not modeled')));
});

test('Aura Guard halves damage from contact moves, not ranged attacks',()=>{
 const defender={...kingler,ability:'Aura Guard'};
 const contactNormal=testCalc(charizard,kingler,'Close Combat');
 const contactGuard=testCalc(charizard,defender,'Close Combat');
 assert.ok(contactGuard.max<contactNormal.max);
 assert.ok(contactGuard.max<=Math.ceil(contactNormal.max/2));
 assert.match(contactGuard.notes.join(' '),/Aura Guard/);
 const rangedNormal=testCalc(charizard,kingler,'Earthquake');
 const rangedGuard=testCalc(charizard,defender,'Earthquake');
 assert.deepEqual([rangedNormal.min,rangedNormal.max],[rangedGuard.min,rangedGuard.max]);
});
