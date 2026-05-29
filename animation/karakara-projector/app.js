const controls = {
  powerButton: document.querySelector("#powerButton"),
  powerLabel: document.querySelector("#powerLabel"),
  powerSymbol: document.querySelector(".power-symbol"),
  jamButton: document.querySelector("#jamButton"),
  statusText: document.querySelector("#statusText"),
  statusDot: document.querySelector("#statusDot"),
  canvas: document.querySelector("#projectorCanvas"),
  speed: document.querySelector("#speedControl"),
  clatter: document.querySelector("#clatterControl"),
  wear: document.querySelector("#wearControl"),
  motor: document.querySelector("#motorControl"),
  lamp: document.querySelector("#lampControl"),
  room: document.querySelector("#roomControl"),
  sync: document.querySelector("#syncControl"),
  catches: document.querySelector("#catchControl"),
  values: {
    speed: document.querySelector("#speedValue"),
    clatter: document.querySelector("#clatterValue"),
    wear: document.querySelector("#wearValue"),
    motor: document.querySelector("#motorValue"),
    lamp: document.querySelector("#lampValue"),
    room: document.querySelector("#roomValue"),
    speedReadout: document.querySelector("#speedReadout"),
    pulseReadout: document.querySelector("#pulseReadout")
  }
};

const params = {
  speed: Number(controls.speed.value),
  clatter: Number(controls.clatter.value) / 100,
  wear: Number(controls.wear.value) / 100,
  motor: Number(controls.motor.value) / 100,
  lamp: Number(controls.lamp.value) / 100,
  room: Number(controls.room.value) / 100,
  sync: controls.sync.checked,
  catches: controls.catches.checked
};

class ProjectorAudio {
  constructor(settings) {
    this.params = { ...settings };
    this.ctx = null;
    this.master = null;
    this.motorGain = null;
    this.bearingGain = null;
    this.rotorGain = null;
    this.rotorFilter = null;
    this.rotorPulse = null;
    this.humOsc = null;
    this.subOsc = null;
    this.whirFilter = null;
    this.delayGain = null;
    this.delayFeedback = null;
    this.noiseBuffer = null;
    this.clickBuffer = null;
    this.rumbleBuffer = null;
    this.nodes = [];
    this.scheduler = null;
    this.nextFrameTime = 0;
    this.frameCounter = 0;
    this.running = false;
  }

  async init() {
    if (this.ctx) {
      await this.ctx.resume();
      return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();
    this.noiseBuffer = this.createNoiseBuffer(1.4);
    this.clickBuffer = this.createClickBuffer(0.08);
    this.rumbleBuffer = this.createRumbleBuffer(2.4);

    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 16;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.16;
    compressor.connect(this.ctx.destination);

    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(compressor);

    this.delay = this.ctx.createDelay(0.42);
    this.delay.delayTime.value = 0.068;
    this.delayFeedback = this.ctx.createGain();
    this.delayFeedback.gain.value = 0.06;
    this.delayGain = this.ctx.createGain();
    this.delayGain.gain.value = 0.08;
    this.delay.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay);
    this.delay.connect(this.delayGain);
    this.delayGain.connect(compressor);

    await this.ctx.resume();
  }

  createNoiseBuffer(duration) {
    const length = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;

    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.82 + white * 0.18;
      data[i] = white * 0.58 + last * 0.42;
    }

