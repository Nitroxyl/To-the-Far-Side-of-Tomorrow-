// Official Megas are discovered from PokéAPI species varieties, not a
// manually curated list. GM Firestore definitions take precedence when a
// species/form name matches, so Santara reworks remain authoritative.
import {fromPokeApi} from './pokemon-math.js';

export function megaDisplayName(id) {
 const parts=String(id||'').toLowerCase().split('-mega-');
 const base=parts[0]||'';
 const variant=(parts[1]||'').split('-').filter(Boolean);
 const title=s=>s.split('-').map(x=>x?x[0].toUpperCase()+x.slice(1):'').join(' ');
 return 'Mega '+title(base)+(variant.length?' '+variant.map(title).join(' '):'');
}
export function mergeMegaOptions(official=[],registered=[]) {
 const byName=new Map();
 // Register official first, then override with GM-custom definitions by name.
 for(const entry of [...official,...registered]) {
  if(!entry||!entry.slug||!entry.name)continue;
  byName.set(entry.name.toLowerCase().replace(/[^a-z0-9]/g,''),entry);
 }
 return [...byName.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
export async function discoverOfficialMegas(speciesKey,fetchFn=fetch) {
 const key=String(speciesKey||'').toLowerCase();
 if(!/^[a-z0-9-]{2,100}$/.test(key))return [];
 const resource=await fetchFn('https://pokeapi.co/api/v2/pokemon-species/'+encodeURIComponent(key)+'/');
 if(!resource.ok)throw Error('Species lookup failed ('+resource.status+').');
 const species=await resource.json();
 const varieties=(species.varieties||[]).map(x=>x.pokemon?.name||'')
  .filter(name=>/-mega(?:-|$)/.test(name));
 const results=await Promise.allSettled(varieties.map(async name=>{
  const r=await fetchFn('https://pokeapi.co/api/v2/pokemon/'+encodeURIComponent(name)+'/');
  if(!r.ok)throw Error('Mega '+name+' unavailable ('+r.status+').');
  const parsed=fromPokeApi(await r.json());
  const ability=parsed.abilities?.[0]||'';
  if(!ability)throw Error('Missing Mega ability for '+name);
  return {
   slug:name,name:megaDisplayName(name),baseSpeciesKey:key,
   baseStats:parsed.baseStats,types:parsed.types,ability,
   spriteUrl:parsed.spriteUrl||'',spriteData:'',source:'official'
  };
 }));
 const loaded=results.filter(x=>x.status==='fulfilled').map(x=>x.value);
 if(varieties.length&&!loaded.length)throw Error('Unable to load official Mega forms for '+key+'.');
 return loaded;
}
