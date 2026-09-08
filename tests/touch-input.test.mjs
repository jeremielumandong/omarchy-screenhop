import test from 'node:test';
import assert from 'node:assert/strict';
import {inputCommand} from '../preview-host.mjs';
test('touch input uses one bounded native finger and explicit release',()=>{
 const [method,params]=inputCommand({kind:'touch',type:'touchStart',x:900,y:-5},390,844);
 assert.equal(method,'Input.dispatchTouchEvent');
 assert.deepEqual(params.touchPoints,[{x:390,y:0,id:0,radiusX:1,radiusY:1,force:1}]);
 for(const type of ['touchEnd','touchCancel'])assert.deepEqual(inputCommand({kind:'touch',type},390,844)[1].touchPoints,[]);
 assert.throws(()=>inputCommand({kind:'touch',type:'mousePressed',x:1,y:1},390,844),/Invalid touch/);
 assert.throws(()=>inputCommand({kind:'touch',type:'touchMove',x:NaN,y:1},390,844),/Invalid input coordinate/);
});
