import test from 'node:test';
import assert from 'node:assert/strict';
import {localNetwork,ensurePhoneFirewall,hasPhoneRule} from '../phone-firewall.mjs';
const defaults=[{dst:'default',dev:'tun0',metric:0},{dst:'default',dev:'wlp2s0',metric:600}];
const links=[{dst:'192.168.4.0/24',dev:'wlp2s0',scope:'link'}];
const rule='-A ufw-user-input -i wlp2s0 -p tcp --dport 53318 -s 192.168.4.0/24 -j ACCEPT';
function fixture({config='ENABLED=yes',rules='',reject=false}={}) {
  const calls=[];let current=rules;
  return {calls,read:async path=>path.endsWith('ufw.conf')?config:current,execute:async(cmd,args)=>{calls.push([cmd,args]);if(cmd==='ip')return {stdout:JSON.stringify(args.includes('default')?defaults:links)};if(reject)throw Object.assign(new Error('cancelled'),{code:126});current=rule;return {stdout:'Rule added'};}};
}
test('selects only default physical private LAN and rejects unsafe scopes',()=>{
  assert.deepEqual(localNetwork(defaults,links),{iface:'wlp2s0',subnet:'192.168.4.0/24'});
  for(const dst of ['0.0.0.0/0','8.8.8.0/24','192.168.4.1/24','192.168.4.0/8','999.168.4.0/24'])assert.throws(()=>localNetwork(defaults,[{...links[0],dst}]));
  assert.throws(()=>localNetwork([{dst:'default',dev:'docker0'}],[{...links[0],dev:'docker0'}]));
});
test('existing exact rule skips authentication',async()=>{
  const f=fixture({rules:rule});assert.equal((await ensurePhoneFirewall(f)).status,'ready');assert.equal(f.calls.filter(([cmd])=>cmd==='pkexec').length,0);
  assert.equal(hasPhoneRule(rule,{iface:'wlp3s0',subnet:'192.168.4.0/24'}),false);
});
test('missing rule uses narrowly scoped system password prompt and verifies result',async()=>{
  const f=fixture();assert.equal((await ensurePhoneFirewall(f)).status,'ready');
  assert.deepEqual(f.calls.find(([cmd])=>cmd==='pkexec'),['pkexec',['/usr/bin/ufw','allow','in','on','wlp2s0','from','192.168.4.0/24','to','any','port','53318','proto','tcp','comment','ScreenHop phone remote']]);
});
test('inactive firewall does not execute commands; cancellation remains actionable',async()=>{
  const f=fixture({config:'ENABLED=no'});assert.equal((await ensurePhoneFirewall(f)).status,'inactive');assert.equal(f.calls.length,0);
  await assert.rejects(ensurePhoneFirewall(fixture({reject:true})),/not authorized/);
});

assert.deepEqual(localNetwork([{dst:'default',dev:'wlp229s0',metric:600}],[{dst:'192.168.1.0/24',dev:'wlp229s0',protocol:'kernel',flags:[]}]),{iface:'wlp229s0',subnet:'192.168.1.0/24'});
