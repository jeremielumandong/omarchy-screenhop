import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
export async function buildIdentity() {
  const hash=createHash('sha256');
  for(const file of ['independent-browser.mjs','native-launch.mjs','native-chromium.mjs','native-switch.mjs','native/Preview.qml','native/main.cpp','native/skin-gesture-filter.h','viewport.mjs','preview-host.mjs','viewer.html','capture-rtc.js','capture-ui.js','linked-previews.mjs','sync-policy.mjs','sync.js','devices.json','skin-assets.mjs','event-sockets.mjs','third_party/ws/package.json']) hash.update(file).update(await readFile(new URL(file,import.meta.url)));
  try { hash.update('.native/screenhop-native').update(await readFile(new URL('.native/screenhop-native',import.meta.url))); }
  catch(error) { if(error.code!=='ENOENT')throw error;hash.update('native-host-not-built'); }
  return hash.digest('hex').slice(0,12);
}
