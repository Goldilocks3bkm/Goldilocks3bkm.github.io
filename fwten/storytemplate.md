<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>小説タイトル - 第1話</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif;
            line-height: 1.8;
            color: #333;
            background-color: #fafafa;
            padding: 20px 0;
        }

        /* メインコンテナ - 幅調整はここで */
        .container {
            max-width: 680px; /* メイン幅調整：600px〜800px程度がおすすめ */
            margin: 0 auto;
            padding: 0 20px;
        }

        /* 記事ヘッダー */
        .article-header {
            background: white;
            padding: 40px;
            margin-bottom: 2px;
            border-radius: 8px 8px 0 0;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .article-title {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 8px;
            color: #1a1a1a;
        }

        .article-subtitle {
            font-size: 18px;
            color: #666;
            margin-bottom: 20px;
        }

        .article-meta {
            font-size: 14px;
            color: #888;
            display: flex;
            gap: 16px;
        }

        /* メインコンテンツエリア */
        .article-content {
            background: white;
            padding: 40px; /* 内側の余白調整 */
            border-radius: 0 0 8px 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            min-height: 500px; /* 最小の高さ調整 */
        }

        /* 小説テキストのスタイル */
        .novel-text {
            font-size: 16px; /* 文字サイズ調整：14px〜18px */
            line-height: 2.0; /* 行間調整：1.6〜2.2 */
            color: #2c2c2c;
            max-width: 100%; /* 一行の最大幅制御 */
            word-wrap: break-word;
        }

        /* 段落スタイル */
        .novel-text p {
            margin-bottom: 1.5em; /* 段落間の空白調整 */
            text-indent: 1em; /* 段落の字下げ：0〜1.5em */
        }

        /* 会話文のスタイル（「」で囲まれた部分） */
        .novel-text .dialogue {
            margin-left: 1em;
            position: relative;
        }

        /* 章区切りなどの区切り線 */
        .section-break {
            text-align: center;
            margin: 3em 0;
            font-size: 18px;
            color: #999;
        }

        /* 画像スタイル（マークダウン用） */
        .novel-text img {
            max-width: 100%;
            height: auto;
            margin: 2em 0;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            display: block;
            margin-left: auto;
            margin-right: auto; /* 中央寄せ */
        }

        /* 画像のキャプション（alt textが表示される場合） */
        .novel-text img[alt]:after {
            content: attr(alt);
            display: block;
            text-align: center;
            font-size: 14px;
            color: #666;
            margin-top: 8px;
            font-style: italic;
        }

        /* ナビゲーション */
        .navigation {
            margin-top: 40px;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .nav-link {
            color: #007acc;
            text-decoration: none;
            font-weight: bold;
            padding: 8px 16px;
            border-radius: 4px;
            transition: background-color 0.2s;
        }

        .nav-link:hover {
            background-color: #f0f8ff;
        }

        .nav-link.disabled {
            color: #ccc;
            pointer-events: none;
        }

        /* レスポンシブ対応 */
        @media (max-width: 768px) {
            .container {
                padding: 0 16px;
            }
            
            .article-header,
            .article-content {
                padding: 24px;
            }
            
            .article-title {
                font-size: 24px;
            }
            
            .novel-text {
                font-size: 15px;
                line-height: 1.9;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- 記事ヘッダー -->
        <header class="article-header">
            <h1 class="article-title">夏の終わりの物語</h1>
            <h2 class="article-subtitle">第1話「始まりの日」</h2>
            <div class="article-meta">
                <span>2024年8月6日</span>
                <span>約3分で読めます</span>
                <span>3,200文字</span>
            </div>
        </header>

        <!-- メインコンテンツ -->
        <main class="article-content">
            <div class="novel-text">
                <p>夏の終わりが近づいた八月のある日、私は久しぶりに故郷の町を訪れた。駅から続く商店街は、子供の頃の記憶よりもずいぶんと寂しくなっていて、シャッターを閉ざした店も目立つ。</p>

                <p>それでも変わらずそこにあるものもある。角の本屋、昔ながらの和菓子店、そして小さな公園。ベンチに腰を下ろしながら、私は十年前のことを思い出していた。</p>

                <p>「お疲れさま」</p>

                <p>突然声をかけられて振り返ると、見覚えのある顔がそこにあった。</p>

                <p>「田中さん？」</p>

                <p>「久しぶりだね。もう十年になるのか」</p>

                <p>彼女は昔と変わらない穏やかな笑顔を浮かべながら、私の隣に座った。夏の日差しが木漏れ日となって、私たちの間に柔らかい光を落としている。</p>

                <div class="section-break">◆ ◆ ◆</div>

                <p>あの夏の日のことを、私たちは決して忘れることはできないだろう。それは終わりの始まりであり、同時に新しい何かの始まりでもあった。</p>

                <p>「覚えてる？あの時の約束」</p>

                <p>「もちろん」</p>

                <p>私は頷きながら答える。風が頬を撫でて、どこか懐かしい香りが漂ってきた。</p>

                <p>時間はゆっくりと過ぎていく。私たちは多くを語らなかったが、その沈黙は心地よく、まるで昔に戻ったかのような感覚だった。</p>

                <p>やがて夕暮れが近づき、空が徐々にオレンジ色に染まり始める。</p>

                <p>「そろそろ帰らなくちゃ」</p>

                <p>「そうだね」</p>

                <p>私たちは立ち上がり、それぞれの道へと向かった。振り返ると、彼女は小さく手を振っていた。その姿が夕日に溶けていくのを見ながら、私は新しい季節の始まりを感じていた。</p>
            </div>
        </main>

        <!-- ナビゲーション -->
        <nav class="navigation">
            <a href="#" class="nav-link disabled">← 前の話</a>
            <a href="index.html" class="nav-link">目次に戻る</a>
            <a href="#" class="nav-link">次の話 →</a>
        </nav>
    </div>
</body>
</html>