import {tls,fetch} from './helpers/phone-tls.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {PreviewHost,rtcMessage} from '../preview-host.mjs';
import {PhoneRemote} from '../phone-remote.mjs';

const offer={peerId:'abc123de',type:'offer',sdp:'v=0\r\n'};
async function fixture(t){
  const signals=[];
  const host=await PreviewHost.create({input:async()=>{},action:async()=>{},signal:async(id,message)=>signals.push({id,message})});
  const url=host.register('abcdef','session',{name:'Test',width:390,height:844,url:'https://example.test'},false);
  const remote=await PhoneRemote.create({tls,host,port:0});
  t.after(async()=>{await remote.close();host.shutdown();});
  const phone=remote.info().url+'view/abcdef';
  const post=(base,data,headers={})=>fetch(base+'/signal',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
  return {host,remote,url,phone,signals,post};
}
test('signal schema accepts only bounded receiver commands and sender responses',()=>{
  assert.deepEqual(rtcMessage({...offer,command:'anything'}),offer);
  for(const data of [{...offer,type:'answer'},{...offer,peerId:'bad/path'},{...offer,sdp:'x'.repeat(100001)},{...offer,type:'execute'},{peerId:offer.peerId,type:'candidate',candidate:{candidate:'x',sdpMLineIndex:-1}}])assert.throws(()=>rtcMessage(data));
  assert.deepEqual(rtcMessage({peerId:offer.peerId,type:'candidate',candidate:null}),{peerId:offer.peerId,type:'candidate',candidate:null});
  assert.deepEqual(rtcMessage({peerId:'*',type:'reset'},{response:true}),{peerId:'*',type:'reset'});
  assert.throws(()=>rtcMessage({peerId:'*',type:'reset'}));
  assert.deepEqual(rtcMessage({peerId:offer.peerId,type:'fallback'}),{peerId:offer.peerId,type:'fallback'});
});
test('desktop and phone signaling are authenticated, validated, and delegated',async t=>{
  const {url,phone,post,signals,host}=await fixture(t);
  assert.match(await (await fetch(url)).text(),/"transport":"webrtc"/);
  assert.match(await (await fetch(phone)).text(),/"transport":"webrtc"/);
  assert.equal((await post(url,offer)).status,200);
  assert.equal((await post(phone,{...offer,peerId:'phone123'})).status,200);
  assert.equal(signals.length,2);
  assert.equal((await post(phone,{...offer,type:'answer'})).status,400);
  assert.equal((await post(phone,{...offer,peerId:'unknown1',type:'close'})).status,400);
  assert.equal((await post(phone,offer,{Origin:'https://evil.test'})).status,403);
  assert.equal((await post(url,offer,{Origin:'https://evil.test'})).status,400);
  assert.equal((await post(url.replace(host.token,'wrong'),offer)).status,404);
  assert.equal(signals.length,2);
});
test('source signals travel over SSE; stopping phone sharing closes only phone peers',async t=>{
  const {url,phone,post,signals,host,remote}=await fixture(t);
  const controller=new AbortController();
  t.after(()=>controller.abort());
  const response=await fetch(phone+'/events',{signal:controller.signal});
  const reader=response.body.getReader();await reader.read();
  const answer={peerId:'phone123',type:'answer',sdp:'v=0\r\n'};
  host.rtcSignal('abcdef',answer);
  assert.match(new TextDecoder().decode((await reader.read()).value),/event: signal/);
  await post(url,offer);await post(phone,{...offer,peerId:'phone123'});
  await remote.close();
  assert.ok(signals.some(({message})=>message.peerId==='phone123'&&message.type==='close'));
  assert.equal(signals.some(({message})=>message.peerId===offer.peerId&&message.type==='close'),false);
  assert.equal(remote.peers.size,0);
});
test('fallback can register without WebRTC offer and receives revoke; malformed requests never register',async t=>{
  const {phone,post,remote,signals}=await fixture(t);
  assert.equal((await post(phone,{peerId:'fallback1',type:'fallback'})).status,200);
  assert.equal((await post(phone,{peerId:'bad',type:'offer'})).status,400);
  assert.equal(remote.peers.size,1);
  await remote.close();
  assert.ok(signals.some(({message})=>message.peerId==='fallback1'&&message.type==='close'));
});
