'use strict';
const $ = (root,selector)=>root.querySelector(selector);
const by = id=>document.getElementById(id);
const esc = value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const records=[];
const activities={dns:'activity-a',tcp:'activity-b',trace:'activity-c'};
const ids=['local','dns','port','route','activity-a','activity-b','activity-c','incident','report'];
const names=[...units.map(u=>u.name),'DNS 조회 실습','TCP 포트 실습','경로 추적 실습','장애 원인 추적','종합 점검 기록'];
const marks=['01','02','03','04','A','B','C','◎','✎'];
const osPrompt={win:'PS C:\\Lab>',client:'client:~$',server:'web:~$'};
const completed=new Set();
function progress(){
  by('score').textContent=completed.size+' / 3';
  by('meter').value=completed.size;
}
function sectionTitle(i,title,intro=''){
  return '<div class="heading"><span class="section-no">'+marks[i]+'</span><h2>'+title+'</h2></div>'+(intro?'<p class="intro">'+intro+'</p>':'');
}
function disclosure(title,html){return '<details><summary>'+title+'</summary>'+html+'</details>';}
function evidence(reading,output){
  const [pattern,why]=reading;
  const quote=output.split('\n').filter(line=>pattern.test(line)).join('\n');
  return '<pre class="quote">'+esc(quote)+'</pre><p>'+esc(why)+'</p>';
}
function fieldSolution(spec,reading,output){
  return '<div class="field-key"><strong>'+esc(spec[0])+'</strong><p>정답 · '+esc(spec[1])+'</p>'+evidence(reading,output)+'</div>';
}
function solution(c,os,output=c.out){
  return '<ol><li>실행 위치는 '+places[os]+'이다.</li><li><code>'+esc(c.cmd)+'</code>를 입력한다.</li><li>'+c.look+'</li><li>'+c.meaning+' '+c.next+'</li></ol>'+c.fields.map((f,i)=>fieldSolution(f,readings[c.key][i],output)).join('');
}
function realCommand(c,os){
  const cmd=c.cmd.replace(host,'YOUR_VM_DOMAIN').replace(ip,'YOUR_VM_IP');
  const help=cmd.includes('YOUR_VM_DOMAIN')?'YOUR_VM_DOMAIN을 자신의 실습 VM 도메인으로 바꾼다.':cmd.includes('YOUR_VM_IP')?'YOUR_VM_IP를 자신의 실습 VM 주소로 바꾼다.':'그대로 입력한다.';
  return disclosure('실제 VM에서 연습할 명령','<p>'+places[os]+'에서 실행한다. '+help+'</p><div class="real cmd"><code>'+cmd+'</code><button type="button" class="copy minor">복사</button></div>');
}
function shell(os){
  return '<div class="console shell" data-os="'+os+'"><div class="bar">모의 터미널 · '+places[os]+'</div><div role="log" aria-label="터미널 기록" class="history"></div><form class="entry"><label><span>'+esc(osPrompt[os])+'</span><input aria-label="'+places[os]+' 명령 입력" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="명령 입력 후 Enter"></label><button>실행</button></form></div>';
}
function bindShell(root,onRun){
  const os=root.dataset.os, form=$(root,'form'),input=$(form,'input'),log=$(root,'.history');
  form.onsubmit=e=>{
    e.preventDefault();
    const raw=input.value.trim();
    const result=raw?simulate(raw,os):{error:'미입력이다. 실행할 명령을 입력한다.'};
    const entry=document.createElement('div');
    entry.className='run';
    const cmd=document.createElement('code'), out=document.createElement('pre');
    cmd.textContent=osPrompt[os]+' '+(raw||'미입력');
    out.textContent=result.error||result.output;
    entry.append(cmd,out);
    if(result.error)entry.classList.add('invalid');
    log.append(entry);
    if(result.key)records.push({root,os,cmd:raw,...result});
    const feedback=onRun(result);
    if(feedback){const note=document.createElement('p');note.textContent=feedback;entry.append(note);}
    log.scrollTop=log.scrollHeight;
    input.value='';input.focus();
    evidenceViews();
  };
}
function clearShell(root){
  $(root,'.history').replaceChildren();$(root,'form').reset();
  for(let i=records.length-1;i>=0;i--)if(records[i].root===root)records.splice(i,1);
}
let fieldId=0;
function field([label,,choices]){
  const id='answer-'+(++fieldId);
  const attrs=' id="'+id+'" aria-describedby="'+id+'-review"';
  const control=choices?'<select'+attrs+'><option value="">선택한다</option>'+choices.map(v=>'<option>'+esc(v)+'</option>').join('')+'</select>':'<input'+attrs+' autocomplete="off" spellcheck="false">';
  return '<div class="answer-field"><label for="'+id+'">'+esc(label)+'</label>'+control+'<div id="'+id+'-review" class="field-review" hidden></div></div>';
}
function normalize(value){
  return value.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
}
function gradeFields(form,fields,rules,output){
  let count=0;
  form.querySelectorAll('.answer-field').forEach((row,i)=>{
    const input=$(row,'input,select');
    const raw=input.value.trim();
    const correct=fields[i][1];
    const rule=rules[i];
    const ok=[correct,...(rule[2]||[])].some(answer=>normalize(answer)===normalize(raw));
    const review=$(row,'.field-review');
    review.hidden=false;
    review.dataset.ok=ok;
    input.setAttribute('aria-invalid',String(!ok));
    review.innerHTML='<strong>'+(ok?'정답이다.':raw?'다시 확인한다.':'미입력이다.')+'</strong><dl><dt>내 답</dt><dd>'+esc(raw||'미입력')+'</dd><dt>정답</dt><dd>'+esc(correct)+'</dd></dl><b>왜 그게 정답인지</b>'+evidence(rule,output);
    if(ok)count++;
  });
  const summary=$(form,'output');
  summary.dataset.ok=count===fields.length;
  summary.textContent=fields.length+'개 항목 중 '+count+'개 정답이다.';
  return count===fields.length;
}
function clearReview(form,input){
  const rows=input?[input.closest('.answer-field')]:form.querySelectorAll('.answer-field');
  for(const row of rows){
    const review=$(row,'.field-review');
    review.replaceChildren();review.hidden=true;
    $(row,'input,select').removeAttribute('aria-invalid');
  }
  const summary=$(form,'output');
  summary.textContent='';delete summary.dataset.ok;
}
function commandGuide(c){
  return places[c.os]+'에서 '+c.cmd+' 명령을 입력한다.';
}
function observation(result,goal){
  const next=commandGuide(goal);
  if(result.error)return next;
  if(result.key==='ping' && ['tcp','nc'].includes(goal.key))return 'ICMP 응답이 왔다. 443번 TCP 연결 여부는 아직 알 수 없다. '+next;
  return catalogue[result.key].meaning+' '+next;
}
function createTask(c,guided,os=c.os){
  const root=document.createElement('div');
  root.className='card exercise';
  root.dataset.task=c.key;
  const activity=!guided && activities[c.key];
  const example=guided?'<div class="example"><small>따라 입력할 명령</small><code>'+esc(c.cmd)+'</code></div>':'';
  root.innerHTML='<div class="grid task-grid"><div class="question"><small class="where">'+(guided?'따라 하기':'혼자 풀기')+'</small><h3>'+c.why+'</h3><p>'+c.goal+'</p>'+example+disclosure('힌트 보기','<p>'+c.look+'</p>')+disclosure('정답·해설 보기',solution(c,os))+'</div>'+shell(os)+'</div><form class="interpret" hidden><h4>출력 해석하기</h4>'+c.fields.map(field).join('')+'<button class="primary">해석 확인</button><output class="feedback" aria-live="polite"></output></form><div class="actions"><button type="button" class="minor reset-task">다시 풀기</button>'+(guided?'<button type="button" class="primary advance" hidden>혼자 풀기 →</button>':'')+'</div>'+realCommand(c,os)+(c.reveal?disclosure(c.reveal,'<p>'+c.answer+'</p>'):'');
  const terminal=$(root,'.shell'), check=$(root,'.interpret'),feedback=$(check,'output'),advance=$(root,'.advance');
  let output=c.out;
  bindShell(terminal,r=>{
    if(r.key!==c.key)return observation(r,c);
    output=r.output;
    $(root,'.question details:nth-of-type(2)').innerHTML='<summary>정답·해설 보기</summary>'+solution(c,os,output);
    check.hidden=false;
    return '명령 수행 성공. '+((r.key==='tcp'||r.key==='nc')?'연결 실패가 관찰됐다. ':'')+'방금 나온 출력을 읽고 아래에서 해석한다.';
  });
  function clearGrade(){
    feedback.textContent='';
    if(advance)advance.hidden=true;
    if(activity){completed.delete(activity);progress();}
  }
  check.oninput=e=>{clearReview(check,e.target);clearGrade();};
  check.onsubmit=e=>{
    e.preventDefault();
    const ok=gradeFields(check,c.fields,readings[c.key],output);
    if(advance)advance.hidden=!ok;
    if(activity){if(ok)completed.add(activity);else completed.delete(activity);progress();}
  };
  $(root,'.reset-task').onclick=()=>{
    clearShell(terminal);check.reset();check.hidden=true;clearReview(check);clearGrade();
    output=c.out;$(root,'.question details:nth-of-type(2)').innerHTML='<summary>정답·해설 보기</summary>'+solution(c,os);
    root.querySelectorAll('details').forEach(d=>d.open=false);evidenceViews();$(terminal,'input').focus();
  };
  return root;
}

