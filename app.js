/* 匿名版编辑器 - 纯前端，localStorage + IndexedDB 持久化 */
'use strict';

// ---------- 数据层 ----------
const LS_KEY = 'anonBoardData_v7';
let db = loadDB();

function loadDB(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){ console.error(e); }
  return {
    chars:[], threads:[], customFonts:[],
    settings:{
      emojis: getDefaultEmojis(),
      exportBgColor:'#ffffff',
      exportPostBgColor:'#fafafa',
      exportPostBorderColor:'#cccccc',
      exportPostBorderWidth:1,
      exportPostBorderOpacity:100,
      exportPostBorderRadius:4,
      exportBorderTop:true, exportBorderRight:true, exportBorderBottom:true, exportBorderLeft:true,
      nameUseCharColor:true,
      // 头部元素垂直微调（px），用于抵消不同字体之间无法用 CSS 消除的字形高度差
      fontOffset:{threadNo:0, title:0, floor:0, name:0, opTag:0},
      fontThreadNo:{family:'monospace',size:16,color:'#2b6cb0',bold:true},
      fontTitle:{family:'Microsoft YaHei,PingFang SC,sans-serif',size:18,color:'#000000',bold:true},
      fontFloor:{family:'monospace',size:14,color:'#2b6cb0',bold:false},
      fontName:{family:'Microsoft YaHei,PingFang SC,sans-serif',size:14,color:'#c03c2b',bold:true},
      fontOpTag:{family:'Microsoft YaHei,PingFang SC,sans-serif',size:11,color:'#ffffff',bold:false},
      fontContent:{family:'Microsoft YaHei,PingFang SC,sans-serif',size:14,color:'#000000',bold:false}
    }
  };
}
function saveDB(){
  try{ localStorage.setItem(LS_KEY, JSON.stringify(db)); }
  catch(e){ console.warn('保存失败（可能超出存储上限）', e); }
}
setInterval(saveDB, 5000);
window.addEventListener('beforeunload', ()=>saveDB());

// ---------- 数据导入/导出（本地 JSON 文件，防清缓存丢失） ----------
function exportData(){
  saveDB();
  const data = JSON.stringify(db, null, 2);
  const blob = new Blob([data], {type:'application/json'});
  const a = document.createElement('a');
  a.download = `anon-board-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.href = URL.createObjectURL(blob);
  a.click();
  URL.revokeObjectURL(a.href);
}
function importData(input){
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    try{
      const data = JSON.parse(e.target.result);
      if(!data.chars || !data.threads){ alert('文件格式不正确'); return; }
      if(!confirm('导入将覆盖当前所有数据（角色、匿名串、设置），确定继续？')) return;
      db = data;
      if(!db.settings) db.settings = {};
      if(!db.customFonts) db.customFonts = [];
      if(!db.settings.emojis) db.settings.emojis = getDefaultEmojis();
      saveDB();
      refreshCharSelects();
      renderChars();
      renderThreads();
      refreshFontSelects();
      if(currentThreadId && !db.threads.find(t=>t.id===currentThreadId)){
        currentThreadId = null;
        document.getElementById('composer-box').style.display = 'none';
        document.getElementById('editor-thread-title').textContent = '请先在「匿名串管理」选择一个串';
        document.getElementById('post-list').innerHTML = '';
      } else if(currentThreadId){
        renderPosts();
      }
      alert('导入成功！');
    }catch(err){
      alert('导入失败：' + err.message);
    }
  };
  reader.readAsText(file);
  input.value = '';
}

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

// 读取数字输入，保留 0 值
function numVal(id, def){
  const el = document.getElementById(id);
  if(!el) return def;
  const v = parseInt(el.value, 10);
  return isNaN(v) ? def : v;
}

// 乱码字符池：大小写字母 + 数字，但排除易混淆的 I l 1 O 0
const CODE_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LOWER = 'abcdefghjkmnpqrstuvwxyz';
const CODE_DIGIT = '23456789';
const CODE_CHARS = CODE_UPPER + CODE_LOWER + CODE_DIGIT;
// 生成一个合规的原始乱码：5 位，字母/数字混合，但不允许「全是数字」
function rawCode(len){
  len = len || 5;
  for(let t=0;t<200;t++){
    let s = '';
    for(let i=0;i<len;i++) s += CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)];
    if(!/^[0-9]+$/.test(s)) return s;   // 不能全是数字
  }
  return 'Ax9kQ';
}
// 收集所有已使用的乱码和别名（大小写不敏感）
function usedCodes(excludeCharId){
  const used = new Set();
  db.chars.forEach(c=>{
    if(c.id === excludeCharId) return;
    if(c.code) used.add(c.code.toUpperCase());
    (c.aliases||[]).forEach(a=>used.add(String(a).toUpperCase()));
  });
  return used;
}
function isCodeTaken(code, excludeCharId){
  return usedCodes(excludeCharId).has(String(code).toUpperCase());
}
// 生成不与现有角色乱码/别名重复的 5 位乱码
function genCode(excludeCharId){
  const used = usedCodes(excludeCharId);
  for(let t=0;t<1000;t++){
    const s = rawCode(5);
    if(!used.has(s.toUpperCase())) return s;
  }
  return rawCode(5);
}
function genNumCode(){
  let s = '';
  for(let i=0;i<5;i++) s += Math.floor(Math.random()*10);
  return s;
}

// 颜文字来源感谢：X岛(hacfun) 颜文字列表 https://gist.github.com/JaHIY/31b086b6b4326e86d15e
function getDefaultEmojis(){
  return [
    '|∀ﾟ','(´ﾟДﾟ`)','(;´Д`)','(｀･ω･)','(=ﾟωﾟ)=','| ω・´)','|-` )','|д` )',
    '|ー` )','|∀` )','(つд⊂)','(ﾟДﾟ≡ﾟДﾟ)','(＾o＾)ﾉ','(|||ﾟДﾟ)','( ﾟ∀ﾟ)','( ´∀`)',
    '(*´∀`)','(*ﾟ∇ﾟ)','(*ﾟーﾟ)','(　ﾟ 3ﾟ)','( ´ー`)','( ・_ゝ・)','( ´_ゝ`)','(*´д`)',
    '(・ー・)','(・∀・)','(ゝ∀･)','(〃∀〃)','(*ﾟ∀ﾟ*)','( ﾟ∀。)','( `д´)','(`ε´ )',
    '(`ヮ´ )','σ`∀´)',' ﾟ∀ﾟ)σ','ﾟ ∀ﾟ)ノ','(╬ﾟдﾟ)','(|||ﾟдﾟ)','( ﾟдﾟ)','Σ( ﾟдﾟ)',
    '( ;ﾟдﾟ)','( ;´д`)','(　д ) ﾟ ﾟ','( ☉д⊙)','(((　ﾟдﾟ)))','( ` ・´)','( ´д`)','( -д-)',
    '(>д<)','･ﾟ( ﾉд`ﾟ)','( TдT)','(￣∇￣)','(￣3￣)','(￣ｰ￣)','(￣ . ￣)','(￣皿￣)',
    '(￣艸￣)','(￣︿￣)','(￣︶￣)','ヾ(´ωﾟ｀)','(*´ω`*)','(・ω・)','( ´・ω)','(｀・ω)',
    '(´・ω・`)','(`・ω・´)','( `_っ´)','( `ー´)','( ´_っ`)','( ´ρ`)','( ﾟωﾟ)','(oﾟωﾟo)',
    '(　^ω^)','(｡◕∀◕｡)','/( ◕‿‿◕ )\\','ヾ(´ε`ヾ)','(ノﾟ∀ﾟ)ノ','(σﾟдﾟ)σ','(σﾟ∀ﾟ)σ','|дﾟ )',
    '┃電柱┃','ﾟ(つд`ﾟ)','ﾟÅﾟ )　','⊂彡☆))д`)','⊂彡☆))д´)','⊂彡☆))∀`)','(´∀((☆ミつ'
  ];
}

