import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const formsCode=readFileSync(new URL('../pokemon-forms-learnsets.js',import.meta.url),'utf8')
 .replace(/\bexport\s+(?=(async\s+)?(const|function)\b)/g,'');
const {applySantaraLearnset,customMoveEligible}=new Function(formsCode+
 '\nreturn {applySantaraLearnset,customMoveEligible};')();

test('Lucario has GM-locked Mach Punch and Wide Guard tutor compatibility',()=>{
 const base={speciesKey:'lucario',knownMoves:['aura-sphere'],
  moveMethods:{},levelUpLevels:{},tmMoves:[]};
 const result=applySantaraLearnset(base);
 assert.ok(result.knownMoves.includes('mach-punch'));
 assert.ok(result.knownMoves.includes('wide-guard'));
 assert.deepEqual(result.moveMethods['mach-punch'],['tutor']);
 assert.deepEqual(result.moveMethods['wide-guard'],['tutor']);
 assert.deepEqual(result.tmMoves,[]);
 assert.deepEqual(result.levelUpLevels,{});
 assert.deepEqual(applySantaraLearnset({speciesKey:'riolu',knownMoves:[]}).knownMoves,[]);
});

test('Aura Lance cannot leak to other Pokémon or the standard Mega',()=>{
 const lance={name:'Aura Lance'},lucario={speciesKey:'lucario'};
 assert.equal(customMoveEligible(lance,lucario,'lucario-mega-z'),true);
 assert.equal(customMoveEligible(lance,lucario,'mega-lucario-z'),true);
 assert.equal(customMoveEligible(lance,lucario,'lucario-mega'),false);
 assert.equal(customMoveEligible(lance,lucario,''),false);
 assert.equal(customMoveEligible(lance,{speciesKey:'riolu'},'lucario-mega-z'),false);
});

test('Player Edition uses the Santara learnset supplement',()=>{
 const code=readFileSync(new URL('../pokemon-party.js',import.meta.url),'utf8');
 assert.match(code,/applySantaraLearnset\(found\)/);
});