const groups={0:'명령 익히기',4:'혼자 풀기',7:'종합 실습'};
by('menu').innerHTML=names.map((n,i)=>(groups[i]?'<span class="group">'+groups[i]+'</span>':'')+'<a class="navlink" href="#'+ids[i]+'"><em>'+marks[i]+'</em>'+n+'</a>').join('');
by('pages').innerHTML=ids.map(id=>'<section class="page" id="'+id+'" hidden></section>').join('');
const unitTabs=[];
for(const [i,u] of units.entries()){
  const page=by(ids[i]);
  page.innerHTML=sectionTitle(i,u.title,u.intro)+'<div class="tabs topics"></div><div class="tasks"></div>';
  const tabs=$(page,'.topics'),panels=$(page,'.tasks');
  const items=exercises.filter(c=>u.commands.some(row=>row.cmd===c.cmd));
  const activate=(j)=>Array.from(tabs.children).forEach((b,k)=>{
    b.setAttribute('aria-pressed',j===k);panels.children[k].hidden=j!==k;
  });
  items.forEach((c,j)=>{
    const button=document.createElement('button');button.textContent=c.name;button.onclick=()=>activate(j);tabs.append(button);
    const panel=document.createElement('div');
    panel.innerHTML='<div class="tabs modes"><button>따라 하기</button><button>혼자 풀기</button></div>';
    const learn=createTask(c,true),solo=createTask(c,false);
    panel.append(learn,solo);panels.append(panel);
    const modes=$(panel,'.modes');
    function mode(independent){
      learn.hidden=independent;solo.hidden=!independent;
      [...modes.children].forEach((b,k)=>b.setAttribute('aria-pressed',k===Number(independent)));
    }
    modes.children[0].onclick=()=>mode(false);modes.children[1].onclick=()=>mode(true);
    $(learn,'.advance').onclick=()=>{mode(true);$(solo,'.entry input').focus();};
    mode(false);
    if(activities[c.key])unitTabs.push({id:activities[c.key],page,open:()=>{activate(j);mode(true);}});
  });
  activate(0);
}
by('port').insertAdjacentHTML('beforeend','<details open class="comparison"><summary>클라이언트와 서버 출력 비교</summary><div id="compare"></div></details>');
function recordBlock(r){
  return '<div class="console"><div class="bar">'+places[r.os]+'</div><pre>'+esc(r.cmd)+'\n'+esc(r.output)+'</pre></div>';
}
function latest(key){return records.findLast(r=>r.key===key);}
function evidenceViews(){
  const pair=['tcp','nc','ss'].map(latest).filter(Boolean);
  by('compare').innerHTML=pair.length?pair.map(recordBlock).join(''):'<p>포트 검사 또는 서버 수신 상태를 실행하면 이곳에 두 위치의 출력이 모인다.</p>';
  const report=by('evidence');
  if(!report)return;
  const items=[['이름 조회',['dns'],'activity-a'],['TCP 연결',['tcp','nc'],'activity-b'],['경로 추적',['trace','traceroute'],'activity-c']];
  report.innerHTML=items.map(([label,keys,id])=>{
    const r=records.findLast(r=>keys.includes(r.key));
    return '<div><h4>'+label+'</h4>'+(r?recordBlock(r):'<a href="#'+id+'">직접 실행해 출력 가져오기 →</a>')+'</div>';
  }).join('');

  by('model').hidden=true;
}

