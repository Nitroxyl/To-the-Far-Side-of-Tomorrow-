// The 25 standard Pokémon Natures. Used by the Pokémon editor and
// Santara's cartridge-style damage calculator (10% stat boosts/reductions).
// These modify effective battle stats; base stats and stored maximum HP remain untouched.
export const NATURE_EFFECTS=Object.freeze({
 Adamant:['Atk','SpA'],Bashful:[],Bold:['Def','Atk'],Brave:['Atk','Spe'],
 Calm:['SpD','Atk'],Careful:['SpD','SpA'],Docile:[],Gentle:['SpD','Def'],
 Hardy:[],Hasty:['Spe','Def'],Impish:['Def','SpA'],Jolly:['Spe','SpA'],
 Lax:['Def','SpD'],Lonely:['Atk','Def'],Mild:['SpA','Def'],Modest:['SpA','Atk'],
 Naive:['Spe','SpD'],Naughty:['Atk','SpD'],Quiet:['SpA','Spe'],Quirky:[],
 Rash:['SpA','SpD'],Relaxed:['Def','Spe'],Sassy:['SpD','Spe'],
 Serious:[],Timid:['Spe','Atk']
});
export const NATURE_NAMES=Object.freeze(Object.keys(NATURE_EFFECTS).sort());
export const validNature=value=>typeof value==='string'&&Object.hasOwn(NATURE_EFFECTS,value);
export const natureName=value=>validNature(value)?value:'Serious';
export function natureLabel(value){
 const name=natureName(value),effect=NATURE_EFFECTS[name];
 return effect.length?name+' (+'+effect[0]+' / -'+effect[1]+')':name+' (Neutral)';
}
export function natureDescription(value){
 const effect=NATURE_EFFECTS[natureName(value)];
 return effect.length?'In battle: +10% '+effect[0]+', -10% '+effect[1]+'.':'Neutral nature: no stat increases or reductions.';
}
