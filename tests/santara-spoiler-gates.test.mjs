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
test('player party and calculator use the spoiler gate',()=>{
 const party=readFileSync(new URL('../pokemon-party.js',import.meta.url),'utf8');
 const calculator=readFileSync(new URL('../santara-damage-calculator.js',import.meta.url),'utf8');
 assert.match(party,/playerVisibleCustomSpecies\(customs,pokemon\)\.map/);
 assert.match(party,/if\(isUnreleasedEclipse\(q\)/);
 assert.match(party,/const found=playerVisibleCustomSpecies\(customs,pokemon\)\.find/);
 assert.match(calculator,/const customSpecies=playerVisibleCustomSpecies\(c\.docs\.map/);
});
