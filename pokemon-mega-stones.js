// Mega Stone requirements. The GM may override the suggested item per form
// when assigning a custom Mega Evolution (for example, Charizardite Z).
const STONES={
 venusaur:'Venusaurite',charizard:'Charizardite',blastoise:'Blastoisinite',
 beedrill:'Beedrillite',pidgeot:'Pidgeotite',alakazam:'Alakazite',
 slowbro:'Slowbronite',gengar:'Gengarite',kangaskhan:'Kangaskhanite',
 pinsir:'Pinsirite',gyarados:'Gyaradosite',aerodactyl:'Aerodactylite',
 mewtwo:'Mewtwonite',ampharos:'Ampharosite',steelix:'Steelixite',
 scizor:'Scizorite',heracross:'Heracronite',houndoom:'Houndoominite',
 tyranitar:'Tyranitarite',sceptile:'Sceptilite',blaziken:'Blazikenite',
 swampert:'Swampertite',gardevoir:'Gardevoirite',sableye:'Sablenite',
 mawile:'Mawilite',aggron:'Aggronite',medicham:'Medichamite',
 manectric:'Manectite',sharpedo:'Sharpedonite',camerupt:'Cameruptite',
 altaria:'Altarianite',banette:'Banettite',absol:'Absolite',
 glalie:'Glalitite',salamence:'Salamencite',metagross:'Metagrossite',
 latias:'Latiasite',latios:'Latiosite',rayquaza:'Rayquazite',
 lopunny:'Lopunnite',garchomp:'Garchompite',lucario:'Lucarionite',
 abomasnow:'Abomasite',gallade:'Galladite',audino:'Audinite',
 diancie:'Diancite',slowking:'Slowkingite',raichu:'Raichunite',
 dragonite:'Dragoninite',starmie:'Starminite'
};
export function suggestedMegaStone(mon,form){
 if(!form)return '';
 const key=String(form.baseSpeciesKey||mon?.speciesKey||'').toLowerCase().replace(/^custom:/,'');
 const base=STONES[key]||key.split('-').map(x=>x?x[0].toUpperCase()+x.slice(1):'').join('')+'ite';
 const name=String(form.name||'').trim();
 const slug=String(form.slug||'').trim();
 const suffix=name.match(/\b([XYZ])$/i)?.[1]||slug.match(/(?:^|[-_])([xyz])$/i)?.[1]||'';
 return base+(suffix?' '+suffix.toUpperCase():'');
}
export function hasRequiredMegaStone(mon,requiredStone){
 const expected=String(requiredStone||'').trim().toLowerCase();
 return Boolean(expected)&&String(mon?.heldItem||'').trim().toLowerCase()===expected;
}
