// A hand slot can contain two held props, independent pets, and loose effects.
// Select a limb from the authored grip/draw band; never use one front arm for
// every piece just because the clothing slot is Hand.
export function handAttachment(record,item) {
  if(record.attachment)return record.attachment;
  if(record.world||record.xmlParticle)return 'world';
  if(record.pet)return 'pet';
  if(item.slot!==5)return 'body';
  if(record.ride||record.seat)return 'body';
  const raw=item.raw??item;
  if(raw.unturned?.includes(record.a+':'+Math.floor((record.sy??0)/32)))return 'body';
  if(record.effect||record.fxEngine||record.referenceFx)return 'body';
  // Captured particle/aura sprites are not the weapon itself. A primary item
  // atlas is allowed to use such a name when its actual art is held in a hand.
  if(/^(?:particles?|effects?|reference-fx|pixel\.)/i.test(record.a??'')&&record.a!==raw.atlas)return 'body';
  if(record.armSide==='back'||record.handSide==='back'||record.u===1||
      record.pass==='RenderBackHandItem'||record.pass==='RenderBackArm')return 'backHand';
  if(record.armSide==='front'||record.handSide==='front'||record.u===11||
      record.pass==='RenderFrontArm')return 'frontHand';
  // The captured back grip is x24 and the front grip x9. Small offsets occur
  // on larger glove overlays, which still belong to the nearby arm.
  if(Number.isFinite(record.x)&&Math.abs(record.x-24)<=2.5)return 'backHand';
  return 'frontHand';
}

export function handReferenceAngle(record,item,attachment) {
  if(record.referenceAngle!==undefined)return record.referenceAngle;
  const key=attachment==='backHand'?'arm1':'arm2';
  return item.raw?.pose?.[key]??item.pose?.[attachment==='backHand'?'backAngle':'frontAngle']??0;
}
