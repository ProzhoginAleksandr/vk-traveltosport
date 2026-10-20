// src/panels/games/PairGame.tsx
import { useState, useEffect, useRef } from 'react';
import {
  Panel,
  Group,
  Button,
  Text,
  Header,
  Card,
  CardGrid,
} from '@vkontakte/vkui';
import { PageBackground } from '../../components/PageBackground';
import { AppTabbar } from '../../components/AppTabbar';
import { showAdIfDue } from '../../utils/adUtils';
import { getCurrentUser } from '../../utils/userUtils';
import headerImage from '../../assets/images/PairGameHeader.png';
import {
  loadUserGamesData,
  updatePairGameRecord,
  getPairGameRecord,
  formatGameTime,
  type PairGameSize,
} from '../../utils/gameStorage';

interface PairGameProps {
  id: string;
}

// 🎴 Пиктограммы (эмодзи)
const ICONS = ['👟', '⌚', '💧', '❤️', '🏁', '🏃', '🎽', '🧢', '💪', '🦵',
  '🦶', '🧘', '🏋️', '🚴', '🏊', '🥇', '🥈', '🥉', '🎯', '📊',
];

// Раньше интерфейс назывался Card и конфликтовал по имени с компонентом Card из VKUI
interface GameCard {
  id: number;
  icon: string;
  pairId: number;
  isOpen: boolean;
  isMatched: boolean;
}

// 🔀 Перемешивание массива
const shuffle = <T,>(arr: T[]): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// 🎲 Создание колоды
const createDeck = (size: PairGameSize): GameCard[] => {
  const pairCount = (size * size) / 2;
  const icons = ICONS.slice(0, pairCount);
  const pairs = icons.flatMap((icon, pairId) => [
    { icon, pairId },
    { icon, pairId },
  ]);

  return shuffle(pairs).map((item, index) => ({
    id: index,
    icon: item.icon,
    pairId: item.pairId,
    isOpen: false,
    isMatched: false,
  }));
};

// 📊 Рекорды пользователя для выбранного размера поля
const readRecords = (userId: number, size: PairGameSize) => {
  const rec = getPairGameRecord(loadUserGamesData(userId), size);
  return { bestTime: rec.bestTime, bestMoves: rec.bestMoves, gamesPlayed: rec.gamesPlayed };
};

