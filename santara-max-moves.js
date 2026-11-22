// Santara Dynamax/Gigantamax move conversion, common to Player and GM.
// Conversion is preview-only: never rewrites the source Pokémon's moves.
export const MAX_MOVE_BY_TYPE=Object.freeze({"Normal":["Max Strike","Lowers all opposing Pokémon Speed by 1 stage"],"Fire":["Max Flare","Sets sun for 5 turns"],"Water":["Max Geyser","Sets rain for 5 turns"],"Electric":["Max Lightning","Sets Electric Terrain for 5 turns"],"Grass":["Max Overgrowth","Sets Grassy Terrain for 5 turns"],"Ice":["Max Hailstorm","Sets hail for 5 turns (distinct from Santara snow)"],"Fighting":["Max Knuckle","Raises user and allies Attack by 1 stage"],"Poison":["Max Ooze","Raises user and allies Special Attack by 1 stage"],"Ground":["Max Quake","Raises user and allies Special Defense by 1 stage"],"Flying":["Max Airstream","Raises user and allies Speed by 1 stage"],"Psychic":["Max Mindstorm","Sets Psychic Terrain for 5 turns"],"Bug":["Max Flutterby","Lowers opponents Special Attack by 1 stage"],"Rock":["Max Rockfall","Sets sandstorm for 5 turns"],"Ghost":["Max Phantasm","Lowers opponents Defense by 1 stage"],"Dragon":["Max Wyrmwind","Lowers opponents Attack by 1 stage"],"Dark":["Max Darkness","Lowers opponents Special Defense by 1 stage"],"Steel":["Max Steelspike","Raises user and allies Defense by 1 stage"],"Fairy":["Max Starfall","Sets Misty Terrain for 5 turns"]});
export const GMAX_BY_SPECIES=Object.freeze({"venusaur":["Grass","G-Max Vine Lash","Non-Grass opponents take 1/6 max HP residual damage for 4 turns"],"charizard":["Fire","G-Max Wildfire","Non-Fire opponents take 1/6 max HP residual damage for 4 turns"],"blastoise":["Water","G-Max Cannonade","Non-Water opponents take 1/6 max HP residual damage for 4 turns"],"butterfree":["Bug","G-Max Befuddle","Inflicts poison, paralysis or sleep randomly on opponents"],"pikachu":["Electric","G-Max Volt Crash","Paralyzes opposing Pokémon"],"meowth":["Normal","G-Max Gold Rush","Confuses opponents and scatters money after battle"],"machamp":["Fighting","G-Max Chi Strike","Raises critical-hit stage for user and allies by 1"],"gengar":["Ghost","G-Max Terror","Prevents opposing Pokémon switching or fleeing"],"kingler":["Water","G-Max Foam Burst","Lowers opponents Speed by 2 stages"],"lapras":["Ice","G-Max Resonance","Sets Aurora Veil on user side for 5 turns"],"eevee":["Normal","G-Max Cuddle","Infatuates opposite-gender opponents"],"snorlax":["Normal","G-Max Replenish","50% chance to restore consumed Berries for user and allies"],"garbodor":["Poison","G-Max Malodor","Poisons opposing Pokémon"],"melmetal":["Steel","G-Max Meltdown","Prevents opponents using the same move twice in a row"],"rillaboom":["Grass","G-Max Drum Solo","Ignores opposing Abilities that otherwise block or modify the move",160],"cinderace":["Fire","G-Max Fireball","Ignores opposing Abilities that otherwise block or modify the move",160],"inteleon":["Water","G-Max Hydrosnipe","Ignores opposing Abilities that otherwise block or modify the move",160],"corviknight":["Flying","G-Max Wind Rage","Clears opposing screens, entry hazards and terrain"],"orbeetle":["Psychic","G-Max Gravitas","Sets Gravity for 5 turns"],"drednaw":["Water","G-Max Stonesurge","Sets Stealth Rock on opposing side"],"coalossal":["Rock","G-Max Volcalith","Non-Rock opponents take 1/6 max HP residual damage for 4 turns"],"flapple":["Grass","G-Max Tartness","Lowers opposing Pokémon evasion by 1 stage"],"appletun":["Grass","G-Max Sweetness","Heals status conditions for user and allies"],"sandaconda":["Ground","G-Max Sandblast","Traps target with Sand Tomb for 4–5 turns"],"toxtricity":["Electric","G-Max Stun Shock","Poisons or paralyzes opposing Pokémon randomly"],"centiskorch":["Fire","G-Max Centiferno","Traps target with Fire Spin for 4–5 turns"],"hatterene":["Fairy","G-Max Smite","Confuses opponents"],"grimmsnarl":["Dark","G-Max Snooze","50% chance to make target drowsy (Yawn)"],"alcremie":["Fairy","G-Max Finale","Heals user and allies by 1/6 maximum HP"],"copperajah":["Steel","G-Max Steelsurge","Sets Steel-type damaging entry hazards"],"duraludon":["Dragon","G-Max Depletion","Removes 2 PP from target’s last-used move"],"urshifusinglestrike":["Dark","G-Max One Blow","Bypasses all protection, including Max Guard"],"urshifurapidstrike":["Water","G-Max Rapid Flow","Bypasses all protection, including Max Guard"]});
const key=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function gmaxSpecies(source){
 const raw=String(source?.speciesKey||source?.speciesName||source?.name||'');
 const id=key(raw.replace(/-?(?:gmax|gigantamax)$/i,''));
 if(id.startsWith('mega'))return '';
 if(id.startsWith('urshifu')){
  if(id.includes('rapid'))return 'urshifurapidstrike';
  if(id.includes('single')||id==='urshifu')return 'urshifusinglestrike';
 }
 if(id.startsWith('toxtricity'))return 'toxtricity';
 return Object.hasOwn(GMAX_BY_SPECIES,id)?id:'';
}
export function canGigantamax(source){return Boolean(gmaxSpecies(source));}
export function savedGigantamax(source){return source?.gigantamax===true||source?.gmax===true||/(?:-gmax|-gigantamax)$/i.test(String(source?.speciesKey||source?.speciesName||''));}
// In the cartridge, Fighting/Poison Max moves use lower power bands.
// Explicit move.maxMove.basePower overrides cover OHKO, fixed-damage and multi-hit exceptions.
export function maxMovePower(power,type,officialMove){
 const special=Number(officialMove?.maxMove?.basePower);
 if(Number.isFinite(special)&&special>0)return special;
 const n=Number(power);
 if(!Number.isFinite(n)||n<=0)return 100;
 if(type==='Fighting'||type==='Poison')return n>=150?100:n>=110?95:n>=75?90:n>=65?85:n>=55?80:n>=45?75:70;
 return n>=150?150:n>=110?140:n>=75?130:n>=65?120:n>=55?110:n>=45?100:90;
}
export function convertedMaxMove(base,source,{gigantamax=false,officialMove=null}={}){
 if(!base)return null;
 if(base.category==='Status')return {name:'Max Guard',type:'Normal',category:'Status',power:0,accuracy:100,originalName:base.name||'',gmax:false,effect:'Fully protects the user, including from Max Moves; no damage'};
 const type=String(base.type||''),ordinary=MAX_MOVE_BY_TYPE[type];
 if(!ordinary)return null;
 const gmax=gigantamax?GMAX_BY_SPECIES[gmaxSpecies(source)]:null;
 const signature=Boolean(gmax&&gmax[0]===type);
 const power=signature&&gmax[3]?gmax[3]:maxMovePower(base.power,type,officialMove);
 return {name:signature?gmax[1]:ordinary[0],type,category:base.category,power,accuracy:100,
  originalName:base.name||'',gmax:signature,effect:signature?gmax[2]:ordinary[1]};
}
