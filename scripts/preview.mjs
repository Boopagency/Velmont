import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('dist');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.ttf':'font/ttf','.woff2':'font/woff2','.xml':'application/xml','.txt':'text/plain'};
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '');let target=path.resolve(root,relative);if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}try{if((await fs.stat(target)).isDirectory())target=path.join(target,'index.html');}catch{target=path.join(root,'404.html');res.statusCode=404;}const data=await fs.readFile(target);res.setHeader('Content-Type',types[path.extname(target)]||'application/octet-stream');res.setHeader('X-Content-Type-Options','nosniff');res.end(data);}catch{res.writeHead(500);res.end('Erro ao abrir a página.');}}).listen(3000,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:3000'));
