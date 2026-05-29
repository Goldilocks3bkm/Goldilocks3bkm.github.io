const disc = document.querySelector("#disc");
const dtx = disc.getContext("2d");
const constellation = document.querySelector("#constellation");
const ctx = constellation.getContext("2d");
const projection = document.querySelector("#projection");
const ptx = projection.getContext("2d");
const stage = document.querySelector(".stage");

const playButton = document.querySelector("#play");
const clearButton = document.querySelector("#clear");
const drawStarsButton = document.querySelector("#drawStars");
const eraseStarsButton = document.querySelector("#eraseStars");
const clearStarsButton = document.querySelector("#clearStars");
const seedButton = document.querySelector("#seed");
const exportMidiButton = document.querySelector("#exportMidi");
const tempoInput = document.querySelector("#tempo");
const tempoValue = document.querySelector("#tempoValue");
const skySelect = document.querySelector("#sky");
const scaleSelect = document.querySelector("#scale");
const skySizeInput = document.querySelector("#skySize");
const skySizeValue = document.querySelector("#skySizeValue");
const harmonyInput = document.querySelector("#harmony");
const harmonyValue = document.querySelector("#harmonyValue");

const STEPS = 32;
const RINGS = 13;
const TAU = Math.PI * 2;
const state = {
  playing: false,
  tempo: Number(tempoInput.value),
  step: 0,
  angle: 0,
  lastTick: 0,
  notes: Array.from({ length: RINGS }, () => Array(STEPS).fill(false)),
  projectionPulses: [],
  projectionPower: 0,
  audio: null,
  audioPrimed: false,
  sky: skySelect.value,
  scale: scaleSelect.value,
  skySize: Number(skySizeInput.value),
  harmony: Number(harmonyInput.value),
  constellationMode: "off",
  constellationDrawing: false,
  currentStroke: null,
  constellations: [],
  drawing: false,
  drawValue: true,
  lastDrawKey: "",
};

const skyPalettes = {
  aurora: ["#7bd7ff", "#a5ffe0", "#f6d174", "#ffffff"],
  nebula: ["#8fc8ff", "#b986ff", "#ff9bc4", "#ffe2a7"],
  zodiac: ["#fff0aa", "#79c8ff", "#d7a96c", "#ffffff"],
  deep: ["#5cb7ff", "#88f4ff", "#d7e8ff", "#c99cff"],
};

const scales = {
  major: [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21],
  minor: [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19, 20],
  pentatonic: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28],
  whole: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24],
};

const hologramStars = createHologramStars(220);
const nebulaDust = createNebulaDust(120);

