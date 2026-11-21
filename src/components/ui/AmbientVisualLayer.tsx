import React, { useEffect, useRef } from 'react';
import { ambientBgm } from '../../utils/ambientBgm';

export const AmbientAudioVisualizer: React.FC<{ className?: string }> = ({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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
  }, []);

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
