"""Snapshot public wiki-rendered infoboxes in bounded batches; never use GTW admin APIs."""
import argparse, concurrent.futures, hashlib, json, re, subprocess, tempfile, urllib.parse
from pathlib import Path
from lxml import html

root=Path(__file__).resolve().parents[1]
catalog=json.loads((root/'demo/catalog.json').read_text())['items']
native=json.loads((root/'demo/native-metadata.json').read_text())['items']
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--cache',type=Path,default=Path(tempfile.gettempdir())/'setplanner-item-info-wiki')
cache=parser.parse_args().cache;cache.mkdir(parents=True,exist_ok=True)
items={str(row['id']):{'description':native.get(str(row['id']),{}).get('sourceFields',{}).get('str_version_22',''),
    'descriptionSource':'supplied native metadata','wikiVerified':False,'properties':[]} for row in catalog}
allowed={row['id'] for row in catalog}

def fetch(batch):
    text=''.join('{{Item|name='+row['name']+'}}' for row in batch if not re.search(r'[{}|\n]',row['name']))
    key=hashlib.sha256(text.encode()).hexdigest();path=cache/(key+'.json')
    if path.exists():data=json.loads(path.read_text())
    else:
        url='https://growtopiawiki.com/api.php?'+urllib.parse.urlencode({'action':'parse','text':text,'title':'Item information','contentmodel':'wikitext','prop':'text','format':'json'})
        result=subprocess.run(['curl','-fsSL','--max-time','90','--retry','1',url],capture_output=True,text=True)
        if result.returncode:return [],'http-error'
        try:data=json.loads(result.stdout)
        except ValueError:return [],'invalid-json'
        if 'parse' not in data:return [],str(data.get('error'))
        path.write_text(json.dumps(data))
    document=html.fromstring(data['parse']['text']['*']);found=[]
    for box in document.xpath('//div[contains(concat(" ",normalize-space(@class)," ")," gtw-item-infobox ")]'):
        image=box.xpath('.//div[contains(@class,"gtw-item-infobox-header")]//img/@src')
        match=re.search(r'/sprites/(\d+)\.png',image[0] if image else '')
        if not match or int(match[1]) not in allowed:continue
        item_id=match[1]
        title=box.xpath('.//div[contains(concat(" ",normalize-space(@class)," ")," item-title ")]')
        name=''.join(title[0].itertext()).split('(Rarity:')[0].strip() if title else ''
        description=box.xpath('.//div[contains(@class,"gtw-item-infobox-desc")]')
        value=box.xpath('./div[@class="section-header" and normalize-space(.)="Properties"]/following-sibling::div[1]')
        lines=[]
        if value:
            for br in value[0].xpath('.//br'):br.tail='\n'+(br.tail or '')
            lines=[' '.join(line.split()) for line in value[0].text_content().split('\n') if line.strip()]
        # These predicates reflect the complete public infobox flag rendering.
        # Do not treat a missing/failed infobox as a negative property record.
        transmute=any('This item can be transmuted.'==line for line in lines)
        deny=any('This item cannot be dropped or traded.'==line for line in lines)
        properties=['This item CAN be transmuted.' if transmute else 'This item CANNOT be transmuted.',
                    'This item cannot be dropped or traded.' if deny else 'This item can be dropped and traded.']
        if 'This item never drops any seeds.' in lines:properties.append('This item never drops any seeds.')
        found.append((item_id,{'wikiVerified':True,'wikiName':name,'description':description[0].text_content().strip() if description else '',
            'descriptionSource':'Growtopia Wiki rendered item infobox','properties':properties,'wikiPropertyLines':lines,
            'source':'https://growtopiawiki.com/w/'+urllib.parse.quote(name.replace(' ','_'),safe='')}))
    return found,None

batches=[catalog[i:i+35] for i in range(0,len(catalog),35)]
errors=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    for index,(found,error) in enumerate(pool.map(fetch,batches)):
        for item_id,entry in found:
            if not entry['description']:entry['description']=items[item_id]['description']
            items[item_id].update(entry)
        if error:errors.append({'batch':index,'error':error})
        if index%10==0:print('batches',index+1,'verified',sum(item['wikiVerified'] for item in items.values()),flush=True)
result={'schema':1,'source':'https://growtopiawiki.com/w/Module:Item/Properties',
    'semantics':'Complete rendered infobox: Transmutable and Untradable flags govern transmutation and drop/trade restrictions; NoSeed is displayed only when explicitly rendered.',
    'items':items,'coverage':{'total':len(items),'wikiVerified':sum(item['wikiVerified'] for item in items.values()),'errors':errors}}
(root/'data/item-info.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
print(json.dumps(result['coverage'],indent=2),flush=True)
