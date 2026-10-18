// Interactive checklist for GAPS.md — a dev-only tool.
//
//   node tools/gaps-checklist.mjs           # serves on http://localhost:3002
//   PORT=4000 node tools/gaps-checklist.mjs
//
// Ticking a box writes STRAIGHT BACK to GAPS.md (cycling [ ] → [~] → [x] → [ ]),
// so the repo file stays the single source of truth. No build, no dependencies.
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAPS_PATH = join(__dirname, '..', 'GAPS.md');
const PORT = Number(process.env.PORT) || 3002; // 3001 is the /demo instance

const ITEM_RE = /^(\s*)- \[([ x~])\] (.*)$/;
const CHECK_RE = /- \[[ x~]\]/;
const statusOf = (c) => (c === 'x' ? 'done' : c === '~' ? 'partial' : 'todo');

async function parse() {
  const raw = await readFile(GAPS_PATH, 'utf8');
  const lines = raw.split('\n');
  const sections = [];
  let current = null;
  lines.forEach((line, i) => {
    const h = line.match(/^(#{2,3})\s+(.*)$/);
    if (h) {
      current = { title: h[2].trim(), items: [] };
      sections.push(current);
      return;
    }
    const m = line.match(ITEM_RE);
    if (m && current) current.items.push({ line: i, status: statusOf(m[2]), text: m[3] });
  });
  return sections.filter((s) => s.items.length);
}

// Cycle the checkbox on one line and persist.
async function toggle(lineNo) {
  const raw = await readFile(GAPS_PATH, 'utf8');
  const lines = raw.split('\n');
  const m = lines[lineNo]?.match(ITEM_RE);
  if (!m) return null;
  const next = m[2] === ' ' ? '~' : m[2] === '~' ? 'x' : ' ';
  lines[lineNo] = lines[lineNo].replace(CHECK_RE, `- [${next}]`);
  await writeFile(GAPS_PATH, lines.join('\n'));
  return statusOf(next);
}

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/') return send(res, 200, PAGE, 'text/html; charset=utf-8');
    if (req.method === 'GET' && req.url === '/api/gaps') return send(res, 200, JSON.stringify(await parse()));
    if (req.method === 'POST' && req.url === '/api/toggle') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const { line } = JSON.parse(body || '{}');
      const status = await toggle(Number(line));
      return status ? send(res, 200, JSON.stringify({ status })) : send(res, 400, JSON.stringify({ error: 'not a checklist line' }));
    }
    send(res, 404, 'Not found', 'text/plain');
  } catch (err) {
    send(res, 500, JSON.stringify({ error: String(err?.message || err) }));
  }
});

server.listen(PORT, () => {
  console.log(`\n  KinderBase gap checklist → http://localhost:${PORT}`);
  console.log(`  Editing ${GAPS_PATH}`);
  console.log(`  Click a box to cycle  ☐ → ◐ → ☑  (writes back to the file).\n`);
});
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error(`\n  Port ${PORT} is in use. Try:  PORT=4000 node tools/gaps-checklist.mjs\n`);
  else throw e;
});