function ensureAudio() {
  if (!state.audio) {
    state.audio = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (state.audio.state === "suspended") {
    state.audio.resume().catch(() => {});
  }

  primeAudio(state.audio);
  return state.audio;
}

function primeAudio(audio) {
  if (state.audioPrimed || !audio) return;
  state.audioPrimed = true;
  const source = audio.createBufferSource();
  const gain = audio.createGain();
  source.buffer = audio.createBuffer(1, 1, audio.sampleRate);
  gain.gain.value = 0;
  source.connect(gain);
  gain.connect(audio.destination);
  source.start();
}

function noteFrequency(ring) {
  const intervals = scales[state.scale] || scales.pentatonic;
  const semitone = intervals[RINGS - 1 - ring] + 48;
  return 440 * 2 ** ((semitone - 69) / 12);
}

function playNote(ring) {
  const audio = ensureAudio();
  if (!audio || audio.state === "closed") return;
  playMusicBoxVoice(audio, ring);
}

function playMusicBoxVoice(audio, ring) {
  const now = audio.currentTime;
  const freq = noteFrequency(ring);
  const gain = audio.createGain();
  const filter = audio.createBiquadFilter();
  const oscA = audio.createOscillator();
  const oscB = audio.createOscillator();

  oscA.type = "sine";
  oscB.type = "triangle";
  oscA.frequency.setValueAtTime(freq, now);
  oscB.frequency.setValueAtTime(freq * 2.01, now);
  filter.type = "highpass";
  filter.frequency.setValueAtTime(260, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.24, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.65);

  oscA.connect(filter);
  oscB.connect(filter);
  filter.connect(gain);
  gain.connect(audio.destination);
  oscA.start(now);
  oscB.start(now);
  oscA.stop(now + 1.75);
  oscB.stop(now + 1.75);
}

function triggerProjection(ring) {
  const now = performance.now();
  state.projectionPulses.push({
    ring,
    born: now,
    life: 1500,
    phase: ring * 0.61,
  });
}

function triggerDiscEvent(ring) {
  triggerProjection(ring);
  playNote(ring);
}

function tick(now) {
  const msPerStep = 60000 / state.tempo / 4;
  if (state.playing && now - state.lastTick > msPerStep) {
    state.lastTick = now;
    state.step = (state.step + 1) % STEPS;
    const activeRings = [];
    for (let ring = 0; ring < RINGS; ring += 1) {
      if (state.notes[ring][state.step]) {
        triggerDiscEvent(ring);
        activeRings.push(ring);
      }
    }
    if (activeRings.length > 0) {
      triggerConstellationHarmony(activeRings);
    }
  }

  const targetAngle = (state.step / STEPS) * TAU;
  state.angle = positiveModulo(state.angle + angleDelta(state.angle, targetAngle) * 0.15, TAU);
  drawDisc();
  drawConstellations(now);
  drawProjection(now);
  requestAnimationFrame(tick);
}

function angleDelta(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function positiveModulo(value, modulo) {
  return ((value % modulo) + modulo) % modulo;
}

function drawDisc() {
  const { width, height } = disc;
  const cx = width / 2;
  const cy = height / 2;
  const outer = width * 0.45;
  const inner = width * 0.13;
  dtx.clearRect(0, 0, width, height);

  const metal = dtx.createRadialGradient(cx * 0.78, cy * 0.68, 20, cx, cy, outer);
  metal.addColorStop(0, "#f4dfaa");
  metal.addColorStop(0.25, "#b9914c");
  metal.addColorStop(0.62, "#6b5634");
  metal.addColorStop(1, "#d0b36f");
  dtx.fillStyle = metal;
  dtx.beginPath();
  dtx.arc(cx, cy, outer, 0, Math.PI * 2);
  dtx.arc(cx, cy, inner, 0, Math.PI * 2, true);
  dtx.fill("evenodd");

  dtx.save();
  dtx.translate(cx, cy);
  dtx.rotate(state.angle);

  for (let ring = 0; ring < RINGS; ring += 1) {
    const r = radiusForRing(ring, inner, outer);
    dtx.strokeStyle = ring % 2 ? "rgba(25,18,9,.38)" : "rgba(255,240,190,.25)";
    dtx.lineWidth = 1.2;
    dtx.beginPath();
    dtx.arc(0, 0, r, 0, Math.PI * 2);
    dtx.stroke();
  }

  for (let step = 0; step < STEPS; step += 1) {
    const a = stepAngle(step);
    dtx.strokeStyle = step % 4 === 0 ? "rgba(32,18,8,.42)" : "rgba(32,18,8,.18)";
    dtx.lineWidth = step % 4 === 0 ? 1.6 : 0.8;
    dtx.beginPath();
    dtx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
    dtx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
    dtx.stroke();
  }

  for (let ring = 0; ring < RINGS; ring += 1) {
    for (let step = 0; step < STEPS; step += 1) {
      const punched = state.notes[ring][step];
      const r = radiusForRing(ring, inner, outer);
      const a = stepAngle(step);
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      dtx.beginPath();
      dtx.arc(x, y, punched ? 7.8 : 3.1, 0, Math.PI * 2);
      dtx.fillStyle = punched ? "#11100e" : "rgba(255,238,174,.25)";
      dtx.fill();
      if (punched) {
        dtx.strokeStyle = "rgba(255,234,170,.75)";
        dtx.lineWidth = 1.1;
        dtx.stroke();
      }
    }
  }

  dtx.restore();

  dtx.strokeStyle = "rgba(255,245,198,.92)";
  dtx.lineWidth = 4;
  dtx.beginPath();
  dtx.moveTo(cx, cy - outer - 18);
  dtx.lineTo(cx, cy - inner + 10);
  dtx.stroke();

  dtx.fillStyle = "#1b1309";
  dtx.beginPath();
  dtx.arc(cx, cy, inner * 0.44, 0, Math.PI * 2);
  dtx.fill();
  dtx.strokeStyle = "#f1d287";
  dtx.lineWidth = 5;
  dtx.stroke();
}

function stepAngle(step) {
  return -Math.PI / 2 + (step / STEPS) * Math.PI * 2;
}

function radiusForRing(ring, inner, outer) {
  const t = (ring + 0.5) / RINGS;
  return outer - (outer - inner) * t;
}

function hitTestDisc(event) {
  const rect = disc.getBoundingClientRect();
  const scale = disc.width / rect.width;
  const x = (event.clientX - rect.left) * scale - disc.width / 2;
  const y = (event.clientY - rect.top) * scale - disc.height / 2;
  const outer = disc.width * 0.45;
  const inner = disc.width * 0.13;
  const r = Math.hypot(x, y);
  if (r < inner || r > outer) return null;

  const unrotated = Math.atan2(y, x) - state.angle + Math.PI / 2;
  const normalized = positiveModulo(unrotated, TAU);
  const step = positiveModulo(Math.round((normalized / TAU) * STEPS), STEPS);
  const ring = Math.floor((1 - (r - inner) / (outer - inner)) * RINGS);
  return { ring: Math.max(0, Math.min(RINGS - 1, ring)), step };
}

function syncConstellationCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(constellation.clientWidth * ratio));
  const height = Math.max(1, Math.round(constellation.clientHeight * ratio));
  if (constellation.width !== width || constellation.height !== height) {
    constellation.width = width;
    constellation.height = height;
  }
}

