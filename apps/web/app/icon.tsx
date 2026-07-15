import { ImageResponse } from 'next/og';

// Favicon / PWA raster icon, generated at build time (no binary asset needed).
export const size = { width: 256, height: 256 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f1115',
        color: '#4f8cff',
        fontSize: 150,
        fontWeight: 700,
      }}
    >
      ⛰
    </div>,
    { ...size },
  );
}
