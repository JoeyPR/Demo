import {resolveItemInfo} from '../demo/engine/item-info.mjs';

const make=(tag,className,id,text)=>{
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(id)node.id=id;
  if(text!=null)node.textContent=text;
  return node;
};
const overlay=make('div','drop-overlay','item-info-overlay');
overlay.hidden=true;
const dialog=make('section','drop-dialog item-info-dialog','item-info-dialog');
dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
dialog.setAttribute('aria-labelledby','item-info-title');
dialog.setAttribute('aria-describedby','item-info-description');
dialog.tabIndex=-1;
const row=make('div','drop-item-row');
const icon=make('div','drop-item-icon','item-info-icon');
const title=make('h2','drop-title','item-info-title');
row.append(icon,title);
const description=make('p','item-info-description','item-info-description');
const propertyGroup=make('div','item-info-property-group');
const properties=make('div','item-info-properties','item-info-properties');
propertyGroup.append(properties);
const actions=make('div','drop-actions');
const closeButton=make('button','drop-confirm','item-info-close','OK');
closeButton.type='button';actions.append(closeButton);
dialog.append(row,description,propertyGroup,actions);overlay.append(dialog);document.body.append(overlay);

let snapshot=null,current=null,previousFocus=null;
let pending=null,requestVersion=0;
function load() {
  if(!pending)pending=fetch(new URL('../data/item-info.json',import.meta.url))
    .then(response=>{if(!response.ok)throw Error('Item information unavailable');return response.json();})
    .then(data=>(snapshot=data))
    .catch(error=>{pending=null;throw error;});
  return pending;
}
function position() {
  const rect=document.getElementById('preview').getBoundingClientRect();
  const scale=.92*Math.max(.12,Math.min(rect.width/643,rect.height/480));
  Object.assign(overlay.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});
  for(const [name,value] of Object.entries({
    'scale':scale,'min-width':Math.min(rect.width*.88,565*scale)+'px','max-width':rect.width*.96+'px',
    'pad-x':28*scale+'px','pad-top':22*scale+'px','pad-bottom':18*scale+'px','row-gap':12*scale+'px',
    'title-size':Math.max(18,44*scale)+'px','icon-size':48*scale+'px',
    'button-height':Math.max(32,62*scale)+'px','button-font':Math.max(18,38*scale)+'px','ok-width':Math.max(58,92*scale)+'px'
  }))dialog.style.setProperty('--drop-'+name,String(value));
  dialog.style.setProperty('--info-font-size',Math.max(12,27*scale)+'px');
}
function formatted(node,text,code) {
  node.textContent=P.rtfont?.color(code,text)??text;
  P.rtfont?.scan(node);
}
function render(item) {
  const info=resolveItemInfo(snapshot,item);
  formatted(description,info.description||'Description unavailable.','o');
  properties.replaceChildren();
  for(const line of info.properties){const p=make('p');formatted(p,line,'1');properties.append(p);}
  propertyGroup.hidden=!info.properties.length;
  dialog.setAttribute('aria-busy','false');
}
function close() {
  if(overlay.hidden)return;
  requestVersion++;overlay.hidden=true;current=null;icon.replaceChildren();
  P.emit('input-reset');P.emit('item-info-close');
  if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
}
async function open(item) {
  if(!item||item.gone)return;
  P.emit('dialog-open','info');
  const version=++requestVersion;
  if(overlay.hidden)previousFocus=document.activeElement;
  current=item;title.textContent=item.name;
  icon.replaceChildren();
  try{if(P.thumb)icon.append(P.thumb(item,64));}catch{icon.textContent=(item.name||'?').slice(0,1);}
  formatted(description,'Loading item information…','o');
  propertyGroup.hidden=true;dialog.setAttribute('aria-busy','true');
  overlay.hidden=false;position();dialog.scrollTop=0;
  P.emit('input-reset');P.emit('item-info-open',item);
  closeButton.focus({preventScroll:true});
  try{await load();if(version===requestVersion&&!overlay.hidden)render(item);}
  catch{if(version===requestVersion&&!overlay.hidden){formatted(description,'Item information could not be loaded.','o');dialog.setAttribute('aria-busy','false');}}
}
P.on('dialog-open',name=>{if(name!=='info')close();});
closeButton.addEventListener('click',close);
overlay.addEventListener('pointerdown',event=>{event.stopPropagation();if(event.target===overlay)close();});
dialog.addEventListener('pointerdown',event=>event.stopPropagation());
document.addEventListener('keydown',event=>{
  if(overlay.hidden)return;
  event.stopPropagation();
  if(event.key==='Escape'){event.preventDefault();close();return;}
  if(event.key==='Tab'){
    event.preventDefault();closeButton.focus();
  }
},true);
window.addEventListener('resize',position);P.on('preview',position);P.on('info-request',open);
P.itemInfo={open,close,get current(){return current;},get data(){return snapshot;},get ready(){return load();}};
