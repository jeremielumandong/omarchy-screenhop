import {attachEventSockets} from './event-sockets.mjs';
import {serveSkinAsset} from './skin-assets.mjs';
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';

// The viewer stays outside the tested document: device chrome never changes its layout.
export class PreviewHost {
  constructor({input,action,close,signal}) {
    this.records = new Map(); this.token = randomBytes(24).toString('hex');
    this.input=input; this.action=action; this.closePreview=close; this.signal=signal;
  }
  static async create(callbacks) {
    const host = new PreviewHost(callbacks);
    host.template=await readFile(new URL('./viewer.html',import.meta.url),'utf8');
    host.server=createServer((req,res)=>host.handle(req,res).catch(error=> {
      if (!res.headersSent) res.writeHead(400,{'Content-Type':'application/json'});
      res.end(JSON.stringify({error:error.message}));
    }));
    await new Promise((resolve,reject)=>{host.server.once('error',reject);host.server.listen(0,'127.0.0.1',resolve)});
    host.origin='http://127.0.0.1:'+host.server.address().port;
    host.closeEventSockets=attachEventSockets(host.server,req=>{
      if(req.headers.host!==new URL(host.origin).host||req.headers.origin!==host.origin)throw Error('Invalid event origin');
      const url=new URL(req.url,host.origin),match=url.pathname.match(new RegExp('^/'+host.token+'/view/([A-Fa-f0-9]+)/events-ws$'));
      const record=match&&host.records.get(match[1]),clientId=url.searchParams.get('clientId')||'';
      if(!record||!/^[A-Za-z0-9_-]{8,80}$/.test(clientId))throw Error('Unknown viewer');
      return stream=>host.subscribe(record,stream,clientId);
    });
    return host;
  }
  register(id,sessionId,device,linked) {
    const base='/'+this.token+'/view/'+id;
    this.records.set(id,{id,sessionId,device,base,url:device.url,linked,streams:new Set(),frame:null});
    return this.origin+base;
  }
  update(id,values) {
    const record=this.records.get(id); if(!record)return;
    Object.assign(record,values); this.broadcast(record,'state',{url:record.url,linked:record.linked,reason:record.reason||''});
  }
  setLinked(linked,reason='') { for(const id of this.records.keys())this.update(id,{linked,reason}); }
  frame(sessionId,data) {
    const record=[...this.records.values()].find(r=>r.sessionId===sessionId);
    if(record){record.frame=data; this.broadcast(record,'frame',{data});}
  }
  rtcSignal(id,message) {
    const record=this.records.get(id);if(!record)return;
    this.broadcast(record,'signal',rtcMessage(message,{response:true}));
  }
  broadcast(record,event,value) {
    const serialized='event: '+event+'\ndata: '+JSON.stringify(value)+'\n\n';
    for(const stream of record.streams) {
      if(event==='frame'&&stream.clientId&&stream.transport!=='jpeg')continue;
      if(event==='signal'&&value.peerId!=='*'&&stream.clientId&&!stream.peers?.has(value.peerId))continue;
      sendStream(stream,event,serialized);
    }
  }
  subscribe(record,res,clientId='') {
    if(clientId&&!/^[A-Za-z0-9_-]{8,80}$/.test(clientId))throw new Error('Invalid viewer identity');
    res.clientId=clientId;res.peers=new Set();res.transport=this.signal?'connecting':'jpeg';
    // Replace a reconnecting event stream before its close callback runs.
    for(const stream of record.streams)if(clientId&&stream.clientId===clientId){res.peers=stream.peers;res.transport=stream.transport;stream.replaced=true;stream.end();}
    record.streams.add(res);
    sendStream(res,'state','event: state\ndata: '+JSON.stringify({url:record.url,linked:record.linked,reason:record.reason||''})+'\n\n');
    if(record.frame&&(!clientId||res.transport==='jpeg'))sendStream(res,'frame','event: frame\ndata: '+JSON.stringify({data:record.frame})+'\n\n');
    const heartbeat=setInterval(()=>{if(!res.writableNeedDrain)res.write(': keepalive\n\n');},10000);
    let cleaned=false;
    const cleanup=()=>{if(cleaned)return;cleaned=true;clearInterval(heartbeat);record.streams.delete(res);if(!res.replaced)for(const peerId of res.peers)Promise.resolve(this.signal?.(record.id,{peerId,type:'close',clientId})).catch(()=>{});};
    res.once('close',cleanup);return cleanup;
  }
  async receiveSignal(record,message) {
    const stream=message.clientId&&[...record.streams].find(s=>s.clientId===message.clientId);
    if(message.clientId&&!stream)throw new Error('Viewer disconnected; reconnect first');
    if(stream){
      if(message.type==='offer'||message.type==='fallback')stream.peers.add(message.peerId);
      else if(!stream.peers.has(message.peerId))throw new Error('Unknown viewer peer');
      if(message.type==='fallback')stream.transport='jpeg';
    }
    await this.signal(record.id,message);
    if(stream&&message.type==='fallback'&&record.frame)sendStream(stream,'frame','event: frame\ndata: '+JSON.stringify({data:record.frame})+'\n\n');
    if(stream&&(message.type==='ready'||message.type==='fallback')) {
      // A reconnect creates a new RTC peer while the old peer keeps JPEG alive.
      // Once the replacement is ready (or replaces a failed attempt), release
      // only this viewer's obsolete peers; other viewers may still need JPEG.
      for(const peerId of [...stream.peers])if(peerId!==message.peerId){
        await this.signal(record.id,{type:'close',peerId,clientId:message.clientId});
        stream.peers.delete(peerId);
      }
      if(message.type==='ready'){stream.transport='webrtc';stream.pendingFrame=null;}
    }
    if(message.type==='close')stream?.peers.delete(message.peerId);
  }
  remove(id) {
    const record=this.records.get(id); if(!record)return;
    for(const stream of record.streams)stream.end(); this.records.delete(id);
  }
  async handle(req,res) {
    res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',`default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self' ${this.origin.replace('http:','ws:')}; frame-ancestors 'none'`);
    const path=new URL(req.url,this.origin).pathname;
    const match=path.match(new RegExp('^/'+this.token+'/view/([A-Fa-f0-9]+)(/(events|input|action|signal|capture-ui\\.js|skin/[A-Za-z0-9_-]+/[A-Za-z0-9_.-]+))?$'));
    const record=match&&this.records.get(match[1]);
    if(!record){res.writeHead(404);res.end('Preview not found');return;}
    const route=match[3];
    if(req.method==='GET'&&route?.startsWith('skin/')){await serveSkinAsset(res,record.device.skinAsset,route);return;}
    if(req.method==='GET'&&!route) {
      const config={...record.device,id:record.id,base:record.base,url:record.url,linked:record.linked,reason:record.reason||'',transport:this.signal?'webrtc':'jpeg'};
      const json=JSON.stringify(config).replaceAll('<','\\u003c');
      res.setHeader('Content-Type','text/html; charset=utf-8');
      res.end(this.template.replace('__SCREENHOP_CONFIG__',json)); return;
    }
    if(req.method==='GET'&&route==='capture-ui.js') {
      res.setHeader('Content-Type','text/javascript; charset=utf-8');
      res.end(await readFile(new URL('./capture-ui.js',import.meta.url),'utf8'));return;
    }
    if(req.method==='GET'&&route==='events') {
      res.writeHead(200,{'Content-Type':'text/event-stream','Connection':'keep-alive'});
      this.subscribe(record,res,new URL(req.url,this.origin).searchParams.get('clientId')||''); return;
    }
    if(req.method!=='POST'||!['input','action','signal'].includes(route)){res.writeHead(405);res.end();return;}
    if(req.headers.host!==new URL(this.origin).host)throw new Error('Invalid host');
    if(req.headers.origin&&req.headers.origin!==this.origin)throw new Error('Invalid origin');
    if(!req.headers['content-type']?.startsWith('application/json'))throw new Error('JSON required');
    let body='',size=0; for await(const chunk of req){size+=chunk.length;if(size>(route==='signal'?120000:20000))throw new Error('Input too large');body+=chunk;}
    const payload=JSON.parse(body);let result;
    if(route==='signal'){
      if(!this.signal)throw new Error('Video signaling unavailable');
      await this.receiveSignal(record,rtcMessage(payload));
    }else if(route==='input')await this.input(record.id,payload);
    else result=await this.action(record.id,actionMessage(payload));
    const response=JSON.stringify(result===undefined?{ok:true}:result);
    if(response.length>100*1024*1024)throw new Error('Capture is too large');
    res.setHeader('Content-Type','application/json');res.end(response);
  }
  shutdown() {
    for(const id of this.records.keys())this.remove(id);
    this.closeEventSockets?.(); this.server.close(); this.server.closeAllConnections();
  }
}

export function inputCommand(data,width,height) {
  const number=(v,min,max)=>{if(typeof v!=='number'||!Number.isFinite(v))throw new Error('Invalid input coordinate');return Math.min(max,Math.max(min,v))};
  const modifiers=number(data.modifiers??0,0,15)|0;
  if(data.kind==='touch') {
    if(!['touchStart','touchMove','touchEnd','touchCancel'].includes(data.type))throw new Error('Invalid touch input');
    const touchPoints=['touchEnd','touchCancel'].includes(data.type)?[]:[{x:number(data.x,0,width),y:number(data.y,0,height),id:0,radiusX:1,radiusY:1,force:1}];
    return ['Input.dispatchTouchEvent',{type:data.type,touchPoints,modifiers}];
  }
  if(data.kind==='pointerleave')return ['Input.dispatchMouseEvent',{type:'mouseMoved',x:-1,y:-1,button:'none',buttons:0,modifiers:0}];
  if(data.kind==='mouse'||data.kind==='wheel') {
    const x=number(data.x,0,width),y=number(data.y,0,height);
    if(data.kind==='wheel')return ['Input.dispatchMouseEvent',{type:'mouseWheel',x,y,deltaX:number(data.deltaX,-10000,10000),deltaY:number(data.deltaY,-10000,10000),modifiers}];
    if(!['mousePressed','mouseReleased','mouseMoved'].includes(data.type)||!['left','right','middle','none'].includes(data.button))throw new Error('Invalid mouse input');
    return ['Input.dispatchMouseEvent',{type:data.type,x,y,button:data.button,buttons:number(data.buttons??0,0,7)|0,clickCount:number(data.clickCount??0,0,3)|0,modifiers}];
  }
  if(data.kind==='text') {
    if(typeof data.text!=='string'||data.text.length>10000)throw new Error('Invalid text input');
    return ['Input.insertText',{text:data.text}];
  }
  if(data.kind==='key') {
    if(!['keyDown','keyUp'].includes(data.type)||typeof data.key!=='string'||typeof data.code!=='string'||data.key.length>100||data.code.length>100)throw new Error('Invalid keyboard input');
    const params={type:data.type,key:data.key,code:data.code,windowsVirtualKeyCode:number(data.keyCode??0,0,255)|0,modifiers};
    if(data.text!==undefined){if(typeof data.text!=='string'||data.text.length>16)throw new Error('Invalid key text');params.text=data.text;}
    return ['Input.dispatchKeyEvent',params];
  }
  throw new Error('Unsupported input');
}

// Strip unknown fields before forwarding to the isolated capture world.
export function rtcMessage(data,{response=false}={}) {
  if(response&&data?.type==='reset'&&data.peerId==='*')return {type:'reset',peerId:'*'};
  if(!data||typeof data!=='object'||Array.isArray(data)||typeof data.peerId!=='string'||!/^[A-Za-z0-9_-]{8,80}$/.test(data.peerId))throw new Error('Invalid video peer');
  const allowed=response?['answer','candidate','error']:['offer','candidate','close','fallback','resize','ready','activity'];
  if(!allowed.includes(data.type))throw new Error('Invalid video signal');
  const message={peerId:data.peerId,type:data.type};
  if(!response&&data.clientId!==undefined){if(typeof data.clientId!=='string'||!/^[A-Za-z0-9_-]{8,80}$/.test(data.clientId))throw new Error('Invalid viewer identity');message.clientId=data.clientId;}
  if(data.type==='activity'){
    if(!Number.isInteger(data.fps)||data.fps<1||data.fps>30||typeof data.visible!=='boolean'||typeof data.active!=='boolean')throw new Error('Invalid capture activity');
    Object.assign(message,{fps:data.fps,visible:data.visible,active:data.active});
  }
  if(data.type==='offer'||data.type==='answer') {
    if(typeof data.sdp!=='string'||!data.sdp.startsWith('v=0')||data.sdp.length>100000)throw new Error('Invalid session description');
    message.sdp=data.sdp;
  }else if(data.type==='candidate') {
    if(data.candidate===null){message.candidate=null;return message;}
    const c=data.candidate;
    if(!c||typeof c!=='object'||Array.isArray(c)||typeof c.candidate!=='string'||c.candidate.length>4096)throw new Error('Invalid video candidate');
    if(c.sdpMid!==undefined&&c.sdpMid!==null&&(typeof c.sdpMid!=='string'||c.sdpMid.length>80))throw new Error('Invalid candidate media identifier');
    if(c.sdpMLineIndex!==undefined&&c.sdpMLineIndex!==null&&(!Number.isInteger(c.sdpMLineIndex)||c.sdpMLineIndex<0||c.sdpMLineIndex>64))throw new Error('Invalid candidate media index');
    if(c.usernameFragment!==undefined&&c.usernameFragment!==null&&(typeof c.usernameFragment!=='string'||c.usernameFragment.length>256))throw new Error('Invalid candidate username');
    message.candidate={candidate:c.candidate};
    for(const key of ['sdpMid','sdpMLineIndex','usernameFragment'])if(c[key]!==undefined)message.candidate[key]=c[key];
  }else if(data.type==='error') {
    if(typeof data.error!=='string'||data.error.length>2000)throw new Error('Invalid video error');
    message.error=data.error;
  }
  return message;
}

export function actionMessage(payload) {
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||!['link','reload','back','forward','screenshot'].includes(payload.action))throw new Error('Unsupported action');
  if(payload.action==='link'){if(typeof payload.enabled!=='boolean')throw new Error('Invalid link state');return {action:'link',enabled:payload.enabled};}
  if(payload.action==='screenshot'){if(typeof payload.skin!=='boolean')throw new Error('Choose whether to include the device skin');return {action:'screenshot',skin:payload.skin};}
  return {action:payload.action};
}

// Keep one newest image outside Node's bounded writable buffer. Control events
// remain ordered; disconnect pathological consumers instead of silently dropping them.
export function sendStream(stream,event,serialized) {
  if(stream.destroyed||stream.writableEnded)return;
  if(event==='frame'&&stream.writableNeedDrain){
    stream.pendingFrame=serialized;
    if(!stream.frameDrain){stream.frameDrain=true;stream.once('drain',()=>{stream.frameDrain=false;const frame=stream.pendingFrame;stream.pendingFrame=null;if(frame)sendStream(stream,'frame',frame);});}
    return;
  }
  if(event!=='frame'&&stream.writableLength>2_000_000){stream.destroy();return;}
  stream.write(serialized);
}