// ---------- 自定义字体（IndexedDB 存储，避免 localStorage 5MB 上限） ----------
let fontDB = null;
function initFontDB(){
  return new Promise((resolve)=>{
    try{
      const req = indexedDB.open('anonBoardFonts', 1);
      req.onupgradeneeded = e=>{
        e.target.result.createObjectStore('fonts', {keyPath:'name'});
      };
      req.onsuccess = e=>{ fontDB = e.target.result; resolve(); };
      req.onerror = ()=>{ console.warn('IndexedDB 不可用'); resolve(); };
    }catch(e){ resolve(); }
  });
}
function injectFont(name, data){
  const style = document.createElement('style');
  style.dataset.fontName = name;
  style.textContent = `@font-face{font-family:'${name}';src:url(${data});}`;
  document.head.appendChild(style);
}
function loadCustomFonts(){
  if(!fontDB) return;
  try{
    const tx = fontDB.transaction('fonts','readonly');
    const req = tx.objectStore('fonts').getAll();
    req.onsuccess = ()=>{
      (req.result||[]).forEach(f=>{
        injectFont(f.name, f.data);
        if(!db.customFonts.find(x=>x.name===f.name)) db.customFonts.push({name:f.name});
      });
      refreshFontSelects();
    };
  }catch(e){ console.warn(e); }
}
function addCustomFont(input){
  const file = input.files[0];
  if(!file) return;
  const name = file.name.replace(/\.[^.]+$/,'');
  const reader = new FileReader();
  reader.onload = function(e){
    const data = e.target.result;
    if(!fontDB){ alert('浏览器不支持 IndexedDB，无法保存字体'); return; }
    const tx = fontDB.transaction('fonts','readwrite');
    tx.objectStore('fonts').put({name, data});
    tx.oncomplete = ()=>{
      injectFont(name, data);
      if(!db.customFonts.find(f=>f.name===name)) db.customFonts.push({name});
      saveDB();
      refreshFontSelects();
      alert(`字体 "${name}" 已添加`);
    };
    tx.onerror = ()=>alert('字体保存失败');
  };
  reader.readAsDataURL(file);
  input.value = '';
}
function removeCustomFont(name){
  if(!confirm(`删除字体 "${name}"？`)) return;
  if(fontDB){
    const tx = fontDB.transaction('fonts','readwrite');
    tx.objectStore('fonts').delete(name);
  }
  db.customFonts = db.customFonts.filter(f=>f.name!==name);
  document.querySelectorAll('style[data-font-name]').forEach(s=>{
    if(s.dataset.fontName===name) s.remove();
  });
  saveDB();
  refreshFontSelects();
  renderExportPreview();
}
function refreshFontSelects(){
  const systemFonts = [
    ['Microsoft YaHei,PingFang SC,sans-serif','微软雅黑'],
    ['SimSun,serif','宋体'],
    ['SimHei,sans-serif','黑体'],
    ['KaiTi,serif','楷体'],
    ['FangSong,serif','仿宋'],
    ['monospace','等宽'],
    ['Courier New,monospace','Courier New'],
    ['Consolas,monospace','Consolas'],
    ['Arial,sans-serif','Arial'],
    ['Times New Roman,serif','Times New Roman'],
    ['Comic Sans MS,cursive','Comic Sans MS'],
    ['system-ui,sans-serif','系统默认']
  ];
  const customOpts = db.customFonts.map(f=>[f.name, f.name+' (自定义)']);
  const allFonts = [...systemFonts, ...customOpts];
  document.querySelectorAll('.font-family-select').forEach(sel=>{
    const current = sel.dataset.current || sel.value;
    sel.innerHTML = allFonts.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
    if(current && allFonts.find(f=>f[0]===current)) sel.value = current;
  });
  const listEl = document.getElementById('custom-font-list');
  if(listEl){
    listEl.innerHTML = db.customFonts.map(f=>`
      <span class="tag" style="background:var(--accent2);color:#fff;margin-right:4px">${esc(f.name)}
        <span style="cursor:pointer;margin-left:4px" onclick="removeCustomFont('${esc(f.name)}')">×</span>
      </span>
    `).join('') || '<span style="color:var(--muted);font-size:12px">暂无自定义字体</span>';
  }
}

