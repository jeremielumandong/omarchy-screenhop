// System Chromium renders directly into an XWayland child window. CDP uses
// inherited pipes, never a LAN or loopback debugging listener.
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {createServer as createHTTPServer} from 'node:http';
import {join} from 'node:path';
import {command} from './native-launch.mjs';
const cfg=JSON.parse(await readFile(process.argv[2],'utf8')),d=cfg.device;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let binary;
for(const candidate of process.env.SCREENHOP_BROWSER?[process.env.SCREENHOP_BROWSER]:['chromium','google-chrome-stable','google-chrome','brave-browser'])try{binary=execFileSync('which',[candidate],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();break;}catch{}
if(!binary)throw Error('Chromium is required');
let geometry;
for(let i=0;i<60;i++){geometry=await command(cfg.socket,'geometry');if(geometry.width>0)break;await delay(100);}
if(!geometry?.width)throw Error('Skin geometry is unavailable');
await mkdir(join(cfg.profile,'chromium'),{recursive:true,mode:0o700});
const bootstrap=createHTTPServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>ScreenHop</title>')});
await new Promise(r=>bootstrap.listen(0,'127.0.0.1',r));
const bootstrapURL='http://127.0.0.1:'+bootstrap.address().port+'/';
const chrome=spawn(binary,['--user-data-dir='+join(cfg.profile,'chromium'),'--remote-debugging-pipe','--ozone-platform=x11','--force-device-scale-factor=1','--no-first-run','--no-default-browser-check','--class=screenhop-content','--app='+bootstrapURL,'--kiosk'],{stdio:['ignore','ignore','inherit','pipe','pipe']});
let defaults;
let sequence=0,buffer='',closed=false,ready=false,sessionId,targetId;
const pending=new Map();
function send(method,params={},session=sessionId){return new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timed out'));},10000);pending.set(id,{resolve,reject,timer});chrome.stdio[3].write(JSON.stringify({id,method,params,...(session?{sessionId:session}:{})})+'\0');});}
chrome.stdio[3].on('error',()=>{});
chrome.stdio[4].on('data',chunk=>{buffer+=chunk.toString();let end;while((end=buffer.indexOf('\0'))>=0){const packet=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!packet)continue;let msg;try{msg=JSON.parse(packet)}catch{continue;}
 if(msg.id){const p=pending.get(msg.id);if(p){pending.delete(msg.id);clearTimeout(p.timer);msg.error?p.reject(Error(msg.error.message)):p.resolve(msg.result);} }
 else if(msg.method==='Target.attachedToTarget'){void configurePopup(msg.params).catch(async error=>{console.error('Popup emulation failed:',error.message);await send('Target.closeTarget',{targetId:msg.params.targetInfo.targetId},null).catch(()=>{});});}
 else if(msg.sessionId===sessionId && ((msg.method==='Page.frameNavigated'&&!msg.params.frame.parentId)||msg.method==='Page.navigatedWithinDocument')){void command(cfg.socket,'url',{url:msg.params.frame?.url||msg.params.url}).catch(()=>{});}
}});
const server=createServer();
async function close(){if(closed)return;closed=true;clearInterval(resizer);await send('Browser.close',{},undefined).catch(()=>{});for(let i=0;i<15&&chrome.exitCode===null&&chrome.signalCode===null;i++)await delay(100);if(chrome.exitCode===null&&chrome.signalCode===null)chrome.kill();server.close();bootstrap.close();await unlink(cfg.socket+'.browser').catch(()=>{});process.exit();}
let resizer;
process.on('SIGTERM',close);process.on('SIGINT',close);
chrome.on('error',error=>{console.error(error.message);process.exit(1)});
chrome.on('exit',()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Browser closed'));}pending.clear();if(!closed)void close();});
const metrics="({width:innerWidth,height:innerHeight,screenWidth:screen.width,screenHeight:screen.height,orientation:screen.orientation.type,clientWidth:document.documentElement.clientWidth,dpr:devicePixelRatio,touchPoints:navigator.maxTouchPoints,coarse:matchMedia('(pointer: coarse)').matches,hover:matchMedia('(hover: hover)').matches,visualWidth:visualViewport.width,engine:navigator.userAgent.split('Chrome/')[1]?.split(' ')[0],webdriver:navigator.webdriver,userAgent:navigator.userAgent,uaData:navigator.userAgentData?.toJSON()})";
let scale=geometry.width/d.width;
async function emulate(){await send('Emulation.setDeviceMetricsOverride',{width:d.width,height:d.height,deviceScaleFactor:d.dpr,mobile:d.mobile,screenWidth:d.width,screenHeight:d.height,scale:scale*geometry.dpr,dontSetVisibleSize:true,screenOrientation:{type:d.width>d.height?'landscapePrimary':'portraitPrimary',angle:d.width>d.height?90:0}});await send('Emulation.setVisibleSize',{width:Math.round(geometry.width*geometry.dpr),height:Math.round(geometry.height*geometry.dpr)});}
// Pause new page targets before their scripts execute; retain their opener relationship.
async function configurePopup({sessionId:popup,targetInfo}) {
 if(targetInfo.targetId===targetId){await send('Runtime.runIfWaitingForDebugger',{},popup);return;}
 await send('Emulation.setDeviceMetricsOverride',{width:d.width,height:d.height,deviceScaleFactor:d.dpr,mobile:d.mobile,screenWidth:d.width,screenHeight:d.height,scale:1,screenOrientation:{type:d.width>d.height?'landscapePrimary':'portraitPrimary',angle:d.width>d.height?90:0}},popup);
 await send('Emulation.setUserAgentOverride',{userAgent:defaults.ua.replace(/\bChrome\//,'HeadlessChrome/'),userAgentMetadata:defaults.metadata},popup);
 if(d.mobile){await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5},popup);await send('Emulation.setEmitTouchEventsForMouse',{enabled:true,configuration:'mobile'},popup);}
 await send('Runtime.runIfWaitingForDebugger',{},popup);
}
try {
 for(let i=0;i<60;i++){const targets=(await send('Target.getTargets',{},undefined)).targetInfos;targetId=targets.find(t=>t.type==='page'&&t.url===bootstrapURL)?.targetId;if(targetId)break;await delay(100);}
 if(!targetId)throw Error('Browser tab did not open');
 sessionId=(await send('Target.attachToTarget',{targetId,flatten:true},undefined)).sessionId;
 await send('Page.enable');
 let embedded=false;for(let i=0;i<60;i++){if((await command(cfg.socket,'embed',{pid:chrome.pid})).embedded){embedded=true;break;}await delay(100);}
 if(!embedded)throw Error('Cannot embed Chromium window');
 await emulate();
 // Match the published headless renderer's request identity as well as its
 // layout settings, so server-side UA branching does not select another page.
 for(let i=0;i<30;i++){
  defaults=(await send('Runtime.evaluate',{expression:"(async()=>({ua:navigator.userAgent,metadata:navigator.userAgentData?await navigator.userAgentData.getHighEntropyValues(['architecture','bitness','model','platformVersion','fullVersionList','wow64']):null}))()",awaitPromise:true,returnByValue:true})).result.value;
  if(defaults?.metadata)break;await delay(100);
 }
 if(!defaults?.metadata)throw Error('Cannot establish browser request identity');
 await send('Emulation.setUserAgentOverride',{userAgent:defaults.ua.replace(/\bChrome\//,'HeadlessChrome/'),userAgentMetadata:defaults.metadata});
 bootstrap.close();
 if(d.mobile){await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});await send('Emulation.setEmitTouchEventsForMouse',{enabled:true,configuration:'mobile'});}
 await send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true,filter:[{type:'page'},{exclude:true}]},null);
 const navigation=await send('Page.navigate',{url:d.url});if(navigation.errorText)throw Error(navigation.errorText);ready=true;
 let resizing=false;
 resizer=setInterval(async()=>{if(resizing||closed)return;resizing=true;try{const next=await command(cfg.socket,'geometry');const nextScale=next.width/d.width;if(nextScale>0&&Math.abs(nextScale-scale)>0.00001){geometry=next;scale=nextScale;await emulate();}}catch{}finally{resizing=false}},150);
 server.on('connection',socket=>{socket.setEncoding('utf8');socket.setTimeout(6000,()=>socket.destroy());socket.on('error',()=>{});let text='';socket.on('data',chunk=>{text+=chunk;if(text.length>16384){socket.destroy();return;}if(!text.includes('\n'))return;socket.removeAllListeners('data');void(async()=>{try{
  const request=JSON.parse(text.split('\n')[0]);let value;
  if(request.action==='inspect')value={ready,viewport:(await send('Runtime.evaluate',{expression:metrics,returnByValue:true})).result.value,scale,panel:geometry,expectedWidth:d.width,expectedHeight:d.height};
  else if(request.action==='page-screenshot'){const image=await send('Page.captureScreenshot',{format:'png'});await writeFile(request.path,Buffer.from(image.data,'base64'));value={status:'saved'};}
  else if(request.action==='reload'){await send('Page.reload');value={status:'ok'};}
  else if(['back','forward'].includes(request.action)){const history=await send('Page.getNavigationHistory');const entry=history.entries[history.currentIndex+(request.action==='back'?-1:1)];if(entry)await send('Page.navigateToHistoryEntry',{entryId:entry.id});value={status:'ok'};}
  else throw Error('Unknown browser action');
  socket.end(JSON.stringify(value)+'\n');
 }catch(error){socket.end(JSON.stringify({error:error.message})+'\n');}})();});});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(cfg.socket+'.browser',resolve);});
}catch(error){console.error(error.message);await close();}
