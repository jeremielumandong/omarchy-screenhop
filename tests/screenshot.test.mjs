import {tls,fetch} from './helpers/phone-tls.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {createServer} from 'node:http';
import {promisify} from 'node:util';
import {CDP} from '../viewport.mjs';
import {PreviewHost} from '../preview-host.mjs';
import {PhoneRemote} from '../phone-remote.mjs';
const exec=promisify(execFile),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const post=(url,payload,headers={})=>fetch(url+'/action',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(payload)});

test('screenshot routes require token/origin and explicit boolean skin before callback',async t=>{
  const calls=[],capture={mimeType:'image/png',data:'test',filename:'test.png'};
  const host=await PreviewHost.create({action:async(id,data)=>{calls.push(data);return capture;},input:async()=>{}});
  const desktop=host.register('abcdef','sid',{name:'Test',width:390,height:844},false);
  const phone=await PhoneRemote.create({tls,host,port:0});
  t.after(async()=>{await phone.close();host.shutdown();});
  const remote=phone.info().url+'view/abcdef';
  for(const url of [desktop,remote]){
    assert.deepEqual(await(await post(url,{action:'screenshot',skin:true})).json(),capture);
    assert.equal((await post(url,{action:'screenshot',skin:'true'})).status,400);
    assert.ok((await post(url,{action:'screenshot',skin:false},{Origin:'https://invalid.test'})).status>=400);
    assert.equal((await fetch(url+'/capture-ui.js')).status,200);
  }
  assert.equal((await post(desktop.replace(host.token,'wrong'),{action:'screenshot',skin:true})).status,404);
  assert.equal((await fetch(remote.replace(phone.token,'wrong')+'/capture-ui.js')).status,404);
  assert.equal(calls.length,2);
});

test('page PNG uses device DPR and skin PNG captures frame only, restoring Frame toggle', {timeout:60000},async()=>{
  const state=await mkdtemp('/tmp/screenhop-screenshot-test-');
  const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#ed4422;color:white}main{height:120vh;background:linear-gradient(#ed4422,#2233ee)}</style><main><h1>Screenshot fixture</h1></main>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const run=async(...args)=>JSON.parse((await exec(process.execPath,[new URL('../viewport.mjs',import.meta.url).pathname,'--state',state,...args],{env:{...process.env,SCREENHOP_TRANSPORT:'jpeg'},timeout:30000})).stdout);
  let viewer;
  try{
    const preview=await run('--headless','--device','iphone-13','--url','http://127.0.0.1:'+server.address().port);
    const[port,path]=(await readFile(state+'/viewer-browser/DevToolsActivePort','utf8')).trim().split('\n');viewer=await CDP.connect('ws://127.0.0.1:'+port+path);
    const{sessionId}=await viewer.send('Target.attachToTarget',{targetId:preview.viewerTargetId,flatten:true});
    const evaluate=async expression=>(await viewer.send('Runtime.evaluate',{expression,returnByValue:true},sessionId)).result.value;
    for(let attempt=0;attempt<60;attempt++){if(await evaluate('document.querySelector("#display")?.naturalWidth > 0'))break;await sleep(100);}
    assert.ok(await evaluate('document.querySelector("#display").naturalWidth > 0'));
    const page=await(await post(preview.viewerUrl,{action:'screenshot',skin:false})).json();
    assert.equal(page.mimeType,'image/png');assert.match(page.filename,/page-.*\.png$/);
    const png=Buffer.from(page.data,'base64');assert.equal(png.readUInt32BE(16),1170);assert.equal(png.readUInt32BE(20),2532);assert.equal(page.width,1170);assert.equal(page.height,2532);
    const before=await evaluate('(()=>{const r=(document.getElementById("capture-region")||document.getElementById("fit-box")).getBoundingClientRect();return{width:r.width,height:r.height,dpr:devicePixelRatio,windowWidth:innerWidth,windowHeight:innerHeight}})()');
    await evaluate('document.getElementById("frame").click()');assert.equal(await evaluate('document.getElementById("device").classList.contains("bare")'),true);
    const skin=await(await post(preview.viewerUrl,{action:'screenshot',skin:true})).json();
    assert.equal(skin.mimeType,'image/png');assert.match(skin.filename,/device-.*\.png$/);
    assert.ok(Math.abs(skin.width-before.width*before.dpr)<=2);assert.ok(Math.abs(skin.height-before.height*before.dpr)<=2);
    assert.ok(skin.width<before.windowWidth*before.dpr&&skin.height<before.windowHeight*before.dpr,'crop excludes surrounding toolbar and window');
    assert.equal(await evaluate('document.getElementById("device").classList.contains("bare")'),true,'temporary frame capture restores Frame off');
  }finally{viewer?.ws.close();await run('--close').catch(()=>{});await new Promise(resolve=>server.close(resolve));}
});
