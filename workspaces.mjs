#!/usr/bin/env node
import {readFile,writeFile,mkdir,rename,stat,mkdtemp} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {rpc,selection,CDP,devices} from './viewport.mjs';
import {isAuthUrl} from './sync-policy.mjs';
import {buildIdentity} from './build.mjs';
const exec=promisify(execFile),here=dirname(fileURLToPath(import.meta.url));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
export function validateWorkspace(value) {
  if(!value||!Array.isArray(value.previews)||!value.previews.length||value.previews.length>32)throw Error('A workspace needs 1–32 previews.');
  const previews=value.previews.map(item=>{
    const request={device:item.device,url:item.url,landscape:item.landscape===true};
    if(request.device==='custom')Object.assign(request,{width:item.width,height:item.height,dpr:item.dpr,mobile:item.mobile===true});
    const device=selection(request);
    if(isAuthUrl(device.url))throw Error('Finish sign-in before saving or restarting this workspace. Login and callback URLs cannot be restored.');
    return {...request,url:device.url};
  });
  // Linking starts off on restore so authentication redirects stay independent.
  return {previews};
}
export async function readWorkspaces(path) {
  try {const value=JSON.parse(await readFile(path,'utf8'));if(value.schema!==1||!Array.isArray(value.items)||value.items.length>50)throw Error('Invalid workspace file');return value;}
  catch(error){if(error.code==='ENOENT')return {schema:1,items:[]};throw error;}
}
export async function saveWorkspace(path,name,snapshot) {
  name=String(name||'').trim();if(!name||name.length>80)throw Error('Use a workspace name of 1–80 characters.');
  const workspace=validateWorkspace(snapshot),data=await readWorkspaces(path);
  const existing=data.items.find(item=>item.name===name);
  if(existing)throw Error('That workspace name already exists. Choose a different name.');
  if(data.items.length>=50)throw Error('Up to 50 workspaces can be saved.');
  data.items.push({name,...workspace});
  await mkdir(dirname(path),{recursive:true,mode:0o700});
  const temp=path+'.'+process.pid+'.tmp';await writeFile(temp,JSON.stringify(data,null,2)+'\n',{mode:0o600,flag:'wx'});await rename(temp,path);
  return data;
}
async function call(socket,request){const reply=await rpc(socket,request);if(reply.status==='error')throw Error(reply.error);return reply;}
async function snapshot(state) {
  const socket=join(state,'controller.sock');
  try {return await call(socket,{snapshot:true});}
  catch(error) {
    if(['ENOENT','ECONNREFUSED'].includes(error.code))throw Error('Open framed previews first.');
    // Older controllers do not implement snapshots. Read only their viewer config
    // to support a reviewed update without exposing pairing tokens in output.
    const [port,path]=(await readFile(join(state,'viewer-browser','DevToolsActivePort'),'utf8')).trim().split('\n');
    const c=await CDP.connect('ws://127.0.0.1:'+port+path);
    try {
      const previews=[];
      for(const target of (await c.send('Target.getTargets')).targetInfos.filter(t=>t.type==='page')) {
        const {sessionId}=await c.send('Target.attachToTarget',{targetId:target.targetId,flatten:true});
        const result=await c.send('Runtime.evaluate',{expression:"JSON.stringify({device:config,url:document.getElementById('url').textContent})",returnByValue:true},sessionId);
        const value=JSON.parse(result.result.value),cfg=value.device;
        const preset=devices.find(d=>d.name===cfg.name&&((d.width===cfg.width&&d.height===cfg.height)||(d.width===cfg.height&&d.height===cfg.width)));
        if(!preset)previews.push({device:'custom',width:cfg.width,height:cfg.height,dpr:cfg.dpr,mobile:cfg.mobile,url:value.url});
        else previews.push({device:preset.id,landscape:preset.width!==cfg.width,url:value.url});
      }
      return {previews};
    }finally{c.ws.close();}
  }
}
export async function main(args=process.argv.slice(2)) {
  const options={};for(let i=0;i<args.length;i++){const key=args[i];if(['--list','--status','--apply-update','--confirm-close','--batch','--page-only'].includes(key))options[key.slice(2)]=true;else if(['--save','--restore','--state','--storage','--output'].includes(key)&&args[i+1])options[key.slice(2)]=args[++i];else throw Error('Unknown workspace option');}
  const state=resolve(options.state||join(process.env.XDG_CACHE_HOME||join(homedir(),'.cache'),'screenhop-framed'));
  const storage=resolve(options.storage||join(process.env.XDG_STATE_HOME||join(homedir(),'.local/state'),'screenhop','workspaces.json'));
  const socket=join(state,'controller.sock');
  if(options.list)return {status:'workspaces',names:(await readWorkspaces(storage)).items.map(item=>item.name)};
  if(options.status){const installed=await buildIdentity();let running;try{running=await call(socket,{ping:true});}catch(e){if(!['ENOENT','ECONNREFUSED'].includes(e.code))throw e;}return {status:'build',installed,running:running?.build|| (running?'older build':'not running'),updateAvailable:!!running&&running.build!==installed};}
  if(options.save){const data=await saveWorkspace(storage,options.save,await snapshot(state));return {status:'saved',names:data.items.map(item=>item.name),message:'Workspace saved. URLs and device choices only; login sessions are not exported.'};}
  async function restore(value){const workspace=validateWorkspace(value);const opened=[];for(const request of workspace.previews){const args=[join(here,'viewport.mjs'),'--state',state,'--device',request.device,'--url',request.url];if(request.landscape)args.push('--landscape');if(request.device==='custom'){args.push('--width',String(request.width),'--height',String(request.height),'--dpr',String(request.dpr));if(request.mobile)args.push('--mobile');}try{const result=JSON.parse((await exec(process.execPath,args,{timeout:45000})).stdout);opened.push(result);}catch{throw Error(`Opened ${opened.length} of ${workspace.previews.length} previews. Remaining previews could not start.`);}}return {status:'restored',message:`Opened ${opened.length} previews. Linking is off until you enable it.`};}
  if(options.restore){const item=(await readWorkspaces(storage)).items.find(item=>item.name===options.restore);if(!item)throw Error('Workspace not found');validateWorkspace(item);await call(socket,{link:'off'}).catch(error=>{if(!['ENOENT','ECONNREFUSED'].includes(error.code))throw error;});return restore(item);}
  if(options['apply-update']){
    if(!options['confirm-close'])throw Error('Confirm closing previews first. Unsaved page changes are not preserved.');
    const current=validateWorkspace(await snapshot(state));
    await call(socket,{close:true});
    // Do not ping during this wait: ping refreshes the old controller idle timer.
    let stopped=false;for(let i=0;i<50;i++){try{await stat(socket);}catch(error){if(error.code==='ENOENT'){stopped=true;break;}throw error;}await delay(1000);}
    if(!stopped)throw Error('The previous controller is still running. Close its previews before retrying.');
    return restore(current);
  }
  if(options.batch){
    const current=await call(socket,{snapshot:true});if(!current.previews?.length)throw Error('Open framed previews first.');
    const root=resolve(options.output||join(homedir(),'Pictures','ScreenHop'));await mkdir(root,{recursive:true,mode:0o700});
    const directory=await mkdtemp(join(root,'capture-'));let count=0;
    for(const preview of current.previews){try{const image=await call(socket,{capture:preview.targetId,skin:!options['page-only']});if(image.mimeType!=='image/png'||typeof image.data!=='string')throw Error('Invalid screenshot response');const name=String(preview.device||'custom').replace(/[^a-zA-Z0-9_-]/g,'-');await writeFile(join(directory,`${String(++count).padStart(2,'0')}-${name}.png`),Buffer.from(image.data,'base64'),{mode:0o600,flag:'wx'});}catch(error){throw Error(`Saved ${count} screenshots to ${directory}; next capture failed: ${error.message}`);}}
    return {status:'captured',message:`Saved ${count} PNG screenshots to ${directory}`,directory,count};
  }
  throw Error('Choose a workspace action.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().then(value=>console.log(JSON.stringify(value))).catch(error=>{console.error(error.message);process.exitCode=1;});
