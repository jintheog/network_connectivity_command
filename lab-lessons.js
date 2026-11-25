/*
 * lab-lessons.js — 실제 터미널 실습의 레슨·문제·채점 규칙 (SPEC 1·2·3장)
 *
 * 화면 코드(lab.js)는 이 데이터를 key로 찾는다. 배열 순서에 기대지 않는다.
 *   PLACES[key]   실행 위치
 *   CARDS[key]    실습 카드 (질문 → 위치 → 명령 → 뜻 → 바꿀 값 → 끝 → 복사 범위 → 붙여넣기 → 읽기 → 답하기 → 채점)
 *   RULES[key]    채점 규칙. analyzer.js가 돌려준 결과(values)만 사용하고, 출력 글자를 직접 해석하지 않는다.
 *   PAGES         메뉴와 페이지 (카드 key 목록)
 *
 * 예시 출력의 값(ens160, 192.168.10.130)은 '예시로 연습'에만 쓴다. 학습자의 실제 값은 붙여 넣은 출력에서 얻는다.
 */
(function (root) {
  'use strict';

  const PLACES = {
    'ssh-vm': {
      label: 'PowerShell 창이지만 SSH로 접속한 CentOS Stream VM 안',
      kind: 'linux',
      detail: [
        'Windows PowerShell에서 <code>ssh 사용자이름@VM주소</code>로 VM에 접속한 창에서 실행한다. 창은 Windows의 PowerShell이지만, 명령은 VM 안에서 실행되고 결과도 VM의 정보다.',
        '프롬프트가 <code>[jin@localhost ~]$</code>나 <code>jin@localhost:~$</code>처럼 <code>$</code>로 끝나면 VM 안이다. <code>PS C:\\...&gt;</code>로 보이면 아직 Windows이므로 먼저 SSH로 접속한다.',
        'SSH 접속이 아직 안 된다면 VMware 화면 안의 VM 터미널에서 실행해도 결과는 같다. 다만 VMware 화면에서는 Windows로 복사가 안 될 수 있다. 그때는 이 카드를 \'예시로 연습\'으로 진행한다.',
      ],
      prompt: '$',
    },
    windows: {
      label: 'SSH에 접속하기 전, Windows PC의 PowerShell',
      kind: 'windows',
      detail: ['시작 메뉴에서 PowerShell을 검색해 연다. 프롬프트가 <code>PS C:\\...&gt;</code>로 보여야 한다. SSH로 VM에 접속한 창이라면 <code>exit</code>로 접속을 끝낸 뒤 실행한다.'],
      prompt: 'PS C:\\>',
    },
    'vm-console': {
      label: 'VMware 화면 안의 VM 터미널',
      kind: 'linux',
      detail: ['VMware에서 VM을 켜고 로그인한 화면에서 실행한다. Windows로 복사가 안 될 수 있다.'],
      prompt: '$',
    },
  };

  // ===== 예시 출력 ('예시로 연습'에서만 쓴다) =====
  const EXAMPLE_ENV = { device: 'ens160', ipv4: '192.168.10.130', prefix: 24 };
  const EX_BR =
    '[jin@localhost ~]$ ip -br addr\n' +
    'lo               UNKNOWN        127.0.0.1/8 ::1/128\n' +
    'ens160           UP             192.168.10.130/24 fe80::20c:29ff:fe3a:5b1c/64';
  const EX_ADDR =
    '[jin@localhost ~]$ ip addr show dev ens160\n' +
    '2: ens160: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP group default qlen 1000\n' +
    '    link/ether 00:0c:29:3a:5b:1c brd ff:ff:ff:ff:ff:ff\n' +
    '    altname enp3s0\n' +
    '    inet 192.168.10.130/24 brd 192.168.10.255 scope global dynamic noprefixroute ens160\n' +
    '       valid_lft 1650sec preferred_lft 1650sec\n' +
    '    inet6 fe80::20c:29ff:fe3a:5b1c/64 scope link noprefixroute\n' +
    '       valid_lft forever preferred_lft forever';

  const CARDS = {
    'ip-br-addr': {
      no: '1-1',
      title: 'ip -br addr — 이 VM의 장치와 IPv4 주소 찾기',
      question: '이 VM은 어떤 네트워크 장치(인터페이스)를 가지고 있고, 그 장치에 붙은 IPv4 주소는 무엇인가?',
      place: 'ssh-vm',
      command: () => 'ip -br addr',
      lead: '0단계에서 SSH로 VM에 접속한 PowerShell 창에서 <code>ip -br addr</code>를 입력한 뒤 Enter를 누른다.',
      parts: [
        ['ip', '리눅스의 네트워크 설정을 보고 바꾸는 명령이다.'],
        ['-br', 'brief(짧게)를 줄인 옵션이다. 결과를 한 장치당 한 줄로 짧게 보여준다.'],
        ['addr', 'address(주소)를 줄인 말이다. 장치에 붙은 주소를 보여 달라는 뜻이다.'],
      ],
      values: () => '바꿀 값이 없다. 그대로 입력한다.',
      ends: '결과를 보여주고 바로 끝난다. 프롬프트(<code>$</code>로 끝나는 줄)가 다시 나타나면 끝난 것이다.',
      copy: {
        from: '첫 번째 장치 줄. 보통 <code>lo</code>로 시작한다.',
        to: '마지막 장치 줄. 출력에는 <code>lo</code>와 <code>ens160</code> 같은 이름이 보일 수 있다. 장치가 더 있으면 그 줄까지 모두 복사한다.',
        extra: '명령 줄과 프롬프트 줄이 함께 복사되어도 괜찮다. 앱이 알아서 빼고 읽는다.',
        fail: '<code>command not found</code> 같은 오류가 나오면 오류 줄부터 프롬프트가 다시 나오기 전 줄까지 복사한다.',
      },
      pasteLabel: '내 Linux 출력',
      expect: 'ip-br-addr',
      example: { output: EX_BR, note: '아래 값(ens160, 192.168.10.130)은 예시다. 내 VM의 값과 다르다.' },
      reading: [
        '한 줄이 네트워크 장치 하나다. 이 장치를 인터페이스라고 한다. 인터페이스는 컴퓨터가 네트워크에 연결되는 통로다.',
        '첫 칸은 장치 이름, 둘째 칸은 상태, 그 뒤는 그 장치에 붙은 주소다. <code>UP</code>은 장치가 켜져 있다는 뜻이다.',
        '<code>lo</code>는 이 컴퓨터가 자기 자신과 통신할 때 쓰는 인터페이스다. 점검 대상이 아니다.',
        '주소에서 슬래시(/) 앞이 주소이고, 뒤의 숫자는 접두사 길이다. 점 네 덩어리(예: 192.168.10.130)는 IPv4, 콜론이 섞인 값(예: fe80::…)은 IPv6 주소다.',
      ],
      questions: [
        { key: 'br.device', label: 'lo가 아닌 장치 가운데 IPv4 주소가 붙은 장치의 이름은 무엇인가?', placeholder: '장치 이름' },
        { key: 'br.ipv4', label: '그 장치의 IPv4 주소는 무엇인가? (슬래시 앞부분만)', placeholder: 'IPv4 주소' },
      ],
      after: 'pick-device',
      next: 'ip-addr-dev',
    },

    'ip-addr-dev': {
      no: '1-2',
      title: 'ip addr show dev — 고른 장치의 inet과 inet6 읽기',
      question: '1-1에서 고른 장치에는 어떤 IPv4 주소가 붙어 있고, 접두사 길이는 얼마인가? inet 줄과 inet6 줄은 무엇이 다른가?',
      place: 'ssh-vm',
      command: env => 'ip addr show dev ' + (env.device || '장치이름'),
      needs: env => (env.device ? null : '장치이름'),
      lead: '1-1과 같은 창(SSH로 VM에 접속한 PowerShell 창)에서 아래 명령을 입력하고 Enter를 누른다.',
      parts: [
        ['ip addr', '장치에 붙은 주소를 자세히 보여준다. <code>-br</code>이 없으므로 한 장치에 여러 줄이 나온다.'],
        ['show', '보여 달라는 뜻이다.'],
        ['dev 장치이름', 'device(장치)의 줄임말이다. 뒤에 쓴 장치 하나의 정보만 보여준다.'],
      ],
      values: env => env.device
        ? '<code>' + env.device + '</code>는 1-1에서 고른 장치 이름이다. 자동으로 채웠다. 다른 장치를 보려면 아래 칸에서 바꾼다.'
        : '<code>장치이름</code> 자리에 1-1의 <code>ip -br addr</code>에서 확인한 장치 이름(예: <code>ens160</code>)을 넣는다. 1-1에서 장치를 고르면 자동으로 채워진다.',
      editDevice: true,
      ends: '결과를 보여주고 바로 끝난다. 프롬프트가 다시 나타나면 끝난 것이다.',
      copy: {
        from: '<code>2: 장치이름: &lt;...&gt;</code>처럼 번호로 시작하는 첫 줄.',
        to: '마지막 <code>valid_lft ...</code> 줄.',
        extra: '명령 줄과 프롬프트 줄이 함께 복사되어도 괜찮다. 명령 줄까지 복사하면 어느 장치의 출력인지 앱이 더 확실히 알 수 있다.',
        fail: '<code>Device "..." does not exist.</code>가 나오면 그 한 줄을 복사한다. 장치 이름의 철자를 1-1의 출력과 비교한다.',
      },
      pasteLabel: '내 Linux 출력',
      expect: 'ip-addr',
      example: { output: EX_ADDR, note: '아래 값(ens160, 192.168.10.130)은 예시다. 내 VM의 값과 다르다.' },
      reading: [
        '첫 줄은 장치 번호, 장치 이름, 꺾쇠(&lt; &gt;) 안의 상태 표시다. <code>state UP</code>은 장치가 켜져 있다는 뜻이다.',
        '<code>link/ether</code> 뒤의 값은 이 장치의 하드웨어 주소(MAC 주소)다.',
        '<code>inet</code>으로 시작하는 줄은 IPv4 주소 줄이다. <code>inet 192.168.10.130/24</code>에서 슬래시 앞이 IPv4 주소, 뒤의 24가 접두사 길이다. 접두사 길이는 주소의 앞에서부터 몇 비트까지가 같은 네트워크를 나타내는지 알려준다.',
        '<code>inet6</code>으로 시작하는 줄은 IPv6 주소 줄이다. <code>valid_lft</code> 줄은 그 주소를 얼마나 더 쓸 수 있는지 보여준다.',
      ],
      questions: [
        { key: 'addr.ipv4', label: 'inet 줄에 있는 IPv4 주소는 무엇인가? (슬래시 앞부분만)', placeholder: 'IPv4 주소' },
        { key: 'addr.prefix', label: '그 IPv4 주소의 접두사 길이는 얼마인가? (슬래시 뒤 숫자)', placeholder: '숫자' },
        { key: 'addr.inet6', label: 'inet6 줄에 있는 주소는 어떤 종류의 주소인가?', choices: ['IPv4 주소', 'IPv6 주소'] },
      ],
      after: 'save-address',
      next: 'ip-route',
    },
  };

  // ===== 0단계 · 실습 환경 준비 (SPEC 13장 [원고]) =====
  // setup 카드는 '출력을 눈으로 보고 확인 질문에 답하기'가 기본이고, 붙여넣기는 선택이다.
  //   ask[]        확인 질문 (type: text / choice / check). rule이 있으면 붙여 넣은 출력으로 정답을 확인한다.
  //   fixes[]      원고의 '이렇게 나오면' [key, 내용]
  //   check(ctx)   { state: ready | problem | unknown | blank, fix, why, save }
  //                ctx = { answers, result(붙여 넣은 출력의 분석 결과 또는 null), env }
  PLACES['win-ps'] = {
    label: 'Windows PC의 PowerShell',
    kind: 'windows',
    detail: ['시작 메뉴에서 PowerShell을 검색해 연다. VM 터미널이 아니다.'],
    prompt: 'PS C:\\>',
  };
  const isV4 = s => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(s) && s.split('.').every(n => +n <= 255);
  const ans = (ctx, k) => String(ctx.answers[k] || '').trim();
  const analyzer = () => root.NetAnalyzer;
  // 붙여 넣은 출력이 있지만 읽을 수 없는 경우(다른 명령, 일부 누락, 알아볼 수 없음)
  const unreadable = res => ({ state: 'unknown', why: res.message + (res.recopy ? ' ' + res.recopy : '') });

  // ----- 0-1 -----
  CARDS['setup-os'] = {
    setup: true,
    no: '0-1',
    title: '어떤 리눅스가 설치되어 있는가? — cat /etc/os-release',
    question: '이 VM에 설치된 리눅스의 이름과 버전은 무엇인가?',
    place: 'vm-console',
    command: () => 'cat /etc/os-release',
    lead: 'VMware 화면 안의 VM 터미널에서 프롬프트 뒤에 아래 명령을 입력하고 Enter를 누른다.',
    parts: [
      ['cat', '파일의 내용을 화면에 그대로 보여주는 명령이다.'],
      ['/etc/os-release', '리눅스가 자기 이름과 버전을 적어 두는 파일이다. /etc는 시스템 설정 파일이 모여 있는 폴더다.'],
    ],
    values: () => '바꿀 값이 없다. 그대로 입력한다.',
    ends: '파일 내용을 보여주고 바로 끝난다. 프롬프트가 다시 나타나면 끝난 것이다.',
    example: {
      title: '출력 예시 (실제로는 줄이 더 많다)',
      shown: 'NAME="CentOS Stream"\nVERSION="10 (Coughlan)"\nID_LIKE="rhel fedora"\nVERSION_ID="10"\nPRETTY_NAME="CentOS Stream 10 (Coughlan)"',
      output: '[jin@localhost ~]$ cat /etc/os-release\nNAME="CentOS Stream"\nVERSION="10 (Coughlan)"\nID_LIKE="rhel fedora"\nVERSION_ID="10"\nPRETTY_NAME="CentOS Stream 10 (Coughlan)"',
      note: '아래 출력은 예시다. 내 VM의 출력과 다를 수 있다.',
    },
    reading: [
      'PRETTY_NAME은 사람이 읽기 쉬운 형태의 OS 이름이다. 이 줄 하나로 무엇이 설치되어 있는지 알 수 있다.',
      'VERSION_ID는 버전 번호다.',
      'ID_LIKE="rhel fedora"는 이 리눅스가 Red Hat Enterprise Linux(RHEL) 계열이라는 뜻이다. RHEL 계열은 명령과 설정 방식이 거의 같다. 그래서 이 교재의 명령은 CentOS Stream, Rocky Linux, AlmaLinux에서 똑같이 쓸 수 있다.',
    ],
    fixes: [
      ['ok', 'CentOS Stream 9 또는 10, Rocky Linux 9 또는 10: 그대로 진행한다.'],
      ['eol', 'CentOS Linux 7, CentOS Linux 8, CentOS Stream 8: 지원이 끝난 버전이다. 프로그램을 설치하는 0-3에서 실패할 수 있다. 새 버전으로 VM을 다시 만드는 것을 권한다.'],
      ['nofile', 'No such file or directory: 파일 이름의 철자를 확인한다. os-release는 하이픈(-)으로 이어진 한 단어다.'],
    ],
    ask: [
      { key: 'os.pretty', type: 'text', label: '확인 질문: 내 VM의 PRETTY_NAME은 무엇인가?', placeholder: '따옴표 안의 값', rule: 'os.pretty' },
      { key: 'os.nofile', type: 'check', label: 'PRETTY_NAME 대신 No such file or directory가 나왔다' },
    ],
    expect: 'os-release',
    pasteLabel: 'VM 터미널 출력 (선택)',
    check(ctx) {
      const res = ctx.result;
      const bySupport = (support, name) => support === 'supported' ? { state: 'ready', fix: 'ok', why: name + ': 이 교재의 명령을 그대로 쓸 수 있다.' }
        : support === 'eol' ? { state: 'problem', fix: 'eol', why: name + '은(는) 지원이 끝난 버전이다.' }
        : support === 'unlisted' ? { state: 'unknown', why: name + '은(는) RHEL 계열이지만 원고의 목록(9 또는 10)에 없는 버전이다. 이 교재는 9·10 기준이다.' }
        : { state: 'unknown', why: '"' + name + '"을(를) CentOS Stream, Rocky Linux, AlmaLinux 같은 RHEL 계열 이름으로 알아보지 못했다. PRETTY_NAME 줄의 따옴표 안 값을 그대로 적었는지 확인한다.' };
      if (res) {
        if (res.status === 'ok') return bySupport(res.values.support, res.values.prettyName);
        if (res.status === 'fail' && res.outcome === 'no-file') return { state: 'problem', fix: 'nofile', why: res.message };
        return unreadable(res);
      }
      if (ans(ctx, 'os.nofile')) return { state: 'problem', fix: 'nofile', why: 'No such file or directory가 나왔다.' };
      const name = ans(ctx, 'os.pretty');
      if (!name) return { state: 'blank' };
      return bySupport(analyzer().classifyOs(name).support, name);
    },
  };

  // ----- 0-2 (1)(2)(3) -----
  const SETUP_NET_PLACE = 'vm-console';
  CARDS['setup-ip'] = {
    setup: true,
    no: '0-2 (1)',
    title: 'VM이 IP 주소를 받았는가? — ip -br addr',
    question: 'VM이 IP 주소를 받았는가?',
    place: SETUP_NET_PLACE,
    command: () => 'ip -br addr',
    lead: '세 명령을 하나씩 입력한다. 결과를 확인한 뒤 다음 명령으로 넘어간다. 먼저 아래 명령을 입력하고 Enter를 누른다.',
    parts: [
      ['ip', '리눅스의 네트워크 설정을 보고 바꾸는 명령이다.'],
      ['addr', 'address(주소)를 줄인 말이다. 주소 정보를 보여 달라는 뜻이다.'],
      ['-br', 'brief(짧게)를 줄인 옵션이다. 장치 하나당 한 줄로 요약해서 보여준다.'],
    ],
    values: () => '바꿀 값이 없다. 그대로 입력한다.',
    ends: '결과를 보여주고 바로 끝난다.',
    example: {
      title: '출력 예시',
      shown: 'lo               UNKNOWN        127.0.0.1/8 ::1/128\nens160           UP             172.16.89.128/24 fe80::20c:29ff:fe8f:fd2d/64',
      output: '[jin@localhost ~]$ ip -br addr\nlo               UNKNOWN        127.0.0.1/8 ::1/128\nens160           UP             172.16.89.128/24 fe80::20c:29ff:fe8f:fd2d/64',
      note: '아래 값(ens160, 172.16.89.128)은 예시다. 내 VM의 값과 다르다.',
    },
    readingLead: '한 줄이 네트워크 장치 하나다. 이 장치를 인터페이스라고 한다. 인터페이스는 컴퓨터가 네트워크에 연결되는 통로다. 첫 칸은 장치 이름, 둘째 칸은 상태, 그 뒤는 그 장치에 붙은 주소다.',
    reading: [
      'lo는 컴퓨터가 자기 자신과 통신할 때 쓰는 가상 장치다. 상태가 UNKNOWN으로 나오는 것이 정상이다. 점검 대상이 아니다.',
      'ens160은 VMware가 VM에 만들어 준 네트워크 장치다. 환경에 따라 ens33, eth0처럼 다른 이름일 수 있다.',
      'UP은 장치가 켜져 있다는 뜻이다.',
      '172.16.89.128/24는 이 VM의 IPv4 주소다. 슬래시(/) 앞이 주소이고, 뒤의 24는 같은 네트워크를 구분하는 접두사 길이다. 자세한 뜻은 1단계에서 다룬다.',
      'fe80::로 시작하는 값은 IPv6 주소다. 지금은 IPv4 주소만 확인한다.',
    ],
    fixes: [
      ['nonet', 'lo 말고 다른 줄이 없거나, 장치가 DOWN이거나, IPv4 주소가 없다: VM이 네트워크에 연결되지 않았다. VMware 메뉴 VM → Settings → Network Adapter에서 Connected와 Connect at power on이 체크되어 있는지 확인한다. 그다음 VM에서 sudo nmcli device connect ens160을 실행한다. ens160은 내 장치 이름으로 바꾼다.'],
    ],
    askLead: '확인 질문: lo가 아닌 장치의 이름과 IPv4 주소(슬래시 앞부분)는 무엇인가? 이 주소는 0-4와 1단계에서 계속 쓰므로 적어 둔다.',
    ask: [
      { key: 'setup.device', type: 'text', label: 'lo가 아닌 장치의 이름', placeholder: '장치 이름', rule: 'br.device' },
      { key: 'setup.ipv4', type: 'text', label: '그 장치의 IPv4 주소(슬래시 앞부분)', placeholder: 'IPv4 주소', rule: 'br.ipv4' },
      { key: 'setup.nonet', type: 'check', label: 'lo 말고 다른 줄이 없거나, 장치가 DOWN이거나, IPv4 주소가 없다' },
    ],
    expect: 'ip-br-addr',
    pasteLabel: 'VM 터미널 출력 (선택)',
    check(ctx) {
      const res = ctx.result;
      const dev = ans(ctx, 'setup.device');
      if (res) {
        if (res.status === 'fail') return { state: 'problem', fix: 'nonet', why: res.message };
        if (res.status !== 'ok') return unreadable(res);
        const usable = res.values.usable;
        const u = usable.find(x => x.name === dev) || (usable.length === 1 ? usable[0] : null);
        if (!u) return { state: 'ready', why: 'IPv4 주소가 붙은 장치가 ' + usable.length + '개다(' + usable.map(x => x.name).join(', ') + '). 확인 질문에 점검할 장치 이름을 적으면 그 장치를 내 환경 정보에 저장한다.' };
        return { state: 'ready', why: u.name + ' 장치가 켜져 있고(UP) IPv4 주소 ' + u.ipv4[0] + '가 붙어 있다.', save: { device: u.name, ipv4: u.ipv4[0], prefix: u.prefix[0], interfaces: usable.map(x => x.name) } };
      }
      if (ans(ctx, 'setup.nonet')) return { state: 'problem', fix: 'nonet', why: 'lo 말고 쓸 수 있는 장치나 IPv4 주소가 없다.' };
      const raw = ans(ctx, 'setup.ipv4');
      if (!dev && !raw) return { state: 'blank' };
      const ip = raw.replace(/\/\d+$/, '');
      const prefix = /\/(\d+)$/.test(raw) ? +/\/(\d+)$/.exec(raw)[1] : null;
      if (!dev || !raw) return { state: 'unknown', why: '장치 이름과 IPv4 주소를 모두 적어야 판정할 수 있다.' };
      if (dev === 'lo') return { state: 'unknown', why: 'lo는 점검 대상이 아니다. lo가 아닌 장치의 이름을 적는다.' };
      if (!isV4(ip)) return { state: 'unknown', why: '"' + raw + '"은(는) IPv4 주소 모양(점으로 나뉜 숫자 네 덩어리)이 아니다. 슬래시 앞부분을 그대로 적는다.' };
      if (/^127\./.test(ip)) return { state: 'unknown', why: '127.로 시작하는 주소는 lo의 주소다. lo가 아닌 장치의 주소를 적는다.' };
      return { state: 'ready', why: dev + ' 장치에 IPv4 주소 ' + ip + '가 있다고 답했다.', save: { device: dev, ipv4: ip, prefix } };
    },
  };

  const PING_COUNTS = ['4번', '3번', '2번', '1번', '0번 (응답 없음)', 'Network is unreachable가 나왔다'];
  CARDS['setup-ping-ip'] = {
    setup: true,
    no: '0-2 (2)',
    title: '인터넷에 닿는가? — ping -c 4 8.8.8.8',
    question: '인터넷에 닿는가?',
    place: SETUP_NET_PLACE,
    command: () => 'ping -c 4 8.8.8.8',
    lead: '(1)의 결과를 확인했으면 같은 터미널에서 아래 명령을 입력하고 Enter를 누른다.',
    parts: [
      ['ping', '상대 장비에 \'응답해 달라\'는 짧은 확인 메시지를 보내고 답이 돌아오는지 본다. 이 확인 메시지를 ICMP 요청이라고 한다.'],
      ['-c 4', 'count(횟수)의 c다. 네 번만 보내고 끝내라는 뜻이다. 이 옵션이 없으면 리눅스의 ping은 멈추지 않고 계속 보낸다. 그때는 Ctrl + C를 눌러 멈춘다.'],
      ['8.8.8.8', '구글이 운영하는 공개 DNS 서버의 IP 주소다. 늘 켜져 있고 ping에 응답하는 잘 알려진 주소라서 인터넷 연결을 확인할 때 자주 쓴다.'],
    ],
    values: () => '바꿀 값이 없다. 그대로 입력한다.',
    ends: '1초에 한 번씩 네 번 보낸 뒤 통계 줄을 출력하고 끝난다. 3~4초쯤 걸린다.',
    example: {
      title: '출력 예시',
      shown: 'PING 8.8.8.8 (8.8.8.8) 56(84) bytes of data.\n64 bytes from 8.8.8.8: icmp_seq=1 ttl=128 time=51.1 ms\n64 bytes from 8.8.8.8: icmp_seq=2 ttl=128 time=1215 ms\n64 bytes from 8.8.8.8: icmp_seq=3 ttl=128 time=391 ms\n64 bytes from 8.8.8.8: icmp_seq=4 ttl=128 time=160 ms\n\n--- 8.8.8.8 ping statistics ---\n4 packets transmitted, 4 received, 0% packet loss, time 3053ms',
      note: '아래 출력은 예시다. 내 VM의 출력과 다를 수 있다.',
    },
    reading: [
      '64 bytes from 8.8.8.8 로 시작하는 줄 하나가 응답 하나다. icmp_seq는 몇 번째 요청에 대한 응답인지를, time은 요청을 보내고 응답을 받기까지 걸린 시간(왕복 시간)을 나타낸다.',
      '통계 줄의 4 packets transmitted, 4 received는 네 번 보내 네 번 받았다는 뜻이다. 0% packet loss는 응답을 받지 못한 요청이 없다는 뜻이다.',
      'time 값이 줄마다 크게 달라도 응답이 왔다면 연결은 된 것이다. 시간은 Windows PC의 인터넷 상태에 따라 달라진다.',
    ],
    fixes: [
      ['loss', '100% packet loss 또는 Network is unreachable: VM에서 인터넷으로 나가지 못한다. 먼저 Windows에서 인터넷이 되는지, (1)에서 IPv4 주소가 있었는지 확인한다.'],
      ['some', '일부만 응답했다(예: 4 packets transmitted, 3 received): 연결은 되지만 불안정하다. 실습은 계속할 수 있다.'],
    ],
    ask: [
      { key: 'setup.ping.count', type: 'choice', label: '확인 질문: 네 번 중 몇 번 응답을 받았는가?', choices: PING_COUNTS, rule: 'setup.ping.count' },
    ],
    expect: 'ping',
    pasteLabel: 'VM 터미널 출력 (선택)',
    check(ctx) {
      const res = ctx.result;
      if (res) {
        if (res.status === 'ok') {
          return res.outcome === 'all'
            ? { state: 'ready', why: res.message }
            : { state: 'ready', fix: 'some', why: res.message };
        }
        if (res.status === 'fail' && (res.outcome === 'none' || res.outcome === 'network-unreachable')) return { state: 'problem', fix: 'loss', why: res.message };
        if (res.status === 'fail') return { state: 'unknown', why: res.message };
        return unreadable(res);
      }
      const a = ans(ctx, 'setup.ping.count');
      if (!a) return { state: 'blank' };
      if (a === '4번') return { state: 'ready', why: '네 번 보내 네 번 응답을 받았다.' };
      if (/^[123]번$/.test(a)) return { state: 'ready', fix: 'some', why: '네 번 중 ' + a + ' 응답을 받았다.' };
      return { state: 'problem', fix: 'loss', why: a === PING_COUNTS[5] ? 'Network is unreachable가 나왔다.' : '응답을 하나도 받지 못했다.' };
    },
  };

  CARDS['setup-ping-name'] = {
    setup: true,
    no: '0-2 (3)',
    title: '도메인 이름을 IP 주소로 바꿀 수 있는가? — ping -c 4 google.com',
    question: '도메인 이름을 IP 주소로 바꿀 수 있는가?',
    place: SETUP_NET_PLACE,
    command: () => 'ping -c 4 google.com',
    lead: '(2)의 결과를 확인했으면 같은 터미널에서 아래 명령을 입력하고 Enter를 누른다.',
    parts: [
      ['google.com', '이번에는 IP 주소 대신 도메인 이름을 넣는다. 컴퓨터는 이름만으로는 통신할 수 없다. 먼저 DNS 서버에 \'google.com의 IP 주소가 무엇인가\'를 묻고, 답으로 받은 IP로 ping을 보낸다. 이름을 IP로 바꾸는 이 과정을 이름 조회(DNS 조회)라고 한다.'],
    ],
    values: () => '바꿀 값이 없다. 그대로 입력한다.',
    ends: '(2)와 같다.',
    example: {
      title: '출력 예시',
      shown: 'PING google.com (142.250.23.138) 56(84) bytes of data.\n64 bytes from zj-in-f138.1e100.net (142.250.23.138): icmp_seq=1 ttl=128 time=135 ms\n(응답 줄 3개 더)\n\n--- google.com ping statistics ---\n4 packets transmitted, 4 received, 0% packet loss, time 3004ms',
      output: '[jin@localhost ~]$ ping -c 4 google.com\nPING google.com (142.250.23.138) 56(84) bytes of data.\n64 bytes from zj-in-f138.1e100.net (142.250.23.138): icmp_seq=1 ttl=128 time=135 ms\n64 bytes from zj-in-f138.1e100.net (142.250.23.138): icmp_seq=2 ttl=128 time=43.3 ms\n64 bytes from zj-in-f138.1e100.net (142.250.23.138): icmp_seq=3 ttl=128 time=42.5 ms\n64 bytes from zj-in-f138.1e100.net (142.250.23.138): icmp_seq=4 ttl=128 time=50.8 ms\n\n--- google.com ping statistics ---\n4 packets transmitted, 4 received, 0% packet loss, time 3004ms',
      note: '아래 값(142.250.23.138)은 예시다. 조회되는 IP는 위치와 시간에 따라 달라질 수 있다.',
    },
    reading: [
      '첫 줄 괄호 안의 142.250.23.138이 이름 조회로 얻은 IP다. 이 줄이 나왔다면 이름 조회는 성공한 것이다. 조회되는 IP는 위치와 시간에 따라 달라질 수 있다.',
      '응답 줄의 zj-in-f138.1e100.net은 그 IP에 붙은 이름이다. 1e100.net은 구글이 자기 서버에 쓰는 도메인이다.',
    ],
    // 원고의 '(2)와 (3)을 함께 읽기'. 페이지 끝에서 (2)·(3)의 판정으로 맞는 줄을 고른다.
    fixes: [
      ['both-ok', '둘 다 성공했다: 인터넷 연결과 이름 조회가 모두 된다. 다음 점검으로 넘어간다.'],
      ['dns', '(2)는 성공했는데 (3)에서 Name or service not known 또는 Temporary failure in name resolution이 나왔다: 인터넷에는 닿지만 이름을 IP로 바꾸지 못한다. 문제는 DNS 쪽이다.'],
      ['both-fail', '둘 다 실패했다: 이름 조회를 보기 전에 인터넷 연결부터 확인한다.'],
    ],
    fixesTitle: '(2)와 (3)을 함께 읽기',
    fixesOutro: '이처럼 IP로 한 번, 이름으로 한 번 확인하면 문제가 연결 자체에 있는지 이름 조회에 있는지 나눠서 볼 수 있다.',
    ask: [
      { key: 'setup.dns.ip', type: 'text', label: '확인 질문: google.com은 어떤 IP로 조회되었는가?', placeholder: 'IP 주소', rule: 'setup.dns.ip' },
      { key: 'setup.dns.fail', type: 'check', label: 'IP 대신 Name or service not known 또는 Temporary failure in name resolution이 나왔다' },
    ],
    expect: 'ping',
    pasteLabel: 'VM 터미널 출력 (선택)',
    check(ctx) {
      const res = ctx.result;
      const pingIp = ctx.others && ctx.others['setup-ping-ip'];
      const failFix = pingIp && pingIp.state === 'problem' ? 'both-fail' : 'dns';
      if (res) {
        if (res.outcome === 'resolve-fail') return { state: 'problem', fix: failFix, why: res.message };
        if (res.values && res.values.targetIp && (res.status === 'ok' || res.status === 'fail')) {
          return { state: 'ready', fix: pingIp && pingIp.state === 'ready' ? 'both-ok' : null, why: 'google.com을 ' + res.values.targetIp + '로 조회했다. 이름 조회는 성공했다.' + (res.status === 'fail' ? ' 다만 ping 응답은 받지 못했다. ' + res.message : '') };
        }
        return unreadable(res);
      }
      if (ans(ctx, 'setup.dns.fail')) return { state: 'problem', fix: failFix, why: '이름 조회에 실패했다는 메시지가 나왔다.' };
      const ip = ans(ctx, 'setup.dns.ip');
      if (!ip) return { state: 'blank' };
      if (!isV4(ip) && !/:/.test(ip)) return { state: 'unknown', why: '"' + ip + '"은(는) IP 주소 모양이 아니다. 첫 줄 괄호 안의 값을 적는다.' };
      return { state: 'ready', fix: pingIp && pingIp.state === 'ready' ? 'both-ok' : null, why: 'google.com을 ' + ip + '로 조회했다고 답했다. 이름 조회는 성공했다.' };
    },
  };

  // ----- 0-3 -----
  const SETUP_PKGS = ['bind-utils', 'traceroute', 'nmap-ncat'];
  const DNF_ENDS = ['Complete!', 'Nothing to do.', 'Sorry, try again.', 'jin is not in the sudoers file', 'Failed to download metadata 또는 Cannot download repomd.xml', 'Unable to find a match'];
  const DNF_END_FIX = { 'Complete!': null, 'Nothing to do.': 'nothing', 'Sorry, try again.': 'pw', 'jin is not in the sudoers file': 'sudoers', 'Failed to download metadata 또는 Cannot download repomd.xml': 'repo', 'Unable to find a match': 'match' };
  const DNF_OUTCOME_FIX = { 'wrong-password': 'pw', 'not-sudoer': 'sudoers', repo: 'repo', 'no-match': 'match' };
  CARDS['setup-dnf'] = {
    setup: true,
    no: '0-3',
    title: '실습 도구가 설치되어 있는가? — sudo dnf install',
    question: '1단계에서 쓸 nslookup, traceroute, nc 명령이 준비되어 있는가?',
    place: 'vm-console',
    command: () => 'sudo dnf install -y bind-utils traceroute nmap-ncat',
    lead: 'VMware 화면 안의 VM 터미널에서 아래 명령을 입력하고 Enter를 누른다.',
    parts: [
      ['sudo', '뒤에 오는 명령을 관리자 권한으로 실행한다. 프로그램 설치처럼 시스템을 바꾸는 작업에는 관리자 권한이 필요하다. 실행하면 [sudo] password for jin: 처럼 비밀번호를 묻는다. 로그인할 때 쓴 내 계정 비밀번호를 입력한다. 입력하는 동안 화면에 아무것도 표시되지 않는데, 정상이다. 다 입력하고 Enter를 누른다.'],
      ['dnf', 'CentOS Stream과 Rocky Linux에서 프로그램을 설치·삭제·업데이트하는 도구다. 설치 단위는 패키지라고 부른다. 패키지는 프로그램과 그 설정 파일을 하나로 묶은 것이다.'],
      ['install', '설치하라는 뜻이다.'],
      ['-y', '설치 도중 \'진행할까요?\'라고 묻는 질문에 자동으로 yes라고 답한다.'],
      ['bind-utils', 'nslookup 명령이 들어 있는 패키지다. 이처럼 패키지 이름과 명령 이름이 다를 수 있다.'],
      ['traceroute', 'traceroute 명령이 들어 있는 패키지다.'],
      ['nmap-ncat', 'nc 명령이 들어 있는 패키지다.'],
    ],
    values: () => '바꿀 값이 없다. 그대로 입력한다.',
    ends: '마지막에 Complete! 또는 Nothing to do. 가 나오고 프롬프트가 돌아오면 끝난 것이다. 인터넷 속도에 따라 수십 초 걸릴 수 있다.',
    example: {
      output: '[jin@localhost ~]$ sudo dnf install -y bind-utils traceroute nmap-ncat\n[sudo] password for jin: \nCentOS Stream 10 - BaseOS                       666 kB/s | 2.3 MB     00:03\nPackage bind-utils-32:9.18.33-31.el10.x86_64 is already installed.\nPackage nmap-ncat-4:7.92-5.el10.x86_64 is already installed.\nDependencies resolved.\n================================================================================\n Package            Architecture    Version                  Repository    Size\n================================================================================\nInstalling:\n traceroute         x86_64          3:2.1.6-3.el10           baseos        60 k\n\nTransaction Summary\n================================================================================\nInstall  1 Package\n\nImporting GPG key 0x8483C65D:\nKey imported successfully\n\nInstalled:\n  traceroute-3:2.1.6-3.el10.x86_64\n\nComplete!',
      note: '아래 출력은 예시다. 내 VM에서는 이미 설치된 패키지가 다를 수 있다.',
    },
    readingTitle: '출력 읽기 (실제 출력에서 중요한 줄만 골랐다)',
    readingLines: [
      ['CentOS Stream 10 - BaseOS   666 kB/s | 2.3 MB  00:03', '설치할 수 있는 패키지 목록(저장소 정보)을 내려받는 중이다.'],
      ['Package bind-utils-32:9.18.33-31.el10.x86_64 is already installed.', '이미 설치되어 있어서 건너뛴다.'],
      ['Installing: 아래의 traceroute', '새로 설치할 패키지다.'],
      ['Importing GPG key ... Key imported successfully', '패키지가 공식 배포처에서 온 것이 맞는지 확인하는 서명 키를 처음 등록하는 과정이다. 처음 설치할 때 한 번 나오는 정상 메시지다.'],
      ['Complete!', '설치가 끝났다.'],
    ],
    fixes: [
      ['nothing', 'Nothing to do.: 세 패키지가 모두 이미 설치되어 있다. 그대로 진행한다.'],
      ['pw', 'Sorry, try again.: 비밀번호가 틀렸다. 다시 입력한다.'],
      ['sudoers', 'jin is not in the sudoers file: 이 계정에 관리자 권한이 없다. 관리자 권한이 있는 계정이나 root로 로그인해 설치한다.'],
      ['repo', 'Failed to download metadata 또는 Cannot download repomd.xml: 패키지 저장소에 접속하지 못했다. 0-2의 인터넷 연결과 이름 조회를 다시 확인한다. 지원이 끝난 버전(0-1 참고)에서도 이 오류가 난다.'],
      ['match', 'Unable to find a match: 패키지 이름의 철자를 확인한다.'],
    ],
    askLead: '확인 질문: 세 패키지 가운데 새로 설치된 것과 이미 설치되어 있던 것은 각각 무엇인가?',
    ask: SETUP_PKGS.map(p => ({ key: 'setup.pkg.' + p, type: 'choice', label: p, choices: ['새로 설치됨', '이미 설치되어 있었음'], rule: 'setup.pkg' }))
      .concat([{ key: 'setup.dnf.end', type: 'choice', label: '마지막에 나온 줄(또는 오류)은 무엇인가?', choices: DNF_ENDS }]),
    expect: 'dnf',
    pasteLabel: 'VM 터미널 출력 (선택)',
    check(ctx) {
      const res = ctx.result;
      if (res) {
        if (res.status === 'ok') return { state: 'ready', fix: res.outcome === 'nothing' ? 'nothing' : null, why: res.message };
        if (res.status === 'fail') return { state: 'problem', fix: DNF_OUTCOME_FIX[res.outcome] || null, why: res.message };
        return unreadable(res);
      }
      const end = ans(ctx, 'setup.dnf.end');
      if (!end) {
        return SETUP_PKGS.some(p => ans(ctx, 'setup.pkg.' + p)) ? { state: 'unknown', why: '마지막에 나온 줄을 골라야 설치가 끝났는지 판정할 수 있다.' } : { state: 'blank' };
      }
      if (end === 'Complete!') return { state: 'ready', why: 'Complete!가 나왔다. 설치가 끝났다.' };
      if (end === 'Nothing to do.') return { state: 'ready', fix: 'nothing', why: 'Nothing to do.가 나왔다.' };
      return { state: 'problem', fix: DNF_END_FIX[end], why: end + '가 나왔다.' };
    },
  };

  // ----- 0-4 -----
  const SSH_RESULTS = ['프롬프트가 jin@localhost:~$ 같은 리눅스 프롬프트로 바뀌었다', 'Connection timed out', 'Connection refused', 'Permission denied, please try again.', "'ssh' 용어가 ... 인식되지 않습니다", 'Are you sure you want to continue connecting (yes/no/[fingerprint])? 에서 멈춰 있다'];
  const SSH_RESULT_FIX = { 1: 'timeout', 2: 'refused', 3: 'denied', 4: 'nossh' };
  const SSH_OUTCOME_FIX = { timeout: 'timeout', refused: 'refused', denied: 'denied' };
  const sshTarget = env => (env.user || '계정이름') + '@' + (env.ipv4 || 'VM주소');
  CARDS['setup-ssh'] = {
    setup: true,
    no: '0-4',
    title: '내 Windows PC에서 VM에 접속할 수 있는가? — ssh',
    question: 'Windows PC에서 VM에 원격으로 접속해 명령을 실행할 수 있는가?',
    why: '왜 필요한가: VMware 화면 안의 터미널은 Windows와 복사·붙여넣기가 되지 않을 수 있다. Windows의 PowerShell에서 SSH로 VM에 접속하면 명령은 VM에서 실행되고 출력은 PowerShell 창에 나타난다. 그래서 평소처럼 복사할 수 있다. 1단계부터는 이 방법으로 실습한다.',
    place: 'win-ps',
    command: env => 'ssh ' + sshTarget(env),
    needs: env => [env.user ? null : '계정이름', env.ipv4 ? null : 'VM주소'].filter(Boolean),
    lead: 'Windows PC의 PowerShell에서 아래 명령을 입력하고 Enter를 누른다.',
    parts: [
      ['ssh', '다른 컴퓨터에 암호화된 연결로 접속해 명령을 실행하는 프로그램이다. Windows 10과 11에는 기본으로 들어 있다.'],
      ['jin@172.16.89.128', '\'172.16.89.128 컴퓨터에 jin 계정으로 접속한다\'는 뜻이다. @ 앞이 계정, 뒤가 접속할 컴퓨터다.'],
    ],
    values: () => '바꿀 값: jin은 VM에 로그인할 때 쓰는 계정 이름으로 바꾼다. 172.16.89.128은 0-2에서 확인한 내 VM의 IPv4 주소로 바꾼다.',
    editSsh: true,
    endsTitle: '진행 순서',
    endsSteps: [
      '처음 접속하면 The authenticity of host ... can\'t be established. 라는 문장과 함께 Are you sure you want to continue connecting (yes/no/[fingerprint])? 라고 묻는다. 처음 접속하는 컴퓨터라서 접속할 컴퓨터가 맞는지 확인하는 질문이다. 내 VM에 접속하는 것이 맞으므로 yes를 입력하고 Enter를 누른다. 한 번 답하면 다음부터는 묻지 않는다.',
      'jin@172.16.89.128\'s password: 가 나오면 VM 계정 비밀번호를 입력한다. 이번에도 화면에는 아무것도 표시되지 않는다.',
      '프롬프트가 PS C:\\...> 에서 jin@localhost:~$ 같은 리눅스 프롬프트로 바뀌면 접속에 성공한 것이다. 창은 PowerShell이지만 지금부터 입력하는 명령은 VM 안에서 실행된다.',
      '접속을 끝낼 때는 exit를 입력한다. 프롬프트가 다시 PS C:\\...> 로 돌아온다.',
    ],
    example: {
      output: 'PS C:\\Users\\jin> ssh jin@172.16.89.128\nThe authenticity of host \'172.16.89.128 (172.16.89.128)\' can\'t be established.\nED25519 key fingerprint is SHA256:(예시 지문).\nAre you sure you want to continue connecting (yes/no/[fingerprint])? yes\nWarning: Permanently added \'172.16.89.128\' (ED25519) to the list of known hosts.\njin@172.16.89.128\'s password:\nLast login: Wed Nov 25 17:52:07 2026 from 172.16.89.1\njin@localhost:~$',
      note: '아래 값(jin, 172.16.89.128)은 예시다. 내 계정 이름과 VM 주소는 다르다.',
    },
    reading: [],
    fixes: [
      ['timeout', 'Connection timed out: 정해진 시간 안에 VM에서 아무 응답도 받지 못했다. IP 주소를 잘못 입력했거나 VM이 꺼져 있을 수 있다. 0-2에서 확인한 주소와 VM 상태를 다시 확인한다.'],
      ['refused', 'Connection refused: VM까지는 닿았지만, VM에서 SSH 접속을 받는 프로그램(sshd)이 실행되고 있지 않다는 거절 응답이 돌아왔다. VM 터미널에서 sudo systemctl enable --now sshd를 실행해 sshd를 켜고 다시 접속한다.'],
      ['denied', 'Permission denied, please try again.: 계정 이름이나 비밀번호가 틀렸다. root 계정은 기본 설정상 비밀번호로 SSH 접속할 수 없으므로 일반 계정으로 접속한다.'],
      ['nossh', '\'ssh\' 용어가 ... 인식되지 않습니다: Windows에 SSH 프로그램이 없다. Windows 설정의 \'선택적 기능\'에서 OpenSSH 클라이언트를 추가한다.'],
    ],
    fixesOutro: 'Connection timed out(응답 없음)과 Connection refused(거절 응답)의 차이는 1단계의 nc 실습에서 다시 다룬다.',
    ask: [
      { key: 'setup.ssh.result', type: 'choice', label: '접속 결과는 어떻게 나왔는가?', choices: SSH_RESULTS },
      { key: 'setup.ssh.who', type: 'choice', label: '확인 질문: 접속에 성공한 상태에서 ip -br addr를 실행하면 누구의 주소가 나오는가?', choices: ['Windows PC의 주소', 'VM의 주소'], rule: 'setup.ssh.who', fixed: true },
    ],
    expect: 'ssh',
    pasteLabel: 'PowerShell 출력 (선택)',
    check(ctx) {
      const res = ctx.result;
      if (res) {
        if (res.status === 'ok') return { state: 'ready', why: res.message };
        if (res.status === 'notfound' && res.kind === 'ssh') return { state: 'problem', fix: 'nossh', why: res.message };
        if (res.status === 'fail') return { state: 'problem', fix: SSH_OUTCOME_FIX[res.outcome] || null, why: res.message };
        return unreadable(res);
      }
      const a = ans(ctx, 'setup.ssh.result');
      if (!a) return { state: 'blank' };
      const i = SSH_RESULTS.indexOf(a);
      if (i === 0) return { state: 'ready', why: '리눅스 프롬프트로 바뀌었다. 접속에 성공했다.' };
      if (i === 5) return { state: 'unknown', why: '아직 접속 중이다. 내 VM에 접속하는 것이 맞으므로 yes를 입력하고 Enter를 누른 뒤 진행 순서 2번부터 이어 간다.' };
      return { state: 'problem', fix: SSH_RESULT_FIX[i], why: a + '가 나왔다.' };
    },
  };

  // ===== 채점 규칙 =====
  // 각 규칙은 (분석 결과, ctx) → { accept, show, lines, explain, type } 또는 { skip } 를 돌려준다.
  // ctx.answers: 학습자의 답(문제 key → 값), ctx.env: 지금 카드가 쓰는 환경 정보(실제 또는 예시)
  const ifaceLines = (res, names) => res.values.interfaces.filter(i => names.indexOf(i.name) >= 0).map(i => i.line);

  // ip addr 출력에서 어느 장치를 볼지 정한다 (분석 결과의 값만 사용)
  function addrTarget(res, env) {
    const v = res.values;
    if (v.target) return { iface: v.target };
    const byEnv = env.device && v.interfaces.find(i => i.name === env.device);
    if (byEnv) return { iface: byEnv };
    const nonLo = v.interfaces.filter(i => !i.loopback);
    if (nonLo.length === 1) return { iface: nonLo[0] };
    return { reason: '출력에 장치가 여러 개 있어 어느 장치를 볼지 정할 수 없다. 명령 줄까지 함께 복사하거나 <code>ip addr show dev 장치이름</code>으로 다시 실행한다.' };
  }

  const RULES = {
    'br.device': res => {
      const names = res.values.usable.map(u => u.name);
      return {
        type: 'text',
        accept: names,
        show: names.join(' 또는 '),
        lines: ifaceLines(res, names),
        explain: '각 줄의 첫 칸이 장치 이름이다. lo는 자기 자신과 통신할 때 쓰는 장치라 점검 대상이 아니다.' +
          (names.length > 1 ? ' 이 출력에는 IPv4 주소가 붙은 장치가 ' + names.length + '개라 어느 것을 적어도 정답이다. 채점 뒤에 점검할 장치를 하나 고른다.' : ' 이 출력에서 lo가 아니면서 IPv4 주소가 붙은 장치는 ' + names[0] + ' 하나다.'),
      };
    },
    'br.ipv4': (res, ctx) => {
      const usable = res.values.usable;
      const said = (ctx.answers['br.device'] || '').trim();
      let pick = usable.filter(u => u.name === said);
      const byAnswer = pick.length > 0;
      if (!pick.length) pick = usable;
      const ips = [].concat.apply([], pick.map(u => u.ipv4));
      return {
        type: 'ip',
        accept: ips,
        show: pick.map(u => u.ipv4.join(', ') + (pick.length > 1 ? ' (' + u.name + ')' : '')).join(' 또는 '),
        lines: ifaceLines(res, pick.map(u => u.name)),
        explain: (byAnswer || usable.length === 1 ? pick[0].name + ' 줄에서' : '장치 줄에서') +
          ' 점 네 덩어리로 된 주소가 IPv4 주소다. 슬래시(/) 뒤의 숫자는 접두사 길이라서 답에 넣지 않는다. fe80::처럼 콜론이 섞인 값은 IPv6 주소다.',
      };
    },
    'addr.ipv4': (res, ctx) => {
      const t = addrTarget(res, ctx.env);
      if (!t.iface) return { skip: t.reason };
      const a = t.iface.ipv4;
      if (!a.length) return { skip: t.iface.name + ' 장치에 inet 줄이 없다. IPv4 주소가 붙어 있지 않다.' };
      return {
        type: 'ip',
        accept: a.map(x => x.address),
        show: a.map(x => x.address).join(' 또는 '),
        lines: a.map(x => x.line),
        explain: 'inet으로 시작하는 줄이 IPv4 주소 줄이다. inet 바로 뒤의 값에서 슬래시(/) 앞부분이 ' + t.iface.name + '의 IPv4 주소다. 이 주소는 이 VM 자신의 주소다.',
      };
    },
    'addr.prefix': (res, ctx) => {
      const t = addrTarget(res, ctx.env);
      if (!t.iface) return { skip: t.reason };
      const said = (ctx.answers['addr.ipv4'] || '').trim().replace(/\/\d+$/, '');
      const a = t.iface.ipv4.filter(x => x.address === said);
      const list = a.length ? a : t.iface.ipv4;
      if (!list.length) return { skip: t.iface.name + ' 장치에 inet 줄이 없어 접두사 길이를 읽을 수 없다.' };
      return {
        type: 'prefix',
        accept: list.map(x => String(x.prefix)),
        show: list.map(x => String(x.prefix)).join(' 또는 '),
        lines: list.map(x => x.line),
        explain: 'inet 뒤의 ' + list[0].address + '/' + list[0].prefix + '에서 슬래시 뒤의 ' + list[0].prefix + '가 접두사 길이다. 주소의 앞 ' + list[0].prefix + '비트가 같은 장비끼리 같은 네트워크에 있다는 뜻이다.' +
          (list[0].prefix === 24 ? ' /24라면 앞의 세 덩어리(' + list[0].address.split('.').slice(0, 3).join('.') + ')가 같은 주소들이 같은 네트워크다.' : ''),
      };
    },
    'addr.inet6': (res, ctx) => {
      const t = addrTarget(res, ctx.env);
      if (!t.iface) return { skip: t.reason };
      if (!t.iface.ipv6.length) return { skip: '이 출력에는 inet6 줄이 없어 채점하지 않는다.' };
      return {
        type: 'choice',
        accept: ['IPv6 주소'],
        show: 'IPv6 주소',
        lines: t.iface.ipv6.map(x => x.line),
        explain: 'inet은 IPv4 주소 줄이고, inet6은 IPv6 주소 줄이다. ' + t.iface.ipv6[0].address + '처럼 콜론(:)으로 구분된 값이 IPv6 주소다. fe80::로 시작하는 주소는 같은 네트워크 안에서만 쓰는 링크 로컬 주소다.',
      };
    },
  };

  // ===== 1단계 나머지 명령 (1-3 ~ 1-10) =====
  // 출력 예시(shown)는 samples/의 실제 출력이다. '예시로 연습'의 출력(output)은 같은 형식에 예시 주소(192.168.10.x)를 넣은 것이다.
  EXAMPLE_ENV.gateway = '192.168.10.2';
  const toExample = s => s.replace(/172\.16\.89\./g, '192.168.10.');
  // VMware NAT에서 Windows PC의 VMnet8 주소는 보통 같은 네트워크의 .1이다 (/24일 때만 계산한다)
  const winHost = env => (env.ipv4 && (env.prefix == null || env.prefix === 24) ? env.ipv4.split('.').slice(0, 3).join('.') + '.1' : null);
  const val = (v, hole) => v || hole;
  const COPY_EXTRA = '명령 줄과 프롬프트 줄이 함께 복사되어도 괜찮다. 앱이 알아서 빼고 읽는다.';

  // ----- 1-3 ip route -----
  const SAMPLE_ROUTE = 'default via 172.16.89.2 dev ens160 proto dhcp src 172.16.89.128 metric 100\n172.16.89.0/24 dev ens160 proto kernel scope link src 172.16.89.128 metric 100';
  CARDS['ip-route'] = {
    no: '1-3',
    title: 'ip route — 기본 경로와 게이트웨이 찾기',
    question: '이 VM은 자기 네트워크 밖(예: 인터넷)으로 가는 패킷을 누구에게 넘기는가? 같은 네트워크 안의 장비에는 어떻게 보내는가?',
    place: 'ssh-vm',
    command: () => 'ip route',
    lead: '1-1과 같은 창(SSH로 VM에 접속한 PowerShell 창)에서 <code>ip route</code>를 입력하고 Enter를 누른다.',
    parts: [
      ['ip', '리눅스의 네트워크 설정을 보고 바꾸는 명령이다.'],
      ['route', '라우팅 테이블(routing table)을 보여 달라는 뜻이다. 라우팅 테이블은 "어느 목적지로 가는 패킷을 어느 장치로, 누구에게 넘길지" 적어 둔 표다. 이 표의 한 줄을 경로(route)라고 한다. 뒤에 아무것도 쓰지 않으면 <code>ip route show</code>(경로 목록 보기)와 같다.'],
    ],
    values: () => '바꿀 값이 없다. 그대로 입력한다.',
    ends: '결과를 보여주고 바로 끝난다. 프롬프트가 다시 나타나면 끝난 것이다.',
    copy: {
      from: '<code>default</code>로 시작하는 줄. 보통 첫 줄이다.',
      to: '마지막 경로 줄. 작성자의 VM에서는 <code>172.16.89.0/24 dev ens160 ...</code>로 시작하는 둘째 줄이 마지막이었다. 줄이 더 있으면 모두 복사한다.',
      extra: COPY_EXTRA,
      fail: '<code>RTNETLINK answers: ...</code> 같은 오류 줄이 나오면 그 줄을 복사한다.',
    },
    pasteLabel: '내 Linux 출력',
    expect: 'ip-route',
    example: {
      shown: [{ text: SAMPLE_ROUTE }],
      output: '[jin@localhost ~]$ ip route\n' + toExample(SAMPLE_ROUTE),
      note: '아래 값(192.168.10.2, 192.168.10.0/24)은 예시다. 내 VM의 값과 다르다.',
    },
    reading: [
      '한 줄이 경로 하나다. 줄의 맨 앞은 목적지이고, 그 뒤는 그 목적지로 보내는 방법이다.',
      '<code>default via 172.16.89.2 dev ens160</code>: <code>default</code>는 다른 줄에 맞는 목적지가 없을 때 쓰는 기본 경로다. <code>via</code> 뒤의 172.16.89.2가 패킷을 대신 넘겨받아 전달해 주는 장비, 곧 기본 게이트웨이다. <code>dev ens160</code>은 ens160 장치로 내보낸다는 뜻이다. 8.8.8.8처럼 이 VM의 네트워크 밖으로 가는 패킷은 이 줄을 따른다.',
      '<code>172.16.89.0/24 dev ens160 ... scope link</code>: 172.16.89.0/24 네트워크(172.16.89.0부터 172.16.89.255까지)로 가는 패킷은 <code>via</code> 없이 ens160으로 직접 보낸다는 뜻이다. 같은 네트워크에 있는 장비에는 게이트웨이를 거치지 않는다. <code>scope link</code>는 이 목적지가 장치에 바로 연결된 네트워크 안에 있다는 표시다.',
      '<code>src 172.16.89.128</code>은 이 경로로 보낼 때 출발지로 쓰는 이 VM의 주소다. <code>proto dhcp</code>는 DHCP(주소를 자동으로 나눠 주는 방식)로 받은 정보로 만든 경로, <code>proto kernel</code>은 장치에 주소를 붙일 때 커널(리눅스의 핵심 프로그램)이 자동으로 만든 경로라는 표시다.',
      '<code>metric 100</code>은 같은 목적지로 가는 경로가 여럿일 때 고르는 우선순위 값이다. 값이 작은 경로를 먼저 쓴다.',
    ],
    questions: [
      { key: 'route.gateway', label: 'default 줄의 via 뒤에 있는 기본 게이트웨이 주소는 무엇인가?', placeholder: 'IPv4 주소' },
      { key: 'route.network', label: 'via 없이 dev로 바로 이어지는 줄의 목적지 네트워크는 무엇인가? (슬래시와 숫자까지)', placeholder: '예: 192.168.10.0/24' },
      { key: 'route.pick', label: '8.8.8.8로 가는 패킷은 어느 줄을 따르는가?', choices: ['default 줄 (게이트웨이를 거친다)', 'via 없는 네트워크 줄 (직접 보낸다)'] },
    ],
    fixes: [
      ['nodefault', '<code>default</code> 줄이 없다: 이 VM은 자기 네트워크 밖으로 나가는 길을 모른다. 0-2의 <code>ping -c 4 8.8.8.8</code>이 실패했다면 이 때문일 수 있다. 다만 출력 일부만 복사해서 안 보이는 것일 수도 있으므로 먼저 첫 줄부터 다시 복사한다.'],
      ['multi', '<code>default</code> 줄이 두 개 이상이다: <code>metric</code> 값이 작은 줄을 먼저 쓴다. 이 앱도 metric이 가장 작은 줄의 게이트웨이를 정답으로 본다.'],
    ],
    fixFor: res => (res.kind === 'ip-route' && !res.values.gateway && res.status === 'partial' ? 'nodefault' : res.values.defaults && res.values.defaults.length > 1 ? 'multi' : null),
    after: 'save-gateway',
    next: 'route-get',
  };
  // 주소가 네트워크(CIDR) 안에 있는가 (IPv4만)
  const v4num = a => a.split('.').reduce((n, x) => n * 256 + (+x), 0);
  const inNet = (ip, net) => {
    const m = /^([\d.]+)\/(\d+)$/.exec(net || '');
    if (!m || !isV4(ip) || !isV4(m[1])) return false;
    const bits = +m[2], size = Math.pow(2, 32 - bits);
    return Math.floor(v4num(ip) / size) === Math.floor(v4num(m[1]) / size);
  };
  RULES['route.gateway'] = res => {
    if (!res.values.gateway) return { skip: '이 출력에는 via가 있는 default 줄이 없어 채점하지 않는다.' };
    return {
      type: 'ip', accept: [res.values.gateway], show: res.values.gateway, lines: res.evidence.gateway || [],
      explain: 'default 줄의 via 뒤 주소가 기본 게이트웨이다. 이 VM은 자기 네트워크 밖으로 가는 패킷을 모두 ' + res.values.gateway + '에 넘긴다. 이 주소를 내 환경 정보에 저장해 다음 명령에 채운다.',
    };
  };
  RULES['route.network'] = res => {
    const nets = res.values.connected.map(x => x.network);
    if (!nets.length) return { skip: '이 출력에는 via 없는 네트워크 줄이 없어 채점하지 않는다.' };
    return {
      type: 'text', accept: nets.concat(nets.map(n => n.split('/')[0])), show: nets.join(' 또는 '),
      lines: nets.map(n => (res.evidence['route:' + n] || [])[0]).filter(Boolean),
      explain: nets[0] + ' 줄에는 via가 없다. 이 네트워크 안의 장비에는 게이트웨이를 거치지 않고 ' + res.values.connected[0].dev + ' 장치로 직접 보낸다는 뜻이다. 이 VM의 주소도 이 네트워크 안에 있다.',
    };
  };
  RULES['route.pick'] = res => {
    const direct = res.values.connected.find(x => inNet('8.8.8.8', x.network));
    if (!direct && !res.values.gateway) return { skip: '8.8.8.8에 맞는 줄이 없어 채점하지 않는다.' };
    const show = direct ? 'via 없는 네트워크 줄 (직접 보낸다)' : 'default 줄 (게이트웨이를 거친다)';
    return {
      type: 'choice', accept: [show], show,
      lines: direct ? res.evidence['route:' + direct.network] : res.evidence.gateway,
      explain: direct ? '8.8.8.8이 ' + direct.network + ' 안에 있어 그 줄을 따른다.'
        : '8.8.8.8은 ' + (res.values.connected.map(x => x.network).join(', ') || '이 VM의 네트워크') + ' 안에 없다. 맞는 줄이 없으므로 기본 경로인 default 줄을 따라 게이트웨이 ' + res.values.gateway + '로 넘긴다.',
    };
  };

  // ----- 1-4 ip route get -----
  const SAMPLE_GET_OUT = '8.8.8.8 via 172.16.89.2 dev ens160 src 172.16.89.128 uid 1000\n    cache';
  const SAMPLE_GET_GW = '172.16.89.2 dev ens160 src 172.16.89.128 uid 1000\n    cache';
  CARDS['route-get'] = {
    no: '1-4',
    title: 'ip route get — 목적지 하나에 실제로 쓰이는 경로 읽기',
    question: '8.8.8.8로 보내는 패킷과 게이트웨이로 보내는 패킷은 각각 어떤 경로를 따르는가? 왜 한쪽에는 via가 있고 다른 쪽에는 없는가?',
    place: 'ssh-vm',
    commands: env => [
      { label: '이 VM의 네트워크 밖에 있는 주소 (구글 공개 DNS 서버)', cmd: 'ip route get 8.8.8.8' },
      { label: '같은 네트워크 안에 있는 주소 (1-3에서 찾은 기본 게이트웨이)', cmd: 'ip route get ' + val(env.gateway, '게이트웨이주소') },
    ],
    needs: env => (env.gateway ? [] : ['게이트웨이주소']),
    lead: '1-1과 같은 창(SSH로 VM에 접속한 PowerShell 창)에서 아래 두 명령을 하나씩 실행한다.',
    parts: [
      ['ip route', '라우팅 테이블을 보고 다루는 명령이다(1-3).'],
      ['get', '목적지 하나를 주면, 그 목적지로 보낼 때 실제로 선택되는 경로 하나를 커널(리눅스의 핵심 프로그램)이 보는 그대로 보여준다. 경로를 찾아 보여줄 뿐 패킷을 실제로 보내지는 않는다.'],
      ['8.8.8.8', '목적지 IP다. 0-2에서 ping을 보낸 구글 공개 DNS 서버 주소다.'],
      ['게이트웨이 주소', '1-3에서 찾은 기본 게이트웨이 주소다. 같은 네트워크 안의 주소를 넣었을 때 결과가 어떻게 다른지 비교한다.'],
    ],
    values: env => env.gateway
      ? '(2)의 <code>' + env.gateway + '</code>는 1-3에서 저장한 기본 게이트웨이다. 자동으로 채웠다.'
      : '(2)의 <code>게이트웨이주소</code> 자리에 1-3의 <code>ip route</code>에서 찾은 default 줄의 via 뒤 주소를 넣는다. 1-3을 채점하면 자동으로 채워진다.',
    ends: '결과를 보여주고 바로 끝난다. 프롬프트가 다시 나타나면 끝난 것이다.',
    copy: {
      from: '목적지 IP로 시작하는 첫 줄. 예: <code>8.8.8.8 via ...</code>',
      to: '그 아래 들여쓴 <code>cache</code> 줄.',
      extra: '명령 하나의 출력만 붙여 넣는다. 명령 줄까지 함께 복사하면 어느 목적지를 물었는지 앱이 더 확실히 안다.',
      fail: '<code>RTNETLINK answers: Network is unreachable</code> 같은 오류가 나오면 그 한 줄을 복사한다.',
    },
    pasteLabel: '내 Linux 출력',
    expect: 'ip-route-get',
    example: {
      shown: [{ label: '(1) <code>ip route get 8.8.8.8</code>', text: SAMPLE_GET_OUT }, { label: '(2) <code>ip route get 172.16.89.2</code>', text: SAMPLE_GET_GW }],
      output: '[jin@localhost ~]$ ip route get 8.8.8.8\n' + toExample(SAMPLE_GET_OUT),
      note: '아래 값(192.168.10.2, 192.168.10.130)은 예시다. 내 VM의 값과 다르다.',
    },
    reading: [
      '첫 줄의 맨 앞은 목적지다. 그 뒤의 <code>via</code>, <code>dev</code>, <code>src</code>는 1-3의 <code>ip route</code>와 같은 뜻이다.',
      '<code>8.8.8.8 via 172.16.89.2 dev ens160</code>: 8.8.8.8은 이 VM의 네트워크(172.16.89.0/24) 밖에 있다. 그래서 1-3의 <code>default</code> 줄이 선택되고, 게이트웨이 172.16.89.2를 거쳐 보낸다.',
      '<code>172.16.89.2 dev ens160</code>: <code>via</code>가 없다. 172.16.89.2는 이 VM과 같은 네트워크(같은 서브넷) 안에 있어 1-3의 <code>172.16.89.0/24</code> 줄이 선택됐다. 같은 서브넷의 장비에는 게이트웨이를 거치지 않고 직접 보낸다. 서브넷은 주소의 앞부분(/24라면 앞의 세 덩어리)이 같은 장비들의 묶음이다.',
      '<code>uid 1000</code>은 이 명령을 실행한 사용자의 번호다. 아래의 <code>cache</code> 줄과 함께 이 실습에서는 읽지 않는다.',
    ],
    questions: [
      { key: 'get.via', label: 'via 뒤의 주소는 무엇인가? via가 없으면 "없음"이라고 적는다.', placeholder: 'IPv4 주소 또는 없음' },
      { key: 'get.dev', label: '어느 장치로 내보내는가?', placeholder: '장치 이름' },
      { key: 'get.kind', label: '이 목적지로는 어떻게 보내는가?', choices: ['게이트웨이를 거쳐 보낸다', '같은 네트워크라 직접 보낸다'] },
    ],
    fixes: [
      ['unreach', '<code>RTNETLINK answers: Network is unreachable</code>: 이 목적지로 가는 경로가 없다. 1-3의 <code>ip route</code>에 <code>default</code> 줄이 있었는지 확인한다.'],
    ],
    fixFor: res => (res.outcome === 'unreachable' ? 'unreach' : null),
    next: 'nslookup',
  };
  RULES['get.via'] = res => {
    const v = res.values;
    return {
      type: 'ip', accept: v.via ? [v.via] : ['없음', '없다', 'none', '-'], show: v.via || '없음',
      lines: (v.via ? res.evidence.via : res.evidence.destination) || [],
      explain: v.via ? v.destination + '로 가는 패킷은 via 뒤의 ' + v.via + '(게이트웨이)에 넘겨 전달한다.'
        : '이 줄에는 via가 없다. ' + v.destination + '는 이 VM과 같은 네트워크 안에 있어 게이트웨이를 거치지 않는다.',
    };
  };
  RULES['get.dev'] = res => ({
    type: 'text', accept: [res.values.dev], show: res.values.dev, lines: res.evidence.dev || [],
    explain: 'dev 뒤의 ' + res.values.dev + '가 이 패킷을 내보내는 장치다. 1-1에서 찾은 장치와 같다.',
  });
  RULES['get.kind'] = res => {
    const show = res.values.via ? '게이트웨이를 거쳐 보낸다' : '같은 네트워크라 직접 보낸다';
    return {
      type: 'choice', accept: [show], show, lines: res.evidence.destination || res.evidence.via || [],
      explain: res.values.via ? 'via가 있으면 그 장비(게이트웨이)를 거쳐 보낸다. 목적지가 이 VM의 네트워크 밖에 있기 때문이다.'
        : 'via가 없으면 같은 서브넷 안의 목적지라 장치에서 바로 보낸다. 같은 서브넷 안에서는 게이트웨이가 필요 없다.',
    };
  };

  // ----- 0단계 확인 질문의 채점 규칙 (붙여 넣은 출력이 있을 때만 쓴다. fixed는 출력 없이도 채점) -----
  const normName = s => String(s || '').replace(/["']/g, '').replace(/\s+/g, ' ').trim();
  RULES['os.pretty'] = res => ({
    type: 'text', accept: [normName(res.values.prettyName)], show: res.values.prettyName,
    lines: res.evidence.prettyName || [],
    explain: 'PRETTY_NAME= 뒤의 따옴표 안 값이 사람이 읽기 쉬운 형태의 OS 이름이다. 따옴표는 빼고 적어도 된다.',
  });
  RULES['setup.ping.count'] = res => {
    const v = res.values;
    const show = res.outcome === 'network-unreachable' ? PING_COUNTS[5] : v.destinationReplies > 0 ? v.destinationReplies + '번' : PING_COUNTS[4];
    return {
      type: 'choice', accept: [show], show,
      lines: (res.evidence.received || res.evidence.error || []),
      explain: res.outcome === 'network-unreachable' ? 'Network is unreachable는 요청을 보낼 경로가 없어 보내지도 못했다는 뜻이다.'
        : '통계 줄의 "' + v.transmitted + ' packets transmitted, ' + v.received + ' received"는 ' + v.transmitted + '번 보내 ' + v.received + '번 받았다는 뜻이다.',
    };
  };
  RULES['setup.dns.ip'] = res => {
    if (!res.values.targetIp) return { skip: '이 출력에는 조회된 IP가 없어 채점하지 않는다.' };
    return {
      type: 'ip', accept: [res.values.targetIp], show: res.values.targetIp, lines: res.evidence.target || [],
      explain: '첫 줄 괄호 안의 값이 이름 조회로 얻은 IP다. 조회되는 IP는 위치와 시간에 따라 달라질 수 있으므로 내 출력의 값이 정답이다.',
    };
  };
  RULES['setup.pkg'] = (res, ctx) => {
    const p = ctx.q.key.replace('setup.pkg.', '');
    const st = res.values.packages && res.values.packages[p];
    if (!st || st === 'unknown') return { skip: '이 출력에서는 ' + p + '가 새로 설치되었는지 알 수 없어 채점하지 않는다.' };
    const show = st === 'new' ? '새로 설치됨' : '이미 설치되어 있었음';
    return {
      type: 'choice', accept: [show], show,
      lines: res.evidence['pkg:' + p] || res.evidence.end || [],
      explain: st === 'new' ? 'Installing: 아래 표나 Installed: 아래에 나온 패키지는 새로 설치한 것이다.'
        : res.values.nothingToDo && !(res.evidence['pkg:' + p] || []).length ? 'Nothing to do.는 요청한 패키지가 모두 이미 설치되어 있다는 뜻이다.'
        : 'Package ... is already installed. 줄은 이미 설치되어 있어서 건너뛴다는 뜻이다.',
    };
  };
  RULES['setup.ssh.who'] = () => ({
    type: 'choice', accept: ['VM의 주소'], show: 'VM의 주소', lines: [],
    explain: 'VM의 주소가 나온다. 창은 Windows의 PowerShell이지만 명령은 SSH로 접속한 VM에서 실행되기 때문이다. 이 내용은 2단계에서 다시 다룬다.',
  });

  // 1단계 실행 위치에 0-4의 접속 명령을 채운다
  PLACES['ssh-vm'].connect = env => 'ssh ' + sshTarget(env);
  EXAMPLE_ENV.user = 'jin';

  const SETUP_PAGES = [
    { id: 'setup-os', menu: 'OS 확인', no: '0-1', cards: ['setup-os'], group: '0단계 · 실습 환경 준비',
      title: '어떤 리눅스가 설치되어 있는가?',
      introTitle: '0단계를 시작하기 전에',
      intro: [
        '명령 실습을 시작하기 전에 실습할 VM이 준비되었는지 확인한다. 확인할 것은 네 가지다. 어떤 리눅스가 설치되어 있는가, VM이 네트워크에 연결되어 있는가, 실습에 쓸 도구가 설치되어 있는가, 내 Windows PC에서 VM에 접속할 수 있는가. 이 네 가지가 준비되면 1단계부터 막힘없이 진행할 수 있다.',
        '0-1부터 0-3까지는 VMware 화면 안의 VM 터미널에서 실행한다. VMware에서 VM을 켜고 계정 이름과 비밀번호로 로그인하면 jin@localhost:~$ 나 [jin@localhost ~]$ 처럼 끝에 $가 붙은 줄이 나타난다. 이 줄을 프롬프트라고 한다. 컴퓨터가 명령을 기다리고 있다는 표시다. 프롬프트 뒤에 명령을 입력하고 Enter를 누른다. 프롬프트 자체는 입력하지 않는다.',
      ] },
    { id: 'setup-net', menu: '네트워크 확인', no: '0-2', cards: ['setup-ip', 'setup-ping-ip', 'setup-ping-name'], group: '0단계 · 실습 환경 준비',
      title: 'VM이 네트워크에 연결되어 있는가? — ip -br addr, ping',
      intro: [
        '이 명령들로 답할 질문: VM이 IP 주소를 받았는가? 인터넷에 닿는가? 도메인 이름을 IP 주소로 바꿀 수 있는가?',
        '실행 위치: VMware 화면 안의 VM 터미널',
        '세 명령을 하나씩 입력한다. 결과를 확인한 뒤 다음 명령으로 넘어간다.',
      ],
      together: 'setup-ping-name' },
    { id: 'setup-dnf', menu: '실습 도구 설치', no: '0-3', cards: ['setup-dnf'], group: '0단계 · 실습 환경 준비',
      title: '실습 도구가 설치되어 있는가?',
      intro: [] },
    { id: 'setup-ssh', menu: 'Windows에서 SSH 접속', no: '0-4', cards: ['setup-ssh'], group: '0단계 · 실습 환경 준비',
      title: '내 Windows PC에서 VM에 접속할 수 있는가?',
      intro: ['0-1부터 0-3까지와 달리 이번 명령은 VM 터미널이 아니라 Windows PC의 PowerShell에서 실행한다.'] },
  ];

  const PAGES = SETUP_PAGES.concat([
    { id: 'lab-ip-br', menu: 'ip -br addr', cards: ['ip-br-addr'], group: '1단계 · 명령 익히기',
      title: '이 VM의 장치와 IP 주소 찾기',
      intro: '1단계에서는 명령의 뜻을 읽고, 내 터미널에 직접 입력하고, 나온 출력에서 값을 찾는다. 먼저 이 VM에 어떤 네트워크 장치가 있고 어떤 주소가 붙어 있는지 확인한다.' },
    { id: 'lab-ip-addr', menu: 'ip addr show dev', cards: ['ip-addr-dev'], group: '1단계 · 명령 익히기',
      title: '고른 장치의 주소 자세히 읽기',
      intro: '1-1에서 고른 장치 하나만 자세히 본다. 같은 주소가 inet 줄에 어떻게 나오는지, inet과 inet6이 어떻게 다른지 읽는다.' },
    { id: 'lab-ip-route', menu: 'ip route', cards: ['ip-route'], group: '1단계 · 명령 익히기',
      title: '기본 경로와 게이트웨이 찾기',
      intro: '패킷을 어디로 보낼지는 라우팅 테이블이 정한다. 이 VM이 자기 네트워크 밖으로 가는 패킷을 누구에게 넘기는지(기본 게이트웨이) 찾는다.' },
    { id: 'lab-route-get', menu: 'ip route get', cards: ['route-get'], group: '1단계 · 명령 익히기',
      title: '목적지 하나에 실제로 쓰이는 경로 읽기',
      intro: '목적지가 내 네트워크 밖에 있을 때와 안에 있을 때 선택되는 경로를 비교한다. 같은 서브넷으로는 via 없이 직접 보낸다.' },
  ]);

  root.LabData = { PLACES, CARDS, RULES, PAGES, EXAMPLE_ENV };
})(typeof self !== 'undefined' ? self : this);
