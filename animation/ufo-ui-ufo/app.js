const state = {
  powered: false,
  mode: "theremin",
  pitch: 520,
  glide: 0.34,
  vibrato: 0.38,
  beaconRate: 6,
  echo: 0.26,
  padX: 0.5,
  padY: 0.5,
};

const els = {
  power: document.querySelector("#powerButton"),
  stage: document.querySelector(".sky-stage"),
  modeReadout: document.querySelector("#modeReadout"),
  freqReadout: document.querySelector("#freqReadout"),
  beaconReadout: document.querySelector("#beaconReadout"),
  padReadout: document.querySelector("#padReadout"),
  pad: document.querySelector("#beamPad"),
  reticle: document.querySelector("#padReticle"),
  ufoBeam: document.querySelector("#ufoBeam"),
  canvas: document.querySelector("#scopeCanvas"),
  tabs: [...document.querySelectorAll(".mode-tab")],
  controls: [...document.querySelectorAll(".knob-control")],
};

const knobModels = new Map();
const scope = {
  context: els.canvas.getContext("2d"),
  data: new Uint8Array(1024),
  phase: 0,
};

class UfoSynth {
  constructor() {
    this.ctx = null;
    this.input = null;
    this.master = null;
    this.analyser = null;
    this.delay = null;
    this.feedback = null;
    this.wet = null;
    this.continuous = null;
    this.scheduler = null;
    this.nextBeaconTime = 0;
    this.beaconStep = 0;
  }

