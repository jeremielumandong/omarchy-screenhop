import {readFile,writeFile,mkdir,access,readdir} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {openSync,closeSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {homedir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createConnection} from 'node:net';
const folder=dirname(fileURLToPath(import.meta.url));
export const runtime=process.env.SCREENHOP_NATIVE_RUNTIME||join(process.env.XDG_RUNTIME_DIR||join(homedir(),'.cache'),'screenhop-native-'+process.getuid());
export function command(socket,action,extra={}) {return new Promise((resolve,reject)=>{const s=createConnection(socket);let data='';s.setTimeout(6000,()=>s.destroy(Error('Native preview timed out')));s.on('error',reject);s.on('connect',()=>s.write(JSON.stringify({action,...extra})+'\n'));s.on('data',chunk=>{data+=chunk;if(data.includes('\n')){try{resolve(JSON.parse(data.split('\n')[0]));}catch(e){reject(e)}s.end();}});});}
export async function instances(){let files;try{files=await readdir(runtime)}catch(e){if(e.code==='ENOENT')return [];throw e;}const list=[];for(const f of files.filter(f=>f.endsWith('.sock'))){const socket=join(runtime,f);try{list.push({socket,...await command(socket,'snapshot')});}catch{}}return list;}
export function skinHTML(template,device) {
 const start=template.indexOf('<script>');
 let script=template.slice(start+8,template.indexOf('const clientId =',start));
 script=script.replace('__SCREENHOP_CONFIG__',JSON.stringify(device).replace(/</g,'\\u003c'));
 script=script.replace("config.base + '/skin/'", "'assets/skins/'");
 // Fit the original skin; the browser sidecar sizes its drawing surface separately.
 const fit=template.slice(template.indexOf('function fit()'),template.indexOf('function updateState('));
 const labels = "$('preview-size').textContent=width+' × '+height+' CSS px · Native Chromium (experimental)';$('dimensions').textContent=width+' × '+height+' CSS px · Preset pixel density';";
 return template.slice(0,start).replace('width=device-width, initial-scale=1','width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no').replace('</head>','<style>html,body{touch-action:none}.tool-dock,.loading,.touch-indicator{display:none!important}</style></head>')+'<script>'+script+'\nlet showFrame=true;\n'+labels+'\n'+fit+"\naddEventListener('resize',fit);addEventListener('load',fit);fit();</script></body></html>";
}
export async function launchNative(device) {
 try{await access(join(folder,'.native/screenhop-native'));}catch{throw Error('Native previews need a local build. Run bash scripts/install.sh from the ScreenHop source folder, then reopen the panel. WebRTC previews remain available.');}
 await mkdir(runtime,{recursive:true,mode:0o700});
 const key=[device.id,device.width,device.height,device.dpr,device.mobile?'mobile':'desktop'].join('-');
 // Allocate a stable numbered profile for each simultaneously open instance.
 const open=await instances();let slot=1;
 while(open.some(x=>x.device?.profileKey===key+'-'+slot))slot++;
 device={...device,profileKey:key+'-'+slot};
 const profile=join(process.env.SCREENHOP_NATIVE_PROFILES||join(homedir(),'.local/state/screenhop/native'),device.profileKey);
 await mkdir(profile,{recursive:true,mode:0o700});
 const id=randomUUID(),socket=join(runtime,id+'.sock'),html=join(runtime,id+'.html'),config=join(runtime,id+'.json');
 await writeFile(html,skinHTML(await readFile(join(folder,'viewer.html'),'utf8'),device),{mode:0o600});
 await writeFile(config,JSON.stringify({device,profile,socket,html,folder}),{mode:0o600});
 let desktopScale=process.env.QT_SCALE_FACTOR;
 if(!desktopScale)try{desktopScale=String(JSON.parse(execFileSync('hyprctl',['-j','monitors'],{encoding:'utf8',stdio:['ignore','pipe','ignore']})).find(m=>m.focused)?.scale||1)}catch{desktopScale='1'}
 const log=openSync(join(runtime,id+'.log'),'a',0o600);
 const child=spawn(join(folder,'.native/screenhop-native'),[config],{detached:true,env:{...process.env,QTWEBENGINE_CHROMIUM_FLAGS:(process.env.QTWEBENGINE_CHROMIUM_FLAGS||'')+' --disable-pinch',QT_QPA_PLATFORM:'xcb',QT_SCALE_FACTOR:desktopScale},stdio:['ignore','ignore',log]});closeSync(log);
 let error='',ended=false;child.on('error',e=>{error=e.message;ended=true});child.on('exit',()=>{ended=true});
 for(let i=0;i<100;i++){
  if(ended)throw Error(error||'Native browser exited. See '+join(runtime,id+'.log'));
  await new Promise(r=>setTimeout(r,100));
  try{const info=await command(socket,'inspect');if(info.ready && info.scale>0 && info.viewport?.screenWidth===device.width && info.viewport?.screenHeight===device.height && info.viewport?.dpr===device.dpr && info.viewport?.touchPoints===(device.mobile?5:0) && info.viewport?.coarse===device.mobile){child.unref();return {status:'ready',pid:child.pid,socket,width:device.width,height:device.height,reason:'Native device preview opened. Link previews switches to WebRTC.'};}}catch{}
 }
 child.kill();throw Error('Native browser did not establish the exact device viewport. '+error);
}
