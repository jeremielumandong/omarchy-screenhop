import {browserEnvironment,fetch} from './helpers/phone-tls.mjs';
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
test('centered live device frame, input forwarding, authentication isolation and cleanup', {timeout:90000}, async()=>{
 const state=await mkdtemp('/tmp/screenhop-framed-test-'); const requests=[];
 const http=createServer((req,res)=>{
  requests.push(req.url);
  if(req.url.includes('/authorize')){res.writeHead(302,{Location:'/callback?code=single-use-test&state=fixture'});res.end();return;}
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>ScreenHop test studio</title><style>body{margin:0;background:#12222e;color:#edf2ff;font:18px system-ui}main{padding:28px}h1{font-size:38px;line-height:1.15;margin:26px 0}button,input{font:16px system-ui;padding:12px;border:0;border-radius:8px}button{background:#b8ceff;color:#11213b}input{display:block;margin:20px 0;width:230px}article{margin-top:28px;border-radius:16px;height:210px;background:linear-gradient(140deg,#33546a,#284b44)}p{color:#aebfcb;line-height:1.6}</style><main><small>SCREENHOP STUDIO</small><h1>One website.<br>Every screen.</h1><p>A live Chromium page, inside a centered device frame.</p><button id="counter" onclick="this.textContent=String(Number(this.textContent)+1)">0</button><input id="entry" placeholder="Try typing here"><article></article><p>390 × 844 CSS pixels<br>ScreenHop 1.0.0</p></main>`);
 });
 await new Promise(r=>http.listen(0,'127.0.0.1',r));
 const url='http://127.0.0.1:'+http.address().port;
 const run=async(...args)=>JSON.parse((await exec(process.execPath,[helper,'--state',state,...args],{timeout:40000,env:browserEnvironment()})).stdout);
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
  await eventually(()=>evalView('document.querySelector("#display")?.naturalWidth > 0 || document.querySelector("#rtc-video")?.videoWidth > 0'),'live page image');
  assert.match(await evalView('document.title'),/iPhone 13/);
  assert.match(await evalView('document.querySelector("#dimensions").textContent'),/390 × 844/);
  const geometry=await evalView('(()=>{const d=document.querySelector("#device").getBoundingClientRect(),s=document.querySelector("#stage").getBoundingClientRect();return{center:d.x+d.width/2,stage:s.x+s.width/2,centerY:d.y+d.height/2,stageY:s.y+s.height/2}})()');
  assert.ok(Math.abs(geometry.center-geometry.stage)<2,'device frame is horizontally centered');
  assert.ok(Math.abs(geometry.centerY-geometry.stageY)<2,'device frame is vertically centered');
  if(process.env.SCREENHOP_TEST_HEADFUL){
   const chrome=await evalView('({outer:outerHeight,inner:innerHeight})');
   assert.ok(chrome.outer-chrome.inner<=2,'No browser titlebar, tabs or address bar: '+JSON.stringify(chrome));
  }
  async function clickView(x,y){await viewer.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1},view);await viewer.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1},view)}
  const button=await evalSource('(()=>{const r=document.querySelector("#counter").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');
  const screen=await evalView('(()=>{const r=document.querySelector("#screen").getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})()');
  await clickView(screen.x+button.x*screen.w/390,screen.y+button.y*screen.h/844);
  await eventually(()=>evalSource('document.querySelector("#counter").textContent === "1"'),'click forwarded to real webpage');
  const field=await evalSource('(()=>{const r=document.querySelector("#entry").getBoundingClientRect();return{x:r.x+20,y:r.y+20}})()');
  await clickView(screen.x+field.x*screen.w/390,screen.y+field.y*screen.h/844);
  await viewer.send('Input.dispatchKeyEvent',{type:'keyDown',key:'h',code:'KeyH',windowsVirtualKeyCode:72,text:'h'},view);
  await viewer.send('Input.dispatchKeyEvent',{type:'keyUp',key:'h',code:'KeyH',windowsVirtualKeyCode:72},view);
  await eventually(()=>evalSource('document.querySelector("#entry").value === "h"'),'keyboard forwarded');
  await evalView('document.querySelector("#frame").click()');
  assert.equal((await rpc(state+'/controller.sock',{inspect:true,targetId:first.targetId})).width,390);
  await evalView('document.querySelector("#frame").click()');
  const screenshot=await viewer.send('Page.captureScreenshot',{format:'png'},view);
  await writeFile('/tmp/screenhop-1.0.0-preview.png',Buffer.from(screenshot.data,'base64'));
  const paired=await run('--phone','on');
  assert.equal(paired.enabled,true);
  const remoteBase=new URL(paired.url);remoteBase.hostname='127.0.0.1';
  const remoteView=new URL('view/'+first.targetId,remoteBase);
  assert.equal((await run('--phone-status')).enabled,true);
  const remoteHTML=await (await fetch(remoteView)).text();
  assert.match(remoteHTML,/"phone":true/);
  const remotePost=async(route,data)=>{
   const response=await fetch(remoteView+'/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
   assert.equal(response.status,200);
  };
  await remotePost('action',{action:'link',enabled:true});
  await remotePost('input',{kind:'mouse',type:'mousePressed',x:button.x,y:button.y,button:'left',clickCount:1});
  await remotePost('input',{kind:'mouse',type:'mouseReleased',x:button.x,y:button.y,button:'left',clickCount:1});
  await eventually(()=>evalSource('document.querySelector("#counter").textContent === "2"'),'phone click reaches source');
  const {sessionId:otherPage}=await source.send('Target.attachToTarget',{targetId:second.targetId,flatten:true});
  await eventually(async()=>(await source.send('Runtime.evaluate',{expression:'document.querySelector("#counter").textContent',returnByValue:true},otherPage)).result.value==='1','phone click reaches linked preview');
  assert.equal((await run('--phone','off')).enabled,false);
  await assert.rejects(fetch(remoteView));
  console.log('Phone integration: pairing, status, real renderer input, linked follower and revocation passed.');
  for(const provider of ['identityserver/connect','okta/oauth2/default/v1','azure/tenant/oauth2/v2.0','auth0','google/o/oauth2/v2','github/login/oauth']){
   await source.send('Page.navigate',{url:url+'/home'},page);await sleep(250);
   const enabled=await run('--link','on');assert.equal(enabled.enabled,true);
   const baseline=requests.length;
   await source.send('Page.navigate',{url:url+'/'+provider+'/authorize?client_id=test&response_type=code&state=fixture'},page);
   await eventually(()=>evalSource('location.pathname === "/callback"'),'OAuth callback');await sleep(350);
   assert.equal((await other()).url,url+'/');
   assert.equal(requests.slice(baseline).filter(p=>p.startsWith('/callback')).length,1,'callback must not be replayed');
   const blocked=await run('--link','on');assert.equal(blocked.enabled,false,'cannot resume while auth callback is open');
  }
  await source.send('Page.navigate',{url:url+'/home'},page);await sleep(250);await run('--link','on');
  await evalSource('document.body.insertAdjacentHTML("beforeend",`<form method="post" action="/standard-login"><input type="password" id="password"><input autocomplete="one-time-code" id="otp"><button type="submit" id="submit">Sign in</button></form>`)');
  await sleep(200);
  assert.equal((await run('--link','on')).enabled,false,'standard login and MFA pause linking');
  const baseline=requests.length;
  await evalSource('document.querySelector("#submit").click()');await sleep(400);
  assert.equal(requests.slice(baseline).filter(p=>p==='/standard-login').length,1);
  assert.equal((await other()).url,url+'/');
  await viewer.send('Target.closeTarget',{targetId:first.viewerTargetId});
  await eventually(async()=>!(await source.send('Target.getTargets')).targetInfos.some(t=>t.targetId===first.targetId),'closing frame closes its rendering page');
  console.log('Frame evidence: centered outline, label, live image, real input, unchanged viewport, six provider redirect fixtures, standard login/MFA isolation and cleanup passed.');
 }finally{source?.ws.close();viewer?.ws.close();await run('--close').catch(()=>{});await new Promise(r=>http.close(r));}
});