  async powerOn() {
    if (!this.ctx) {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) {
        throw new Error("Web Audio is not supported in this browser.");
      }
      this.ctx = new AudioContextCtor();
      this.createGraph();
    }

    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }

    this.startMode(state.mode);
  }

  async powerOff() {
    this.stopBeacon();
    this.stopContinuous();

    if (this.ctx) {
      await this.ctx.close();
    }

    this.ctx = null;
    this.input = null;
    this.master = null;
    this.analyser = null;
  }

  createGraph() {
    const ctx = this.ctx;
    this.input = ctx.createGain();
    this.master = ctx.createGain();
    this.delay = ctx.createDelay(1.2);
    this.feedback = ctx.createGain();
    this.wet = ctx.createGain();
    this.analyser = ctx.createAnalyser();

    const dry = ctx.createGain();
    dry.gain.value = 1;
    this.master.gain.value = 0.92;
    this.analyser.fftSize = 1024;

    this.input.connect(dry);
    this.input.connect(this.delay);
    this.delay.connect(this.feedback);
    this.feedback.connect(this.delay);
    this.delay.connect(this.wet);
    dry.connect(this.master);
    this.wet.connect(this.master);
    this.master.connect(this.analyser);
    this.analyser.connect(ctx.destination);
    this.updateEcho();
  }

  startMode(mode) {
    if (!this.ctx) return;
    this.stopBeacon();
    this.stopContinuous();

    if (mode === "beacon") {
      this.startBeacon();
      return;
    }

    this.startContinuous(mode);
  }

  startContinuous(mode) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const voices = voiceSettings(mode).map((voice) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = voice.type;
      osc.frequency.value = effectivePitch(mode) * voice.ratio;
      filter.type = "lowpass";
      filter.Q.value = voice.q;
      filter.frequency.value = filterFrequency();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(voice.level, now + 0.08);
      lfoGain.connect(osc.frequency);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.input);
      osc.start(now);

      return { osc, gain, filter, ratio: voice.ratio };
    });

    lfo.type = "sine";
    lfo.frequency.value = 4.2 + state.vibrato * 5.5;
    lfoGain.gain.value = vibratoDepth();
    lfo.connect(lfoGain);

    lfo.start(now);
    this.continuous = { voices, lfo, lfoGain };
    this.updateContinuous();
  }

  stopContinuous() {
    if (!this.continuous || !this.ctx) return;
    const { voices, lfo } = this.continuous;
    const now = this.ctx.currentTime;
    voices.forEach(({ osc, gain }) => {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0.0001, now, 0.025);
      osc.stop(now + 0.12);
    });
    lfo.stop(now + 0.12);
    setTimeout(() => {
      try {
        voices.forEach(({ osc, gain, filter }) => {
          osc.disconnect();
          filter.disconnect();
          gain.disconnect();
        });
        lfo.disconnect();
      } catch {
        // Nodes can already be gone after a fast power toggle.
      }
    }, 180);
    this.continuous = null;
  }

  startBeacon() {
    if (!this.ctx) return;
    this.nextBeaconTime = this.ctx.currentTime + 0.03;
    this.beaconStep = 0;
    this.scheduler = window.setInterval(() => this.scheduleBeacon(), 25);
    this.scheduleBeacon();
  }

  stopBeacon() {
    if (this.scheduler) {
      window.clearInterval(this.scheduler);
      this.scheduler = null;
    }
  }

  scheduleBeacon() {
    if (!this.ctx || state.mode !== "beacon") return;
    const lookahead = 0.14;
    const minGap = 1 / Math.max(1, state.beaconRate);

    while (this.nextBeaconTime < this.ctx.currentTime + lookahead) {
      this.triggerBeacon(this.nextBeaconTime);
      this.nextBeaconTime += minGap;
    }
  }

  triggerBeacon(time) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const tick = this.beaconStep++ % 8;
    const wobble = tick === 0 ? 1.22 : tick % 3 === 0 ? 0.84 : 1;
    const freq = effectivePitch("beacon") * wobble;
    const duration = 0.045 + (1 - state.padY) * 0.075;

    osc.type = "square";
    osc.frequency.setValueAtTime(freq * 1.18, time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.78), time + duration);
    filter.type = "bandpass";
    filter.Q.value = 8.5;
    filter.frequency.setValueAtTime(freq * 1.8, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.48, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.input);
    osc.start(time);
    osc.stop(time + duration + 0.03);
    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }

  updateContinuous() {
    if (!this.continuous || !this.ctx) return;
    const { voices, lfo, lfoGain } = this.continuous;
    const now = this.ctx.currentTime;
    const target = Math.max(40, effectivePitch(state.mode));
    const glide = Math.max(0.025, state.glide);

    voices.forEach(({ osc, filter, ratio }) => {
      if (osc.frequency.cancelAndHoldAtTime) {
        osc.frequency.cancelAndHoldAtTime(now);
      } else {
        osc.frequency.cancelScheduledValues(now);
        osc.frequency.setValueAtTime(osc.frequency.value, now);
      }

      osc.frequency.exponentialRampToValueAtTime(target * ratio, now + glide);
      filter.frequency.setTargetAtTime(filterFrequency(), now, 0.05);
    });
    lfo.frequency.setTargetAtTime(4.2 + state.vibrato * 5.5, now, 0.04);
    lfoGain.gain.setTargetAtTime(vibratoDepth(), now, 0.04);
  }

  updateEcho() {
    if (!this.ctx || !this.delay) return;
    const now = this.ctx.currentTime;
    this.delay.delayTime.setTargetAtTime(0.11 + state.echo * 0.45, now, 0.04);
    this.feedback.gain.setTargetAtTime(Math.min(0.62, state.echo * 0.78), now, 0.04);
    this.wet.gain.setTargetAtTime(state.echo * 0.58, now, 0.04);
  }

  updateAll() {
    this.updateEcho();
    this.updateContinuous();
  }
}

const synth = new UfoSynth();

function voiceSettings(mode) {
  if (mode === "triple") {
    return [
      { ratio: 1, level: 0.17, type: "sine", q: 5.8 },
      { ratio: 1.26, level: 0.14, type: "triangle", q: 4.8 },
      { ratio: 1.5, level: 0.13, type: "sine", q: 6.4 },
    ];
  }

  if (mode === "hover") {
    return [{ ratio: 1, level: 0.24, type: "triangle", q: 3.2 }];
  }

  return [{ ratio: 1, level: 0.32, type: "sine", q: 6.5 }];
}

function effectivePitch(mode = state.mode) {
  const orbit = (state.padX - 0.5) * 1.25;
  const ratio = 2 ** orbit;
  const base = mode === "hover" ? state.pitch * 0.48 : state.pitch;
  return clamp(base * ratio, 35, 4200);
}

function vibratoDepth() {
  return (2 + state.pitch * 0.045) * state.vibrato * (0.55 + (1 - state.padY) * 0.9);
}