function drawConstellations(now) {
  syncConstellationCanvas();
  const width = constellation.width;
  const height = constellation.height;
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (const stroke of state.constellations) {
    if (stroke.points.length < 1) continue;

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(204, 229, 255, 0.48)";
    ctx.beginPath();
    let drawingLine = false;
    for (let index = 0; index < stroke.points.length; index += 1) {
      const point = stroke.points[index];
      const x = point.x * width;
      const y = point.y * height;
      if (!drawingLine) {
        ctx.moveTo(x, y);
        drawingLine = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    for (const point of stroke.points) {
      const x = point.x * width;
      const y = point.y * height;
      const age = now - (point.litAt || -99999);
      const glow = Math.max(0, 1 - age / 900);
      const twinkle = 0.65 + Math.sin(now * 0.004 + point.phase) * 0.35;
      const radius = 4.2 + point.size * 2.2 + glow * 6.5;
      const starGlow = ctx.createRadialGradient(x, y, 0, x, y, radius * 4.4);
      starGlow.addColorStop(0, `rgba(255, 245, 190, ${0.72 + glow * 0.28})`);
      starGlow.addColorStop(0.34, `rgba(117, 205, 255, ${0.26 + glow * 0.26})`);
      starGlow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = starGlow;
      ctx.beginPath();
      ctx.arc(x, y, radius * 4.4, 0, TAU);
      ctx.fill();

      ctx.fillStyle = `rgba(255, 246, 201, ${0.82 * twinkle + glow * 0.34})`;
      ctx.beginPath();
      ctx.arc(x, y, 2.8 + point.size + glow * 1.8, 0, TAU);
      ctx.fill();

      ctx.strokeStyle = `rgba(255, 255, 255, ${0.24 + glow * 0.6})`;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(x - radius * 1.8, y);
      ctx.lineTo(x + radius * 1.8, y);
      ctx.moveTo(x, y - radius * 1.8);
      ctx.lineTo(x, y + radius * 1.8);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function getConstellationPoint(event) {
  const rect = constellation.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
  };
}

function addConstellationPoint(event) {
  const point = getConstellationPoint(event);
  const stroke = state.currentStroke;
  if (!stroke) return;
  const last = stroke.points.at(-1);
  if (last && Math.hypot(point.x - last.x, point.y - last.y) * constellation.clientWidth < 24) return;
  stroke.points.push({
    ...point,
    size: 0.35 + Math.random() * 0.9,
    phase: Math.random() * TAU,
    litAt: -99999,
  });
  updateConstellationStatus();
}

function eraseConstellationPoint(event) {
  const point = getConstellationPoint(event);
  const radius = 54 / Math.max(1, constellation.clientWidth);
  for (const stroke of state.constellations) {
    stroke.points = stroke.points.filter((star) => Math.hypot(star.x - point.x, star.y - point.y) > radius);
  }
  state.constellations = state.constellations.filter((stroke) => stroke.points.length > 0);
  updateConstellationStatus();
}

function allConstellationStars() {
  return state.constellations.flatMap((stroke) => stroke.points);
}

function isConstellationUiTarget(target) {
  return target instanceof Element && Boolean(target.closest(".controls, .disc-wrap"));
}

function triggerConstellationHarmony(activeRings) {
  const stars = allConstellationStars();
  if (stars.length === 0 || state.harmony <= 0) return;

  const sweep = (state.step + 0.5) / STEPS;
  const band = Math.max(0.035, 1.6 / STEPS);
  const litStars = stars
    .map((star) => ({ star, distance: Math.abs(star.x - sweep) }))
    .filter((entry) => entry.distance < band)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 7)
    .map((entry) => entry.star);

  if (litStars.length === 0) return;
  const now = performance.now();
  for (const star of litStars) {
    star.litAt = now;
  }

  const rootRing = activeRings[Math.floor(activeRings.length / 2)];
  playHarmony(rootRing, litStars);
}

function playHarmony(rootRing, litStars) {
  if (state.harmony <= 0) return;
  const audio = ensureAudio();
  if (!audio || audio.state === "closed") return;
  playHarmonyVoices(audio, rootRing, litStars);
}

function playHarmonyVoices(audio, rootRing, litStars) {
  const now = audio.currentTime;
  const voiceCount = Math.min(6, litStars.length);
  const averageY = litStars.reduce((sum, star) => sum + star.y, 0) / litStars.length;
  const verticalShift = Math.round((0.5 - averageY) * 16);
  const intervals = [0, 7, 12, 16, 19, 24];
  const root = midiNoteForRing(rootRing) + verticalShift - 5;
  const amount = state.harmony / 100;

  for (let index = 0; index < voiceCount; index += 1) {
    const note = root + intervals[index];
    const freq = 440 * 2 ** ((note - 69) / 12);
    const delay = index * 0.018;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    const filter = audio.createBiquadFilter();
    osc.type = index % 2 ? "sine" : "triangle";
    osc.frequency.setValueAtTime(freq, now + delay);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2400 + index * 220, now + delay);
    gain.gain.setValueAtTime(0.0001, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.035 * amount, now + delay + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 1.8);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audio.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 1.9);
  }
}

function createHologramStars(count) {
  return Array.from({ length: count }, (_, index) => {
    const radius = 0.15 + Math.random() * 0.86;
    return {
      radius,
      theta: Math.random() * TAU,
      y: (Math.random() - 0.5) * 1.6,
      size: 0.55 + Math.random() * 1.9,
      speed: 0.55 + Math.random() * 1.35,
      phase: Math.random() * TAU,
      colorIndex: index % 4,
    };
  });
}

function createNebulaDust(count) {
  return Array.from({ length: count }, (_, index) => ({
    radius: 0.1 + Math.random() * 0.95,
    theta: Math.random() * TAU,
    y: (Math.random() - 0.5) * 1.15,
    size: 10 + Math.random() * 38,
    speed: 0.32 + Math.random() * 0.55,
    phase: Math.random() * TAU,
    colorIndex: index % 3,
  }));
}

function drawProjection(now) {
  syncProjectionCanvas();
  const canvasWidth = projection.width;
  const canvasHeight = projection.height;
  const { cx, cy, visualWidth, visualHeight } = getProjectionLayout();
  const targetPower = state.playing ? 1 : 0;
  const pulsePower = state.projectionPulses.reduce((sum, pulse) => {
    return sum + Math.max(0, 1 - (now - pulse.born) / pulse.life);
  }, 0);
  const audioPulse = Math.min(1, pulsePower * 0.42);
  const powerTarget = Math.min(1, targetPower + pulsePower * 0.18);
  state.projectionPower += (powerTarget - state.projectionPower) * 0.055;

  ptx.clearRect(0, 0, canvasWidth, canvasHeight);
  if (state.projectionPower < 0.012) return;

  const power = state.projectionPower;
  const palette = skyPalettes[state.sky] || skyPalettes.aurora;
  const spin = now * 0.00018;

  ptx.save();
  ptx.globalCompositeOperation = "lighter";
  ptx.globalAlpha = power;
  drawProjectionCore(ptx, now, cx, cy, visualWidth, visualHeight, palette, power, audioPulse);
  drawNebula(ptx, now, spin, cx, cy, visualWidth, visualHeight, palette, power, audioPulse);
  drawHologramStars(ptx, now, spin, cx, cy, visualWidth, visualHeight, palette, power, audioPulse);
  drawProjectionBlooms(ptx, now, cx, cy, visualWidth, visualHeight, palette, power);
  ptx.restore();

  state.projectionPulses = state.projectionPulses.filter((pulse) => now - pulse.born < pulse.life);
}

function syncProjectionCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(projection.clientWidth * ratio));
  const height = Math.max(1, Math.round(projection.clientHeight * ratio));
  if (projection.width !== width || projection.height !== height) {
    projection.width = width;
    projection.height = height;
  }
}

