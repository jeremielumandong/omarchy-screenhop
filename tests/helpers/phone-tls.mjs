// Ephemeral test identity. Production never generates certificates or bypasses trust.
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {request} from 'node:https';
import {Readable} from 'node:stream';
import {createHash,X509Certificate} from 'node:crypto';
import {after} from 'node:test';

const directory=mkdtempSync(join(tmpdir(),'screenhop-test-tls-'));
after(()=>rmSync(directory,{recursive:true,force:true}));
const keyFile=join(directory,'key.pem'),certFile=join(directory,'cert.pem');
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',keyFile,'-out',certFile,'-days','1','-subj','/CN=ScreenHop test only','-addext','subjectAltName=IP:127.0.0.1,DNS:localhost','-addext','basicConstraints=critical,CA:TRUE'],{stdio:'ignore'});
export const tls={key:readFileSync(keyFile),cert:readFileSync(certFile),hostname:'127.0.0.1'};
export const configPath=join(directory,'phone-tls.json');
writeFileSync(configPath,JSON.stringify({hostname:tls.hostname,keyFile,certFile}));

// Trust only this generated identity, keeping normal chain/hostname validation.
export function fetch(url,options={}) {
  if(new URL(url).protocol!=='https:')return globalThis.fetch(url,options);
  return new Promise((resolve,reject)=>{
    const req=request(url,{method:options.method,headers:options.headers,signal:options.signal,ca:tls.cert},res=>{
      resolve(new Response(Readable.toWeb(res),{status:res.statusCode,headers:res.headers}));
    });
    req.on('error',reject);req.end(options.body);
  });
}

export function browserEnvironment() {
  // A test-only browser wrapper pins just the ephemeral fixture key, never all
  // certificate errors. No production flags or user trust stores are changed.
  const spki=new X509Certificate(tls.cert).publicKey.export({type:'spki',format:'der'});
  const pin=createHash('sha256').update(spki).digest('base64');
  const browser=process.env.SCREENHOP_BROWSER||'chromium';
  const quote=value=>"'"+value.replaceAll("'","'\\''")+"'";
  const wrapper=join(directory,'browser');
  writeFileSync(wrapper,`#!/bin/sh\nexec ${quote(browser)} --ignore-certificate-errors-spki-list=${quote(pin)} "$@"\n`,{mode:0o700});
  return {...process.env,SCREENHOP_PHONE_TLS_CONFIG:configPath,SCREENHOP_BROWSER:wrapper,SCREENHOP_TEST_PHONE_PORT:'0'};
}