const PAGE = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>KinderBase — Gap checklist</title>
<style>
  :root { --bg:#f6f5f1; --card:#fff; --line:#eceae4; --ink:#1f2937; --muted:#6b7280; --brand:#d97642; }
  * { box-sizing:border-box; }
  body { margin:0; font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:var(--bg); color:var(--ink); }
  header { position:sticky; top:0; z-index:5; background:rgba(246,245,241,.92); backdrop-filter:blur(8px); border-bottom:1px solid var(--line); padding:16px 20px; }
  .wrap { max-width:860px; margin:0 auto; }
  h1 { font-size:18px; margin:0 0 10px; }
  .bar { height:8px; background:#e5e3dd; border-radius:99px; overflow:hidden; display:flex; }
  .bar .done { background:#16a34a; } .bar .partial { background:#d97706; }
  .counts { display:flex; gap:14px; flex-wrap:wrap; font-size:12px; color:var(--muted); margin-top:8px; }
  .counts b { color:var(--ink); }
  .filters { display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
  .filters button { font:12px inherit; border:1px solid var(--line); background:#fff; color:var(--muted); border-radius:99px; padding:4px 11px; cursor:pointer; }
  .filters button.on { background:var(--ink); color:#fff; border-color:var(--ink); }
  main { max-width:860px; margin:18px auto 80px; padding:0 20px; }
  section { margin-bottom:22px; }
  h2 { font-size:13px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); margin:0 0 8px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:14px; overflow:hidden; }
  .item { display:flex; gap:12px; padding:11px 14px; border-top:1px solid var(--line); cursor:pointer; align-items:flex-start; }
  .item:first-child { border-top:0; }
  .item:hover { background:#faf9f6; }
  .box { flex:0 0 auto; width:20px; height:20px; border-radius:6px; border:2px solid #cfcdc6; margin-top:1px; display:flex; align-items:center; justify-content:center; font-size:13px; color:#fff; }
  .box.done { background:#16a34a; border-color:#16a34a; } .box.partial { background:#d97706; border-color:#d97706; }
  .title { font-weight:600; } .item.done .title { color:var(--muted); text-decoration:line-through; }
  .desc { color:var(--muted); font-size:12.5px; margin-top:2px; }
  .tags { display:inline-flex; gap:5px; flex-wrap:wrap; margin-left:6px; vertical-align:middle; }
  .tag { font-size:10px; font-weight:700; border-radius:5px; padding:1px 6px; background:#eceae4; color:#555; }
  .tag.p0 { background:#fee2e2; color:#b91c1c; } .tag.p1 { background:#ffedd5; color:#9a5a16; } .tag.p2 { background:#eef2ff; color:#4f46e5; }
  .tag.legal { background:#fde68a; color:#92400e; } .tag.spec { background:#e0f2fe; color:#0369a1; } .tag.branch { background:#dcfce7; color:#15803d; }
  .saved { position:fixed; bottom:16px; left:50%; transform:translateX(-50%); background:var(--ink); color:#fff; padding:7px 14px; border-radius:99px; font-size:12px; opacity:0; transition:opacity .2s; pointer-events:none; }
  .saved.show { opacity:1; }
  .hide { display:none !important; }
</style>
</head>
<body>
<header><div class="wrap">
  <h1>KinderBase — Gap checklist</h1>
  <div class="bar"><div class="done" id="barDone"></div><div class="partial" id="barPartial"></div></div>
  <div class="counts" id="counts"></div>
  <div class="filters">
    <button data-f="all" class="on">All</button>
    <button data-f="p0">P0 only</button>
    <button data-f="legal">Legal</button>
    <button data-f="open">Unfinished</button>
    <button data-f="hidedone">Hide done</button>
  </div>
</div></header>
<main id="root"></main>
<div class="saved" id="saved">Saved to GAPS.md</div>
<script>
const SYM = { done:'✓', partial:'◐', todo:'' };
let data = [], filter = 'all';

function parseText(t){
  const title = (t.match(/\\*\\*(.+?)\\*\\*/)||[])[1] || t;
  const tags = [...t.matchAll(/\`([^\`]+)\`/g)].map(m=>m[1]);
  let desc = t.replace(/\\*\\*(.+?)\\*\\*/g,'').replace(/\`[^\`]+\`/g,'').replace(/^[\\s—–-]+/,'').trim();
  return { title, tags, desc };
}
function tagClass(tag){
  if(tag==='P0')return'p0'; if(tag==='P1')return'p1'; if(tag==='P2')return'p2';
  if(tag.includes('LEGAL'))return'legal'; if(/^S\\d|^SP$/.test(tag))return'spec';
  if(tag==='(branch)')return'branch'; return '';
}
function itemMatches(it){
  const {tags} = parseText(it.text);
  if(filter==='p0') return tags.includes('P0');
  if(filter==='legal') return tags.some(t=>t.includes('LEGAL'));
  if(filter==='open') return it.status!=='done';
  if(filter==='hidedone') return it.status!=='done';
  return true;
}
function render(){
  const root = document.getElementById('root');
  root.innerHTML = '';
  let done=0, partial=0, total=0;
  data.forEach(sec=>{
    const items = sec.items.filter(itemMatches);
    sec.items.forEach(it=>{ total++; if(it.status==='done')done++; else if(it.status==='partial')partial++; });
    if(!items.length) return;
    const s = document.createElement('section');
    s.innerHTML = '<h2>'+sec.title+'</h2>';
    const card = document.createElement('div'); card.className='card';
    items.forEach(it=>{
      const {title,tags,desc} = parseText(it.text);
      const row = document.createElement('div'); row.className='item '+it.status;
      row.innerHTML =
        '<div class="box '+it.status+'">'+SYM[it.status]+'</div>'+
        '<div><span class="title">'+title+'</span>'+
        (tags.length?'<span class="tags">'+tags.map(t=>'<span class="tag '+tagClass(t)+'">'+t+'</span>').join('')+'</span>':'')+
        (desc?'<div class="desc">'+desc+'</div>':'')+'</div>';
      row.onclick = ()=>toggle(it, row);
      card.appendChild(row);
    });
    s.appendChild(card); root.appendChild(s);
  });
  const pct = total? Math.round((done+partial*0.5)/total*100):0;
  document.getElementById('barDone').style.width = (done/total*100)+'%';
  document.getElementById('barPartial').style.width = (partial/total*100)+'%';
  document.getElementById('counts').innerHTML =
    '<span><b>'+done+'</b> built</span><span><b>'+partial+'</b> partial</span>'+
    '<span><b>'+(total-done-partial)+'</b> not started</span><span><b>'+total+'</b> total</span>'+
    '<span><b>'+pct+'%</b> complete</span>';
}
async function toggle(it){
  const r = await fetch('/api/toggle',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({line:it.line})});
  if(!r.ok) return;
  it.status = (await r.json()).status;
  flashSaved(); render();
}
let savedT;
function flashSaved(){ const e=document.getElementById('saved'); e.classList.add('show'); clearTimeout(savedT); savedT=setTimeout(()=>e.classList.remove('show'),900); }
document.querySelectorAll('.filters button').forEach(b=>b.onclick=()=>{
  filter=b.dataset.f; document.querySelectorAll('.filters button').forEach(x=>x.classList.toggle('on',x===b)); render();
});
async function load(){ data = await (await fetch('/api/gaps')).json(); render(); }
load();
</script>
</body>
</html>`;
