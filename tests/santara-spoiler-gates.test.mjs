import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isUnreleasedEclipse,ownsEclipseForm,playerVisibleCustomSpecies} from '../santara-spoiler-gates.js';

const species=[
 {slug:'riolu',name:'Riolu'},
 {slug:'yveltal-eclipse-forme',name:'Yveltal Eclipse Forme'},
 {slug:'yveltal',name:'Yveltal'},
 {slug:'spinotroleum',name:'Spinotroleum'}
];
const owned=[{speciesKey:'riolu',speciesName:'Riolu'}];
test('unreleased form is hidden while the ordinary Yveltal remains available',()=>{
 assert.equal(isUnreleasedEclipse('Yveltal Eclipse Forme'),true);
 assert.equal(isUnreleasedEclipse('custom:yveltal-eclipse-forme'),true);
 assert.equal(isUnreleasedEclipse('yveltal-eclipse'),true);
 assert.equal(isUnreleasedEclipse('Yveltal'),false);
 assert.equal(isUnreleasedEclipse('Eclipse'),false);
 assert.deepEqual(playerVisibleCustomSpecies(species,owned).map(x=>x.name),
 ['Riolu','Yveltal','Spinotroleum']);
 assert.equal(ownsEclipseForm(owned),false);
});
test('GM-assigned form becomes an intentional player unlock',()=>{
 const assigned=[...owned,{speciesKey:'custom:yveltal-eclipse-forme',speciesName:'Yveltal Eclipse Forme'}];
 assert.equal(ownsEclipseForm(assigned),true);
 assert.equal(playerVisibleCustomSpecies(species,assigned).length,4);
});
test('player party and calculator still gate unpublished story forms',()=>{
 const party=readFileSync(new URL('../pokemon-party.js',import.meta.url),'utf8');
 const calc=readFileSync(new URL('../santara-damage-calculator.js',import.meta.url),'utf8');
 assert.ok(party.includes('availableCustomSpecies()'));
 assert.ok(party.includes('if(isUnreleasedEclipse(q)'));
 assert.ok(party.includes('const found=availableCustomSpecies().find'));
 assert.ok(calc.includes("visiblePlayerContent('species'"));
 assert.ok(calc.includes('playerVisibleCustomSpecies('));
});
test('a direct GM reveal unlocks an unreleased story form',()=>{
 const shown=playerVisibleCustomSpecies(species,owned,{speciesUnlocks:['yveltal-eclipse-forme']});
 assert.equal(shown.length,4);
});
