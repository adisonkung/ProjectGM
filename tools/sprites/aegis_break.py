"""Shield-centred, status-owned Break presentation. Called by aegis.py; originals preserved."""
import json,math
import numpy as np
from PIL import Image,ImageDraw,ImageFilter

def bake_break(src,out,report,strip,star):
 im=Image.open(src/'14-fx-aegis-break-core.png');panels=[];core_centres=[]
 for i in range(10):
  f=im.crop((round(i%5*im.width/5),round(i//5*im.height/2),round((i%5+1)*im.width/5),round((i//5+1)*im.height/2)))
  # Supplied RGB checker is flattened. Preserve light colours with a soft saturation matte.
  a=np.array(f.convert('RGB')).astype(float);sat=a.max(2)-a.min(2);alpha=np.clip((sat-7)/55,0,1)
  panels.append(Image.fromarray(np.dstack((a,alpha*255)).astype('uint8')))
  r,g,b=a.transpose(2,0,1);yy,xx=np.indices(r.shape);weight=np.minimum(g-r,b-r)
  weight[(xx<190)|(xx>245)|(yy<110)|(yy>260)|(weight<30)]=0
  core_centres.append((float((xx*weight).sum()/weight.sum()),float((yy*weight).sum()/weight.sum())))
 body=Image.open(src/'kneel-break.png').convert('RGBA');indices=[0,4,7,10,13,16,19,22,25,28,31,34,37,40,43,46,49,52,54,55];centres=[]
 for i in indices:
  a=np.array(body.crop((i%8*512,i//8*512,i%8*512+512,i//8*512+512))).astype(float)
  r,g,b,al=a.transpose(2,0,1);yy,xx=np.indices(r.shape);w=np.minimum(g-r,b-r)*al/255
  w[(xx<235)|(yy<270)|(yy>390)|(w<30)]=0
  x=float((xx*w).sum()/w.sum());y=float((yy*w).sum()/w.sum())-7*np.clip((x-265)/69,0,1)
  centres.append((x,y))
 frames=[]
 # Fixed body-relative anchor [0,-44]; the local core follows the shield through the actual 20 poses.
 for i in range(75):
  t=i*.04;phase=math.tau*t;pose=min(19,int(t/.15));x,y=centres[pose]
  dx=(264-x)*180/252*1.25;dy=46+(-14+(y-414)*180/252)*1.25
  cx=160+dx*320/240;cy=130+(dy+44)*320/240
  a=Image.new('RGBA',(320,260));native=int((t%1)*10)%10;source=panels[native];ox,oy=core_centres[native]
  f=source.resize((140,117),Image.Resampling.LANCZOS)
  a.alpha_composite(f,(round(cx-ox*140/source.width),round(cy-oy*117/source.height)))
  light=Image.new('RGBA',a.size);d=ImageDraw.Draw(light)
  for arm in range(3):
   head=phase+arm*math.tau/3
   color=(255,222,135) if arm==0 else (100,238,255)
   for k in range(22):
    u=head-k*.035;v=u-.035
    d.line((cx+49*math.cos(u),cy+41*math.sin(u),cx+49*math.cos(v),cy+41*math.sin(v)),fill=(*color,round(235*(1-k/22)**1.4)),width=2)
   star(d,cx+49*math.cos(head),cy+41*math.sin(head),3.4,color,245)
  for j in range(16):
   theta=j*2.399963+phase*.7;r=27+(j%4)*8
   star(d,cx+r*math.cos(theta),cy+r*.8*math.sin(theta),1.3+j%3,(140,243,255),100+int(145*math.sin(phase+j)**2))
  if t<.24:
   r=8+t*140;d.ellipse((cx-r,cy-r,cx+r,cy+r),outline=(164,247,255,round(210*(1-t/.24))),width=2)
  star(d,cx,cy,4+1.5*math.sin(phase*2),(228,255,255),235)
  a.alpha_composite(light.filter(ImageFilter.GaussianBlur(2)));a.alpha_composite(light)
  frames.append(a)
 strip('core',frames,(320,260))
 (report/'break-presentation.json').write_text(json.dumps({'source':'14-fx-aegis-break-core.png','sourceGrid':[5,2],'frames':75,'frameMs':40,'anchor':[0,-44],'fitCells':2.4,'nativeCoreCentres':core_centres,'shieldSourceCentres':centres,'bodyFrames1Based':[n+1 for n in indices],'durationMs':3000},indent=2))
