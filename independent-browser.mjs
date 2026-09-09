#!/usr/bin/env node
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {selection} from './native-preview.mjs';
import {launchNative} from './native-launch.mjs';

export function parse(args) {
  const request = {};
  for (let i=0;i<args.length;i++) {
    const key=args[i];
    if (['--landscape','--mobile'].includes(key)) request[key.slice(2)]=true;
    else if (['--device','--url','--width','--height','--dpr'].includes(key)) {
      if (args[i+1]===undefined || args[i+1].startsWith('--')) throw Error('Missing value for '+key);
      request[key.slice(2)]=args[++i];
    } else throw Error('Unsupported independent browser option: '+key);
  }
  return selection(request);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const args=process.argv.slice(2);const device=parse(args);const exec=promisify(execFile);const controller=fileURLToPath(new URL('./viewport.mjs',import.meta.url));const stateArgs=process.env.SCREENHOP_WEBRTC_STATE?['--state',process.env.SCREENHOP_WEBRTC_STATE]:[];const status=JSON.parse((await exec(process.execPath,[controller,...stateArgs,'--status'])).stdout);if(status.enabled)console.log((await exec(process.execPath,[controller,...stateArgs,...args,'--linked'],{timeout:60000})).stdout.trim());else console.log(JSON.stringify(await launchNative(device)))}catch(error){console.error(error.message);process.exitCode=1;}
}
