from pathlib import Path
from PIL import Image,ImageOps
import numpy as np,json,hashlib,sys
D=Path(sys.argv[1]);O=Path(sys.argv[2]);O.mkdir(parents=True,exist_ok=True)
report={};allfx={}
def clean(im):
 a=np.array(im.convert('RGBA'));a[:,:,3]=np.where(a[:,:,3]<=5,0,a[:,:,3]);a[a[:,:,3]==0,:3]=0;return Image.fromarray(a)
def transform(im,size,anchor,target,scale):
 sx,sy=scale if isinstance(scale,tuple) else (scale,scale)
 return im.transform(size,Image.Transform.AFFINE,(1/sx,0,anchor[0]-target[0]/sx,0,1/sy,anchor[1]-target[1]/sy),Image.Resampling.BICUBIC)
for p in sorted((D/'source').glob('jadecrest-*.png')):
 name=p.stem.removeprefix('jadecrest-');im=clean(Image.open(p));w,h=im.size
 frames=[im] if name=='ground-charge-held' else [im.crop((round(i%4*w/4),round(i//4*h/2),round((i%4+1)*w/4),round((i//4+1)*h/2))) for i in range(8)]
 if name=='stomp-front-impact':
  edges=[[0,330,710,1100,1536],[0,425,790,1155,1536]]
  frames=[im.crop((edges[i//4][i%4],(i//4)*512,edges[i//4][i%4+1],(i//4+1)*512)) for i in range(8)]
 out=[]
 for i,c in enumerate(frames):
  cw,ch=c.size
  if name=='ground-charge-held':
   c=transform(c,(512,384),(887,521),(256,260),(400/1560,100/342))
  elif name=='ground-charge-in':
   centres=[(231,280),(224,280),(226,284),(223,286),(226,285),(225,284),(223,284),(222,284)]
   c=transform(c,(512,384),centres[i],(256,260),400/410)
  elif name=='stomp-front-impact':
   xs=[113,122,107,90,95,63,60,75]
   c=transform(c,(640,512),(xs[i],475 if i<4 else 367),(110,410),1.1)
  elif name=='pounce-landing-impact':
   c=transform(c,(640,512),(248,380 if i<4 else 330),(320,410),1)
  else:c=c.resize((512,512),Image.Resampling.LANCZOS)
  out.append(c)
 allfx[name]=out
 sz=out[0].size;sheet=Image.new('RGBA',(sz[0]*len(out),sz[1]));left=Image.new('RGBA',sheet.size)
 for i,f in enumerate(out):sheet.paste(f,(i*sz[0],0));left.paste(ImageOps.mirror(f),(i*sz[0],0))
 sheet.save(O/(p.stem+'-right.png'));left.save(O/(p.stem+'-left.png'))
 report[name]={'source':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'sourceSize':[w,h],'grid':[1,1] if len(out)==1 else [4,2],'frames':len(out),'outputCell':sz,'previewOnly':True}
(O/'manifest.json').write_text(json.dumps(report,indent=2))
print('Prepared',len(report),'effects')
