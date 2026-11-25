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

  const PAGES = [
    { id: 'lab-ip-br', menu: 'ip -br addr', cards: ['ip-br-addr'], group: '1단계 · 명령 익히기',
      title: '이 VM의 장치와 IP 주소 찾기',
      intro: '1단계에서는 명령의 뜻을 읽고, 내 터미널에 직접 입력하고, 나온 출력에서 값을 찾는다. 먼저 이 VM에 어떤 네트워크 장치가 있고 어떤 주소가 붙어 있는지 확인한다.' },
    { id: 'lab-ip-addr', menu: 'ip addr show dev', cards: ['ip-addr-dev'], group: '1단계 · 명령 익히기',
      title: '고른 장치의 주소 자세히 읽기',
      intro: '1-1에서 고른 장치 하나만 자세히 본다. 같은 주소가 inet 줄에 어떻게 나오는지, inet과 inet6이 어떻게 다른지 읽는다.' },
  ];

  root.LabData = { PLACES, CARDS, RULES, PAGES, EXAMPLE_ENV };
})(typeof self !== 'undefined' ? self : this);