// ---------- 角色 ----------
function createChar(){
  const name = document.getElementById('new-char-name').value.trim();
  if(!name){ alert('请输入角色名'); return; }
  const color = getColorInput('new-char-color');
  const showName = document.getElementById('new-char-showname').checked;
  const c = { id:uid(), name, code:genCode(), aliases:[], color, showName, desc:'', createdAt:Date.now() };
  db.chars.push(c);
  saveDB();
  document.getElementById('new-char-name').value = '';
  renderChars();
  refreshCharSelects();
}

let editingCharId = null;
function openCharModal(id){
  const c = db.chars.find(x=>x.id===id);
  if(!c) return;
  editingCharId = id;
  document.getElementById('edit-char-name').value = c.name;
  document.getElementById('edit-char-code').value = c.code;
  renderAliasList(c);
  setColorInput('edit-char-color', c.color);
  document.getElementById('edit-char-showname').checked = c.showName !== false;
  document.getElementById('edit-char-desc').value = c.desc || '';
  document.getElementById('char-modal').classList.remove('hidden');
}
function closeCharModal(){
  editingCharId = null;
  document.getElementById('char-modal').classList.add('hidden');
}
function regenCode(){
  document.getElementById('edit-char-code').value = genCode(editingCharId);
}
// 别名管理（编辑弹窗内，暂存在角色对象上，保存时生效）
function renderAliasList(c){
  const el = document.getElementById('edit-char-aliases');
  const aliases = c.aliases || [];
  el.innerHTML = aliases.map((a,i)=>`
    <span class="tag" style="background:var(--accent2);color:#fff;margin-right:4px;font-family:monospace">${esc(a)}
      <span style="cursor:pointer;margin-left:4px" onclick="removeAlias(${i})">×</span>
    </span>
  `).join('') || '<span style="color:var(--muted);font-size:12px">暂无别名</span>';
}
function addAlias(){
  const c = db.chars.find(x=>x.id===editingCharId);
  if(!c) return;
  const input = document.getElementById('edit-char-alias-input');
  const alias = input.value.trim();
  if(!alias) return;
  if(!c.aliases) c.aliases = [];
  if(alias.toUpperCase() === c.code.toUpperCase() || c.aliases.find(a=>a.toUpperCase()===alias.toUpperCase())){
    alert('该别名与当前角色的乱码/别名重复'); return;
  }
  // 检查其他角色
  const others = usedCodes(editingCharId);
  if(others.has(alias.toUpperCase())){
    alert('该别名与其他角色的乱码/别名重复'); return;
  }
  c.aliases.push(alias);
  input.value = '';
  renderAliasList(c);
}
// 给别名输入框随机生成一个乱码（可直接编辑或再点添加）
function regenAliasCode(){
  const c = db.chars.find(x=>x.id===editingCharId);
  const input = document.getElementById('edit-char-alias-input');
  if(!input) return;
  const used = usedCodes(editingCharId);
  if(c && c.code) used.add(c.code.toUpperCase());
  if(c) (c.aliases||[]).forEach(a=>used.add(String(a).toUpperCase()));
  for(let t=0;t<1000;t++){
    const s = rawCode(5);
    if(!used.has(s.toUpperCase())){ input.value = s; return; }
  }
  input.value = rawCode(5);
}
function removeAlias(i){
  const c = db.chars.find(x=>x.id===editingCharId);
  if(!c || !c.aliases) return;
  c.aliases.splice(i,1);
  renderAliasList(c);
}
function saveChar(){
  const c = db.chars.find(x=>x.id===editingCharId);
  if(!c) return;
  const newCode = document.getElementById('edit-char-code').value.trim() || genCode(editingCharId);
  // 乱码唯一性检测（排除自身及自身别名）
  const selfAliases = (c.aliases||[]).map(a=>a.toUpperCase());
  if(!selfAliases.includes(newCode.toUpperCase()) && isCodeTaken(newCode, editingCharId)){
    alert('该乱码已被其他角色使用，请更换'); return;
  }
  c.name = document.getElementById('edit-char-name').value.trim() || c.name;
  c.code = newCode;
  c.color = getColorInput('edit-char-color');
  c.showName = document.getElementById('edit-char-showname').checked;
  c.desc = document.getElementById('edit-char-desc').value;
  saveDB();
  closeCharModal();
  renderChars();
  refreshCharSelects();
  if(currentThreadId) renderPosts();
}
function deleteChar(){
  if(!confirm('删除该角色？已发布的帖子会保留其名称和乱码。')) return;
  db.chars = db.chars.filter(x=>x.id!==editingCharId);
  saveDB();
  closeCharModal();
  renderChars();
  refreshCharSelects();
}

