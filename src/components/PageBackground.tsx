// src/components/PageBackground.tsx
import type { CSSProperties, ReactNode } from 'react';
import { PatternLayer, type PatternName } from './BackgroundPatterns';

export type BackgroundVariant = 'green' | 'violet' | 'blue' | 'amber' | 'red';
export type { PatternName };

interface Palette {
  accent: string; // яркий центр свечения
  mid: string;    // переход
  deep: string;   // тёмный край
}

// Структура градиента та же, что была раньше, меняются только цвета
const PALETTES: Record<BackgroundVariant, Palette> = {
  green:  { accent: '#096b11', mid: '#1c4934', deep: '#01130f' }, // прежний фон приложения
  violet: { accent: '#4a2a9e', mid: '#2a1b5c', deep: '#0b0618' },
  blue:   { accent: '#0b6e8f', mid: '#124557', deep: '#03141a' },
  amber:  { accent: '#a0610a', mid: '#52360f', deep: '#160d02' },
  red:    { accent: '#9b1c1c', mid: '#4f1818', deep: '#170505' },
};

const buildGradient = ({ accent, mid, deep }: Palette): string =>
  `radial-gradient(circle at bottom right, ${accent} 0%, ${mid} 17%, ${deep} 40%, transparent 70%), ` +
  `radial-gradient(circle at top left, ${accent} 0%, ${mid} 7%, ${deep} 20%, #000000 100%)`;

interface PageBackgroundProps {
  variant?: BackgroundVariant;
  /** Спортивный узор поверх градиента: topo, track, footsteps, pulse или ridge */
  pattern?: PatternName;
  /** Медленно «плавающее» свечение. Анимируется только transform, отключается при prefers-reduced-motion */
  animated?: boolean;
  /** Нижний отступ под таббар, по умолчанию 80 */
  paddingBottom?: number;
  style?: CSSProperties;
  children: ReactNode;
}

export const PageBackground = ({
  variant = 'green',
  pattern,
  animated = false,
  paddingBottom = 80,
  style,
  children,
}: PageBackgroundProps) => {
  const palette = PALETTES[variant];
  const gradient = buildGradient(palette);

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: gradient,
        minHeight: '100vh',
        width: '100%',
        padding: `0 16px ${paddingBottom}px 16px`,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {animated && (
        <>
          <style>{`
            @keyframes pbFloat {
              0%   { transform: translate3d(-10%, 0, 0) scale(1); }
              50%  { transform: translate3d(12%, 14%, 0) scale(1.15); }
              100% { transform: translate3d(-10%, 0, 0) scale(1); }
            }
            .pbGlow {
              position: absolute;
              top: 8%;
              left: -25%;
              width: 90vw;
              height: 90vw;
              max-width: 520px;
              max-height: 520px;
              border-radius: 50%;
              opacity: 0.35;
              pointer-events: none;
              will-change: transform;
              animation: pbFloat 18s ease-in-out infinite;
            }
            @media (prefers-reduced-motion: reduce) {
              .pbGlow { animation: none; }
            }
          `}</style>
          <div
            aria-hidden="true"
            className="pbGlow"
            style={{ background: `radial-gradient(circle, ${palette.accent} 0%, transparent 65%)` }}
          />
        </>
      )}

      {pattern && <PatternLayer name={pattern} bottomOffset={Math.max(0, paddingBottom - 10)} />}

      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  );
};

export default PageBackground;