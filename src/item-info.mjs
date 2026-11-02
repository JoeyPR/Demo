// Resolve only source-backed metadata. A missing wiki record is not evidence
// that an item is tradable or transmutable.
export function resolveItemInfo(snapshot,item) {
  if (item?.tool) {
    const type = item.toolType === 'wrench' ? 'wrench' : 'fist';
    return {
      id: item.id,
      name: String(item.name ?? (type === 'wrench' ? 'Wrench' : 'Fist')),
      description: type === 'wrench'
        ? 'Use the Wrench to open customization settings for items that support Wrench controls.'
        : 'Use the Fist to punch objects and trigger punch interactions in the preview.',
      descriptionSource: 'Planner built-in tool',
      properties: [],
      verified: false,
      source: null
    };
  }
  const record=snapshot?.items?.[String(item?.id)];
  const verified=record?.wikiVerified===true;
  return {
    id:item?.id,name:String(item?.name??record?.wikiName??'Item'),
    description:String(record?.description??''),
    descriptionSource:record?.descriptionSource??null,
    properties:verified&&Array.isArray(record.properties)
      ?record.properties.filter(line=>typeof line==='string'&&line!=='This item can be dropped and traded.'):[],
    verified,
    source:verified&&/^https:\/\/growtopiawiki\.com\/w\//.test(record.source??'')?record.source:null
  };
}
