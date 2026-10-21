// src/hooks/useRunTracker.ts
// Вся логика трекера пробежек. Экран (Tracker.tsx) только показывает то, что отдаёт этот хук.
//
// Горячий путь (обработка GPS-точек) работает через ref'ы, а не через состояние React:
// так не бывает «устаревших замыканий», а побочные эффекты не прячутся внутри setState.
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  startWatchingGeolocation,
  GEO_ERROR,
  type GeoError,
  type GeoPosition,
} from '../utils/geo';
import { getCurrentUser } from '../utils/userUtils';
import { saveTrackToStorage, loadUserTracks, type SavedTrack } from '../utils/trackStorage';
import { saveSession, loadSession, clearSession, type ActiveSession } from '../utils/trackSession';
import { createWakeLock } from '../utils/wakeLock';
import { getRank, type Rank } from '../utils/ranks';
import {
  haversine,
  computeDistance,
  computeSplits,
  simplifyTrack,
  type LatLon,
  type Split,
} from '../utils/geoMath';
import {
  acceptPoint,
  smoothPosition,
  minDistanceFor,
  FILTER_DEFAULTS,
  type TrackPoint,
  type Sample,
} from '../utils/trackFilter';
import { parseGpx } from '../utils/gpx';
import { startSimulation } from '../utils/geoSimulator';
import { setAdsBlocked } from '../utils/adUtils';
import { haptic, type HapticKind } from '../utils/haptics';
import {
  loadTrackerSettings,
  saveTrackerSettings,
  type TrackerSettings,
} from '../utils/trackerSettings';

export type { TrackPoint, Split };

export type RunPhase = 'idle' | 'countdown' | 'running' | 'paused' | 'finished';
export type GpsLevel = 'searching' | 'good' | 'weak' | 'error';
export type SaveState = 'idle' | 'saving' | 'saved' | 'failed' | 'tooShort';

export interface GpsInfo {
  level: GpsLevel;
  text: string;
  accuracy: number;
  /** Есть позиция с приемлемой точностью — можно стартовать */
  ready: boolean;
}

export interface RunSummary {
  track: SavedTrack;
  splits: Split[];
}

// Минимум для сохранения пробежки (иначе — вопрос «сохранить всё равно?»).
// Важно из-за званий: они считаются по количеству пробежек.
const MIN_SAVE_DISTANCE_M = 200;
const MIN_SAVE_DURATION_S = 60;

const AUTOSAVE_INTERVAL_MS = 10000;
const BACKGROUND_WARN_AFTER_MS = 15000;
// Автопауза ставится, только если за это время не было ни одного реального смещения.
// 12 с, а не 10: при редких GPS-фиксах 10 с истекали между двумя нормальными точками.
const AUTO_PAUSE_AFTER_MS = 12000;
// Смещение меньше этого порога — дрожание приёмника, а не бег.
const AUTO_PAUSE_NOISE_FLOOR_M = 10;
// Выход из паузы чуть чувствительнее входа: пробежка возобновляется за 3–5 с,
// но одиночный выброс GPS её не разбудит — нужны два фикса подряд.
const AUTO_PAUSE_RESUME_FLOOR_M = 8;
const AUTO_PAUSE_RESUME_CONFIRM = 2;
// Точка хуже этого порога не может поставить пробежку на паузу — это шум, а не остановка.
const AUTO_PAUSE_MAX_ACCURACY_M = FILTER_DEFAULTS.accuracyThreshold;
const COUNTDOWN_SECONDS = 3;
const PACE_WINDOW_M = 300;

/**
 * Пороги автопаузы зависят от точности приёмника: чем хуже сигнал, тем больше смещение
 * нужно, чтобы отличить бег от дрожания. Верхняя граница — 15 м (порог фильтра точек).
 */
const autoPauseThresholds = (accuracy: number): { move: number; resume: number } => {
  const noise = minDistanceFor(accuracy);
  return {
    move: Math.max(AUTO_PAUSE_NOISE_FLOOR_M, noise),
    resume: Math.min(AUTO_PAUSE_NOISE_FLOOR_M, Math.max(AUTO_PAUSE_RESUME_FLOOR_M, noise)),
  };
};

// Один Wake Lock на весь модуль
const wakeLock = createWakeLock();

