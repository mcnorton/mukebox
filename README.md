# MukeBox

음표 길이(온음표~16분음표)를 직접 만들고 연주하는 **교육용 악보+연주 정적 웹앱**입니다.

Chrome Music Lab [Song Maker](https://musiclab.chromeexperiments.com/Song-Maker/)에서 영감을 받았으며, 수업에서 리듬과 멜로디를 시각적으로 배치하고 즉시 소리로 확인할 수 있습니다.

## 실행 방법

```bash
# 로컬 서버 (권장)
npx serve .
# 또는
python3 -m http.server 8080
```

브라우저에서 접속 후 **▶ 재생**을 누르면 Web Audio 오디오가 시작됩니다.

## 태블릿에 설치하기 (PWA)

MukeBox는 PWA(Progressive Web App)로, 홈 화면에 설치하면 전체화면 앱처럼 오프라인에서도 동작합니다.

- **Android / Chrome**: 접속하면 헤더 우측에 **설치** 버튼이 나타납니다. 눌러서 설치하세요. (또는 브라우저 메뉴 → "앱 설치/홈 화면에 추가")
- **iPad / Safari**: 공유 버튼 → **홈 화면에 추가**를 누릅니다. (헤더 **설치** 버튼을 누르면 안내가 표시됩니다.)

> 설치/오프라인 캐시는 서비스 워커가 필요하므로 `https://` 또는 `localhost`(`http://`) 환경에서 접속해야 합니다.

## 기능

- **피아노 (C3~C5)**: 건반별 레인, 칸 클릭으로 멜로디·화음
- **큰북**: 타악기 행, 칸 클릭 on/off
- **음표 길이**: 더블클릭 분할(4분→8분→16분), 드래그+[OK] 병합
- **박자**: 2/4, 3/4, 4/4, 6/8 — 변경해도 음표 형태(dur) 유지
- **연주**: Web Audio API 신디사이저, 재생 중 칸 하이라이트
- **저장**: localStorage 자동 저장 (`mukebox-song`), JSON보내기/불러오기

## 사용 방법

1. 피아노 칸을 탭해 음을 켜고 끕니다.
2. 칸 **길게 누르기**(또는 더블클릭) → 절반으로 분할.
3. 인접 칸 **드래그** → 즉시 병합.
4. 하단에서 **박자(Meter)**·**템포**를 바꿀 수 있습니다.
5. **▶** 재생/정지, **↻** 반복 연주, 헤더 **💾** 저장·**📂** 불러오기.

## 프로젝트 구조

```
index.html
manifest.webmanifest  # PWA 매니페스트
sw.js                 # 서비스 워커 (오프라인 캐시)
icons/                # 앱 아이콘 (192/512/maskable/apple-touch)
js/
├── model.js       # 박자·음역·악기 상수
├── i18n.js        # 다국어 (ko/en)
├── note-data.js   # v3 곡 데이터 (dur 분수, 편집, 직렬화)
├── schedule.js    # 재생 스케줄 (초 단위)
├── audio.js       # Web Audio API
├── grid.js        # 피아노롤 UI
├── storage.js     # 저장/불러오기
└── main.js
```

문서: [`docs/`](docs/) — [데이터모델](docs/데이터모델.md), [아키텍처](docs/아키텍처.md), [계획서](docs/계획서.md)

## 테스트

```bash
node scripts/test-migration.js
```

## 악기 추가

[`js/model.js`](js/model.js)의 `INSTRUMENTS`에 항목을 추가하고, [`js/note-data.js`](js/note-data.js)의 `createDefaultSong()` tracks에 ID를 넣습니다.

## 기술

- HTML / CSS / JavaScript (Vanilla)
- Web Audio API (외부 의존성 없음, 완전 오프라인 동작)
- PWA: Web App Manifest + Service Worker (`sw.js`)

## 라이선스

교육용 프로젝트 — 자유롭게 수정·활용 가능합니다.
