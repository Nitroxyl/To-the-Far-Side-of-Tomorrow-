import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const math=readFileSync(new URL('../pokemon-math.js',import.meta.url),'utf8');
const engine=readFileSync(new URL('../pokemon-damage.js',import.meta.url),'utf8');
const util=new Function(
 math.replace(/^export /gm,'')+'\n'+
 engine.replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'')+
 '\nreturn {parseDice,rollDice,typeEffectiveness,stabMultiplier,calculateDamage};'
)();
const {parseDice,rollDice,typeEffectiveness,stabMultiplier,calculateDamage}=util;
const charizard={speciesName:'Charizard',ability:'Blaze',heldItem:'',types:['fire','flying'],
 baseStats:{hp:78,attack:84,defense:78,specialAttack:109,specialDefense:85,speed:100},maxHp:180,currentHp:180};
const venusaur={speciesName:'Venusaur',types:['grass','poison'],
 baseStats:{hp:80,attack:82,defense:83,specialAttack:100,specialDefense:100,speed:80},
 maxHp:120,currentHp:72};
const fire={name:'Flamethrower',type:'fire',category:'special'};
const calculate=(overrides={})=>calculateDamage({attacker:charizard,defender:venusaur,move:fire,dice:'3d8',...overrides});

test('dice expression parser preserves min, average, maximum and fixed modifiers',()=>{
 const d=parseDice('3d8 + 2');
 assert.equal(d.min,5);assert.equal(d.max,26);assert.equal(d.average,15.5);
 assert.equal(parseDice('15').average,15);
 assert.equal(rollDice('2d6+2',()=>0),4);
 assert.equal(rollDice('2d6+2',()=>.999),14);
 assert.throws(()=>parseDice('eval(123)'),/dice/);
 assert.throws(()=>parseDice('100d20'),/dice/);
});

test('V5.2 physical vs special table and final once-only rounding',()=>{
 const r=calculate({weather:'sun'});
 assert.equal(r.offense,1.6);
 assert.equal(r.defense,.65);
 assert.equal(r.typeMultiplier,2);
 assert.equal(r.stab,1.5);
 assert.equal(r.weatherMultiplier,1.5);
 assert.equal(r.average,Math.floor(13.5*1.6*.65*2*1.5*1.5));
 assert.equal(r.roundedBy,'down');
});

test('GM-configured V5.2 tier values take precedence',()=>{
 const r=calculate({dice:'10',rules:{offenseBands:[.6,.8,1,1.2,1.4,3],defenseBands:[1.7,1.3,1.05,.9,.75,1]}});
 assert.equal(r.offense,3);
 assert.equal(r.defense,1);
});

test('type immunities override flat held item bonuses',()=>{
 const defender={...venusaur,types:['ghost']};
 const r=calculate({attacker:{...charizard,heldItem:'Life Orb'},defender,move:{name:'Quick Attack',type:'normal',category:'physical'},dice:'10'});
 assert.equal(r.min,0);assert.equal(r.max,0);assert.equal(r.flatBonus,2);
});

test('both Tera STAB and old-type STAB are supported',()=>{
 const tera={...charizard,tera:true,teraType:'fire',originalTypes:['fire','flying'],types:['fire']};
 assert.equal(stabMultiplier(tera,'fire'),2);
 assert.equal(stabMultiplier(tera,'flying'),1.5);
 assert.equal(stabMultiplier({...tera,teraType:'dragon',types:['dragon']},'dragon'),1.5);
});

test('Calamitous Sun removes Fire resistances without affecting immunity',()=>{
 assert.equal(typeEffectiveness('fire',['water','dragon']).multiplier,.25);
 assert.equal(typeEffectiveness('fire',['water','dragon'],{calamitousSun:true}).multiplier,1);
 const r=calculate({attacker:{...charizard,ability:'Calamitous Sun'},defender:{...venusaur,types:['water','dragon']}});
 assert.equal(r.typeMultiplier,1);
});

test('critical hit, burn and held-item flat bonuses affect the right category',()=>{
 const original=calculate({dice:'10',weather:'none'}).average;
 const critical=calculate({dice:'10',critical:true}).average;
 assert.ok(critical>original);
 const physical={name:'Tackle',type:'normal',category:'physical'};
 const base=calculate({move:physical,dice:'10'});
 const burned=calculate({move:physical,dice:'10',burned:true});
 assert.ok(burned.average<base.average);
 assert.equal(calculate({move:physical,dice:'10',burned:true,attacker:{...charizard,ability:'Guts'}}).burnMultiplier,1);
 assert.equal(calculate({attacker:{...charizard,heldItem:'Choice Specs'},dice:'10'}).flatBonus,3);
 assert.equal(calculate({attacker:{...charizard,heldItem:'Choice Band'},dice:'10'}).flatBonus,0);
});

test('status moves have no direct damage roll',()=>{
 assert.equal(calculateDamage({attacker:charizard,defender:venusaur,move:{name:'Protect',type:'normal',category:'status'}}).status,true);
});

test('Mega Z automatically selects its new Sp. Attack tier',()=>{
 const z={...charizard,baseStats:{...charizard.baseStats,specialAttack:200},types:['fire','dragon'],ability:'Calamitous Sun'};
 const r=calculate({attacker:z,dice:'10'});
 assert.equal(r.attackStat,200);
 assert.equal(r.offense,2.75);
});
