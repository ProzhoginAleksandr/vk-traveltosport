// src/components/ClubRunCard.tsx
// Карточка клубного пробега на главной: общие километры за месяц,
// участники и прогресс к цели клуба.
import { Text } from '@vkontakte/vkui';

import { CLUB_MONTH_GOAL_KM } from '../config/club';
import { formatClubNumber, monthTitle, type ClubStats } from '../utils/club';
import { COLORS, FONT_SIZE, LINE_HEIGHT, RADIUS, SPACING } from '../styles/tokens';

const FONT = 'Oswald, Impact, "Arial Narrow", Arial, sans-serif';

interface ClubRunCardProps {
  stats: ClubStats;
  ownKm: number | null;
  onClick: () => void;
}

export const ClubRunCard = ({ stats, ownKm, onClick }: ClubRunCardProps) => {
  const progress = Math.min(100, Math.round((stats.km / CLUB_MONTH_GOAL_KM) * 100));

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Клубный пробег: ${formatClubNumber(stats.km)} километров за ${monthTitle(
        stats.month
      )}, участников ${stats.users}`}
      style={{
        display: 'block',
        width: '100%',
        boxSizing: 'border-box',
        textAlign: 'left',
        padding: SPACING.lg,
        margin: `0 0 ${SPACING.md}px`,
        borderRadius: RADIUS.lg,
        border: '1px solid rgba(190, 221, 162, 0.38)',
        background:
          'linear-gradient(135deg, rgba(76, 175, 80, 0.2) 0%, rgba(41, 128, 100, 0.12) 55%, rgba(255, 255, 255, 0.05) 100%)',
        boxShadow: '0 6px 24px rgba(0, 0, 0, 0.32)',
        color: COLORS.text,
        fontFamily: FONT,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <Text
          style={{
            color: 'rgba(255, 255, 255, 0.72)',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontFamily: FONT,
          }}
        >
          Клубный пробег
        </Text>
        <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: FONT_SIZE.caption, fontFamily: FONT }}>
          {monthTitle(stats.month)}
        </Text>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
        <Text
          style={{
            color: COLORS.text,
            fontSize: FONT_SIZE.display,
            lineHeight: LINE_HEIGHT.display,
            fontFamily: FONT,
          }}
        >
          {formatClubNumber(stats.km)}
        </Text>
        <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: FONT_SIZE.caption, fontFamily: FONT }}>
          км из {formatClubNumber(CLUB_MONTH_GOAL_KM)}
        </Text>
      </div>

      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: 'rgba(255, 255, 255, 0.14)',
          overflow: 'hidden',
          marginTop: SPACING.sm,
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            borderRadius: 3,
            background: 'linear-gradient(90deg, #4CAF50, #bedda2)',
            transition: 'width 300ms ease',
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: SPACING.sm }}>
        <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: FONT_SIZE.caption, fontFamily: FONT }}>
          {formatClubNumber(stats.users)} участников
        </Text>
        <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: FONT_SIZE.caption, fontFamily: FONT }}>
          ваш вклад {formatClubNumber(ownKm ?? 0)} км
        </Text>
      </div>
    </button>
  );
};

export default ClubRunCard;
