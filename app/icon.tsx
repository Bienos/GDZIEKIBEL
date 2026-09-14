import { ImageResponse } from 'next/og';

/**
 * Code-generated favicon/app icon (TASK-027,
 * `docs/adr/0022-seo-share-baseline.md`): no design asset pipeline exists
 * in this repository, so this uses this project's own `tokens.css` colours
 * — signal yellow, ink black — rather than an invented or placeholder
 * image. "WC" mirrors the exact mark `lib/toilets/marker-element.ts`
 * already puts on every toilet marker, so the tab icon and the in-app
 * marker read as the same visual language.
 */
export const size = { width: 32, height: 32 };
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
        background: '#ffd800',
        color: '#0b0b0b',
        fontSize: 15,
        fontWeight: 800,
        fontFamily: 'Arial, sans-serif',
        letterSpacing: -0.5,
      }}
    >
      WC
    </div>,
    { ...size },
  );
}
