// src/panels/Home.tsx
import { Panel, Group, Cell, Title, Text } from '@vkontakte/vkui';
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router';
import headerImage from '../assets/images/HomeHeader.png';
import calcIcon from '../assets/images/CalculatorIcon.png';
import brainIcon from '../assets/images/BrainBoosterIcon.png';
import diaryIcon from '../assets/images/DiaryIcon.png';
import profileIcon from '../assets/images/ProfileIcon.png';
import { PageBackground } from '../components/PageBackground';
import { Icon24CalendarOutline } from '@vkontakte/icons';
import { loadPlanState } from '../utils/planStorage';
import { buildPlanView, plural } from '../utils/planProgress';
import { todayISO } from '../utils/racePlan';
import { formatKmNumber } from '../utils/racePlan';

interface HomeProps {
  id: string;
}

const colors = {
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
};

export const Home = ({ id }: HomeProps) => {
  const routeNavigator = useRouteNavigator();

  const planState = loadPlanState();
  const planView = planState ? buildPlanView(planState, todayISO()) : null;
  const planToday = planView?.todaySessions[0] ?? null;
  const planSubtitle = !planView
    ? 'Поставьте цель и получите план на каждую неделю'
    : planToday
      ? `Сегодня: ${planToday.title.toLowerCase()} · ${formatKmNumber(planToday.distanceKm ?? 0)} км`
      : planView.racePassed
        ? `Старт позади · выполнено ${planView.doneCount} из ${planView.total}`
        : planView.nextSession
          ? `До старта ${planView.daysLeft} ${plural(planView.daysLeft, 'день', 'дня', 'дней')} · ${planView.doneCount} из ${planView.total} тренировок`
          : `Выполнено ${planView.doneCount} из ${planView.total}`;

  return (
    <Panel id={id} style={{ background: 'transparent', padding: 0 }}>
      <style>{`
        .vkuiGroup { background: transparent !important; }
      `}</style>

      <PageBackground variant="green" pattern="ridge" paddingBottom={24}>
        {/* Header */}
        <div
          style={{
            paddingTop: '40px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <img
            src={headerImage}
            alt="TraveltoSport"
            style={{ width: '100%', maxWidth: '380px', height: 'auto', objectFit: 'contain' }}
          />
        </div>

        {/* План до старта */}
        <Group
          style={{
            background: 'rgba(76, 175, 80, 0.12)',
            borderRadius: '16px',
            marginBottom: '12px',
            border: '1px solid rgba(76, 175, 80, 0.45)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            padding: '4px 0',
          }}
        >
          <Cell onClick={() => routeNavigator.push('/race_plan')} style={{ color: colors.text }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  background: 'rgba(76, 175, 80, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#4CAF50',
                  flexShrink: 0,
                }}
              >
                <Icon24CalendarOutline />
              </div>
              <div style={{ minWidth: 0 }}>
                <Text
                  weight="2"
                  style={{ color: colors.text, fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}
                >
                  План до старта
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: '13px',
                    fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
                    whiteSpace: 'normal',
                  }}
                >
                  {planSubtitle}
                </Text>
                {planView && planView.percent > 0 ? (
                  <div
                    style={{
                      height: '4px',
                      borderRadius: '2px',
                      background: 'rgba(255, 255, 255, 0.12)',
                      marginTop: '6px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${planView.percent}%`,
                        height: '100%',
                        background: '#4CAF50',
                        borderRadius: '2px',
                      }}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </Cell>
        </Group>

        {/* Заголовок */}
        <Title
          level="2"
          style={{
            color: colors.text,
            marginTop: '16px',
            marginBottom: '16px',
            fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
            fontSize: '20px',
          }}
        >
          Инструменты
        </Title>

        {/* Карточка 1 — Профиль пользователя */}
        <Group
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            marginBottom: '12px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            padding: '4px 0',
          }}
        >
          <Cell
            onClick={() => routeNavigator.push('/profile')}
            style={{ color: colors.text }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img
                src={profileIcon}
                alt="Личный кабинет"
                style={{ width: '32px', height: '32px', objectFit: 'contain' }}
              />
              <div>
                <Text weight="2" style={{ color: colors.text, fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>
                  Личный кабинет
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: '13px',
                    fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
                    whiteSpace: 'normal',
                  }}
                >
                  Ваши персональные достижения
                </Text>
              </div>
            </div>
          </Cell>
        </Group>
        
{/* Карточка 2 — Ваши тренировки */}
<Group
  style={{
    background: 'rgba(255, 255, 255, 0.08)',
    borderRadius: '16px',
    marginBottom: '12px',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    padding: '4px 0',
  }}
>
  <Cell
    onClick={() => routeNavigator.push('/training_diary')}
    style={{ color: colors.text }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <img
        src={diaryIcon}
        alt="Дневник тренировок"
        style={{ width: '32px', height: '32px', objectFit: 'contain' }}
      />
      <div>
        <Text weight="2" style={{ color: colors.text, fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>
          Дневник тренировок
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: '13px', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>
          Трекер и импорт тренировок
        </Text>
      </div>
    </div>
  </Cell>
</Group>

        {/* Карточка 3 — Калькулятор бегуна */}
        <Group
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            marginBottom: '12px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            padding: '4px 0',
          }}
        >
          <Cell
            onClick={() => routeNavigator.push('/runner_calculator')}
            style={{ color: colors.text }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img
                src={calcIcon}
                alt="Калькулятор бегуна"
                style={{ width: '32px', height: '32px', objectFit: 'contain' }}
              />
              <div>
                <Text weight="2" style={{ color: colors.text, fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>
                  Калькулятор бегуна
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: '13px',
                    fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
                    whiteSpace: 'normal',
                  }}
                >
                  Расчёт основных метрик бега
                </Text>
              </div>
            </div>
          </Cell>
        </Group>

        {/* Карточка 4 — Брейнбустер */}
        <Group
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            marginBottom: '12px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            padding: '4px 0',
          }}
        >
          <Cell
            onClick={() => routeNavigator.push('/brain_booster')}
            style={{ color: colors.text }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img
                src={brainIcon}
                alt="Брейнбустер"
                style={{ width: '32px', height: '32px', objectFit: 'contain' }}
              />
              <div>
                <Text weight="2" style={{ color: colors.text, fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>
                  Брейнбустер
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: '13px', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>
                  Тренируйте извилины
                </Text>
              </div>
            </div>
          </Cell>
        </Group>



      </PageBackground>

    </Panel>
  );
};
export default Home;
