"""Lossless export of immutable cut-in art and separately generated water layers."""
from pathlib import Path
import json,hashlib
from PIL import Image
root=Path(__file__).resolve().parents[2]
for relative in ['assets/ui/cutins/bailong-aura-italic.json','assets/ui/cutins/bailong-water-layers.json']:
    manifest=root/relative
    data=json.loads(manifest.read_text())
    for row in data if isinstance(data,list) else [data]:
        source=root/row['source']
        assert hashlib.sha256(source.read_bytes()).hexdigest()==row['source_sha256']
        image=Image.open(source).convert('RGBA')
        assert image.size==(row['w'],row['h']) and image.getextrema()[3][0]==0
        output=root/row['file']
        image.save(output,'WEBP',lossless=True,exact=True,method=6)
        assert Image.open(output).convert('RGBA').tobytes()==image.tobytes()
        row['runtime_sha256']=hashlib.sha256(output.read_bytes()).hexdigest()
    manifest.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
