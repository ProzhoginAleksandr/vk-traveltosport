// src/panels/PaceConverter.tsx
import { useState } from 'react';
import {
  Panel,
  Group,
  Input,
  Button,
  Text,
} from '@vkontakte/vkui';


import headerImage from '../assets/images/PaceConverterHeader.png';
import { AppTabbar } from '../components/AppTabbar';
import { getCurrentUser } from '../utils/userUtils';
import { saveCalculation } from '../utils/statsUtils';
import { PageBackground } from '../components/PageBackground';

interface PaceConverterProps {
  id: string;
}

export const PaceConverter = ({ id }: PaceConverterProps) => {
  

  const [speed, setSpeed] = useState<string>('');
  const [pace, setPace] = useState<string>('');
  const [speedResult, setSpeedResult] = useState<string>('');
  const [paceResult, setPaceResult] = useState<string>('');

  const convertSpeedToPace = async () => {
    const speedNum = parseFloat(speed);
    if (isNaN(speedNum) || speedNum <= 0) {
      setPaceResult('❌ Введите корректную скорость (число > 0)');
      setSpeedResult('');
      return;
    }
    const paceMinutes = 60 / speedNum;
    const mins = Math.floor(paceMinutes);
    const secs = Math.round((paceMinutes - mins) * 60);
    const result = `Темп: ${mins}:${secs.toString().padStart(2, '0')} мин/км`;
    setPaceResult(result);
    setSpeedResult('');

    const user = await getCurrentUser();
    if (user) {
      saveCalculation(user, 'Конвертер скорости', `${speed} км/ч → ${result}`);
    }
  };

  const convertPaceToSpeed = () => {
    const parts = pace.replace(',', '.').split(/[:.]/);
    if (parts.length === 2) {
      const mins = parseFloat(parts[0]);
      const secs = parseFloat(parts[1]);
      if (!isNaN(mins) && !isNaN(secs) && secs < 60) {
        const paceMinutes = mins + secs / 60;
        if (paceMinutes > 0) {
          const speedKmh = 60 / paceMinutes;
          setSpeedResult(`Скорость: ${speedKmh.toFixed(2)} км/ч`);
          setPaceResult('');
          return;
        }
      }
    }
    setSpeedResult('❌ Введите темп в формате "мин:сек", например 5:30 (секунды < 60)');
    setPaceResult('');
  };

  return (
    <Panel id={id} style={{ background: 'transparent', padding: 0 }}>
      <style>{`
        .vkuiGroup { background: transparent !important; }
        .vkuiInput__el { color: #FFFFFF !important; }
        .vkuiInput__el::placeholder { color: rgba(255, 255, 255, 0.5) !important; }
      `}</style>

      <PageBackground variant="red" pattern="track">
        {/* Кастомный Header с кнопкой «Назад» */}
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
            alt="Конвертер"
            style={{ width: '100%', maxWidth: '380px', height: 'auto', objectFit: 'contain' }}
          />
        </div>

        {/* Основной контент */}
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
            <Text style={{ color: '#FFFFFF', marginBottom: '8px', fontFamily: 'Arial' }}>
              Скорость (км/ч)
            </Text>

            <Input
              type="number"
              min="0"
              step="0.1"
              placeholder="например: 10"
              value={speed}
              onChange={(e) => setSpeed(e.target.value)}
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
                marginBottom: '8px',
              }}
            />

            <Button
              size="l"
              stretched
              onClick={convertSpeedToPace}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.25)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
                fontFamily: 'Impact',
                fontSize: '16px',
                height: '56px',
                boxSizing: 'border-box',
                marginBottom: '16px',
              }}
            >
              → в темп
            </Button>

            {paceResult && (
              <div style={{ marginBottom: '16px' }}>
                <Text weight="2" style={{ fontSize: '16px', color: '#4CAF50' }}>
                  {paceResult}
                </Text>
              </div>
            )}

            <div style={{ height: '16px' }} />

            <Text style={{ color: '#FFFFFF', marginBottom: '8px', fontFamily: 'Arial' }}>
              Темп (мин/км)
            </Text>

            <Input
              placeholder="например: 5:30"
              value={pace}
              onChange={(e) => setPace(e.target.value)}
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
                marginBottom: '8px',
              }}
            />

            <Button
              size="l"
              stretched
              onClick={convertPaceToSpeed}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.25)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
                fontFamily: 'Impact',
                fontSize: '16px',
                height: '56px',
                boxSizing: 'border-box',
                marginBottom: '16px',
              }}
            >
              → в скорость
            </Button>

            {speedResult && (
              <div>
                <Text weight="2" style={{ fontSize: '16px', color: '#4CAF50' }}>
                  {speedResult}
                </Text>
              </div>
            )}
          </div>
        </Group>
      </PageBackground>

      <AppTabbar active="calculator" />
    </Panel>
  );
};
export default PaceConverter;