#!/usr/bin/env python3
"""Export a reviewable public tree; never copy local vendor artwork or Git history."""
import json,pathlib,shutil,sys
source=pathlib.Path(__file__).resolve().parent.parent
if len(sys.argv)!=2: raise SystemExit('Usage: python3 scripts/prepare-publication.py NEW_OUTPUT_DIRECTORY')
target=pathlib.Path(sys.argv[1]).resolve()
if target.exists(): raise SystemExit('Output must be a new directory')
target.mkdir(parents=True)
root_files=['Widget.qml','manifest.json','viewport.mjs','native-preview.mjs','preview-host.mjs','phone-remote.mjs','phone-firewall.mjs','viewer.html','linked-previews.mjs','sync-policy.mjs','sync.js','capture-rtc.js','capture-ui.js','build.mjs','workspaces.mjs','skin-assets.mjs','README.md','PLAN.md','LICENSE','THIRD_PARTY_NOTICES.md','preview.png','CHANGELOG.md','.gitignore']
for name in root_files:shutil.copy2(source/name,target/name)
for folder in ['scripts','tests','third_party']:
 for p in (source/folder).rglob('*'):
  if p.is_symlink():raise SystemExit('Symlinks are not allowed: '+str(p))
  if p.is_file() and '__pycache__' not in p.parts and p.name!='skin-viewer.test.mjs':
   dest=target/p.relative_to(source);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
(target/'docs').mkdir()
if (source/'docs/images/device-previews.png').is_file():
 (target/'docs/images').mkdir()
 shutil.copy2(source/'docs/images/device-previews.png',target/'docs/images/device-previews.png')
for name in ['DEVICE_SOURCES.md','PUBLICATION.md','MARKETPLACE_SUBMISSION.md']:
 shutil.copy2(source/'docs'/name,target/'docs'/name)
devices=json.loads((source/'devices.json').read_text())
for d in devices:d.pop('skinAsset',None)
(target/'devices.json').write_text(json.dumps(devices,indent=2)+'\n')
(target/'VALIDATION.md').write_text('# Publication validation\n\nSee docs/PUBLICATION.md for the checks and remaining publication steps.\n')
print(target)
