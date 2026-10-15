import {chromium} from "playwright";
import assert from "node:assert/strict";
import {mkdir,writeFile,readFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import path from "node:path";
import {startServer} from "../scripts/serve.mjs";
await mkdir("test-results",{recursive:true});
const server=await startServer(0);
const base="http://127.0.0.1:"+server.address().port;
const browser=await chromium.launch({headless:true,args:["--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--enable-unsafe-swiftshader"]});
const results=[],errors=[];
const monitor=page=>{
 page.on("pageerror",e=>errors.push(e.message));
 page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
};
const record=(name,details={})=>{results.push({name,status:"PASS",...details});console.log("PASS "+name);};
try{
 const ctx=await browser.newContext({viewport:{width:960,height:640}});
 let page=await ctx.newPage();monitor(page);
 await page.goto(base+"/mweb.html");
 await page.waitForFunction(()=>!document.getElementById("newgame").disabled,{},{timeout:30000});
 await page.selectOption("#mode","creative");
 await page.click("#newgame");
 await page.waitForFunction(()=>started&&meshes.size>0);
 await page.evaluate(()=>{running=false;player.pitch=.12;});
 await page.waitForFunction(()=>dirty.size===0);
 await page.screenshot({path:"test-results/world.png"});
 const preview=await page.screenshot({type:"jpeg",quality:45});
 console.log("VISUAL_JPEG:"+preview.toString("base64"));
 record("Create seeded world, boot WebAssembly and render textured chunks");
 const original=await page.evaluate(()=>snapshot());
 const physics=await page.evaluate(()=>{
  const out=[];
  const check=(name,fn)=>{fn();out.push(name);};
  const ok=(v,m)=>{if(!v)throw Error(m);};
  const reset=()=>{
   running=false;dead=false;mode="survival";dimension=0;difficulty="peaceful";
   blocks.fill(0);edits={};blockStates={};drops=[];particles=[];mobs=[];
   fluidQueue=[];fallQueue=[];crops=[];mobWorlds={};simulationWorlds={};
   for(let z=0;z<N;z++)for(let x=0;x<N;x++){vox.set(x,0,z,23);vox.set(x,5,z,3);}
   player={x:10.5,y:6,z:10.5,yaw:0,pitch:0,vy:0};
   keys={};health=20;hunger=20;flying=false;damageCooldown=0;
   foodClock=0;timer=0;day=90;bag={};durability={};selected=0;hotbar=[2,5,7,20,32,42,45,22,16];
   resetMotion();
  };
  check("Ground stability, jump height and landing",()=>{
   reset();let low=99,high=0;
   for(let i=0;i<240;i++){updatePlayer(1/120);low=Math.min(low,player.y);high=Math.max(high,player.y);}
   ok(Math.abs(player.y-6)<.001&&high-low<.001,"Ground jitter");
   keys.Space=true;updatePlayer(1/120);keys.Space=false;let peak=player.y;
   for(let i=0;i<180;i++){updatePlayer(1/120);peak=Math.max(peak,player.y);}
   ok(peak>7.1&&peak<7.5&&Math.abs(player.y-6)<.001,"Jump/landing: "+peak+"/"+player.y);
  });
  check("Wall/head collisions; creative flight collides, spectator passes",()=>{
   reset();vox.set(12,6,10,3);vox.set(12,7,10,3);
   moveAxis("x",4);ok(player.x>11.69&&player.x<=11.70001,"Wall penetration");
   player.x=10.5;mode="creative";flying=true;moveAxis("x",4);
   ok(player.x<=11.70001,"Creative flight clipping");
   mode="spectator";moveAxis("x",2);ok(player.x>13,"Spectator blocked");
   reset();vox.set(10,8,10,3);player.vy=8;moveAxis("y",3);
   ok(player.y<=6.20001&&player.vy===0,"Head clipping");
  });
  check("Crouch ledge protection and sprint speed",()=>{
   reset();for(let x=11;x<N;x++)vox.set(x,5,10,0);
   crouching=true;onGround=true;moveAxis("x",2);
   ok(player.x<11.31,"Sneak fell off ledge");
   reset();keys.KeyW=true;
   for(let i=0;i<60;i++)updatePlayer(1/60);
   const walk=player.z-10.5;
   reset();keys.KeyW=true;keys.ControlLeft=true;
   for(let i=0;i<60;i++)updatePlayer(1/60);
   ok(player.z-10.5>walk*1.2,"Sprint not faster");
  });
  check("Swimming breath is independent of hunger; drowning after air expires",()=>{
   reset();for(let y=6;y<=8;y++)vox.set(10,y,10,8);foodClock=20;
   for(let i=0;i<120;i++){damageCooldown=0;updatePlayer(1/60);}
   ok(health===20&&breath>7,"Early drowning");
   for(let i=0;i<600;i++){damageCooldown=0;updatePlayer(1/60);}
   ok(health<20&&hunger===20,"No drowning or shared hunger timer");
  });
  check("Fall damage, safe spawn and no one-block auto climb",()=>{
   reset();player.y=14;resetMotion();
   for(let i=0;i<240;i++){damageCooldown=Math.max(0,damageCooldown-1/120);updatePlayer(1/120);}
   ok(health<20&&Math.abs(player.y-6)<.001,"Fall damage");
   reset();vox.set(10,6,10,3);ensureSafePosition();
   ok(!collide(player.x,player.y,player.z,1.8),"Spawn trapped in terrain");
   reset();vox.set(11,6,10,3);moveAxis("x",2);
   ok(player.x<=10.7001&&player.y===6,"Auto-climbed full block");
  });
  check("Ray picking, timed mining, particles, physical drops and pickup",()=>{
   reset();vox.set(10,7,13,5);lookHit=raycast();
   ok(lookHit?.id===5&&lookHit.cell[2]===13,"Ray miss");
   mining=true;hitMob=null;mineTick(.2);ok(get(10,7,13)===5,"Instant survival mining");
   mineTick(1);ok(get(10,7,13)===0&&drops.some(d=>d.id===5)&&particles.length===10,"Mining drop missing");
   ok(amount(5)===0,"Drop was credited before pickup");
   Object.assign(drops[0],{x:10.5,y:6.7,z:10.5,age:.6,vy:0});
   updateDrops(.01);ok(amount(5)===1&&drops.length===0,"Pickup failed");mining=false;
  });
  check("Place on selected face and preserve directional block state",()=>{
   reset();vox.set(10,7,13,3);hotbar[0]=5;bag[5]=2;running=true;
   placeBlock();running=false;
   ok(get(10,7,12)===5&&amount(5)===1,"Placement failed");
   ok(blockStates[0]["10,7,12"].axis==="z","Log axis wrong");
   vox.set(10,7,12,0);hotbar[0]=46;bag[46]=1;running=true;placeBlock();running=false;
   ok(blockStates[0]["10,7,12"].facing===5,"Furnace faces away from player");
   player.z=12.1;hotbar[0]=3;bag[3]=1;vox.set(10,7,12,0);
   running=true;placeBlock();running=false;
   ok(get(10,7,12)===0&&bag[3]===1,"Block placed inside player");
  });
  check("Crafting button spends ingredients and grants output",()=>{
   reset();bag[5]=1;renderInventory();
   document.querySelector("#recipes button").click();
   ok(amount(5)===0&&amount(7)===4,"Crafting did not mutate inventory");
  });
  check("Chunk boundaries update neighboring geometry and stream out far chunks",()=>{
   reset();player.x=15.8;moveAxis("x",.5);ok(player.x>16,"Chunk boundary collision");
   dirty.clear();change(15,6,15,3);
   ok(["0,0","1,0","0,1","1,1"].every(k=>dirty.has(k)),"Missing diagonal AO/chunk invalidation");
   viewDistance=32;rebuildAll();for(const k of [...dirty]){const[x,z]=k.split(",").map(Number);buildChunk(x,z);}
   dirty.clear();const before=meshes.size;player.x=90;player.z=90;window.voxelGraphics.maintainChunks();
   ok(!meshes.has("0,0")&&before>0,"Far chunk not unloaded");
  });
  check("Texture atlas, native face masks, face-specific maps and WebGL draw",()=>{
   reset();viewDistance=56;rebuildAll();buildChunk(0,0);buildChunk(1,0);
   const gfx=window.voxelGraphics;const atlas=gfx.atlas();
   ok(atlas.length===256*256*4&&gfx.tiles.length<=256,"Atlas size");
   ok(gfx.map[1][0]!==gfx.map[1][1],"Grass faces identical");
   const t=gfx.blockFaceTiles(5,{axis:"x"});ok(t[2]===t[3]&&t[2]!==t[0],"Horizontal log ends");
   vox.set(10,7,12,19);vox.set(11,7,12,8);buildChunk(0,0);
   render();ok(gl.getError()===gl.NO_ERROR,"WebGL error");
  });
  return out;
 });
 physics.forEach(name=>record(name));
 // Exercise the actual keyboard and pointer event handlers against a controlled world.
 await page.evaluate(()=>{
  mode="creative";running=true;menuOpen=false;invOpen=false;flying=false;
  player={x:30.5,y:6,z:30.5,yaw:0,pitch:0,vy:0};resetMotion();
 });
 await page.keyboard.press("Space");await page.keyboard.press("Space");
 assert.equal(await page.evaluate(()=>flying),true);
 await page.waitForTimeout(300);
 await page.keyboard.press("Space");await page.keyboard.press("Space");
 assert.equal(await page.evaluate(()=>flying),false);
 await page.keyboard.press("w");await page.keyboard.down("w");
 await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>sprinting&&sprintLatch),true);
 await page.keyboard.up("w");
 assert.equal(await page.evaluate(()=>sprintLatch),false);
 record("Keyboard: double Space toggles creative flight, double W sprints and release cancels");
 await page.evaluate(()=>{
  running=true;mode="survival";hotbar[0]=2;selected=0;offhand=0;bag={2:65};drops=[];
 });
 await page.keyboard.press("f");
 assert.deepEqual(await page.evaluate(()=>[hotbar[0],offhand]),[0,2]);
 await page.keyboard.press("f");
 await page.keyboard.press("q");await page.keyboard.press("Control+q");
 assert.deepEqual(await page.evaluate(()=>[amount(2),drops.reduce((n,d)=>n+d.n,0)]),[0,65]);
 assert.equal(await page.evaluate(()=>drops.every(d=>d.pickupDelay===1.2)),true);
 record("Keyboard: F swaps hands, Q drops one and Ctrl Q drops up to 64");
 await page.evaluate(()=>{
  running=true;mode="creative";resetMotion();player.x=10.5;player.y=6;player.z=10.5;player.yaw=0;player.pitch=0;
  for(let z=11;z<16;z++)vox.set(10,7,z,0);
  vox.set(10,7,14,5);hotbar[0]=2;selected=0;
 });
 await page.mouse.click(480,320,{button:"middle"});
 assert.equal(await page.evaluate(()=>hotbar[selected]),5);
 await page.evaluate(()=>{mode="survival";hotbar[0]=3;bag={3:5};running=true;});
 await page.mouse.down({button:"right"});
 const placed=await page.evaluate(()=>{
  tickUse(.21);tickUse(.21);
  const result=[get(10,7,13),get(10,7,12),get(10,7,11),amount(3)];
  return result;
 });
 await page.mouse.up({button:"right"});
 assert.deepEqual(placed,[3,3,3,2]);
 assert.equal(await page.evaluate(()=>using),false);
 record("Mouse: middle click picks block; held right click repeats placement and release stops");
 await page.evaluate(()=>{
  running=true;hotbar[0]=42;bag={42:2};hunger=10;offhand=0;
 });
 await page.mouse.down({button:"right"});
 assert.equal(await page.evaluate(()=>{tickUse(.5);return amount(42);}),2);
 await page.mouse.up({button:"right"});
 assert.equal(await page.evaluate(()=>eating===null),true);
 await page.mouse.down({button:"right"});
 assert.deepEqual(await page.evaluate(()=>{tickUse(1.61);return[amount(42),hunger];}),[1,14]);
 await page.mouse.up({button:"right"});
 await page.evaluate(()=>{
  running=true;hotbar[0]=0;offhand=42;hunger=10;bag={42:1};beginUse();tickUse(1.61);endUse();
  const s=snapshot();validate(s);if(s.offhand!==42||s.hotbar[0]!==0||hunger!==14)throw Error("Offhand use/save failed");
 });
 record("Held use: eating takes time, release cancels, offhand works and is saved");
 await page.keyboard.press("F1");
 assert.equal(await page.evaluate(()=>hudHidden&&document.getElementById("hud").style.display==="none"),true);
 await page.keyboard.press("F1");await page.keyboard.press("F3");
 assert.equal(await page.evaluate(()=>debugShown&&document.getElementById("info").style.display==="block"),true);
 await page.evaluate(()=>{
  settings.sensitivity=1.5;settings.invertY=true;settings.fov=85;saveSettings();syncSettings();
  player.yaw=0;player.pitch=0;look(100,100);
  if(Math.abs(player.yaw+.45)>1e-5||Math.abs(player.pitch+.45)>1e-5)throw Error("Look settings ignored");
  resetControls();if(using||mining||keys.Space)throw Error("Stuck input");
 });
 record("HUD toggles, adjustable FOV/sensitivity/inverted look and input reset");
 await page.evaluate(s=>{loadGame(s);running=false;resetControls();hudHidden=false;debugShown=false;
  settings.fov=70;settings.sensitivity=1;settings.invertY=false;syncSettings();updateHud();
 },original);
 await page.waitForFunction(()=>dirty.size===0);
 const profiles=[];
 for(const profile of[0,1,2]){
  profiles.push(await page.evaluate(profile=>{
   setShaderProfile(profile);render();
   const p=new Uint8Array(gl.canvas.width*gl.canvas.height*4);
   gl.readPixels(0,0,gl.canvas.width,gl.canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,p);
   let hash=2166136261;for(let i=0;i<p.length;i+=4)hash=Math.imul(hash^p[i]^p[i+1]^p[i+2],16777619);
   const error=gl.getError();return{...window.voxelGraphics.diagnostics(),hash,error};
  },profile));
  await page.screenshot({path:"test-results/shader-"+profile+".png"});
 }
 assert(profiles.every(p=>p.error===0&&p.stride===52));
 assert.equal(profiles[0].framebuffer,false);assert.equal(profiles[1].framebuffer,false);
 assert.equal(profiles[2].postActive,true);assert.equal(profiles[2].postFailed,false);
 assert.equal(new Set(profiles.map(p=>p.hash)).size,3);
 record("Three real shader profiles render distinct pixels, cinematic framebuffer complete, no WebGL errors",{profiles});
 const shaderPreview=await page.screenshot({type:"jpeg",quality:55});
 console.log("SHADER_JPEG:"+shaderPreview.toString("base64"));
 await page.evaluate(()=>{
  const before={...player};const oldDay=day,oldTimer=timer;
  for(let x=8;x<=14;x++)for(let z=14;z<=20;z++)vox.set(x,24,z,8);
  player={x:11.5,y:26,z:11.5,yaw:0,pitch:.65,vy:0};day=150;buildChunk(0,0);buildChunk(0,1);render();
  if(gl.getError())throw Error("Water shader error");
  timer+=2;day=450;render();if(gl.getError())throw Error("Night shader error");
  player=before;day=oldDay;timer=oldTimer;
 });
 record("Water normals/reflection and day/night shader paths render without GL errors");
 await page.evaluate(()=>{
  const ext=gl.getExtension("WEBGL_lose_context");if(!ext)throw Error("Context-loss extension unavailable");
  ext.loseContext();setTimeout(()=>ext.restoreContext(),150);
 });
 await page.waitForFunction(()=>!gl.isContextLost()&&menuOpen,{},{timeout:15000});
 await page.waitForFunction(()=>meshes.size>0);
 assert.equal(await page.evaluate(()=>{render();return gl.getError();}),0);
 record("WebGL context restore rebuilds textures, buffers and cinematic render targets");

 await page.evaluate(s=>{if(!loadGame(s))throw Error("Restore failed");running=false;},original);
 const saved=await page.evaluate(()=>{
  mode="survival";running=false;
  change(40,40,40,46);
  blockStates[0]={"40,40,40":{facing:3}};
  bag[5]=13;hotbar[0]=5;
  drops=[{id:4,n:2,x:39.5,y:40,z:40.5,vy:0,age:2,dim:0}];
  crops=[{x:41,y:40,z:40,at:timer,dim:0}];change(41,40,40,54);
  fluidQueue=[[42,40,40,6]];change(42,40,40,8);
  mobs=[{x:44.5,y:40,z:44.5,hp:5,hostile:false,phase:0,attack:0,kind:"pig"}];
  saveGame(false);const s=snapshot();validate(s);return s;
 });
 await page.close();
 page=await ctx.newPage();monitor(page);await page.goto(base+"/mweb.html");
 await page.waitForFunction(()=>!document.getElementById("continue").disabled);
 assert.equal(await page.evaluate(()=>settings.shaders),2);
 await page.click("#continue");
 await page.waitForFunction(()=>started);
 const recovered=await page.evaluate(()=>{
  running=false;return{bag:bag[5],block:get(40,40,40),facing:blockStates[0]["40,40,40"].facing,
   drops:drops.length,crops:crops.length,queue:fluidQueue.length,pig:mobs.find(m=>m.kind==="pig")?.hp};
 });
 assert.deepEqual(recovered,{bag:13,block:46,facing:3,drops:1,crops:1,queue:1,pig:5});
 record("Save, close page and recover inventory, edits, orientation, mobs, crops and queued fluid");
 const compatibility=await page.evaluate(s=>{
  const v1={...s,version:1};delete v1.terrainVersion;
  if(!loadGame(v1)||terrainVersion!==1)throw Error("Legacy save failed");
  running=false;
  const bad={...s,blockStates:{"0":{"40,40,40":{facing:90}}}};
  let rejected=false;try{validate(bad);}catch{rejected=true;}
  if(!rejected)throw Error("Invalid orientation accepted");
  loadGame(s);running=false;
  switchDimension(1);running=false;change(30,40,30,7);
  switchDimension(0);running=false;
  if(get(40,40,40)!==46||!mobs.some(m=>m.kind==="pig"&&m.hp===5))throw Error("Dimension persistence failed");
  switchDimension(1);running=false;if(get(30,40,30)!==7)throw Error("Nether edit lost");
  return true;
 },saved);
 assert(compatibility);record("Legacy saves, malformed imports and dimension state");
 await page.evaluate(()=>{mode="survival";bag={5:2};health=1;damageCooldown=0;damage(2);});
 assert.equal(await page.locator("#resume").textContent(),"Reaparecer");
 await page.click("#resume");
 assert.equal(await page.evaluate(()=>health===20&&!dead&&!collide(player.x,player.y,player.z)),true);
 record("Death screen and safe respawn");
 const exported=await page.evaluate(()=>portableHtml||capturePortableHtml());
 assert(exported.endsWith("</html>")||exported.trim().endsWith("</html>"));
 assert.equal((exported.match(/data-runtime=/g)||[]).length,0);
 await writeFile("test-results/exported.html",exported);
 const filePage=await ctx.newPage();monitor(filePage);
 await filePage.goto(pathToFileURL(path.resolve("test-results/exported.html")).href);
 await filePage.waitForFunction(()=>!document.getElementById("newgame").disabled);
 record("Downloaded HTML starts directly from file://");
 const organized=await ctx.newPage();monitor(organized);
 await organized.goto(base+"/dist/organized/index.html");
 await organized.waitForFunction(()=>!document.getElementById("newgame").disabled);
 record("Organized build loads compiled engine.wasm through HTTP");
 await organized.close();await filePage.close();await ctx.close();

 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 const touch=await mobile.newPage();monitor(touch);
 await touch.goto(base+"/mweb.html");
 await touch.waitForFunction(()=>!document.getElementById("newgame").disabled);
 await touch.selectOption("#mode","creative");await touch.tap("#newgame");
 await touch.waitForFunction(()=>started&&running);
 await touch.evaluate(()=>{
  for(let x=5;x<20;x++)for(let z=5;z<20;z++)for(let y=1;y<14;y++)vox.set(x,y,z,y===5?3:0);
  player={x:10.5,y:6,z:10.5,yaw:0,pitch:0,vy:0};resetMotion();rebuildAll();
 });
 const cdp=await mobile.newCDPSession(touch);
 const up=await touch.locator("#up").boundingBox();
 const point={x:up.x+up.width/2,y:up.y+up.height/2,id:1};
 await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[point]});
 await touch.waitForTimeout(350);
 await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
 assert(await touch.evaluate(()=>player.z>10.7&&!keys.KeyW));
 await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:330,y:220,id:2}]});
 await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:290,y:250,id:2}]});
 await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
 assert(await touch.evaluate(()=>Math.abs(player.yaw)>.05&&player.pitch>.03&&!lookTouch));
 await touch.tap("#crouch");
 assert.equal(await touch.evaluate(()=>!!keys.ShiftLeft),false);
 await touch.locator("#hotbar button").nth(2).tap();
 assert.equal(await touch.evaluate(()=>selected),2);
 assert.equal(await touch.evaluate(()=>scrollX===0&&scrollY===0),true);
 await touch.screenshot({path:"test-results/mobile.png"});
 record("Emulated mobile touch: movement, camera, release, hotbar selection, no page scroll");
 await mobile.close();
 assert.deepEqual(errors,[],"Browser console errors");
 record("No uncaught exceptions or console errors");
}catch(error){
 results.push({name:"Failure",status:"FAIL",error:error.stack});console.error(error);
 process.exitCode=1;
}finally{
 await writeFile("test-results/report.json",JSON.stringify({results,errors},null,2));
 await browser.close();await new Promise(resolve=>server.close(resolve));
 console.log("TEST_REPORT:"+JSON.stringify({results,errors}));
}
