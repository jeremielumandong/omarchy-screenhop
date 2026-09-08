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
test('Mobile preview sends native touch taps and scrolling with a round indicator', {timeout:90000}, async()=>{
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
  const second=await run('--device','laptop-compact','--url',url);
  async function connect(folder){const[port,path]=(await readFile(state+'/'+folder+'/DevToolsActivePort','utf8')).trim().split('\n');return CDP.connect('ws://127.0.0.1:'+port+path)}
  source=await connect('browser');viewer=await connect('viewer-browser');
  const {sessionId:page}=await source.send('Target.attachToTarget',{targetId:first.targetId,flatten:true});
  const {sessionId:view}=await viewer.send('Target.attachToTarget',{targetId:first.viewerTargetId,flatten:true});
  const evalSource=async expr=>(await source.send('Runtime.evaluate',{expression:expr,returnByValue:true},page)).result.value;
  const evalView=async expr=>(await viewer.send('Runtime.evaluate',{expression:expr,returnByValue:true},view)).result.value;
  const other=()=>rpc(state+'/controller.sock',{inspect:true,targetId:second.targetId});
  await eventually(()=>evalView('rtcMode === "webrtc"'),'mobile video ready');
  await evalSource(`document.body.innerHTML='<style>body{height:2400px;margin:0}button{margin:20px;padding:20px}</style><button id="tap">Tap</button>';window.touchLog=[];for(const type of ['pointerdown','touchstart','touchend','touchcancel','click'])document.addEventListener(type,e=>touchLog.push({type,pointerType:e.pointerType}));`);
  assert.equal(await evalSource('matchMedia("(hover:none) and (pointer:coarse)").matches'),true,'mobile remains coarse touch with no hover');
  const bounds=await evalView('(()=>{const r=screen.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})()');
  const send=async(type,x,y,buttons=0)=>viewer.send('Input.dispatchMouseEvent',{type,x:bounds.x+x*bounds.w/390,y:bounds.y+y*bounds.h/844,button:buttons||type==='mouseReleased'?'left':'none',buttons,clickCount:type==='mouseMoved'?0:1},view);
  await send('mouseMoved',40,40);
  await eventually(()=>evalView('!touchIndicator.hidden'),'round pointer visible');
  assert.equal(await evalSource('touchLog.length'),0,'hovering mobile does not send mouse events');
  await send('mousePressed',40,40,1);await send('mouseReleased',40,40);
  await eventually(()=>evalSource('touchLog.some(e=>e.type==="click")'),'native touch creates compatibility click');
  assert.equal(await evalSource('touchLog.find(e=>e.type==="pointerdown").pointerType'),'touch');
  assert.equal(await evalSource('touchLog.filter(e=>e.type==="touchstart").length'),1);
  assert.equal(await evalSource('touchLog.filter(e=>e.type==="touchend").length'),1);
  await send('mousePressed',190,650,1);
  for(let y=620;y>=200;y-=30){await send('mouseMoved',190,y,1);await sleep(20);}
  await send('mouseReleased',190,200);
  await eventually(()=>evalSource('scrollY>100'),'native touch drag scrolls webpage');
  await send('mousePressed',190,600,1);await evalView('releasePointer()');
  await eventually(()=>evalSource('touchLog.some(e=>e.type==="touchcancel")'),'cancel releases native touch');
  const desktop=await rpc(state+'/controller.sock',{inspect:true,targetId:second.targetId});assert.equal(desktop.touch,0);
  const {sessionId:desktopPage}=await source.send('Target.attachToTarget',{targetId:second.targetId,flatten:true});
  assert.equal((await source.send('Runtime.evaluate',{expression:'matchMedia("(hover:hover) and (pointer:fine)").matches',returnByValue:true},desktopPage)).result.value,true,'desktop remains fine mouse with hover');
  console.log('Mobile native touch, round indicator, compatibility click, drag scroll, cancellation and desktop input capabilities passed.');
 }finally{source?.ws.close();viewer?.ws.close();await run('--close').catch(()=>{});await new Promise(r=>http.close(r));}
});
