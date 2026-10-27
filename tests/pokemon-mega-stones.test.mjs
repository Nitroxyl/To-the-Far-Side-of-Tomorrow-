import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../pokemon-mega-stones.js',import.meta.url),'utf8');
const {suggestedMegaStone,hasRequiredMegaStone}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(src));
const z={slug:'mega-charizard-z',name:'Mega Charizard Z',baseSpeciesKey:'charizard'};
const x={slug:'charizard-mega-x',name:'Mega Charizard X',baseSpeciesKey:'charizard'};
const y={slug:'charizard-mega-y',name:'Mega Charizard Y',baseSpeciesKey:'charizard'};
const c={speciesKey:'charizard',heldItem:''};

test('Official X/Y and Santara Z require distinct Mega Stones',()=>{
 assert.equal(suggestedMegaStone(c,x),'Charizardite X');
 assert.equal(suggestedMegaStone(c,y),'Charizardite Y');
 assert.equal(suggestedMegaStone(c,z),'Charizardite Z');
 assert.equal(suggestedMegaStone({speciesKey:'lucario'},{name:'Mega Lucario',slug:'lucario-mega',baseSpeciesKey:'lucario'}),'Lucarionite');
});
test('Mega Evolution cannot activate with no stone or the wrong held item',()=>{
 assert.equal(hasRequiredMegaStone(c,'Charizardite Z'),false);
 assert.equal(hasRequiredMegaStone({...c,heldItem:'Charizardite X'},'Charizardite Z'),false);
 assert.equal(hasRequiredMegaStone({...c,heldItem:'Charizardite Z'},''),false);
});
test('Correct held item is case-insensitive and whitespace-trimmed',()=>{
 assert.equal(hasRequiredMegaStone({...c,heldItem:'  charizardite z  '},'Charizardite Z'),true);
 assert.equal(hasRequiredMegaStone({...c,heldItem:'Charizardite Y'},'Charizardite Y'),true);
});
test('UI disables Mega Evolve without a configured equipped stone but permits reverting',()=>{
 const uiSource=readFileSync(new URL('../pokemon-gimmick-ui.js',import.meta.url),'utf8')
  .replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
 const render=new Function('hasRequiredMegaStone',uiSource+'\nreturn controlsUI;')(hasRequiredMegaStone);
 const option=(value,label)=>'<option value="'+value+'">'+label+'</option>';
 const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
 const g={mega:true,tera:false,zMove:false,dynamax:false};
 const pokemon={...c,megaForm:z,megaActive:false};
 assert.match(render(pokemon,g,esc,option,true,'Charizardite Z'),/data-act="g-mega" disabled/);
 assert.match(render({...pokemon,heldItem:'Charizardite X'},g,esc,option,true,'Charizardite Z'),/data-act="g-mega" disabled/);
 assert.doesNotMatch(render({...pokemon,heldItem:'Charizardite Z'},g,esc,option,true,'Charizardite Z'),/data-act="g-mega" disabled/);
 assert.match(render({...pokemon,megaActive:true},g,esc,option,true,'Charizardite Z'),/Revert Mega/);
 assert.doesNotMatch(render({...pokemon,megaActive:true},g,esc,option,true,'Charizardite Z'),/data-act="g-mega" disabled/);
});
