const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const types={'/index.html':'text/html; charset=utf-8','/style.css':'text/css; charset=utf-8','/mobile.css':'text/css; charset=utf-8','/levels.css':'text/css; charset=utf-8','/game.js':'text/javascript; charset=utf-8'};
Object.assign(types,{'/assets/cat-gouache-v1.png':'image/png','/assets/woodland-atlas-v1.png':'image/png','/assets/forest-dawn-v1.jpg':'image/jpeg'});
types['/assets/signs-gouache-v1.png']='image/png';
Object.assign(types,{'/assets/harbor-afternoon-v1.jpg':'image/jpeg','/assets/harbor-atlas-v1.png':'image/png','/assets/harbor-warehouse-v1.png':'image/png'});
Object.assign(types,{'/assets/rooftop-moonlight-v1.jpg':'image/jpeg','/assets/rooftop-atlas-v1.png':'image/png','/assets/rooftop-landmarks-v1.png':'image/png'});
types['/assets/rooftop-sliding-eave-v1.png']='image/png';
types['/assets/mill-night-v1.jpg']='image/jpeg';
types['/assets/mill-atlas-v1.png']='image/png';
types['/assets/cat-feedback-v1.png']='image/png';
const lan=process.argv.includes('--lan'),port=Number(process.env.PORT||4173);
const server=http.createServer((req,res)=>{
  let name=new URL(req.url,'http://localhost').pathname;
  if(name==='/')name='/index.html';
  if(!types[name]){res.writeHead(404);res.end('Not found');return;}
  fs.readFile(path.join(__dirname,name.slice(1)),(err,data)=>{
    if(err){res.writeHead(500);res.end('Read failed');return;}
    res.writeHead(200,{'Content-Type':types[name],'Cache-Control':'no-store'});res.end(data);
  });
});
server.on('error',err=>{console.error(err.code==='EADDRINUSE'?'端口已占用，请关闭旧服务或通过 PORT 环境变量指定其他端口。':err.message);process.exitCode=1;});
server.listen(port,lan?'0.0.0.0':'127.0.0.1',()=>{
  console.log('Local: http://127.0.0.1:'+port+'/');
  if(lan)for(const entries of Object.values(require('node:os').networkInterfaces()))
    for(const entry of entries)if(entry.family==='IPv4'&&!entry.internal)console.log('LAN: http://'+entry.address+':'+port+'/');
});
