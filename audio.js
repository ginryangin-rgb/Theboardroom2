/* Sound. No audio files: the stadium is synthesised in the browser with the Web Audio API.
   A crowd bed (layers of filtered noise) that swells and falls with the play, a roar for a goal and a groan for one against, referee
   whistles, a gavel for the boardroom, and a commentator who calls the goals through the browser's speech voice (with a synthesised
   shout as a fallback if the device has no voice). Everything is optional, remembered, and starts only after your first click. */

const baseAudioPause = pauseSettings;
const AU = { ctx: null, master: null, bus: null, layers: null, analyser: null, base: .1, voice: null, built: false, yellBuf: null };

function soundPrefs() { let p = prefs(); if (p.sound) return p.sound; let gp = typeof globalPrefs === 'function' ? globalPrefs() : {}; return p.sound = { on: gp.sound !== false, vol: gp.vol != null ? gp.vol : .7, crowd: gp.crowd !== false } }
function soundOn() { return soundPrefs().on }
function audioReady() { return !!(AU.ctx && AU.ctx.state === 'running' && soundPrefs().on) }

/* ---------- building the graph ---------- */
function noiseBuf(c, type) {
  let n = c.sampleRate * 4, b = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    let d = b.getChannelData(ch), b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < n; i++) {
      let w = Math.random() * 2 - 1;
      if (type === 'pink') { b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852; b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * .11; b6 = w * .115926 }
      else if (type === 'brown') { last = (last + .02 * w) / 1.02; d[i] = last * 3.5 }
      else d[i] = w * .5;
    }
  }
  return b;
}
function loopNoise(buf, filters, gain, dest) {
  let c = AU.ctx, s = c.createBufferSource(); s.buffer = buf; s.loop = true; let node = s, chain = [];
  for (let [type, f, q] of filters) { let fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; if (q) fl.Q.value = q; node.connect(fl); node = fl; chain.push(fl) }
  let gn = c.createGain(); gn.gain.value = gain; node.connect(gn); gn.connect(dest); s.start(0, Math.random() * 3); return { src: s, gain: gn, filters: chain };
}
function buildAudio() {
  if (AU.built) return true; let Ctor = typeof AudioContext !== 'undefined' ? AudioContext : typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null; if (!Ctor) return false;
  try {
    let c = AU.ctx = new Ctor(), comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = .01; comp.release.value = .25;
    AU.master = c.createGain(); AU.master.gain.value = .9 * soundPrefs().vol; AU.analyser = c.createAnalyser(); AU.analyser.fftSize = 1024;
    AU.master.connect(comp); comp.connect(AU.analyser); AU.analyser.connect(c.destination);
    let pink = noiseBuf(c, 'pink'), brown = noiseBuf(c, 'brown'); AU.pink = pink; AU.brown = brown;
    AU.bus = c.createGain(); AU.bus.gain.value = 0; AU.bus.connect(AU.master);
    AU.layers = { murmur: loopNoise(pink, [['bandpass', 650, .5], ['lowpass', 2600]], .9, AU.bus), voices: loopNoise(pink, [['bandpass', 1250, 1.1]], .5, AU.bus), rumble: loopNoise(brown, [['lowpass', 240]], .8, AU.bus), hiss: loopNoise(pink, [['highpass', 3500]], .07, AU.bus) };
    let lfo = c.createOscillator(); lfo.frequency.value = .17; let lg = c.createGain(); lg.gain.value = .22; lfo.connect(lg); lg.connect(AU.layers.voices.gain.gain); lfo.start();
    AU.built = true; return true;
  } catch (e) { AU.ctx = null; return false }
}
function audioUnlock() { if (!soundPrefs().on) return; if (!AU.built) buildAudio(); if (AU.ctx && AU.ctx.state !== 'running') AU.ctx.resume().catch(() => { }) }

