// src/panels/RunnerCalculator.tsx
import {
  Panel,
  Group,
  Cell,
  Title,
  Text,
} from '@vkontakte/vkui';
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router';

import calculatorHeader from '../assets/images/RunnerCalculatorHeader.png';

import paceIcon from '../assets/images/PaceConverterIcon.png';
import heartIcon from '../assets/images/HeartRateZonesIcon.png';
import raceIcon from '../assets/images/RacePaceIcon.png';
import vo2Icon from '../assets/images/Vo2PredictorIcon.png';

import { AppTabbar } from '../components/AppTabbar';
import { PageBackground } from '../components/PageBackground';
import { BackButton } from '../components/BackButton';

interface RunnerCalculatorProps {
  id: string;
}

const colors = {
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
};

const CALCULATORS = [
  {
    icon: paceIcon,
    title: 'Конвертер скорости/темпа',
    description: 'Переводите скорость бега (км/ч) в темп (мин/км) и обратно',
    route: '/pace_converter',
    alt: 'Конвертер скорости',
  },
  {
    icon: heartIcon,
    title: 'Пульсовые зоны',
    description: 'Рассчитайте пульсовые зоны по пульсу в покое и МЧСС',
    route: '/heart_rate_zones',
    alt: 'Пульсовые зоны',
  },
  {
    icon: raceIcon,
    title: 'Раскладка по километрам',
    description: 'Разбейте финишное время на равные отрезки по каждому километру',
    route: '/race_pace',
    alt: 'Раскладка по километрам',
  },
  {
    icon: vo2Icon,
    title: 'Прогноз финишного времени',
    description: 'Спрогнозируйте финишное время на основе контрольных забегов',
    route: '/vo2_predictor',
    alt: 'Прогноз финишного времени',
  },
];

export const RunnerCalculator = ({ id }: RunnerCalculatorProps) => {
  const routeNavigator = useRouteNavigator();

  return (
    <Panel id={id} style={{ background: 'transparent', padding: 0 }}>
      <style>{`
        .vkuiGroup { background: transparent !important; }
      `}</style>

      <PageBackground variant="red" pattern="topo">
        <BackButton to="/" />

        {/* Header */}
        <div
          style={{
            paddingTop: '20px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <img
            src={calculatorHeader}
            alt="Калькулятор бегуна"
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
          Калькуляторы
        </Title>

        {/* Карточки */}
        {CALCULATORS.map((calc) => (
          <Group
            key={calc.route}
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
              onClick={() => routeNavigator.push(calc.route)}
              style={{ color: colors.text }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img
                  src={calc.icon}
                  alt={calc.alt}
                  style={{ width: '32px', height: '32px', objectFit: 'contain' }}
                />
                <div>
                  <Text weight="2" style={{ color: colors.text, fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>
                    {calc.title}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: '13px',
                      fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
                      whiteSpace: 'normal',
                    }}
                  >
                    {calc.description}
                  </Text>
                </div>
              </div>
            </Cell>
          </Group>
        ))}
      </PageBackground>

      <AppTabbar active="calculator" />
    </Panel>
  );
};
export default RunnerCalculator;
