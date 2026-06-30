/*
 * 서버(Node) SVG 문자열 렌더러
 * DoorEngine.build()의 shapes를 SVG 문자열로 직렬화한다.
 * 결과 SVG는 그대로 응답하거나, sharp로 PNG/JPEG 변환해 다운로드 제공 가능.
 *
 * 색상 텍스처 이미지는 dataURL 또는 파일경로를 <image>에 인라인.
 * textureLoader(colorId) -> dataURL|url  (선택)
 */
function renderSVG(result, opts) {
  opts = opts || {};
  var texMap = opts.textureMap || {};
  var photoMap = opts.photoMap || {};
  var W = result.width, H = result.height;
  var disclaimers = result.disclaimers || [];
  var totalH = result.totalHeight || H;
  var parts = [];
  parts.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ' + W + ' ' + totalH + '" width="' + W + '" height="' + totalH + '">');
  parts.push('<defs>');
  parts.push(grad('gg', [['0', '#dfe5e6'], ['0.5', '#aeb6b8'], ['1', '#cfd6d8']]));
  parts.push(grad('gold', [['0', '#8a5a32'], ['0.45', '#d89a62'], ['0.55', '#e8b27a'], ['1', '#9a6638']]));
  parts.push('</defs>');

  var clipSeq = 0;
  var GLASS_KEY = '/ref/color/%EA%B8%B0%ED%83%80/glass.jpg';
  var GLASS_SRC = photoMap[GLASS_KEY] || GLASS_KEY;
  result.shapes.forEach(function (s) {
    if (s.t === 'rect' && s.fill === 'glass') {
      var gcid = 'glassClip' + (clipSeq++);
      parts.push('<clipPath id="' + gcid + '"><rect x="' + s.x + '" y="' + s.y + '" width="' + s.w + '" height="' + s.h + '"/></clipPath>');
      parts.push('<image x="' + s.x + '" y="' + s.y + '" width="' + s.w + '" height="' + s.h + '" preserveAspectRatio="xMidYMid slice" clip-path="url(#' + gcid + ')" xlink:href="' + GLASS_SRC + '" href="' + GLASS_SRC + '"/>');
      if (s.stroke) parts.push('<rect x="' + s.x + '" y="' + s.y + '" width="' + s.w + '" height="' + s.h + '" fill="none" stroke="' + s.stroke + '" stroke-width="' + (s.sw || 1) + '"/>');
    }
    else if (s.t === 'rect') parts.push(rect(s));
    else if (s.t === 'line') parts.push('<line x1="' + s.x1 + '" y1="' + s.y1 + '" x2="' + s.x2 + '" y2="' + s.y2 + '" stroke="' + s.stroke + '" stroke-width="' + s.sw + '" opacity="' + (s.opacity == null ? 1 : s.opacity) + '"/>');
    else if (s.t === 'texture') parts.push(texture(s, texMap[s.colorId] || s.image, clipSeq++));
    else if (s.t === 'photo') {
      var clipId = 'photoClip' + (clipSeq++);
      var cx = s.clipX != null ? s.clipX : s.x;
      var cw = s.clipW != null ? s.clipW : s.w;
      var cy = s.clipY != null ? s.clipY : s.y;
      var ch = s.clipH != null ? s.clipH : s.h;
      var photoSrc = (photoMap[s.src] || s.src);
      parts.push('<clipPath id="' + clipId + '"><rect x="' + cx + '" y="' + cy + '" width="' + cw + '" height="' + ch + '"/></clipPath>');
      if (s.rotate === 90) {
        var cxR = s.x + s.w / 2;
        var cyR = cy + ch / 2;
        parts.push('<g clip-path="url(#' + clipId + ')"><image x="' + (cxR - ch/2) + '" y="' + (cyR - s.w/2) + '" width="' + ch + '" height="' + s.w + '" preserveAspectRatio="xMidYMid slice" transform="rotate(90,' + cxR + ',' + cyR + ')" xlink:href="' + photoSrc + '" href="' + photoSrc + '"/></g>');
      } else {
        var pa = s.preserveAspect || 'xMidYMid slice';
        parts.push('<image x="' + s.x + '" y="' + s.y + '" width="' + s.w + '" height="' + s.h + '" preserveAspectRatio="' + pa + '" clip-path="url(#' + clipId + ')" xlink:href="' + photoSrc + '" href="' + photoSrc + '"/>');
      }
    }
    else if (s.t === 'gradRect') {
      var gid = 'gr' + (clipSeq++);
      var col = s.fill || '#000000';
      var op1 = s.opacity1 != null ? s.opacity1 : 0;
      var op2 = s.opacity2 != null ? s.opacity2 : 0;
      var hx = s.horiz ? '1' : '0', hy = s.horiz ? '0' : '1';
      parts.push('<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="' + hx + '" y2="' + hy + '"><stop offset="0" stop-color="' + col + '" stop-opacity="' + op1 + '"/><stop offset="1" stop-color="' + col + '" stop-opacity="' + op2 + '"/></linearGradient></defs>');
      parts.push('<rect x="' + s.x + '" y="' + s.y + '" width="' + s.w + '" height="' + s.h + '" fill="url(#' + gid + ')"/>');
    }
    else if (s.t === 'spotlight') {
      var sid = 'sp' + (clipSeq++);
      var cx = s.cx != null ? s.cx : 0.5;
      var cy = s.cy != null ? s.cy : 0.15;
      var r  = s.r  != null ? s.r  : 0.75;
      var bOp = s.brightOp != null ? s.brightOp : 0.15;
      var dOp = s.darkOp   != null ? s.darkOp   : 0.10;
      var mid = s.midStop != null ? s.midStop : 0.3;
      parts.push('<defs><radialGradient id="' + sid + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '" fx="' + cx + '" fy="' + cy + '" gradientUnits="objectBoundingBox"><stop offset="0" stop-color="#ffffff" stop-opacity="' + bOp + '"/><stop offset="' + mid + '" stop-color="#ffffff" stop-opacity="0.01"/><stop offset="1" stop-color="#000000" stop-opacity="' + dOp + '"/></radialGradient></defs>');
      parts.push('<rect x="' + s.x + '" y="' + s.y + '" width="' + s.w + '" height="' + s.h + '" fill="url(#' + sid + ')"/>');
    }
    else if (s.t === 'image') {
      var imgPa = s.preserveAspect || 'none';
      var imgSrc = photoMap[s.href] || s.href;
      parts.push('<image x="' + s.x + '" y="' + s.y + '" width="' + s.w + '" height="' + s.h + '" preserveAspectRatio="' + imgPa + '" xlink:href="' + imgSrc + '" href="' + imgSrc + '"/>');
    }
    else if (s.t === 'path') parts.push('<path d="' + s.d + '" fill="' + (s.fill || 'none') + '" stroke="' + (s.stroke || '#000000') + '" stroke-width="' + (s.sw || 1) + '" stroke-linecap="round" stroke-linejoin="round" opacity="' + (s.opacity == null ? 1 : s.opacity) + '"/>');
    else if (s.t === 'photoTile') {
      var tcid = 'tileClip' + (clipSeq++);
      parts.push('<clipPath id="' + tcid + '"><rect x="' + s.x + '" y="' + s.y + '" width="' + s.w + '" height="' + s.h + '"/></clipPath>');
      var numTiles = Math.ceil(s.w / s.tileW) + 1;
      for (var ti = 0; ti < numTiles; ti++) {
        var tx = s.x + ti * s.tileW;
        parts.push('<image x="' + tx + '" y="' + s.y + '" width="' + s.tileW + '" height="' + s.h + '" preserveAspectRatio="none" clip-path="url(#' + tcid + ')" xlink:href="' + s.src + '" href="' + s.src + '"/>');
      }
    }
  });
  if (disclaimers.length > 0) {
    var textAreaH = totalH - H;
    parts.push('<rect x="0" y="' + H + '" width="' + W + '" height="' + textAreaH + '" fill="#f5f3f0"/>');
    disclaimers.forEach(function(txt, i) {
      parts.push('<text x="6" y="' + (H + 14 + i * 14) + '" font-size="9.5" fill="#555555" font-family="\'Malgun Gothic\', \'Noto Sans CJK KR\', \'Noto Sans KR\', \'Apple SD Gothic Neo\', sans-serif">' + txt + '</text>');
    });
  }
  parts.push('</svg>');
  return parts.join('');
}

