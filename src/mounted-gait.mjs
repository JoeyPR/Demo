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

// Rider head displacement measured from set-1.mp4's travel segment. The
// capture renders native pixels at approximately 2.75x; its head cycles through
// y=26..29 versus y=32 at rest. Keep the atlas/leg animation on its own clock.
export const RIDING_REFERENCE_PERIOD_MS=1000/3;
export const RIDING_REFERENCE_PIXELS_PER_UNIT=2.75;
export const RIDING_REFERENCE_BODY_Y=Object.freeze([26,27,27,28,29,29,28,27,27,26]
  .map(y=>(y-32)/RIDING_REFERENCE_PIXELS_PER_UNIT));
export function mountedGaitProfile(item) {
  if(item.raw?.mountedGait===false)return null;
  if(item.raw?.mountedGait)return item.raw.mountedGait;
  if(!item.vehicle||isFloatingItem(item))return null;
  const records=item.raw.gameIcon??[];
  const animal=ANIMAL_NAME.test(item.name??item.raw?.name??'')||ANIMAL_ALIASES.has(item.id);
  // All seated riders share the body animation; only split animal sprites
  // receive the small opposing component offsets from the captured horse.
  const halves=records.filter(p=>p.a&&!p.skin&&!p.seat&&p.a!=='player_sleeve.png');
  const split=animal&&halves.every(p=>p.sw<=32&&p.sh<=32)&&new Set(halves.map(p=>p.sy)).size>1;
  return {periodMs:RIDING_REFERENCE_PERIOD_MS,bodyKeys:RIDING_REFERENCE_BODY_Y,
    split,evidence:'set-1.mp4-measured-rider-components'};
}
export function sampleMountedGait(item,motion) {
  const profile=mountedGaitProfile(item),state=locomotionState(motion);
  if(!profile||state.airborne||!state.moving)return {active:false,bodyY:0,slide:0};
  const elapsed=item.motionPlayback?motion.clockMs-item.motionPlayback.startedMs:motion.moveMs??0;
  const t=Math.max(0,elapsed),phase=(t%profile.periodMs)/profile.periodMs;
  const keys=profile.bodyKeys??RIDING_REFERENCE_BODY_Y;
  const index=Math.floor(phase*keys.length+1e-8)%keys.length;
  const bodyY=keys[index];
  // The horse's native front/hind cells continue their own atlas sequence;
  // translating the whole horse by the rider bob made it slide vertically.
  const slide=profile.split?Math.sin(2*Math.PI*phase)/3:0;
  return {active:true,bodyY,slide,phase,profile};
}
export function applyMountedGait(item,motion) {
  const gait=sampleMountedGait(item,motion);item.gait=gait;
  if(!gait.active)return;
  const rows=[...new Set(item.referencePieces.filter(p=>p.attachment==='mount'&&!p.seat).map(p=>p.sy))].sort((a,b)=>a-b);
  for(const piece of item.pieces) {
    if(piece.attachment!=='mount')continue;
    if(piece.seat)piece.y+=gait.bodyY;
    else if(gait.profile.split) {
      const row=rows.indexOf(piece.sequence?piece.sequence.frames[0][1]*piece.sequence.stride[1]+piece.sequence.offset[1]:piece.sy);
      piece.y+=row%2===0?gait.slide:-gait.slide;
    }
  }
}
