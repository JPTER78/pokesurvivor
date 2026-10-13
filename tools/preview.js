/* Local, loopback-only preview. Keeps accounts and saves in this browser. */
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.webmanifest':'application/manifest+json', '.png':'image/png', '.jpg':'image/jpeg', '.ico':'image/x-icon', '.ttf':'font/ttf', '.woff2':'font/woff2' };
const LOCAL = '<script>window.G={};Object.defineProperty(window.G,"FIREBASE_CONFIG",{get:()=>null,set:()=>{}});</script>';
http.createServer((req,res)=>{
  try {
    const url = new URL(req.url,'http://localhost');
    let file = path.resolve(ROOT, '.'+decodeURIComponent(url.pathname));
    if (file !== ROOT && !file.startsWith(ROOT+path.sep)) { res.writeHead(403).end(); return; }
    if (fs.statSync(file).isDirectory()) file = path.join(file,'index.html');
    let body = fs.readFileSync(file);
    if (path.extname(file) === '.html') body = Buffer.from(body.toString('utf8').replace('<head>','<head>'+LOCAL),'utf8');
    res.setHeader('Content-Type',MIME[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control','no-store');
    res.end(body);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(8765,'127.0.0.1',()=>console.log('PokéSurvivor local preview: http://127.0.0.1:8765/'));
