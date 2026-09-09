import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {selection} from '../native-preview.mjs';
import {CDP} from '../viewport.mjs';
const exec=promisify(execFile),folder=new URL('..',import.meta.url).pathname;
const expression="({width:innerWidth,height:innerHeight,screenWidth:screen.width,screenHeight:screen.height,orientation:screen.orientation.type,clientWidth:document.documentElement.clientWidth,dpr:devicePixelRatio,touchPoints:navigator.maxTouchPoints,coarse:matchMedia('(pointer: coarse)').matches,hover:matchMedia('(hover: hover)').matches,visualWidth:visualViewport.width,engine:navigator.userAgent.split('Chrome/')[1]?.split(' ')[0],userAgent:navigator.userAgent,uaData:navigator.userAgentData?.toJSON()})";
test('audit native rendering against current device emulation',{timeout:120000},async()=>{
 const root=await mkdtemp('/tmp/sh-parity-');process.env.SCREENHOP_NATIVE_RUNTIME=root+'/native';process.env.SCREENHOP_NATIVE_PROFILES=root+'/profiles';
 const {launchNative,instances,command}=await import('../native-launch.mjs');
 const state=root+'/webrtc';const reports=[];
 const server=createServer((req,res)=>res.end('<!doctype html>'+(req.url==='/viewport'?'<meta name="viewport" content="width=device-width,initial-scale=1">':'')+'<style>body{margin:0}main{height:3000px}</style><main>Rendering parity fixture</main>'));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const run=async args=>JSON.parse((await exec(process.execPath,[folder+'viewport.mjs','--state',state,...args],{timeout:45000})).stdout);
 try{
  for(const scenario of [{meta:'viewport',device:'iphone-se'},{meta:'no-viewport',device:'iphone-se'},{meta:'viewport',device:'iphone-se',landscape:true},{meta:'viewport',device:'custom',width:1920,height:1080,dpr:1},{meta:'viewport',device:'iphone-x'},{meta:'viewport',device:'pixel-11'},{meta:'viewport',device:'galaxy-s26-ultra'},{meta:'viewport',device:'ipad-pro-11',landscape:true}]){
   const {meta}=scenario;
   const url='http://127.0.0.1:'+server.address().port+'/'+meta;
   const device=selection({...scenario,url});const native=await launchNative(device);
   const args=['--headless','--device',device.id,'--url',url];if(scenario.landscape)args.push('--landscape');if(device.id==='custom')args.push('--width',String(device.width),'--height',String(device.height),'--dpr',String(device.dpr));
   const framed=await run(args);
   await new Promise(r=>setTimeout(r,1000));
   const [port,path]=(await readFile(state+'/browser/DevToolsActivePort','utf8')).trim().split('\n');
   const cdp=await CDP.connect('ws://127.0.0.1:'+port+path);
   try{
    const {sessionId}=await cdp.send('Target.attachToTarget',{targetId:framed.targetId,flatten:true});
    const expected=(await cdp.send('Runtime.evaluate',{expression,returnByValue:true},sessionId)).result.value;
    const actual=(await command(native.socket,'inspect')).viewport;
    const differences=Object.keys(expected).filter(key=>JSON.stringify(expected[key])!==JSON.stringify(actual[key]));
    reports.push({fixture:meta,device:device.id,landscape:!!scenario.landscape,current:expected,native:actual,differences});
    assert.deepEqual(differences,[],JSON.stringify(reports.at(-1)));
   }finally{cdp.ws.close();await command(native.socket,'close');await run(['--close']);}
  }
 }finally{for(const p of await instances())await command(p.socket,'close');await run(['--close']).catch(()=>{});await new Promise(r=>server.close(r));}
 await writeFile(folder+'native-parity-report.json',JSON.stringify(reports,null,2)+'\n');
 console.log(JSON.stringify(reports));
});