function getProjectionLayout() {
  const rect = stage.getBoundingClientRect();
  const scaleX = projection.width / Math.max(1, projection.clientWidth);
  const scaleY = projection.height / Math.max(1, projection.clientHeight);
  const viewportWidth = projection.clientWidth;
  const viewportHeight = projection.clientHeight;
  const size = state.skySize / 100;
  const grow = smoothstep(Math.max(0, state.skySize - 100) / (Number(skySizeInput.max) - 100));
  const baseCenterX = rect.left + rect.width * 0.5;
  const baseCenterY = rect.top + rect.height * 0.545;
  const fullCenterX = viewportWidth * 0.5;
  const fullCenterY = viewportHeight * 0.48;
  const baseWidth = rect.width * 0.76 * size;
  const baseHeight = rect.height * 0.34 * size;
  const fullWidth = viewportWidth * 1.16;
  const fullHeight = viewportHeight * 0.84;

  return {
    cx: lerp(baseCenterX, fullCenterX, grow) * scaleX,
    cy: lerp(baseCenterY, fullCenterY, grow) * scaleY,
    visualWidth: lerp(baseWidth, fullWidth, grow) * scaleX,
    visualHeight: lerp(baseHeight, fullHeight, grow) * scaleY,
  };
}

function smoothstep(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

function drawProjectionCore(ctx, now, cx, cy, width, height, palette, power, audioPulse) {
  const breath = Math.sin(now * 0.0014) * 0.5 + 0.5;
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, width * 0.42);
  glow.addColorStop(0, colorWithAlpha(palette[0], (0.095 + audioPulse * 0.075) * power));
  glow.addColorStop(0.45, colorWithAlpha(palette[1], (0.06 + audioPulse * 0.045) * power));
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(cx, cy, width * 0.44, height * 0.25, 0, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = colorWithAlpha(palette[0], (0.14 + breath * 0.08 + audioPulse * 0.06) * power);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(cx, cy, width * 0.38, height * 0.2, 0, 0, TAU);
  ctx.stroke();

  ctx.strokeStyle = colorWithAlpha("#ffffff", 0.035 * power);
  ctx.beginPath();
  ctx.ellipse(cx, cy, width * 0.26, height * 0.055, now * 0.00034, 0, TAU);
  ctx.stroke();
}

function drawNebula(ctx, now, spin, cx, cy, width, height, palette, power, audioPulse) {
  for (const mote of nebulaDust) {
    const theta = mote.theta + spin * mote.speed;
    const z = Math.sin(theta + mote.phase * 0.18);
    const depth = 0.72 + (z + 1) * 0.15;
    const swirl = mote.radius * width * 0.42;
    const x = cx + Math.cos(theta) * swirl * depth;
    const y = cy + mote.y * height * 0.13 * depth + Math.sin(theta * 2 + mote.phase) * height * 0.018;
    const alpha = (0.04 + Math.max(0, z + 0.35) * 0.066 + audioPulse * 0.028) * power;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, mote.size * depth);
    glow.addColorStop(0, colorWithAlpha(palette[mote.colorIndex], alpha * 4));
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, mote.size * depth, 0, TAU);
    ctx.fill();
  }
}

