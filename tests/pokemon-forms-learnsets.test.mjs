import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const files=['pokemon-forms-learnsets.js','pokemon-math.js'];
const [mod,math]=files.map(p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const api=new Function(mod.replace(/^export /gm,'')+math.replace(/^export /gm,'')+
 '\nreturn {officialFamilyMoveCatalog,historicalMoveCatalog,preEvolutionVariety,customAbilityScope,validCustomAbilityScope,customAbilityEligible,eligibleAbilityNames,legalAbility,officialMoveCatalog,officialMoveSource,fetchPokeApi,discoverPokemonForms,pokemonLookupKey,readableForm,isGimmickVariety,customMoveScope,customMoveEligible,legalMove,eligibleMoveNames,validCustomMoveScope,fromPokeApi};')();
const {
 officialFamilyMoveCatalog,historicalMoveCatalog,preEvolutionVariety,customAbilityScope,validCustomAbilityScope,customAbilityEligible,eligibleAbilityNames,legalAbility,officialMoveCatalog,officialMoveSource,fetchPokeApi,discoverPokemonForms,pokemonLookupKey,readableForm,isGimmickVariety,
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
 assert.equal(pokemonLookupKey("Farfetch'd (Galarian)"),'farfetchd-galar');
 assert.equal(pokemonLookupKey('Mr. Mime (Galarian)'),'mr-mime-galar');
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

test('Regional form names in normal language resolve to PokéAPI identifiers',()=>{
 assert.equal(pokemonLookupKey('Hisuian Growlithe'),'growlithe-hisui');
 assert.equal(pokemonLookupKey('Growlithe Hisuian'),'growlithe-hisui');
 assert.equal(pokemonLookupKey('Alolan Raichu'),'raichu-alola');
 assert.equal(pokemonLookupKey('Galarian Mr. Mime'),'mr-mime-galar');
 assert.equal(pokemonLookupKey('growlithe-hisui'),'growlithe-hisui');
});
test('A hanging PokéAPI lookup times out cleanly',async()=>{
 await assert.rejects(fetchPokeApi('https://pokeapi.co/api/v2/pokemon/invalid/',()=>new Promise(()=>{}),15),/too long|timed out/i);
});
test('The app imports its lookup normalizer and releases fetch buttons',()=>{
 const source=readFileSync(new URL('../pokemon-party.js',import.meta.url),'utf8');
 const imports=source.split('\n').find(x=>x.includes("from './pokemon-forms-learnsets.js"));
 assert.ok(imports.includes('pokemonLookupKey')&&imports.includes('fetchPokeApi'));
 assert.match(source,/action==='lookup'\|\|action==='request-lookup'/);
 assert.match(source,/b\.disabled=false/);
});

function fakeLearnMove(name,details){
 return {move:{name},version_group_details:details.map(([version,method])=>({
  version_group:{name:version},move_learn_method:{name:method},level_learned_at:0}))};
}
test('Regular and Hisuian Growlithe keep distinct modern TM lists',()=>{
 const n=officialMoveCatalog({moves:[
  fakeLearnMove('play-rough',[['scarlet-violet','machine']]),
  fakeLearnMove('hidden-power',[['ultra-sun-ultra-moon','machine']]),
  fakeLearnMove('flame-wheel',[['scarlet-violet','level-up']])
 ]});
 const h=officialMoveCatalog({moves:[
  fakeLearnMove('rock-slide',[['scarlet-violet','machine']]),
  fakeLearnMove('stealth-rock',[['scarlet-violet','machine']])
 ]});
 assert.equal(n.versionGroup,'scarlet-violet');
 assert.equal(h.versionGroup,'scarlet-violet');
 assert.deepEqual(n.knownMoves,['flame-wheel','play-rough']);
 assert.deepEqual(h.tmMoves,['rock-slide','stealth-rock']);
 assert.ok(!n.knownMoves.includes('hidden-power'));
 assert.ok(!h.knownMoves.includes('play-rough'));
 assert.equal(officialMoveSource({moveMethods:h.moveMethods},'Rock Slide'),'TM');
});
test('Forms missing Scarlet/Violet use only latest supported game moves',()=>{
 const x=officialMoveCatalog({moves:[
  fakeLearnMove('brutal-swing',[['sword-shield','machine']]),
  fakeLearnMove('cut',[['red-blue','machine']])
 ]});
 assert.equal(x.versionGroup,'sword-shield');
 assert.deepEqual(x.knownMoves,['brutal-swing']);
});
test('Moves without version data are not admitted as all-game TMs',()=>{
 assert.deepEqual(officialMoveCatalog({moves:[{move:{name:'bad'},version_group_details:[]}]}).knownMoves,[]);
});

test('Custom ability form whitelist prevents cross-form usage',()=>{
 const a={name:'Volcanic Hide',allowedSpeciesKeys:['growlithe-hisui']};
 const normal={speciesKey:'growlithe',abilities:['intimidate']};
 const hisui={speciesKey:'growlithe-hisui',abilities:['intimidate','rock-head']};
 assert.equal(customAbilityEligible(a,normal),false);
 assert.equal(customAbilityEligible(a,hisui),true);
 assert.ok(!eligibleAbilityNames(normal,[a]).includes('Volcanic Hide'));
 assert.ok(eligibleAbilityNames(hisui,[a]).includes('Volcanic Hide'));
 assert.equal(legalAbility('Volcanic Hide',normal,[a]),false);
 assert.equal(legalAbility('Volcanic Hide',hisui,[a]),true);
 assert.equal(legalAbility('Intimidate',normal,[a]),true);
});
test('Legacy custom ability is not accidentally universal',()=>{
 const old={name:"Kingdom's End"};
 const charizard={speciesKey:'charizard',abilities:['blaze','solar-power']};
 assert.equal(legalAbility("Kingdom's End",charizard,[old]),false);
 assert.ok(!eligibleAbilityNames(charizard,[old]).includes("Kingdom's End"));
 assert.ok(validCustomAbilityScope({allowedSpeciesKeys:['growlithe-hisui']}));
 assert.ok(!validCustomAbilityScope({allowedSpeciesKeys:Array(31).fill('growlithe')}));
});
test('Explicit custom species abilities remain usable',()=>{
 const original={name:'Apex Predator'};
 assert.equal(legalAbility('Apex Predator',{speciesKey:'custom:spinotroleum',abilities:['Apex Predator']},[original]),true);
 assert.equal(legalAbility('Apex Predator',{speciesKey:'growlithe',abilities:['intimidate']},[original]),false);
});
test('GM assignment filters and validates custom abilities',()=>{
 const text=readFileSync(new URL('../pokemon-party.js',import.meta.url),'utf8');
 assert.match(text,/eligibleAbilityNames\(d,customAbilities\)/);
 assert.match(text,/legalAbility\(selectedAbility,abilityMon,customAbilities\)/);
});

test('Historical Staraptor moves retain Roost learned in BDSP and Legends Arceus',()=>{
 const catalog=historicalMoveCatalog({name:'staraptor',moves:[
  fakeLearnMove('brave-bird',[['scarlet-violet','level-up']]),
  fakeLearnMove('roost',[['brilliant-diamond-and-shining-pearl','machine'],['legends-arceus','level-up']])
 ]});
 assert.ok(catalog.knownMoves.includes('roost'));
 assert.ok(catalog.tmMoves.includes('roost'));
 assert.equal(legalMove('Roost',{speciesKey:'staraptor',knownMoves:catalog.knownMoves},[]),true);
});
test('Hisuian Arcanine gets Head Smash through the matching Hisuian Growlithe line',async()=>{
 const resources={
  'pokemon-species/arcanine':{name:'arcanine',evolves_from_species:{name:'growlithe'}},
  'pokemon-species/growlithe':{name:'growlithe',evolves_from_species:null,varieties:[
   {is_default:true,pokemon:{name:'growlithe'}},
   {is_default:false,pokemon:{name:'growlithe-hisui'}}
  ]},
  'pokemon/growlithe-hisui':{name:'growlithe-hisui',species:{name:'growlithe'},moves:[
   fakeLearnMove('head-smash',[['scarlet-violet','egg']])
  ]},
  'pokemon/growlithe':{name:'growlithe',species:{name:'growlithe'},moves:[
   fakeLearnMove('flame-wheel',[['scarlet-violet','level-up']])
  ]}
 };
 const fetchFn=async url=>{
  const key=url.replace('https://pokeapi.co/api/v2/','').replace(/\/$/,'');
  if(!resources[key])throw Error('Unexpected request '+key);
  return {ok:true,json:async()=>resources[key]};
 };
 const hisui=await officialFamilyMoveCatalog({
  name:'arcanine-hisui',species:{name:'arcanine'},moves:[
   fakeLearnMove('rock-slide',[['scarlet-violet','machine']])
  ]},fetchFn);
 const normal=await officialFamilyMoveCatalog({
  name:'arcanine',species:{name:'arcanine'},moves:[
   fakeLearnMove('extreme-speed',[['scarlet-violet','level-up']])
  ]},fetchFn);
 assert.equal(hisui.incomplete,false);
 assert.deepEqual(hisui.inheritedFrom,['growlithe-hisui']);
 assert.ok(hisui.knownMoves.includes('head-smash'));
 assert.equal(legalMove('Head Smash',{speciesKey:'arcanine-hisui',knownMoves:hisui.knownMoves},[]),true);
 assert.match(officialMoveSource(hisui,'Head Smash'),/Pre-evo Egg/);
 assert.deepEqual(normal.inheritedFrom,['growlithe']);
 assert.ok(!normal.knownMoves.includes('head-smash'));
});
test('Regional evolution chains choose exact regional precursors',()=>{
 const former={name:'growlithe',varieties:[
  {is_default:true,pokemon:{name:'growlithe'}},
  {is_default:false,pokemon:{name:'growlithe-hisui'}}
 ]};
 assert.equal(preEvolutionVariety('arcanine-hisui',former),'growlithe-hisui');
 assert.equal(preEvolutionVariety('arcanine',former),'growlithe');
 assert.equal(preEvolutionVariety('raichu-alola',{name:'pikachu',varieties:[
  {is_default:true,pokemon:{name:'pikachu'}}
 ]}),'pikachu');
});
test('Both sites use the historical family catalogue instead of only Scarlet/Violet',()=>{
 const app=readFileSync(new URL('../pokemon-party.js',import.meta.url),'utf8');
 assert.match(app,/await officialFamilyMoveCatalog\(p\)/);
 assert.match(app,/found\.knownMoves=learns\.knownMoves/);
});
