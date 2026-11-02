// src/panels/games/DictionaryQuiz.tsx
import { useState, useEffect, useRef, type CSSProperties } from 'react';
import {
  Panel,
  Group,
  Button,
  Text,
  Div,
  Header,
  Card,
  CardGrid,
} from '@vkontakte/vkui';
import headerImage from '../../assets/images/DictionaryQuizHeader.png';
import { AppTabbar } from '../../components/AppTabbar';
import { PageBackground } from '../../components/PageBackground';
import { getCurrentUser } from '../../utils/userUtils';
import {
  loadUserGamesData,
  updateDictionaryQuizRecord,
  formatGameTime,
} from '../../utils/gameStorage';
import { DICTIONARY } from '../../utils/dictionary';
import { showAdIfDue } from '../../utils/adUtils';

interface DictionaryQuizProps {
  id: string;
}

const QUESTIONS_COUNT = 10;
const OPTIONS_COUNT = 4;
const ANSWER_DELAY_MS = 900;
/** Пауза между результатом и рекламой: сначала игрок видит свой счёт */
const AD_DELAY_MS = 1500;

type Phase = 'ready' | 'playing' | 'result';

interface Question {
  term: string;
  definition: string;
  options: string[];     // варианты терминов
  correctIndex: number;  // индекс правильного в options
}