function drawHologramStars(ctx, now, spin, cx, cy, width, height, palette, power, audioPulse) {
  const projected = hologramStars.map((star) => {
    const theta = star.theta + spin * star.speed;
    const z = Math.sin(theta + star.phase * 0.2);
    const depth = 0.68 + (z + 1) * 0.19;
    const x = cx + Math.cos(theta) * star.radius * width * 0.43 * depth;
    const y = cy + star.y * height * 0.16 * depth + Math.sin(theta * 2 + star.phase) * height * 0.014;
    return { ...star, x, y, z, depth };
  });

  for (const star of projected.sort((a, b) => a.z - b.z)) {
    const twinkle = 0.55 + Math.sin(now * 0.004 + star.phase) * 0.45;
    const alpha = (0.46 + Math.max(0, star.z) * 0.6 + audioPulse * 0.24) * twinkle * power;
    const size = star.size * star.depth * (1.08 + twinkle * 0.58 + audioPulse * 0.35);
    ctx.fillStyle = colorWithAlpha(palette[star.colorIndex], alpha);
    ctx.beginPath();
    ctx.arc(star.x, star.y, size, 0, TAU);
    ctx.fill();

    if (twinkle > 0.82 && star.size > 1.2) {
      ctx.strokeStyle = colorWithAlpha("#ffffff", alpha * 0.62);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(star.x - size * 3.2, star.y);
      ctx.lineTo(star.x + size * 3.2, star.y);
      ctx.moveTo(star.x, star.y - size * 3.2);
      ctx.lineTo(star.x, star.y + size * 3.2);
      ctx.stroke();
    }
  }

}

