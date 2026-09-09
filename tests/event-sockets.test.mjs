import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import WebSocket from '../third_party/ws/wrapper.mjs';
import {PreviewHost} from '../preview-host.mjs';
const address=(base,id='viewer123')=>base.replace(/^http/,'ws')+'/events-ws?clientId='+id;
async function connect(base,id='viewer123'){
 const ws=new WebSocket(address(base,id),{origin:new URL(base).origin});
 const state=once(ws,'message');await once(ws,'open');const [data,binary]=await state;assert.equal(binary,false);assert.match(data.toString(),/event: state/);return ws;
}
async function denied(url,origin){
 const ws=new WebSocket(url,{...(origin?{origin}:{})});const [error]=await once(ws,'error');assert.match(error.message,/403/);
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
test('ordinary browser disconnect releases its subscription and RTC peers',async t=>{
 const signals=[];
 const host=await PreviewHost.create({input:async()=>{},action:async()=>{},signal:async(id,m)=>signals.push(m)});
 const base=host.register('abcdef','sid',{name:'test',width:200,height:300},false);t.after(()=>host.shutdown());
 const ws=await connect(base);const record=host.records.get('abcdef');
 await host.receiveSignal(record,{type:'offer',peerId:'peer1234',clientId:'viewer123',sdp:'v=0'});
 const stream=[...record.streams][0],closed=once(stream,'close');ws.close();await closed;
 assert.equal(record.streams.size,0);assert.ok(signals.some(m=>m.type==='close'&&m.peerId==='peer1234'));
});
