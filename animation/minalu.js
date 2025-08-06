// ---- 設定 ----
const W = 768; H = 468;
const GEAR_MAX = 45, STAR_CNT = 180;

let gears = [], stars = [];
let minalImg; // 女の子画像（透過PNG推奨）

function preload() {
  // ファイル名は適宜変えてね（ここでは minalu2.png）
  minalImg = loadImage('minalu2.png');
}

function setup() {
  createCanvas(W, H);
  angleMode(RADIANS);
  for (let i = 0; i < STAR_CNT; i++) stars.push(new Star());
  for (let i = 0; i < GEAR_MAX; i++) gears.push(new Gear());
}

function draw() {
  background(0, 16, 32);

  // 星とギア
  for (let s of stars) { s.upd(); s.show(); }
  for (let g of gears) { g.upd(); g.show(); }

  // ミナル画像（左下）
  if (minalImg) {
    let scaleF = 1.0; // 必要なら調整
    let imgW = minalImg.width * scaleF;
    let imgH = minalImg.height * scaleF;
    image(minalImg, 0, H - imgH, imgW, imgH);
  }
}

// ==== 星クラス ====
class Star {
  constructor() {
    this.x = random(width); this.y = random(height);
    this.ph = random(TWO_PI); this.bright = random(0.7, 1);
  }
  upd() {
    this.a = 100 + 155 * sin(frameCount * 0.03 + this.ph) * this.bright;
  }
  show() {
    stroke(255, this.a); strokeWeight(1); point(this.x, this.y);
    // 明るいときにキラキラ十字
    if (this.a > 220) {
      stroke(255, this.a);
      line(this.x - 3, this.y, this.x + 3, this.y);
      line(this.x, this.y - 3, this.x, this.y + 3);
    }
  }
}

// ==== 歯車クラス ====
class Gear {
  constructor() { this.reset(); }
  reset() {
    this.x = random(width); this.y = random(-H, -40);
    this.r = random(2, 10); this.t = int(random(6, 16));
    this.rotSp = random(-0.06, 0.06);
    this.col = color(random(200, 255), random(140, 220), random(80, 200));
    this.v = random(1, 4);
  }
  upd() {
    this.y += this.v;
    if (this.y - this.r > H) this.reset();
  }
  show() {
    push();
    translate(this.x, this.y); rotate(frameCount * this.rotSp);
    fill(this.col); noStroke();
    beginShape();
    for (let a = 0; a < TWO_PI; a += TWO_PI / this.t) {
      vertex(cos(a) * this.r, sin(a) * this.r);
      vertex(cos(a + PI / this.t) * this.r * 1.35, sin(a + PI / this.t) * this.r * 1.35);
    }
    endShape(CLOSE);
    fill(0, 150); circle(0, 0, this.r * 0.6);
    pop();
  }
}
