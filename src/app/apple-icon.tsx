import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// Mono-line ∞ on the Definity-blue field. Full-bleed (iOS rounds it itself).
const INF = 'M 36,90 C 36,62 70,62 90,90 C 110,118 144,118 144,90 C 144,62 110,62 90,90 C 70,118 36,118 36,90 Z';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0b1875',
          backgroundImage: 'radial-gradient(150% 150% at 28% 8%, #1c3ae6 0%, #1430cf 42%, #0a1576 100%)',
        }}
      >
        <svg width={180} height={180} viewBox="0 0 180 180">
          <path d={INF} stroke="#ffffff" strokeWidth={12} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size,
  );
}
