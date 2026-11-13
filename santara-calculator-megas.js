// Calculator-only Mega form previews mirrored from finalized Santara GM presets.
// New GM form registrations remain managed in Firebase, and assigned form snapshots
// always override previews. These definitions do not grant a Mega or Mega Stone.
import {suggestedMegaStone} from './pokemon-mega-stones.js?v=ceruledgite-v1';
import {unlockedValue} from './santara-player-unlocks.js';

const normalize=value=>String(value??'').toLowerCase().replace(/[^a-z0-9]/g,'');
export const SANTARA_MEGA_PREVIEWS=Object.freeze([
  {
    "slug": "mega-charizard-z",
    "name": "Mega Charizard Z",
    "baseSpeciesKey": "charizard",
    "baseStats": {
      "hp": 78,
      "attack": 63,
      "defense": 72,
      "specialAttack": 200,
      "specialDefense": 70,
      "speed": 151
    },
    "types": [
      "fire",
      "dragon"
    ],
    "ability": "Kingdom's End",
    "source": "custom"
  },
  {
    "slug": "charizard-mega-x",
    "name": "Mega Charizard X",
    "baseSpeciesKey": "charizard",
    "baseStats": {
      "hp": 78,
      "attack": 160,
      "defense": 120,
      "specialAttack": 70,
      "specialDefense": 96,
      "speed": 110
    },
    "types": [
      "fire",
      "dragon"
    ],
    "ability": "Tough Claws",
    "source": "custom"
  },
  {
    "slug": "skarmory-mega",
    "name": "Mega Skarmory",
    "baseSpeciesKey": "skarmory",
    "baseStats": {
      "hp": 65,
      "attack": 150,
      "defense": 130,
      "specialAttack": 20,
      "specialDefense": 95,
      "speed": 105
    },
    "types": [
      "steel",
      "flying"
    ],
    "ability": "Sharpness",
    "source": "custom"
  },
  {
    "slug": "garchomp-mega-z",
    "name": "Mega Garchomp Z",
    "baseSpeciesKey": "garchomp",
    "baseStats": {
      "hp": 108,
      "attack": 95,
      "defense": 90,
      "specialAttack": 170,
      "specialDefense": 85,
      "speed": 152
    },
    "types": [
      "dragon"
    ],
    "ability": "Skybreaker",
    "source": "custom"
  },
  {
    "slug": "absol-mega-z",
    "name": "Mega Absol Z",
    "baseSpeciesKey": "absol",
    "baseStats": {
      "hp": 65,
      "attack": 165,
      "defense": 75,
      "specialAttack": 45,
      "specialDefense": 64,
      "speed": 151
    },
    "types": [
      "dark",
      "ghost"
    ],
    "ability": "Foretold Ruin",
    "source": "custom"
  },
  {
    "slug": "mega-lycanroc-dusk",
    "name": "Mega Lycanroc Dusk",
    "baseSpeciesKey": "lycanroc-dusk",
    "baseStats": {
      "hp": 75,
      "attack": 157,
      "defense": 85,
      "specialAttack": 55,
      "specialDefense": 80,
      "speed": 135
    },
    "types": [
      "rock",
      "dark"
    ],
    "ability": "Tough Claws",
    "source": "custom"
  },
  {
    "slug": "mega-dragapult",
    "name": "Mega Dragapult",
    "baseSpeciesKey": "dragapult",
    "baseStats": {
      "hp": 88,
      "attack": 135,
      "defense": 115,
      "specialAttack": 140,
      "specialDefense": 110,
      "speed": 112
    },
    "types": [
      "dragon",
      "ghost"
    ],
    "ability": "Mega Launcher",
    "source": "custom"
  },
  {
    "slug": "mega-ceruledge",
    "name": "Mega Ceruledge",
    "baseSpeciesKey": "ceruledge",
    "baseStats": {
      "hp": 75,
      "attack": 160,
      "defense": 110,
      "specialAttack": 60,
      "specialDefense": 120,
      "speed": 100
    },
    "types": [
      "fire",
      "ghost"
    ],
    "ability": "Sharpness",
    "source": "custom"
  },
  {
    "slug": "mega-armarouge",
    "name": "Mega Armarouge",
    "baseSpeciesKey": "armarouge",
    "baseStats": {
      "hp": 85,
      "attack": 60,
      "defense": 140,
      "specialAttack": 165,
      "specialDefense": 100,
      "speed": 75
    },
    "types": [
      "fire",
      "psychic"
    ],
    "ability": "Bastion Furnace",
    "source": "custom"
  },
  {
    "slug": "mega-greninja",
    "name": "Mega Greninja",
    "baseSpeciesKey": "greninja",
    "baseStats": {
      "hp": 72,
      "attack": 110,
      "defense": 77,
      "specialAttack": 148,
      "specialDefense": 81,
      "speed": 142
    },
    "types": [
      "water",
      "dark"
    ],
    "ability": "Perfected Ninjutsu",
    "source": "custom"
  },
  {
    "slug": "mega-arbok",
    "name": "Mega Arbok",
    "baseSpeciesKey": "arbok",
    "baseStats": {
      "hp": 60,
      "attack": 135,
      "defense": 99,
      "specialAttack": 65,
      "specialDefense": 89,
      "speed": 100
    },
    "types": [
      "poison",
      "dark"
    ],
    "ability": "Strong Jaw",
    "source": "custom"
  },
  {
    "slug": "mega-krookodile",
    "name": "Mega Krookodile",
    "baseSpeciesKey": "krookodile",
    "baseStats": {
      "hp": 95,
      "attack": 157,
      "defense": 105,
      "specialAttack": 65,
      "specialDefense": 80,
      "speed": 117
    },
    "types": [
      "ground",
      "dark"
    ],
    "ability": "Adaptability",
    "source": "custom"
  },
  {
    "slug": "mega-hydreigon",
    "name": "Mega Hydreigon",
    "baseSpeciesKey": "hydreigon",
    "baseStats": {
      "hp": 92,
      "attack": 105,
      "defense": 110,
      "specialAttack": 170,
      "specialDefense": 105,
      "speed": 118
    },
    "types": [
      "dragon",
      "electric"
    ],
    "ability": "Tempest Crown",
    "source": "custom"
  },
  {
    "slug": "mega-lapras",
    "name": "Mega Lapras",
    "baseSpeciesKey": "lapras",
    "baseStats": {
      "hp": 130,
      "attack": 85,
      "defense": 115,
      "specialAttack": 135,
      "specialDefense": 105,
      "speed": 65
    },
    "types": [
      "water",
      "ice"
    ],
    "ability": "Aurora Chorus",
    "source": "custom"
  },
  {
    "slug": "mega-kilowattrel",
    "name": "Mega Kilowattrel",
    "baseSpeciesKey": "kilowattrel",
    "baseStats": {
      "hp": 70,
      "attack": 70,
      "defense": 85,
      "specialAttack": 135,
      "specialDefense": 90,
      "speed": 140
    },
    "types": [
      "electric",
      "flying"
    ],
    "ability": "Lightning Rod",
    "source": "custom"
  },
  {
    "slug": "mega-garganacl",
    "name": "Mega Garganacl",
    "baseSpeciesKey": "garganacl",
    "baseStats": {
      "hp": 100,
      "attack": 125,
      "defense": 175,
      "specialAttack": 45,
      "specialDefense": 120,
      "speed": 35
    },
    "types": [
      "rock"
    ],
    "ability": "Purifying Salt",
    "source": "custom"
  },
  {
    "slug": "mega-kingdra",
    "name": "Mega Kingdra",
    "baseSpeciesKey": "kingdra",
    "baseStats": {
      "hp": 75,
      "attack": 95,
      "defense": 110,
      "specialAttack": 160,
      "specialDefense": 110,
      "speed": 90
    },
    "types": [
      "water",
      "dragon"
    ],
    "ability": "Swift Swim",
    "source": "custom"
  },
  {
    "slug": "mega-tyrantrum",
    "name": "Mega Tyrantrum",
    "baseSpeciesKey": "tyrantrum",
    "baseStats": {
      "hp": 82,
      "attack": 161,
      "defense": 139,
      "specialAttack": 69,
      "specialDefense": 79,
      "speed": 91
    },
    "types": [
      "dragon",
      "fire"
    ],
    "ability": "Molten Edge",
    "source": "custom"
  },
  {
    "slug": "mega-crawdaunt",
    "name": "Mega Crawdaunt",
    "baseSpeciesKey": "crawdaunt",
    "baseStats": {
      "hp": 63,
      "attack": 165,
      "defense": 100,
      "specialAttack": 90,
      "specialDefense": 65,
      "speed": 85
    },
    "types": [
      "water",
      "dark"
    ],
    "ability": "Adaptability",
    "source": "custom"
  },
  {
    "slug": "lucario-mega",
    "name": "Mega Lucario",
    "baseSpeciesKey": "lucario",
    "baseStats": {
      "hp": 70,
      "attack": 155,
      "defense": 88,
      "specialAttack": 120,
      "specialDefense": 70,
      "speed": 122
    },
    "types": [
      "fighting",
      "steel"
    ],
    "ability": "Adaptability",
    "source": "custom"
  },
  {
    "slug": "lucario-mega-z",
    "name": "Mega Lucario Z",
    "baseSpeciesKey": "lucario",
    "baseStats": {
      "hp": 70,
      "attack": 100,
      "defense": 70,
      "specialAttack": 164,
      "specialDefense": 70,
      "speed": 151
    },
    "types": [
      "fighting",
      "steel"
    ],
    "ability": "Aura Guard",
    "source": "custom"
  },
  {
    "slug": "baxcalibur-mega",
    "name": "Mega Baxcalibur",
    "baseSpeciesKey": "baxcalibur",
    "baseStats": {
      "hp": 115,
      "attack": 205,
      "defense": 150,
      "specialAttack": 75,
      "specialDefense": 125,
      "speed": 30
    },
    "types": [
      "dragon",
      "ice"
    ],
    "ability": "Sword of Ruin",
    "source": "custom"
  },
  {
    "slug": "mega-porygon-z",
    "name": "Mega Porygon-Z",
    "baseSpeciesKey": "porygon-z",
    "baseStats": {
      "hp": 85,
      "attack": 80,
      "defense": 85,
      "specialAttack": 165,
      "specialDefense": 100,
      "speed": 125
    },
    "types": [
      "normal",
      "electric"
    ],
    "ability": "System Override",
    "source": "custom"
  },
  {
    "slug": "mega-archaludon",
    "name": "Mega Archaludon",
    "baseSpeciesKey": "archaludon",
    "baseStats": {
      "hp": 90,
      "attack": 105,
      "defense": 165,
      "specialAttack": 170,
      "specialDefense": 105,
      "speed": 65
    },
    "types": [
      "steel",
      "dragon"
    ],
    "ability": "Siege Battery",
    "source": "custom"
  }
]);
export const isStoryMega=form=>/^Mega .+ Z$/i.test(String(form?.name||''));

