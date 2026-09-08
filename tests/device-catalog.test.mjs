import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const devices=JSON.parse(await readFile(new URL('../devices.json',import.meta.url)));
test('current device catalog has stable legacy selections and explicit viewport estimates',()=>{
 assert.equal(devices.length,103);assert.equal(new Set(devices.map(d=>d.id)).size,devices.length);
 assert.deepEqual(devices.slice(0,3).map(d=>d.id),['iphone-se','iphone-12-mini','iphone-13']);
 for(const d of devices.slice(66)){
  assert.ok(d.width>0&&d.height>0&&d.dpr>0,d.id);
  assert.equal(d.viewportApproximate,true,d.id);assert.match(d.name,/approximate/);
  assert.equal(d.width,Math.round(d.physicalWidth/d.dpr),d.id);
  assert.equal(d.height,Math.round(d.physicalHeight/d.dpr),d.id);
  assert.equal(new URL(d.source).protocol,'https:');
 }
});
test('supplied skin geometry matches unmodified PNG dimensions and every selected color exists',async t=>{
 const skins=devices.filter(d=>d.skinAsset);if(!skins.length){t.skip('Public package uses original CSS frames without vendor assets');return;}assert.equal(skins.length,11);assert.equal(skins.reduce((n,d)=>n+d.skinAsset.colors.length,0),23);
 for(const {id,skinAsset:a} of skins){
  assert.equal(a.id,id);assert.ok(a.colors.some(c=>c.file===a.defaultColor));
  const c=a.crop;assert.ok(c.x>=0&&c.y>=0&&c.x+c.width<=a.canvasWidth&&c.y+c.height<=a.canvasHeight,id);
  assert.ok(c.x<=a.screenX&&c.y<=a.screenY&&c.x+c.width>=a.screenX+a.screenWidth&&c.y+c.height>=a.screenY+a.screenHeight,id);
  for(const file of [a.foreground,...a.colors.map(c=>c.file)]){
   const b=await readFile(new URL('../assets/skins/'+id+'/'+file,import.meta.url));
   assert.equal(b.subarray(1,4).toString(),'PNG');
   assert.equal(b.readUInt32BE(16),file===a.foreground?a.screenWidth:a.canvasWidth,id+file);
   assert.equal(b.readUInt32BE(20),file===a.foreground?a.screenHeight:a.canvasHeight,id+file);
  }
 }
});