export const PairGame = ({ id }: PairGameProps) => {
  const [userId, setUserId] = useState<number | null>(null);
  const [gridSize, setGridSize] = useState<PairGameSize>(4);
  const [cards, setCards] = useState<GameCard[]>(() => createDeck(4));
  const [openCards, setOpenCards] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [bestMoves, setBestMoves] = useState<number | null>(null);
  const [gamesPlayed, setGamesPlayed] = useState(0);

  const lockRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ⏳ Отложенные действия запоминаем, чтобы их можно было отменить
  const later = (fn: () => void, ms: number) => {
    timeoutsRef.current.push(setTimeout(fn, ms));
  };

  const clearPending = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  };

  // 🧹 При уходе с экрана отменяем всё отложенное
  useEffect(
    () => () => {
      timeoutsRef.current.forEach(clearTimeout);
      if (timerRef.current) clearInterval(timerRef.current);
    },
    []
  );

  // 👤 Загружаем пользователя
  useEffect(() => {
    const init = async () => {
      const user = await getCurrentUser();
      if (user) setUserId(user.id);
    };
    init();
  }, []);

  // 📊 Рекорды подгружаются для текущего размера поля
  useEffect(() => {
    if (userId === null) return;
    const rec = readRecords(userId, gridSize);
    setBestTime(rec.bestTime);
    setBestMoves(rec.bestMoves);
    setGamesPlayed(rec.gamesPlayed);
  }, [userId, gridSize]);

  // ⏱ Таймер
  useEffect(() => {
    if (startTime && !isFinished) {
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTime, isFinished]);

  // 🔁 Общий сброс партии (без запуска)
  const resetBoard = (size: PairGameSize) => {
    clearPending();
    setGridSize(size);
    setCards(createDeck(size));
    setOpenCards([]);
    setMoves(0);
    setElapsedTime(0);
    setIsFinished(false);
    setMessage('');
    lockRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // 🎚 Выбор сложности: поле перемешивается, но игра не стартует
  const selectSize = (size: PairGameSize) => {
    resetBoard(size);
    setStartTime(null);
  };

  // ▶️ Старт игры: перемешиваем и сразу запускаем таймер
  const startGame = () => {
    resetBoard(gridSize);
    setStartTime(Date.now());
  };

  // 🖱 Клик по карточке
  const handleCardClick = (cardId: number) => {
    if (!startTime || isFinished || lockRef.current) return;
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.isOpen || card.isMatched) return;

    const newCards = cards.map((c) =>
      c.id === cardId ? { ...c, isOpen: true } : c
    );
    setCards(newCards);

    const newOpen = [...openCards, cardId];
    setOpenCards(newOpen);

    // Если открыто 2 карточки — проверяем
    if (newOpen.length === 2) {
      lockRef.current = true;
      const newMoves = moves + 1;
      setMoves(newMoves);

      const [firstId, secondId] = newOpen;
      const first = newCards.find((c) => c.id === firstId);
      const second = newCards.find((c) => c.id === secondId);

      if (first && second && first.pairId === second.pairId) {
        // ✅ Совпадение
        later(() => {
          const matched = newCards.map((c) =>
            c.id === firstId || c.id === secondId
              ? { ...c, isMatched: true, isOpen: true }
              : c
          );
          setCards(matched);
          setOpenCards([]);
          lockRef.current = false;

          // Проверяем, все ли открыты
          if (matched.every((c) => c.isMatched)) {
            finishGame(newMoves);
          }
        }, 400);
      } else {
        // ❌ Не совпало — закрываем через 800 мс
        later(() => {
          const closed = newCards.map((c) =>
            c.id === firstId || c.id === secondId
              ? { ...c, isOpen: false }
              : c
          );
          setCards(closed);
          setOpenCards([]);
          lockRef.current = false;
        }, 800);
      }
    }
  };

  // 🏁 Завершение партии
  const finishGame = (finalMoves: number) => {
    const totalSeconds = startTime
      ? Math.floor((Date.now() - startTime) / 1000)
      : elapsedTime;
    setIsFinished(true);
    if (timerRef.current) clearInterval(timerRef.current);

    setElapsedTime(totalSeconds);

    // Новый рекорд — момент радости, рекламу в него не вставляем
    let celebrate = false;

    if (userId) {
      // Рекорды ведутся отдельно для каждого размера поля
      const result = updatePairGameRecord(userId, totalSeconds, finalMoves, gridSize);
      celebrate = result.isNewTimeRecord || result.isNewMovesRecord;
      const rec = readRecords(userId, gridSize);
      setBestTime(rec.bestTime);
      setBestMoves(rec.bestMoves);
      setGamesPlayed(rec.gamesPlayed);

      if (result.isNewTimeRecord && result.isNewMovesRecord) {
        setMessage('🏆 Новый рекорд по времени и ходам!');
      } else if (result.isNewTimeRecord) {
        setMessage('⚡ Новый рекорд по времени!');
      } else if (result.isNewMovesRecord) {
        setMessage('🎯 Новый рекорд по ходам!');
      } else {
        setMessage('✅ Игра завершена!');
      }
    } else {
      setMessage('✅ Игра завершена!');
    }

    // Реклама в естественной паузе, когда результат уже виден. Через later(): отменится,
    // если пользователь сразу начнёт новую партию или уйдёт с экрана.
    if (!celebrate) later(() => void showAdIfDue('game_finished'), 1500);
  };

  const isPlaying = startTime !== null && !isFinished;
  const sizeLabel = `${gridSize}×${gridSize}`;

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
            alt="Импорт тренировок"
            style={{ width: '100%', maxWidth: '380px', height: 'auto', objectFit: 'contain' }}
          />

          <Text
            weight="2"
            style={{
              color: '#FFFFFF',
              fontFamily: 'Impact',
              fontSize: '22px',
            }}
          >
           
          </Text>
        </div>

        {/* Выбор размера поля: до старта и после окончания партии */}
        {!isPlaying && (
          <Group
            header={<Header style={{ color: '#FFFFFF', fontFamily: 'Impact' }}>Выберите сложность</Header>}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(12px)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              padding: '16px',
            }}
          >
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button
                size="l"
                onClick={() => selectSize(4)}
                style={{
                  flex: 1,
                  background: gridSize === 4 ? 'rgba(76, 175, 80, 0.9)' : 'rgba(255, 255, 255, 0.15)',
                  borderRadius: '12px',
                  color: '#FFFFFF',
                  fontFamily: 'Impact',
                  height: '56px',
                }}
              >
                4 × 4 (легко)
              </Button>
              <Button
                size="l"
                onClick={() => selectSize(6)}
                style={{
                  flex: 1,
                  background: gridSize === 6 ? 'rgba(76, 175, 80, 0.9)' : 'rgba(255, 255, 255, 0.15)',
                  borderRadius: '12px',
                  color: '#FFFFFF',
                  fontFamily: 'Impact',
                  height: '56px',
                }}
              >
                6 × 6 (сложно)
              </Button>
            </div>
          </Group>
        )}

        {/* Статистика партии */}
        {(startTime || isFinished) && (
          <Group
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(12px)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              padding: '16px',
              marginTop: '16px',
            }}
          >
            <CardGrid size="l">
              <Card style={{ padding: '12px', textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>Время</Text>
                <Text style={{ fontSize: '22px', fontWeight: 700, color: '#FFFFFF' }}>
                  {formatGameTime(elapsedTime)}
                </Text>
              </Card>
              <Card style={{ padding: '12px', textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>Ходы</Text>
                <Text style={{ fontSize: '22px', fontWeight: 700, color: '#FFFFFF' }}>
                  {moves}
                </Text>
              </Card>
              <Card style={{ padding: '12px', textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>Рекорд {sizeLabel}</Text>
                <Text style={{ fontSize: '22px', fontWeight: 700, color: '#FFFFFF' }}>
                  {bestTime !== null ? formatGameTime(bestTime) : '—'}
                </Text>
              </Card>
              <Card style={{ padding: '12px', textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>Лучшие ходы</Text>
                <Text style={{ fontSize: '22px', fontWeight: 700, color: '#FFFFFF' }}>
                  {bestMoves !== null ? bestMoves : '—'}
                </Text>
              </Card>
            </CardGrid>
          </Group>
        )}

        {/* Подсказка до старта */}
        {!startTime && !isFinished && (
          <Text
            style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: '13px',
              textAlign: 'center',
              marginTop: '16px',
            }}
          >
            Выберите сложность и нажмите «Начать игру» — тогда запустится таймер
          </Text>
        )}

        {/* Игровое поле */}
        <Group
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(12px)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            padding: '12px',
            marginTop: '16px',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
              gap: gridSize === 4 ? '8px' : '6px',
              opacity: startTime || isFinished ? 1 : 0.6,
            }}
          >
            {cards.map((card) => (
              <button
                key={card.id}
                onClick={() => handleCardClick(card.id)}
                disabled={card.isMatched || card.isOpen || !isPlaying}
                aria-label={card.isOpen || card.isMatched ? card.icon : 'Закрытая карточка'}
                style={{
                  aspectRatio: '1 / 1',
                  borderRadius: '10px',
                  fontSize: gridSize === 4 ? '28px' : '20px',
                  background: card.isMatched
                    ? 'rgba(76, 175, 80, 0.35)'
                    : card.isOpen
                    ? 'rgba(255, 255, 255, 0.9)'
                    : 'rgba(255, 255, 255, 0.15)',
                  cursor: isPlaying && !card.isMatched && !card.isOpen ? 'pointer' : 'default',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: card.isOpen || card.isMatched ? '#0a0f0a' : 'transparent',
                  border: card.isMatched
                    ? '2px solid #4CAF50'
                    : '1px solid rgba(255, 255, 255, 0.15)',
                }}
              >
                {(card.isOpen || card.isMatched) ? card.icon : ''}
              </button>
            ))}
          </div>
        </Group>

        {/* Сообщение о победе */}
        {isFinished && (
          <Group
            style={{
              background: 'rgba(76, 175, 80, 0.15)',
              backdropFilter: 'blur(12px)',
              borderRadius: '16px',
              border: '1px solid rgba(76, 175, 80, 0.4)',
              padding: '16px',
              marginTop: '16px',
              textAlign: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              {message}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>
              Время: {formatGameTime(elapsedTime)} · Ходов: {moves} · Партий на {sizeLabel}: {gamesPlayed}
            </Text>
          </Group>
        )}

        {/* Кнопки управления */}
        <Group
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(12px)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            padding: '16px',
            marginTop: '16px',
          }}
        >
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
              fontFamily: 'Impact',
              fontSize: '16px',
              height: '56px',
            }}
          >
            {isPlaying ? '🔄 Новая партия' : isFinished ? '🔄 Сыграть ещё' : '▶ Начать игру'}
          </Button>
        </Group>
      </PageBackground>

      <AppTabbar active="brainbooster" />
    </Panel>
  );
};
export default PairGame;
