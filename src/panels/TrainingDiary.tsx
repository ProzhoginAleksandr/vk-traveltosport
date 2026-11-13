// src/panels/TrainingDiary.tsx
import {
  Panel,
  Group,
  Cell,
  Title,
  Text,
} from '@vkontakte/vkui';
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router';
import { Icon24CalendarOutline } from '@vkontakte/icons';

import diaryHeader from '../assets/images/TrainingDiaryHeader.png';
import trackerIcon from '../assets/images/TrackerIcon.png';
import importIcon from '../assets/images/ProfileIcon.png';

import { AppTabbar } from '../components/AppTabbar';
import { PageBackground } from '../components/PageBackground';

interface TrainingDiaryProps {
  id: string;
}

const colors = {
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
};

interface ToolItem {
  key: string;
  title: string;
  description: string;
  route: string;
  alt: string;
  /** PNG-иконка в общем стиле; если нет — рисуем вектор в акцентной плашке */
  icon?: string;
}

const TOOLS: ToolItem[] = [
  {
    key: 'plan',
    title: 'Программа подготовки',
    description: 'План тренировок к забегу по неделям',
    route: 'race_plan',
    alt: 'Программа подготовки',
  },
  {
    key: 'tracker',
    icon: trackerIcon,
    title: 'Трекер пробежек',
    description: 'Записывайте маршрут, дистанцию, темп и время пробежки',
    route: 'tracker',
    alt: 'Трекер пробежек',
  },
  {
    key: 'import',
    icon: importIcon,
    title: 'Импорт тренировок',
    description: 'Загружайте GPX и TCX файлы из Garmin, Polar, Huawei',
    route: 'training_import',
    alt: 'Импорт тренировок',
  },
];

export const TrainingDiary = ({ id }: TrainingDiaryProps) => {
  const routeNavigator = useRouteNavigator();

  return (
    <Panel id={id} style={{ background: 'transparent', padding: 0 }}>
      <style>{`
        .vkuiGroup { background: transparent !important; }
      `}</style>

      <PageBackground variant="blue" pattern="footsteps">
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
            src={diaryHeader}
            alt="Дневник тренировок"
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

        {/* Карточки */}
        {TOOLS.map((tool) => (
          <Group
            key={tool.key}
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
              onClick={() => routeNavigator.push(`/${tool.route}`)}
              style={{ color: colors.text }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {tool.icon ? (
                  <img
                    src={tool.icon}
                    alt={tool.alt}
                    style={{ width: '32px', height: '32px', objectFit: 'contain' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '10px',
                      background: 'rgba(76, 175, 80, 0.2)',
                      border: '1px solid rgba(76, 175, 80, 0.45)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#4CAF50',
                      flexShrink: 0,
                    }}
                  >
                    <Icon24CalendarOutline />
                  </div>
                )}
                <div>
                  <Text weight="2" style={{ color: colors.text, fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>
                    {tool.title}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: '13px',
                      fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
                      whiteSpace: 'normal',
                    }}
                  >
                    {tool.description}
                  </Text>
                </div>
              </div>
            </Cell>
          </Group>
        ))}
      </PageBackground>

      <AppTabbar active="diary" />
    </Panel>
  );
};
export default TrainingDiary;
