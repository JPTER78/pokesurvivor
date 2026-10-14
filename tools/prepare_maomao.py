"""Build preview sheets from the approved cropped poses (directory argument).
Usage: python tools/prepare_maomao.py ../maomao-preview
No AI-generated frames: missing orientations use nearest existing view.
"""
from PIL import Image
from pathlib import Path
import sys, json
root=Path(__file__).resolve().parent.parent
src=Path(sys.argv[1]); out=root/'assets/pokemon/10001'
out.mkdir(parents=True,exist_ok=True)
W,H=40,44

def poses(name):
 im=Image.open(src/(name+'.png')).convert('RGBA')
 return [im.crop((x,0,x+160,176)).resize((W,H),Image.Resampling.NEAREST) for x in range(0,im.width,160)]

def flip(seq): return [im.transpose(Image.Transpose.FLIP_LEFT_RIGHT) for im in seq]
idle=poses('Idle'); right=poses('WalkRight'); back=poses('WalkBack'); left=poses('WalkLeft')
# Row order: down, down-right, right, up-right, up, up-left, left, down-left.
walk=[idle,right,right,back,back,back,left,left]
rows={'Idle':[[s[0]] for s in walk],'Walk':walk}
for name in ['Attack','Shoot','Charge','Faint']:
 seq=poses(name)
 rows[name]=[seq,seq,seq,seq,seq,flip(seq),flip(seq),flip(seq)]
# Hurt is not played by Player.hurt(), but preload expects the sheet.
rows['Hurt']=[[idle[0]] for _ in range(8)]
meta={'s':1,'a':{}}
for name,dirs in rows.items():
 n=len(dirs[0]); sheet=Image.new('RGBA',(W*n,H*8))
 for y,seq in enumerate(dirs):
  for x,im in enumerate(seq):sheet.alpha_composite(im,(x*W,y*H))
 sheet.save(out/(name+'.png'))
 durations=([12]*(n-1)+[30]) if name=='Faint' else [9]*n
 if name=='Idle':durations=[40]
 meta['a'][name]={'w':W,'h':H,'n':n,'r':8,'d':durations,'ax':20,'ay':39}
(out/'metadata.json').write_text(json.dumps(meta,indent=2))
print(json.dumps(meta))
