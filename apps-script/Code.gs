/**
 * 학교 행사 참여 기록 — Google Apps Script 서버
 * 구글 시트(확장 프로그램 > Apps Script)에 붙여넣고 웹 앱으로 배포하세요.
 * 처음 한 번 setup() 함수를 실행하면 시트와 접속 코드가 준비됩니다.
 */

const TABLES = {
  events:   { name: '행사', key: 'id',
    headers: ['id','학년도','행사명','분류','대상','학년','시작일','종료일','주관부서','활동내용','생기부문구','비고','수정자','수정일시'] },
  students: { name: '학생', key: null,
    headers: ['학년도','학번','학년','반','번호','이름'] },
  parts:    { name: '참여', key: null,
    headers: ['행사id','학번','비고','등록자','등록일시'] },
};

/* ---------- 최초 설정 ---------- */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.values(TABLES).forEach(t => {
    let sh = ss.getSheetByName(t.name);
    if (!sh) sh = ss.insertSheet(t.name);
    if (sh.getLastRow() === 0) sh.appendRow(t.headers);
    sh.getRange(1, 1, 1, t.headers.length).setFontWeight('bold').setBackground('#eef2f7');
    sh.setFrozenRows(1);
    sh.getRange('A:Z').setNumberFormat('@'); // 학번·날짜를 글자로 보관
  });
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('VIEW_CODE')) p.setProperty('VIEW_CODE', randomCode_());
  if (!p.getProperty('EDIT_CODE')) p.setProperty('EDIT_CODE', randomCode_());
  Logger.log('조회 코드(담임 선생님용): ' + p.getProperty('VIEW_CODE'));
  Logger.log('편집 코드(자료 올리는 선생님용): ' + p.getProperty('EDIT_CODE'));
}

/** 코드를 바꾸고 싶을 때: 아래 값을 고친 뒤 이 함수를 실행 */
function changeCodes() {
  const p = PropertiesService.getScriptProperties();
  p.setProperty('VIEW_CODE', '여기에-새-조회코드');
  p.setProperty('EDIT_CODE', '여기에-새-편집코드');
  Logger.log('변경 완료');
}

function randomCode_() {
  const c = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

/* ---------- 웹 요청 처리 ---------- */
function doGet() {
  return out_({ ok: true, message: '행사 참여 기록 API가 동작 중입니다.' });
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); }
  catch (err) { return out_({ ok: false, error: '잘못된 요청' }); }

  const role = roleOf_(req.code);
  if (!role) return out_({ ok: false, error: '접속 코드가 올바르지 않습니다.' });

  const writeActions = ['saveEvent','deleteEvent','setParticipants','importRows'];
  if (writeActions.indexOf(req.action) >= 0 && role !== 'edit')
    return out_({ ok: false, error: '편집 권한이 없습니다. 편집 코드로 접속하세요.' });

  const lock = LockService.getScriptLock();
  try {
    if (role === 'edit') lock.waitLock(20000);
    const user = String(req.user || '').slice(0, 30);
    let result;
    switch (req.action) {
      case 'load':            result = load_(); break;
      case 'saveEvent':       result = saveEvent_(req.event, user); break;
      case 'deleteEvent':     result = deleteEvent_(req.id); break;
      case 'setParticipants': result = setParticipants_(req.eventId, req.ids || [], user); break;
      case 'importRows':      result = importRows_(req.table, req.rows || [], req.mode, user); break;
      default: return out_({ ok: false, error: '알 수 없는 요청: ' + req.action });
    }
    result.role = role;
    result.ok = true;
    return out_(result);
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

function roleOf_(code) {
  const p = PropertiesService.getScriptProperties();
  code = String(code || '').trim();
  if (!code) return null;
  if (code === p.getProperty('EDIT_CODE')) return 'edit';
  if (code === p.getProperty('VIEW_CODE')) return 'view';
  return null;
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- 시트 읽기/쓰기 ---------- */
function sheet_(t) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(t.name);
  if (!sh) throw new Error('"' + t.name + '" 시트가 없습니다. setup()을 먼저 실행하세요.');
  return sh;
}

function cell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return v === null || v === undefined ? '' : String(v).trim();
}

