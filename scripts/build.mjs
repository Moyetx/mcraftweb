import {readFile,mkdir,writeFile} from "node:fs/promises";
import vm from "node:vm";
import assert from "node:assert/strict";
import wabtFactory from "wabt";
const html=await readFile("mweb.html","utf8");
const js=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const css=html.match(/<style>([\s\S]*?)<\/style>/)[1];
new vm.Script(js);
const builder=js.slice(js.indexOf("function createVoxelModule"),js.indexOf("const $=id"));
const embedded=vm.runInNewContext(builder+";createVoxelModule()");
assert(WebAssembly.validate(embedded),"Embedded WASM must validate");
const wabt=await wabtFactory();
const source=await readFile("engine/engine.wat","utf8");
const parsed=wabt.parseWat("engine.wat",source);parsed.resolveNames();parsed.validate();
const compiled=parsed.toBinary({}).buffer;parsed.destroy();
const a=(await WebAssembly.instantiate(embedded)).instance.exports;
const b=(await WebAssembly.instantiate(compiled)).instance.exports;
for(const e of[a,b]){
 e.set(15,12,15,3);e.set(16,12,15,19);e.set(14,12,15,6);e.set(15,13,15,3);
}
for(let x=-1;x<=96;x++)for(let z=-1;z<=96;z++){
 assert.equal(a.hash(x,z,951),b.hash(x,z,951));
 for(const y of[-1,0,12,13,47,48]){
  assert.equal(a.get(x,y,z),b.get(x,y,z));
  assert.equal(a.faceMask(x,y,z),b.faceMask(x,y,z));
 }
}
assert.equal(a.gravity(8,.25),1);assert.equal(a.gravity(8,.25),b.gravity(8,.25));
const porous=new Set([0,6,8,11,16,17,19,22,28,31,54,59,60]);
const dirs=[[0,1,0],[0,-1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]];
for(const id of[0,1,3,6,8,11,16,19,22,28,31,54,59,60])for(let other=0;other<=60;other++){
 a.set(40,20,40,id);dirs.forEach(([x,y,z])=>a.set(40+x,20+y,40+z,other));
 const expected=id&&id!==other&&porous.has(other)?63:0;
 assert.equal(a.faceMask(40,20,40),expected,id+"/"+other);
}
await mkdir("dist/organized",{recursive:true});
await writeFile("dist/voxel-atlas-completo.html",html);
let organizedJs=js.replace(builder,"").replace(
 "WebAssembly.instantiate(createVoxelModule())",
 'WebAssembly.instantiate(await (await fetch("engine.wasm")).arrayBuffer())'
);
organizedJs+=[
 '\ndocument.addEventListener("DOMContentLoaded",()=>{',
 'document.getElementById("download").onclick=async()=>{',
 'try{const r=await fetch("../voxel-atlas-completo.html");',
 'if(!r.ok)throw Error("No se encontró el HTML portable");',
 'download(await r.text(),"text/html;charset=utf-8","voxel-atlas-completo.html");',
 '}catch(e){toast(e.message);}};},{once:true});'
].join("\n");
const index=html.replace(/<style>[\s\S]*?<\/style>/,'<link rel="stylesheet" href="style.css">')
 .replace(/<script>[\s\S]*?<\/script>/,'<script defer src="game.js"></script>');
await writeFile("dist/organized/index.html",index);
await writeFile("dist/organized/game.js",organizedJs);
await writeFile("dist/organized/style.css",css);
await writeFile("dist/organized/engine.wasm",compiled);
await writeFile("dist/organized/engine.wat",source);
console.log(JSON.stringify({test:"WASM source/binary parity, bounds, hash, gravity, 854 face cases",status:"PASS",embeddedBytes:embedded.length,compiledBytes:compiled.length}));
