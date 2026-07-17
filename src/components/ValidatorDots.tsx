'use client';

import { useEffect, useState } from 'react';

// Plots the pool's validators onto the "Where it runs" map. Fetches the live
// /validators.json (timer-maintained in public/) so it always reflects the
// current set, independent of build/ISR timing. Teal glow dots over the map.
type V = { vote: string; name: string | null; country: string | null; city: string | null; lat: number; lng: number };

const W = 950;
const H = 620;
// world-map.svg ("World map - low resolution") is a hand-drawn, artistically
// distorted silhouette — NOT a clean projection. A naive equirectangular map
// lands dots ~34px too far north (in the ocean). These cubic coefficients are an
// empirical 2D warp (rms ~2px) from real lng/lat to the map's 950×620 pixel
// frame, least-squares fit against 35 island/landmark anchors whose pixel
// positions were measured from the SVG country paths. Basis below; CX/CY are its
// coefficients. Keeps validator dots on the correct landmasses.
const CX = [455.50289, 2.8166656, -0.072249888, -0.00067115029, -0.00044540963, 0.00017075188, 0.0000037267691, 0.000011026278, 0.0000098482318, -0.0001500399];
const CY = [337.85623, -0.011272125, -2.8492088, 0.000073082554, 0.000035583714, 0.00017156481, 5.1917311e-7, -0.0001145467, -0.00003869894, 1.259708e-7];
const clamp = (v: number, max: number) => (v < 0 ? 0 : v > max ? max : v);
const project = (lat: number, lng: number) => {
  // basis: [1, lng, lat, lng·lat, lng², lat², lng³, lat³, lng²·lat, lng·lat²]
  const b = [1, lng, lat, lng * lat, lng * lng, lat * lat, lng ** 3, lat ** 3, lng * lng * lat, lng * lat * lat];
  let x = 0, y = 0;
  for (let i = 0; i < b.length; i++) { x += CX[i] * b[i]; y += CY[i] * b[i]; }
  // clamp in case a future validator sits far from any calibration anchor
  return { x: clamp(x, W), y: clamp(y, H) };
};

export function ValidatorDots() {
  const [dots, setDots] = useState<V[]>([]);

  useEffect(() => {
    let alive = true;
    fetch('/validators.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.validators) return;
        setDots(
          d.validators.filter(
            // pending members (approved, seat not on-chain yet) stay off the map
            (v: V & { pending?: boolean }) =>
              !v.pending && v.lat != null && v.lng != null && Number.isFinite(v.lat) && Number.isFinite(v.lng),
          ),
        );
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!dots.length) return null;

  return (
    <svg className="vdots" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="vd-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#37f0b0" stopOpacity="0.6" />
          <stop offset="55%" stopColor="#37f0b0" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#37f0b0" stopOpacity="0" />
        </radialGradient>
      </defs>
      {dots.map((v, i) => {
        const { x, y } = project(v.lat, v.lng);
        return (
          <g key={`${v.vote}-${i}`}>
            <title>{(v.name || v.vote.slice(0, 8)) + (v.city ? ` · ${v.city}` : '') + (v.country ? `, ${v.country}` : '')}</title>
            <circle cx={x} cy={y} r={16} fill="url(#vd-glow)" />
            <circle cx={x} cy={y} r={3.2} fill="#37f0b0" />
            <circle cx={x} cy={y} r={1.4} fill="#ffffff" />
          </g>
        );
      })}
    </svg>
  );
}
