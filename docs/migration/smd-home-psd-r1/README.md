# SMD Home PSD R1 · CF1–CF2

기준 커밋: `2692fa20b0140457ff41431ea1ed3369dfc43889`.

PSD: `261022_smd_메인페이지 복사2.psd`, 1920 × 9003, 56,367,448 bytes.
SHA-256: `761707d94510eede8bf4e5603d4a468d721e37d475672b9ea4e31adccf9db27d`.

## 적용 범위

CF1은 PSD의 실제 부모·자식·형제 순서, 표시 플래그, opacity, 클리핑, 도형 벡터와 원형 정보, 스마트 오브젝트 원본 해시·변환, 텍스트와 UTF-16 run을 고정한다. 131개 레이어 전체를 보존한다. 섹션 후보와 Figma 대응은 원본 트리에 합쳐 넣지 않는다.

CF2는 홈 전용 색상·알파와 소스 텍스트 렌더러를 추가한다. 기존 semantic 경로의 `HomeFigmaText.vue`는 `HomeSourceText mode="current"`에 기존 표시 run을 그대로 전달한다. Figma 경로에는 동일한 PSD 대응 메타데이터를 붙인다. **현재 메인페이지의 표시 문구·폰트·좌표·레이아웃을 PSD 버전으로 전환하는 단계는 CF4다.** 캐러셀, 헤더, FAQ, CTA 주소, 기존 미디어 슬롯은 바꾸지 않는다.

## 원본과 대응 계약

| 기록 | 위치·책임 |
|---|---|
| 실제 PSD 사실 | `source-manifest.json`의 `layers`, `texts`, `shapes`, `assets` |
| 섹션 후보 | `sectionCandidates`: Y 범위에 따른 후보이며 PSD 그룹이 아님 |
| 의미 대응 | `scripts/home-psd-r1/policy.json`: PSD 52개 텍스트 레이어 ↔ 기존 Figma 49개 텍스트 노드 |
| 다대일 대응 | 혜택 제목 `[241,242] → node-1:92`; CTA `[1076,1077,1265] → node-35:4` |
| 기존 원본 보호 | `source-lock.json`: Figma JSONL·SVG·생성 데이터와 기존 표시·운영 소스 51개 파일 해시 |
| 생성된 앱 데이터 | `home-psd-r1-manifest.ts`, `home-psd-r1-copy.generated.ts`, `home-psd-r1-mapping.ts` |

`visible=true`는 합성 화면에서 노출된다는 뜻이 아니다. 108/109는 원본 표시 플래그를 유지하고 별도로 가려진 잔여 요소 후보로 기록한다. 빈 텍스트 1819의 실제 부모 142도 유지한다. FAQ 예시 질문·FOOTER·더보기 미정 액션은 표시 텍스트에 편입하지 않는다. CTA 사진 1274의 좌우 반전 변환도 그대로 남긴다.

## 토큰과 텍스트

- 공용 navy `#172C57`, orange `#D95E22` 등은 기존 `main.css` 변수를 사용한다. 공용 토큰 값은 수정하지 않았다.
- 혜택 카드 `#EAF1FF`와 특별한 시작 카드의 `#D7E4FF × 135/255`를 별도 역할로 유지한다. 반투명도는 배경 페인트에만 적용할 수 있도록 RGB와 알파를 분리한다.
- 원본 크기·leading·tracking·400/500/600/700/800 굵기·caps·가상 기울임·97%/99% 가로비율·기준선·전체 affine 행렬을 보존한다.
- `mode="psd"`는 `HomePsdTextPaint.vue`를 지연 로드한다. 글꼴 로드 후 SVG advance를 측정하고 가로비율을 적용한 다음, LEFT/CENTER/RIGHT 기준선을 배치한다. 글꼴 누락이나 유효하지 않은 폭은 명시적으로 실패한다.
- 줄바꿈 제거와 대문자 표시는 파생 값이다. raw CR 텍스트와 UTF-16 범위를 덮어쓰지 않는다.
- 원본은 모두 가로 point text이고, warp·들여쓰기·문단 전후 간격이 없다. 다른 입력을 정상처럼 처리하지 않도록 admission에서 거부한다.
- Photoshop의 가상 기울임은 브라우저 `oblique`로 투영한다. 글리프 래스터라이징·kerning·기울기까지 Photoshop과 픽셀 일치한다는 주장은 하지 않는다.

소스 모드 사용 예:

```vue
<HomeSourceText mode="psd" layer-id="2063" />
```

이 모드는 `.smd-home`의 토큰과 기존 Pretendard Variable 로드를 필요로 한다. 자체 SVG는 PSD 레이어의 bbox·기준선을 보존하며, 전체 섹션 배치는 CF4의 책임이다. 현재 운영 문구를 raw PSD 문구로 자동 치환하는 API가 아니다.

## 실행

```sh
npm ci
npm run verify:home-psd
npm run test:home-psd
npm run typecheck
npm run build
```

PSD 원본 재추출:

```sh
python -m pip install -r scripts/home-psd-r1/requirements.txt
python scripts/home-psd-r1/extract-source.py --source "261022_smd_메인페이지 복사2.psd"
npm run verify:home-psd
```

추출기는 `--root`로 별도 출력 디렉터리를 지정할 수 있다. 다른 PSD SHA나 다른 psd-tools 버전은 거부한다. 이미지 파일을 내보내거나 미디어 슬롯을 추가하지 않는다.

별도 컴포넌트 브라우저 검사:

```sh
npx playwright install chromium
npm run verify:home-psd-browser
```

`--font`, `--chromium`, `--out` 인자를 지원한다. 기본 글꼴은 Pretendard 1.3.9 공식 배포 파일이다. DPR 1/2, mixed weight, 기준선 행렬, 가로비율, 글꼴 누락, 늦게 도착한 이전 측정 결과를 검사한다. 임시 테스트 서버를 닫고 파일을 정리하며 제품 라우트는 추가하지 않는다.

## 이번 검증의 경계

실제 명령 결과는 `verification-receipt.json`을 참조한다. SOURCE/STATIC, SSR RUNTIME, COMPILE을 분리한다.

- 새 계약 검사와 기존 텍스트 76개 × 3 캐러셀 상태의 SSR 비교를 실행했다.
- 기존 회귀의 `header-wordmark-r1`은 현재 0.15인 헤더 알파에 0.20을 기대한다. `home-r2-cf2-composition`은 Hero 이벤트가 추가되기 전의 태그 문자열을 기대한다. 두 실패는 수정 전 기준본에서도 재현되며 이번 단계에서 수정하지 않는다.
- 로컬 획득본에는 GitHub 연결 도구가 반환하지 못한 대용량 이미지 등 21개 파일이 없다. 표준 build는 미디어 검사에서 실패했다. 원격 작업 트리는 원본 Git tree를 기반으로 생성하여 이 파일들을 삭제하거나 대체하지 않는다.
- Nuxt 직접 컴파일은 표준 build 수락과 별도로 기록한다. Chromium은 실행 환경의 socket 제한으로 시작하지 못했다. 브라우저 폰트·SVG 실측, 전체 페이지 시각 비교, PSD 픽셀 일치는 아직 검증하지 못했다.

## 다음 단계

CF3에서 미디어 프레임·clip·asset slot 계약을 구현한다. CF4에서 본문을 단일 레이아웃으로 전환하며 PSD paint와 text mode를 함께 채택한다. 그때 운영 문구와 PSD 문구의 차이를 별도 표시 정책으로 결정해야 한다. 이 단계에서 원본 Figma 데이터나 기존 CMS/public 계약을 다시 작성하지 않는다.
