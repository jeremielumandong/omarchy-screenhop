import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
export async function buildIdentity() {
  const hash=createHash('sha256');
  for(const file of ['viewport.mjs','preview-host.mjs','phone-remote.mjs','viewer.html','capture-rtc.js','capture-ui.js','linked-previews.mjs','sync-policy.mjs','sync.js','devices.json','skin-assets.mjs']) hash.update(file).update(await readFile(new URL(file,import.meta.url)));
  return hash.digest('hex').slice(0,12);
}
