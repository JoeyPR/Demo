(function(root){
  if(root.GrowSkinColors)return;
  const wiki='https://growtopiawiki.com/w/Skin_Colors';
  const definitions=[
    ['default-1','Default 1','#785C50'],['default-2','Default 2','#967264'],
    ['default-3','Default 3','#B48A78'],['default-4','Default 4','#C39582'],
    ['default-5','Default 5','#E1AC96'],['default-6','Default 6','#FFC3AA'],
    ['default-7','Default 7','#FFCEB4'],['default-8','Default 8','#FFE5C8'],
    ['light-green','Light Green','#B1DDA3'],['aqua','Aqua','#41C2C5'],
    ['red','Red','#D74B2B'],['dark-green','Dark Green','#418A2A'],
    ['purple','Purple','#A951D5'],['white','Mannequin White','#F0F0F0'],
    ['blue','Blue','#3D7AD3'],['light-blue','Light Blue','#B1CBEF'],
    ['orange','Orange','#FF940B'],['translucent-red','Translucent Red','#E94756',184],
    ['subscriber-purple','Subscriber Purple','#7351AF',184],['subscriber-turquoise','Subscriber Turquoise','#2F99A6',184],
    ['buddy-legacy','Buddy Legacy','#E6C489'],
    ['black','Black','#000000'],['grey','Grey','#7F7F7F'],['pure-white','White','#FFFFFF'],
    ['mod','Mod','#9AA3A8']
  ];
  const SKINS=definitions.map(([id,name,hex,alpha=255],index)=>({id,name,hex,
    rgb:[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16),alpha],
    source:index<18?wiki:index<21?'https://github.com/JoeyPR/Planner/blob/main/js/core/app.js':'supplied skin selector reference',
    ...(id==='buddy-legacy'?{palette:[[204,159,78],[218,177,105],[230,196,137],[241,215,177]]}: {})}));
  function resolveStoredSkin(value){
    if(typeof value==='string'){const i=SKINS.findIndex(skin=>skin.id===value);if(i>=0)return i;}
    return [6,3,0,9,24][Number(value)]??6;
  }
  root.GrowSkinColors={SKINS,resolveStoredSkin};root.PLANNER_SKINS=SKINS;
})(globalThis);
