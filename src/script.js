if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js');
        }

// --- 定数 ---
        const CANVAS_WIDTH = 800;
        const CANVAS_HEIGHT = 600;
        const PLAYER_WIDTH = 50;
        const PLAYER_HEIGHT = 50;
        const PLAYER_SPEED = 7;
        const BULLET_WIDTH = 5;
        const BULLET_HEIGHT = 15;
        const BULLET_SPEED = 10;
        const ENEMY_HP = 2;
        const GAME_DURATION_SEC = 60;
        const SHOOT_AREA_Y_RATIO = 0.8;

        // 難易度設定
        const DIFFICULTY_SETTINGS = {
            easy: {
                speedMin: 0.8,
                speedMax: 1.5,
                spawnInterval: 1500,
                minSpawnInterval: 800,
                maxSpawnCount: 2,
                intervalReduction: 0.6,
                bossSpeed: 2.0
            },
            normal: {
                speedMin: 1.0,
                speedMax: 2.0,
                spawnInterval: 1200,
                minSpawnInterval: 600,
                maxSpawnCount: 3,
                intervalReduction: 0.75,
                bossSpeed: 2.5
            },
            hard: {
                speedMin: 1.3,
                speedMax: 2.5,
                spawnInterval: 1500,
                minSpawnInterval: 500,
                maxSpawnCount: 3,
                intervalReduction: 0.8,
                bossSpeed: 3.0
            },
            extreme: {
                speedMin: 1.8,
                speedMax: 3.0,
                spawnInterval: 1000,
                minSpawnInterval: 450,
                maxSpawnCount: 3,
                intervalReduction: 0.8,
                bossSpeed: 5.0
            }
        };

        // --- 敵リスト ---
        const ENEMY_TEXTS = [
            "1920農業集団化", "1959七カ年計画", "1950処女地開拓運動",
            "1970中央集権計画経済", "1979アフガン侵攻", "1986チェルノブイリ",
            "1980ペレストロイカ", "1980グラスノスチ"
        ];
        const ENEMY_FONT = 'bold 18px sans-serif';
        const ENEMY_COLOR = '#FFCCCC';

        // --- ボス設定 ---
        const BOSS_TEXT = "1991ソ連崩壊";
        const BOSS_HP = 20;
        const BOSS_FONT = 'bold 60px sans-serif';
        const BOSS_COLOR = '#FFFF00';

        // --- グローバル変数 ---
        let canvas, ctx;
        let player, bullets, enemies, boss;
        let gameRunning, bossPhase;
        let keys = {};
        let lastEnemySpawnTime = 0;
        let gameStartTime;
        let playerImage;
        let bgm, endBgm;
        let animationFrameId;
        let isBgmPlaying = true;
        let currentDifficulty = 'normal';

        // --- スマホ操作用 ---
        let touchMode = 'none';
        let canvasRect;

        // ▼▼▼ チート用追加 ▼▼▼
        let bgmClickCount = 0;
        let cheatEnabled = false;
        let isInvincible = false;
        let hasPenetration = false;
        let fastShoot = false;
        let noFallDefeat = false;
        // ▲▲▲ チート用追加 ▲▲▲

        // --- DOM要素 ---
        const startButton = document.getElementById('start-button');
        const scoreDisplay = document.getElementById('score');
        const overlay = document.getElementById('overlay');
        const gameContainer = document.getElementById('game-container');
        const bgmToggle = document.getElementById('bgm-toggle');
        const difficultySelect = document.getElementById('difficulty-select');
        const backButton = document.getElementById('back-button');

        let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        let shootButton;

        // --- 初期化 ---
        window.onload = () => {
            canvas = document.getElementById('gameCanvas');
            ctx = canvas.getContext('2d');
            canvas.width = CANVAS_WIDTH;
            canvas.height = CANVAS_HEIGHT;
            
            bgm = document.getElementById('bgm');
            endBgm = document.getElementById('end-bgm');
            
            playerImage = new Image();
            playerImage.src = 'player.png';
            
            playerImage.onerror = () => {
                console.warn("player.png が読み込めませんでした。代替の銀色四角形で描画します。");
            };

            scoreDisplay.textContent = `耐久時間: ${GAME_DURATION_SEC.toFixed(1)}秒`;
            startButton.addEventListener('click', showDifficultySelect);
            bgmToggle.addEventListener('click', toggleBGM);
            backButton.addEventListener('click', hideDifficultySelect);

            // 難易度ボタンのイベントリスナー
            document.querySelectorAll('.difficulty-button').forEach(button => {
                button.addEventListener('click', (e) => {
                    const difficulty = e.currentTarget.getAttribute('data-difficulty');
                    selectDifficulty(difficulty);
                });
            });

            // スマホ操作用のイベントリスナー
            setupTouchControls();

            shootButton = document.getElementById('shoot-button');
            if (isMobile) {
                shootButton.style.display = 'block';
                
                shootButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (gameRunning) shoot();
                });
            } else {
                shootButton.style.display = 'none';
            }
        };

        // --- 難易度選択画面表示 ---
        function showDifficultySelect() {
            difficultySelect.style.display = 'block';
            startButton.style.display = 'none';
        }

        function hideDifficultySelect() {
            difficultySelect.style.display = 'none';
            startButton.style.display = 'inline-block';
        }

        function selectDifficulty(difficulty) {
            currentDifficulty = difficulty;
            
            // チートフラグを一旦リセット
            isInvincible = false;
            hasPenetration = false;
            fastShoot = false;
            noFallDefeat = false;

            if (cheatEnabled && difficulty === 'extreme') {
                isInvincible = true;
                hasPenetration = true;
                fastShoot = true; // 弾速UPフラグ
                noFallDefeat = true;
                console.log("8月クーデター チート適用");
            }

            hideDifficultySelect();
            startGame();
        }

        // --- BGM ON/OFF切り替え ---
        function toggleBGM() {
            // ▼▼▼ チートカウンター ▼▼▼
            bgmClickCount++;
            if (bgmClickCount === 10) {
                cheatEnabled = true;
                console.log("隠しコマンド有効");
                // ユーザーにチート有効を通知
                overlay.textContent = "チート有効";
                overlay.style.color = '#FFFF00'; // 目立つ色
                overlay.style.display = 'block';
                // 1.5秒後に非表示（ゲームが始まっていなければ）
                setTimeout(() => {
                    if (!gameRunning) {
                        overlay.style.display = 'none';
                    }
                }, 1500);
            }

            if (isBgmPlaying) {
                bgm.pause();
                isBgmPlaying = false;
                bgmToggle.textContent = 'BGM: OFF';
            } else {
                bgm.play().catch(e => console.error("BGM再生エラー:", e)); 
                isBgmPlaying = true;
                bgmToggle.textContent = 'BGM: ON';
            }
        }

        // --- ゲーム開始 ---
        function startGame() {
            player = {
                x: (CANVAS_WIDTH - PLAYER_WIDTH) / 2,
                y: CANVAS_HEIGHT - PLAYER_HEIGHT - 10,
                width: PLAYER_WIDTH,
                height: PLAYER_HEIGHT,
                speed: PLAYER_SPEED
            };
            bullets = [];
            enemies = [];
            boss = null;
            gameRunning = true;
            bossPhase = false;
            lastEnemySpawnTime = 0;
            gameStartTime = Date.now();
            keys = {};
            touchMode = 'none';
            scoreDisplay.textContent = `耐久時間: ${GAME_DURATION_SEC.toFixed(1)}秒`;
            overlay.style.display = 'none';
            startButton.style.display = 'inline-block';

            if (isMobile) {
                shootButton.style.display = 'block';
            }

            endBgm.pause();
            endBgm.currentTime = 0;
            
            if (isBgmPlaying) {
                bgm.currentTime = 0;
                bgm.play().catch(e => console.error("BGM再生エラー:", e));
            }

            document.addEventListener('keydown', handleKeyDown);
            document.addEventListener('keyup', handleKeyUp);

            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            gameLoop(0);
        }

        // --- キー入力ハンドラ ---
        function handleKeyDown(e) {
            keys[e.code] = true;
            if (e.code === 'Space' && gameRunning) {
                e.preventDefault();
                shoot();
            }
        }
        function handleKeyUp(e) {
            keys[e.code] = false;
        }

        // --- スマホ操作ハンドラ ---
        function setupTouchControls() {
            canvasRect = canvas.getBoundingClientRect();
            window.addEventListener('resize', () => {
                canvasRect = canvas.getBoundingClientRect();
            });

            canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
            canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
            canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
        }

        function handleTouchStart(e) {
            if (!gameRunning) return;
            e.preventDefault();
            
            const touch = e.touches[0];
            
            canvasRect = canvas.getBoundingClientRect();
            const scaleX = CANVAS_WIDTH / canvasRect.width;
            const relativeX = touch.clientX - canvasRect.left;
            const internalX = relativeX * scaleX;

            touchMode = 'move';
            updatePlayerPosition(internalX);
        }

        function handleTouchMove(e) {
            if (!gameRunning || touchMode !== 'move') return;
            e.preventDefault();
            
            const touch = e.touches[0];
            
            canvasRect = canvas.getBoundingClientRect();
            const scaleX = CANVAS_WIDTH / canvasRect.width;
            const relativeX = touch.clientX - canvasRect.left;
            const internalX = relativeX * scaleX;
            
            updatePlayerPosition(internalX);
        }

        function handleTouchEnd(e) {
            if (!gameRunning) return;
            e.preventDefault();
            touchMode = 'none';
        }

        function updatePlayerPosition(internalX) {
            player.x = internalX - player.width / 2;
            if (player.x < 0) player.x = 0;
            if (player.x > CANVAS_WIDTH - player.width) {
                player.x = CANVAS_WIDTH - player.width;
            }
        }

        // --- 弾発射 ---
        function shoot() {
            const bullet = {
                x: player.x + (PLAYER_WIDTH - BULLET_WIDTH) / 2,
                y: player.y,
                width: BULLET_WIDTH,
                height: BULLET_HEIGHT,
                // speed: BULLET_SPEED // 変更前
                speed: fastShoot ? BULLET_SPEED * 3 : BULLET_SPEED //チート
            };
            bullets.push(bullet);
        }

        // --- 敵生成 ---
        function spawnEnemy() {
            const settings = DIFFICULTY_SETTINGS[currentDifficulty];
            const text = ENEMY_TEXTS[Math.floor(Math.random() * ENEMY_TEXTS.length)];
            ctx.font = ENEMY_FONT;
            const textMetrics = ctx.measureText(text);
            const textWidth = textMetrics.width;
            const textHeight = 18;
            
            const enemy = {
                x: Math.random() * Math.max(0, CANVAS_WIDTH - textWidth),
                y: -textHeight,
                text: text,
                speed: settings.speedMin + Math.random() * (settings.speedMax - settings.speedMin),
                width: textWidth,
                height: textHeight,
                maxHp: ENEMY_HP,
                hp: ENEMY_HP
            };
            enemies.push(enemy);
        }

        function spawnEnemies(count) {
            for (let i = 0; i < count; i++) {
                spawnEnemy();
            }
        }

        // --- 更新処理 (メイン) ---
        function update(timestamp) {
            if (!gameRunning) return;

            // プレイヤー移動 (キーボード)
            if (keys['ArrowLeft'] || keys['KeyA']) {
                player.x -= player.speed;
                if (player.x < 0) player.x = 0;
            }
            if (keys['ArrowRight'] || keys['KeyD']) {
                player.x += player.speed;
                if (player.x > CANVAS_WIDTH - player.width) {
                    player.x = CANVAS_WIDTH - player.width;
                }
            }

            updateBullets();

            if (bossPhase) {
                updateBoss();
            } else {
                updateEnemies(timestamp);
                updateTimer();
            }
        }
        
        function updateBullets() {
            for (let i = bullets.length - 1; i >= 0; i--) {
                bullets[i].y -= bullets[i].speed;
                if (bullets[i].y < -BULLET_HEIGHT) {
                    bullets.splice(i, 1);
                }
            }
        }

        function updateEnemies(timestamp) {
            // 通常時の雑魚敵更新
            for (let i = enemies.length - 1; i >= 0; i--) {
                const enemy = enemies[i];
                enemy.y += enemy.speed;

                if (enemy.y > CANVAS_HEIGHT) {
                    // ▼▼▼ 変更後 (チート対応) ▼▼▼
                    if (!noFallDefeat) {
                        gameOver("失敗！ 政策が露見した！");
                        return;
                    } else {
                        enemies.splice(i, 1); // チート時は消すだけ
                    }
                    // ▲▲▲ 変更後 ▲▲▲
                }
                if (checkCollision(player, enemy)) {
                    // ▼▼▼ 変更後 (チート対応) ▼▼▼
                    if (!isInvincible) {
                        gameOver("失敗！ 責任を問われた！");
                        return;
                    }
                    // ▲▲▲ 変更後 ▲▲▲
                }
                for (let j = bullets.length - 1; j >= 0; j--) {
                    if (checkCollision(bullets[j], enemy)) {
                        
                        // ▼▼▼ 変更後 (チート対応) ▼▼▼
                        if (!hasPenetration) {
                            bullets.splice(j, 1);
                        }
                        // ▲▲▲ 変更後 ▲▲▲

                        enemy.hp--;
                        if (enemy.hp <= 0) {
                            enemies.splice(i, 1);
                        }
                        
                        //チート
                        if (!hasPenetration) {
                            break; 
                        }
                    }
                }
            }

            // 通常時の敵生成ロジック
            if (!bossPhase) {
                const settings = DIFFICULTY_SETTINGS[currentDifficulty];
                const elapsedSec = (Date.now() - gameStartTime) / 1000;
                const progress = Math.min(1, elapsedSec / GAME_DURATION_SEC);
                const spawnInterval = Math.max(
                    settings.minSpawnInterval, 
                    settings.spawnInterval * (1 - settings.intervalReduction * progress)
                );
                const spawnCount = 1 + Math.floor(progress * (settings.maxSpawnCount - 1));

                if (timestamp - lastEnemySpawnTime > spawnInterval) {
                    spawnEnemies(spawnCount);
                    lastEnemySpawnTime = timestamp;
                }
            }
        }

        function updateTimer() {
            const elapsedTime = (Date.now() - gameStartTime) / 1000;
            const remainingTime = Math.max(0, GAME_DURATION_SEC - elapsedTime);
            scoreDisplay.textContent = `耐久時間: ${remainingTime.toFixed(1)}秒`;

            if (remainingTime <= 0) {
                enterBossPhase();
            }
        }

        function enterBossPhase() {
            bossPhase = true;
            enemies = []; // 通常の敵をクリア
            scoreDisplay.textContent = "ラスボス出現！";
            
            const settings = DIFFICULTY_SETTINGS[currentDifficulty];
            ctx.font = BOSS_FONT;
            const metrics = ctx.measureText(BOSS_TEXT);
            boss = {
                text: BOSS_TEXT,
                x: (CANVAS_WIDTH - metrics.width) / 2,
                y: 100,
                width: metrics.width,
                height: 60,
                hp: BOSS_HP,
                maxHp: BOSS_HP,
                speedX: settings.bossSpeed
            };
            scoreDisplay.textContent = `ボスHP: ${boss.hp}`;
        }

        function updateBoss() {
            if (!boss) return;

            // ボス本体の移動
            boss.x += boss.speedX;
            if (boss.x < 0 || boss.x + boss.width > CANVAS_WIDTH) {
                boss.speedX *= -1;
                boss.x = Math.max(0, Math.min(boss.x, CANVAS_WIDTH - boss.width));
            }

            // ボスが生存中、ランダムに「共和国離反」を生成
            if (Math.random() < 0.03) { // 3%の確率で生成
                const text = "共和国離反";
                ctx.font = ENEMY_FONT;
                const metrics = ctx.measureText(text);
                const enemy = {
                    x: Math.random() * (CANVAS_WIDTH - metrics.width),
                    y: -30,
                    text: text,
                    speed: 3,
                    width: metrics.width,
                    height: 18,
                    maxHp: 1,
                    hp: 1
                };
                enemies.push(enemy); // enemies 配列に追加
            }

            // ボスフェーズ中の雑魚敵（共和国離反）の更新処理
            // updateEnemies() を流用すると通常時の敵生成ロジックが動いてしまうため、
            // 雑魚敵の更新部分だけを別途実行する
            for (let i = enemies.length - 1; i >= 0; i--) {
                const enemy = enemies[i];
                enemy.y += enemy.speed;
                if (enemy.y > CANVAS_HEIGHT) {
                    if (!noFallDefeat) {
                        gameOver("失敗！ 政策が露見した！");
                        return;
                    } else {
                        enemies.splice(i, 1); // チート時は消すだけ
                    }
                }
                if (checkCollision(player, enemy)) {
                    //チート
                    if (!isInvincible) {
                        gameOver("失敗！ 責任を問われた！");
                        return;
                    }
                }
                for (let j = bullets.length - 1; j >= 0; j--) {
                    if (checkCollision(bullets[j], enemy)) {
                        //チート
                        if (!hasPenetration) {
                            bullets.splice(j, 1);
                        }

                        enemy.hp--;
                        if (enemy.hp <= 0) {
                            enemies.splice(i, 1);
                        }
                        
                        if (!hasPenetration) {
                            break;
                        }
                    }
                }
            }

            // ボスとプレイヤーの当たり判定
            if (checkCollision(player, boss)) {
                //チート
                if (!isInvincible) {
                    gameOver("失敗！ 崩壊に巻き込まれた！");
                    return;
                }
            }

            // ボスと弾の当たり判定
            for (let j = bullets.length - 1; j >= 0; j--) {
                if (checkCollision(bullets[j], boss)) {
                    //チート
                    if (!hasPenetration) {
                        bullets.splice(j, 1);
                    }

                    boss.hp--;
                    
                    if (boss.hp <= 0) {
                        scoreDisplay.textContent = "ボスHP: 0";
                        gameWin("勝利！ 歴史を改変した！");
                        return;
                    }
                    scoreDisplay.textContent = `ボスHP: ${boss.hp}`;
                    
                    if (!hasPenetration) {
                        break;
                    }
                }
            }
        }
        
        function checkCollision(rect1, rect2) {
            return rect1.x < rect2.x + rect2.width &&
                   rect1.x + rect1.width > rect2.x &&
                   rect1.y < rect2.y + rect2.height &&
                   rect1.y + rect1.height > rect2.y;
        }

        // --- 描画処理 ---
        function draw() {
            ctx.fillStyle = '#660000';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

            // プレイヤー描画
            if (playerImage.complete && playerImage.naturalWidth !== 0) {
                ctx.drawImage(playerImage, player.x, player.y, player.width, player.height);
            } else {
                ctx.fillStyle = 'silver';
                ctx.fillRect(player.x, player.y, player.width, player.height);
            }

            // 弾描画
            ctx.fillStyle = '#FFFF00';
            for (const bullet of bullets) {
                ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
            }

            // 雑魚敵の描画 (通常時もボスフェーズ時も実行)
            ctx.fillStyle = ENEMY_COLOR;
            ctx.font = ENEMY_FONT;
            ctx.textBaseline = 'top';
            for (const enemy of enemies) {
                ctx.fillText(enemy.text, enemy.x, enemy.y);
                const barW = Math.max(30, enemy.width);
                const barH = 6;
                let barX = enemy.x;
                let barY = enemy.y - barH - 6;
                if (barY < 0) barY = enemy.y + enemy.height + 4;
                ctx.fillStyle = '#330000';
                ctx.fillRect(barX, barY, barW, barH);
                const ratio = Math.max(0, enemy.hp / enemy.maxHp);
                ctx.fillStyle = '#55FF55';
                ctx.fillRect(barX, barY, barW * ratio, barH);
                ctx.strokeStyle = '#000';
                ctx.strokeRect(barX, barY, barW, barH);
            }

            // ボスの描画 (ボスフェーズ中のみ実行)
            if (bossPhase && boss) {
                ctx.fillStyle = BOSS_COLOR;
                ctx.font = BOSS_FONT;
                ctx.textBaseline = 'top';
                ctx.fillText(boss.text, boss.x, boss.y);
                const bossBarW = boss.width;
                const bossBarH = 12;
                const bossBarX = boss.x;
                let bossBarY = boss.y - bossBarH - 8;
                if (bossBarY < 0) bossBarY = boss.y + boss.height + 8;
                ctx.fillStyle = '#330000';
                ctx.fillRect(bossBarX, bossBarY, bossBarW, bossBarH);
                const bossRatio = Math.max(0, boss.hp / boss.maxHp);
                ctx.fillStyle = '#55FF55';
                ctx.fillRect(bossBarX, bossBarY, bossBarW * bossRatio, bossBarH);
                ctx.strokeStyle = '#000';
                ctx.strokeRect(bossBarX, bossBarY, bossBarW, bossBarH);
            }
            // --- 修正ここまで (元の else ブロックは削除) ---
        }

        // --- メインループ ---
        function gameLoop(timestamp) {
            if (!gameRunning) return; 

            update(timestamp);
            draw();

            animationFrameId = requestAnimationFrame(gameLoop);
        }

        // --- ゲームオーバー / クリア処理 ---
        function stopGame() {
            gameRunning = false;
            cancelAnimationFrame(animationFrameId);
            bgm.pause();
            endBgm.currentTime = 0;
            endBgm.play().catch(e => console.error("終了BGM再生エラー:", e));
            
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);

            if (isMobile) {
                shootButton.style.display = 'none';
            }
        }

        function gameOver(message) {
            stopGame();
            overlay.textContent = message;
            overlay.style.color = '#FF5555';
            overlay.style.display = 'block';
            startButton.textContent = 'リトライ';
        }

        function gameWin(message) {
            stopGame();
            overlay.textContent = message;
            overlay.style.color = '#55FF55';
            overlay.style.display = 'block';
            startButton.textContent = 'もう一度プレイ';
        }
