#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';

const run=promisify(execFile);
const PORT=53318;

export function localNetwork(defaultRoutes,linkRoutes) {
  const routes=defaultRoutes.filter(route=>route.dst==='default'&&/^(wl|en|eth)[A-Za-z0-9_.:-]*$/.test(route.dev||'')&&!route.linkdown).sort((a,b)=>(a.metric||0)-(b.metric||0));
  for(const route of routes) {
    const links=linkRoutes.filter(link=>link.dev===route.dev&&(!link.scope||link.scope==='link')&&!link.gateway&&!link.linkdown);
    for(const link of links) {
      const match=String(link.dst).match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/);
      if(!match)continue;
      const [a,b,c,d,prefix]=match.slice(1).map(Number);
      if([a,b,c,d].some(part=>part>255)||prefix>30)continue;
      const privateNetwork=(a===10&&prefix>=8)||(a===172&&b>=16&&b<=31&&prefix>=12)||(a===192&&b===168&&prefix>=16);
      if(!privateNetwork)continue;
      const address=(((a<<24)>>>0)+(b<<16)+(c<<8)+d)>>>0;
      const mask=(0xffffffff<<(32-prefix))>>>0;
      if(((address&mask)>>>0)!==address)continue;
      return {iface:route.dev,subnet:link.dst};
    }
  }
  throw new Error('No private Wi-Fi or Ethernet subnet was found on the default network. Connect to your local network and retry Allow Wi-Fi access.');
}

export function hasPhoneRule(rules,{iface,subnet}) {
  const expected=`-A ufw-user-input -i ${iface} -p tcp --dport ${PORT} -s ${subnet} -j ACCEPT`;
  return rules.split(/\r?\n/).some(line=>line.trim()===expected);
}

// The UI calls this only after the HTTPS-only remote starts successfully, or
// after an explicit retry while that remote is enabled. A firewall rule never
// substitutes for TLS; this helper does not start a listener.
// Credentials are collected by the system polkit agent, never by ScreenHop.
export async function ensurePhoneFirewall({read=readFile,execute=run}={}) {
  let config;
  try{config=await read('/etc/ufw/ufw.conf','utf8');}
  catch(error){if(error.code==='ENOENT')return {status:'unmanaged',message:'UFW is not installed. If another firewall is enabled, allow ScreenHop TCP port 53318 from your local network.'};throw new Error('Could not read the firewall configuration. Retry Allow Wi-Fi access or configure TCP port 53318 in your firewall.');}
  if(!/^ENABLED\s*=\s*yes\s*$/mi.test(config))return {status:'inactive',message:'UFW is off; no firewall change was needed. Use the same Wi-Fi network.'};
  let network;
  try {
    const defaults=await execute('ip',['-j','-4','route','show','default']);
    const links=await execute('ip',['-j','-4','route','show','scope','link']);
    network=localNetwork(JSON.parse(defaults.stdout),JSON.parse(links.stdout));
  }catch(error){throw new Error(error.message.startsWith('No private')?error.message:'Could not detect your local Wi-Fi or Ethernet network. Check the connection and retry Allow Wi-Fi access.');}
  let rules;
  try{rules=await read('/etc/ufw/user.rules','utf8');}
  catch{throw new Error('Could not check existing firewall rules. Allow TCP port 53318 from your local subnet in UFW, then retry.');}
  if(hasPhoneRule(rules,network))return {status:'ready',...network,message:'Wi-Fi access is allowed. Scan the QR code on your phone.'};
  try {
    await execute('pkexec',['/usr/bin/ufw','allow','in','on',network.iface,'from',network.subnet,'to','any','port',String(PORT),'proto','tcp','comment','ScreenHop phone remote']);
  }catch(error){
    if(error.code===126||error.code===127)throw new Error('Wi-Fi access was not authorized. Click Allow Wi-Fi access to try the system password prompt again.');
    throw new Error('Could not allow Wi-Fi access. Check that UFW and a system authentication agent are available, then retry.');
  }
  const updated=await read('/etc/ufw/user.rules','utf8').catch(()=> '');
  if(!hasPhoneRule(updated,network))throw new Error('The firewall rule could not be verified. Retry Allow Wi-Fi access or check UFW.');
  return {status:'ready',...network,message:'Wi-Fi access is allowed. Scan the QR code on your phone.'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try{console.log(JSON.stringify(await ensurePhoneFirewall()));}
  catch(error){console.log(JSON.stringify({status:'error',message:error.message}));process.exitCode=1;}
}