const buildTrack = (points: TrackPoint[], distance: number, duration: number): SavedTrack => ({
  id: `track_${Date.now()}`,
  date: new Date().toISOString(),
  distance: Math.round(distance),
  duration,
  pace: distance > 0 && duration > 0 ? duration / (distance / 1000) : 0,
  speed: duration > 0 ? distance / 1000 / (duration / 3600) : 0,
  // Прореживаем: длинная пробежка иначе упирается в лимит localStorage
  points: simplifyTrack(points, 3, 1000),
});

export const useRunTracker = () => {
  /* ------------------------------ состояние UI ------------------------------ */
  const [phase, setPhaseState] = useState<RunPhase>('idle');
  const [countdown, setCountdown] = useState(0);
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [distance, setDistance] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [currentPace, setCurrentPace] = useState<number | null>(null);
  const [splits, setSplits] = useState<Split[]>([]);
  const [lastSplit, setLastSplit] = useState<Split | null>(null);
  const [autoPaused, setAutoPaused] = useState(false);
  const [position, setPosition] = useState<LatLon | null>(null);
  const [gps, setGps] = useState<GpsInfo>({
    level: 'searching',
    text: 'Поиск сигнала...',
    accuracy: 0,
    ready: false,
  });
  const [geoError, setGeoError] = useState('');
  const [backgroundWarning, setBackgroundWarning] = useState('');
  const [notice, setNotice] = useState('');
  const [filteredCount, setFilteredCount] = useState(0);
  const [pendingSession, setPendingSession] = useState<ActiveSession | null>(null);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState('');
  const [rankUp, setRankUp] = useState<Rank | null>(null);
  const [totalRuns, setTotalRuns] = useState<number | null>(null);
  const [settings, setSettingsState] = useState<TrackerSettings>(() => loadTrackerSettings());
  const [simulating, setSimulating] = useState(false);

  /* --------------------------------- ref'ы ---------------------------------- */
  const phaseRef = useRef<RunPhase>('idle');
  const pointsRef = useRef<TrackPoint[]>([]);
  const distanceRef = useRef(0);
  const accumulatedRef = useRef(0); // накопленное время «в движении», мс
  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchStopRef = useRef<(() => void) | null>(null);
  const simStopRef = useRef<(() => void) | null>(null);
  const simulatingRef = useRef(false);
  const lastPosRef = useRef<GeoPosition | null>(null);
  const smoothRef = useRef<Sample[]>([]);
  const anchorRef = useRef<{ lat: number; lon: number; t: number } | null>(null);
  const autoPausedRef = useRef(false);
  const resumeHitsRef = useRef(0);
  const countNextSegmentRef = useRef(false);
  const splitsRef = useRef<Split[]>([]);
  const lastBoundaryRef = useRef(0);
  const lastCountedElapsedRef = useRef(0);
  const samplesRef = useRef<Array<{ d: number; t: number }>>([{ d: 0, t: 0 }]);
  const settingsRef = useRef<TrackerSettings>(settings);
  const summaryRef = useRef<RunSummary | null>(null);
  const handlersRef = useRef<{
    onPosition: (p: GeoPosition) => void;
    onError: (e: GeoError) => void;
  }>({
    onPosition: () => undefined,
    onError: () => undefined,
  });

  /* ------------------------------- мелкие утилиты ---------------------------- */
  const setPhase = (next: RunPhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  };

  const buzz = (kind: HapticKind) => {
    if (settingsRef.current.vibration) haptic(kind);
  };

  // Эти три функции читают только ref'ы (и setState), поэтому их идентичность стабильна:
  // зависимости у них пустые/стабильные, а эффект подписки на GPS не перезапускается.
  const getElapsedMs = useCallback(
    (): number =>
      accumulatedRef.current + (timerRef.current ? Date.now() - startTimeRef.current : 0),
    []
  );

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor(getElapsedMs() / 1000));
    }, 1000);
  }, [getElapsedMs]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetRunData = () => {
    pointsRef.current = [];
    distanceRef.current = 0;
    accumulatedRef.current = 0;
    splitsRef.current = [];
    lastBoundaryRef.current = 0;
    lastCountedElapsedRef.current = 0;
    samplesRef.current = [{ d: 0, t: 0 }];
    smoothRef.current = [];
    anchorRef.current = null;
    autoPausedRef.current = false;
    resumeHitsRef.current = 0;
    countNextSegmentRef.current = false;
    summaryRef.current = null;

    setPoints([]);
    setDistance(0);
    setElapsed(0);
    setCurrentPace(null);
    setSplits([]);
    setLastSplit(null);
    setAutoPaused(false);
    setFilteredCount(0);
    setBackgroundWarning('');
    setNotice('');
    setSummary(null);
    setSaveState('idle');
    setSaveError('');
    setRankUp(null);
    setTotalRuns(null);
  };

  /* ------------------------ прогресс: отсечки и текущий темп ------------------------ */
  const registerProgress = (prevDist: number, seg: number, elapsedNow: number) => {
    // Отсечки по километрам (время на границе — линейная интерполяция внутри отрезка)
    while (distanceRef.current >= (splitsRef.current.length + 1) * 1000) {
      const km = splitsRef.current.length + 1;
      const frac = seg > 0 ? Math.min(1, Math.max(0, (km * 1000 - prevDist) / seg)) : 1;
      const tAt =
        lastCountedElapsedRef.current + frac * (elapsedNow - lastCountedElapsedRef.current);
      const split: Split = { km, seconds: Math.max(1, Math.round(tAt - lastBoundaryRef.current)) };
      lastBoundaryRef.current = tAt;
      splitsRef.current = [...splitsRef.current, split];
      setSplits(splitsRef.current);
      setLastSplit(split);
      buzz('heavy');
    }
    lastCountedElapsedRef.current = elapsedNow;

    // Текущий темп: по последним ~300 м
    const dist = distanceRef.current;
    const samples = samplesRef.current;
    samples.push({ d: dist, t: elapsedNow });
    while (samples.length > 2 && samples[1].d < dist - PACE_WINDOW_M * 2) samples.shift();

    const target = dist - PACE_WINDOW_M;
    let ref = samples[0];
    for (const s of samples) {
      if (s.d <= target) ref = s;
      else break;
    }
    const dd = dist - ref.d;
    const dt = elapsedNow - ref.t;
    setCurrentPace(dd >= 30 && dt >= 10 ? dt / (dd / 1000) : null);
  };

  /* ----------------------------- пауза и возобновление ----------------------------- */
  const pauseInternal = (auto: boolean) => {
    if (phaseRef.current !== 'running') return;
    accumulatedRef.current += Date.now() - startTimeRef.current;
    stopTimer();
    autoPausedRef.current = auto;
    resumeHitsRef.current = 0;
    setAutoPaused(auto);
    setCurrentPace(null);
    setPhase('paused');
    if (auto) buzz('light');
  };

  const resumeInternal = () => {
    if (phaseRef.current !== 'paused') return;
    // После автопаузы первый отрезок — реальный бег, его считаем; после ручной — нет
    // (пользователь мог пройти пешком, пока стоял на паузе)
    if (autoPausedRef.current) countNextSegmentRef.current = true;
    autoPausedRef.current = false;
    resumeHitsRef.current = 0;
    setAutoPaused(false);
    startTimer();
    setPhase('running');
    const lp = lastPosRef.current;
    anchorRef.current = lp ? { lat: lp.lat, lon: lp.lon, t: Date.now() } : null;
  };

  /* -------------------------------- автопауза -------------------------------- */
  // Раньше «зона стояния» равнялась точности приёмника (Math.max(8, accuracy)), и при
  // слабом сигнале она раздувалась до 25–45 м: бегун успевал пробежать 20–30 м, не
  // выйдя из неё, и пробежка вставала на паузу, а для возобновления требовалось
  // 1,5 радиуса (до 45 м) реального бега. Теперь пауза ставится по отсутствию
  // реального смещения, а якорь обновляется на каждом таком смещении.
  const handleAutoPause = (p: LatLon, accuracy: number, now: number) => {
    const anchor = anchorRef.current;
    if (!anchor) {
      anchorRef.current = { lat: p.lat, lon: p.lon, t: now };
      return;
    }

    const { move, resume } = autoPauseThresholds(accuracy);
    const d = haversine(anchor, p);

    if (autoPausedRef.current) {
      // «Якорь» остаётся там, где остановились, пока человек реально не отойдёт
      if (d >= resume) {
        resumeHitsRef.current += 1;
        if (resumeHitsRef.current >= AUTO_PAUSE_RESUME_CONFIRM) resumeInternal();
      } else {
        resumeHitsRef.current = 0;
      }
      return;
    }

    if (d >= move) {
      // Реальное смещение — бежим: якорь переезжает, отсчёт паузы начинается заново
      anchorRef.current = { lat: p.lat, lon: p.lon, t: now };
      return;
    }

    // Мусорная точка (хуже порога фильтра) не может поставить пробежку на паузу
    if (accuracy > AUTO_PAUSE_MAX_ACCURACY_M) return;

    if (phaseRef.current === 'running' && now - anchor.t >= AUTO_PAUSE_AFTER_MS) {
      pauseInternal(true);
    }
  };

  /* ---------------------------- запись GPS-точки ---------------------------- */
  const addPoint = (pt: TrackPoint) => {
    const list = pointsRef.current;
    const prev = list.length > 0 ? list[list.length - 1] : null;
    list.push(pt);

    const forced = countNextSegmentRef.current;
    if (!pt.isPaused) countNextSegmentRef.current = false;

    if (prev && !pt.isPaused && (!prev.isPaused || forced)) {
      const seg = haversine(prev, pt);
      const prevDist = distanceRef.current;
      distanceRef.current = prevDist + seg;
      registerProgress(prevDist, seg, getElapsedMs() / 1000);
      setDistance(distanceRef.current);
    }
    setPoints(list.slice());
  };

  const recordPoint = (pos: GeoPosition) => {
    const now = Date.now();
    const smooth = smoothPosition(smoothRef.current, { lat: pos.lat, lon: pos.lon, t: now });

    if (settingsRef.current.autoPause) handleAutoPause(smooth, pos.accuracy, now);

    const result = acceptPoint(
      pointsRef.current,
      { lat: smooth.lat, lon: smooth.lon, timestamp: now, accuracy: pos.accuracy },
      {
        isPaused: phaseRef.current === 'paused',
        maxSpeedMps: simulatingRef.current ? 1000 : FILTER_DEFAULTS.maxSpeedMps,
      }
    );

    if (!result.ok) {
      if (result.reason !== 'tooClose') setFilteredCount((c) => c + 1);
      return;
    }
    addPoint(result.point);
  };

  const onPosition = (pos: GeoPosition) => {
    lastPosRef.current = pos;
    setPosition({ lat: pos.lat, lon: pos.lon });

    const weak = pos.accuracy > FILTER_DEFAULTS.accuracyThreshold;
    setGps({
      level: weak ? 'weak' : 'good',
      text: weak
        ? `Слабый сигнал (${pos.accuracy.toFixed(0)} м)`
        : pos.accuracy > 0
        ? `GPS: ${pos.accuracy.toFixed(0)} м`
        : 'GPS: определено',
      accuracy: pos.accuracy,
      ready: !weak,
    });
    setGeoError('');

    if (phaseRef.current === 'running' || phaseRef.current === 'paused') recordPoint(pos);
  };

  const onGeoError = (err: GeoError) => {
    console.error('Ошибка геолокации:', err);
    let text = 'Ошибка';
    let message = 'Не удалось получить геопозицию';
    if (err.code === GEO_ERROR.PERMISSION_DENIED) {
      text = 'Нет разрешения';
      message = 'Разрешите доступ к геопозиции в настройках приложения';
    } else if (err.code === GEO_ERROR.POSITION_UNAVAILABLE) {
      text = 'Нет сигнала';
      message = 'Нет сигнала GPS. Выйдите на улицу';
    } else if (err.code === GEO_ERROR.TIMEOUT) {
      text = 'Таймаут';
      message = 'Долго нет сигнала. Проверьте GPS';
    } else if (err.code === GEO_ERROR.UNSUPPORTED) {
      message = 'Геолокация не поддерживается';
    }
    setGeoError(message);
    setGps((g) => ({ ...g, level: 'error', text, ready: false }));
  };

  // Свежие обработчики на каждый рендер: подписка на GPS создаётся один раз и вызывает их через ref
  useEffect(() => {
    handlersRef.current = { onPosition, onError: onGeoError };
  });

  /* ------------------------------- GPS-подписка ------------------------------ */
  // Обе функции работают только с watchStopRef, поэтому стабильны: подписка создаётся
  // один раз при входе на экран и не пересоздаётся на каждом рендере.
  const stopWatch = useCallback(() => {
    if (watchStopRef.current) {
      watchStopRef.current();
      watchStopRef.current = null;
    }
  }, []);

  const startWatch = useCallback(() => {
    stopWatch();
    watchStopRef.current = startWatchingGeolocation(
      (p) => handlersRef.current.onPosition(p),
      (e) => handlersRef.current.onError(e)
    );
  }, [stopWatch]);

  /* -------------------------------- управление -------------------------------- */
  const beginRun = () => {
    accumulatedRef.current = 0;
    anchorRef.current = null;
    setPhase('running');
    startTimer();
    buzz('heavy');
    // Трек начинается с уже известной позиции, а не ждёт следующего отсчёта GPS
    if (lastPosRef.current) recordPoint(lastPosRef.current);
  };

  const startCountdown = () => {
    let n = COUNTDOWN_SECONDS;
    setPhase('countdown');
    setCountdown(n);
    buzz('light');
    countdownRef.current = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = null;
        setCountdown(0);
        beginRun();
      } else {
        setCountdown(n);
        buzz('light');
      }
    }, 1000);
  };

  const cancelCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdown(0);
    wakeLock.disable();
    setPhase('idle');
  };

  const start = () => {
    if (phaseRef.current !== 'idle' && phaseRef.current !== 'finished') return;
    clearSession();
    setPendingSession(null);
    resetRunData();
    wakeLock.enable();
    if (settingsRef.current.countdown) startCountdown();
    else beginRun();
  };

  const pause = () => pauseInternal(false);
  const resume = () => resumeInternal();

  const reset = () => {
    resetRunData();
    setPhase('idle');
  };

  /* -------------------------------- сохранение -------------------------------- */
  const saveRun = async (track: SavedTrack) => {
    setSaveState('saving');
    setSaveError('');
    try {
      const user = await getCurrentUser();
      if (!user) throw new Error('Не удалось определить пользователя VK');

      const before = loadUserTracks(user.id).length;
      let toSave = track;
      let ok = saveTrackToStorage(user.id, toSave);

      if (!ok) {
        // Скорее всего, не хватило места: пробуем ещё раз с более грубым треком
        toSave = { ...track, points: simplifyTrack(track.points, 10, 400) };
        ok = saveTrackToStorage(user.id, toSave);
      }
      if (!ok) throw new Error('Хранилище переполнено или недоступно');

      clearSession();
      const next: RunSummary = { track: toSave, splits: summaryRef.current?.splits ?? splitsRef.current };
      summaryRef.current = next;
      setSummary(next);

      const rankBefore = getRank(before);
      const rankAfter = getRank(before + 1);
      setTotalRuns(before + 1);
      setRankUp(rankAfter && rankAfter.name !== rankBefore?.name ? rankAfter : null);
      setSaveState('saved');
    } catch (err) {
      console.error('Ошибка сохранения трека:', err);
      setSaveError(err instanceof Error ? err.message : 'Не удалось сохранить пробежку');
      setSaveState('failed');
    }
  };

  const stop = () => {
    const p = phaseRef.current;
    if (p !== 'running' && p !== 'paused') return;

    if (p === 'running') accumulatedRef.current += Date.now() - startTimeRef.current;
    stopTimer();
    wakeLock.disable();
    autoPausedRef.current = false;
    setAutoPaused(false);
    setCurrentPace(null);

    const duration = Math.floor(accumulatedRef.current / 1000);
    const pts = pointsRef.current;
    const dist = distanceRef.current;
    setElapsed(duration);
    buzz('success');

    if (pts.length < 2) {
      clearSession();
      reset();
      setNotice('Не набралось GPS-точек, пробежка не сохранена.');
      return;
    }

    setPhase('finished');
    const result: RunSummary = {
      track: buildTrack(pts, dist, duration),
      splits: splitsRef.current,
    };
    summaryRef.current = result;
    setSummary(result);

    const tooShort = dist < MIN_SAVE_DISTANCE_M || duration < MIN_SAVE_DURATION_S;
    if (tooShort) {
      setSaveState('tooShort');
      return;
    }
    void saveRun(result.track);
  };

  /** Сохранить короткую пробежку «всё равно» или повторить неудачное сохранение */
  const saveCurrent = () => {
    if (summaryRef.current) void saveRun(summaryRef.current.track);
  };

  const discardRun = () => {
    clearSession();
    reset();
  };

  /* --------------------------- незавершённая пробежка --------------------------- */
  const restoreSession = () => {
    const s = pendingSession;
    if (!s) return;

    resetRunData();
    const pts: TrackPoint[] = s.points.map((p) => ({ ...p }));
    pointsRef.current = pts;
    distanceRef.current = computeDistance(pts);
    accumulatedRef.current = s.elapsedSec * 1000;

    const restoredSplits = computeSplits(pts);
    splitsRef.current = restoredSplits;
    lastBoundaryRef.current = restoredSplits.reduce((sum, x) => sum + x.seconds, 0);
    lastCountedElapsedRef.current = s.elapsedSec;
    samplesRef.current = [{ d: distanceRef.current, t: s.elapsedSec }];

    setPoints(pts.slice());
    setDistance(distanceRef.current);
    setElapsed(s.elapsedSec);
    setSplits(restoredSplits);
    setPendingSession(null);
    wakeLock.enable();
    setPhase('paused'); // пользователь сам нажмёт «Возобновить»
  };

  const discardSession = () => {
    clearSession();
    setPendingSession(null);
  };

  /* --------------------------------- настройки -------------------------------- */
  const updateSettings = (patch: Partial<TrackerSettings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettingsState(next);
    saveTrackerSettings(next);
  };

  /* ------------------------ симуляция (для разработки) ------------------------ */
  const stopSimulation = () => {
    if (simStopRef.current) {
      simStopRef.current();
      simStopRef.current = null;
    }
    if (simulatingRef.current) {
      simulatingRef.current = false;
      setSimulating(false);
      startWatch(); // возвращаемся к настоящему GPS
    }
  };

  const simulate = (gpxText: string, metersPerSecond: number) => {
    const route = parseGpx(gpxText);
    if (route.length < 2) {
      setNotice('В GPX-файле не нашлось маршрута.');
      return;
    }
    stopWatch();
    if (simStopRef.current) simStopRef.current();
    simulatingRef.current = true;
    setSimulating(true);
    simStopRef.current = startSimulation(
      route,
      metersPerSecond,
      (p) => handlersRef.current.onPosition(p),
      () => stopSimulation()
    );
  };

  /* ------------------------------ эффекты жизненного цикла ------------------------------ */

  // Подписка на GPS на всё время, пока открыт экран: так видно позицию и готовность GPS до старта
  useEffect(() => {
    startWatch();
    setPendingSession(loadSession());
    return () => {
      stopWatch();
      if (simStopRef.current) simStopRef.current();
      stopTimer();
      if (countdownRef.current) clearInterval(countdownRef.current);
      wakeLock.disable();
      setAdsBlocked(false); // ушли с экрана — пробежка остановлена, рекламу можно снова
    };
    // startWatch/stopWatch/stopTimer стабильны (useCallback), поэтому эффект срабатывает
    // ровно один раз — при входе на экран и при выходе с него
  }, [startWatch, stopWatch, stopTimer]);

  // Пока идёт пробежка (отсчёт, бег, пауза), полноэкранная реклама запрещена везде, включая таббар
  useEffect(() => {
    setAdsBlocked(phase === 'countdown' || phase === 'running' || phase === 'paused');
  }, [phase]);

  // Автосохранение сессии во время пробежки
  useEffect(() => {
    if (phase !== 'running' && phase !== 'paused') return;
    const timer = setInterval(() => {
      if (pointsRef.current.length < 2) return;
      saveSession({
        savedAt: Date.now(),
        points: pointsRef.current,
        elapsedSec: Math.floor(getElapsedMs() / 1000),
      });
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [phase, getElapsedMs]);

  // Предупреждение, если приложение долго было в фоне во время бега
  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = phaseRef.current === 'running' ? Date.now() : 0;
      } else if (hiddenAt && Date.now() - hiddenAt > BACKGROUND_WARN_AFTER_MS) {
        setBackgroundWarning(
          'Приложение было в фоне, часть пути могла не записаться. Не сворачивайте его во время пробежки.'
        );
        hiddenAt = 0;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const avgPace = distance >= 20 && elapsed >= 10 ? elapsed / (distance / 1000) : null;

  return {
    // состояние
    phase,
    countdown,
    points,
    distance,
    elapsed,
    currentPace,
    avgPace,
    splits,
    lastSplit,
    autoPaused,
    position,
    gps,
    geoError,
    backgroundWarning,
    notice,
    filteredCount,
    pendingSession,
    summary,
    saveState,
    saveError,
    rankUp,
    totalRuns,
    settings,
    simulating,
    // действия
    start,
    cancelCountdown,
    pause,
    resume,
    stop,
    reset,
    saveCurrent,
    discardRun,
    restoreSession,
    discardSession,
    updateSettings,
    simulate,
    stopSimulation,
  };
};
