import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {homedir} from 'node:os';
import {rpc} from './viewport.mjs';
import {runtime,instances,command} from './native-launch.mjs';
import {isAuthUrl} from './sync-policy.mjs';
const exec=promisify(execFile),folder=dirname(fileURLToPath(import.meta.url));
const run=async args=>JSON.parse((await exec(process.execPath,[join(folder,'viewport.mjs'),...(process.env.SCREENHOP_WEBRTC_STATE?['--state',process.env.SCREENHOP_WEBRTC_STATE]:[]),...args],{timeout:60000})).stdout.trim());
try {
 const args=process.argv.slice(2),open=await instances();
 if(args[0]==='--status')console.log(JSON.stringify(await run(['--status'])));
 else if(args[0]==='--link'&&args[1]==='off')console.log(JSON.stringify(await run(['--link','off'])));
 else if(args[0]==='--link'&&args[1]==='on'){
  if(open.length){await command(open[0].socket,'request-link');const state=await run(['--status']);console.log(JSON.stringify({...state,reason:'Confirm the renderer switch in the native preview window.'}));}
  else console.log(JSON.stringify(await run(['--link','on'])));
 } else if(args[0]==='--apply-link') {
  await mkdir(runtime,{recursive:true,mode:0o700});
  console.log((await exec('flock',['-n',join(runtime,'switch.lock'),process.execPath,fileURLToPath(import.meta.url),'--apply-link-locked'],{timeout:300000})).stdout.trim());
 } else if(args[0]==='--apply-link-locked') {
  const controller=await run(['--status']);
  if(controller.protocol && controller.protocol<9)throw Error('To switch renderers, first close the older WebRTC previews, close the ScreenHop panel, and wait 35 seconds. Native previews can still open independently.');
  if(open.some(item=>isAuthUrl(item.url)))throw Error('Finish signing in before switching renderers. Original previews remain open.');
  const created=[];
  try {
  // Create replacements first. A failure leaves all originals open.
  for(const item of open){
   const d=item.device;
   // OAuth callback URLs cannot be reopened as new authentication transactions.
   const url=isAuthUrl(item.url)?d.url:item.url;
   const launch=['--device','custom','--width',String(d.width),'--height',String(d.height),'--dpr',String(d.dpr||1),'--url',url];
   // Preserve the original preset and orientation so WebRTC uses the same skin.
   if(d.id!=='custom'){
    const {devices}=await import('./native-preview.mjs');const original=devices.find(x=>x.id===d.id);
    if(!original)throw Error('Device preset is unavailable');
    launch.splice(0,10,'--device',d.id,'--url',url);
    if(original.width!==d.width)launch.push('--landscape');
   } else if(d.mobile)launch.push('--mobile');
   const result=await run(launch);if(result.targetId)created.push(result.targetId);if(result.status!=='ready')throw Error('Replacement preview did not open');
  }
  const result=await run(['--link','on']);
  if(!result.enabled)throw Error(result.reason||'Linking could not be enabled. Original previews remain open.');
  }catch(error){
   const state=process.env.SCREENHOP_WEBRTC_STATE||join(process.env.XDG_CACHE_HOME||join(homedir(),'.cache'),'screenhop-framed');
   for(const targetId of created)await rpc(join(state,'controller.sock'),{closeTarget:targetId}).catch(()=>{});
   throw error;
  }
  await Promise.all(open.map(item=>command(item.socket,'close')));
  console.log(JSON.stringify(await run(['--status'])));
 }else throw Error('Unsupported renderer switch');
}catch(error){console.error(error.message);process.exitCode=1;}
