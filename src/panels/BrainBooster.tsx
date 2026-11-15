// src/panels/BrainBooster.tsx
import {
  Panel,
  Group,
  Cell,
  Title,
  Text,
} from '@vkontakte/vkui';
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router';

import brainHeader from '../assets/images/BrainBoosterHeader.webp';
import dictionaryIcon from '../assets/images/DictionaryIcon.png';
import quizIcon from '../assets/images/DictionaryQuizIcon.png';
import pairIcon from '../assets/images/PairGameIcon.png';
import splitIcon from '../assets/images/SplitMemoryIcon.png';

import { AppTabbar } from '../components/AppTabbar';

import { PageBackground } from '../components/PageBackground';
import { BackButton } from '../components/BackButton';

interface BrainBoosterProps {
  id: string;
}

const colors = {
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
};

interface Tool {
  title: string;
  description: string;
  route: string;
  alt: string;
  icon?: string;   // путь к PNG
  emoji?: string;  // или эмодзи-иконка
}

const TOOLS: Tool[] = [
  {
    icon: dictionaryIcon,
    title: 'Словарь бегуна',
    description: 'Термины, понятия и жаргон из мира бега и триатлона',
    route: 'runner_dictionary',
    alt: 'Словарь бегуна',
  },
  {
    icon: quizIcon,
    title: 'Викторина по словарю',
    description: '10 вопросов: угадайте термин по определению из словаря бегуна',
    route: 'dictionary_quiz',
    alt: 'Викторина',
  },
  {
    icon: pairIcon,
    title: 'Найди пару',
    description: 'Классическая игра на память — найди одинаковые карточки',
    route: 'pair_game',
    alt: 'Найди пару',
  },
  {
    icon: splitIcon,
    title: 'Запомни раскладку',
    description: 'Запомните темп по километрам и воспроизведите его по памяти',
    route: 'split_memory_game',
    alt: 'Запомни раскладку',
  },
];

export const BrainBooster = ({ id }: BrainBoosterProps) => {
  const routeNavigator = useRouteNavigator();

  return (
    <Panel id={id} style={{ background: 'transparent', padding: 0 }}>
      <style>{`
        .vkuiGroup { background: transparent !important; }
      `}</style>

      <PageBackground variant="violet" pattern="topo">
        <BackButton to="/" />
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
            src={brainHeader}
            alt="Брейнбустер"
            style={{ width: '100%', maxWidth: '380px', height: 'auto', objectFit: 'contain' }}
          />
        </div>

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

        {TOOLS.map((tool) => (
          <Group
            key={tool.route}
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
                  <span
                    aria-label={tool.alt}
                    style={{ width: '32px', height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px' }}
                  >
                    {tool.emoji}
                  </span>
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

      <AppTabbar active="brainbooster" />
    </Panel>
  );
};
export default BrainBooster;