function filterFrequency() {
  return clamp(680 + state.padY * 4600 + state.vibrato * 700, 420, 6800);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function labelForMode(mode) {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

function initKnobs() {
  els.controls.forEach((control) => {
    const knob = control.querySelector(".knob");
    const model = {
      control,
      knob,
      output: control.querySelector("output"),
      param: control.dataset.param,
      min: Number(control.dataset.min),
      max: Number(control.dataset.max),
      value: Number(control.dataset.value),
      unit: control.dataset.unit || "",
      decimals: Number(control.dataset.decimals || 0),
      scale: control.dataset.scale || "linear",
      percent: control.dataset.percent === "true",
    };

    state[model.param] = model.value;
    knobModels.set(model.param, model);
    updateKnob(model, model.value);

    knob.addEventListener("pointerdown", (event) => {
      knob.setPointerCapture(event.pointerId);
      setKnobFromPointer(model, event);
    });

    knob.addEventListener("pointermove", (event) => {
      if (event.buttons === 1) setKnobFromPointer(model, event);
    });

    knob.addEventListener("keydown", (event) => {
      const keys = ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft", "Home", "End"];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      const norm = valueToNorm(model, state[model.param]);
      const step = event.shiftKey ? 0.1 : 0.025;
      let next = norm;

      if (event.key === "ArrowUp" || event.key === "ArrowRight") next += step;
      if (event.key === "ArrowDown" || event.key === "ArrowLeft") next -= step;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = 1;

      updateKnob(model, normToValue(model, clamp(next, 0, 1)));
      applyParams();
    });
  });
}

function setKnobFromPointer(model, event) {
  const rect = model.knob.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = event.clientX - centerX;
  const dy = event.clientY - centerY;
  let degrees = (Math.atan2(dy, dx) * 180) / Math.PI + 90;

  if (degrees > 180) degrees -= 360;
  degrees = clamp(degrees, -135, 135);
  const norm = (degrees + 135) / 270;
  updateKnob(model, normToValue(model, norm));
  applyParams();
}

function updateKnob(model, value) {
  const normalized = valueToNorm(model, value);
  const angle = -135 + normalized * 270;
  const display = formatValue(model, value);
  state[model.param] = value;
  model.control.style.setProperty("--angle", `${angle}deg`);
  model.control.style.setProperty("--amount", normalized.toFixed(4));
  model.output.textContent = display;
  model.knob.setAttribute("aria-valuenow", value.toFixed(model.decimals));
  model.knob.setAttribute("aria-valuetext", display);
}

function valueToNorm(model, value) {
  if (model.scale === "log") {
    return Math.log(value / model.min) / Math.log(model.max / model.min);
  }
  return (value - model.min) / (model.max - model.min);
}

function normToValue(model, norm) {
  if (model.scale === "log") {
    return model.min * (model.max / model.min) ** norm;
  }
  return model.min + (model.max - model.min) * norm;
}

function formatValue(model, value) {
  if (model.percent) {
    const percent = Math.round(valueToNorm(model, value) * 100);
    return `${percent}%`;
  }

  return `${value.toFixed(model.decimals)}${model.unit}`;
}

function initModes() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      state.mode = tab.dataset.mode;
      els.tabs.forEach((item) => {
        const active = item === tab;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-selected", String(active));
      });

      updateReadouts();
      synth.startMode(state.mode);
    });
  });
}

function initPower() {
  els.power.addEventListener("click", async () => {
    const nextPowered = !state.powered;
    els.power.disabled = true;

    try {
      if (nextPowered) {
        await synth.powerOn();
        state.powered = true;
      } else {
        await synth.powerOff();
        state.powered = false;
      }
    } catch (error) {
      state.powered = false;
      console.warn(error.message);
    } finally {
      els.power.disabled = false;
      updatePowerUI();
    }
  });
}

function updatePowerUI() {
  els.power.setAttribute("aria-pressed", String(state.powered));
  els.stage.classList.toggle("is-playing", state.powered);
  document.body.classList.toggle("is-playing", state.powered);
}

function applyParams() {
  synth.updateAll();
  updateReadouts();
  updateBeam();
}

