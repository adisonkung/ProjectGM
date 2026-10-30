from pathlib import Path
import sys
from PIL import Image,ImageOps
import numpy as np
from scipy.ndimage import map_coordinates,gaussian_filter
D=Path(sys.argv[2]);P=D;SOURCE=Path(sys.argv[1])/'source'
a=Image.open(P/'jadecrest-ground-charge-in-left.png').convert('RGBA').crop((7*512,0,8*512,384));v=np.array(a).astype(float);h,w=v.shape[:2];yy,xx=np.mgrid[:h,:w]
# Warp only the green upper aura. Gold rim and ground registration remain fixed.
mask=np.clip((247-yy)/32,0,1)*np.clip((v[:,:,1]-v[:,:,0]-6)/28,0,1)
mask=gaussian_filter(mask,1.2);prem=v.copy();prem[:,:,:3]*=v[:,:,3:4]/255
frames=[]
for i in range(30):
 p=i/30*np.pi*2
 sx=xx+4.2*np.sin(yy*.055+p)*mask;sy=yy+3*np.sin(xx*.04-p*2)*mask
 q=np.stack([map_coordinates(prem[:,:,k],[sy,sx],order=1,mode='constant') for k in range(4)],axis=-1)
 q[:,:,:3]=np.divide(q[:,:,:3]*255,q[:,:,3:4],out=np.zeros_like(q[:,:,:3]),where=q[:,:,3:4]>.5)
 m=mask[:,:,None];r=v*(1-m)+q*m;r[:,:,3]*=1-mask*(.045+.045*np.sin(p+xx*.018))
 frames.append(Image.fromarray(np.uint8(np.clip(r,0,255))))
out=Image.new('RGBA',(512*30,384))
for i,f in enumerate(frames):out.paste(f,(i*512,0))
out.save(D/'ground-aura-flow.png')
# Rebuild landing sheet with soft source-cell boundaries, roomy padding and foot-plane pivot.
a=Image.open(SOURCE/'jadecrest-pounce-landing-impact.png').convert('RGBA');w,h=a.size;sheet=Image.new('RGBA',(8*800,600))
for i in range(8):
 c=a.crop((round(i%4*w/4),round(i//4*h/2),round((i%4+1)*w/4),round((i//4+1)*h/2)))
 v=np.array(c);ch,cw=v.shape[:2];y,x=np.mgrid[:ch,:cw]
 edge=np.minimum.reduce([x/16,(cw-1-x)/16,y/14,(ch-1-y)/14]);edge=np.clip(edge,0,1);edge=edge*edge*(3-2*edge)
 v[:,:,3]=np.uint8(v[:,:,3]*edge);v[v[:,:,3]<=5]=0;c=Image.fromarray(v)
 # Source ground centre: first row near y340; second row near y300.
 anchor=(248,340 if i<4 else 300);c=c.transform((800,600),Image.Transform.AFFINE,(1,0,anchor[0]-400,0,1,anchor[1]-430),Image.Resampling.BICUBIC)
 c=ImageOps.mirror(c);sheet.paste(c,(i*800,0))
sheet.save(D/'landing-grounded.png')
print('Prepared 30 aura phases + 8 padded landing frames')
