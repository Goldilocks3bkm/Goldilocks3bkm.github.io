// ====== グローバル変数・定数 ======
let leaves = [];         // ★葉っぱ配列
let rainbowColors;       // ★葉色リスト
let wordFonts = ["serif", "sans-serif", "monospace", "Georgia", "Verdana", "Courier New"];
let bgImg;               // ★背景画像

// -- 文字リスト（ここはそのまま上に書く） --
const hiraList = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん".split('');
const kataList = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン".split('');
const abcList  = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');

// ====== 画像読み込み ======
function preload() {
  bgImg = loadImage("alice001.PNG");  // ← ファイル名は自分の画像に合わせてね
}

// ====== ランダム単語生成 ======
function randomWordString() {
  let type = int(random(3)); // 0:ひらがな, 1:カタカナ, 2:アルファベット
  let len = int(random(1, 7));
  let list = hiraList;
  if (type == 1) list = kataList;
  if (type == 2) list = abcList;
  let str = "";
  for (let i = 0; i < len; i++) {
    str += random(list);
  }
  return str;
}

// ====== セットアップ ======
function setup() {
  // === [1] キャンバスサイズをwindowに合わせて作る ===
  resizeCanvasToFit();

  // === [2] 色リストを初期化 ===
  rainbowColors = [
    color(255, 60, 60),    // 赤
    color(255, 120, 30),   // 橙
    color(255, 220, 0),    // 黄
    color(100, 200, 100),  // 緑
    color(80, 180, 200),   // 水色
    color(70, 90, 240),    // 青
    color(170, 90, 240)    // 紫
  ];

  // === [3] 葉っぱ配列を初期化 ===
  leaves = [];  // ←※配列リセット
  for (let i = 0; i < 15; i++) {
    leaves.push(new Leaf());
  }

  // === [4] テキスト設定 ===
  textFont("serif");
  textAlign(CENTER, CENTER);
}

// ====== ウィンドウリサイズ時 ======
function windowResized() {
  setup(); // ←「サイズ変化したら全部作り直す」でOK！
}

// ====== アスペクト比を維持してキャンバスサイズ調整 ======
function resizeCanvasToFit() {
  let imgAspect = bgImg.width / bgImg.height;
  let winAspect = windowWidth / windowHeight;
  let w, h;
  if (winAspect > imgAspect) {
    h = windowHeight;
    w = h * imgAspect;
  } else {
    w = windowWidth;
    h = w / imgAspect;
  }
  createCanvas(w, h); // ←注意: resizeCanvasじゃなく「createCanvas」！
}

// ====== メイン描画 ======
function draw() {
  // === 背景 ===
  background(245, 250, 255); // 万一画像ない時用
  image(bgImg, 0, 0, width, height); // ぴったり貼り付け

  // === 葉っぱ ===
  for (let leaf of leaves) {
    leaf.update();
    leaf.display();
    leaf.updateWord();
    leaf.displayWord();
  }
}

// ====== 葉っぱクラス ======
class Leaf {
  constructor() { this.reset(); }
  reset() {
    this.x = random(width);
    this.y = random(-100, -20);
    this.size = random(25, 40);
    this.speed = random(0.5, 1.5);
    this.angle = random(TWO_PI);
    this.swing = random(0.5, 4);
    this.color = random(rainbowColors);
    this.reachedGround = false;
    this.leafAlpha = 255;
    this.word = randomWordString();
    this.wordAlpha = 0;
    this.wordY = this.y;
    this.wordState = 0;
    this.wordTimer = 0;
    this.wordColor = color(random(60, 200), random(60, 200), random(60, 200));
    this.wordFont = random(wordFonts);
  }
  update() {
    if (!this.reachedGround) {
      this.y += this.speed;
      this.angle += 0.05;
      this.x += sin(this.angle) * this.swing;
      if (this.y > height - 20) {
        this.reachedGround = true;
        this.leafAlpha = 255;
        this.wordAlpha = 0;
        this.wordY = this.y;
        this.wordState = 0;
        this.wordTimer = 0;
      }
    } else if (this.leafAlpha > 0) {
      this.leafAlpha -= 4;
      if (this.leafAlpha <= 0) {
        this.wordState = 1;
        this.wordAlpha = 0;
      }
    }
  }
  display() {
    if (this.reachedGround && this.leafAlpha > 0) {
      push();
      translate(this.x, this.y);
      rotate(sin(this.angle) * 0.5);
      scale(this.size / 20);
      fill(red(this.color), green(this.color), blue(this.color), this.leafAlpha);
      noStroke();
      beginShape();
      vertex(0, 0);
      bezierVertex(10, -15, 10, -30, 0, -40);
      bezierVertex(-10, -30, -10, -15, 0, 0);
      endShape(CLOSE);
      pop();
    }
    if (!this.reachedGround) {
      push();
      translate(this.x, this.y);
      rotate(sin(this.angle) * 0.5);
      scale(this.size / 20);
      fill(this.color);
      noStroke();
      beginShape();
      vertex(0, 0);
      bezierVertex(10, -15, 10, -30, 0, -40);
      bezierVertex(-10, -30, -10, -15, 0, 0);
      endShape(CLOSE);
      pop();
    }
  }
  updateWord() {
    if (this.wordState == 1) {
      if (this.wordAlpha < 255) {
        this.wordAlpha += 10;
        this.wordY -= 0.2;
      } else {
        this.wordAlpha = 255;
        this.wordState = 2;
        this.wordTimer = 0;
      }
    } else if (this.wordState == 2) {
      this.wordTimer++;
      if (this.wordTimer > 0) {
        this.wordAlpha -= 3;
        this.wordY -= 1.0;
        if (this.wordAlpha <= 0) {
          this.reset();
        }
      }
    }
  }
  displayWord() {
    if (this.reachedGround && this.wordAlpha > 0) {
      fill(
        red(this.wordColor),
        green(this.wordColor),
        blue(this.wordColor),
        this.wordAlpha
      );
      textFont(this.wordFont);
      textSize(100)
      text(this.word, this.x, this.wordY);
    }
  }
}