function colorWithAlpha(hex, alpha) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function downloadMidi() {
  const bytes = buildMidiFile();
  const blob = new Blob([new Uint8Array(bytes)], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "celestial-box-pattern.mid";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildMidiFile() {
  const ppq = 480;
  const ticksPerStep = ppq / 4;
  const tempo = Math.round(60000000 / state.tempo);
  const track = [];
  pushVar(track, 0);
  track.push(0xff, 0x51, 0x03, (tempo >> 16) & 0xff, (tempo >> 8) & 0xff, tempo & 0xff);
  pushVar(track, 0);
  track.push(0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08);

  const events = [];
  for (let step = 0; step < STEPS; step += 1) {
    for (let ring = 0; ring < RINGS; ring += 1) {
      if (!state.notes[ring][step]) continue;
      const note = midiNoteForRing(ring);
      const start = step * ticksPerStep;
      const end = start + ticksPerStep;
      events.push({ tick: start, data: [0x90, note, 82] });
      events.push({ tick: end, data: [0x80, note, 0] });
    }
  }
  events.sort((a, b) => a.tick - b.tick || a.data[0] - b.data[0]);

  let cursor = 0;
  for (const event of events) {
    pushVar(track, event.tick - cursor);
    track.push(...event.data);
    cursor = event.tick;
  }

  const endTick = STEPS * ticksPerStep;
  pushVar(track, Math.max(0, endTick - cursor));
  track.push(0xff, 0x2f, 0x00);

  return [
    ...ascii("MThd"),
    0x00, 0x00, 0x00, 0x06,
    0x00, 0x00,
    0x00, 0x01,
    (ppq >> 8) & 0xff, ppq & 0xff,
    ...ascii("MTrk"),
    (track.length >> 24) & 0xff,
    (track.length >> 16) & 0xff,
    (track.length >> 8) & 0xff,
    track.length & 0xff,
    ...track,
  ];
}

function midiNoteForRing(ring) {
  const intervals = scales[state.scale] || scales.pentatonic;
  return intervals[RINGS - 1 - ring] + 48;
}

function ascii(text) {
  return Array.from(text, (char) => char.charCodeAt(0));
}

function pushVar(bytes, value) {
  let buffer = value & 0x7f;
  while ((value >>= 7)) {
    buffer <<= 8;
    buffer |= (value & 0x7f) | 0x80;
  }
  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) {
      buffer >>= 8;
    } else {
      break;
    }
  }
}

