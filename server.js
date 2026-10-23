const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const url = require('url');
const { exec } = require('child_process');

const PORT = Number(process.env.PORT || 8080);
const ROOT = __dirname;

const MIME = {
  '.html':'text/html; charset=utf-8',
  '.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.gif':'image/gif',
  '.svg':'image/svg+xml',
  '.json':'application/json; charset=utf-8',
  '.ico':'image/x-icon',
  '.woff':'font/woff',
  '.woff2':'font/woff2',
  '.ttf':'font/ttf',
  '.otf':'font/otf'
};

const VIRTUAL = /radmin|vpn|virtual|vethernet|vmware|virtualbox|hyper-v|wsl|bluetooth|loopback|tailscale|zerotier|tap|tun/i;

function lanHosts(){
  const list = [];
  const ifs = os.networkInterfaces();
  Object.keys(ifs).forEach(name=>{
    (ifs[name] || []).forEach(ni=>{
      if(ni.family !== 'IPv4' || ni.internal) return;
      list.push({ name, address: ni.address });
    });
  });
  // 虚拟网卡排后面，常见家用网段排前面
  const score = a=>{
    if(VIRTUAL.test(a.name)) return 100;
    if(/^192\.168\./.test(a.address)) return 0;
    if(/^10\./.test(a.address)) return 1;
    if(/^172\.(1[6-9]|2\d|3[01])\./.test(a.address)) return 2;
    return 5;
  };
  return list.map(a=>({ ...a, score: score(a) })).sort((x,y)=>x.score - y.score);
}

function lanIPs(){
  const hosts = lanHosts();
  const real = hosts.filter(h=>h.score < 100);
  return (real.length ? real : hosts).map(h=>({ name: h.name, address: h.address }));
}

process.on('exit', ()=>{
  try { fs.unlinkSync(path.join(ROOT, 'server.pid')); } catch(e){}
});

const server = http.createServer((req, res)=>{
  const parsed = url.parse(req.url);
  let pathname;
  try { pathname = decodeURIComponent(parsed.pathname); }
  catch(e){ res.writeHead(400); res.end('Bad Request'); return; }

  if(pathname === '/') pathname = '/index.html';
  const file = path.join(ROOT, pathname);
  // 防止目录遍历
  if(!path.resolve(file).startsWith(path.resolve(ROOT))){ res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data)=>{
    if(err){ res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); res.end('Not Found'); return; }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      // 禁止缓存，避免改动后浏览器仍用旧文件
      'Cache-Control':'no-store, no-cache, must-revalidate',
      'Pragma':'no-cache',
      'Expires':'0'
    });
    res.end(data);
  });
});

server.on('error', (e)=>{
  if(e.code === 'EADDRINUSE'){
    console.error(`端口 ${PORT} 已被占用。可能已经有一个实例在运行，直接打开 http://localhost:${PORT} 即可。`);
    console.error(`也可以用别的端口启动：set PORT=8090 && node server.js`);
  } else {
    console.error(e);
  }
  process.exitCode = 1;
});

server.listen(PORT, '0.0.0.0', ()=>{
  // 记录 pid，供 stop.bat 精确停止本服务（不会误杀其他 node 程序）
  try { fs.writeFileSync(path.join(ROOT, 'server.pid'), String(process.pid)); } catch(e){}
  console.log('=========================================');
  console.log(` 匿名版编辑器已启动  端口 ${PORT}`);
  console.log('=========================================');
  console.log(` 本机打开:  http://localhost:${PORT}`);
  const ips = lanIPs();
  if(ips.length){
    ips.forEach(h=>console.log(` 手机打开:  http://${h.address}:${PORT}   (${h.name} / 手机需连同一WiFi)`));
  } else {
    console.log(' 未检测到局域网地址（电脑可能没连WiFi/网线）');
  }
  console.log('-----------------------------------------');
  console.log(' 关闭本窗口即停止服务');
  console.log('=========================================');
  if(process.argv.includes('--open')){
    exec(`start "" "http://localhost:${PORT}"`);
  }
});
