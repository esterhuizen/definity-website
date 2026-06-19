import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const size = { width: 48, height: 48 };
export const contentType = 'image/png';

// Mono-line ∞ on a Definity-blue rounded square — the brand favicon.
const INF = 'M 9,24 C 9,16 18,16 24,24 C 30,32 39,32 39,24 C 39,16 30,16 24,24 C 18,32 9,32 9,24 Z';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 11,
          backgroundColor: '#0b1875',
          backgroundImage: 'radial-gradient(140% 140% at 28% 8%, #1c3ae6 0%, #1430cf 42%, #0a1576 100%)',
        }}
      >
        <svg width={48} height={48} viewBox="0 0 48 48">
          <path d={INF} stroke="#ffffff" strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size,
  );
}
