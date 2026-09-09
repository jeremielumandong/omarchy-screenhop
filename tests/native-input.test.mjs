import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp} from 'node:fs/promises';
import {createServer} from 'node:http';
import {selection} from '../native-preview.mjs';
const exec=promisify(execFile),delay=ms=>new Promise(r=>setTimeout(r,ms));
test('native mouse, keyboard, and scrolling reach the embedded page',{timeout:45000},async()=>{
 const state=await mkdtemp('/tmp/sh-native-input-');process.env.SCREENHOP_NATIVE_RUNTIME=state+'/runtime';process.env.SCREENHOP_NATIVE_PROFILES=state+'/profiles';
 const {launchNative,command}=await import('../native-launch.mjs');
 const events=[];
 const server=createServer((req,res)=>{if(req.url.startsWith('/event/')){events.push(req.url);res.end('ok');return;}res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;height:3000px}button,input{position:absolute;left:10px;width:160px;height:40px}button{top:10px}input{top:70px}</style><button onclick="fetch(\'/event/click-\'+event.isTrusted)">Click</button><input oninput="fetch(\'/event/type-\'+this.value)"><script>onload=()=>fetch(\'/event/ready\');onscroll=()=>fetch(\'/event/scroll\');for(const t of [\'pointerdown\',\'mousedown\',\'touchstart\'])addEventListener(t,e=>fetch(\'/event/\'+t+\'-\'+(e.clientX||e.touches?.[0]?.clientX)+\'-\'+(e.clientY||e.touches?.[0]?.clientY)+\'-\'+e.target.tagName))</script>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let window;
 try{
  await exec('c++',[new URL('./native-input.cpp',import.meta.url).pathname,'-o',state+'/input','-lX11','-lXtst']);
  window=await launchNative(selection({device:'iphone-se',url:'http://127.0.0.1:'+server.address().port}));
  for(let i=0;i<50&&!events.includes('/event/ready');i++)await delay(100);
  assert.ok(events.includes('/event/ready'));await delay(700);
  const windows=JSON.parse((await exec('hyprctl',['-j','clients'])).stdout);const current=windows.find(w=>w.pid===window.pid);assert.ok(current);
  await exec('hyprctl',['dispatch','hl.dsp.focus({window="address:'+current.address+'"})']);await delay(300);
  const g=await command(window.socket,'geometry'),info=await command(window.socket,'inspect');const scale=info.scale*g.dpr;
  const input=async(x,y,kind)=>{await exec(state+'/input',[g.child,String(Math.round(x*scale)),String(Math.round(y*scale)),kind]);await delay(300);};
  await input(50,30,'c');assert.ok(events.includes('/event/click-true'),'trusted native click reaches button: '+JSON.stringify({events,g,info}));
  await input(50,90,'a');assert.ok(events.includes('/event/type-a'),'typing reaches focused field');
  await input(200,180,'s');assert.ok(events.includes('/event/scroll'),'native scrolling reaches page');
 }finally{if(window)await command(window.socket,'close').catch(()=>{});await new Promise(r=>server.close(r));}
});
