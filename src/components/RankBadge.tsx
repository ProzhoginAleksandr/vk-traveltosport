// src/components/RankBadge.tsx
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Text } from '@vkontakte/vkui';
import { getNextRank, getRank } from '../utils/ranks';

interface RankBadgeProps {
  /** Общее количество пробежек пользователя */
  runsCount: number;
}

export const RankBadge = ({ runsCount }: RankBadgeProps) => {
  const [open, setOpen] = useState(false);

  const rank = getRank(runsCount);
  const next = getNextRank(runsCount);

  const icon = rank?.icon ?? '🏁';
  const name = rank?.name ?? 'Без звания';
  const description =
    rank?.description ?? 'Совершите первую пробежку, чтобы получить звание «Новичок».';

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const progress = next
    ? Math.min(100, Math.round(((runsCount - (rank?.minRuns ?? 0)) / (next.minRuns - (rank?.minRuns ?? 0))) * 100))
    : 100;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Звание: ${name}. Нажмите, чтобы узнать подробнее`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          borderRadius: 999,
          border: '1px solid rgba(255, 255, 255, 0.18)',
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          color: '#FFFFFF',
          cursor: 'pointer',
          fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
          fontSize: 15,
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
        <span>{name}</span>
      </button>

      {open &&
        createPortal(
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              background: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Звание ${name}`}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 340,
                boxSizing: 'border-box',
                padding: 24,
                borderRadius: 20,
                textAlign: 'center',
                color: '#FFFFFF',
                background: 'linear-gradient(160deg, #1c4934 0%, #01130f 100%)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              }}
            >
              <div style={{ fontSize: 56, lineHeight: 1 }}>{icon}</div>
              <div style={{ fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif', fontSize: 24, margin: '12px 0 8px' }}>{name}</div>
              <Text style={{ color: '#DDDDDD', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif', whiteSpace: 'normal' }}>
                {description}
              </Text>

              <div style={{ marginTop: 20, textAlign: 'left' }}>
                <Text style={{ color: '#AAAAAA', fontSize: 13, fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>
                  Пробежек: {runsCount}
                  {next ? ` · до «${next.name}»: ${next.minRuns - runsCount}` : ' · максимальное звание'}
                </Text>
                <div
                  style={{
                    height: 6,
                    marginTop: 8,
                    borderRadius: 3,
                    background: 'rgba(255, 255, 255, 0.15)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${progress}%`,
                      height: '100%',
                      background: '#2fbf4a',
                      transition: 'width 0.3s',
                    }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  marginTop: 20,
                  width: '100%',
                  padding: '12px 0',
                  borderRadius: 12,
                  border: 'none',
                  background: 'rgba(255, 255, 255, 0.15)',
                  color: '#FFFFFF',
                  fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
                  fontSize: 16,
                  cursor: 'pointer',
                }}
              >
                Закрыть
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default RankBadge;