export function officialMegaPreviews(gen){
 const out=[];
 for(const mon of gen?.species||[]){
  const original=String(mon.name||'');
  const match=original.match(/^(.+)-Mega(?:-([XY]))?$/i);
  if(!match||!mon.baseStats||!mon.types?.length)continue;
  const baseName=match[1],suffix=match[2]?' '+match[2].toUpperCase():'';
  const key=baseName.toLowerCase().replace(/[^a-z0-9]+/g,'-');
  const name='Mega '+baseName+suffix;
  const baseStats=mon.baseStats;
  out.push({slug:key+'-mega'+(suffix?'-'+suffix.trim().toLowerCase():''),name,
   baseSpeciesKey:key,baseStats:{
    hp:baseStats.hp,attack:baseStats.atk,defense:baseStats.def,
    specialAttack:baseStats.spa,specialDefense:baseStats.spd,speed:baseStats.spe
   },types:mon.types.map(t=>t.toLowerCase()),ability:mon.abilities?.[0]||'',
   source:'official'});
 }
 return out;
}
export function eligibleMegaForms(source,forms=[],{gm=false,unlocks={}}={}){
 if(!source)return [];
 const base=normalize(source.speciesKey||source.speciesName||source.name);
 const entries=new Map();
 for(const form of [...forms,...(source.megaForm?[source.megaForm]:[])]){
  if(!form?.slug||!form?.baseSpeciesKey||!form?.baseStats||!form?.name||!form?.ability)continue;
  if(normalize(form.baseSpeciesKey)!==base)continue;
  entries.set(normalize(form.slug),form);
 }
 const assigned=normalize(source.megaForm?.slug);
 return [...entries.values()].filter(form=>{
  if(gm)return true;
  if(unlocks?.mega!==true)return false;
  if(normalize(form.slug)===assigned)return true;
  if(unlockedValue(unlocks,'megaForms',form))return true;
  return !isStoryMega(form);
 }).sort((a,b)=>
  (normalize(a.slug)===assigned?-1:0)-(normalize(b.slug)===assigned?-1:0)
  ||a.name.localeCompare(b.name));
}
export function requiredStoneFor(source,form){
 if(!form)return '';
 if(source?.megaForm&&normalize(source.megaForm.slug)===normalize(form.slug)&&source.megaRequiredStone)
  return String(source.megaRequiredStone).trim();
 return suggestedMegaStone(source,form);
}
export function matchesMegaStone(equipped,required){
 return Boolean(required)&&normalize(equipped)===normalize(required);
}
export function megaStoneNames(forms=[],records=[]){
 const values=new Set();
 for(const form of forms){
  const required=requiredStoneFor(null,form);
  if(required)values.add(required);
 }
 for(const record of records){
  const stone=requiredStoneFor(record,record?.megaForm);
  if(stone)values.add(stone);
 }
 return [...values].sort((a,b)=>a.localeCompare(b));
}
