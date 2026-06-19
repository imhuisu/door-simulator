# 도어 컨피규레이터 (엔토브 / 로이도어)

현관문을 제품군·모델·색상·사이즈·구성에 따라 실시간으로 그려주는 컨피규레이터입니다.
**브라우저 실시간 렌더**와 **서버 렌더(다운로드/카탈로그)**가 하나의 엔진을 공유합니다.

## 핵심 설계

```
선택값(state) + 데이터(JSON)  →  [공용 엔진]  →  도형 명령(shapes)  →  [렌더러]  →  화면/이미지
                                  engine.js                          svg-renderer(브라우저)
                                                                     svg-server(서버)
```

- **엔진(src/engine.js)**: 환경 독립적인 순수 함수. DOM·파일에 의존하지 않고 "그릴 도형 목록"만 만든다. 브라우저·서버가 똑같이 사용 → 결과가 100% 일치.
- **색상·키 = 이미지 에셋**: 색상 텍스처(`public/textures/*.jpg`)와 전자키 PNG(`public/keys/*.png`)를 서버에 올려두고, 선택 시 입힌다.
- **남마·소대·프레임 = 동적 렌더링**: 구조물은 이미지 없이 그때그때 그린다.

## 폴더 구조

```
data/        설정 데이터 (코드 수정 없이 모델·색상 추가 가능)
  colors.json   색상 22종 (강판 19 + 우드 3). 우드는 texture 이미지 매핑
  models.json   모델 21종 (제품군/디자인/기본색/키옵션)
  keys.json     전자키 부품
  config.json   선택 항목 메타(사이즈 범위, 프레임 규격 등)
public/
  index.html    브라우저 실시간 화면
  textures/     색상 텍스처 이미지 (color id.jpg)
  keys/         전자키 PNG (투명배경)
src/
  engine.js        공용 렌더 엔진 (브라우저+서버 공용)
  svg-renderer.js  브라우저용: shapes → SVG DOM
server/
  index.js         http 서버 (정적 서빙 + /api/render, /api/meta)
  svg-server.js    서버용: shapes → SVG 문자열
```

## 실행

```bash
node server/index.js      # http://localhost:3000
```
의존성 없이 바로 실행됩니다(순수 http). PNG 다운로드가 필요하면 `npm i sharp` 후
server/index.js의 변환 주석을 켜면 됩니다.

## 홈페이지 연동 (링크 방식)

- **실시간 화면**: `index.html`을 그대로 임베드하거나 iframe.
- **서버 렌더 이미지**: 쿼리스트링으로 바로 이미지 URL 생성. 예:
  ```
  /api/render?model=E305&color=caramel-oak&glass=2&fix=true&dh=2200&hinge=R
  ```
  이 URL을 `<img src>`에 넣으면 어디서든 그 구성의 문이 뜬다 → 카탈로그/공유/메일에 활용.

## 선택 항목

제품군(엔토브/로이도어) · 모델 · 색상(강판19/우드3) · 사이즈(전체·문 가로세로) ·
소대 0~2개 + 유리/판재 · 경첩 좌/우 · 남마 0~1 + 유리/판재 ·
키(엔토브=매립형 고정 + 손잡이 길이 / 로이도어=전자키 선택).

## 확장 방법

- **색상 추가**: `public/textures/`에 이미지 넣고 `colors.json`에 항목 추가.
- **모델 추가**: `models.json`에 항목 추가. 디자인 패턴이 새 형태면 `engine.js`의 `pushDesign`에 케이스 추가.
- **전자키 추가**: `public/keys/`에 PNG, `keys.json`에 등록.
- **가격 연동**: `/api/meta`가 구성 정보를 반환하므로, 여기에 CSV 가격 로직을 붙이면 견적 산출 가능.

## 다음 작업(권장)

1. 실제 제품 사진에서 색상 텍스처를 깨끗한 평면 스와치로 추출해 `textures/`에 교체.
2. 전자키 4~5종 PNG 제작 후 `keys/`에 추가.
3. 모델별 고유 디자인(슬릿 위치/판재 간격 등)을 사진 기준으로 미세 조정.
