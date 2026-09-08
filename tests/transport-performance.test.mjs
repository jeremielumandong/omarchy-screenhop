import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PreviewHost,sendStream,rtcMessage} from '../preview-host.mjs';
class Stream extends EventEmitter {
  writableLength=0;writableNeedDrain=false;writes=[];
  write(data){this.writes.push(data);return !this.writableNeedDrain;}
  end(){this.writableEnded=true;this.emit('close');}
  destroy(){this.destroyed=true;this.emit('close');}
}
test('slow subscribers retain newest frame and deliver control before it',()=>{
 const stream=new Stream();stream.writableNeedDrain=true;
 sendStream(stream,'frame','old');sendStream(stream,'frame','new');
 sendStream(stream,'state','linked');sendStream(stream,'signal','answer');
 assert.deepEqual(stream.writes,['linked','answer']);
 stream.writableNeedDrain=false;stream.emit('drain');
 assert.deepEqual(stream.writes,['linked','answer','new']);
 assert.equal(stream.pendingFrame,null);
});
test('subscribers receive only requested JPEG and their own signaling; disconnect closes peers',async()=>{
 const calls=[];const host=new PreviewHost({signal:async(id,msg)=>calls.push(msg)});
 host.origin='http://localhost';host.register('abcdef','session',{url:'https://example.test'},false);
 const record=host.records.get('abcdef'),a=new Stream(),b=new Stream();
 host.subscribe(record,a,'client_aaa');host.subscribe(record,b,'client_bbb');
 await host.receiveSignal(record,{clientId:'client_aaa',peerId:'peer_aaa',type:'fallback'});
 await host.receiveSignal(record,{clientId:'client_bbb',peerId:'peer_bbb',type:'offer'});
 host.frame('session','jpeg');
 assert.equal(a.writes.some(x=>x.includes('event: frame')),true);
 assert.equal(b.writes.some(x=>x.includes('event: frame')),false);
 host.rtcSignal('abcdef',{peerId:'peer_bbb',type:'answer',sdp:'v=0\r\n'});
 assert.equal(a.writes.some(x=>x.includes('event: signal')),false);
 assert.equal(b.writes.some(x=>x.includes('event: signal')),true);
 await host.receiveSignal(record,{clientId:'client_aaa',peerId:'peer_aaa',type:'ready'});
 const n=a.writes.length;host.frame('session','next');assert.equal(a.writes.length,n);
 a.destroy();b.destroy();await Promise.resolve();
 assert.equal(calls.filter(x=>x.type==='close').length,2);
});
test('reconnect inherits peers without closing their transports',async()=>{
 const calls=[];const host=new PreviewHost({signal:async(id,msg)=>calls.push(msg)});host.origin='http://localhost';host.register('abcdef','session',{},false);
 const record=host.records.get('abcdef'),a=new Stream(),b=new Stream();host.subscribe(record,a,'client_aaa');
 await host.receiveSignal(record,{clientId:'client_aaa',peerId:'peer_aaa',type:'fallback'});
 host.subscribe(record,b,'client_aaa');assert.equal(b.transport,'jpeg');assert.equal(b.peers.has('peer_aaa'),true);
 assert.equal(calls.some(x=>x.type==='close'),false);b.destroy();
});
test('activity validates bounded cadence and viewer identity',()=>{
 const msg={type:'activity',peerId:'peer_aaa',clientId:'client_aaa',fps:10,visible:true,active:false};
 assert.deepEqual(rtcMessage(msg),msg);
 for(const bad of [{fps:0},{fps:31},{fps:1.5},{visible:'yes'},{clientId:'../bad'}])assert.throws(()=>rtcMessage({...msg,...bad}));
});
test('replacement RTC ready releases only its client fallback demand, then last disconnect stops JPEG',async()=>{
 const demand=new Set();let jpeg=false;
 const host=new PreviewHost({signal:async(id,msg)=>{
   if(msg.type==='fallback')demand.add(msg.peerId);
   if(msg.type==='ready'||msg.type==='close')demand.delete(msg.peerId);
   jpeg=demand.size>0;
 }});
 host.origin='http://localhost';host.register('abcdef','session',{},false);
 const record=host.records.get('abcdef'),a=new Stream(),b=new Stream();
 host.subscribe(record,a,'client_aaa');host.subscribe(record,b,'client_bbb');
 await host.receiveSignal(record,{clientId:'client_aaa',peerId:'old_peer_a',type:'fallback'});
 host.frame('session','static-cached-frame');
 await host.receiveSignal(record,{clientId:'client_bbb',peerId:'old_peer_b',type:'fallback'});
 assert.ok(b.writes.some(value=>value.includes('static-cached-frame')),'new fallback receiver gets existing static frame without waiting for repaint');
 await host.receiveSignal(record,{clientId:'client_aaa',peerId:'new_peer_a',type:'offer'});
 assert.equal(demand.size,2,'JPEG remains through replacement negotiation');
 await host.receiveSignal(record,{clientId:'client_aaa',peerId:'new_peer_a',type:'ready'});
 assert.deepEqual([...demand],['old_peer_b']);assert.equal(jpeg,true);
 assert.deepEqual([...a.peers],['new_peer_a']);
 b.destroy();await Promise.resolve();assert.equal(jpeg,false);a.destroy();
});
