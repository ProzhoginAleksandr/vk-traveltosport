// src/components/racePlan/PlanOverview.tsx
// Главный экран плана: сколько осталось до старта, что делать сегодня,
// вся неделя по дням и полный список недель с отметками.

import { useMemo, useState } from 'react';
import { Button, Text } from '@vkontakte/vkui';

import {
  formatKmNumber,
  GOAL_DISTANCE_TEXT,
  LEVEL_TITLES,
  PHASE_TITLES,
  shiftDate,
  todayISO,
} from '../../utils/racePlan';
import {
  buildPlanView,
  formatPlanDate,
  formatShortDate,
  plural,
  type PlanSessionView,
} from '../../utils/planProgress';
import {
  moveSession,
  resetSessionMove,
  setSessionStatus,
  type PlanState,
  type SessionStatus,
} from '../../utils/planStorage';
import { COLORS, FONT_SIZE, LINE_HEIGHT, RADIUS, SPACING } from '../../styles/tokens';
import { SessionCard } from './SessionCard';
import { captionStyle, cardStyle, chipStyle, FONT, sectionTitleStyle } from './ui';
interface PlanOverviewProps {
  state: PlanState;
  onChange: (state: PlanState) => void;
  onEdit: () => void;
  onDelete: () => void;
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const mondayOfWeek = (iso: string): string => {
  const weekday = new Date(`${iso}T00:00:00`).getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return shiftDate(iso, offset);
};

const statusColor = (status: SessionStatus | undefined, isToday: boolean): string => {
  if (status === 'done') return COLORS.accent;
  if (status === 'skipped') return COLORS.danger;
  return isToday ? COLORS.warning : COLORS.borderStrong;
};

export const PlanOverview = ({ state, onChange, onEdit, onDelete }: PlanOverviewProps) => {
  const today = todayISO();
  const view = useMemo(() => buildPlanView(state, today), [state, today]);
  const { plan } = view;

  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [openWeek, setOpenWeek] = useState<number | null>(view.currentWeekIndex);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleStatus = (sessionId: string, status: SessionStatus | null) => {
    onChange(setSessionStatus(state, sessionId, status));
  };

  const handleMove = (sessionId: string, date: string) => {
    onChange(moveSession(state, sessionId, date));
  };

  const handleResetMove = (sessionId: string) => {
    onChange(resetSessionMove(state, sessionId));
  };

  const todaySessions = view.todaySessions;
  const nextSession = view.nextSession;
  const overdue = view.sessions.filter(
    (session) => !session.status && session.effectiveDate < today
  ).length;

  const weekStart = mondayOfWeek(today);
  const currentWeekSessions = view.sessions.filter(
    (session) => session.weekIndex === view.currentWeekIndex
  );

  const startDateText = state.createdAt ? formatPlanDate(state.createdAt.slice(0, 10)) : '';

  const renderSessionCard = (session: PlanSessionView, label?: string) => (
    <SessionCard
      session={session}
      label={label}
      onStatus={(status) => handleStatus(session.id, status)}
      onMove={(date) => handleMove(session.id, date)}
      onResetMove={() => handleResetMove(session.id)}
    />
  );

  const allDone = view.total > 0 && view.doneCount === view.total;

  return (
    <div>
      {/* Сводка */}
      <div style={cardStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: SPACING.sm,
          }}
        >
          <Text style={{ ...captionStyle, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {view.racePassed ? 'Забег прошёл' : 'До старта'}
          </Text>
          <Text style={captionStyle}>
            {view.doneCount} из {view.total} тренировок
          </Text>
        </div>

        <Text
          style={{
            color: COLORS.text,
            fontSize: FONT_SIZE.display,
            lineHeight: LINE_HEIGHT.display,
            margin: `${SPACING.xs}px 0 0`,
          }}
        >
          {view.racePassed
            ? 'Старт позади'
            : `${view.daysLeft} ${plural(view.daysLeft, 'день', 'дня', 'дней')}`}
        </Text>

        <Text style={{ ...captionStyle, color: COLORS.text, marginTop: SPACING.xs }}>
          {GOAL_DISTANCE_TEXT[plan.goalKm]} · {formatPlanDate(plan.raceDate)} · {plan.weeksTotal}{' '}
          {plural(plan.weeksTotal, 'неделя', 'недели', 'недель')}
        </Text>

        <div
          style={{
            height: 6,
            borderRadius: 3,
            background: COLORS.border,
            overflow: 'hidden',
            marginTop: SPACING.md,
          }}
        >
          <div
            style={{
              width: `${view.percent}%`,
              height: '100%',
              background: COLORS.accent,
              borderRadius: 3,
              transition: 'width 200ms ease',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md }}>
          <span style={chipStyle}>выполнено {view.percent}%</span>
          <span style={chipStyle}>{formatKmNumber(view.doneKm)} км пройдено</span>
          <span style={chipStyle}>пик {formatKmNumber(plan.peakKm)} км</span>
          <span style={chipStyle}>цель {Math.floor(plan.paces.goal / 60)}:{String(plan.paces.goal % 60).padStart(2, '0')} /км</span>
        </div>

        {startDateText ? (
          <Text style={{ ...captionStyle, marginTop: SPACING.sm }}>
            План составлен {startDateText}
          </Text>
        ) : null}
      </div>

      {/* Что делать сегодня */}
      <Text style={sectionTitleStyle}>
        {todaySessions.length > 0
          ? 'Сегодня'
          : nextSession
            ? 'Следующая тренировка'
            : 'План завершён'}
      </Text>

      {todaySessions.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
          {todaySessions.map((session, index) => (
            <div key={session.id}>
              {renderSessionCard(session, index === 0 ? 'Сегодня' : 'Ещё сегодня')}
            </div>
          ))}
        </div>
      ) : allDone ? (
        <div style={cardStyle}>
          <Text
            style={{
              color: COLORS.accent,
              fontSize: FONT_SIZE.subtitleSmall,
              lineHeight: LINE_HEIGHT.title,
              fontStyle: 'italic',
            }}
          >
            Все тренировки плана отмечены
          </Text>
          <Text style={{ ...captionStyle, marginTop: SPACING.xs }}>
            Выполнено {view.doneCount} тренировок, {view.doneKm} км, пропущено {view.skippedCount}. Это
            хорошая база перед следующим стартом.
          </Text>
          <div style={{ marginTop: SPACING.md }}>
            <Button mode="secondary" size="m" onClick={onEdit}>
              Составить новый план
            </Button>
          </div>
        </div>
      ) : nextSession ? (
        <div>
          {renderSessionCard(nextSession, 'Следующая тренировка')}
          <Text style={{ ...captionStyle, marginTop: SPACING.sm }}>
            {nextSession.day}, {formatShortDate(nextSession.effectiveDate)} · неделя{' '}
            {nextSession.weekIndex}
          </Text>
        </div>
      ) : (
        <div style={cardStyle}>
          <Text style={{ ...captionStyle, color: COLORS.text }}>
            Свободных тренировок не осталось. Можно составить новый план к следующему старту.
          </Text>
          <div style={{ marginTop: SPACING.md }}>
            <Button mode="secondary" size="m" onClick={onEdit}>
              Составить новый план
            </Button>
          </div>
        </div>
      )}

      {/* Предупреждения */}
      {view.daysLeft >= 0 && view.daysLeft < 21 ? (
        <div style={{ ...cardStyle, borderColor: COLORS.warning, marginTop: SPACING.md }}>
          <Text style={{ color: COLORS.warning, fontSize: FONT_SIZE.body, lineHeight: LINE_HEIGHT.body }}>
            До старта меньше трёх недель: план сжатый. Не добавляйте объём сверху — лучше прийти на
            старт отдохнувшим.
          </Text>
        </div>
      ) : null}

      {plan.goalKm === 42 && plan.level === 'novice' ? (
        <div style={{ ...cardStyle, borderColor: COLORS.warning, marginTop: SPACING.md }}>
          <Text style={{ color: COLORS.warning, fontSize: FONT_SIZE.body, lineHeight: LINE_HEIGHT.body }}>
            Марафон с нуля — рискованно. Если появится боль в колене, голени или стопе, пропустите
            тренировку и покажитесь врачу.
          </Text>
        </div>
      ) : null}

      {view.skippedCount >= 2 ? (
        <div style={{ ...cardStyle, marginTop: SPACING.md }}>
          <Text style={{ ...captionStyle, color: COLORS.text }}>
            Пропуски — это нормально. Не догоняйте: объём не растёт задним числом, а при двух
            пропусках подряд лучше сделать следующую неделю легче.
          </Text>
        </div>
      ) : null}

      {!view.racePassed && overdue > 0 ? (
        <div style={{ ...cardStyle, marginTop: SPACING.md }}>
          <Text style={{ ...captionStyle, color: COLORS.text }}>
            Без отметки осталось {overdue}{' '}
            {plural(overdue, 'тренировка', 'тренировки', 'тренировок')}. Откройте нужную неделю в
            списке ниже, чтобы отметить её выполненной или пропустить.
          </Text>
        </div>
      ) : null}

      {/* Неделя по дням */}
      <Text style={sectionTitleStyle}>
        Неделя {view.currentWeekIndex} ·{' '}
        {PHASE_TITLES[plan.weeks.find((week) => week.index === view.currentWeekIndex)?.phase ?? 'base']}
      </Text>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 6,
          marginBottom: SPACING.sm,
        }}
      >
        {WEEKDAYS.map((label, index) => {
          const date = shiftDate(weekStart, index);
          const daySessions = currentWeekSessions.filter(
            (session) => session.effectiveDate === date
          );
          const isToday = date === today;
          const color =
            daySessions.length > 0
              ? statusColor(daySessions[0].status, isToday)
              : isToday
                ? COLORS.borderStrong
                : COLORS.border;
          return (
            <div
              key={label}
              style={{
                ...cardStyle,
                padding: `${SPACING.sm}px 4px`,
                textAlign: 'center',
                borderColor: isToday ? COLORS.accent : COLORS.border,
                boxShadow: 'none',
              }}
            >
              <Text style={{ ...captionStyle, fontSize: 11 }}>{label}</Text>
              <Text style={{ color: COLORS.text, fontSize: FONT_SIZE.body, lineHeight: 1.1 }}>
                {Number(date.slice(8, 10))}
              </Text>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  margin: '4px auto 0',
                  background: color,
                }}
              />
            </div>
          );
        })}
      </div>
      <Text style={captionStyle}>
        Зелёная точка — выполнено, красная — пропущено, жёлтая — сегодня, светлая — впереди.
      </Text>

      {/* Весь план */}
      <Text style={sectionTitleStyle}>Весь план</Text>
      {plan.weeks.map((week) => {
        const sessions = view.sessions.filter((session) => session.weekIndex === week.index);
        const expanded = openWeek === week.index;
        return (
          <div key={week.index} style={{ marginBottom: SPACING.sm }}>
            <button
              type="button"
              onClick={() => setOpenWeek(expanded ? null : week.index)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: SPACING.sm,
                padding: '12px 14px',
                borderRadius: RADIUS.md,
                border: `1px solid ${expanded ? COLORS.borderStrong : COLORS.border}`,
                background: COLORS.surface,
                color: COLORS.text,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: FONT,
              }}
            >
              <span style={{ flex: 1, fontSize: FONT_SIZE.body }}>
                Неделя {week.index} · {formatKmNumber(week.volumeKm)} км
              </span>
              <span style={{ ...captionStyle, fontSize: FONT_SIZE.caption }}>
                {PHASE_TITLES[week.phase]}
                {week.cutback ? ' · разгрузка' : ''}
              </span>
              <span style={{ color: COLORS.textSecondary }}>{expanded ? '−' : '+'}</span>
            </button>

            {expanded ? (
              <div style={{ marginTop: SPACING.sm, display: 'flex', flexDirection: 'column', gap: SPACING.sm }}>
                {sessions.map((session) =>
                  openSessionId === session.id ? (
                    <div key={session.id}>
                      {renderSessionCard(session)}
                      <Button
                        mode="tertiary"
                        size="s"
                        style={{ marginTop: SPACING.xs }}
                        onClick={() => setOpenSessionId(null)}
                      >
                        Свернуть
                      </Button>
                    </div>
                  ) : (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => setOpenSessionId(session.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: SPACING.sm,
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: RADIUS.md,
                        border: `1px solid ${COLORS.border}`,
                        background: 'rgba(0, 0, 0, 0.18)',
                        color: COLORS.text,
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'inherit',
                        fontSize: FONT_SIZE.body,
                      }}
                    >
                      <span style={{ width: 44, color: COLORS.textSecondary, fontSize: FONT_SIZE.caption }}>
                        {session.day}
                      </span>
                      <span style={{ flex: 1 }}>{session.title}</span>
                      <span style={{ color: COLORS.textSecondary, fontSize: FONT_SIZE.caption }}>
                        {session.effectiveDate !== session.date
                          ? `${formatShortDate(session.effectiveDate)} · перенесено`
                          : `${formatKmNumber(session.distanceKm ?? 0)} км`}
                      </span>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          background: statusColor(session.status, session.effectiveDate === today),
                        }}
                      />
                    </button>
                  )
                )}
              </div>
            ) : null}
          </div>
        );
      })}

      {/* Настройки */}
      <Text style={sectionTitleStyle}>Настройки плана</Text>
      <div style={cardStyle}>
        <div style={{ ...captionStyle, color: COLORS.text, display: 'grid', gap: 6 }}>
          <span>Цель: {GOAL_DISTANCE_TEXT[plan.goalKm]}</span>
          <span>Старт: {formatPlanDate(plan.raceDate)}</span>
          <span>Уровень: {LEVEL_TITLES[plan.level]}</span>
          <span>
            Дней в неделю: {plan.daysPerWeek} · объём: {plan.weeklyKm} км
          </span>
          {state.input.age ? <span>Возраст: {state.input.age}</span> : null}
          {plan.paces.source === 'result' ? (
            <span>Темпы уточнены по вашему результату</span>
          ) : (
            <span>Темпы оценены по уровню и объёму</span>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md }}>
          <Button mode="secondary" size="m" onClick={onEdit}>
            Изменить параметры
          </Button>
          {confirmDelete ? (
            <>
              <Button appearance="negative" size="m" onClick={onDelete}>
                Удалить
              </Button>
              <Button mode="tertiary" size="m" onClick={() => setConfirmDelete(false)}>
                Отмена
              </Button>
            </>
          ) : (
            <Button mode="tertiary" size="m" onClick={() => setConfirmDelete(true)}>
              Удалить план
            </Button>
          )}
        </div>
        {confirmDelete ? (
          <Text style={{ ...captionStyle, color: COLORS.danger, marginTop: SPACING.sm }}>
            План и все отметки удалятся с этого устройства.
          </Text>
        ) : null}
      </div>
    </div>
  );
};
