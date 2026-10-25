import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../pokemon-math.js',import.meta.url),'utf8');
const {fromPokeApi,maxHpV4Baseline,statBand,tierMultiplier,combatSummary,validStats,V52_TIERS}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(code));
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
 assert.equal(summary.universalAC,null);
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
