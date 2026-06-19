'use client';

import { useEffect, useRef } from 'react';

// Generative ∞ — glowing particles flowing along a Gerono lemniscate (figure-eight),
// with destination-out trails for a luminous wireframe. The brand's signature motif and
// a literal nod to looping. Pure canvas; respects prefers-reduced-motion.
export function InfinityField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const x = c.getContext('2d');
    if (!x) return;
    const parent = c.parentElement as HTMLElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, A = 0, cx = 0, cy = 0, raf = 0;

    const size = () => {
      const r = parent.getBoundingClientRect();
      w = r.width; h = r.height;
      c.width = w * dpr; c.height = h * dpr;
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      A = Math.min(w * 0.27, h * 0.42);
      cx = w * 0.63; cy = h * 0.46;
    };
    size();
    window.addEventListener('resize', size);

    const pt = (t: number) => ({ x: cx + A * Math.cos(t), y: cy + A * 0.82 * Math.sin(2 * t) });
    const N = reduce ? 60 : 150;
    const P = Array.from({ length: N }, () => ({
      t: Math.random() * Math.PI * 2,
      sp: reduce ? 0 : 0.0016 + Math.random() * 0.0042,
      s: 0.6 + Math.random() * 1.8,
      teal: Math.random() < 0.34,
    }));

    const frame = () => {
      x.globalCompositeOperation = 'destination-out';
      x.fillStyle = 'rgba(0,0,0,0.085)';
      x.fillRect(0, 0, w, h);
      x.globalCompositeOperation = 'source-over';
      x.beginPath();
      for (let t = 0; t <= Math.PI * 2 + 0.01; t += 0.05) {
        const p = pt(t);
        t === 0 ? x.moveTo(p.x, p.y) : x.lineTo(p.x, p.y);
      }
      x.strokeStyle = 'rgba(255,255,255,0.05)';
      x.lineWidth = 1;
      x.stroke();
      x.globalCompositeOperation = 'lighter';
      for (const p of P) {
        p.t += p.sp;
        const a = pt(p.t);
        const col = p.teal ? '55,240,176' : '255,255,255';
        x.shadowBlur = 10;
        x.shadowColor = `rgba(${col},0.9)`;
        x.beginPath();
        x.arc(a.x, a.y, p.s, 0, Math.PI * 2);
        x.fillStyle = `rgba(${col},0.85)`;
        x.fill();
      }
      x.shadowBlur = 0;
      raf = requestAnimationFrame(frame);
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="inf-canvas" />;
}
