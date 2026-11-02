// src/panels/Tracker.tsx
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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

import { MapContainer, TileLayer, Polyline, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import trackerHeaderImage from '../assets/images/TrackerHeader.png';
import { AppTabbar } from '../components/AppTabbar';
import { PageBackground } from '../components/PageBackground';
import { BigRunScreen } from '../components/BigRunScreen';
import { ShareRunModal } from '../components/ShareRunModal';
import { useRunTracker, type TrackPoint } from '../hooks/useRunTracker';
import { formatDuration, formatKm, formatPaceValue } from '../utils/runFormat';
import { trackToGpx } from '../utils/gpx';
import { saveFile, textToFile } from '../utils/fileExport';
import { showAdIfDue } from '../utils/adUtils';
import { getBuildId } from '../utils/buildInfo';
import type { TrackerSettings } from '../utils/trackerSettings';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface TrackerProps {
  id: string;
}

const glass: CSSProperties = {
  background: 'rgba(255, 255, 255, 0.08)',
  backdropFilter: 'blur(12px)',
  borderRadius: '16px',
  border: '1px solid rgba(255, 255, 255, 0.12)',
};

const statCard: CSSProperties = {
  padding: '12px',
  textAlign: 'center',
  background: 'rgba(255,255,255,0.05)',
  borderRadius: '12px',
};

const actionButton = (background: string): CSSProperties => ({
  width: '100%',
  background,
  borderRadius: '12px',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  color: '#FFFFFF',
  fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
  fontSize: '16px',
  height: '56px',
});

const SETTING_ITEMS: Array<{ key: keyof TrackerSettings; label: string }> = [
  { key: 'vibration', label: 'Вибрация на каждом километре' },
  { key: 'countdown', label: 'Отсчёт 3-2-1 перед стартом' },
];

/* -------------------------------------------------------------------------- */
/*  Карта: слежение за позицией и кнопка «Где я»                               */
/* -------------------------------------------------------------------------- */

interface MapControllerProps {
  position: { lat: number; lon: number } | null;
  follow: boolean;
  onUserPan: () => void;
  onLocate: () => void;
}

const MapController = ({ position, follow, onUserPan, onLocate }: MapControllerProps) => {
  const map = useMap();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const onLocateRef = useRef(onLocate);

  useEffect(() => {
    onLocateRef.current = onLocate;
  });

  // Пользователь двигает карту пальцем — перестаём за ним «убегать»
  useMapEvents({ dragstart: onUserPan });

  // В режиме слежения центрируем карту, но не трогаем выбранный пользователем масштаб
  useEffect(() => {
    if (follow && position) {
      map.setView([position.lat, position.lon], map.getZoom(), { animate: true });
    }
  }, [follow, position, map]);

  // Кнопка создаётся один раз (раньше пересоздавалась при каждой точке GPS)
  useEffect(() => {
    const LocateButton = L.Control.extend({
      onAdd: () => {
        const btn = L.DomUtil.create('button');
        btn.innerHTML = '📍';
        btn.title = 'Где я';
        btn.setAttribute('aria-label', 'Где я');
        btn.style.cssText = `
          width: 40px;
          height: 40px;
          font-size: 20px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 8px;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          color: white;
        `;
        L.DomEvent.disableClickPropagation(btn);
        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          onLocateRef.current();
        };
        buttonRef.current = btn;
        return btn;
      },
    });

    const control = new LocateButton({ position: 'topright' });
    control.addTo(map);
    return () => {
      control.remove();
      buttonRef.current = null;
    };
  }, [map]);

  // Цвет кнопки показывает, включено ли слежение
  useEffect(() => {
    if (buttonRef.current) {
      buttonRef.current.style.background = follow
        ? 'rgba(9, 107, 17, 0.95)'
        : 'rgba(70, 70, 70, 0.9)';
    }
  }, [follow]);

  return null;
};