    return buffer;
  }

  createClickBuffer(duration) {
    const length = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let previous = 0;

    for (let i = 0; i < length; i += 1) {
      const progress = i / Math.max(1, length - 1);
      const envelope = Math.pow(1 - progress, 3.2);
      const grit = Math.random() < 0.5 ? -1 : 1;
      const white = Math.random() * 1.4 - 0.7 + grit * 0.32;
      const high = white - previous * 0.62;
      previous = white;
      data[i] = high * envelope;
    }

    return buffer;
  }

  createRumbleBuffer(duration) {
    const length = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let brown = 0;
    let last = 0;

    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      brown = (brown + white * 0.055) * 0.985;
      const blocked = Math.round(white * 5) / 5;
      last = last * 0.72 + blocked * 0.28;
      data[i] = brown * 0.82 + last * 0.18;
    }

    return buffer;
  }

  async start() {
    await this.init();
    if (this.running) return;

    const now = this.ctx.currentTime;
    this.running = true;
    this.createContinuousBed(now);
    this.applyParams(now);
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(0.82, now, 0.045);
    this.nextFrameTime = now + 0.04;
    this.frameCounter = 0;
    this.scheduler = window.setInterval(() => this.schedule(), 22);
  }

  stop() {
    if (!this.ctx || !this.running) return;

    const now = this.ctx.currentTime;
    this.running = false;
    window.clearInterval(this.scheduler);
    this.scheduler = null;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(0, now, 0.065);

    for (const node of this.nodes) {
      try {
        node.stop(now + 0.18);
      } catch (error) {
        // Some nodes may already be stopped by their envelope.
      }
    }

    this.nodes = [];
  }

  createContinuousBed(now) {
    const motorFilter = this.ctx.createBiquadFilter();
    motorFilter.type = "lowpass";
    motorFilter.frequency.value = 260;
    motorFilter.Q.value = 0.6;

    this.motorGain = this.ctx.createGain();
    this.motorGain.gain.value = 0;
    this.motorGain.connect(motorFilter);
    motorFilter.connect(this.master);
    motorFilter.connect(this.delay);

    const hum = this.ctx.createOscillator();
    hum.type = "sine";
    hum.frequency.value = 52;
    hum.connect(this.motorGain);
    hum.start(now);

    const sub = this.ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = 29;
    sub.connect(this.motorGain);
    sub.start(now);

    const rotorSource = this.ctx.createBufferSource();
    rotorSource.buffer = this.rumbleBuffer;
    rotorSource.loop = true;

    const rotorHighpass = this.ctx.createBiquadFilter();
    rotorHighpass.type = "highpass";
    rotorHighpass.frequency.value = 38;
    rotorHighpass.Q.value = 0.5;

    const rotorFilter = this.ctx.createBiquadFilter();
    rotorFilter.type = "lowpass";
    rotorFilter.frequency.value = 420;
    rotorFilter.Q.value = 0.95;

    this.rotorGain = this.ctx.createGain();
    this.rotorGain.gain.value = 0;
    rotorSource.connect(rotorHighpass);
    rotorHighpass.connect(rotorFilter);
    rotorFilter.connect(this.rotorGain);
    this.rotorGain.connect(this.master);
    rotorSource.start(now);

    const rotorPulse = this.ctx.createOscillator();
    rotorPulse.type = "triangle";
    rotorPulse.frequency.value = 8;
    const rotorPulseDepth = this.ctx.createGain();
    rotorPulseDepth.gain.value = 0.018;
    rotorPulse.connect(rotorPulseDepth);
    rotorPulseDepth.connect(this.rotorGain.gain);
    rotorPulse.start(now);

    const whirSource = this.ctx.createBufferSource();
    whirSource.buffer = this.noiseBuffer;
    whirSource.loop = true;

    const whirFilter = this.ctx.createBiquadFilter();
    whirFilter.type = "highpass";
    whirFilter.frequency.value = 2200;
    whirFilter.Q.value = 0.45;

    this.bearingGain = this.ctx.createGain();
    this.bearingGain.gain.value = 0;
    whirSource.connect(whirFilter);
    whirFilter.connect(this.bearingGain);
    this.bearingGain.connect(this.master);
    this.bearingGain.connect(this.delay);
    whirSource.start(now);

    this.humOsc = hum;
    this.subOsc = sub;
    this.rotorFilter = rotorFilter;
    this.rotorPulse = rotorPulse;
    this.whirFilter = whirFilter;
    this.nodes.push(hum, sub, rotorSource, rotorPulse, whirSource);
  }

  schedule() {
    if (!this.running || !this.ctx) return;

    const lookAhead = 0.14;
    const now = this.ctx.currentTime;
    const baseInterval = 1 / this.params.speed;

    while (this.nextFrameTime < now + lookAhead) {
      const wander = (Math.random() - 0.5) * 0.0045 * this.params.wear;
      const t = this.nextFrameTime + wander;
      this.scheduleFrame(t, baseInterval);
      this.nextFrameTime += baseInterval;
      this.frameCounter += 1;
    }
  }

  scheduleFrame(time, interval) {
    const clatter = this.params.clatter;
    const wear = this.params.wear;
    const catchHit = this.params.catches && Math.random() < 0.006 + wear * 0.024;
    const accent = this.frameCounter % 3 === 0 ? 1.18 : 0.94;
    const scrape = 0.45 + wear * 2.1 + (catchHit ? 1.7 : 0);

    // Gate slam: the low-mid body of the projector, like a rotary machine under load.
    this.noiseHit(time - 0.002, {
      buffer: "rumble",
      echo: false,
      filter: "bandpass",
      duration: 0.024 + wear * 0.018 + (catchHit ? 0.028 : 0),
      gain: (0.12 + clatter * 0.25) * accent * (catchHit ? 1.48 : 1),
      frequency: 150 + Math.random() * 260 + wear * 150,
      q: 1.0 + wear * 0.7,
      attack: 0.0012,
      decay: 0.028 + wear * 0.014 + (catchHit ? 0.03 : 0),
      rate: 0.66 + Math.random() * 0.18
    });

    // Gate impact: a midrange crunch gives the mechanism weight without adding a tonal motor.
    this.noiseHit(time - 0.001, {
      dry: true,
      echo: false,
      duration: 0.006 + wear * 0.006 + (catchHit ? 0.018 : 0),
      gain: (0.065 + clatter * 0.16) * accent * (catchHit ? 1.36 : 1),
      frequency: 520 + Math.random() * 950 + wear * 500,
      q: 0.95 + wear * 0.62,
      attack: 0.00055,
      decay: 0.011 + wear * 0.007 + (catchHit ? 0.018 : 0),
      rate: 0.58 + Math.random() * 0.18
    });

    // Pull-down claw: the strongest transient in the loop.
    this.noiseHit(time, {
      dry: true,
      echo: false,
      duration: 0.0035 + wear * 0.0045 + (catchHit ? 0.014 : 0),
      gain: (0.052 + clatter * 0.13) * accent * (catchHit ? 1.42 : 1),
      frequency: 3600 + Math.random() * 5000 + scrape * 700,
      q: 2.4 + wear * 2.2,
      attack: 0.00045,
      decay: 0.006 + wear * 0.005 + (catchHit ? 0.014 : 0),
      rate: 0.9 + Math.random() * 0.22
    });

    this.noiseHit(time + 0.006, {
      buffer: "rumble",
      echo: false,
      filter: "bandpass",
      duration: 0.016 + wear * 0.01,
      gain: (0.045 + clatter * 0.12) * (0.8 + Math.random() * 0.35),
      frequency: 250 + Math.random() * 520 + wear * 260,
      q: 0.9 + wear * 0.6,
      attack: 0.001,
      decay: 0.019 + wear * 0.01,
      rate: 0.74 + Math.random() * 0.18
    });

    // A smaller metal edge, kept short so it reads as hard mechanism instead of a tone.
    this.metalPing(time + 0.004, {
      gain: 0.002 + clatter * 0.007 + wear * 0.004,
      frequency: 1800 + Math.random() * 2600 + this.params.speed * 18,
      duration: 0.01 + wear * 0.007
    });

    const bladeCount = this.params.sync ? 2 : 1;
    const shutterGain = this.params.sync ? 0.014 + clatter * 0.032 : 0.007 + clatter * 0.013;
    for (let blade = 0; blade < bladeCount; blade += 1) {
      this.noiseHit(time + (interval / bladeCount) * blade + 0.0012, {
        dry: true,
        echo: false,
        duration: 0.0018 + wear * 0.002,
        gain: shutterGain * (blade === 0 ? 0.74 : 1),
        frequency: 6500 + Math.random() * 4200 + wear * 900,
        q: 2.6 + wear * 1.8,
        attack: 0.00035,
        decay: 0.0032 + wear * 0.002
      });
    }

    if (wear > 0.15) {
      const microTaps = 1 + Math.floor(wear * 3);
      for (let i = 0; i < microTaps; i += 1) {
        this.noiseHit(time + 0.009 + Math.random() * interval * 0.62, {
          buffer: Math.random() < 0.58 ? "rumble" : "click",
          echo: false,
          filter: "bandpass",
          duration: 0.005 + Math.random() * 0.009,
          gain: (0.018 + clatter * 0.055) * wear,
          frequency: 190 + Math.random() * 850,
          q: 0.9 + Math.random() * 0.8,
          attack: 0.0008,
          decay: 0.012 + Math.random() * 0.01,
          rate: 0.66 + Math.random() * 0.32
        });
      }
    }
  }

  noiseHit(time, options) {
    const source = this.ctx.createBufferSource();
    source.buffer = this.selectBuffer(options);

    const filter = this.ctx.createBiquadFilter();
    filter.type = options.filter || "bandpass";
    filter.frequency.setValueAtTime(options.frequency, time);
    filter.Q.value = options.q;

    const gain = this.ctx.createGain();
    const attack = options.attack ?? (options.dry ? 0.00055 : 0.0015);
    const offset = options.dry ? 0 : Math.random() * 0.6;
    source.playbackRate.setValueAtTime(options.rate ?? (0.92 + Math.random() * 0.16), time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, options.gain), time + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + options.decay);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    if (options.echo !== false) {
      gain.connect(this.delay);
    }
    source.start(time, offset, options.duration);
    source.stop(time + options.duration + 0.02);
  }

  selectBuffer(options) {
    if (options.buffer === "rumble") return this.rumbleBuffer;
    if (options.buffer === "click" || options.dry) return this.clickBuffer;
    return this.noiseBuffer;
  }

  metalPing(time, options) {
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(options.frequency, time);
    osc.frequency.exponentialRampToValueAtTime(options.frequency * 1.08, time + options.duration);

    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 920;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, options.gain), time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + options.duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    gain.connect(this.delay);
    osc.start(time);
    osc.stop(time + options.duration + 0.02);
  }

  jam() {
    if (!this.running || !this.ctx) return;

    const now = this.ctx.currentTime;
    for (let i = 0; i < 7; i += 1) {
      this.noiseHit(now + i * 0.028 + Math.random() * 0.012, {
        dry: true,
        echo: false,
        duration: 0.012 + Math.random() * 0.03,
        gain: 0.13 + this.params.clatter * 0.2,
        frequency: 1800 + Math.random() * 6800,
        q: 2 + Math.random() * 3,
        attack: 0.0005,
        decay: 0.012 + Math.random() * 0.03
      });
    }

    this.metalPing(now + 0.02, {
      gain: 0.18,
      frequency: 320 + Math.random() * 260,
      duration: 0.18
    });
  }

  update(settings) {
    this.params = { ...this.params, ...settings };
    if (this.ctx && this.running) {
      this.applyParams(this.ctx.currentTime);
    }
  }

  applyParams(time) {
    const motorAmount = this.params.motor;
    const motorLevel = 0.012 + motorAmount * 0.06;
    const bearingLevel = 0.002 + motorAmount * 0.008 + this.params.wear * 0.012;
    const rotorLevel = 0.06 + this.params.clatter * 0.095 + this.params.wear * 0.075 + motorAmount * 0.05;
    const motorPitch = 43 + this.params.speed * 0.76;
    const rotorPulseRate = Math.max(5, this.params.speed * 0.48);
    const whirPitch = 1900 + this.params.speed * 38 + this.params.wear * 520;
    const room = this.params.room;

    if (this.motorGain) {
      this.motorGain.gain.setTargetAtTime(motorLevel, time, 0.08);
    }

    if (this.humOsc && this.subOsc) {
      this.humOsc.frequency.setTargetAtTime(motorPitch, time, 0.12);
      this.subOsc.frequency.setTargetAtTime(motorPitch * 0.5, time, 0.12);
    }

    if (this.rotorGain) {
      this.rotorGain.gain.setTargetAtTime(rotorLevel, time, 0.1);
    }

    if (this.rotorFilter && this.rotorPulse) {
      this.rotorFilter.frequency.setTargetAtTime(260 + this.params.speed * 10 + this.params.wear * 180, time, 0.14);
      this.rotorFilter.Q.setTargetAtTime(0.82 + this.params.wear * 0.45, time, 0.14);
      this.rotorPulse.frequency.setTargetAtTime(rotorPulseRate, time, 0.12);
    }

    if (this.whirFilter) {
      this.whirFilter.frequency.setTargetAtTime(whirPitch, time, 0.12);
      this.whirFilter.Q.setTargetAtTime(0.42 + this.params.wear * 0.22, time, 0.12);
    }

    if (this.bearingGain) {
      this.bearingGain.gain.setTargetAtTime(bearingLevel, time, 0.08);
    }

    if (this.delayGain && this.delayFeedback) {
      this.delayGain.gain.setTargetAtTime(room * 0.055, time, 0.08);
      this.delayFeedback.gain.setTargetAtTime(0.006 + room * 0.07, time, 0.08);
    }
  }
}

