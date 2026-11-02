// src/panels/games/SplitMemoryGame.tsx
import { useState, useEffect, useRef } from 'react';
import {
  Panel,
  Group,
  Button,
  Text,
  Div,
  Header,
  Input,
  Card,
  CardGrid,
} from '@vkontakte/vkui';

import headerImage from '../../assets/images/SplitMemoryHeader.png';
import { PageBackground } from '../../components/PageBackground';
import { AppTabbar } from '../../components/AppTabbar';
import { getCurrentUser } from '../../utils/userUtils';
import {
  loadUserGamesData,
  updateSplitMemoryRecord,
} from '../../utils/gameStorage';
import { showAdIfDue } from '../../utils/adUtils';

interface SplitMemoryGameProps {
  id: string;
}

const START_LEVEL = 3;
const MEMORIZE_SECONDS = 5;
/** Пауза между результатом и рекламой: сначала игрок видит, что получилось */
const AD_DELAY_MS = 1500;

// 🏃 Один отрезок раскладки
interface Split {
  km: number;      // номер километра
  pace: string;    // "5:00" или "5:30"
}

// 🎲 Генерация случайной раскладки
const generateSplits = (count: number): Split[] => {
  const splits: Split[] = [];
  for (let km = 1; km <= count; km++) {
    // Темп в диапазоне 4:00–7:00
    const mins = 4 + Math.floor(Math.random() * 3); // 4, 5, 6
    const secs = [0, 15, 30, 45][Math.floor(Math.random() * 4)];
    const secsStr = secs.toString().padStart(2, '0');
    splits.push({ km, pace: `${mins}:${secsStr}` });
  }
  return splits;
};

/**
 * Приводит ответ игрока к виду «м:сс»: «5.00», «5,00», «05:00» и «5 : 00» считаются верными для «5:00».
 * Секунды всегда нужны две цифры («5:5» не засчитывается: непонятно, 5 секунд это или 50).
 */
const normalizePace = (value: string): string => {
  const m = /^(\d{1,2})\s*[:.,]\s*(\d{2})$/.exec(value.trim());
  return m ? `${Number(m[1])}:${m[2]}` : value.trim();
};

type GamePhase = 'ready' | 'memorize' | 'recall' | 'result';