// Линия маршрута: пройденное — зелёным, участки на паузе — серым пунктиром
const renderPolylines = (track: TrackPoint[]) => {
  if (track.length < 2) return null;

  const result: JSX.Element[] = [];
  let segmentStart = 0;
  let currentIsPaused = track[0].isPaused || track[1].isPaused;

  const push = (key: string, from: number, to: number | undefined, paused: boolean) => {
    const positions: [number, number][] = track
      .slice(from, to)
      .map((p) => [p.lat, p.lon]);
    if (positions.length >= 2) {
      result.push(
        <Polyline
          key={key}
          positions={positions}
          color={paused ? '#888888' : '#4CAF50'}
          weight={paused ? 3 : 5}
          opacity={paused ? 0.7 : 1}
          dashArray={paused ? '8, 8' : undefined}
        />
      );
    }
  };

  for (let i = 2; i < track.length; i++) {
    const segPaused = track[i - 1].isPaused || track[i].isPaused;
    if (segPaused !== currentIsPaused) {
      push(`seg-${segmentStart}`, segmentStart, i, currentIsPaused);
      segmentStart = i - 1;
      currentIsPaused = segPaused;
    }
  }
  push('seg-final', segmentStart, undefined, currentIsPaused);

  return result;
};

/* -------------------------------------------------------------------------- */
/*  Экран                                                                      */
/* -------------------------------------------------------------------------- */

