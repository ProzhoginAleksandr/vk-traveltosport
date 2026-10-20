// src/panels/TrainingDiary.tsx
import {
  Panel,
  Group,
  Cell,
  Title,
  Text,
} from '@vkontakte/vkui';
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router';

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

const TOOLS = [
  {
    icon: trackerIcon,
    title: 'Трекер пробежек',
    description: 'Записывайте маршрут, дистанцию, темп и время пробежки',
    route: 'tracker',
    alt: 'Трекер пробежек',
  },
  {
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
            fontFamily: 'Impact',
            fontSize: '20px',
          }}
        >
          Инструменты
        </Title>

        {/* Карточки */}
        {TOOLS.map((tool) => (
          <Group
            key={tool.route}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
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
                <img
                  src={tool.icon}
                  alt={tool.alt}
                  style={{ width: '32px', height: '32px', objectFit: 'contain' }}
                />
                <div>
                  <Text weight="2" style={{ color: colors.text, fontFamily: 'Impact' }}>
                    {tool.title}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: '13px',
                      fontFamily: 'Arial',
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