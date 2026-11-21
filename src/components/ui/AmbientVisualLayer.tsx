import React, { useEffect, useRef } from 'react';
import { useSystem } from '../../context/SystemContext';
import { ambientBgm } from '../../utils/ambientBgm';

export const AmbientVisualLayer: React.FC = () => {
  const { state } = useSystem();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const p = state?.settings.personalization;
  const particlesEnabled = Boolean(
    p &&
      p.ambientEffects.particles &&
      !p.reducedMotion &&
      p.animationIntensity !== 'none'
  );
  const gradientEnabled = Boolean(
    p && p.ambientEffects.gradientMovement && !p.reducedMotion && p.animationIntensity !== 'none'
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !particlesEnabled) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const count = p?.animationIntensity === 'expressive' ? 38 : 20;
    const speedFactor = p?.animationIntensity === 'expressive' ? 0.35 : 0.18;

    const nodes = Array.from({ length: count }).map((_, idx) => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * speedFactor,
      vy: (Math.random() - 0.5) * speedFactor,
      r: 1.2 + (idx % 3) * 0.6,
      tone: idx % 2 === 0 ? '6, 182, 212' : '124, 58, 237',
    }));

    const tick = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0) n.x = window.innerWidth;
        if (n.x > window.innerWidth) n.x = 0;
        if (n.y < 0) n.y = window.innerHeight;
        if (n.y > window.innerHeight) n.y = 0;

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${n.tone}, 0.22)`;
        ctx.fill();
      }
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [particlesEnabled, p?.animationIntensity]);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      {gradientEnabled && (
        <div
          className="absolute -top-40 -right-40 h-96 w-96 rounded-full opacity-20 dark:opacity-15 blur-3xl transition-transform duration-1000"
          style={{
            background:
              'radial-gradient(circle, rgba(6,182,212,0.45) 0%, rgba(124,58,237,0.22) 50%, transparent 75%)',
          }}
        />
      )}
      {particlesEnabled && <canvas ref={canvasRef} className="h-full w-full block" />}
    </div>
  );
};

export const AmbientAudioVisualizer: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { state } = useSystem();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const p = state?.settings.personalization;
  const enabled = Boolean(p?.ambientEffects.visualizer && !p?.reducedMotion);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const buffer = new Uint8Array(32);
    let animId = 0;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const active = ambientBgm.getFrequencyData(buffer);
      const bars = 24;
      const barWidth = Math.max(3, Math.floor((w - (bars - 1) * 3) / bars));

      for (let i = 0; i < bars; i++) {
        const val = active ? buffer[i % buffer.length] / 255 : 0.08;
        const barH = Math.max(3, Math.round(val * (h - 6)));
        const x = i * (barWidth + 3);
        const y = h - barH;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(6, 182, 212, 0.78)' : 'rgba(139, 92, 246, 0.78)';
        ctx.fillRect(x, y, barWidth, barH);
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [enabled]);

  if (!enabled) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 h-14 text-[11px] text-slate-500 ${className}`}
      >
        Audio visualizer disabled (Reduced Motion or Preferences)
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={56}
      className={`w-full h-14 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-2 ${className}`}
      aria-label="Live ambient audio frequency visualizer"
    />
  );
};
