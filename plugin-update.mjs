#!/usr/bin/env node
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,realpath,writeFile,rename,unlink} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const exec=promisify(execFile),here=dirname(fileURLToPath(import.meta.url));
const env={...process.env,GIT_TERMINAL_PROMPT:'0',GIT_SSH_COMMAND:'ssh -oBatchMode=yes'};
async function git(folder,args){return (await exec('git',['-C',folder,...args],{env,timeout:60000,maxBuffer:2*1024*1024})).stdout.trim();}
async function checkout(folder){
 try{if(await realpath(await git(folder,['rev-parse','--show-toplevel']))!==await realpath(folder))throw Error();}
 catch{throw Error('This is a copied installation. Install ScreenHop through omarchy plugin add to enable updates here.');}
 if(await git(folder,['status','--porcelain']))throw Error('Local changes prevent updating. Back up or resolve them first; nothing has been overwritten.');
}
export async function checkUpdate(folder=here){
 await checkout(folder);
 const installed=await git(folder,['rev-parse','HEAD']);
 await git(folder,['fetch','--quiet','origin','HEAD']);
 const commit=await git(folder,['rev-parse','FETCH_HEAD']);
 try{await git(folder,['merge-base','--is-ancestor',installed,commit]);}
 catch{throw Error('The installed branch has diverged. Resolve it manually before updating.');}
 const current=JSON.parse(await readFile(join(folder,'manifest.json'),'utf8'));
 const next=JSON.parse(await git(folder,['show',commit+':manifest.json']));
 if(next.id!=='arkane.screenhop'||typeof next.version!=='string')throw Error('The update is not a valid ScreenHop release.');
 return {status:'checked',installed,commit,currentVersion:current.version,version:next.version,available:installed!==commit,message:installed===commit?'ScreenHop '+current.version+' is up to date.':'ScreenHop '+next.version+' is available ('+commit.slice(0,7)+').'};
}
export async function installUpdate(folder,installed,commit){
 if(!/^[a-f0-9]{40}$/.test(installed||'')||!/^[a-f0-9]{40}$/.test(commit||''))throw Error('Check for updates and confirm the selected update first.');
 const latest=await checkUpdate(folder);
 if(latest.installed!==installed||latest.commit!==commit)throw Error('The installed or available commit changed. Check for updates again before installing.');
 if(latest.available)await git(folder,['merge','--ff-only',commit]);
 // Check in the installed environment. Never reset or discard user changes.
 try{await exec('omarchy',['plugin','validate',folder],{env,timeout:30000});}
 catch{throw Error('The update downloaded but plugin validation failed. The picker was not reloaded. Review the installation before using it.');}
 try{await exec('bash',[join(folder,'scripts/build-native.sh')],{env,timeout:180000,maxBuffer:2*1024*1024});}
 catch{throw Error('Source code is current, but building native previews failed. Install the build dependencies listed in README.md, then check for updates and choose Build native previews to retry. WebRTC remains available.');}
 return {status:'installed',version:latest.version,commit,message:'ScreenHop '+latest.version+' installed; native previews built. Choose Done to close this panel. Close and reopen existing previews when your work is saved.'};
}
async function progressFile(){return resolve(here,await git(here,['rev-parse','--git-path','screenhop-update.json']));}
async function saveProgress(value){const file=await progressFile(),temp=file+'.'+process.pid;await writeFile(temp,JSON.stringify(value),{mode:0o600});await rename(temp,file);}
async function main(args){
 if(args.length===1&&args[0]==='--check')return checkUpdate();
 if(args.length===1&&args[0]==='--progress'){
  try{return JSON.parse(await readFile(await progressFile(),'utf8'));}catch{return {status:'idle'};}
 }
 if(args.length===1&&args[0]==='--acknowledge'){
  await unlink(await progressFile()).catch(e=>{if(e.code!=='ENOENT')throw e;});return {status:'idle'};
 }
 if(args.length===3&&args[0]==='--install'){
  if(!args.slice(1).every(x=>/^[a-f0-9]{40}$/.test(x)))throw Error('Check for updates and confirm first.');
  await saveProgress({status:'installing',message:'Installing update…'});
  // The worker survives the old QML component being destroyed by a live reload.
  const child=spawn(process.execPath,[fileURLToPath(import.meta.url),'--worker',args[1],args[2]],{detached:true,stdio:'ignore',env});
  await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();
  return {status:'installing',message:'Installing update…'};
 }
 if(args.length===3&&args[0]==='--worker'){
  let result;
  try{
   const lock=await git(here,['rev-parse','--git-path','screenhop-update.lock']);
   const child=await exec('flock',['-n',resolve(here,lock),process.execPath,fileURLToPath(import.meta.url),'--install-locked',args[1],args[2]],{env,timeout:300000,maxBuffer:2*1024*1024});
   result=JSON.parse(child.stdout);
  }catch(error){
   try{result=JSON.parse(error.stdout);}catch{result={status:'error',message:'Update could not complete. Check connectivity, local changes and native build dependencies, then retry.'};}
  }
  await saveProgress(result);return result;
 }
 if(args.length===3&&args[0]==='--install-locked')return installUpdate(here,args[1],args[2]);
 throw Error('Choose --check or --install with the confirmed installed and target commits.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.log(JSON.stringify({status:'error',message:error.message}));process.exitCode=1;});
