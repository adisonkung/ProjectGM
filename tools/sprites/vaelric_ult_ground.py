"""Audit the existing Ultimate strips' lower visible alpha edges; never rewrites art.
python tools/sprites/vaelric_ult_ground.py [SPRITE_DIR] [AUDIT_JSON]
"""
import hashlib,json,sys
from pathlib import Path
import numpy as np
from PIL import Image
src=Path(sys.argv[1] if len(sys.argv)>1 else 'public/sprites')
out=Path(sys.argv[2] if len(sys.argv)>2 else 'docs/timelines/vaelric/vaelric-ult-ground.json')
report={'alphaThreshold':8,'parts':{}}
for part,w,count in [('vanish',238,10),('impact',308,12),('retreat',204,5)]:
 p=src/f'fx-vaelric-ult-{part}.png';a=np.array(Image.open(p).convert('RGBA'))
 assert a.shape[1]==w*count
 edges=[]
 for i in range(count):
  ys=np.nonzero(a[:,i*w:(i+1)*w,3]>=8)[0]
  assert ys.size
  edges.append(int(ys.max())+1)
 report['parts'][part]={'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'ground':edges,'w':w,'h':a.shape[0]}
# The fixed F8 charging/F9 return stance's solid body ends at156px; exclude detached sword/glow fragments.
p=src/'hero-vaelric.png';a=np.array(Image.open(p).convert('RGBA'))[1190:1360,7*260:8*260,3]
rows=np.count_nonzero(a>=32,axis=1);foot=int(np.flatnonzero(rows>=max(3,rows.max()*.08)).max())+1
report['hero']={'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'frame':8,'solidFootPixel':foot,'footPercent':96-(170-foot)*165/132,'openingFootPercent':77.25}
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