function drawProjectionBlooms(ctx, now, cx, cy, width, height, palette, power) {
  for (const pulse of state.projectionPulses) {
    const t = Math.max(0, 1 - (now - pulse.born) / pulse.life);
    const angle = pulse.phase + now * 0.00016;
    const orbit = (pulse.ring / Math.max(1, RINGS - 1) - 0.5) * width * 0.38;
    const x = cx + Math.cos(angle) * orbit * 0.48;
    const y = cy + Math.sin(angle * 1.7) * height * 0.09;
    const radius = width * (0.12 + (1 - t) * 0.2);
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, colorWithAlpha(palette[pulse.ring % palette.length], 0.14 * t * power));
    glow.addColorStop(0.42, colorWithAlpha("#ffffff", 0.035 * t * power));
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(x, y, radius, radius * 0.36, angle * 0.3, 0, TAU);
    ctx.fill();
  }
}

function setHoleFromPointer(event, shouldToggle = false) {
  const hit = hitTestDisc(event);
  if (!hit) return false;
  const key = `${hit.ring}:${hit.step}`;
  if (key === state.lastDrawKey) return true;
  state.lastDrawKey = key;

  if (shouldToggle) {
    state.drawValue = !state.notes[hit.ring][hit.step];
  }
  state.notes[hit.ring][hit.step] = state.drawValue;
  if (state.drawValue) triggerDiscEvent(hit.ring);
  return true;
}

disc.addEventListener("pointerdown", (event) => {
  ensureAudio();
  state.drawing = true;
  state.lastDrawKey = "";
  disc.setPointerCapture(event.pointerId);
  setHoleFromPointer(event, true);
});

disc.addEventListener("pointermove", (event) => {
  if (!state.drawing) return;
  setHoleFromPointer(event);
});

disc.addEventListener("pointerup", (event) => {
  state.drawing = false;
  state.lastDrawKey = "";
  disc.releasePointerCapture(event.pointerId);
});

disc.addEventListener("pointercancel", () => {
  state.drawing = false;
  state.lastDrawKey = "";
});

document.addEventListener(
  "pointerdown",
  () => {
    ensureAudio();
  },
  { capture: true }
);

document.addEventListener("pointerdown", (event) => {
  if (state.constellationMode === "off") return;
  if (isConstellationUiTarget(event.target)) return;
  if (state.constellationMode === "erase") {
    eraseConstellationPoint(event);
    state.constellationDrawing = true;
    return;
  }

  state.constellationDrawing = true;
  state.currentStroke = { points: [] };
  state.constellations.push(state.currentStroke);
  addConstellationPoint(event);
});

