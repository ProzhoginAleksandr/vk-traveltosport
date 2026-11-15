// src/components/racePlan/PlanOnboarding.tsx
// Три коротких шага: цель и дата, опыт и объём, возраст и необязательный
// недавний результат. После них сразу видно, что получится, — план считается
// на лету и сохраняется только по кнопке «Составить план».

import { useState } from 'react';
import { Button, Text } from '@vkontakte/vkui';

import {
  buildRacePlan,
  daysUntilRace,
  formatKmNumber,
  formatPace,
  formatRaceTime,
  GOAL_DISTANCE_TEXT,
  LEVEL_TITLES,
  shiftDate,
  todayISO,
  type GoalDistance,
  type Level,
  type PlanInput,
} from '../../utils/racePlan';
import { formatPlanDate, plural } from '../../utils/planProgress';
import { COLORS, FONT_SIZE, LINE_HEIGHT, SPACING } from '../../styles/tokens';
import { captionStyle, cardStyle, choiceStyle, fieldStyle, sectionTitleStyle } from './ui';

interface PlanOnboardingProps {
  initial?: PlanInput;
  onSubmit: (input: PlanInput) => void;
  onCancel: () => void;
}

const GOALS: GoalDistance[] = [5, 10, 21, 42];
const DAYS = [2, 3, 4, 5, 6];
const VOLUME_PRESETS = [10, 20, 30, 40, 50];
const LEVELS: Array<{ value: Level; description: string }> = [
  { value: 'novice', description: 'Бегаю меньше года или начинаю с нуля' },
  { value: 'stable', description: 'Бегаю год-три, тренировки регулярные' },
  { value: 'advanced', description: 'Больше трёх лет, знаю свои темпы и объёмы' },
];
const STEP_TITLES = [
  'К какому забегу готовимся?',
  'Какая у вас сейчас форма?',
  'Ещё пара деталей',
];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const parseNumber = (value: string, fallback = 0): number => {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const percentText = (ratio: number): string => `${(ratio * 100).toFixed(1).replace('.', ',')}%`;

export const PlanOnboarding = ({ initial, onSubmit, onCancel }: PlanOnboardingProps) => {
  const [step, setStep] = useState(0);
  const [goalKm, setGoalKm] = useState<GoalDistance>(initial?.goalKm ?? 10);
  const [raceDate, setRaceDate] = useState(initial?.raceDate ?? shiftDate(todayISO(), 56));
  const [level, setLevel] = useState<Level>(initial?.level ?? 'stable');
  const [daysPerWeek, setDaysPerWeek] = useState(initial?.daysPerWeek ?? 3);
  const [weeklyKmText, setWeeklyKmText] = useState(
    initial ? String(initial.weeklyKm) : '20'
  );
  const [ageText, setAgeText] = useState(initial?.age ? String(initial.age) : '');
  const [useResult, setUseResult] = useState(Boolean(initial?.recentResult));
  const [resultKm, setResultKm] = useState<GoalDistance>(
    (initial?.recentResult?.distanceKm as GoalDistance | undefined) ?? 10
  );
  const [resultMinText, setResultMinText] = useState(
    initial?.recentResult ? String(Math.floor(initial.recentResult.timeSec / 60)) : ''
  );
  const [resultSecText, setResultSecText] = useState(
    initial?.recentResult ? String(initial.recentResult.timeSec % 60) : ''
  );
  const [useTarget, setUseTarget] = useState(Boolean(initial?.targetTimeSec));
  const [targetMinText, setTargetMinText] = useState(
    initial?.targetTimeSec ? String(Math.floor(initial.targetTimeSec / 60)) : ''
  );
  const [targetSecText, setTargetSecText] = useState(
    initial?.targetTimeSec ? String(initial.targetTimeSec % 60) : ''
  );

  const dateValid = DATE_RE.test(raceDate) && daysUntilRace(raceDate) >= 1;
  const daysLeft = dateValid ? daysUntilRace(raceDate) : 0;
  const weeklyKm = parseNumber(weeklyKmText, 0);
  const ageValue = parseNumber(ageText, 0);
  const age = ageValue >= 10 && ageValue <= 90 ? Math.round(ageValue) : undefined;
  const resultTime =
    parseNumber(resultMinText, 0) * 60 + Math.min(59, Math.max(0, parseNumber(resultSecText, 0)));
  const targetTime =
    parseNumber(targetMinText, 0) * 60 + Math.min(59, Math.max(0, parseNumber(targetSecText, 0)));
  const targetValid = useTarget && targetTime >= 60;

  const composeInput = (): PlanInput => ({
    goalKm,
    raceDate,
    level,
    daysPerWeek,
    weeklyKm,
    age,
    recentResult: useResult && resultTime >= 300 ? { distanceKm: resultKm, timeSec: resultTime } : undefined,
    targetTimeSec: targetValid ? targetTime : undefined,
    startDate: todayISO(),
  });

  const preview = dateValid ? buildRacePlan(composeInput()) : null;
  const improvementSec = preview ? preview.paces.currentTimeSec - preview.paces.targetTimeSec : 0;
  const improvementRatio =
    preview && preview.paces.currentTimeSec > 0 ? improvementSec / preview.paces.currentTimeSec : 0;

  const canNext = step === 0 ? dateValid : true;

  const handleNext = () => {
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    onSubmit(composeInput());
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: SPACING.sm, marginBottom: SPACING.lg }}>
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: index <= step ? COLORS.accent : COLORS.border,
            }}
          />
        ))}
      </div>

      <Text
        style={{
          color: COLORS.text,
          fontSize: FONT_SIZE.title,
          lineHeight: LINE_HEIGHT.title,
          marginBottom: SPACING.xs,
          fontStyle: 'italic',
        }}
      >
        {STEP_TITLES[step]}
      </Text>
      <Text style={{ ...captionStyle, marginBottom: SPACING.lg }}>
        {step === 0
          ? 'От цели зависит длина длинных тренировок и целевой темп.'
          : step === 1
            ? 'Честные ответы дают план, который реально выполнить.'
            : 'Эти данные влияют на темпы и пульсовые зоны. Оба пункта можно пропустить.'}
      </Text>

      {step === 0 ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACING.sm }}>
            {GOALS.map((goal) => (
              <button
                key={goal}
                type="button"
                onClick={() => setGoalKm(goal)}
                style={{ ...choiceStyle(goalKm === goal), minWidth: 0, padding: '14px 12px' }}
              >
                {GOAL_DISTANCE_TEXT[goal]}
              </button>
            ))}
          </div>

          <Text style={sectionTitleStyle}>Дата старта</Text>
          <input
            type="date"
            value={raceDate}
            min={shiftDate(todayISO(), 1)}
            onChange={(event) => setRaceDate(event.target.value)}
            style={fieldStyle}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm }}>
            {[6, 8, 12, 16].map((weeks) => (
              <button
                key={weeks}
                type="button"
                onClick={() => setRaceDate(shiftDate(todayISO(), weeks * 7))}
                style={{ ...choiceStyle(false), flex: '0 0 auto', minWidth: 0, padding: '8px 10px', fontSize: FONT_SIZE.caption }}
              >
                через {weeks} {plural(weeks, 'неделю', 'недели', 'недель')}
              </button>
            ))}
          </div>
          <Text style={{ ...captionStyle, marginTop: SPACING.sm }}>
            {dateValid
              ? `До старта ${daysLeft} ${plural(daysLeft, 'день', 'дня', 'дней')}.`
              : 'Выберите дату в будущем.'}
          </Text>
          {dateValid && daysLeft < 21 ? (
            <Text style={{ ...captionStyle, color: COLORS.warning, marginTop: SPACING.xs }}>
              До старта меньше трёх недель: план получится сжатым. Это скорее напоминание, чем
              полноценная подготовка.
            </Text>
          ) : null}
        </>
      ) : null}

      {step === 1 ? (
        <>
          <Text style={sectionTitleStyle}>Опыт</Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm }}>
            {LEVELS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setLevel(item.value)}
                style={{
                  ...choiceStyle(level === item.value),
                  textAlign: 'left',
                  padding: '12px 14px',
                }}
              >
                <span style={{ display: 'block', fontSize: FONT_SIZE.body }}>{LEVEL_TITLES[item.value]}</span>
                <span
                  style={{
                    display: 'block',
                    color: level === item.value ? COLORS.text : COLORS.textSecondary,
                    fontSize: FONT_SIZE.caption,
                    lineHeight: LINE_HEIGHT.caption,
                    marginTop: 2,
                  }}
                >
                  {item.description}
                </span>
              </button>
            ))}
          </div>

          <Text style={sectionTitleStyle}>Сколько дней в неделю можете бегать?</Text>
          <div style={{ display: 'flex', gap: SPACING.sm }}>
            {DAYS.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setDaysPerWeek(days)}
                style={{ ...choiceStyle(daysPerWeek === days), minWidth: 0, padding: '10px 0' }}
              >
                {days}
              </button>
            ))}
          </div>

          <Text style={sectionTitleStyle}>Текущий объём, км в неделю</Text>
          <input
            value={weeklyKmText}
            onChange={(event) => setWeeklyKmText(event.target.value.replace(/[^\d.,]/g, ''))}
            inputMode="decimal"
            placeholder="20"
            style={fieldStyle}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm }}>
            {VOLUME_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setWeeklyKmText(String(preset))}
                style={{ ...choiceStyle(weeklyKm === preset), flex: '0 0 auto', minWidth: 0, padding: '8px 12px', fontSize: FONT_SIZE.caption }}
              >
                {preset} км
              </button>
            ))}
          </div>
          <Text style={{ ...captionStyle, marginTop: SPACING.sm }}>
            Если не знаете точно — поставьте примерно. План всё равно начнётся с безопасного объёма.
          </Text>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Text style={sectionTitleStyle}>Возраст</Text>
          <input
            value={ageText}
            onChange={(event) => setAgeText(event.target.value.replace(/[^\d]/g, ''))}
            inputMode="numeric"
            placeholder="Например, 35"
            style={fieldStyle}
          />
          <Text style={{ ...captionStyle, marginTop: SPACING.sm }}>
            Нужен только для пульсовых зон. Можно пропустить — тогда зоны будут «по самочувствию».
          </Text>

          <Text style={sectionTitleStyle}>Недавний результат</Text>
          <button
            type="button"
            onClick={() => setUseResult(!useResult)}
            style={{ ...choiceStyle(useResult), display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px' }}
          >
            {useResult ? 'Указан — темпы точнее' : 'У меня есть результат за последние 3 месяца'}
          </button>

          {useResult ? (
            <div style={{ marginTop: SPACING.md }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: SPACING.sm }}>
                {GOALS.map((goal) => (
                  <button
                    key={goal}
                    type="button"
                    onClick={() => setResultKm(goal)}
                    style={{ ...choiceStyle(resultKm === goal), minWidth: 0, padding: '8px 0', fontSize: FONT_SIZE.caption }}
                  >
                    {goal} км
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm }}>
                <input
                  value={resultMinText}
                  onChange={(event) => setResultMinText(event.target.value.replace(/[^\d]/g, ''))}
                  inputMode="numeric"
                  placeholder="минуты"
                  style={{ ...fieldStyle, width: '50%' }}
                />
                <Text style={{ color: COLORS.textSecondary }}>:</Text>
                <input
                  value={resultSecText}
                  onChange={(event) => setResultSecText(event.target.value.replace(/[^\d]/g, ''))}
                  inputMode="numeric"
                  placeholder="секунды"
                  style={{ ...fieldStyle, width: '50%' }}
                />
              </div>
            </div>
          ) : null}

          <Text style={sectionTitleStyle}>Желаемый результат</Text>
          <button
            type="button"
            onClick={() => setUseTarget(!useTarget)}
            style={{
              ...choiceStyle(useTarget),
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '12px 14px',
            }}
          >
            {useTarget
              ? 'Цель указана — план построится под неё'
              : 'Хочу задать желаемое время на финише'}
          </button>

          {useTarget ? (
            <div style={{ marginTop: SPACING.md }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
                <input
                  value={targetMinText}
                  onChange={(event) => setTargetMinText(event.target.value.replace(/[^\d]/g, ''))}
                  inputMode="numeric"
                  placeholder="минуты"
                  style={{ ...fieldStyle, width: '50%' }}
                />
                <Text style={{ color: COLORS.textSecondary }}>:</Text>
                <input
                  value={targetSecText}
                  onChange={(event) => setTargetSecText(event.target.value.replace(/[^\d]/g, ''))}
                  inputMode="numeric"
                  placeholder="секунды"
                  style={{ ...fieldStyle, width: '50%' }}
                />
              </div>

              {targetValid && preview ? (
                <Text style={{ ...captionStyle, marginTop: SPACING.sm }}>
                  {improvementSec > 0
                    ? `Это на ${formatRaceTime(improvementSec)} быстрее текущей формы (${percentText(
                        improvementRatio
                      )}).`
                    : improvementSec < 0
                      ? `Это на ${formatRaceTime(-improvementSec)} медленнее текущей формы — нормально для комфортного финиша.`
                      : 'Это ровно ваша текущая форма.'}
                </Text>
              ) : (
                <Text style={{ ...captionStyle, marginTop: SPACING.sm }}>
                  Укажите время, за которое хотите финишировать на дистанции забега.
                </Text>
              )}

              {targetValid && preview && preview.paces.assessment === 'unrealistic' ? (
                <Text style={{ ...captionStyle, color: COLORS.warning, marginTop: SPACING.xs }}>
                  Цель больше чем на 10% быстрее текущей формы — план будет очень тяжёлым. Лучше
                  выбрать цель поскромнее или увеличить срок подготовки.
                </Text>
              ) : null}
              {targetValid && preview && preview.paces.assessment === 'ambitious' ? (
                <Text style={{ ...captionStyle, color: COLORS.warning, marginTop: SPACING.xs }}>
                  На 5–10% быстрее текущей формы — амбициозно, но выполнимо при регулярных
                  тренировках.
                </Text>
              ) : null}
            </div>
          ) : null}

          {preview ? (
            <div style={{ ...cardStyle, marginTop: SPACING.lg }}>
              <Text style={{ ...captionStyle, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Вот что получится
              </Text>
              <Text
                style={{
                  color: COLORS.text,
                  fontSize: FONT_SIZE.subtitleSmall,
                  lineHeight: LINE_HEIGHT.title,
                  margin: `${SPACING.xs}px 0`,
                  fontStyle: 'italic',
                }}
              >
                {preview.weeksTotal} {plural(preview.weeksTotal, 'неделя', 'недели', 'недель')} до старта
              </Text>
              <Text style={{ ...captionStyle, color: COLORS.text }}>
                {formatPlanDate(preview.raceDate)} · {GOAL_DISTANCE_TEXT[goalKm]} ·{' '}
                {preview.daysPerWeek} {plural(preview.daysPerWeek, 'тренировка', 'тренировки', 'тренировок')} в
                неделю
              </Text>
              <Text style={{ ...captionStyle, marginTop: SPACING.sm }}>
                Пик объёма {formatKmNumber(preview.peakKm)} км · лёгкий темп {formatPace(preview.paces.easy[0])}–
                {formatPace(preview.paces.easy[1])} /км
              </Text>
              <Text style={{ ...captionStyle, marginTop: SPACING.xs, color: COLORS.text }}>
                Сейчас {GOAL_DISTANCE_TEXT[goalKm]}:{' '}
                {formatRaceTime(preview.paces.currentTimeSec)} · цель:{' '}
                {formatRaceTime(preview.paces.targetTimeSec)} ({formatPace(preview.paces.goal)} /км)
              </Text>
              <Text style={{ ...captionStyle, marginTop: SPACING.xs }}>
                Прогноз плана: {formatRaceTime(preview.paces.predictedTimeSec)} · заложено улучшение{' '}
                {percentText(preview.paces.gainRatio)}
                {preview.paces.goalSource === 'user'
                  ? ' · цель ваша'
                  : ' · цель рассчитана автоматически'}
              </Text>
              {goalKm === 42 && level === 'novice' ? (
                <Text style={{ ...captionStyle, color: COLORS.warning, marginTop: SPACING.sm }}>
                  Марафон с нуля — рискованно для здоровья. План будет очень щадящим, но лучше
                  обсудить подготовку с врачом и тренером.
                </Text>
              ) : null}
            </div>
          ) : null}

          <Text style={{ ...captionStyle, marginTop: SPACING.lg }}>
            План не заменяет тренера и медицинскую консультацию. При боли в груди, головокружении
            или травме тренировку нужно прекратить и обратиться к врачу.
          </Text>
          <Text style={{ ...captionStyle, marginTop: SPACING.sm }}>
            План хранится только на этом устройстве. Если очистить кэш приложения, его придётся
            составить заново.
          </Text>
        </>
      ) : null}

      <div style={{ display: 'flex', gap: SPACING.sm, marginTop: SPACING.xxl }}>
        {step > 0 ? (
          <Button mode="secondary" size="l" onClick={() => setStep(step - 1)}>
            Назад
          </Button>
        ) : (
          <Button mode="secondary" size="l" onClick={onCancel}>
            Отмена
          </Button>
        )}
        <div style={{ flex: 1 }}>
          <Button
            size="l"
            stretched
            appearance="accent"
            disabled={!canNext}
            onClick={handleNext}
          >
            {step === 2 ? 'Составить план' : 'Далее'}
          </Button>
        </div>
      </div>
    </div>
  );
};
