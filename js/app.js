(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = matchMedia('(max-width: 860px), (orientation: portrait)');
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } }
  };

  function seeded(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => {
      h += 0x6d2b79f5;
      let t = Math.imul(h ^ (h >>> 15), 1 | h);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ───────── sound (synthesised, no assets) ───────── */
  const Sfx = {
    ctx: null, out: null, noise: null,
    muted: store.get('icemelt:mute') === '1' || /[?&]mute\b/.test(location.search),
    init() {
      if (this.ctx || this.muted) { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = this.ctx = new AC();
      const comp = c.createDynamicsCompressor();
      this.out = c.createGain();
      this.out.gain.value = 0.55;
      this.out.connect(comp).connect(c.destination);
      const buf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
    },
    ok() { return !this.muted && this.ctx; },
    grain(t, freq, q, dur, vol, type = 'bandpass') {
      const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noise; s.loop = true;
      f.type = type; f.frequency.value = freq; f.Q.value = q;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(this.out);
      s.start(t, Math.random() * 0.9); s.stop(t + dur + 0.02);
    },
    ping(t, freq, dur, vol, type = 'sine', attack = 0.002) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.out);
      o.start(t); o.stop(t + dur + 0.05);
    },
    tap(dmg) {
      if (!this.ok()) return;
      const t = this.ctx.currentTime;
      this.grain(t, rnd(2600, 4200) + dmg * 1500, 1.2, 0.05, 0.5);
      this.ping(t, rnd(1500, 2100) + dmg * 900, 0.09, 0.12);
      this.ping(t, 180, 0.06, 0.25);
    },
    crack() {
      if (!this.ok()) return;
      const t = this.ctx.currentTime;
      for (let i = 0; i < 5; i++) this.grain(t + i * rnd(0.012, 0.03), rnd(4000, 9000), 4, 0.03, 0.35, 'highpass');
    },
    shatter(size = 1) {
      if (!this.ok()) return;
      const t = this.ctx.currentTime, n = 8 + size * 3;
      this.ping(t, 150, 0.14, 0.5);
      this.grain(t, 1800, 0.6, 0.12, 0.7);
      for (let i = 0; i < n; i++) this.grain(t + Math.random() * 0.32, rnd(3000, 10000), 6, rnd(0.03, 0.09), rnd(0.15, 0.4));
      for (let i = 0; i < 5; i++) this.ping(t + Math.random() * 0.12, rnd(2200, 7200), rnd(0.25, 0.9), rnd(0.02, 0.06));
    },
    bloom() {
      if (!this.ok()) return;
      const t = this.ctx.currentTime;
      [261.6, 329.6, 392, 587.3, 783.9].forEach((f, i) => {
        this.ping(t + i * 0.09, f, 3.6, 0.09, 'triangle', 0.5);
        this.ping(t + i * 0.09, f * 2.003, 2.8, 0.03, 'sine', 0.8);
      });
      for (let i = 0; i < 10; i++) this.ping(t + 0.3 + i * 0.13, rnd(2400, 5200), 0.7, 0.025);
    },
    frost(k) {
      if (!this.ok()) return;
      const t = this.ctx.currentTime;
      this.grain(t, 5200 + k * 3500, 7, 0.05, 0.16, 'highpass');
      this.ping(t, 1400 + k * 1600, 0.12, 0.025);
    },
    seal() {
      if (!this.ok()) return;
      const t = this.ctx.currentTime;
      this.ping(t, 2093, 0.9, 0.05); this.ping(t + 0.04, 3136, 1.1, 0.03);
      this.grain(t, 7000, 3, 0.18, 0.2, 'highpass');
    },
    cue(go) {
      if (!this.ok()) return;
      const t = this.ctx.currentTime;
      if (go) { this.ping(t, 1318, 0.5, 0.12, 'triangle'); this.ping(t, 1976, 0.6, 0.07); }
      else { this.ping(t, 880, 0.22, 0.09, 'triangle'); this.ping(t + 0.16, 880, 0.22, 0.09, 'triangle'); }
    },
    ui() { if (this.ok()) this.ping(this.ctx.currentTime, 1320, 0.12, 0.06); }
  };

  const soundBtn = $('#soundBtn');
  function paintSound() {
    soundBtn.setAttribute('aria-pressed', String(!Sfx.muted));
    soundBtn.setAttribute('aria-label', Sfx.muted ? '소리 켜기' : '소리 끄기');
  }
  soundBtn.addEventListener('click', () => {
    Sfx.muted = !Sfx.muted;
    store.set('icemelt:mute', Sfx.muted ? '1' : '0');
    paintSound();
    if (!Sfx.muted) { Sfx.init(); Sfx.ui(); }
  });
  paintSound();

  /* ───────── particles ───────── */
  const cv = $('#fx'), cx = cv.getContext('2d');
  let P = [], raf = 0, last = 0, W = 0, H = 0, ambient = false;
  function fit() {
    const d = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * d; cv.height = H * d;
    cx.setTransform(d, 0, 0, d, 0, 0);
  }
  addEventListener('resize', fit); fit();
  function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }

  function shard(x, y, vx, vy, s, life) {
    const n = 3 + (Math.random() * 3 | 0), pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * 6.283 + rnd(-0.4, 0.4), r = s * rnd(0.45, 1); pts.push(Math.cos(a) * r, Math.sin(a) * r); }
    P.push({ k: 0, x, y, vx, vy, pts, rot: rnd(0, 6.28), vr: rnd(-9, 9), life, max: life, a: rnd(0.55, 0.95) });
  }
  function spark(x, y, vx, vy, s, life, col) { P.push({ k: 1, x, y, vx, vy, s, life, max: life, col }); }
  function chips(x, y, n) {
    if (reduce) n = Math.min(n, 2);
    for (let i = 0; i < n; i++) { const a = rnd(0, 6.283), v = rnd(80, 320); shard(x, y, Math.cos(a) * v, Math.sin(a) * v - 120, rnd(2, 5), rnd(0.35, 0.7)); }
    kick();
  }
  function burst(rect, hx, hy) {
    const n = reduce ? 5 : clamp(Math.round(rect.width * rect.height / 900), 9, 26);
    for (let i = 0; i < n; i++) {
      const x = rect.left + Math.random() * rect.width, y = rect.top + Math.random() * rect.height;
      const dx = x - hx, dy = y - hy, d = Math.hypot(dx, dy) || 1, v = rnd(120, 460);
      shard(x, y, dx / d * v + rnd(-60, 60), dy / d * v - rnd(80, 260), rnd(5, Math.min(22, rect.width / 4)), rnd(0.7, 1.3));
    }
    if (!reduce) for (let i = 0; i < 5; i++) spark(rect.left + Math.random() * rect.width, rect.top + Math.random() * rect.height, rnd(-50, 50), rnd(-120, -30), rnd(5, 11), rnd(0.5, 1), i % 2 ? '#fff' : '#cfe0ff');
    kick();
  }
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    cx.clearRect(0, 0, W, H);
    if (ambient && !reduce && state.heartRect && Math.random() < 0.05 + state.melt * 0.35) {
      const r = state.heartRect;
      P.push({ k: 2, x: r.left + r.width * rnd(0.2, 0.8), y: r.top + r.height * rnd(0.3, 0.8), vx: rnd(-14, 14), vy: rnd(-55, -20), s: rnd(1.5, 4), life: 2.4, max: 2.4, col: Math.random() < 0.5 ? '#ffffff' : '#cfe0ff' });
    }
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.life -= dt;
      if (p.life <= 0) { P.splice(i, 1); continue; }
      const f = p.life / p.max;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.k === 0) {
        p.vy += 1500 * dt; p.rot += p.vr * dt;
        cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot);
        cx.beginPath(); cx.moveTo(p.pts[0], p.pts[1]);
        for (let j = 2; j < p.pts.length; j += 2) cx.lineTo(p.pts[j], p.pts[j + 1]);
        cx.closePath();
        cx.globalAlpha = Math.min(1, f * 2.2) * p.a;
        cx.fillStyle = '#f6f9ff'; cx.fill();
        cx.lineWidth = 1.3; cx.strokeStyle = '#2545cf'; cx.stroke();
        cx.restore();
      } else if (p.k === 1) {
        const s = p.s * Math.sin(f * Math.PI);
        cx.globalAlpha = 1; cx.fillStyle = p.col;
        cx.beginPath();
        cx.moveTo(p.x, p.y - s); cx.quadraticCurveTo(p.x, p.y, p.x + s, p.y);
        cx.quadraticCurveTo(p.x, p.y, p.x, p.y + s); cx.quadraticCurveTo(p.x, p.y, p.x - s, p.y);
        cx.quadraticCurveTo(p.x, p.y, p.x, p.y - s); cx.fill();
      } else {
        cx.globalAlpha = Math.sin(f * Math.PI) * 0.85; cx.fillStyle = p.col;
        cx.beginPath(); cx.arc(p.x, p.y, p.s, 0, 6.283); cx.fill();
      }
    }
    cx.globalAlpha = 1;
    raf = (P.length || ambient) ? requestAnimationFrame(loop) : 0;
  }

  /* ───────── ambient decor ───────── */
  (function decor() {
    const host = $('#decor'), r = seeded('frost');
    const STAR = 'M12 0c.9 6.300 5.700 11.100 12 12-6.300.900-11.100 5.700-12 12-.900-6.300-5.700-11.100-12-12 6.300-.900 11.100-5.700 12-12Z';
    const DOODLES = [
      'M12 21C5 15.500 2 12 2 8a5 5 0 0 1 10-1.500A5 5 0 0 1 22 8c0 4-3 7.500-10 13Z',
      'M12 2c4 6 7 9 7 13a7 7 0 0 1-14 0c0-4 3-7 7-13Z',
      'M12 2v20M3.300 7l17.400 10M3.300 17L20.700 7M9 3.500l3 2.500 3-2.500M9 20.500l3-2.500 3 2.500',
      'M12 12c0-2 3-2 3 .500s-4 3.500-6 1-1-7 3.500-7 7 4 5.500 8.500',
      'M4 16c3-6 5 4 8-2s5 4 8-2',
      'M12 3l2.200 6.200L20.500 9l-5 4 1.800 6.300L12 15.500 6.700 19.300 8.500 13l-5-4 6.300.200Z'
    ];
    let html = '';
    for (let i = 0; i < 16; i++) {
      const sz = 8 + r() * 20;
      html += `<svg class="st${i % 3 === 0 ? ' y' : ''}" viewBox="0 0 24 24" style="left:${r() * 100}%;top:${r() * 100}%;width:${sz}px;--d:${3 + r() * 5}s;--dl:${-r() * 6}s"><path d="${STAR}"/></svg>`;
    }
    for (let i = 0; i < 9; i++) {
      const sz = 26 + r() * 30, edge = r() < 0.5;
      const x = edge ? (r() < 0.5 ? r() * 16 : 84 + r() * 14) : r() * 100, y = edge ? r() * 100 : (r() < 0.5 ? r() * 12 : 88 + r() * 10);
      html += `<svg class="dd" viewBox="0 0 24 24" style="left:${x}%;top:${y}%;width:${sz}px;transform:rotate(${(r() * 50 - 25) | 0}deg)"><path d="${DOODLES[i % DOODLES.length]}"/></svg>`;
    }
    html += '<i class="orbit" style="width:46vmax;height:46vmax;left:-14vmax;bottom:-18vmax"></i><i class="orbit" style="width:30vmax;height:30vmax;right:-8vmax;top:-10vmax"></i>';
    host.innerHTML = html;
  })();

  /* ───────── data ───────── */
  const str = (v, max = 600) => (typeof v === 'string' || typeof v === 'number') ? String(v).trim().slice(0, max) : '';
  const STYLES = [[/깃|고사리|솜/, 'feather'], [/곧|바늘|직선|선/, 'needle'], [/판|육각|면|유리/, 'plate'], [/가시|창|칼|날/, 'spike'], [/이슬|구슬|방울|물/, 'dew']];
  const STYLE_KO = { feather: '깃털', needle: '곧음', plate: '판', spike: '가시', dew: '이슬' };
  const clean = t => String(t || '').replace(/```[a-z]*/gi, '').replace(/\r/g, '');
  const isPrompt = t => /\[OOC\s*\d\/\d|잠시 역할극 중단|\[출력\]/.test(t);
  const unwrap = s => s.replace(/^[\s"'“”‘’「」『』]+|[\s"'“”‘’「」『』]+$/g, '');
  const KEY = /^[-*•\s]*[\[【]?\s*(대상|해동|본심|결정|핵|가지|빛깔|얼린\s*이유|녹지\s*않는\s*이유|속마음)\s*(\d*)\s*[\]】]?\s*([.:：)]?)\s*(.*)$/;
  const field = (v, name) => { const m = v.match(new RegExp('[\\[(（]\\s*' + name + '\\s*[:：]\\s*([^\\])）]*)')); return m ? unwrap(m[1]) : ''; };
  const tail = (v, name) => { const m = v.match(new RegExp('[\\[(（]\\s*' + name + '\\s*[:：]\\s*([\\s\\S]*)$')); return m ? unwrap(m[1].replace(/[\])）]\s*$/, '')) : ''; };

  function rows(text) {
    const out = [];
    for (const raw of clean(text).split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const m = line.match(KEY);
      if (m && m[4] && (m[2] || /[:：]/.test(m[3]))) out.push({ k: m[1].replace(/\s/g, ''), v: m[4].trim() });
      else if (out.length) out[out.length - 1].v += ' ' + line;
    }
    return out;
  }
  const parts = v => v.split(/\s*[·•|]\s*/).map(unwrap).filter(Boolean);
  const PASTED = 'OOC를 그대로 붙여 넣었어요. 채팅에 보낸 뒤 AI가 쓴 답을 복사해 주세요.';

  function parse1(text) {
    if (isPrompt(text)) throw new Error(PASTED);
    const out = { balloons: [] };
    for (const { k, v } of rows(text)) {
      if (k === '대상') { const [a, b] = v.split(/\s*(?:\/|→|->)\s*/); out.npc = unwrap(a || ''); out.pc = unwrap(b || ''); }
      else if (k === '해동') {
        const body = tail(v, '속마음') || unwrap(v.replace(/[\[(（]\s*감정[^\])）]*[\])）]/, ''));
        if (body) out.balloons.push({ tag: field(v, '감정'), text: body });
      } else if (k === '본심') out.final = unwrap(v);
    }
    if (out.balloons.length < 3) throw new Error(out.balloons.length ? '해동 항목이 너무 적어요. 답이 중간에 끊겼다면 채팅에서 다시 받아 주세요.' : '해동 항목을 찾지 못했어요. AI가 쓴 답의 코드 블록을 통째로 복사해 주세요.');
    const miss = [!out.npc && '대상', !out.final && '본심'].filter(Boolean);
    if (miss.length) throw new Error(`${miss.join(', ')} 항목이 빠졌어요. 답을 처음부터 끝까지 복사했는지 확인해 주세요.`);
    return out;
  }

  function parse2(text) {
    if (isPrompt(text)) throw new Error(PASTED);
    const c = { arms: [] };
    for (const { k, v } of rows(text)) {
      const ps = parts(v);
      if (k === '결정') { c.name = ps[0] || ''; c.desc = ps.slice(1).join(' · '); }
      else if (k === '핵') c.core = unwrap(v);
      else if (k === '가지') {
        const name = field(v, '이름'), len = +(field(v, '길이').match(/\d+(?:\.\d+)?/) || [0])[0];
        if (name) c.arms.push({ name, len, style: field(v, '결'), desc: tail(v, '설명') });
      } else if (k === '빛깔') c.light = { name: ps[0] || '', meaning: ps.slice(1).join(' · ') };
      else if (k === '얼린이유') c.frozen = unwrap(v);
      else if (k === '녹지않는이유') c.lasting = unwrap(v);
      else if (k === '속마음') c.truth = unwrap(v);
    }
    const miss = [!c.name && '결정', !c.core && '핵', c.arms.length < 6 && `가지(${c.arms.length}/6)`, !c.truth && '속마음'].filter(Boolean);
    if (!c.name && !c.core && !c.arms.length) throw new Error('감정서 항목을 찾지 못했어요. OOC ②의 답을 코드 블록째 복사해 주세요.');
    if (miss.length) throw new Error(`${miss.join(', ')} 항목이 빠졌어요. 답이 끊겼다면 채팅에서 다시 받아 주세요.`);
    return { crystal: c };
  }
  const PARSERS = [parse1, parse2];
  const SUMMARY = [
    d => `${d.npc} → ${d.pc} · 속마음 ${d.balloons.length}개`,
    d => `${d.crystal.name} · 가지 ${d.crystal.arms.length}개`
  ];

  function normalize(d) {
    if (!d || typeof d !== 'object') throw new Error('데이터 형식이 올바르지 않아요.');
    const balloons = (Array.isArray(d.balloons) ? d.balloons : []).map(b => ({ tag: str(b && b.tag, 16), text: str(b && b.text, 300) })).filter(b => b.text).slice(0, 16);
    if (balloons.length < 2) throw new Error('속마음이 비어 있어요. 채팅에서 다시 받아 주세요.');
    const c = d.crystal || {}, light = c.light || {};
    const rng = seeded(str(c.name) + str(d.npc)), keys = Object.keys(STYLE_KO);
    const arms = (Array.isArray(c.arms) ? c.arms : []).slice(0, 6).map(a => {
      const hit = STYLES.find(([re]) => re.test(str(a && a.style, 12)));
      return { name: str(a && a.name, 40), len: clamp(+(a && a.len) || 6, 1, 10), style: hit ? hit[1] : keys[rng() * keys.length | 0], desc: str(a && a.desc, 300) };
    });
    while (arms.length < 6) arms.push({ name: '', len: 3 + (rng() * 5 | 0), style: keys[rng() * keys.length | 0], desc: '' });
    return {
      npc: str(d.npc, 40) || 'NPC', pc: str(d.pc, 40) || 'PC', balloons,
      final: str(d.final, 300) || balloons[balloons.length - 1].text,
      crystal: { name: str(c.name, 60) || '이름 없는 결정', desc: str(c.desc, 400), core: str(c.core), arms,
        light: { name: str(light.name, 40), meaning: str(light.meaning, 300) }, frozen: str(c.frozen), lasting: str(c.lasting), truth: str(c.truth) }
    };
  }

  /* ───────── snowflake: six-fold crystal; each of the six ways becomes one tier of it ───────── */
  const PARTS = ['큰 축', '사이 축', '곁가지', '끝 장식', '핵 둘레', '끝 구슬'];
  function snowflake(svg, data, uid) {
    const W = '#ffffff', f = v => (+v).toFixed(2), U = id => `${uid}${id}`;
    const A = data.crystal.arms, edge = `stroke="${W}" stroke-width=".55" stroke-linejoin="round"`;
    const vein = (d, w = 0.5, o = 0.9) => `<path d="${d}" fill="none" stroke="${W}" stroke-width="${w}" stroke-linecap="round" opacity="${o}"/>`;
    const kite = (y0, y1, w, p, fill = 'a') => { const ym = y0 + (y1 - y0) * p; return `<path d="M0 ${f(-y0)}L${f(w)} ${f(-ym)}L0 ${f(-y1)}L${f(-w)} ${f(-ym)}Z" fill="url(#${U(fill)})" ${edge}/>`; };
    const hexP = (cy, r, rot = 0) => { let d = ''; for (let i = 0; i < 6; i++) { const t = (i * 60 + rot) * Math.PI / 180; d += (i ? 'L' : 'M') + f(Math.sin(t) * r) + ' ' + f(-cy - Math.cos(t) * r); } return d + 'Z'; };
    const star4 = (cy, z) => { const k = z * 0.16; return `<path transform="translate(0 ${f(-cy)})" d="M0 ${f(-z)}Q${f(k)} ${f(-k)} ${f(z)} 0Q${f(k)} ${f(k)} 0 ${f(z)}Q${f(-k)} ${f(k)} ${f(-z)} 0Q${f(-k)} ${f(-k)} 0 ${f(-z)}Z" fill="${W}"/>`; };
    const six = (g, off = 0) => { let o = ''; for (let i = 0; i < 6; i++) o += `<g transform="rotate(${i * 60 + off})">${g}</g>`; return o; };

    // a faceted blade from radius y0 to y1, shaped by its grain
    const blade = (st, y0, y1, k = 1) => {
      const L = y1 - y0;
      if (st === 'needle') return kite(y0, y1, 3.6 * k, 0.2) + vein(`M0 ${f(-y0)}L0 ${f(-y1)}`);
      if (st === 'plate') return kite(y0, y1, 9.5 * k, 0.56) + kite(y0 + L * 0.2, y1 - L * 0.16, 5 * k, 0.56, 'b') + vein(`M0 ${f(-y0)}L0 ${f(-y1)}`);
      if (st === 'spike') return kite(y0, y1, 4.6 * k, 0.14) + `<g transform="translate(0 ${f(-(y0 + L * 0.62))})"><g transform="rotate(38)">${kite(0, L * 0.3, 2.4 * k, 0.2, 'b')}</g><g transform="rotate(-38)">${kite(0, L * 0.3, 2.4 * k, 0.2, 'b')}</g></g>` + vein(`M0 ${f(-y0)}L0 ${f(-y1)}`);
      if (st === 'dew') return kite(y0, y1, 3 * k, 0.3) + vein(`M0 ${f(-y0)}L0 ${f(-y1)}`) + `<circle cy="${f(-(y0 + L * 0.55))}" r="${f(3 * k)}" fill="url(#${U('b')})" ${edge}/>`;
      let ribs = '';
      const w = 6.4 * k, pm = 0.3;
      for (let i = 1; i <= 7; i++) { const t = i / 8, y = y0 + L * t, half = (t < pm ? t / pm : (1 - t) / (1 - pm)) * w * 0.86; ribs += `M${f(-half)} ${f(-y + half * 0.7)}L0 ${f(-y)}L${f(half)} ${f(-y + half * 0.7)}`; }
      return kite(y0, y1, w, pm) + vein(ribs, 0.45, 0.85) + vein(`M0 ${f(-y0)}L0 ${f(-y1)}`);
    };
    // a small ornament centred at radius cy
    const gem = (st, cy, z) => {
      if (st === 'plate') return `<path d="${hexP(cy, z)}" fill="url(#${U('a')})" ${edge}/><path d="${hexP(cy, z * 0.5)}" fill="${W}" opacity=".9"/>`;
      if (st === 'needle') return star4(cy, z * 1.25);
      if (st === 'spike') return `<g transform="translate(0 ${f(-cy)})">${kite(-z * 0.9, z * 1.5, z * 0.55, 0.38)}</g>`;
      if (st === 'dew') return `<circle cy="${f(-cy)}" r="${f(z * 0.8)}" fill="url(#${U('a')})" ${edge}/><circle cy="${f(-cy)}" r="${f(z * 0.3)}" fill="${W}"/>`;
      return `<g transform="translate(0 ${f(-cy)})">${kite(-z * 1.1, z * 1.5, z * 0.8, 0.46)}${vein(`M0 ${f(z * 1.1)}L0 ${f(-z * 1.5)}M${f(-z * 0.5)} ${f(-z * 0.1)}L0 ${f(z * 0.35)}L${f(z * 0.5)} ${f(-z * 0.1)}`, 0.4)}</g>`;
    };

    const L1 = 50 + A[0].len * 3.6, L2 = 30 + A[1].len * 3.1, L3 = 28 + A[2].len * 3.3;
    const z4 = 3.4 + A[3].len * 0.42, h5 = 9 + A[4].len * 0.85, z6 = 2.2 + A[5].len * 0.3;
    const plate5 = A[4].style === 'dew' ? `<circle cy="${f(-h5 * 0.92)}" r="${f(h5 * 0.8)}" fill="url(#${U('b')})" ${edge}/>`
      : A[4].style === 'spike' ? kite(2, h5 * 2, h5 * 0.62, 0.62, 'b')
      : A[4].style === 'needle' ? kite(2, h5 * 2.1, h5 * 0.36, 0.5, 'b')
      : `<path d="${hexP(h5 * 0.94, h5, 30)}" fill="url(#${U('b')})" ${edge}/>` + (A[4].style === 'feather' ? `<path d="${hexP(h5 * 0.94, h5 * 0.55, 30)}" fill="none" ${edge}/>` : '');
    const tip1 = Math.min(L1, 96 - z4 * 1.6), tip2 = Math.min(L2, 92 - z6 * 1.5);
    const flake =
      six(`<g transform="rotate(21)">${blade(A[2].style, 15, L3, 0.82)}</g><g transform="rotate(-21)">${blade(A[2].style, 15, L3, 0.82)}</g>`) +
      six(blade(A[1].style, 12, tip2, 0.8) + gem(A[5].style, tip2, z6), 30) +
      six(blade(A[0].style, 8, tip1) + gem(A[3].style, tip1, z4)) +
      six(plate5, 30) +
      `<path d="${hexP(0, 6.5)}" fill="${W}"/>` + six(vein('M0 0L0 -13', 0.6));

    svg.innerHTML = `<defs>
      <radialGradient id="${U('g')}"><stop offset="0" stop-color="#9dbcff" stop-opacity=".7"/><stop offset=".6" stop-color="#9dbcff" stop-opacity=".2"/><stop offset="1" stop-color="#9dbcff" stop-opacity="0"/></radialGradient>
      <linearGradient id="${U('a')}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#cfe0ff" stop-opacity=".78"/><stop offset="1" stop-color="#fff" stop-opacity=".97"/></linearGradient>
      <linearGradient id="${U('b')}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity=".62"/></linearGradient>
      <filter id="${U('n')}" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="1.5" numOctaves="2" result="t"/><feColorMatrix in="t" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 2.2 -.75" result="a"/><feComposite in="SourceGraphic" in2="a" operator="in"/></filter>
      <filter id="${U('fr')}" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" result="t"/><feColorMatrix in="t" values="0 0 0 0 .42 0 0 0 0 .58 0 0 0 0 1 0 0 0 1.5 -.62" result="n"/><feComposite in="n" in2="SourceGraphic" operator="in" result="s"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="s"/></feMerge></filter>
    </defs>
    <g class="ly" style="--i:0"><circle r="80" fill="url(#${U('g')})" opacity=".35"/><circle r="80" fill="url(#${U('g')})" filter="url(#${U('n')})"/></g>
    <g class="ly" style="--i:1"><g class="rot" style="--dur:200s"><g filter="url(#${U('fr')})">${flake}</g></g></g>`;
  }

  /* ───────── ice ───────── */
  function layout(cols, rows, k = 1) {
    const occ = Array.from({ length: rows }, () => Array(cols).fill(false)), cells = [], out = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push([c, r]);
    for (let i = cells.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [cells[i], cells[j]] = [cells[j], cells[i]]; }
    const free = (c, r, w, h) => { if (c + w > cols || r + h > rows) return false; for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (occ[y][x]) return false; return true; };
    let big = 0;
    for (const [c, r] of cells) {
      if (occ[r][c]) continue;
      const p = Math.random();
      let w = 1, h = 1;
      if (p < 0.14 * k && big < 2 && free(c, r, 2, 2)) { w = h = 2; big++; }
      else if (p < 0.42 * k && free(c, r, 2, 1)) w = 2;
      else if (p < 0.62 * k && free(c, r, 1, 2)) h = 2;
      for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) occ[y][x] = true;
      out.push({ c, r, w, h });
    }
    return out;
  }

  function buildIce(host, cols, rows, interactive) {
    host.textContent = '';
    return layout(cols, rows, cols < 5 ? 0.55 : 1).map(b => {
      const area = b.w * b.h;
      const el = document.createElement(interactive ? 'button' : 'div');
      el.className = 'blk';
      if (interactive) el.type = 'button';
      el.style.cssText = `left:${b.c / cols * 100}%;top:${b.r / rows * 100}%;width:${b.w / cols * 100}%;height:${b.h / rows * 100}%`;
      el.innerHTML = '<span class="f"><svg viewBox="0 0 100 100" preserveAspectRatio="none"></svg></span>';
      host.appendChild(el);
      const hp = area === 1 ? 2 + (Math.random() * 3 | 0) : area === 2 ? 5 : 8;
      return { el, svg: el.querySelector('svg'), face: el.firstChild, hp, max: hp, area };
    });
  }

  function addCrack(b, x, y) {
    const k = 2 + (Math.random() * 2 | 0);
    let d = '';
    for (let i = 0; i < k; i++) {
      let a = rnd(0, 6.283), px = x, py = y;
      d += `M${px.toFixed(1)} ${py.toFixed(1)}`;
      for (let s = 0, m = 2 + (Math.random() * 3 | 0); s < m; s++) {
        a += rnd(-0.7, 0.7);
        const len = rnd(10, 26);
        px += Math.cos(a) * len; py += Math.sin(a) * len;
        d += `L${px.toFixed(1)} ${py.toFixed(1)}`;
      }
    }
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d); p.setAttribute('pathLength', '1');
    b.svg.appendChild(p);
  }

  /* ───────── game state ───────── */
  const state = { data: null, blocks: [], broken: 0, taps: 0, melt: 0, next: 0, thresholds: [], queue: [], lastShow: 0, timer: 0, side: 0, heartRect: null, hex: '#fff', sub: '#fff', done: false };
  const root = document.documentElement, body = document.body;
  const ice = $('#ice'), blocksEl = $('#blocks'), laneL = $('#laneL'), laneR = $('#laneR');
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers.clear(); };

  function setMelt(v) { state.melt = v; root.style.setProperty('--melt', v.toFixed(3)); }
  function show(name) {
    body.dataset.screen = name;
    for (const id of ['intro', 'play', 'result']) $('#' + id).hidden = id !== name;
    scrollTo(0, 0);
  }
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toast.id); toast.id = setTimeout(() => t.classList.remove('on'), 2200);
  }

  function startPlay(data) {
    clearTimers();
    state.data = data;
    Object.assign(state, { broken: 0, taps: 0, next: 0, queue: [], lastShow: 0, side: 0, done: false });
    setMelt(0);
    body.classList.remove('thawing', 'thawed');
    laneL.textContent = ''; laneR.textContent = '';
    $('#emblem').classList.remove('on'); $('#emblem').textContent = '';
    $('#pNpc').textContent = data.npc; $('#pPc').textContent = data.pc;
    $('#barPair').textContent = `${data.npc} → ${data.pc}`;
    show('play');
    const [cols, rows] = narrow.matches ? [4, 5] : [6, 4];
    state.blocks = buildIce(blocksEl, cols, rows, true);
    const total = state.blocks.length, n = data.balloons.length;
    state.thresholds = data.balloons.map((_, i) => clamp(Math.round((i + 0.6) * (total - 1) / n), 1, total - 1));
    state.blocks.forEach((b, i) => {
      b.el.setAttribute('aria-label', `얼음 블록 ${i + 1}`);
      b.el.addEventListener('pointerdown', e => {
        if (e.button > 0) return;
        const r = b.el.getBoundingClientRect();
        hit(b, e.clientX, e.clientY, r);
      });
      b.el.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        if (e.repeat) return;
        const r = b.el.getBoundingClientRect();
        hit(b, r.left + r.width * rnd(0.3, 0.7), r.top + r.height * rnd(0.3, 0.7), r, true);
      });
    });
    paintHud();
    state.heartRect = $('#ice .heart').getBoundingClientRect();
    ambient = true; kick();
    freezeIn();
  }

  // entrance: the bare heart beats alone, then ice closes in from the edges and seals it
  function freezeIn() {
    const curtain = $('#curtain'), msg = $('#cMsg'), cue = $('#cue');
    const say = (t, cls) => { cue.textContent = t; cue.className = 'cue'; void cue.offsetWidth; cue.classList.add(cls); };
    state.locked = false;
    body.classList.remove('freezing');
    curtain.className = 'curtain'; msg.className = 'c-msg'; cue.className = 'cue';
    if (reduce) return;
    state.locked = true;
    body.classList.add('freezing');
    curtain.classList.add('on');
    let t = 300;
    if (!state.seenHint) {
      later(() => msg.classList.add('show'), t);
      later(() => msg.classList.remove('show'), t + 2300);
      t += 3000;
    }
    state.seenHint = true;
    later(() => { say('READY~', 'ready'); Sfx.cue(0); }, t);
    later(() => { say('START!', 'start'); Sfx.cue(1); }, t + 1000);
    const STEP = 30, n = state.blocks.length, open = t + 1650;
    state.blocks.forEach(b => b.el.classList.add('wait'));
    later(() => {
      curtain.classList.remove('on');
      const box = ice.getBoundingClientRect(), mx = box.left + box.width / 2, my = box.top + box.height / 2;
      state.blocks.map(b => { const r = b.el.getBoundingClientRect(); return { b, d: Math.hypot(r.left + r.width / 2 - mx, r.top + r.height / 2 - my) }; })
        .sort((x, y) => y.d - x.d)
        .forEach(({ b }, i) => { b.el.style.setProperty('--fd', i * STEP + 'ms'); b.el.classList.remove('wait'); b.el.classList.add('freeze'); later(() => Sfx.frost(i / n), i * STEP); });
    }, open);
    later(() => {
      state.blocks.forEach(b => b.el.classList.remove('freeze'));
      body.classList.remove('freezing');
      ice.classList.remove('sealed'); void ice.offsetWidth; ice.classList.add('sealed');
      Sfx.seal();
      state.locked = false;
    }, open + n * STEP + 380);
  }

  function paintHud() {
    const left = state.blocks.length - state.broken;
    $('#hudCount').textContent = `ICE ${String(left).padStart(2, '0')} / ${String(state.blocks.length).padStart(2, '0')}`;
  }

  function hit(b, cxp, cyp, rect, viaKey) {
    if (b.hp <= 0 || state.done || state.locked) return;
    Sfx.init();
    b.hp--; state.taps++;
    const lx = clamp((cxp - rect.left) / rect.width * 100, 4, 96), ly = clamp((cyp - rect.top) / rect.height * 100, 4, 96);
    const dmg = 1 - b.hp / b.max;
    b.el.style.setProperty('--dmg', dmg.toFixed(2));
    b.el.style.setProperty('--hx', lx + '%'); b.el.style.setProperty('--hy', ly + '%');
    addCrack(b, lx, ly);
    if (b.hp > 0) {
      b.el.classList.remove('jolt'); void b.el.offsetWidth; b.el.classList.add('jolt');
      chips(cxp, cyp, 4);
      Sfx.tap(dmg);
      if (b.hp === Math.floor(b.max / 2)) Sfx.crack();
      return;
    }
    // break
    state.broken++;
    const lastOne = state.broken === state.blocks.length;
    b.el.classList.add('gone'); b.el.disabled = true;
    later(() => b.el.remove(), 260);
    burst(rect, cxp, cyp);
    Sfx.shatter(lastOne ? 4 : b.area === 1 ? 1 : b.area === 2 ? 2 : 3);
    if (navigator.vibrate) navigator.vibrate(lastOne ? [30, 40, 60] : 12 + b.area * 6);
    if (!reduce) { ice.classList.remove('shake'); void ice.offsetWidth; ice.classList.add('shake'); }
    setMelt(state.broken / state.blocks.length);
    paintHud();
    state.heartRect = $('#ice .heart').getBoundingClientRect();
    if (lastOne) return finale();
    if (viaKey) { const nx = state.blocks.find(o => o.hp > 0); if (nx) nx.el.focus(); }
    while (state.next < state.thresholds.length && state.broken >= state.thresholds[state.next]) state.queue.push(state.next++);
    pump();
  }

  function pump() {
    if (!state.queue.length || state.timer || state.done) return;
    const wait = 1700 - (performance.now() - state.lastShow);
    if (wait > 0) { state.timer = later(() => { state.timer = 0; pump(); }, wait); return; }
    bubble(state.data.balloons[state.queue.shift()]);
    state.lastShow = performance.now();
    if (state.queue.length) pump();
  }

  function bubble(b) {
    const single = narrow.matches;
    const lane = single ? laneL : laneR;
    const el = document.createElement('div');
    el.className = 'bubble';
    if (b.tag) { const t = document.createElement('b'); t.textContent = b.tag; el.appendChild(t); }
    el.appendChild(document.createTextNode(b.text));
    const live = [...lane.children].filter(c => !c.classList.contains('out'));
    const keep = single ? 0 : 2;
    live.slice(0, Math.max(0, live.length - keep)).forEach(dismiss);
    if (single) [...lane.children].forEach(c => c.remove());
    lane.appendChild(el);
    $('#live').textContent = b.text;
    later(() => dismiss(el), Math.max(5200, b.text.length * 130));
  }
  function dismiss(el) {
    if (!el.isConnected || el.classList.contains('out')) return;
    el.classList.add('out');
    setTimeout(() => el.remove(), 620);
  }

  function finale() {
    state.done = true; state.queue = [];
    later(() => { ambient = false; }, 600);
    const d = state.data, r = ice.getBoundingClientRect(), mx = r.left + r.width / 2, my = r.top + r.height / 2;
    const fl = $('#flash');
    if (!reduce) { fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go'); }
    for (let i = 0; i < (reduce ? 6 : 46); i++) {
      const a = rnd(0, 6.283), v = rnd(60, 520);
      spark(mx, my, Math.cos(a) * v, Math.sin(a) * v, rnd(5, 16), rnd(0.8, 2), ['#ffffff', '#cfe0ff', '#9dbcff'][i % 3]);
    }
    kick();
    [...laneL.children, ...laneR.children].forEach(dismiss);
    $('#mName').textContent = d.crystal.name;
    $('#mDesc').textContent = d.crystal.desc;
    $('#mFinal').textContent = d.final;
    snowflake($('#emblem'), d, 'e1');
    later(() => { body.classList.add('thawing'); $('#emblem').classList.add('on'); Sfx.bloom(); }, reduce ? 50 : 650);
    later(() => { body.classList.add('thawed'); $('#toResult').focus({ preventScroll: true }); state.heartRect = ice.getBoundingClientRect(); }, reduce ? 100 : 1900);
  }

  function fillList(host, items, make) { host.textContent = ''; items.forEach((it, i) => host.appendChild(make(it, i))); }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }

  function showResult() {
    const d = state.data, c = d.crystal;
    ambient = false;
    $('#rNpc').textContent = d.npc; $('#rPc').textContent = d.pc;
    const now = new Date();
    $('#rDate').textContent = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
    const code = seeded(d.npc + d.pc + c.name);
    $('#rNo').textContent = 'No. IM-' + String(code() * 9000 + 1000 | 0);
    $('#ringText').textContent = `For ${d.pc} only · Snow crystal certificate · ${c.name} · One of one · `.repeat(2);
    $('#rName').textContent = c.name; $('#rDesc').textContent = c.desc;
    $('#rLight').textContent = c.light.name ? `${c.light.name}${c.light.meaning ? ' · ' + c.light.meaning : ''}` : '';
    $('#rLight').parentElement.hidden = !c.light.name;
    $('#rCore').textContent = c.core; $('#rFrozen').textContent = c.frozen; $('#rLasting').textContent = c.lasting; $('#rTruth').textContent = c.truth;
    for (const id of ['rCore', 'rFrozen', 'rLasting', 'rTruth']) $('#' + id).closest('.item').hidden = !$('#' + id).textContent;
    $('.duo').hidden = !c.frozen && !c.lasting;
    const named = c.arms.map((a, i) => ({ ...a, i })).filter(a => a.name);
    fillList($('#rArms'), named, a => {
      const li = el('li');
      li.append(el('b', '', String(a.i + 1)));
      const box = el('div'), head = el('p', 'arm-name', a.name);
      head.append(el('span', 'arm-style', `${PARTS[a.i]} · ${STYLE_KO[a.style]}`));
      box.append(head);
      if (a.desc) box.append(el('p', '', a.desc));
      li.append(box);
      return li;
    });
    $('#rArms').closest('.item').hidden = !named.length;
    fillList($('#rLog'), d.balloons, b => { const li = el('li'); if (b.tag) li.append(el('b', '', b.tag)); li.append(document.createTextNode(b.text)); return li; });
    $('#rLogN').textContent = `(${d.balloons.length})`;
    snowflake($('#emblemR'), d, 'e2');
    setMelt(1);
    show('result');
  }

  function resultText() {
    const d = state.data, c = d.crystal;
    return [
      `ICE MELT · 눈 결정 감정서 — ${d.npc} → ${d.pc}`,
      `결정: ${c.name}${c.desc ? ' — ' + c.desc : ''}`,
      c.light.name && `빛깔: ${c.light.name}${c.light.meaning ? ' — ' + c.light.meaning : ''}`,
      c.core && `핵: ${c.core}`,
      ...c.arms.filter(a => a.name).map((a, i) => `가지 ${i + 1}: ${a.name}${a.desc ? ' — ' + a.desc : ''}`),
      c.frozen && `얼린 이유: ${c.frozen}`,
      c.lasting && `녹지 않는 이유: ${c.lasting}`,
      c.truth && `속마음: ${c.truth}`
    ].filter(Boolean).join('\n');
  }

  async function copy(text, ok) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { ok = '복사하지 못했어요. 직접 선택해 복사해 주세요.'; }
      ta.remove();
    }
    toast(ok);
  }

  function goHome() {
    clearTimers(); ambient = false; state.done = true; state.locked = false;
    body.classList.remove('freezing');
    body.classList.remove('thawing', 'thawed');
    setMelt(0);
    show('intro');
  }

  /* ───────── OOC steps ───────── */
  const STEPS = [
    { title: '해동 기록', desc: '얼음이 깨질 때마다 새어 나올 속마음과 마지막 본심을 받습니다.', ph: '대상: … / …\n해동 1 [감정: …] (속마음: …)\n본심: …' },
    { title: '눈 결정 감정', desc: '같은 채팅에 이어서 보냅니다. 얼음이 다 깨진 뒤 남는 눈 결정 한 송이의 이름, 핵, 여섯 가지를 받습니다.', ph: '결정: … · …\n핵: …\n가지 1 [이름: …] [길이: 0] [결: …] (설명: …)' }
  ];
  const MARK = ['①', '②'];
  const stepsEl = $('#steps'), startBtn = $('#startBtn'), lastBtn = $('#lastBtn');
  const answers = [null, null];

  stepsEl.innerHTML = STEPS.map((st, i) => `
    <li class="step" data-i="${i}" data-state="empty">
      <span class="no" aria-hidden="true">${i + 1}</span>
      <div class="step-body">
        <div class="step-head"><h2>${st.title}</h2><span class="status" aria-live="polite"></span></div>
        <p>${st.desc}</p>
        <div class="acts">
          <button class="btn" type="button" data-act="copy">OOC ${MARK[i]} 복사</button>
          <span class="arrow" aria-hidden="true">→</span>
          <button class="btn" type="button" data-act="paste">답 붙여넣기</button>
        </div>
        <textarea id="answer${i + 1}" rows="5" spellcheck="false" aria-label="${st.title} 답 직접 입력" placeholder="${st.ph.replace(/\n/g, '&#10;')}" hidden></textarea>
        <div class="got" hidden><span class="got-text"></span><button class="link" type="button" data-act="redo">다시 넣기</button><button class="link" type="button" data-act="clear">지우기</button></div>
        <p class="error" role="alert" hidden></p>
        <div class="minor">
          <button class="link" type="button" data-act="manual">직접 붙여넣기</button>
          <button class="link" type="button" data-act="peek" aria-expanded="false">OOC 내용 보기</button>
        </div>
        <pre class="prompt" hidden></pre>
      </div>
    </li>`).join('');

  const stepEl = i => stepsEl.children[i];
  function paintSteps() {
    STEPS.forEach((_, i) => {
      const el = stepEl(i), done = !!answers[i], locked = i > 0 && !answers[i - 1];
      el.dataset.state = done ? 'done' : locked ? 'locked' : 'empty';
      $('.status', el).textContent = done ? '✓ 완료' : locked ? '앞 단계 먼저' : '대기 중';
      $('.got', el).hidden = !done;
      $('.acts', el).hidden = done;
      $('.minor', el).hidden = done;
      if (done) { $('.got-text', el).textContent = SUMMARY[i](answers[i]); $('textarea', el).hidden = true; $('.prompt', el).hidden = true; }
      el.querySelectorAll('.acts button, .minor button').forEach(b => { b.disabled = locked; });
    });
    startBtn.disabled = !(answers[0] && answers[1]);
  }
  function fail(i, msg) { const e = $('.error', stepEl(i)); e.textContent = msg; e.hidden = !msg; }
  function accept(i, text, quiet) {
    try {
      answers[i] = PARSERS[i](text);
      store.set('icemelt2:a' + i, text);
      fail(i, '');
      paintSteps();
      if (!quiet) { toast(`${STEPS[i].title} 확인 완료`); (answers[0] && answers[1] ? startBtn : $('[data-act="copy"]', stepEl(i + 1))).focus(); }
      return true;
    } catch (e) { if (!quiet) fail(i, e.message); return false; }
  }
  function openManual(i, msg) {
    const ta = $('textarea', stepEl(i));
    ta.hidden = false; ta.focus();
    if (msg) fail(i, msg);
  }
  stepsEl.addEventListener('click', async e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const el = btn.closest('.step'), i = +el.dataset.i, act = btn.dataset.act;
    if (act === 'copy') copy(window.ICE.PROMPTS[i], `OOC ${MARK[i]}을 복사했어요. 채팅에 보내 주세요.`);
    else if (act === 'paste') {
      let text = '';
      try { text = await navigator.clipboard.readText(); }
      catch { return openManual(i, '브라우저가 클립보드 읽기를 막았어요. 아래 칸에 직접 붙여 넣어 주세요.'); }
      if (!text.trim()) return fail(i, '클립보드가 비어 있어요. 채팅에서 AI의 답을 복사한 뒤 다시 눌러 주세요.');
      accept(i, text);
    } else if (act === 'manual') openManual(i);
    else if (act === 'peek') {
      const pre = $('.prompt', el), open = pre.hidden;
      pre.textContent = window.ICE.PROMPTS[i]; pre.hidden = !open;
      btn.setAttribute('aria-expanded', String(open)); btn.textContent = open ? 'OOC 내용 접기' : 'OOC 내용 보기';
    } else if (act === 'redo' || act === 'clear') {
      for (let j = i; j < (act === 'clear' ? answers.length : i + 1); j++) { answers[j] = null; store.set('icemelt2:a' + j, ''); $('textarea', stepEl(j)).value = ''; fail(j, ''); }
      paintSteps();
      if (act === 'redo') openManual(i);
    }
  });
  stepsEl.addEventListener('input', e => {
    if (e.target.tagName !== 'TEXTAREA') return;
    const i = +e.target.closest('.step').dataset.i;
    clearTimeout(e.target._t);
    if (!e.target.value.trim()) return fail(i, '');
    e.target._t = setTimeout(() => accept(i, e.target.value), 350);
  });

  const build = () => normalize({ ...answers[0], ...answers[1] });
  function begin(d) { store.set('icemelt2:last', JSON.stringify(d)); lastBtn.hidden = false; Sfx.init(); startPlay(d); }

  [0, 1].forEach(i => { const t = store.get('icemelt2:a' + i); if (t && (i === 0 || answers[0])) accept(i, t, true); });
  paintSteps();
  let lastData = null;
  try { lastData = normalize(JSON.parse(store.get('icemelt2:last'))); } catch { /* nothing saved */ }
  lastBtn.hidden = !lastData;

  /* ───────── wiring ───────── */
  startBtn.addEventListener('click', () => { try { begin(build()); } catch (e) { toast(e.message); } });
  $('#sampleBtn').addEventListener('click', () => { Sfx.init(); startPlay(normalize({ ...parse1(window.ICE.SAMPLE[0]), ...parse2(window.ICE.SAMPLE[1]) })); });
  lastBtn.addEventListener('click', () => {
    let d = null;
    try { d = normalize(JSON.parse(store.get('icemelt2:last'))); } catch { /* fall through */ }
    if (d) { Sfx.init(); startPlay(d); } else toast('저장된 해동 기록이 없어요.');
  });
  $('#toResult').addEventListener('click', () => { Sfx.ui(); showResult(); });
  $('#againBtn').addEventListener('click', () => startPlay(state.data));
  $('#newBtn').addEventListener('click', goHome);
  $('#homeBtn').addEventListener('click', goHome);
  $('#copyResult').addEventListener('click', () => copy(resultText(), '결과를 복사했어요.'));
  addEventListener('resize', () => { if (body.dataset.screen === 'play') state.heartRect = (state.done ? ice : $('#ice .heart')).getBoundingClientRect(); });
})();
