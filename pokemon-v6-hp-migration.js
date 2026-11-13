// V6 release migration utilities. Never changes data until the GM commits.
import {validStats,maxHpV53,maxHpV6,hpAfterMaxChange} from './pokemon-math.js';
export function hpMigrationRow(mon){
 const stats=mon?.baseStats,level=Number(mon?.level),oldMax=Number(mon?.maxHp),current=Number(mon?.currentHp);
 if(!validStats(stats)||!Number.isInteger(level)||level<1||level>100||
   !Number.isInteger(oldMax)||oldMax<1||!Number.isInteger(current)||current<0||current>oldMax)
  return {id:mon?.id||'',name:mon?.nickname||mon?.speciesName||'Unknown',category:'invalid',reason:'Invalid or missing stats / saved HP'};
 const expected=maxHpV6(stats,level);
 const legacy=maxHpV53(stats,level);
 const category=oldMax===expected?'already-v6':oldMax===legacy?'legacy':'override';
 return {
  id:mon.id,name:mon.nickname||mon.speciesName||'Unknown',species:mon.speciesName,
  ownerUid:mon.ownerUid,level,category,oldMax,oldCurrent:current,
  oldV53:legacy,newMax:expected,newCurrent:hpAfterMaxChange(current,oldMax,expected),
  missingHp:oldMax-current,
  ...(!mon.id?{category:'invalid',reason:'Missing Pokémon document ID'}:{})
 };
}
export function hpMigrationPlan(records=[],includeOverrides=false){
 const rows=records.map(hpMigrationRow);
 const eligible=rows.filter(row=>row.category==='legacy'||(includeOverrides&&row.category==='override'));
 return {rows,eligible,counts:{
  total:rows.length,legacy:rows.filter(r=>r.category==='legacy').length,
  overrides:rows.filter(r=>r.category==='override').length,
  already:rows.filter(r=>r.category==='already-v6').length,
  invalid:rows.filter(r=>r.category==='invalid').length
 }};
}
export function verifyMigrationSnapshot(saved,planned){
 if(!saved||!planned)return false;
 return Number(saved.maxHp)===planned.oldMax
  &&Number(saved.currentHp)===planned.oldCurrent
  &&Number(saved.level)===planned.level
  &&String(saved.ownerUid)===String(planned.ownerUid)
  &&validStats(saved.baseStats)
  &&maxHpV6(saved.baseStats,saved.level)===planned.newMax;
}
