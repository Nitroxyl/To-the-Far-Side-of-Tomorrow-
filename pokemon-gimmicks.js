// Active and permanent forms are deliberately separate. Mega Evolution is a
// battle transformation; the Pokémon's stored base stats are never overwritten.
export const TYPE_NAMES=['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'];
export const GIMMICK_KEYS=['tera','mega','zMove','dynamax'];
export const GIMMICK_LABELS={tera:'Terastallization',mega:'Mega Evolution',zMove:'Z-Moves',dynamax:'Dynamax'};
export function initialUnlocks(){return {tera:false,mega:false,zMove:false,dynamax:false};}
export function megaCompatible(mon,form){
 if(!form || !mon)return false;
 return String(form.baseSpeciesKey||'').toLowerCase()===String(mon.speciesKey||'').toLowerCase()
   && ['hp','attack','defense','specialAttack','specialDefense','speed'].every(k=>Number.isInteger(Number(form.baseStats?.[k]))&&form.baseStats[k]>=1&&form.baseStats[k]<=255);
}
export function effectivePokemon(mon,unlock={}) {
 const mega=unlock.mega===true && mon.megaActive===true && megaCompatible(mon,mon.megaForm);
 const tera=unlock.tera===true && mon.teraActive===true && TYPE_NAMES.includes(mon.teraType);
 const dmax=unlock.dynamax===true && Number(mon.dynamaxTurns)>0;
 const form=mega?mon.megaForm:null;
 const maxHp=Math.max(1,Number(mon.maxHp)||1)*(dmax?2:1);
 const currentHp=Math.max(0,Number(mon.currentHp)||0)*(dmax?2:1);
 return {
  ...mon,baseStats:form?.baseStats||mon.baseStats,
  displayName:form?.name||mon.speciesName,
  types:tera?[mon.teraType]:form?.types||mon.types,
  originalTypes:form?.types||mon.types,
  ability:form?.ability||mon.ability,
  spriteUrl:form?.spriteUrl||mon.spriteUrl,
  spriteData:form?.spriteData||mon.spriteData,
  maxHp,currentHp,mega,tera,dynamax:dmax
 };
}
