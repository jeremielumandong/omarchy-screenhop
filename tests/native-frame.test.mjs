import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdtemp,stat} from 'node:fs/promises';
import {launchNative,command,skinHTML} from '../native-launch.mjs';
import {selection} from '../native-preview.mjs';
test('native view preserves device CSS size and uses original skins', {timeout:90000}, async()=>{
 process.env.SCREENHOP_NATIVE_PROFILES=await mkdtemp('/tmp/sh-native-profiles-');
 const cookieRequests=[];
 const http=createServer((req,res)=>{if(req.url==='/')cookieRequests.push(req.headers.cookie||'');res.setHeader('Set-Cookie','screenhop_fixture=persisted; Max-Age=3600; Path=/');res.setHeader('content-type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Native ScreenHop fixture</title><style>body{margin:0;background:#123;color:white;font:24px sans-serif}section{height:2400px;background:linear-gradient(#123,#386)}</style><section><h1>Native preview test</h1><input placeholder="Type here"><button onclick="this.textContent=\'Clicked\'">Click</button></section>');});
 await new Promise(r=>http.listen(0,'127.0.0.1',r));
 const open=[];
 try{
  for(const req of [{device:'iphone-se'},{device:'custom',width:1920,height:1080,dpr:1}]){
   const device=selection({...req,url:'http://127.0.0.1:'+http.address().port});
   const template=await readFile(new URL('../viewer.html',import.meta.url),'utf8');
   const html=skinHTML(template,device);assert.ok(html.includes('skin-iphone-classic'));assert.ok(!html.includes('new RTCPeerConnection'));
   const result=await launchNative(device);open.push(result.socket);
   await new Promise(r=>setTimeout(r,1200));
   const info=await command(result.socket,'inspect');
   assert.equal(info.viewport.width,device.width);assert.equal(info.viewport.height,device.height);
   assert.equal(info.viewport.dpr,device.dpr);
   assert.equal(info.viewport.touchPoints,device.mobile?5:0);
   assert.equal(info.viewport.coarse,device.mobile);
   if(device.mobile)assert.equal(info.viewport.clientWidth,device.width);
   assert.ok(info.scale>0&&info.scale<=1);
   console.log(JSON.stringify({device:device.id,...info}));
   await command(result.socket,'page-screenshot',{path:'/tmp/screenhop-native-'+device.id+'.png'});
   await new Promise(r=>setTimeout(r,700));
   assert.ok((await stat('/tmp/screenhop-native-'+device.id+'.png')).size>1000);
  }
  await command(open.shift(),'close');await new Promise(r=>setTimeout(r,600));
  const before=cookieRequests.length;
  const reopened=await launchNative(selection({device:'iphone-se',url:'http://127.0.0.1:'+http.address().port}));open.push(reopened.socket);
  await new Promise(r=>setTimeout(r,1000));
  assert.ok(cookieRequests.slice(before).some(value=>value.includes('screenhop_fixture=persisted')),'session cookie survives native process restart');
 }finally{for(const socket of open)await command(socket,'close').catch(()=>{});await new Promise(r=>http.close(r));}
});
