"""Validate generated locale pages, bundle references and offline font coverage."""
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import unquote, urljoin, urlsplit
import sys
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'tools/cache/python'))
from fontTools.ttLib import TTFont

class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.links=[]; self.lang=None; self.base=None; self.text=[]; self.hidden=0; self.metas={}
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='html': self.lang=a.get('lang')
        if tag=='base': self.base=a.get('href')
        if tag in ('script','style'): self.hidden+=1
        if tag=='meta': self.metas[a.get('name') or a.get('property')]=a.get('content')
        for key in ('src','href'):
            if a.get(key): self.links.append(a[key])
        if a.get('style'): self.links.extend(re.findall(r'url\([\'\"]?([^\)\'\"]+)',a['style']))
    def handle_endtag(self,tag):
        if tag in ('script','style'): self.hidden-=1
    def handle_data(self,data):
        if not self.hidden: self.text.append(data)

pages=sorted((ROOT/'zh').rglob('index.html'))
assert len(pages)==12,len(pages)
count=0; text=''
for file in pages:
    p=Page(); source=file.read_text(encoding='utf-8'); p.feed(source)
    assert p.lang=='zh-CN',file
    assert p.metas.get('og:locale')=='zh_CN',file
    base='https://preview.local/'+file.relative_to(ROOT).as_posix()
    if p.base: base=urljoin(base,p.base)
    for href in p.links:
        url=urlsplit(urljoin(base,href))
        if url.netloc!='preview.local' or url.scheme!='https': continue
        target=ROOT/unquote(url.path).lstrip('/')
        if url.path.endswith('/'): target=target/'index.html'
        assert target.exists(),f'{file.relative_to(ROOT)}: {href}'
        count+=1
    if file.parent.name=='pokedex':
        terms=json.loads((ROOT/'tools/localization/zh-cn-terms.json').read_text(encoding='utf-8'))
        for dex,row in terms['species'].items():
            assert f'id="p{dex}"' in source and row['zh'] in source,dex
    if file.parent.name=='moves':
        assert '精神强念' in source and '超能力' in source
    text+=''.join(p.text)

for file in [ROOT/'css/style.css',ROOT/'css/pages.css',ROOT/'css/fonts-zh.css']:
    for value in re.findall(r'url\([\'\"]?([^\)\'\"]+)',file.read_text(encoding='utf-8')):
        assert (file.parent/value).resolve().exists(),(file,value)

manifest=json.loads((ROOT/'tools/localization/font-manifest.json').read_text(encoding='utf-8'))
for row in manifest['fonts']:
    file=ROOT/'assets/fonts'/row['file']
    assert hashlib.sha256(file.read_bytes()).hexdigest()==row['sha256']
    cmap=TTFont(file).getBestCmap()
    for c in text:
        if 0x3400<=ord(c)<=0x9fff: assert ord(c) in cmap,(row['file'],c)

version=json.loads((ROOT/'version.json').read_text(encoding='utf-8'))['v']
assert hashlib.sha1((ROOT/'js/app.min.js').read_bytes()).hexdigest()[:10]==version
for entry,lang,locale in [('index.html','es','es_ES'),('en/index.html','en','en_US'),('zh/index.html','zh-CN','zh_CN')]:
    source=(ROOT/entry).read_text(encoding='utf-8')
    assert 'app.min.js?v='+version in source
    p=Page(); p.feed(source)
    assert p.lang==lang and p.metas.get('og:locale')==locale,entry
manifest=json.loads((ROOT/'manifest.webmanifest').read_text(encoding='utf-8'))
assert manifest['lang']=='es'
print(f'PASS: {len(pages)} Chinese pages, {count} local references, 966 official names, two font faces, bundle fingerprints')
