import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createServer} from 'node:http';
import {selection} from '../native-preview.mjs';
import {rpc} from '../viewport.mjs';
const exec=promisify(execFile),folder=new URL('..',import.meta.url).pathname;
test('switch native previews to WebRTC with matching device dimensions', {timeout:120000},async()=>{
 const native=await mkdtemp('/tmp/sh-native-switch-'),state=await mkdtemp('/tmp/sh-webrtc-switch-');
 process.env.SCREENHOP_NATIVE_PROFILES=native+'/profiles';process.env.SCREENHOP_NATIVE_RUNTIME=native;process.env.SCREENHOP_WEBRTC_STATE=state;
 const {launchNative,instances,command}=await import('../native-launch.mjs');
 let redirect=false;
 const server=createServer((req,res)=>{if(redirect&&req.url!=='/login'){res.writeHead(302,{Location:'/login'});res.end();return;}res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><h1>Renderer switch test</h1>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url='http://127.0.0.1:'+server.address().port;
 try{
  await launchNative(selection({device:'iphone-se',url}));
  await launchNative(selection({device:'custom',width:768,height:900,dpr:1,url}));
  const result=await exec(process.execPath,[folder+'native-switch.mjs','--apply-link'],{timeout:90000});
  assert.equal(JSON.parse(result.stdout).enabled,true);
  await new Promise(r=>setTimeout(r,500));assert.equal((await instances()).length,0);
  const snapshot=await rpc(state+'/controller.sock',{snapshot:true});
  assert.equal(snapshot.previews.length,2);
  assert.deepEqual(snapshot.previews.map(p=>[p.width,p.height]).sort((a,b)=>a[0]-b[0]),[[375,667],[768,900]]);
  for(const p of snapshot.previews){const info=await rpc(state+'/controller.sock',{inspect:true,targetId:p.targetId});assert.equal(info.width,p.width);assert.equal(info.height,p.height);}
  const routed=JSON.parse((await exec(process.execPath,[folder+'independent-browser.mjs','--device','iphone-se','--url',url],{timeout:60000})).stdout);
  assert.ok(routed.targetId,'stale independent launch routes to linked WebRTC');
  assert.equal((await instances()).length,0);
  await exec(process.execPath,[folder+'viewport.mjs','--state',state,'--link','off']);
  await launchNative(selection({device:'iphone-se',url}));
  redirect=true;
  for(let attempt=0;attempt<2;attempt++){
   await assert.rejects(exec(process.execPath,[folder+'native-switch.mjs','--apply-link'],{timeout:90000}));
   await new Promise(r=>setTimeout(r,500));
   assert.equal((await instances()).length,1,'original remains open');
   assert.equal((await rpc(state+'/controller.sock',{snapshot:true})).previews.length,3,'failed switch removes only new replacements');
  }
 }finally{
  for(const p of await instances())await command(p.socket,'close');
  await exec(process.execPath,[folder+'viewport.mjs','--state',state,'--close']).catch(()=>{});
  await new Promise(r=>server.close(r));
 }
});
