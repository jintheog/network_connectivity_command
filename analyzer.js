/*
 * analyzer.js — 터미널 출력 분석 엔진 (SPEC 6장)
 *
 * 화면 코드와 분리된 파일이다. 붙여 넣은 출력은 텍스트로만 다루고, 네트워크 요청을 하지 않는다.
 * 브라우저에서는 window.NetAnalyzer, node에서는 require('./analyzer.js')로 쓴다.
 *
 *   NetAnalyzer.analyze(text, {expect})  → 분석 결과 1개
 *   NetAnalyzer.ssPort(ssResult, port)   → ss 결과에서 특정 포트의 수신 여부 ('listening' | 'not-listening' | 'unknown')
 *   NetAnalyzer.parseSamples(text)       → "### $ 명령" / "### PS> 명령" 블록 목록
 *
 * 출력 형식의 기준은 samples/samples-linux.txt(CentOS Stream 10)와 samples/windows.txt(한국어 Windows)다.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NetAnalyzer = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STATUS = {
    ok: '정상',
    fail: '실패 응답',
    empty: '빈 입력',
    other: '다른 명령의 출력',
    partial: '일부 누락 의심',
    notfound: '도구 없음',
    unknown: '판정 불가',
  };

  // 분석 대상 명령. recopy는 출력이 부족할 때 다시 복사할 범위 안내다.
  const KINDS = {
    'ip-br-addr': { label: 'ip -br addr', recopy: '첫 장치 줄(보통 lo로 시작)부터 마지막 장치 줄까지 복사한다.' },
    'ip-addr': { label: 'ip addr', recopy: '"1: lo:"처럼 번호로 시작하는 첫 줄부터 마지막 valid_lft 줄까지 복사한다.' },
    'ip-route': { label: 'ip route', recopy: 'default로 시작하는 줄부터 마지막 경로 줄까지 복사한다.' },
    'ip-route-get': { label: 'ip route get', recopy: '목적지 IP로 시작하는 줄과 그 아래 cache 줄까지 복사한다.' },
    nslookup: { label: 'nslookup', recopy: 'Server: 줄부터 마지막 Address: 줄까지 복사한다. 오류가 나왔다면 ** 또는 ;; 로 시작하는 줄까지 복사한다.' },
    ping: { label: 'ping (Linux)', recopy: 'PING으로 시작하는 첫 줄부터 "packets transmitted"가 들어 있는 통계 줄(그 아래 rtt 줄이 있으면 그 줄)까지 복사한다.' },
    'win-ping': { label: 'ping (Windows)', recopy: '"Ping ... 데이터 사용:" 줄부터 "패킷: 보냄 = ..." 통계 줄(그 아래 최소·최대·평균 줄이 있으면 그 줄)까지 복사한다.' },
    ss: { label: 'ss -lnt', recopy: 'State로 시작하는 제목 줄부터 마지막 LISTEN 줄까지 빠짐없이 복사한다.' },
    nc: { label: 'nc (Ncat)', recopy: '"Ncat: Version" 줄부터 마지막 Ncat: 줄까지 복사한다.' },
    traceroute: { label: 'traceroute', recopy: '"traceroute to" 줄부터 마지막 홉 줄(목적지가 나온 줄 또는 마지막 번호 줄)까지 복사한다.' },
    tnc: { label: 'Test-NetConnection', recopy: 'ComputerName 줄부터 TcpTestSucceeded 줄까지 복사한다. 그 위에 경고 줄이 있으면 함께 복사한다.' },
    // 분석 대상은 아니지만 '다른 명령의 출력'을 알아보기 위해 구분하는 종류
    'os-release': { label: 'cat /etc/os-release', other: true },
    ipconfig: { label: 'ipconfig (Windows)', other: true },
    tracert: { label: 'tracert (Windows)', other: true },
  };

  // command not found일 때 안내할 패키지
  const PACKAGES = {
    nslookup: 'bind-utils', dig: 'bind-utils', host: 'bind-utils',
    traceroute: 'traceroute', nc: 'nmap-ncat', ncat: 'nmap-ncat',
    ss: 'iproute', ip: 'iproute', ping: 'iputils',
  };
  const TOOL_KIND = { nslookup: 'nslookup', traceroute: 'traceroute', nc: 'nc', ncat: 'nc', ss: 'ss', ip: null, ping: 'ping', 'test-netconnection': 'tnc', tnc: 'tnc' };

  // ---------- 공통 도구 ----------
  const isV4 = s => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(s) && s.split('.').every(n => +n <= 255);
  const isV6 = s => /^[0-9a-fA-F:]*:[0-9a-fA-F:.]*(%\S+)?$/.test(s) && /[0-9a-fA-F]|::/.test(s);
  const isIp = s => isV4(s) || isV6(s);
  const family = s => (isV4(s) ? 4 : isV6(s) ? 6 : null);
  const isLoopback = s => /^127\./.test(s) || s === '::1';
  const isWildcard = s => s === '0.0.0.0' || s === '::' || s === '*';

  function cidr(tok) {
    const m = /^([^/\s]+)\/(\d{1,3})$/.exec(tok);
    if (!m || !isIp(m[1])) return null;
    return { address: m[1], prefix: +m[2], family: family(m[1]) };
  }

  // "a via b dev c" 같은 키워드-값 쌍 읽기
  function keywords(rest, keys) {
    const t = rest.trim().split(/\s+/).filter(Boolean);
    const out = {};
    for (let i = 0; i < t.length; i++) if (keys.indexOf(t[i]) >= 0 && i + 1 < t.length) out[t[i]] = t[++i];
    return out;
  }

  // ---------- 입력 정리: BOM·CRLF·프롬프트·명령 줄 ----------
  const PROMPTS = [
    /^###\s+(?:\$|#|PS>)\s*(.*)$/,                // 샘플 파일 머리줄
    /^\[[^\]\s]+@[^\]]+\][$#]\s?(.*)$/,           // [jin@localhost ~]$ 명령, [root@localhost ~]# 명령
    /^[\w.-]+@[\w.-]+:[^\s$#]*[$#]\s?(.*)$/,      // jin@localhost:~$ 명령
    /^PS [A-Za-z]:\\[^>]*>\s?(.*)$/,              // PS C:\Users\jin> 명령
    /^PS>\s?(.*)$/,
    /^[$#](?:\s+(.*))?$/,                         // $ 명령, # 명령
  ];
  const BARE_COMMAND = /^(?:sudo\s+)?(?:ip|nslookup|ping|ss|nc|ncat|traceroute|cat|ssh|dig|tracert|ipconfig)(?:\s|$)|^(?:Test-NetConnection|tnc)(?:\s|$)/i;
  const BARE_COMMAND_CS = /^(?:sudo\s+)?(?:ip|nslookup|ping|ss|nc|ncat|traceroute|cat|ssh|dig|tracert|ipconfig)(?:\s|$)/;

  function splitLines(text) {
    return String(text == null ? '' : text)
      .replace(/^\uFEFF/, '')
      .replace(/\r\n?/g, '\n')
      .replace(/\u00a0/g, ' ')
      .split('\n')
      .map(l => l.replace(/\s+$/, ''));
  }

  function matchPrompt(line) {
    const s = line.replace(/^\s+/, '');
    for (const re of PROMPTS) {
      const m = re.exec(s);
      if (m) return { command: (m[1] || '').trim() };
    }
    return null;
  }

  // 프롬프트 줄마다 구간을 나눈다. 각 구간 = {command, lines}
  function segment(text) {
    const segs = [{ command: null, lines: [], promptLines: [] }];
    const removed = [];
    splitLines(text).forEach(raw => {
      const p = matchPrompt(raw);
      if (p) {
        removed.push(raw);
        if (p.command) segs.push({ command: p.command, lines: [], promptLines: [raw] });
        else segs[segs.length - 1].promptLines.push(raw);
        return;
      }
      if (raw.trim() === '^C') { removed.push(raw); return; }
      segs[segs.length - 1].lines.push(raw);
    });
    // 프롬프트 없이 명령만 복사한 첫 줄 처리 (Linux 명령은 소문자만 인정: "PING", "Ping"은 출력이다)
    const first = segs[0];
    const idx = first.lines.findIndex(l => l.trim());
    if (idx >= 0) {
      const t = first.lines[idx].trim();
      if (BARE_COMMAND_CS.test(t) || /^(?:Test-NetConnection|tnc)(?:\s|$)/i.test(t)) {
        if (looksLikeCommand(t)) {
          removed.push(first.lines[idx]);
          first.command = t;
          first.lines.splice(idx, 1);
        }
      }
    }
    return { segments: segs, removed };
  }
  function looksLikeCommand(t) {
    // "ping: google.com: Name or service not known"는 명령 줄이 아니다
    return BARE_COMMAND.test(t) && !/^\S+:\s/.test(t) && !/^traceroute to /.test(t);
  }

  // ---------- 명령 줄 해석 ----------
  function positional(args, withValue) {
    const pos = [], opts = {};
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (/^-/.test(a)) {
        const name = a.replace(/^-+/, '');
        if (withValue.indexOf(name) >= 0 && i + 1 < args.length) opts[name] = args[++i];
        else opts[name] = true;
      } else pos.push(a);
    }
    return { pos, opts };
  }

  function parseCommand(cmd) {
    if (!cmd) return null;
    let t = cmd.trim().split(/\s+/);
    if (t[0] === 'sudo') t = t.slice(1);
    const tool = t[0] || '';
    const args = t.slice(1);
    const info = { text: cmd.trim(), tool, kind: null };
    const low = tool.toLowerCase();
    if (tool === 'ip') {
      const { pos, opts } = positional(args, []);
      const obj = pos[0] || '';
      if (/^a(d(d(r(e(s(s)?)?)?)?)?)?$/.test(obj)) {
        info.kind = opts.br || opts.brief ? 'ip-br-addr' : 'ip-addr';
        const rest = pos.slice(1).filter(p => !/^(show|list|lst|sh|ls)$/.test(p));
        const di = rest.indexOf('dev');
        info.dev = di >= 0 ? rest[di + 1] || null : rest[0] || null;
      } else if (/^r(o(u(t(e)?)?)?)?$/.test(obj)) {
        if (pos[1] === 'get') { info.kind = 'ip-route-get'; info.target = pos[2] || null; }
        else info.kind = 'ip-route';
      }
    } else if (tool === 'nslookup') {
      const { pos } = positional(args, []);
      info.kind = 'nslookup'; info.name = pos[0] || null; info.server = pos[1] || null;
    } else if (low === 'ping') {
      const { pos, opts } = positional(args, ['c', 'W', 'w', 'i', 's', 't', 'I', 'Q', 'M', 'l', 'n', 'l']);
      info.kind = 'ping'; info.target = pos[pos.length - 1] || null;
      info.count = opts.c ? +opts.c : opts.n ? +opts.n : null;
    } else if (tool === 'ss') {
      info.kind = 'ss'; info.flags = args.join(' ');
    } else if (tool === 'nc' || tool === 'ncat') {
      const { pos, opts } = positional(args, ['w', 'i', 'p', 's', 'x', 'X', 'e', 'c', 'm', 'd']);
      info.kind = 'nc'; info.target = pos[0] || null; info.port = pos[1] || null; info.wait = opts.w || null;
    } else if (tool === 'traceroute') {
      const { pos } = positional(args, ['w', 'q', 'm', 'f', 'p', 's', 'i', 'N', 'z', 't', 'g']);
      info.kind = 'traceroute'; info.target = pos[0] || null;
    } else if (low === 'test-netconnection' || low === 'tnc') {
      const { pos, opts } = positional(args, ['ComputerName', 'computername', 'Port', 'port', 'CommonTCPPort', 'commontcpport', 'InformationLevel']);
      info.kind = 'tnc';
      info.target = opts.ComputerName || opts.computername || pos[0] || null;
      info.port = opts.Port || opts.port || null;
    } else if (tool === 'cat' && args.some(a => /os-release$/.test(a))) info.kind = 'os-release';
    else if (low === 'ipconfig') info.kind = 'ipconfig';
    else if (low === 'tracert') info.kind = 'tracert';
    return info;
  }

  // ---------- 도구 없음 ----------
  // CentOS의 command-not-found 도우미는 "command not found..."처럼 끝에 점을 붙이고,
  // "Install package 'x' to provide command 'y'? [N/y]" 또는 "Similar command is: 'z'" 줄을 이어 붙인다.
  function findNotFound(lines) {
    let found = null;
    for (const l of lines) {
      const s = l.trim();
      let m;
      if (!found) {
        m = /^(?:-?[\w/]*sh:\s+)?(?:line \d+:\s+)?(?:sudo:\s+)?(\S+?):\s+command not found\.*$/.exec(s);
        if (m) { found = { tool: m[1], line: l, os: 'linux', extra: [] }; continue; }
        m = /'([^']+)'\s*용어가\s*cmdlet/.exec(s) || /The term '([^']+)' is not recognized/.exec(s) ||
          /^'([^']+)'은\(는\) 내부 또는 외부 명령/.exec(s) || /^'([^']+)' is not recognized as an internal or external command/.exec(s) ||
          /ObjectNotFound:\s*\(([^:)]+):String\).*CommandNotFoundException/.exec(s);
        if (m) { found = { tool: m[1], line: l, os: 'windows', extra: [] }; continue; }
      } else if (found.os === 'linux') {
        if ((m = /^Install package '([^']+)' to provide command '([^']+)'\?/.exec(s))) { found.helperPackage = m[1]; found.extra.push(l); continue; }
        if ((m = /^Similar commands? (?:is|are):?\s*(.*)$/.exec(s))) { found.similar = m[1].replace(/'/g, '').trim() || null; found.extra.push(l); continue; }
        if (/^'[^']+'$/.test(s) && found.similar === null) { found.similar = s.replace(/'/g, ''); found.extra.push(l); continue; }
      }
    }
    return found;
  }

  // ---------- 출력 모양으로 명령 알아보기 ----------
  const DETECT = [
    ['tnc', /^\s*(TcpTestSucceeded|ComputerName|RemoteAddress|PingSucceeded|RemotePort)\s*:/],
    ['nc', /^Ncat: |^Connection to \S+ \S+ port \[|^nc: connect to /],
    ['tracert', /^(\S+(으)?로 가는 경로 추적|Tracing route to |최대 \d+홉 이상의)/],
    ['ipconfig', /Windows IP (구성|Configuration)|IPv4 (주소|Address)[ .]*:/],
    ['win-ping', /^(Ping \S+ (\[\S+\] )?\d+바이트 데이터 사용|Pinging \S+)|의 응답: |^Reply from |패킷: 보냄 =|Packets: Sent =|^요청 시간이 만료되었습니다|^Request timed out|Ping 요청에서 |^Ping request could not find/],
    ['ping', /^PING \S+|packets transmitted|^\d+ bytes from .*icmp_seq=|^ping: |^From \S+.* icmp_seq=/],
    ['traceroute', /^traceroute to |^\s*\d+\s+(\*(\s+\*)*\s*$|[\d.]+\s+[\d.]+ ms|[0-9a-fA-F:]+:[0-9a-fA-F:]*\s+[\d.]+ ms|\S+ \([\d.:a-fA-F]+\)\s+[\d.]+ ms)/],
    ['nslookup', /^Server:\s|^Address:\s+\S+#\d+|server can't find|^;; (communications error|connection timed out|no servers)|^Non-authoritative answer:|^\*\*\* Can't find|canonical name =/],
    ['ss', /^(Netid\s+)?State\s+Recv-Q\s+Send-Q|^(?:(?:tcp|udp)\s+)?(LISTEN|ESTAB|UNCONN|TIME-WAIT|SYN-SENT|SYN-RECV|CLOSE-WAIT)\s+\d+\s+\d+\s/],
    ['ip-addr', /^\d+:\s+[^:\s]+:\s+<|^\s*inet6?\s+\S+\/\d+\s.*\bscope\b|^\s*link\/(ether|loopback|none)\b|^Device ".+" does not exist/],
    ['ip-br-addr', /^\S+\s+(UP|DOWN|UNKNOWN|DORMANT|LOWERLAYERDOWN|NOTPRESENT)(\s|$)/],
    ['ip-route', /^(default\s+via\s|default\s+dev\s|\S+\s+(via\s+\S+\s+)?dev\s+\S+)|^RTNETLINK answers:/],
    ['os-release', /^(NAME|PRETTY_NAME|VERSION_ID|ID_LIKE|ID)=/],
  ];

  function detect(lines) {
    const text = lines.map(l => l.trim()).filter(Boolean);
    for (const [kind, re] of DETECT) {
      if (text.some(l => re.test(l))) {
        if (kind === 'ip-route' && text.some(l => /\buid\s+\d+\b/.test(l) || l.trim() === 'cache')) return 'ip-route-get';
        return kind;
      }
    }
    return null;
  }

  // ---------- 결과 만들기 도구 ----------
  function newRes() {
    return { status: 'ok', outcome: null, values: {}, evidence: {}, notes: [], message: '', unparsed: [] };
  }
  function ev(r, key, line) {
    if (line == null) return;
    (r.evidence[key] = r.evidence[key] || []);
    if (r.evidence[key].indexOf(line) < 0) r.evidence[key].push(line);
  }
  const nonEmpty = lines => lines.filter(l => l.trim());

  // ---------- ip -br addr ----------
  function parseIpBr(lines) {
    const r = newRes();
    const re = /^\s*(\S+?)(?:@\S+)?\s+(UP|DOWN|UNKNOWN|DORMANT|LOWERLAYERDOWN|NOTPRESENT|TESTING)\b\s*(.*)$/;
    const ifs = [];
    nonEmpty(lines).forEach(l => {
      const m = re.exec(l);
      if (!m) { r.unparsed.push(l); return; }
      const it = { name: m[1], state: m[2], ipv4: [], ipv6: [], line: l };
      m[3].split(/\s+/).filter(Boolean).forEach(tok => {
        const a = cidr(tok);
        if (a) (a.family === 4 ? it.ipv4 : it.ipv6).push(a);
      });
      it.loopback = it.name === 'lo' || (it.ipv4.concat(it.ipv6).length > 0 && it.ipv4.concat(it.ipv6).every(a => isLoopback(a.address)));
      ifs.push(it);
    });
    const candidates = ifs.filter(i => !i.loopback);
    const usable = candidates.filter(i => i.ipv4.length && i.state !== 'DOWN');
    r.values = {
      interfaces: ifs,
      candidates: candidates.map(i => i.name),
      usable: usable.map(i => ({ name: i.name, ipv4: i.ipv4.map(a => a.address), prefix: i.ipv4.map(a => a.prefix) })),
      primary: usable.length === 1 ? { name: usable[0].name, ipv4: usable[0].ipv4[0].address, prefix: usable[0].ipv4[0].prefix } : null,
    };
    ifs.forEach(i => ev(r, 'interface:' + i.name, i.line));
    if (r.values.primary) ev(r, 'primary', usable[0].line);
    if (!ifs.some(i => i.name === 'lo')) r.notes.push('lo 줄이 보이지 않는다. 출력의 첫 줄부터 복사했는지 확인한다.');
    if (!usable.length) {
      r.status = 'fail'; r.outcome = 'no-ipv4';
      r.message = 'lo가 아닌 장치 가운데 켜져 있고(UP) IPv4 주소가 붙은 장치가 없다. VM이 네트워크에 연결되지 않았거나, 출력 일부만 복사했다.';
    } else {
      r.outcome = usable.length > 1 ? 'multiple' : 'single';
      r.message = usable.length > 1
        ? 'IPv4 주소가 있는 장치가 ' + usable.length + '개다. 점검할 장치를 골라야 한다.'
        : usable[0].name + ' 장치의 IPv4 주소는 ' + usable[0].ipv4[0].address + '이고 접두사 길이는 /' + usable[0].ipv4[0].prefix + '다.';
    }
    return r;
  }

  // ---------- ip addr / ip addr show dev ----------
  function parseIpAddr(lines, cmd) {
    const r = newRes();
    const ifs = [];
    let cur = null, orphan = false;
    for (const l of nonEmpty(lines)) {
      let m;
      if ((m = /^Device "(.+)" does not exist\.?$/.exec(l.trim()))) {
        r.status = 'fail'; r.outcome = 'no-device'; r.values.missingDevice = m[1]; ev(r, 'missingDevice', l);
        r.message = '"' + m[1] + '" 장치가 없다. ip -br addr로 장치 이름을 다시 확인한다.';
        continue;
      }
      if ((m = /^(\d+):\s+([^:\s@]+)(?:@[^:\s]+)?:\s+<([^>]*)>(.*)$/.exec(l))) {
        const st = /\bstate (\S+)/.exec(m[4]); const mtu = /\bmtu (\d+)/.exec(m[4]);
        cur = { index: +m[1], name: m[2], flags: m[3].split(','), state: st ? st[1] : null, mtu: mtu ? +mtu[1] : null, mac: null, ipv4: [], ipv6: [], altnames: [], line: l, hasLink: false };
        ifs.push(cur); continue;
      }
      if ((m = /^\s*link\/(\S+)(?:\s+(\S+))?/.exec(l))) {
        if (!cur) { orphan = true; continue; }
        cur.hasLink = true; if (m[1] === 'ether') cur.mac = m[2] || null; continue;
      }
      if ((m = /^\s*inet\s+([\d.]+)\/(\d+)(.*)$/.exec(l))) {
        if (!cur) { orphan = true; r.unparsed.push(l); continue; }
        const brd = /\bbrd (\S+)/.exec(m[3]); const sc = /\bscope (\S+)/.exec(m[3]);
        cur.ipv4.push({ address: m[1], prefix: +m[2], brd: brd ? brd[1] : null, scope: sc ? sc[1] : null, dynamic: /\bdynamic\b/.test(m[3]), line: l });
        continue;
      }
      if ((m = /^\s*inet6\s+(\S+)\/(\d+)(.*)$/.exec(l))) {
        if (!cur) { orphan = true; r.unparsed.push(l); continue; }
        const sc = /\bscope (\S+)/.exec(m[3]);
        cur.ipv6.push({ address: m[1], prefix: +m[2], scope: sc ? sc[1] : null, line: l });
        continue;
      }
      if ((m = /^\s*altname\s+(\S+)/.exec(l))) { if (cur) cur.altnames.push(m[1]); continue; }
      if (/^\s*valid_lft\b/.test(l)) continue;
      r.unparsed.push(l);
    }
    ifs.forEach(i => {
      i.loopback = i.name === 'lo' || i.flags.indexOf('LOOPBACK') >= 0;
      ev(r, 'interface:' + i.name, i.line);
      i.ipv4.forEach(a => ev(r, 'ipv4:' + i.name, a.line));
      i.ipv6.forEach(a => ev(r, 'ipv6:' + i.name, a.line));
    });
    const dev = cmd && cmd.dev ? cmd.dev : null;
    const target = dev ? ifs.find(i => i.name === dev) || null : null;
    const usable = ifs.filter(i => !i.loopback && i.ipv4.length);
    r.values = Object.assign(r.values, {
      interfaces: ifs,
      showDev: dev,
      target: target,
      candidates: ifs.filter(i => !i.loopback).map(i => i.name),
      usable: usable.map(i => ({ name: i.name, ipv4: i.ipv4.map(a => a.address), prefix: i.ipv4.map(a => a.prefix) })),
    });
    if (r.status === 'fail') return r;
    if (!ifs.length) {
      r.status = 'partial';
      r.message = '번호로 시작하는 장치 머리줄(예: "2: ens160: <...>")이 없다. 주소 줄이 어느 장치의 것인지 알 수 없다.';
      return r;
    }
    const last = ifs[ifs.length - 1];
    if (orphan || !last.hasLink) {
      r.status = 'partial';
      r.message = orphan ? '장치 머리줄 없이 주소 줄만 있는 부분이 있다. 앞부분이 빠졌을 수 있다.' : last.name + ' 장치의 아랫줄(link/, inet)이 보이지 않는다. 뒷부분이 빠졌을 수 있다.';
      return r;
    }
    if (dev && !target) {
      r.status = 'partial';
      r.message = '명령에서 지정한 ' + dev + ' 장치의 내용이 출력에 없다.';
      return r;
    }
    const focus = target ? [target] : usable;
    if (!focus.length || !focus.some(i => i.ipv4.length)) {
      r.status = 'fail'; r.outcome = 'no-ipv4';
      r.message = (target ? target.name + ' 장치에' : 'lo가 아닌 장치에') + ' IPv4 주소(inet 줄)가 없다.';
    } else {
      r.outcome = focus.length > 1 ? 'multiple' : 'single';
      const f = focus[0];
      r.message = focus.length > 1 ? 'IPv4 주소가 있는 장치가 ' + focus.length + '개다.' : f.name + ' 장치의 inet 줄에 IPv4 주소 ' + f.ipv4[0].address + '/' + f.ipv4[0].prefix + '가 있다.';
    }
    return r;
  }

  // ---------- ip route ----------
  const ROUTE_RE = /^\s*(?:(unicast|local|broadcast|unreachable|blackhole|prohibit|throw|multicast)\s+)?(default|[\da-fA-F:.]+(?:\/\d+)?)\s+(.*)$/;
  const ROUTE_KEYS = ['via', 'dev', 'proto', 'scope', 'src', 'metric', 'table', 'uid'];
  function parseRouteLine(l) {
    const m = ROUTE_RE.exec(l);
    if (!m || (m[2] !== 'default' && !isIp(m[2].split('/')[0]))) return null;
    const k = keywords(m[3], ROUTE_KEYS);
    return { type: m[1] || 'unicast', dest: m[2], via: k.via || null, dev: k.dev || null, proto: k.proto || null, scope: k.scope || null, src: k.src || null, metric: k.metric != null ? +k.metric : null, uid: k.uid != null ? +k.uid : null, line: l };
  }

  function parseIpRoute(lines) {
    const r = newRes();
    const routes = [];
    nonEmpty(lines).forEach(l => {
      if (/^RTNETLINK answers:/.test(l.trim())) { r.status = 'fail'; r.outcome = 'error'; r.message = l.trim(); ev(r, 'error', l); return; }
      const x = parseRouteLine(l);
      if (x) routes.push(x); else r.unparsed.push(l);
    });
    const defs = routes.filter(x => x.dest === 'default').sort((a, b) => (a.metric || 0) - (b.metric || 0));
    const def = defs[0] || null;
    r.values = {
      routes,
      defaults: defs,
      gateway: def ? def.via : null,
      defaultDev: def ? def.dev : null,
      defaultSrc: def ? def.src : null,
      connected: routes.filter(x => x.dest !== 'default' && !x.via).map(x => ({ network: x.dest, dev: x.dev, src: x.src })),
    };
    routes.forEach(x => ev(r, 'route:' + x.dest, x.line));
    if (def) { ev(r, 'gateway', def.line); ev(r, 'defaultDev', def.line); }
    if (r.status === 'fail') return r;
    if (!def) {
      r.status = 'partial';
      r.message = 'default로 시작하는 줄이 없다. 기본 경로가 없는 장비이거나, 출력 일부만 복사했다.';
    } else {
      r.outcome = def.via ? 'gateway' : 'direct';
      r.message = '기본 경로는 ' + (def.via ? 'via ' + def.via + '(기본 게이트웨이)' : '게이트웨이 없이') + ' dev ' + def.dev + '로 나간다.';
      if (defs.length > 1) r.notes.push('default 줄이 ' + defs.length + '개다. metric 값이 가장 작은 줄이 먼저 쓰인다.');
    }
    return r;
  }

  // ---------- ip route get ----------
  function parseIpRouteGet(lines, cmd) {
    const r = newRes();
    let route = null, cache = false;
    nonEmpty(lines).forEach(l => {
      const t = l.trim();
      if (/^RTNETLINK answers:/.test(t)) { r.status = 'fail'; r.outcome = /unreachable/i.test(t) ? 'unreachable' : 'error'; ev(r, 'error', l); r.message = t + ' — 이 목적지로 보낼 경로가 없다.'; return; }
      if (/^Error:/.test(t)) { r.status = 'fail'; r.outcome = 'error'; ev(r, 'error', l); r.message = t; return; }
      if (t === 'cache' || /^cache\b/.test(t)) { cache = true; return; }
      const x = parseRouteLine(l);
      if (x && !route) route = x; else r.unparsed.push(l);
    });
    r.values = {
      destination: route ? route.dest : (cmd && cmd.target) || null,
      via: route ? route.via : null,
      dev: route ? route.dev : null,
      src: route ? route.src : null,
      direct: route ? !route.via : null,
      routeType: route ? route.type : null,
    };
    if (route) ['destination', 'via', 'dev', 'src', 'direct'].forEach(k => ev(r, k, route.line));
    if (r.status === 'fail') return r;
    if (!route) { r.status = 'partial'; r.message = '목적지로 시작하는 경로 줄이 없다.'; return r; }
    if (cmd && cmd.target && cmd.target !== route.dest) r.notes.push('명령의 목적지(' + cmd.target + ')와 출력의 목적지(' + route.dest + ')가 다르다.');
    if (!cache) r.notes.push('cache 줄이 보이지 않는다. 경로 줄은 읽을 수 있다.');
    r.outcome = route.via ? 'via-gateway' : 'direct';
    r.message = route.via
      ? route.dest + '로 가는 패킷은 게이트웨이 ' + route.via + '를 거쳐 ' + route.dev + ' 장치로 나간다.'
      : route.dest + '는 같은 네트워크에 있어 게이트웨이(via) 없이 ' + route.dev + ' 장치로 직접 보낸다.';
    return r;
  }

  // ---------- nslookup ----------
  function parseNslookup(lines, cmd) {
    const r = newRes();
    const v = { server: null, serverAddress: null, port: null, name: (cmd && cmd.name) || null, answers: [], cnames: [], authoritative: null, outcome: null, failedServer: null, errorCode: null };
    let seenAnswer = false, curName = null, serverLine = null;
    nonEmpty(lines).forEach(l => {
      const t = l.trim();
      let m;
      if ((m = /^Server:\s+(\S+)/.exec(t))) { v.server = m[1]; serverLine = l; ev(r, 'server', l); return; }
      if ((m = /^Address:\s+(\S+?)(?:#(\d+))?$/.exec(t)) && !seenAnswer && !curName) {
        v.serverAddress = m[1]; v.port = m[2] ? +m[2] : 53; ev(r, 'server', l); return;
      }
      if (/^Non-authoritative answer:/.test(t)) { v.authoritative = false; seenAnswer = true; ev(r, 'answers', l); return; }
      if ((m = /^Name:\s+(\S+)/.exec(t))) { curName = m[1].replace(/\.$/, ''); seenAnswer = true; if (!v.name) v.name = curName; return; }
      if ((m = /^Address(?:es)?:\s+(\S+)$/.exec(t)) && (seenAnswer || curName)) {
        v.answers.push({ name: curName, address: m[1], family: family(m[1]), line: l }); ev(r, 'answers', l); return;
      }
      if ((m = /^(\S+?)\.?\s+canonical name = (\S+?)\.?$/.exec(t))) { v.cnames.push({ alias: m[1], target: m[2], line: l }); seenAnswer = true; ev(r, 'answers', l); return; }
      if ((m = /^(\S+)\s+name = (\S+?)\.?$/.exec(t))) { v.answers.push({ name: m[1], address: null, ptr: m[2], family: null, line: l }); seenAnswer = true; ev(r, 'answers', l); return; }
      if ((m = /^\*\* server can't find (\S+?):\s*(\S+)/.exec(t))) {
        v.name = v.name || m[1]; v.errorCode = m[2];
        v.outcome = m[2] === 'NXDOMAIN' ? 'nxdomain' : m[2] === 'SERVFAIL' ? 'servfail' : m[2] === 'REFUSED' ? 'refused' : 'error';
        ev(r, 'outcome', l); return;
      }
      if ((m = /^\*\*\* Can't find (\S+?):\s*No answer/.exec(t))) { v.outcome = 'noanswer'; ev(r, 'outcome', l); return; }
      if ((m = /^;; communications error to (\S+?)#(\d+): (.+)$/.exec(t))) {
        v.failedServer = m[1]; v.port = +m[2];
        if (!v.outcome) v.outcome = /timed out/.test(m[3]) ? 'timeout' : /refused/.test(m[3]) ? 'refused' : 'error';
        ev(r, 'outcome', l); return;
      }
      if (/^;; (connection timed out; )?no servers could be reached/.test(t)) { v.outcome = v.outcome || 'timeout'; ev(r, 'outcome', l); return; }
      if (/^;; Got recursion not available/.test(t) || /^;;/.test(t)) { ev(r, 'outcome', l); return; }
      r.unparsed.push(l);
    });
    if (!v.outcome && v.answers.length) v.outcome = 'answer';
    v.ipv4 = v.answers.filter(a => a.family === 4).map(a => a.address);
    v.ipv6 = v.answers.filter(a => a.family === 6).map(a => a.address);
    r.values = v; r.outcome = v.outcome;
    const MSG = {
      nxdomain: 'DNS 서버가 응답했지만 "' + v.name + '"라는 이름은 없다고 답했다(NXDOMAIN).',
      timeout: '정해진 시간 안에 DNS 서버' + (v.failedServer ? '(' + v.failedServer + ')' : '') + '에서 아무 응답도 받지 못했다. 이름이 없다는 뜻이 아니다.',
      servfail: 'DNS 서버가 응답했지만 조회를 끝내지 못했다고 답했다(SERVFAIL).',
      refused: 'DNS 서버가 조회 요청을 거절했다(REFUSED).',
      noanswer: 'DNS 서버가 응답했지만 요청한 종류의 주소가 없다고 답했다.',
      error: 'DNS 조회에서 오류가 났다.',
    };
    if (v.outcome === 'answer') {
      if (!serverLine) {
        r.status = 'partial';
        r.message = '조회 결과 주소는 보이지만 Server:/Address:#53 줄이 없어 질의한 DNS 서버를 알 수 없다.';
      } else {
        r.message = 'DNS 서버 ' + (v.serverAddress || v.server) + '에 물어 ' + v.name + '의 주소 ' + v.answers.map(a => a.address || a.ptr).join(', ') + '를 받았다.';
      }
    } else if (v.outcome) {
      r.status = 'fail'; r.message = MSG[v.outcome];
    } else {
      r.status = 'partial';
      r.message = 'DNS 서버 줄은 있지만 조회 결과(Name:/Address:)나 오류 줄이 없다.';
    }
    return r;
  }

  // ---------- ping (Linux iputils) ----------
  function parsePing(lines, cmd) {
    const r = newRes();
    const v = { target: (cmd && cmd.target) || null, targetIp: null, requested: cmd && cmd.count, transmitted: null, received: null, errors: 0, lossPercent: null, replies: [], unreachable: [], ttls: [], rtt: null };
    let stats = false, header = false;
    nonEmpty(lines).forEach(l => {
      const t = l.trim();
      let m;
      if ((m = /^PING (\S+?)\s*\(([^)]+)\)/.exec(t))) { header = true; v.target = m[1]; v.targetIp = m[2]; ev(r, 'target', l); return; }
      if ((m = /^(\d+) bytes from (.+?): icmp_seq=(\d+) ttl=(\d+) time=([\d.]+) ms/.exec(t))) {
        const from = /\(([^)]+)\)\s*$/.exec(m[2]);
        v.replies.push({ from: from ? from[1] : m[2], name: from ? m[2].replace(/\s*\([^)]+\)\s*$/, '') : null, seq: +m[3], ttl: +m[4], time: +m[5], line: l });
        ev(r, 'replies', l); return;
      }
      if ((m = /^From (\S+)(?: \(([^)]+)\))? icmp_seq=(\d+) (.+)$/.exec(t))) { v.unreachable.push({ from: m[2] || m[1], seq: +m[3], reason: m[4], line: l }); ev(r, 'unreachable', l); return; }
      if (/^--- .* ping statistics ---$/.test(t)) { ev(r, 'stats', l); return; }
      if ((m = /^(\d+) packets transmitted, (\d+) received(?:, \+(\d+) errors)?(?:, ([\d.]+)% packet loss)?/.exec(t))) {
        stats = true; v.transmitted = +m[1]; v.received = +m[2]; v.errors = m[3] ? +m[3] : 0; v.lossPercent = m[4] != null ? +m[4] : null;
        ev(r, 'stats', l); ev(r, 'received', l); return;
      }
      if ((m = /^rtt min\/avg\/max\/mdev = ([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+) ms/.exec(t))) { v.rtt = { min: +m[1], avg: +m[2], max: +m[3], mdev: +m[4] }; ev(r, 'rtt', l); return; }
      if ((m = /^ping: (\S+): (Name or service not known|Temporary failure in name resolution|No address associated with hostname)/.exec(t))) {
        r.status = 'fail'; r.outcome = 'resolve-fail'; v.target = m[1]; ev(r, 'error', l);
        r.message = '"' + m[1] + '"의 IP 주소를 찾지 못했다(' + m[2] + '). ping 요청(ICMP)을 보내기 전에 이름 조회에서 멈췄으므로 ICMP 실패가 아니라 이름 조회 실패다.';
        return;
      }
      if (/^ping: (connect: )?Network is unreachable/.test(t)) { r.status = 'fail'; r.outcome = 'network-unreachable'; ev(r, 'error', l); r.message = '이 목적지로 보낼 경로가 없다(Network is unreachable). 요청을 보내지도 못했다.'; return; }
      if (/^ping: /.test(t)) { r.status = 'fail'; r.outcome = 'error'; ev(r, 'error', l); r.message = t; return; }
      r.unparsed.push(l);
    });
    v.ttls = v.replies.map(x => x.ttl).filter((x, i, a) => a.indexOf(x) === i);
    // 목적지에서 온 정상 응답만 센다. "From 주소 ... Destination Host Unreachable"은 다른 장비(또는 내 VM)가 보낸 오류 알림이다.
    const fromTarget = x => !v.targetIp || x.from === v.targetIp;
    const otherReplies = v.replies.filter(x => !fromTarget(x));
    v.errorReplies = v.unreachable.length;
    otherReplies.forEach(x => ev(r, 'notFromDestination', x.line));
    v.unreachable.forEach(x => ev(r, 'notFromDestination', x.line));
    v.replies.filter(fromTarget).forEach(x => ev(r, 'destinationReplies', x.line));
    r.values = v;
    if (r.status === 'fail') return r;
    if (stats) {
      // Linux는 오류 알림을 received가 아니라 errors로 센다. 목적지가 아닌 곳의 정상 응답만 빼면 된다.
      v.destinationReplies = Math.max(0, v.received - otherReplies.length);
      if (v.requested && v.transmitted < v.requested) r.notes.push('-c ' + v.requested + '로 실행했지만 ' + v.transmitted + '번만 보냈다. 중간에 Ctrl + C로 멈췄을 수 있다.');
      if (v.replies.length && v.replies.length < v.received) r.notes.push('통계에는 ' + v.received + '번 받았다고 나오지만 응답 줄은 ' + v.replies.length + '개만 붙여 넣었다. 개수는 통계 줄을 기준으로 읽는다.');
      if (v.unreachable.length) r.notes.push('"From ' + v.unreachable[0].from + ' ... ' + v.unreachable[0].reason + '" 줄 ' + v.unreachable.length + '개는 목적지(' + (v.targetIp || v.target) + ')가 아니라 ' + v.unreachable[0].from + '가 보낸 오류 알림이다. 목적지 응답으로 세지 않는다.');
      if (otherReplies.length) r.notes.push('목적지가 아닌 주소(' + otherReplies.map(x => x.from).join(', ') + ')에서 온 응답 ' + otherReplies.length + '개는 목적지 응답으로 세지 않는다.');
      if (v.destinationReplies > 0) {
        r.outcome = v.destinationReplies >= v.transmitted ? 'all' : 'some';
        r.message = v.transmitted + '번 보내 목적지에서 ' + v.destinationReplies + '번 응답을 받았다' + (v.destinationReplies < v.transmitted ? '. 일부 요청은 응답을 받지 못했다.' : '.');
      } else {
        r.status = 'fail'; r.outcome = 'none';
        r.message = v.transmitted + '번 보냈지만 목적지에서 응답을 하나도 받지 못했다. 이것만으로는 상대가 꺼졌는지, ICMP를 막는지, 경로가 끊겼는지 구분할 수 없다.';
        if (v.unreachable.length) r.message += ' 대신 ' + v.unreachable[0].from + '가 "' + v.unreachable[0].reason + '"라고 알려 왔다.';
      }
    } else {
      r.status = 'partial';
      r.message = header || v.replies.length
        ? '"packets transmitted"가 들어 있는 통계 줄이 없다. 몇 번 보내 몇 번 받았는지 확정할 수 없다.'
        : 'ping 출력의 첫 줄과 통계 줄이 모두 없다.';
    }
    return r;
  }

  // ---------- ping (Windows, 한국어·영어) ----------
  function parseWinPing(lines, cmd) {
    const r = newRes();
    const v = { target: (cmd && cmd.target) || null, targetIp: null, sent: null, received: null, lost: null, lossPercent: null, replies: [], timeouts: 0, unreachable: [], ttls: [], rtt: null };
    let stats = false, header = false;
    nonEmpty(lines).forEach(l => {
      const t = l.trim();
      let m;
      if ((m = /^Ping (\S+)(?: \[(\S+)\])? (\d+)바이트 데이터 사용:?/.exec(t)) || (m = /^Pinging (\S+)(?: \[(\S+)\])? with (\d+) bytes of data:?/.exec(t))) {
        header = true; v.target = m[1]; v.targetIp = m[2] || (isIp(m[1]) ? m[1] : null); ev(r, 'target', l); return;
      }
      if ((m = /^(\S+?)의 응답: 바이트=(\d+) 시간([<=])(\d+)ms TTL=(\d+)/.exec(t)) || (m = /^Reply from (\S+?): bytes=(\d+) time([<=])(\d+)ms TTL=(\d+)/.exec(t))) {
        v.replies.push({ from: m[1], bytes: +m[2], time: +m[4], below: m[3] === '<', ttl: +m[5], line: l }); ev(r, 'replies', l); return;
      }
      if ((m = /^(\S+?)의 응답: 시간([<=])(\d+)ms/.exec(t)) || (m = /^Reply from (\S+?): time([<=])(\d+)ms/.exec(t))) {
        v.replies.push({ from: m[1], bytes: null, time: +m[3], below: m[2] === '<', ttl: null, line: l }); ev(r, 'replies', l); return;
      }
      if ((m = /^(\S+?)의 응답: (대상 (?:호스트|네트워크)에 연결할 수 없습니다\.?)/.exec(t)) || (m = /^Reply from (\S+?): (Destination (?:host|net) unreachable\.?)/.exec(t))) {
        v.unreachable.push({ from: m[1], reason: m[2], line: l }); ev(r, 'unreachable', l); return;
      }
      if (/^(요청 시간이 만료되었습니다\.?|Request timed out\.?)$/.test(t)) { v.timeouts++; ev(r, 'timeouts', l); return; }
      if ((m = /Ping 요청에서 (\S+?) 호스트를 찾을 수 없습니다/.exec(t)) || (m = /Ping request could not find host (\S+?)\./.exec(t))) {
        r.status = 'fail'; r.outcome = 'resolve-fail'; v.target = m[1]; ev(r, 'error', l);
        r.message = '"' + m[1] + '"의 IP 주소를 찾지 못했다. ping 요청(ICMP)을 보내기 전에 이름 조회에서 멈췄으므로 ICMP 실패가 아니라 이름 조회 실패다.'; return;
      }
      if (/일반 오류|General failure|전송하지 못했습니다|transmit failed/i.test(t)) { ev(r, 'error', l); r.notes.push('전송 오류 줄이 있다: ' + t); return; }
      if (/에 대한 Ping 통계:$|^Ping statistics for /.test(t)) { ev(r, 'stats', l); return; }
      if ((m = /패킷:\s*보냄\s*=\s*(\d+),\s*받음\s*=\s*(\d+),\s*손실\s*=\s*(\d+)\s*\((\d+)%/.exec(t)) || (m = /Packets:\s*Sent\s*=\s*(\d+),\s*Received\s*=\s*(\d+),\s*Lost\s*=\s*(\d+)\s*\((\d+)%/.exec(t))) {
        stats = true; v.sent = +m[1]; v.received = +m[2]; v.lost = +m[3]; v.lossPercent = +m[4]; ev(r, 'stats', l); ev(r, 'received', l); return;
      }
      if (/^(왕복 시간\(밀리초\):|Approximate round trip times)/.test(t)) return;
      if ((m = /최소\s*=\s*(\d+)ms,\s*최대\s*=\s*(\d+)ms,\s*평균\s*=\s*(\d+)ms/.exec(t)) || (m = /Minimum\s*=\s*(\d+)ms,\s*Maximum\s*=\s*(\d+)ms,\s*Average\s*=\s*(\d+)ms/.exec(t))) {
        v.rtt = { min: +m[1], max: +m[2], avg: +m[3] }; ev(r, 'rtt', l); return;
      }
      r.unparsed.push(l);
    });
    v.ttls = v.replies.map(x => x.ttl).filter((x, i, a) => x != null && a.indexOf(x) === i);
    r.values = v;
    if (r.status === 'fail') return r;
    if (!stats) {
      r.status = 'partial';
      r.message = '"패킷: 보냄 = ..."(영어판은 "Packets: Sent = ...") 통계 줄이 없다. 몇 번 보내 몇 번 받았는지 확정할 수 없다.';
      return r;
    }
    // Windows의 "받음"에는 다른 장비가 보낸 "대상 호스트에 연결할 수 없습니다" 오류 응답도 들어간다.
    // 그래서 통계 숫자 대신, 목적지 주소에서 온 정상 응답 줄(바이트=… TTL=…)만 센다.
    const dest = v.targetIp;
    const destReplies = v.replies.filter(x => !dest || x.from === dest);
    const otherReplies = v.replies.filter(x => dest && x.from !== dest);
    v.destinationReplies = destReplies.length;
    v.errorReplies = v.unreachable.length;
    destReplies.forEach(x => ev(r, 'destinationReplies', x.line));
    v.unreachable.forEach(x => ev(r, 'notFromDestination', x.line));
    otherReplies.forEach(x => ev(r, 'notFromDestination', x.line));
    const unexplained = v.received - destReplies.length - v.unreachable.length - otherReplies.length;
    if (unexplained > 0) {
      r.status = 'partial';
      r.message = '통계에는 받음 = ' + v.received + '로 나오지만 붙여 넣은 응답 줄로는 ' + (v.received - unexplained) + '개만 확인된다. 응답 줄 일부가 빠졌다.';
      return r;
    }
    if (v.received !== destReplies.length) {
      const who = v.unreachable.concat(otherReplies).map(x => x.from).filter((x, i, a) => a.indexOf(x) === i).join(', ');
      r.notes.push('통계의 "받음 = ' + v.received + '"과 목적지 응답 수(' + destReplies.length + ')가 다르다. 차이 ' + (v.received - destReplies.length) + '개는 목적지(' + (dest || v.target) + ')가 아니라 ' + who + '에서 온 ' + (v.unreachable.length ? '오류 응답(' + v.unreachable[0].reason + ')' : '응답') + '이다. Windows는 이런 오류 응답도 "받음"에 넣는다.');
    }
    if (destReplies.length > 0) {
      r.outcome = destReplies.length >= v.sent ? 'all' : 'some';
      r.message = v.sent + '번 보내 목적지에서 ' + destReplies.length + '번 정상 응답을 받았다.';
    } else {
      r.status = 'fail';
      r.outcome = 'none';
      r.message = v.unreachable.length
        ? v.sent + '번 보냈지만 목적지(' + (dest || v.target) + ')에서 온 정상 응답은 0개다. 통계의 받음 = ' + v.received + '은 ' + v.unreachable[0].from + '가 보낸 "' + v.unreachable[0].reason + '" 오류 응답을 센 것이다.'
        : v.sent + '번 보냈지만 응답을 하나도 받지 못했다. Windows 호스트나 서버가 기본 방화벽으로 ICMP를 막는 경우에도 이렇게 나오므로, 이것만으로 장애라고 판단하지 않는다.';
    }
    return r;
  }

  // ---------- ss -lnt ----------
  const SS_ROW = /^\s*(?:(tcp|udp|raw|u_str|tcp6|udp6)\s+)?(LISTEN|ESTAB|UNCONN|TIME-WAIT|SYN-SENT|SYN-RECV|CLOSE-WAIT|FIN-WAIT-1|FIN-WAIT-2|LAST-ACK|CLOSING)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\S+)/;
  function splitHostPort(s) {
    const i = s.lastIndexOf(':');
    if (i < 0) return { address: s, port: null };
    let addr = s.slice(0, i); const port = s.slice(i + 1);
    let iface = null;
    const pct = addr.indexOf('%');
    if (/^\[.*\]$/.test(addr)) addr = addr.slice(1, -1);
    if (pct >= 0) { iface = addr.slice(addr.indexOf('%') + 1).replace(/\]$/, ''); addr = addr.slice(0, addr.indexOf('%')).replace(/^\[/, ''); }
    return { address: addr === '' ? '::' : addr, port, iface };
  }
  function scopeOf(addr) {
    if (isWildcard(addr)) return 'all';
    if (isLoopback(addr)) return 'loopback';
    return 'specific';
  }
  function parseSs(lines) {
    const r = newRes();
    const listeners = [];
    let header = null;
    const rows = nonEmpty(lines);
    rows.forEach(l => {
      if (/^\s*(Netid\s+)?State\s+Recv-Q\s+Send-Q/.test(l)) { header = l; ev(r, 'header', l); return; }
      const m = SS_ROW.exec(l);
      if (!m) { r.unparsed.push(l); return; }
      const loc = splitHostPort(m[5]);
      const peer = splitHostPort(m[6]);
      listeners.push({ netid: m[1] || 'tcp', state: m[2], recvQ: +m[3], sendQ: +m[4], local: m[5], address: loc.address, port: loc.port, iface: loc.iface, peer: m[6], scope: scopeOf(loc.address), family: loc.address === '*' ? 'any' : family(loc.address), line: l });
      void peer;
    });
    listeners.forEach(x => ev(r, 'port:' + x.port, x.line));
    const ports = listeners.filter(x => x.state === 'LISTEN').map(x => x.port).filter((p, i, a) => a.indexOf(p) === i).sort((a, b) => +a - +b);
    r.values = { listeners, ports, hasHeader: !!header };
    const last = rows[rows.length - 1];
    const cutLast = last && !SS_ROW.test(last) && last !== header;
    if (!header) {
      r.status = 'partial';
      r.message = 'State로 시작하는 제목 줄이 없다. 앞부분이 빠졌을 수 있으므로 목록에 없는 포트를 "수신하지 않는다"고 단정하지 않는다.';
    } else if (cutLast) {
      r.status = 'partial';
      r.message = '마지막 줄이 LISTEN 줄 형식이 아니다. 뒷부분이 잘렸을 수 있으므로 목록에 없는 포트를 "수신하지 않는다"고 단정하지 않는다.';
    } else {
      r.outcome = listeners.length ? 'listening' : 'none';
      r.message = listeners.length ? 'TCP 연결을 기다리는(LISTEN) 포트: ' + ports.join(', ') : '제목 줄만 있고 LISTEN 줄이 없다. TCP 연결을 기다리는 포트가 없다.';
    }
    return r;
  }

  // 특정 포트가 수신 중인지. ss 출력 일부만 있으면 'unknown'을 돌려준다.
  function ssPort(res, port, opts) {
    opts = opts || {};
    if (!res || res.kind !== 'ss') return { state: 'unknown', reason: 'ss -lnt 출력이 아니다.', lines: [] };
    const hits = res.values.listeners.filter(x => x.state === 'LISTEN' && x.port === String(port) && (!opts.address || x.address === opts.address));
    if (hits.length) {
      const scopes = hits.map(h => h.scope);
      return {
        state: 'listening',
        scope: scopes.indexOf('all') >= 0 ? 'all' : scopes.indexOf('specific') >= 0 ? 'specific' : 'loopback',
        addresses: hits.map(h => h.local),
        listeners: hits,
        lines: hits.map(h => h.line),
        reason: hits.every(h => h.scope === 'loopback')
          ? port + '번은 ' + hits.map(h => h.local).join(', ') + '에서만 기다린다. 자기 자신(loopback)에서 온 연결만 받고, 외부 PC의 연결은 받지 않는다.'
          : port + '번을 ' + hits.map(h => h.local).join(', ') + '에서 기다린다.',
      };
    }
    if (res.status !== 'ok') return { state: 'unknown', reason: '출력 일부가 빠졌을 수 있어 ' + port + '번이 없다고 단정하지 않는다. ' + KINDS.ss.recopy, lines: [] };
    return { state: 'not-listening', reason: '제목 줄부터 끝까지 있는 출력에 ' + port + '번 LISTEN 줄이 없다.', lines: res.evidence.header || [] };
  }

  // ---------- nc (Ncat) ----------
  function parseNc(lines, cmd) {
    const r = newRes();
    const v = { target: (cmd && cmd.target) || null, port: (cmd && cmd.port) || null, version: null, outcome: null, flavor: null };
    nonEmpty(lines).forEach(l => {
      const t = l.trim();
      let m;
      if ((m = /^Ncat: Version (\S+)/.exec(t))) { v.version = m[1]; v.flavor = 'ncat'; ev(r, 'version', l); return; }
      if ((m = /^Ncat: Connected to (\S+)\.$/.exec(t))) {
        const hp = splitHostPort(m[1]); v.target = hp.address; v.port = hp.port; v.outcome = 'connected'; v.flavor = 'ncat'; ev(r, 'outcome', l); return;
      }
      if (/^Ncat: \d+ bytes sent, \d+ bytes received/.test(t)) { ev(r, 'outcome', l); return; }
      if (/^Ncat: Connection refused\.?$/.test(t)) { v.outcome = 'refused'; ev(r, 'outcome', l); return; }
      if (/^Ncat: (TIMEOUT|Connection timed out)\.?$/.test(t)) { v.outcome = 'timeout'; ev(r, 'outcome', l); return; }
      if (/^Ncat: No route to host\.?$/.test(t)) { v.outcome = 'no-route'; ev(r, 'outcome', l); return; }
      if (/^Ncat: Network is unreachable\.?$/.test(t)) { v.outcome = 'network-unreachable'; ev(r, 'outcome', l); return; }
      if ((m = /^Ncat: Could not resolve hostname "?([^":]+)"?/.exec(t))) { v.outcome = 'resolve-fail'; v.target = m[1]; ev(r, 'outcome', l); return; }
      // OpenBSD nc 형식(참고용, CentOS 기본은 Ncat)
      if ((m = /^Connection to (\S+) (\d+) port \[[^\]]*\] succeeded!/.exec(t))) { v.target = m[1]; v.port = m[2]; v.outcome = 'connected'; v.flavor = 'openbsd'; ev(r, 'outcome', l); return; }
      if ((m = /^nc: connect to (\S+) port (\d+) \(tcp\) (?:failed: )?(.+)$/.exec(t))) {
        v.target = m[1]; v.port = m[2]; v.flavor = 'openbsd'; v.outcome = /refused/i.test(m[3]) ? 'refused' : /timed out/i.test(m[3]) ? 'timeout' : 'error'; ev(r, 'outcome', l); return;
      }
      if (/^Ncat: /.test(t)) { ev(r, 'other', l); return; }
      r.unparsed.push(l);
    });
    r.values = v; r.outcome = v.outcome;
    const where = (v.target || '대상') + (v.port ? ' ' + v.port + '번 포트' : '');
    const MSG = {
      connected: where + '로 TCP 연결에 성공했다. 그 포트에서 연결을 받는 프로그램이 있다는 뜻이다. 로그인이나 웹 페이지가 정상인지는 아직 모른다.',
      refused: where + '에서 "연결 거부" 응답이 돌아왔다(Connection refused). 대상 장비까지는 닿았지만 그 포트에서 기다리는 프로그램이 없다.',
      timeout: '정해진 시간 안에 ' + where + '에서 아무 응답도 받지 못했다(TIMEOUT). 대상이 꺼졌거나, 중간에서 막혔거나, 주소가 틀렸을 수 있다.',
      'no-route': where + '로 가는 길을 찾지 못했다(No route to host).',
      'network-unreachable': '이 대상 네트워크로 보낼 경로가 없다(Network is unreachable).',
      'resolve-fail': '"' + v.target + '"의 IP 주소를 찾지 못해 연결을 시도하지 못했다.',
      error: where + ' 연결 시도에서 오류가 났다.',
    };
    if (!v.outcome) {
      r.status = 'partial';
      r.message = '연결 결과 줄(Connected to / Connection refused / TIMEOUT)이 없다.';
    } else {
      r.status = v.outcome === 'connected' ? 'ok' : 'fail';
      r.message = MSG[v.outcome];
    }
    if (!v.target || !v.port) r.notes.push('출력에 대상 주소나 포트가 없다. 명령 줄까지 함께 복사하면 대상도 알 수 있다.');
    return r;
  }

  // ---------- traceroute ----------
  function parseTraceroute(lines, cmd) {
    const r = newRes();
    const v = { target: (cmd && cmd.target) || null, targetIp: null, maxHops: null, hops: [], respondedHops: [], destinationReached: null, lastResponder: null, verdict: null };
    nonEmpty(lines).forEach(l => {
      const t = l.trim();
      let m;
      if ((m = /^traceroute to (\S+) \(([^)]+)\), (\d+) hops max/.exec(t))) { v.target = m[1]; v.targetIp = m[2]; v.maxHops = +m[3]; ev(r, 'target', l); return; }
      if ((m = /^(\d+)\s+(.*)$/.exec(t))) {
        const hop = { n: +m[1], responders: [], rtts: [], stars: 0, notes: [], line: l };
        const tok = m[2].split(/\s+/);
        for (let i = 0; i < tok.length; i++) {
          const x = tok[i];
          if (x === '*') hop.stars++;
          else if (/^\(([^)]+)\)$/.test(x) && isIp(x.slice(1, -1))) { const ip = x.slice(1, -1); if (hop.responders.indexOf(ip) < 0) hop.responders.push(ip); }
          else if (isIp(x)) { if (hop.responders.indexOf(x) < 0) hop.responders.push(x); }
          else if (/^[\d.]+$/.test(x) && tok[i + 1] === 'ms') { hop.rtts.push(+x); i++; }
          else if (/^![A-Z0-9<>]*$/.test(x)) hop.notes.push(x);
        }
        v.hops.push(hop); return;
      }
      r.unparsed.push(l);
    });
    if (!v.targetIp && v.target && isIp(v.target)) v.targetIp = v.target;
    v.hops.forEach(h => { if (h.responders.length) { v.respondedHops.push({ n: h.n, ips: h.responders, line: h.line }); ev(r, 'hop:' + h.n, h.line); } });
    const lastResp = v.respondedHops[v.respondedHops.length - 1];
    v.lastResponder = lastResp ? lastResp.ips[lastResp.ips.length - 1] : null;
    const destHop = v.targetIp ? v.hops.find(h => h.responders.indexOf(v.targetIp) >= 0) : null;
    v.destinationReached = v.targetIp ? !!destHop : null;
    if (destHop) { v.destinationHop = destHop.n; ev(r, 'destination', destHop.line); }
    r.values = v;
    if (!v.hops.length) { r.status = 'partial'; r.message = '번호로 시작하는 홉 줄이 없다.'; return r; }
    const nums = v.hops.map(h => h.n);
    const gap = nums[0] !== 1 || nums.some((n, i) => i && n !== nums[i - 1] + 1);
    const lastN = nums[nums.length - 1];
    if (gap) { r.status = 'partial'; r.message = '홉 번호가 1부터 차례로 이어지지 않는다. 일부 줄이 빠졌다.'; }
    else if (!v.targetIp) { r.status = 'partial'; r.message = '"traceroute to" 줄이 없어 목적지 주소를 알 수 없다. 목적지에 닿았는지 판정할 수 없다.'; }
    else if (!destHop && v.maxHops && lastN < v.maxHops) { r.status = 'partial'; r.message = lastN + '번 홉에서 출력이 끝났다. 최대 ' + v.maxHops + '홉까지 나오기 전에 복사가 끊겼거나 Ctrl + C로 멈췄다.'; }
    if (destHop) {
      v.verdict = 'reached';
      if (r.status === 'ok') r.message = destHop.n + '번 홉에서 목적지 ' + v.targetIp + '가 응답했다. 목적지 응답을 확인했다.';
    } else if (v.respondedHops.length) {
      v.verdict = 'intermediate-only';
      if (r.status === 'ok') r.message = '중간 홉(' + v.respondedHops.map(h => h.n + '번 ' + h.ips.join('/')).join(', ') + ')만 응답했고 목적지는 응답하지 않았다. VMware NAT 환경에서는 흔히 이렇게 나오므로 이것만으로 목적지에 닿지 못했다고 판정하기 어렵다.';
    } else {
      v.verdict = 'no-response';
      if (r.status === 'ok') { r.status = 'unknown'; r.message = '모든 홉이 * 로만 나왔다. 응답한 장비가 하나도 없어 주어진 출력만으로는 판정하기 어렵다. VMware NAT 환경에서는 흔히 이렇게 나온다.'; }
    }
    r.outcome = v.verdict;
    return r;
  }

  // ---------- Test-NetConnection ----------
  function parseTnc(lines, cmd) {
    const r = newRes();
    const v = { computerName: null, remoteAddress: null, remotePort: null, interfaceAlias: null, sourceAddress: null, pingSucceeded: null, pingRtt: null, tcpTestSucceeded: null, warnings: [], requestedPort: (cmd && cmd.port) || null, target: (cmd && cmd.target) || null };
    const KEYS = { ComputerName: 'computerName', RemoteAddress: 'remoteAddress', RemotePort: 'remotePort', InterfaceAlias: 'interfaceAlias', SourceAddress: 'sourceAddress', PingSucceeded: 'pingSucceeded', 'PingReplyDetails (RTT)': 'pingRtt', TcpTestSucceeded: 'tcpTestSucceeded' };
    nonEmpty(lines).forEach(l => {
      const t = l.trim();
      let m;
      if ((m = /^(?:WARNING|경고):\s*(.+)$/.exec(t)) || (m = /^((?:TCP connect to|Ping to|Name resolution of) .+)$/.exec(t))) {
        v.warnings.push({ text: m[1], line: l }); ev(r, 'warnings', l);
        const tc = /TCP connect to \((\S+) : (\d+)\) failed/.exec(m[1]);
        if (tc) { v.remoteAddress = v.remoteAddress || tc[1]; v.remotePort = v.remotePort || +tc[2]; }
        if (/^Name resolution of .* failed/.test(m[1])) v.resolveFailed = true;
        return;
      }
      if ((m = /^([A-Za-z][A-Za-z ()]*?)\s*:\s?(.*)$/.exec(t)) && KEYS[m[1]]) {
        const k = KEYS[m[1]]; let val = m[2].trim();
        if (k === 'pingSucceeded' || k === 'tcpTestSucceeded') val = /^true$/i.test(val) ? true : /^false$/i.test(val) ? false : null;
        else if (k === 'remotePort') val = val ? +val : null;
        v[k] = val === '' ? null : val; ev(r, k, l); return;
      }
      if (/^[A-Za-z][A-Za-z ()]*?\s*:/.test(t)) { ev(r, 'other', l); return; }
      r.unparsed.push(l);
    });
    r.values = v;
    const port = v.remotePort || v.requestedPort;
    const target = v.remoteAddress || v.computerName || v.target || '대상';
    if (v.resolveFailed && !v.remoteAddress) {
      r.status = 'fail'; r.outcome = 'resolve-fail';
      r.message = '이름 조회에 실패해 연결 검사를 하지 못했다.';
    } else if (v.tcpTestSucceeded === true) {
      r.outcome = 'tcp-ok';
      r.message = '이 Windows PC에서 ' + target + '의 TCP ' + port + '번 포트로 연결에 성공했다(TcpTestSucceeded : True). 그 포트에서 연결을 받는 프로그램이 있다는 뜻이다. 로그인 성공이나 웹 페이지 정상 응답까지 확인한 것은 아니다.';
    } else if (v.tcpTestSucceeded === false) {
      r.status = 'fail'; r.outcome = 'tcp-fail';
      r.message = '이 Windows PC에서 ' + target + '의 TCP ' + port + '번 포트로 연결하지 못했다(TcpTestSucceeded : False). 거절됐는지, 응답이 없었는지는 이 결과만으로 구분되지 않는다.';
      if (v.pingSucceeded === true) r.message += ' ICMP(ping) 응답은 받았으므로 대상 장비까지는 닿는다.';
    } else if (v.requestedPort) {
      r.status = 'partial';
      r.message = '-Port로 실행했지만 TcpTestSucceeded 줄이 없다.';
    } else if (v.pingSucceeded != null) {
      r.outcome = v.pingSucceeded ? 'ping-ok' : 'ping-fail';
      r.status = v.pingSucceeded ? 'ok' : 'fail';
      r.message = v.pingSucceeded ? 'ICMP(ping) 응답을 받았다(PingSucceeded : True).' : 'ICMP(ping) 응답을 받지 못했다(PingSucceeded : False). 기본 방화벽이 ICMP를 막아도 이렇게 나온다.';
    } else {
      r.status = 'partial';
      r.message = 'TcpTestSucceeded나 PingSucceeded 줄이 없다.';
    }
    if (v.pingSucceeded === false && r.outcome === 'tcp-ok') r.notes.push('ping 응답은 없었지만 TCP 연결은 됐다. ICMP만 막혀 있는 경우다.');
    return r;
  }

  const PARSERS = {
    'ip-br-addr': parseIpBr, 'ip-addr': parseIpAddr, 'ip-route': parseIpRoute, 'ip-route-get': parseIpRouteGet,
    nslookup: parseNslookup, ping: parsePing, 'win-ping': parseWinPing, ss: parseSs, nc: parseNc,
    traceroute: parseTraceroute, tnc: parseTnc,
  };

  function compatible(a, b) {
    if (!a || !b) return true;
    if (a === b) return true;
    const pair = [a, b].sort().join('|');
    return pair === 'ping|win-ping' || pair === 'ip-route|ip-route-get';
  }
  function expectList(expect) { return expect == null ? null : [].concat(expect); }
  // expect에는 종류 하나 또는 배열을 넣는다. Linux ping과 Windows ping은 서로 다른 종류다.
  function matchesExpect(kind, list) {
    return !list || list.indexOf(kind) >= 0;
  }

  // ---------- 진입점 ----------
  function analyze(text, options) {
    options = options || {};
    const expect = expectList(options.expect);
    const { segments, removed } = segment(text);
    const used = segments.filter(s => s.command || nonEmpty(s.lines).length);

    const base = {
      kind: null, label: null, expected: expect, command: null, commandInfo: null,
      status: 'empty', statusLabel: STATUS.empty, message: '', recopy: null,
      outcome: null, values: {}, evidence: {}, notes: [], ignoredLines: removed, unparsed: [], segments: used.length,
    };
    if (!used.length) {
      base.message = '붙여 넣은 내용이 없다. 터미널에서 명령을 실행한 뒤 출력을 복사해 붙여 넣는다.';
      if (removed.length) base.message = '프롬프트 줄만 있고 출력이 없다. 명령 아래에 나온 출력을 함께 복사한다.';
      return finish(base, expect);
    }

    // 여러 명령이 함께 붙어 있으면: 기대한 명령의 구간 → 없으면 마지막 구간
    let seg = used[used.length - 1];
    if (used.length > 1) {
      const pick = used.slice().reverse().find(s => {
        const k = kindOf(s);
        return expect && k && matchesExpect(k, expect);
      });
      if (pick) seg = pick;
      base.notes.push('명령 ' + used.length + '개의 출력이 함께 붙어 있다. "' + (seg.command || '첫 부분') + '" 부분만 분석했다.');
    }
    const cmd = parseCommand(seg.command);
    base.command = seg.command; base.commandInfo = cmd;
    const out = nonEmpty(seg.lines);

    // 도구 없음
    const nf = findNotFound(out);
    if (nf) {
      const tool = nf.tool.replace(/^.*[\/\\]/, '');
      base.kind = (cmd && cmd.kind) || TOOL_KIND[tool.toLowerCase()] || null;
      base.label = base.kind ? KINDS[base.kind].label : tool;
      base.status = 'notfound';
      const pkg = nf.os === 'linux' ? nf.helperPackage || PACKAGES[tool] || null : null;
      base.values = { tool, package: pkg, os: nf.os, similar: nf.similar || null, notACommand: isIp(tool) };
      if (pkg) base.values.install = 'sudo dnf install -y ' + pkg;
      ev(base, 'tool', nf.line);
      nf.extra.forEach(l => ev(base, 'tool', l));
      // 실행 위치가 틀린 경우: Linux 명령을 Windows PowerShell에서, Windows 명령을 VM 안에서 실행했다.
      const LINUX_ONLY = ['ip', 'ss', 'nc', 'ncat', 'traceroute', 'dig', 'host'];
      const WINDOWS_ONLY = ['test-netconnection', 'tnc', 'ipconfig', 'tracert'];
      if (nf.os === 'windows' && LINUX_ONLY.indexOf(tool.toLowerCase()) >= 0) {
        base.values.wrongPlace = 'windows';
        base.message = tool + '는 Linux 명령인데 Windows PowerShell에서 실행했다. 도구가 없는 것이 아니라 실행 위치가 다르다. PowerShell에서 ssh 사용자이름@VM주소 로 VM에 접속한 뒤, 프롬프트가 $로 끝나는지 확인하고 다시 실행한다.';
        return finish(base, expect);
      }
      if (nf.os === 'linux' && WINDOWS_ONLY.indexOf(tool.toLowerCase()) >= 0) {
        base.values.wrongPlace = 'linux';
        base.values.package = null; delete base.values.install;
        base.message = tool + '는 Windows PowerShell 명령인데 VM(Linux) 안에서 실행했다. exit로 SSH 접속을 끝내고, 프롬프트가 PS C:\\...> 로 돌아온 뒤 다시 실행한다.';
        return finish(base, expect);
      }
      if (nf.os === 'linux' && isIp(tool)) {
        base.message = '"' + tool + '"는 명령이 아니라 주소다. 명령 이름 없이 주소만 입력해서 셸이 이것을 명령으로 찾다가 실패했다. 주소 앞에 ping 같은 명령 이름을 붙여 다시 실행한다.';
      } else if (nf.os === 'linux') {
        base.message = '이 명령을 실행할 도구(' + tool + ')를 찾지 못했다. 입력이 틀린 것이 아니라 도구가 설치되어 있지 않다.' +
          (base.values.install ? ' ' + base.values.install + ' 로 설치하거나, 설치하지 않고 예시 모드로 진행한다.' : '') +
          (nf.extra.some(l => /^\s*Install package/.test(l)) ? ' 터미널이 "Install package ...? [N/y]"라고 물으면 y를 입력해 바로 설치할 수도 있다.' : '');
      } else {
        base.message = 'Windows에서 ' + tool + ' 명령을 찾지 못했다.' + (tool.toLowerCase() === 'ssh' ? ' Windows 설정의 "선택적 기능"에서 OpenSSH 클라이언트를 추가한다.' : ' 명령 이름의 철자를 확인하고, 필요한 프로그램이 설치되어 있는지 확인한다.');
      }
      return finish(base, expect);
    }

    if (!out.length) {
      base.kind = cmd && cmd.kind; base.label = base.kind ? KINDS[base.kind].label : null;
      base.status = 'partial';
      base.message = '명령 줄만 있고 출력이 없다. 명령 아래에 나온 출력까지 복사한다.';
      return finish(base, expect);
    }

    const outKind = detect(out);
    let kind = outKind || (cmd && cmd.kind) || null;
    if (cmd && cmd.kind && outKind && cmd.kind !== outKind) {
      if (compatible(cmd.kind, outKind)) kind = outKind;
      else base.notes.push('명령 줄은 ' + (KINDS[cmd.kind] || {}).label + '인데 출력은 ' + KINDS[outKind].label + '의 모양이다. 출력 모양을 기준으로 분석했다.');
    }
    base.kind = kind;
    base.label = kind ? KINDS[kind].label : null;

    if (!kind) {
      base.status = 'unknown';
      base.message = '어떤 명령의 출력인지 알아보지 못했다. 명령을 실행한 뒤 나온 출력 전체를 복사했는지 확인한다.';
      return finish(base, expect);
    }
    if (!PARSERS[kind]) {
      base.status = expect ? 'other' : 'unknown';
      base.message = KINDS[kind].label + '의 출력으로 보인다. 이 엔진이 분석하는 명령이 아니다.';
      return finish(base, expect);
    }

    // ip addr show dev는 명령 정보가 필요하다
    const r = PARSERS[kind](seg.lines, cmd && (cmd.kind === kind || compatible(cmd.kind, kind)) ? cmd : null);
    Object.assign(base, {
      status: r.status, outcome: r.outcome, values: r.values, message: r.message,
      notes: base.notes.concat(r.notes), unparsed: r.unparsed,
    });
    Object.keys(r.evidence).forEach(k => { base.evidence[k] = r.evidence[k]; });
    if (r.unparsed.length) base.notes.push('알아보지 못한 줄 ' + r.unparsed.length + '개는 분석에서 뺐다.');
    return finish(base, expect);
  }

  function kindOf(seg) {
    const cmd = parseCommand(seg.command);
    const out = nonEmpty(seg.lines);
    return detect(out) || (cmd && cmd.kind) || null;
  }

  function finish(res, expect) {
    if (expect && res.kind && !matchesExpect(res.kind, expect) && res.status !== 'empty') {
      res.otherStatus = res.status;
      res.status = 'other';
      res.message = '이 출력은 ' + res.label + '의 출력으로 보인다. ' + expect.map(e => KINDS[e] ? KINDS[e].label : e).join(' 또는 ') + '의 출력을 붙여 넣는다.';
    }
    res.statusLabel = STATUS[res.status];
    if (res.status === 'partial' || res.status === 'unknown' || res.status === 'other') {
      const k = res.status === 'other' && expect ? expect[0] : res.kind;
      res.recopy = k && KINDS[k] && KINDS[k].recopy ? KINDS[k].recopy : null;
    }
    return res;
  }

  // ---------- 샘플 파일 ----------
  function parseSamples(text) {
    const blocks = [];
    let cur = null;
    splitLines(text).forEach(l => {
      const m = /^###\s+(\$|#|PS>)\s+(.+)$/.exec(l.trim());
      if (m) { cur = { shell: m[1], command: m[2].trim(), lines: [] }; blocks.push(cur); return; }
      if (cur) cur.lines.push(l);
    });
    return blocks.map(b => ({ shell: b.shell, command: b.command, output: b.lines.join('\n').replace(/\s+$/, '') }));
  }

  return { analyze, ssPort, parseSamples, parseCommand, detect: lines => detect(splitLines(lines)), STATUS, KINDS, PACKAGES };
});
