'use strict';
// Keys follow the existing lesson order. Each check is answered from a fresh terminal run.
const exercises = [
  {key:'config', os:'win', name:'Windows 주소', goal:'내 PC의 인터페이스, IPv4 주소, 기본 게이트웨이를 찾는다.', fields:[['인터페이스 이름','Ethernet'],['내 IPv4 주소','10.0.1.10'],['기본 게이트웨이','10.0.1.1']], next:'기본 게이트웨이와 경로 추적에서 처음 응답한 주소를 비교한다.'},
  {key:'addr', os:'client', name:'Linux 주소', goal:'클라이언트 VM에서 인터페이스 이름과 IPv4 주소를 찾는다.', fields:[['인터페이스 이름','eth0'],['내 IPv4 주소 (/24 생략 가능)','10.0.1.11']], next:'이 인터페이스를 통해 사용할 경로를 확인한다.'},
  {key:'route', os:'client', name:'Linux 경로', goal:'클라이언트 VM에서 기본 게이트웨이와 웹 서버 전용 경로의 다음 장비를 찾는다.', fields:[['기본 게이트웨이','10.0.1.1'],['웹 서버로 갈 때 거치는 다음 장비','10.0.1.254']], next:'웹 서버용 경로의 dev와 내 인터페이스 이름을 비교한다.'},
  {key:'dns', os:'win', name:'이름 조회', goal:'web.example.test를 조회하고 응답에서 두 장비의 주소를 구분한다.', fields:[['DNS 서버 IP','10.0.1.53'],['웹 서버 IP',ip]], next:'조회된 주소가 목적지인지 확인하고 그 주소의 서비스 포트를 검사한다.'},
  {key:'ping', os:'win', name:'ICMP 응답', goal:'내 PC에서 192.0.2.20이 ICMP 요청에 응답하는지 확인한다.', fields:[['확인한 응답 종류','ICMP',['HTTPS','ICMP','TCP']]],next:'웹 서비스가 쓰는 443번 TCP 포트까지 연결을 검사한다.'},
  {key:'tcp', os:'win', name:'Windows 포트', goal:'이름 조회가 되고 ping 응답도 오지만 HTTPS 사이트가 열리지 않는다. 내 PC에서 web.example.test의 443번 TCP 포트까지 연결할 수 있는지 확인한다.', fields:[['확인된 사실','이 PC에서 TCP 443 연결에 실패했다',['방화벽이 차단했다','이 PC에서 TCP 443 연결에 실패했다','웹 페이지가 정상이다']],['아직 모르는 원인','서버의 수신 상태와 방화벽 차단 여부',['서버의 수신 상태와 방화벽 차단 여부','DNS 이름의 존재 여부']]], next:'웹 서버의 수신 주소와 포트를 확인하고 방화벽은 규칙과 로그로 따로 점검한다.'},
  {key:'nc', os:'client', name:'Linux 포트', goal:'클라이언트 VM에서 192.0.2.20의 TCP 443 연결을 검사한다.', fields:[['클라이언트에서 관찰한 결과','연결 거부',['연결 성공','연결 거부']]],next:'웹 서버 터미널로 이동해 수신 중인 TCP 포트를 확인한다.'},
  {key:'ss', os:'server', name:'서버 수신 상태', goal:'웹 서버에서 연결을 기다리는 TCP 포트를 확인한다.', fields:[['목록에서 LISTEN 상태인 포트 번호','80'],['443번 수신 소켓','목록에 없다',['목록에 있다','목록에 없다']]],next:'웹 서비스의 수신 포트와 시작 상태를 점검한다.'},
  {key:'trace', os:'win', name:'Windows 경로', goal:'내 PC에서 192.0.2.20까지 경로를 추적하고 중간 장비와 목적지의 응답을 읽는다.'},
  {key:'traceroute', os:'client', name:'Linux 경로', goal:'클라이언트 VM에서 192.0.2.20까지 경로를 추적하고 별표가 나온 줄을 해석한다.'}
];
const traceFields = [['목적지 도달 여부','마지막 홉에서 목적지가 응답했다',['마지막 홉에서 목적지가 응답했다','중간 홉에서 경로가 끊겼다']],['별표의 의미','제한 시간 안에 응답이 없었다',['장비가 고장 났다','제한 시간 안에 응답이 없었다']]];
const catalogue = Object.fromEntries(exercises.map((x,i)=>{
  Object.assign(x,units.flatMap(u=>u.commands)[i]);
  if(!x.fields){x.fields=traceFields;x.next='목적지의 응답을 TCP 포트 검사 결과와 비교한다.';}
  return [x.key,x];
}));
// Each field pairs its accepted value with a reading of the corresponding output.
const readings = {
  config:[
    [/Ethernet adapter/, 'adapter 다음에 나오는 Ethernet이 이 연결의 이름이다.', ['이더넷','Ethernet adapter Ethernet:']],
    [/IPv4 Address/, 'IPv4 Address 줄에서 콜론 오른쪽이 PC에 설정된 주소다.'],
    [/Default Gateway/, 'Default Gateway 오른쪽의 값이 다른 네트워크로 보낼 때 사용하는 기본 게이트웨이다.']
  ],
  addr:[
    [/^2: /, '장치 번호 2 다음, 두 번째 콜론 앞에 인터페이스 이름 eth0이 있다.'],
    [/inet /, 'inet 다음의 IPv4 주소를 읽는다. /24는 네트워크 부분의 길이다.', ['10.0.1.11/24']]
  ],
  route:[
    [/^default /, 'default로 시작하는 줄에서 via 다음 주소를 읽는다.'],
    [/^192\.0\.2\.0\/24 /, '웹 서버 192.0.2.20이 속한 범위의 줄에서 via 다음 주소를 읽는다.']
  ],
  dns:[
    [/^Server:|^Address:\s*10\.0\.1\.53/, 'Server 바로 아래 Address는 질의를 받은 DNS 서버의 주소다.', ['10.0.1.53#53','10.0.1.53:53']],
    [/^Name:|^Address:\s*192\.0\.2\.20/, 'Name 아래 Address는 조회한 이름에 대응하는 웹 서버 주소다.']
  ],
  ping:[[/Reply from|bytes from/, 'ping은 ICMP 요청을 보낸다. 상대 주소에서 응답이 돌아왔으므로 확인한 것은 ICMP 응답이다. HTTPS 연결에는 별도 검사가 필요하다.']],
  tcp:[
    [/RemotePort|TcpTestSucceeded/, 'RemotePort가 443이고 성공 여부가 False다. 이 PC에서 그 포트까지 TCP 연결을 맺지 못했다.'],
    [/RemoteAddress|TcpTestSucceeded/, '목적지 IP를 얻고 연결을 시도했지만 False는 실패 원인을 표시하지 않는다. 서버 수신 목록과 방화벽 규칙은 따로 확인한다.']
  ],
  nc:[[/Connection refused/, 'Connection refused는 접속 시도가 거부됐다는 뜻이다.']],
  ss:[
    [/^LISTEN/, 'LISTEN 줄의 로컬 주소 0.0.0.0:80에서 콜론 오른쪽 숫자가 수신 포트다.', ['80번','80번 포트','TCP 80','80/tcp','포트 80']],
    [/^State|^LISTEN/, '수신 목록의 로컬 포트는 80 하나다. 443번에서 기다리는 소켓은 목록에 없다.']
  ],
  trace:[
    [/^\s*4\s/, '마지막 홉에서 응답한 IP가 명령의 목적지 192.0.2.20과 같다.'],
    [/^\s*2\s|^\s*3\s/, '2번 홉의 별표는 각 시도의 응답 시간 초과다. 이후 3번 홉이 응답했으므로 별표로 장비 고장을 확정할 수 없다.']
  ]
};
readings.traceroute=readings.trace;
const incidentField=['서버 출력으로 확인한 사실','현재 이 서버에 443번 TCP 연결을 기다리는 소켓이 없다',['방화벽이 원인이다','현재 이 서버에 443번 TCP 연결을 기다리는 소켓이 없다','웹 서버가 꺼져 있다']];
const incidentReading=[/^State|^LISTEN/, '서버가 출력한 수신 목록에는 80번만 있다. 이 목록은 443번 수신 소켓이 없다는 근거다. 방화벽 원인을 판단하려면 규칙이나 로그가 더 필요하다.'];
const places = {win,client:linux,server};
const available = {win:['config','dns','ping','tcp','trace'],client:['addr','route','dns','ping','nc','traceroute'],server:['ss']};
const usage = {dns:'nslookup 도메인',ping:'ping 대상',tcp:'Test-NetConnection 대상 -Port 포트번호',nc:'nc -vz 대상 포트번호',trace:'tracert -d 대상',traceroute:'traceroute -n 대상'};
function simulate(raw,os) {
  const words=raw.trim().split(/\s+/);
  const name=os==='win'?words[0].toLowerCase():words[0];
  const args=words.slice(1);
  const fail=msg=>({error:msg});
  const commands={ipconfig:'config',nslookup:'dns',ping:'ping','test-netconnection':'tcp',tnc:'tcp',nc:'nc',ss:'ss',tracert:'trace',traceroute:'traceroute'};
  let key=Object.hasOwn(commands,name)?commands[name]:null;
  if(name==='ip') {
    if(os==='win') return fail('ip는 Linux 명령이다. 클라이언트 VM 터미널에서 실행한다.');
    key={addr:'addr',a:'addr',route:'route',r:'route'}[args[0]];
    if(!['route','addr'].includes(key)) return fail('ip 다음의 하위 명령 철자를 확인한다. 주소는 addr, 경로는 route를 쓴다.');
  }
  if(!key) {
    if(name.toLowerCase()==='test-netconnection') return fail('Test-NetConnection은 내 PC의 Windows PowerShell에서 실행한다.');
    return fail('첫 단어의 명령 이름을 확인한다. 막히면 힌트나 정답·해설을 열 수 있다.');
  }
  if(!available[os].includes(key)) return fail('이 실습에서 해당 명령의 실행 위치는 '+places[catalogue[key].os]+'이다.');
  const c=catalogue[key];
  let target, port;
  const badArgs=()=>fail('인수의 순서와 옵션을 확인한다. 형식은 '+(usage[key]||c.cmd)+'이다.');
  switch(key){
    case 'config': if(args.length) return badArgs(); break;
    case 'addr': case 'route': if(args.length!==1) return badArgs(); break;
    case 'dns': case 'ping': if(args.length!==1) return badArgs(); [target]=args; break;
    case 'tcp':
      for(let i=0;i<args.length;i++){
        const token=args[i].toLowerCase();
        if(token==='-port' && port===undefined && i+1<args.length)port=args[++i];
        else if(token==='-computername' && !target && i+1<args.length)target=args[++i];
        else if(!args[i].startsWith('-') && !target)target=args[i];
        else return badArgs();
      }
      if(!target || port===undefined)return badArgs();
      break;
    case 'nc': {
      const flags=args.slice(0,-2);
      if(!['-vz','-zv','-v -z','-z -v'].includes(flags.join(' '))) return badArgs();
      [target,port]=args.slice(-2);break;
    }
    case 'ss':
      if(!args.every(x=>/^-[lnt]+$/.test(x)) || [...new Set(args.join('').replaceAll('-',''))].sort().join('')!=='lnt') return badArgs();
      break;
    case 'trace': case 'traceroute':
      if(args.length!==1 && !(args.length===2 && args[0]===(key==='trace'?'-d':'-n'))) return badArgs();
      target=args.at(-1);break;
  }
  if(target){
    target=target.toLowerCase().replace(/\.$/,'');
    if(key==='dns' && target!==host) return fail('조회 대상에는 웹 서버 도메인 '+host+'을 입력한다.');
    if(target!==ip && target!==host) return fail('대상 주소를 확인한다. 이 실습의 웹 서버는 '+host+'이다.');
  }
  if(port!==undefined && port!=='443') return fail('포트 번호를 확인한다. 이 문제의 HTTPS 포트는 443이다.');
  let output=c.out;
  if(key==='tcp') output=output.replace(host,target);
  if(key==='dns' && os==='client') output=output.replace('10.0.1.53','10.0.1.53#53');
  if(key==='ping' && os==='client') output='64 bytes from '+ip+': icmp_seq=1 ttl=61 time=8.0 ms';
  return {key,output};
}
