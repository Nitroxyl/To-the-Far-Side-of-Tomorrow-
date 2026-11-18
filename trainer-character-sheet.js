// Santara Trainer Dossier. Human-scale D&D checks, GM-awarded milestones, and classless talents.
// Old four-stat values are retained invisibly for backwards compatibility with saved cards.
export const TRAINER_ATTRIBUTES=[
 {key:'str',name:'Strength',short:'STR',hint:'Lifting, climbing, physical exertion'},
 {key:'dex',name:'Dexterity',short:'DEX',hint:'Stealth, reflexes, coordination'},
 {key:'con',name:'Constitution',short:'CON',hint:'Stamina and resisting fatigue'},
 {key:'int',name:'Intelligence',short:'INT',hint:'Research, reasoning and technology'},
 {key:'wis',name:'Wisdom',short:'WIS',hint:'Awareness, intuition and Pokémon care'},
 {key:'cha',name:'Charisma',short:'CHA',hint:'Influence, empathy and confidence'}
];
export const STARTING_ARRAY=[14,13,12,11,10,9];
export const TRAINER_SKILLS=[
 {name:'Athletics',ability:'str'},
 {name:'Acrobatics',ability:'dex'},{name:'Sleight of Hand',ability:'dex'},{name:'Stealth',ability:'dex'},
 {name:'History',ability:'int'},{name:'Investigation',ability:'int'},{name:'Nature',ability:'int'},
 {name:'Pokémon Knowledge',ability:'int'},{name:'Technology',ability:'int'},
 {name:'Insight',ability:'wis'},{name:'Medicine',ability:'wis'},{name:'Perception',ability:'wis'},
 {name:'Pokémon Handling',ability:'wis'},{name:'Survival',ability:'wis'},
 {name:'Deception',ability:'cha'},{name:'Intimidation',ability:'cha'},
 {name:'Performance',ability:'cha'},{name:'Persuasion',ability:'cha'}
];
export const TRAINER_TALENTS=[
 {id:'trailblazer',name:'Trailblazer',category:'Fieldcraft',description:'Once per expedition, find a safer route through unfamiliar terrain. If none exists, gain advantage on the next relevant Survival check.'},
 {id:'keen-observer',name:'Keen Observer',category:'Fieldcraft',description:'Once per expedition, ask the GM for an important environmental detail or clue you could reasonably notice.'},
 {id:'always-prepared',name:'Always Prepared',category:'Fieldcraft',description:'Once per session, reveal a reasonable inexpensive non-combat tool or supply you brought.'},
 {id:'field-medic',name:'Field Medic',category:'Fieldcraft',description:'Once per expedition, use supplies to stabilize an injury or ease minor environmental exhaustion. Does not replace battle healing.'},
 {id:'silent-approach',name:'Silent Approach',category:'Fieldcraft',description:'Once per expedition, gain advantage on Stealth to approach or observe a wild Pokémon unnoticed.'},
 {id:'species-tracker',name:'Species Tracker',category:'Pokémoncraft',description:'Once per expedition, name a species and receive a credible lead toward its habitat or recent activity, if available.'},
 {id:'rare-encounter-specialist',name:'Rare Encounter Specialist',category:'Pokémoncraft',description:'Once per expedition, when the GM rolls a random wild Pokémon encounter, roll twice and choose either result. No story-locked encounters.'},
 {id:'efficient-training',name:'Efficient Training',category:'Pokémoncraft',description:'Once per Gym arc, train one underleveled Pokémon during downtime for up to 2 bonus levels, never past the GM party cap.'},
 {id:'natural-handler',name:'Natural Handler',category:'Pokémoncraft',description:'Gain advantage on checks to calm or befriend a wild Pokémon that is not actively attacking.'},
 {id:'legendary-pursuer',name:'Legendary Pursuer',category:'Pokémoncraft',description:'After Gym 5, collect 3 independent clues about an available roaming Legendary. The GM then reveals a credible lead, not a guaranteed encounter or capture.',minGyms:5},
 {id:'battle-analyst',name:'Battle Analyst',category:'Command',description:'Once per battle, identify either the Ability or held item of one opposing active Pokémon.'},
 {id:'speed-reader',name:'Speed Reader',category:'Command',description:'Once per battle, learn the effective Speed order between two active Pokémon, including field effects.'},
 {id:'damage-spotter',name:'Damage Spotter',category:'Command',description:'Once per battle, ask the GM for the estimated damage percentage of one legal move against a visible target using the damage calculator.'},
 {id:'contingency-call',name:'Contingency Call',category:'Command',description:'Once per battle, after switches resolve but before attacks, change one locked move or target without seeing hidden opponent choices.'},
 {id:'safe-pivot',name:'Safe Pivot',category:'Command',description:'Once per battle, halve entry-hazard damage taken by a Pokémon you voluntarily switch in, rounded down. Other hazard effects apply.'}
];
export const TRAINER_STORY_FIELDS=[
 {key:'beforeJourney',label:'Life before the journey',prompt:'What did an ordinary day look like for you?',max:600},
 {key:'motivation',label:'Why accept the invitation?',prompt:'Why join Professor Meranti’s expedition?',max:500},
 {key:'goal',label:'Your biggest personal goal',prompt:'What is the one thing you want to accomplish?',max:500},
 {key:'strength',label:'Personal strength',prompt:'What comes naturally to you?',max:280},
 {key:'flaw',label:'Personal flaw',prompt:'What do you struggle with?',max:280},
 {key:'townConnection',label:'Connection to Luma Town',prompt:'Lifelong resident, recent arrival, visiting family, or something else?',max:500},
 {key:'trainerConnections',label:'Connections to other trainers',prompt:'Do you already know anyone in the group?',max:500},
 {key:'npcConnections',label:'Connections to local people',prompt:'Friends, family, Professor Meranti, Cedric, or other NPCs?',max:500},
 {key:'partnerStory',label:'Your first Pokémon',prompt:'How did you meet your partner?',max:500}
];
const clean=(x,max)=>String(x??'').trim().slice(0,max);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statMod=x=>Math.floor((x-10)/2);
export const trainingProgress=data=>({
 gymCount:Math.max(0,Math.min(8,Number.isInteger(data?.gymCount)?data.gymCount:0)),
 champion:data?.champion===true&&data?.gymCount===8
});
export function skillLimit(progress){
 const n=trainingProgress(progress).gymCount;
 return n>=6?5:n>=2?4:3;
}
export function proficiencyBonus(progress){
 const n=trainingProgress(progress).gymCount;
 return n>=8?4:n>=3?3:2;
}
export function talentLimit(progress){
 const p=trainingProgress(progress);
 return (p.gymCount>=7?3:p.gymCount>=4?2:p.gymCount>=1?1:0)+(p.champion?1:0);
}
export function blankTrainerSheet(){
 return {
  age:'',occupation:'',beforeJourney:'',motivation:'',goal:'',strength:'',flaw:'',
  townConnection:'',trainerConnections:'',npcConnections:'',partnerStory:'',
  attributes:{physique:-1,agility:-1,intellect:-1,presence:-1},
  abilityScores:{str:0,dex:0,con:0,int:0,wis:0,cha:0},abilityBoost:'',
  skills:[],talents:[]
 };
}
export function normalizeTrainerSheet(data){
 const src=data&&typeof data==='object'&&!Array.isArray(data)?data:{};
 const result=blankTrainerSheet();
 result.age=clean(src.age,8);result.occupation=clean(src.occupation,64);
 for(const field of TRAINER_STORY_FIELDS)result[field.key]=clean(src[field.key],field.max);
 for(const k of Object.keys(result.attributes)){
  if([-1,0,1,2].includes(src.attributes?.[k]))result.attributes[k]=src.attributes[k];
 }
 for(const {key} of TRAINER_ATTRIBUTES){
  const v=src.abilityScores?.[key];
  result.abilityScores[key]=[0,...STARTING_ARRAY].includes(v)?v:0;
 }
 result.abilityBoost=TRAINER_ATTRIBUTES.some(a=>a.key===src.abilityBoost)?src.abilityBoost:'';
 const allowedSkills=new Set(TRAINER_SKILLS.map(s=>s.name));
 const allowedTalents=new Set(TRAINER_TALENTS.map(t=>t.id));
 result.skills=Array.isArray(src.skills)?[...new Set(src.skills.filter(s=>allowedSkills.has(s)))].slice(0,5):[];
 result.talents=Array.isArray(src.talents)?[...new Set(src.talents.filter(t=>allowedTalents.has(t)))].slice(0,4):[];
 return result;
}
export function readTrainerSheet(form,previousSheet){
 const prev=normalizeTrainerSheet(previousSheet),f=new FormData(form);
 if(!f.has('sheetAge'))return prev; // Card-only page: preserve the saved character sheet.
 const result={...prev,age:clean(f.get('sheetAge'),8),occupation:clean(f.get('sheetOccupation'),64)};
 for(const field of TRAINER_STORY_FIELDS)result[field.key]=clean(f.get('sheet_'+field.key),field.max);
 for(const {key} of TRAINER_ATTRIBUTES)result.abilityScores[key]=Number(f.get('sheetAbility_'+key)??0);
 result.abilityBoost=String(f.get('sheetAbilityBoost')||'');
 result.skills=f.getAll('sheetSkill').map(String);
 result.talents=f.getAll('sheetTalent').map(String);
 return result;
}
export function validateTrainerSheet(input,progress){
 const p=trainingProgress(progress),s=input||{};
 const values=TRAINER_ATTRIBUTES.map(a=>s.abilityScores?.[a.key]);
 const allBlank=values.every(v=>v===0);
 if(!allBlank&&(values.length!==6||values.some(v=>!STARTING_ARRAY.includes(v))||new Set(values).size!==6))
  return 'Assign each starting score (14, 13, 12, 11, 10, 9) exactly once, or leave all six unassigned for now.';
 if(s.abilityBoost&&(!TRAINER_ATTRIBUTES.some(a=>a.key===s.abilityBoost)||p.gymCount<5||allBlank||s.abilityScores[s.abilityBoost]>=16))
  return 'The +1 ability-score improvement unlocks after Gym 5.';
 const allowedSkills=new Set(TRAINER_SKILLS.map(x=>x.name)),skills=s.skills||[];
 if(!Array.isArray(skills)||skills.length>skillLimit(p)||new Set(skills).size!==skills.length||skills.some(v=>!allowedSkills.has(v)))
  return 'Choose up to '+skillLimit(p)+' distinct trained skills for your current Gym progress.';
 const allowedTalents=new Set(TRAINER_TALENTS.map(x=>x.id)),talents=s.talents||[];
 if(!Array.isArray(talents)||talents.length>talentLimit(p)||new Set(talents).size!==talents.length||talents.some(v=>!allowedTalents.has(v)))
  return 'You have '+talentLimit(p)+' talent slot(s) unlocked. Choose no more than that.';
 const command=talents.filter(v=>TRAINER_TALENTS.find(t=>t.id===v)?.category==='Command').length;
 if(command>(p.champion?2:1))return 'You may choose at most '+(p.champion?2:1)+' Command talent(s).';
 if(p.gymCount<4&&command)return 'Command talents unlock after Gym 4. Your first talent must be Fieldcraft or Pokémoncraft.';
 if(p.gymCount<5&&talents.includes('legendary-pursuer'))return 'Legendary Pursuer unlocks after Gym 5.';
 return '';
}
export function sheetComplete(input){
 const s=normalizeTrainerSheet(input);
 return STARTING_ARRAY.every(n=>Object.values(s.abilityScores).includes(n))&&s.skills.length>=3;
}
const abilitySummary=(s,a)=>s.abilityScores[a.key]===0?'—':String(s.abilityScores[a.key]+(s.abilityBoost===a.key?1:0));
export function renderTrainerSheetEditor(input,active=true,progress){
 const s=normalizeTrainerSheet(input),p=trainingProgress(progress),skillMax=skillLimit(p),talentMax=talentLimit(p);
 const abilities=TRAINER_ATTRIBUTES.map(a=>'<label class="sheet-ability-input"><strong>'+a.short+'</strong><span>'+a.name+'</span><select name="sheetAbility_'+a.key+'">'+
  '<option value="0"'+(s.abilityScores[a.key]===0?' selected':'')+'>Not assigned</option>'+
  STARTING_ARRAY.map(n=>'<option value="'+n+'"'+(s.abilityScores[a.key]===n?' selected':'')+'>'+n+' ('+(statMod(n)>=0?'+':'')+statMod(n)+')</option>').join('')+
  '</select><small>'+esc(a.hint)+'</small></label>').join('');
 const boost='<label class="field full">Gym 5 ability improvement (+1)<select name="sheetAbilityBoost"'+(p.gymCount<5?' disabled':'')+'><option value="">Not selected</option>'+
  TRAINER_ATTRIBUTES.map(a=>'<option value="'+a.key+'"'+(s.abilityBoost===a.key?' selected':'')+'>'+a.short+' — '+a.name+'</option>').join('')+'</select></label>';
 const skills=TRAINER_SKILLS.map(x=>'<label class="sheet-skill-choice"><input type="checkbox" name="sheetSkill" value="'+esc(x.name)+'"'+(s.skills.includes(x.name)?' checked':'')+'><span>'+esc(x.name)+' <small>('+x.ability.toUpperCase()+')</small></span></label>').join('');
 const talents=['Fieldcraft','Pokémoncraft','Command'].map(category=>{
  const entries=TRAINER_TALENTS.filter(t=>t.category===category).map(t=>{
   const locked=(category==='Command'&&p.gymCount<4)||(t.minGyms&&p.gymCount<t.minGyms);
   return '<label class="sheet-talent-choice'+(locked?' locked':'')+'"><input type="checkbox" name="sheetTalent" value="'+t.id+'"'+(s.talents.includes(t.id)?' checked':'')+(locked?' disabled':'')+'><span><strong>'+esc(t.name)+'</strong>'+(locked?'<em>Locked until Gym '+(t.minGyms||4)+'</em>':'')+'<small>'+esc(t.description)+'</small></span></label>';
  }).join('');
  return '<div class="sheet-talent-group"><h4>'+category+'</h4>'+entries+'</div>';
 }).join('');
 const narrative=TRAINER_STORY_FIELDS.map(field=>'<label class="field sheet-story-field">'+esc(field.label)+'<textarea name="sheet_'+field.key+'" maxlength="'+field.max+'" rows="2">'+esc(s[field.key])+'</textarea></label>').join('');
 return '<section class="tabpane" data-page-body="character"'+(active?'':' hidden')+'>'+
  '<div class="sheet-intro"><h3>Character Sheet · Expedition dossier</h3><p>Six ordinary human ability scores, trained skills, and GM-unlocked talents. These affect Trainer checks, not Pokémon damage calculations.</p></div>'+
  '<div class="form-group"><label class="field">Character age (optional)<input name="sheetAge" maxlength="8" value="'+esc(s.age)+'"></label>'+
  '<label class="field">Occupation / background<input name="sheetOccupation" maxlength="64" value="'+esc(s.occupation)+'"></label></div>'+
  '<h3 class="sheet-heading">Ability scores</h3><p class="hint">Assign 14, 13, 12, 11, 10, 9 exactly once. Human scores remain capped at 16. Modifiers use the ordinary D&D formula.</p>'+
  '<div class="sheet-ability-editor">'+abilities+'</div><div class="form-group" style="margin-top:12px">'+boost+'</div>'+
  '<h3 class="sheet-heading">Skill proficiencies · '+s.skills.length+'/'+skillMax+'</h3><p class="hint">Checks: d20 + ability modifier + '+proficiencyBonus(p)+' if trained. Gain extra trained skills at Gym 2 and Gym 6.</p>'+
  '<div class="sheet-skill-editor">'+skills+'</div>'+
  '<h3 class="sheet-heading">Trainer Talents · '+s.talents.length+'/'+talentMax+'</h3>'+
  '<p class="hint">New slots: Gym 1, Gym 4, Gym 7, and Championship. Your first talent must be Fieldcraft or Pokémoncraft; only one Command talent before Championship. No Pokémon combat dice or damage multipliers are changed.</p>'+
  '<div class="sheet-talent-editor">'+talents+'</div>'+
  '<h3 class="sheet-heading">Background & connections</h3><p class="hint">Write as much or as little as you like about your character and their place in Santara.</p>'+
  '<div class="form-group sheet-story-editor">'+narrative+'</div></section>';
}
export function renderTrainerSheetViewer(input,progress){
 const s=normalizeTrainerSheet(input),p=trainingProgress(progress);
 const scores=TRAINER_ATTRIBUTES.map(a=>{
  const n=s.abilityScores[a.key],effective=n+(s.abilityBoost===a.key&&p.gymCount>=5?1:0),mod=n?statMod(effective):null;
  return '<div class="sheet-stat"><span>'+a.short+'</span><strong>'+abilitySummary({...s,abilityBoost:p.gymCount>=5?s.abilityBoost:''},a)+'</strong><small>'+(mod===null?'Unassigned':(mod>=0?'+':'')+mod+' modifier')+'</small></div>';
 }).join('');
 const skillTags=s.skills.map(name=>'<span class="sheet-skill">'+esc(name)+'</span>').join('')||'<span class="sheet-muted">No trained skills selected yet</span>';
 const talentTags=s.talents.map(id=>TRAINER_TALENTS.find(x=>x.id===id)).filter(Boolean).map(t=>'<div class="sheet-selected-talent"><strong>'+esc(t.name)+'</strong><small>'+t.category+'</small><p>'+esc(t.description)+'</p></div>').join('')||'<span class="sheet-muted">No talents selected yet</span>';
 const info=[['Age',s.age],['Occupation',s.occupation],...TRAINER_STORY_FIELDS.map(f=>[f.label,s[f.key]])].filter(([,value])=>value);
 return '<section class="sheet-viewer" aria-label="Trainer character sheet">'+
  '<div class="sheet-view-header"><div><span class="sheet-overline">PERSONAL EXPEDITION RECORD</span><h2>Trainer Character Sheet</h2></div>'+
  '<span class="sheet-status">'+p.gymCount+' / 8 Gyms · '+(p.champion?'Champion':'Trainer')+'</span></div>'+
  '<div class="sheet-progress-line"><span>Proficiency +'+proficiencyBonus(p)+'</span><span>Trained skills '+s.skills.length+'/'+skillLimit(p)+'</span><span>Talents '+s.talents.length+'/'+talentLimit(p)+'</span></div>'+
  '<div class="sheet-attributes">'+scores+'</div>'+
  '<div class="sheet-view-skills"><strong>Trained skills</strong><div class="sheet-skill-list">'+skillTags+'</div></div>'+
  '<div class="sheet-view-skills"><strong>Trainer talents</strong><div class="sheet-selected-talents">'+talentTags+'</div></div>'+
  (info.length?'<div class="sheet-view-story">'+info.map(([label,value])=>'<div class="sheet-story-item"><strong>'+esc(label)+'</strong><p>'+esc(value)+'</p></div>').join('')+'</div>':'<p class="sheet-muted">No background details recorded yet.</p>')+'</section>';
}
