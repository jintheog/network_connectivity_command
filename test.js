// node test.js — 출력 분석 엔진 테스트 (node가 없으면 test.html을 브라우저로 연다)
'use strict';
const fs = require('fs');
const path = require('path');
const A = require('./analyzer.js');
const { runCases } = require('./tests/cases.js');

const read = f => fs.readFileSync(path.join(__dirname, 'samples', f), 'utf8');
const r = runCases(A, { linux: read('samples-linux.txt'), win: read('windows.txt') });
r.results.forEach(x => {
  console.log((x.ok ? 'PASS ' : 'FAIL ') + x.name);
  x.errors.forEach(e => console.log('     - ' + e));
});
console.log('\n' + r.passed + ' / ' + r.total + ' 통과');
process.exit(r.failed ? 1 : 0);
