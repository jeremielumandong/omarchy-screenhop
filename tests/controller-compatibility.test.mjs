import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {createServer} from 'node:net';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile),base=new URL('..',import.meta.url).pathname;
test('protocol 8 supports ordinary launches but cannot perform native migration',async()=>{
 const state=await mkdtemp('/tmp/screenhop-protocol-');const requests=[];
 const server=createServer(s=>{let data='';s.on('data',chunk=>{data+=chunk;if(!data.includes('\n'))return;const r=JSON.parse(data.split('\n')[0]);requests.push(r);s.end(JSON.stringify(r.ping?{protocol:8}:r.status?{status:'state',protocol:8,enabled:false,previewCount:1}:{status:'ready',targetId:'existing-controller'})+'\n');});});
 await new Promise(r=>server.listen(state+'/controller.sock',r));
 try{
  const run=args=>exec(process.execPath,[base+'viewport.mjs','--state',state,...args]);
  assert.equal(JSON.parse((await run(['--status'])).stdout).protocol,8);
  assert.equal(JSON.parse((await run(['--device','iphone-se','--url','https://example.com'])).stdout).status,'ready');
  await assert.rejects(exec(process.execPath,[base+'native-switch.mjs','--apply-link'],{env:{...process.env,SCREENHOP_NATIVE_RUNTIME:state+'/native',SCREENHOP_WEBRTC_STATE:state}}),e=>e.stderr.includes('first close the older WebRTC previews'));
  assert.equal(requests.filter(r=>r.device).length,1,'migration creates no replacement in the old controller');
 }finally{await new Promise(r=>server.close(r));}
});
