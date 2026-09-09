import test from 'node:test';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {PreviewHost,rtcMessage} from '../preview-host.mjs';

const offer={peerId:'abc123de',type:'offer',sdp:'v=0\r\n'};
async function fixture(t){
  const signals=[];
  const host=await PreviewHost.create({input:async()=>{},action:async()=>{},signal:async(id,message)=>signals.push({id,message})});
  const url=host.register('abcdef','session',{name:'Test',width:390,height:844,url:'https://example.test'},false);
  t.after(()=>host.shutdown());
  const post=(base,data,headers={})=>fetch(base+'/signal',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
  return {host,url,signals,post};
}
test('signal schema accepts only bounded receiver commands and sender responses',()=>{
  assert.deepEqual(rtcMessage({...offer,command:'anything'}),offer);
  for(const data of [{...offer,type:'answer'},{...offer,peerId:'bad/path'},{...offer,sdp:'x'.repeat(100001)},{...offer,type:'execute'},{peerId:offer.peerId,type:'candidate',candidate:{candidate:'x',sdpMLineIndex:-1}}])assert.throws(()=>rtcMessage(data));
  assert.deepEqual(rtcMessage({peerId:offer.peerId,type:'candidate',candidate:null}),{peerId:offer.peerId,type:'candidate',candidate:null});
  assert.deepEqual(rtcMessage({peerId:'*',type:'reset'},{response:true}),{peerId:'*',type:'reset'});
  assert.throws(()=>rtcMessage({peerId:'*',type:'reset'}));
  assert.deepEqual(rtcMessage({peerId:offer.peerId,type:'fallback'}),{peerId:offer.peerId,type:'fallback'});
});
test('desktop signaling is authenticated, validated, and delegated',async t=>{
  const {url,post,signals,host}=await fixture(t);
  assert.match(await (await fetch(url)).text(),/"transport":"webrtc"/);
  assert.equal((await post(url,offer)).status,200);
  assert.equal(signals.length,1);
  assert.equal((await post(url,{...offer,type:'answer'})).status,400);
  assert.equal((await post(url,offer,{Origin:'https://evil.test'})).status,400);
  assert.equal((await post(url.replace(host.token,'wrong'),offer)).status,404);
  assert.equal(signals.length,1);
});
test('source signals travel over SSE and closing the viewer releases its peer',async t=>{
  const {url,post,signals,host}=await fixture(t);
  const controller=new AbortController();t.after(()=>controller.abort());
  const response=await fetch(url+'/events?clientId=viewer123',{signal:controller.signal});
  const reader=response.body.getReader();await reader.read();
  await post(url,{...offer,clientId:'viewer123'});
  const answer={peerId:offer.peerId,type:'answer',sdp:'v=0\r\n'};
  host.rtcSignal('abcdef',answer);
  assert.match(new TextDecoder().decode((await reader.read()).value),/event: signal/);
  const record=host.records.get('abcdef');
  const closed=once([...record.streams][0],'close');
  host.remove('abcdef');await closed;
  assert.equal(record.streams.size,0);
  assert.ok(signals.some(({message})=>message.peerId===offer.peerId&&message.type==='close'));
});