// 🔀 Перемешивание
const shuffle = <T,>(arr: T[]): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// 🎲 Взять N случайных уникальных элементов
const pickRandom = <T,>(arr: T[], count: number): T[] => {
  const copy = [...arr];
  const result: T[] = [];
  const n = Math.min(count, copy.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
};

// 🧩 Сборка 10 вопросов
const buildQuestions = (): Question[] => {
  const picks = pickRandom(DICTIONARY, QUESTIONS_COUNT);
  return picks.map((item) => {
    const distractors = pickRandom(
      DICTIONARY.filter((d) => d.term !== item.term),
      OPTIONS_COUNT - 1,
    ).map((d) => d.term);
    const options = shuffle([item.term, ...distractors]);
    return {
      term: item.term,
      definition: item.definition,
      options,
      correctIndex: options.indexOf(item.term),
    };
  });
};

export const DictionaryQuiz = ({ id }: DictionaryQuizProps) => {
  

  const [userId, setUserId] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('ready');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [message, setMessage] = useState('');

  const [bestScore, setBestScore] = useState<number | null>(null);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [gamesPlayed, setGamesPlayed] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const adTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 👤 Пользователь и его рекорды
  useEffect(() => {
    const init = async () => {
      const user = await getCurrentUser();
      if (!user) return;
      setUserId(user.id);
      const data = loadUserGamesData(user.id);
      setBestScore(data.dictionaryQuiz.bestScore);
      setBestTime(data.dictionaryQuiz.bestTimeSeconds);
      setGamesPlayed(data.dictionaryQuiz.gamesPlayed);
    };
    init();
  }, []);

  // ⏱ Таймер
  useEffect(() => {
    if (phase === 'playing' && startTime) {
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, startTime]);

  // 🧹 Очистка при размонтировании: отложенные ответы, таймер и реклама
  useEffect(() => () => {
    if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
    if (adTimeoutRef.current) clearTimeout(adTimeoutRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // ▶️ Начать игру
  const startGame = () => {
    setQuestions(buildQuestions());
    setCurrentIndex(0);
    setSelectedIndex(null);
    setScore(0);
    setStartTime(Date.now());
    setElapsedTime(0);
    setPhase('playing');
    setMessage('');
    if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
    // Новая игра началась раньше, чем сработала реклама, — рекламу отменяем
    if (adTimeoutRef.current) clearTimeout(adTimeoutRef.current);
  };

  // 🏁 Завершение
  const finishGame = (finalScore: number, totalSeconds: number) => {
    setPhase('result');
    if (timerRef.current) clearInterval(timerRef.current);

    // Новый рекорд — момент радости, рекламу в него не вставляем
    let celebrate = false;

    if (userId) {
      const { isNewScoreRecord, isNewTimeRecord } = updateDictionaryQuizRecord(
        userId,
        finalScore,
        totalSeconds,
      );
      celebrate = isNewScoreRecord || isNewTimeRecord;

      const data = loadUserGamesData(userId);
      setBestScore(data.dictionaryQuiz.bestScore);
      setBestTime(data.dictionaryQuiz.bestTimeSeconds);
      setGamesPlayed(data.dictionaryQuiz.gamesPlayed);

      if (isNewScoreRecord && isNewTimeRecord) {
        setMessage('🏆 Новый рекорд по очкам и времени!');
      } else if (isNewScoreRecord) {
        setMessage('🏆 Новый рекорд по очкам!');
      } else if (isNewTimeRecord) {
        setMessage('⚡ Лучшее время при этом счёте!');
      } else {
        setMessage('✅ Викторина завершена!');
      }
    } else {
      setMessage('✅ Викторина завершена!');
    }

    // Реклама в естественной паузе, когда результат уже виден
    if (!celebrate) {
      adTimeoutRef.current = setTimeout(() => {
        void showAdIfDue('game_finished');
      }, AD_DELAY_MS);
    }
  };

  // 🖱 Ответ на вопрос
  const handleAnswer = (optionIndex: number) => {
    if (selectedIndex !== null) return;

    const question = questions[currentIndex];
    const isCorrect = optionIndex === question.correctIndex;
    const newScore = score + (isCorrect ? 1 : 0);

    setSelectedIndex(optionIndex);
    setScore(newScore);

    advanceTimeoutRef.current = setTimeout(() => {
      const nextIndex = currentIndex + 1;
      if (nextIndex >= questions.length) {
        const totalSeconds = startTime
          ? Math.floor((Date.now() - startTime) / 1000)
          : elapsedTime;
        setElapsedTime(totalSeconds);
        finishGame(newScore, totalSeconds);
      } else {
        setCurrentIndex(nextIndex);
        setSelectedIndex(null);
      }
    }, ANSWER_DELAY_MS);
  };

  // 🎨 Цвет кнопки-варианта
  const getOptionStyle = (index: number): CSSProperties => {
    const base: CSSProperties = {
      width: '100%',
      minHeight: '56px',
      height: 'auto',
      padding: '12px 16px',
      borderRadius: '12px',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      color: '#FFFFFF',
      fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
      fontSize: '15px',
      lineHeight: '1.3',
      textAlign: 'left',
      whiteSpace: 'normal',
      cursor: selectedIndex === null ? 'pointer' : 'default',
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
    };

    if (selectedIndex === null) {
      return { ...base, background: 'rgba(255, 255, 255, 0.12)' };
    }

    const question = questions[currentIndex];
    const isCorrectOption = index === question.correctIndex;
    const isSelected = index === selectedIndex;

    if (isCorrectOption) {
      return { ...base, background: 'rgba(76, 175, 80, 0.55)', border: '1px solid #4CAF50' };
    }
    if (isSelected) {
      return { ...base, background: 'rgba(244, 67, 54, 0.5)', border: '1px solid #F44336' };
    }
    return { ...base, background: 'rgba(255, 255, 255, 0.06)', opacity: 0.7 };
  };

  const currentQuestion = questions[currentIndex];

  return (
    <Panel id={id} style={{ background: 'transparent', padding: 0 }}>
      <style>{`
        .vkuiGroup { background: transparent !important; }
        .vkuiCard { background: transparent !important; }
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
            alt="Словарь бегуна"
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
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Очки</Text>
              <Text style={{ fontSize: '22px', fontWeight: 700, color: '#FFFFFF' }}>
                {phase === 'playing' ? `${score} / ${currentIndex + (selectedIndex !== null ? 1 : 0)}` : score}
              </Text>
            </Card>
            <Card style={{ padding: '12px', textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Рекорд</Text>
              <Text style={{ fontSize: '22px', fontWeight: 700, color: '#FFFFFF' }}>
                {bestScore !== null ? `${bestScore} / ${QUESTIONS_COUNT}` : '—'}
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
                1. Вам покажут определение термина{'\n\n'}
                2. Выберите правильный термин из 4 вариантов{'\n\n'}
                3. Всего 10 вопросов — чем больше угадаете, тем лучше{'\n\n'}
                4. Если угадаете все 10 за меньшее время — установите новый рекорд
              </Text>
            </Div>
          </Group>
        )}

        {/* Фаза: Игра */}
        {phase === 'playing' && currentQuestion && (
          <>
            <Group
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                padding: '16px',
                marginTop: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>
                  Вопрос {currentIndex + 1} из {questions.length}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>
                  ⏱ {formatGameTime(elapsedTime)}
                </Text>
              </div>
              <Text style={{ color: '#FFFFFF', fontSize: '15px', lineHeight: '1.6' }}>
                {currentQuestion.definition}
              </Text>
            </Group>

            <Group
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                padding: '16px',
                marginTop: '16px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={option}
                    onClick={() => handleAnswer(index)}
                    disabled={selectedIndex !== null}
                    style={getOptionStyle(index)}
                  >
                    <span style={{ marginRight: '10px', opacity: 0.6 }}>
                      {String.fromCharCode(65 + index)}.
                    </span>
                    {option}
                  </button>
                ))}
              </div>
            </Group>
          </>
        )}

        {/* Фаза: Результат */}
        {phase === 'result' && (
          <>
            <Group
              style={{
                background: 'rgba(76, 175, 80, 0.15)',
                borderRadius: '16px',
                border: '1px solid rgba(76, 175, 80, 0.4)',
                padding: '20px',
                marginTop: '16px',
                textAlign: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: '26px', fontWeight: 700, fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>
                {score} / {QUESTIONS_COUNT}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: '15px', marginTop: '8px' }}>
                Правильных ответов за {formatGameTime(elapsedTime)}
              </Text>
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
                <Text style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: 600 }}>
                  {message}
                </Text>
                {bestTime !== null && (
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginTop: '6px' }}>
                    Лучшее время при рекорде: {formatGameTime(bestTime)}
                  </Text>
                )}
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
          {phase !== 'playing' && (
            <Button
              size="l"
              stretched
              onClick={startGame}
              style={{
                width: '100%',
                background: 'rgba(76, 175, 80, 0.7)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
                fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
                fontSize: '15px',
                height: '56px',
              }}
            >
              {phase === 'result' ? '🔄 Играть снова' : '▶ Начать игру'}
            </Button>
          )}
        </Group>
      </PageBackground>

      <AppTabbar active="brainbooster" />
    </Panel>
  );
};

export default DictionaryQuiz;