function readTable_(t) {
  const sh = sheet_(t);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const head = values[0].map(String);
  return values.slice(1)
    .filter(r => r.some(v => v !== '' && v !== null))
    .map(r => {
      const o = {};
      t.headers.forEach(h => { const i = head.indexOf(h); o[h] = i >= 0 ? cell_(r[i]) : ''; });
      return o;
    });
}

function writeTable_(t, rows) {
  const sh = sheet_(t);
  const data = [t.headers].concat(rows.map(o => t.headers.map(h => o[h] === undefined ? '' : String(o[h]))));
  sh.clearContents();
  sh.getRange(1, 1, data.length, t.headers.length).setNumberFormat('@').setValues(data);
}

function now_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
}

/* ---------- 기능 ---------- */
function load_() {
  return {
    events: readTable_(TABLES.events),
    students: readTable_(TABLES.students),
    parts: readTable_(TABLES.parts),
  };
}

function saveEvent_(ev, user) {
  if (!ev || !String(ev['행사명'] || '').trim()) throw new Error('행사명을 입력하세요.');
  const rows = readTable_(TABLES.events);
  const clean = {};
  TABLES.events.headers.forEach(h => clean[h] = String(ev[h] === undefined ? '' : ev[h]).trim());
  clean['수정자'] = user;
  clean['수정일시'] = now_();
  if (!clean.id) {
    clean.id = (clean['학년도'] || new Date().getFullYear()) + '-' + Utilities.getUuid().slice(0, 8);
    rows.push(clean);
  } else {
    const i = rows.findIndex(r => r.id === clean.id);
    if (i >= 0) rows[i] = clean; else rows.push(clean);
  }
  writeTable_(TABLES.events, rows);
  return { event: clean };
}

function deleteEvent_(id) {
  if (!id) throw new Error('id가 없습니다.');
  writeTable_(TABLES.events, readTable_(TABLES.events).filter(r => r.id !== id));
  writeTable_(TABLES.parts, readTable_(TABLES.parts).filter(r => r['행사id'] !== id));
  return { deleted: id };
}

function setParticipants_(eventId, ids, user) {
  if (!eventId) throw new Error('행사 id가 없습니다.');
  const all = readTable_(TABLES.parts);
  const prev = {};
  all.filter(r => r['행사id'] === eventId).forEach(r => prev[r['학번']] = r);
  const kept = all.filter(r => r['행사id'] !== eventId);
  const uniq = Array.from(new Set(ids.map(x => String(x).trim()).filter(Boolean)));
  uniq.forEach(h => kept.push(prev[h] || { '행사id': eventId, '학번': h, '비고': '', '등록자': user, '등록일시': now_() }));
  writeTable_(TABLES.parts, kept);
  return { eventId: eventId, count: uniq.length };
}

/** 표 붙여넣기로 한꺼번에 가져오기. mode: 'append' | 'replaceYear' */
function importRows_(table, rows, mode, user) {
  const t = TABLES[table];
  if (!t) throw new Error('알 수 없는 표: ' + table);
  let cur = readTable_(t);
  const stamp = now_();

  if (table === 'students') {
    const years = new Set(rows.map(r => String(r['학년도'])));
    if (mode === 'replaceYear') cur = cur.filter(r => !years.has(r['학년도']));
    const idx = {};
    cur.forEach((r, i) => idx[r['학년도'] + '|' + r['학번']] = i);
    rows.forEach(r => {
      const k = r['학년도'] + '|' + r['학번'];
      if (idx[k] !== undefined) cur[idx[k]] = r; else { idx[k] = cur.length; cur.push(r); }
    });
  } else if (table === 'events') {
    const idx = {};
    cur.forEach((r, i) => idx[r.id] = i);
    rows.forEach(r => {
      r['수정자'] = user; r['수정일시'] = stamp;
      if (!r.id) r.id = (r['학년도'] || new Date().getFullYear()) + '-' + Utilities.getUuid().slice(0, 8);
      if (idx[r.id] !== undefined) cur[idx[r.id]] = r; else { idx[r.id] = cur.length; cur.push(r); }
    });
  } else if (table === 'parts') {
    const have = new Set(cur.map(r => r['행사id'] + '|' + r['학번']));
    rows.forEach(r => {
      const k = r['행사id'] + '|' + r['학번'];
      if (!have.has(k)) { have.add(k); r['등록자'] = user; r['등록일시'] = stamp; cur.push(r); }
    });
  }
  writeTable_(t, cur);
  return { table: table, total: cur.length };
}
