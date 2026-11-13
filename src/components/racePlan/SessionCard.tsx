// src/components/racePlan/SessionCard.tsx
// Карточка одной тренировки: что делать, в каком темпе, в какой пульсовой зоне
// и что с ней стало — выполнено, пропущено или перенесено.

import { useState } from 'react';
import { Button, Text } from '@vkontakte/vkui';
import { formatKmNumber, shiftDate } from '../../utils/racePlan';
import { formatShortDate, plural, type PlanSessionView } from '../../utils/planProgress';
import type { SessionStatus } from '../../utils/planStorage';
import { COLORS, FONT_SIZE, LINE_HEIGHT, SPACING } from '../../styles/tokens';
import { captionStyle, cardStyle, chipStyle } from './ui';

interface SessionCardProps {
  session: PlanSessionView;
  /** Подпись над карточкой: «Сегодня», «Следующая тренировка» */
  label?: string;
  onStatus: (status: SessionStatus | null) => void;
  onMove: (date: string) => void;
  onResetMove: () => void;
}

export const SessionCard = ({
  session,
  label,
  onStatus,
  onMove,
  onResetMove,
}: SessionCardProps) => {
  const [moving, setMoving] = useState(false);
  const moved = session.effectiveDate !== session.date;
  const done = session.status === 'done';
  const skipped = session.status === 'skipped';

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: SPACING.sm,
          marginBottom: SPACING.xs,
        }}
      >
        <Text
          style={{
            ...captionStyle,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: done ? COLORS.accent : skipped ? COLORS.danger : COLORS.textSecondary,
          }}
        >
          {label ?? (done ? 'Выполнено' : skipped ? 'Пропущено' : 'Тренировка')}
        </Text>
        <Text style={captionStyle}>
          {session.day} · {formatShortDate(session.effectiveDate)}
        </Text>
      </div>

      <Text
        style={{
          color: COLORS.text,
          fontSize: FONT_SIZE.subtitleSmall,
          lineHeight: LINE_HEIGHT.title,
          marginBottom: SPACING.sm,
          fontStyle: 'italic',
        }}
      >
        {session.title}
      </Text>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md }}>
        {session.distanceKm ? <span style={chipStyle}>{formatKmNumber(session.distanceKm)} км</span> : null}
        {session.paceText ? <span style={chipStyle}>{session.paceText}</span> : null}
        {session.hrText ? <span style={chipStyle}>{session.hrText}</span> : null}
      </div>

      <Text style={{ color: COLORS.text, fontSize: FONT_SIZE.body, lineHeight: LINE_HEIGHT.body }}>
        {session.detail}
      </Text>

      <Text
        style={{
          ...captionStyle,
          marginTop: SPACING.sm,
          fontStyle: 'italic',
        }}
      >
        {session.purpose}
      </Text>

      {moved ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: SPACING.sm,
            marginTop: SPACING.md,
          }}
        >
          <Text style={captionStyle}>Перенесено с {formatShortDate(session.date)}</Text>
          {!session.status ? (
            <Button mode="tertiary" size="s" onClick={onResetMove}>
              Вернуть дату
            </Button>
          ) : null}
        </div>
      ) : null}

      <div style={{ marginTop: SPACING.md }}>
        {session.status ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: done ? COLORS.accent : COLORS.danger, fontSize: FONT_SIZE.body }}>
              {done ? 'Отмечено выполненным' : 'Отмечено пропущенным'}
            </Text>
            <Button mode="tertiary" size="s" onClick={() => onStatus(null)}>
              Отменить
            </Button>
          </div>
        ) : moving ? (
          <div>
            <Text style={{ ...captionStyle, marginBottom: SPACING.sm }}>На какой день перенести?</Text>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.sm, alignItems: 'center' }}>
              {[1, 2, 7].map((days) => (
                <Button
                  key={days}
                  mode="secondary"
                  size="s"
                  onClick={() => {
                    onMove(shiftDate(session.effectiveDate, days));
                    setMoving(false);
                  }}
                >
                  +{days} {plural(days, 'день', 'дня', 'дней')}
                </Button>
              ))}
              <Button mode="tertiary" size="s" onClick={() => setMoving(false)}>
                Отмена
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.sm }}>
            <Button size="m" appearance="accent" onClick={() => onStatus('done')}>
              Выполнено
            </Button>
            <Button size="m" mode="secondary" onClick={() => setMoving(true)}>
              Перенести
            </Button>
            <Button size="m" mode="tertiary" onClick={() => onStatus('skipped')}>
              Пропустить
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
