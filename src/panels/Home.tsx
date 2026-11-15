// src/panels/Home.tsx
import { useEffect } from 'react';
import { Panel, Group, Cell, Title, Text } from '@vkontakte/vkui';
import { useActiveVkuiLocation, useRouteNavigator } from '@vkontakte/vk-mini-apps-router';
import headerImage from '../assets/images/HomeHeader.png';
import calcIcon from '../assets/images/CalculatorIcon.png';
import brainIcon from '../assets/images/BrainBoosterIcon.png';
import diaryIcon from '../assets/images/DiaryIcon.png';
import profileIcon from '../assets/images/ProfileIcon.png';
import { PageBackground } from '../components/PageBackground';
import { hideBannerAd, showBannerAd } from '../utils/bannerAd';

interface HomeProps {
  id: string;
}

const colors = {
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
};

export const Home = ({ id }: HomeProps) => {
  const routeNavigator = useRouteNavigator();
  const { panel } = useActiveVkuiLocation();
  const isActive = !panel || panel === id;

  // Баннер живёт только на главной: на остальных экранах его прячем,
  // потому что там есть таббар и он бы перекрывал навигацию.
  useEffect(() => {
    if (isActive) void showBannerAd();
    else void hideBannerAd();
  }, [isActive]);

  useEffect(() => () => void hideBannerAd(), []);

  return (
    <Panel id={id} style={{ background: 'transparent', padding: 0 }}>
      <style>{`
        .vkuiGroup { background: transparent !important; }
      `}</style>

      <PageBackground variant="green" pattern="ridge" paddingBottom={24}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 'calc(100vh - 24px)',
            boxSizing: 'border-box',
          }}
        >
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
          План подготовки и импорт тренировок
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



        {/* Автор */}
        <div style={{ marginTop: 'auto', paddingTop: '28px', textAlign: 'center' }}>
          <Text
            style={{
              color: 'rgba(255, 255, 255, 0.85)',
              fontSize: '13px',
              lineHeight: 1.4,
              fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
            }}
          >
            автор{' '}
            <a
              href="https://vk.ru/prozhogin.aleksandr"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'rgba(255, 255, 255, 0.9)',
                textDecoration: 'none',
                borderBottom: '1px solid rgba(255, 255, 255, 0.35)',
              }}
            >
              Александр Прожогин
            </a>
          </Text>
        </div>
        </div>
      </PageBackground>

    </Panel>
  );
};
export default Home;
