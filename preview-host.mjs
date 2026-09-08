import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';

// The viewer stays outside the tested document: device chrome never changes its layout.
export class PreviewHost {
  constructor({input,action,close}) {
    this.records = new Map(); this.token = randomBytes(24).toString('hex');
    this.input=input; this.action=action; this.closePreview=close;
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
  broadcast(record,event,value) {
    for(const stream of record.streams) {
      // A slow viewer drops frames instead of accumulating unbounded image data.
      if(stream.writableLength<2_000_000)stream.write('event: '+event+'\ndata: '+JSON.stringify(value)+'\n\n');
    }
  }
  remove(id) {
    const record=this.records.get(id); if(!record)return;
    for(const stream of record.streams)stream.end(); this.records.delete(id);
  }
  async handle(req,res) {
    res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'self'; frame-ancestors 'none'");
    const path=new URL(req.url,this.origin).pathname;
    const match=path.match(new RegExp('^/'+this.token+'/view/([A-Fa-f0-9]+)(/(events|input|action))?$'));
    const record=match&&this.records.get(match[1]);
    if(!record){res.writeHead(404);res.end('Preview not found');return;}
    const route=match[3];
    if(req.method==='GET'&&!route) {
      const config={...record.device,id:record.id,base:record.base,url:record.url,linked:record.linked,reason:record.reason||''};
      const json=JSON.stringify(config).replaceAll('<','\\u003c');
      res.setHeader('Content-Type','text/html; charset=utf-8');
      res.end(this.template.replace('__SCREENHOP_CONFIG__',json)); return;
    }
    if(req.method==='GET'&&route==='events') {
      res.writeHead(200,{'Content-Type':'text/event-stream','Connection':'keep-alive'});
      record.streams.add(res);
      res.write('event: state\ndata: '+JSON.stringify({url:record.url,linked:record.linked,reason:record.reason||''})+'\n\n');
      if(record.frame)res.write('event: frame\ndata: '+JSON.stringify({data:record.frame})+'\n\n');
      const heartbeat=setInterval(()=>res.write(': keepalive\n\n'),10000);
      req.on('close',()=>{clearInterval(heartbeat);record.streams.delete(res)}); return;
    }
    if(req.method!=='POST'||!['input','action'].includes(route)){res.writeHead(405);res.end();return;}
    if(req.headers.origin&&req.headers.origin!==this.origin)throw new Error('Invalid origin');
    if(!req.headers['content-type']?.startsWith('application/json'))throw new Error('JSON required');
    let body=''; for await(const chunk of req){body+=chunk;if(body.length>20000)throw new Error('Input too large');}
    const payload=JSON.parse(body);
    if(route==='input')await this.input(record.id,payload);
    else await this.action(record.id,payload);
    res.setHeader('Content-Type','application/json');res.end('{"ok":true}');
  }
  shutdown() {
    for(const id of this.records.keys())this.remove(id);
    this.server.close(); this.server.closeAllConnections();
  }
}

export function inputCommand(data,width,height) {
  const number=(v,min,max)=>{if(typeof v!=='number'||!Number.isFinite(v))throw new Error('Invalid input coordinate');return Math.min(max,Math.max(min,v))};
  const modifiers=number(data.modifiers??0,0,15)|0;
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