/* ---------- the crowd ---------- */
function crowdOn(level) {
  if (!audioReady() || !soundPrefs().crowd || !AU.bus) return; let t = AU.ctx.currentTime;
  AU.base = .04 + level * .62; AU.bus.gain.setTargetAtTime(AU.base, t, .9);
  AU.layers.voices.filters[0].frequency.setTargetAtTime(900 + level * 1200, t, .8); AU.layers.hiss.gain.gain.setTargetAtTime(.04 + level * .12, t, .8);
}
function crowdOff() { if (!AU.bus || !AU.ctx) return; AU.base = 0; AU.bus.gain.setTargetAtTime(0, AU.ctx.currentTime, .6) }
function swell(amount, secs) { if (!audioReady() || !AU.bus || !soundPrefs().crowd) return; let t = AU.ctx.currentTime, g = AU.bus.gain; g.cancelScheduledValues(t); g.setTargetAtTime(AU.base + amount, t, .09); g.setTargetAtTime(AU.base, t + secs * .35, secs * .3) }
function dip(secs) { if (!audioReady() || !AU.bus) return; let t = AU.ctx.currentTime, g = AU.bus.gain; g.cancelScheduledValues(t); g.setTargetAtTime(AU.base * .35, t, .15); g.setTargetAtTime(AU.base, t + secs * .5, secs * .35) }
function burst(o) {
  let c = AU.ctx, t = c.currentTime, s = c.createBufferSource(); s.buffer = o.buf || AU.pink; s.loop = true; let fl = c.createBiquadFilter(); fl.type = o.type || 'bandpass'; fl.Q.value = o.q || 1;
  fl.frequency.setValueAtTime(o.f0, t); fl.frequency.exponentialRampToValueAtTime(o.f1, t + (o.sweep || 2)); let g = c.createGain(), a = o.attack || .2, h = o.hold || 1, d = o.decay || 1.5;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(o.peak || .4, t + a); g.gain.setValueAtTime(o.peak || .4, t + a + h); g.gain.exponentialRampToValueAtTime(.0001, t + a + h + d);
  s.connect(fl); fl.connect(g); g.connect(AU.master); s.start(t, Math.random() * 3); s.stop(t + a + h + d + .1);
}
function roar() { if (!audioReady()) return; swell(.8, 5.4); burst({ f0: 500, f1: 1700, q: .8, peak: 1, attack: .22, hold: 2, decay: 2.8, sweep: 2.8 }); burst({ buf: AU.brown, type: 'lowpass', f0: 420, f1: 200, q: .5, peak: 1.1, attack: .3, hold: 2.2, decay: 2.4, sweep: 3 }); burst({ f0: 2200, f1: 3600, q: 1.5, peak: .3, attack: .15, hold: 1.6, decay: 2.2, sweep: 2 }); burst({ f0: 900, f1: 1300, q: 2, peak: .6, attack: .12, hold: 1.2, decay: 2, sweep: 1.5 }) }
function groan() { if (!audioReady()) return; dip(3.2); burst({ type: 'lowpass', f0: 1300, f1: 280, q: .7, peak: .6, attack: .2, hold: .7, decay: 2.4, sweep: 2.4 }); burst({ buf: AU.brown, type: 'lowpass', f0: 300, f1: 150, q: .5, peak: .5, attack: .25, hold: .6, decay: 1.8, sweep: 2 }) }
function ohh(on) { if (!audioReady()) return; swell(on ? .3 : .16, on ? 2.2 : 1.6); burst({ f0: on ? 500 : 800, f1: on ? 1000 : 500, q: 1.2, peak: on ? .2 : .1, attack: .25, hold: .3, decay: 1.2, sweep: 1.4 }) }

/* ---------- referee, boardroom, notifications ---------- */
function whistle(blasts = 1, len = .55, gap = .2) {
  if (!audioReady()) return; let c = AU.ctx, t = c.currentTime;
  for (let i = 0; i < blasts; i++) {
    let st = t + i * (len + gap), o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 2850; let vib = c.createOscillator(); vib.frequency.value = 26; let vg = c.createGain(); vg.gain.value = 60; vib.connect(vg); vg.connect(o.frequency);
    let g = c.createGain(); g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(.2, st + .03); g.gain.setValueAtTime(.2, st + len - .06); g.gain.linearRampToValueAtTime(0, st + len);
    o.connect(g); g.connect(AU.master); o.start(st); vib.start(st); o.stop(st + len + .05); vib.stop(st + len + .05);
    let n = c.createBufferSource(); n.buffer = AU.pink; let hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000; let ng = c.createGain(); ng.gain.setValueAtTime(0, st); ng.gain.linearRampToValueAtTime(.06, st + .03); ng.gain.linearRampToValueAtTime(0, st + len); n.connect(hp); hp.connect(ng); ng.connect(AU.master); n.start(st, 0); n.stop(st + len + .05);
  }
}
function thump() { if (!audioReady()) return; burst({ buf: AU.brown, type: 'lowpass', f0: 220, f1: 90, q: .6, peak: .5, attack: .005, hold: .02, decay: .12, sweep: .15 }) }
function gavel() {
  if (!audioReady()) return; let c = AU.ctx, t = c.currentTime;
  for (let i = 0; i < 3; i++) {
    let st = t + i * .24, o = c.createOscillator(); o.frequency.setValueAtTime(130, st); o.frequency.exponentialRampToValueAtTime(55, st + .12); let g = c.createGain(); g.gain.setValueAtTime(.5, st); g.gain.exponentialRampToValueAtTime(.001, st + .16); o.connect(g); g.connect(AU.master); o.start(st); o.stop(st + .2);
    let n = c.createBufferSource(); n.buffer = AU.pink; let lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; let ng = c.createGain(); ng.gain.setValueAtTime(.4, st); ng.gain.exponentialRampToValueAtTime(.001, st + .07); n.connect(lp); lp.connect(ng); ng.connect(AU.master); n.start(st, 0); n.stop(st + .1);
  }
}
function ping() {
  if (!audioReady()) return; let c = AU.ctx, t = c.currentTime;
  for (let [f, d] of [[880, 0], [1318, .11]]) { let o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; let g = c.createGain(); g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(.12, t + d + .01); g.gain.exponentialRampToValueAtTime(.001, t + d + .9); o.connect(g); g.connect(AU.master); o.start(t + d); o.stop(t + d + 1) }
}

