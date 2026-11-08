import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const files=['pokemon-forms-learnsets.js','pokemon-math.js'];
const [mod,math]=files.map(p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const api=new Function(mod.replace(/^export /gm,'')+math.replace(/^export /gm,'')+
 '\nreturn {discoverPokemonForms,pokemonLookupKey,readableForm,isGimmickVariety,customMoveScope,customMoveEligible,legalMove,eligibleMoveNames,validCustomMoveScope,fromPokeApi};')();
const {
 discoverPokemonForms,pokemonLookupKey,readableForm,isGimmickVariety,
 customMoveScope,customMoveEligible,legalMove,eligibleMoveNames,validCustomMoveScope,fromPokeApi
}=api;
function mockApi(url){
 let json=null;
 if(url.endsWith('/pokemon-species/growlithe/'))json={varieties:[
  {is_default:true,pokemon:{name:'growlithe'}},{is_default:false,pokemon:{name:'growlithe-hisui'}}
 ]};
 if(url.endsWith('/pokemon-form/growlithe-hisui/'))json={is_battle_only:false,is_mega:false};
 if(url.endsWith('/pokemon-species/charizard/'))json={varieties:[
  {is_default:true,pokemon:{name:'charizard'}},{is_default:false,pokemon:{name:'charizard-mega-x'}},
  {is_default:false,pokemon:{name:'charizard-mega-y'}},{is_default:false,pokemon:{name:'charizard-gmax'}}
 ]};
 if(url.endsWith('/pokemon-species/aegislash/'))json={varieties:[
  {is_default:true,pokemon:{name:'aegislash-shield'}},{is_default:false,pokemon:{name:'aegislash-blade'}}
 ]};
 if(url.endsWith('/pokemon-form/aegislash-blade/'))json={is_battle_only:true,is_mega:false};
 return Promise.resolve({ok:json!==null,status:json===null?404:200,json:async()=>json});
}
test('Growlithe can select its actual Hisuian form and not a Mega',async()=>{
 const forms=await discoverPokemonForms('growlithe',mockApi);
 assert.deepEqual(forms.map(f=>f.id),['growlithe','growlithe-hisui']);
 assert.equal(forms[1].label,'Growlithe (Hisuian)');
 assert.equal(pokemonLookupKey(forms[1].label),'growlithe-hisui');
});
test('Battle-only and Mega forms never appear in normal species choices',async()=>{
 assert.deepEqual((await discoverPokemonForms('charizard',mockApi)).map(f=>f.id),['charizard']);
 assert.deepEqual((await discoverPokemonForms('aegislash',mockApi)).map(f=>f.id),['aegislash-shield']);
 assert.equal(isGimmickVariety('charizard-mega-x'),true);
});
test('Region and alternative labels round-trip back to a Pokémon API identifier',()=>{
 assert.equal(pokemonLookupKey('Tauros (Paldean Combat Breed)'),'tauros-paldea-combat-breed');
 assert.equal(pokemonLookupKey('Growlithe (Standard)'),'growlithe');
 assert.equal(readableForm('rotom-wash','rotom'),'Rotom (Wash)');
});
test('Regional Pokémon use exact form-specific stats and moves',()=>{
 const raw={name:'growlithe-hisui',species:{name:'growlithe'},stats:[
  ['hp',60],['attack',75],['defense',45],['special-attack',65],['special-defense',50],['speed',55]
 ].map(([name,base_stat])=>({stat:{name},base_stat})),types:[
  {slot:1,type:{name:'fire'}},{slot:2,type:{name:'rock'}}
 ],abilities:[{ability:{name:'intimidate'}}],moves:[{move:{name:'rock-slide'}},{move:{name:'flame-wheel'}}],
 sprites:{front_default:''}};
 const mon=fromPokeApi(raw);
 assert.equal(mon.speciesKey,'growlithe-hisui');
 assert.equal(mon.parentSpeciesKey,'growlithe');
 assert.deepEqual(mon.types,['fire','rock']);
 assert.ok(legalMove('Rock Slide',mon,[],''));
 assert.equal(legalMove('Roost',mon,[],''),false);
});
test('Infernal Sweep remains exclusive to the assigned Mega Charizard Z',()=>{
 const legacy={name:'Infernal Sweep'};
 const growlithe={speciesKey:'growlithe-hisui',knownMoves:['flame-wheel','rock-slide']};
 const charizard={speciesKey:'charizard',knownMoves:['flamethrower','roost']};
 assert.equal(customMoveEligible(legacy,growlithe,'mega-charizard-z'),false);
 assert.equal(customMoveEligible(legacy,charizard,''),false);
 assert.equal(customMoveEligible(legacy,charizard,'charizard-mega-y'),false);
 assert.equal(customMoveEligible(legacy,charizard,'mega-charizard-z'),true);
 assert.ok(!eligibleMoveNames(growlithe,[legacy],'').includes('Infernal Sweep'));
 assert.ok(eligibleMoveNames(charizard,[legacy],'mega-charizard-z').includes('Infernal Sweep'));
});
test('Other custom moves require an explicit allowlist, not universal availability',()=>{
 const m={name:'New Signature'};
 const mon={speciesKey:'custom:spinotroleum',knownMoves:['tackle']};
 assert.deepEqual(customMoveScope(m).allowedSpeciesKeys,[]);
 assert.equal(legalMove('New Signature',mon,[m],''),false);
 assert.equal(legalMove('Tackle',mon,[m],''),true);
 const scoped={...m,allowedSpeciesKeys:['custom:spinotroleum'],requiredMegaSlug:''};
 assert.equal(legalMove('New Signature',mon,[scoped],''),true);
 assert.equal(legalMove('New Signature',{speciesKey:'growlithe',knownMoves:['tackle']},[scoped],''),false);
});
test('Explicit all-species custom moves are possible but Mega exclusivity cannot be wildcarded',()=>{
 assert.ok(validCustomMoveScope({allowedSpeciesKeys:['*'],requiredMegaSlug:''}));
 assert.equal(validCustomMoveScope({allowedSpeciesKeys:['*'],requiredMegaSlug:'mega-charizard-z'}),false);
 const shared={name:'General Move',allowedSpeciesKeys:['*'],requiredMegaSlug:''};
 assert.ok(legalMove('General Move',{speciesKey:'growlithe',knownMoves:[]},[shared],''));
});
