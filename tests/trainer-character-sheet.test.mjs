import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../trainer-character-sheet.js',import.meta.url),'utf8');
const {
 blankTrainerSheet,normalizeTrainerSheet,validateTrainerSheet,sheetComplete,
 renderTrainerSheetEditor,renderTrainerSheetViewer
}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(code));

test('new trainers start with an editable, unfinished sheet',()=>{
 const draft=blankTrainerSheet();
 assert.equal(draft.attributes.physique,-1);
 assert.deepEqual(draft.skills,[]);
 assert.equal(validateTrainerSheet(draft),'');
 assert.equal(sheetComplete(draft),false);
});

test('one +2, two +1 and one +0 with three skills completes a sheet',()=>{
 const draft=blankTrainerSheet();
 draft.attributes={physique:2,agility:1,intellect:1,presence:0};
 draft.skills=['Athletics','Investigation','Pokémon Handling'];
 assert.equal(validateTrainerSheet(draft),'');
 assert.equal(sheetComplete(draft),true);
});

test('invalid attribute or skill allocations cannot be saved',()=>{
 const draft=blankTrainerSheet();
 draft.attributes={physique:2,agility:2,intellect:1,presence:0};
 assert.match(validateTrainerSheet(draft),/Distribute/);
 draft.attributes={physique:2,agility:1,intellect:1,presence:0};
 draft.skills=['Athletics','Athletics'];
 assert.match(validateTrainerSheet(draft),/different/);
 draft.skills=['Athletics','Investigation','Stealth','Medicine'];
 assert.match(validateTrainerSheet(draft),/up to three/);
});

test('legacy cards normalize safely and descriptions cannot inject HTML',()=>{
 const draft=normalizeTrainerSheet({goal:'Find <img src=x onerror=alert(1)>',skills:['Stealth','Stealth','unknown']});
 assert.equal(draft.skills.length,1);
 assert.equal(draft.age,'');
 assert.ok(renderTrainerSheetViewer(draft).includes('&lt;img'));
 assert.ok(!renderTrainerSheetViewer(draft).includes('<img'));
});

test('the dossier renders four stat selectors and twelve skill checkboxes',()=>{
 const html=renderTrainerSheetEditor(blankTrainerSheet(),true);
 assert.equal((html.match(/name="sheetStat_/g)||[]).length,4);
 assert.equal((html.match(/name="sheetSkill"/g)||[]).length,12);
 assert.ok(html.startsWith('<section class="tabpane" data-pane-body="sheet">'));
});

test('background fields use compact two-column layout with no guiding placeholders',()=>{
 const markup=renderTrainerSheetEditor(blankTrainerSheet(),true);
 assert.equal((markup.match(/class="field sheet-story-field"/g)||[]).length,9);
 assert.equal((markup.match(/<textarea /g)||[]).length,9);
 assert.ok(!markup.includes('placeholder='));
 assert.ok(!markup.includes('class="field full"'));
 assert.ok(markup.includes('class="form-group sheet-story-editor"'));
});
