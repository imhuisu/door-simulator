const path = require('path');
const fs = require('fs');
const http = require('http');
const url = require('url');

let sharp;
try { sharp = require('sharp'); } catch(e) { sharp = null; }

const THUMB_SIZE = 200;
const thumbCache = {};

const ROOT = path.join(__dirname, '..');
const CUSTOM_DIR = path.join(ROOT, 'Custom');
const DoorEngine = require(path.join(ROOT, 'src/engine.js'));
const { renderSVG } = require('./svg-server.js');

const DATA = {
  colors: JSON.parse(fs.readFileSync(path.join(ROOT, 'data/colors.json'))),
  models: JSON.parse(fs.readFileSync(path.join(ROOT, 'data/models.json'))),
  config: JSON.parse(fs.readFileSync(path.join(ROOT, 'data/config.json'))),
};

// 색상 텍스처를 요청 시마다 디스크에서 읽어 dataURL로 인라인 (파일 변경 즉시 반영)
function buildTexMap() {
  const map = {};
  DATA.colors.forEach(c => {
    if (c.image) {
      const p = path.join(ROOT, 'public', c.image);
      try {
        const b = fs.readFileSync(p).toString('base64');
        map[c.id] = 'data:image/jpeg;base64,' + b;
      } catch(e) {}
    }
  });
  return map;
}

// 카탈로그 도어 이미지: 참조이미지/door/ 하위 스캔
const DOOR_DIR = path.join(CUSTOM_DIR, '참조이미지', 'door');
const SERIES_MAP = { '로이': '로이도어' };
const CATALOG = {};

function buildCatalog() {
  const scanDir = fs.existsSync(DOOR_DIR) ? DOOR_DIR : CUSTOM_DIR;
  const urlBase = fs.existsSync(DOOR_DIR) ? '/ref/door/' : '/images/';
  if (!fs.existsSync(scanDir)) return;
  fs.readdirSync(scanDir).forEach(seriesFolder => {
    const seriesPath = path.join(scanDir, seriesFolder);
    try { if (!fs.statSync(seriesPath).isDirectory()) return; } catch(e) { return; }
    const seriesKey = SERIES_MAP[seriesFolder] || seriesFolder;
    CATALOG[seriesKey] = {};
    fs.readdirSync(seriesPath).forEach(file => {
      const ext = path.extname(file).toLowerCase();
      if (ext !== '.jpg' && ext !== '.png') return;
      const base = file.slice(0, file.length - ext.length);
      const match = base.match(/^(\d+)\s+(.+)$/) || base.match(/^(\d+)([A-Z]{2,}.*)$/);
      if (!match) return;
      const modelNum = match[1];
      const colorCode = match[2].trim();
      if (!CATALOG[seriesKey][modelNum]) CATALOG[seriesKey][modelNum] = {};
      CATALOG[seriesKey][modelNum][colorCode] = urlBase
        + encodeURIComponent(seriesFolder) + '/' + encodeURIComponent(file);
    });
  });
}
buildCatalog();
DATA.catalog = CATALOG;

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript',
  '.json': 'application/json', '.jpg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css'
};

function parseState(q) {
  return {
    product: q.product || '엔토브',
    model: q.model || 'E301',
    color: q.color || 'corten-brown',
    colorCode: q.colorCode || null,
    glass: q.glass === '2' ? 2 : (q.glass === '0' ? 0 : q.glass || 2),
    material: q.material || 'glass',
    fix: q.fix === 'true' || q.fix === '1',
    fixMat: q.fixMat || 'glass',
    hinge: q.hinge || 'R',
    fw: +q.fw || 1500, fh: +q.fh || 2300, dw: +q.dw || 900, dh: +q.dh || 2100,
    handleMM: +q.handleMM || 1600,
    keyId: q.keyId,
  };
}

