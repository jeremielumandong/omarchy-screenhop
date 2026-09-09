import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';import {createServer} from 'node:http';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const base=new URL('..',import.meta.url).pathname,root=await mkdtemp('/tmp/screenhop-review-popup-'),exec=promisify(execFile),delay=ms=>new Promise(r=>setTimeout(r,ms));
Object.assign(process.env,{SCREENHOP_NATIVE_RUNTIME:root+'/runtime',SCREENHOP_NATIVE_PROFILES:root+'/profiles'});
const {launchNative,instances,command}=await import(base+'native-launch.mjs');const {selection}=await import(base+'native-preview.mjs');let events=[];
const server=createServer((req,res)=>{if(req.url.startsWith('/report?')){events.push(JSON.parse(decodeURIComponent(req.url.slice(8))));res.end('ok');return;}res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">'+(req.url==='/popup'?`<title>ScreenHop popup fixture</title><script>fetch('/report?'+encodeURIComponent(JSON.stringify({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,touch:navigator.maxTouchPoints})))</script>`:`<style>body{margin:0}button{width:160px;height:60px}</style><button onclick="window.open('/popup','_blank')">Open new tab</button>`));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{
 await exec('c++',[base+'tests/native-input.cpp','-o',root+'/input','-lX11','-lXtst']);
 const p=await launchNative(selection({device:'iphone-se',url:'http://127.0.0.1:'+server.address().port}));await delay(700);
 const windows=JSON.parse((await exec('hyprctl',['-j','clients'])).stdout),w=windows.find(w=>w.pid===p.pid);await exec('hyprctl',['dispatch','hl.dsp.focus({window="address:'+w.address+'"})']);await delay(300);
 const g=await command(p.socket,'geometry'),info=await command(p.socket,'inspect');const scale=info.scale*g.dpr;
 await exec(root+'/input',[g.child,String(Math.round(50*scale)),String(Math.round(30*scale)),'c']);await delay(1000);
 assert.deepEqual(events,[{width:375,height:667,dpr:2,touch:5}]);
 console.log(JSON.stringify({expected:{width:375,height:667,dpr:2,touch:5},popup:events},null,2));
}finally{for(const p of await instances())await command(p.socket,'close').catch(()=>{});server.closeAllConnections();await new Promise(r=>server.close(r));}
