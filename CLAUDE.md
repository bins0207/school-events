# 학교 행사 참여 기록 웹앱

고등학교 행사(행사명·분류·대상·기간·주관부서)와 참여 학생을 기록하고, 학생별로 참여 행사를 조회해 담임교사와 공유하는 웹앱. 사용자는 교사이며 화면 문구는 모두 한국어로 쓴다.

## 구조
- 저장소: 구글 시트 3개 탭 — `행사`(id, 학년도, 행사명, 분류, 대상, 학년, 시작일, 종료일, 주관부서, 활동내용, 생기부문구, 비고, 수정자, 수정일시), `학생`(학년도, 학번, 학년, 반, 번호, 이름), `참여`(행사id, 학번, 비고, 등록자, 등록일시)
- 서버: `apps-script/Code.gs` (Google Apps Script). 화면에서 `google.script.run.api(req)` 또는 외부에서 `doPost`로 호출. 진입점은 `handle_(req)`.
- 화면: `app.js` + `style.css` (빌드 도구 없는 바닐라 JS)
  - 배포 방식 A(기본): Apps Script가 `apps-script/Index.html`을 서빙. **Index.html은 app.js·style.css를 인라인한 결과물이므로 직접 고치지 말고, 수정 후 `python build_gas.py`로 다시 만든다.**
  - 방식 B: `index.html`·`config.js`(API_URL)로 GitHub Pages/Vercel 정적 배포.
  - API 주소가 없고 Apps Script 안도 아니면 예시 데이터로 동작하는 체험 모드.

## 규칙
- 권한: 조회 코드(view) / 편집 코드(edit), Script Properties에 저장. 쓰기 작업은 edit만.
- 대상이 `전체`인 행사는 참여 명단 없이 해당 학년도(·학년) 학생 전체에 적용. `선택`이면 `참여` 탭 명단 사용.
- 학번은 해마다 바뀌므로 학생 키는 `학년도|학번`.
- 시트 값은 모두 글자(@ 서식)로 저장. 날짜는 `yyyy-MM-dd`.
- Apps Script HTML에는 `<?` 문자열을 넣지 않는다(템플릿 기호로 해석될 수 있음).
- 학생 실명 데이터(시작데이터 엑셀 등)는 저장소에 커밋하지 않는다.
