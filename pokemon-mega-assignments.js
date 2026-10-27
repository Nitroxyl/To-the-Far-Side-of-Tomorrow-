// The Mega assignment is a separate owner-scoped Firestore document.
// It never rewrites a legacy Pokémon, and only copies validated public
// form fields. The Firestore rules independently verify GM authorization.
export const MEGA_STAT_KEYS=['hp','attack','defense','specialAttack','specialDefense','speed'];
export const MEGA_TYPES=['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'];

export function cleanMegaSnapshot(mon,form){
 if(form==null)return null;
 if(!mon || !form || String(form.baseSpeciesKey)!==String(mon.speciesKey))throw Error('Mega form must match the regular Pokémon species.');
 const name=String(form.name||''),slug=String(form.slug||''),ability=String(form.ability||'');
 if(!/^[a-z0-9-]{2,70}$/.test(slug))throw Error('Mega form ID is invalid.');
 if(!name||name.length>85||!ability||ability.length>48)throw Error('Mega name/ability exceeds Firestore limits.');
 const baseStats={};
 for(const k of MEGA_STAT_KEYS){
  const val=Number(form.baseStats?.[k]);
  if(!Number.isInteger(val)||val<1||val>255)throw Error('Mega '+k+' base stat must be 1–255.');
  baseStats[k]=val;
 }
 const types=Array.isArray(form.types)?form.types.slice():[];
 if(!types.length||types.length>2||types.some(t=>!MEGA_TYPES.includes(t)))throw Error('Mega typing is invalid.');
 const rawData=String(form.spriteData||'');
 const rawUrl=String(form.spriteUrl||'');
 // Old templates sometimes contain oversized/PNG artwork. Preserve the
 // stats and mechanics, but don't copy nonconforming images to the assignment.
 const spriteData=rawData.length<=150000 && /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(rawData)?rawData:'';
 const spriteUrl=rawUrl.length<=600 && /^https:\/\/.+/.test(rawUrl)?rawUrl:'';
 return {slug,name,baseSpeciesKey:String(mon.speciesKey),baseStats,types,ability,
  spriteUrl,spriteData,source:form.source==='official'?'official':'custom'};
}
export function applyMegaOverlays(raw,assignments){
 return raw.map(mon=>{
  if(!Object.prototype.hasOwnProperty.call(assignments,mon.id))return mon;
  return {...mon,megaForm:assignments[mon.id].megaForm??null};
 });
}