/* ---------- travel ---------- */
function travelSound(mode) {
  if (!audioReady()) return; let c = AU.ctx, t = c.currentTime;
  if (mode === 'flight') { burst({ type: 'lowpass', f0: 220, f1: 2200, q: .6, peak: .55, attack: 1.4, hold: 2.6, decay: 1.8, sweep: 3.4 }); burst({ f0: 3200, f1: 1400, q: 1.2, peak: .12, attack: 1.2, hold: 2.6, decay: 1.8, sweep: 4 }) }
  else { burst({ buf: AU.brown, type: 'lowpass', f0: 190, f1: 130, q: .5, peak: .6, attack: .5, hold: 4.4, decay: 1.4, sweep: 5 }); for (let i = 0; i < 5; i++) { let st = t + .4 + i * .7, o = c.createOscillator(); o.type = 'square'; o.frequency.value = 900; let gn = c.createGain(); gn.gain.setValueAtTime(0, st); gn.gain.linearRampToValueAtTime(.025, st + .005); gn.gain.linearRampToValueAtTime(0, st + .04); o.connect(gn); gn.connect(AU.master); o.start(st); o.stop(st + .06) } }
}
function arriveSound() { if (!audioReady()) return; burst({ f0: 600, f1: 1000, q: 1, peak: .3, attack: .3, hold: .6, decay: 1.6, sweep: 1.5 }); setTimeout(() => ping(), 120) }

/* no spoken commentator: synthetic voices sound robotic, and real voices cannot be shipped. The crowd carries the goal. */
function say() { return false }
/* ---------- one front door for the game ---------- */
const SFX = {
  ready: audioReady,
  kickoff() { whistle(1, .7); swell(.25, 3) }, halfTime() { whistle(2) }, fullTime() { whistle(3, .6); swell(.2, 3) },
  shot(onTarget, own) { thump(); ohh(onTarget && own) }, corner() { swell(.12, 1.6) }, card() { whistle(1, .3) },
  goal(own, who) { thump(); if (own) roar(); else groan() },
  gavel, ping, say, crowdOn, crowdOff, travel: travelSound, arrive: arriveSound
};

/* ---------- preferences, unlocking and the buttons ---------- */
function soundButton() { return `<button class="iconbutton soundbtn" onclick="toggleSound()" title="${soundOn() ? 'Sound on' : 'Sound off'}" aria-label="Toggle sound">${soundOn() ? '🔊' : '🔇'}</button>` }
function toggleSound() {
  let s = soundPrefs(); s.on = !s.on;
  if (s.on) { audioUnlock(); if (AU.master) AU.master.gain.setTargetAtTime(.9 * s.vol, AU.ctx.currentTime, .05); setTimeout(() => ping(), 150) }
  else { crowdOff(); if (AU.master) AU.master.gain.setTargetAtTime(0, AU.ctx.currentTime, .03); 0 }
  save(); render();
}
function setSound(k, v) {
  let s = soundPrefs(); if (k === 'vol') { s.vol = clamp(Number(v) / 100, 0, 1); if (AU.master) AU.master.gain.setTargetAtTime(.9 * s.vol, AU.ctx.currentTime, .05) } else s[k] = !!v;
  if (k === 'crowd' && !v) crowdOff(); if (k === 'on') { if (!v) { crowdOff(); if (AU.master) AU.master.gain.setTargetAtTime(0, AU.ctx.currentTime, .03) } else if (AU.master) AU.master.gain.setTargetAtTime(.9 * s.vol, AU.ctx.currentTime, .05) } save();
}
function audioSettingsHtml() {
  let s = soundPrefs(); return `<div class="pauseopt" style="cursor:default"><span><b>Sound</b><small><label><input type="checkbox" ${s.on ? 'checked' : ''} onchange="setSound('on',this.checked);audioUnlock()"> Sound on</label><br><label><input type="checkbox" ${s.crowd ? 'checked' : ''} onchange="setSound('crowd',this.checked)"> Stadium crowd</label><br><label class="volrow">Volume <input type="range" min="0" max="100" value="${Math.round(s.vol * 100)}" oninput="setSound('vol',this.value)"></label></small></span></div>`;
}
pauseSettings = function () {
  baseAudioPause(); let h = $('modal').innerHTML; if (typeof h === 'string') { let i = h.indexOf('<div class="actions"><button class="primary" onclick="closeModal()">Done'); if (i > 0) $('modal').innerHTML = h.slice(0, i) + audioSettingsHtml() + h.slice(i) }
};
if (typeof document.addEventListener === 'function') {
  for (let ev of ['pointerdown', 'keydown']) document.addEventListener(ev, () => { if (g) audioUnlock() }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (AU.ctx) { if (document.hidden) AU.ctx.suspend(); else if (soundPrefs().on) AU.ctx.resume() } });
}
function audioLevel() {
  if (!AU.analyser) return 0; let a = new Uint8Array(AU.analyser.fftSize); AU.analyser.getByteTimeDomainData(a); let s = 0; for (let v of a) { let x = (v - 128) / 128; s += x * x } return Math.sqrt(s / a.length);
}
