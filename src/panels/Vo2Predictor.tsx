// src/panels/Vo2Predictor.tsx
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


import headerImage from '../assets/images/Vo2PredictorHeader.png';
import { AppTabbar } from '../components/AppTabbar';
import { getCurrentUser } from '../utils/userUtils';
import { saveCalculation } from '../utils/statsUtils';

import { PageBackground } from '../components/PageBackground';

interface Vo2PredictorProps {
  id: string;
}

const DISTANCES = [
  { value: '1000', label: '1 км' },
  { value: '3000', label: '3 км' },
  { value: '5000', label: '5 км' },
  { value: '10000', label: '10 км' },
  { value: '21100', label: '21,1 км (полумарафон)' },
  { value: '42195', label: '42,2 км (марафон)' },
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

const calculatePace = (seconds: number, distanceMeters: number): number => {
  return seconds / (distanceMeters / 1000);
};

const predictTime = (
  controlSeconds: number,
  controlDistanceMeters: number,
  targetDistanceMeters: number
): number => {
  const exponent = 1.06;
  return controlSeconds * Math.pow(targetDistanceMeters / controlDistanceMeters, exponent);
};

export const Vo2Predictor = ({ id }: Vo2PredictorProps) => {
  

  const [controlDist, setControlDist] = useState<string>('3000');
  const [controlTime, setControlTime] = useState<string>('');
  const [targetDist, setTargetDist] = useState<string>('10000');
  const [prediction, setPrediction] = useState<{
    time: string;
    pace: string;
    controlPace: string;
    diffPace: string;
  } | null>(null);
  const [error, setError] = useState<string>('');

  const calculate = async () => {
    const ctrlSec = parseTimeToSeconds(controlTime);
    if (ctrlSec === null || ctrlSec <= 0) {
      setError('Введите корректное время (мм:сс или чч:мм:сс, секунды < 60)');
      setPrediction(null);
      return;
    }

    if (controlDist === targetDist) {
      setError('Контрольная и целевая дистанции должны различаться');
      setPrediction(null);
      return;
    }

    setError('');

    const ctrlDistM = parseFloat(controlDist);
    const targetDistM = parseFloat(targetDist);

    const predictedSec = predictTime(ctrlSec, ctrlDistM, targetDistM);
    const controlPace = calculatePace(ctrlSec, ctrlDistM);
    const predictedPace = calculatePace(predictedSec, targetDistM);
    const diffPace = predictedPace - controlPace;

    setPrediction({
      time: formatTime(predictedSec),
      pace: formatTime(predictedPace),
      controlPace: formatTime(controlPace),
      diffPace: diffPace > 0 ? `+${formatTime(diffPace)}` : formatTime(diffPace),
    });

    const user = await getCurrentUser();
    if (user) {
      saveCalculation(user, 'Прогноз времени', `${controlDist}м за ${controlTime} → ${targetDist}м`);
    }
  };

  const controlLabel = DISTANCES.find((d) => d.value === controlDist)?.label || controlDist;
  const targetLabel = DISTANCES.find((d) => d.value === targetDist)?.label || targetDist;

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

      <PageBackground variant="red" pattern="ridge">
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
            alt="Прогноз по VDOT"
            style={{ width: '100%', maxWidth: '380px', height: 'auto', objectFit: 'contain' }}
          />
        </div>

        {/* Форма */}
        <Group
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
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
              Контрольная дистанция
            </Text>
            <Select
              options={DISTANCES}
              value={controlDist}
              onChange={(e) => setControlDist(e.target.value)}
              style={{ width: '100%', marginBottom: '16px' }}
            />

            <Text style={{ color: '#FFFFFF', marginBottom: '8px', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>
              Время на {controlLabel}
            </Text>
            <Input
              placeholder="мм:сс или чч:мм:сс"
              value={controlTime}
              onChange={(e) => setControlTime(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#FFFFFF',
                height: '56px',
                fontSize: '16px',
                padding: '0 16px',
                boxSizing: 'border-box',
                marginBottom: '16px',
              }}
            />

            <Text style={{ color: '#FFFFFF', marginBottom: '8px', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>
              Целевая дистанция
            </Text>
            <Select
              options={DISTANCES}
              value={targetDist}
              onChange={(e) => setTargetDist(e.target.value)}
              style={{ width: '100%', marginBottom: '16px' }}
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
                fontSize: '16px',
                height: '56px',
                boxSizing: 'border-box',
                marginBottom: '16px',
              }}
            >
              Спрогнозировать
            </Button>

            {error && (
              <Text style={{ color: '#F44336', marginTop: '8px' }}>{error}</Text>
            )}
          </div>
        </Group>

        {/* Результат */}
        {prediction && (
          <>
            <Separator style={{ background: 'rgba(255,255,255,0.2)' }} />
            <Group
              header={
                <Header style={{ color: '#FFFFFF', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>
                  Результат прогноза (VDOT)
                </Header>
              }
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderRadius: '16px',
                marginTop: '16px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                padding: '4px 0',
              }}
            >
              <div style={{ padding: '16px' }}>
                <CardGrid size="l">
                  <Card
                    style={{
                      padding: '16px',
                      textAlign: 'center',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '12px',
                    }}
                  >
                    <Text weight="2" style={{ color: '#FFFFFF' }}>
                      Прогноз на {targetLabel}
                    </Text>
                    <Text style={{ fontSize: 32, fontWeight: 700, color: '#648ACE' }}>
                      {prediction.time}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>
                      Темп: {prediction.pace} /км
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                      Контрольный темп: {prediction.controlPace} /км
                    </Text>
                    <Text
                      style={{
                        color: prediction.diffPace.startsWith('+') ? '#F44336' : '#4CAF50',
                        marginTop: 4,
                        fontWeight: 600,
                      }}
                    >
                      Изменение темпа: {prediction.diffPace} /км
                    </Text>
                  </Card>
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
export default Vo2Predictor;