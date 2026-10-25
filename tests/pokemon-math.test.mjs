import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../pokemon-math.js',import.meta.url),'utf8');
const {fromPokeApi,maxHpV4Baseline,statBand,tierMultiplier,combatSummary,validStats}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(code));
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
test('handles bad stats and 20-point boundaries',()=>{
 assert.equal(validStats(baseStats),true);
 assert.equal(validStats({...baseStats,attack:-1}),false);
 assert.equal(statBand(19),'0–19');
 assert.equal(statBand(20),'20–39');
 assert.equal(statBand(200),'200–219');
});
test('does not invent V5.2 AC or multipliers',()=>{
 const m={baseStats,maxHp:62};
 const summary=combatSummary(m);
 assert.equal(summary.universalAC,null);
 assert.equal(summary.physicalOffenseMultiplier,null);
 assert.equal(summary.physicalDefenseMultiplier,null);
 assert.equal(maxHpV4Baseline(baseStats,12),62);
});
test('reads the correct tier when the GM provides V5.2 tables',()=>{
 const rules={universalAc:12,offenseBands:Array.from({length:14},(_,i)=>i/10+0.5),defenseBands:Array.from({length:14},(_,i)=>i/10+0.6)};
 const summary=combatSummary({baseStats,maxHp:62},rules);
 assert.equal(summary.universalAC,12);
 assert.equal(summary.physicalOffenseMultiplier,0.8);
 assert.equal(summary.specialOffenseMultiplier,0.6);
 assert.equal(summary.physicalDefenseMultiplier,0.8);
 assert.equal(tierMultiplier(200,rules.offenseBands),1.5);
});
