import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join} from 'node:path';
import {checkUpdate,installUpdate} from '../plugin-update.mjs';
const exec=promisify(execFile);
async function fixture(t){
 const root=await mkdtemp('/tmp/screenhop-update-test-');t.after(()=>rm(root,{recursive:true,force:true}));
 const upstream=join(root,'upstream'),installed=join(root,'installed');await mkdir(upstream);
 const git=async (folder,...args)=>(await exec('git',['-C',folder,...args])).stdout.trim();
 await git(upstream,'init','-b','main');await git(upstream,'config','user.email','test@example.invalid');await git(upstream,'config','user.name','Test');
 await writeFile(join(upstream,'plugin-update.mjs'),await readFile(new URL('../plugin-update.mjs',import.meta.url)));
 const manifest=JSON.parse(await readFile(new URL('../manifest.json',import.meta.url),'utf8'));
 await writeFile(join(upstream,'manifest.json'),JSON.stringify(manifest));await writeFile(join(upstream,'Widget.qml'),'import QtQuick\nItem {}\n');
 await writeFile(join(upstream,'.gitignore'),'.native/\n');
 await mkdir(join(upstream,'scripts'));await writeFile(join(upstream,'scripts/build-native.sh'),'#!/bin/sh\nmkdir -p "'+join(installed,'.native')+'"\nprintf built > "'+join(installed,'.native/rebuilt')+'"\n');
 await git(upstream,'add','.');await git(upstream,'commit','-m','initial');await exec('git',['clone',upstream,installed]);
 const advance=async()=>{manifest.version='1.0.99';await writeFile(join(upstream,'manifest.json'),JSON.stringify(manifest));await git(upstream,'add','.');await git(upstream,'commit','-m','update');};
 return {root,installed,upstream,git,advance};
}
test('checks and installs the confirmed commit without closing previews',async t=>{
 const f=await fixture(t);assert.equal((await checkUpdate(f.installed)).available,false);
 await f.advance();const checked=await checkUpdate(f.installed);assert.equal(checked.version,'1.0.99');assert.equal(checked.available,true);
 const done=await installUpdate(f.installed,checked.installed,checked.commit);assert.equal(done.status,'installed');assert.equal(await readFile(join(f.installed,'.native/rebuilt'),'utf8'),'built');assert.equal(await f.git(f.installed,'rev-parse','HEAD'),checked.commit);
});
test('refuses copied installs, local changes, and a target changed after confirmation',async t=>{
 const f=await fixture(t);await assert.rejects(checkUpdate(f.root),/copied installation/);
 await f.advance();const checked=await checkUpdate(f.installed);
 await writeFile(join(f.installed,'Widget.qml'),'local edit');await assert.rejects(installUpdate(f.installed,checked.installed,checked.commit),/Local changes/);
 assert.equal(await readFile(join(f.installed,'Widget.qml'),'utf8'),'local edit');
 await f.git(f.installed,'restore','Widget.qml');await writeFile(join(f.upstream,'new-file'),'changed');await f.git(f.upstream,'add','.');await f.git(f.upstream,'commit','-m','later');
 await assert.rejects(installUpdate(f.installed,checked.installed,checked.commit),/commit changed/);
 assert.equal(await f.git(f.installed,'rev-parse','HEAD'),checked.installed);
});
test('rebuilds an existing native host after an update',async t=>{
 const f=await fixture(t);await mkdir(join(f.installed,'.native'));await writeFile(join(f.installed,'.native/screenhop-native'),'fixture');
 await f.advance();const checked=await checkUpdate(f.installed);
 // The build script uses its own directory in production; use an absolute fixture marker.
 await writeFile(join(f.upstream,'scripts/build-native.sh'),'#!/bin/sh\nprintf built > "'+join(f.installed,'.native/rebuilt')+'"\n');await f.git(f.upstream,'add','.');await f.git(f.upstream,'commit','-m','build');
 const latest=await checkUpdate(f.installed);await installUpdate(f.installed,latest.installed,latest.commit);
 assert.equal(await readFile(join(f.installed,'.native/rebuilt'),'utf8'),'built');
});

test('detached worker finishes after the launching process exits and exposes completion',async t=>{
 const f=await fixture(t);await f.advance();const checked=await checkUpdate(f.installed);
 const run=async args=>JSON.parse((await exec(process.execPath,[join(f.installed,'plugin-update.mjs'),...args])).stdout);
 assert.equal((await run(['--install',checked.installed,checked.commit])).status,'installing');
 let result;for(let i=0;i<60;i++){result=await run(['--progress']);if(result.status!=='installing')break;await new Promise(r=>setTimeout(r,100));}
 assert.equal(result.status,'installed',JSON.stringify(result));assert.equal(await f.git(f.installed,'rev-parse','HEAD'),checked.commit);
 await run(['--acknowledge']);assert.equal((await run(['--progress'])).status,'idle');
});

test('builds native previews even when no source update is available',async t=>{
 const f=await fixture(t);const checked=await checkUpdate(f.installed);assert.equal(checked.available,false);
 await installUpdate(f.installed,checked.installed,checked.commit);
 assert.equal(await readFile(join(f.installed,'.native/rebuilt'),'utf8'),'built');
 assert.equal(await f.git(f.installed,'rev-parse','HEAD'),checked.installed);
});
test('build failure reports a retry without deleting the existing native binary',async t=>{
 const f=await fixture(t);await mkdir(join(f.installed,'.native'));await writeFile(join(f.installed,'.native/screenhop-native'),'previous binary');
 await writeFile(join(f.upstream,'scripts/build-native.sh'),'#!/bin/sh\nexit 1\n');await f.git(f.upstream,'add','.');await f.git(f.upstream,'commit','-m','missing dependency fixture');
 const checked=await checkUpdate(f.installed);
 await assert.rejects(installUpdate(f.installed,checked.installed,checked.commit),/Build native previews to retry/);
 assert.equal(await readFile(join(f.installed,'.native/screenhop-native'),'utf8'),'previous binary');
 assert.equal(await f.git(f.installed,'rev-parse','HEAD'),checked.commit);
});
