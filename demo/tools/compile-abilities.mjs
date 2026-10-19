import fs from "node:fs";
const catalog=JSON.parse(fs.readFileSync(new URL("../catalog.json",import.meta.url)));
const pages=JSON.parse(fs.readFileSync(new URL("../../research/ability-wiki-pages.json",import.meta.url)));
const normalize=name=>name.normalize("NFKC").toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g," ").trim();
const byName=new Map(catalog.items.map(i=>[normalize(i.name),i]));
const keys={Double_Jump:"doubleJump",High_Jump:"highJump",Slow_Fall:"slowFall",Speedy:"speedy"};
const registry={schema:1,provenance:"Growtopia Wiki mod tables; exact normalized item-name matching. No name-based ability inference.",
  physics:"Preview coefficients; official native physics parity is not established.",
  items:{},unmatched:[],conditional:[],pages:pages.map(({mod,slot,url,error})=>({mod,slot,url,error}))};
for(const page of pages) {
  if(page.error)continue;
  for(const line of page.content.split("\n")) {
    if(!line.startsWith("|"))continue;
    const cells=line.split("|").slice(1,-1).map(s=>s.trim());
    const [name,label,notes]=cells;
    if(!name||name==="Item"||name.startsWith("**")||name.startsWith("--"))continue;
    const item=byName.get(normalize(name));
    if(!item){registry.unmatched.push({name,mod:page.mod,source:page.url});continue;}
    // Sprite's Robe randomly switches one of three jump mods. It must not
    // silently receive high + double jump simultaneously from two table rows.
    if(/one of its three|different mods when/i.test(notes??"")){
      registry.conditional.push({id:item.id,name,mod:page.mod,label,notes,source:page.url});continue;
    }
    const entry=registry.items[item.id]??={id:item.id,name:item.name,sources:[],notes:[]};
    entry[keys[page.mod]]=true;
    entry.sources.push(page.url);entry.notes.push({mod:page.mod,label,notes});
  }
}
registry.summary={matchedItems:Object.keys(registry.items).length,
  ...Object.fromEntries(Object.values(keys).map(k=>[k,Object.values(registry.items).filter(i=>i[k]).length])),
  unmatchedRows:registry.unmatched.length,conditionalRows:registry.conditional.length};
fs.writeFileSync(new URL("../ability-registry.json",import.meta.url),JSON.stringify(registry,null,2)+"\n");
console.log(registry.summary);
