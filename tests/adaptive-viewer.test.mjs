import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {CDP,rpc} from '../viewport.mjs';
const exec=promisify(execFile),helper=new URL('../viewport.mjs',import.meta.url).pathname;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function eventually(fn,description) {for(let i=0;i<60;i++){if(await fn())return;await sleep(100)}throw new Error('Timed out: '+description)}
test('Adaptive quality, diagnostics and JPEG cleanup on WebRTC recovery', {timeout:90000}, async()=>{
 const state=await mkdtemp('/tmp/screenhop-framed-test-'); const requests=[];
 const http=createServer((req,res)=>{
  requests.push(req.url);
  if(req.url.includes('/authorize')){res.writeHead(302,{Location:'/callback?code=single-use-test&state=fixture'});res.end();return;}
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>ScreenHop test studio</title><style>body{margin:0;background:#12222e;color:#edf2ff;font:18px system-ui}main{padding:28px}h1{font-size:38px;line-height:1.15;margin:26px 0}button,input{font:16px system-ui;padding:12px;border:0;border-radius:8px}button{background:#b8ceff;color:#11213b}input{display:block;margin:20px 0;width:230px}article{margin-top:28px;border-radius:16px;height:210px;background:linear-gradient(140deg,#33546a,#284b44)}p{color:#aebfcb;line-height:1.6}</style><main><small>SCREENHOP STUDIO</small><h1>One website.<br>Every screen.</h1><p>A live Chromium page, inside a centered device frame.</p><button id="counter" onclick="this.textContent=String(Number(this.textContent)+1)">0</button><input id="entry" placeholder="Try typing here"><article></article><p>390 × 844 CSS pixels<br>ScreenHop 1.0.0</p></main>`);
 });
 await new Promise(r=>http.listen(0,'127.0.0.1',r));
 const url='http://127.0.0.1:'+http.address().port;
 const run=async(...args)=>JSON.parse((await exec(process.execPath,[helper,'--state',state,...args],{timeout:40000})).stdout);
 let source,viewer;
 try{
  const first=await run(...(process.env.SCREENHOP_TEST_HEADFUL?[]:['--headless']),'--device','iphone-13','--url',url);
  const second=await run('--device','pixel-5','--url',url);
  async function connect(folder){const[port,path]=(await readFile(state+'/'+folder+'/DevToolsActivePort','utf8')).trim().split('\n');return CDP.connect('ws://127.0.0.1:'+port+path)}
  source=await connect('browser');viewer=await connect('viewer-browser');
  const {sessionId:page}=await source.send('Target.attachToTarget',{targetId:first.targetId,flatten:true});
  const {sessionId:view}=await viewer.send('Target.attachToTarget',{targetId:first.viewerTargetId,flatten:true});
  const evalSource=async expr=>(await source.send('Runtime.evaluate',{expression:expr,returnByValue:true},page)).result.value;
  const evalView=async expr=>(await viewer.send('Runtime.evaluate',{expression:expr,returnByValue:true},view)).result.value;
  const other=()=>rpc(state+'/controller.sock',{inspect:true,targetId:second.targetId});
  try{await eventually(()=>evalView('document.querySelector("#rtc-video")?.videoWidth === 390 && document.querySelector("#rtc-video")?.videoHeight === 844'),'live WebRTC video');}catch(error){console.log(await evalView('({mode:rtcMode,state:rtcPeer?.connectionState,width:rtcVideo.videoWidth,height:rtcVideo.videoHeight,toast:document.querySelector("#toast").textContent})'));throw error;}
  assert.match(await evalView('document.title'),/iPhone 13/);
  assert.equal(await evalView('document.querySelector("#rtc-video").videoHeight'),844);
  assert.equal(await evalView('document.querySelector("#display").naturalWidth'),0,'WebRTC must not require a JPEG stream');
  await viewer.send('Emulation.setFocusEmulationEnabled',{enabled:true},view);
  await evalView('document.querySelector(".tool-dock").classList.add("open");document.querySelector("#diagnostics").open=true');
  await eventually(()=>evalView('document.querySelector("#diagnostic-values").textContent.includes("DPR 3")'),'diagnostics show actual preset DPR');
  assert.match(await evalView('document.querySelector("#diagnostic-values").textContent'),/Chromium emulation/);
  await evalView('lastActivity=performance.now()-4000;reportActivity(true)');
  assert.equal(await evalView('activityDemand().fps'),10);
  await evalView('document.querySelector("#preview-quality").value="eco";document.querySelector("#preview-quality").dispatchEvent(new Event("change"))');
  assert.equal(await evalView('activityDemand().fps'),5);
  await evalView('markActivity()');assert.equal(await evalView('activityDemand().fps'),30);
  await evalView('lastActivity=performance.now()-4000;dispatchEvent(new CustomEvent("screenhop-recording",{detail:true}))');
  assert.equal(await evalView('activityDemand().fps'),30,'recording keeps full cadence');
  const {targetId:extraTarget}=await viewer.send('Target.createTarget',{url:await evalView('location.href')});
  const {sessionId:extraSession}=await viewer.send('Target.attachToTarget',{targetId:extraTarget,flatten:true});
  const evalExtra=async expression=>(await viewer.send('Runtime.evaluate',{expression,returnByValue:true},extraSession)).result.value;
  await eventually(()=>evalExtra('typeof rtcMode !== "undefined" && rtcMode === "webrtc"'),'second receiver connects');
  await evalExtra('fallbackRTC("")');
  await eventually(()=>evalExtra('display.naturalWidth>0'),'second receiver fallback renders');
  await evalView('dispatchEvent(new CustomEvent("screenhop-recording",{detail:false}));fallbackRTC("")');
  await eventually(()=>evalView('display.naturalWidth>0'),'JPEG fallback renders');
  await evalView('startRTC()');
  await eventually(()=>evalView('rtcMode === "webrtc"'),'WebRTC recovers');
  await eventually(async()=>(await rpc(state+'/controller.sock',{inspect:true,targetId:first.targetId})).fallbackPeerCount===1,'first receiver releases fallback');
  const stillNeeded=await rpc(state+'/controller.sock',{inspect:true,targetId:first.targetId});
  assert.equal(stillNeeded.jpegActive,true,'other fallback subscriber still requires capture');
  assert.equal(stillNeeded.fallbackPeerCount,1);
  await evalExtra('startRTC()');
  await eventually(()=>evalExtra('rtcMode === "webrtc"'),'second receiver recovers');
  await eventually(async()=>!(await rpc(state+'/controller.sock',{inspect:true,targetId:first.targetId})).jpegActive,'JPEG source stopped');
  const metrics=await rpc(state+'/controller.sock',{inspect:true,targetId:first.targetId});
  assert.equal(metrics.width,390);assert.equal(metrics.height,844);assert.equal(metrics.dpr,3);
  assert.equal(metrics.jpegActive,false);assert.equal(metrics.fallbackPeerCount,0);
  console.log('Verified adaptive controls, diagnostics, recording cadence, native recovery and JPEG source cleanup.');
 }finally{source?.ws.close();viewer?.ws.close();await run('--close').catch(()=>{});await new Promise(r=>http.close(r));}
});
