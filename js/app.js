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
      this.startMusic();
    },
    ok() { return !this.muted && this.ctx; },
    music: null,
    startMusic() {
      if (!this.ok() || this.music) return;
      const c = this.ctx, bus = c.createGain(), lp = c.createBiquadFilter(), dl = c.createDelay(1), fb = c.createGain(), wet = c.createGain();
      lp.type = 'lowpass'; lp.frequency.value = 1500;
      dl.delayTime.value = 0.42; fb.gain.value = 0.42; wet.gain.value = 0.35;
      bus.gain.setValueAtTime(0.0001, c.currentTime); bus.gain.exponentialRampToValueAtTime(1, c.currentTime + 0.8);
      bus.connect(lp); lp.connect(this.out); lp.connect(dl); dl.connect(fb).connect(dl); dl.connect(wet).connect(this.out);
      const CH = [[130.81, 196, 246.94, 293.66, 329.63], [110, 164.81, 196, 246.94, 261.63], [87.31, 130.81, 164.81, 220, 246.94], [82.41, 123.47, 146.83, 196, 220]];
      const BELL = [659.25, 783.99, 880, 987.77, 1174.66, 1318.51];
      const m = this.music = { bus, step: 0, timers: [] };
      const pad = (t, f, dur, v) => {
        for (const det of [-4, 4]) {
          const o = c.createOscillator(), g = c.createGain();
          o.type = 'triangle'; o.frequency.value = f; o.detune.value = det;
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + (m.step > 1 ? 3 : 0.6)); g.gain.setValueAtTime(v, t + dur - 3.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          o.connect(g).connect(bus); o.start(t); o.stop(t + dur + 0.1);
        }
      };
      const chord = () => {
        if (this.music !== m) return;
        const t = c.currentTime + 0.05;
        CH[m.step++ % CH.length].forEach((f, i) => pad(t, f, 11, i ? 0.0028 : 0.0038));
        m.timers.push(setTimeout(chord, 9000));
      };
      const bell = () => {
        if (this.music !== m) return;
        const t = c.currentTime + 0.02, f = BELL[Math.random() * BELL.length | 0];
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.0035, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
        o.connect(g).connect(bus); o.start(t); o.stop(t + 3.3);
        m.timers.push(setTimeout(bell, 2400 + Math.random() * 3600));
      };
      chord(); m.timers.push(setTimeout(bell, 400));
    },
    stopMusic() {
      const m = this.music;
      if (!m) return;
      this.music = null;
      m.timers.forEach(clearTimeout);
      const t = this.ctx.currentTime;
      m.bus.gain.cancelScheduledValues(t); m.bus.gain.setValueAtTime(Math.max(0.0001, m.bus.gain.value), t); m.bus.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      setTimeout(() => m.bus.disconnect(), 1400);
    },
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
  document.addEventListener('visibilitychange', () => { if (!Sfx.ctx) return; if (document.hidden) Sfx.ctx.suspend(); else if (!Sfx.muted) Sfx.ctx.resume(); });
  ['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, () => { if (!Sfx.muted) { Sfx.init(); Sfx.startMusic(); } }, { once: true, passive: true }));
    if (Sfx.muted) Sfx.stopMusic(); else { Sfx.init(); Sfx.startMusic(); Sfx.ui(); }
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
    if (document.body.classList.contains('paused')) { last = now; raf = requestAnimationFrame(loop); return; }
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

  /* ───────── liquid gradient background (WebGL, falls back to the CSS layers) ───────── */
  (function liquid() {
    const cv = document.getElementById('bgfx');
    if (!cv) return;
    const gl = cv.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) return;
    const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const FS = `precision mediump float;
uniform vec2 r;uniform float t;
#define NB 6.
float h(float n){return fract(sin(n*127.1)*43758.5453);}
vec3 bloom(vec3 col,vec2 p,float asp,float id,float per,vec3 tint,float k){
  float q=t/per+(id-1.)/NB;
  float cyc=floor(q),f=fract(q);
  vec2 c=vec2((.08+.84*h(cyc*3.1+id))*asp,.08+.84*h(cyc*5.7+id*2.3));
  float e=1.-pow(1.-f,2.2);
  float rad=mix(.05,.35,e)*max(1.,asp*.5);
  float a=smoothstep(0.,.12,f)*(1.-smoothstep(.35,1.,f));
  float d=length(p-c);
  return mix(col,tint,exp(-d*d/(rad*rad))*a*k);
}
void main(){
  vec2 uv=gl_FragCoord.xy/r;
  float asp=r.x/r.y;
  vec2 p=vec2(uv.x*asp,uv.y);
  vec3 col=vec3(.985,.99,1.);
  col=bloom(col,p,asp,1.,18.,vec3(.66,.78,1.),.63);
  col=bloom(col,p,asp,2.,18.,vec3(.76,.88,1.),.63);
  col=bloom(col,p,asp,3.,18.,vec3(.62,.74,1.),.63);
  col=bloom(col,p,asp,4.,18.,vec3(.72,.84,1.),.63);
  col=bloom(col,p,asp,5.,18.,vec3(.72,.90,1.),.63);
  col=bloom(col,p,asp,6.,18.,vec3(.68,.80,1.),.63);
  gl_FragColor=vec4(col,1.);
}`;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return;
    const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uR = gl.getUniformLocation(pr, 'r'), uT = gl.getUniformLocation(pr, 't');
    const SCALE = innerWidth < 760 ? 0.22 : 0.3;
    // the on-screen keyboard shrinks the viewport: keep the tallest height seen so the canvas is not resized (and cleared) on every open/close
    let tallest = 0, lastW = 0;
    const size = () => {
      const vw = document.documentElement.clientWidth || innerWidth;
      if (vw !== lastW) { lastW = vw; tallest = 0; }
      tallest = Math.max(tallest, innerHeight, (window.visualViewport && visualViewport.height) || 0);
      const w = Math.max(1, Math.round(vw * SCALE)), h = Math.max(1, Math.round(tallest * SCALE));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); draw(performance.now()); }
    };
    const t0 = performance.now() - 40000 * Math.random();
    let lastDraw = 0;
    let ok = false;
    const draw = now => { lastDraw = now; gl.uniform2f(uR, cv.width, cv.height); gl.uniform1f(uT, (now - t0) / 1000); gl.drawArrays(gl.TRIANGLES, 0, 3); if (!ok && !gl.getError()) { ok = true; document.documentElement.classList.add('gl-bg'); } };
    const frame = now => { if (!document.hidden && !document.body.classList.contains('paused') && now - lastDraw > 33) draw(now); requestAnimationFrame(frame); };
    cv.addEventListener('webglcontextlost', e => { e.preventDefault(); document.documentElement.classList.remove('gl-bg'); ok = false; });
    size(); addEventListener('resize', size);
    requestAnimationFrame(frame);
  })();

  /* ───────── data ───────── */
  const str = (v, max = 600) => (typeof v === 'string' || typeof v === 'number') ? String(v).trim().slice(0, max) : '';
  const STYLES = [[/깃|고사리|솜/, 'feather'], [/곧|바늘|직선|선/, 'needle'], [/판|육각|면|유리/, 'plate'], [/가시|창|칼|날/, 'spike'], [/이슬|구슬|방울|물/, 'dew']];
  const STYLE_KO = { feather: '깃털', needle: '곧음', plate: '판', spike: '가시', dew: '이슬' };
  const WAY_KO = { feather: '섬세하게', needle: '한결같이', plate: '든든하게', spike: '서툴게', dew: '여리게' };
  const TYPES = { feather: ['깃털형 결정', 'Fernlike Dendrite'], needle: ['바늘형 결정', 'Needle Star'], plate: ['육각판형 결정', 'Sectored Plate'], spike: ['가시형 결정', 'Spiked Stellar'], dew: ['이슬형 결정', 'Rimed Stellar'] };
  const clean = t => String(t || '').replace(/```[a-z]*/gi, '').replace(/\r/g, '');
  const isPrompt = t => /\[OOC\s*\d\/\d|잠시 역할극 중단|\[출력\]/.test(t);
  const unwrap = s => s.replace(/^[\s"'“”‘’「」『』]+|[\s"'“”‘’「」『』]+$/g, '');
  const KEY = /^[-*•\s]*[\[【]?\s*(대상|얼음|해동|본심|결정|핵|가지|빛깔|얼린\s*이유|녹지\s*않는\s*이유|속마음)\s*(\d*)\s*[\]】]?\s*([.:：)]?)\s*(.*)$/;
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
      else if (k === '얼음') { const n = +(v.match(/[1-5]/) || [0])[0]; if (n) out.ice = { level: n, why: parts(v).slice(1).join(' · ') }; }
      else if (k === '해동') {
        const body = tail(v, '속마음') || unwrap(v.replace(/[\[(（]\s*감정[^\])）]*[\])）]/, ''));
        if (body) out.balloons.push({ tag: field(v, '감정'), when: field(v, '시점'), text: body });
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
    d => `${d.npc} → ${d.pc} · ${d.ice ? ICE_LV[d.ice.level - 1].name + ' · ' : ''}속마음 ${d.balloons.length}개`,
    d => `${d.crystal.name} · 가지 ${d.crystal.arms.length}개`
  ];

  function normalize(d) {
    if (!d || typeof d !== 'object') throw new Error('데이터 형식이 올바르지 않아요.');
    const balloons = (Array.isArray(d.balloons) ? d.balloons : []).map(b => ({ tag: str(b && b.tag, 16), when: str(b && b.when, 16), text: str(b && b.text, 300) })).filter(b => b.text).slice(0, 16);
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
      ice: { level: clamp(Math.round(+(d.ice && d.ice.level)) || 4, 1, 5), why: str(d.ice && d.ice.why, 300) },
      final: str(d.final, 300) || balloons[balloons.length - 1].text,
      crystal: { name: str(c.name, 60) || '이름 없는 결정', desc: str(c.desc, 400), core: str(c.core), arms,
        light: { name: str(light.name, 40), meaning: str(light.meaning, 300) }, frozen: str(c.frozen), lasting: str(c.lasting), truth: str(c.truth) }
    };
  }

  /* ───────── snowflake: twelve-fold faceted crystal, lit from the upper left ───────── */
  const PARTS = ['큰 축', '사이 축', '곁가지', '끝 장식', '중심 판', '사이 끝'];
  function snowflake(svg, data, uid) {
    const A = data.crystal.arms, f = v => (+v).toFixed(2), U = id => `${uid}${id}`;
    const LX = -0.55, LY = -0.83;
    const LO = [118, 146, 226], MID = [208, 222, 255], HI = [255, 255, 255];
    const tone = (nx, ny) => {
      const k = (nx * LX + ny * LY + 1) / 2;
      const c = k < 0.5 ? LO.map((v, i) => v + (MID[i] - v) * k * 2) : MID.map((v, i) => v + (HI[i] - v) * (k - 0.5) * 2);
      return `rgb(${c.map(Math.round).join(',')})`;
    };
    const poly = pts => 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z';
    let faces = '', ridges = '';
    const facet = (pts, nx, ny) => { faces += `<path d="${poly(pts)}" fill="${tone(nx, ny)}"/>`; };
    const ridge = (a, b, w = 0.45) => { ridges += `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`; };

    // a two-faced blade from (bx,by) toward angle ang (rad, 0 = up), half-width profile [[t,w]...]
    const blade = (bx, by, ang, L, prof) => {
      const dx = Math.sin(ang), dy = -Math.cos(ang), px = -dy, py = dx;
      const at = (t, w, s) => [bx + dx * L * t + px * w * s, by + dy * L * t + py * w * s];
      const tip = [bx + dx * L, by + dy * L];
      for (const s of [-1, 1]) facet([[bx, by], ...prof.map(([t, w]) => at(t, w, s)), tip], px * s, py * s);
      ridge([bx, by], tip);
      return tip;
    };
    // a flat hexagonal plate split into six lit sectors
    const plate = (cx, cy, r, rot = 0, ring = 0) => {
      const v = i => { const a = (i * 60 + rot) * Math.PI / 180; return [cx + Math.sin(a) * r, cy - Math.cos(a) * r]; };
      for (let i = 0; i < 6; i++) {
        const a = v(i), b = v(i + 1), mx = (a[0] + b[0]) / 2 - cx, my = (a[1] + b[1]) / 2 - cy, m = Math.hypot(mx, my) || 1;
        facet([[cx, cy], a, b], mx / m, my / m);
        ridge([cx, cy], a);
      }
      if (ring) { const w = i => { const a = (i * 60 + rot) * Math.PI / 180; return [cx + Math.sin(a) * r * ring, cy - Math.cos(a) * r * ring]; }; for (let i = 0; i < 6; i++) ridge(w(i), w(i + 1)); }
    };
    const PROF = {
      needle: [[0.08, 1.5], [0.82, 1.9]],
      feather: [[0.06, 2.4], [0.5, 3.3]],
      plate: [[0.05, 2.6], [0.48, 6.4], [0.78, 4.6]],
      spike: [[0.05, 3.6], [0.2, 4.2]],
      dew: [[0.06, 2], [0.7, 2.8], [0.9, 1.6]]
    };
    const scaled = (st, k) => PROF[st].map(([t, w]) => [t, w * k]);
    const ornament = (st, x, y, ang, z) => {
      const dx = Math.sin(ang), dy = -Math.cos(ang);
      if (st === 'plate') return plate(x + dx * z * 0.75, y + dy * z * 0.75, z, ang * 180 / Math.PI + 30, 0.45);
      if (st === 'spike') return blade(x - dx * z * 0.6, y - dy * z * 0.6, ang, z * 2.6, [[0.05, z * 0.35], [0.32, z * 0.95]]);
      if (st === 'feather') { blade(x, y, ang - Math.PI / 3, z * 1.5, [[0.1, z * 0.22], [0.5, z * 0.3]]); return blade(x, y, ang + Math.PI / 3, z * 1.5, [[0.1, z * 0.22], [0.5, z * 0.3]]); }
      if (st === 'dew') { faces += `<circle cx="${f(x + dx * z * 0.7)}" cy="${f(y + dy * z * 0.7)}" r="${f(z * 0.72)}" fill="url(#${U('bead')})"/>`; return; }
      return blade(x - dx * z * 0.3, y - dy * z * 0.3, ang, z * 1.8, [[0.4, z * 0.42]]);
    };

    // the first way of loving decides the whole architecture of the crystal; the other five tune it
    const TYPE = A[0].style, n1 = A[1].len / 10, n2 = A[2].len / 10, n3 = A[3].len / 10, n4 = A[4].len / 10, n5 = A[5].len / 10;
    const bead = (x, y, r) => { faces += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="url(#${U('bead')})"/>`; };
    const pt = (ang, r) => [Math.sin(ang) * r, -Math.cos(ang) * r];
    let core = 8;
    for (let i = 0; i < 6; i++) {
      const ang = i * Math.PI / 3, ang2 = ang + Math.PI / 6;
      if (TYPE === 'feather') {
        // classic stellar dendrite (the original design)
        const L0 = 62 + A[0].len * 2.4, L1 = L0 * (0.27 + A[1].len * 0.011);
        core = 10 + A[4].len * 0.8;
        const nB = 2 + Math.round(A[2].len / 4.5), bLen = L0 * (0.18 + A[2].len * 0.014);
        const z3 = 4 + A[3].len * 0.5, z5 = 2.6 + A[5].len * 0.3;
        const t2 = blade(Math.sin(ang2) * core * 0.8, -Math.cos(ang2) * core * 0.8, ang2, L1 - core * 0.8, scaled(A[1].style, 0.75));
        ornament(A[5].style, t2[0], t2[1], ang2, z5);
        for (let j = 0; j < nB; j++) {
          const t = 0.42 + j * (0.4 / Math.max(1, nB - 1)), r = L0 * t, len = bLen * (1 - j * 0.2);
          const bx = Math.sin(ang) * r, by = -Math.cos(ang) * r;
          for (const sg of [-1, 1]) blade(bx, by, ang + sg * Math.PI / 3, len, scaled(A[2].style, 0.62));
        }
        const tip = blade(Math.sin(ang) * core * 0.6, -Math.cos(ang) * core * 0.6, ang, L0 - core * 0.6, PROF.feather);
        ornament(A[3].style, tip[0], tip[1], ang, z3);
      } else if (TYPE === 'needle') {
        // needle star: twelve clean spears, no branches, a small bright hub
        core = 6 + n4 * 3;
        const L = 90, L2 = 52 + n1 * 26;
        blade(...pt(ang, core * 0.4), ang, L, [[0.1, 1.6], [0.7, 2.1], [0.94, 0.8]]);
        blade(...pt(ang2, core * 0.4), ang2, L2, [[0.1, 1.2], [0.7, 1.5], [0.94, 0.6]]);
        const ring = 30 + n3 * 18;
        bead(...pt(ang, ring), 1.6 + n5 * 1.2);
        bead(...pt(ang2, ring * 0.8), 1.1 + n5 * 0.8);
      } else if (TYPE === 'plate') {
        // stellar plate: six broad faceted plate-arms that widen into a flat hexagon near the tip
        core = 14 + n4 * 4;
        const L = 78 + n1 * 10, wide = 7 + n2 * 3;
        blade(...pt(ang, core * 0.7), ang, L - core * 0.7, [[0.05, wide * 0.55], [0.32, wide * 0.42], [0.55, wide], [0.78, wide * 0.9], [0.92, wide * 0.4]]);
        plate(...pt(ang, L * 0.62), wide * 0.85, ang * 180 / Math.PI, 0.5);
        plate(...pt(ang, L + 3 + n3 * 2), 3.5 + n3 * 3, ang * 180 / Math.PI + 30, 0.4);
        blade(...pt(ang2, core * 0.8), ang2, 12 + n5 * 10, [[0.1, 3.4], [0.55, 4.2]]);
      } else if (TYPE === 'spike') {
        // dagger star: six wide, sharp blades with swept-back barbs
        core = 9 + n4 * 4;
        const L = 80 + n1 * 10;
        blade(...pt(ang, core * 0.3), ang, L, [[0.05, 9], [0.22, 11], [0.6, 4]]);
        const barbs = 1 + Math.round(n2 * 2);
        for (let j = 0; j < barbs; j++) {
          const [bx, by] = pt(ang, L * (0.48 + j * 0.16));
          for (const sgn of [-1, 1]) blade(bx, by, ang + sgn * 0.62, 13 + n3 * 8 - j * 3, [[0.05, 2.6], [0.3, 3]]);
        }
        blade(...pt(ang2, core * 0.5), ang2, 30 + n5 * 18, [[0.05, 5], [0.25, 6]]);
      } else {
        // pearl star: slender arms, a few twigs that each end in a frost pearl, a large pearl at every tip
        core = 9 + n4 * 3;
        const L = 72 + n1 * 10;
        const tip = blade(...pt(ang, core * 0.5), ang, L - core * 0.5, [[0.06, 1.8], [0.7, 2.2], [0.95, 0.8]]);
        bead(tip[0], tip[1], 4.6 + n3 * 2.4);
        for (const [t, k] of [[0.5, 0.3], [0.74, 0.2]]) {
          const [bx, by] = pt(ang, L * t);
          for (const sg of [-1, 1]) { const e = blade(bx, by, ang + sg * Math.PI / 3, L * k * (0.8 + n2 * 0.4), [[0.1, 1.1], [0.8, 1.2]]); bead(e[0], e[1], 2 + n5 * 1.4); }
        }
        bead(...pt(ang, L * 0.32), 2.2);
        const t2 = blade(...pt(ang2, core * 0.6), ang2, 18 + n5 * 8, [[0.1, 1.2]]); bead(t2[0], t2[1], 2.6);
      }
    }
    plate(0, 0, core, 30, TYPE === 'plate' ? 0.55 : (TYPE === 'feather' && (A[4].style === 'plate' || A[4].style === 'needle')) ? 0.55 : 0);
    if (TYPE === 'dew') bead(0, 0, core * 0.42);
    if (TYPE === 'feather' && A[4].style === 'dew') bead(0, 0, core * 0.36);
    const k = Math.min(core, 13) * 0.9;
    const glint = `<path class="fglint" d="M0 ${f(-k)}Q${f(k * 0.1)} ${f(-k * 0.1)} ${f(k)} 0Q${f(k * 0.1)} ${f(k * 0.1)} 0 ${f(k)}Q${f(-k * 0.1)} ${f(k * 0.1)} ${f(-k)} 0Q${f(-k * 0.1)} ${f(-k * 0.1)} 0 ${f(-k)}Z" fill="#fff"/>`;

    const star = z => `<path d="M0 ${f(-z)}Q${f(z * 0.12)} ${f(-z * 0.12)} ${f(z)} 0Q${f(z * 0.12)} ${f(z * 0.12)} 0 ${f(z)}Q${f(-z * 0.12)} ${f(z * 0.12)} ${f(-z)} 0Q${f(-z * 0.12)} ${f(-z * 0.12)} 0 ${f(-z)}Z" fill="#fff"/>`;
    let burst = '<circle class="wave" r="10" fill="none"/><circle class="wave w2" r="10" fill="none"/>';
    for (let i = 0; i < 12; i++) burst += `<g transform="rotate(${i * 30 + 15})"><g class="sp" style="--d:${(i % 3) * 0.07}s;--far:${i % 2 ? 78 : 96}px">${star(i % 2 ? 3 : 5)}</g></g>`;
    for (let i = 0; i < 18; i++) burst += `<g transform="rotate(${i * 20 + 5})"><circle class="mote" r="${i % 3 ? 0.9 : 1.4}" style="--d:${0.1 + (i % 4) * 0.06}s;--far:${50 + (i * 37) % 44}px"/></g>`;
    svg.innerHTML = `<defs>
      <radialGradient id="${U('g')}"><stop offset="0" stop-color="#a9c4ff" stop-opacity=".55"/><stop offset=".55" stop-color="#a9c4ff" stop-opacity=".14"/><stop offset="1" stop-color="#a9c4ff" stop-opacity="0"/></radialGradient>
      <radialGradient id="${U('bead')}" cx="35%" cy="32%" r="70%"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#dbe6ff"/><stop offset="1" stop-color="#8aa5ea"/></radialGradient>
      <filter id="${U('blur')}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.2"/></filter>
    </defs>
    <g class="ly" style="--i:0"><circle r="96" fill="url(#${U('g')})"/></g>
    <g class="ly" style="--i:1"><g>
      <g id="${U('fl')}">${faces}<path d="${ridges}" fill="none" stroke="#fff" stroke-width=".5" stroke-linecap="round" opacity=".85"/></g>
    </g></g>
    <g class="ly" style="--i:2">${glint}</g>
    <g class="burst" aria-hidden="true">${burst}</g>`;
    const host = svg.querySelector(`#${U('fl')}`);
    const halo = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    halo.setAttribute('href', `#${U('fl')}`); halo.setAttribute('filter', `url(#${U('blur')})`); halo.setAttribute('opacity', '.6');
    host.parentNode.insertBefore(halo, host);
  }

  /* ───────── ice ───────── */
  const ICE_LV = [
    { name: '살얼음', d: [3, 2], m: [2, 3], kd: 0.25, km: 0.25, hp: [1, 2] },
    { name: '얇은 얼음', d: [4, 2], m: [2, 4], kd: 0.35, km: 0.35, hp: [2, 3] },
    { name: '단단한 얼음', d: [4, 3], m: [3, 4], kd: 0.5, km: 0.45, hp: [2, 4] },
    { name: '두꺼운 얼음', d: [6, 4], m: [4, 5], kd: 1, km: 0.55, hp: [2, 4] },
    { name: '만년설', d: [7, 5], m: [5, 6], kd: 0.9, km: 0.7, hp: [3, 5] }
  ];
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

  function buildIce(host, cols, rows, interactive, opt = {}) {
    host.textContent = '';
    return layout(cols, rows, opt.k !== undefined ? opt.k : (cols < 5 ? 0.55 : 1)).map(b => {
      const area = b.w * b.h;
      const el = document.createElement(interactive ? 'button' : 'div');
      el.className = 'blk';
      if (interactive) el.type = 'button';
      el.style.cssText = `left:${b.c / cols * 100}%;top:${b.r / rows * 100}%;width:${b.w / cols * 100}%;height:${b.h / rows * 100}%`;
      el.innerHTML = '<span class="f"><svg viewBox="0 0 100 100" preserveAspectRatio="none"></svg></span>';
      host.appendChild(el);
      const [lo, hi] = opt.hp || [2, 4], base = lo + (Math.random() * (hi - lo + 1) | 0);
      const hp = area === 1 ? base : area === 2 ? Math.round(hi * 1.25) : Math.round(hi * 2);
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
    const L = ICE_LV[data.ice.level - 1], [cols, rows] = narrow.matches ? L.m : L.d;
    state.blocks = buildIce(blocksEl, cols, rows, true, { k: narrow.matches ? L.km : L.kd, hp: L.hp });
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
    $('#hudCount').textContent = `${ICE_LV[state.data.ice.level - 1].name} · ICE ${String(left).padStart(2, '0')} / ${String(state.blocks.length).padStart(2, '0')}`;
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
    // the last piece holds until every inner voice has surfaced
    if (state.broken === state.blocks.length - 1 && (state.queue.length || state.timer)) {
      b.hp = 1;
      b.el.classList.remove('jolt'); void b.el.offsetWidth; b.el.classList.add('jolt');
      chips(cxp, cyp, 4); Sfx.tap(0.9);
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
    const single = true;
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

  const WHEN_FALLBACK = ['처음 며칠', '조금 익숙해질 무렵', '가까워지던 때', '마음이 깊어지던 무렵', '얼마 전'];
  const KEY_WHEN = ['첫 만남', '지금', '조금 익숙해질 무렵', '가까워지던 때', '마음이 깊어지던 무렵'];
  function whenLabel(b, i, n) {
    if (b.when) return b.when;
    if (i === 0) return '첫 만남';
    if (i === n - 1) return '지금';
    return WHEN_FALLBACK[Math.min(WHEN_FALLBACK.length - 1, Math.floor((i - 1) / Math.max(1, n - 2) * WHEN_FALLBACK.length))];
  }
  function fillList(host, items, make) { host.textContent = ''; items.forEach((it, i) => host.appendChild(make(it, i))); }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }

  function showResult() {
    const d = state.data, c = d.crystal;
    ambient = false;
    $('#rNpc').textContent = d.npc; $('#rPc').textContent = d.pc;
    const T = TYPES[c.arms[0].style];
    $('#rType').textContent = T[0]; $('#rTypeEn').textContent = T[1];
    $('#ringText').textContent = `For ${d.pc} only · Snow crystal certificate · ${c.name} · One of one · `.repeat(2);
    $('#rName').textContent = c.name; $('#rDesc').textContent = c.desc;
    $('#rLightName').textContent = c.light.name; $('#rLightMean').textContent = c.light.meaning; $('#factLight').hidden = !c.light.name;
    $('#rIceName').textContent = ICE_LV[d.ice.level - 1].name; $('#rIceWhy').textContent = d.ice.why;
    $('#rCore').textContent = c.core; $('#rFrozen').textContent = c.frozen; $('#rLasting').textContent = c.lasting; $('#rTruth').textContent = c.truth;
    for (const id of ['rCore', 'rTruth']) $('#' + id).closest('.item').hidden = !$('#' + id).textContent;
    $('#phases').hidden = !c.frozen && !c.lasting;
    setPhase('before');
    const named = c.arms.map((a, i) => ({ ...a, i })).filter(a => a.name);
    fillList($('#rArms'), named, a => {
      const li = el('li');
      const top = el('div', 'arm-top');
      top.append(el('b', 'arm-no', String(a.i + 1).padStart(2, '0')), el('span', 'arm-part', WAY_KO[a.style]));
      li.append(top, el('p', 'arm-name', a.name));
      if (a.desc) li.append(el('p', 'arm-desc', a.desc));
      const foot = el('div', 'arm-foot');
      foot.append(el('span', 'arm-style', '마음을 써 온 시간'));
      const meter = el('span', 'arm-len');
      meter.setAttribute('aria-label', `머문 시간 ${a.len} / 10`);
      for (let k = 1; k <= 10; k++) meter.append(el('i', k <= a.len ? 'on' : ''));
      foot.append(meter);
      li.append(foot);
      return li;
    });
    const dots = $('#carDots');
    dots.textContent = '';
    named.forEach(() => dots.append(el('i')));
    paintCar();
    $('#rArms').closest('.item').hidden = !named.length;
    const seenWhen = new Set();
    fillList($('#rLog'), d.balloons, (b, i) => {
      const li = el('li'), head = el('p', 'tl-head');
      const when = whenLabel(b, i, d.balloons.length), key = (i === 0 || i === d.balloons.length - 1 || KEY_WHEN.includes(when)) && !seenWhen.has(when);
      seenWhen.add(when);
      head.append(el('span', key ? 'tl-when key' : 'tl-when', when));
      if (b.tag) head.append(el('b', 'tl-tag', b.tag));
      li.append(head, el('p', 'tl-text', b.text));
      return li;
    });
    $('#rLogN').textContent = `(${d.balloons.length})`;
    snowflake($('#emblemR'), d, 'e2');
    snowflake($('#scEmblem'), d, 'e3');
    $('#scType').textContent = T[0]; $('#scTypeEn').textContent = T[1];
    $('#scNpc').textContent = d.npc; $('#scPc').textContent = d.pc; $('#scName').textContent = c.name;
    $('#scLight').textContent = c.light.name || '—';
    $('#scQuote').textContent = c.truth || d.final;
    setMelt(1);
    show('result');
    $('#rArms').scrollLeft = 0;
    requestAnimationFrame(paintCar);
  }

  function paintCar() {
    const list = $('#rArms'), items = [...list.children];
    if (!items.length) return;
    const x = list.scrollLeft, w = items[0].getBoundingClientRect().width + 14;
    const cur = Math.round(x / w), max = list.scrollWidth - list.clientWidth;
    [...$('#carDots').children].forEach((d, i) => d.classList.toggle('on', i === Math.min(cur, items.length - 1)));
    const [prev, next] = document.querySelectorAll('.car-btn');
    prev.disabled = x <= 2; next.disabled = x >= max - 2;
    $('.car-nav').hidden = max <= 2;
  }
  $('#rArms').addEventListener('scroll', () => requestAnimationFrame(paintCar), { passive: true });
  addEventListener('resize', () => { if (body.dataset.screen === 'result') paintCar(); });
  document.querySelectorAll('.car-btn').forEach(btn => btn.addEventListener('click', () => {
    const list = $('#rArms'), first = list.children[0];
    if (first) list.scrollBy({ left: (+btn.dataset.dir) * (first.getBoundingClientRect().width + 14), behavior: reduce ? 'auto' : 'smooth' });
  }));

  function setPhase(p) {
    const box = $('#phases'); box.dataset.phase = p;
    box.querySelectorAll('[role="tab"]').forEach(t => t.setAttribute('aria-selected', String(t.dataset.p === p)));
  }
  $('#phases').addEventListener('click', e => { const t = e.target.closest('[data-p]'); if (t) { setPhase(t.dataset.p); Sfx.ui(); } });
  $('#phases .ph-panels').addEventListener('click', () => setPhase($('#phases').dataset.phase === 'before' ? 'after' : 'before'));

  /* ───────── save the certificate as an image (same approach as love-dive) ───────── */
  async function fontEmbedCSS(node) {
    const used = new Set(); for (const ch of node.innerText) used.add(ch.codePointAt(0));
    const hits = range => {
      if (!range) return true;
      return range.split(',').some(part => {
        const p = part.trim().replace(/^U\+/i, ''); let lo, hi;
        if (p.includes('?')) { lo = parseInt(p.replace(/\?/g, '0'), 16); hi = parseInt(p.replace(/\?/g, 'F'), 16); }
        else if (p.includes('-')) { const [x, y] = p.split('-'); lo = parseInt(x, 16); hi = parseInt(y.replace(/^U\+/i, ''), 16); }
        else lo = hi = parseInt(p, 16);
        for (const cp of used) if (cp >= lo && cp <= hi) return true;
        return false;
      });
    };
    const rules = [];
    for (const sheet of document.styleSheets) { let list; try { list = sheet.cssRules; } catch { continue; } for (const r of list) if (r instanceof CSSFontFaceRule && hits(r.style.getPropertyValue('unicode-range'))) rules.push(r); }
    const css = await Promise.all(rules.map(async r => {
      const m = r.style.getPropertyValue('src').match(/url\(["']?([^"')]+)["']?\)/); if (!m) return '';
      try {
        const blob = await (await fetch(new URL(m[1], r.parentStyleSheet && r.parentStyleSheet.href || location.href).href)).blob();
        const data = await new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = no; fr.readAsDataURL(blob); });
        const st = r.style, range = st.getPropertyValue('unicode-range');
        return `@font-face{font-family:${st.getPropertyValue('font-family')};font-style:${st.getPropertyValue('font-style') || 'normal'};font-weight:${st.getPropertyValue('font-weight') || '400'};src:url(${data});${range ? `unicode-range:${range};` : ''}}`;
      } catch { return ''; }
    }));
    return css.join('\n');
  }
  async function saveSheetImage(node, filename) {
    if (!window.htmlToImage) throw new Error('no renderer');
    await (document.fonts && document.fonts.ready);
    const skip = p => /^(height|block-size|min-height|min-block-size|grid-template-rows)$|^(animation|transition)/.test(p);
    const props = Array.from(getComputedStyle(document.documentElement)).filter(p => !skip(p));
    node.classList.add('capturing');
    let card;
    try {
    card = await window.htmlToImage.toCanvas(node, {
      includeStyleProperties: props, pixelRatio: 2, fontEmbedCSS: await fontEmbedCSS(node), cacheBust: false,
      style: { boxShadow: 'none', margin: '0' },
      filter: el => !(el instanceof HTMLElement && (el.dataset.noCapture !== undefined || el.classList.contains('car-nav')))
    });
    } finally { node.classList.remove('capturing'); }
    const pad = Math.round(card.width * 0.1), W = card.width + pad * 2, H = Math.max(card.height + pad * 2, Math.round(W * 1.25));
    const out = document.createElement('canvas'); out.width = W; out.height = H;
    const g = out.getContext('2d'), grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#f4f7ff'); grad.addColorStop(1, '#d6e3ff');
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    g.save(); g.shadowColor = 'rgba(20, 36, 110, .28)'; g.shadowBlur = pad * 0.5; g.shadowOffsetY = pad * 0.15; g.drawImage(card, pad, Math.round((H - card.height) / 2)); g.restore();
    const blob = await new Promise(ok => out.toBlob(ok, 'image/jpeg', 0.92));
    if (!blob) throw new Error('render failed');
    // inside the claude.ai artifact viewer, files go through its downloads capability
    const dl = window.claude && window.claude.use ? await Promise.race([window.claude.use('downloads').catch(() => null), new Promise(ok => setTimeout(() => ok(null), 1500))]) : null;
    if (dl) {
      try { await dl.save({ filename, data: blob }); return 'downloaded'; }
      catch (e) { if (e && e.code === 'declined') return 'declined'; throw e; }
    }
    const file = new File([blob], filename, { type: 'image/jpeg' });
    if (matchMedia('(pointer: coarse)').matches && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'ICE MELT' }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'shared'; }
    }
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return 'downloaded';
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
    resetSteps();
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
        <div class="ta-acts" hidden><button class="btn primary" type="button" data-act="confirm">입력 완료</button><button class="link" type="button" data-act="cancel">닫기</button></div>
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
      if (done) { $('.got-text', el).textContent = SUMMARY[i](answers[i]); $('textarea', el).hidden = true; $('.ta-acts', el).hidden = true; $('.prompt', el).hidden = true; }
      el.querySelectorAll('.acts button, .minor button').forEach(b => { b.disabled = locked; });
    });
    startBtn.disabled = !(answers[0] && answers[1]);
    paintReset();
  }
  function paintReset() {
    const any = answers.some(Boolean) || [...stepsEl.querySelectorAll('textarea')].some(t => t.value.trim());
    $('#resetBtn').hidden = !any;
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
    ta.hidden = false; $('.ta-acts', stepEl(i)).hidden = false; ta.focus();
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
    else if (act === 'confirm') {
      const v = $('textarea', el).value;
      if (!v.trim()) { fail(i, '붙여 넣은 내용이 없어요. AI가 쓴 답을 넣은 뒤 눌러 주세요.'); $('textarea', el).focus(); return; }
      accept(i, v);
    } else if (act === 'cancel') { $('textarea', el).hidden = true; $('.ta-acts', el).hidden = true; fail(i, ''); }
    else if (act === 'peek') {
      const pre = $('.prompt', el), open = pre.hidden;
      pre.textContent = window.ICE.PROMPTS[i]; pre.hidden = !open;
      btn.setAttribute('aria-expanded', String(open)); btn.textContent = open ? 'OOC 내용 접기' : 'OOC 내용 보기';
    } else if (act === 'redo' || act === 'clear') {
      const keep = act === 'redo' ? (store.get('icemelt2:a' + i) || '') : '';
      for (let j = i; j < (act === 'clear' ? answers.length : i + 1); j++) { answers[j] = null; store.set('icemelt2:a' + j, ''); $('textarea', stepEl(j)).value = ''; fail(j, ''); }
      paintSteps();
      if (act === 'redo') { $('textarea', el).value = keep; openManual(i); paintReset(); }
    }
  });
  stepsEl.addEventListener('input', e => {
    if (e.target.tagName !== 'TEXTAREA') return;
    const i = +e.target.closest('.step').dataset.i;
    fail(i, '');
    paintReset();
  });

  function resetSteps() {
    answers.forEach((_, j) => {
      answers[j] = null; store.set('icemelt2:a' + j, '');
      const el = stepEl(j), ta = $('textarea', el), pre = $('.prompt', el), peek = $('[data-act="peek"]', el);
      ta.value = ''; ta.hidden = true; $('.ta-acts', el).hidden = true; pre.hidden = true; fail(j, '');
      if (peek) { peek.setAttribute('aria-expanded', 'false'); peek.textContent = 'OOC 내용 보기'; }
    });
    paintSteps();
  }
  const build = () => normalize({ ...answers[0], ...answers[1] });
  function begin(d) { store.set('icemelt2:last', JSON.stringify(d)); lastBtn.hidden = false; Sfx.init(); startPlay(d); }

  [0, 1].forEach(i => { const t = store.get('icemelt2:a' + i); if (t && (i === 0 || answers[0])) accept(i, t, true); });
  paintSteps();
  let lastData = null;
  try { lastData = normalize(JSON.parse(store.get('icemelt2:last'))); } catch { /* nothing saved */ }
  lastBtn.hidden = !lastData;

  /* ───────── wiring ───────── */
  startBtn.addEventListener('click', () => { try { begin(build()); } catch (e) { toast(e.message); } });
  $('#resetBtn').addEventListener('click', () => { resetSteps(); toast('입력한 내용을 모두 지웠어요.'); $('[data-act="copy"]', stepEl(0)).focus(); });
  $('#sampleBtn').addEventListener('click', () => { Sfx.init(); startPlay(normalize({ ...parse1(window.ICE.SAMPLE[0]), ...parse2(window.ICE.SAMPLE[1]) })); });
  lastBtn.addEventListener('click', () => {
    let d = null;
    try { d = normalize(JSON.parse(store.get('icemelt2:last'))); } catch { /* fall through */ }
    if (d) { Sfx.init(); startPlay(d); } else toast('저장된 해동 기록이 없어요.');
  });
  $('#toResult').addEventListener('click', () => { Sfx.ui(); showResult(); });
  $('#againBtn').addEventListener('click', () => startPlay(state.data));
  $('#newBtn').addEventListener('click', goHome);
  /* ───────── leave confirmation: dim, freeze everything, ask ───────── */
  const leave = $('#leave');
  let leaveFrom = null;
  function openLeave() {
    leaveFrom = document.activeElement;
    body.classList.add('paused');
    if (Sfx.ctx && Sfx.ctx.state === 'running') Sfx.ctx.suspend();
    leave.hidden = false;
    requestAnimationFrame(() => leave.classList.add('on'));
    $('#leaveStay').focus();
  }
  function closeLeave(go) {
    leave.classList.remove('on');
    leave.hidden = true;
    body.classList.remove('paused');
    if (go) goHome();
    else if (leaveFrom && leaveFrom.focus) leaveFrom.focus();
    if (Sfx.ctx && !Sfx.muted) Sfx.ctx.resume();
  }
  $('#homeBtn').addEventListener('click', () => {
    if (body.dataset.screen === 'play' || body.dataset.screen === 'result') openLeave(); else goHome();
  });
  $('#leaveStay').addEventListener('click', () => closeLeave(false));
  $('#leaveGo').addEventListener('click', () => closeLeave(true));
  leave.addEventListener('click', e => { if (e.target === leave) closeLeave(false); });
  addEventListener('keydown', e => {
    if (leave.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); closeLeave(false); }
    else if (e.key === 'Tab') { const a = $('#leaveStay'), b = $('#leaveGo'); if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); } else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); } }
  });
  $('#saveImg').addEventListener('click', async e => {
    const btn = e.currentTarget, label = btn.textContent;
    btn.disabled = true; btn.textContent = '만드는 중…';
    try {
      const how = await saveSheetImage($('#shareCard'), 'ice-melt-certificate.jpg');
      if (how !== 'declined') toast(how === 'shared' ? '이미지를 공유 창으로 보냈어요.' : '이미지를 저장했어요.');
    } catch (err) {
      toast('이미지를 만들지 못했어요. 잠시 후 다시 눌러 주세요.');
    } finally { btn.disabled = false; btn.textContent = label; }
  });
  addEventListener('resize', () => { if (body.dataset.screen === 'play') state.heartRect = (state.done ? ice : $('#ice .heart')).getBoundingClientRect(); });
})();
