import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';

const root=process.env.SCREENHOP_MULTI_TEST_ROOT;
const helper=root?`${root}/viewport.mjs`:new URL('../viewport.mjs',import.meta.url).pathname;
const {CDP}=await import(pathToFileURL(helper));
const exec=promisify(execFile),sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function eventually(fn,description) {
 for(let i=0;i<120;i++){if(await fn())return;await sleep(100);}
 throw new Error('Timed out: '+description);
}

// Chromium shares its HTTP/1 connection pool between preview windows. Seven
// viewers exceed the six-connection pool and expose persistent-stream starvation.
test('seven desktop previews connect, receive video and remain interactive',{timeout:150000},async()=>{
 const state=await mkdtemp('/tmp/screenhop-multi-preview-');
 const fixture=createServer((req,res)=>{
  res.setHeader('Content-Type','text/html');
  res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}button{position:absolute;left:20px;top:20px;width:120px;height:50px}</style><button id="counter" onclick="this.textContent=String(+this.textContent+1)">0</button>');
 });
 await new Promise(r=>fixture.listen(0,'127.0.0.1',r));
 const url='http://127.0.0.1:'+fixture.address().port;
 const run=async(...args)=>JSON.parse((await exec(process.execPath,[helper,'--state',state,...args],{timeout:40000})).stdout);
 let source,viewer;
 const previews=[];
 const evaluate=async(cdp,session,expression)=>(await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},session)).result.value;
 const evalView=(session,expression)=>evaluate(viewer,session,expression);
 const live=session=>evalView(session,'typeof rtcMode !== "undefined" && rtcMode === "webrtc" && rtcVideo.videoWidth === 200 && rtcVideo.videoHeight === 300');
 async function connect(folder){const [port,path]=(await readFile(`${state}/${folder}/DevToolsActivePort`,'utf8')).trim().split('\n');return CDP.connect('ws://127.0.0.1:'+port+path);}
 async function click(session,page,expected){
  const p=await evalView(session,'(()=>{const r=screen.getBoundingClientRect();return{x:r.x+80*r.width/200,y:r.y+45*r.height/300}})()');
  await viewer.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1},session);
  await viewer.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1},session);
  await eventually(async()=>await evaluate(source,page,'document.querySelector("#counter").textContent')===String(expected),'browser input reaches source with all seven event channels open');
 }
 try{
  for(let i=0;i<7;i++){
   const preview=await run(...(i?[]:['--headless']),'--device','custom','--width','200','--height','300','--dpr','1','--url',url);
   if(!source){source=await connect('browser');viewer=await connect('viewer-browser');}
   preview.page=(await source.send('Target.attachToTarget',{targetId:preview.targetId,flatten:true})).sessionId;
   preview.view=(await viewer.send('Target.attachToTarget',{targetId:preview.viewerTargetId,flatten:true})).sessionId;
   previews.push(preview);
   await eventually(()=>live(preview.view),`desktop viewer ${i+1} receives WebRTC video`);
  }
  for(const preview of previews)await click(preview.view,preview.page,1);
  // Signaling still works after saturation, including reopening a peer.
  const first=previews[0];
  const previous=await evalView(first.view,'rtcPeerId');
  await evalView(first.view,'startRTC();true');
  await eventually(async()=>await live(first.view)&&await evalView(first.view,'rtcPeerId')!==previous,'desktop video renegotiates with seven viewers open');
  await click(first.view,first.page,2);
  console.log('Seven desktop WebRTC receivers and all seven input paths passed at 200 × 300 CSS px.');
 }catch(error){
  for(const [i,p] of previews.entries())console.log('Preview',i+1,await evalView(p.view,'({mode:typeof rtcMode === "undefined"?"unloaded":rtcMode,status:document.querySelector("#status-text")?.textContent})').catch(()=>null));
  throw error;
 }finally{
  source?.ws.close();viewer?.ws.close();
  await run('--close').catch(()=>{});
  fixture.closeAllConnections();await new Promise(r=>fixture.close(r));
 }
});
