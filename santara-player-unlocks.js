// Per-trainer unlocks. The existing santara_trainer_gimmicks/{uid} document
// remains the source of truth. Legacy 4-toggle documents remain valid.
export const GIMMICK_KEYS=Object.freeze(['tera','mega','zMove','dynamax']);
export const GIMMICK_LABELS=Object.freeze({tera:'Terastallization',mega:'Mega Evolution',zMove:'Z-Moves',dynamax:'Dynamax'});
export const UNLOCK_LIST_FIELDS=Object.freeze({
 species:'speciesUnlocks',megaForms:'megaFormUnlocks',moves:'moveUnlocks',
 abilities:'abilityUnlocks',weather:'weatherUnlocks'
});
export const SPECIAL_WEATHER=Object.freeze(['Calamitous Sun','Royal Tempest']);
const norm=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]/g,'');
export const contentKey=norm;
const entries=value=>Array.isArray(value)?value:[];
const unique=value=>[...new Set(entries(value).map(x=>String(x).trim()).filter(x=>x&&x.length<=85))].slice(0,150);
export function initialTrainerUnlocks(){
 return {tera:false,mega:false,zMove:false,dynamax:false,
  speciesUnlocks:[],megaFormUnlocks:[],moveUnlocks:[],abilityUnlocks:[],weatherUnlocks:[]};
}
export function readTrainerUnlocks(value){
 const base=initialTrainerUnlocks(),doc=value&&typeof value==='object'?value:{};
 for(const key of GIMMICK_KEYS)base[key]=doc[key]===true;
 for(const field of Object.values(UNLOCK_LIST_FIELDS))base[field]=unique(doc[field]);
 return base;
}
export function unlockedValue(doc,category,item) {
 const field=UNLOCK_LIST_FIELDS[category];
 if(!field)return false;
 const id=norm(typeof item==='string'?item:(item?.slug||item?.name||''));
 return !!id&&readTrainerUnlocks(doc)[field].some(k=>norm(k)===id);
}
export function unlockedWeather(doc,name) {
 return SPECIAL_WEATHER.includes(String(name)) && unlockedValue(doc,'weather',name);
}
const ownedSpecies=records=>new Set(entries(records).flatMap(p=>[
 norm(p.speciesKey),norm(p.speciesName),norm(p.name)
]).filter(Boolean));
const ownedMoves=records=>new Set(entries(records).flatMap(p=>entries(p.moves).map(norm)).filter(Boolean));
const ownedAbilities=records=>new Set(entries(records).flatMap(p=>[
 p.ability,...entries(p.abilities),p.megaForm?.ability
]).map(norm).filter(Boolean));
export function visiblePlayerContent(category,definitions,owned=[],unlocks={}){
 const ownedIds=category==='species'?ownedSpecies(owned):
  category==='moves'?ownedMoves(owned):
  category==='abilities'?ownedAbilities(owned):new Set();
 return entries(definitions).filter(item=>{
  if(unlockedValue(unlocks,category,item))return true;
  if(category==='species'){
   return ownedIds.has(norm(item.slug)) || ownedIds.has(norm('custom:'+item.slug))
     || ownedIds.has(norm(item.name));
  }
  if(category==='moves'||category==='abilities')return ownedIds.has(norm(item.name));
  if(category==='megaForms')return entries(owned).some(p=>norm(p.megaForm?.slug)===norm(item.slug));
  return false;
 });
}
export function progressionPayload(formData,approvedOptions){
 const data=initialTrainerUnlocks();
 for(const key of GIMMICK_KEYS)data[key]=formData.has(key);
 for(const [category,field] of Object.entries(UNLOCK_LIST_FIELDS)){
  const allowed=new Set(entries(approvedOptions?.[category]).map(x=>norm(
   typeof x==='string'?x:(x.slug||x.name)
  )));
  const raw=unique(formData.getAll(field));
  if(raw.some(x=>!allowed.has(norm(x))))throw Error('Unknown '+category+' unlock selected. Refresh the Trainer Unlocks page.');
  if(category==='weather'&&raw.some(x=>!SPECIAL_WEATHER.includes(x)))
   throw Error('Unrecognized special weather unlock.');
  data[field]=raw;
 }
 return data;
}
