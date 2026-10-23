// 把 index.html + app.js + vendor 库打包成「单文件 HTML」，手机上无需电脑即可运行
// 用法： node build-single.js
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, '匿名版编辑器-手机版.html');

const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
// 内联进 <script> 时，要防止源码里出现 </script 提前闭合标签
const inline = code => code.replace(/<\/script/gi, '<\\/script');

let html = read('index.html');
const app = read('app.js');
const h2c = read('vendor/html2canvas.min.js');

// 用函数式替换，避免 $& / $1 之类被当成替换模式
html = html.replace(/<script src="vendor\/html2canvas\.min\.js"><\/script>/,
  () => '<script>/* html2canvas 1.4.1 (MIT) */\n' + inline(h2c) + '</script>');
html = html.replace(/<script src="app\.js\?v=[^"]*"><\/script>/,
  () => '<script>/* app.js */\n' + inline(app) + '</script>');

// 方便「添加到主屏幕」当 App 用
html = html.replace('</title>',
  '</title>\n<meta name="apple-mobile-web-app-capable" content="yes">\n' +
  '<meta name="mobile-web-app-capable" content="yes">\n' +
  '<meta name="apple-mobile-web-app-title" content="匿名版编辑器">\n' +
  '<meta name="theme-color" content="#1a1b1e">');

if(html.includes('src="vendor/') || html.includes('src="app.js')){
  console.error('打包失败：仍有外部脚本引用未内联');
  process.exit(1);
}

fs.writeFileSync(OUT, html, 'utf8');
const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log(`已生成：${OUT}`);
console.log(`单文件大小：${kb} KB（无任何外部依赖，可离线使用）`);