function updateReadouts() {
  els.modeReadout.textContent = labelForMode(state.mode);
  els.freqReadout.textContent = `${Math.round(effectivePitch())} Hz`;
  els.beaconReadout.textContent = `${state.beaconRate.toFixed(1)} pps`;
  const cents = Math.round((state.padX - 0.5) * 1200);
  const lift = Math.round((1 - state.padY) * 100);
  els.padReadout.textContent = `${cents >= 0 ? "+" : ""}${cents} c / ${lift}%`;
}

function updateBeam() {
  const width = 38 + state.echo * 58 + (1 - state.padY) * 24;
  els.ufoBeam.style.width = `${width}%`;
  els.ufoBeam.style.opacity = state.powered ? `${0.55 + state.vibrato * 0.35}` : "0.48";
}

function initPad() {
  const setFromEvent = (event) => {
    const rect = els.pad.getBoundingClientRect();
    state.padX = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    state.padY = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    updatePadVisual();
    applyParams();
  };

  els.pad.addEventListener("pointerdown", (event) => {
    els.pad.setPointerCapture(event.pointerId);
    setFromEvent(event);
  });

  els.pad.addEventListener("pointermove", (event) => {
    if (event.buttons === 1) setFromEvent(event);
  });

  els.pad.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 0.08 : 0.035;
    const before = `${state.padX}:${state.padY}`;

    if (event.key === "ArrowLeft") state.padX -= step;
    if (event.key === "ArrowRight") state.padX += step;
    if (event.key === "ArrowUp") state.padY -= step;
    if (event.key === "ArrowDown") state.padY += step;
    if (event.key === "Home") {
      state.padX = 0.5;
      state.padY = 0.5;
    }

    state.padX = clamp(state.padX, 0, 1);
    state.padY = clamp(state.padY, 0, 1);
    if (`${state.padX}:${state.padY}` !== before) {
      event.preventDefault();
      updatePadVisual();
      applyParams();
    }
  });
}

function updatePadVisual() {
  els.reticle.style.left = `${state.padX * 100}%`;
  els.reticle.style.top = `${state.padY * 100}%`;
  els.pad.setAttribute("aria-valuenow", Math.round(state.padX * 100));
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = els.canvas.getBoundingClientRect();
  const width = Math.max(320, Math.round(rect.width * dpr));
  const height = Math.max(120, Math.round(rect.height * dpr));

  if (els.canvas.width !== width || els.canvas.height !== height) {
    els.canvas.width = width;
    els.canvas.height = height;
  }
}

function drawScope() {
  resizeCanvas();
  const ctx = scope.context;
  const width = els.canvas.width;
  const height = els.canvas.height;
  scope.phase += 0.018;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(8, 8, 12, 0.7)";
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, width, height);

  ctx.lineWidth = Math.max(2, width * 0.004);
  ctx.strokeStyle =
    state.mode === "beacon"
      ? "#ffd36a"
      : state.mode === "triple"
        ? "#dc84ff"
        : state.mode === "hover"
          ? "#75c8ff"
          : "#80ffd7";
  ctx.shadowColor = ctx.strokeStyle;
  ctx.shadowBlur = 16;
  ctx.beginPath();

  if (state.powered && synth.analyser) {
    synth.analyser.getByteTimeDomainData(scope.data);
    for (let i = 0; i < scope.data.length; i += 1) {
      const x = (i / (scope.data.length - 1)) * width;
      const y = (scope.data[i] / 255) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  } else {
    for (let x = 0; x <= width; x += 8) {
      const t = x / width;
      const amp = 0.18 + state.vibrato * 0.08;
      const y = height * (0.5 + Math.sin(t * Math.PI * 4 + scope.phase) * amp);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }

  ctx.stroke();
  ctx.shadowBlur = 0;
  requestAnimationFrame(drawScope);
}

function drawGrid(ctx, width, height) {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
  ctx.lineWidth = 1;

  for (let x = 0; x <= width; x += width / 12) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y <= height; y += height / 5) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.restore();
}

function boot() {
  initKnobs();
  initModes();
  initPower();
  initPad();
  updatePadVisual();
  updatePowerUI();
  applyParams();
  drawScope();
}

boot();
