'use client';

import { useEffect, useRef } from 'react';

// Generative ∞ — glowing particles flowing along a Gerono lemniscate (figure-eight)
// with destination-out trails, over a faint static guide curve so the mark is always
// visible. The brand signature and a literal nod to looping. It always animates (the
// motion is slow and decorative); under prefers-reduced-motion it simply runs gentler.
export function InfinityField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const x = c.getContext('2d');
    if (!x) return;
    const parent = c.parentElement as HTMLElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Match the concept: always animate (the motion is a slow, decorative drift, not a
    // jarring transition), so the ∞ moves for everyone — including reduced-motion users.
    let w = 0, h = 0, A = 0, cx = 0, cy = 0, raf = 0;

    const pt = (t: number) => ({ x: cx + A * Math.cos(t), y: cy + A * 0.82 * Math.sin(2 * t) });
    const trace = () => {
      x.beginPath();
      for (let t = 0; t <= Math.PI * 2 + 0.01; t += 0.04) {
        const p = pt(t);
        t === 0 ? x.moveTo(p.x, p.y) : x.lineTo(p.x, p.y);
      }
    };

    const size = () => {
      const r = parent.getBoundingClientRect();
      w = Math.max(r.width, 1);
      h = Math.max(r.height, 1);
      c.width = w * dpr;
      c.height = h * dpr;
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      A = Math.min(w * 0.28, 360);
      cx = w * 0.62;
      cy = Math.min(h * 0.46, 440); // keep the ∞ in the hero fold on tall pages
    };

    const N = 150;
    const P = Array.from({ length: N }, () => ({
      t: Math.random() * Math.PI * 2,
      sp: 0.0016 + Math.random() * 0.0042,
      s: 0.6 + Math.random() * 1.8,
      teal: Math.random() < 0.34,
    }));

    const frame = () => {
      x.globalCompositeOperation = 'destination-out';
      x.fillStyle = 'rgba(0,0,0,0.085)';
      x.fillRect(0, 0, w, h);
      // faint static guide so the ∞ reads even before trails build
      x.globalCompositeOperation = 'source-over';
      trace();
      x.strokeStyle = 'rgba(255,255,255,0.07)';
      x.lineWidth = 1;
      x.stroke();
      // flowing glowing particles (additive)
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

    size();
    requestAnimationFrame(size); // re-measure after fonts/layout settle
    const ro = new ResizeObserver(size);
    ro.observe(parent);
    frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="inf-canvas" />;
}
