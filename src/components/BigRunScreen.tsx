// src/components/BigRunScreen.tsx
// Крупный режим: огромные цифры и большие кнопки, чтобы можно было глянуть на экран на бегу.
import { useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

import type { RunPhase, Split } from '../hooks/useRunTracker';
import { formatDuration, formatKm, formatPaceValue } from '../utils/runFormat';

interface BigRunScreenProps {
  phase: RunPhase;
  distance: number;
  elapsed: number;
  currentPace: number | null;
  avgPace: number | null;
  lastSplit: Split | null;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onClose: () => void;
}

const bigButton: CSSProperties = {
  flex: 1,
  height: 76,
  borderRadius: 18,
  border: '1px solid rgba(255, 255, 255, 0.2)',
  color: '#FFFFFF',
  fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
  fontSize: 22,
  cursor: 'pointer',
};

const label: CSSProperties = {
  color: 'rgba(255, 255, 255, 0.6)',
  fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
  fontSize: 14,
  letterSpacing: 1,
  textTransform: 'uppercase',
};

export const BigRunScreen = ({
  phase,
  distance,
  elapsed,
  currentPace,
  avgPace,
  lastSplit,
  onPause,
  onResume,
  onStop,
  onClose,
}: BigRunScreenProps) => {
  const [confirming, setConfirming] = useState(false);
  const paused = phase === 'paused';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Крупный режим пробежки"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        padding: 'max(16px, env(safe-area-inset-top)) 20px max(20px, env(safe-area-inset-bottom)) 20px',
        color: '#FFFFFF',
        background:
          'radial-gradient(circle at bottom right, #096b11 0%, #1c4934 17%, #01130f 45%, #000000 100%)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '10px 18px',
            borderRadius: 999,
            border: '1px solid rgba(255, 255, 255, 0.25)',
            background: 'rgba(255, 255, 255, 0.12)',
            color: '#FFFFFF',
            fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          Свернуть
        </button>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          textAlign: 'center',
          gap: 18,
        }}
      >
        {paused && (
          <div style={{ color: '#FF9800', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif', fontSize: 22 }}>
            ⏸ ПАУЗА
          </div>
        )}

        <div>
          <div style={label}>Дистанция, км</div>
          <div style={{ fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif', fontSize: 'min(30vw, 150px)', lineHeight: 1 }}>
            {formatKm(distance)}
          </div>
        </div>

        <div>
          <div style={label}>Время</div>
          <div style={{ fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif', fontSize: 'min(20vw, 96px)', lineHeight: 1 }}>
            {formatDuration(elapsed)}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-around' }}>
          <div>
            <div style={label}>Темп сейчас</div>
            <div style={{ fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif', fontSize: 'min(13vw, 60px)', lineHeight: 1.1 }}>
              {formatPaceValue(currentPace)}
            </div>
          </div>
          <div>
            <div style={label}>Средний темп</div>
            <div style={{ fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif', fontSize: 'min(13vw, 60px)', lineHeight: 1.1 }}>
              {formatPaceValue(avgPace)}
            </div>
          </div>
        </div>

        {lastSplit && (
          <div style={{ color: '#4CAF50', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif', fontSize: 22 }}>
            🏁 Км {lastSplit.km}: {formatDuration(lastSplit.seconds)}
          </div>
        )}
      </div>

      {confirming ? (
        <div>
          <div style={{ textAlign: 'center', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif', fontSize: 20, marginBottom: 12 }}>
            Завершить пробежку?
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                onStop();
              }}
              style={{ ...bigButton, background: 'rgba(244, 67, 54, 0.75)' }}
            >
              Завершить
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              style={{ ...bigButton, background: 'rgba(255, 255, 255, 0.2)' }}
            >
              Продолжить
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12 }}>
          {paused ? (
            <button
              type="button"
              onClick={onResume}
              style={{ ...bigButton, background: 'rgba(76, 175, 80, 0.8)' }}
            >
              ▶ Продолжить
            </button>
          ) : (
            <button
              type="button"
              onClick={onPause}
              style={{ ...bigButton, background: 'rgba(255, 152, 0, 0.8)' }}
            >
              ⏸ Пауза
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirming(true)}
            style={{ ...bigButton, background: 'rgba(244, 67, 54, 0.75)' }}
          >
            ⏹ Стоп
          </button>
        </div>
      )}
    </div>,
    document.body
  );
};

export default BigRunScreen;
