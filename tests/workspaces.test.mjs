import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,stat,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {validateWorkspace,saveWorkspace,readWorkspaces,main} from '../workspaces.mjs';
const previews=[{device:'iphone-13',url:'https://omarchy.org',landscape:true}];
test('workspaces preserve orientation and custom dimensions but never restore authentication transactions',()=>{
 assert.equal(validateWorkspace({previews}).previews[0].landscape,true);
 assert.equal(validateWorkspace({previews:[{device:'custom',width:420,height:900,dpr:2,mobile:true,url:'localhost:3000'}]}).previews[0].url,'http://localhost:3000/');
 for(const url of ['https://example.test/callback?code=secret','https://example.test/#access_token=secret','https://login.microsoftonline.com/tenant','https://user:pass@example.test','file:///tmp/test'])assert.throws(()=>validateWorkspace({previews:[{device:'iphone-13',url}]}));
 assert.throws(()=>validateWorkspace({previews:[]}));
 assert.throws(()=>validateWorkspace({previews:Array(33).fill(previews[0])}));
 assert.equal('linked' in validateWorkspace({previews,linked:true}),false);
});
test('workspace storage is private and duplicate names never overwrite a saved device set',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'screenhop-workspaces-'));t.after(()=>rm(dir,{recursive:true,force:true}));const file=join(dir,'nested','workspaces.json');
 assert.deepEqual((await readWorkspaces(file)).items,[]);
 await saveWorkspace(file,'Mobile',{previews});
 assert.equal((await stat(file)).mode&0o777,0o600);
 assert.equal((await stat(join(dir,'nested'))).mode&0o777,0o700);
 const before=await readFile(file,'utf8');
 await assert.rejects(saveWorkspace(file,'Mobile',{previews}),/already exists/);
 assert.equal(await readFile(file,'utf8'),before);
 assert.deepEqual(await main(['--list','--storage',file]),{status:'workspaces',names:['Mobile']});
 await assert.rejects(main(['--apply-update','--state',dir]),/Confirm closing/);
});
