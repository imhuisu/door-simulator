(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DoorEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  var FRAME_BLACK = '#0c0c0d';

  // ── 엔토브 고정 치수 (mm) ── 엑셀 참조 기준
  var E = {
    topFr    : 90,   // 상단 블랙 프레임 (남마 없음)
    topFr2   : 20,   // 남마 있음: 상부2 (최상단)
    topFr1   : 20,   // 남마 있음: 상부1 (문 바로 위 구분)
    keyFr    : 120,  // 소대0개일 때 전자키측 프레임 너비
    outFr    : 30,   // 외부 아우터 프레임 (경첩측 / 소대시 모든 외부)
    mullKey  : 105,  // 소대 있을 때 전자키측 멀리언 너비
    mullStd  : 20,   // 소대 있을 때 경첩측 멀리언 너비
    btmSlv   : 20,   // 하부 실버 프레임 높이
    sideFrame: 60    // 소대 내부 알루미늄 서브프레임 (상하좌우 동일)
  };

  function rnd(seed, x, y) {
    var s = Math.sin(seed * 127.1 + x * 0.13 + y * 0.07) * 43758.5453;
    return s - Math.floor(s);
  }
  function findColor(colors, id) {
    for (var i = 0; i < colors.length; i++) if (colors[i].id === id) return colors[i];
    return colors[0];
  }
  function findModel(models, id) {
    for (var i = 0; i < models.length; i++) if (models[i].id === id) return models[i];
    return models[0];
  }
  function clamp(v, lo, hi, def) {
    v = parseInt(v, 10);
    if (!v || v < lo || v > hi) return def;
    return v;
  }

  // ═══════════════════════════════════════════
  //  메인 빌드 진입점
  // ═══════════════════════════════════════════
  function build(state, data) {
    var models  = data.models;
    var catalog = data.catalog || {};
    var M = findModel(models, state.model);

    var seriesKey = M.series;
    var modelNum  = M.id.replace(/^[A-Z]/, '');
    var colorCode = state.colorCode || '';
    var photoSrc  = (catalog[seriesKey] && catalog[seriesKey][modelNum] && catalog[seriesKey][modelNum][colorCode]) || null;

    // 판재 텍스처: color/{colorFolder}/{colorCode}.jpg
    var colorFolder = M.colorFolder || M.series;
    var panelSrc = colorCode
      ? '/ref/color/' + encodeURIComponent(colorFolder) + '/' + encodeURIComponent(colorCode) + '.jpg'
      : null;

    var result;
    if (M.series === '엔토브') {
      var handleColorCode = (M.handleColorMap && M.handleColorMap[colorCode]) || colorCode;
      var handleSrc = (handleColorCode && handleColorCode !== colorCode)
        ? '/ref/color/' + encodeURIComponent(colorFolder) + '/' + encodeURIComponent(handleColorCode) + '.jpg'
        : panelSrc;
      result = buildEntob(state, M, panelSrc, handleSrc);
    } else {
      result = buildRoy(state, data, M, panelSrc);
    }
    var isWoodColor = (state.color === 'mahogany' || state.color === 'pitch-pine' ||
                       colorCode.indexOf('마호가니') === 0 || colorCode.indexOf('피치파인') === 0);
    var disclaimers = ['*본 이미지는 참고용으로 실 제품과는 이미지 차이가 있을 수 있습니다.'];
    if (isWoodColor) disclaimers.push('*본 제품의 내부는 목재가 아닌 강판이 사용됩니다.');
    result.disclaimers = disclaimers;
    result.totalHeight = result.height + (6 + disclaimers.length * 14 + 6);
    return result;
  }

  // ═══════════════════════════════════════════
  //  엔토브 전용 빌더 (엑셀 참조 구조)
  // ═══════════════════════════════════════════
  function buildEntob(state, M, photoSrc, handleSrc) {
    handleSrc = handleSrc || photoSrc;
    var shapes = [];
    var fw = clamp(state.fw, 500, 5000, 1200);
    var fh = clamp(state.fh, 1000, 4000, 2300);
    var dw = clamp(state.dw, 200, 3000,  950);

    var VW = 400, sc = VW / fw, VH = fh * sc;

    // 경첩 우측(R) = 전자키 좌측, 경첩 좌측(L) = 전자키 우측
    var keyLeft = (state.hinge !== 'L');
    var hasL = (state.glass === 'L' || state.glass === 2);
    var hasR = (state.glass === 'R' || state.glass === 2);

    // 소대가 전자키 측에 있는지 여부
    var sideOnKey   = keyLeft ? hasL : hasR;
    var sideOnHinge = keyLeft ? hasR : hasL;

    // ── 수평 레이아웃 계산 (mm) ──
    // 반환: { leftFrW, sideLeftW, mullLeftW, sideRightW, mullRightW, rightFrW }
    var H = calcHLayout(fw, dw, sideOnKey, sideOnHinge, keyLeft);

    // ── 수직 좌표 (mm) ──
    var hasFix = state.fix === true || state.fix === 'true';
    var dh     = clamp(state.dh, 500, 3900, 0);
    var yInner, doorH, ySilver, innerH, yFix, fixH;
    if (!hasFix) {
      // 남마 없음: 상부 90mm → 문짝 → 문지방 20mm
      yFix   = 0; fixH = 0;
      yInner = E.topFr;
      doorH  = fh - E.topFr - E.btmSlv;
    } else {
      // 남마 있음: 상부2(30) → 남마 → 상부1(30) → 문(dh) → 문지방(20)
      var dhUsed = (dh >= 500 && dh < fh - 110) ? dh : Math.max(500, fh - E.topFr2 - E.topFr1 - E.btmSlv - 300);
      yFix   = E.topFr2;
      fixH   = Math.max(50, fh - E.topFr2 - E.topFr1 - dhUsed - E.btmSlv);
      yInner = yFix + fixH + E.topFr1;
      doorH  = dhUsed;
    }
    ySilver = yInner + doorH;
    innerH  = doorH;

    // ── 수평 x좌표 (mm) ── 좌→우 + 우→좌, xTotal = fw 보장
    // 소대0: doorWmm = fw-leftFr-rightFr (가로-150 자동)
    // 소대1/2: doorWmm = dw (사용자 입력, 기본 950)
    var xLFr  = 0;
    var xSL   = H.leftFrW;
    var xML   = H.leftFrW + H.sideLeftW;
    var xDL   = xML + H.mullLeftW;                // 문짝 좌측
    var xRFr  = fw - H.rightFrW;                  // 우측 외부 프레임 시작
    var xSR   = xRFr - H.sideRightW;             // 우측 소대 시작
    var xMR   = xSR - H.mullRightW;              // 우측 멀리언 끝 = 문짝 우측
    var xDR   = xMR;
    var doorWmm = xDR - xDL;                      // 소대0: fw-150 자동 / 소대有: dw
    var xTotal = fw;

    // ── 색상 ──
    var BLK = '#0c0c0d';   // 블랙 프레임
    var SLV = '#8a8c8f';   // 실버 하부

    // rect 헬퍼: mm → px
    function R(xmm, ymm, wmm, hmm, fill, stroke, sw) {
      if (wmm <= 0 || hmm <= 0) return;
      var s = { t:'rect', x:xmm*sc, y:ymm*sc, w:wmm*sc, h:hmm*sc, fill:fill };
      if (stroke) { s.stroke = stroke; s.sw = sw || 1; }
      shapes.push(s);
    }

    // 문짝/소대 색상 헬퍼: 색상 채우기 + 엣지 그라데이션 + 얇은 테두리
    function panelColor(xmm, ymm, wmm, hmm) {
      if (wmm <= 0 || hmm <= 0) return;
      if (photoSrc) {
        // 이미지를 y=0 전체 높이로 배치하고 패널 영역만 클리핑:
        // 넓은 도어(너비 기준 스케일)와 좁은 소대(높이 기준 스케일)의
        // 스케일 기준이 달라 이미지 상단 검은 바 위치가 달라지는 문제 방지
        shapes.push({ t:'photo', x:xmm*sc, y:0, w:wmm*sc, h:fh*sc,
                      clipY:ymm*sc, clipH:hmm*sc, src:photoSrc, brightness:2.0 });
      } else {
        R(xmm, ymm, wmm, hmm, '#5a4a3a');
      }
      // 프레임/판재 접합부 소프트 엣지 (4면)
      var ex = xmm*sc, ey = ymm*sc, ew = wmm*sc, eh = hmm*sc, ef = 10;
      shapes.push({ t:'gradRect', x:ex,       y:ey,       w:ew, h:ef, fill:'#000000', opacity1:0.30, opacity2:0 });
      shapes.push({ t:'gradRect', x:ex,       y:ey+eh-ef, w:ew, h:ef, fill:'#000000', opacity1:0,    opacity2:0.30 });
      shapes.push({ t:'gradRect', x:ex,       y:ey,       w:ef, h:eh, fill:'#000000', opacity1:0.30, opacity2:0,    horiz:true });
      shapes.push({ t:'gradRect', x:ex+ew-ef, y:ey,       w:ef, h:eh, fill:'#000000', opacity1:0,    opacity2:0.30, horiz:true });
      // 얇은 외곽선
      R(xmm, ymm, wmm, hmm, 'none', '#000000', 0.5);
    }

    // 문짝 전용 핀조명 오버레이
    function addPinLight(xmm, ymm, wmm, hmm) {
      var px = xmm*sc, py = ymm*sc, pw = wmm*sc, ph = hmm*sc;
      shapes.push({ t:'spotlight', x:px, y:py, w:pw, h:ph,
                    cx:0.5, cy:0.10, r:0.90, midStop:0.52, brightOp:0.10, darkOp:0.08 });
      shapes.push({ t:'gradRect', x:px, y:py + ph*0.55, w:pw, h:ph*0.45,
                    fill:'#000000', opacity1:0, opacity2:0.13 });
    }

    // 소대 렌더:
    //   판재 → 외부 박스 전체 색상 (문짝과 동일 높이, 라인 일치)
    //   유리 → 외부 박스(=판재 사이즈)에서 사방 60mm 블랙, 나머지 유리
    function drawSidelight(xmm, ymm, wmm, hmm) {
      if (wmm <= 0 || hmm <= 0) return;
      if (state.material === 'glass') {
        var sf = E.sideFrame;  // 60mm 사방
        var gx = xmm + sf, gy = ymm + sf;
        var gw = wmm - sf * 2, gh = hmm - sf * 2;
        if (gw > 0 && gh > 0) {
          R(gx, gy, gw, gh, 'glass');
          R(gx, gy, gw, gh, 'none', '#000000', 1.5);
        }
        R(xmm, ymm, wmm, hmm, 'none', '#000000', 1.5);
      } else {
        panelColor(xmm, ymm, wmm, hmm);
      }
    }

    // ── 1. 전체 배경 (블랙) ──
    R(0, 0, xTotal, fh, BLK);

    // ── 1a. 프레임 부재 – 알루미늄 그라디언트 ──
    // 좌·우 기둥: 전체 높이 연속 (끊김 없음)
    if (H.leftFrW  > 0) R(0,    0, H.leftFrW,  fh, 'almV');
    if (H.rightFrW > 0) R(xRFr, 0, H.rightFrW, fh, 'almV');
    // 상부 수평 프레임: 기둥 사이에 들어가는 구조 (기둥 위로 덮지 않음)
    if (!hasFix) {
      R(H.leftFrW, 0, xRFr - H.leftFrW, yInner, 'almH');
    } else {
      R(H.leftFrW, 0, xRFr - H.leftFrW, E.topFr2, 'almH');
      R(H.leftFrW, yInner - E.topFr1, xRFr - H.leftFrW, E.topFr1, 'almH');
    }

    // ── 1b. 남마 패널 ── (상부2↔남마↔상부1 경계는 BLK 배경)
    if (hasFix && fixH > 0) {
      var txX = H.leftFrW, txW = xRFr - H.leftFrW;
      if (state.fixMat === 'glass') {
        var sf = E.sideFrame;
        var gx = txX+sf, gy = yFix+sf, gw = txW-sf*2, gh = fixH-sf*2;
        if (gw > 0 && gh > 0) {
          R(gx, gy, gw, gh, 'glass');
          R(gx, gy, gw, gh, 'none', '#000000', 1.5);
        }
        R(txX, yFix, txW, fixH, 'none', '#000000', 1.5);
      } else {
        panelColor(txX, yFix, txW, fixH);
      }
    }

    // ── 2. 문짝 ──
    panelColor(xDL, yInner, doorWmm, doorH);
    addPinLight(xDL, yInner, doorWmm, doorH);

    // ── 3. 좌측 소대 ──
    if (H.sideLeftW > 0) {
      drawSidelight(xSL, yInner, H.sideLeftW, innerH);
    }

    // ── 4. 우측 소대 ──
    if (H.sideRightW > 0) {
      drawSidelight(xSR, yInner, H.sideRightW, innerH);
    }

    // ── 9. 멀리언 (프레임 세로대) ──
    if (H.mullLeftW > 0)  R(xML,  yInner, H.mullLeftW,  innerH, 'almV');
    if (H.mullRightW > 0) R(xMR,  yInner, H.mullRightW, innerH, 'almV');

    // ── 9b. 조인트 심 라인 ──
    function seamH(x1mm, x2mm, ymm) {
      if (x2mm <= x1mm) return;
      var y = ymm * sc;
      shapes.push({ t:'line', x1:x1mm*sc, y1:y,     x2:x2mm*sc, y2:y,     stroke:'#000000', sw:1.8, opacity:0.95 });
      shapes.push({ t:'line', x1:x1mm*sc, y1:y+1.5, x2:x2mm*sc, y2:y+1.5, stroke:'#30303e', sw:0.7, opacity:0.50 });
    }
    function seamV(xmm, y1mm, y2mm) {
      if (y2mm <= y1mm) return;
      var x = xmm * sc;
      shapes.push({ t:'line', x1:x,     y1:y1mm*sc, x2:x,     y2:y2mm*sc, stroke:'#000000', sw:1.8, opacity:0.95 });
      shapes.push({ t:'line', x1:x+1.5, y1:y1mm*sc, x2:x+1.5, y2:y2mm*sc, stroke:'#30303e', sw:0.7, opacity:0.50 });
    }
    function seamD(x1mm, y1mm, x2mm, y2mm) {
      shapes.push({ t:'line', x1:x1mm*sc, y1:y1mm*sc, x2:x2mm*sc, y2:y2mm*sc, stroke:'#000000', sw:1.8, opacity:0.95 });
      shapes.push({ t:'line', x1:x1mm*sc+1, y1:y1mm*sc+1, x2:x2mm*sc+1, y2:y2mm*sc+1, stroke:'#30303e', sw:0.7, opacity:0.50 });
    }

    // ① 상부 프레임 ↔ 기둥 (프레임 끝단이 기둥 내면에 맞닿음, 기둥은 연속)
    if (H.leftFrW  > 0) seamV(H.leftFrW, 0, yInner);
    if (H.rightFrW > 0) seamV(xRFr,      0, yInner);
    seamH(H.leftFrW, xRFr, yInner);   // 상부 프레임 하단선 (기둥 사이 구간만)

    // ② 상부 프레임 ↔ 멀리언 T자 접합
    if (H.mullLeftW  > 0) { seamV(xML, yInner, yInner+5); seamV(xDL, yInner, yInner+5); }
    if (H.mullRightW > 0) { seamV(xMR, yInner, yInner+5); seamV(xSR, yInner, yInner+5); }

    // ③ 하부 실버 실 ↔ 기둥/멀리언 (실 끝단이 기둥 내면에 맞닿음, 기둥은 연속)
    seamH(H.leftFrW, xRFr, ySilver);
    seamV(H.leftFrW, ySilver, ySilver + E.btmSlv);
    seamV(xRFr,      ySilver, ySilver + E.btmSlv);
    if (H.mullLeftW  > 0) { seamV(xML, ySilver-5, ySilver); seamV(xDL, ySilver-5, ySilver); }
    if (H.mullRightW > 0) { seamV(xMR, ySilver-5, ySilver); seamV(xSR, ySilver-5, ySilver); }

    // ④ 소대 서브프레임 45도 마이터 접합
    var sf = E.sideFrame;
    if (H.sideLeftW > sf*2 && state.material === 'glass') {
      // 직선 구간 (코너 제외)
      seamH(xSL+sf, xML-sf, yInner+sf);  seamH(xSL+sf, xML-sf, ySilver-sf);
      seamV(xSL+sf, yInner+sf, ySilver-sf);  seamV(xML-sf, yInner+sf, ySilver-sf);
      // 45도 마이터 코너
      seamD(xSL,    yInner,     xSL+sf, yInner+sf);
      seamD(xML-sf, yInner+sf,  xML,    yInner);
      seamD(xSL,    ySilver,    xSL+sf, ySilver-sf);
      seamD(xML-sf, ySilver-sf, xML,    ySilver);
    }
    if (H.sideRightW > sf*2 && state.material === 'glass') {
      seamH(xSR+sf, xRFr-sf, yInner+sf);  seamH(xSR+sf, xRFr-sf, ySilver-sf);
      seamV(xSR+sf, yInner+sf, ySilver-sf);  seamV(xRFr-sf, yInner+sf, ySilver-sf);
      seamD(xSR,     yInner,     xSR+sf,  yInner+sf);
      seamD(xRFr-sf, yInner+sf,  xRFr,    yInner);
      seamD(xSR,     ySilver,    xSR+sf,  ySilver-sf);
      seamD(xRFr-sf, ySilver-sf, xRFr,    ySilver);
    }

    // ⑤ 남마(픽스 패널) 상하 프레임 접합
    if (hasFix && fixH > 0) {
      seamH(H.leftFrW, xRFr, E.topFr2);
      seamH(H.leftFrW, xRFr, yInner - E.topFr1);
    }

    // ── 9c. 스텐 밴드 (E305 블랙스텐 / E306 실버스텐) ──
    // 문짝 판재·소대 판재 영역에만, 멀리언·외부프레임 제외
    if (M.stenFrom > 0 && M.stenTo > M.stenFrom) {
      var stenTopAbs = ySilver - M.stenTo;
      var stenBotAbs = ySilver - M.stenFrom;
      var stenBandH  = M.stenTo - M.stenFrom;
      var stenSrc = M.stenSrc || (M.stenDS
        ? '/ref/color/' + encodeURIComponent(M.colorFolder || '강판') + '/DS.jpg'
        : null);
      if (stenTopAbs >= yInner && stenBotAbs <= ySilver) {
        function drawStenBand(x1, x2) {
          var bw = x2 - x1;
          if (bw <= 0) return;
          if (stenSrc) {
            shapes.push({ t:'photo', x:x1*sc, y:stenTopAbs*sc, w:bw*sc, h:stenBandH*sc,
                          clipY:stenTopAbs*sc, clipH:stenBandH*sc, src:stenSrc,
                          rotate: M.stenDS ? 90 : 0 });
          } else {
            R(x1, stenTopAbs, bw, stenBandH, M.stenColor || '#1a1a1e');
          }
          var gx = x1 * sc, gw = bw * sc, gfade = 12 * sc;
          var gTop = stenTopAbs * sc, gBot = stenBotAbs * sc;
          shapes.push({ t:'gradRect', x:gx, y:gTop-gfade, w:gw, h:gfade, fill:'#000000', opacity1:0,    opacity2:0.14 });
          shapes.push({ t:'gradRect', x:gx, y:gTop,       w:gw, h:gfade, fill:'#000000', opacity1:0.14, opacity2:0    });
          shapes.push({ t:'gradRect', x:gx, y:gBot-gfade, w:gw, h:gfade, fill:'#000000', opacity1:0,    opacity2:0.14 });
          shapes.push({ t:'gradRect', x:gx, y:gBot,       w:gw, h:gfade, fill:'#000000', opacity1:0.14, opacity2:0    });
        }
        drawStenBand(xDL, xDR);                                                          // 문짝
        if (H.sideLeftW  > 0 && state.material !== 'glass') drawStenBand(xSL, xML);  // 좌측 소대 (판재만)
        if (H.sideRightW > 0 && state.material !== 'glass') drawStenBand(xSR, xRFr); // 우측 소대 (판재만)
      }
    }

    // ── 10. 하부 실버 프레임 ──
    R(H.leftFrW, ySilver, xRFr - H.leftFrW, E.btmSlv, SLV);
    R(H.leftFrW, ySilver, xRFr - H.leftFrW, E.btmSlv, 'none', '#000000', 1.5);

    // ── 11. 경첩 ──
    // 경첩 R(keyLeft=true): 문짝 우측 끝(xDR) 기준 / L: 좌측 끝(xDL)
    var hingeEdge = keyLeft ? xDR : xDL;  // 문짝 판재 끝 좌표
    var hW = 22;   // 경첩 너비 mm
    var hH = 150;  // 경첩 높이 mm
    var hX = hingeEdge - hW / 2;
    // 위에서 150mm, 400mm / 아래에서 250mm (프레임 기준)
    [yInner + 150, yInner + 400, ySilver - 250 - hH].forEach(function(hY) {
      shapes.push({ t:'image', x:hX*sc, y:hY*sc, w:hW*sc, h:hH*sc,
                    href:'/ref/hinge/%EA%B2%BD%EC%B2%A9.jpg' });
      shapes.push({ t:'rect', x:hX*sc, y:hY*sc, w:hW*sc, h:hH*sc, fill:'#1a1a1a', opacity:0.70 });
    });

    // ── 12. 전자키 ──
    // 키가 들어가는 프레임/멀리언 x좌표(mm)와 너비(mm)를 직접 계산
    var keyFrX, keyFrW;
    if (keyLeft) {
      keyFrW = H.mullLeftW > 0 ? H.mullLeftW : H.leftFrW;
      keyFrX = H.mullLeftW > 0 ? xML : xLFr;
    } else {
      keyFrW = H.mullRightW > 0 ? H.mullRightW : H.rightFrW;
      keyFrX = H.mullRightW > 0 ? xMR : xRFr;
    }
    pushEntobKey(shapes, sc, keyFrX, keyFrW, keyLeft, xDL, xDR, yInner, doorH, fh);

    // ── 13. 손잡이 ──
    // 개폐방향 끝에서 80mm 안쪽, 동일 색상 판재 + 돌출 3D 효과
    var hdW = 40;   // 손잡이 너비 mm
    var hdH = Math.min(clamp(state.handleMM, 200, 3000, 1700), doorH * 0.95);
    var hdX = keyLeft ? (xDL + 120) : (xDR - 120 - hdW);
    // 1200 이하: 하단 1000mm 지점이 센터 / 초과: 하단 200mm 고정
    var hdY = hdH <= 1200
      ? yInner + doorH - 1000 - hdH / 2
      : yInner + doorH - 200 - hdH;
    var hxPx = hdX*sc, hyPx = hdY*sc, hwPx = hdW*sc, hhPx = hdH*sc;

    // 60mm 돌출 기준 깊이 계산
    var depthPx = Math.round(60 * sc);       // ~18px
    var sFade   = Math.round(depthPx * 1.8); // 드롭섀도 퍼짐
    var sideW   = Math.max(3, Math.round(depthPx * 0.20)); // 측면 깊이면 두께

    // 1a) 측면 드롭섀도 (도어 패널 위)
    if (keyLeft) {
      shapes.push({ t:'gradRect', x:hxPx-sFade, y:hyPx, w:sFade, h:hhPx+sideW,
                    fill:'#000000', opacity1:0, opacity2:0.12, horiz:true });
    } else {
      shapes.push({ t:'gradRect', x:hxPx+hwPx, y:hyPx, w:sFade, h:hhPx+sideW,
                    fill:'#000000', opacity1:0.12, opacity2:0, horiz:true });
    }
    // 1b) 하단 드롭섀도
    shapes.push({ t:'gradRect', x:hxPx, y:hyPx+hhPx, w:hwPx, h:Math.round(sFade*0.7),
                  fill:'#000000', opacity1:0.40, opacity2:0 });

    // 2) 패널 색상 (손잡이 전용 이미지가 있으면 handleSrc 사용)
    // handleColorMap이 있으면 항상 별도 렌더 (303 파일 + 좌측 10px 오프셋)
    var useOwnHandle = handleSrc && (handleSrc !== photoSrc || M.handleColorMap);
    if (useOwnHandle) {
      var vPad = Math.round(hhPx * 0.10);
      var imgOff = 10; // 이미지 좌측 10px 지점부터 표시
      shapes.push({ t:'photo', x:hxPx - imgOff, y:hyPx-vPad, w:hwPx + imgOff, h:hhPx+vPad*2,
                    clipX:hxPx, clipW:hwPx, clipY:hyPx, clipH:hhPx, src:handleSrc,
                    preserveAspect:'xMinYMid slice' });
    } else if (handleSrc) {
      // 판재와 같은 이미지: 판재 좌표계로 렌더해 결 연속성 유지
      shapes.push({ t:'photo', x:xDL*sc, y:0, w:doorWmm*sc, h:fh*sc,
                    clipX:hxPx, clipW:hwPx, clipY:hyPx, clipH:hhPx, src:handleSrc });
    } else {
      shapes.push({ t:'rect', x:hxPx, y:hyPx, w:hwPx, h:hhPx, fill:'#5a4a3a' });
    }

    // 3) 측면·하단 깊이면 (어두운 단면 — 돌출 두께감)
    if (keyLeft) {
      shapes.push({ t:'rect', x:hxPx-sideW, y:hyPx, w:sideW, h:hhPx, fill:'#0a0a0a', opacity:0.25 });
    } else {
      shapes.push({ t:'rect', x:hxPx+hwPx, y:hyPx, w:sideW, h:hhPx, fill:'#0a0a0a', opacity:0.25 });
    }
    shapes.push({ t:'rect', x:hxPx, y:hyPx+hhPx, w:hwPx, h:sideW, fill:'#0a0a0a', opacity:0.20 });

    // 4) 테두리: 좌우 2px, 상하 2px, 순수 블랙
    shapes.push({ t:'rect', x:hxPx,           y:hyPx,           w:hwPx, h:2.0, fill:'#000000' });
    shapes.push({ t:'rect', x:hxPx,           y:hyPx+hhPx-2.0, w:hwPx, h:2.0, fill:'#000000' });
    shapes.push({ t:'rect', x:hxPx,           y:hyPx,           w:1.0,  h:hhPx, fill:'#000000' });
    shapes.push({ t:'rect', x:hxPx+hwPx-1.0, y:hyPx,           w:1.0,  h:hhPx, fill:'#000000' });

    // 브라켓은 손잡이 뒤에 있어 보이지 않으므로 별도 렌더 없음

    // ── 14. 외곽 테두리 ──
    shapes.push({ t:'rect', x:0, y:0, w:VW, h:VH, fill:'none', stroke:'#000000', sw:1.5 });

    return {
      width: VW, height: VH, shapes: shapes,
      meta: {
        doorW: Math.round(doorWmm), doorH: Math.round(doorH),
        sideW: Math.round(Math.max(H.sideLeftW, H.sideRightW)),
        nSide: (H.sideLeftW > 0 ? 1 : 0) + (H.sideRightW > 0 ? 1 : 0),
        fixMM: Math.round(fixH)
      }
    };
  }

  // 수평 레이아웃 계산 (엑셀 참조 기준)
  function calcHLayout(fw, dw, sideOnKey, sideOnHinge, keyLeft) {
    var H = { leftFrW:0, sideLeftW:0, mullLeftW:0, mullRightW:0, sideRightW:0, rightFrW:0 };

    if (!sideOnKey && !sideOnHinge) {
      // 소대0개: 전자키측=120mm, 경첩측=30mm, 기둥없음
      H.leftFrW  = keyLeft ? E.keyFr : E.outFr;
      H.rightFrW = keyLeft ? E.outFr : E.keyFr;

    } else if (sideOnKey && !sideOnHinge) {
      // 소대1개(전자키측): 양 외곽=30mm, 전자키 멀리언=105mm (방향 무관)
      var sw = Math.max(50, fw - E.outFr - E.mullKey - dw - E.outFr);
      H.leftFrW = E.outFr; H.rightFrW = E.outFr;
      if (keyLeft) {
        H.sideLeftW  = sw; H.mullLeftW  = E.mullKey;
      } else {
        H.sideRightW = sw; H.mullRightW = E.mullKey;
      }

    } else if (!sideOnKey && sideOnHinge) {
      // 소대1개(경첩측): 전자키 외곽=120mm, 경첩 외곽=30mm, 경첩 멀리언=30mm
      var sw2 = Math.max(50, fw - E.keyFr - dw - E.mullStd - E.outFr);
      if (keyLeft) {
        // 전자키 좌(120mm), 소대 우
        H.leftFrW = E.keyFr;
        H.mullRightW = E.mullStd; H.sideRightW = sw2; H.rightFrW = E.outFr;
      } else {
        // 전자키 우(120mm), 소대 좌
        H.rightFrW = E.keyFr;
        H.mullLeftW = E.mullStd; H.sideLeftW = sw2; H.leftFrW = E.outFr;
      }

    } else {
      // 소대2개: 양 외곽=30mm, 전자키 멀리언=105mm, 경첩 멀리언=30mm
      var lMull = keyLeft ? E.mullKey : E.mullStd;
      var rMull = keyLeft ? E.mullStd : E.mullKey;
      var sideTot = Math.max(100, fw - E.outFr - lMull - dw - rMull - E.outFr);
      H.leftFrW   = E.outFr;
      H.sideLeftW  = Math.floor(sideTot / 2);
      H.mullLeftW  = lMull;
      H.mullRightW = rMull;
      H.sideRightW = sideTot - Math.floor(sideTot / 2);
      H.rightFrW  = E.outFr;
    }

    return H;
  }

  // 전자키 렌더 (mm 좌표계)
  function pushEntobKey(shapes, sc, keyFrX, keyFrW, keyLeft, xDL, xDR, yDoor, doorH, fh) {
    // 매립키 이미지: 프레임 중앙, 하부 1000mm 기준 센터
    var kW = Math.min(keyFrW * 0.55, 55) + 20;  // 프레임 55% 이하, 최대 55mm + 좌우 10mm
    var kH = kW * 4.95;                          // ~1:5.5 비율 × 0.9 (상하 10% 축소)
    var kX = keyFrX + (keyFrW - kW) / 2;
    var kY = fh - E.btmSlv - 1000 - kH / 2;

    shapes.push({
      t: 'image',
      x: kX * sc, y: kY * sc, w: kW * sc, h: kH * sc,
      href: '/ref/digitalkey/%EB%A7%A4%EB%A6%BD%ED%82%A4.jpg'
    });
  }

  // ═══════════════════════════════════════════
  //  로이도어 디자인 포인트 렌더러
  // ═══════════════════════════════════════════
  function pushRoyDesign(design, d, shapes, sc,
      xDL, xDR, yInner, ySilver, doorH, doorWmm, keyLeft, panelSrc, fh, BLK, SLV) {

    if (!design || design === 'plain') return;

    function R(xmm, ymm, wmm, hmm, fill, stroke, sw, opacity) {
      if (wmm <= 0 || hmm <= 0) return;
      var s = { t:'rect', x:xmm*sc, y:ymm*sc, w:wmm*sc, h:hmm*sc, fill:fill };
      if (stroke)  { s.stroke = stroke; s.sw = sw || 1; }
      if (opacity != null) s.opacity = opacity;
      shapes.push(s);
    }
    function lineV(xmm, y1mm, y2mm, stroke, sw, op) {
      var x = xmm * sc;
      shapes.push({ t:'line', x1:x, y1:y1mm*sc, x2:x, y2:y2mm*sc, stroke:stroke, sw:sw, opacity:op == null ? 1 : op });
    }
    function lineH(x1mm, x2mm, ymm, stroke, sw, op) {
      var y = ymm * sc;
      shapes.push({ t:'line', x1:x1mm*sc, y1:y, x2:x2mm*sc, y2:y, stroke:stroke, sw:sw, opacity:op == null ? 1 : op });
    }
    function seamH(x1mm, x2mm, ymm) {
      lineH(x1mm, x2mm, ymm, '#000000', 1.8, 0.95);
      lineH(x1mm, x2mm, ymm + 1.5 / sc, '#30303e', 0.7, 0.50);
    }
    function seamV(xmm, y1mm, y2mm) {
      lineV(xmm,            y1mm, y2mm, '#000000', 1.8, 0.95);
      lineV(xmm + 1.5 / sc, y1mm, y2mm, '#30303e', 0.7, 0.50);
    }
    function protrudeBox(x, y, w, h, pt) {
      if (pt <= 0) return;
      R(x+w,               y, pt*0.45, h, BLK, null, null, 0.32);
      R(x+w + pt*0.45,     y, pt*0.35, h, BLK, null, null, 0.16);
      R(x+w + pt*0.80,     y, pt*0.20, h, BLK, null, null, 0.07);
      R(x,   y+h,          w, pt*0.45, BLK, null, null, 0.28);
      R(x,   y+h + pt*0.45, w, pt*0.35, BLK, null, null, 0.13);
      R(x,   y+h + pt*0.80, w, pt*0.20, BLK, null, null, 0.05);
      lineV(x,   y, y+h, '#c0c4c8', 0.8, 0.30);
      lineH(x, x+w, y,   '#c0c4c8', 0.8, 0.30);
    }

    // ── squares: 유리/펀치 사각 N개 (L103: 중앙 유리, L126: 스텐 컬럼 다크펀치) ──
    if (design === 'squares') {
      var count     = d.count     || 5;
      var sqSize    = d.size      || 100;
      var isGlass   = d.glass !== false;  // 기본 true (유리)
      var side      = d.side;             // 'L'|'R' — 컬럼 모드 시 지정
      var colW      = d.colW      || 0;
      var stainless = d.stainless || false;

      var sqCenterX; // 사각 수평 중심 (mm)

      if (side && colW > 0) {
        // 컬럼 모드 (L126): 지정 측에 세로 기둥 + 사각
        var colX = (side === 'R') ? (xDR - colW) : xDL;
        sqCenterX = colX + colW / 2;
        if (stainless) {
          R(colX, yInner, colW, doorH, '#9ca0a4');
          R(colX + colW * 0.12, yInner, colW * 0.28, doorH, '#b8bcbf', null, null, 0.5);
        } else {
          R(colX, yInner, colW, doorH, BLK);
        }
        seamV(side === 'R' ? colX : colX + colW, yInner, ySilver);
      } else {
        // 중앙 모드 (L103): 컬럼 없이 도어 가로 중앙
        sqCenterX = xDL + doorWmm / 2;
      }

      var sqX       = sqCenterX - sqSize / 2;
      var topM      = (d.topMargin  !== undefined) ? d.topMargin  : 250;
      var botM      = (d.botMargin  !== undefined) ? d.botMargin  : 250;
      var availH    = doorH - topM - botM;
      var spacing   = count > 1 ? (availH - sqSize * count) / (count - 1) : 0;
      var sqPT      = d.protrude || 0;

      for (var i = 0; i < count; i++) {
        var sqY = yInner + topM + i * (sqSize + spacing);
        protrudeBox(sqX, sqY, sqSize, sqSize, sqPT);
        if (isGlass) {
          var fw2 = sqSize * 0.12;  // 내부 프레임 두께
          R(sqX, sqY, sqSize, sqSize, BLK);
          R(sqX + fw2, sqY + fw2, sqSize - fw2 * 2, sqSize - fw2 * 2, 'glass');
        } else {
          R(sqX, sqY, sqSize, sqSize, BLK);
          var inset = sqSize * 0.14;
          R(sqX + inset, sqY + inset, sqSize - inset * 2, sqSize - inset * 2, '#1c1c24');
        }
        R(sqX, sqY, sqSize, sqSize, 'none', '#000', 1.2);
      }
    }

    // ── hingecol: 경첩쪽 판재 + 10mm알미늄 + DS컬럼(유리) + 10mm알미늄 (L126) ──
    if (design === 'hingecol') {
      var hcHP  = d.hingePanel || 200;
      var hcSW  = d.sepW       || 10;
      var hcDW  = d.dsW        || 150;
      var hcSqN = d.sqCount    || 5;
      var hcSqS = d.sqSize     || 100;
      var hcTM  = d.sqTopM     || 250;
      var hcBM  = d.sqBotM     || 250;
      var hcFrC = '#0e0e12';
      var hcDsSrc = d.dsSrc || '/ref/color/%EA%B0%95%ED%8C%90/DS.jpg';

      // 경첩 방향 기준 위치 계산
      var dsX   = keyLeft ? (xDR - hcHP - hcSW - hcDW) : (xDL + hcHP + hcSW);
      var sep1X = keyLeft ? (xDR - hcHP - hcSW)         : (xDL + hcHP);
      var sep2X = keyLeft ? (dsX - hcSW)                 : (dsX + hcDW);

      // 첫번째 10mm 알미늄 (경첩 판재 | DS 구분)
      R(sep1X, yInner, hcSW, doorH, hcFrC);

      // DS 판재
      shapes.push({ t:'photo', x:dsX*sc, y:yInner*sc, w:hcDW*sc, h:doorH*sc, src:hcDsSrc });

      // 두번째 10mm 알미늄 (DS | 키쪽 판재 구분)
      R(sep2X, yInner, hcSW, doorH, hcFrC);

      // DS 내부 유리 사각 (L103과 동일, DS 중앙 정렬)
      var hcPT    = d.protrude || 0;
      var hcSqX   = dsX + (hcDW - hcSqS) / 2;
      var hcAvail = doorH - hcTM - hcBM;
      var hcSpacing = hcSqN > 1 ? (hcAvail - hcSqS * hcSqN) / (hcSqN - 1) : 0;
      var hcFw    = hcSqS * 0.12;
      for (var hci = 0; hci < hcSqN; hci++) {
        var hcSqY = yInner + hcTM + hci * (hcSqS + hcSpacing);
        protrudeBox(hcSqX, hcSqY, hcSqS, hcSqS, hcPT);
        R(hcSqX,        hcSqY,        hcSqS,          hcSqS,          BLK);
        R(hcSqX + hcFw, hcSqY + hcFw, hcSqS - hcFw*2, hcSqS - hcFw*2, 'glass');
        R(hcSqX,        hcSqY,        hcSqS,          hcSqS,          'none', '#000', 1.2);
      }
    }

    // ── vmoldings: 세로 몰딩 N개, 색상 + 돌출 효과 (L106) ──
    if (design === 'vmoldings') {
      var count2   = d.count   || 5;
      var mw       = d.width   || 40;   // 몰딩 너비 mm
      var mg       = d.gap     || 40;   // 간격 mm
      var fw1      = d.frameW  || 3;    // 좌우 블랙 프레임 mm
      var fh1      = d.frameH  || 2;    // 상하 블랙 프레임 mm
      var colors   = d.colors  || [];
      var protrude = d.protrude || 0;   // 돌출 깊이 mm (그림자 길이 기준)

      var totalW  = count2 * mw + (count2 - 1) * mg;
      var startX2 = xDL + (doorWmm - totalW) / 2;
      var innerH  = doorH - fh1 * 2;
      var innerY  = yInner + fh1;

      for (var i = 0; i < count2; i++) {
        var mx      = startX2 + i * (mw + mg);
        var innerX2 = mx + fw1;
        var innerW2 = mw - fw1 * 2;
        var color   = (colors[i] !== undefined) ? colors[i] : 'stainless';

        // ① 돌출 캐스트 섀도: 몰딩 우측 도어 면에 3단 페이드 그림자
        if (protrude > 0) {
          R(mx + mw,                yInner, protrude * 0.45, doorH, BLK, null, null, 0.32);
          R(mx + mw + protrude*0.45, yInner, protrude * 0.35, doorH, BLK, null, null, 0.16);
          R(mx + mw + protrude*0.80, yInner, protrude * 0.20, doorH, BLK, null, null, 0.07);
        }

        // 블랙 알미늄 프레임 색: BLK보다 밝아 배경과 구분
        var frC = '#0e0e12';  // 블랙 알미늄 (순수 블랙에 가깝되 배경과 구분)

        // ② 몰딩 프레임 + 내부 색상
        if (color === 'panel') {
          R(mx,             yInner,        fw1, doorH, frC);   // 좌 3mm 알미늄
          R(mx + mw - fw1,  yInner,        fw1, doorH, frC);   // 우 3mm 알미늄
          R(mx,             yInner,        mw,  fh1,   frC);   // 상 알미늄
          R(mx,             ySilver - fh1, mw,  fh1,   frC);   // 하 알미늄
        } else if (color === 'ds') {
          R(mx,             yInner,        fw1, doorH, frC);   // 좌 알미늄
          R(mx + mw - fw1,  yInner,        fw1, doorH, frC);   // 우 알미늄
          R(mx,             yInner,        mw,  fh1,   frC);   // 상 알미늄
          R(mx,             ySilver - fh1, mw,  fh1,   frC);   // 하 알미늄
          shapes.push({ t:'photo', x:innerX2*sc, y:innerY*sc, w:innerW2*sc, h:innerH*sc,
                        src:'/ref/color/%EA%B0%95%ED%8C%90/DS.jpg' });
        } else {
          var fillColor = (color === 'stainless') ? '#8a8e92' : color;
          R(mx,             yInner,        fw1, doorH, frC);   // 좌 3mm 알미늄
          R(mx + mw - fw1,  yInner,        fw1, doorH, frC);   // 우 3mm 알미늄
          R(mx,             yInner,        mw,  fh1,   frC);   // 상 알미늄
          R(mx,             ySilver - fh1, mw,  fh1,   frC);   // 하 알미늄
          R(innerX2, innerY, innerW2, innerH, fillColor);      // 내부 색
          if (color === 'stainless') {
            R(innerX2 + innerW2 * 0.18, innerY, innerW2 * 0.28, innerH, '#c0c4c8', null, null, 0.45);
          }
        }

        // ③ 돌출 에지 하이라이트 (좌측 코너 미세 반사)
        if (protrude > 0) {
          lineV(mx, yInner, ySilver, '#38383e', 1.2, 0.55);
        }
      }
    }

    // ── vgrooves: N개 세로 홈 라인 (기타 모델용 예비) ──
    if (design === 'vgrooves') {
      var count  = d.count  || 4;
      var x1F   = d.x1Frac || 0.35;
      var x2F   = d.x2Frac || 0.65;
      var gTop  = yInner + doorH * 0.04;
      var gBot  = ySilver - doorH * 0.04;
      var startX = xDL + doorWmm * x1F;
      var endX   = xDL + doorWmm * x2F;
      var step   = count > 1 ? (endX - startX) / (count - 1) : 0;
      for (var i = 0; i < count; i++) {
        var lx = startX + step * i;
        lineV(lx,          gTop, gBot, '#000000', 3.5, 0.80);
        lineV(lx + 2/sc,   gTop, gBot, '#ffffff', 1.0, 0.10);
      }
    }

    // ── vstrips: 교대 세로 패널 (L111, L113, L115, L129) ──
    if (design === 'vstrips') {
      var count   = d.count   || 6;
      var gapW    = d.gapW    || 8;
      var altDark = d.altDark || false;
      var totalGap = gapW * (count - 1);
      var panelW  = (doorWmm - totalGap) / count;
      for (var i = 0; i < count; i++) {
        var px = xDL + (panelW + gapW) * i;
        if (altDark && (i % 2 === 0)) {
          R(px, yInner, panelW, doorH, '#18181c', null, null, 0.88);
        }
        if (i < count - 1) {
          R(px + panelW, yInner, gapW, doorH, BLK);
        }
      }
    }

    // ── splitstrips: 경첩쪽 + 키쪽 양측에서 세로 몰딩 (L111) ──
    if (design === 'splitstrips') {
      var ssW   = d.mw           || 40;  // 몰딩 너비 mm
      var ssG   = d.gw           || 40;  // 간격 mm
      var ssHI  = d.hingeInitGap || 40;  // 경첩 초기 간격 mm
      var ssHS  = d.hingeStop    || 300; // 경첩쪽 종료 임계값
      var ssKS  = d.keyStop      || 50;  // 키쪽 종료 임계값
      var ssFW  = d.frameW       || 8;   // 좌우 블랙 알루미늄 프레임 mm
      var ssFH  = d.frameH       || 2;   // 상하 블랙 알루미늄 프레임 mm
      var ssPT  = d.protrude     || 0;   // 돌출 깊이 mm
      var ssFrC = '#0e0e12';             // 블랙 알루미늄 색

      var ssH = [];
      for (var ssP = ssHI; (doorWmm - (ssP + ssW)) > ssHS; ssP += ssW + ssG) {
        ssH.push([ssP, ssP + ssW]);
      }

      function ssAbs(lo) {
        return keyLeft ? (xDR - lo - ssW) : (xDL + lo);
      }

      var ssMoldSrc = d.moldSrc || '/ref/color/%EA%B0%95%ED%8C%90/MB.jpg';
      var ssInnerY  = yInner + ssFH;
      var ssInnerH  = doorH - ssFH * 2;
      var ssInnerW  = ssW - ssFW * 2;

      function ssRenderMold(absX) {
        if (ssPT > 0) {
          R(absX + ssW,       yInner, 17, doorH, BLK, null, null, 0.70);
          R(absX + ssW + 17,  yInner, 23, doorH, BLK, null, null, 0.35);
          R(absX + ssW + 40,  yInner, 33, doorH, BLK, null, null, 0.14);
          lineV(absX, yInner, ySilver, '#c8cace', 0.8, 0.25);
        }
        // 좌우 프레임
        R(absX,              yInner, ssFW, doorH, ssFrC);
        R(absX + ssW - ssFW, yInner, ssFW, doorH, ssFrC);
        // 상하 프레임
        R(absX, yInner,          ssW, ssFH, ssFrC);
        R(absX, ySilver - ssFH,  ssW, ssFH, ssFrC);
        // 내부 몰딩 텍스처
        shapes.push({ t:'photo', x:(absX + ssFW)*sc, y:ssInnerY*sc, w:ssInnerW*sc, h:ssInnerH*sc, src:ssMoldSrc });
      }

      // 경첩쪽 몰딩 렌더 (베이스 색상이 갭에 보임, 키쪽은 소대에 렌더)
      for (var ssI = 0; ssI < ssH.length; ssI++) {
        ssRenderMold(ssAbs(ssH[ssI][0]));
      }
    }

    // ── threecol: 경첩쪽 베이스영역 + 균등 몰딩 6개 (L113) ──
    // 주색상: 키쪽 + 소대 + 남마 / 베이스: 경첩쪽 큰 영역 / 몰딩: 베이스 위 20mm 몰딩
    if (design === 'threecol') {
      var tcBAW  = d.baseAreaW  || 700;
      var tcMW   = d.moldW      || 20;
      var tcMCnt = d.moldCount  || 6;
      var tcFW   = d.frameW     || 8;
      var tcFH   = d.frameH     || 2;
      var tcMFW  = d.moldFrameW || 5;
      var tcPT   = d.protrude   || 0;
      var tcFrC  = '#0e0e12';
      var tcBaseSrc = d.baseSrc || panelSrc;
      var tcMoldSrc = d.moldSrc || panelSrc;

      var baX = keyLeft ? (xDR - tcBAW) : xDL;

      // 베이스 색상으로 영역 채우기
      shapes.push({ t:'photo',
        x: baX*sc, y: (yInner+tcFH)*sc,
        w: tcBAW*sc, h: (doorH-tcFH*2)*sc,
        src: tcBaseSrc });

      // Level 1: 베이스 영역이 주색상 패널 위로 tcPT만큼 돌출
      if (tcPT > 0) {
        if (keyLeft) {
          R(baX - tcPT*0.45, yInner, tcPT*0.45, doorH, BLK, null, null, 0.32);
          R(baX - tcPT*0.80, yInner, tcPT*0.35, doorH, BLK, null, null, 0.16);
          R(baX - tcPT,      yInner, tcPT*0.20, doorH, BLK, null, null, 0.07);
          lineV(baX + tcBAW - tcFW, yInner, ySilver, '#c0c4c8', 0.8, 0.30);
        } else {
          R(baX + tcBAW,             yInner, tcPT*0.45, doorH, BLK, null, null, 0.32);
          R(baX + tcBAW + tcPT*0.45, yInner, tcPT*0.35, doorH, BLK, null, null, 0.16);
          R(baX + tcBAW + tcPT*0.80, yInner, tcPT*0.20, doorH, BLK, null, null, 0.07);
          lineV(baX + tcFW, yInner, ySilver, '#c0c4c8', 0.8, 0.30);
        }
      }

      // 키쪽 경계 프레임 (주색상↔베이스 구분)
      var sepX = keyLeft ? baX : (baX + tcBAW - tcFW);
      R(sepX, yInner, tcFW, doorH, tcFrC);
      R(baX, yInner,         tcBAW, tcFH, tcFrC);
      R(baX, ySilver - tcFH, tcBAW, tcFH, tcFrC);

      // 베이스 영역 안에 균등 배치 몰딩
      var tcGapW = (tcBAW - tcMCnt * tcMW) / (tcMCnt + 1);
      var mInnerY = yInner + tcFH;
      var mInnerH = doorH - tcFH * 2;
      var mInnerW = tcMW - tcMFW * 2;

      for (var tci = 0; tci < tcMCnt; tci++) {
        var mAbsX = baX + tcGapW + tci * (tcMW + tcGapW);
        // Level 2: 몰딩이 베이스 위로 tcPT만큼 돌출
        if (tcPT > 0) {
          R(mAbsX + tcMW,              yInner, tcPT*0.45, doorH, BLK, null, null, 0.32);
          R(mAbsX + tcMW + tcPT*0.45,  yInner, tcPT*0.35, doorH, BLK, null, null, 0.16);
          R(mAbsX + tcMW + tcPT*0.80,  yInner, tcPT*0.20, doorH, BLK, null, null, 0.07);
          lineV(mAbsX, yInner, ySilver, '#38383e', 1.2, 0.55);
        }
        R(mAbsX,               yInner, tcMFW, doorH, tcFrC);
        R(mAbsX + tcMW - tcMFW, yInner, tcMFW, doorH, tcFrC);
        R(mAbsX, yInner,          tcMW, tcFH, tcFrC);
        R(mAbsX, ySilver - tcFH,  tcMW, tcFH, tcFrC);
        shapes.push({ t:'photo',
          x: (mAbsX+tcMFW)*sc, y: mInnerY*sc,
          w: mInnerW*sc, h: mInnerH*sc,
          src: tcMoldSrc });
      }
    }

    // ── keystrips: 키쪽부터 고정간격 세로 몰딩 (L115) ──
    if (design === 'keystrips') {
      var ksW   = d.moldW    || 100;
      var ksG   = d.gap      || 50;
      var ksC   = d.count    || 5;
      var ksFW  = d.frameW   || 8;
      var ksPT  = d.protrude || 0;
      var ksFrC = '#0e0e12';
      var ksMoldSrc = d.moldSrc || panelSrc;
      var ksInnerW = ksW - ksFW * 2;

      function ksRenderMold(absX) {
        if (ksPT > 0) {
          R(absX + ksW,              yInner, ksPT*0.45, doorH, BLK, null, null, 0.32);
          R(absX + ksW + ksPT*0.45,  yInner, ksPT*0.35, doorH, BLK, null, null, 0.16);
          R(absX + ksW + ksPT*0.80,  yInner, ksPT*0.20, doorH, BLK, null, null, 0.07);
        }
        R(absX,              yInner, ksFW, doorH, ksFrC);
        R(absX + ksW - ksFW, yInner, ksFW, doorH, ksFrC);
        shapes.push({ t:'photo', x:(absX+ksFW)*sc, y:yInner*sc, w:ksInnerW*sc, h:doorH*sc, src:ksMoldSrc });
        if (ksPT > 0) lineV(absX, yInner, ySilver, '#38383e', 1.2, 0.55);
      }

      for (var ki = 0; ki < ksC; ki++) {
        var ksRelX = ksG + ki * (ksW + ksG);
        var ksAbsX = keyLeft ? (xDR - ksRelX - ksW) : (xDL + ksRelX);
        ksRenderMold(ksAbsX);
      }
    }

    // ── slit: 세로 유리 슬릿 (L118, L121) ──
    if (design === 'slit') {
      var splitDark = d.splitDark || false;
      var splitFrac = d.splitFrac || 0.40;

      if (splitDark) {
        var splitX = xDL + doorWmm * splitFrac;
        R(xDL, yInner, splitX - xDL, doorH, '#18181c', null, null, 0.82);
        seamV(splitX, yInner, ySilver);
      }

      var slitW, slitX, slitH, slitY, sltFW;

      if (d.hingeOffMM != null) {
        // 절대 mm 방식 (L118)
        sltFW  = d.frameW  || 50;
        slitW  = d.glassW  || 150;
        var topMM = d.topMM || 250;
        slitX  = keyLeft
          ? (xDR - d.hingeOffMM - sltFW - slitW)
          : (xDL + d.hingeOffMM + sltFW);
        slitY  = yInner + topMM;
        slitH  = doorH - topMM * 2;
      } else {
        // 비율 방식 (L121 등)
        var xFrac = d.xFrac || 0.72;
        var wFrac = d.wFrac || 0.10;
        var mFrac = d.mFrac || 0.10;
        sltFW  = 18;
        slitW  = doorWmm * wFrac;
        slitX  = xDL + doorWmm * xFrac - slitW / 2;
        slitH  = doorH * (1 - mFrac * 2);
        slitY  = yInner + doorH * mFrac;
      }

      // 검정 프레임 박스
      var slitPT = d.protrude || 0;
      protrudeBox(slitX - sltFW, slitY - sltFW, slitW + sltFW * 2, slitH + sltFW * 2, slitPT);
      R(slitX - sltFW, slitY - sltFW, slitW + sltFW * 2, slitH + sltFW * 2, BLK);
      // 유리
      R(slitX, slitY, slitW, slitH, 'glass');
      R(slitX, slitY, slitW, slitH, 'none', '#000', 1.5);
    }

    // ── keycol: 키쪽 LB(리스타블랙) + DS(다크서스) 스트립 + 선택판재 (L120) ──
    if (design === 'keycol') {
      var kcKW    = d.keyW   || 200;
      var kcSW    = d.stripW || 10;
      var kcLbSrc = d.lbSrc  || '/ref/color/%EA%B0%95%ED%8C%90/LB.jpg';
      var kcDsSrc = d.dsSrc  || '/ref/color/%EA%B0%95%ED%8C%90/DS.jpg';

      // 키쪽 200mm LB 판재
      var kcLbX = keyLeft ? xDL : (xDR - kcKW);
      shapes.push({ t:'photo', x:kcLbX*sc, y:yInner*sc, w:kcKW*sc, h:doorH*sc, src:kcLbSrc });

      // 경계 10mm DS 스트립
      var kcDsX = keyLeft ? (xDL + kcKW) : (xDR - kcKW - kcSW);
      shapes.push({ t:'photo', x:kcDsX*sc, y:yInner*sc, w:kcSW*sc, h:doorH*sc, src:kcDsSrc });
    }

    // ── keysplit: 키쪽 DS판재 200mm + 10mm블랙 + 5분할 (L123) ──
    if (design === 'keysplit') {
      var ksPW  = d.keyPanelW  || 200;
      var ksSW  = d.sepW       || 10;
      var ksN   = d.splitCount || 5;
      var ksBarW = d.splitBarW || 10;
      var ksDsSrc = d.dsSrc || '/ref/color/%EA%B0%95%ED%8C%90/DS.jpg';

      // 키쪽 DS 판재
      var dsPanelX = keyLeft ? xDL : (xDR - ksPW);
      shapes.push({ t:'photo', x:dsPanelX*sc, y:yInner*sc, w:ksPW*sc, h:doorH*sc, src:ksDsSrc });

      // DS↔섹션 경계 10mm 블랙 알미늄
      var sep1X = keyLeft ? (xDL + ksPW) : (xDR - ksPW - ksSW);
      R(sep1X, yInner, ksSW, doorH, BLK);

      // 나머지 영역 가로 5분할 (패널은 panelFill로 이미 채워짐, 가로 구분선만 그림)
      var remainX = keyLeft ? (xDL + ksPW + ksSW) : xDL;
      var remainW = doorWmm - ksPW - ksSW;
      var ksSH = (doorH - (ksN - 1) * ksBarW) / ksN;
      var hpos = yInner;
      for (var ksi2 = 0; ksi2 < ksN; ksi2++) {
        hpos += ksSH;
        if (ksi2 < ksN - 1) {
          R(remainX, hpos, remainW, ksBarW, BLK);
          hpos += ksBarW;
        }
      }
    }

    // ── moldglass: 경첩쪽 100mm몰딩 + 유리 + 200mm몰딩 (L121) ──
    if (design === 'moldglass') {
      var mgHG  = d.hingeGap   || 100;
      var mgM1  = d.moldW1     || 100;
      var mgG1  = d.gap1       || 40;
      var mgFW  = d.frameW     || 40;
      var mgGW  = d.glassW     || 60;
      var mgTM  = d.topMM      || 250;
      var mgG2  = d.gap2       || 40;
      var mgM2  = d.moldW2     || 200;
      var mgMFW = d.moldFrameW || 8;
      var mgMFH = d.moldFrameH || 2;
      var mgFrC = '#0e0e12';
      var mgPT  = d.protrude || 0;
      var mgMoldSrc   = d.moldSrc || panelSrc;
      var mgGlassUnitW = mgFW * 2 + mgGW;
      var mgSlitH = doorH - mgTM * 2;
      var mgSlitY = yInner + mgTM;

      // 첫번째 몰딩 (경첩쪽, 100mm)
      var mld1X = keyLeft ? (xDR - mgHG - mgM1) : (xDL + mgHG);
      if (mgPT > 0) {
        R(mld1X + mgM1,              yInner, mgPT*0.45, doorH, BLK, null, null, 0.32);
        R(mld1X + mgM1 + mgPT*0.45,  yInner, mgPT*0.35, doorH, BLK, null, null, 0.16);
        R(mld1X + mgM1 + mgPT*0.80,  yInner, mgPT*0.20, doorH, BLK, null, null, 0.07);
        lineV(mld1X, yInner, ySilver, '#38383e', 1.2, 0.55);
      }
      R(mld1X,                yInner, mgMFW, doorH, mgFrC);
      R(mld1X + mgM1 - mgMFW, yInner, mgMFW, doorH, mgFrC);
      R(mld1X, yInner,           mgM1, mgMFH, mgFrC);
      R(mld1X, ySilver - mgMFH,  mgM1, mgMFH, mgFrC);
      shapes.push({ t:'photo',
        x:(mld1X+mgMFW)*sc, y:(yInner+mgMFH)*sc,
        w:(mgM1-mgMFW*2)*sc, h:(doorH-mgMFH*2)*sc, src:mgMoldSrc });

      // 유리 (L118과 동일 방식: 40mm 블랙 + 60mm 유리 + 40mm 블랙, 상하 250mm 여백)
      var glassUnitX = keyLeft
        ? (xDR - mgHG - mgM1 - mgG1 - mgGlassUnitW)
        : (xDL + mgHG + mgM1 + mgG1);
      var glassX = glassUnitX + mgFW;
      protrudeBox(glassUnitX, mgSlitY - mgFW, mgGlassUnitW, mgSlitH + mgFW * 2, mgPT);
      R(glassUnitX, mgSlitY - mgFW, mgGlassUnitW, mgSlitH + mgFW * 2, BLK);
      R(glassX, mgSlitY, mgGW, mgSlitH, 'glass');
      R(glassX, mgSlitY, mgGW, mgSlitH, 'none', '#000', 1.5);

      // 두번째 몰딩 (키쪽, 200mm)
      var mld2X = keyLeft
        ? (xDR - mgHG - mgM1 - mgG1 - mgGlassUnitW - mgG2 - mgM2)
        : (xDL + mgHG + mgM1 + mgG1 + mgGlassUnitW + mgG2);
      if (mgPT > 0) {
        R(mld2X + mgM2,              yInner, mgPT*0.45, doorH, BLK, null, null, 0.32);
        R(mld2X + mgM2 + mgPT*0.45,  yInner, mgPT*0.35, doorH, BLK, null, null, 0.16);
        R(mld2X + mgM2 + mgPT*0.80,  yInner, mgPT*0.20, doorH, BLK, null, null, 0.07);
        lineV(mld2X, yInner, ySilver, '#38383e', 1.2, 0.55);
      }
      R(mld2X,                yInner, mgMFW, doorH, mgFrC);
      R(mld2X + mgM2 - mgMFW, yInner, mgMFW, doorH, mgFrC);
      R(mld2X, yInner,           mgM2, mgMFH, mgFrC);
      R(mld2X, ySilver - mgMFH,  mgM2, mgMFH, mgFrC);
      shapes.push({ t:'photo',
        x:(mld2X+mgMFW)*sc, y:(yInner+mgMFH)*sc,
        w:(mgM2-mgMFW*2)*sc, h:(doorH-mgMFH*2)*sc, src:mgMoldSrc });
    }

    // ── gothic: 4줄 블랙 스트립 + 중앙 상단 이미지 (L122) ──
    if (design === 'gothic') {
      var gtLW  = d.lineW    || 10;
      var gtLG  = d.lineGap  || 100;
      var gtLC  = d.lineCount || 4;
      var gtGW  = d.glassW   || 180;
      var gtGH  = d.glassH   || 250;
      var gtTOP = d.topOff   || 300;
      var gtFW  = d.frameW   || 30;

      var dc = xDL + doorWmm / 2;

      // 4줄 세로 블랙 알미늄 (문 중앙 기준)
      var totalLW = gtLC * gtLW + (gtLC - 1) * gtLG;
      var lStartX = dc - totalLW / 2;
      for (var gli = 0; gli < gtLC; gli++) {
        R(lStartX + gli * (gtLW + gtLG), yInner, gtLW, doorH, BLK);
      }

      // 중앙 상단 이미지 배치 (이전 유리창+프레임 위치)
      var glY = yInner + gtTOP;
      var imgW = (gtGW + gtFW * 2) * 1.8;
      var imgH = (gtGH + gtFW * 2) * 1.8;
      var imgX = dc - imgW / 2;
      var imgY = glY - gtFW;
      shapes.push({ t:'photo', x:imgX*sc, y:imgY*sc, w:imgW*sc, h:imgH*sc,
        src:'/ref/color/%EA%B8%B0%ED%83%80/122.png' });
    }

    // ── hplanks: 가로 플랭크 줄눈 (L123, L128) ──
    if (design === 'hplanks') {
      var count2  = d.count   || 10;
      var barFrac = (d.barFrac !== undefined) ? d.barFrac : -1;
      var barW2   = d.barW    || 40;

      for (var i = 1; i < count2; i++) {
        seamH(xDL, xDR, yInner + doorH * i / count2);
      }

      if (barFrac >= 0) {
        var barX = xDL + doorWmm * barFrac - barW2 / 2;
        R(barX, yInner, barW2, doorH, '#8a8e92');
        R(barX + barW2 * 0.15, yInner, barW2 * 0.30, doorH, '#bcc0c4', null, null, 0.55);
        R(barX, yInner, barW2, doorH, 'none', '#555555', 0.8);
        seamV(barX,          yInner, ySilver);
        seamV(barX + barW2,  yInner, ySilver);
      }
    }

    // ── hingestrips: 경첩쪽에서 고정간격 세로 몰딩 N개 (L129) ──
    if (design === 'hingestrips') {
      var hsHG  = d.hingeGap || 150;
      var hsMW  = d.moldW    || 20;
      var hsMG  = d.moldGap  || 100;
      var hsN   = d.count    || 5;
      var hsFW  = d.frameW   || 3;
      var hsFH  = d.frameH   || 2;
      var hsPT  = d.protrude || 0;
      var hsFrC = '#0e0e12';
      var hsMoldSrc = panelSrc;
      var hsInnerW = hsMW - hsFW * 2;
      var hsInnerH = doorH - hsFH * 2;
      var hsInnerY = yInner + hsFH;

      for (var hsi = 0; hsi < hsN; hsi++) {
        var hsDist = hsHG + hsi * (hsMW + hsMG);
        var hsMX   = keyLeft ? (xDR - hsDist - hsMW) : (xDL + hsDist);

        // 돌출 캐스트 섀도 (몰딩 우측 3단 페이드)
        if (hsPT > 0) {
          R(hsMX + hsMW,               yInner, hsPT * 0.45, doorH, BLK, null, null, 0.32);
          R(hsMX + hsMW + hsPT * 0.45, yInner, hsPT * 0.35, doorH, BLK, null, null, 0.16);
          R(hsMX + hsMW + hsPT * 0.80, yInner, hsPT * 0.20, doorH, BLK, null, null, 0.07);
        }

        // 몰딩 프레임 + 내부 판재
        R(hsMX,                yInner,       hsFW, doorH, hsFrC);
        R(hsMX + hsMW - hsFW,  yInner,       hsFW, doorH, hsFrC);
        R(hsMX,                yInner,       hsMW, hsFH,  hsFrC);
        R(hsMX,                ySilver-hsFH, hsMW, hsFH,  hsFrC);
        if (hsInnerW > 0 && hsMoldSrc) {
          shapes.push({ t:'photo', x:(hsMX+hsFW)*sc, y:hsInnerY*sc, w:hsInnerW*sc, h:hsInnerH*sc, src:hsMoldSrc });
        }

        // 좌측 엣지 하이라이트
        if (hsPT > 0) {
          lineV(hsMX, yInner, ySilver, '#38383e', 1.2, 0.55);
        }
      }
    }
  }

  // ═══════════════════════════════════════════
  //  로이도어 빌더
  // ═══════════════════════════════════════════
  function buildRoy(state, data, M, panelSrc) {
    var shapes = [];

    // ── 로이도어 고정 치수 (mm, 엑셀 참조) ──
    var L = {
      outFr:  30,  // 좌우 외부 프레임
      topFr:  90,  // 상부 프레임 (남마 없음)
      topFr2: 20,  // 남마 있음: 최상단
      topFr1: 20,  // 남마 있음: 문 바로 위
      btmSlv: 20,  // 문지방
      mull:   20   // 멀리언 (소대↔문 사이)
    };

    var fw  = clamp(state.fw, 500, 5000, 1500);
    var fh  = clamp(state.fh, 1000, 4000, 2300);
    var dw  = clamp(state.dw, 200, 3000, 950);
    var VW  = 400, sc = VW / fw, VH = fh * sc;
    var BLK = '#0c0c0d', SLV = '#8a8c8f';
    var frameSameColor = M.frameSameColor === true;
    var tileWidthPx  = M.tileWidthMM  ? M.tileWidthMM  * sc : 0;
    var panelRealHPx = M.panelRealH   ? M.panelRealH   * sc : 0;
    var seamOp1 = frameSameColor ? 0.04 : 0.95;
    var seamOp2 = frameSameColor ? 0.02 : 0.50;

    var keyLeft = (state.hinge !== 'L');
    var hasL = (state.glass === 'L' || state.glass === 2);
    var hasR = (state.glass === 'R' || state.glass === 2);

    // ── 수직 좌표 ──
    var hasFix = state.fix === true || state.fix === 'true';
    var dh = clamp(state.dh, 500, 3900, 0);
    var yInner, doorH, ySilver, yFix, fixH;
    if (!hasFix) {
      yFix = 0; fixH = 0;
      yInner = L.topFr;
      doorH  = fh - L.topFr - L.btmSlv;
    } else {
      var dhUsed = (dh >= 500 && dh < fh - 110) ? dh : Math.max(500, fh - L.topFr2 - L.topFr1 - L.btmSlv - 300);
      yFix   = L.topFr2;
      fixH   = Math.max(50, fh - L.topFr2 - L.topFr1 - dhUsed - L.btmSlv);
      yInner = yFix + fixH + L.topFr1;
      doorH  = dhUsed;
    }
    ySilver = yInner + doorH;

    // ── 수평 좌표 ──
    // 소대 없음: 문폭 = fw-60 / 소대 있음: 문폭 = dw 입력값
    var innerW   = fw - 2 * L.outFr;
    var mullLW   = hasL ? L.mull : 0;
    var mullRW   = hasR ? L.mull : 0;
    var doorWmm  = (hasL || hasR)
                   ? Math.min(dw, innerW - mullLW - mullRW)
                   : innerW;
    var sideSpace  = innerW - doorWmm - mullLW - mullRW;
    var leftSideW  = hasL ? (hasR ? sideSpace / 2 : sideSpace) : 0;
    var rightSideW = hasR ? (hasL ? sideSpace / 2 : sideSpace) : 0;

    var xSL = L.outFr;                         // 좌측 소대 시작
    var xML = L.outFr + leftSideW;             // 좌측 멀리언 시작
    var xDL = xML + mullLW;                    // 문짝 좌측
    var xDR = xDL + doorWmm;                   // 문짝 우측
    var xMR = xDR;                             // 우측 멀리언 시작
    var xSR = xMR + mullRW;                    // 우측 소대 시작

    // rect 헬퍼
    function R(xmm, ymm, wmm, hmm, fill, stroke, sw, opacity) {
      if (wmm <= 0 || hmm <= 0) return;
      var s = { t:'rect', x:xmm*sc, y:ymm*sc, w:wmm*sc, h:hmm*sc, fill:fill };
      if (stroke) { s.stroke = stroke; s.sw = sw || 1; }
      if (opacity != null) s.opacity = opacity;
      shapes.push(s);
    }
    // lineV: pushRoyDesign 내부와 spRenderMold/ksRenderSideMold(buildRoy 소대 렌더) 양쪽에서 사용
    function lineV(xmm, y1mm, y2mm, stroke, sw, op) {
      var x = xmm * sc;
      shapes.push({ t:'line', x1:x, y1:y1mm*sc, x2:x, y2:y2mm*sc, stroke:stroke, sw:sw, opacity:op == null ? 1 : op });
    }

    function panelFill(xmm, ymm, wmm, hmm) {
      if (wmm <= 0 || hmm <= 0) return;
      if (panelSrc && tileWidthPx > 0) {
        shapes.push({ t:'photoTile', x:xmm*sc, y:ymm*sc, w:wmm*sc, h:hmm*sc, src:panelSrc, tileW:tileWidthPx });
      } else if (panelSrc && panelRealHPx > 0) {
        // 이미지를 실제 비율(mm→px)로 고정, 문짝 상단 기준 배치 후 클리핑
        shapes.push({ t:'photo', x:xmm*sc, y:yInner*sc, w:wmm*sc, h:panelRealHPx,
                      clipY:ymm*sc, clipH:hmm*sc, src:panelSrc });
      } else if (panelSrc) {
        shapes.push({ t:'photo', x:xmm*sc, y:0, w:wmm*sc, h:fh*sc,
                      clipY:ymm*sc, clipH:hmm*sc, src:panelSrc });
      } else {
        R(xmm, ymm, wmm, hmm, '#5a4a3a');
      }
      var bdr = { t:'rect', x:xmm*sc, y:ymm*sc, w:wmm*sc, h:hmm*sc, fill:'none', stroke:'#000000', sw:1.5 };
      if (frameSameColor) bdr.opacity = 0.03;
      shapes.push(bdr);
    }

    function frameFill(xmm, ymm, wmm, hmm) {
      if (wmm <= 0 || hmm <= 0) return;
      if (panelSrc) {
        shapes.push({ t:'photo', x:xmm*sc, y:0, w:wmm*sc, h:fh*sc,
                      clipY:ymm*sc, clipH:hmm*sc, src:panelSrc });
      } else {
        R(xmm, ymm, wmm, hmm, '#5a4a3a');
      }
    }

    function sidelightFill(xmm, ymm, wmm, hmm) {
      if (wmm <= 0 || hmm <= 0) return;
      if (state.material === 'glass') {
        var sf = 60;
        var gx = xmm + sf, gy = ymm + sf;
        var gw = wmm - sf * 2, gh = hmm - sf * 2;
        if (frameSameColor) { frameFill(xmm, ymm, wmm, hmm); } else { R(xmm, ymm, wmm, hmm, BLK); }
        if (gw > 0 && gh > 0) {
          R(gx, gy, gw, gh, 'glass');
          if (!frameSameColor) R(gx, gy, gw, gh, 'none', '#000000', 1.5);
        }
        if (!frameSameColor) {
          var xR = xmm + wmm, yB = ymm + hmm;
          seamD(xmm,    ymm,    xmm+sf, ymm+sf);
          seamD(xR-sf,  ymm+sf, xR,     ymm);
          seamD(xmm,    yB,     xmm+sf, yB-sf);
          seamD(xR-sf,  yB-sf,  xR,     yB);
        }
      } else {
        panelFill(xmm, ymm, wmm, hmm);
      }
    }

    // ── 1. 전체 배경 ──
    R(0, 0, fw, fh, BLK);

    // ── 1a. 알루미늄 프레임 ──
    if (frameSameColor) {
      frameFill(0,            0, L.outFr,  fh);
      frameFill(fw - L.outFr, 0, L.outFr,  fh);
      if (!hasFix) {
        frameFill(L.outFr, 0, innerW, yInner);
      } else {
        frameFill(L.outFr, 0,                  innerW, L.topFr2);
        frameFill(L.outFr, yInner - L.topFr1,  innerW, L.topFr1);
      }
    } else {
      R(0,            0, L.outFr,     fh, 'almV');
      R(fw - L.outFr, 0, L.outFr,     fh, 'almV');
      if (!hasFix) {
        R(L.outFr, 0, innerW, yInner, 'almH');
      } else {
        R(L.outFr, 0,                  innerW, L.topFr2,  'almH');
        R(L.outFr, yInner - L.topFr1,  innerW, L.topFr1,  'almH');
      }
    }

    // ── 2. 문짝 ──
    panelFill(xDL, yInner, doorWmm, doorH);

    // ── 3. 소대 ──
    if (leftSideW  > 0) sidelightFill(xSL, yInner, leftSideW,  doorH);
    if (rightSideW > 0) sidelightFill(xSR, yInner, rightSideW, doorH);

    // ── 4. 남마 패널 ──
    if (hasFix && fixH > 0) {
      if (state.fixMat === 'glass') {
        R(L.outFr, yFix, innerW, fixH, 'glass');
        R(L.outFr, yFix, innerW, fixH, 'none', '#000000', 1.5);
      } else {
        panelFill(L.outFr, yFix, innerW, fixH);
      }
    }

    // ── 9. 멀리언 ──
    var isOpenSide = state.sideType === 'open';
    function openSideFill(xmm, ymm, wmm, hmm) {
      // border 없이 재질만 그림 (경계선 제거용). 양쪽 2px씩 더 넓혀 도어 border 완전 덮음
      var px = 2 / sc;
      var x0 = xmm - px, w0 = wmm + px * 2;
      if (state.material === 'glass') {
        R(x0, ymm, w0, hmm, BLK);  // 유리 소대 외곽은 블랙 프레임이므로 BLK로 덮음
      } else if (panelSrc && tileWidthPx > 0) {
        shapes.push({ t:'photoTile', x:x0*sc, y:ymm*sc, w:w0*sc, h:hmm*sc, src:panelSrc, tileW:tileWidthPx });
      } else if (panelSrc) {
        shapes.push({ t:'photo', x:x0*sc, y:0, w:w0*sc, h:fh*sc, clipY:ymm*sc, clipH:hmm*sc, src:panelSrc });
      } else {
        R(x0, ymm, w0, hmm, '#5a4a3a');
      }
    }
    if (hasL) {
      if (isOpenSide) openSideFill(xML, yInner, L.mull, doorH);
      else if (frameSameColor) frameFill(xML, yInner, L.mull, doorH);
      else R(xML, yInner, L.mull, doorH, 'almV');
    }
    if (hasR) {
      if (isOpenSide) openSideFill(xMR, yInner, L.mull, doorH);
      else if (frameSameColor) frameFill(xMR, yInner, L.mull, doorH);
      else R(xMR, yInner, L.mull, doorH, 'almV');
    }

    // ── 9b. 조인트 심 라인 ──
    function seamH(x1mm, x2mm, ymm) {
      if (x2mm <= x1mm) return;
      var y = ymm * sc;
      shapes.push({ t:'line', x1:x1mm*sc, y1:y,     x2:x2mm*sc, y2:y,     stroke:'#000000', sw:1.8, opacity:seamOp1 });
      shapes.push({ t:'line', x1:x1mm*sc, y1:y+1.5, x2:x2mm*sc, y2:y+1.5, stroke:'#30303e', sw:0.7, opacity:seamOp2 });
    }
    function seamV(xmm, y1mm, y2mm) {
      if (y2mm <= y1mm) return;
      var x = xmm * sc;
      shapes.push({ t:'line', x1:x,     y1:y1mm*sc, x2:x,     y2:y2mm*sc, stroke:'#000000', sw:1.8, opacity:seamOp1 });
      shapes.push({ t:'line', x1:x+1.5, y1:y1mm*sc, x2:x+1.5, y2:y2mm*sc, stroke:'#30303e', sw:0.7, opacity:seamOp2 });
    }
    function seamD(x1mm, y1mm, x2mm, y2mm) {
      shapes.push({ t:'line', x1:x1mm*sc, y1:y1mm*sc, x2:x2mm*sc, y2:y2mm*sc, stroke:'#000000', sw:1.8, opacity:seamOp1 });
      shapes.push({ t:'line', x1:x1mm*sc+1, y1:y1mm*sc+1, x2:x2mm*sc+1, y2:y2mm*sc+1, stroke:'#30303e', sw:0.7, opacity:seamOp2 });
    }
    // 상부 ↔ 기둥
    seamV(L.outFr,        0, yInner);
    seamV(fw - L.outFr,   0, yInner);
    seamH(L.outFr, fw - L.outFr, yInner);
    // 멀리언 T 접합 (소대개폐 시 멀리언 경계선 생략, 대신 판재 경계 살짝 표시)
    if (hasL && !isOpenSide) { seamV(xML, yInner, yInner+5); seamV(xDL, yInner, yInner+5); }
    if (hasR && !isOpenSide) { seamV(xMR, yInner, yInner+5); seamV(xSR, yInner, yInner+5); }
    if (isOpenSide) {
      if (hasL) lineV(xDL, yInner, ySilver, '#000000', 3.0, 0.56);
      if (hasR) lineV(xMR, yInner, ySilver, '#000000', 3.0, 0.56);
    }
    // 하부 실버
    seamH(L.outFr, fw - L.outFr, ySilver);
    seamV(L.outFr,        ySilver, ySilver + L.btmSlv);
    seamV(fw - L.outFr,   ySilver, ySilver + L.btmSlv);
    if (hasL) { seamV(xML, ySilver-5, ySilver); seamV(xDL, ySilver-5, ySilver); }
    if (hasR) { seamV(xMR, ySilver-5, ySilver); seamV(xSR, ySilver-5, ySilver); }
    // 남마
    if (hasFix && fixH > 0) {
      seamH(L.outFr, fw - L.outFr, L.topFr2);
      seamH(L.outFr, fw - L.outFr, yInner - L.topFr1);
    }

    // ── 10. 하부 실버 문지방 ──
    R(L.outFr, ySilver, innerW, L.btmSlv, SLV);
    R(L.outFr, ySilver, innerW, L.btmSlv, 'none', '#000000', 1.5);

    // ── 11. 경첩 ──
    var hW = 22, hH = 150;
    var hingeEdges = isOpenSide
      ? [L.outFr, fw - L.outFr]          // 소대개폐: 좌우 외부 프레임에 경첩
      : [keyLeft ? xDR : xDL];           // 일반: 경첩 방향 한쪽
    hingeEdges.forEach(function(hingeEdge) {
      var hX = hingeEdge - hW / 2;
      if (frameSameColor) {
        [yInner + 150, yInner + 400, ySilver - 250 - hH].forEach(function(hY) {
          frameFill(hX, hY, hW, hH);
          R(hX, hY, hW, hH, 'none', '#000000', 0.25);
        });
      } else {
        [yInner + 150, yInner + 400, ySilver - 250 - hH].forEach(function(hY) {
          shapes.push({ t:'image', x:hX*sc, y:hY*sc, w:hW*sc, h:hH*sc,
                        href:'/ref/hinge/%EA%B2%BD%EC%B2%A9.jpg' });
          shapes.push({ t:'rect', x:hX*sc, y:hY*sc, w:hW*sc, h:hH*sc, fill:'#1a1a1a', opacity:0.70 });
        });
      }
    });

    // ── 11b. 디자인 포인트 ──
    var dp = M.designParams ? Object.assign({}, M.designParams) : {};
    if (M.design === 'splitstrips' || M.design === 'threecol' || M.design === 'keystrips' || M.design === 'moldglass') {
      var dpFolder = encodeURIComponent(M.colorFolder || '강판');
      dp.moldSrc = '/ref/color/' + dpFolder + '/' + encodeURIComponent(state.moldColor || 'MB') + '.jpg';
      if (M.design === 'threecol') {
        dp.baseSrc = '/ref/color/' + dpFolder + '/' + encodeURIComponent(state.baseColor || 'MB') + '.jpg';
      }
    }
    if (M.design === 'keycol' || M.design === 'keysplit' || M.design === 'hingecol') {
      var dpFolder2 = encodeURIComponent(M.colorFolder || '강판');
      dp.lbSrc = '/ref/color/' + dpFolder2 + '/LB.jpg';
      dp.dsSrc = '/ref/color/' + dpFolder2 + '/DS.jpg';
    }
    pushRoyDesign(M.design, dp, shapes, sc,
      xDL, xDR, yInner, ySilver, doorH, doorWmm, keyLeft, panelSrc, fh, BLK, SLV);

    // ── 11c. 소대 몰딩 (splitstrips 전용, 외부 프레임쪽에서 안쪽으로) ──
    if (M.design === 'splitstrips') {
      var spW   = dp.mw       || 40;
      var spG   = dp.gw       || 40;
      var spFW  = dp.frameW   || 8;
      var spFH  = dp.frameH   || 2;
      var spKS  = dp.keyStop  || 50;
      var spPT  = dp.protrude || 0;
      var spFrC = '#0e0e12';
      var spMoldSrc = dp.moldSrc;
      var spInnerY = yInner + spFH;
      var spInnerH = doorH - spFH * 2;
      var spInnerW = spW - spFW * 2;

      function spRenderMold(absX) {
        // 소프트 섀도
        if (spPT > 0) {
          R(absX + spW,       yInner, 17, doorH, BLK, null, null, 0.40);
          R(absX + spW + 17,  yInner, 23, doorH, BLK, null, null, 0.20);
          R(absX + spW + 40,  yInner, 33, doorH, BLK, null, null, 0.08);
          lineV(absX, yInner, ySilver, '#c8cace', 0.8, 0.20);
        }
        R(absX,              yInner, spFW, doorH, spFrC);
        R(absX + spW - spFW, yInner, spFW, doorH, spFrC);
        R(absX, yInner,         spW, spFH, spFrC);
        R(absX, ySilver - spFH, spW, spFH, spFrC);
        shapes.push({ t:'photo', x:(absX+spFW)*sc, y:spInnerY*sc, w:spInnerW*sc, h:spInnerH*sc, src:spMoldSrc });
      }

      if (leftSideW > 0 && state.material !== 'glass') {
        var spLPos = spG; // 외부 프레임과의 초기 간격 (문짝 hingeInitGap과 동일 개념)
        while ((leftSideW - spLPos - spW) > spKS) {
          spRenderMold(xSL + spLPos);
          spLPos += spW + spG;
        }
      }

      if (rightSideW > 0 && state.material !== 'glass') {
        var spRPos = spG; // 외부 프레임과의 초기 간격
        while ((rightSideW - spRPos - spW) > spKS) {
          spRenderMold(xSR + rightSideW - spRPos - spW);
          spRPos += spW + spG;
        }
      }
    }

    // ── 11d. 소대 몰딩 (keystrips 전용) ──
    if (M.design === 'keystrips' && state.material !== 'glass') {
      var ksW2    = dp.moldW     || 100;
      var ksG2    = dp.gap       || 50;
      var ksFW2   = dp.frameW    || 8;
      var ksPT2   = dp.protrude  || 0;
      var ksFrC2  = '#0e0e12';
      var ksMSrc2 = dp.moldSrc;
      var ksIW2   = ksW2 - ksFW2 * 2;

      function ksRenderSideMold(absX) {
        // 소프트 섀도
        if (ksPT2 > 0) {
          R(absX + ksW2,       yInner, 17, doorH, BLK, null, null, 0.40);
          R(absX + ksW2 + 17,  yInner, 23, doorH, BLK, null, null, 0.20);
          R(absX + ksW2 + 40,  yInner, 33, doorH, BLK, null, null, 0.08);
          lineV(absX, yInner, ySilver, '#c8cace', 0.8, 0.20);
        }
        R(absX,                yInner, ksFW2, doorH, ksFrC2);
        R(absX + ksW2 - ksFW2, yInner, ksFW2, doorH, ksFrC2);
        shapes.push({ t:'photo', x:(absX+ksFW2)*sc, y:yInner*sc, w:ksIW2*sc, h:doorH*sc, src:ksMSrc2 });
      }

      function ksRenderCentered(startX, sideW) {
        var n = Math.floor((sideW + ksG2) / (ksW2 + ksG2));
        if (n < 1) return;
        var totalW = n * ksW2 + (n - 1) * ksG2;
        var margin = (sideW - totalW) / 2;
        for (var ksi = 0; ksi < n; ksi++) {
          ksRenderSideMold(startX + margin + ksi * (ksW2 + ksG2));
        }
      }

      if (leftSideW > 0)  ksRenderCentered(xSL, leftSideW);
      if (rightSideW > 0) ksRenderCentered(xSR, rightSideW);
    }

    // ── 11e. 소대 가로분할 (keysplit 전용, 판재일 때) ──
    if (M.design === 'keysplit' && state.material !== 'glass') {
      var ksN4   = dp.splitCount || 5;
      var ksBW4  = dp.splitBarW  || 10;
      var ksSH4  = (doorH - (ksN4 - 1) * ksBW4) / ksN4;
      var ksFrC4 = '#0e0e12';

      function ksDrawSideBars(sideX, sideW) {
        var hp = yInner;
        for (var ki = 0; ki < ksN4; ki++) {
          hp += ksSH4;
          if (ki < ksN4 - 1) {
            R(sideX, hp, sideW, ksBW4, ksFrC4);
            hp += ksBW4;
          }
        }
      }

      if (leftSideW > 0)  ksDrawSideBars(xSL, leftSideW);
      if (rightSideW > 0) ksDrawSideBars(xSR, rightSideW);
    }

    // ── 12. 전자키 ──
    var keyData = data.keys && state.keyId
      ? (function() { for (var i = 0; i < data.keys.length; i++) if (data.keys[i].id === state.keyId) return data.keys[i]; return null; })()
      : null;
    var keyW = (keyData && keyData.w) ? keyData.w : 55;
    var keyH = (keyData && keyData.h) ? keyData.h : 230;
    var keyX = keyLeft ? (xDL + 55) : (xDR - 55 - keyW);
    var keyY = ySilver - 1000 - keyH / 2;
    if (keyData && keyData.image) {
      shapes.push({ t:'image', x:keyX*sc, y:keyY*sc, w:keyW*sc, h:keyH*sc, href:keyData.image });
    } else {
      R(keyX, keyY, keyW, keyH, '#1a1a1a');
      R(keyX, keyY, keyW, keyH, 'none', '#444444', 0.5);
    }

    // ── 14. 외곽 테두리 ──
    shapes.push({ t:'rect', x:0, y:0, w:VW, h:VH, fill:'none', stroke:'#000000', sw:1.5 });

    return {
      width: VW, height: VH, shapes: shapes,
      meta: {
        doorW: Math.round(doorWmm), doorH: Math.round(doorH),
        sideW: Math.round(Math.max(leftSideW, rightSideW)),
        nSide: (leftSideW > 0 ? 1 : 0) + (rightSideW > 0 ? 1 : 0),
        fixMM: Math.round(fixH)
      }
    };
  }

  return { build: build, FRAME_BLACK: FRAME_BLACK };
});
