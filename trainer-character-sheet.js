// Lightweight non-combat Trainer character sheet. The Pokemon party stays in My Pokemon.
export const TRAINER_ATTRIBUTES=[
 {key:'physique',name:'Physique',short:'PHY',hint:'Strength, endurance and physical effort'},
 {key:'agility',name:'Agility',short:'AGI',hint:'Balance, reflexes and sneaking'},
 {key:'intellect',name:'Intellect',short:'INT',hint:'Research, technology and problem-solving'},
 {key:'presence',name:'Presence',short:'PRE',hint:'Persuasion, empathy and Pokémon handling'}
];
export const TRAINER_SKILLS=[
 'Athletics','Acrobatics','Stealth','Perception','Investigation','Survival',
 'Pokémon Handling','Pokémon Knowledge','Technology','Medicine','Persuasion','Deception'
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
export function blankTrainerSheet(){
 return {
  age:'',occupation:'',beforeJourney:'',motivation:'',goal:'',strength:'',flaw:'',
  townConnection:'',trainerConnections:'',npcConnections:'',partnerStory:'',
  attributes:{physique:-1,agility:-1,intellect:-1,presence:-1},skills:[]
 };
}
export function normalizeTrainerSheet(data){
 const source=data&&typeof data==='object'&&!Array.isArray(data)?data:{};
 const result=blankTrainerSheet();
 result.age=clean(source.age,8);result.occupation=clean(source.occupation,64);
 for(const f of TRAINER_STORY_FIELDS)result[f.key]=clean(source[f.key],f.max);
 for(const {key} of TRAINER_ATTRIBUTES){
  const value=source.attributes?.[key];
  result.attributes[key]=[-1,0,1,2].includes(value)?value:-1;
 }
 result.skills=Array.isArray(source.skills)?[...new Set(source.skills.filter(s=>TRAINER_SKILLS.includes(s)))].slice(0,3):[];
 return result;
}
export function readTrainerSheet(form){
 const data=new FormData(form);
 const value=(name,max)=>clean(data.get(name),max);
 const attributes={};
 for(const {key} of TRAINER_ATTRIBUTES)attributes[key]=Number(data.get('sheetStat_'+key)??-1);
 const result={
  age:value('sheetAge',8),occupation:value('sheetOccupation',64),
  attributes,skills:data.getAll('sheetSkill').map(String)
 };
 for(const f of TRAINER_STORY_FIELDS)result[f.key]=value('sheet_'+f.key,f.max);
 return result;
}
export function validateTrainerSheet(sheet){
 const attrs=TRAINER_ATTRIBUTES.map(({key})=>sheet.attributes?.[key]);
 if(attrs.some(n=>![-1,0,1,2].includes(n)))return 'Choose an allowed attribute modifier (or leave it unassigned).';
 if([0,1,2].some((n)=>attrs.filter(v=>v===n).length>({0:1,1:2,2:1}[n])))return 'Distribute modifiers as +2, +1, +1, and +0, with each value used the correct number of times.';
 const skills=sheet.skills||[];
 if(!Array.isArray(skills)||skills.length>3||new Set(skills).size!==skills.length||skills.some(s=>!TRAINER_SKILLS.includes(s)))
  return 'Choose up to three different skill proficiencies.';
 return '';
}
export function sheetComplete(sheet){
 const s=normalizeTrainerSheet(sheet);
 return TRAINER_ATTRIBUTES.map(({key})=>s.attributes[key]).sort().join(',')==='0,1,1,2'&&s.skills.length===3;
}
export function renderTrainerSheetEditor(input,active=false){
 const s=normalizeTrainerSheet(input);
 const options=value=>'<option value="-1"'+(value===-1?' selected':'')+'>Not assigned</option>'+
  [0,1,2].map(n=>'<option value="'+n+'"'+(n===value?' selected':'')+'>+'+n+'</option>').join('');
 const attr=TRAINER_ATTRIBUTES.map(a=>'<label class="sheet-stat-input"><strong>'+a.short+'</strong><span>'+a.name+'</span><select name="sheetStat_'+a.key+'">'+options(s.attributes[a.key])+'</select><small>'+esc(a.hint)+'</small></label>').join('');
 const skill=TRAINER_SKILLS.map(name=>'<label class="sheet-skill-choice"><input type="checkbox" name="sheetSkill" value="'+esc(name)+'"'+(s.skills.includes(name)?' checked':'')+'><span>'+esc(name)+'</span></label>').join('');
 const narrative=TRAINER_STORY_FIELDS.map(f=>'<label class="field full">'+esc(f.label)+'<textarea name="sheet_'+f.key+'" maxlength="'+f.max+'" rows="3" placeholder="'+esc(f.prompt)+'">'+esc(s[f.key])+'</textarea></label>').join('');
 return '<section class="tabpane" data-pane-body="sheet"'+(active?'':' hidden')+'>'+
  '<div class="sheet-intro"><h3>Character sheet · Expedition dossier</h3><p>Your trainer is a person first, not a second Pokémon. These details shape exploration and roleplay. Only approved Trainers can view your published dossier.</p></div>'+
  '<div class="form-group"><label class="field">Character age (optional)<input name="sheetAge" maxlength="8" value="'+esc(s.age)+'" placeholder="e.g. 18"></label>'+
  '<label class="field">Occupation / background<input name="sheetOccupation" maxlength="64" value="'+esc(s.occupation)+'" placeholder="e.g. Student, mechanic, researcher"></label></div>'+
  '<h3 class="sheet-heading">Trainer attributes</h3><p class="hint">Assign +2, +1, +1 and +0 across the four attributes. These only affect trainer skill checks, not Pokémon damage.</p>'+
  '<div class="sheet-attribute-editor">'+attr+'</div>'+
  '<h3 class="sheet-heading">Skill proficiencies</h3><p class="hint">Choose three. Each chosen skill adds +2 to relevant checks: d20 + attribute + proficiency (if applicable).</p>'+
  '<div class="sheet-skill-editor">'+skill+'</div>'+
  '<h3 class="sheet-heading">Background & connections</h3><p class="hint">Answer as much or as little as you like. Your self-insert may have lived in Luma Town for years, or have another reason to be here.</p>'+
  '<div class="form-group sheet-story-editor">'+narrative+'</div>'+
  '</section>';
}
export function renderTrainerSheetViewer(input){
 const s=normalizeTrainerSheet(input);
 const complete=sheetComplete(s);
 const attributes=TRAINER_ATTRIBUTES.map(a=>'<div class="sheet-stat"><span>'+a.short+'</span><strong>'+(s.attributes[a.key]<0?'—':'+'+s.attributes[a.key])+'</strong><small>'+a.name+'</small></div>').join('');
 const skills=s.skills.map(v=>'<span class="sheet-skill">'+esc(v)+'</span>').join('')||'<span class="sheet-muted">No proficiencies selected yet</span>';
 const info=[['Age',s.age],['Occupation',s.occupation],...TRAINER_STORY_FIELDS.map(f=>[f.label,s[f.key]])].filter(([,v])=>v);
 return '<section class="sheet-viewer" aria-label="Trainer character sheet">'+
  '<div class="sheet-view-header"><div><span class="sheet-overline">PERSONAL EXPEDITION RECORD</span><h2>Trainer Dossier</h2></div><span class="sheet-status">'+(complete?'Attributes & skills assigned':'Character sheet in progress')+'</span></div>'+
  '<div class="sheet-attributes">'+attributes+'</div>'+
  '<div class="sheet-view-skills"><strong>Skill proficiencies</strong><div class="sheet-skill-list">'+skills+'</div></div>'+
  (info.length?'<div class="sheet-view-story">'+info.map(([label,value])=>'<div class="sheet-story-item"><strong>'+esc(label)+'</strong><p>'+esc(value)+'</p></div>').join('')+'</div>':'<p class="sheet-muted">No personal history published yet. Use the Character Sheet tab to introduce your trainer.</p>')+
  '</section>';
}