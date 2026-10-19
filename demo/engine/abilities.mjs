// The registry contains exact-name/ID matches to fetched wiki mod tables.
// Unknown items do not acquire abilities from a name, FX flag, or sprite size.
export function resolveAbilities(items,registry={items:{}}) {
  const result={doubleJump:false,highJump:false,slowFall:false,speedy:false,sources:[]};
  for(const item of items) {
    const entry=registry.items?.[item.id];
    if(!entry)continue;
    for(const key of ["doubleJump","highJump","slowFall","speedy"])
      if(entry[key])result[key]=true;
    result.sources.push({id:item.id,name:item.name,sources:entry.sources});
  }
  return result;
}
