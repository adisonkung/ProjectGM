"""Re-export the generated Bai Long source with lossless alpha; never modify artwork."""
from pathlib import Path
import json,hashlib
from PIL import Image
root=Path(__file__).resolve().parents[2]
p=root/'assets/ui/cutins/bailong-aura-italic.json'
row=json.loads(p.read_text());source=root/row['source']
assert hashlib.sha256(source.read_bytes()).hexdigest()==row['source_sha256']
im=Image.open(source).convert('RGBA')
assert im.size==(row['w'],row['h']) and im.getextrema()[3][0]==0
output=root/row['file'];im.save(output,'WEBP',lossless=True,exact=True,method=6)
assert Image.open(output).convert('RGBA').tobytes()==im.tobytes()
row['runtime_sha256']=hashlib.sha256(output.read_bytes()).hexdigest()
p.write_text(json.dumps(row,ensure_ascii=False,indent=2)+'\n')
