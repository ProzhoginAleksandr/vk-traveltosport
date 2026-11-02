// src/utils/importUtils.ts
import { SavedTrack, TrackPoint } from './trackStorage';

// 📏 Формула гаверсинусов
const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// ============================================================
// 📊 Расчёт метрик из массива точек с учётом пауз
// ============================================================
interface Metrics {
  distance: number;   // метры
  duration: number;   // секунды (активное время)
  pace: number;       // сек/км
  speed: number;      // км/ч
}

const calculateMetrics = (points: TrackPoint[]): Metrics => {
  if (points.length < 2) {
    return { distance: 0, duration: 0, pace: 0, speed: 0 };
  }

  const PAUSE_TIME_THRESHOLD = 30;      // сек — если между точками >30 сек, считаем паузой
  const PAUSE_SPEED_THRESHOLD = 1.0;    // км/ч — если скорость <1 км/ч, считаем паузой

  let distance = 0;
  let activeDuration = 0;
  let totalDuration = 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    const segmentDistance = haversine(prev.lat, prev.lon, curr.lat, curr.lon);
    const segmentTime = (curr.timestamp - prev.timestamp) / 1000;

    if (segmentTime <= 0) continue;

    const speedKmh = (segmentDistance / 1000) / (segmentTime / 3600);

    distance += segmentDistance;
    totalDuration += segmentTime;

    const isPause =
      segmentTime > PAUSE_TIME_THRESHOLD ||
      speedKmh < PAUSE_SPEED_THRESHOLD;

    if (!isPause) {
      activeDuration += segmentTime;
    }
  }

  const duration = activeDuration > 60 ? activeDuration : totalDuration;

  const pace = distance > 0 && duration > 0 ? duration / (distance / 1000) : 0;
  const speed = duration > 0 ? (distance / 1000) / (duration / 3600) : 0;

  console.log(
    `📊 Расчёт: дистанция ${(distance / 1000).toFixed(2)} км, ` +
    `активное ${Math.round(activeDuration)} сек, ` +
    `полное ${Math.round(totalDuration)} сек, ` +
    `темп ${Math.round(pace)} сек/км`
  );

  return { distance, duration, pace, speed };
};

// ============================================================
// 🔍 Извлечение метрик из <extensions> (Garmin/Polar/Huawei)
// ============================================================
interface ExtensionMetrics {
  distance?: number;   // метры
  duration?: number;   // секунды
  totalTime?: number;  // общее время, включая паузы
}

const extractExtensionMetrics = (doc: Document): ExtensionMetrics => {
  const result: ExtensionMetrics = {};

  try {
    // Ищем элементы в любом пространстве имён с именами Distance / Duration / TotalTimeSeconds
    const findFirstByLocalName = (names: string[]): string | null => {
      for (const name of names) {
        // Ищем по всем узлам, проверяя localName (без namespace)
        const allElements = doc.getElementsByTagName('*');
        for (let i = 0; i < allElements.length; i++) {
          const el = allElements[i];
          if (el.localName === name && el.textContent && el.textContent.trim()) {
            return el.textContent.trim();
          }
        }
      }
      return null;
    };

    // 1. Дистанция (в метрах)
    const distanceStr = findFirstByLocalName([
      'DistanceMeters',
      'Distance',
      'distanceMeters',
      'distance',
    ]);
    if (distanceStr) {
      const d = parseFloat(distanceStr);
      if (!isNaN(d) && d > 0) {
        result.distance = d;
        console.log(`🔍 Из extensions: дистанция = ${d} м`);
      }
    }

    // 2. Общее время (в секундах)
    const totalTimeStr = findFirstByLocalName([
      'TotalTimeSeconds',
      'TotalTime',
      'totalTimeSeconds',
    ]);
    if (totalTimeStr) {
      const t = parseFloat(totalTimeStr);
      if (!isNaN(t) && t > 0) {
        result.totalTime = t;
        console.log(`🔍 Из extensions: общее время = ${t} сек`);
      }
    }

    // 3. Активное время (может называться по-разному)
    const durationStr = findFirstByLocalName([
      'Duration',
      'ActiveTime',
      'MovingTime',
    ]);
    if (durationStr) {
      const t = parseFloat(durationStr);
      if (!isNaN(t) && t > 0) {
        result.duration = t;
        console.log(`🔍 Из extensions: активное время = ${t} сек`);
      }
    }

    // 4. Читаем TrackPointExtension — пульс, каденс (опционально)
    // Только для информации, в SavedTrack не сохраняем
    const hrElements = doc.getElementsByTagName('*');
    let hrCount = 0;
    for (let i = 0; i < hrElements.length; i++) {
      if (hrElements[i].localName === 'hr' || hrElements[i].localName === 'HeartRateBpm') {
        hrCount++;
      }
    }
    if (hrCount > 0) {
      console.log(`🔍 Из extensions: найдено ${hrCount} значений пульса (не используется)`);
    }
  } catch (error) {
    console.warn('⚠️ Ошибка чтения extensions:', error);
  }

  return result;
};

