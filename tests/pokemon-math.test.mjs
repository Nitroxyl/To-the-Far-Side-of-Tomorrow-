import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../pokemon-math.js',import.meta.url),'utf8');
const {fromPokeApi,maxHpV4Baseline,maxHpV53,hpAfterMaxChange,dndLevel,proficiencyBonus,levelDamageMultiplier,statBand,tierMultiplier,combatSummary,validStats,V52_TIERS}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(code));
const baseStats={hp:40,attack:70,defense:40,specialAttack:35,specialDefense:40,speed:60};
test('imports official Riolu stats, typing, abilities and artwork',()=>{
 const m=fromPokeApi({
  name:'riolu',stats:Object.entries({hp:40,attack:70,defense:40,'special-attack':35,'special-defense':40,speed:60}).map(([name,base_stat])=>({stat:{name},base_stat})),
  types:[{slot:1,type:{name:'fighting'}}],abilities:[{ability:{name:'inner-focus'}}],
  moves:[{move:{name:'quick-attack'}}],sprites:{front_default:'https://example.com/riolu.png'}
 });
 assert.deepEqual(m.baseStats,baseStats);
 assert.deepEqual(m.types,['fighting']);
 assert.deepEqual(m.abilities,['inner-focus']);
 assert.deepEqual(m.knownMoves,['quick-attack']);
});
test('uses 12 V5.2 brackets, with 200–249 and 250+ at the end',()=>{
 assert.equal(validStats(baseStats),true);
 assert.equal(validStats({...baseStats,attack:-1}),false);
 assert.equal(V52_TIERS.length,12);
 assert.equal(statBand(19),'0–19');
 assert.equal(statBand(20),'20–39');
 assert.equal(statBand(199),'180–199');
 assert.equal(statBand(200),'200–249');
 assert.equal(statBand(249),'200–249');
 assert.equal(statBand(250),'250+');
 assert.equal(statBand(255),'250+');
});
test('V5.2 provides published multipliers without requiring a Firestore rule config',()=>{
 const summary=combatSummary({baseStats,maxHp:62});
 assert.equal(summary.universalAC,13);
 assert.equal(summary.universalAcFormula,'11 + proficiency bonus');
 assert.equal(summary.physicalOffenseMultiplier,1.2);
 assert.equal(summary.specialOffenseMultiplier,0.8);
 assert.equal(summary.physicalDefenseMultiplier,1.05);
 assert.equal(summary.specialDefenseMultiplier,1.05);
 assert.equal(tierMultiplier(200,null,'offense'),2.75);
 assert.equal(tierMultiplier(249,null,'defense'),0.35);
 assert.equal(tierMultiplier(250,null,'offense'),3.25);
 assert.equal(tierMultiplier(250,null,'defense'),0.3);
 assert.equal(maxHpV4Baseline(baseStats,12),62);
});
test('a GM override may replace the built-in V5.2 values',()=>{
 const rules={universalAc:12,offenseBands:Array.from({length:12},(_,i)=>i/10+0.5),defenseBands:Array.from({length:12},(_,i)=>i/10+0.6)};
 const summary=combatSummary({baseStats,maxHp:62},rules);
 assert.equal(summary.universalAC,12);
 assert.equal(summary.physicalOffenseMultiplier,0.8);
 assert.equal(summary.specialOffenseMultiplier,0.6);
 assert.equal(summary.physicalDefenseMultiplier,0.8);
 assert.equal(tierMultiplier(200,rules.offenseBands),1.5);
});

test('V5.3 maps 100 Pokémon levels to 20 D&D levels',()=>{
 assert.equal(dndLevel(1),1);
 assert.equal(dndLevel(5),1);
 assert.equal(dndLevel(6),2);
 assert.equal(dndLevel(10),2);
 assert.equal(dndLevel(21),5);
 assert.equal(dndLevel(50),10);
 assert.equal(dndLevel(75),15);
 assert.equal(dndLevel(100),20);
});
test('V5.3 proficiency and default AC advance at D&D milestones',()=>{
 const stats={hp:85,attack:120,defense:70,specialAttack:50,specialDefense:60,speed:100};
 for(const [pokemon,bonus] of [[1,2],[20,2],[21,3],[40,3],[41,4],[60,4],[61,5],[80,5],[81,6],[100,6]]){
  assert.equal(proficiencyBonus(pokemon),bonus);
  const sheet=combatSummary({baseStats:stats,level:pokemon,maxHp:50});
  assert.equal(sheet.proficiencyBonus,bonus);
  assert.equal(sheet.universalAC,11+bonus);
 }
 assert.equal(combatSummary({baseStats:stats,level:100,maxHp:200},{universalAc:23}).universalAC,23);
});
test('V5.3 HP distinguishes bulk and grows smoothly',()=>{
 const star={hp:85},lucario={hp:70},snorlax={hp:160};
 assert.equal(maxHpV53(star,1),17);
 assert.equal(maxHpV53(star,10),33);
 assert.equal(maxHpV53(star,25),60);
 assert.equal(maxHpV53(star,50),105);
 assert.equal(maxHpV53(star,100),195);
 assert.equal(maxHpV53(lucario,10),30);
 assert.equal(maxHpV53(snorlax,10),47);
 assert.equal(maxHpV53(snorlax,100),299);
 assert.ok(maxHpV53(star,11)>maxHpV53(star,10));
});
test('V5.3 damage multiplier combines with original stat tier (without replacing it)',()=>{
 assert.equal(levelDamageMultiplier(10),1.1);
 assert.equal(levelDamageMultiplier(50),1.5);
 assert.equal(levelDamageMultiplier(100),2);
 const s={hp:85,attack:120,defense:70,specialAttack:50,specialDefense:60,speed:100};
 const d=combatSummary({baseStats:s,level:50,maxHp:105});
 assert.equal(d.physicalOffenseMultiplier,1.8);
 assert.ok(Math.abs(d.levelledPhysicalOffenseMultiplier-2.7)<1e-9);
 assert.equal(d.levelledSpecialOffenseMultiplier,1.5);
});
test('Leveling preserves missing HP and does not revive a fainted Pokémon',()=>{
 assert.equal(hpAfterMaxChange(23,33,42),32);
 assert.equal(hpAfterMaxChange(0,33,42),0);
 assert.equal(hpAfterMaxChange(33,33,42),42);
 assert.equal(hpAfterMaxChange(12,33,30),9);
 assert.equal(hpAfterMaxChange(12,33,8),0);
});
test('Both editions show V5.3 stats and an explicit HP recalculation control',()=>{
 const app=readFileSync(new URL('../pokemon-party.js',import.meta.url),'utf8');
 assert.match(app,/maxHpV53/);
 assert.match(app,/levelledPhysicalOffenseMultiplier/);
 assert.match(app,/levelDamageMultiplier/);
 assert.match(app,/data-act="recalc-hp"/);
 assert.match(app,/hpAfterMaxChange/);
 assert.match(app,/V5\.3: damage dice/);
 assert.doesNotMatch(app,/maxHpV4Baseline\(/);
});
