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
    if (!reduce) for (let i = 0; i < 5; i++) spark(rect.left + Math.random() * rect.width, rect.top + Math.random() * rect.height, rnd(-50, 50), rnd(-120, -30), rnd(5, 11), rnd(0.5, 1), '#fff');
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
        cx.fillStyle = '#e4efff'; cx.fill();
        cx.lineWidth = 1; cx.strokeStyle = '#fff'; cx.stroke();
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
    let html = '';
    for (let i = 0; i < 18; i++) {
      const s = 8 + r() * 22;
      html += `<svg class="${i % 4 === 0 ? 'y' : ''}" viewBox="0 0 24 24" style="left:${r() * 100}%;top:${r() * 100}%;width:${s}px;--d:${3 + r() * 5}s;--dl:${-r() * 6}s"><path d="M12 0c.8 6.400 5.600 11.200 12 12-6.400.800-11.200 5.600-12 12-.800-6.400-5.600-11.200-12-12 6.400-.800 11.200-5.600 12-12Z"/></svg>`;
    }
    html += '<i class="orbit" style="width:46vmax;height:46vmax;left:-14vmax;bottom:-18vmax"></i><i class="orbit" style="width:30vmax;height:30vmax;right:-8vmax;top:-10vmax"></i>';
    host.innerHTML = html;
  })();

  /* ───────── data ───────── */
  const str = (v, max = 600) => (typeof v === 'string' || typeof v === 'number') ? String(v).trim().slice(0, max) : '';
  const hexOk = (v, fb) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(str(v)) ? str(v) : fb;
  const SHAPES = ['orb', 'heart', 'gem', 'ring', 'wave', 'thread', 'petal', 'drop', 'ray', 'dot', 'star', 'shard'];

  function parse(text) {
    let t = text.replace(/```(?:json)?/gi, '').replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('데이터를 찾지 못했어요. AI가 출력한 { … } 코드 블록을 통째로 붙여 넣어 주세요.');
    t = t.slice(a, b + 1);
    try { return JSON.parse(t); } catch {
      try { return JSON.parse(t.replace(/,\s*([}\]])/g, '$1')); } catch {
        throw new Error('형식이 조금 어긋나 읽을 수 없어요. 채팅에서 다시 생성한 뒤 코드 블록 전체를 복사해 주세요.');
      }
    }
  }
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

  /* ───────── emblem ───────── */
  function emblem(svg, data, uid) {
    const { hex, sub } = data.color, rng = seeded(data.form.name + data.npc);
    let layers = data.form.layers;
    if (layers.length < 2) {
      const pool = ['petal', 'wave', 'thread', 'drop', 'shard', 'star', 'dot', 'ray'];
      layers = [{ shape: 'orb' }];
      for (let i = 0; i < 4; i++) layers.push({ shape: pool[rng() * pool.length | 0], count: 5 + (rng() * 8 | 0) });
      layers = layers.map(l => ({ count: 0, r: null, size: 0, ...l }));
    }
    const cols = [hex, sub, '#ffffff'], n = layers.length, f = v => v.toFixed(2);
    const polar = (fn, steps, turns = 1) => {
      let d = '';
      for (let i = 0; i <= steps; i++) { const a = i / steps * Math.PI * 2 * turns, r = fn(a); d += (i ? 'L' : 'M') + f(Math.cos(a) * r) + ' ' + f(Math.sin(a) * r); }
      return d + 'Z';
    };
    const around = (cnt, fn) => { let s = ''; for (let i = 0; i < cnt; i++) s += `<g transform="rotate(${f(i * 360 / cnt)})">${fn(i)}</g>`; return s; };
    let out = `<defs><radialGradient id="${uid}g"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="${hex}"/><stop offset="1" stop-color="${hex}" stop-opacity="0"/></radialGradient></defs>`;
    out += `<circle r="96" fill="url(#${uid}g)" opacity=".28"/>`;
    layers.forEach((l, i) => {
      const c = cols[i % 3], c2 = cols[(i + 1) % 3];
      const r = clamp(l.r === null ? (n === 1 ? 50 : 16 + i * 66 / (n - 1)) : l.r, 0, 92);
      const cnt = k => clamp(Math.round(l.count) || k, 1, 36);
      const st = `fill="none" stroke="${c}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"`;
      let g = '', spin = true;
      switch (l.shape) {
        case 'orb': { const s = l.size || 20; spin = false;
          g = `<circle r="${s * 1.7}" fill="url(#${uid}g)"/><circle r="${s * .42}" fill="#fff"/>`; break; }
        case 'heart': { const s = (l.size || 18) / 50; spin = false;
          g = `<path transform="scale(${f(s)}) translate(-50 -46)" d="M50 90C22 68 4 51 4 30 4 15 15 4 29 4c9 0 17 5 21 13C54 9 62 4 71 4c14 0 25 11 25 26 0 21-18 38-46 60Z" fill="${c}" fill-opacity=".85" stroke="#fff" stroke-width="2.5"/>`; break; }
        case 'gem': { const k = clamp(cnt(6), 3, 12), s = l.size || 24;
          const poly = q => polar(() => q, k);
          g = `<path d="${poly(s)}" fill="${c}" fill-opacity=".35" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/><path d="${poly(s * .5)}" fill="#fff" fill-opacity=".35" stroke="#fff" stroke-width="1"/>`
            + around(k, () => `<path d="M${f(s * .5)} 0L${f(s)} 0" stroke="#fff" stroke-width="1"/>`); break; }
        case 'ring': g = `<circle r="${f(r)}" ${st}${l.count ? ` stroke-dasharray="${f(Math.PI * r / l.count)}"` : ''}/>`; break;
        case 'wave': { const k = cnt(8), a = l.size || 5; g = `<path d="${polar(t => r + a * Math.sin(k * t), 180)}" ${st}/>`; break; }
        case 'thread': { const k = cnt(5); g = `<path d="${polar(t => r * (.58 + .42 * Math.cos((k + .5) * t)), 360, 2)}" ${st} stroke-width="1"/>`; break; }
        case 'petal': { const k = cnt(6), a = r * .22, w = l.size || Math.max(5, r * 2.2 / k);
          g = around(k, () => `<path d="M0 ${f(-a)}C${f(w)} ${f(-a - (r - a) * .35)} ${f(w)} ${f(-r + (r - a) * .15)} 0 ${f(-r)}C${f(-w)} ${f(-r + (r - a) * .15)} ${f(-w)} ${f(-a - (r - a) * .35)} 0 ${f(-a)}Z" fill="${c}" fill-opacity=".3" stroke="${c}" stroke-width="1.3" stroke-linejoin="round"/>`); break; }
        case 'drop': { const k = cnt(6), s = l.size || 6;
          g = around(k, () => `<path d="M0 ${f(-r - s * 1.7)}C${f(s)} ${f(-r - s * .2)} ${f(s)} ${f(-r + s)} 0 ${f(-r + s)}C${f(-s)} ${f(-r + s)} ${f(-s)} ${f(-r - s * .2)} 0 ${f(-r - s * 1.7)}Z" fill="${c}" fill-opacity=".45" stroke="${c}" stroke-width="1.2"/>`); break; }
        case 'ray': { const k = cnt(12), s = l.size || 10;
          g = around(k, j => `<path d="M0 ${f(-r)}L0 ${f(-r - (j % 2 ? s * .55 : s))}" ${st}/>`); break; }
        case 'dot': { const k = cnt(10), s = l.size || 2.2; g = around(k, j => `<circle cy="${f(-r)}" r="${f(j % 2 ? s * .6 : s)}" fill="${j % 2 ? c2 : c}"/>`); break; }
        case 'star': { const k = cnt(5), s = l.size || 6;
          g = around(k, () => `<path transform="translate(0 ${f(-r)})" d="M0 ${-s}Q0 0 ${s} 0Q0 0 0 ${s}Q0 0 ${-s} 0Q0 0 0 ${-s}Z" fill="${c}"/>`); break; }
        case 'shard': { const k = cnt(6), s = l.size || 12;
          g = around(k, () => `<path d="M0 ${f(-r - s)}L${f(s * .28)} ${f(-r)}L0 ${f(-r + s * .7)}L${f(-s * .28)} ${f(-r)}Z" fill="${c}" fill-opacity=".4" stroke="#fff" stroke-width="1"/>`); break; }
      }
      out += `<g class="ly" style="--i:${i}"><g class="${spin ? 'rot' : ''}" style="--dur:${50 + i * 22}s;--dirn:${i % 2 ? 'reverse' : 'normal'}">${g}</g></g>`;
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
    const lane = single ? laneL : (state.side++ % 2 ? laneR : laneL);
    const el = document.createElement('div');
    el.className = 'bubble';
    if (b.tag) { const t = document.createElement('b'); t.textContent = b.tag; el.appendChild(t); }
    el.appendChild(document.createTextNode(b.text));
    const live = [...lane.children].filter(c => !c.classList.contains('out'));
    const keep = single ? 0 : 1;
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

  /* ───────── wiring ───────── */
  const dataIn = $('#dataIn'), err = $('#err');
  const saved = store.get('icemelt:data');
  if (saved) dataIn.value = saved;

  $('#copyPrompt').addEventListener('click', () => copy(window.ICE_PROMPT, '프롬프트를 복사했어요. 채팅방에 붙여 넣어 주세요.'));
  $('#startBtn').addEventListener('click', () => {
    err.textContent = '';
    if (!dataIn.value.trim()) { err.textContent = '먼저 AI가 출력한 해동 데이터를 붙여 넣어 주세요. 구경만 하려면 샘플로 체험할 수 있어요.'; dataIn.focus(); return; }
    try {
      const d = normalize(parse(dataIn.value));
      store.set('icemelt:data', dataIn.value);
      Sfx.init();
      startPlay(d);
    } catch (e) { err.textContent = e.message; dataIn.focus(); }
  });
  $('#sampleBtn').addEventListener('click', () => { err.textContent = ''; Sfx.init(); startPlay(normalize(window.ICE_SAMPLE)); });
  $('#toResult').addEventListener('click', () => { Sfx.ui(); showResult(); });
  $('#againBtn').addEventListener('click', () => startPlay(state.data));
  $('#newBtn').addEventListener('click', goHome);
  $('#homeBtn').addEventListener('click', goHome);
  $('#copyResult').addEventListener('click', () => copy(resultText(), '결과를 복사했어요.'));
  addEventListener('resize', () => { if (body.dataset.screen === 'play') state.heartRect = (state.done ? ice : $('#ice .heart')).getBoundingClientRect(); });

  // intro preview: a half-thawed block of ice
  (function preview() {
    const host = $('#previewIce'), wrap = document.createElement('div');
    wrap.className = 'blocks';
    host.appendChild(wrap);
    const [c, r] = narrow.matches ? [3, 4] : [4, 3];
    buildIce(wrap, c, r, false).forEach((b, i) => {
      if (i % 5 === 1) return b.el.remove();
      if (i % 3 === 0) { addCrack(b, rnd(20, 80), rnd(20, 80)); b.el.style.setProperty('--dmg', '.4'); }
    });
  })();
})();
