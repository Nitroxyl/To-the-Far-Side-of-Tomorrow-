// Official Gigantamax reference artwork (PokéAPI sprites repository).
// Image preview only: no battle state, gimmick unlocks, or Firebase writes.
import {gmaxSpecies} from './santara-max-moves.js';

const GMAX_ARTWORK_IDS=Object.freeze({
  "venusaur": 10195,
  "charizard": 10196,
  "blastoise": 10197,
  "butterfree": 10198,
  "pikachu": 10199,
  "meowth": 10200,
  "machamp": 10201,
  "gengar": 10202,
  "kingler": 10203,
  "lapras": 10204,
  "eevee": 10205,
  "snorlax": 10206,
  "garbodor": 10207,
  "melmetal": 10208,
  "rillaboom": 10209,
  "cinderace": 10210,
  "inteleon": 10211,
  "corviknight": 10212,
  "orbeetle": 10213,
  "drednaw": 10214,
  "coalossal": 10215,
  "flapple": 10216,
  "appletun": 10217,
  "sandaconda": 10218,
  "toxtricity": 10219,
  "centiskorch": 10220,
  "hatterene": 10221,
  "grimmsnarl": 10222,
  "alcremie": 10223,
  "copperajah": 10224,
  "duraludon": 10225,
  "urshifusinglestrike": 10226,
  "urshifurapidstrike": 10227
});
const ART='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/';
const SPRITE='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';

export function gigantamaxArtwork(source) {
  const species=gmaxSpecies(source);
  if(!species||!Object.hasOwn(GMAX_ARTWORK_IDS,species))return null;
  const raw=String(source?.speciesKey||source?.speciesName||source?.name||'').toLowerCase();
  const lowKey=species==='toxtricity'&&/low[-_ ]?key/.test(raw);
  const id=lowKey?10228:GMAX_ARTWORK_IDS[species];
  const formName=species==='urshifurapidstrike'?'Gigantamax Urshifu (Rapid Strike Style)':
    species==='urshifusinglestrike'?'Gigantamax Urshifu (Single Strike Style)':
    species==='toxtricity'?'Gigantamax Toxtricity ('+(lowKey?'Low Key':'Amped')+' Form)':
    'Gigantamax '+String(source?.speciesName||source?.name||species).replace(/-gmax$/i,'');
  return {species,id,label:formName,artworkUrl:ART+id+'.png',spriteUrl:SPRITE+id+'.png'};
}
