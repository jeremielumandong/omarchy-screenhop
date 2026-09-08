// Manual benchmark: node tests/performance-bench.mjs [source-root] [output.json]
// Requires Chromium and Linux /proc; uses only temporary browser profiles.
import {createServer} from 'node:http';
import {mkdtemp,readFile,readdir,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const exec=promisify(execFile),root=resolve(process.argv[2]||fileURLToPath(new URL('../',import.meta.url)));
const {CDP}=await import(root+'/viewport.mjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ticks=Number((await exec('getconf',['CLK_TCK'])).stdout.trim());
const result={root,sampleSeconds:5,idleWaitSeconds:Number(process.env.SCREENHOP_BENCH_IDLE_WAIT||12),headless:true,logicalCores:(await import('node:os')).cpus().length,runs:[]};
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#222;color:white;font:24px sans-serif}div{background:linear-gradient(60deg,#34c,#e87);width:60%;height:250px;animation:a .8s infinite alternate}@keyframes a{to{transform:translate(40px,100px) rotate(20deg)}}</style><h1>ScreenHop benchmark</h1><div></div>')});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port;
async function processes(state){
 const all=await Promise.all((await readdir('/proc')).filter(p=>/^\d+$/.test(p)).map(async pid=>{try{const [stat,cmd]=await Promise.all([readFile('/proc/'+pid+'/stat','utf8'),readFile('/proc/'+pid+'/cmdline','utf8')]);const fields=stat.slice(stat.lastIndexOf(')')+2).split(' ');return{pid:Number(pid),parent:Number(fields[1]),ticks:Number(fields[11])+Number(fields[12]),owned:cmd.includes(state)};}catch{return null}}));
 const entries=all.filter(Boolean),ids=new Set(entries.filter(e=>e.owned).map(e=>e.pid));let changed;do{changed=false;for(const e of entries)if(ids.has(e.parent)&&!ids.has(e.pid)){ids.add(e.pid);changed=true}}while(changed);
 return Promise.all(entries.filter(e=>ids.has(e.pid)).map(async e=>{try{const smaps=await readFile('/proc/'+e.pid+'/smaps_rollup','utf8');e.pssKiB=Number(smaps.match(/^Pss:\s+(\d+)/m)?.[1]||0)}catch{e.pssKiB=0}return e}));
}
try{for(const count of [1,2,4]){
 const state=await mkdtemp('/tmp/screenhop-performance-');
 const run=async(...args)=>JSON.parse((await exec(process.execPath,[root+'/viewport.mjs','--state',state,...args],{timeout:45000})).stdout);
 let viewer;const pages=[];
 try{
  for(let i=0;i<count;i++)pages.push(await run('--headless','--device',['iphone-13','pixel-5','iphone-13','pixel-5'][i],'--url',url));
  const [port,path]=(await readFile(state+'/viewer-browser/DevToolsActivePort','utf8')).trim().split('\n');viewer=await CDP.connect('ws://127.0.0.1:'+port+path);
  for(const p of pages){p.session=(await viewer.send('Target.attachToTarget',{targetId:p.viewerTargetId,flatten:true})).sessionId;await viewer.send('Emulation.setFocusEmulationEnabled',{enabled:true},p.session);}
  const evaluate=async(p,expression)=>(await viewer.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},p.session)).result.value;
  const stats=()=>Promise.all(pages.map(p=>evaluate(p,'(async()=>{const v=document.querySelector("#rtc-video"),r=typeof rtcPeer!=="undefined"&&rtcPeer?await rtcPeer.getStats():null;let inbound=null;r?.forEach(s=>{if(s.type==="inbound-rtp"&&s.kind==="video")inbound={framesDecoded:s.framesDecoded,framesDropped:s.framesDropped,bytesReceived:s.bytesReceived,framesPerSecond:s.framesPerSecond}});return {mode:typeof rtcMode!=="undefined"?rtcMode:null,width:v?.videoWidth,height:v?.videoHeight,visibility:document.visibilityState,decoded:v?.getVideoPlaybackQuality().totalVideoFrames,inbound}})()')));
  for(let tries=0;;tries++){const s=await stats();if(s.every(v=>v.mode==='webrtc'&&v.width))break;if(tries>100)throw Error('WebRTC failed: '+JSON.stringify(s));await sleep(100)}
  const activity=()=>Promise.all(pages.map(async p=>{await evaluate(p,'typeof markActivity === "function" && markActivity()');return fetch(p.viewerUrl+'/input',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'mouse',type:'mouseMoved',x:120,y:160})})}));
  const sample=async(active)=>{if(active)await activity();const timer=active?setInterval(()=>activity().catch(()=>{}),700):null;try{const before=await processes(state),framesBefore=await stats(),started=performance.now();await sleep(5000);const after=await processes(state),framesAfter=await stats(),seconds=(performance.now()-started)/1000;const previous=new Map(before.map(p=>[p.pid,p.ticks]));return{seconds:+seconds.toFixed(2),cpuPercentOneCore:+(after.reduce((s,p)=>s+Math.max(0,p.ticks-(previous.get(p.pid)??p.ticks)),0)/ticks/seconds*100).toFixed(1),pssMiB:+(after.reduce((s,p)=>s+p.pssKiB,0)/1024).toFixed(1),processes:after.length,viewers:framesAfter.map((s,i)=>({...s,decodedFps:+((s.decoded-framesBefore[i].decoded)/seconds).toFixed(1)}))}}finally{clearInterval(timer)}};
  await sleep(5000);const active=await sample(true);await sleep(result.idleWaitSeconds*1000);const idle=await sample(false);const item={count,active,idle};result.runs.push(item);console.log(JSON.stringify(item));
 }finally{
  viewer?.ws.close();await run('--close').catch(()=>{});await sleep(300);
  // Only isolated benchmark-owned processes can be terminated.
  const owned=await processes(state);for(const p of owned)try{process.kill(p.pid,'SIGTERM')}catch{}
 }
}}finally{await new Promise(r=>server.close(r));}
if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(result,null,2)+'\n');
