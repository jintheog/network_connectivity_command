/*
 * lab.js — 실제 터미널 실습 화면 (SPEC 1·2장)
 *
 * - 실습 카드 틀: 질문 → 실행 위치 → 입력할 명령 → 뜻 → 바꿀 값 → 끝나는 때 → 복사 범위
 *                → 붙여넣기 → 출력 읽기 → 질문 답하기 → 채점
 * - 출력 해석은 analyzer.js(NetAnalyzer)만 한다. 이 파일은 분석 결과의 값으로 화면을 그린다.
 * - 카드마다 '실제 터미널 실습'(내 출력)과 '예시로 연습'(예시 출력)을 바꿀 수 있다.
 * - 내 환경 정보(장치 이름, VM IP, 게이트웨이, 고른 장치)는 localStorage에 저장한다.
 */
(function () {
  'use strict';
  const A = window.NetAnalyzer, D = window.LabData;
  const by = id => document.getElementById(id);
  const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ---------- 저장 ----------
  const STORE = { env: 'netlab.env', modes: 'netlab.modes' };
  function load(k, d) {
    try { const v = JSON.parse(localStorage.getItem(k)); return v && typeof v === 'object' ? v : d; } catch (e) { return d; }
  }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장할 수 없는 환경 */ } }

  let env = load(STORE.env, {});
  function setEnv(patch) {
    env = Object.assign({}, env, patch);
    env.updated = new Date().toISOString();
    store(STORE.env, env);
    refreshAll();
  }
  function resetEnv() {
    env = {};
    try { localStorage.removeItem(STORE.env); } catch (e) { /* 무시 */ }
    Object.keys(state).forEach(k => { if (state[k].real) state[k].real.after = null; });
    refreshAll();
  }

  const modes = load(STORE.modes, {});
  const modeOf = key => (modes[key] === 'example' ? 'example' : 'real');
  const SOURCE = { real: '내 출력', example: '예시 출력' };

  // 카드별 · 모드별 상태: { text, result, answers, graded, stale, picked }
  const state = {};
  function S(key, mode) {
    state[key] = state[key] || {};
    if (!state[key][mode]) {
      state[key][mode] = { text: mode === 'example' ? D.CARDS[key].example.output : '', result: null, answers: {}, graded: null, stale: false, picked: null };
    }
    return state[key][mode];
  }
  // 예시 모드는 예시 환경을 쓰고, 내 환경 정보에 저장하지 않는다.
  function envFor(mode) {
    if (mode === 'real') return env;
    const picked = S('ip-br-addr', 'example').picked;
    return Object.assign({}, D.EXAMPLE_ENV, picked ? { device: picked.name, ipv4: picked.ipv4[0], prefix: picked.prefix[0] } : {});
  }

  // ---------- 카드 그리기 ----------
  let uid = 0;
  const step = (n, title, body, cls) => '<section class="lab-step' + (cls ? ' ' + cls : '') + '"><h4><b>' + n + '</b>' + title + '</h4>' + body + '</section>';

  function guideHTML(key, mode) {
    const c = D.CARDS[key], place = D.PLACES[c.place], e = envFor(mode);
    const cmd = c.command(e);
    const hole = c.needs && c.needs(e);
    const cmdShown = hole ? esc(cmd).replace(esc(hole), '<mark>' + esc(hole) + '</mark>') : esc(cmd);
    let values = c.values(e);
    if (c.editDevice && mode === 'real') {
      const id = 'dev-' + (++uid);
      values += '<div class="dev-edit"><label for="' + id + '">장치 이름</label><input id="' + id + '" class="dev-input" value="' + esc(env.device || '') + '" placeholder="예: ens160" autocomplete="off" spellcheck="false"><button type="button" class="minor dev-apply">명령에 채우기</button></div>';
    }
    if (mode === 'example') values = '<span class="ex-tag">예시</span> 예시 장치 <code>' + esc(e.device) + '</code>를 채웠다. 실제 실습에서는 1-1에서 고른 내 장치 이름이 채워진다.';
    return '<div class="lab-guide">' +
      step(1, '이 명령으로 답할 질문', '<p class="ask">' + c.question + '</p>') +
      step(2, '어디에서 실행하는가', '<p class="place"><span>' + (place.kind === 'linux' ? 'Linux' : 'Windows') + '</span>' + esc(place.label) + '</p>' + place.detail.map(p => '<p>' + p + '</p>').join('')) +
      step(3, '입력할 명령', '<p>' + c.lead + '</p><div class="cmdline"><span class="prompt" aria-hidden="true" title="프롬프트는 입력하지 않는다">' + esc(place.prompt) + '</span><code>' + cmdShown + '</code><button type="button" class="lab-copy" data-copy="' + esc(cmd) + '">복사</button></div>' +
        '<p class="small">회색 <code>' + esc(place.prompt) + '</code>는 프롬프트라서 복사되지 않는다. 한 번에 이 명령 하나만 입력한다.' + (hole ? ' <mark>' + esc(hole) + '</mark> 부분은 내 값으로 바꿔야 한다.' : '') + '</p>') +
      step(4, '단어·옵션의 뜻', '<dl class="parts">' + c.parts.map(p => '<dt><code>' + p[0] + '</code></dt><dd>' + p[1] + '</dd>').join('') + '</dl>') +
      step(5, '바꿔야 할 값', '<p>' + values + '</p>') +
      step(6, '언제 끝나는가', '<p>' + c.ends + '</p>') +
      step(7, '어디서부터 어디까지 복사하는가', '<ul class="copy-range"><li><b>시작</b> ' + c.copy.from + '</li><li><b>끝</b> ' + c.copy.to + '</li><li>' + c.copy.extra + '</li><li><b>실패했을 때</b> ' + c.copy.fail + '</li></ul>') +
      '</div>';
  }

  function pasteHTML(key, mode) {
    const c = D.CARDS[key], st = S(key, mode);
    if (mode === 'example') {
      return step(8, '예시 출력 보기', '<p class="small"><span class="ex-tag">예시</span>' + esc(c.example.note) + ' 실제 실습의 붙여넣기 자리에 이 예시 출력을 넣었다고 생각하고 읽는다.</p>' +
        '<div class="console ex-console"><div class="bar">예시 출력 · 내 VM의 값이 아니다</div><pre>' + esc(st.text) + '</pre></div>' +
        '<div class="actions"><button type="button" class="primary read">출력 읽기</button></div>');
    }
    const id = 'paste-' + (++uid);
    return step(8, '붙여넣기', '<label for="' + id + '">' + esc(c.pasteLabel) + '</label><textarea id="' + id + '" class="paste" rows="8" spellcheck="false" autocomplete="off" placeholder="터미널에서 복사한 출력을 여기에 붙여 넣는다">' + esc(st.text) + '</textarea>' +
      '<p class="stale-note"' + (st.stale ? '' : ' hidden') + '>출력이 바뀌었다. \'출력 읽기\'를 다시 누르면 새 출력 기준으로 다시 읽고 채점한다.</p>' +
      '<div class="actions"><button type="button" class="primary read">출력 읽기</button><button type="button" class="minor clear">지우기</button></div>');
  }

  function statusChip(res) {
    const cls = res.status === 'ok' ? 'ok' : res.status === 'fail' ? 'fail' : 'warn';
    return '<span class="chip ' + cls + '">' + esc(res.statusLabel) + '</span>';
  }

  function readingHTML(key, mode) {
    const c = D.CARDS[key], st = S(key, mode), res = st.result;
    if (!res) return '';
    let body = '<p class="read-status">출력 상태 ' + statusChip(res) + (res.label && res.status !== 'notfound' && res.status !== 'empty' ? ' <span class="small">' + esc(res.label) + ' 출력으로 읽었다.</span>' : '') + '</p>';
    if (res.ignoredLines && res.ignoredLines.length && res.status !== 'empty') body += '<p class="small">프롬프트·명령 줄 ' + res.ignoredLines.length + '개는 빼고 읽었다.</p>';
    if (res.status === 'ok') {
      if (res.notes.length) body += '<ul class="notes">' + res.notes.map(n => '<li>' + esc(n) + '</li>').join('') + '</ul>';
      body += '<p><b>출력 읽는 법</b></p><ul class="guide">' + c.reading.map(r => '<li>' + r + '</li>').join('') + '</ul><p>이 내용을 보며 아래 질문에 답한다.</p>';
    } else {
      body += '<div class="redo"><p>' + esc(res.message) + '</p>';
      if (res.recopy) body += '<p><b>다시 할 일</b> ' + esc(res.recopy) + '</p>';
      else if (res.status !== 'notfound' && res.status !== 'fail') body += '<p><b>다시 할 일</b> 3번의 명령을 다시 실행하고, 7번 안내대로 처음 줄부터 마지막 줄까지 복사해 붙여 넣는다.</p>';
      if (res.notes.length) body += '<ul class="notes">' + res.notes.map(n => '<li>' + esc(n) + '</li>').join('') + '</ul>';
      if (res.status === 'notfound' && res.values.install) {
        body += '<p><b>설치 명령</b> (' + esc(D.PLACES[c.place].label) + '에서 실행)</p><div class="cmdline"><span class="prompt" aria-hidden="true">$</span><code>' + esc(res.values.install) + '</code><button type="button" class="lab-copy" data-copy="' + esc(res.values.install) + '">복사</button></div><p class="small">sudo는 비밀번호를 묻는다. 입력하는 동안 화면에 아무것도 표시되지 않는 것이 정상이다. 설치한 뒤 3번의 명령을 다시 실행한다.</p>';
      }
      if (mode === 'real' && (res.status === 'notfound' || res.status === 'unknown')) {
        body += '<p><button type="button" class="minor to-example">' + (res.values && res.values.install ? '설치하지 않고 ' : '') + '이 카드를 \'예시로 연습\'으로 진행</button></p>';
      }
      body += '<p class="no-wrong">이 결과로는 질문에 답할 수 없어 채점하지 않는다. 오답으로 처리하지 않는다.</p></div>';
    }
    return step(9, '출력 읽기', body, 'reading');
  }

  function answersHTML(key, mode) {
    const c = D.CARDS[key], st = S(key, mode);
    if (!st.result || st.result.status !== 'ok') return '';
    const fields = c.questions.map(q => {
      const id = 'q-' + (++uid), v = st.answers[q.key] || '';
      const control = q.choices
        ? '<select id="' + id + '" data-q="' + q.key + '"><option value="">고른다</option>' + q.choices.map(o => '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>'
        : '<input id="' + id + '" data-q="' + q.key + '" value="' + esc(v) + '" placeholder="' + esc(q.placeholder || '') + '" autocomplete="off" spellcheck="false">';
      return '<div class="q"><label for="' + id + '">' + esc(q.label) + '</label>' + control + '</div>';
    }).join('');
    return '<form class="lab-step answers"><h4><b>10</b>질문에 답하기</h4>' + fields + '<button class="primary">채점</button></form>';
  }

  const VERDICT = { ok: '정답이다', wrong: '오답이다. 근거 줄을 다시 확인한다', blank: '미입력이다', skip: '판정 불가 · 채점하지 않는다' };
  function gradeHTML(key, mode) {
    const st = S(key, mode);
    if (!st.graded) return '';
    const g = st.graded;
    const counted = g.filter(x => x.verdict !== 'skip');
    const ok = g.filter(x => x.verdict === 'ok').length;
    const blank = g.filter(x => x.verdict === 'blank').length;
    const skip = g.length - counted.length;
    let body = '<p class="grade-sum" data-all="' + (ok === counted.length && counted.length > 0) + '">' + SOURCE[mode] + ' 기준으로 채점했다. ' + (counted.length ? '채점한 ' + counted.length + '개 중 ' + ok + '개 정답이다.' : '이 출력으로 채점할 수 있는 항목이 없다.') +
      (blank ? ' 미입력 ' + blank + '개.' : '') + (skip ? ' 판정 불가로 채점하지 않은 항목 ' + skip + '개.' : '') + '</p>';
    body += g.map(x => {
      const r = x.rule;
      let h = '<div class="verdict ' + x.verdict + '"><p class="vq">' + esc(x.q.label) + '</p><strong>' + VERDICT[x.verdict] + '</strong>';
      if (x.verdict === 'skip') return h + '<p>' + r.skip + '</p></div>';
      h += '<dl><dt>내 답</dt><dd>' + esc(x.raw || '미입력') + '</dd><dt>이 출력에서의 정답</dt><dd>' + esc(r.show) + '</dd></dl>';
      if (x.note) h += '<p class="small">' + esc(x.note) + '</p>';
      h += '<p class="ev-title">근거가 된 원문 줄</p><pre class="quote">' + esc(r.lines.join('\n')) + '</pre>';
      h += '<p><b>쉬운 해설</b> ' + esc(r.explain) + '</p></div>';
      return h;
    }).join('');
    return step(11, '채점', body, 'grade');
  }

  function afterHTML(key, mode) {
    const c = D.CARDS[key], st = S(key, mode), res = st.result;
    if (!st.graded || !res || res.status !== 'ok') return '';
    if (c.after === 'pick-device') {
      const usable = res.values.usable;
      const chosen = mode === 'real' ? usable.find(u => u.name === env.device) : st.picked;
      const preset = chosen ? chosen.name : (st.answers['br.device'] || '').trim();
      let body = '';
      if (usable.length > 1) {
        body += '<p>IPv4 주소가 붙은 장치가 ' + usable.length + '개다. 다음 명령에서 자세히 볼 장치를 하나 고른다. 보통 VM 네트워크(VMware)에 연결된 장치를 고른다.</p><div class="picks">' +
          usable.map(u => '<label class="pick"><input type="radio" name="pick-' + key + '-' + mode + '" value="' + esc(u.name) + '"' + (preset === u.name ? ' checked' : '') + '> <code>' + esc(u.name) + '</code> · ' + esc(u.ipv4.join(', ')) + '</label>').join('') +
          '</div><button type="button" class="primary pick-apply">이 장치로 점검</button>';
      }
      if (chosen) {
        body += '<p class="picked">점검할 장치: <code>' + esc(chosen.name) + '</code> · IPv4 <code>' + esc(chosen.ipv4[0]) + '/' + chosen.prefix[0] + '</code></p>' +
          (mode === 'real'
            ? '<p>내 환경 정보에 저장했다. 다음 명령 <code>ip addr show dev ' + esc(chosen.name) + '</code>에 자동으로 채운다.</p>'
            : '<p><span class="ex-tag">예시</span> 이 값은 예시라서 내 환경 정보에는 저장하지 않는다.</p>') +
          (c.next ? '<p><a class="next-link" href="#' + pageOf(c.next) + '">다음: ' + esc(D.CARDS[c.next].no) + ' ' + esc(D.CARDS[c.next].title.split(' — ')[0]) + ' →</a></p>' : '');
      }
      return step('✓', '점검할 장치 고르기', body, 'after');
    }
    if (c.after === 'save-address' && st.after) {
      const a = st.after;
      return step('✓', '내 환경 정보', mode === 'real'
        ? '<p>이 출력의 <code>' + esc(a.device) + '</code> · <code>' + esc(a.ipv4) + '/' + a.prefix + '</code>를 내 환경 정보에 저장했다.</p>'
        : '<p><span class="ex-tag">예시</span> 예시 값(' + esc(a.device) + ' · ' + esc(a.ipv4) + '/' + a.prefix + ')이라 내 환경 정보에는 저장하지 않는다.</p>', 'after');
    }
    return '';
  }

  function cardHTML(key) {
    const c = D.CARDS[key], mode = modeOf(key);
    return '<div class="lab-card-head"><span class="card-no">' + esc(c.no) + '</span><h3>' + esc(c.title) + '</h3>' +
      '<div class="mode-switch" role="group" aria-label="실습 방식"><button type="button" data-mode="real" aria-pressed="' + (mode === 'real') + '">실제 터미널 실습</button><button type="button" data-mode="example" aria-pressed="' + (mode === 'example') + '">예시로 연습</button></div>' +
      '<p class="source ' + mode + '" role="status">지금 쓰는 결과: <b>' + SOURCE[mode] + '</b>' + (mode === 'example' ? ' (내 VM의 값이 아님)' : '') + '</p></div>' +
      '<div class="lab-grid">' + guideHTML(key, mode) +
      '<div class="lab-work">' + pasteHTML(key, mode) + '<div class="after-paste">' + readingHTML(key, mode) + answersHTML(key, mode) + gradeHTML(key, mode) + afterHTML(key, mode) + '</div></div></div>';
  }

  // ---------- 동작 ----------
  function readOutput(key, mode) {
    const c = D.CARDS[key], st = S(key, mode);
    st.result = A.analyze(st.text, { expect: c.expect });
    const regrade = st.graded || st.stale;
    st.graded = null; st.stale = false; st.after = null;
    if (mode === 'example' && key === 'ip-br-addr') st.picked = null;
    if (regrade && st.result.status === 'ok' && Object.keys(st.answers).some(k => st.answers[k])) grade(key, mode);
  }

  function norm(type, v) {
    let s = String(v == null ? '' : v).normalize('NFKC').trim().replace(/\s+/g, ' ');
    if (type === 'ip') s = s.replace(/\/\d+$/, '').toLowerCase();
    else if (type === 'prefix') s = s.replace(/^\//, '');
    else if (type === 'text') s = s.toLowerCase();
    return s;
  }

  function grade(key, mode) {
    const c = D.CARDS[key], st = S(key, mode), res = st.result, e = envFor(mode);
    if (!res || res.status !== 'ok') return;
    st.graded = c.questions.map(q => {
      const raw = (st.answers[q.key] || '').trim();
      const rule = D.RULES[q.key](res, { answers: st.answers, env: e });
      if (rule.skip) return { q, verdict: 'skip', raw, rule };
      if (!raw) return { q, verdict: 'blank', raw, rule };
      const ok = rule.accept.some(a => norm(rule.type, a) === norm(rule.type, raw));
      const note = rule.type === 'ip' && /\/\d+$/.test(raw) ? '슬래시(/) 뒤는 접두사 길이라서 빼고 비교했다.' : null;
      return { q, verdict: ok ? 'ok' : 'wrong', raw, rule, note };
    });
    // 채점 뒤 처리: 장치 고르기 / 주소 저장
    if (c.after === 'pick-device') {
      const usable = res.values.usable;
      if (usable.length === 1) choose(key, mode, usable[0], true);
      else if (mode === 'real' && !usable.some(u => u.name === env.device)) {
        // 고르기 전이므로 아무것도 저장하지 않는다
      }
    }
    if (c.after === 'save-address') {
      const t = res.values.target || (e.device && res.values.interfaces.find(i => i.name === e.device)) ||
        (res.values.interfaces.filter(i => !i.loopback).length === 1 ? res.values.interfaces.filter(i => !i.loopback)[0] : null);
      if (t && t.ipv4.length) {
        st.after = { device: t.name, ipv4: t.ipv4[0].address, prefix: t.ipv4[0].prefix };
        if (mode === 'real') setEnv({ device: t.name, ipv4: t.ipv4[0].address, prefix: t.ipv4[0].prefix }, true);
      }
    }
  }

  function choose(key, mode, u, quiet) {
    if (mode === 'real') {
      const res = S(key, mode).result;
      const all = res ? res.values.usable.map(x => x.name) : [];
      env = Object.assign({}, env, { device: u.name, ipv4: u.ipv4[0], prefix: u.prefix[0], interfaces: all, updated: new Date().toISOString() });
      store(STORE.env, env);
    } else {
      S(key, mode).picked = u;
    }
    if (!quiet) refreshAll();
  }

  function render(key) {
    const el = document.querySelector('.lab-card[data-key="' + key + '"]');
    if (el) el.innerHTML = cardHTML(key);
  }
  function refreshAll() {
    Object.keys(D.CARDS).forEach(render);
    renderEnv();
    renderHero();
  }

  function bindCards(root) {
    root.addEventListener('click', e => {
      const card = e.target.closest('.lab-card');
      if (!card) return;
      const key = card.dataset.key, mode = modeOf(key);
      const t = e.target;
      if (t.matches('.mode-switch button')) {
        modes[key] = t.dataset.mode; store(STORE.modes, modes); render(key); syncHeader(); return;
      }
      if (t.matches('.read')) {
        if (mode === 'real') S(key, mode).text = card.querySelector('.paste').value;
        readOutput(key, mode); refreshAll();
        const r = document.querySelector('.lab-card[data-key="' + key + '"] .reading');
        if (r) r.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (t.matches('.clear')) {
        const st = S(key, mode);
        st.text = ''; st.result = null; st.graded = null; st.stale = false; st.after = null;
        render(key); return;
      }
      if (t.matches('.to-example')) { modes[key] = 'example'; store(STORE.modes, modes); render(key); syncHeader(); return; }
      if (t.matches('.pick-apply')) {
        const sel = card.querySelector('.picks input:checked');
        if (!sel) { alert('점검할 장치를 하나 고른다.'); return; }
        const u = S(key, mode).result.values.usable.find(x => x.name === sel.value);
        if (u) choose(key, mode, u);
        return;
      }
      if (t.matches('.dev-apply')) {
        const v = card.querySelector('.dev-input').value.trim();
        if (v) setEnv(deviceOnly(v));
      }
    });
    root.addEventListener('input', e => {
      const card = e.target.closest('.lab-card');
      if (!card) return;
      const key = card.dataset.key, mode = modeOf(key), st = S(key, mode);
      if (e.target.matches('.paste')) {
        st.text = e.target.value;
        if (st.result) {
          st.stale = !!st.graded || st.stale;
          st.result = null; st.graded = null; st.after = null;
          card.querySelector('.after-paste').innerHTML = '';
          card.querySelector('.stale-note').hidden = !st.stale;
        }
      }
      if (e.target.dataset.q) {
        st.answers[e.target.dataset.q] = e.target.value;
        if (st.graded) {
          st.graded = null;
          const g = card.querySelector('.grade'), a = card.querySelector('.after');
          if (g) g.remove();
          if (a) a.remove();
        }
      }
    });
    root.addEventListener('change', e => { if (e.target.matches('.dev-input') && e.target.value.trim()) setEnv(deviceOnly(e.target.value.trim())); });
    root.addEventListener('submit', e => {
      const card = e.target.closest('.lab-card');
      if (!card) return;
      e.preventDefault();
      const key = card.dataset.key, mode = modeOf(key);
      grade(key, mode); refreshAll();
      const g = document.querySelector('.lab-card[data-key="' + key + '"] .grade');
      if (g) g.scrollIntoView({ block: 'nearest' });
    });
  }

  // 장치 이름만 직접 바꾸면 다른 장치의 IP가 남지 않도록 IP를 비운다. 1-2를 채점하면 다시 저장된다.
  function deviceOnly(name) {
    return name === env.device ? { device: name } : { device: name, ipv4: null, prefix: null };
  }

  // ---------- 내 환경 정보 · 머리 그림 ----------
  function renderEnv() {
    const box = by('env-panel');
    if (!box) return;
    const row = (k, v) => '<dt>' + k + '</dt><dd>' + (v ? '<code>' + esc(v) + '</code>' : '<span class="none">아직 모름</span>') + '</dd>';
    box.innerHTML = '<div class="env-title">내 환경 정보</div><dl>' +
      row('고른 장치', env.device) + row('VM IPv4', env.ipv4 ? env.ipv4 + (env.prefix != null ? '/' + env.prefix : '') : '') +
      row('게이트웨이', env.gateway) + (env.interfaces && env.interfaces.length > 1 ? row('IPv4 장치', env.interfaces.join(', ')) : '') +
      '</dl><p class="env-note">내 출력에서 확인한 값만 저장한다. 예시 값은 저장하지 않는다.</p><button type="button" class="minor" id="env-reset">내 환경 정보 초기화</button>';
    by('env-reset').onclick = () => {
      if (confirm('저장한 내 환경 정보(장치 이름, VM IP, 게이트웨이)를 지운다. 계속할까?')) resetEnv();
    };
  }
  function renderHero() {
    const vm = by('hero-vm');
    if (vm) vm.innerHTML = env.ipv4 ? esc(env.device || '') + ' · ' + esc(env.ipv4) : '1-1에서 확인';
  }

  // ---------- 페이지 · 메뉴 ----------
  function pageOf(cardKey) { const p = D.PAGES.find(x => x.cards.indexOf(cardKey) >= 0); return p ? p.id : ''; }

  function build() {
    const menu = by('lab-menu'), pages = by('lab-pages');
    if (!menu || !pages) return;
    let group = null, html = '';
    D.PAGES.forEach(p => {
      if (p.group !== group) { group = p.group; html += '<span class="group">' + esc(group) + '</span>'; }
      const c = D.CARDS[p.cards[0]];
      html += '<a class="navlink lab-link" href="#' + p.id + '"><em>' + esc(c.no) + '</em>' + esc(p.menu) + '</a>';
    });
    menu.innerHTML = html;
    pages.innerHTML = D.PAGES.map(p => '<section class="lab-page" id="' + p.id + '" hidden><div class="heading"><span class="section-no">' + esc(D.CARDS[p.cards[0]].no.split('-')[0]) + '단계</span><h2>' + esc(p.title) + '</h2></div><p class="intro">' + esc(p.intro) + '</p>' +
      p.cards.map(k => '<article class="card lab-card" data-key="' + k + '">' + cardHTML(k) + '</article>').join('') + '</section>').join('');
    bindCards(pages);
    menu.addEventListener('click', e => { const a = e.target.closest('a'); if (a && a.hash === location.hash) route(location.hash, true); });
    pages.addEventListener('click', e => {
      const b = e.target.closest('.lab-copy');
      if (!b) return;
      copyText(b.dataset.copy, b);
    });
    renderEnv(); renderHero();
  }

  async function copyText(text, b) {
    try { await navigator.clipboard.writeText(text); b.textContent = '복사됨'; }
    catch (err) {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove();
      b.textContent = ok ? '복사됨' : 'Ctrl+C로 복사';
    }
    setTimeout(() => { b.textContent = '복사'; }, 1500);
  }

  let current = null;
  function syncHeader() {
    const label = by('mode-label');
    if (!label) return;
    if (!current) { label.textContent = '예전 실습 · 모의 터미널'; return; }
    const p = D.PAGES.find(x => x.id === current);
    const ms = p.cards.map(modeOf);
    label.textContent = ms.every(m => m === 'example') ? '예시로 연습 · 예시 출력 사용 중' : '실제 터미널 실습 · 내 출력 사용 중';
  }

  // app.js의 showPage가 먼저 부른다. 실습 페이지면 true를 돌려준다.
  function route(hash, scroll) {
    const id = (hash || '').replace(/^#/, '');
    const page = id === '' ? D.PAGES[0] : D.PAGES.find(p => p.id === id);
    document.querySelectorAll('.lab-page').forEach(s => { s.hidden = !page || s.id !== page.id; });
    document.querySelectorAll('.lab-link').forEach(a => {
      const on = page && a.hash === '#' + page.id;
      a.classList.toggle('active', !!on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const hero = by('lab-hero');
    if (hero) hero.hidden = !page;
    current = page ? page.id : null;
    syncHeader();
    if (!page) return false;
    const i = D.PAGES.indexOf(page);
    [['prev', D.PAGES[i - 1]], ['next', D.PAGES[i + 1]]].forEach(([id2, p]) => {
      const a = by(id2);
      if (!a) return;
      a.hidden = !p;
      if (p) { a.href = '#' + p.id; a.textContent = id2 === 'prev' ? '‹ ' + p.menu : p.menu + ' ›'; }
    });
    if (scroll) by(page.id).scrollIntoView({ block: 'start' });
    return true;
  }

  window.Lab = { route, getEnv: () => Object.assign({}, env), setEnv, resetEnv };
  build();
})();
