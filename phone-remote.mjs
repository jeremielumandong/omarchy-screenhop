import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {networkInterfaces as systemInterfaces} from 'node:os';
import {execFileSync} from 'node:child_process';
import {inputCommand,rtcMessage,actionMessage} from './preview-host.mjs';

const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// An explicitly enabled, revocable LAN controller. It only exposes the framed
// preview API; the desktop control token and browser debugging port stay private.
export class PhoneRemote {
  static async create({host,networkInterfaces=systemInterfaces,port=53318}) {
    if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Phone remote port must be between 0 and 65535.');
    const remote=new PhoneRemote();
    remote.host=host; remote.token=randomBytes(32).toString('hex');
    remote.sockets=new Set(); remote.streams=new Map(); remote.peers=new Map(); remote.pendingSignals=new Set(); remote.enabled=true;
    const interfaces=typeof networkInterfaces==='function'?networkInterfaces():networkInterfaces;
    // Prefer physical Wi-Fi, then Ethernet, before VPNs and container bridges.
    const priority=name=>/^(wl|wlan|wifi)/i.test(name)?0:/^(en|eth)/i.test(name)?1:/^(docker|br|veth|virbr|tun|tap|wg|tailscale|zt)/i.test(name)?3:2;
    const addresses=[...new Set(Object.entries(interfaces).sort(([a],[b])=>priority(a)-priority(b)).flatMap(([,items])=>items||[]).filter(item=>!item.internal&&(item.family==='IPv4'||item.family===4)).map(item=>item.address))];
    remote.addresses=new Set(['127.0.0.1',...addresses]);
    remote.server=createServer((req,res)=>remote.handle(req,res).catch(()=>{
      if(!res.headersSent)res.writeHead(400,{'Content-Type':'application/json'});
      res.end('{"error":"Invalid request"}');
    }));
    remote.server.on('connection',socket=>{remote.sockets.add(socket);socket.on('close',()=>remote.sockets.delete(socket));});
    remote.server.requestTimeout=15000; remote.server.headersTimeout=10000;
    try {
      await new Promise((resolve,reject)=>{
        const failed=error=>reject(error);remote.server.once('error',failed);
        remote.server.listen(port,'0.0.0.0',()=>{remote.server.removeListener('error',failed);resolve();});
      });
    } catch(error) {
      remote.enabled=false;remote.token='';remote.server.close();
      for(const socket of remote.sockets)socket.destroy();
      if(error.code==='EADDRINUSE')throw new Error(`ScreenHop phone remote port ${port} is already in use. Close the other ScreenHop remote or the app using that port, then try again.`);
      throw error;
    }
    remote.port=remote.server.address().port;
    remote.reason=addresses.length?`Use the same Wi-Fi network. If a firewall is enabled, allow TCP port ${remote.port} from your local network.`:'No LAN IPv4 address is available. Connect this computer to Wi-Fi or Ethernet, then turn Phone remote off and on.';
    remote.urls=(addresses.length?addresses:['127.0.0.1']).map(address=>`http://${address}:${remote.port}/${remote.token}/`);
    remote.qrData='';
    try {
      const svg=execFileSync('qrencode',['-t','SVG','-o','-',remote.urls[0]],{encoding:'utf8',timeout:2000,maxBuffer:1024*1024,stdio:['ignore','pipe','ignore']});
      remote.qrData='data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64');
    } catch { /* The copyable pairing URL remains available without qrencode. */ }
    return remote;
  }
  info() {return this.enabled?{enabled:true,urls:[...this.urls],url:this.urls[0],qrData:this.qrData,port:this.port,reason:this.reason}:{enabled:false,urls:[],url:'',qrData:''};}
  async close() {
    this.enabled=false;this.token='';this.urls=[];this.qrData='';
    for(const [stream,cleanup] of this.streams){cleanup();stream.destroy();}
    const closed=new Promise(resolve=>this.server.close(resolve));
    for(const socket of this.sockets)socket.destroy();
    await closed;
    await Promise.allSettled([...this.pendingSignals]);
    await Promise.allSettled([...this.peers.values()].map(({id,peerId})=>Promise.resolve().then(()=>this.host.signal?.(id,{peerId,type:'close'}))));
    this.peers.clear();
  }
  async handle(req,res) {
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'");
    const validHosts=new Set([...this.addresses].map(address=>`${address}:${this.port}`));
    if(!this.enabled||!validHosts.has(req.headers.host)){res.writeHead(403);res.end();return;}
    const origin='http://'+req.headers.host;
    if(req.headers.origin&&req.headers.origin!==origin){res.writeHead(403);res.end();return;}
    if(req.headers['sec-fetch-site']==='cross-site'){res.writeHead(403);res.end();return;}
    const path=new URL(req.url,origin).pathname;
    const prefix='/'+this.token+'/';
    if(!path.startsWith(prefix)){res.writeHead(404);res.end();return;}
    const suffix=path.slice(prefix.length);
    if(req.method==='GET'&&!suffix){
      const devices=[...this.host.records.values()].map(record=>`<a href="${prefix}view/${encodeURIComponent(record.id)}"><strong>${escapeHTML(record.device.name)}</strong><span>${escapeHTML(record.device.width)} × ${escapeHTML(record.device.height)}</span></a>`).join('');
      res.setHeader('Content-Type','text/html; charset=utf-8');
      res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>ScreenHop remote</title><style>body{font:16px system-ui;background:#16181d;color:#f2f3f5;max-width:36rem;margin:auto;padding:24px}a{display:flex;justify-content:space-between;gap:16px;color:inherit;text-decoration:none;background:#272b34;padding:20px;border-radius:12px;margin:12px 0}span,p{color:#b9c2d0}</style></head><body><h1>ScreenHop remote</h1><p>Choose a preview to control. Enable Link previews to drive the other screens. Linking pauses during sign-in and security checks.</p>${devices||'<p>No framed previews are open. Open a device preview on your computer, then refresh this page.</p>'}</body></html>`);return;
    }
    const match=suffix.match(/^view\/([A-Za-z0-9_-]+)(?:\/(events|input|action|signal|capture-ui\.js))?$/);
    const record=match&&this.host.records.get(match[1]);
    if(!record){res.writeHead(404);res.end();return;}
    const route=match[2];
    if(req.method==='GET'&&!route){
      const config={...record.device,id:record.id,base:prefix+'view/'+record.id,url:record.url,linked:record.linked,reason:record.reason||'',phone:true,transport:this.host.signal?'webrtc':'jpeg'};
      res.setHeader('Content-Type','text/html; charset=utf-8');
      res.end(this.host.template.replace('__SCREENHOP_CONFIG__',JSON.stringify(config).replaceAll('<','\\u003c')));return;
    }
    if(req.method==='GET'&&route==='capture-ui.js'){
      res.setHeader('Content-Type','text/javascript; charset=utf-8');
      res.end(await readFile(new URL('./capture-ui.js',import.meta.url),'utf8'));return;
    }
    if(req.method==='GET'&&route==='events'){
      res.writeHead(200,{'Content-Type':'text/event-stream','Connection':'keep-alive'});
      record.streams.add(res);
      const heartbeat=setInterval(()=>res.write(': keepalive\n\n'),10000);
      const cleanup=()=>{clearInterval(heartbeat);record.streams.delete(res);this.streams.delete(res);};
      this.streams.set(res,cleanup);res.once('close',cleanup);
      res.write('event: state\ndata: '+JSON.stringify({url:record.url,linked:record.linked,reason:record.reason||''})+'\n\n');
      if(record.frame)res.write('event: frame\ndata: '+JSON.stringify({data:record.frame})+'\n\n');return;
    }
    if(req.method!=='POST'||!['input','action','signal'].includes(route)){res.writeHead(405);res.end();return;}
    if(!req.headers['content-type']?.toLowerCase().startsWith('application/json'))throw new Error('JSON required');
    let body='',size=0;for await(const chunk of req){size+=chunk.length;if(size>(route==='signal'?120000:20000))throw new Error('Input too large');body+=chunk;}
    const payload=JSON.parse(body);let result;if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('Invalid payload');
    if(route==='signal'){
      const message=rtcMessage(payload);
      if(!this.host.signal)throw new Error('Video signaling unavailable');
      const key=record.id+':'+message.peerId;
      if(message.type==='offer'||message.type==='fallback'){
        if(!this.peers.has(key)&&[...this.peers.values()].filter(peer=>peer.id===record.id).length>=8)throw new Error('Too many phone viewers');
        this.peers.set(key,{id:record.id,peerId:message.peerId});
      }else if(!this.peers.has(key))throw new Error('Unknown phone video peer');
      const operation=Promise.resolve().then(()=>this.host.signal(record.id,message));
      this.pendingSignals.add(operation);
      try {await operation;if(message.type==='close')this.peers.delete(key);}
      finally {this.pendingSignals.delete(operation);}
    }else if(route==='input'){
      inputCommand(payload,record.device.width,record.device.height);
      await this.host.input(record.id,payload);
    }else{
      result=await this.host.action(record.id,actionMessage(payload));
    }
    const response=JSON.stringify(result===undefined?{ok:true}:result);
    if(response.length>100*1024*1024)throw new Error('Capture is too large');
    res.setHeader('Content-Type','application/json');res.end(response);
  }
}
