import {PreviewMotion} from '../demo/engine/motion.mjs';

// World rendering uses 20 logical units for each native 32px texture cell.
// Motion x is the avatar centre, y its feet, relative to the spawn surface.
export const WORLD_TILE_SIZE=20;
export const WORLD_ORIGIN_X=50.5*WORLD_TILE_SIZE;
export const WORLD_ORIGIN_Y=24*WORLD_TILE_SIZE;
export const WORLD_PLAYER_HALF_WIDTH=8;
export const WORLD_PLAYER_HEIGHT=32*.78;
const EPS=1e-7;

export class WorldMotion extends PreviewMotion {
  constructor({world,blocks={},tileSize=WORLD_TILE_SIZE,originX=WORLD_ORIGIN_X,
    originY=WORLD_ORIGIN_Y,...options}={}) {
    super(options);
    Object.assign(this,{world,blocks,tileSize,originX,originY});
  }
  setWorld(world) {this.world=world;return this;}
  collisionAt(tx,ty) {
    const rows=this.world?.fg,height=rows?.length??0,width=rows?.[0]?.length??0;
    if(!width||ty<0||ty>=height)return 0;
    const x=((tx%width)+width)%width;
    return this.blocks[rows[ty]?.[x]??0]?.collision??0;
  }
  // Coordinates use the same centre/feet world space as MotionFrame x/y.
  solidAt(x,y) {
    return this.collisionAt(Math.floor((x+this.originX)/this.tileSize),
      Math.floor((y+this.originY)/this.tileSize))===1;
  }
  respawn({x=0,y=0}={}) {
    Object.assign(this,{x,y,vx:0,vy:0,ground:false,punch:null,cooldown:0,
      airAvailable:this.doubleJump,moveMs:0});
    this.events.push({type:'respawn',id:`respawn:${this.clockMs}`,at:this.clockMs,x,y,facing:this.facing});
    return this.snapshot();
  }
  advancePosition(dt) {
    if(!this.world)return super.advancePosition(dt);
    const tile=this.tileSize,half=WORLD_PLAYER_HALF_WIDTH,height=WORLD_PLAYER_HEIGHT;
    const beforeGround=this.ground;
    let cx=this.x+this.originX,feet=this.y+this.originY;
    const dx=this.vx*dt,dy=this.vy*dt;
    const topRow=Math.floor((feet-height+EPS)/tile),bottomRow=Math.floor((feet-EPS)/tile);
    if(dx>0) {
      const from=Math.floor((cx+half-EPS)/tile),to=Math.floor((cx+half+dx-EPS)/tile);
      let hit=false;
      for(let tx=from;tx<=to&&!hit;tx++)for(let ty=topRow;ty<=bottomRow;ty++) {
        if(this.collisionAt(tx,ty)===1&&tx*tile>=cx+half-EPS) {
          cx=tx*tile-half;this.vx=0;hit=true;break;
        }
      }
      if(!hit)cx+=dx;
    } else if(dx<0) {
      const from=Math.floor((cx-half+EPS)/tile),to=Math.floor((cx-half+dx+EPS)/tile);
      let hit=false;
      for(let tx=from;tx>=to&&!hit;tx--)for(let ty=topRow;ty<=bottomRow;ty++) {
        if(this.collisionAt(tx,ty)===1&&(tx+1)*tile<=cx-half+EPS) {
          cx=(tx+1)*tile+half;this.vx=0;hit=true;break;
        }
      }
      if(!hit)cx+=dx;
    }
    const left=Math.floor((cx-half+EPS)/tile),right=Math.floor((cx+half-EPS)/tile);
    this.ground=false;
    if(dy>=0) {
      const from=Math.floor((feet-EPS)/tile),to=Math.floor((feet+dy+EPS)/tile);
      let hit=false;
      for(let ty=from;ty<=to&&!hit;ty++) {
        const tileTop=ty*tile;
        if(tileTop<feet-EPS||tileTop>feet+dy+EPS)continue;
        for(let tx=left;tx<=right;tx++)if([1,2].includes(this.collisionAt(tx,ty))) {
          feet=tileTop;this.vy=0;this.ground=true;hit=true;break;
        }
      }
      if(!hit)feet+=dy;
    } else {
      const oldTop=feet-height,newTop=oldTop+dy;
      const from=Math.floor((oldTop+EPS)/tile),to=Math.floor((newTop+EPS)/tile);
      let hit=false;
      for(let ty=from;ty>=to&&!hit;ty--) {
        const tileBottom=(ty+1)*tile;
        if(tileBottom>oldTop+EPS||tileBottom<newTop-EPS)continue;
        for(let tx=left;tx<=right;tx++)if(this.collisionAt(tx,ty)===1) {
          feet=tileBottom+height;this.vy=0;hit=true;break;
        }
      }
      if(!hit)feet+=dy;
    }
    this.x=cx-this.originX;this.y=feet-this.originY;
    if(this.ground) {
      this.airAvailable=this.doubleJump;
      if(!beforeGround)this.events.push({type:'land',id:`land:${this.clockMs}`,at:this.clockMs,
        x:this.x,y:this.y,facing:this.facing});
    }
    if(this.y>(this.world.fg.length*tile-this.originY)+5*tile)this.respawn();
  }
}
