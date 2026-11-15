// src/components/AdCard.tsx
// Карточка «Реклама» между блоками контента. Ролик запускается только по
// нажатию: пользователь сам решает, смотреть его или пролистнуть дальше.
import { useState } from 'react';
import { Button, Text } from '@vkontakte/vkui';

import { showOptInAd } from '../utils/adUtils';
import { COLORS, FONT_SIZE, LINE_HEIGHT, RADIUS, SPACING } from '../styles/tokens';

const FONT = 'Oswald, Impact, "Arial Narrow", Arial, sans-serif';

interface AdCardProps {
  style?: React.CSSProperties;
}

export const AdCard = ({ style }: AdCardProps) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'thanks' | 'unavailable'>('idle');

  const watch = async () => {
    setStatus('loading');
    const shown = await showOptInAd();
    setStatus(shown ? 'thanks' : 'unavailable');
    if (shown) {
      window.setTimeout(() => setStatus('idle'), 5000);
    }
  };

  return (
    <div
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.lg,
        padding: SPACING.lg,
        boxSizing: 'border-box',
        fontFamily: FONT,
        ...style,
      }}
    >
      <Text
        style={{
          color: COLORS.textMuted,
          fontSize: 11,
          lineHeight: 1.2,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontFamily: FONT,
        }}
      >
        Реклама
      </Text>
      <Text
        style={{
          color: COLORS.text,
          fontSize: FONT_SIZE.body,
          lineHeight: LINE_HEIGHT.body,
          marginTop: 4,
          fontFamily: FONT,
        }}
      >
        Поддержите TraveltoSport
      </Text>
      <Text
        style={{
          color: COLORS.textSecondary,
          fontSize: FONT_SIZE.caption,
          lineHeight: LINE_HEIGHT.caption,
          marginTop: 6,
          fontFamily: FONT,
        }}
      >
        Короткий ролик — то, на чём держится приложение. Смотреть его не обязательно.
      </Text>

      <div style={{ marginTop: SPACING.md }}>
        {status === 'thanks' ? (
          <Text style={{ color: COLORS.accent, fontSize: FONT_SIZE.body, fontFamily: FONT }}>
            Спасибо! Это помогает приложению развиваться.
          </Text>
        ) : status === 'unavailable' ? (
          <Text style={{ color: COLORS.textSecondary, fontSize: FONT_SIZE.caption, fontFamily: FONT }}>
            Реклама сейчас недоступна — попробуйте позже.
          </Text>
        ) : (
          <Button
            size="m"
            mode="secondary"
            loading={status === 'loading'}
            onClick={() => void watch()}
          >
            Посмотреть ролик
          </Button>
        )}
      </div>
    </div>
  );
};

export default AdCard;