// ============================================================
// 1️⃣ Парсинг GPX
// ============================================================
export const parseGPX = (content: string): SavedTrack | null => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'application/xml');

    const errorNode = doc.querySelector('parsererror');
    if (errorNode) {
      console.error('❌ Ошибка XML:', errorNode.textContent);
      return null;
    }

    // 📍 Сначала ищем метрики в <extensions>
    const extMetrics = extractExtensionMetrics(doc);

    // 📍 Извлекаем точки
    const trkpts = doc.querySelectorAll('trkpt');
    if (trkpts.length === 0) {
      console.warn('⚠️ В файле нет точек трека');
      return null;
    }

    const points: TrackPoint[] = [];
    trkpts.forEach((trkpt) => {
      const lat = parseFloat(trkpt.getAttribute('lat') || '0');
      const lon = parseFloat(trkpt.getAttribute('lon') || '0');
      const timeEl = trkpt.querySelector('time');
      const timestamp = timeEl
        ? new Date(timeEl.textContent || '').getTime()
        : Date.now();

      if (!isNaN(lat) && !isNaN(lon)) {
        points.push({ lat, lon, timestamp, isPaused: false });
      }
    });

    if (points.length < 2) {
      console.warn('⚠️ Слишком мало точек в треке');
      return null;
    }

    // 📊 Считаем метрики из точек
    const computedMetrics = calculateMetrics(points);

    // 🎯 Финальные метрики: приоритет у extensions, но с разумной проверкой
    let finalDistance = computedMetrics.distance;
    let finalDuration = computedMetrics.duration;

    // Если extensions дали дистанцию и она близка к вычисленной (±5%) — доверяем
    if (extMetrics.distance && extMetrics.distance > 0) {
      const diff = Math.abs(extMetrics.distance - computedMetrics.distance) / computedMetrics.distance;
      if (diff < 0.05) {
        finalDistance = extMetrics.distance;
        console.log(`✅ Используем дистанцию из extensions (расхождение ${(diff * 100).toFixed(1)}%)`);
      } else {
        console.warn(
          `⚠️ Дистанция из extensions отличается на ${(diff * 100).toFixed(0)}% — используем вычисленную`
        );
      }
    }

    // Если extensions дали активное время — доверяем
    if (extMetrics.duration && extMetrics.duration > 0) {
      finalDuration = extMetrics.duration;
      console.log('✅ Используем активное время из extensions');
    } else if (extMetrics.totalTime && extMetrics.totalTime > 0) {
      // Иначе берём totalTime, но вычитаем паузы по нашей логике
      finalDuration = Math.min(computedMetrics.duration, extMetrics.totalTime);
      console.log('✅ Используем totalTime из extensions с корректировкой');
    }

    const finalPace = finalDistance > 0 && finalDuration > 0
      ? finalDuration / (finalDistance / 1000)
      : 0;
    const finalSpeed = finalDuration > 0
      ? (finalDistance / 1000) / (finalDuration / 3600)
      : 0;

    console.log(
      `📊 Финал: дистанция ${(finalDistance / 1000).toFixed(2)} км, ` +
      `время ${Math.round(finalDuration)} сек, ` +
      `темп ${Math.round(finalPace)} сек/км`
    );

    const date = new Date(points[0].timestamp).toISOString();

    return {
      id: `imported_gpx_${Date.now()}`,
      date,
      distance: Math.round(finalDistance),
      duration: Math.round(finalDuration),
      pace: finalPace,
      speed: finalSpeed,
      points,
    };
  } catch (error) {
    console.error('❌ Ошибка парсинга GPX:', error);
    return null;
  }
};