function renderChars(){
  const el = document.getElementById('char-list');
  if(!db.chars.length){ el.innerHTML = '<div style="color:var(--muted)">暂无角色</div>'; return; }
  el.innerHTML = db.chars.map(c=>`
    <div class="char-card">
      <div class="code">${esc(c.code)}</div>
      <div class="name" style="color:${esc(c.color)}">${esc(c.name)}</div>
      ${(c.aliases&&c.aliases.length)?`<div class="meta" style="font-family:monospace">别名: ${c.aliases.map(a=>esc(a)).join(', ')}</div>`:''}
      <div class="meta">
        <span class="tag" style="background:${c.showName!==false?'#2b6cb0':'#666'};color:#fff">${c.showName!==false?'显示名字':'仅显示乱码'}</span>
      </div>
      <div class="meta">${c.desc ? esc(c.desc.slice(0,60)) : '（无设定）'}</div>
      <div class="actions">
        <button class="small" onclick="openCharModal('${c.id}')">编辑</button>
      </div>
    </div>
  `).join('');
}

function refreshCharSelects(){
  const opts = db.chars.map(c=>`<option value="${c.id}">${esc(c.name)} (${esc(c.code)})</option>`).join('');
  document.getElementById('new-thread-char').innerHTML = opts || '<option value="">请先创建角色</option>';
  document.getElementById('post-char').innerHTML = opts;
}

// ---------- 匿名串 ----------
function createThread(){
  const title = document.getElementById('new-thread-title').value.trim();
  if(!title){ alert('请输入标题'); return; }
  const charId = document.getElementById('new-thread-char').value;
  if(!charId){ alert('请先创建角色'); return; }
  const opLabel = document.getElementById('new-thread-oplabel').value.trim() || '楼主';
  const opColor = getColorInput('new-thread-opcolor');
  const t = {
    id:uid(), no:genNumCode(), title,
    opLabel, opColor,
    posts:[],
    createdAt:Date.now()
  };
  db.threads.push(t);
  saveDB();
  document.getElementById('new-thread-title').value = '';
  renderThreads();
  openThread(t.id);
}

function threadNoStr(t){ return t.no; }
function floorNo(t, idx){ return idx===0 ? '000' : String(idx).padStart(3,'0'); }

function renderThreads(){
  const el = document.getElementById('thread-list');
  if(!db.threads.length){ el.innerHTML = '<div style="color:var(--muted)">暂无匿名串</div>'; return; }
  el.innerHTML = db.threads.map(t=>{
    const first = t.posts[0];
    const author = first ? getCharDisplay(first.charId, first.snapshot) : '—';
    return `<div class="thread-item" onclick="openThread('${t.id}')">
      <div class="title">No.${threadNoStr(t)} ${esc(t.title)}</div>
      <div class="meta">
        <span style="color:${author.color}">${author.showName!==false?author.name:author.code}</span>
        <span class="code">${author.code}</span>
        · ${t.posts.length} 楼
        <button class="small" onclick="event.stopPropagation();openThreadEditModal('${t.id}')">编辑</button>
        <button class="small danger" style="float:right" onclick="event.stopPropagation();deleteThread('${t.id}')">删除</button>
      </div>
    </div>`;
  }).join('');
}

let editingThreadId = null;
function openThreadEditModal(id){
  const t = db.threads.find(x=>x.id===id);
  if(!t) return;
  editingThreadId = id;
  document.getElementById('edit-thread-no').value = t.no;
  document.getElementById('edit-thread-title').value = t.title;
  document.getElementById('edit-thread-oplabel').value = t.opLabel || '楼主';
  setColorInput('edit-thread-opcolor', t.opColor || '#c03c2b');
  document.getElementById('thread-modal').classList.remove('hidden');
}
function closeThreadModal(){
  editingThreadId = null;
  document.getElementById('thread-modal').classList.add('hidden');
}

function regenThreadNo(){
  document.getElementById('edit-thread-no').value = genNumCode();
}
function saveThread(){
  const t = db.threads.find(x=>x.id===editingThreadId);
  if(!t) return;
  t.no = document.getElementById('edit-thread-no').value.trim() || genNumCode();
  t.title = document.getElementById('edit-thread-title').value.trim() || t.title;
  t.opLabel = document.getElementById('edit-thread-oplabel').value.trim() || '楼主';
  t.opColor = getColorInput('edit-thread-opcolor');
  saveDB();
  closeThreadModal();
  renderThreads();
  if(currentThreadId===editingThreadId){
    document.getElementById('editor-thread-title').innerHTML =
      `<strong style="color:var(--accent2)">No.${threadNoStr(t)}</strong> ${esc(t.title)}`;
    renderPosts();
  }
  refreshExportSelect();
}

