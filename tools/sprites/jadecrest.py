"""Bake the user-reviewed Jadecrest actions/VFX; source PNGs remain untouched.
Run python3 tools/sprites/jadecrest.py. Character poses, charge, main and hit strips stay separate.
"""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter,ImageOps
import numpy as np,subprocess,sys,tempfile,json,math,hashlib
R=Path(__file__).resolve().parents[2];SRC=R/'assets/bosses/Jadecrest';OUT=R/'public/sprites';REPORT=R/'docs/art/jadecrest';REPORT.mkdir(parents=True,exist_ok=True)
T=Path(tempfile.mkdtemp(prefix='jadecrest-bake-'))
for script in ['jadecrest_actions.py','jadecrest_fx_cut.py','jadecrest_fx_flow.py']:
 subprocess.run([sys.executable,str(Path(__file__).with_name(script)),str(SRC),str(T)],check=True)
def cells(path,n=56,cell=512,cols=8):
 im=Image.open(path).convert('RGBA');return [im.crop((i%cols*cell,i//cols*cell,(i%cols+1)*cell,(i//cols+1)*cell)) for i in range(n)]
raw=SRC/'source';idle=cells(raw/'jade_idle.png');attack=cells(raw/'jade_normalAttack.png');stomp=cells(raw/'jade_skill1.png');walk=cells(T/'jade_walk_stable_right.png',32);death=cells(raw/'jade_death.png');br=cells(T/'jade_break_candidate_right.png');pounce=cells(raw/'Jadecrest Guardian-pounce_leap.png',56,768);roar=cells(raw/'Jadecrest Guardian-mighty_roar.png')
W,H,COLS=320,280,50
rows=[];mapping=[]
def actor(f,root,scale,mirror=False,lift=0,dx=0):
 if mirror:f=ImageOps.mirror(f);root=(f.width-root[0],root[1])
 f=f.resize((round(f.width*scale),round(f.height*scale)),Image.Resampling.NEAREST)
 out=Image.new('RGBA',(W,H));out.alpha_composite(f,(round(W/2-root[0]*scale+dx),round(H-14-root[1]*scale-lift)));return out

def row(name,frames,indices,root,scale,mirror=False,lifts=None):
 out=[actor(frames[i],root,scale,mirror,lifts[j] if lifts else 0) for j,i in enumerate(indices)];rows.append(out);mapping.append({'clip':name,'row':len(rows),'sourceFrames1Based':[i+1 for i in indices]})
row('idle',idle,list(range(0,48,2)),(280,379),.7,True)
row('walk',walk,list(range(32)),(280,379),.60)
rows.append([actor(idle[0],(280,379),.7,True,0,dx) for dx in [0,-3,-5,-3,-1,0]]);mapping.append({'clip':'hurt','row':3,'note':'idle recoil, no extra source generation'})
row('death',death,list(range(0,56,2)),(280,379),.68)
row('attack',attack,[0,6,12,16,20,24,26,28,30,32,36,42,48,55],(280,379),.7,True)
# Skip the baked green claw streak F27–F32: anticipation followed by native ground-contact poses.
s1=[2,4,6,8,10,12,14,16,18,20,22,24,24,24,24,24,24,24,25,32]+list(np.linspace(33,55,16).astype(int))
row('stomp',stomp,s1,(280,379),.7,True)
s2=list(np.linspace(8,30,16).astype(int))+[32,34,35,36,38,39,40,40]+list(np.linspace(41,55,16).astype(int))
lifts=[0]*16+[4*72*(i/8)*(1-i/8) for i in range(8)]+[0]*16
row('pounce',pounce,s2,(432,569),.4,lifts=lifts)
s3=list(np.linspace(4,21,16).astype(int))+list(np.linspace(22,55,21).astype(int))+list(np.linspace(20,0,13).astype(int))
row('roar',roar,s3,(275,379),.7)
row('broken',br,list(np.linspace(0,55,30).astype(int)),(280,379),.68)
atlas=Image.new('RGBA',(COLS*W,len(rows)*H))
for y,frames in enumerate(rows):
 for x,f in enumerate(frames):atlas.paste(f,(x*W,y*H))
atlas.save(OUT/'enemy-jadecrest-guardian.png',optimize=True)
meta={}
def save(name,frames,size=None):
 if size:frames=[f.resize(size,Image.Resampling.LANCZOS) for f in frames]
 w,h=frames[0].size;a=Image.new('RGBA',(w*len(frames),h))
 for i,f in enumerate(frames):a.paste(f,(i*w,0))
 file='fx-jadecrest-'+name+'.png';a.save(OUT/file,optimize=True);meta[name]={'file':file,'frames':len(frames),'w':w,'h':h}
 return frames

def fx(name,face='right'):
 m=json.loads((T/'manifest.json').read_text())[name];w,h=m['outputCell'];a=Image.open(T/('jadecrest-'+name+'-'+face+'.png')).convert('RGBA');return [a.crop((i*w,0,(i+1)*w,h)) for i in range(m['frames'])]
def star(d,x,y,r,col=(185,255,210),alpha=220):
 d.polygon([(x-r,y),(x-r*.2,y-r*.2),(x,y-r*1.6),(x+r*.2,y-r*.2),(x+r,y),(x+r*.2,y+r*.2),(x,y+r*1.6),(x-r*.2,y+r*.2)],fill=(*col,round(max(0,min(255,alpha)))))
# Native upper aura flows; native rim and ground origin stay fixed. Reviewed 30-phase loop.
a=Image.open(T/'ground-aura-flow.png').convert('RGBA');flow=[a.crop((i*512,0,(i+1)*512,384)) for i in range(30)];formation=fx('ground-charge-in')
under=[];over=[]
for i in range(60):
 t=i*.03;p=min(1,t/.62);native=formation[min(7,int(p*8))] if p<1 else ImageOps.mirror(flow[int((t-.62)*30)%30]);base=native.copy()
 # Full under-body aura plus a separate foreground rim keeps the tiger readable inside the circle.
 light=Image.new('RGBA',base.size);d=ImageDraw.Draw(light)
 for j in range(4):
  head=t*4+j*math.tau/4;pts=[(256+205*math.cos(head-k*.025),260+52*math.sin(head-k*.025)) for k in range(28)]
  d.line(pts,fill=(133,255,204,round(210*p)),width=2);star(d,*pts[0],3,alpha=230*p)
 for j in range(18):
  theta=j*2.39996+t*.4;q=(t*.65+j*.618)%1;bx=256+192*math.cos(theta);by=260+48*math.sin(theta)
  pts=[(bx+math.sin(t*3+j+k/13*2)*5,by-q*58-k/13*19) for k in range(14)]
  alpha=135*p*math.sin(q*math.pi);d.line(pts,fill=(141,255,211,round(alpha)),width=2);star(d,*pts[-1],1.5,alpha=alpha)
 base.alpha_composite(light.filter(ImageFilter.GaussianBlur(2)));base.alpha_composite(light)
 front=base.copy();front.paste((0,0,0,0),(0,0,512,270));base.paste((0,0,0,0),(0,270,512,384));under.append(base);over.append(front)
save('charge-under',under,(360,270));save('charge-front',over,(360,270))
# S1 approved foreground order is paw burst followed by front-impact. Native right artwork is retained.
save('s1-front',fx('stomp-front-impact')[3:8],(384,308))
save('s1-paw',fx('stomp-paw-charge')[-1:],(180,180))
# S2: padded, edge-softened native impact, centred on the foot plane. A separate low rim draws over feet.
a=Image.open(T/'landing-grounded.png').convert('RGBA');land=[ImageOps.mirror(a.crop((i*800,0,(i+1)*800,600))) for i in range(8)];fore=[]
for f in land:
 g=f.copy();g.paste((0,0,0,0),(0,0,800,433));fore.append(g);f.paste((0,0,0,0),(0,433,800,600))
save('s2-land',land,(480,360));save('s2-rim',fore,(480,360))
save('s2-trail',fx('pounce-trail'),(280,170))
# A continuous code ellipse masks the lost hard source-cell edges without inventing replacement native shards.
rip=[]
for i in range(24):
 q=i/24;f=Image.new('RGBA',(400,180));d=ImageDraw.Draw(f);rx=95+q*90;ry=rx*.24
 d.ellipse((200-rx,90-ry,200+rx,90+ry),outline=(142,255,205,round(210*(1-q))),width=3);rip.append(f)
save('s2-ripple',rip)
# S3 V6 approved: native alpha gain +8% RGB, charge shifted toward the mouth at runtime.
def boost(f,gain):
 a=np.array(f).astype(float);a[:,:,3]=np.minimum(255,a[:,:,3]*gain);a[:,:,:3]=np.minimum(255,a[:,:,:3]*1.08);return Image.fromarray(a.astype('uint8'))
charges=[boost(f,1.55) for f in fx('roar-charge')];save('s3-charge',charges,(180,180));waves=[boost(f,1.65) for f in fx('roar-wave')];stream=[]
for i in range(36):
 t=i*.03;f=Image.new('RGBA',(600,300))
 for j in range(7):
  age=t-j*.12
  if not 0<=age<.88:continue
  w=round(70+age*175);a=waves[min(7,int(age/.88*8))].resize((w,w),Image.Resampling.LANCZOS);a.putalpha(a.getchannel('A').point(lambda v:round(v*(1-age/.88))))
  f.alpha_composite(a,(round(60+age*340-w/2),round(150-w/2)))
 stream.append(f)
save('s3-wave',stream)
save('hit',fx('hit-spark'),(110,110));save('break',fx('break-core'),(160,160));save('death',fx('death-dissolve'),(240,260))
(REPORT/'bake.json').write_text(json.dumps({'character':{'cell':[W,H],'cols':COLS,'root':[W/2,H-14],'rows':mapping},'fx':meta,'sourceHashes':json.loads((SRC/'manifest.json').read_text()),'reviewVersions':{'s1':'V4','allChargeRings':'V5','s2':'V5','s3':'V6'}},indent=2,default=int))
print('Baked Jadecrest',len(rows),'character rows,',len(meta),'FX strips')