export const SplitMemoryGame = ({ id }: SplitMemoryGameProps) => {
  

  const [userId, setUserId] = useState<number | null>(null);
  const [phase, setPhase] = useState<GamePhase>('ready');
  const [level, setLevel] = useState(START_LEVEL);   // текущий уровень (число отрезков)
  const [splits, setSplits] = useState<Split[]>([]); // правильная раскладка
  const [userAnswers, setUserAnswers] = useState<string[]>([]); // ответы игрока
  const [countdown, setCountdown] = useState(MEMORIZE_SECONDS); // таймер на запоминание
  const [results, setResults] = useState<boolean[]>([]); // правильно ли каждый отрезок
  const [levelPassed, setLevelPassed] = useState(false); // уровень пройден целиком
  const [bestLevel, setBestLevel] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [message, setMessage] = useState<string>('');

  const adTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 👤 Загружаем пользователя и его рекорды
  useEffect(() => {
    const init = async () => {
      const user = await getCurrentUser();
      if (!user) return;
      setUserId(user.id);
      const data = loadUserGamesData(user.id);
      setBestLevel(data.splitMemory.bestLevel);
      setGamesPlayed(data.splitMemory.gamesPlayed);
    };
    init();
  }, []);

  // 🧹 При уходе с экрана отменяем отложенную рекламу
  useEffect(
    () => () => {
      if (adTimeoutRef.current) clearTimeout(adTimeoutRef.current);
    },
    []
  );

  // ⏱ Обратный отсчёт фазы «Запоминание»
  useEffect(() => {
    if (phase !== 'memorize') return;
    if (countdown <= 0) {
      setPhase('recall');
      setUserAnswers(new Array(splits.length).fill(''));
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, countdown, splits.length]);

  // ▶️ Начать игру с заданного уровня
  const startGame = (lvl: number) => {
    // Новый раунд начался раньше, чем сработала реклама, — рекламу отменяем
    if (adTimeoutRef.current) clearTimeout(adTimeoutRef.current);

    setLevel(lvl);
    setSplits(generateSplits(lvl));
    setUserAnswers(new Array(lvl).fill(''));
    setCountdown(MEMORIZE_SECONDS);
    setResults([]);
    setLevelPassed(false);
    setMessage('');
    setPhase('memorize');
  };

  // 🖊 Обновить ответ игрока
  const handleAnswerChange = (index: number, value: string) => {
    // Обновление от предыдущего значения: несколько событий подряд (автозаполнение, быстрый ввод)
    // не затирают друг друга
    setUserAnswers((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  // ✅ Проверка ответов
  const checkAnswers = () => {
    const res = splits.map((split, i) => normalizePace(userAnswers[i] || '') === split.pace);
    setResults(res);

    const correctCount = res.filter(Boolean).length;
    const allCorrect = correctCount === splits.length;
    setLevelPassed(allCorrect);

    if (allCorrect) {
      // Уровень пройден — игрок сам решает, идти дальше
      setMessage(`✅ Все ${splits.length} отрезков угаданы! Следующий уровень: ${level + 1}`);

      if (userId) {
        const { isNewRecord } = updateSplitMemoryRecord(userId, level);
        const data = loadUserGamesData(userId);
        setBestLevel(data.splitMemory.bestLevel);
        setGamesPlayed(data.splitMemory.gamesPlayed);
        if (isNewRecord) {
          setMessage(`🏆 Новый рекорд: ${level} отрезков! Можно идти дальше.`);
        }
      }
    } else {
      setMessage(`❌ Угадано ${correctCount} из ${splits.length}. Попробуйте ещё раз.`);

      // Серия закончилась неудачей — естественная пауза для рекламы
      adTimeoutRef.current = setTimeout(() => {
        void showAdIfDue('game_finished');
      }, AD_DELAY_MS);
    }

    setPhase('result');
  };

  // 🔄 Повторить текущий уровень (после неудачи)
  const retryLevel = () => {
    startGame(level);
  };

  // 🏁 Играть заново с 3 отрезков
  const restartGame = () => {
    startGame(START_LEVEL);
  };

  // ▶️ Следующий уровень (после успеха)
  const nextLevel = () => {
    startGame(level + 1);
  };

  return (
    <Panel id={id} style={{ background: 'transparent', padding: 0 }}>
      <style>{`
        .vkuiGroup { background: transparent !important; }
        .vkuiCard { background: transparent !important; }
        .vkuiInput__el { color: #FFFFFF !important; text-align: center; }
        .vkuiInput__el::placeholder { color: rgba(255, 255, 255, 0.4) !important; }
      `}</style>

      <PageBackground variant="violet" pattern="topo">
        {/* Header с кнопкой «Назад» */}
        <div
          style={{
            paddingTop: '20px',
            paddingBottom: '16px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            position: 'relative',
          }}
        >

          <img
            src={headerImage}
            alt="Запомни раскладку"
            style={{ width: '100%', maxWidth: '380px', height: 'auto', objectFit: 'contain' }}
          />
        </div>

        {/* Статистика */}
        <Group
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            padding: '16px',
            marginTop: '16px',
          }}
        >
          <CardGrid size="l">
            <Card style={{ padding: '12px', textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Уровень</Text>
              <Text style={{ fontSize: '22px', fontWeight: 700, color: '#FFFFFF' }}>
                {level} отрезков
              </Text>
            </Card>
            <Card style={{ padding: '12px', textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Рекорд</Text>
              <Text style={{ fontSize: '22px', fontWeight: 700, color: '#FFFFFF' }}>
                {bestLevel || '—'}
              </Text>
            </Card>
            <Card style={{ padding: '12px', textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Сыграно</Text>
              <Text style={{ fontSize: '22px', fontWeight: 700, color: '#FFFFFF' }}>
                {gamesPlayed}
              </Text>
            </Card>
          </CardGrid>
        </Group>

        {/* Фаза: Готовность */}
        {phase === 'ready' && (
          <Group
            header={<Header style={{ color: '#FFFFFF', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>Правила игры</Header>}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              padding: '16px',
              marginTop: '16px',
            }}
          >
            <Div>
              <Text style={{ color: 'rgba(255,255,255,0.85)', lineHeight: '1.6' }}>
                1. Вам покажут раскладку по километрам (1 км — 5:00, 2 км — 5:15...){'\n\n'}
                2. Через {MEMORIZE_SECONDS} секунд раскладка исчезнет{'\n\n'}
                3. Введите темп каждого отрезка по памяти{'\n\n'}
                4. Чем больше отрезков запомните — тем выше уровень
              </Text>
            </Div>
          </Group>
        )}

        {/* Фаза: Запоминание */}
        {phase === 'memorize' && (
          <Group
            header={
              <Header style={{ color: '#FFFFFF', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>
                👀 Запомните раскладку ({countdown} сек)
              </Header>
            }
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              padding: '16px',
              marginTop: '16px',
            }}
          >
            {splits.map((split) => (
              <div
                key={split.km}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  marginBottom: '8px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '12px',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: '16px' }}>
                  {split.km} км
                </Text>
                <Text
                  style={{
                    color: '#4CAF50',
                    fontSize: '20px',
                    fontWeight: 700,
                    fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
                  }}
                >
                  {split.pace}
                </Text>
              </div>
            ))}
          </Group>
        )}

        {/* Фаза: Воспроизведение */}
        {phase === 'recall' && (
          <Group
            header={
              <Header style={{ color: '#FFFFFF', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>
                ✏️ Введите темп по памяти
              </Header>
            }
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              padding: '16px',
              marginTop: '16px',
            }}
          >
            {splits.map((split, index) => (
              <div
                key={split.km}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '12px',
                }}
              >
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: '16px',
                    minWidth: '50px',
                  }}
                >
                  {split.km} км
                </Text>
                <Input
                  type="text"
                  autoComplete="off"
                  placeholder="5:00"
                  value={userAnswers[index] || ''}
                  onChange={(e) => handleAnswerChange(index, e.target.value)}
                  style={{
                    flex: 1,
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    height: '48px',
                    fontSize: '16px',
                  }}
                />
              </div>
            ))}
          </Group>
        )}

        {/* Фаза: Результат */}
        {phase === 'result' && (
          <>
            <Group
              header={
                <Header style={{ color: '#FFFFFF', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>
                  📊 Результат
                </Header>
              }
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                padding: '16px',
                marginTop: '16px',
              }}
            >
              {splits.map((split, index) => (
                <div
                  key={split.km}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 16px',
                    marginBottom: '8px',
                    background: results[index]
                      ? 'rgba(76, 175, 80, 0.2)'
                      : 'rgba(244, 67, 54, 0.2)',
                    borderRadius: '12px',
                    border: results[index]
                      ? '1px solid rgba(76, 175, 80, 0.5)'
                      : '1px solid rgba(244, 67, 54, 0.5)',
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: '14px' }}>
                    {results[index] ? '✅' : '❌'} {split.km} км
                  </Text>
                  <div style={{ textAlign: 'right' }}>
                    <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '13px' }}>
                      Ваш ответ: {userAnswers[index] || '—'}
                    </Text>
                    <Text
                      style={{
                        color: '#4CAF50',
                        fontSize: '16px',
                        fontWeight: 700,
                      }}
                    >
                      Правильно: {split.pace}
                    </Text>
                  </div>
                </div>
              ))}
            </Group>

            {message && (
              <Group
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  padding: '16px',
                  marginTop: '12px',
                  textAlign: 'center',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: 600 }}>
                  {message}
                </Text>
              </Group>
            )}
          </>
        )}

        {/* Кнопки управления */}
        <Group
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            padding: '16px',
            marginTop: '16px',
          }}
        >
          {phase === 'ready' && (
            <Button
              size="l"
              stretched
              onClick={() => startGame(level)}
              style={{
                width: '100%',
                background: 'rgba(76, 175, 80, 0.7)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
                fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
                fontSize: '16px',
                height: '56px',
              }}
            >
              ▶ Начать игру
            </Button>
          )}

          {phase === 'memorize' && (
            <Button
              size="l"
              stretched
              onClick={() => setPhase('recall')}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#FFFFFF',
                fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
                fontSize: '16px',
                height: '56px',
              }}
            >
              Я запомнил → Ввести ответы
            </Button>
          )}

          {phase === 'recall' && (
            <Button
              size="l"
              stretched
              onClick={checkAnswers}
              style={{
                width: '100%',
                background: 'rgba(76, 175, 80, 0.7)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
                fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
                fontSize: '16px',
                height: '56px',
              }}
            >
              ✅ Проверить ответы
            </Button>
          )}

          {/* После успеха — только «дальше», после неудачи — только «повторить» */}
          {phase === 'result' && levelPassed && (
            <Button
              size="l"
              stretched
              onClick={nextLevel}
              style={{
                width: '100%',
                background: 'rgba(76, 175, 80, 0.7)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
                fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
                fontSize: '16px',
                height: '56px',
              }}
            >
              ▶ Следующий уровень ({level + 1})
            </Button>
          )}

          {phase === 'result' && !levelPassed && (
            <Button
              size="l"
              stretched
              onClick={retryLevel}
              style={{
                width: '100%',
                background: 'rgba(255, 152, 0, 0.7)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
                fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
                fontSize: '16px',
                height: '56px',
              }}
            >
              🔄 Повторить уровень
            </Button>
          )}

          {phase === 'result' && (
            <Button
              size="l"
              stretched
              mode="secondary"
              onClick={restartGame}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
                fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
                fontSize: '14px',
                height: '48px',
                marginTop: '12px',
              }}
            >
              🏁 Начать с {START_LEVEL} отрезков
            </Button>
          )}
        </Group>
      </PageBackground>

      <AppTabbar active="brainbooster" />
    </Panel>
  );
};
export default SplitMemoryGame;
