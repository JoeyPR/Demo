import {locomotionState,isFloatingItem} from "./motion-policy.mjs";
const ANIMAL_WORDS=[
  "horse","horsie","appaloosa","steed","stallion","pony","donkey","mule","raptor",
  "wolf","snakewolf","dog","corgi","pug","tiger","bull","bilby","elephant","mammoth",
  "unicorn","pegasus","chicken","pollo","turkey","turtle","axolotl","burrito",
  "silkworm","worm","dinosaur","kangaroo","rabbit","bunny","reindeer","deer","moose",
  "camel","llama","alpaca","lion","panther","zebra","boar","pig","panda","bear",
  "rhino","hippo","ostrich","giraffe","dragon","snail","crab","otter","gopher",
  "goat","sheep","cow","frog","toad","crocodile","alligator","snake","beetle",
  "spider","fish","cuttlefish","stonefish","shark","megalodon","dolphin","seahorse",
  "manta","ray","gorilla","bumblebee","bee","phoenix","raven","roach","flamingo",
  "firefly","eagle","owl","sloth","wombat","hedgehog","raccoon"
];
const ANIMAL_NAME=new RegExp(`\\b(${ANIMAL_WORDS.join("|")})\\b`,"i");
// Hooves / steed / horse aliases confirmed by the linked descriptions.
const ANIMAL_ALIASES=new Set([
  1176, // https://growtopiawiki.com/w/Aimster%27s_Nightmare
  2868, // https://growtopiawiki.com/w/White_Fury
  14260 // https://growtopiawiki.com/w/Enbarr,_The_Flowing_Mane
]);

// User-observed split horse-sit behavior. Amplitudes/rate are reference tuning,
// not an assertion that native enum bits or native timing were recovered.
export function mountedGaitProfile(item) {
  if(item.raw?.mountedGait===false)return null;
  if(item.raw?.mountedGait)return item.raw.mountedGait;
  if(!item.vehicle||isFloatingItem(item))return null;
  // Positive animal-name classification: a horse-shaped seat is NOT proof
  // that the vehicle is an animal (brooms, cars, comets share the same seats).
  if(!ANIMAL_NAME.test(item.name??item.raw?.name??"")&&!ANIMAL_ALIASES.has(item.id))return null;
  const records=item.raw.gameIcon??[];
  const horseSeat=records.some(p=>p.a==="player_sit.png"&&p.sy===32&&[64,96].includes(p.sx)||
    p.a==="player_horsepants.png"&&p.seat);
  const halves=records.filter(p=>p.a&&!p.skin&&!p.seat&&p.a!=="player_sleeve.png");
  // Full 64-pixel sprites never receive the opposing-half transformation.
  if(!horseSeat||halves.some(p=>p.sw>32||p.sh>32)||new Set(halves.map(p=>p.sy)).size<2)return null;
  // Rider bob tuning: the moving-hop cycle runs slower than the original
  // reference tuning so mounted movement sways gently (see lift.mjs).
  return {periodMs:950,hop:1.5,slide:1.25,evidence:"user-observed-split-animal-reference"};
}
export function sampleMountedGait(item,motion) {
  const profile=mountedGaitProfile(item),state=locomotionState(motion);
  if(!profile||state.airborne||!state.moving)return {active:false,bodyY:0,slide:0};
  const t=item.motionPlayback?motion.clockMs-item.motionPlayback.startedMs:motion.moveMs??0;
  const phase=2*Math.PI*Math.max(0,t)/profile.periodMs;
  return {active:true,bodyY:-profile.hop*Math.abs(Math.sin(phase)),
    slide:profile.slide*Math.sin(phase),phase,profile};
}
export function applyMountedGait(item,motion) {
  const gait=sampleMountedGait(item,motion);item.gait=gait;
  if(!gait.active)return;
  const rows=[...new Set(item.referencePieces.filter(p=>p.attachment==="mount"&&!p.seat).map(p=>p.sy))].sort((a,b)=>a-b);
  for(const piece of item.pieces) {
    if(piece.attachment!=="mount")continue;
    if(piece.seat)piece.y+=gait.bodyY;
    else {
      const row=rows.indexOf(piece.sequence?piece.sequence.frames[0][1]*piece.sequence.stride[1]+piece.sequence.offset[1]:piece.sy);
      piece.y+=gait.bodyY+(row%2===0?gait.slide:-gait.slide);
    }
  }
}
