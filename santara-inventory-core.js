// Shared Santara Trainer Bag and TM rules. Pure helpers used in both editions.
export const ITEM_CATEGORIES=Object.freeze(['ball','medicine','battle','material','key','evolution','tm','misc']);
export const MAX_BAG_ENTRIES=120;
export const MAX_ITEM_QUANTITY=9999;
export const keyOf=value=>String(value||'').trim().toLowerCase().normalize('NFKD')
 .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const moveId=value=>keyOf(value);
export function inventoryId(category,name,moveName=''){
 const type=ITEM_CATEGORIES.includes(category)?category:'misc';
 const key=type==='tm'?moveId(moveName):keyOf(name);
 if(!key)throw Error('Give the item a name or TM move.');
 return (type+'-'+key).slice(0,95);
}
export function itemDefinition({name,category,description='',moveName='',quantity=1}){
 const type=String(category||'misc').toLowerCase();
 if(!ITEM_CATEGORIES.includes(type))throw Error('Select a valid item category.');
 const move=String(moveName||'').trim().slice(0,48);
 const label=type==='tm'?'TM · '+move:String(name||'').trim().slice(0,75);
 const details=String(description||'').trim().slice(0,180);
 const count=Number(quantity);
 if(type==='tm'&&!move)throw Error('A TM must specify the move it teaches.');
 if(!label||label.length>75)throw Error('Item name must be 1–75 characters.');
 if(!Number.isInteger(count)||count<1||count>MAX_ITEM_QUANTITY)throw Error('Quantity must be from 1 to 9999.');
 const id=inventoryId(type,label,move);
 return {id,name:label,category:type,description:details,moveName:type==='tm'?move:'',quantity:count};
}
export function bagItems(data){
 if(!data||typeof data!=='object'||Array.isArray(data))return {};
 const results={};
 for(const [id,item] of Object.entries(data)){
  if(!item||typeof item!=='object'||!ITEM_CATEGORIES.includes(item.category))continue;
  if(!Number.isInteger(item.quantity)||item.quantity<1)continue;
  results[id]=item;
 }
 return results;
}
export function adjustBag(items,definition,change){
 const delta=Number(change);
 if(!Number.isInteger(delta)||delta===0||Math.abs(delta)>MAX_ITEM_QUANTITY)throw Error('Quantity change must be a whole number.');
 const copy={...bagItems(items)},id=definition.id,existing=copy[id];
 if(existing && (existing.category!==definition.category || existing.moveName!==definition.moveName))
  throw Error('Item ID conflict. Use a different name or TM move.');
 const next=(existing?.quantity||0)+delta;
 if(next<0)throw Error('Not enough items in this Trainer bag.');
 if(next>MAX_ITEM_QUANTITY)throw Error('An item stack cannot exceed 9999.');
 if(next===0)delete copy[id];
 else copy[id]={...(existing||definition),quantity:next,...(!existing?{}:{name:existing.name,description:existing.description})};
 if(Object.keys(copy).length>MAX_BAG_ENTRIES)throw Error('A Trainer bag can contain at most 120 different items.');
 return copy;
}
export function teachMove(known,moveName,forgetMove=''){
 const existing=(Array.isArray(known)?known:[]).filter(x=>typeof x==='string'&&x.trim()).slice();
 const newName=String(moveName||'').trim(),forgotten=String(forgetMove||'').trim();
 if(!newName||newName.length>48)throw Error('The TM must have a valid move name.');
 if(existing.some(x=>moveId(x)===moveId(newName)))throw Error('The Pokémon already knows '+newName+'.');
 if(existing.length>4)throw Error('This Pokémon has too many recorded moves.');
 if(forgotten){
  const i=existing.findIndex(x=>moveId(x)===moveId(forgotten));
  if(i<0)throw Error('The selected replacement move is no longer known.');
  existing[i]=newName;
 }else{
  if(existing.length>=4)throw Error('Choose a move to forget; all four slots are full.');
  existing.push(newName);
 }
 return existing;
}
export function tmUsable(item){
 return item?.category==='tm'&&Number.isInteger(item.quantity)&&item.quantity>0&&
  typeof item.moveName==='string'&&item.moveName.trim().length>0&&item.moveName.length<=48;
}
