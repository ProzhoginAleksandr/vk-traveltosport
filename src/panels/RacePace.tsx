// src/panels/RacePace.tsx
import { useState } from 'react';
import {
  Panel,
  Group,
  Input,
  Button,
  Text,
  Select,
  Card,
  CardGrid,
  Separator,
  Header,
} from '@vkontakte/vkui';


import headerImage from '../assets/images/RacePaceHeader.png';
import { AppTabbar } from '../components/AppTabbar';
import { getCurrentUser } from '../utils/userUtils';
import { saveCalculation } from '../utils/statsUtils';

import { PageBackground } from '../components/PageBackground';
import { BackButton } from '../components/BackButton';

interface RacePaceProps {
  id: string;
}

const DISTANCES = [
  { value: '5', label: '5 км' },
  { value: '10', label: '10 км' },
  { value: '21.1', label: '21,1 км (полумарафон)' },
  { value: '42.2', label: '42,2 км (марафон)' },
];

const parseTimeToSeconds = (timeStr: string): number | null => {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) {
    const [h, m, s] = parts;
    if (!isNaN(h) && !isNaN(m) && !isNaN(s) && s < 60) return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    if (!isNaN(m) && !isNaN(s) && s < 60) return m * 60 + s;
  }
  return null;
};

const formatTime = (totalSeconds: number): string => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const RacePace = ({ id }: RacePaceProps) => {
  

  const [distance, setDistance] = useState<string>('10');
  const [finishTime, setFinishTime] = useState<string>('');
  const [splits, setSplits] = useState<{ km: number; time: string }[] | null>(null);
  const [error, setError] = useState<string>('');

  const calculate = async () => {
    const distKm = parseFloat(distance);
    if (isNaN(distKm) || distKm <= 0) {
      setError('Выберите дистанцию');
      setSplits(null);
      return;
    }

    const totalSeconds = parseTimeToSeconds(finishTime);
    if (totalSeconds === null || totalSeconds <= 0) {
      setError('Введите корректное время (мм:сс или чч:мм:сс, секунды < 60)');
      setSplits(null);
      return;
    }

    const pacePerKm = totalSeconds / distKm;
    const result: { km: number; time: string }[] = [];
    const fullKm = Math.floor(distKm);
    for (let km = 1; km <= fullKm; km++) {
      const cumulativeTime = pacePerKm * km;
      result.push({ km, time: formatTime(cumulativeTime) });
    }

    const remainder = distKm - fullKm;
    if (remainder > 0.01) {
      const lastTime = pacePerKm * distKm;
      result.push({ km: distKm, time: formatTime(lastTime) });
    }

    setError('');
    setSplits(result);

    const user = await getCurrentUser();
    if (user) {
      saveCalculation(user, 'Раскладка по км', `${distance} км за ${finishTime}`);
    }
  };

  return (
    <Panel id={id} style={{ background: 'transparent', padding: 0 }}>
      <style>{`
        .vkuiGroup { background: transparent !important; }
        .vkuiInput__el { color: #FFFFFF !important; }
        .vkuiInput__el::placeholder { color: rgba(255, 255, 255, 0.5) !important; }
        .vkuiSelect__el {
          color: #FFFFFF !important;
          background: rgba(255, 255, 255, 0.05) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-radius: 12px !important;
          height: 56px !important;
          padding: 0 16px !important;
        }
        .vkuiSelect__el option {
          background: #1c1c2e !important;
          color: #FFFFFF !important;
        }
        .vkuiCard { background: transparent !important; }
      `}</style>

      <PageBackground variant="red" pattern="footsteps">
        <BackButton to="/runner_calculator" />
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
            alt="Раскладка по километрам"
            style={{ width: '100%', maxWidth: '380px', height: 'auto', objectFit: 'contain' }}
          />
        </div>

        {/* Форма */}
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
            <Text style={{ color: '#FFFFFF', marginBottom: '8px', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>
              Дистанция
            </Text>
            <Select
              options={DISTANCES}
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              style={{ width: '100%', marginBottom: '16px' }}
            />

            <Text style={{ color: '#FFFFFF', marginBottom: '8px', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>
              Финишное время
            </Text>
            <Input
              placeholder="мм:сс или чч:мм:сс"
              value={finishTime}
              onChange={(e) => setFinishTime(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#FFFFFF',
                height: '56px',
                fontSize: '15px',
                padding: '0 16px',
                boxSizing: 'border-box',
                marginBottom: '16px',
              }}
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
              Рассчитать раскладку
            </Button>

            {error && (
              <Text style={{ color: '#F44336', marginTop: '8px' }}>{error}</Text>
            )}
          </div>
        </Group>

        {/* Результат */}
        {splits && (
          <>
            <Separator style={{ background: 'rgba(255,255,255,0.2)' }} />
            <Group
              header={
                <Header style={{ color: '#FFFFFF', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>
                  Раскладка по километрам
                </Header>
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
                <CardGrid size="l">
                  {splits.map((split) => (
                    <Card
                      key={split.km}
                      style={{
                        padding: '12px 16px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '12px',
                      }}
                    >
                      <Text weight="2" style={{ color: '#FFFFFF' }}>
                        {split.km} км
                      </Text>
                      <Text style={{ fontSize: 20, fontWeight: 600, color: '#FFFFFF' }}>
                        {split.time}
                      </Text>
                    </Card>
                  ))}
                </CardGrid>
              </div>
            </Group>
          </>
        )}
      </PageBackground>

      <AppTabbar active="calculator" />
    </Panel>
  );
};
export default RacePace;
