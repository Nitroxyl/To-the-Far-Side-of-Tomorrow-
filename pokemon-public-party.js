// Only public-facing identity details belong on Trainer Cards.
// Never copy private battle notes, HP, abilities, or hidden Mega unlocks.
export function publicPartySlots(pokemon) {
 const result=Array.from({length:6},()=>null);
 const mons=[...(pokemon||[])].filter(m=>Number.isInteger(Number(m.slot))&&Number(m.slot)>=1&&Number(m.slot)<=6);
 for(const m of mons) {
  const idx=Number(m.slot)-1;
  if(result[idx])continue;
  const artwork=String(m.spriteUrl||'');
  const data=String(m.spriteData||'');
  result[idx]={
    name:String(m.nickname||m.speciesName||'Pokémon').slice(0,32),
    species:String(m.speciesName||'Pokémon').slice(0,85),
    level:Math.max(1,Math.min(100,Number(m.level)||1)),
    artUrl:/^https:\/\//.test(artwork)?artwork.slice(0,600):'',
    artData:/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(data)&&data.length<=150000?data:''
  };
 }
 return result;
}
export function partySignature(slots){return JSON.stringify(slots);}
