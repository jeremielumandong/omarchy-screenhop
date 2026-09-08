import {readFile} from 'node:fs/promises';

// Both authenticated viewers use this allowlist; URLs cannot address arbitrary
// files or artwork belonging to a different device.
export async function serveSkinAsset(res,asset,route) {
 const match=/^skin\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_.-]+\.png)$/.exec(route);
 const allowed=asset&&new Set([asset.foreground,...(asset.colors||[]).map(color=>color.file)]);
 if(!match || match[1]!==asset?.id || !allowed?.has(match[2])) {res.writeHead(404);res.end('Skin not found');return;}
 try {
  const data=await readFile(new URL('./assets/skins/'+match[1]+'/'+match[2],import.meta.url));
  res.setHeader('Content-Type','image/png');
  // Only the currently selected artwork is requested. Reuse it when switching
  // colors instead of repeatedly transferring multi-megabyte manufacturer files.
  res.setHeader('Cache-Control','private, max-age=3600');
  res.end(data);
 } catch(error) {if(error.code!=='ENOENT')throw error;res.writeHead(404);res.end('Skin not found');}
}
