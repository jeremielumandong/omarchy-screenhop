import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {main} from '../workspaces.mjs';
import {rpc} from '../viewport.mjs';
const exec=promisify(execFile);
test('live workspace snapshot preserves rotated and custom devices; batch export writes valid PNGs',async t=>{
 const state=await mkdtemp('/tmp/screenhop-workspace-browser-');const storage=state+'/workspaces.json';
 const server=createServer((req,res)=>res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><h1>Workspace fixture</h1>'));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{await rpc(state+'/controller.sock',{close:true}).catch(()=>{});server.close();});
 const run=(...args)=>exec(process.execPath,[new URL('../viewport.mjs',import.meta.url).pathname,'--state',state,'--headless',...args],{timeout:45000});
 await run('--device','iphone-13','--landscape','--url',url);
 await run('--device','custom','--width','420','--height','900','--dpr','2','--mobile','--url',url);
 const saved=await main(['--save','Fixture','--state',state,'--storage',storage]);assert.deepEqual(saved.names,['Fixture']);
 const data=JSON.parse(await readFile(storage,'utf8')).items[0];assert.equal(data.previews[0].landscape,true);assert.equal(data.previews[1].device,'custom');assert.equal(data.previews[1].width,420);
 const info=await main(['--status','--state',state]);assert.equal(info.updateAvailable,false);assert.equal(info.installed,info.running);
 const batch=await main(['--batch','--page-only','--state',state,'--output',state+'/exports']);assert.equal(batch.count,2);
 const files=await readdir(batch.directory);assert.equal(files.length,2);
 for(const file of files){const png=await readFile(batch.directory+'/'+file);assert.equal(png.subarray(1,4).toString(),'PNG');}
 await main(['--restore','Fixture','--state',state,'--storage',storage]);
 const restored=await rpc(state+'/controller.sock',{snapshot:true});assert.equal(restored.previews.length,4);
 assert.equal((await rpc(state+'/controller.sock',{status:true})).enabled,false);
});