function rect(s) {
  var fill = s.fill === 'glass' ? 'url(#gg)' : s.fill === 'gold' ? 'url(#gold)' : s.fill;
  var a = 'x="' + s.x + '" y="' + s.y + '" width="' + s.w + '" height="' + s.h + '" fill="' + fill + '"';
  if (s.stroke) a += ' stroke="' + s.stroke + '" stroke-width="' + (s.sw || 1) + '"';
  if (s.opacity != null) a += ' opacity="' + s.opacity + '"';
  if (s.rx != null) a += ' rx="' + s.rx + '"';
  return '<rect ' + a + '/>';
}

function texture(s, url, seq) {
  if (!url) return '<rect x="' + s.x + '" y="' + s.y + '" width="' + s.w + '" height="' + s.h + '" fill="#6a5038"/>';
  var sw = s.w / s.strips, out = [];
  for (var i = 0; i < s.strips; i++) {
    var sx = s.x + i * sw, cid = 'clip' + seq + '_' + i;
    out.push('<clipPath id="' + cid + '"><rect x="' + sx + '" y="' + s.y + '" width="' + (sw + 0.5) + '" height="' + s.h + '"/></clipPath>');
    out.push('<g clip-path="url(#' + cid + ')">');
    var flip = s.flip[i], imgW = sw * 1.4, offX = sx - (imgW - sw) * (0.3 + 0.4 * (i % 3) / 2);
    var tr = flip < 0 ? ' transform="translate(' + (2 * offX + imgW) + ',0) scale(-1,1)"' : '';
    out.push('<image x="' + offX + '" y="' + s.y + '" width="' + imgW + '" height="' + s.h + '" preserveAspectRatio="none" xlink:href="' + url + '"' + tr + '/>');
    var sh = s.shade[i];
    out.push('<rect x="' + sx + '" y="' + s.y + '" width="' + (sw + 0.5) + '" height="' + s.h + '" fill="' + (sh > 0 ? '#fff' : '#000') + '" opacity="' + Math.abs(sh).toFixed(3) + '"/>');
    if (i > 0) out.push('<line x1="' + sx + '" y1="' + s.y + '" x2="' + sx + '" y2="' + (s.y + s.h) + '" stroke="#000" stroke-width="0.5" opacity="0.1"/>');
    out.push('</g>');
  }
  return out.join('');
}

function grad(id, stops) {
  var s = '<linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="0">';
  stops.forEach(function (st) { s += '<stop offset="' + st[0] + '" stop-color="' + st[1] + '"/>'; });
  return s + '</linearGradient>';
}

module.exports = { renderSVG: renderSVG };