class ProjectorVisual {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.params = { ...settings };
    this.running = false;
    this.filmOffset = 0;
    this.reelAngle = 0;
    this.flashKick = 0;
    this.last = performance.now();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    requestAnimationFrame((time) => this.draw(time));
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(1, Math.floor(rect.width * dpr));
    this.height = Math.max(1, Math.floor(rect.height * dpr));
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cssWidth = rect.width;
    this.cssHeight = rect.height;
  }

  update(settings) {
    this.params = { ...this.params, ...settings };
  }

  setRunning(value) {
    this.running = value;
  }

  kickFlash() {
    this.flashKick = 1;
  }

  draw(time) {
    const delta = Math.min(0.05, (time - this.last) / 1000);
    this.last = time;

    if (this.running) {
      this.filmOffset += delta * this.params.speed * 22;
      this.reelAngle += delta * this.params.speed * 0.42;
    } else {
      this.reelAngle += delta * 0.08;
    }

    this.flashKick *= 0.9;

    const ctx = this.ctx;
    const w = this.cssWidth;
    const h = this.cssHeight;
    ctx.clearRect(0, 0, w, h);
    this.drawRoom(ctx, w, h);
    this.drawLight(ctx, w, h, time);
    this.drawProjector(ctx, w, h);
    this.drawFilm(ctx, w, h, time);
    this.drawProjection(ctx, w, h, time);
    requestAnimationFrame((next) => this.draw(next));
  }

  drawRoom(ctx, w, h) {
    const grd = ctx.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, "#17110c");
    grd.addColorStop(0.52, "#080807");
    grd.addColorStop(1, "#14170f");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(255, 226, 164, 0.035)";
    for (let y = 0; y < h; y += 6) {
      ctx.fillRect(0, y, w, 1);
    }
  }

  drawLight(ctx, w, h, time) {
    const lamp = this.params.lamp;
    const flicker = this.running
      ? 0.62 + Math.sin(time * 0.001 * this.params.speed * Math.PI * 4) * 0.21 + Math.random() * 0.09
      : 0.18;
    const intensity = Math.max(0, lamp * flicker + this.flashKick * 0.45);
    const gateX = w * 0.42;
    const gateY = h * 0.5;
    const endX = w * 0.93;
    const coneH = h * (0.28 + lamp * 0.18);

    ctx.save();
    ctx.globalAlpha = intensity * 0.54;
    const cone = ctx.createLinearGradient(gateX, gateY, endX, gateY);
    cone.addColorStop(0, "rgba(255, 226, 164, 0.72)");
    cone.addColorStop(0.46, "rgba(255, 200, 112, 0.26)");
    cone.addColorStop(1, "rgba(255, 233, 184, 0)");
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(gateX, gateY - 32);
    ctx.lineTo(endX, gateY - coneH);
    ctx.lineTo(endX, gateY + coneH);
    ctx.lineTo(gateX, gateY + 32);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawProjector(ctx, w, h) {
    const baseX = w * 0.08;
    const baseY = h * 0.63;
    const bodyW = w * 0.31;
    const bodyH = h * 0.25;
    const r = Math.min(w, h) * 0.105;

    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 18;

    ctx.fillStyle = "#24201a";
    this.roundRect(ctx, baseX + bodyW * 0.11, baseY - bodyH, bodyW * 0.78, bodyH, 10);
    ctx.fill();

    ctx.fillStyle = "#12100d";
    this.roundRect(ctx, baseX + bodyW * 0.68, baseY - bodyH * 0.72, bodyW * 0.26, bodyH * 0.33, 6);
    ctx.fill();

    ctx.fillStyle = "#30291f";
    this.roundRect(ctx, baseX, baseY, bodyW, h * 0.055, 8);
    ctx.fill();

    this.drawReel(ctx, baseX + bodyW * 0.3, baseY - bodyH - r * 0.38, r, this.reelAngle);
    this.drawReel(ctx, baseX + bodyW * 0.72, baseY - bodyH - r * 0.48, r * 0.88, -this.reelAngle * 0.9);

    ctx.strokeStyle = "rgba(169, 128, 70, 0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(baseX + bodyW * 0.29, baseY - bodyH - r * 0.36);
    ctx.quadraticCurveTo(baseX + bodyW * 0.5, baseY - bodyH * 1.13, baseX + bodyW * 0.72, baseY - bodyH - r * 0.47);
    ctx.stroke();

    ctx.restore();
  }

  drawReel(ctx, x, y, radius, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = "#211c16";
    ctx.strokeStyle = "rgba(255, 226, 164, 0.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#0f0d0b";
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(241, 178, 82, 0.45)";
    for (let i = 0; i < 5; i += 1) {
      ctx.rotate((Math.PI * 2) / 5);
      this.roundRect(ctx, radius * 0.25, -radius * 0.08, radius * 0.53, radius * 0.16, radius * 0.07);
      ctx.fill();
    }
    ctx.restore();
  }

  drawFilm(ctx, w, h) {
    const x = w * 0.32;
    const y = h * 0.16;
    const stripW = Math.max(84, w * 0.105);
    const stripH = h * 0.68;
    const sprocketW = stripW * 0.16;
    const frameH = stripW * 0.72;
    const perfGap = 21;
    const offset = this.filmOffset % perfGap;

    ctx.save();
    ctx.fillStyle = "#15120e";
    this.roundRect(ctx, x, y, stripW, stripH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 226, 164, 0.18)";
    ctx.stroke();

    ctx.fillStyle = "#ecd09b";
    for (let py = y - perfGap + offset; py < y + stripH + perfGap; py += perfGap) {
      this.roundRect(ctx, x + 9, py, sprocketW, perfGap * 0.47, 3);
      ctx.fill();
      this.roundRect(ctx, x + stripW - sprocketW - 9, py, sprocketW, perfGap * 0.47, 3);
      ctx.fill();
    }

    ctx.strokeStyle = "rgba(255, 226, 164, 0.22)";
    ctx.lineWidth = 1;
    for (let fy = y - frameH + (this.filmOffset % frameH); fy < y + stripH + frameH; fy += frameH) {
      ctx.strokeRect(x + stripW * 0.25, fy, stripW * 0.5, frameH * 0.78);
    }
    ctx.restore();
  }

  drawProjection(ctx, w, h, time) {
    const screenW = w * 0.36;
    const screenH = Math.min(h * 0.48, screenW * 0.72);
    const x = w * 0.58;
    const y = h * 0.27;
    const lamp = this.params.lamp;
    const pulse = this.running
      ? Math.max(0.08, 0.55 + Math.sin(time * 0.001 * this.params.speed * Math.PI * 4) * 0.35)
      : 0.12;
    const alpha = lamp * (this.params.sync ? pulse : 0.62);

    ctx.save();
    ctx.shadowColor = "rgba(255, 208, 126, 0.45)";
    ctx.shadowBlur = 42 + lamp * 42;
    ctx.fillStyle = `rgba(255, 231, 180, ${0.16 + alpha * 0.58})`;
    this.roundRect(ctx, x, y, screenW, screenH, 8);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(60, 42, 24, ${0.1 + alpha * 0.08})`;
    const bandY = y + ((this.filmOffset * 0.65) % screenH);
    ctx.fillRect(x, bandY, screenW, 2);

    const scratches = 7;
    ctx.strokeStyle = `rgba(48, 36, 26, ${0.13 + this.params.wear * 0.22})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < scratches; i += 1) {
      const sx = x + screenW * (0.12 + i * 0.12) + Math.sin(time * 0.001 + i) * 3;
      ctx.beginPath();
      ctx.moveTo(sx, y + 8);
      ctx.lineTo(sx + Math.sin(i) * 7, y + screenH - 8);
      ctx.stroke();
    }

    ctx.fillStyle = `rgba(55, 39, 25, ${0.08 + this.params.wear * 0.16})`;
    for (let i = 0; i < 26; i += 1) {
      const dotX = x + ((i * 47 + time * 0.012) % screenW);
      const dotY = y + ((i * 83 + time * 0.021) % screenH);
      ctx.beginPath();
      ctx.arc(dotX, dotY, 0.7 + (i % 3) * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width * 0.5, height * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }
}

const audio = new ProjectorAudio(params);
const visual = new ProjectorVisual(controls.canvas, params);

function readParams() {
  params.speed = Number(controls.speed.value);
  params.clatter = Number(controls.clatter.value) / 100;
  params.wear = Number(controls.wear.value) / 100;
  params.motor = Number(controls.motor.value) / 100;
  params.lamp = Number(controls.lamp.value) / 100;
  params.room = Number(controls.room.value) / 100;
  params.sync = controls.sync.checked;
  params.catches = controls.catches.checked;
  return { ...params };
}

function renderControls() {
  controls.values.speed.value = Math.round(params.speed);
  controls.values.clatter.value = Math.round(params.clatter * 100);
  controls.values.wear.value = Math.round(params.wear * 100);
  controls.values.motor.value = Math.round(params.motor * 100);
  controls.values.lamp.value = Math.round(params.lamp * 100);
  controls.values.room.value = Math.round(params.room * 100);
  controls.values.speedReadout.textContent = `${params.speed.toFixed(1)} fps`;
  controls.values.pulseReadout.textContent = `${(params.speed * 2).toFixed(0)} Hz`;
}

function applyControlUpdate() {
  const next = readParams();
  renderControls();
  audio.update(next);
  visual.update(next);
}

function setRunning(running) {
  visual.setRunning(running);
  controls.powerButton.classList.toggle("is-running", running);
  controls.powerButton.setAttribute("aria-pressed", String(running));
  controls.powerLabel.textContent = running ? "Stop" : "Start";
  controls.powerSymbol.textContent = running ? "||" : ">";
  controls.statusText.textContent = running ? "Running" : "Idle";
  controls.statusDot.classList.toggle("running", running);
}

async function togglePower() {
  if (audio.running) {
    audio.stop();
    setRunning(false);
    return;
  }

  applyControlUpdate();
  await audio.start();
  setRunning(true);
}

for (const input of [
  controls.speed,
  controls.clatter,
  controls.wear,
  controls.motor,
  controls.lamp,
  controls.room,
  controls.sync,
  controls.catches
]) {
  input.addEventListener("input", applyControlUpdate);
  input.addEventListener("change", applyControlUpdate);
}

controls.powerButton.addEventListener("click", () => {
  togglePower().catch((error) => {
    controls.statusText.textContent = "Audio blocked";
    console.error(error);
  });
});

controls.jamButton.addEventListener("click", () => {
  audio.jam();
  visual.kickFlash();
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Space" && event.target === document.body) {
    event.preventDefault();
    togglePower();
  }
});

renderControls();
