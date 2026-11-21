import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { gameAudio } from '../../utils/gameAudio';

type GamePhase = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'GAME_OVER';
type GameMode = 'campaign' | 'endless';

interface HudSnapshot {
  score: number;
  wave: number;
  maxWaves: number;
  coreHp: number;
  combo: number;
  dashPct: number;
  kills: number;
  bestCombo: number;
  waveBanner: string | null;
}

interface Enemy {
  id: number;
  kind: 'drone' | 'sniffer' | 'brute';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  flashTimer: number;
  squash: number;
  stateTimer: number;
  telegraphTimer: number;
  aimAngle: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  fromPlayer: boolean;
  life: number;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

const BACKDROP_SRC = '/src/assets/images/game_sentinel_backdrop_1795259193782.jpg';
const PARTICLE_POOL_SIZE = 160;
const CAMPAIGN_WAVES = 5;

export const RelaySentinelGame: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const [phase, setPhase] = useState<GamePhase>('TITLE_MENU');
  const [mode, setMode] = useState<GameMode>('campaign');
  const [muted, setMuted] = useState(false);
  const [backdropFailed, setBackdropFailed] = useState(false);
  const [hud, setHud] = useState<HudSnapshot>({
    score: 0,
    wave: 1,
    maxWaves: CAMPAIGN_WAVES,
    coreHp: 100,
    combo: 1,
    dashPct: 100,
    kills: 0,
    bestCombo: 1,
    waveBanner: null,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<GamePhase>('TITLE_MENU');
  const modeRef = useRef<GameMode>('campaign');
  phaseRef.current = phase;
  modeRef.current = mode;

  // Mutable simulation state isolated from React renders
  const simRef = useRef({
    width: 1280,
    height: 720,
    coreX: 640,
    coreY: 360,
    coreHp: 100,
    coreFlash: 0,
    corePulse: 0,
    playerX: 640,
    playerY: 460,
    playerVx: 0,
    playerVy: 0,
    playerAngle: -Math.PI / 2,
    playerSquash: 1,
    dashCooldown: 0,
    dashActiveTimer: 0,
    dashBuffered: 0,
    fireCooldown: 0,
    score: 0,
    combo: 1,
    comboTimer: 0,
    bestCombo: 1,
    kills: 0,
    wave: 1,
    waveKillsNeeded: 8,
    waveKillsDone: 0,
    spawnTimer: 0.6,
    waveBannerTimer: 0,
    waveBannerText: '' as string | null,
    hitstopTimer: 0,
    shakeTrauma: 0,
    elapsed: 0,
    nextEnemyId: 1,
    enemies: [] as Enemy[],
    bullets: [] as Bullet[],
    particles: Array.from({ length: PARTICLE_POOL_SIZE }, (): Particle => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 2,
      color: '#22d3ee',
    })),
    heldKeys: new Set<string>(),
    pointerX: 640,
    pointerY: 260,
    pointerDown: false,
    lastHudSync: {
      score: -1,
      wave: -1,
      coreHp: -1,
      combo: -1,
      dashPct: -1,
      kills: -1,
      waveBanner: null as string | null,
    },
  });

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      gameAudio.setMuted(next);
      return next;
    });
  }, []);

  const spawnParticleBurst = useCallback(
    (x: number, y: number, color: string, count: number, speed = 180) => {
      const pool = simRef.current.particles;
      let spawned = 0;
      for (let i = 0; i < pool.length && spawned < count; i++) {
        if (!pool[i].active) {
          const angle = Math.random() * Math.PI * 2;
          const mag = speed * (0.35 + Math.random() * 0.85);
          pool[i].active = true;
          pool[i].x = x;
          pool[i].y = y;
          pool[i].vx = Math.cos(angle) * mag;
          pool[i].vy = Math.sin(angle) * mag;
          pool[i].maxLife = 0.25 + Math.random() * 0.3;
          pool[i].life = pool[i].maxLife;
          pool[i].size = 1.8 + Math.random() * 2.6;
          pool[i].color = color;
          spawned++;
        }
      }
    },
    []
  );

  const resetAndStartGame = useCallback(
    (selectedMode?: GameMode) => {
      const activeMode = selectedMode || modeRef.current;
      if (selectedMode) setMode(selectedMode);
      const s = simRef.current;
      const w = window.innerWidth;
      const h = window.innerHeight;
      s.width = w;
      s.height = h;
      s.coreX = w / 2;
      s.coreY = h / 2;
      s.coreHp = 100;
      s.coreFlash = 0;
      s.corePulse = 0;
      s.playerX = w / 2;
      s.playerY = h / 2 + 110;
      s.playerVx = 0;
      s.playerVy = 0;
      s.playerAngle = -Math.PI / 2;
      s.playerSquash = 1;
      s.dashCooldown = 0;
      s.dashActiveTimer = 0;
      s.dashBuffered = 0;
      s.fireCooldown = 0;
      s.score = 0;
      s.combo = 1;
      s.comboTimer = 0;
      s.bestCombo = 1;
      s.kills = 0;
      s.wave = 1;
      s.waveKillsNeeded = 8;
      s.waveKillsDone = 0;
      s.spawnTimer = 0.4;
      s.waveBannerTimer = 1.8;
      s.waveBannerText = 'Wave 1 · Perimeter Active';
      s.hitstopTimer = 0;
      s.shakeTrauma = 0;
      s.elapsed = 0;
      s.enemies = [];
      s.bullets = [];
      s.heldKeys.clear();
      s.pointerDown = false;
      for (const pt of s.particles) pt.active = false;
      s.lastHudSync = {
        score: -1,
        wave: -1,
        coreHp: -1,
        combo: -1,
        dashPct: -1,
        kills: -1,
        waveBanner: null,
      };

      setHud({
        score: 0,
        wave: 1,
        maxWaves: activeMode === 'campaign' ? CAMPAIGN_WAVES : 999,
        coreHp: 100,
        combo: 1,
        dashPct: 100,
        kills: 0,
        bestCombo: 1,
        waveBanner: 'Wave 1 · Perimeter Active',
      });
      setPhase('PLAYING');
      gameAudio.playWaveClear();
    },
    []
  );

  // Input listeners: separated continuous held vs edge-triggered actions + blur cleanup
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      if (phaseRef.current === 'TITLE_MENU') {
        if (code === 'Enter' || code === 'Space') {
          e.preventDefault();
          resetAndStartGame();
        } else if (code === 'Escape') {
          onExit();
        }
        return;
      }

      if (code === 'KeyM') {
        toggleMute();
        return;
      }

      if (code === 'Escape') {
        e.preventDefault();
        if (phaseRef.current === 'PLAYING') {
          simRef.current.heldKeys.clear();
          simRef.current.pointerDown = false;
          setPhase('PAUSED');
        } else if (phaseRef.current === 'PAUSED') {
          setPhase('PLAYING');
        }
        return;
      }

      if (phaseRef.current !== 'PLAYING') return;

      if (
        code === 'Space' ||
        code === 'ArrowUp' ||
        code === 'ArrowDown' ||
        code === 'ArrowLeft' ||
        code === 'ArrowRight'
      ) {
        e.preventDefault();
      }

      if ((code === 'ShiftLeft' || code === 'ShiftRight') && !e.repeat) {
        simRef.current.dashBuffered = 0.14;
      }
      simRef.current.heldKeys.add(code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      simRef.current.heldKeys.delete(e.code);
    };

    const onBlur = () => {
      simRef.current.heldKeys.clear();
      simRef.current.pointerDown = false;
      if (phaseRef.current === 'PLAYING') {
        setPhase('PAUSED');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [onExit, resetAndStartGame, toggleMute]);

  // Isolated 60fps simulation & render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      simRef.current.width = w;
      simRef.current.height = h;
      simRef.current.coreX = w / 2;
      simRef.current.coreY = h / 2;
    };
    resize();
    window.addEventListener('resize', resize);

    let rafId = 0;
    let lastTime = performance.now();

    const spawnEnemy = () => {
      const s = simRef.current;
      const edge = Math.floor(Math.random() * 4);
      let x = 0;
      let y = 0;
      const margin = 36;
      if (edge === 0) {
        x = Math.random() * s.width;
        y = -margin;
      } else if (edge === 1) {
        x = s.width + margin;
        y = Math.random() * s.height;
      } else if (edge === 2) {
        x = Math.random() * s.width;
        y = s.height + margin;
      } else {
        x = -margin;
        y = Math.random() * s.height;
      }

      const roll = Math.random();
      let kind: Enemy['kind'] = 'drone';
      if (s.wave >= 2 && roll > 0.62 && roll <= 0.88) kind = 'sniffer';
      if (s.wave >= 3 && roll > 0.88) kind = 'brute';

      const hp = kind === 'brute' ? 4 + Math.floor(s.wave / 2) : kind === 'sniffer' ? 2 : 1;
      const radius = kind === 'brute' ? 22 : kind === 'sniffer' ? 15 : 12;

      s.enemies.push({
        id: s.nextEnemyId++,
        kind,
        x,
        y,
        vx: 0,
        vy: 0,
        radius,
        hp,
        maxHp: hp,
        flashTimer: 0,
        squash: 1.25,
        stateTimer: 1.2 + Math.random() * 1.1,
        telegraphTimer: 0,
        aimAngle: Math.atan2(s.coreY - y, s.coreX - x),
      });
    };

    const tick = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
      const s = simRef.current;

      if (phaseRef.current === 'PLAYING') {
        s.elapsed += dt;
        s.corePulse += dt * 2.1;
        if (s.coreFlash > 0) s.coreFlash = Math.max(0, s.coreFlash - dt * 3);
        if (s.shakeTrauma > 0) s.shakeTrauma = Math.max(0, s.shakeTrauma - dt * 2.8);
        if (s.waveBannerTimer > 0) {
          s.waveBannerTimer -= dt;
          if (s.waveBannerTimer <= 0) s.waveBannerText = null;
        }

        // Hitstop freeze frames on heavy impacts
        if (s.hitstopTimer > 0) {
          s.hitstopTimer -= dt;
        } else {
          // Combo decay
          if (s.combo > 1) {
            s.comboTimer -= dt;
            if (s.comboTimer <= 0) {
              s.combo = 1;
            }
          }

          // Input movement (held keys)
          let mx = 0;
          let my = 0;
          if (s.heldKeys.has('KeyW') || s.heldKeys.has('ArrowUp')) my -= 1;
          if (s.heldKeys.has('KeyS') || s.heldKeys.has('ArrowDown')) my += 1;
          if (s.heldKeys.has('KeyA') || s.heldKeys.has('ArrowLeft')) mx -= 1;
          if (s.heldKeys.has('KeyD') || s.heldKeys.has('ArrowRight')) mx += 1;
          const mLen = Math.hypot(mx, my);
          if (mLen > 0) {
            mx /= mLen;
            my /= mLen;
          }

          // Dash buffering
          if (s.dashCooldown > 0) s.dashCooldown = Math.max(0, s.dashCooldown - dt);
          if (s.dashBuffered > 0) s.dashBuffered = Math.max(0, s.dashBuffered - dt);
          if (s.dashActiveTimer > 0) s.dashActiveTimer = Math.max(0, s.dashActiveTimer - dt);

          if (s.dashBuffered > 0 && s.dashCooldown <= 0) {
            s.dashBuffered = 0;
            s.dashCooldown = 1.6;
            s.dashActiveTimer = 0.16;
            const dashDirX = mLen > 0 ? mx : Math.cos(s.playerAngle);
            const dashDirY = mLen > 0 ? my : Math.sin(s.playerAngle);
            s.playerVx = dashDirX * 780;
            s.playerVy = dashDirY * 780;
            s.playerSquash = 1.4;
            spawnParticleBurst(s.playerX, s.playerY, '#22d3ee', 14, 150);
            gameAudio.playDash();
          }

          if (s.dashActiveTimer <= 0) {
            const targetSpeed = 330;
            s.playerVx += (mx * targetSpeed - s.playerVx) * Math.min(1, dt * 14);
            s.playerVy += (my * targetSpeed - s.playerVy) * Math.min(1, dt * 14);
          }

          s.playerX = Math.max(24, Math.min(s.width - 24, s.playerX + s.playerVx * dt));
          s.playerY = Math.max(24, Math.min(s.height - 24, s.playerY + s.playerVy * dt));
          s.playerSquash += (1 - s.playerSquash) * Math.min(1, dt * 12);

          // Aim angle toward pointer
          s.playerAngle = Math.atan2(s.pointerY - s.playerY, s.pointerX - s.playerX);

          // Firing
          if (s.fireCooldown > 0) s.fireCooldown -= dt;
          const wantFire = s.pointerDown || s.heldKeys.has('Space');
          if (wantFire && s.fireCooldown <= 0) {
            s.fireCooldown = 0.14;
            const speed = 720;
            s.bullets.push({
              x: s.playerX + Math.cos(s.playerAngle) * 18,
              y: s.playerY + Math.sin(s.playerAngle) * 18,
              vx: Math.cos(s.playerAngle) * speed,
              vy: Math.sin(s.playerAngle) * speed,
              radius: 4,
              fromPlayer: true,
              life: 1.4,
            });
            s.playerSquash = 0.85;
            gameAudio.playLaser();
          }

          // Spawning enemies
          const activeCap = 6 + s.wave * 2;
          s.spawnTimer -= dt;
          if (s.spawnTimer <= 0 && s.enemies.length < activeCap) {
            spawnEnemy();
            s.spawnTimer = Math.max(0.42, 1.35 - s.wave * 0.14);
          }

          // Update bullets
          for (let i = s.bullets.length - 1; i >= 0; i--) {
            const b = s.bullets[i];
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.life -= dt;
            if (b.life <= 0 || b.x < -40 || b.x > s.width + 40 || b.y < -40 || b.y > s.height + 40) {
              s.bullets.splice(i, 1);
              continue;
            }

            if (b.fromPlayer) {
              let hit = false;
              for (let j = s.enemies.length - 1; j >= 0; j--) {
                const en = s.enemies[j];
                const dist = Math.hypot(b.x - en.x, b.y - en.y);
                if (dist <= en.radius + b.radius) {
                  en.hp -= 1;
                  en.flashTimer = 0.12;
                  en.squash = 1.32;
                  hit = true;
                  spawnParticleBurst(b.x, b.y, '#38bdf8', 6, 120);

                  if (en.hp <= 0) {
                    const isBrute = en.kind === 'brute';
                    const pts = (isBrute ? 120 : en.kind === 'sniffer' ? 65 : 35) * s.combo;
                    s.score += pts;
                    s.kills += 1;
                    s.waveKillsDone += 1;
                    s.combo = Math.min(12, s.combo + 1);
                    s.comboTimer = 3.2;
                    if (s.combo > s.bestCombo) s.bestCombo = s.combo;
                    if (isBrute) {
                      s.hitstopTimer = 0.055;
                      s.shakeTrauma = Math.min(1, s.shakeTrauma + 0.55);
                      s.coreHp = Math.min(100, s.coreHp + 8);
                    } else {
                      s.shakeTrauma = Math.min(1, s.shakeTrauma + 0.16);
                    }
                    const burstColor =
                      en.kind === 'brute' ? '#f43f5e' : en.kind === 'sniffer' ? '#a855f7' : '#f59e0b';
                    spawnParticleBurst(en.x, en.y, burstColor, isBrute ? 24 : 12, isBrute ? 240 : 170);
                    gameAudio.playImpact(isBrute);
                    s.enemies.splice(j, 1);
                  } else {
                    gameAudio.playImpact(false);
                  }
                  break;
                }
              }
              if (hit) s.bullets.splice(i, 1);
            } else {
              // Enemy projectile hitting Vault Core or non-dashing player
              const distCore = Math.hypot(b.x - s.coreX, b.y - s.coreY);
              if (distCore < 34 + b.radius) {
                s.coreHp = Math.max(0, s.coreHp - 8);
                s.coreFlash = 1;
                s.shakeTrauma = Math.min(1, s.shakeTrauma + 0.45);
                s.combo = 1;
                spawnParticleBurst(b.x, b.y, '#ef4444', 12, 160);
                gameAudio.playCoreHit();
                s.bullets.splice(i, 1);
              } else if (s.dashActiveTimer <= 0 && Math.hypot(b.x - s.playerX, b.y - s.playerY) < 14 + b.radius) {
                s.coreHp = Math.max(0, s.coreHp - 5);
                s.shakeTrauma = Math.min(1, s.shakeTrauma + 0.35);
                s.combo = 1;
                spawnParticleBurst(b.x, b.y, '#fb7185', 10, 150);
                gameAudio.playCoreHit();
                s.bullets.splice(i, 1);
              }
            }
          }

          // Update enemies
          for (let i = s.enemies.length - 1; i >= 0; i--) {
            const en = s.enemies[i];
            if (en.flashTimer > 0) en.flashTimer -= dt;
            en.squash += (1 - en.squash) * Math.min(1, dt * 10);

            const dxCore = s.coreX - en.x;
            const dyCore = s.coreY - en.y;
            const distCore = Math.max(1, Math.hypot(dxCore, dyCore));
            const angleCore = Math.atan2(dyCore, dxCore);

            if (en.kind === 'drone') {
              const spd = 105 + s.wave * 11;
              const weave = Math.sin(s.elapsed * 4 + en.id) * 0.45;
              en.vx = Math.cos(angleCore + weave) * spd;
              en.vy = Math.sin(angleCore + weave) * spd;
              en.x += en.vx * dt;
              en.y += en.vy * dt;
            } else if (en.kind === 'sniffer') {
              const orbitDist = 225;
              if (distCore > orbitDist && en.telegraphTimer <= 0) {
                en.x += Math.cos(angleCore) * 95 * dt;
                en.y += Math.sin(angleCore) * 95 * dt;
              } else {
                // Telegraph windup then fire bolt
                if (en.telegraphTimer > 0) {
                  en.telegraphTimer -= dt;
                  if (en.telegraphTimer <= 0) {
                    s.bullets.push({
                      x: en.x,
                      y: en.y,
                      vx: Math.cos(en.aimAngle) * 320,
                      vy: Math.sin(en.aimAngle) * 320,
                      radius: 5,
                      fromPlayer: false,
                      life: 2.4,
                    });
                    en.stateTimer = 2.1;
                    en.squash = 1.25;
                  }
                } else {
                  en.stateTimer -= dt;
                  en.x += -Math.sin(angleCore) * 45 * dt;
                  en.y += Math.cos(angleCore) * 45 * dt;
                  if (en.stateTimer <= 0) {
                    en.telegraphTimer = 0.75;
                    en.aimAngle = angleCore;
                  }
                }
              }
            } else {
              // Brute advances steadily
              const spd = 62 + s.wave * 6;
              en.x += Math.cos(angleCore) * spd * dt;
              en.y += Math.sin(angleCore) * spd * dt;
            }

            // Enemy reaching Vault Core
            if (distCore <= 34 + en.radius) {
              const dmg = en.kind === 'brute' ? 22 : 12;
              s.coreHp = Math.max(0, s.coreHp - dmg);
              s.coreFlash = 1;
              s.hitstopTimer = 0.04;
              s.shakeTrauma = Math.min(1, s.shakeTrauma + 0.6);
              s.combo = 1;
              spawnParticleBurst(en.x, en.y, '#f43f5e', 18, 210);
              gameAudio.playCoreHit();
              s.enemies.splice(i, 1);
            }
          }

          // Wave advancement
          if (s.waveKillsDone >= s.waveKillsNeeded) {
            if (modeRef.current === 'campaign' && s.wave >= CAMPAIGN_WAVES) {
              setPhase('VICTORY');
              gameAudio.playWaveClear();
            } else {
              s.wave += 1;
              s.waveKillsDone = 0;
              s.waveKillsNeeded = 8 + s.wave * 3;
              s.waveBannerText = `Wave ${s.wave} · Escalating Relay Traffic`;
              s.waveBannerTimer = 2.0;
              gameAudio.playWaveClear();
            }
          }

          if (s.coreHp <= 0) {
            setPhase('GAME_OVER');
          }
        }

        // Update pooled particles
        for (const pt of s.particles) {
          if (!pt.active) continue;
          pt.x += pt.vx * dt;
          pt.y += pt.vy * dt;
          pt.vx *= 0.94;
          pt.vy *= 0.94;
          pt.life -= dt;
          if (pt.life <= 0) pt.active = false;
        }

        // Throttled HUD sync only on changed integers
        const dashPct = Math.round(Math.max(0, Math.min(100, (1 - s.dashCooldown / 1.6) * 100)));
        const l = s.lastHudSync;
        if (
          l.score !== s.score ||
          l.wave !== s.wave ||
          l.coreHp !== s.coreHp ||
          l.combo !== s.combo ||
          l.dashPct !== dashPct ||
          l.kills !== s.kills ||
          l.waveBanner !== s.waveBannerText
        ) {
          l.score = s.score;
          l.wave = s.wave;
          l.coreHp = s.coreHp;
          l.combo = s.combo;
          l.dashPct = dashPct;
          l.kills = s.kills;
          l.waveBanner = s.waveBannerText;
          setHud({
            score: s.score,
            wave: s.wave,
            maxWaves: modeRef.current === 'campaign' ? CAMPAIGN_WAVES : 999,
            coreHp: s.coreHp,
            combo: s.combo,
            dashPct,
            kills: s.kills,
            bestCombo: s.bestCombo,
            waveBanner: s.waveBannerText,
          });
        }
      }

      // Render Arena Canvas
      const w = s.width;
      const h = s.height;
      ctx.save();
      ctx.fillStyle = '#070B14';
      ctx.fillRect(0, 0, w, h);

      // Subtle decaying screen shake
      if (s.shakeTrauma > 0) {
        const mag = s.shakeTrauma * s.shakeTrauma * 10;
        ctx.translate((Math.random() - 0.5) * mag * 2, (Math.random() - 0.5) * mag * 2);
      }

      // Arena grid lines
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
      ctx.lineWidth = 1;
      const gridStep = 64;
      for (let gx = (w / 2) % gridStep; gx < w; gx += gridStep) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = (h / 2) % gridStep; gy < h; gy += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      // Defensive Perimeter Ring
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.16)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(s.coreX, s.coreY, 225, 0, Math.PI * 2);
      ctx.stroke();

      // Central Watermark Vault Core
      ctx.save();
      ctx.translate(s.coreX, s.coreY);
      const coreScale = 1 + Math.sin(s.corePulse) * 0.03;
      ctx.scale(coreScale, coreScale);

      // Outer orbital shield arc
      ctx.strokeStyle = s.coreFlash > 0 ? '#f43f5e' : '#22d3ee';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 38, s.corePulse * 0.6, s.corePulse * 0.6 + (Math.PI * 2 * s.coreHp) / 100);
      ctx.stroke();

      // Inner Hexagon Vault
      ctx.fillStyle = s.coreFlash > 0 ? 'rgba(244, 63, 94, 0.35)' : 'rgba(14, 116, 144, 0.35)';
      ctx.strokeStyle = s.coreFlash > 0 ? '#fb7185' : '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const ang = (Math.PI / 3) * k - Math.PI / 6;
        const px = Math.cos(ang) * 24;
        const py = Math.sin(ang) * 24;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Enemies + Telegraph lines
      for (const en of s.enemies) {
        if (en.telegraphTimer > 0) {
          ctx.save();
          ctx.strokeStyle = `rgba(244, 63, 94, ${0.35 + (1 - en.telegraphTimer / 0.75) * 0.55})`;
          ctx.setLineDash([6, 6]);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(en.x, en.y);
          ctx.lineTo(en.x + Math.cos(en.aimAngle) * 380, en.y + Math.sin(en.aimAngle) * 380);
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();
        ctx.translate(en.x, en.y);
        ctx.scale(en.squash, 2 - en.squash);
        const fill =
          en.flashTimer > 0
            ? '#ffffff'
            : en.kind === 'brute'
              ? '#e11d48'
              : en.kind === 'sniffer'
                ? '#9333ea'
                : '#f59e0b';
        ctx.fillStyle = fill;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;

        const sides = en.kind === 'brute' ? 8 : en.kind === 'sniffer' ? 6 : 4;
        ctx.beginPath();
        for (let k = 0; k < sides; k++) {
          const ang = (Math.PI * 2 * k) / sides;
          const px = Math.cos(ang) * en.radius;
          const py = Math.sin(ang) * en.radius;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (en.kind === 'brute' && en.hp > 1) {
          ctx.strokeStyle = 'rgba(251, 113, 133, 0.85)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, en.radius + 5, 0, (Math.PI * 2 * en.hp) / en.maxHp);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Bullets
      for (const b of s.bullets) {
        ctx.fillStyle = b.fromPlayer ? '#38bdf8' : '#fb7185';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Player Sentinel Craft
      ctx.save();
      ctx.translate(s.playerX, s.playerY);
      ctx.rotate(s.playerAngle);
      ctx.scale(s.playerSquash, 2 - s.playerSquash);
      ctx.fillStyle = s.dashActiveTimer > 0 ? '#a5f3fc' : '#22d3ee';
      ctx.strokeStyle = '#083344';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-11, -11);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-11, 11);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Pooled particles
      for (const pt of s.particles) {
        if (!pt.active) continue;
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
      }
      ctx.globalAlpha = 1;

      ctx.restore();
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [spawnParticleBurst]);

  const coreStatusLabel =
    hud.coreHp > 60 ? 'STABLE' : hud.coreHp > 30 ? 'CAUTION' : 'CRITICAL';

  return (
    <div className="fixed inset-0 z-50 bg-[#070B14] text-slate-100 select-none overflow-hidden">
      {/* Isolated Canvas Viewport */}
      <canvas
        ref={canvasRef}
        onMouseMove={(e) => {
          simRef.current.pointerX = e.clientX;
          simRef.current.pointerY = e.clientY;
        }}
        onMouseDown={(e) => {
          if (e.button === 0 && phaseRef.current === 'PLAYING') {
            simRef.current.pointerDown = true;
          }
        }}
        onMouseUp={() => {
          simRef.current.pointerDown = false;
        }}
        onMouseLeave={() => {
          simRef.current.pointerDown = false;
        }}
        className="block w-full h-full cursor-crosshair"
      />

      {/* World-Matched, Low-Occlusion HUD (pointer-events-none, no backdrop-filter) */}
      {phase !== 'TITLE_MENU' && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-10 flex items-start justify-between p-4 sm:p-6">
          {/* Top-Left: Core Integrity + Wave */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 rounded-lg border border-cyan-500/30 bg-[#0B1120]/90 px-3.5 py-2">
              <svg width="20" height="20" viewBox="0 0 24 24" className="text-cyan-400 shrink-0" aria-hidden="true">
                <polygon
                  points="12,2 21,7 21,17 12,22 3,17 3,7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle cx="12" cy="12" r="3" fill="currentColor" />
              </svg>
              <div>
                <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
                  <span className="text-slate-300">CORE {hud.coreHp}/100</span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span
                    className={
                      hud.coreHp > 60
                        ? 'text-emerald-400'
                        : hud.coreHp > 30
                          ? 'text-amber-400'
                          : 'text-rose-400'
                    }
                  >
                    {coreStatusLabel}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-36 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-transform origin-left ${
                      hud.coreHp > 60
                        ? 'bg-cyan-400'
                        : hud.coreHp > 30
                          ? 'bg-amber-400'
                          : 'bg-rose-500'
                    }`}
                    style={{ width: `${hud.coreHp}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-[#0B1120]/90 px-3 py-1.5 text-xs font-mono tabular-nums text-slate-300 w-fit">
              <span>
                Wave {hud.wave}
                {mode === 'campaign' ? ` / ${hud.maxWaves}` : ' (Endless)'}
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>Intercepted {hud.kills}</span>
            </div>
          </div>

          {/* Wave Banner */}
          {hud.waveBanner && phase === 'PLAYING' && (
            <div className="hidden sm:block rounded-lg border border-cyan-500/40 bg-[#0B1120]/95 px-4 py-2 text-xs font-mono text-cyan-300">
              {hud.waveBanner}
            </div>
          )}

          {/* Top-Right: Score, Combo, Dash + Interactive Pause/Mute */}
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg border border-slate-800 bg-[#0B1120]/90 px-3.5 py-2 text-right font-mono tabular-nums">
              <p className="text-xs text-slate-400">
                Score <strong className="text-white text-sm ml-1">{hud.score}</strong>
              </p>
              <p className="text-[11px] text-cyan-400">
                Combo x{hud.combo} <span className="text-slate-600">·</span> Dash {hud.dashPct}%
              </p>
            </div>

            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? 'Unmute game sound effects' : 'Mute game sound effects'}
              className="pointer-events-auto rounded-lg border border-slate-700 bg-[#0B1120] p-2.5 text-slate-300 hover:text-white hover:border-cyan-500/50 transition-colors"
            >
              {muted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4 text-cyan-400" />}
            </button>

            <button
              type="button"
              onClick={() => setPhase(phase === 'PAUSED' ? 'PLAYING' : 'PAUSED')}
              aria-label="Pause game"
              className="pointer-events-auto rounded-lg border border-slate-700 bg-[#0B1120] p-2.5 text-slate-300 hover:text-white hover:border-cyan-500/50 transition-colors"
            >
              <Pause className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* TITLE SCREEN */}
      {phase === 'TITLE_MENU' && (
        <div className="fixed inset-0 z-20 flex items-center bg-[#070B14]">
          {!backdropFailed && (
            <img
              src={BACKDROP_SRC}
              alt="Relay Sentinel cryptographic vault defense key art"
              referrerPolicy="no-referrer"
              onError={() => setBackdropFailed(true)}
              className="absolute inset-0 h-full w-full object-cover opacity-85"
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(90deg, rgba(7,11,20,0.96) 0%, rgba(7,11,20,0.82) 38%, rgba(7,11,20,0.25) 100%)',
            }}
          />

          <div className="relative z-10 w-full max-w-xl px-8 sm:px-14 space-y-6">
            <button
              type="button"
              onClick={onExit}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Return to Workspace</span>
            </button>

            {/* Bespoke Inline SVG Title Lockup */}
            <div>
              <svg
                viewBox="0 0 420 92"
                className="w-full max-w-md h-auto"
                role="img"
                aria-label="Relay Sentinel"
              >
                <polygon
                  points="30,10 52,23 52,49 30,62 8,49 8,23"
                  fill="rgba(6,182,212,0.16)"
                  stroke="#22d3ee"
                  strokeWidth="2.5"
                />
                <polygon points="30,22 41,29 41,43 30,50 19,43 19,29" fill="#7c3aed" />
                <text
                  x="70"
                  y="44"
                  fill="#ffffff"
                  fontFamily="Plus Jakarta Sans, sans-serif"
                  fontWeight="700"
                  fontSize="30"
                  letterSpacing="1.5"
                >
                  RELAY SENTINEL
                </text>
                <text
                  x="72"
                  y="66"
                  fill="#22d3ee"
                  fontFamily="JetBrains Mono, monospace"
                  fontSize="11.5"
                  letterSpacing="2"
                >
                  VAULT PERIMETER DEFENSE
                </text>
              </svg>

              <p className="mt-2 text-sm text-slate-300 leading-relaxed max-w-md">
                Pilot the Sentinel interceptor around your Watermark Vault Core. Neutralize rogue leak drones, dodge spoofed sniffer volleys, and shatter Hash-Breaker brutes to restore core integrity.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setMode('campaign')}
                className={`rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  mode === 'campaign'
                    ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200'
                    : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
                }`}
              >
                Campaign (5 Waves)
              </button>
              <button
                type="button"
                onClick={() => setMode('endless')}
                className={`rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  mode === 'endless'
                    ? 'border-violet-400 bg-violet-500/15 text-violet-200'
                    : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
                }`}
              >
                Endless Relay
              </button>
              <button
                type="button"
                onClick={toggleMute}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-300 hover:text-white"
              >
                {muted ? <VolumeX className="h-3.5 w-3.5 text-rose-400" /> : <Volume2 className="h-3.5 w-3.5 text-cyan-400" />}
                <span>{muted ? 'Audio Muted' : 'Audio FX On'}</span>
              </button>
            </div>

            <div>
              <button
                type="button"
                onClick={() => resetAndStartGame(mode)}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-6 py-3 text-sm font-semibold text-white transition-colors whitespace-nowrap"
              >
                <Play className="h-4 w-4" />
                <span>Start Game</span>
              </button>
            </div>

            <p className="text-xs font-mono text-slate-400 pt-2 border-t border-slate-800/90">
              WASD / Arrows Move · Mouse Aim &amp; Click / Space Pulse · Shift Dash · Esc Pause
            </p>
          </div>
        </div>
      )}

      {/* PAUSE / VICTORY / GAME OVER MODAL */}
      {(phase === 'PAUSED' || phase === 'VICTORY' || phase === 'GAME_OVER') && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-[#0B1120] p-6 space-y-5">
            <div>
              <p className="text-xs font-mono text-cyan-400">
                {phase === 'PAUSED'
                  ? 'Simulation Paused'
                  : phase === 'VICTORY'
                    ? 'Vault Perimeter Secured'
                    : 'Core Integrity Depleted'}
              </p>
              <h2 className="mt-1 text-xl font-bold text-white">
                {phase === 'PAUSED'
                  ? 'Game Paused'
                  : phase === 'VICTORY'
                    ? 'Campaign Complete'
                    : 'Game Over'}
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-4 font-mono tabular-nums text-xs">
              <div>
                <p className="text-slate-400">Final Score</p>
                <p className="text-base font-semibold text-white mt-0.5">{hud.score}</p>
              </div>
              <div>
                <p className="text-slate-400">Wave Reached</p>
                <p className="text-base font-semibold text-cyan-400 mt-0.5">{hud.wave}</p>
              </div>
              <div>
                <p className="text-slate-400">Packets Intercepted</p>
                <p className="text-base font-semibold text-white mt-0.5">{hud.kills}</p>
              </div>
              <div>
                <p className="text-slate-400">Best Combo</p>
                <p className="text-base font-semibold text-violet-400 mt-0.5">x{hud.bestCombo}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {phase === 'PAUSED' && (
                <button
                  type="button"
                  onClick={() => setPhase('PLAYING')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-semibold text-white whitespace-nowrap"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>Resume</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => resetAndStartGame()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2 text-xs font-semibold text-white whitespace-nowrap"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Play Again</span>
              </button>

              <button
                type="button"
                onClick={() => setPhase('TITLE_MENU')}
                className="rounded-lg border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white whitespace-nowrap"
              >
                Title Screen
              </button>

              <button
                type="button"
                onClick={onExit}
                className="rounded-lg border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-white whitespace-nowrap"
              >
                Exit to Workspace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
