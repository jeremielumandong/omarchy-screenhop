import {tls,fetch,configPath} from './helpers/phone-tls.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {request} from 'node:https';
import {generateKeyPairSync,X509Certificate} from 'node:crypto';
import WebSocket from '../third_party/ws/wrapper.mjs';
import {once} from 'node:events';
import {connect as connectTLS} from 'node:tls';
import {PreviewHost} from '../preview-host.mjs';
import {PhoneRemote,loadPhoneTLS} from '../phone-remote.mjs';

async function fixture(t){
  const calls=[];
  const record={id:'abc123',device:{name:'<script>alert(1)</script>',width:390,height:844},url:'https://example.test',linked:false,streams:new Set(),frame:'test-frame'};
  const host={token:'DESKTOP-SECRET',template:'<script>const config=__SCREENHOP_CONFIG__;</script>',records:new Map([[record.id,record]]),input:async(id,data)=>calls.push({id,data}),action:async(id,data)=>calls.push({id,data})};
  host.subscribe=PreviewHost.prototype.subscribe;
  const remote=await PhoneRemote.create({tls,host,port:0});
  t.after(()=>remote.close());
  const url=remote.info().url;
  const post=(path,data,headers={})=>fetch(url+'view/abc123/'+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
  return {remote,url,record,calls,post};
}

test('pairing is token gated, escapes names, and never exposes desktop token',async t=>{
  const {remote,url}=await fixture(t);
  assert.equal(remote.token.length,64);
  assert.equal((await fetch(url.replace(remote.token,'wrong'))).status,404);
  const list=await (await fetch(url)).text();
  assert.match(list,/&lt;script&gt;/);assert.doesNotMatch(list,/<script>/);assert.doesNotMatch(list,/DESKTOP-SECRET|https:\/\/example/);
  const viewer=await (await fetch(url+'view/abc123')).text();
  assert.match(viewer,/"phone":true/);assert.match(viewer,new RegExp(remote.token));assert.doesNotMatch(viewer,/DESKTOP-SECRET/);
});
test('remote delegates validated input and link action and rejects arbitrary commands',async t=>{
  const {post,calls,url}=await fixture(t);
  assert.equal((await post('action',{action:'link',enabled:true},{Origin:new URL(url).origin})).status,200);
  assert.equal((await post('input',{kind:'text',text:'hello'})).status,200);
  assert.deepEqual(calls,[{id:'abc123',data:{action:'link',enabled:true}},{id:'abc123',data:{kind:'text',text:'hello'}}]);
  for(const payload of [{action:'shell',command:'anything'},{action:'navigate',url:'file:///etc/passwd'},{action:'link',enabled:'yes'}])assert.equal((await post('action',payload)).status,400);
  assert.equal((await post('input',{kind:'execute',command:'anything'})).status,400);
  assert.equal(calls.length,2);
  assert.equal((await fetch(url+'view/missing/action',{method:'POST'})).status,404);
});
test('rejects cross origin requests and unexpected Host before invoking callbacks',async t=>{
  const {post,calls,url}=await fixture(t);
  assert.equal((await post('action',{action:'reload'},{Origin:'https://evil.test'})).status,403);
  const hostStatus=await new Promise((resolve,reject)=>{const req=request(url,{ca:tls.cert,servername:'localhost',headers:{Host:'evil.test'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});
  assert.equal(hostStatus,403);
  assert.equal((await post('action',{action:'reload'},{'Sec-Fetch-Site':'cross-site'})).status,403);
  assert.equal(calls.length,0);
});
test('frames stream and disable cleans subscriptions and revokes pairing',async t=>{
  const {remote,url,record}=await fixture(t);
  const response=await fetch(url+'view/abc123/events');
  const reader=response.body.getReader();
  let events='';while(!events.includes('event: frame'))events+=new TextDecoder().decode((await reader.read()).value);
  assert.match(events,/test-frame/);
  assert.equal(record.streams.size,1);
  await remote.close();
  assert.equal(record.streams.size,0);assert.equal(remote.info().enabled,false);assert.equal(remote.token,'');
  await assert.rejects(fetch(url));
});

test('pairing publishes only the explicitly configured certificate identity',async t=>{
  const remote=await PhoneRemote.create({tls,host:{records:new Map()},port:0});
  t.after(()=>remote.close());
  assert.deepEqual(remote.info().urls,[`https://127.0.0.1:${remote.port}/${remote.token}/`]);
  assert.match(remote.info().reason,/never bypass a certificate warning/);
});

test('configured port is used and an occupied port reports a useful error',async t=>{
  const reserved=createServer();
  await new Promise(resolve=>reserved.listen(0,'0.0.0.0',resolve));
  const port=reserved.address().port;
  await assert.rejects(PhoneRemote.create({tls,host:{records:new Map()},port}),new RegExp(`port ${port} is already in use`));
  await new Promise(resolve=>reserved.close(resolve));
  const remote=await PhoneRemote.create({tls,host:{records:new Map()},port});
  t.after(()=>remote.close());
  assert.equal(remote.info().port,port);
  assert.match(remote.info().reason,new RegExp(`TCP port ${port}`));
});

test('configuration fails closed before listening, and certificate identity/key/expiry are checked',async t=>{
  const configured=await loadPhoneTLS({configPath});
  assert.deepEqual(configured,tls);
  await assert.rejects(loadPhoneTLS({configPath:'/nonexistent/screenhop-test-tls.json'}),/requires trusted HTTPS/);
  const options={host:{records:new Map()},port:0};
  const previous=process.env.SCREENHOP_PHONE_TLS_CONFIG;
  process.env.SCREENHOP_PHONE_TLS_CONFIG='/nonexistent/screenhop-test-tls.json';
  try {await assert.rejects(PhoneRemote.create(options),/requires trusted HTTPS/);}
  finally {if(previous===undefined)delete process.env.SCREENHOP_PHONE_TLS_CONFIG;else process.env.SCREENHOP_PHONE_TLS_CONFIG=previous;}

  for(const hostname of ['evil.test','http://localhost','localhost/path','localhost:53318','localhost@evil.test'])
    await assert.rejects(PhoneRemote.create({...options,tls:{...tls,hostname}}),/hostname/);
  await assert.rejects(PhoneRemote.create({...options,tls:{...tls,cert:'not a certificate'}}),/certificate/);
  const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
  await assert.rejects(PhoneRemote.create({...options,tls:{...tls,key:privateKey.export({type:'pkcs8',format:'pem'})}}),/private key/);
  t.mock.method(Date,'now',()=>Date.parse(new X509Certificate(tls.cert).validTo)+1);
  await assert.rejects(PhoneRemote.create({...options,tls}),/current/);
  t.mock.restoreAll();
});

test('plaintext HTTP/WS cannot replay a valid credential; HTTPS requires trusted identity',async t=>{
  const {remote,url,calls}=await fixture(t);
  await assert.rejects(globalThis.fetch(url),'an untrusted test certificate must be rejected');
  await assert.rejects(globalThis.fetch(url.replace('https:','http:')+'view/abc123/action',{
    method:'POST',headers:{'Content-Type':'application/json'},body:'{"action":"reload"}',signal:AbortSignal.timeout(3000)
  }));
  const insecure=new WebSocket(url.replace('https:','ws:')+'view/abc123/events-ws?clientId=phone1234',{origin:new URL(url).origin});
  await once(insecure,'error');
  assert.equal(calls.length,0);assert.equal(remote.streams.size,0);
  assert.equal((await fetch(url)).status,200);
  const policy=(await fetch(url)).headers.get('content-security-policy');
  assert.match(policy,/wss:\/\//);assert.doesNotMatch(policy,/(?:^|\s)ws:\/\//);
});

test('turning sharing off and on rotates the credential and rejects replay on the same port',async t=>{
  const {remote,url}=await fixture(t);
  const oldToken=remote.token,port=remote.port,host=remote.host;
  await remote.close();
  const next=await PhoneRemote.create({tls,host,port});t.after(()=>next.close());
  assert.notEqual(next.token,oldToken);
  assert.equal((await fetch(url)).status,404);
  assert.equal((await fetch(next.info().url)).status,200);
});

test('TLS protocol floor rejects legacy clients while TLS 1.2 and 1.3 validate the server',async t=>{
  const {remote}=await fixture(t);
  for(const version of ['TLSv1.2','TLSv1.3']){
    const socket=connectTLS({host:'127.0.0.1',port:remote.port,ca:tls.cert,minVersion:version,maxVersion:version});
    await once(socket,'secureConnect');assert.equal(socket.authorized,true);assert.equal(socket.getProtocol(),version);socket.destroy();
  }
  const legacy=connectTLS({host:'127.0.0.1',port:remote.port,ca:tls.cert,minVersion:'TLSv1.1',maxVersion:'TLSv1.1'});
  await once(legacy,'error');legacy.destroy();
});
