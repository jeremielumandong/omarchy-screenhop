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
test('Desktop mouse hover opens menus and leaving preview clears hover', {timeout:90000}, async()=>{
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
  const first=await run(...(process.env.SCREENHOP_TEST_HEADFUL?[]:['--headless']),'--device','laptop-compact','--url',url);
  const second=await run('--device','pixel-5','--url',url);
  async function connect(folder){const[port,path]=(await readFile(state+'/'+folder+'/DevToolsActivePort','utf8')).trim().split('\n');return CDP.connect('ws://127.0.0.1:'+port+path)}
  source=await connect('browser');viewer=await connect('viewer-browser');
  const {sessionId:page}=await source.send('Target.attachToTarget',{targetId:first.targetId,flatten:true});
  const {sessionId:view}=await viewer.send('Target.attachToTarget',{targetId:first.viewerTargetId,flatten:true});
  const evalSource=async expr=>(await source.send('Runtime.evaluate',{expression:expr,returnByValue:true},page)).result.value;
  const evalView=async expr=>(await viewer.send('Runtime.evaluate',{expression:expr,returnByValue:true},view)).result.value;
  const other=()=>rpc(state+'/controller.sock',{inspect:true,targetId:second.targetId});
  await eventually(()=>evalView('rtcMode === "webrtc"'),'desktop video ready');
  await evalSource(`document.body.innerHTML='<style>#hover{position:fixed;right:0;top:0;padding:20px;background:white;color:black}#menu{display:none}#hover:hover #menu{display:block}</style><div id="hover">Theme<div id="menu">Nord</div></div>'`);
  const hoverCapability = await evalSource('matchMedia("(hover:hover)").matches');
  assert.equal(hoverCapability,true,'desktop enables real hover capability');
  const target=await evalSource('(()=>{const r=document.querySelector("#hover").getBoundingClientRect();return{x:r.x+10,y:r.y+10,w:innerWidth,h:innerHeight}})()');
  const bounds=await evalView('(()=>{const r=screen.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})()');
  await viewer.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:bounds.x+target.x*bounds.w/target.w,y:bounds.y+target.y*bounds.h/target.h,button:'none',buttons:0},view);
  await eventually(()=>evalSource('getComputedStyle(document.querySelector("#menu")).display === "block"'),'hover without click opens menu');
  await viewer.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1,button:'none',buttons:0},view);
  await eventually(()=>evalSource('getComputedStyle(document.querySelector("#menu")).display === "none"'),'leaving preview closes menu');
  assert.equal(await evalSource('matchMedia("(hover:hover)").matches'),hoverCapability,'pointer input preserves device media capabilities');
  console.log('Desktop no-button hover and pointer leave passed without changing device media capabilities.');
 }finally{source?.ws.close();viewer?.ws.close();await run('--close').catch(()=>{});await new Promise(r=>http.close(r));}
});
