import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {combatSummary,maxHpV6} from '../pokemon-math.js';

test('Player Pokémon detail no longer renders old V5.3 dice',()=>{
 const source=readFileSync(new URL('../pokemon-party.js',import.meta.url),'utf8');
 assert.ok(!source.includes('Damage dice:'));
 assert.ok(source.includes('V6: Pokémon damage and defenses'));
});
test('V6 HP is the only suggested battle sheet HP',()=>{
 const stats={hp:70,attack:110,defense:70,specialAttack:115,specialDefense:70,speed:90};
 assert.equal(combatSummary({baseStats:stats,level:50,maxHp:145}).suggestedMaxHp,maxHpV6(stats,50));
});
test('Player combat guide exists and links to the calculator and move tracking',()=>{
 const html=readFileSync(new URL('../combat-guide.html',import.meta.url),'utf8');
 assert.match(html,/PLAYER COMBAT REFERENCE/);
 assert.match(html,/damage-calculator.html/);
 assert.match(html,/pokemon-party.html/);
 assert.match(html,/Old damage dice are no longer used/);
 const party=readFileSync(new URL('../pokemon-party.html',import.meta.url),'utf8');
 assert.match(party,/combat-guide.html/);
});
test('V5.3 documentation is prominently marked as archived',()=>{
 const md=readFileSync(new URL('../SANTARA_COMBAT_V53.md',import.meta.url),'utf8');
 assert.match(md.slice(0,250),/ARCHIVED/);
});
