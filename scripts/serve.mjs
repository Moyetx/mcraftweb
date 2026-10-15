import http from "node:http";
import {readFile,stat} from "node:fs/promises";
import path from "node:path";
const root=path.resolve(process.argv[2]||".");
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".wasm":"application/wasm",".json":"application/json"};
export function startServer(port=8080){
 const server=http.createServer(async(req,res)=>{
  try{
   const name=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
   let file=path.resolve(root,"."+name);
   if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
   if((await stat(file)).isDirectory())file=path.join(file,file===root?"mweb.html":"index.html");
   const bytes=await readFile(file);
   res.writeHead(200,{"Content-Type":mime[path.extname(file)]||"application/octet-stream","Cache-Control":"no-store"});
   res.end(bytes);
  }catch{res.writeHead(404);res.end("Not found");}
 });
 return new Promise(resolve=>server.listen(port,"127.0.0.1",()=>resolve(server)));
}
if(process.argv[1]&&path.resolve(process.argv[1])===new URL(import.meta.url).pathname){
 await startServer(Number(process.env.PORT)||8080);
 console.log("Abre http://127.0.0.1:8080/mweb.html");
}
