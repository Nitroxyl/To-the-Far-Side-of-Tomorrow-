// Presentation helpers for Santara battle mechanics.
export const TYPES=['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'];
export const KEYS=['tera','mega','zMove','dynamax'];
export const LABELS={tera:'Terastallization',mega:'Mega Evolution',zMove:'Z-Moves',dynamax:'Dynamax'};
const cap=s=>String(s||'').replace(/\b\w/g,c=>c.toUpperCase());
export function unlockUI(g,label,esc){
 return `<section class="panel"><h3>Unlock Trainer gimmicks</h3><p>Progression unlocks for <b>${esc(label)}</b>. Save separately for each Trainer.</p>
 <form id="gimmick-unlock-form"><div class="gimmick-grid">${KEYS.map(k=>`<label class="gimmick-tile"><input type="checkbox" name="${k}" ${g[k]?'checked':''}><span><b>${LABELS[k]}</b><small>${k==='tera'?'Choose Tera types':k==='mega'?'Evolve assigned Mega forms':k==='zMove'?'Track a Z-Move use':'Track three Dynamax turns'}</small></span></label>`).join('')}</div><button class="btn primary" type="submit">Save unlocks</button></form></section>`;
}
export function libraryUI(forms,esc){
 return `<section class="panel"><div class="toolbar"><h3>Registered Mega Evolutions</h3><button class="btn" data-act="mega-new">+ Register Mega form</button></div><p>Import an official Mega's stats or define a reworked Mega with custom stats, types, ability and artwork.</p>
 ${forms.length?forms.map(x=>`<div class="mega-entry"><b>${esc(x.name)}</b> <span class="hint">(${esc(x.baseSpeciesKey)} · ${esc(x.source)})</span><button class="btn small" data-act="mega-edit" data-id="${esc(x.slug)}">Edit</button></div>`).join(''):'<p class="hint">No Mega forms registered.</p>'}</section>`;
}
export function editorUI(d,statKeys,statLabels,option,esc){
 return `<section class="panel"><div class="toolbar"><h2>Register or edit Mega form</h2><button class="btn" data-act="back">← Back</button></div>
 <p>Enter its regular species identifier, such as <code>charizard</code> or <code>custom:spinotroleum</code>. Mega stats are stored separately from the regular Pokémon.</p>
 <form id="mega-form" class="form-grid">
 <label class="field">Base species key<input name="baseSpeciesKey" maxlength="110" required placeholder="charizard" value="${esc(d.baseSpeciesKey||'')}"></label>
 <label class="field">Mega form name<input name="name" maxlength="85" required placeholder="Mega Charizard X" value="${esc(d.name||'')}"></label>
 <label class="field full">PokéAPI official Mega identifier (optional)<div class="actions"><input name="officialKey" placeholder="charizard-mega-x"><button class="btn" type="button" data-act="mega-import">Import official stats</button></div></label>
 <label class="field">Type 1<select name="type1">${TYPES.map(t=>option(t,cap(t),d.types?.[0]||'fire')).join('')}</select></label>
 <label class="field">Type 2<select name="type2">${option('','None',d.types?.[1]||'')}${TYPES.map(t=>option(t,cap(t),d.types?.[1]||'')).join('')}</select></label>
 ${statKeys.map((k,i)=>`<label class="field">${statLabels[i]} base stat<input required type="number" min="1" max="255" name="stat_${k}" value="${d.baseStats?.[k]??''}"></label>`).join('')}
 <label class="field">Mega Ability<input required name="ability" maxlength="48" value="${esc(d.ability||'')}"></label>
 <label class="field">Artwork URL (optional)<input type="url" name="spriteUrl" value="${esc(d.spriteUrl||'')}"></label>
 <label class="field full">Upload artwork (optional)<input type="file" name="upload" accept="image/png,image/jpeg,image/webp"></label>
 <p class="hint full">Saving this definition will not change existing Pokémon until their GM reapplies the saved Mega form to their record.</p>
 <div class="actions"><button class="btn primary" type="submit">Save Mega definition</button></div></form></section>`;
}
import {hasRequiredMegaStone} from './pokemon-mega-stones.js';
export function controlsUI(m,g,esc,option,compatible,requiredStone=''){
 const stoneEquipped=hasRequiredMegaStone(m,requiredStone);
 const canMega=compatible&&(m.megaActive||stoneEquipped);
 const stoneDescription=!compatible?'GM has not assigned a compatible Mega form.'
  :!requiredStone?'GM must set the required Mega Stone for this assigned form.'
  :stoneEquipped?'Required stone equipped: '+requiredStone
  :'Requires '+requiredStone+' (currently holding '+(m.heldItem||'nothing')+').';
 const unlocked=KEYS.filter(k=>g[k]);
 return `<section class="panel"><h3>Battle mechanics</h3><p class="hint">Unlocked: ${unlocked.map(k=>LABELS[k]).join(', ')||'None yet'}</p>
 <div class="gimmick-grid">
 ${g.tera?`<div class="gimmick-tile"><b>Terastallization</b><label class="field">Tera Type<select id="tera-type">${TYPES.map(t=>option(t,cap(t),m.teraType||m.types?.[0]||'normal')).join('')}</select></label><button class="btn ${m.teraActive?'primary':''}" data-act="g-tera">${m.teraActive?'Revert Tera':'Terastallize'}</button></div>`:''}
 ${g.mega?`<div class="gimmick-tile"><b>Mega Evolution</b><p class="hint">${compatible?esc(m.megaForm.name):'No compatible Mega form assigned.'}</p><p class="hint">${esc(stoneDescription)}</p><button class="btn ${m.megaActive?'primary':''}" data-act="g-mega" ${canMega?'':'disabled'}>${m.megaActive?'Revert Mega':'Mega Evolve'}</button></div>`:''}
 ${g.zMove?`<div class="gimmick-tile"><b>Z-Moves</b><p class="hint">${m.zUsed?'Used this battle':'Available'}</p><button class="btn" data-act="g-z">${m.zUsed?'Reset Z-Move':'Mark Z-Move Used'}</button></div>`:''}
 ${g.dynamax?`<div class="gimmick-tile"><b>Dynamax</b><p class="hint">${Number(m.dynamaxTurns)>0?m.dynamaxTurns+' turns left':m.dynamaxUsed?'Already used':'Available (3 turns)'}</p><div class="actions"><button class="btn ${m.dynamaxTurns?'primary':''}" data-act="g-dmax" ${m.dynamaxUsed&&!m.dynamaxTurns?'disabled':''}>${m.dynamaxTurns?'End Dynamax':'Dynamax'}</button>${m.dynamaxTurns?'<button class="btn small" data-act="g-next">Next Turn</button>':''}<button class="btn small" data-act="g-reset">Reset Dynamax</button></div></div>`:''}
 </div><p class="hint">Mega Evolution changes displayed stats, typing, ability and artwork; it does not overwrite the original Pokémon. Dynamax doubles displayed HP while active.</p></section>`;
}