const server = http.createServer((req, res) => {
  const u = url.parse(req.url, true);

  // Custom/ 이미지 서빙
  if (u.pathname.startsWith('/images/')) {
    const parts = u.pathname.slice('/images/'.length).split('/').map(p => decodeURIComponent(p));
    const abs = path.normalize(path.join(CUSTOM_DIR, ...parts));
    if (!abs.startsWith(path.normalize(CUSTOM_DIR))) {
      res.writeHead(403); res.end(); return;
    }
    fs.readFile(abs, (err, buf) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      const ext = path.extname(abs).toLowerCase();
      res.writeHead(200, {
        'Content-Type': ext === '.png' ? 'image/png' : 'image/jpeg',
        'Cache-Control': 'no-store'
      });
      res.end(buf);
    });
    return;
  }

  // 참조이미지 서빙 (/ref/... ?thumb=1 로 썸네일 요청 가능)
  if (u.pathname.startsWith('/ref/')) {
    const REF_DIR = path.join(CUSTOM_DIR, '참조이미지');
    const parts = u.pathname.slice('/ref/'.length).split('/').map(p => decodeURIComponent(p));
    const abs = path.normalize(path.join(REF_DIR, ...parts));
    if (!abs.startsWith(path.normalize(REF_DIR))) {
      res.writeHead(403); res.end(); return;
    }
    const isThumb = u.query.thumb === '1';
    if (isThumb && sharp) {
      fs.readFile(abs, (err, buf) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        sharp(buf).resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer()
          .then(out => {
            res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' });
            res.end(out);
          })
          .catch(() => {
            res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' });
            res.end(buf);
          });
      });
      return;
    }
    fs.readFile(abs, (err, buf) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      const ext = path.extname(abs).toLowerCase();
      res.writeHead(200, {
        'Content-Type': ext === '.png' ? 'image/png' : 'image/jpeg',
        'Cache-Control': 'no-store'
      });
      res.end(buf);
    });
    return;
  }

  // 카탈로그 API: 시리즈→모델→색상코드→이미지URL
  if (u.pathname === '/api/catalog') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(CATALOG));
    return;
  }

  // 서버 렌더 API
  if (u.pathname === '/api/render') {
    const state = parseState(u.query);
    const result = DoorEngine.build(state, DATA);
    const svg = renderSVG(result, { textureMap: buildTexMap() });
    res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Access-Control-Allow-Origin': '*' });
    res.end(svg);
    return;
  }

  // PNG 생성 공통 함수
  async function generatePng(state) {
    const result = DoorEngine.build(state, DATA);
    const REF_DIR = path.join(CUSTOM_DIR, '참조이미지');
    const W = result.width, H = result.totalHeight || result.height;
    async function resolveRef(urlPath) {
      try {
        const decoded = decodeURIComponent(urlPath);
        const rel = decoded.replace(/^\/ref\//, '').split('/');
        const abs = path.normalize(path.join(REF_DIR, ...rel));
        if (!abs.startsWith(path.normalize(REF_DIR))) return null;
        const raw = fs.readFileSync(abs);
        const resized = await sharp(raw).resize(600, 600, { fit: 'inside' }).jpeg({ quality: 85 }).toBuffer();
        return 'data:image/jpeg;base64,' + resized.toString('base64');
      } catch(e) { return null; }
    }
    const srcs = new Set();
    const GLASS_KEY = '/ref/color/%EA%B8%B0%ED%83%80/glass.jpg';
    srcs.add(GLASS_KEY);
    result.shapes.forEach(s => {
      if ((s.t === 'photo' || s.t === 'photoTile') && s.src) srcs.add(s.src);
    });
    const photoMap = {};
    await Promise.all([...srcs].map(async src => {
      const data = await resolveRef(src);
      if (data) photoMap[src] = data;
    }));
    const svg = renderSVG(result, { textureMap: buildTexMap(), photoMap });
    return sharp(Buffer.from(svg), { density: 144 })
      .resize(Math.round(W * 2), Math.round(H * 2), { fit: 'inside' })
      .png()
      .toBuffer();
  }

  // PNG API: GET /api/png?s=[JSON] — 모바일 새 탭에서 직접 열기용
  if (u.pathname === '/api/png' && req.method === 'GET' && u.query.s) {
    (async () => {
      try {
        const state = JSON.parse(u.query.s);
        const filename = (state.model || 'door') + '_' + (state.colorCode || '') + '.png';
        const buf = await generatePng(state);
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Content-Disposition': 'inline; filename="' + filename + '"',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(buf);
      } catch(e) {
        res.writeHead(400); res.end('Error: ' + e.message);
      }
    })();
    return;
  }

  // PNG API: POST /api/png (body = JSON state) — 데스크탑 클립보드/저장용
  if (u.pathname === '/api/png' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const state = JSON.parse(body);
        const buf = await generatePng(state);
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Content-Disposition': 'inline; filename="door.png"',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(buf);
      } catch(e) {
        res.writeHead(400); res.end('Bad request: ' + e.message);
      }
    });
    return;
  }

  // 메타 정보 API
  if (u.pathname === '/api/meta') {
    const state = parseState(u.query);
    const result = DoorEngine.build(state, DATA);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(result.meta));
    return;
  }

  // 정적 파일
  let fp = u.pathname === '/' ? '/index.html' : u.pathname;
  let abs;
  if (fp.startsWith('/data/') || fp.startsWith('/src/')) abs = path.join(ROOT, fp);
  else abs = path.join(ROOT, 'public', fp);

  fs.readFile(abs, (err, buf) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(abs)] || 'application/octet-stream' });
    res.end(buf);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Door configurator → http://localhost:' + PORT));