// ============================================================
// 2️⃣ Парсинг TCX
// ============================================================
export const parseTCX = (content: string): SavedTrack | null => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'application/xml');

    const errorNode = doc.querySelector('parsererror');
    if (errorNode) {
      console.error('❌ Ошибка XML:', errorNode.textContent);
      return null;
    }

    // 📍 TCX часто содержит готовые метрики в <Lap>
    const getElementValue = (parent: Element, tagName: string): string | null => {
      const el = parent.getElementsByTagName(tagName)[0];
      return el ? el.textContent : null;
    };

    const lapEl = doc.getElementsByTagName('Lap')[0];
    let extDistance = 0;
    let extDuration = 0;

    if (lapEl) {
      const distanceStr = getElementValue(lapEl, 'DistanceMeters');
      const timeStr = getElementValue(lapEl, 'TotalTimeSeconds');

      if (distanceStr) {
        const d = parseFloat(distanceStr);
        if (!isNaN(d) && d > 0) {
          extDistance = d;
          console.log(`🔍 Из TCX Lap: дистанция = ${d} м`);
        }
      }

      if (timeStr) {
        const t = parseFloat(timeStr);
        if (!isNaN(t) && t > 0) {
          extDuration = t;
          console.log(`🔍 Из TCX Lap: время = ${t} сек`);
        }
      }
    }

    // 📍 Извлекаем точки
    const trackpoints = doc.querySelectorAll('Trackpoint');
    if (trackpoints.length === 0) {
      console.warn('⚠️ В файле нет Trackpoint');
      return null;
    }

    const points: TrackPoint[] = [];
    trackpoints.forEach((tp) => {
      const latEl = tp.querySelector('LatitudeDegrees');
      const lonEl = tp.querySelector('LongitudeDegrees');
      const timeEl = tp.querySelector('Time');

      if (latEl && lonEl) {
        const lat = parseFloat(latEl.textContent || '0');
        const lon = parseFloat(lonEl.textContent || '0');
        const timestamp = timeEl
          ? new Date(timeEl.textContent || '').getTime()
          : Date.now();

        if (!isNaN(lat) && !isNaN(lon)) {
          points.push({ lat, lon, timestamp, isPaused: false });
        }
      }
    });

    if (points.length < 2) {
      console.warn('⚠️ Слишком мало точек в TCX');
      return null;
    }

    const computedMetrics = calculateMetrics(points);

    // 🎯 Приоритет у метрик из Lap
    const finalDistance = extDistance > 0 ? extDistance : computedMetrics.distance;
    const finalDuration = extDuration > 0
      ? Math.min(extDuration, computedMetrics.duration)
      : computedMetrics.duration;

    const finalPace = finalDistance > 0 && finalDuration > 0
      ? finalDuration / (finalDistance / 1000)
      : 0;
    const finalSpeed = finalDuration > 0
      ? (finalDistance / 1000) / (finalDuration / 3600)
      : 0;

    console.log(
      `📊 Финал TCX: дистанция ${(finalDistance / 1000).toFixed(2)} км, ` +
      `время ${Math.round(finalDuration)} сек`
    );

    const date = new Date(points[0].timestamp).toISOString();

    return {
      id: `imported_tcx_${Date.now()}`,
      date,
      distance: Math.round(finalDistance),
      duration: Math.round(finalDuration),
      pace: finalPace,
      speed: finalSpeed,
      points,
    };
  } catch (error) {
    console.error('❌ Ошибка парсинга TCX:', error);
    return null;
  }
};

// ============================================================
// 3️⃣ Универсальный парсер
// ============================================================
export const parseTrackFile = (content: string, filename: string): SavedTrack | null => {
  const lowerName = filename.toLowerCase();

  if (lowerName.endsWith('.gpx')) {
    return parseGPX(content);
  }
  if (lowerName.endsWith('.tcx')) {
    return parseTCX(content);
  }

  // Определяем по содержимому
  if (content.includes('<gpx')) {
    return parseGPX(content);
  }
  if (content.includes('<TrainingCenterDatabase')) {
    return parseTCX(content);
  }

  console.error('❌ Неизвестный формат файла');
  return null;
};