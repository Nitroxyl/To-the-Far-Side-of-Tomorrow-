// Species varieties and move eligibility shared by Santara's GM and Player apps.
// PokéAPI /pokemon-species/{species}/varieties contains distinct regional and
// alternate Pokémon records. /pokemon-form/{variety} identifies battle-only forms.
// Mega, Primal, Gigantamax, Totem, etc. remain separate gimmicks.
const REGIONS={alola:'Alolan',galar:'Galarian',hisui:'Hisuian',paldea:'Paldean'};
const EXCLUDED=/(?:^|-)(mega|gmax|gigantamax|primal|totem|eternamax)(?:-|$)/;
const FALLBACK_BATTLE=/(?:^|-)(zen|school|busted|gulping|gorging|hero|noice|hangry|sunshine|ash|complete|battle-bond)(?:-|$)/;
const PRIOR_SCOPES={
 'infernal-sweep':{allowedSpeciesKeys:['charizard'],requiredMegaSlug:'mega-charizard-z'},
 'schradebreaker':{allowedSpeciesKeys:['charizard'],requiredMegaSlug:'mega-charizard-z'},
 'schrade-s-end':{allowedSpeciesKeys:['charizard'],requiredMegaSlug:'mega-charizard-z'},
 'tar-rend':{allowedSpeciesKeys:['custom:spinotroleum'],requiredMegaSlug:''},
 'riptide-bite':{allowedSpeciesKeys:['custom:mosasord'],requiredMegaSlug:''},
 'faultline-gore':{allowedSpeciesKeys:['custom:carnotremor'],requiredMegaSlug:''}
};
export const LEGACY_MOVE_SCOPES=PRIOR_SCOPES;
export function speciesKey(value){
 return String(value||'').trim().toLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g,'').replace(/♀/g,'-f').replace(/♂/g,'-m')
  .replace(/['’]/g,'').replace(/[^a-z0-9*:]+/g,'-')
  .replace(/-+/g,'-').replace(/^-|-$/g,'');
}
export function pokemonLookupKey(value){
 const raw=String(value||'').trim();
 const inverse={alolan:'alola',galarian:'galar',hisuian:'hisui',paldean:'paldea'};
 const paren=raw.match(/^(.+?)\s*\(([^)]+)\)$/);
 if(paren){
  const root=speciesKey(paren[1]);
  const suffix=speciesKey(paren[2]).replace(/^(alolan|galarian|hisuian|paldean)(?=-|$)/,x=>inverse[x]||x);
  return suffix==='standard'?root:root+'-'+suffix;
 }
 const key=speciesKey(raw);
 // Support "Hisuian Growlithe" and "Growlithe Hisuian", alongside API IDs.
 const prefix=key.match(/^(alolan|galarian|hisuian|paldean)-(.+)$/);
 if(prefix)return prefix[2]+'-'+inverse[prefix[1]];
 const suffix=key.match(/^(.+)-(alolan|galarian|hisuian|paldean)$/);
 if(suffix)return suffix[1]+'-'+inverse[suffix[2]];
 return key;
}
export function moveKey(value){return String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
export function readableForm(name,base){
 const id=speciesKey(name),parent=speciesKey(base||name);
 const head=parent.split('-').map(s=>s?s[0].toUpperCase()+s.slice(1):'').join(' ');
 if(id===parent)return head+' (Standard)';
 const suffix=id.startsWith(parent+'-')?id.slice(parent.length+1):id;
 const formatted=suffix.split('-').map(s=>REGIONS[s]||s[0]?.toUpperCase()+s.slice(1)).join(' ');
 return head+' ('+formatted+')';
}
export function isGimmickVariety(name){
 return EXCLUDED.test(speciesKey(name));
}
// Abort requests and settle the lookup even if a fetch implementation ignores abort.
export async function fetchPokeApi(url,fetchFn=fetch,timeoutMs=9000){
 const controller=new AbortController();
 let timer;
 try{
  return await Promise.race([
   Promise.resolve().then(()=>fetchFn(url,{signal:controller.signal})),
   new Promise((_,reject)=>{timer=setTimeout(()=>{
    controller.abort();
    reject(Error('PokéAPI took too long to respond. Please try again.'));
   },timeoutMs)})
  ]);
 }catch(error){
  if(error?.message?.startsWith('PokéAPI took too long'))throw error;
  if(error?.name==='AbortError')throw Error('PokéAPI request timed out. Please try again.');
  throw Error('Cannot reach PokéAPI. Check your connection and try again.');
 }finally{clearTimeout(timer)}
}
export async function discoverPokemonForms(base, fetchFn=fetch){
 const root=speciesKey(base);
 if(!/^[a-z0-9-]{2,100}$/.test(root))return [];
 const r=await fetchPokeApi('https://pokeapi.co/api/v2/pokemon-species/'+encodeURIComponent(root)+'/',fetchFn);
 if(!r.ok)throw Error('Could not load official forms for '+root+'.');
 const species=await r.json();
 const varieties=(species.varieties||[]).map(v=>({name:speciesKey(v.pokemon?.name),default:Boolean(v.is_default)}))
  .filter(v=>v.name && !isGimmickVariety(v.name));
 const results=await Promise.all(varieties.map(async v=>{
  if(v.default||v.name===root)return {id:v.name,label:readableForm(v.name,root)};
  try{
   const form=await fetchPokeApi('https://pokeapi.co/api/v2/pokemon-form/'+encodeURIComponent(v.name)+'/',fetchFn);
   if(!form.ok)throw Error('Form metadata unavailable');
   const data=await form.json();
   if(data.is_mega||data.is_battle_only)return null;
  }catch{
   // Only allow known regional variants when the form metadata service is
   // unavailable. Unknown forms might be a temporary battle transformation.
   if(!/(?:^|-)(alola|galar|hisui|paldea)(?:-|$)/.test(v.name)||FALLBACK_BATTLE.test(v.name))return null;
  }
  return {id:v.name,label:readableForm(v.name,root)};
 }));
 const found=results.filter(Boolean);
 // Some species have no /pokemon/{species}/ resource: their default record
 // is instead /pokemon/aegislash-shield, basculin-red-striped, etc.
 if(!found.length)throw Error('No permanent Pokémon form found for '+root+'.');
 const defaultId=varieties.find(x=>x.default)?.name||root;
 const seen=new Set();
 return found.filter(x=>!seen.has(x.id)&&seen.add(x.id)).sort((a,b)=>a.id===defaultId?-1:b.id===defaultId?1:a.label.localeCompare(b.label));
}
export function customMoveScope(record){
 const legacy=PRIOR_SCOPES[moveKey(record?.name||record?.slug)];
 // Old custom moves must not become universal by default.
 const allowed=Array.isArray(record?.allowedSpeciesKeys)?record.allowedSpeciesKeys:legacy?.allowedSpeciesKeys||[];
 const mega=typeof record?.requiredMegaSlug==='string'?record.requiredMegaSlug:legacy?.requiredMegaSlug||'';
 return {allowedSpeciesKeys:allowed.map(speciesKey).filter(Boolean),requiredMegaSlug:speciesKey(mega)};
}
export function validCustomMoveScope(scope){
 const allowed=scope?.allowedSpeciesKeys,mega=speciesKey(scope?.requiredMegaSlug);
 if(!Array.isArray(allowed)||allowed.length>30)return false;
 if(allowed.some(x=>!/^(\*|(?:custom:)?[a-z0-9-]{2,110})$/.test(speciesKey(x))))return false;
 if(mega&&!/^[a-z0-9-]{2,70}$/.test(mega))return false;
 if(mega&&(!allowed.length||allowed.includes('*')))return false;
 return true;
}
export function customMoveEligible(move,mon,megaSlug=''){
 if(!move||!mon?.speciesKey)return false;
 const scope=customMoveScope(move);
 if(!scope.allowedSpeciesKeys.length)return false;
 const key=speciesKey(mon.speciesKey);
 const base=speciesKey(mon.parentSpeciesKey||mon.speciesKey);
 // Species keys are exact; e.g. growlithe does not grant growlithe-hisui.
 if(!scope.allowedSpeciesKeys.some(x=>x==='*'||x===key))return false;
 if(scope.requiredMegaSlug&&scope.requiredMegaSlug!==speciesKey(megaSlug||mon.megaForm?.slug))return false;
 return true;
}

export const LEARNSET_GAME_PRIORITY=Object.freeze([
 'scarlet-violet','sword-shield','brilliant-diamond-and-shining-pearl','legends-arceus',
 'ultra-sun-ultra-moon','sun-moon','omega-ruby-alpha-sapphire','x-y','black-2-white-2',
 'black-white','heartgold-soulsilver','platinum','diamond-pearl','emerald',
 'firered-leafgreen','ruby-sapphire','crystal','gold-silver','yellow','red-blue'
]);
export function officialMoveCatalog(pokemon,preferredGame=''){
 // Machine, level-up, egg and tutor moves are scoped to the exact form and game.
 const entries=Array.isArray(pokemon?.moves)?pokemon.moves:[];
 const versions=new Set();
 for(const item of entries)for(const detail of item?.version_group_details||[]){
  if(detail?.version_group?.name)versions.add(detail.version_group.name);
 }
 const pref=speciesKey(preferredGame);
 const versionGroup=(pref&&versions.has(pref)?pref:null)
  ||LEARNSET_GAME_PRIORITY.find(v=>versions.has(v))
  ||[...versions].sort().at(-1)||'';
 const methods=new Map();
 if(versionGroup)for(const item of entries){
  const key=moveKey(item?.move?.name);
  if(!key)continue;
  for(const detail of item?.version_group_details||[]){
   if(detail?.version_group?.name!==versionGroup)continue;
   if(!methods.has(key))methods.set(key,new Set());
   methods.get(key).add(detail?.move_learn_method?.name||'unknown');
  }
 }
 return {versionGroup,knownMoves:[...methods.keys()].sort(),
  moveMethods:Object.fromEntries([...methods].map(([k,v])=>[k,[...v].sort()])),
  tmMoves:[...methods].filter(([k,v])=>v.has('machine')).map(([k])=>k).sort()};
}
export function officialMoveSource(mon,name){
 const dict={'machine':'TM','level-up':'Level-up','egg':'Egg/reminder','tutor':'Tutor','evolution':'Evolution'};
 return (mon?.moveMethods?.[moveKey(name)]||[]).map(method=>dict[method]||method).join(' · ');
}


export function customAbilityScope(record){
 const list=Array.isArray(record?.allowedSpeciesKeys)?record.allowedSpeciesKeys:[];
 return {allowedSpeciesKeys:list.map(speciesKey).filter(Boolean)};
}
export function validCustomAbilityScope(scope){
 return validCustomMoveScope({allowedSpeciesKeys:scope?.allowedSpeciesKeys,requiredMegaSlug:''});
}
export function customAbilityEligible(record,mon){
 if(!record||!mon?.speciesKey)return false;
 const keys=customAbilityScope(record).allowedSpeciesKeys;
 return keys.includes('*')||keys.includes(speciesKey(mon.speciesKey));
}
export function eligibleAbilityNames(mon,definitions){
 const native=Array.isArray(mon?.abilities)?mon.abilities:[];
 const custom=(definitions||[]).filter(x=>customAbilityEligible(x,mon)).map(x=>x.name);
 return [...new Map([...native,...custom].filter(Boolean).map(x=>[speciesKey(x),x])).values()];
}
export function legalAbility(name,mon,definitions){
 const key=speciesKey(name);
 if(!key||!mon?.speciesKey)return false;
 if((mon.abilities||[]).some(x=>speciesKey(x)===key))return true;
 return (definitions||[]).some(x=>speciesKey(x.name)===key&&customAbilityEligible(x,mon));
}

export function officialLearnset(mon){
 return (Array.isArray(mon?.knownMoves)?mon.knownMoves:[]).map(moveKey).filter(Boolean);
}
export function legalMove(name,mon,customMoves,megaSlug){
 const key=moveKey(name);
 if(!key)return false;
 const custom=(customMoves||[]).find(x=>moveKey(x.name||x.slug)===key);
 if(custom)return customMoveEligible(custom,mon,megaSlug);
 return officialLearnset(mon).includes(key);
}
export function eligibleMoveNames(mon,customMoves,megaSlug){
 const official=Array.isArray(mon?.knownMoves)?mon.knownMoves:[];
 const custom=(customMoves||[]).filter(x=>customMoveEligible(x,mon,megaSlug)).map(x=>x.name);
 const result=[...official,...custom].map(x=>String(x||'').replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase()));
 return [...new Map(result.filter(Boolean).map(name=>[moveKey(name),name])).values()].sort((a,b)=>a.localeCompare(b));
}
