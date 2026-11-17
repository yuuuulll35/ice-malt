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
    if (!reduce) for (let i = 0; i < 5; i++) spark(rect.left + Math.random() * rect.width, rect.top + Math.random() * rect.height, rnd(-50, 50), rnd(-120, -30), rnd(5, 11), rnd(0.5, 1), i % 2 ? '#fff' : '#ffd55e');
    kick();
  }
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    cx.clearRect(0, 0, W, H);
    if (ambient && !reduce && state.heartRect && Math.random() < 0.05 + state.melt * 0.35) {
      const r = state.heartRect;
      P.push({ k: 2, x: r.left + r.width * rnd(0.2, 0.8), y: r.top + r.height * rnd(0.3, 0.8), vx: rnd(-14, 14), vy: rnd(-55, -20), s: rnd(1.5, 4), life: 2.4, max: 2.4, col: Math.random() < 0.5 ? state.hex : state.sub });
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
  const hexOk = (v, fb) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(str(v)) ? str(v) : fb;
  const SHAPES = ['orb', 'heart', 'gem', 'ring', 'wave', 'thread', 'petal', 'drop', 'ray', 'dot', 'star', 'shard'];

  const KO_SHAPES = [[/핵|불씨|빛의\s*핵/, 'orb'], [/하트|심장/, 'heart'], [/보석|원석/, 'gem'], [/고리|링|원/, 'ring'], [/물결|파문/, 'wave'], [/실타래|실|끈/, 'thread'],
    [/꽃잎|꽃/, 'petal'], [/물방울|방울|눈물/, 'drop'], [/빛살|광선|햇살/, 'ray'], [/점|구슬|알갱이/, 'dot'], [/별/, 'star'], [/결정|조각|파편/, 'shard']];
  const clean = t => String(t || '').replace(/```[a-z]*/gi, '').replace(/\r/g, '');
  const isPrompt = t => /\[OOC\s*\d\/\d|잠시 역할극 중단|\[출력\]/.test(t);
  const unwrap = s => s.replace(/^[\s"'“”‘’「」『』]+|[\s"'“”‘’「」『』]+$/g, '');
  const KEY = /^[-*•\s]*[\[【]?\s*(대상|해동|본심|온도|보조\s*색|색상?|하트\s*컬러|컬러|형상\s*구성|구성|형상|순간|본질|속마음)\s*(\d*)\s*[\]】]?\s*([.:：)]?)\s*(.*)$/;

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

  function parse1(text) {
    if (isPrompt(text)) throw new Error('OOC를 그대로 붙여 넣었어요. 채팅에 보낸 뒤 AI가 쓴 답을 복사해 주세요.');
    const out = { balloons: [] };
    for (const { k, v } of rows(text)) {
      if (k === '대상') { const [a, b] = v.split(/\s*(?:\/|→|->)\s*/); out.npc = unwrap(a || ''); out.pc = unwrap(b || ''); }
      else if (k === '해동') {
        const tag = (v.match(/[\[(（]\s*감정\s*[:：]\s*([^\])）]*)/) || [])[1];
        const body = (v.match(/[\[(（]\s*속마음\s*[:：]\s*([\s\S]*)$/) || [])[1];
        const textOut = unwrap((body !== undefined ? body : v.replace(/[\[(（]\s*감정[^\])）]*[\])）]/, '')).replace(/[\])）]\s*$/, ''));
        if (textOut) out.balloons.push({ tag: unwrap(tag || ''), text: textOut });
      } else if (k === '본심') out.final = unwrap(v);
    }
    if (out.balloons.length < 3) throw new Error(out.balloons.length ? '해동 항목이 너무 적어요. 답이 중간에 끊겼다면 채팅에서 다시 받아 주세요.' : '해동 항목을 찾지 못했어요. AI가 쓴 답의 코드 블록을 통째로 복사해 주세요.');
    const miss = [!out.npc && '대상', !out.final && '본심'].filter(Boolean);
    if (miss.length) throw new Error(`${miss.join(', ')} 항목이 빠졌어요. 답을 처음부터 끝까지 복사했는지 확인해 주세요.`);
    return out;
  }

  function parse2(text) {
    if (isPrompt(text)) throw new Error('OOC를 그대로 붙여 넣었어요. 채팅에 보낸 뒤 AI가 쓴 답을 복사해 주세요.');
    const out = { form: {}, temp: {}, color: {} };
    for (const { k, v } of rows(text)) {
      const ps = parts(v);
      if (k === '온도') {
        const head = ps[0] || '', m = head.match(/[-−+]?\s*\d[\d,]*(?:\.\d+)?/);
        out.temp = m ? { value: m[0].replace(/\s/g, '').replace('−', '-'), unit: head.slice(m.index + m[0].length).trim() || '°C', note: ps.slice(1).join(' · ') }
          : { value: head, unit: '', note: ps.slice(1).join(' · ') };
      } else if (k === '색' || k === '색상' || k === '하트컬러' || k === '컬러') {
        const hex = (v.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/i) || [])[0], rest = ps.filter(p => !/^#[0-9a-f]{3,6}$/i.test(p));
        Object.assign(out.color, { hex, name: rest[0] || '', meaning: rest.slice(1).join(' · ') });
      } else if (k === '보조색') out.color.sub = (v.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/i) || [])[0];
      else if (k === '형상') { out.form.name = ps[0] || ''; out.form.desc = ps.slice(1).join(' · '); }
      else if (k === '구성' || k === '형상구성') {
        out.form.layers = v.split(/\s*[,，、·]\s*/).map(t => {
          const hit = KO_SHAPES.find(([re]) => re.test(t));
          return hit && { shape: hit[1], count: +(t.match(/\d+/) || [0])[0] };
        }).filter(Boolean);
      } else if (k === '순간') out.moment = unwrap(v);
      else if (k === '본질') out.essence = unwrap(v);
      else if (k === '속마음') out.truth = unwrap(v);
    }
    const miss = [!out.temp.value && '온도', !out.color.hex && '색(#RRGGBB)', !out.form.name && '형상', !out.truth && '속마음'].filter(Boolean);
    if (miss.length === 4) throw new Error('판독 항목을 찾지 못했어요. OOC ②의 답을 코드 블록째 복사해 주세요.');
    if (miss.length) throw new Error(`${miss.join(', ')} 항목이 빠졌어요. 답이 끊겼다면 채팅에서 다시 받아 주세요.`);
    return out;
  }
  const PARSERS = [parse1, parse2];
  const SUMMARY = [
    d => `${d.npc} → ${d.pc} · 속마음 ${d.balloons.length}개`,
    d => `${d.temp.value}${d.temp.unit} · ${d.color.name || d.color.hex} · ${d.form.name}`
  ];

  function normalize(d) {
    if (!d || typeof d !== 'object') throw new Error('데이터 형식이 올바르지 않아요.');
    const balloons = (Array.isArray(d.balloons) ? d.balloons : [])
      .map(b => typeof b === 'string' ? { tag: '', text: str(b, 300) } : { tag: str(b && b.tag, 16), text: str(b && b.text, 300) })
      .filter(b => b.text).slice(0, 16);
    if (balloons.length < 2) throw new Error('속마음 말풍선(balloons)이 비어 있어요. 채팅에서 다시 생성해 주세요.');
    const f = d.form || {}, t = d.temp || {}, c = d.color || {};
    const layers = (Array.isArray(f.layers) ? f.layers : []).map(l => {
      if (typeof l === 'string') { const [s, n] = l.split(':'); l = { shape: s, count: +n }; }
      l = l || {};
      return { shape: str(l.shape, 12).toLowerCase(), count: +l.count || 0, r: Number.isFinite(+l.r) && l.r !== null && l.r !== undefined && l.r !== '' ? +l.r : null, size: +l.size || 0 };
    }).filter(l => SHAPES.includes(l.shape)).slice(0, 7);
    return {
      npc: str(d.npc, 40) || 'NPC', pc: str(d.pc, 40) || 'PC',
      balloons,
      final: str(d.final, 300) || balloons[balloons.length - 1].text,
      form: { name: str(f.name, 60) || '이름 없는 형상', desc: str(f.desc, 400), layers },
      temp: { value: str(t.value, 12) || '—', unit: str(t.unit, 6), note: str(t.note, 300) },
      color: { name: str(c.name, 40) || '이름 없는 색', hex: hexOk(c.hex, '#FF9FBF'), sub: hexOk(c.sub, '#FFE2A8'), meaning: str(c.meaning, 300) },
      moment: str(d.moment), essence: str(d.essence), truth: str(d.truth)
    };
  }

  /* ───────── emblem: a small star chart drawn from the form's layers ───────── */
  function emblem(svg, data, uid) {
    const { hex, sub } = data.color, rng = seeded(data.form.name + data.npc);
    let layers = data.form.layers;
    if (layers.length < 2) {
      const pool = ['petal', 'wave', 'thread', 'drop', 'shard', 'star', 'dot', 'ray', 'ring'];
      layers = [{ shape: 'orb' }];
      for (let i = 0; i < 4; i++) layers.push({ shape: pool[rng() * pool.length | 0], count: 5 + (rng() * 8 | 0) });
      layers = layers.map(l => ({ count: 0, r: null, size: 0, ...l }));
    }
    const SILVER = '#eef2ff', n = layers.length, f = v => (+v).toFixed(2), U = id => `${uid}${id}`;
    const polar = (fn, steps, turns = 1) => {
      let d = '';
      for (let i = 0; i <= steps; i++) { const a = i / steps * Math.PI * 2 * turns, r = fn(a); d += (i ? 'L' : 'M') + f(Math.cos(a) * r) + ' ' + f(Math.sin(a) * r); }
      return d + 'Z';
    };
    const around = (cnt, fn) => { let o = ''; for (let i = 0; i < cnt; i++) o += `<g transform="rotate(${f(i * 360 / cnt)})">${fn(i)}</g>`; return o; };
    const spark = (sz, t = 0.1) => { const k = sz * t; return `M0 ${f(-sz)}Q${f(k)} ${f(-k)} ${f(sz)} 0Q${f(k)} ${f(k)} 0 ${f(sz)}Q${f(-k)} ${f(k)} ${f(-sz)} 0Q${f(-k)} ${f(-k)} 0 ${f(-sz)}Z`; };
    const star = (sz, col, extra = '') => `<path d="${spark(sz)}" fill="url(#${U('s')})" stroke="${col}" stroke-width=".5" stroke-linejoin="round" ${extra}/>`;
    const star8 = (sz, col) => `<path d="${spark(sz * 0.5, 0.16)}" transform="rotate(45)" fill="${SILVER}" opacity=".85"/>${star(sz, col)}`;

    let out = `<defs>
      <radialGradient id="${U('g')}"><stop offset="0" stop-color="${hex}" stop-opacity=".95"/><stop offset=".55" stop-color="${hex}" stop-opacity=".4"/><stop offset="1" stop-color="${hex}" stop-opacity="0"/></radialGradient>
      <radialGradient id="${U('g2')}"><stop offset="0" stop-color="${sub}" stop-opacity=".9"/><stop offset="1" stop-color="${sub}" stop-opacity="0"/></radialGradient>
      <linearGradient id="${U('s')}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#c9d4ff"/></linearGradient>
      <linearGradient id="${U('p')}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="-1"><stop offset="0" stop-color="${hex}" stop-opacity="0"/><stop offset="1" stop-color="${hex}" stop-opacity=".9"/></linearGradient>
      <linearGradient id="${U('b')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sub}" stop-opacity=".05"/><stop offset="1" stop-color="${sub}" stop-opacity=".75"/></linearGradient>
      <filter id="${U('n')}" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="1.5" numOctaves="2" seed="${rng() * 99 | 0}" result="t"/><feColorMatrix in="t" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 2.2 -.75" result="a"/><feComposite in="SourceGraphic" in2="a" operator="in"/></filter>
    </defs>`;
    out += `<circle r="78" fill="url(#${U('g')})" opacity=".35"/><circle r="78" fill="url(#${U('g')})" filter="url(#${U('n')})"/>`;
    let dust = '';
    for (let i = 0; i < 16; i++) {
      const a = rng() * 6.283, r = 30 + rng() * 66, x = Math.cos(a) * r, y = Math.sin(a) * r;
      dust += i % 4 === 0 ? `<g transform="translate(${f(x)} ${f(y)})">${star(2 + rng() * 2.5, i % 8 ? hex : sub)}</g>` : `<circle cx="${f(x)}" cy="${f(y)}" r="${f(0.4 + rng() * 0.7)}" fill="${i % 3 ? SILVER : sub}" opacity="${f(0.5 + rng() * 0.5)}"/>`;
    }
    out += `<g class="ly" style="--i:0">${dust}</g>`;

    layers.forEach((l, i) => {
      const c = i % 2 ? sub : hex;
      const r = clamp(l.r === null ? (n === 1 ? 50 : 14 + i * 68 / (n - 1)) : l.r, 0, 92);
      const cnt = k => clamp(Math.round(l.count) || k, 1, 36);
      const thin = `fill="none" stroke-linecap="round" stroke-linejoin="round"`;
      let g = '', spin = true;
      switch (l.shape) {
        case 'orb': { const sz = l.size || 20; spin = false;
          g = `<circle r="${f(sz * 1.5)}" fill="url(#${U('g2')})" filter="url(#${U('n')})"/><circle r="${f(sz * 0.9)}" fill="url(#${U('g')})"/>${star8(sz * 1.6, hex)}<circle r="${f(sz * 0.12)}" fill="#fff"/>`; break; }
        case 'heart': { const sz = (l.size || 20) / 50; spin = false;
          g = `<g transform="scale(${f(sz)}) translate(-50 -46)"><path d="M50 90C22 68 4 51 4 30 4 15 15 4 29 4c9 0 17 5 21 13C54 9 62 4 71 4c14 0 25 11 25 26 0 21-18 38-46 60Z" fill="url(#${U('g')})" stroke="${SILVER}" stroke-width="1.6"/><path d="M17 28c1-8 6-13 13-14" ${thin} stroke="#fff" stroke-width="2.4"/></g>`; break; }
        case 'gem': { const k = clamp(cnt(6), 3, 12), sz = l.size || 24, poly = q => polar(() => q, k);
          g = `<path d="${poly(sz)}" fill="${c}" fill-opacity=".22" stroke="${SILVER}" stroke-width=".7" stroke-linejoin="round"/><path d="${poly(sz * 0.52)}" fill="#fff" fill-opacity=".18" stroke="${SILVER}" stroke-width=".5"/>`
            + around(k, () => `<path d="M${f(sz * 0.52)} 0L${f(sz)} 0" stroke="${SILVER}" stroke-width=".5"/>`); break; }
        case 'ring': { const tilt = -24 + i * 37, k = l.count ? cnt(1) : 1;
          let moons = '';
          for (let j = 0; j < Math.min(k, 6); j++) { const a = j / Math.min(k, 6) * 6.283 + 0.6; moons += `<circle cx="${f(Math.cos(a) * r)}" cy="${f(Math.sin(a) * r * 0.36)}" r="${j ? 1.4 : 2.6}" fill="${j ? SILVER : c}" stroke="${SILVER}" stroke-width=".4"/>`; }
          spin = false;
          g = `<g transform="rotate(${tilt})"><ellipse rx="${f(r)}" ry="${f(r * 0.36)}" ${thin} stroke="${c}" stroke-width=".8"/><ellipse rx="${f(r)}" ry="${f(r * 0.36)}" ${thin} stroke="${SILVER}" stroke-width=".3" stroke-dasharray="1 3"/>${moons}</g>`; break; }
        case 'wave': { const k = cnt(8), a = l.size || 4; g = `<path d="${polar(t => r + a * Math.sin(k * t), 240)}" ${thin} stroke="${SILVER}" stroke-width=".6" opacity=".9"/>`; break; }
        case 'thread': { const k = cnt(5); g = `<path d="${polar(t => r * (0.56 + 0.44 * Math.cos((k + 0.5) * t)), 420, 2)}" ${thin} stroke="${c}" stroke-width=".6"/>`; break; }
        case 'petal': { const k = cnt(6), a = r * 0.16, w = l.size || Math.max(5, r * 2.4 / k);
          g = `<g>` + around(k, () => `<path d="M0 ${f(-a)}C${f(w)} ${f(-a - (r - a) * 0.35)} ${f(w)} ${f(-r + (r - a) * 0.12)} 0 ${f(-r)}C${f(-w)} ${f(-r + (r - a) * 0.12)} ${f(-w)} ${f(-a - (r - a) * 0.35)} 0 ${f(-a)}Z" fill="url(#${U('p')})" stroke="${SILVER}" stroke-width=".5" stroke-linejoin="round"/>`).replace(/y2="-1"/g, '') + `</g>`;
          break; }
        case 'drop': { const k = cnt(6), sz = l.size || 5.5;
          g = around(k, j => { const q = j % 2 ? sz * 0.65 : sz; return `<g transform="translate(0 ${f(-r)})"><circle r="${f(q)}" fill="url(#${U('b')})" stroke="${c}" stroke-width=".6"/><path d="M${f(-q * 0.55)} ${f(-q * 0.2)}A${f(q * 0.6)} ${f(q * 0.6)} 0 0 1 ${f(-q * 0.1)} ${f(-q * 0.6)}" ${thin} stroke="#fff" stroke-width=".8"/></g>`; }); break; }
        case 'ray': { const k = cnt(12), sz = l.size || 9;
          g = `<circle r="${f(r)}" ${thin} stroke="${SILVER}" stroke-width=".3" opacity=".5"/>` + around(k, j => `<path d="M0 ${f(-r)}L0 ${f(-r - (j % 2 ? sz * 0.4 : sz))}" ${thin} stroke="${SILVER}" stroke-width="${j % 2 ? 0.4 : 0.7}"/>`); break; }
        case 'dot': { const k = cnt(10), sz = l.size || 1.6, pts = [];
          for (let j = 0; j < k; j++) { const a = j / k * 6.283 + (rng() - 0.5) * 0.3, q = r + (rng() - 0.5) * 14; pts.push([Math.cos(a) * q, Math.sin(a) * q, rng()]); }
          g = `<path d="${pts.map((p2, j) => (j ? 'L' : 'M') + f(p2[0]) + ' ' + f(p2[1])).join('')}" ${thin} stroke="${SILVER}" stroke-width=".35" stroke-dasharray="1.5 2" opacity=".75"/>`
            + pts.map(p2 => p2[2] > 0.7 ? `<g transform="translate(${f(p2[0])} ${f(p2[1])})">${star(sz * 3, c)}</g>` : `<circle cx="${f(p2[0])}" cy="${f(p2[1])}" r="${f(sz * (0.6 + p2[2]))}" fill="${p2[2] > 0.35 ? SILVER : c}"/>`).join(''); break; }
        case 'star': { const k = cnt(5), sz = l.size || 8; g = around(k, j => `<g transform="translate(0 ${f(-r)})">${star(j % 2 ? sz * 0.55 : sz, c)}</g>`); break; }
        case 'shard': { const k = cnt(6), sz = l.size || 13;
          g = around(k, j => { const q = j % 2 ? sz * 0.6 : sz; return `<path d="M0 ${f(-r - q)}L${f(q * 0.2)} ${f(-r)}L0 ${f(-r + q * 0.6)}L${f(-q * 0.2)} ${f(-r)}Z" fill="${c}" fill-opacity=".3" stroke="${SILVER}" stroke-width=".5" stroke-linejoin="round"/>`; }); break; }
      }
      if (l.shape === 'petal') g = g.replace(new RegExp(`url\\(#${U('p')}\\)`, 'g'), `url(#${U('p' + i)})`), out += `<defs><linearGradient id="${U('p' + i)}" gradientUnits="userSpaceOnUse" x1="0" y1="${f(-r * 0.16)}" x2="0" y2="${f(-r)}"><stop offset="0" stop-color="${c}" stop-opacity="0"/><stop offset="1" stop-color="${c}" stop-opacity=".85"/></linearGradient></defs>`;
      out += `<g class="ly" style="--i:${i + 1}"><g class="${spin ? 'rot' : ''}" style="--dur:${70 + i * 26}s;--dirn:${i % 2 ? 'reverse' : 'normal'}">${g}</g></g>`;
    });
    svg.innerHTML = out;
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
    Object.assign(state, { broken: 0, taps: 0, next: 0, queue: [], lastShow: 0, side: 0, done: false, hex: data.color.hex, sub: data.color.sub });
    root.style.setProperty('--heart', data.color.hex);
    root.style.setProperty('--heart2', data.color.sub);
    setMelt(0);
    body.classList.remove('thawing', 'thawed');
    laneL.textContent = ''; laneR.textContent = '';
    $('#emblem').classList.remove('on'); $('#emblem').textContent = '';
    $('#pNpc').textContent = data.npc; $('#pPc').textContent = data.pc;
    $('#barPair').textContent = `${data.npc} → ${data.pc}`;
    $('#hudHint').classList.remove('off');
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
  }

  function paintHud() {
    const left = state.blocks.length - state.broken;
    $('#hudCount').textContent = `ICE ${String(left).padStart(2, '0')} / ${String(state.blocks.length).padStart(2, '0')}`;
  }

  function hit(b, cxp, cyp, rect, viaKey) {
    if (b.hp <= 0 || state.done) return;
    Sfx.init();
    b.hp--; state.taps++;
    if (state.taps === 4) $('#hudHint').classList.add('off');
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
    const d = state.data, r = ice.getBoundingClientRect(), mx = r.left + r.width / 2, my = r.top + r.height / 2;
    const fl = $('#flash');
    if (!reduce) { fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go'); }
    for (let i = 0; i < (reduce ? 6 : 46); i++) {
      const a = rnd(0, 6.283), v = rnd(60, 520);
      spark(mx, my, Math.cos(a) * v, Math.sin(a) * v, rnd(5, 16), rnd(0.8, 2), [d.color.hex, d.color.sub, '#fff'][i % 3]);
    }
    kick();
    [...laneL.children, ...laneR.children].forEach(dismiss);
    $('#mName').textContent = d.form.name;
    $('#mDesc').textContent = d.form.desc;
    $('#mFinal').textContent = d.final;
    emblem($('#emblem'), d, 'e1');
    later(() => {
      body.classList.add('thawing');
      $('#emblem').classList.add('on');
      Sfx.bloom();
    }, reduce ? 50 : 650);
    later(() => {
      body.classList.add('thawed');
      $('#toResult').focus({ preventScroll: true });
      state.heartRect = ice.getBoundingClientRect();
    }, reduce ? 100 : 1900);
  }

  function showResult() {
    const d = state.data;
    ambient = false;
    $('#rNpc').textContent = d.npc; $('#rPc').textContent = d.pc;
    const now = new Date();
    $('#rDate').textContent = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
    $('#rTemp').textContent = d.temp.value; $('#rUnit').textContent = d.temp.unit; $('#rTempNote').textContent = d.temp.note;
    $('#rColorName').textContent = d.color.name; $('#rColorHex').textContent = d.color.hex; $('#rColorMean').textContent = d.color.meaning;
    $('#rFormName').textContent = d.form.name; $('#rFormDesc').textContent = d.form.desc;
    $('#rMoment').textContent = d.moment; $('#rEssence').textContent = d.essence; $('#rTruth').textContent = d.truth;
    for (const id of ['rMoment', 'rEssence', 'rTruth']) $('#' + id).closest('.item').hidden = !$('#' + id).textContent;
    const log = $('#rLog');
    log.textContent = '';
    d.balloons.forEach(b => {
      const li = document.createElement('li');
      if (b.tag) { const t = document.createElement('b'); t.textContent = b.tag; li.appendChild(t); }
      li.appendChild(document.createTextNode(b.text));
      log.appendChild(li);
    });
    $('#rLogN').textContent = `(${d.balloons.length})`;
    emblem($('#emblemR'), d, 'e2');
    const code = seeded(d.npc + d.pc + d.form.name);
    $('#rNo').textContent = 'No. IM-' + String(code() * 9000 + 1000 | 0);
    $('#ringText').textContent = `For ${d.pc} only · Ice Melt Report · ${d.form.name} · ${d.color.name} · `.repeat(2);
    setMelt(1);
    show('result');
  }

  function resultText() {
    const d = state.data;
    return [
      `ICE MELT — ${d.npc} → ${d.pc}`,
      `01 사랑의 온도: ${d.temp.value}${d.temp.unit}${d.temp.note ? ' — ' + d.temp.note : ''}`,
      `02 하트 컬러: ${d.color.name} (${d.color.hex})${d.color.meaning ? ' — ' + d.color.meaning : ''}`,
      `03 애정의 형상: ${d.form.name}${d.form.desc ? ' — ' + d.form.desc : ''}`,
      d.moment && `04 결정적인 순간: ${d.moment}`,
      d.essence && `05 사랑의 본질: ${d.essence}`,
      d.truth && `06 가장 솔직한 속마음: ${d.truth}`
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
    clearTimers(); ambient = false; state.done = true;
    body.classList.remove('thawing', 'thawed');
    setMelt(0);
    show('intro');
  }

  /* ───────── OOC steps ───────── */
  const STEPS = [
    { title: '해동 기록', desc: '얼음이 깨질 때마다 새어 나올 속마음과 마지막 본심을 받습니다.', ph: '대상: … / …\n해동 1 [감정: …] (속마음: …)\n본심: …' },
    { title: '사랑의 온도', desc: '같은 채팅에 이어서 보냅니다. 온도, 하트 컬러, 애정의 형상, 결과지 내용을 받습니다.', ph: '온도: 00.0 °C · …\n색: #RRGGBB · … · …\n형상: … · …' }
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
      store.set('icemelt:a' + i, text);
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
      for (let j = i; j < (act === 'clear' ? answers.length : i + 1); j++) { answers[j] = null; store.set('icemelt:a' + j, ''); $('textarea', stepEl(j)).value = ''; fail(j, ''); }
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
  function begin(d) { store.set('icemelt:last', JSON.stringify(d)); lastBtn.hidden = false; Sfx.init(); startPlay(d); }

  [0, 1].forEach(i => { const t = store.get('icemelt:a' + i); if (t && (i === 0 || answers[0])) accept(i, t, true); });
  paintSteps();
  let lastData = null;
  try { lastData = normalize(JSON.parse(store.get('icemelt:last'))); } catch { /* nothing saved */ }
  lastBtn.hidden = !lastData;

  /* ───────── wiring ───────── */
  startBtn.addEventListener('click', () => { try { begin(build()); } catch (e) { toast(e.message); } });
  $('#sampleBtn').addEventListener('click', () => { Sfx.init(); startPlay(normalize({ ...parse1(window.ICE.SAMPLE[0]), ...parse2(window.ICE.SAMPLE[1]) })); });
  lastBtn.addEventListener('click', () => {
    let d = null;
    try { d = normalize(JSON.parse(store.get('icemelt:last'))); } catch { /* fall through */ }
    if (d) { Sfx.init(); startPlay(d); } else toast('저장된 해동 기록이 없어요.');
  });
  $('#toResult').addEventListener('click', () => { Sfx.ui(); showResult(); });
  $('#againBtn').addEventListener('click', () => startPlay(state.data));
  $('#newBtn').addEventListener('click', goHome);
  $('#homeBtn').addEventListener('click', goHome);
  $('#copyResult').addEventListener('click', () => copy(resultText(), '결과를 복사했어요.'));
  addEventListener('resize', () => { if (body.dataset.screen === 'play') state.heartRect = (state.done ? ice : $('#ice .heart')).getBoundingClientRect(); });
})();
