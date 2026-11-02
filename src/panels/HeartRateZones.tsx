// src/panels/HeartRateZones.tsx
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  Panel,
  Group,
  Input,
  Button,
  Text,
  Card,
  CardGrid,
  Separator,
  Header,
} from '@vkontakte/vkui';


import headerImage from '../assets/images/HeartRateZonesHeader.png';
import { AppTabbar } from '../components/AppTabbar';
import { getCurrentUser } from '../utils/userUtils';
import { saveCalculation } from '../utils/statsUtils';

import { PageBackground } from '../components/PageBackground';

interface HeartRateZonesProps {
  id: string;
}

interface ZoneBase {
  name: string;
  minPct: number;
  maxPct: number;
  color: string;
  emoji: string;
  feel: string;
  purpose: string;
}

const ZONES_BASE: ZoneBase[] = [
  {
    name: 'Базовая аэробная',
    minPct: 55,
    maxPct: 65,
    color: '#648ACE',
    emoji: '🔵',
    feel: 'Лёгкий комфортный бег. Можно свободно разговаривать и дышать только носом.',
    purpose: 'Развивает базовую выносливость и помогает восстановиться. Основа большей части тренировочного объёма.',
  },
  {
    name: 'Сложная аэробная',
    minPct: 65,
    maxPct: 75,
    color: '#4CAF50',
    emoji: '🟢',
    feel: 'Умеренная нагрузка. Говорить ещё можно, но уже короткими фразами.',
    purpose: 'Укрепляет сердечно-сосудистую систему и повышает аэробные возможности. Подходит для длительных пробежек.',
  },
  {
    name: 'Лактатный порог',
    minPct: 75,
    maxPct: 85,
    color: '#d7e244',
    emoji: '🟡',
    feel: 'Ощущение «комфортно тяжело». Дыхание глубокое и частое, разговор ограничен несколькими словами.',
    purpose: 'Учит организм дольше держать высокий темп. Типичные тренировки — темповые отрезки по 20–40 минут.',
  },
  {
    name: 'Базовая анаэробная',
    minPct: 85,
    maxPct: 95,
    color: '#FF9800',
    emoji: '🟠',
    feel: 'Тяжёлая нагрузка. Дыхание очень частое, говорить почти невозможно.',
    purpose: 'Повышает МПК и скоростную выносливость. Применяется в интервалах по 3–8 минут с отдыхом между ними.',
  },
  {
    name: 'Сложная анаэробная',
    minPct: 95,
    maxPct: 100,
    color: '#B21212',
    emoji: '🔴',
    feel: 'Предельное усилие. Удержать его можно лишь очень короткое время.',
    purpose: 'Короткие ускорения и финишные рывки. Использовать редко и только при хорошей подготовке.',
  },
];

interface Zone extends ZoneBase {
  min: number;
  max: number;
}

interface Result {
  zones: Zone[];
  mhr: number;
  rest: number;
  reserve: number;
  byFormula: boolean;
}

// Строгий разбор целого числа: отсекает '1e2', '30.5', '-5', '' и т. п.
const parseStrictInt = (value: string): number | null => {
  const v = value.trim();
  return /^\d{1,3}$/.test(v) ? Number(v) : null;
};

const inputStyle = {
  width: '100%',
  background: 'rgba(255, 255, 255, 0.05)',
  borderRadius: '12px',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  color: '#FFFFFF',
  height: '56px',
  fontSize: '15px',
  padding: '0 16px',
  boxSizing: 'border-box' as const,
  marginBottom: '16px',
};

