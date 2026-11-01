import { approach } from "./math.mjs";
import { PLANNER_PROFILE } from "./planner-profile.mjs";

// Optional preview controller. Only a flat floor, not Growtopia world physics.
// The renderer also accepts externally supplied, calibrated MotionFrames directly.
export class PreviewMotion {
  constructor({floorY=0,profile=PLANNER_PROFILE,doubleJump=false}={}) {
    Object.assign(this,{x:0,y:floorY,vx:0,vy:0,ground:true,facing:1,
      floorY,profile,doubleJump,airAvailable:doubleJump,moveMs:0,
      clockMs:0,lastJump:false,lastPunch:false,punch:null,cooldown:0,events:[],locomotion:"idle"});
  }
  setAbilities({doubleJump=false,highJump=false,slowFall=false,speedy=false}={}) {
    this.doubleJump=doubleJump;this.highJump=highJump;this.slowFall=slowFall;this.speedy=speedy;
    // Equipping an item in the air must never refill an already-used jump.
    if(this.ground)this.airAvailable=doubleJump;
    else if(!doubleJump)this.airAvailable=false;
  }
  step(dtMs,input={}) {
    if(dtMs<=0 || dtMs>50) throw Error("Use fixed steps of at most 50ms");
    const dt=dtMs/1000,c=this.profile.physics;
    this.clockMs+=dtMs; this.events=[];
    const justJump=!!input.jump&&!this.lastJump;
    const direction=Number(!!input.right)-Number(!!input.left);
    this.lastJump=!!input.jump;
    if(direction&&!input.punchTarget) this.facing=direction;
    this.vx=approach(this.vx,direction*c.speed*(this.speedy?1.4:1),(direction?c.acceleration:c.friction)*dt);
    if(justJump&&(this.ground||this.airAvailable)) {
      const type=this.ground?"jump":"doubleJump";
      if(!this.ground) this.airAvailable=false;
      this.ground=false;
      // One additional 32-unit tile at full held-jump height. Preview physics,
      // not a recovered official-client impulse.
      this.vy=-Math.sqrt(c.jump*c.jump+(this.highJump?2*c.gravity*32:0));
      this.events.push({type,id:`${type}:${this.clockMs}`,at:this.clockMs,x:this.x,y:this.y,facing:this.facing});
    } else if(!this.ground) {
      const release=this.vy<0&&!input.jump?c.releaseGravity:0;
      this.vy=Math.min(c.maxFall,this.vy+(c.gravity+release)*dt);
      if(this.slowFall&&input.jump&&this.vy>0)
        this.vy=Math.min(this.vy,c.maxFall*c.slowFallFactor);
    }
    this.advancePosition(dt);
    this.cooldown=Math.max(0,this.cooldown-dtMs);
    if(this.cooldown<1e-7)this.cooldown=0; // Do not add a frame for floating-point residue.
    if(this.punch) {
      this.punch.ageMs+=dtMs;
      if(input.punchTarget)this.punch.target=input.punchTarget.slice();
      if(this.punch.ageMs>=260) this.punch=null;
    }
    if(input.punch&&this.cooldown===0) {
      this.punch={ageMs:dtMs,target:input.punchTarget?.slice()};this.cooldown=200;
      this.events.push({type:"punch",id:`punch:${this.clockMs}`,at:this.clockMs,x:this.x,y:this.y,facing:this.facing});
    }
    this.jumpHeld=!!input.jump;
    const state=!this.ground ? (this.vy<0?"jump":this.slowFall&&input.jump?"glide":"fall") : Math.abs(this.vx)>1?"walk":"idle";
    this.moveMs=state===this.locomotion?this.moveMs+dtMs:0;
    this.locomotion=state;
    return this.snapshot();
  }
  // A world adapter can replace spatial collision without duplicating input,
  // ability, punch, event or animation-clock handling.
  advancePosition(dt) {
    this.x+=this.vx*dt;this.y+=this.vy*dt;
    if(!this.ground&&this.vy>=0&&this.y>=this.floorY) {
      this.y=this.floorY;this.vy=0;this.ground=true;this.airAvailable=this.doubleJump;
      this.events.push({type:"land",id:`land:${this.clockMs}`,at:this.clockMs,x:this.x,y:this.y,facing:this.facing});
    }
  }
  snapshot() {
    return structuredClone(Object.fromEntries(
      ["x","y","vx","vy","ground","facing","clockMs","moveMs","punch","events","locomotion","jumpHeld"]
        .map(k=>[k,this[k]])));
  }
}
export class FixedStepper {
  constructor(step,hz=60) {this.step=step;this.dt=1000/hz;this.remainder=0;}
  advance(elapsedMs) {
    if(elapsedMs<0||elapsedMs>250) throw Error("Pause or restore on long gaps");
    this.remainder+=elapsedMs;
    while(this.remainder+1e-9>=this.dt) {this.step(this.dt);this.remainder-=this.dt;}
    return Math.max(0,this.remainder/this.dt);
  }
}
