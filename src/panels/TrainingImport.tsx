// src/panels/TrainingImport.tsx
import { useState, useRef } from 'react';
import {
  Panel,
  Group,
  Text,
  Div,
  Header,
  Button,
  Spinner,
  Card,
  CardGrid,
} from '@vkontakte/vkui';
import { Icon24Upload } from '@vkontakte/icons';

import headerImage from '../assets/images/HomeHeader.png';
import { AppTabbar } from '../components/AppTabbar';

import { getCurrentUser } from '../utils/userUtils';
import { saveTrackToStorage } from '../utils/trackStorage';
import { parseTrackFile } from '../utils/importUtils';

import { PageBackground} from '../components/PageBackground';

interface TrainingImportProps {
  id: string;
}

const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const formatPace = (paceSecPerKm: number): string => {
  if (!paceSecPerKm || paceSecPerKm <= 0) return '—';
  const mins = Math.floor(paceSecPerKm / 60);
  const secs = Math.round(paceSecPerKm % 60);
  return `${mins}:${String(secs).padStart(2, '0')} /км`;
};

export const TrainingImport = ({ id }: TrainingImportProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [lastImported, setLastImported] = useState<{
    distance: number;
    duration: number;
    pace: number;
    speed: number;
    date: string;
  } | null>(null);

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setMessage('');
    setLastImported(null);

    try {
      // 📖 Читаем файл
      const content = await file.text();

      // 📊 Парсим
      const parsedTrack = parseTrackFile(content, file.name);

      if (!parsedTrack) {
        setMessage('❌ Не удалось прочитать файл. Проверьте формат GPX или TCX.');
        setMessageType('error');
        setIsProcessing(false);
        return;
      }

      // 👤 Получаем пользователя
      const user = await getCurrentUser();
      if (!user) {
        setMessage('❌ Не удалось получить пользователя');
        setMessageType('error');
        setIsProcessing(false);
        return;
      }

      // 💾 Сохраняем
      const success = saveTrackToStorage(user.id, parsedTrack);

      if (success) {
        setMessage(`✅ Тренировка «${file.name}» успешно импортирована`);
        setMessageType('success');
        setLastImported({
          distance: parsedTrack.distance,
          duration: parsedTrack.duration,
          pace: parsedTrack.pace,
          speed: parsedTrack.speed,
          date: parsedTrack.date,
        });
      } else {
        setMessage('❌ Не удалось сохранить тренировку');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Ошибка импорта:', error);
      setMessage('❌ Ошибка обработки файла');
      setMessageType('error');
    } finally {
      setIsProcessing(false);
      // Сбрасываем input, чтобы можно было выбрать тот же файл снова
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Panel id={id} style={{ background: 'transparent', padding: 0 }}>
      <style>{`
        .vkuiGroup { background: transparent !important; }
        .vkuiCard { background: transparent !important; }
      `}</style>

      <PageBackground variant="blue" pattern="footsteps">
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
            alt="Импорт тренировок"
            style={{ width: '100%', maxWidth: '380px', height: 'auto', objectFit: 'contain' }}
          />
        </div>

        {/* Информация */}
        <Group
          header={
            <Header style={{ color: '#FFFFFF', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>
              📥 Импорт тренировок
            </Header>
          }
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(12px)',
            borderRadius: '16px',
            marginTop: '16px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            padding: '16px',
          }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.8)', lineHeight: '1.5' }}>
            Загрузите файл тренировки из вашего носимого устройства:
          </Text>

          <Div style={{ padding: '12px 0 0 0' }}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>
              🏃 <b>GPX</b> — Garmin, Polar, Suunto, Huawei, Strava{'\n'}
              🏃 <b>TCX</b> — Garmin Training Center
            </Text>
          </Div>
        </Group>

        {/* Кнопка выбора файла */}
        <Group
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(12px)',
            borderRadius: '16px',
            marginTop: '16px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            padding: '16px',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".gpx,.tcx,application/gpx+xml,application/vnd.garmin.tcx+xml"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          <Button
            size="l"
            stretched
            onClick={handleFileClick}
            disabled={isProcessing}
            before={isProcessing ? <Spinner size="s" /> : <Icon24Upload />}
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
            {isProcessing ? 'Обработка...' : '📁 Выбрать файл'}
          </Button>

          {message && (
            <Div style={{ marginTop: '12px' }}>
              <Text
                style={{
                  color:
                    messageType === 'success'
                      ? '#4CAF50'
                      : messageType === 'error'
                      ? '#F44336'
                      : '#FF9800',
                  textAlign: 'center',
                }}
              >
                {message}
              </Text>
            </Div>
          )}
        </Group>

        {/* Результат импорта */}
        {lastImported && (
          <Group
            header={
              <Header style={{ color: '#FFFFFF', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>
                📊 Импортированная тренировка
              </Header>
            }
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(12px)',
              borderRadius: '16px',
              marginTop: '16px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              padding: '16px',
            }}
          >
            <CardGrid size="l">
              <Card
                style={{
                  padding: '12px',
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '12px',
                }}
              >
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>
                  Дистанция
                </Text>
                <Text style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF' }}>
                  {(lastImported.distance / 1000).toFixed(2)} км
                </Text>
              </Card>
              <Card
                style={{
                  padding: '12px',
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '12px',
                }}
              >
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>Время</Text>
                <Text style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF' }}>
                  {formatDuration(lastImported.duration)}
                </Text>
              </Card>
              <Card
                style={{
                  padding: '12px',
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '12px',
                }}
              >
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>Темп</Text>
                <Text style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF' }}>
                  {formatPace(lastImported.pace)}
                </Text>
              </Card>
              <Card
                style={{
                  padding: '12px',
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '12px',
                }}
              >
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>Скорость</Text>
                <Text style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF' }}>
                  {lastImported.speed.toFixed(2)} км/ч
                </Text>
              </Card>
            </CardGrid>

            <Div>
              <Text style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', fontSize: '13px' }}>
                Тренировка добавлена в профиль. Откройте «Профиль», чтобы увидеть её на карте.
              </Text>
            </Div>
          </Group>
        )}
      </PageBackground>

      <AppTabbar active="diary" />
    </Panel>
  );
};
export default TrainingImport;