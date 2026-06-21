'use client';

import { useEffect, useRef } from 'react';

// Generative ∞ — glowing particles flowing along a Gerono lemniscate (figure-eight)
// with destination-out trails, over a faint static guide curve so the mark is always
// visible. The brand signature and a literal nod to looping.
//
// Performance: the glow is a *pre-rendered sprite* drawn with drawImage — NOT a
// per-particle canvas shadowBlur, which is brutally expensive (it re-runs a Gaussian
// blur for every particle every frame and was pinning the GPU/CPU). The loop is also
// throttled to ~30fps and time-stepped, so it costs the same regardless of the
// display's refresh rate (a 144Hz monitor no longer does 144 frames of work). It
// always animates (slow, decorative drift); reduced-motion runs gentler still.
export function InfinityField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const x = c.getContext('2d');
    if (!x) return;
    const parent = c.parentElement as HTMLElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    let w = 0, h = 0, A = 0, cx = 0, cy = 0, raf = 0, paused = false, last = 0;

    const pt = (t: number) => ({ x: cx + A * Math.cos(t), y: cy + A * 0.82 * Math.sin(2 * t) });
    const trace = () => {
      x.beginPath();
      for (let t = 0; t <= Math.PI * 2 + 0.01; t += 0.06) {
        const p = pt(t);
        t === 0 ? x.moveTo(p.x, p.y) : x.lineTo(p.x, p.y);
      }
    };

    // Pre-render the soft halo once per colour into an offscreen sprite. Drawing this
    // with drawImage replaces the per-particle shadowBlur (which produced the glow but
    // was the expensive part); the bright core is still a tiny crisp arc below.
    const HALO = 12; // halo reach in CSS px (was shadowBlur: 10)
    const sprite = (rgb: string) => {
      const d = Math.max(2, Math.ceil(HALO * 2 * dpr));
      const s = document.createElement('canvas');
      s.width = d;
      s.height = d;
      const g = s.getContext('2d')!;
      const grad = g.createRadialGradient(d / 2, d / 2, 0, d / 2, d / 2, d / 2);
      grad.addColorStop(0, `rgba(${rgb},0.55)`);
      grad.addColorStop(0.35, `rgba(${rgb},0.18)`);
      grad.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, d, d);
      return s;
    };
    const haloWhite = sprite('255,255,255');
    const haloTeal = sprite('55,240,176');

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

    const N = reduced ? 80 : 140;
    const P = Array.from({ length: N }, () => ({
      t: Math.random() * Math.PI * 2,
      sp: 0.0016 + Math.random() * 0.0042,
      s: 0.6 + Math.random() * 1.8,
      teal: Math.random() < 0.34,
    }));

    const FPS = reduced ? 22 : 30;
    const minDt = 1000 / FPS - 2;

    const frame = (now: number) => {
      if (paused) { raf = 0; return; }
      raf = requestAnimationFrame(frame);
      const dt = now - last;
      if (dt < minDt) return; // throttle: skip frames above the target rate (cheap)
      // advance scaled to a 60fps baseline so drift speed is identical at any refresh
      // rate; clamp so a backgrounded tab doesn't jump on resume.
      const k = last ? Math.min(dt / 16.67, 4) : 1;
      last = now;

      // trail fade (alpha tuned so per-second decay matches the original 60fps look)
      x.globalCompositeOperation = 'destination-out';
      x.fillStyle = 'rgba(0,0,0,0.15)';
      x.fillRect(0, 0, w, h);
      // faint static guide so the ∞ reads even before trails build
      x.globalCompositeOperation = 'source-over';
      trace();
      x.strokeStyle = 'rgba(255,255,255,0.07)';
      x.lineWidth = 1;
      x.stroke();
      // flowing glowing particles (additive): soft halo sprite + tiny crisp core
      x.globalCompositeOperation = 'lighter';
      for (const p of P) {
        p.t += p.sp * k;
        const a = pt(p.t);
        if (p.teal) {
          x.drawImage(haloTeal, a.x - HALO, a.y - HALO, HALO * 2, HALO * 2);
          x.fillStyle = 'rgba(55,240,176,0.85)';
        } else {
          x.drawImage(haloWhite, a.x - HALO, a.y - HALO, HALO * 2, HALO * 2);
          x.fillStyle = 'rgba(255,255,255,0.85)';
        }
        x.beginPath();
        x.arc(a.x, a.y, p.s, 0, Math.PI * 2);
        x.fill();
      }
      x.globalCompositeOperation = 'source-over';
    };

    size();
    requestAnimationFrame(size); // re-measure after fonts/layout settle
    const ro = new ResizeObserver(size);
    ro.observe(parent);
    // Pause the loop when the hero scrolls off-screen so it doesn't burn frames or
    // compete with scrolling while the rest of the page is in view.
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          if (paused) { paused = false; last = 0; raf = requestAnimationFrame(frame); }
        } else {
          paused = true;
        }
      },
      { threshold: 0 }
    );
    io.observe(c);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="inf-canvas" />;
}
