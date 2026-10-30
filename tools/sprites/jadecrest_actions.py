from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter,ImageOps
import numpy as np,json,math,hashlib,zipfile,sys
D=Path(sys.argv[1]);O=Path(sys.argv[2]);O.mkdir(parents=True,exist_ok=True)

def cells(name,rows):
 im=Image.open(D/'source'/name).convert('RGBA');return [im.crop((i%8*512,i//8*512,i%8*512+512,i//8*512+512)) for i in range(8*rows)]
def sheet(frames,cols,rows,name):
 out=Image.new('RGBA',(cols*512,rows*512))
 for i,f in enumerate(frames):out.paste(f,(i%cols*512,i//cols*512))
 out.save(O/name,optimize=True)
 return out
walk=cells('jade_walk.png',4);ref=walk[0];refa=np.array(ref).astype(float)
# Register the fixed mane to the bronze shoulder plate, not to changing feet/tail or gem highlights.
ty,tx,th,tw=208,265,53,66;template=refa[ty:ty+th,tx:tx+tw,:3];template=template-template.mean((0,1))
mask=Image.new('L',(512,512));md=ImageDraw.Draw(mask)
md.polygon([(163,127),(346,124),(353,174),(336,196),(338,224),(314,249),(276,247),(250,242),(230,235),(184,233),(163,223)],fill=255)
mask=mask.filter(ImageFilter.GaussianBlur(1.2));ma=np.array(mask)/255
fixed=[];shifts=[];before=[];after=[]
inside=(ma>.999)&(refa[:,:,3]>220)&(refa[:,:,1]>refa[:,:,0]+8)&(np.indices(ma.shape)[0]<223)
for frame in walk:
 a=np.array(frame).astype(float);best=(float('inf'),0,0)
 for dy in range(-12,13):
  for dx in range(-12,13):
   part=a[ty+dy:ty+dy+th,tx+dx:tx+dx+tw,:3];part=part-part.mean((0,1));error=float(np.mean((part-template)**2))
   if error<best[0]:best=(error,dx,dy)
 score,dx,dy=best;shifts.append({'dx':dx,'dy':dy,'plateMSE':round(score,3)})
 # Replace, rather than merely composite, so old protruding gem silhouettes do not remain behind the new layer.
 warped=Image.new('RGBA',(512,512));warped.paste(ref,(dx,dy))
 wm=Image.new('L',(512,512));wm.paste(mask,(dx,dy));weight=np.array(wm)/255
 out=a*(1-weight[:,:,None])+np.array(warped)*weight[:,:,None];fixed.append(Image.fromarray(np.clip(out,0,255).astype('uint8')))
 yy,xx=np.where(inside);valid=(yy+dy>=0)&(yy+dy<512)&(xx+dx>=0)&(xx+dx<512);yy=yy[valid];xx=xx[valid]
 before.append(float(np.mean((a[yy+dy,xx+dx,:3]-refa[yy,xx,:3])**2)))
 after.append(float(np.mean((out[yy+dy,xx+dx,:3]-refa[yy,xx,:3])**2)))
 # Native legs/tail below and outside this local upper-back correction remain pixel-identical.
 assert np.array_equal(np.array(fixed[-1])[weight==0],np.array(frame)[weight==0])
sheet(fixed,8,4,'jade_walk_stable_right.png');sheet([ImageOps.mirror(f) for f in fixed],8,4,'jade_walk_stable_left.png')
# Reuse only the onset of the death collapse. Keep eyes open, avoid the final fully prone death hold.
death=cells('jade_death.png',7);enter=[0,8,16,24,28,30,32,34,35,37];recover=[37,35,34,32,30,28,24,16,8,0];break_frames=[];mapping=[]
for i in range(56):
 if i<10:idx=enter[i];f=death[idx];stage='stagger'
 elif i<46:
  idx=37;stage='hold';phase=(i-10)/35*math.tau;s=1+.008*math.sin(phase)
  f=death[idx].transform((512,512),Image.Transform.AFFINE,(1,0,0,0,1/s,379*(1-1/s)),resample=Image.Resampling.BICUBIC)
 else:idx=recover[i-46];f=death[idx];stage='recover'
 break_frames.append(f);mapping.append({'frame':i+1,'sourceDeathFrame':idx+1,'stage':stage})
sheet(break_frames,8,7,'jade_break_candidate_right.png');sheet([ImageOps.mirror(f) for f in break_frames],8,7,'jade_break_candidate_left.png')
