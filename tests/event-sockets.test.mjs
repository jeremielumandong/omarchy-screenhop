import {tls,fetch} from './helpers/phone-tls.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import WebSocket from '../third_party/ws/wrapper.mjs';
import {PreviewHost} from '../preview-host.mjs';
import {PhoneRemote} from '../phone-remote.mjs';
const address=(base,id='viewer123')=>base.replace(/^http/,'ws')+'/events-ws?clientId='+id;
async function connect(base,id='viewer123'){
 const ws=new WebSocket(address(base,id),{origin:new URL(base).origin,ca:tls.cert});
 const state=once(ws,'message');await once(ws,'open');const [data,binary]=await state;assert.equal(binary,false);assert.match(data.toString(),/event: state/);return ws;
}
async function denied(url,origin){
 const ws=new WebSocket(url,{...(origin?{origin}:{}),ca:tls.cert});const [error]=await once(ws,'error');assert.match(error.message,/403/);
}
test('event WebSockets enforce token, origin, viewer identity, and server-only messages',async t=>{
 const host=await PreviewHost.create({input:async()=>{},action:async()=>{}});
 const base=host.register('abcdef','sid',{name:'test',width:200,height:300},false);
 t.after(()=>host.shutdown());
 const ws=await connect(base);t.after(()=>ws.terminate());
 await denied(address(base.replace(host.token,'invalid')),host.origin);
 await denied(address(base),'https://untrusted.test');await denied(address(base));
 await denied(address(base,'bad'),host.origin);
 const state=once(ws,'message');host.update('abcdef',{linked:true});assert.match((await state)[0].toString(),/"linked":true/);
 const closed=once(ws,'close');ws.send('{"action":"reload"}');assert.equal((await closed)[0],1008);
});
test('phone event sockets use pairing/Host/origin checks and revoke without closing desktop',async t=>{
 const host=await PreviewHost.create({input:async()=>{},action:async()=>{}});
 const desktop=host.register('abcdef','sid',{name:'test',width:200,height:300},false);
 const phone=await PhoneRemote.create({tls,host,port:0});
 t.after(async()=>{await phone.close();host.shutdown();});
 const remote=phone.info().url+'view/abcdef';const a=await connect(desktop,'desktop123'),b=await connect(remote,'phone1234');t.after(()=>{a.terminate();b.terminate();});
 assert.equal(phone.info().connectedViewers,1);
 await denied(address(remote.replace(phone.token,'invalid')),new URL(remote).origin);
 await denied(address(remote),'https://untrusted.test');
 await denied(address(remote),new URL(remote).origin.replace('https:','http:'));
 const closed=once(b,'close');await phone.close();await closed;
 const state=once(a,'message');host.update('abcdef',{linked:true});assert.match((await state)[0].toString(),/"linked":true/);
});

test('ordinary browser disconnect releases its subscription and RTC peers',async t=>{
 const signals=[];
 const host=await PreviewHost.create({input:async()=>{},action:async()=>{},signal:async(id,m)=>signals.push(m)});
 const base=host.register('abcdef','sid',{name:'test',width:200,height:300},false);t.after(()=>host.shutdown());
 const ws=await connect(base);const record=host.records.get('abcdef');
 await host.receiveSignal(record,{type:'offer',peerId:'peer1234',clientId:'viewer123',sdp:'v=0'});
 const stream=[...record.streams][0],closed=once(stream,'close');ws.close();await closed;
 assert.equal(record.streams.size,0);assert.ok(signals.some(m=>m.type==='close'&&m.peerId==='peer1234'));
});
