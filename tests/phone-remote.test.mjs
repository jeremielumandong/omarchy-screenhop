import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {PhoneRemote} from '../phone-remote.mjs';

async function fixture(t){
  const calls=[];
  const record={id:'abc123',device:{name:'<script>alert(1)</script>',width:390,height:844},url:'https://example.test',linked:false,streams:new Set(),frame:'test-frame'};
  const host={token:'DESKTOP-SECRET',template:'<script>const config=__SCREENHOP_CONFIG__;</script>',records:new Map([[record.id,record]]),input:async(id,data)=>calls.push({id,data}),action:async(id,data)=>calls.push({id,data})};
  const remote=await PhoneRemote.create({host,networkInterfaces:()=>({lo:[{family:'IPv4',address:'127.0.0.1',internal:true}]})});
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
  const hostStatus=await new Promise((resolve,reject)=>{const req=request(url,{headers:{Host:'evil.test'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});
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

 test('pairing prioritizes Wi-Fi then Ethernet ahead of virtual interfaces',async t=>{
  const ip=address=>[{address,family:'IPv4',internal:false}];
  const remote=await PhoneRemote.create({host:{records:new Map()},networkInterfaces:()=>({docker0:ip('172.17.0.1'),wg0:ip('10.10.0.1'),eth0:ip('192.168.1.4'),wlp2s0:ip('192.168.1.5')})});
  t.after(()=>remote.close());
  assert.deepEqual(remote.info().urls.map(value=>new URL(value).hostname),['192.168.1.5','192.168.1.4','172.17.0.1','10.10.0.1']);
  assert.equal(new URL(remote.info().url).hostname,'192.168.1.5');
});
