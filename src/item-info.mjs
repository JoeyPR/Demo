// Resolve only source-backed metadata. A missing wiki record is not evidence
// that an item is tradable or transmutable.
export function resolveItemInfo(snapshot,item) {
  const record=snapshot?.items?.[String(item?.id)];
  const verified=record?.wikiVerified===true;
  return {
    id:item?.id,name:String(item?.name??record?.wikiName??'Item'),
    description:String(record?.description??''),
    descriptionSource:record?.descriptionSource??null,
    properties:verified&&Array.isArray(record.properties)?record.properties.filter(line=>typeof line==='string'):[],
    verified,
    source:verified&&/^https:\/\/growtopiawiki\.com\/w\//.test(record.source??'')?record.source:null
  };
}
