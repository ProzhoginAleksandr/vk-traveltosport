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
  /** Световые пятна, дуги дорожек и зерно: глубина фона для главной */
  atmospheric?: boolean;
  /** Нижний отступ под таббар, по умолчанию 80 */
  paddingBottom?: number;
  style?: CSSProperties;
  children: ReactNode;
}

export const PageBackground = ({
  variant = 'green',
  pattern,
  animated = false,
  atmospheric = false,
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

      {atmospheric && (
        <div aria-hidden="true" className="pbAtmosphere">
          <style>{`
            .pbAtmosphere {
              position: absolute;
              inset: 0;
              overflow: hidden;
              pointer-events: none;
            }
            .pbAtmosphere > * {
              position: absolute;
              pointer-events: none;
            }
            .pbAuroraA {
              top: -24%;
              right: -32%;
              width: 95vw;
              height: 95vw;
              max-width: 680px;
              max-height: 680px;
              border-radius: 50%;
              background: radial-gradient(
                circle,
                rgba(76, 175, 80, 0.28) 0%,
                rgba(28, 73, 52, 0.16) 40%,
                transparent 70%
              );
              animation: pbDriftA 26s ease-in-out infinite;
              will-change: transform;
            }
            .pbAuroraB {
              bottom: -20%;
              left: -34%;
              width: 85vw;
              height: 85vw;
              max-width: 580px;
              max-height: 580px;
              border-radius: 50%;
              background: radial-gradient(circle, rgba(41, 128, 100, 0.22) 0%, transparent 72%);
              animation: pbDriftB 34s ease-in-out infinite;
              will-change: transform;
            }
            .pbLanes {
              top: -70px;
              right: -150px;
              width: 540px;
              height: auto;
              transform: rotate(-16deg);
              opacity: 0.075;
            }
            .pbVignette {
              inset: 0;
              box-shadow: inset 0 0 160px 30px rgba(0, 0, 0, 0.55);
            }
            .pbGrain {
              inset: 0;
              opacity: 0.045;
              mix-blend-mode: soft-light;
              background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E");
              background-size: 140px 140px;
            }
            @keyframes pbDriftA {
              0%,
              100% {
                transform: translate3d(0, 0, 0) scale(1);
              }
              50% {
                transform: translate3d(-6%, 5%, 0) scale(1.1);
              }
            }
            @keyframes pbDriftB {
              0%,
              100% {
                transform: translate3d(0, 0, 0) scale(1);
              }
              50% {
                transform: translate3d(5%, -6%, 0) scale(1.08);
              }
            }
            @media (prefers-reduced-motion: reduce) {
              .pbAuroraA,
              .pbAuroraB {
                animation: none;
              }
            }
          `}</style>
          <div className="pbAuroraA" />
          <div className="pbAuroraB" />
          <svg className="pbLanes" viewBox="0 0 520 320" aria-hidden="true" focusable="false">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <rect
                key={index}
                x={index * 14}
                y={index * 14}
                width={520 - index * 28}
                height={320 - index * 28}
                rx={160 - index * 14}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth={1.5}
              />
            ))}
            <line x1="390" y1="0" x2="390" y2="84" stroke="#FFFFFF" strokeWidth="4" strokeDasharray="5 5" />
          </svg>
          <div className="pbVignette" />
          <div className="pbGrain" />
        </div>
      )}

      {pattern && <PatternLayer name={pattern} bottomOffset={Math.max(0, paddingBottom - 10)} />}

      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  );
};

export default PageBackground;