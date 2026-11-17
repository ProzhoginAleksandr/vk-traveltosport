// src/panels/ClubRun.tsx
// Экран клубного пробега: общие километры за месяц, участники и цель клуба.
// Показываются только суммы — без имён, маршрутов и личных результатов.
import { Panel, Text, Button } from '@vkontakte/vkui';
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router';

import { AppTabbar } from '../components/AppTabbar';
import { BackButton } from '../components/BackButton';
import { PageBackground } from '../components/PageBackground';
import { CLUB_ENABLED, CLUB_MONTH_GOAL_KM } from '../config/club';
import { useClubStats } from '../hooks/useClubStats';
import { formatClubNumber, monthTitle } from '../utils/club';
import { COLORS, FONT_SIZE, LINE_HEIGHT, RADIUS, SPACING } from '../styles/tokens';

const FONT = 'Oswald, Impact, "Arial Narrow", Arial, sans-serif';

interface ClubRunProps {
  id: string;
}

export const ClubRun = ({ id }: ClubRunProps) => {
  const routeNavigator = useRouteNavigator();
  const { stats, ownKm, loading, refresh } = useClubStats();
  const progress = stats ? Math.min(100, Math.round((stats.km / CLUB_MONTH_GOAL_KM) * 100)) : 0;

  return (
    <Panel id={id} style={{ background: 'transparent', padding: 0 }}>
      <PageBackground variant="blue" pattern="track" paddingBottom={96} style={{ fontFamily: FONT }}>
        <BackButton to="/" />

        <Text
          style={{
            color: COLORS.text,
            fontSize: FONT_SIZE.title,
            lineHeight: LINE_HEIGHT.title,
            fontStyle: 'italic',
            marginTop: SPACING.md,
            marginBottom: SPACING.sm,
          }}
        >
          Клубный пробег
        </Text>
        <Text style={{ ...caption, marginBottom: SPACING.lg }}>
          Общая дистанция всех участников за месяц. Считаются только импортированные тренировки —
          то, что подтверждено файлом из часов или телефона.
        </Text>

        {!CLUB_ENABLED ? (
          <div style={card}>
            <Text style={{ ...sectionTitle }}>Пока не подключено</Text>
            <Text style={paragraph}>
              Клубный пробег включается, когда настроен бэкенд. После публикации статистика появится
              здесь автоматически.
            </Text>
          </div>
        ) : !stats ? (
          <div style={card}>
            <Text style={sectionTitle}>{loading ? 'Считаем километры…' : 'Пока нет данных'}</Text>
            <Text style={paragraph}>
              {loading
                ? 'Отправляем ваш месячный объём и забираем общую сумму.'
                : 'Ни у кого ещё нет импортированных тренировок за этот месяц — станьте первым.'}
            </Text>
            <Button
              size="m"
              mode="secondary"
              loading={loading}
              style={{ marginTop: SPACING.md }}
              onClick={refresh}
            >
              Обновить
            </Button>
          </div>
        ) : (
          <>
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <Text style={{ ...labelText }}>{monthTitle(stats.month)}</Text>
                <Text style={caption}>цель {formatClubNumber(CLUB_MONTH_GOAL_KM)} км</Text>
              </div>
              <Text
                style={{
                  color: COLORS.text,
                  fontSize: 44,
                  lineHeight: 1.05,
                  marginTop: 4,
                  fontFamily: FONT,
                }}
              >
                {formatClubNumber(stats.km)} км
              </Text>
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: 'rgba(255, 255, 255, 0.14)',
                  overflow: 'hidden',
                  marginTop: SPACING.md,
                }}
              >
                <div
                  style={{
                    width: `${progress}%`,
                    height: '100%',
                    borderRadius: 4,
                    background: 'linear-gradient(90deg, #4CAF50, #bedda2)',
                    transition: 'width 300ms ease',
                  }}
                />
              </div>
              <Text style={{ ...caption, marginTop: SPACING.sm }}>
                {progress}% месячной цели клуба
              </Text>
            </div>

            <div style={card}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACING.md }}>
                <div>
                  <Text style={labelText}>Участники</Text>
                  <Text style={valueText}>{formatClubNumber(stats.users)}</Text>
                </div>
                <div>
                  <Text style={labelText}>Ваш вклад</Text>
                  <Text style={valueText}>{formatClubNumber(ownKm ?? 0)} км</Text>
                </div>
              </div>
              <Button
                size="m"
                mode="secondary"
                loading={loading}
                style={{ marginTop: SPACING.md }}
                onClick={refresh}
              >
                Обновить
              </Button>
            </div>

            <div style={card}>
              <Text style={sectionTitle}>Как это считается</Text>
              <Text style={paragraph}>
                В сумму попадают только импортированные тренировки — GPX или TCX из часов и
                приложений. Ручные отметки в программе подготовки не учитываются: это план, а не
                факт. Показываем только суммы по всем участникам, без имён, маршрутов и личных
                результатов.
              </Text>
              <Text style={{ ...caption, marginTop: SPACING.sm }}>
                Последнее обновление:{' '}
                {new Date(stats.fetchedAt).toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </div>
          </>
        )}

        <Button
          mode="tertiary"
          size="m"
          style={{ marginTop: SPACING.lg }}
          onClick={() => routeNavigator.push('/')}
        >
          На главную
        </Button>
      </PageBackground>

      <AppTabbar active="home" />
    </Panel>
  );
};

const card = {
  background: COLORS.surface,
  border: `1px solid ${COLORS.border}`,
  borderRadius: RADIUS.lg,
  padding: SPACING.lg,
  marginTop: SPACING.md,
  fontFamily: FONT,
};

const sectionTitle = {
  color: COLORS.text,
  fontSize: FONT_SIZE.subtitleSmall,
  lineHeight: LINE_HEIGHT.title,
  fontStyle: 'italic' as const,
  marginBottom: SPACING.sm,
};

const paragraph = {
  color: COLORS.text,
  fontSize: FONT_SIZE.body,
  lineHeight: LINE_HEIGHT.body,
  fontFamily: FONT,
};

const caption = {
  color: COLORS.textSecondary,
  fontSize: FONT_SIZE.caption,
  lineHeight: LINE_HEIGHT.caption,
  fontFamily: FONT,
};

const labelText = {
  color: COLORS.textSecondary,
  fontSize: 11,
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  fontFamily: FONT,
};

const valueText = {
  color: COLORS.text,
  fontSize: FONT_SIZE.subtitle,
  lineHeight: LINE_HEIGHT.title,
  fontFamily: FONT,
};

export default ClubRun;