export const Tracker = ({ id }: TrackerProps) => {
  
  const run = useRunTracker();
  const { phase, summary } = run;

  const [follow, setFollow] = useState(true);
  const [bigMode, setBigMode] = useState(false);
  const [stopConfirm, setStopConfirm] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [exportInfo, setExportInfo] = useState('');
  const [locateHint, setLocateHint] = useState('');
  const [simSpeed, setSimSpeed] = useState(3);

  const isActive = phase === 'running' || phase === 'paused';

  // Линия маршрута пересобирается только когда меняются точки, а не каждую секунду вместе с таймером
  const polylines = useMemo(() => renderPolylines(run.points), [run.points]);

  useEffect(() => {
    setStopConfirm(false);
    if (!isActive) setBigMode(false);
    if (phase === 'idle' || phase === 'countdown') {
      setShareOpen(false);
      setExportInfo('');
    }
  }, [phase, isActive]);

  useEffect(() => {
    if (run.position) setLocateHint('');
  }, [run.position]);

  // Реклама в естественной паузе: пробежка сохранена, результат уже на экране.
  // Если получено новое звание, ролик не показываем, чтобы не портить этот момент.
  useEffect(() => {
    if (run.saveState !== 'saved' || run.rankUp) return;
    const timer = setTimeout(() => {
      void showAdIfDue('run_finished');
    }, 2500);
    return () => clearTimeout(timer);
  }, [run.saveState, run.rankUp]);

  const handleLocate = () => {
    if (!run.position) {
      setLocateHint('Ждём сигнал GPS...');
      return;
    }
    setLocateHint('');
    setFollow(true);
  };


  const handleExportGpx = async () => {
    if (!summary) return;
    const file = textToFile(
      trackToGpx(summary.track),
      `traveltosport_${Date.now()}.gpx`,
      'application/gpx+xml'
    );
    const result = await saveFile(file);
    if (result === 'failed') {
      setExportInfo('Не удалось сохранить файл.');
    } else if (result === 'download-attempted') {
      setExportInfo('Если файл не появился в «Загрузках», попробуйте открыть приложение в браузере.');
    } else {
      setExportInfo('');
    }
  };

  const lastPoint = run.points.length > 0 ? run.points[run.points.length - 1] : null;
  const mapCenter: [number, number] = run.position
    ? [run.position.lat, run.position.lon]
    : lastPoint
    ? [lastPoint.lat, lastPoint.lon]
    : [55.7558, 37.6173];

  const gpsColor =
    run.gps.level === 'good' ? '#4CAF50' : run.gps.level === 'searching' ? '#FF9800' : '#F44336';

  const fastestKm =
    run.splits.length > 1 ? Math.min(...run.splits.map((s) => s.seconds)) : null;

  const renderSplits = (list: typeof run.splits) => (
    <div style={{ marginTop: 12 }}>
      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 6 }}>
        Отсечки по километрам
      </Text>
      {list.map((s) => (
        <div
          key={s.km}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '6px 0',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            color: s.seconds === fastestKm ? '#4CAF50' : '#FFFFFF',
            fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
            fontSize: 15,
          }}
        >
          <span>Км {s.km}</span>
          <span>
            {formatDuration(s.seconds)}
            {s.seconds === fastestKm ? ' 🔥' : ''}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <Panel id={id} style={{ background: 'transparent', padding: 0 }}>
      <style>{`
        .vkuiGroup { background: transparent !important; }
        .vkuiCard { background: transparent !important; }
        .leaflet-container { border-radius: 12px; background: #0a0f0a; }
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
            src={trackerHeaderImage}
            alt="Трекер пробежек"
            style={{ width: '100%', maxWidth: '380px', height: 'auto', objectFit: 'contain' }}
          />
        </div>

        {/* Сообщения */}
        {run.geoError && (
          <Div>
            <Text style={{ color: '#FF9800', textAlign: 'center', fontSize: '13px' }}>
              📍 {run.geoError}
            </Text>
          </Div>
        )}
        {locateHint && (
          <Div>
            <Text style={{ color: '#FF9800', textAlign: 'center', fontSize: '13px' }}>{locateHint}</Text>
          </Div>
        )}

        <Div>
          <Text style={{ color: gpsColor, textAlign: 'center', fontSize: '13px' }}>
            🛰️ {run.gps.text}
            {phase === 'idle' && run.gps.ready ? ' · готов к старту' : ''}
            {run.filteredCount > 0 ? ` · отфильтровано: ${run.filteredCount}` : ''}
          </Text>
          <Text style={{ color: '#FF9800', textAlign: 'center', fontSize: '12px', marginTop: 2 }}>
            сборка {getBuildId() || 'dev'}
          </Text>
        </Div>

        {run.backgroundWarning && (
          <Div>
            <Text style={{ color: '#FF9800', textAlign: 'center', fontSize: '13px' }}>
              ⚠️ {run.backgroundWarning}
            </Text>
          </Div>
        )}
        {run.notice && (
          <Div>
            <Text style={{ color: '#FF9800', textAlign: 'center', fontSize: '13px' }}>{run.notice}</Text>
          </Div>
        )}

        {/* Незавершённая пробежка из прошлого запуска */}
        {run.pendingSession && phase === 'idle' && (
          <Group style={{ ...glass, marginTop: '16px', padding: '16px' }}>
            <Text style={{ color: '#FFFFFF', textAlign: 'center', marginBottom: 12 }}>
              Найдена незавершённая пробежка. Продолжить?
            </Text>
            <div style={{ display: 'flex', gap: 12 }}>
              <Button
                size="l"
                onClick={run.restoreSession}
                style={{ ...actionButton('rgba(76, 175, 80, 0.7)'), flex: 1 }}
              >
                Продолжить
              </Button>
              <Button
                size="l"
                onClick={run.discardSession}
                style={{ ...actionButton('rgba(244, 67, 54, 0.5)'), flex: 1 }}
              >
                Удалить
              </Button>
            </div>
          </Group>
        )}

        {/* Карта */}
        <Group style={{ ...glass, marginTop: '16px', padding: '8px' }}>
          <div style={{ height: '300px', borderRadius: '12px', overflow: 'hidden' }}>
            <MapContainer
              center={mapCenter}
              zoom={16}
              style={{ height: '100%', width: '100%' }}
              attributionControl={false}
            >
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                maxZoom={16}
                attribution="Tiles &copy; Esri"
              />
              <MapController
                position={run.position}
                follow={follow}
                onUserPan={() => setFollow(false)}
                onLocate={handleLocate}
              />

              {run.position && (
                <>
                  <Circle
                    center={[run.position.lat, run.position.lon]}
                    radius={20}
                    pathOptions={{ color: '#2196F3', fillColor: '#2196F3', fillOpacity: 0.3 }}
                  />
                  <Circle
                    center={[run.position.lat, run.position.lon]}
                    radius={5}
                    pathOptions={{ color: '#FFFFFF', fillColor: '#2196F3', fillOpacity: 1, weight: 2 }}
                  />
                </>
              )}

              {polylines}
              {lastPoint && <Marker position={[lastPoint.lat, lastPoint.lon]} />}
            </MapContainer>
          </div>
        </Group>

        {/* Настройки */}
        {phase === 'idle' && (
          <Group
            header={<Header style={{ color: '#FFFFFF', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>⚙️ Настройки</Header>}
            style={{ ...glass, marginTop: '16px', padding: '4px 0' }}
          >
            <div style={{ padding: '8px 16px 12px' }}>
              {SETTING_ITEMS.map((item) => (
                <label
                  key={item.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 0',
                    color: '#FFFFFF',
                    fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
                    fontSize: 15,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={run.settings[item.key]}
                    onChange={(e) => run.updateSettings({ [item.key]: e.target.checked } as Partial<TrackerSettings>)}
                    style={{ width: 22, height: 22 }}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </Group>
        )}

        {/* Текущая пробежка */}
        {phase !== 'finished' && (
          <Group
            header={
              <Header style={{ color: '#FFFFFF', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>📊 Текущая пробежка</Header>
            }
            style={{ ...glass, marginTop: '16px', padding: '4px 0' }}
          >
            <CardGrid size="l">
              <Card style={statCard}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Дистанция</Text>
                <Text style={{ fontSize: 26, fontWeight: 700, color: '#FFFFFF' }}>
                  {formatKm(run.distance)} км
                </Text>
              </Card>
              <Card style={statCard}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Время</Text>
                <Text style={{ fontSize: 26, fontWeight: 700, color: '#FFFFFF' }}>
                  {formatDuration(run.elapsed)}
                </Text>
              </Card>
              <Card style={statCard}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Темп сейчас</Text>
                <Text style={{ fontSize: 26, fontWeight: 700, color: '#FFFFFF' }}>
                  {formatPaceValue(run.currentPace)}
                </Text>
              </Card>
              <Card style={statCard}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Средний темп</Text>
                <Text style={{ fontSize: 26, fontWeight: 700, color: '#FFFFFF' }}>
                  {formatPaceValue(run.avgPace)}
                </Text>
              </Card>
            </CardGrid>

            {isActive && run.lastSplit && (
              <Div>
                <Text style={{ color: '#4CAF50', textAlign: 'center', fontWeight: 600 }}>
                  🏁 Км {run.lastSplit.km}: {formatDuration(run.lastSplit.seconds)}
                </Text>
              </Div>
            )}
            {isActive && run.splits.length > 0 && (
              <div style={{ padding: '0 16px 12px' }}>{renderSplits(run.splits)}</div>
            )}
          </Group>
        )}

        {/* Управление */}
        {phase !== 'finished' && (
          <Group style={{ ...glass, marginTop: '16px', padding: '16px' }}>
            {phase === 'idle' && (
              <>
                <Button
                  size="l"
                  stretched
                  disabled={!run.gps.ready}
                  onClick={run.start}
                  style={actionButton(
                    run.gps.ready ? 'rgba(76, 175, 80, 0.7)' : 'rgba(255, 255, 255, 0.15)'
                  )}
                >
                  {run.gps.ready ? '▶ Начать пробежку' : '⏳ Ждём сигнал GPS…'}
                </Button>
                {!run.gps.ready && (
                  <Button
                    size="m"
                    mode="tertiary"
                    stretched
                    onClick={run.start}
                    style={{ marginTop: 8, color: 'rgba(255,255,255,0.8)' }}
                  >
                    Начать без точного сигнала
                  </Button>
                )}
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: 12,
                    textAlign: 'center',
                    marginTop: 8,
                  }}
                >
                  Не сворачивайте приложение и не блокируйте экран во время пробежки
                </Text>
              </>
            )}

            {phase === 'countdown' && (
              <>
                <div style={{ textAlign: 'center', color: '#FFFFFF' }}>
                  <div style={{ fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif', fontSize: 96, lineHeight: 1 }}>
                    {run.countdown}
                  </div>
                  <Text style={{ color: 'rgba(255,255,255,0.7)' }}>Приготовьтесь…</Text>
                </div>
                <Button
                  size="l"
                  stretched
                  onClick={run.cancelCountdown}
                  style={{ ...actionButton('rgba(255, 255, 255, 0.2)'), marginTop: 12 }}
                >
                  Отмена
                </Button>
              </>
            )}

            {isActive && !stopConfirm && (
              <>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {phase === 'paused' ? (
                    <Button
                      size="l"
                      onClick={run.resume}
                      style={{ ...actionButton('rgba(76, 175, 80, 0.7)'), flex: 1 }}
                    >
                      ▶ Возобновить
                    </Button>
                  ) : (
                    <Button
                      size="l"
                      onClick={run.pause}
                      style={{ ...actionButton('rgba(255, 152, 0, 0.7)'), flex: 1 }}
                    >
                      ⏸ Пауза
                    </Button>
                  )}
                  <Button
                    size="l"
                    onClick={() => setStopConfirm(true)}
                    style={{ ...actionButton('rgba(244, 67, 54, 0.7)'), flex: 1 }}
                  >
                    ⏹ Остановить
                  </Button>
                </div>
                <Button
                  size="l"
                  stretched
                  onClick={() => setBigMode(true)}
                  style={{ ...actionButton('rgba(255, 255, 255, 0.18)'), marginTop: 12 }}
                >
                  🔎 Крупный режим
                </Button>
                {phase === 'paused' && (
                  <Text
                    style={{ color: '#FF9800', textAlign: 'center', marginTop: 10, fontSize: 14 }}
                  >
                    ⏸ Пробежка на паузе
                  </Text>
                )}
              </>
            )}

            {isActive && stopConfirm && (
              <>
                <Text
                  style={{
                    color: '#FFFFFF',
                    textAlign: 'center',
                    fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
                    fontSize: 18,
                    marginBottom: 12,
                  }}
                >
                  Завершить пробежку?
                </Text>
                <div style={{ display: 'flex', gap: 12 }}>
                  <Button
                    size="l"
                    onClick={() => {
                      setStopConfirm(false);
                      run.stop();
                    }}
                    style={{ ...actionButton('rgba(244, 67, 54, 0.75)'), flex: 1 }}
                  >
                    Завершить
                  </Button>
                  <Button
                    size="l"
                    onClick={() => setStopConfirm(false)}
                    style={{ ...actionButton('rgba(255, 255, 255, 0.2)'), flex: 1 }}
                  >
                    Продолжить
                  </Button>
                </div>
              </>
            )}
          </Group>
        )}

        {/* Итоги пробежки */}
        {phase === 'finished' && summary && (
          <Group
            header={
              <Header style={{ color: '#FFFFFF', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>🏁 Пробежка завершена</Header>
            }
            style={{ ...glass, marginTop: '16px', padding: '4px 0' }}
          >
            <CardGrid size="l">
              <Card style={statCard}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Дистанция</Text>
                <Text style={{ fontSize: 26, fontWeight: 700, color: '#FFFFFF' }}>
                  {formatKm(summary.track.distance)} км
                </Text>
              </Card>
              <Card style={statCard}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Время</Text>
                <Text style={{ fontSize: 26, fontWeight: 700, color: '#FFFFFF' }}>
                  {formatDuration(summary.track.duration)}
                </Text>
              </Card>
              <Card style={statCard}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Средний темп</Text>
                <Text style={{ fontSize: 26, fontWeight: 700, color: '#FFFFFF' }}>
                  {formatPaceValue(summary.track.pace)}
                </Text>
              </Card>
            </CardGrid>

            <div style={{ padding: '0 16px 16px' }}>
              {/* Состояние сохранения */}
              {run.saveState === 'saving' && (
                <Text style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 8 }}>
                  Сохраняем пробежку…
                </Text>
              )}
              {run.saveState === 'saved' && (
                <Text
                  style={{ color: '#4CAF50', textAlign: 'center', fontWeight: 600, marginTop: 8 }}
                >
                  ✅ Пробежка сохранена в профиль
                  {run.totalRuns !== null ? ` · всего пробежек: ${run.totalRuns}` : ''}
                </Text>
              )}
              {run.saveState === 'failed' && (
                <>
                  <Text style={{ color: '#F44336', textAlign: 'center', marginTop: 8 }}>
                    Не удалось сохранить: {run.saveError}
                  </Text>
                  <Button
                    size="l"
                    stretched
                    onClick={run.saveCurrent}
                    style={{ ...actionButton('rgba(255, 152, 0, 0.7)'), marginTop: 8 }}
                  >
                    🔁 Повторить сохранение
                  </Button>
                </>
              )}
              {run.saveState === 'tooShort' && (
                <>
                  <Text style={{ color: '#FF9800', textAlign: 'center', marginTop: 8 }}>
                    Слишком короткая пробежка ({Math.round(summary.track.distance)} м,{' '}
                    {formatDuration(summary.track.duration)}). Сохранить в историю?
                  </Text>
                  <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    <Button
                      size="l"
                      onClick={run.saveCurrent}
                      style={{ ...actionButton('rgba(76, 175, 80, 0.7)'), flex: 1 }}
                    >
                      Сохранить
                    </Button>
                    <Button
                      size="l"
                      onClick={run.discardRun}
                      style={{ ...actionButton('rgba(244, 67, 54, 0.5)'), flex: 1 }}
                    >
                      Не сохранять
                    </Button>
                  </div>
                </>
              )}

              {run.rankUp && (
                <div
                  style={{
                    marginTop: 12,
                    padding: '12px 16px',
                    textAlign: 'center',
                    borderRadius: 12,
                    background: 'rgba(255, 193, 7, 0.15)',
                    border: '1px solid rgba(255, 193, 7, 0.5)',
                    color: '#FFFFFF',
                  }}
                >
                  <div style={{ fontSize: 32 }}>{run.rankUp.icon}</div>
                  <div style={{ fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif', fontSize: 18 }}>
                    Новое звание: {run.rankUp.name}!
                  </div>
                </div>
              )}

              {summary.splits.length > 0 && renderSplits(summary.splits)}

              {run.saveState === 'saved' && (
                <Button
                  size="l"
                  stretched
                  onClick={() => setShareOpen(true)}
                  style={{ ...actionButton('rgba(76, 175, 80, 0.6)'), marginTop: 16 }}
                >
                  📤 Поделиться пробежкой
                </Button>
              )}
              <Button
                size="l"
                stretched
                onClick={handleExportGpx}
                style={{ ...actionButton('rgba(255, 255, 255, 0.18)'), marginTop: 12 }}
              >
                ⬇ Экспорт GPX
              </Button>
              {exportInfo && (
                <Text
                  style={{
                    color: '#FF9800',
                    fontSize: 12,
                    textAlign: 'center',
                    marginTop: 8,
                    whiteSpace: 'normal',
                  }}
                >
                  {exportInfo}
                </Text>
              )}
              {run.saveState !== 'tooShort' && run.saveState !== 'saving' && (
                <Button
                  size="l"
                  stretched
                  onClick={run.reset}
                  style={{ ...actionButton('rgba(255, 255, 255, 0.25)'), marginTop: 12 }}
                >
                  🔄 Новая пробежка
                </Button>
              )}
            </div>
          </Group>
        )}

        {/* Симуляция GPS: только при разработке (npm start), в сборке этого блока нет */}
        {import.meta.env.DEV && phase === 'idle' && (
          <Group style={{ ...glass, marginTop: '16px', padding: '16px' }}>
            <Text style={{ color: '#FFFFFF', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif', marginBottom: 8 }}>
              🧪 Симуляция (только для разработки)
            </Text>
            {run.simulating ? (
              <Button
                size="m"
                stretched
                onClick={run.stopSimulation}
                style={actionButton('rgba(244, 67, 54, 0.5)')}
              >
                Остановить симуляцию
              </Button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <select
                  value={simSpeed}
                  onChange={(e) => setSimSpeed(Number(e.target.value))}
                  style={{ height: 40, borderRadius: 8, padding: '0 8px' }}
                >
                  <option value={3}>×1 (3 м/с, как настоящий бег)</option>
                  <option value={15}>×5 (быстрая проверка)</option>
                  <option value={60}>×20 (очень быстрая)</option>
                </select>
                <input
                  type="file"
                  accept=".gpx"
                  style={{ color: '#FFFFFF' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) run.simulate(await file.text(), simSpeed);
                  }}
                />
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                  Выберите GPX-файл, затем нажмите «Начать пробежку».
                </Text>
              </div>
            )}
          </Group>
        )}
      </PageBackground>

      {bigMode && isActive && (
        <BigRunScreen
          phase={phase}
          distance={run.distance}
          elapsed={run.elapsed}
          currentPace={run.currentPace}
          avgPace={run.avgPace}
          lastSplit={run.lastSplit}
          onPause={run.pause}
          onResume={run.resume}
          onStop={run.stop}
          onClose={() => setBigMode(false)}
        />
      )}

      {shareOpen && summary && (
        <ShareRunModal track={summary.track} onClose={() => setShareOpen(false)} />
      )}

      <AppTabbar active="diary" />
    </Panel>
  );
};
export default Tracker;