const incident=by('incident');
incident.innerHTML=sectionTitle(7,'장애 원인 추적')+'<div class="card"><div class="grid task-grid"><div class="question"><h3>사용자가 HTTPS 사이트가 열리지 않는다고 문의했다. 어디까지 정상이고 어디서 실패하는지 확인하라.</h3><p>접속할 도메인은 <code>'+host+'</code>이다. 내 PC와 Linux 웹 서버 터미널을 사용할 수 있다.</p><div id="clues"></div></div><div><div class="tabs" id="locations"><button>내 PC</button><button>Linux 웹 서버</button></div>'+shell('win')+shell('server')+'</div></div><form id="diagnosis" hidden><h4>어디까지 확인했을까?</h4>'+field(incidentField)+'<button class="primary">판단 확인</button><output class="feedback" aria-live="polite"></output></form><div class="actions"><button id="restart" class="minor">다시 풀기</button></div></div>';
const found=new Set();
const consoles=[...incident.querySelectorAll('.shell')];
function locationTab(i){
  [...by('locations').children].forEach((b,k)=>{b.setAttribute('aria-pressed',i===k);consoles[k].hidden=i!==k;});
}
[...by('locations').children].forEach((b,k)=>b.onclick=()=>locationTab(k));
function nextIncident(){
  return catalogue[['dns','ping','tcp','ss'].find(key=>!found.has(key))||'ss'];
}
function incidentOutput(key){
  return records.findLast(r=>consoles.includes(r.root) && r.key===key)?.output||catalogue[key].out;
}
function incidentClues(){
  const remaining=['dns','ping','tcp','ss'].find(key=>!found.has(key));
  const hint={
    dns:'접속할 이름이 어느 주소로 해석되는지 확인한다.',
    ping:'목적지 장비가 ICMP 요청에 응답하는지 확인한다.',
    tcp:'내 PC에서 웹 서버의 특정 포트까지 연결되는지 확인한다.',
    ss:'웹 서버 안에서 어떤 TCP 포트가 연결을 기다리는지 확인한다.'
  };
  const c=catalogue[remaining];
  by('clues').innerHTML=disclosure('힌트 보기','<p>'+(c?hint[remaining]:'두 터미널의 출력을 대조하고 확인된 사실을 고른다.')+'</p>')+disclosure('정답·해설 보기',['dns','ping','tcp','ss'].map(key=>solution(catalogue[key],catalogue[key].os,incidentOutput(key))).join('')+fieldSolution(incidentField,incidentReading,incidentOutput('ss')));
  by('diagnosis').hidden=!['dns','tcp','ss'].every(k=>found.has(k));
}
consoles.forEach(t=>bindShell(t,r=>{
  if(!r.key)return commandGuide(t.dataset.os==='server'?catalogue.ss:nextIncident());
  found.add(r.key);
  incidentClues();
  if(r.key==='tcp')return '명령 수행 성공. 이 PC에서 443번 연결 시도가 실패했다. 실패 원인을 좁히려면 서버의 수신 상태를 살핀다. '+commandGuide(catalogue.ss);
  if(r.key==='ping')return observation(r,catalogue.tcp);
  return catalogue[r.key].meaning + (!['dns','tcp','ss'].every(k=>found.has(k))?' '+commandGuide(nextIncident()):'');
}));
const diagnosis=by('diagnosis');
diagnosis.oninput=e=>clearReview(diagnosis,e.target);
diagnosis.onsubmit=e=>{
  e.preventDefault();
  gradeFields(diagnosis,[incidentField],[incidentReading],incidentOutput('ss'));
};
by('restart').onclick=()=>{
  consoles.forEach(clearShell);found.clear();diagnosis.reset();clearReview(diagnosis);
  locationTab(0);incidentClues();evidenceViews();$(consoles[0],'input').focus();
};
locationTab(0);incidentClues();
const reportItems=[
  {label:'확인한 사실',model:'web.example.test는 192.0.2.20으로 조회됐다. 클라이언트의 TCP 443 연결은 실패했다. 경로 추적에서 마지막 홉의 목적지는 응답했다.',criterion:'조회된 IP, 검사한 포트와 연결 결과, 마지막 응답 IP를 각각 출력과 대조한다.'},
  {label:'아직 모르는 점',model:'세 출력만으로는 서버의 수신 상태와 방화벽 차단 여부를 확정할 수 없다.',criterion:'연결 실패라는 관찰과 가능한 원인을 구분했는지 확인한다. 원인을 확정하려면 어떤 근거가 더 필요한지 짚는다.'},
  {label:'다음 명령과 실행 위치',model:'Linux 웹 서버에서 ss -lnt를 실행해 Local Address:Port 열에 443번 수신 소켓이 있는지 살핀다. 이미 실행했다면 80번만 보인 결과를 근거로 웹 서비스의 수신 설정을 점검한다.',criterion:'실행할 장비와 명령, 읽을 줄을 함께 적었는지 확인한다. 다른 점검을 골랐다면 그 결과가 어떤 의문을 풀어 주는지 설명한다.'}
];
function reportComparison(values){
  return reportItems.map((item,i)=>'<section class="report-item"><h4>'+item.label+'</h4><div class="response-pair"><div><b>내 답</b><p>'+esc(values[i].trim()||'미입력')+'</p></div><div><b>모범 답안</b><p>'+item.model+'</p></div></div><p><b>스스로 확인할 기준</b> · '+item.criterion+'</p></section>').join('');
}
const reportKey=reportItems.map(item=>'<h4>'+item.label+'</h4><p>'+item.model+'</p><p>확인 기준 · '+item.criterion+'</p>').join('');
by('report').innerHTML=sectionTitle(8,'웹 서버 접속 문의에 어떻게 답할까?','실습에서 얻은 최근 출력을 보고 세 항목을 작성한다. 모범 답안과 표현이 달라도 각 항목의 기준으로 비교할 수 있다.')+'<div class="card"><div class="evidence" id="evidence"></div>'+disclosure('힌트 보기','<p>각 출력에서 대상 주소와 마지막 결과를 찾는다. 그 줄로 알 수 있는 사실을 적고, 아직 근거가 필요한 원인에 맞춰 다음 명령을 고른다.</p>')+disclosure('정답·해설 보기',reportKey)+'<form id="notes" class="report-form">'+reportItems.map(item=>'<label>'+item.label+'<textarea></textarea></label>').join('')+'<button class="primary" id="compare-model">모범 답안과 비교</button><button class="minor" type="reset">다시 풀기</button><div class="model" id="model" hidden></div></form></div>';
const notes=by('notes');
notes.onsubmit=e=>{
  e.preventDefault();
  by('model').innerHTML=reportComparison([...notes.querySelectorAll('textarea')].map(el=>el.value));
  by('model').hidden=false;
  by('model').scrollIntoView({block:'nearest'});
};
notes.oninput=()=>{by('model').hidden=true;};
notes.onreset=()=>{
  by('model').replaceChildren();by('model').hidden=true;
  by('report').querySelectorAll('details').forEach(d=>d.open=false);
};
evidenceViews();
function showPage(scroll){
  // 새 Linux 실습 페이지(lab.js)면 예전 실습 페이지를 모두 숨긴다.
  if(window.Lab && Lab.route(location.hash,scroll)){
    document.querySelectorAll('.page').forEach(p=>p.hidden=true);
    document.querySelectorAll('#menu .navlink').forEach(a=>{a.classList.remove('active');a.removeAttribute('aria-current');});
    by('legacy-hero').hidden=true;
    return;
  }
  const index=Math.max(0,ids.indexOf(location.hash.slice(1)));
  const shortcut=unitTabs.find(t=>t.id===ids[index]);
  const page=shortcut?shortcut.page:by(ids[index]);
  if(shortcut)shortcut.open();
  document.querySelectorAll('.page').forEach(p=>p.hidden=p!==page);
  document.querySelectorAll('#menu .navlink').forEach((a,k)=>{
    a.classList.toggle('active',k===index);
    if(k===index)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
  });
  for(const [id,k] of [['prev',index-1],['next',index+1]]){
    const a=by(id);a.hidden=!names[k];
    if(names[k]){a.href='#'+ids[k];a.textContent=id==='prev'?'‹ '+names[k]:names[k]+' ›';}
  }
  by('legacy-hero').hidden=ids[index]==='incident';
  if(scroll)page.scrollIntoView({block:'start'});
}
showPage(false);
window.addEventListener('hashchange',()=>showPage(true));
by('menu').addEventListener('click',e=>{const a=e.target.closest('a');if(a && a.hash===location.hash)showPage(true);});
document.addEventListener('click',async e=>{
  const b=e.target.closest('.copy');if(!b)return;
  const code=b.previousElementSibling;
  try{await navigator.clipboard.writeText(code.textContent);b.textContent='복사됨';}
  catch{const range=document.createRange();range.selectNodeContents(code);const sel=getSelection();sel.removeAllRanges();sel.addRange(range);b.textContent=document.execCommand('copy')?'복사됨':'선택됨 · Ctrl+C';}
});
