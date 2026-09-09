import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '../independent-browser.mjs';
test('native launcher validates websites and dimensions',()=>{
 const device=parse(['--device','custom','--url','example.com','--width','768','--height','900','--landscape']);
 assert.equal(device.width,900);assert.equal(device.height,768);
 for(const url of ['file:///etc/passwd','javascript://example.com','https://user:pass@example.com']) assert.throws(()=>parse(['--device','iphone-se','--url',url]));
 assert.throws(()=>parse(['--device','iphone-se','--url','example.com','--linked']));
 assert.throws(()=>parse(['--device','custom','--url','example.com','--width','-1','--height','900']));
});