const labelStyle = { color: '#FFFFFF', marginBottom: '8px', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' };

// 🪟 Всплывающее окно с описанием зоны
interface ZoneModalProps {
  zone: Zone;
  onClose: () => void;
}

const ZoneModal = ({ zone, onClose }: ZoneModalProps) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'rgba(0, 0, 0, 0.6)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={zone.name}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 360,
          maxHeight: '85vh',
          overflowY: 'auto',
          boxSizing: 'border-box',
          padding: 24,
          borderRadius: 20,
          color: '#FFFFFF',
          background: 'linear-gradient(160deg, #1c4934 0%, #01130f 100%)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderTop: `4px solid ${zone.color}`,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, lineHeight: 1 }}>{zone.emoji}</div>
          <div style={{ fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif', fontSize: 22, margin: '10px 0 4px' }}>{zone.name}</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            {zone.min} – {zone.max} уд/мин
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
            {zone.minPct}–{zone.maxPct}% от резерва ЧСС
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif', fontSize: 15, color: zone.color, marginBottom: 4 }}>
            Ощущения
          </div>
          <Text style={{ color: '#DDDDDD', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif', whiteSpace: 'normal' }}>{zone.feel}</Text>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif', fontSize: 15, color: zone.color, marginBottom: 4 }}>
            Для чего
          </div>
          <Text style={{ color: '#DDDDDD', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif', whiteSpace: 'normal' }}>{zone.purpose}</Text>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 24,
            width: '100%',
            padding: '12px 0',
            borderRadius: 12,
            border: 'none',
            background: 'rgba(255, 255, 255, 0.15)',
            color: '#FFFFFF',
            fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          Закрыть
        </button>
      </div>
    </div>,
    document.body
  );
};

export const HeartRateZones = ({ id }: HeartRateZonesProps) => {
 

  const [age, setAge] = useState<string>('');
  const [restHR, setRestHR] = useState<string>('');
  const [customMhr, setCustomMhr] = useState<string>('');
  const [result, setResult] = useState<Result | null>(null);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [error, setError] = useState<string>('');

  // Последняя сохранённая в историю запись — чтобы не плодить дубли
  const lastSavedRef = useRef<string>('');

  // При изменении любого поля старый результат убираем, чтобы он не вводил в заблуждение
  const handleChange =
    (setter: (value: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value);
      setResult(null);
      setSelectedZone(null);
      setError('');
    };

  const handleEnter = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') void calculate();
  };

  const fail = (message: string) => {
    setError(message);
    setResult(null);
    setSelectedZone(null);
  };

  const calculate = async () => {
    const customEntered = customMhr.trim() !== '';

    // Возраст нужен только если МЧСС считается по формуле
    let ageNum: number | null = null;
    if (!customEntered) {
      ageNum = parseStrictInt(age);
      if (ageNum === null || ageNum < 10 || ageNum > 120) {
        fail('Введите корректный возраст (10–120 лет)');
        return;
      }
    }

    const restNum = parseStrictInt(restHR);
    if (restNum === null || restNum < 30 || restNum > 120) {
      fail('Введите корректный пульс в покое (30–120 уд/мин)');
      return;
    }

    let mhr: number;
    if (customEntered) {
      const customNum = parseStrictInt(customMhr);
      if (customNum === null || customNum < 100 || customNum > 250) {
        fail('Введите корректный МЧСС (100–250 уд/мин)');
        return;
      }
      mhr = customNum;
    } else {
      mhr = Math.round(211 - 0.64 * (ageNum as number));
    }

    if (mhr <= restNum) {
      fail('МЧСС должен быть больше пульса в покое');
      return;
    }

    const reserve = mhr - restNum;

    // Границы зон не пересекаются: минимум следующей зоны = максимум предыдущей + 1
    let prevMax = 0;
    const zones: Zone[] = ZONES_BASE.map((zone, i) => {
      const rawMin = Math.round(reserve * (zone.minPct / 100) + restNum);
      const rawMax = Math.round(reserve * (zone.maxPct / 100) + restNum);
      const min = i === 0 ? rawMin : prevMax + 1;
      const max = Math.max(rawMax, min);
      prevMax = max;
      return { ...zone, min, max };
    });

    setError('');
    setSelectedZone(null);
    setResult({ zones, mhr, rest: restNum, reserve, byFormula: !customEntered });

    // Сохранение в историю не должно ломать экран, если что-то пошло не так
    try {
      const user = await getCurrentUser();
      if (user) {
        const parts: string[] = [];
        if (age.trim() !== '') parts.push(`Возраст ${age.trim()}`);
        parts.push(`пульс покоя ${restNum}`);
        parts.push(`МЧСС ${mhr} (${customEntered ? 'введён вручную' : 'по формуле'})`);
        const description = parts.join(', ');

        if (lastSavedRef.current !== description) {
          await saveCalculation(user, 'Пульсовые зоны', description);
          lastSavedRef.current = description;
        }
      }
    } catch (err) {
      console.warn('Не удалось сохранить расчёт в историю:', err);
    }
  };

  return (
    <Panel id={id} style={{ background: 'transparent', padding: 0 }}>
      <style>{`
        .vkuiGroup { background: transparent !important; }
        .vkuiInput__el { color: #FFFFFF !important; }
        .vkuiInput__el::placeholder { color: rgba(255, 255, 255, 0.5) !important; }
        .vkuiCard { background: transparent !important; }
      `}</style>

      <PageBackground variant="red" pattern="pulse">
        {/* Header с кнопкой «Назад» */}
        <div
          style={{
            paddingTop: '20px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            position: 'relative',
          }}
        >


          <img
            src={headerImage}
            alt="Пульсовые зоны"
            style={{ width: '100%', maxWidth: '380px', height: 'auto', objectFit: 'contain' }}
          />
        </div>

        {/* Форма ввода */}
        <Group
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            marginTop: '16px',
            marginBottom: '12px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            padding: '4px 0',
          }}
        >
          <div style={{ padding: '16px' }}>
            <Text style={labelStyle}>
              Возраст (лет){customMhr.trim() !== '' ? ' — необязательно' : ''}
            </Text>
            <Input
              type="number"
              inputMode="numeric"
              min="10"
              max="120"
              placeholder="например: 30"
              value={age}
              onChange={handleChange(setAge)}
              onKeyDown={handleEnter}
              style={inputStyle}
            />

            <Text style={labelStyle}>Пульс в покое (уд/мин)</Text>
            <Input
              type="number"
              inputMode="numeric"
              min="30"
              max="120"
              placeholder="например: 65"
              value={restHR}
              onChange={handleChange(setRestHR)}
              onKeyDown={handleEnter}
              style={inputStyle}
            />

            <Text style={labelStyle}>МЧСС (максимальный пульс)</Text>
            <Input
              type="number"
              inputMode="numeric"
              min="100"
              max="250"
              placeholder="необязательно"
              value={customMhr}
              onChange={handleChange(setCustomMhr)}
              onKeyDown={handleEnter}
              style={inputStyle}
            />

            <Button
              size="l"
              stretched
              onClick={calculate}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.25)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
                fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
                fontSize: '15px',
                height: '56px',
                boxSizing: 'border-box',
                marginBottom: '16px',
              }}
            >
              Рассчитать зоны
            </Button>

            {error && <Text style={{ color: '#F44336', marginTop: '8px' }}>{error}</Text>}
          </div>
        </Group>

        {/* Результаты */}
        {result && (
          <>
            <Separator style={{ background: 'rgba(255,255,255,0.2)' }} />

            {/* Использованный МЧСС */}
            <Group
              header={
                <Header style={{ color: '#FFFFFF', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>Использованные данные</Header>
              }
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                marginTop: '16px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                padding: '4px 0',
              }}
            >
              <div style={{ padding: '16px' }}>
                <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 600 }}>
                  МЧСС: {result.mhr} уд/мин
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 8 }}>
                  {result.byFormula
                    ? 'Рассчитан по формуле 211 − 0,64 × возраст'
                    : 'Введён вручную'}
                </Text>
                <Text style={{ color: '#FFFFFF' }}>Пульс в покое: {result.rest} уд/мин</Text>
                <Text style={{ color: '#FFFFFF' }}>Резерв ЧСС: {result.reserve} уд/мин</Text>
              </div>
            </Group>

            {/* Зоны */}
            <Group
              header={
                <Header style={{ color: '#FFFFFF', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>Ваши пульсовые зоны</Header>
              }
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                marginTop: '12px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                padding: '4px 0',
              }}
            >
              <div style={{ padding: '16px' }}>
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: 13,
                    textAlign: 'center',
                    marginBottom: 12,
                  }}
                >
                  Нажмите на зону, чтобы узнать подробнее
                </Text>

                <CardGrid size="l">
                  {result.zones.map((zone) => (
                    <Card
                      key={zone.name}
                      role="button"
                      tabIndex={0}
                      aria-label={`${zone.name}: ${zone.min}–${zone.max} уд/мин. Нажмите для описания`}
                      onClick={() => setSelectedZone(zone)}
                      onKeyDown={(e: ReactKeyboardEvent<HTMLDivElement>) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedZone(zone);
                        }
                      }}
                      style={{
                        borderLeft: `4px solid ${zone.color}`,
                        padding: '12px 16px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      <Text weight="2" style={{ color: '#FFFFFF' }}>
                        {zone.emoji} {zone.name}
                      </Text>
                      <Text style={{ fontSize: 20, fontWeight: 600, color: '#FFFFFF' }}>
                        {zone.min} – {zone.max} уд/мин
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.6)' }}>
                        {zone.minPct}–{zone.maxPct}% от резерва ЧСС
                      </Text>
                    </Card>
                  ))}
                </CardGrid>

                <Text
                  style={{
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontSize: 13,
                    marginTop: 16,
                    whiteSpace: 'normal',
                  }}
                >
                  Значения ориентировочные. Если у вас есть заболевания сердца или вы давно не
                  тренировались, проконсультируйтесь с врачом перед интенсивными нагрузками.
                </Text>
              </div>
            </Group>
          </>
        )}
      </PageBackground>

      {selectedZone && <ZoneModal zone={selectedZone} onClose={() => setSelectedZone(null)} />}

      <AppTabbar active="calculator" />
    </Panel>
  );
};
export default HeartRateZones;
