/*
 * tests/cases.js — 출력 분석 엔진 테스트 (node: test.js, 브라우저: test.html에서 함께 쓴다)
 *
 * 실제 출력: samples/samples-linux.txt, samples/windows.txt
 * MADE_UP(아래)의 출력은 샘플에 없는 경우를 시험하려고 직접 만든 예시다. 이름 앞에 [직접 만든 예시]를 붙인다.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AnalyzerTests = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ===== 직접 만든 예시 (실제 샘플 아님) =====
  const MADE_UP = {
    notFoundNslookup: '[jin@localhost ~]$ nslookup google.com\n-bash: nslookup: command not found\n[jin@localhost ~]$ ',
    notFoundTraceroute: 'jin@localhost:~$ traceroute -n 8.8.8.8\nbash: traceroute: command not found',
    notFoundNcSudo: '[root@localhost ~]# nc -vz -w 3 172.16.89.128 22\nbash: nc: command not found',
    notFoundWinSsh: "PS C:\\Users\\jin> ssh jin@172.16.89.128\nssh : 'ssh' 용어가 cmdlet, 함수, 스크립트 파일 또는 실행할 수 있는 프로그램 이름으로 인식되지 않습니다. 이름이 정확한지 확인하고 경로가 포함된 경우 경로가 올바른지 검증한 다음 다시 시도하십시오.",
    pingPartialLoss: 'PING 192.168.10.2 (192.168.10.2) 56(84) bytes of data.\n64 bytes from 192.168.10.2: icmp_seq=1 ttl=128 time=0.611 ms\n64 bytes from 192.168.10.2: icmp_seq=2 ttl=128 time=0.502 ms\n64 bytes from 192.168.10.2: icmp_seq=4 ttl=128 time=0.488 ms\n\n--- 192.168.10.2 ping statistics ---\n4 packets transmitted, 3 received, 25% packet loss, time 3061ms\nrtt min/avg/max/mdev = 0.488/0.533/0.611/0.055 ms',
    pingNoStats: '[jin@localhost ~]$ ping -c 4 172.16.89.2\nPING 172.16.89.2 (172.16.89.2) 56(84) bytes of data.\n64 bytes from 172.16.89.2: icmp_seq=1 ttl=128 time=0.528 ms\n64 bytes from 172.16.89.2: icmp_seq=2 ttl=128 time=0.484 ms',
    pingResolveFail: '[jin@localhost ~]$ ping -c 4 google.com\nping: google.com: Temporary failure in name resolution',
    pingUnreachable: 'PING 192.168.10.77 (192.168.10.77) 56(84) bytes of data.\nFrom 192.168.10.130 icmp_seq=1 Destination Host Unreachable\nFrom 192.168.10.130 icmp_seq=2 Destination Host Unreachable\nFrom 192.168.10.130 icmp_seq=3 Destination Host Unreachable\n\n--- 192.168.10.77 ping statistics ---\n4 packets transmitted, 0 received, +3 errors, 100% packet loss, time 3071ms\npipe 3',
    ssHeadless: 'LISTEN 0      128          0.0.0.0:22        0.0.0.0:*\nLISTEN 0      4096       127.0.0.1:631       0.0.0.0:*',
    ssCutLast: 'State  Recv-Q Send-Q Local Address:Port Peer Address:Port\nLISTEN 0      128          0.0.0.0:22        0.0.0.0:*\nLISTEN 0      4096       127.0.0.1:631',
    ssLoopback443: '[root@web ~]# ss -lnt\nState  Recv-Q Send-Q Local Address:Port Peer Address:Port\nLISTEN 0      128          0.0.0.0:22        0.0.0.0:*\nLISTEN 0      511        127.0.0.1:443       0.0.0.0:*',
    brMulti: 'lo               UNKNOWN        127.0.0.1/8 ::1/128\nens160           UP             192.168.10.130/24 fe80::20c:29ff:fe11:2233/64\nens224           UP             10.10.0.5/24 fe80::20c:29ff:fe11:4455/64\nvirbr0           DOWN           192.168.122.1/24',
    brOtherVm: 'jin@localhost:~$ ip -br addr\nlo               UNKNOWN        127.0.0.1/8 ::1/128\nens33            UP             192.168.10.130/24 fe80::20c:29ff:fe11:2233/64',
    brOnlyLo: 'lo               UNKNOWN        127.0.0.1/8 ::1/128\nens160           DOWN',
    routeOtherVm: 'default via 192.168.10.2 dev ens33 proto dhcp src 192.168.10.130 metric 100\n192.168.10.0/24 dev ens33 proto kernel scope link src 192.168.10.130 metric 100',
    routeNoDefault: '172.16.89.0/24 dev ens160 proto kernel scope link src 172.16.89.128 metric 100',
    addrNoDevice: '[jin@localhost ~]$ ip addr show dev ens33\nDevice "ens33" does not exist.',
    addrCut: '1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000\n    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00\n    inet 127.0.0.1/8 scope host lo\n2: ens160: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP group default qlen 1000',
    nsServerOnly: 'Server:\t\t172.16.89.2\nAddress:\t172.16.89.2#53\n',
    nsAnswerOnly: 'Non-authoritative answer:\nName:\tgoogle.com\nAddress: 142.250.198.142',
    nsServfail: 'Server:\t\t172.16.89.2\nAddress:\t172.16.89.2#53\n\n** server can\'t find example.broken: SERVFAIL',
    ncVersionOnly: 'Ncat: Version 7.92 ( https://nmap.org/ncat )',
    traceReached: 'traceroute to 192.0.2.20 (192.0.2.20), 30 hops max, 60 byte packets\n 1  10.0.1.1  1.123 ms  1.010 ms  0.998 ms\n 2  * * *\n 3  192.0.2.20  5.402 ms  5.311 ms  5.390 ms',
    traceCut: 'traceroute to 8.8.8.8 (8.8.8.8), 30 hops max, 60 byte packets\n 1  172.16.89.2  0.581 ms  0.236 ms  0.086 ms\n 2  * * *\n 3  * * *',
    traceNoHeader: ' 1  172.16.89.2  0.581 ms  0.236 ms  0.086 ms\n 2  * * *',
    winPingTimeout: 'PS C:\\Users\\jin> ping 172.16.89.1\n\nPing 172.16.89.1 32바이트 데이터 사용:\n요청 시간이 만료되었습니다.\n요청 시간이 만료되었습니다.\n요청 시간이 만료되었습니다.\n요청 시간이 만료되었습니다.\n\n172.16.89.1에 대한 Ping 통계:\n    패킷: 보냄 = 4, 받음 = 0, 손실 = 4 (100% 손실),',
    winPingUnreach: 'Ping 192.168.10.77 32바이트 데이터 사용:\n192.168.10.1의 응답: 대상 호스트에 연결할 수 없습니다.\n192.168.10.1의 응답: 대상 호스트에 연결할 수 없습니다.\n192.168.10.1의 응답: 대상 호스트에 연결할 수 없습니다.\n192.168.10.1의 응답: 대상 호스트에 연결할 수 없습니다.\n\n192.168.10.77에 대한 Ping 통계:\n    패킷: 보냄 = 4, 받음 = 4, 손실 = 0 (0% 손실),',
    winPingEnglish: 'Pinging 192.168.10.130 with 32 bytes of data:\nReply from 192.168.10.130: bytes=32 time<1ms TTL=64\nReply from 192.168.10.130: bytes=32 time=1ms TTL=64\nRequest timed out.\nReply from 192.168.10.130: bytes=32 time=1ms TTL=64\n\nPing statistics for 192.168.10.130:\n    Packets: Sent = 4, Received = 3, Lost = 1 (25% loss),\nApproximate round trip times in milli-seconds:\n    Minimum = 0ms, Maximum = 1ms, Average = 0ms',
    tncKoreanWarn: 'PS C:\\Users\\jin> Test-NetConnection 192.168.10.130 -Port 443\n경고: TCP connect to (192.168.10.130 : 443) failed\n경고: Ping to 192.168.10.130 failed with status: TimedOut\n\n\nComputerName           : 192.168.10.130\nRemoteAddress          : 192.168.10.130\nRemotePort             : 443\nInterfaceAlias         : VMware Network Adapter VMnet8\nSourceAddress          : 192.168.10.1\nPingSucceeded          : False\nPingReplyDetails (RTT) : 0 ms\nTcpTestSucceeded       : False',
    tncPortNoResult: 'ComputerName     : 172.16.89.128\nRemoteAddress    : 172.16.89.128\nRemotePort       : 22',
    unknownText: '안녕하세요\n이건 터미널 출력이 아닙니다',
    osRelease: 'NAME="CentOS Stream"\nVERSION="10 (Coughlan)"\nID_LIKE="rhel fedora"\nVERSION_ID="10"\nPRETTY_NAME="CentOS Stream 10 (Coughlan)"',
  };

  function runCases(A, sampleText) {
    const linux = A.parseSamples(sampleText.linux);
    const win = A.parseSamples(sampleText.win);
    const block = (set, cmd) => {
      const b = set.find(x => x.command === cmd);
      if (!b) throw new Error('샘플에 없는 명령: ' + cmd);
      return b.output;
    };
    const L = cmd => block(linux, cmd);
    const W = cmd => block(win, cmd);
    // 실제 샘플을 다른 형태로 붙여 넣은 것처럼 바꾸기
    const withPrompt = (prompt, cmd, out) => prompt + ' ' + cmd + '\n' + out + '\n' + prompt + ' ';
    const crlf = s => s.replace(/\n/g, '\r\n');

    const results = [];
    function test(name, fn) {
      const errors = [];
      const t = {
        eq(actual, expected, label) {
          const a = JSON.stringify(actual), e = JSON.stringify(expected);
          if (a !== e) errors.push((label || '') + ' 기대값 ' + e + ', 실제값 ' + a);
        },
        ok(cond, label) { if (!cond) errors.push(label || '조건이 거짓'); },
      };
      try { fn(t); } catch (err) { errors.push('예외: ' + (err && err.stack || err)); }
      results.push({ name, ok: !errors.length, errors });
    }
    const has = (arr, s) => (arr || []).some(l => l.indexOf(s) >= 0);

    // ---------- 샘플 파일 자체 ----------
    test('샘플 파일: Linux 블록 19개, Windows 블록 3개를 읽는다', t => {
      t.eq(linux.length, 19, 'Linux 블록 수');
      t.eq(win.length, 3, 'Windows 블록 수');
      t.eq(win[0].command, 'ping 172.16.89.128', 'BOM 뒤 첫 명령');
    });
    test('실제 샘플 22개 모두 명령 종류를 알아본다', t => {
      linux.concat(win).forEach(b => {
        const cmd = A.parseCommand(b.command);
        const r = A.analyze(b.output);
        const want = cmd.kind === 'ping' && b.shell === 'PS>' ? 'win-ping' : cmd.kind;
        t.eq(r.kind, want, b.command);
        const r2 = A.analyze((b.shell === 'PS>' ? 'PS C:\\Users\\jin> ' : '[jin@localhost ~]$ ') + b.command + '\n' + b.output, { expect: want });
        t.ok(r2.status !== 'other' && r2.status !== 'unknown' || want === 'traceroute', b.command + ' (명령 줄 포함) 상태: ' + r2.status);
      });
    });

    // ---------- ip -br addr ----------
    test('실제 ip -br addr: ens160 172.16.89.128/24, lo는 후보에서 뺀다', t => {
      const r = A.analyze(L('ip -br addr'), { expect: 'ip-br-addr' });
      t.eq(r.status, 'ok'); t.eq(r.values.interfaces.length, 2);
      t.eq(r.values.candidates, ['ens160']);
      t.eq(r.values.primary, { name: 'ens160', ipv4: '172.16.89.128', prefix: 24 });
      const ens = r.values.interfaces[1];
      t.eq(ens.ipv6.map(a => a.address + '/' + a.prefix), ['fe80::20c:29ff:fe8f:fd2d/64']);
      t.ok(has(r.evidence.primary, '172.16.89.128/24'), '근거 줄');
    });
    test('[직접 만든 예시] 복수 인터페이스: ens160·ens224 둘 다 후보, virbr0(DOWN)은 사용 가능 목록에서 뺀다', t => {
      const r = A.analyze(MADE_UP.brMulti);
      t.eq(r.status, 'ok'); t.eq(r.outcome, 'multiple');
      t.eq(r.values.candidates, ['ens160', 'ens224', 'virbr0']);
      t.eq(r.values.usable.map(u => u.name + '=' + u.ipv4[0]), ['ens160=192.168.10.130', 'ens224=10.10.0.5']);
      t.eq(r.values.primary, null, '하나로 정하지 않는다');
    });
    test('[직접 만든 예시] 서로 다른 VM IP: 172.16.89.128과 192.168.10.130에서 정답이 달라진다', t => {
      const a = A.analyze(L('ip -br addr'));
      const b = A.analyze(MADE_UP.brOtherVm);
      t.eq(a.values.primary.ipv4, '172.16.89.128');
      t.eq(b.values.primary.ipv4, '192.168.10.130');
      t.eq(b.values.primary.name, 'ens33');
      t.eq(b.command, 'ip -br addr', 'jin@localhost:~$ 프롬프트의 명령 줄');
      const ra = A.analyze(L('ip route')), rb = A.analyze(MADE_UP.routeOtherVm);
      t.eq([ra.values.gateway, rb.values.gateway], ['172.16.89.2', '192.168.10.2']);
    });
    test('[직접 만든 예시] lo만 IPv4가 있으면 실패 응답', t => {
      const r = A.analyze(MADE_UP.brOnlyLo);
      t.eq(r.status, 'fail'); t.eq(r.outcome, 'no-ipv4');
    });

    // ---------- ip addr ----------
    test('실제 ip addr: inet과 inet6, 접두사 길이, brd를 구분한다', t => {
      const r = A.analyze(L('ip addr'), { expect: 'ip-addr' });
      t.eq(r.status, 'ok');
      const ens = r.values.interfaces.find(i => i.name === 'ens160');
      t.eq(ens.ipv4.map(a => [a.address, a.prefix, a.brd, a.scope]), [['172.16.89.128', 24, '172.16.89.255', 'global']]);
      t.eq(ens.ipv6.map(a => [a.address, a.prefix, a.scope]), [['fe80::20c:29ff:fe8f:fd2d', 64, 'link']]);
      t.eq(ens.mac, '00:0c:29:8f:fd:2d'); t.eq(ens.state, 'UP');
      t.ok(has(r.evidence['ipv4:ens160'], 'inet 172.16.89.128/24'), '근거 줄');
      t.eq(r.values.interfaces[0].ipv4[0].address, '127.0.0.1');
    });
    test('실제 ip addr show dev ens160: 지정한 장치를 target으로 잡는다', t => {
      const r = A.analyze('[jin@localhost ~]$ ip addr show dev ens160\n' + L('ip addr show dev ens160'));
      t.eq(r.status, 'ok'); t.eq(r.values.showDev, 'ens160');
      t.eq(r.values.target && r.values.target.ipv4[0].address, '172.16.89.128');
    });
    test('[직접 만든 예시] 없는 장치(ens33) → 실패 응답', t => {
      const r = A.analyze(MADE_UP.addrNoDevice);
      t.eq(r.kind, 'ip-addr'); t.eq(r.status, 'fail'); t.eq(r.values.missingDevice, 'ens33');
    });
    test('[직접 만든 예시] ip addr 끝이 잘림 → 일부 누락 의심', t => {
      const r = A.analyze(MADE_UP.addrCut);
      t.eq(r.status, 'partial'); t.ok(r.recopy, '다시 복사 안내');
    });

    // ---------- ip route / ip route get ----------
    test('실제 ip route: 기본 게이트웨이 172.16.89.2, 장치 ens160', t => {
      const r = A.analyze(L('ip route'));
      t.eq(r.status, 'ok'); t.eq(r.values.gateway, '172.16.89.2'); t.eq(r.values.defaultDev, 'ens160'); t.eq(r.values.defaultSrc, '172.16.89.128');
      t.eq(r.values.connected, [{ network: '172.16.89.0/24', dev: 'ens160', src: '172.16.89.128' }]);
      t.ok(has(r.evidence.gateway, 'default via 172.16.89.2'), '근거 줄');
    });
    test('[직접 만든 예시] default 줄이 없으면 일부 누락 의심', t => {
      const r = A.analyze(MADE_UP.routeNoDefault);
      t.eq(r.status, 'partial'); t.eq(r.values.gateway, null);
    });
    test('실제 ip route get 8.8.8.8: via 172.16.89.2를 거친다', t => {
      const r = A.analyze(L('ip route get 8.8.8.8'), { expect: 'ip-route-get' });
      t.eq(r.status, 'ok'); t.eq(r.values.via, '172.16.89.2'); t.eq(r.values.dev, 'ens160'); t.eq(r.values.direct, false); t.eq(r.values.src, '172.16.89.128');
    });
    test('실제 ip route get 172.16.89.2: 같은 서브넷이라 via가 없다', t => {
      const r = A.analyze(L('ip route get 172.16.89.2'), { expect: 'ip-route-get' });
      t.eq(r.status, 'ok'); t.eq(r.values.via, null); t.eq(r.values.direct, true); t.eq(r.outcome, 'direct');
    });

    // ---------- nslookup ----------
    test('실제 nslookup google.com: DNS 서버와 조회 결과를 구분한다', t => {
      const r = A.analyze(L('nslookup google.com'), { expect: 'nslookup' });
      t.eq(r.status, 'ok'); t.eq(r.outcome, 'answer');
      t.eq(r.values.serverAddress, '172.16.89.2'); t.eq(r.values.port, 53);
      t.eq(r.values.ipv4, ['142.250.198.142']); t.eq(r.values.ipv6, ['2404:6800:4005:81b::200e']);
      t.ok(r.values.answers.every(a => a.address !== '172.16.89.2'), 'DNS 서버 주소가 조회 결과에 섞이지 않는다');
      t.ok(has(r.evidence.server, '172.16.89.2#53'), '서버 근거 줄');
    });
    test('실제 nslookup NXDOMAIN과 시간 초과를 구분한다', t => {
      const nx = A.analyze(L('nslookup no-such-name.invalid'));
      const to = A.analyze(L('nslookup google.com 192.0.2.1'));
      t.eq([nx.status, nx.outcome], ['fail', 'nxdomain']); t.eq(nx.values.name, 'no-such-name.invalid');
      t.eq([to.status, to.outcome], ['fail', 'timeout']); t.eq(to.values.failedServer, '192.0.2.1');
      t.ok(has(nx.evidence.outcome, 'NXDOMAIN'), 'NXDOMAIN 근거'); t.ok(has(to.evidence.outcome, 'timed out'), '시간 초과 근거');
    });
    test('[직접 만든 예시] nslookup: 서버 줄만 있음/결과만 있음 → 일부 누락, SERVFAIL → 실패 응답', t => {
      t.eq(A.analyze(MADE_UP.nsServerOnly).status, 'partial');
      const a = A.analyze(MADE_UP.nsAnswerOnly);
      t.eq(a.status, 'partial'); t.eq(a.values.ipv4, ['142.250.198.142']);
      const s = A.analyze(MADE_UP.nsServfail); t.eq([s.status, s.outcome], ['fail', 'servfail']);
    });

    // ---------- ping (Linux) ----------
    test('실제 ping 172.16.89.2 / 8.8.8.8: 4번 보내 4번 받음', t => {
      ['ping -c 4 172.16.89.2', 'ping -c 4 8.8.8.8'].forEach(c => {
        const r = A.analyze(L(c), { expect: 'ping' });
        t.eq([r.status, r.outcome, r.values.transmitted, r.values.received, r.values.replies.length], ['ok', 'all', 4, 4, 4], c);
        t.eq(r.values.ttls, [128], c + ' TTL');
        t.ok(has(r.evidence.received, '4 received'), c + ' 근거 줄');
      });
    });
    test('실제 ping 응답 없음(172.16.89.1, 192.0.2.1): 실패 응답이지만 방화벽이라고 단정하지 않는다', t => {
      ['ping -c 4 -W 1 172.16.89.1', 'ping -c 4 -W 1 192.0.2.1'].forEach(c => {
        const r = A.analyze(L(c));
        t.eq([r.status, r.outcome, r.values.received], ['fail', 'none', 0], c);
        t.ok(!/방화벽이 (막|차단)/.test(r.message), c + ' 메시지가 원인을 단정하지 않는다');
      });
    });
    test('[직접 만든 예시] ping 일부 손실: 4번 중 3번', t => {
      const r = A.analyze(MADE_UP.pingPartialLoss);
      t.eq([r.status, r.outcome, r.values.received, r.values.lossPercent], ['ok', 'some', 3, 25]);
    });
    test('[직접 만든 예시] ping 통계 줄 없음 → 일부 누락 의심', t => {
      const r = A.analyze(MADE_UP.pingNoStats);
      t.eq(r.status, 'partial'); t.eq(r.values.replies.length, 2); t.eq(r.values.received, null);
    });
    test('[직접 만든 예시] ping 이름 조회 실패, Destination Host Unreachable', t => {
      const a = A.analyze(MADE_UP.pingResolveFail);
      t.eq([a.kind, a.status, a.outcome], ['ping', 'fail', 'resolve-fail']);
      const b = A.analyze(MADE_UP.pingUnreachable);
      t.eq([b.status, b.outcome, b.values.errors, b.values.unreachable.length], ['fail', 'none', 3, 3]);
    });

    // ---------- ping (Windows) ----------
    test('실제 Windows ping(한국어): 보냄 4, 받음 4, TTL 64', t => {
      const r = A.analyze(W('ping 172.16.89.128'), { expect: 'win-ping' });
      t.eq([r.status, r.outcome, r.values.sent, r.values.received, r.values.replies.length], ['ok', 'all', 4, 4, 4]);
      t.eq(r.values.ttls, [64]); t.eq(r.values.replies[0].below, true, '시간<1ms');
      t.eq(r.values.targetIp, '172.16.89.128');
      t.ok(has(r.evidence.received, '받음 = 4'), '근거 줄');
    });
    test('[직접 만든 예시] Windows ping: 시간 만료 4번 / 연결할 수 없음을 받음으로 세는 경우 / 영어판', t => {
      const a = A.analyze(MADE_UP.winPingTimeout);
      t.eq([a.status, a.outcome, a.values.timeouts, a.command], ['fail', 'none', 4, 'ping 172.16.89.1']);
      t.ok(/ICMP/.test(a.message), 'ICMP 차단 가능성을 설명한다');
      const b = A.analyze(MADE_UP.winPingUnreach);
      t.eq([b.status, b.outcome, b.values.received, b.values.echoReplies], ['fail', 'unreachable', 4, 0]);
      const c = A.analyze(MADE_UP.winPingEnglish);
      t.eq([c.status, c.outcome, c.values.received, c.values.timeouts], ['ok', 'some', 3, 1]);
    });

    // ---------- ss ----------
    test('실제 ss -lnt: 22·631·9090, 22는 모든 주소, 631은 loopback', t => {
      const r = A.analyze(L('ss -lnt'), { expect: 'ss' });
      t.eq(r.status, 'ok'); t.eq(r.values.ports, ['22', '631', '9090']);
      const p22 = A.ssPort(r, 22), p631 = A.ssPort(r, 631), p9090 = A.ssPort(r, 9090), p443 = A.ssPort(r, 443);
      t.eq([p22.state, p22.scope], ['listening', 'all']); t.eq(p22.addresses, ['0.0.0.0:22', '[::]:22']);
      t.eq([p631.state, p631.scope], ['listening', 'loopback']);
      t.eq([p9090.state, p9090.scope], ['listening', 'all']);
      t.eq(p443.state, 'not-listening', '전체 출력에서 443이 없으면 없다고 말할 수 있다');
      t.ok(has(p22.lines, '0.0.0.0:22'), '근거 줄');
    });
    test('[직접 만든 예시] ss 일부만 복사: 제목 줄 없음 / 마지막 줄 잘림 → 443을 "없음"으로 단정하지 않는다', t => {
      const a = A.analyze(MADE_UP.ssHeadless, { expect: 'ss' });
      t.eq(a.status, 'partial'); t.eq(A.ssPort(a, 443).state, 'unknown'); t.eq(A.ssPort(a, 22).state, 'listening');
      t.ok(a.recopy && a.recopy.indexOf('State') >= 0, '다시 복사할 범위 안내');
      const b = A.analyze(MADE_UP.ssCutLast, { expect: 'ss' });
      t.eq(b.status, 'partial'); t.eq(A.ssPort(b, 9090).state, 'unknown');
    });
    test('[직접 만든 예시] ss: 127.0.0.1:443은 loopback에서만 수신 (# 프롬프트 포함)', t => {
      const r = A.analyze(MADE_UP.ssLoopback443);
      t.eq(r.status, 'ok'); t.eq(r.command, 'ss -lnt');
      const p = A.ssPort(r, 443); t.eq([p.state, p.scope], ['listening', 'loopback']);
    });

    // ---------- nc (Ncat) ----------
    test('실제 nc(Ncat): 연결 성공 / 연결 거부 / 시간 초과를 구분한다', t => {
      const ok = A.analyze('[jin@localhost ~]$ nc -vz -w 3 172.16.89.128 22\n' + L('nc -vz -w 3 172.16.89.128 22'));
      const rf = A.analyze('[jin@localhost ~]$ nc -vz -w 3 172.16.89.128 443\n' + L('nc -vz -w 3 172.16.89.128 443'));
      const to = A.analyze(L('nc -vz -w 3 192.0.2.1 22'));
      t.eq([ok.status, ok.outcome, ok.values.target, ok.values.port], ['ok', 'connected', '172.16.89.128', '22']);
      t.eq([rf.status, rf.outcome, rf.values.port], ['fail', 'refused', '443']);
      t.eq([to.status, to.outcome], ['fail', 'timeout']);
      t.ok(to.notes.some(n => n.indexOf('명령 줄') >= 0), '대상을 모르면 명령 줄 복사를 안내');
      t.ok(/로그인/.test(ok.message), '연결 성공이 로그인 성공이 아님을 설명');
    });
    test('[직접 만든 예시] nc: Version 줄만 있음 → 일부 누락 의심', t => {
      t.eq(A.analyze(MADE_UP.ncVersionOnly).status, 'partial');
    });

    // ---------- traceroute ----------
    test('실제 traceroute 172.16.89.2: 모두 * → 판정 불가', t => {
      const r = A.analyze(L('traceroute -n 172.16.89.2'));
      t.eq([r.status, r.outcome, r.values.hops.length, r.values.respondedHops.length, r.values.maxHops], ['unknown', 'no-response', 30, 0, 30]);
    });
    test('실제 traceroute 8.8.8.8: 1번 홉(172.16.89.2)만 응답 → 중간 홉만 응답', t => {
      const r = A.analyze(L('traceroute -n -w 2 8.8.8.8'), { expect: 'traceroute' });
      t.eq([r.status, r.outcome, r.values.destinationReached], ['ok', 'intermediate-only', false]);
      t.eq(r.values.respondedHops.map(h => [h.n, h.ips]), [[1, ['172.16.89.2']]]);
      t.eq(r.values.hops[0].rtts, [0.581, 0.236, 0.086]);
    });
    test('[직접 만든 예시] traceroute: 목적지 도달 / 중간에 끊김 / 머리줄 없음', t => {
      const a = A.analyze(MADE_UP.traceReached);
      t.eq([a.status, a.outcome, a.values.destinationHop], ['ok', 'reached', 3]);
      t.ok(has(a.evidence.destination, '192.0.2.20  5.402 ms'), '목적지 근거 줄');
      t.eq(A.analyze(MADE_UP.traceCut).status, 'partial');
      const c = A.analyze(MADE_UP.traceNoHeader);
      t.eq([c.kind, c.status], ['traceroute', 'partial']);
    });

    // ---------- Test-NetConnection ----------
    test('실제 Test-NetConnection 22: TCP 성공, SSH 로그인 성공으로 말하지 않는다', t => {
      const r = A.analyze(W('Test-NetConnection 172.16.89.128 -Port 22'), { expect: 'tnc' });
      t.eq([r.status, r.outcome, r.values.remotePort, r.values.tcpTestSucceeded], ['ok', 'tcp-ok', 22, true]);
      t.eq(r.values.sourceAddress, '172.16.89.1');
      t.ok(/로그인 성공.*확인한 것은 아니다/.test(r.message), '로그인과 구분');
      t.ok(has(r.evidence.tcpTestSucceeded, 'True'), '근거 줄');
    });
    test('실제 Test-NetConnection 443: TCP 실패, ping은 성공, 경고 줄을 근거로 남긴다', t => {
      const r = A.analyze(W('Test-NetConnection 172.16.89.128 -Port 443'));
      t.eq([r.status, r.outcome, r.values.pingSucceeded, r.values.tcpTestSucceeded], ['fail', 'tcp-fail', true, false]);
      t.ok(has(r.evidence.warnings, 'TCP connect to (172.16.89.128 : 443) failed'), '경고 근거 줄');
    });
    test('[직접 만든 예시] Test-NetConnection 한국어 경고와 PS 프롬프트 / TcpTestSucceeded 빠짐', t => {
      const r = A.analyze(MADE_UP.tncKoreanWarn);
      t.eq([r.status, r.outcome, r.values.pingSucceeded, r.values.warnings.length, r.command], ['fail', 'tcp-fail', false, 2, 'Test-NetConnection 192.168.10.130 -Port 443']);
      const p = A.analyze('PS C:\\Users\\jin> Test-NetConnection 172.16.89.128 -Port 22\n' + MADE_UP.tncPortNoResult);
      t.eq(p.status, 'partial');
    });

    // ---------- 빈 입력 / 다른 명령 / 판정 불가 / 도구 없음 ----------
    test('[직접 만든 예시] 빈 입력: 빈 문자열, 공백·줄바꿈만, 프롬프트만', t => {
      t.eq(A.analyze('').status, 'empty');
      t.eq(A.analyze('   \r\n\n\t\n').status, 'empty');
      t.eq(A.analyze('[jin@localhost ~]$ ').status, 'empty');
      t.eq(A.analyze(null).status, 'empty');
    });
    test('[직접 만든 예시] 명령 줄만 있고 출력 없음 → 일부 누락 의심', t => {
      const r = A.analyze('[jin@localhost ~]$ ss -lnt\n[jin@localhost ~]$ ');
      t.eq([r.kind, r.status], ['ss', 'partial']);
    });
    test('[직접 만든 예시] 다른 명령의 출력: ss를 기대했는데 ip route, ip -br addr을 기대했는데 os-release', t => {
      const a = A.analyze(L('ip route'), { expect: 'ss' });
      t.eq([a.status, a.kind], ['other', 'ip-route']); t.ok(a.recopy && a.recopy.indexOf('State') >= 0, 'ss 복사 안내');
      const b = A.analyze(MADE_UP.osRelease, { expect: 'ip-br-addr' });
      t.eq([b.status, b.kind], ['other', 'os-release']);
      const c = A.analyze(W('ping 172.16.89.128'), { expect: 'ping' });
      t.eq([c.status, c.kind], ['other', 'win-ping'], 'Linux ping 자리에 Windows ping');
    });
    test('[직접 만든 예시] 알아볼 수 없는 글 → 판정 불가', t => {
      const r = A.analyze(MADE_UP.unknownText, { expect: 'ping' });
      t.eq([r.status, r.kind], ['unknown', null]);
    });
    test('[직접 만든 예시] command not found → 도구 없음, 설치 명령 안내', t => {
      const a = A.analyze(MADE_UP.notFoundNslookup, { expect: 'nslookup' });
      t.eq([a.status, a.kind, a.values.tool, a.values.install], ['notfound', 'nslookup', 'nslookup', 'sudo dnf install -y bind-utils']);
      t.ok(has(a.evidence.tool, 'command not found'), '근거 줄');
      t.eq(A.analyze(MADE_UP.notFoundTraceroute).values.install, 'sudo dnf install -y traceroute');
      t.eq(A.analyze(MADE_UP.notFoundNcSudo).values.install, 'sudo dnf install -y nmap-ncat');
      const w = A.analyze(MADE_UP.notFoundWinSsh);
      t.eq([w.status, w.values.tool, w.values.os], ['notfound', 'ssh', 'windows']);
      t.ok(/OpenSSH/.test(w.message), 'OpenSSH 클라이언트 안내');
    });

    // ---------- 프롬프트·공백·CRLF ----------
    test('[직접 만든 예시] 프롬프트 4종 + CRLF + 탭: 결과가 원본과 같다', t => {
      const out = L('nslookup google.com');
      const base = A.analyze(out);
      ['[jin@localhost ~]$', 'jin@localhost:~$', '[root@localhost ~]#', '$'].forEach(p => {
        const r = A.analyze(crlf(withPrompt(p, 'nslookup google.com', out)));
        t.eq([r.status, r.values.serverAddress, r.values.ipv4, r.command], [base.status, '172.16.89.2', ['142.250.198.142'], 'nslookup google.com'], p);
        t.eq(r.ignoredLines.length, 2, p + ' 프롬프트 줄 2개 제외');
      });
    });
    test('[직접 만든 예시] 앞 공백·여분 빈 줄·명령 줄만(프롬프트 없이) 복사', t => {
      const out = L('ping -c 4 8.8.8.8').split('\n').map(l => '  ' + l).join('\n');
      const r = A.analyze('ping -c 4 8.8.8.8\n\n\n' + out + '\n\n');
      t.eq([r.status, r.values.received, r.command], ['ok', 4, 'ping -c 4 8.8.8.8']);
      const b = A.analyze('  ' + L('ip -br addr').replace(/\n/g, '\n   '));
      t.eq(b.values.primary && b.values.primary.ipv4, '172.16.89.128');
    });
    test('[직접 만든 예시] 두 명령을 한꺼번에 붙여 넣으면 기대한 명령 부분을 고른다', t => {
      const text = '[jin@localhost ~]$ ip route\n' + L('ip route') + '\n[jin@localhost ~]$ ss -lnt\n' + L('ss -lnt') + '\n[jin@localhost ~]$ ';
      const a = A.analyze(text, { expect: 'ip-route' });
      t.eq([a.kind, a.status, a.values.gateway], ['ip-route', 'ok', '172.16.89.2']);
      const b = A.analyze(text, { expect: 'ss' });
      t.eq([b.kind, b.status], ['ss', 'ok']);
    });
    test('재입력 후 재분석: 같은 질문에 새 출력의 값이 나온다 (이전 결과가 남지 않는다)', t => {
      const first = A.analyze(L('ip route'), { expect: 'ip-route' });
      const second = A.analyze(MADE_UP.routeOtherVm, { expect: 'ip-route' });
      const third = A.analyze(L('ip route'), { expect: 'ip-route' });
      t.eq([first.values.gateway, second.values.gateway, third.values.gateway], ['172.16.89.2', '192.168.10.2', '172.16.89.2']);
    });

    const passed = results.filter(r => r.ok).length;
    return { results, passed, failed: results.length - passed, total: results.length };
  }

  return { runCases, MADE_UP };
});
