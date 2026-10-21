"""Extract supplied V5 art. No painted/generated pixels; five whole Dash rows use runtime reveal.
Usage: python tools/sprites/vaelric_ult_v5.py SOURCE_DIR [SPRITE_DIR] [AUDIT_JSON]
"""
import hashlib,json,sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

src=Path(sys.argv[1]);out=Path(sys.argv[2] if len(sys.argv)>2 else 'public/sprites')
audit=Path(sys.argv[3] if len(sys.argv)>3 else 'docs/timelines/vaelric/vaelric-ult-v5-assets.json')
out.mkdir(parents=True,exist_ok=True)
report={'sources':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in src.glob('*.png')},'parts':{}}
assert report['sources']=={'Vanish VFX.png':'3ccfe2c9304993d66958bf5e4aa64d81121656ee12035486f13e6ab3f18c3adb','Dash VFX.png':'b6ce089fb611b5b57d8af7ac5930138c010ebdafe6b76254f0650d95bad0308d','slash impact VFX.png':'59fa2c8c8c8c3c1275391864c608189dee29c529896afdb3d7204f73368a9085'}, 'Source changed; review cuts first'
# Magenta is a keyed background, not alpha. Keep original red/black artwork and remove the key only.
a=np.array(Image.open(src/'Vanish VFX.png').convert('RGBA'))
r,g,b=(a[:,:,i].astype(np.int16) for i in range(3))
key=(r>180)&(b>180)&(g<90)&(abs(r-b)<70)
# Remove only magenta-contaminated boundary pixels; retain interior crimson/white blade cores.
spill=(ndi.distance_transform_edt(~key)<2.5)&(r-g>50)&(b-g>50)&(r>120)
a[key|spill]=0
# First five original cells are the specified retreat; main charge keeps its approved original strip.
van=[]
for i in range(5):
 p=Image.fromarray(a[:362,i*362:(i+1)*362]);van.append(p)
strip=Image.new('RGBA',(204*5,220))
for i,p in enumerate(van): strip.alpha_composite(p.resize((196,196),Image.Resampling.NEAREST),(i*204+4,12))
strip.save(out/'fx-vaelric-ult-retreat.png',optimize=True)
report['parts']['retreat']={'frames':5,'w':204,'h':220,'pivot':[.5,208/220],'keyedPixels':int(key.sum()),'spillPixels':int((spill&~key).sum())}
# Six isolated accumulated states. Common density/anchor; connected components own detached sparks.
a=np.array(Image.open(src/'slash impact VFX.png').convert('RGBA'))
anchors=(np.arange(6)+.5)*362
strong=a[:,:,3]>8
labels,_=ndi.label(strong);owned=np.zeros(strong.shape,np.int16)
for j,b in enumerate(ndi.find_objects(labels),1):
 ys,xs=np.nonzero(labels[b]==j);xs+=b[1].start;ys+=b[0].start
 owner=int(np.argmin(abs(np.median(xs)-anchors)))+1
 owned[ys,xs]=owner
_,near=ndi.distance_transform_edt(~strong,return_indices=True)
owned=np.where(strong,owned,owned[tuple(near)]);owned[a[:,:,3]==0]=0
assert np.count_nonzero(owned)==np.count_nonzero(a[:,:,3])
strip=Image.new('RGBA',(256*6,400))
for i in range(6):
 p=a.copy();p[owned!=i+1]=0
 # Source cells have clear gaps; preserve complete component extents with transparent gutters.
 ys,xs=np.nonzero(p[:,:,3]);box=(int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1))
 crop=Image.fromarray(p).crop(box);s=.5
 crop=crop.resize((round(crop.width*s),round(crop.height*s)),Image.Resampling.NEAREST)
 x=round(128+(box[0]-anchors[i])*s);y=round(200+(box[1]-362)*s)
 assert x>=0 and y>=0 and x+crop.width<256 and y+crop.height<400
 strip.alpha_composite(crop,(i*256+x,y))
strip.save(out/'fx-vaelric-ult-cuts.png',optimize=True)
report['parts']['cuts']={'frames':6,'w':256,'h':400,'sourceAlphaPixels':int(np.count_nonzero(a[:,:,3]))}
# Whole ribbons: nearest-row ownership keeps connected trails intact where they cross equal grid lines.
a=np.array(Image.open(src/'Dash VFX.png').convert('RGBA'))
centers=np.array([110,240,380,510,650]);strong=a[:,:,3]>8
labels,_=ndi.label(strong);owned=np.zeros(strong.shape,np.int16)
for j,b in enumerate(ndi.find_objects(labels),1):
 ys,xs=np.nonzero(labels[b]==j);ys+=b[0].start;xs+=b[1].start
 owner=int(np.argmin(abs(np.median(ys)-centers)))+1
 owned[ys,xs]=owner
_,near=ndi.distance_transform_edt(~strong,return_indices=True)
owned=np.where(strong,owned,owned[tuple(near)]);owned[a[:,:,3]==0]=0
assert np.count_nonzero(owned)==np.count_nonzero(a[:,:,3])
for i in range(5):
 p=a.copy();p[owned!=i+1]=0;ys,xs=np.nonzero(p[:,:,3])
 box=(int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1))
 crop=Image.fromarray(p).crop(box);s=.25
 crop=crop.resize((round(crop.width*s),round(crop.height*s)),Image.Resampling.NEAREST)
 canvas=Image.new('RGBA',(560,64));x=round(4+box[0]*s);y=round(32+(box[1]-centers[i])*s)
 assert x>=0 and y>=0 and x+crop.width<560 and y+crop.height<64
 canvas.alpha_composite(crop,(x,y));canvas.save(out/f'fx-vaelric-ult-dash-{i+1}.png',optimize=True)
report['parts']['dash']={'variations':5,'framesPerVariation':1,'w':560,'h':64,'pivot':[(4+110*.25)/560,.5],
 'sourceAlphaPixels':int(np.count_nonzero(a[:,:,3])),'playback':'USER_APPROVED_WHOLE_ROW_RUNTIME_REVEAL'}
audit.parent.mkdir(parents=True,exist_ok=True);audit.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