document.addEventListener("pointermove", (event) => {
  if (!state.constellationDrawing) return;
  if (state.constellationMode === "erase") {
    eraseConstellationPoint(event);
  } else {
    addConstellationPoint(event);
  }
});

document.addEventListener("pointerup", () => {
  state.constellationDrawing = false;
  if (state.currentStroke && state.currentStroke.points.length < 1) {
    state.constellations = state.constellations.filter((stroke) => stroke !== state.currentStroke);
  }
  state.currentStroke = null;
});

document.addEventListener("pointercancel", () => {
  state.constellationDrawing = false;
  state.currentStroke = null;
});

document.addEventListener("click", (event) => {
  if (state.constellationMode === "off" || state.constellationDrawing) return;
  if (isConstellationUiTarget(event.target)) return;
  if (state.constellationMode === "erase") {
    eraseConstellationPoint(event);
    return;
  }

  state.currentStroke = { points: [] };
  state.constellations.push(state.currentStroke);
  const stroke = state.currentStroke;
  addConstellationPoint(event);
  if (stroke.points.length < 1) {
    state.constellations = state.constellations.filter((item) => item !== stroke);
  }
  state.currentStroke = null;
});

playButton.addEventListener("click", () => {
  ensureAudio();
  state.playing = !state.playing;
  state.lastTick = performance.now();
  playButton.textContent = state.playing ? "Pause" : "Play";
});

clearButton.addEventListener("click", () => {
  for (const ring of state.notes) ring.fill(false);
});

drawStarsButton.addEventListener("click", () => {
  setConstellationMode(state.constellationMode === "draw" ? "off" : "draw");
});

eraseStarsButton.addEventListener("click", () => {
  setConstellationMode(state.constellationMode === "erase" ? "off" : "erase");
});

clearStarsButton.addEventListener("click", () => {
  state.constellations = [];
  state.currentStroke = null;
  state.constellationDrawing = false;
  updateConstellationStatus();
});

seedButton.addEventListener("click", () => {
  for (const ring of state.notes) ring.fill(false);
  for (let step = 0; step < STEPS; step += 1) {
    if (step % 2 === 0) state.notes[8 + (step % 5)][step] = true;
    if (step % 8 === 0) state.notes[11][step] = true;
    if ([5, 14, 21, 29].includes(step)) state.notes[3 + (step % 4)][step] = true;
  }
});

tempoInput.addEventListener("input", () => {
  state.tempo = Number(tempoInput.value);
  tempoValue.value = tempoInput.value;
});

scaleSelect.addEventListener("change", () => {
  state.scale = scaleSelect.value;
});

skySelect.addEventListener("change", () => {
  state.sky = skySelect.value;
});

skySizeInput.addEventListener("input", () => {
  state.skySize = Number(skySizeInput.value);
  skySizeValue.value = skySizeInput.value;
  updateSkySize();
});

harmonyInput.addEventListener("input", () => {
  state.harmony = Number(harmonyInput.value);
  harmonyValue.value = harmonyInput.value;
});

exportMidiButton.addEventListener("click", () => {
  downloadMidi();
});

seedButton.click();
updateSkySize();
updateConstellationStatus();
requestAnimationFrame(tick);

function updateSkySize() {
  skySizeValue.value = String(state.skySize);
}

function setConstellationMode(mode) {
  state.constellationMode = mode;
  drawStarsButton.classList.toggle("is-active", mode === "draw");
  eraseStarsButton.classList.toggle("is-active", mode === "erase");
  document.body.classList.toggle("constellation-editing", mode !== "off");
  document.body.classList.toggle("constellation-erasing", mode === "erase");
  updateConstellationStatus();
}

function updateConstellationStatus() {
  const count = allConstellationStars().length;
  drawStarsButton.title = `${count} drawn star${count === 1 ? "" : "s"}`;
}
