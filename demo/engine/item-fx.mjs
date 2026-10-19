import {compose,translate,scale,rotate,point} from "./math.mjs";

// Appearance is source-backed; procedural art and coefficients are reference
// tuning, NOT extracted native effect clips. Never derive a recipe from fx=true.
export const ITEM_FX_RECIPES={
  1438:{kind:"sparkle",interval:140,life:520,color:[255,223,105],source:"https://growtopiawiki.com/w/Golden_Pickaxe",anchor:"hand"},
  288:{kind:"bubble",interval:240,life:1100,color:[180,236,255],source:"https://growtopiawiki.com/w/Snorkel",anchor:[30,0],userObserved:true},
  2048:{kind:"dust",interval:55,life:700,color:[157,255,88],source:"https://growtopiawiki.com/w/Riding_Comet",anchor:[-5,31],moving:true},
  2064:{kind:"dust",interval:55,life:700,color:[150,226,255],source:"https://growtopiawiki.com/w/Riding_Meteor",anchor:[-5,31],moving:true},
  138:{kind:"beam",trigger:"punch",life:180,color:[255,75,55],source:"https://growtopiawiki.com/w/Cyclopean_Visor",anchor:[24,7]},
  366:{kind:"heart",trigger:"punch",life:260,color:[255,115,155],source:"https://growtopiawiki.com/w/Heartbow",anchor:"hand"},
  472:{kind:"bullet",trigger:"punch",life:220,color:[255,229,139],source:"https://growtopiawiki.com/w/Tommygun",anchor:"hand"}
};
export function punchEffectOwner(items) {
  return items.find(i=>i.slot===5&&ITEM_FX_RECIPES[i.id]?.trigger==="punch")??
    items.find(i=>ITEM_FX_RECIPES[i.id]?.trigger==="punch");
}
const cells={sparkle:0,bubble:1,heart:2,bullet:3,beam:4,dust:5};
const noise=n=>{let x=Math.imul(n|0,0x45d9f3b);x^=x>>>16;return (x>>>0)/4294967296;};
export class ItemEffects {
  constructor(){this.particles=[];this.last=new Map();}
  reset(){this.particles=[];this.last.clear();}
  step(items,motion,calls,lift) {
    const now=motion.clockMs,ox=(motion.worldX??motion.x??0)-(motion.x??0),
      oy=(motion.worldY??motion.y??0)-(motion.y??0);
    this.particles=this.particles.filter(p=>now>=p.birth&&now-p.birth<p.recipe.life);
    const punchOwner=punchEffectOwner(items);
    for(const item of items) {
      const recipe=ITEM_FX_RECIPES[item.id];if(!recipe)continue;
      if(recipe.trigger==="punch"&&punchOwner!==item)continue;
      if(recipe.moving&&Math.abs(motion.vx??0)<1&&motion.locomotion!=="walk")continue;
      const stamp=recipe.trigger==="punch"?
        (motion.events??[]).find(e=>e.type==="punch")?.id:Math.floor(now/recipe.interval);
      if(stamp===undefined||this.last.get(item.id)===stamp)continue;
      this.last.set(item.id,stamp);
      const hand=calls.find(c=>c.owner===item.id&&c.attachment==="frontHand");
      const facing=motion.facing<0?-1:1;
      const local=recipe.anchor==="hand"&&hand?point(hand.matrix,[16,9]):
        [(motion.x??0)+(facing<0?32-(Array.isArray(recipe.anchor)?recipe.anchor[0]:24):
          (Array.isArray(recipe.anchor)?recipe.anchor[0]:24)),
        (motion.y??0)+(Array.isArray(recipe.anchor)?recipe.anchor[1]:18)+(lift?.y??0)];
      let target=motion.punch?.target??[64,16];
      target=[(motion.x??0)+(facing<0?32-target[0]:target[0]),(motion.y??0)+target[1]+(lift?.y??0)];
      const dx=target[0]-local[0],dy=target[1]-local[1],distance=Math.hypot(dx,dy);
      const reach=Math.min(192,distance),factor=distance?reach/distance:0;
      this.particles.push({recipe,birth:now,x:local[0]+ox,y:local[1]+oy,
        target:[local[0]+dx*factor+ox,local[1]+dy*factor+oy],
        seed:item.id+Math.floor(now),facing});
    }
    if(this.particles.length>400)this.particles.splice(0,this.particles.length-400);
    return this.particles.map(p=>{
      const r=p.recipe,age=now-p.birth,t=age/r.life,sec=age/1000;
      let x=p.x-ox,y=p.y-oy,k=1,angle=0,sx=1,sy=1;
      if(r.trigger==="punch") {
        const dx=p.target[0]-p.x,dy=p.target[1]-p.y;angle=Math.atan2(dy,dx)*180/Math.PI;
        if(r.kind==="beam"){sx=Math.max(.01,Math.hypot(dx,dy)/32);sy=.35;x+=dx/2;y+=dy/2;}
        else {x+=dx*t;y+=dy*t;k=r.kind==="heart"?.65:.45;}
      }else if(r.kind==="bubble"){x+=Math.sin(sec*6+p.seed)*2;y-=sec*18;k=.055+.09*t;}
      else if(r.kind==="dust"){x-=p.facing*sec*15;y-=sec*4;k=.2*(1-t)+.05;}
      else {x+=(noise(p.seed)-.5)*14;y+=(noise(p.seed+7)-.5)*14;k=.08+.12*Math.sin(Math.PI*t);angle=age*.12;}
      return {atlas:"reference-fx.png",sx:cells[r.kind]*32,sy:0,sw:32,sh:32,alpha:1-t,
        tint:r.color,pass:"PARTICLES",owner:null,referenceFx:r.kind,
        matrix:compose(translate(x,y),rotate(angle),scale(k*sx,k*sy),translate(-16,-16))};
    });
  }
}
