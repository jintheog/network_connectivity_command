'use strict';
const by = id => document.getElementById(id);
const esc = value => value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const names = [...units.map(u=>u.name),'두 주소 구분하기','포트 연결 판단하기','경로 결과 해석하기','종합 점검 기록'];
const ids = ['local','dns','port','route','activity-a','activity-b','activity-c','report'];
const marks = ['01','02','03','04','A','B','C','✎'];
const solved = new Set();

function commandLine(cmd) {
  return '<div class="cmd"><code>'+esc(cmd)+'</code><button type="button" class="copy" aria-label="명령 복사">복사</button></div>';
}
function terminal(label,output,cmd) {
  return '<div class="console"><div class="bar">'+label+'</div>'+(cmd?commandLine(cmd):'')+'<pre>'+esc(output)+'</pre></div>';
}
function heading(i,title,intro) {
  return '<div class="heading"><span class="section-no">'+marks[i]+'</span><h2>'+title+'</h2></div><p class="intro">'+intro+'</p>';
}
function commandCard(c) {
  const actual = c.cmd.replace(host,'YOUR_VM_DOMAIN').replace(ip,'YOUR_VM_IP');
  const hint = c.cmd.includes(host)?'YOUR_VM_DOMAIN을 자신의 실습 VM에 등록된 도메인으로 바꾼다.':c.cmd.includes(ip)?'YOUR_VM_IP를 자신의 실습 VM IP 주소로 바꾼다.':'대상 주소를 입력할 필요가 없어 명령을 그대로 실행한다.';
  const reveal = c.answer?'<details'+(c.reveal?' open':'')+'><summary>'+(c.reveal||'출력에서 찾은 값 확인')+'</summary><p>'+c.answer+'</p></details>':'';
  return '<div class="card"><h3>'+c.why+'</h3><p>'+c.use+'</p><span class="where">'+c.where+'</span><div class="grid">'+terminal('모의 명령과 예시 출력 · 발췌',c.out,c.cmd)+'<div class="read"><h4>눈여겨볼 줄</h4><p>'+c.look+'</p><h4>결과의 의미</h4><p>'+c.meaning+'</p>'+reveal+'</div></div><details class="real"><summary>실제 VM에서 연습할 명령</summary><p>'+hint+' 실행 위치는 '+c.where+'이다.</p>'+commandLine(actual)+'</details></div>';
}
function lesson(i) {
  const u = units[i];
  return heading(i,u.title,u.intro)+'<div class="tabs">'+u.commands.map((c,j)=>'<button type="button" data-command="'+j+'" aria-pressed="'+(!j)+'">'+c.tab+'</button>').join('')+'</div><div class="cards">'+u.commands.map((c,j)=>'<div '+(j?'hidden':'')+'>'+commandCard(c)+'</div>').join('')+'</div>';
}
const val = id => by(id).value.trim();
function select(id,label,options) {
  return '<label>'+label+'<select id="'+id+'" required><option value="">선택한다</option>'+options.map(([v,t])=>'<option value="'+v+'">'+t+'</option>').join('')+'</select></label>';
}
const tcpCmd = units[2].commands[1].cmd;
const probes = {ping:[units[2].commands[0].cmd,ping],tcp:[tcpCmd,tcp],dns:[units[1].commands[0].cmd,dns]};
function quiz(i,title,intro,body) {
  return heading(i,title,intro)+'<form class="card quiz">'+body+'<div><button class="primary">채점하기</button><button type="reset" class="minor">다시 풀기</button></div><output class="feedback" aria-live="polite"></output></form>';
}
const labA = quiz(4,'두 Address는 각각 누구의 주소일까?','Windows PC의 모의 조회 결과를 읽고 두 주소를 입력한다.','<div class="grid">'+terminal('Windows PowerShell · 모의 출력',dns,'nslookup '+host)+'<div><label>DNS 서버 IP<input id="resolver" required autocomplete="off"></label><label>웹 서버 IP<input id="web" required autocomplete="off"></label></div></div>');
const labB = quiz(5,'ping 응답은 오는데 HTTPS가 열리지 않는다면?','이름 조회에 성공했고 ping 응답도 받았다. 내 Windows PC에서 다음에 실행할 명령을 고르고 결과를 판단한다.',select('probe','내 PC에서 실행할 명령',Object.entries(probes).map(([key,[cmd]])=>[key,cmd]))+'<div id="probeResult" aria-live="polite"></div><div id="interpret" hidden>'+select('fact','출력에서 확인한 사실',[['firewall','방화벽이 443번을 차단했다'],['failed','이 PC에서 TCP 443 연결에 실패했다']])+select('cause','원인을 좁히기 위한 추가 점검',[['done','ping이 성공했으므로 서버 점검을 끝낸다'],['inspect','서버의 수신 주소와 포트, 방화벽 허용 규칙을 확인한다']])+'</div>');
const labC = quiz(6,'중간에 별표가 있어도 목적지까지 갔을까?','응답한 마지막 IP를 명령의 목적지 IP와 비교한다.','<div class="grid">'+terminal('Windows PowerShell · 모의 출력',trace,'tracert -d '+ip)+'<div>'+select('arrival','목적지 도달 여부',[['no','2번 홉에서 멈췄다'],['yes','목적지까지 도달했다']])+select('star','2번 홉의 별표가 뜻하는 것',[['late','해당 시도의 응답을 시간 안에 받지 못했다'],['broken','중간 장비가 고장 났다']])+'</div></div>');
const prompts = ['확인한 사실','아직 모르는 점','다음에 실행할 명령과 실행 위치'];
const answers = ['이 PC에서 web.example.test는 192.0.2.20으로 조회됐다. TCP 443 연결은 실패했고, 경로 추적에서는 4번 홉의 목적지가 응답했다.','세 출력으로는 서버가 어떤 주소에서 연결을 기다리는지, 방화벽이 연결을 막았는지 알 수 없다.','Linux 웹 서버에 로그인해 ss -lnt를 실행한다. Local Address:Port에서 외부 연결을 받을 주소의 443번이 LISTEN 상태인지 확인한다.'];
const report = heading(7,'웹 서버 접속 문의에 어떻게 답할까?','아래 세 출력만을 근거로 Windows PC에서 확인한 사실을 기록한다. 작성한 뒤 모범 답안과 비교한다.')+'<div class="card"><div class="evidence">'+terminal('DNS 조회 · Windows PowerShell',dns,'nslookup '+host)+terminal('TCP 연결 · Windows PowerShell',tcp,tcpCmd)+terminal('경로 추적 · Windows PowerShell',trace,'tracert -d '+ip)+'</div><form id="notes" class="report-form">'+prompts.map(p=>'<label>'+p+'<textarea required></textarea></label>').join('')+'<button class="primary">모범 답안과 비교</button><button type="reset" class="minor">다시 쓰기</button><div id="model" class="model" hidden><h3>모범 답안</h3>'+prompts.map((p,i)=>'<h4>'+p+'</h4><p>'+answers[i]+'</p>').join('')+'</div></form></div>';