function deleteThread(id){
  if(!confirm('删除该串及其所有楼层？')) return;
  db.threads = db.threads.filter(t=>t.id!==id);
  if(currentThreadId===id){ currentThreadId=null; document.getElementById('composer-box').style.display='none'; document.getElementById('editor-thread-title').textContent='请先在「匿名串管理」选择一个串'; document.getElementById('post-list').innerHTML=''; }
  saveDB();
  renderThreads();
  refreshExportSelect();
}

function getCharDisplay(charId, snapshot){
  const c = db.chars.find(x=>x.id===charId);
  if(c) return { name:c.name, code:c.code, color:c.color, showName:c.showName!==false };
  if(snapshot) return { ...snapshot, showName:snapshot.showName!==false };
  return { name:'无名氏', code:'?????', color:'#888', showName:false };
}

// ---------- 编辑器 ----------
let currentThreadId = null;
let editingPostId = null;

function openThread(id){
  currentThreadId = id;
  editingPostId = null;
  switchPage('editor');
  const t = db.threads.find(x=>x.id===id);
  if(!t) return;
  document.getElementById('editor-thread-title').innerHTML =
    `<strong style="color:var(--accent2)">No.${threadNoStr(t)}</strong> ${esc(t.title)}`;
  document.getElementById('composer-box').style.display = 'block';
  document.getElementById('post-content').value = '';
  renderPosts();
  refreshCharSelects();
}

function renderPosts(){
  const t = db.threads.find(x=>x.id===currentThreadId);
  const el = document.getElementById('post-list');
  if(!t){ el.innerHTML=''; return; }
  el.innerHTML = t.posts.map((p,idx)=>{
    const a = getCharDisplay(p.charId, p.snapshot);
    const isOP = idx===0;
    const displayName = a.showName!==false ? a.name : a.code;
    const opTag = isOP ? `<span class="tag" style="background:${esc(t.opColor||'#c03c2b')};color:#fff">${esc(t.opLabel||'楼主')}</span>` : '';
    return `<div class="post">
      <div class="post-header">
        <span class="floor">${isOP?'No.'+threadNoStr(t)+'000':'No.'+threadNoStr(t)+floorNo(t,idx)}</span>
        <span class="name" style="color:${a.color}">${esc(displayName)}</span>
        ${opTag}
      </div>
      <div class="post-content">${renderContent(p.content)}</div>
      <div class="post-actions">
        <button class="small" onclick="editPost('${p.id}')">编辑</button>
        <button class="small danger" onclick="deletePost('${p.id}')">删除</button>
      </div>
    </div>`;
  }).join('');
  refreshExportRange();
}

function renderContent(text){
  let html = esc(text);
  html = html.replace(/\[img:([^\]]+)\]/g, '<img src="$1" alt="img">');
  html = html.replace(/\n/g,'<br>');
  return html;
}

function submitPost(){
  const t = db.threads.find(x=>x.id===currentThreadId);
  if(!t) return;
  const charId = document.getElementById('post-char').value;
  const content = document.getElementById('post-content').value.trim();
  if(!content){ alert('内容不能为空'); return; }
  const c = db.chars.find(x=>x.id===charId);
  const snapshot = c ? { name:c.name, code:c.code, color:c.color, showName:c.showName } : { name:'无名氏', code:'?????', color:'#888', showName:false };

  if(editingPostId){
    const p = t.posts.find(x=>x.id===editingPostId);
    if(p){ p.content = content; p.charId = charId; p.snapshot = snapshot; }
    editingPostId = null;
  }else{
    t.posts.push({ id:uid(), charId, snapshot, content, createdAt:Date.now() });
  }
  saveDB();
  document.getElementById('post-content').value = '';
  renderPosts();
  renderThreads();
}

function editPost(id){
  const t = db.threads.find(x=>x.id===currentThreadId);
  const p = t.posts.find(x=>x.id===id);
  if(!p) return;
  editingPostId = id;
  document.getElementById('post-char').value = p.charId;
  document.getElementById('post-content').value = p.content;
  document.getElementById('post-content').focus();
}
function cancelEdit(){
  editingPostId = null;
  document.getElementById('post-content').value = '';
}
function deletePost(id){
  if(!confirm('删除该楼层？')) return;
  const t = db.threads.find(x=>x.id===currentThreadId);
  t.posts = t.posts.filter(x=>x.id!==id);
  if(editingPostId===id) cancelEdit();
  saveDB();
  renderPosts();
  renderThreads();
}

// ---------- 颜文字管理 ----------
let emojiPanelVisible = false;
let emojiDeleteMode = false;
function showEmojiPanel(){
  const panel = document.getElementById('emoji-panel');
  emojiPanelVisible = !emojiPanelVisible;
  if(emojiPanelVisible){
    emojiDeleteMode = false;
    renderEmojiPanel();
    panel.classList.remove('hidden');
  }else{
    panel.classList.add('hidden');
  }
}
function toggleEmojiDeleteMode(){
  emojiDeleteMode = !emojiDeleteMode;
  renderEmojiPanel();
}
function renderEmojiPanel(){
  const panel = document.getElementById('emoji-panel');
  let html = db.settings.emojis.map((e,i)=>{
    const cls = emojiDeleteMode ? 'style="background:#c03c2b;color:#fff"' : '';
    return `<span ${cls} onclick="emojiClick(${i})" title="${emojiDeleteMode?'点击删除':'点击插入'}">${e}</span>`;
  }).join('');
  html += `<span style="color:var(--accent2);font-weight:bold" onclick="addEmojiPrompt()">+ 添加</span>`;
  html += `<span style="color:${emojiDeleteMode?'#c03c2b':'var(--muted)'}" onclick="toggleEmojiDeleteMode()">${emojiDeleteMode?'完成':'删除模式'}</span>`;
  panel.innerHTML = html;
}
function emojiClick(i){
  if(emojiDeleteMode){
    db.settings.emojis.splice(i,1);
    saveDB();
    renderEmojiPanel();
  }else{
    insertEmoji(db.settings.emojis[i]);
  }
}
function addEmojiPrompt(){
  const e = prompt('输入颜文字：');
  if(e && e.trim()){
    db.settings.emojis.push(e.trim());
    saveDB();
    renderEmojiPanel();
  }
}
function insertEmoji(e){
  const ta = document.getElementById('post-content');
  const start = ta.selectionStart, end = ta.selectionEnd;
  const val = ta.value;
  ta.value = val.slice(0,start) + e + val.slice(end);
  ta.focus();
  ta.selectionStart = ta.selectionEnd = start + e.length;
}

