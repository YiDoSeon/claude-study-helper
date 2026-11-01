# study-helper 작업 지침

이 저장소에서 일하는 모든 세션과 서브에이전트에 적용한다. 전역 규칙 `C:\Users\doseon\.claude\CLAUDE.md` 도 함께 따른다. 서브에이전트에게 일을 맡기는 방법은 `.claude/subagents.md` 에 있다.

## 구조

- `src/` 가 원본이다. `npm run build` (`build.mjs`) 가 `dist/study.html` 과 `docs/index.html` 을 만든다.
- GitHub Pages 는 `main` 브랜치의 `/docs` 를 내보내므로 `docs/index.html` 도 커밋한다. `dist/` 는 커밋하지 않는다.
- 화면 연결은 `main.js`, 화면 이동과 방문 기록은 `router.js`, 화면마다의 코드는 `src/views/` 에 있다.

## 코드 관례

- 바닐라 JS ES 모듈이다. DOM 은 `dom.js` 의 `h()` 와 `$` 로 만든다.
- 주석은 한국어로 쓰고, 파일 첫 줄에 그 파일이 맡은 주제를 적는다. 주변 코드만큼만 주석을 단다.
- 새 기능은 새 파일에 쓴다. 기존 파일에는 그 기능을 부르는 연결만 더한다.
- 모델이 쓴 글은 `markdown.js` 의 `renderMarkdown` 으로만 넣는다 (DOMPurify 를 거친다).
- 기기마다 기억할 화면 상태 (고른 필터 등) 는 `dom.js` 의 `remember()` 에 둔다.

### 동기화되는 데이터

- 동기화할 데이터는 `store.js` 의 `COLLECTIONS` 에 컬렉션으로 둔다.
- `mergeData` 는 항목 단위로 합친다. 같은 id 면 `updatedAt` 이 큰 항목 하나만 남는다.
- 그래서 기존 항목 (`records`, `chats` 등) 에 필드를 더해 `put` 하면 항목 전체의 `updatedAt` 이 바뀌어, 아직 받아 오지 않은 다른 기기의 변경을 덮는다. 사용자가 따로 바꾸는 값 (즐겨찾기, 메모) 은 별도 컬렉션에 둔다.
- 이전 버전 앱이 동기화하면 모르는 컬렉션을 빼고 올린다. 새 버전 기기가 다시 올리므로 사라지지는 않는다.

## 빌드와 테스트

1. `npm run build`
2. Node 로직 테스트: `node <테스트 폴더>\logic-test.mjs`, `node <테스트 폴더>\md-test.mjs`
3. 화면 흐름 테스트: `<테스트 폴더>\jsdom\` 의 `*.cjs` 를 하나씩 `node` 로 실행한다. `dist/study.html` 을 읽으므로 빌드한 뒤에 실행한다.

- 테스트 폴더는 지금 세션의 scratchpad 다: `C:\Users\doseon\AppData\Local\Temp\claude\D--Workspace-Idea\5192b59f-fdc5-4876-b8a0-bd0433fda047\scratchpad`
- 새 기능에는 새 jsdom 테스트 파일을 만든다. 테스트 파일은 Write 도구로 만든다.
- API 와 GitHub 는 가짜 `fetch` 로 흉내 낸다. 실제 API 를 부르지 않는다 (돈이 든다).
- jsdom 은 레이아웃과 스크롤을 계산하지 않는다. 폭, 넘침, 위치는 확인할 수 없다고 보고한다.

## 하지 않는 것

- 브라우저 실행과 화면 검수 (Playwright, headless, Chrome 등)
- 커밋과 푸시: 본 세션이 사용자에게 묻고 한다.
- `python -`, heredoc 으로 python 실행, `sed -i`: 훅이 막는다. 파일은 Edit·Write 도구로 고친다.
- npm 패키지 추가: 먼저 묻는다.