const groups = {0:'명령 익히기',4:'학습 확인',7:'학습 정리'};
by('menu').innerHTML = names.map((n,i)=>(groups[i]?'<span class="group">'+groups[i]+'</span>':'')+'<a class="navlink" href="#'+ids[i]+'"><em>'+marks[i]+'</em>'+n+'</a>').join('');
by('pages').innerHTML = [...units.map((_,i)=>lesson(i)),labA,labB,labC,report].map((html,i)=>'<section class="page" id="'+ids[i]+'" hidden>'+html+'</section>').join('');
function showPage(scroll) {
  const active = Math.max(0,ids.indexOf(location.hash.slice(1)));
  document.querySelectorAll('.page').forEach((p,i)=>p.hidden=i!==active);
  document.querySelectorAll('.navlink').forEach((a,i)=>{
    a.classList.toggle('active',i===active);
    if(i===active) a.setAttribute('aria-current','page');
    else a.removeAttribute('aria-current');
  });
  for(const [id,i] of [['prev',active-1],['next',active+1]]) {
    const a=by(id);
    a.hidden=!names[i];
    if(names[i]) {a.href='#'+ids[i]; a.textContent=id==='prev'?'‹ '+names[i]:names[i]+' ›';}
  }
  if(scroll) by(ids[active]).scrollIntoView({block:'start'});
}
showPage(false);
window.addEventListener('hashchange',()=>showPage(true));
document.querySelectorAll('.tabs').forEach(tabs=>tabs.onclick=e=>{
  const button=e.target.closest('button');
  if(!button) return;
  const chosen=Number(button.dataset.command);
  Array.from(tabs.children).forEach((b,i)=>b.setAttribute('aria-pressed',i===chosen));
  Array.from(tabs.nextElementSibling.children).forEach((p,i)=>p.hidden=i!==chosen);
});
document.addEventListener('click',async e=>{
  const b=e.target.closest('.copy');
  if(!b) return;
  const code=b.previousElementSibling;
  try {
    await navigator.clipboard.writeText(code.textContent);
    b.textContent='복사됨';
  } catch {
    const range=document.createRange();
    range.selectNodeContents(code);
    const selection=window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    b.textContent=document.execCommand('copy')?'복사됨':'선택됨 · Ctrl+C';
  }
});
function probeChanged() {
  const choice=val('probe');
  by('probeResult').innerHTML=choice?terminal('Windows PowerShell · 모의 결과',probes[choice][1]):'';
  by('interpret').hidden=choice!=='tcp';
  for(const id of ['fact','cause']) {by(id).disabled=choice!=='tcp';by(id).value='';}
}
by('probe').onchange=probeChanged;
probeChanged();
function grade(id) {
  if(id==='activity-a') {
    if(val('resolver')===ip && val('web')==='10.0.1.53') return [false,'두 주소가 바뀌었다. Server 아래 Address에서 DNS 서버를, Name 아래 Address에서 웹 서버를 찾는다.'];
    const ok=val('resolver')==='10.0.1.53' && val('web')===ip;
    return [ok,ok?'Server 아래의 10.0.1.53이 질의를 받았고 Name 아래의 192.0.2.20이 조회 결과다.':'Server 바로 아래의 주소와 조회한 이름 바로 아래의 주소를 입력란 순서대로 다시 읽는다.'];
  }
  if(id==='activity-b') {
    if(val('probe')!=='tcp') return [false,'선택한 명령은 '+(val('probe')==='ping'?'ICMP 응답':'이름에 해당하는 IP')+'을 확인한다. TCP 포트 번호를 지정하는 명령을 찾아본다.'];
    const ok=val('fact')==='failed' && val('cause')==='inspect';
    return [ok,'TcpTestSucceeded가 False이므로 이 PC에서 443번 연결에 실패했다. 방화벽 차단 여부와 서버 수신 상태는 각각 추가로 확인해야 한다.'];
  }
  return [val('arrival')==='yes' && val('star')==='late','4번 홉의 192.0.2.20은 목적지 주소다. 2번 홉의 별표는 그 시도의 응답 시간 초과를 뜻한다. 이후 홉도 응답했으므로 2번에서 경로가 끊겼다고 단정할 수 없다.'];
}
function updateProgress() {by('score').textContent=solved.size+' / 3';by('meter').value=solved.size;}
document.querySelectorAll('.quiz').forEach(form=>{
  const id=form.parentElement.id, output=form.querySelector('output');
  form.onsubmit=e=>{
    e.preventDefault();
    const [ok,msg]=grade(id);
    output.dataset.ok=ok;
    output.textContent=(ok?'정답이다. ':'다시 살펴본다. ')+msg;
    if(ok) solved.add(id); else solved.delete(id);
    updateProgress();
  };
  const clear=()=>{output.textContent='';solved.delete(id);updateProgress();};
  form.oninput=clear;
  form.onreset=()=>{clear();if(id==='activity-b'){by('probe').value='';probeChanged();}};
});
by('notes').onsubmit=e=>{
  e.preventDefault();
  const blank=Array.from(e.target.querySelectorAll('textarea')).find(a=>!a.value.trim());
  if(blank){blank.setCustomValidity('점검 내용을 입력한다.');blank.reportValidity();return;}
  by('model').hidden=false;
  by('model').scrollIntoView({block:'nearest'});
};
by('notes').oninput=e=>{e.target.setCustomValidity('');by('model').hidden=true;};
by('notes').onreset=()=>{by('model').hidden=true;by('notes').querySelectorAll('textarea').forEach(a=>a.setCustomValidity(''));};