// ---------- 图片 ----------
function insertImage(input){
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    const ta = document.getElementById('post-content');
    const tag = `\n[img:${e.target.result}]\n`;
    const start = ta.selectionStart;
    ta.value = ta.value.slice(0,start) + tag + ta.value.slice(start);
    ta.focus();
  };
  reader.readAsDataURL(file);
  input.value = '';
}

// ---------- 颜色输入辅助 ----------
function setColorInput(id, color){
  const picker = document.getElementById(id);
  if(picker) picker.value = color;
  const hexEl = document.getElementById(id+'-hex');
  if(hexEl) hexEl.value = color;
}
function getColorInput(id){
  const hexEl = document.getElementById(id+'-hex');
  if(hexEl && /^#[0-9A-Fa-f]{6}$/.test(hexEl.value)) return hexEl.value;
  const picker = document.getElementById(id);
  return picker ? picker.value : '#000000';
}
function syncColorHex(id){
  const color = document.getElementById(id).value;
  const hexEl = document.getElementById(id+'-hex');
  if(hexEl) hexEl.value = color;
}
function syncColorPicker(id){
  const hex = document.getElementById(id+'-hex').value;
  if(/^#[0-9A-Fa-f]{6}$/.test(hex)){
    document.getElementById(id).value = hex;
  }
}

// ---------- 导出 ----------
function refreshExportSelect(){
  const sel = document.getElementById('export-thread');
  sel.innerHTML = db.threads.map(t=>`<option value="${t.id}">No.${threadNoStr(t)} ${esc(t.title)}</option>`).join('');
  if(sel.value) renderExportPreview();
}
function refreshExportRange(){
  const t = db.threads.find(x=>x.id===document.getElementById('export-thread').value);
  if(t){
    document.getElementById('export-to').value = t.posts.length;
    document.getElementById('export-to').max = t.posts.length;
  }
}

function getExportSettings(){
  return {
    bgColor: getColorInput('export-bgcolor'),
    postBgColor: getColorInput('export-postbgcolor'),
    postBorderColor: getColorInput('export-bordercolor'),
    postBorderWidth: numVal('export-borderwidth', 1),
    postBorderOpacity: numVal('export-borderopacity', 100),
    postBorderRadius: numVal('export-borderradius', 4),
    borderTop: document.getElementById('export-border-top').checked,
    borderRight: document.getElementById('export-border-right').checked,
    borderBottom: document.getElementById('export-border-bottom').checked,
    borderLeft: document.getElementById('export-border-left').checked,
    fontThreadNo: getFontSettings('font-threadno'),
    fontTitle: getFontSettings('font-title'),
    fontFloor: getFontSettings('font-floor'),
    fontName: getFontSettings('font-name'),
    fontOpTag: getFontSettings('font-optag'),
    fontContent: getFontSettings('font-content'),
    nameUseCharColor: document.getElementById('font-name-usecharcolor').checked,
    fontOffset: {
      threadNo: numVal('offset-threadno', 0),
      title: numVal('offset-title', 0),
      floor: numVal('offset-floor', 0),
      name: numVal('offset-name', 0),
      opTag: numVal('offset-optag', 0)
    }
  };
}

function getFontSettings(prefix){
  const el = document.getElementById(prefix+'-family');
  if(!el) return {family:'sans-serif',size:14,color:'#000000',bold:false};
  return {
    family: el.value,
    size: numVal(prefix+'-size', 14),
    color: getColorInput(prefix+'-color'),
    bold: document.getElementById(prefix+'-bold').checked
  };
}

function setFontSettings(prefix, f){
  const el = document.getElementById(prefix+'-family');
  if(!el) return;
  el.dataset.current = f.family; // refreshFontSelects 用此值恢复选中
  el.value = f.family;
  document.getElementById(prefix+'-size').value = f.size;
  setColorInput(prefix+'-color', f.color);
  document.getElementById(prefix+'-bold').checked = f.bold;
}

function saveExportSettings(){
  const s = db.settings;
  s.exportBgColor = getColorInput('export-bgcolor');
  s.exportPostBgColor = getColorInput('export-postbgcolor');
  s.exportPostBorderColor = getColorInput('export-bordercolor');
  s.exportPostBorderWidth = numVal('export-borderwidth', 1);
  s.exportPostBorderOpacity = numVal('export-borderopacity', 100);
  s.exportPostBorderRadius = numVal('export-borderradius', 4);
  s.exportBorderTop = document.getElementById('export-border-top').checked;
  s.exportBorderRight = document.getElementById('export-border-right').checked;
  s.exportBorderBottom = document.getElementById('export-border-bottom').checked;
  s.exportBorderLeft = document.getElementById('export-border-left').checked;
  s.fontThreadNo = getFontSettings('font-threadno');
  s.fontTitle = getFontSettings('font-title');
  s.fontFloor = getFontSettings('font-floor');
  s.fontName = getFontSettings('font-name');
  s.fontOpTag = getFontSettings('font-optag');
  s.fontContent = getFontSettings('font-content');
  s.nameUseCharColor = document.getElementById('font-name-usecharcolor').checked;
  s.fontOffset = {
    threadNo: numVal('offset-threadno', 0),
    title: numVal('offset-title', 0),
    floor: numVal('offset-floor', 0),
    name: numVal('offset-name', 0),
    opTag: numVal('offset-optag', 0)
  };
  saveDB();
  renderExportPreview();
}

function loadExportSettings(){
  const s = db.settings;
  setColorInput('export-bgcolor', s.exportBgColor);
  setColorInput('export-postbgcolor', s.exportPostBgColor);
  setColorInput('export-bordercolor', s.exportPostBorderColor);
  document.getElementById('export-borderwidth').value = s.exportPostBorderWidth;
  document.getElementById('export-borderopacity').value = s.exportPostBorderOpacity;
  document.getElementById('export-borderradius').value = s.exportPostBorderRadius;
  document.getElementById('export-border-top').checked = s.exportBorderTop !== false;
  document.getElementById('export-border-right').checked = s.exportBorderRight !== false;
  document.getElementById('export-border-bottom').checked = s.exportBorderBottom !== false;
  document.getElementById('export-border-left').checked = s.exportBorderLeft !== false;
  setFontSettings('font-threadno', s.fontThreadNo);
  setFontSettings('font-title', s.fontTitle);
  setFontSettings('font-floor', s.fontFloor);
  setFontSettings('font-name', s.fontName);
  setFontSettings('font-optag', s.fontOpTag);
  setFontSettings('font-content', s.fontContent);
  document.getElementById('font-name-usecharcolor').checked = s.nameUseCharColor !== false;
  const fo = s.fontOffset || {};
  [['offset-threadno',fo.threadNo],['offset-title',fo.title],['offset-floor',fo.floor],
   ['offset-name',fo.name],['offset-optag',fo.opTag]].forEach(([id,v])=>{
    const el = document.getElementById(id);
    if(el) el.value = v || 0;
  });
}

function fontStyle(f){
  // 去掉引号避免破坏内联 style 属性
  const fam = (f.family||'sans-serif').replace(/["']/g,'');
  return `font-family:${fam};font-size:${f.size}px;color:${f.color};font-weight:${f.bold?'bold':'normal'};`;
}

function hexToRgba(hex, opacity){
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${opacity/100})`;
}

function renderExportPreview(){
  const tid = document.getElementById('export-thread').value;
  const t = db.threads.find(x=>x.id===tid);
  const el = document.getElementById('export-preview');
  const width = numVal('export-width', 800);
  const es = getExportSettings();
  const fo = es.fontOffset || {};
  el.style.width = width + 'px';
  el.style.background = es.bgColor;
  if(!t){ el.innerHTML='<div style="color:#666">请选择串</div>'; return; }
  let from = numVal('export-from', 1);
  let to = numVal('export-to', t.posts.length);
  from = Math.max(1,from); to = Math.min(t.posts.length,to);
  if(from>to){ el.innerHTML='<div style="color:#666">楼层范围无效</div>'; return; }
  const slice = t.posts.slice(from-1, to);

  // 边框 CSS：宽度为 0 时完全无边框
  let borderCss = '';
  if(es.postBorderWidth > 0){
    const bc = hexToRgba(es.postBorderColor, es.postBorderOpacity);
    if(es.borderTop) borderCss += `border-top:${es.postBorderWidth}px solid ${bc};`;
    if(es.borderRight) borderCss += `border-right:${es.postBorderWidth}px solid ${bc};`;
    if(es.borderBottom) borderCss += `border-bottom:${es.postBorderWidth}px solid ${bc};`;
    if(es.borderLeft) borderCss += `border-left:${es.postBorderWidth}px solid ${bc};`;
  }

  // 中线对齐分两层：
  // 1) 所有头部元素共用同一行高 => 行盒等高、文字按半行距垂直居中；
  // 2) 不同字体（等宽数字 vs 微软雅黑中文）在同一行盒里的基线与字形视觉中心并不一致，
  //    纯 CSS 无法对齐，因此用 canvas measureText 取真实字形包围盒，算出每个元素的像素补偿。
  const H = Math.ceil(Math.max(es.fontFloor.size, es.fontName.size, es.fontOpTag.size) * 1.6);
  const TH = Math.ceil(Math.max(es.fontThreadNo.size, es.fontTitle.size) * 1.6);
  const mctx = document.createElement('canvas').getContext('2d');
  function textShift(f, text, lineH){
    try{
      mctx.font = `${f.bold?'bold ':''}${f.size}px ${(f.family||'sans-serif').replace(/["']/g,'')}`;
      const m = mctx.measureText(String(text||'M'));
      const asc = m.actualBoundingBoxAscent, desc = m.actualBoundingBoxDescent;
      const fa = m.fontBoundingBoxAscent, fd = m.fontBoundingBoxDescent;
      if(!isFinite(asc) || !isFinite(desc) || !isFinite(fa) || !isFinite(fd)) return 0;
      const baselineFromTop = (lineH - (fa + fd)) / 2 + fa;      // 基线在行盒内的位置
      const visualCenter = baselineFromTop - (asc - desc) / 2;    // 字形视觉中心在行盒内的位置
      return +(lineH / 2 - visualCenter).toFixed(2);              // 补偿量：让视觉中心落到盒中线
    }catch(e){ return 0; }
  }
  const cell = (style, text, shift) =>
    `<span style="display:inline-block;vertical-align:top;position:relative;top:${shift||0}px;line-height:${H}px;margin-right:8px;${style}">${text}</span>`;
  const tcell = (style, text, shift) =>
    `<span style="display:inline-block;vertical-align:top;position:relative;top:${shift||0}px;line-height:${TH}px;${style}">${text}</span>`;

  el.innerHTML = `
    <div style="margin-bottom:12px;font-size:0">
      ${tcell(fontStyle(es.fontThreadNo), 'No.'+threadNoStr(t), textShift(es.fontThreadNo, 'No.'+threadNoStr(t), TH) + (fo.threadNo||0))}
      ${tcell(fontStyle(es.fontTitle)+'margin-left:8px;', esc(t.title), textShift(es.fontTitle, t.title, TH) + (fo.title||0))}
    </div>
    ${slice.map((p,i)=>{
      const idx = from-1+i;
      const a = getCharDisplay(p.charId, p.snapshot);
      const isOP = idx===0;
      const displayName = a.showName!==false ? a.name : a.code;
      const floorText = isOP?'No.'+threadNoStr(t)+'000':'No.'+threadNoStr(t)+floorNo(t,idx);
      const opTagStyle = fontStyle(es.fontOpTag) + `background:${esc(t.opColor||'#c03c2b')};padding:0 6px;border-radius:3px;`;
      const opTag = isOP ? cell(opTagStyle, esc(t.opLabel||'楼主'), (fo.opTag||0)) : '';
      const nameStyle = fontStyle(es.fontName) + (es.nameUseCharColor ? `color:${a.color};` : '');
      return `<div class="xpost" style="background:${es.postBgColor};${borderCss}border-radius:${es.postBorderRadius}px">
        <div class="xpost-header" style="display:block;font-size:0">
          ${cell(fontStyle(es.fontFloor), floorText, textShift(es.fontFloor, floorText, H) + (fo.floor||0))}
          ${cell(nameStyle, esc(displayName), textShift(es.fontName, displayName, H) + (fo.name||0))}
          ${opTag}
        </div>
        <div style="${fontStyle(es.fontContent)};white-space:pre-wrap;word-break:break-word">${renderContent(p.content)}</div>
      </div>`;
    }).join('')}
  `;
}

function doExport(){
  saveExportSettings();
  const node = document.getElementById('export-preview');
  if(typeof html2canvas === 'undefined'){
    alert('导出组件还没加载完，请稍等一秒再点一次'); return;
  }
  html2canvas(node, { backgroundColor: db.settings.exportBgColor, scale:2 }).then(canvas=>{
    const name = `anon-thread-${Date.now()}.png`;
    // 用 blob 下载：手机上比 dataURL 更稳（部分浏览器限制超长 dataURL）
    if(canvas.toBlob){
      canvas.toBlob(blob=>{
        if(!blob){ saveDataURL(canvas.toDataURL('image/png'), name); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.download = name;
        a.href = url;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(()=>URL.revokeObjectURL(url), 5000);
      }, 'image/png');
    } else {
      saveDataURL(canvas.toDataURL('image/png'), name);
    }
  }).catch(e=>{
    console.error(e);
    alert('导出失败：' + e.message);
  });
}
function saveDataURL(url, name){
  const a = document.createElement('a');
  a.download = name;
  a.href = url;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ---------- 工具 ----------
function esc(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---------- 导航 ----------
function switchPage(name){
  document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));
  document.getElementById('page-'+name).classList.remove('hidden');
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active', b.dataset.page===name));
  if(name==='chars') renderChars();
  if(name==='threads') renderThreads();
  if(name==='export'){
    refreshFontSelects();      // 先填充字体下拉框
    loadExportSettings();      // 再恢复选中值
    refreshExportSelect();
    refreshExportRange();
    renderExportPreview();
  }
  if(name==='editor'){ refreshCharSelects(); }
}
document.querySelectorAll('nav button').forEach(b=>{
  b.addEventListener('click', ()=>switchPage(b.dataset.page));
});

// 回车提交支持
document.addEventListener('keydown', function(e){
  if(e.key === 'Enter' && !e.shiftKey){
    const active = document.activeElement;
    if(active.id === 'new-char-name'){
      e.preventDefault();
      createChar();
    }
    if(active.id === 'new-thread-title' || active.id === 'new-thread-oplabel'){
      e.preventDefault();
      createThread();
    }
  }
});

// 初始化
initFontDB().then(()=>{
  loadCustomFonts();
  refreshFontSelects();
});
refreshCharSelects();
renderThreads();
renderChars();

// html2canvas 由 index.html 内联/本地引入（单文件版则直接内联），这里只做兜底
if(typeof html2canvas === 'undefined'){
  const s = document.createElement('script');
  s.src = 'vendor/html2canvas.min.js';
  s.onerror = ()=>console.warn('html2canvas 未加载，导出 PNG 可能不可用');
  document.head.appendChild(s);
}
