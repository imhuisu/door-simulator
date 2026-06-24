/*
 * 브라우저 SVG 렌더러
 * DoorEngine.build()가 만든 shapes 배열을 받아 SVG로 그린다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DoorSvgRenderer = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  var NS = 'http://www.w3.org/2000/svg';
  var XLINK = 'http://www.w3.org/1999/xlink';

  function el(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function bust(src, cb) {
    if (!cb) return src;
    return src + (src.indexOf('?') >= 0 ? '&' : '?') + 't=' + cb;
  }

  function render(svg, result, opts) {
    opts = opts || {};
    var texMap = opts.textureMap || {};
    var cb = opts.cacheBust || null;
    var disclaimers = result.disclaimers || [];
    var totalH = result.totalHeight || result.height;
    svg.setAttribute('viewBox', '0 0 ' + result.width + ' ' + totalH);
    svg.setAttribute('width', result.width);
    svg.setAttribute('height', totalH);
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    var defs = el('defs', {});
    defs.appendChild(grad('gg', [['0', '#dfe5e6'], ['0.5', '#aeb6b8'], ['1', '#cfd6d8']]));
    defs.appendChild(grad('gold', [['0', '#8a5a32'], ['0.45', '#d89a62'], ['0.55', '#e8b27a'], ['1', '#9a6638']]));
    defs.appendChild(almGrad('almH', false));  // 수평 부재: 위 밝고 아래 어두움
    defs.appendChild(almGrad('almV', true));   // 수직 부재: 왼쪽 밝고 오른쪽 어두움
    svg.appendChild(defs);

    var GLASS_SRC = bust('/ref/color/%EA%B8%B0%ED%83%80/glass.jpg', cb);
    var clipSeq = 0;
    result.shapes.forEach(function (s) {
      if (s.t === 'rect' && s.fill === 'glass') {
        var gcid = 'glassClip' + (clipSeq++);
        var gcp = el('clipPath', { id: gcid });
        gcp.appendChild(el('rect', { x: s.x, y: s.y, width: s.w, height: s.h }));
        svg.querySelector('defs').appendChild(gcp);
        var gim = el('image', {
          x: s.x, y: s.y, width: s.w, height: s.h,
          preserveAspectRatio: 'xMidYMid slice',
          'clip-path': 'url(#' + gcid + ')'
        });
        gim.setAttributeNS(XLINK, 'href', GLASS_SRC);
        gim.setAttribute('href', GLASS_SRC);
        svg.appendChild(gim);
        if (s.stroke) {
          svg.appendChild(el('rect', { x: s.x, y: s.y, width: s.w, height: s.h, fill: 'none', stroke: s.stroke, 'stroke-width': s.sw || 1 }));
        }
      } else if (s.t === 'rect') {
        svg.appendChild(el('rect', mapRect(s)));
      } else if (s.t === 'line') {
        svg.appendChild(el('line', {
          x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2,
          stroke: s.stroke, 'stroke-width': s.sw, opacity: s.opacity == null ? 1 : s.opacity
        }));
      } else if (s.t === 'texture') {
        var url = texMap[s.colorId] || bust(s.image, cb);
        drawTexture(svg, s, url, clipSeq++);
      } else if (s.t === 'photo') {
        var clipId = 'photoClip' + (clipSeq++);
        var cp = el('clipPath', { id: clipId });
        var cx_clip = s.clipX != null ? s.clipX : s.x;
        var cw_clip = s.clipW != null ? s.clipW : s.w;
        var cy = s.clipY != null ? s.clipY : s.y;
        var ch = s.clipH != null ? s.clipH : s.h;
        cp.appendChild(el('rect', { x: cx_clip, y: cy, width: cw_clip, height: ch }));
        svg.querySelector('defs').appendChild(cp);
        var bsrc = bust(s.src, cb);
        if (s.rotate === 90) {
          var cxR = s.x + s.w / 2;
          var cyR = cy + ch / 2;
          var g90 = el('g', { 'clip-path': 'url(#' + clipId + ')' });
          var im = el('image', {
            x: cxR - ch / 2, y: cyR - s.w / 2,
            width: ch, height: s.w,
            preserveAspectRatio: 'xMidYMid slice',
            transform: 'rotate(90,' + cxR + ',' + cyR + ')'
          });
          im.setAttributeNS(XLINK, 'href', bsrc);
          im.setAttribute('href', bsrc);
          g90.appendChild(im);
          svg.appendChild(g90);
        } else {
          var im = el('image', {
            x: s.x, y: s.y, width: s.w, height: s.h,
            preserveAspectRatio: s.preserveAspect || 'xMidYMid slice',
            'clip-path': 'url(#' + clipId + ')'
          });
          if (s.brightness) im.style.filter = 'brightness(' + s.brightness + ')';
          im.setAttributeNS(XLINK, 'href', bsrc);
          im.setAttribute('href', bsrc);
          svg.appendChild(im);
        }
      } else if (s.t === 'spotlight') {
        var sid = 'sp' + (clipSeq++);
        var cx  = s.cx  != null ? s.cx  : 0.5;
        var cy  = s.cy  != null ? s.cy  : 0.15;
        var r   = s.r   != null ? s.r   : 0.75;
        var bOp = s.brightOp != null ? s.brightOp : 0.15;
        var dOp = s.darkOp   != null ? s.darkOp   : 0.10;
        var rg = el('radialGradient', { id: sid, cx: cx, cy: cy, r: r, fx: cx, fy: cy, gradientUnits: 'objectBoundingBox' });
        var sp1 = el('stop', { offset: '0',   'stop-color': '#ffffff', 'stop-opacity': bOp });
        var mid = s.midStop != null ? s.midStop : 0.3;
        var sp2 = el('stop', { offset: String(mid), 'stop-color': '#ffffff', 'stop-opacity': '0.01' });
        var sp3 = el('stop', { offset: '1',   'stop-color': '#000000', 'stop-opacity': dOp });
        rg.appendChild(sp1); rg.appendChild(sp2); rg.appendChild(sp3);
        svg.querySelector('defs').appendChild(rg);
        svg.appendChild(el('rect', { x: s.x, y: s.y, width: s.w, height: s.h, fill: 'url(#' + sid + ')' }));
      } else if (s.t === 'gradRect') {
        var gid = 'gr' + (clipSeq++);
        var col = s.fill || '#000000';
        var op1 = s.opacity1 != null ? s.opacity1 : 0;
        var op2 = s.opacity2 != null ? s.opacity2 : 0;
        var lg = el('linearGradient', { id: gid, x1: '0', y1: '0', x2: s.horiz ? '1' : '0', y2: s.horiz ? '0' : '1' });
        var st1 = el('stop', { offset: '0', 'stop-color': col, 'stop-opacity': op1 });
        var st2 = el('stop', { offset: '1', 'stop-color': col, 'stop-opacity': op2 });
        lg.appendChild(st1); lg.appendChild(st2);
        svg.querySelector('defs').appendChild(lg);
        svg.appendChild(el('rect', { x: s.x, y: s.y, width: s.w, height: s.h, fill: 'url(#' + gid + ')' }));
      } else if (s.t === 'image') {
        var bhref = bust(s.href, cb);
        var im2 = el('image', { x: s.x, y: s.y, width: s.w, height: s.h, preserveAspectRatio: 'none' });
        im2.setAttributeNS(XLINK, 'href', bhref); im2.setAttribute('href', bhref);
        svg.appendChild(im2);
      } else if (s.t === 'photoTile') {
        var tcid = 'tileClip' + (clipSeq++);
        var tcp = el('clipPath', { id: tcid });
        tcp.appendChild(el('rect', { x: s.x, y: s.y, width: s.w, height: s.h }));
        svg.querySelector('defs').appendChild(tcp);
        var btsrc = bust(s.src, cb);
        var numTiles = Math.ceil(s.w / s.tileW) + 1;
        for (var ti = 0; ti < numTiles; ti++) {
          var tim = el('image', {
            x: s.x + ti * s.tileW, y: s.y, width: s.tileW, height: s.h,
            preserveAspectRatio: 'none', 'clip-path': 'url(#' + tcid + ')'
          });
          tim.setAttributeNS(XLINK, 'href', btsrc);
          tim.setAttribute('href', btsrc);
          svg.appendChild(tim);
        }
      } else if (s.t === 'path') {
        var pe = el('path', { d: s.d, fill: s.fill || 'none', stroke: s.stroke || '#000000', 'stroke-width': s.sw || 1, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: s.opacity == null ? 1 : s.opacity });
        svg.appendChild(pe);
      }
    });
    if (disclaimers.length > 0) {
      var textAreaH = totalH - result.height;
      svg.appendChild(el('rect', { x: 0, y: result.height, width: result.width, height: textAreaH, fill: '#f5f3f0' }));
      disclaimers.forEach(function(txt, i) {
        var tEl = el('text', {
          x: 6, y: result.height + 14 + i * 14,
          'font-size': '9.5', fill: '#555555', 'font-family': 'sans-serif'
        });
        tEl.textContent = txt;
        svg.appendChild(tEl);
      });
    }
  }

  function mapRect(s) {
    var a = { x: s.x, y: s.y, width: s.w, height: s.h };
    if (s.fill === 'glass') a.fill = 'url(#gg)';
    else if (s.fill === 'gold') a.fill = 'url(#gold)';
    else if (s.fill === 'almH') a.fill = 'url(#almH)';
    else if (s.fill === 'almV') a.fill = 'url(#almV)';
    else a.fill = s.fill;
    if (s.stroke) { a.stroke = s.stroke; a['stroke-width'] = s.sw || 1; }
    if (s.opacity != null) a.opacity = s.opacity;
    if (s.rx != null) a.rx = s.rx;
    return a;
  }

  function drawTexture(svg, s, url, seq) {
    if (!url) {
      svg.appendChild(el('rect', { x: s.x, y: s.y, width: s.w, height: s.h, fill: '#6a5038' }));
      return;
    }
    var sw = s.w / s.strips;
    for (var i = 0; i < s.strips; i++) {
      var sx = s.x + i * sw;
      var cid = 'clip' + seq + '_' + i;
      var cp = el('clipPath', { id: cid });
      cp.appendChild(el('rect', { x: sx, y: s.y, width: sw + 0.5, height: s.h }));
      svg.appendChild(cp);
      var g = el('g', { 'clip-path': 'url(#' + cid + ')' });
      var flip = s.flip[i], imgW = sw * 1.4, offX = sx - (imgW - sw) * (0.3 + 0.4 * (i % 3) / 2);
      var im = el('image', {
        x: offX, y: s.y, width: imgW, height: s.h, preserveAspectRatio: 'none',
        transform: flip < 0 ? ('translate(' + (2 * offX + imgW) + ',0) scale(-1,1)') : ''
      });
      im.setAttributeNS(XLINK, 'href', url); im.setAttribute('href', url);
      g.appendChild(im);
      var sh = s.shade[i];
      g.appendChild(el('rect', { x: sx, y: s.y, width: sw + 0.5, height: s.h, fill: sh > 0 ? '#fff' : '#000', opacity: Math.abs(sh).toFixed(3) }));
      if (i > 0) g.appendChild(el('line', { x1: sx, y1: s.y, x2: sx, y2: s.y + s.h, stroke: '#000', 'stroke-width': 0.5, opacity: 0.1 }));
      svg.appendChild(g);
    }
  }

  function grad(id, stops) {
    var g = el('linearGradient', { id: id, x1: '0', y1: '0', x2: '1', y2: '0' });
    stops.forEach(function (st) { g.appendChild(el('stop', { offset: st[0], 'stop-color': st[1] })); });
    return g;
  }

  // 알루미늄 프레임 그라디언트: isVertical=true → 좌우(수직 부재), false → 상하(수평 부재)
  function almGrad(id, isVertical) {
    var g = el('linearGradient', {
      id: id,
      x1: '0', y1: '0',
      x2: isVertical ? '1' : '0',
      y2: isVertical ? '0' : '1',
      gradientUnits: 'objectBoundingBox'
    });
    g.appendChild(el('stop', { offset: '0%',   'stop-color': '#1c1c22' }));
    g.appendChild(el('stop', { offset: '10%',  'stop-color': '#0c0c0e' }));
    g.appendChild(el('stop', { offset: '100%', 'stop-color': '#080809' }));
    return g;
  }

  return { render: render };
});
