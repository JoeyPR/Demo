// Punch behaviour from the official punch_options string (src:"official") plus reconstructed class ids.
// Class ids (RP-###) are our own numbering; "low" confidence rows only group items by shared baked fields.
export function punchPoseFor(items,punchData){
  if(!punchData)return null;
  for(const it of items){
    const d=punchData[it.id];
    if(d?.src==="official")return {itemId:it.id,...d};
  }
  return null;
}
export function applyPunchPose(pose,data){
  if(!data)return pose;
  if(data.face!==undefined)pose.face=[data.face,0];
  if(data.arm1!==undefined)pose.backAngle=data.arm1;
  if(data.arm2!==undefined)pose.frontAngle=data.arm2;
  return pose;
}
