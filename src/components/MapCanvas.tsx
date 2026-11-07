// src/components/MapCanvas.tsx
// Карта на MapLibre GL JS с тайлами OpenFreeMap (стиль dark).
//
// OpenFreeMap отдаёт векторные тайлы и работает без ключей и регистрации,
// поэтому Leaflet здесь не подходит — нужен WebGL-рендерер.
// Компонент самодостаточный: принимает центр, зум, участки маршрута, точку
// текущей позиции и радиус точности, рисует их слоями и умеет «следить» за точкой.
import { useEffect, useRef, useState } from 'react';
import { GeoJSONSource, Map as MapLibreMap, setWorkerUrl, type StyleSpecification } from 'maplibre-gl';
import type { Feature, FeatureCollection } from 'geojson';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';

// MapLibre ищет файл воркера рядом с бандлом и в сборке Vite его не находит
// (ошибка «Worker failed to load»). Адрес задаём явно: Vite кладёт файл воркера
// в assets, а расширение меняем на .js — на .mjs хостинг VK отвечает 403.
setWorkerUrl(workerUrl.replace(/\.mjs$/, '.js'));

const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';

// Запасной стиль: обычные растровые тайлы Esri, у них другой CDN (без Cloudflare).
// Нужен там, где OpenFreeMap недоступен — например, в мобильной сети оператора.
const RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    esri: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 16,
      attribution: 'Tiles &copy; Esri',
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#0a0f0a' } },
    { id: 'esri', type: 'raster', source: 'esri' },
  ],
};

export interface MapSegment {
  /** Координаты в формате [широта, долгота], как в остальном коде */
  positions: Array<[number, number]>;
  /** Участок пройден на паузе — рисуется серым пунктиром */
  paused: boolean;
}

interface MapCanvasProps {
  center: [number, number];
  zoom: number;
  segments?: MapSegment[];
  /** Текущая позиция: [широта, долгота] */
  marker?: [number, number] | null;
  /** Радиус круга точности в метрах */
  accuracyMeters?: number;
  follow?: boolean;
  onUserPan?: () => void;
  onLocate?: () => void;
}

const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };

const toLonLat = ([lat, lon]: [number, number]): [number, number] => [lon, lat];

// Круг точности: MapLibre не умеет радиус в метрах, поэтому считаем полигон.
const circleRing = (
  center: [number, number],
  radiusM: number,
  steps = 64
): Array<[number, number]> => {
  const [lat, lon] = center;
  const dLat = radiusM / 111320;
  const dLon = radiusM / (111320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const ring: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    ring.push([lon + dLon * Math.cos(angle), lat + dLat * Math.sin(angle)]);
  }
  return ring;
};

const lineFeatures = (segments: MapSegment[], paused: boolean): Feature[] =>
  segments
    .filter((s) => s.paused === paused && s.positions.length >= 2)
    .map((s) => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: s.positions.map(toLonLat) },
    }));

const markerFeature = (marker: [number, number] | null): FeatureCollection => ({
  type: 'FeatureCollection',
  features: marker
    ? [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Point', coordinates: toLonLat(marker) },
        },
      ]
    : [],
});

const accuracyFeature = (
  marker: [number, number] | null,
  radiusM: number
): FeatureCollection => ({
  type: 'FeatureCollection',
  features:
    marker && radiusM > 0
      ? [
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Polygon', coordinates: [circleRing(marker, radiusM)] },
          },
        ]
      : [],
});

export const MapCanvas = ({
  center,
  zoom,
  segments = [],
  marker = null,
  accuracyMeters = 0,
  follow = false,
  onUserPan,
  onLocate,
}: MapCanvasProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const readyRef = useRef(false);
  // ВРЕМЕННО: текст диагностики, если карта не отрисовалась
  const [debugInfo, setDebugInfo] = useState('');

  // Свежие данные и колбэки для обработчиков, которые создаются один раз
  const dataRef = useRef({ segments, marker, accuracyMeters });
  dataRef.current = { segments, marker, accuracyMeters };
  const onUserPanRef = useRef(onUserPan);
  onUserPanRef.current = onUserPan;
  const centerRef = useRef(center);
  centerRef.current = center;

  const applyDataRef = useRef<() => void>(() => undefined);

  // Создание карты — строго один раз
  useEffect(() => {
    if (!containerRef.current) return;

    const webgl2 = (() => {
      try {
        return !!document.createElement('canvas').getContext('webgl2');
      } catch {
        return false;
      }
    })();

    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: STYLE_URL,
        center: toLonLat(centerRef.current),
        zoom,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
    } catch (err) {
      // WebGL2 в WebView бывает отключён — тогда MapLibre не запустится вообще
      console.error('Карта не создалась:', err, 'WebGL2:', webgl2);
      setDebugInfo('Карта не загрузилась. Проверьте соединение и откройте экран заново.');
      return;
    }
    mapRef.current = map;

    // VKUI может менять высоту панели — без resize канвас остаётся нулевого размера
    const resizeObserver = new ResizeObserver(() => {
      try {
        map.resize();
      } catch {
        /* карта уже уничтожена */
      }
    });
    resizeObserver.observe(containerRef.current);

    const ensureLayers = () => {
      if (!map.getSource('route-active')) {
        map.addSource('route-active', { type: 'geojson', data: empty });
        map.addSource('route-paused', { type: 'geojson', data: empty });
        map.addSource('position', { type: 'geojson', data: empty });
        map.addSource('accuracy', { type: 'geojson', data: empty });

        map.addLayer({
          id: 'accuracy-fill',
          type: 'fill',
          source: 'accuracy',
          paint: { 'fill-color': '#2196F3', 'fill-opacity': 0.18 },
        });
        map.addLayer({
          id: 'accuracy-outline',
          type: 'line',
          source: 'accuracy',
          paint: { 'line-color': '#2196F3', 'line-width': 1, 'line-opacity': 0.55 },
        });
        map.addLayer({
          id: 'route-active',
          type: 'line',
          source: 'route-active',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#4CAF50', 'line-width': 5 },
        });
        map.addLayer({
          id: 'route-paused',
          type: 'line',
          source: 'route-paused',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#888888', 'line-width': 3, 'line-dasharray': [2, 2] },
        });
        map.addLayer({
          id: 'position',
          type: 'circle',
          source: 'position',
          paint: {
            'circle-radius': 6,
            'circle-color': '#2196F3',
            'circle-stroke-color': '#FFFFFF',
            'circle-stroke-width': 2,
          },
        });
      }
    };

    const applyData = () => {
      if (!readyRef.current || !map.isStyleLoaded()) return;
      ensureLayers();
      const { segments: segs, marker: pos, accuracyMeters: acc } = dataRef.current;
      const routeActive = map.getSource('route-active') as GeoJSONSource | undefined;
      const routePaused = map.getSource('route-paused') as GeoJSONSource | undefined;
      const position = map.getSource('position') as GeoJSONSource | undefined;
      const accuracy = map.getSource('accuracy') as GeoJSONSource | undefined;

      routeActive?.setData({ type: 'FeatureCollection', features: lineFeatures(segs, false) });
      routePaused?.setData({ type: 'FeatureCollection', features: lineFeatures(segs, true) });
      position?.setData(markerFeature(pos));
      accuracy?.setData(accuracyFeature(pos, acc));
    };

    applyDataRef.current = applyData;

    // Векторные тайлы OpenFreeMap живут за Cloudflare, а мобильные операторы
    // в РФ нередко замедляют или режут такие домены. Если стиль не пришёл за
    // 6 секунд или пришла сетевая ошибка — переключаемся на растровые тайлы
    // с другого CDN, чтобы карта осталась рабочей и на мобильной сети.
    let fallbackApplied = false;
    let styleReady = false;

    const applyRasterFallback = () => {
      if (fallbackApplied || styleReady) return;
      fallbackApplied = true;
      console.warn('OpenFreeMap недоступен, включаем растровые тайлы');
      try {
        map.setStyle(RASTER_STYLE);
      } catch (err) {
        console.error('Не удалось включить запасные тайлы:', err);
      }
    };

    const vectorTimer = window.setTimeout(applyRasterFallback, 6000);

    map.on('error', (event) => {
      const message = String(
        (event as { error?: { message?: string } })?.error?.message ?? ''
      );
      // Переключаемся только если не загрузился сам стиль: единичные ошибки
      // отдельных тайлов уже загруженной карты поводом для этого не являются
      if (!styleReady && /style|fetch|network|load failed|abort/i.test(message)) {
        applyRasterFallback();
      }
    });

    // Если не пришёл даже запасной стиль — сообщаем пользователю
    const failTimer = window.setTimeout(() => {
      if (!styleReady) setDebugInfo('Карта не загрузилась. Проверьте соединение.');
    }, 16000);

    // Срабатывает и для основного стиля, и для запасного
    map.on('style.load', () => {
      styleReady = true;
      readyRef.current = true;
      window.clearTimeout(vectorTimer);
      window.clearTimeout(failTimer);
      setDebugInfo('');
      applyData();
    });

    // Пользователь сам подвинул карту — перестаём за ним «убегать»
    map.on('dragstart', () => onUserPanRef.current?.());

    return () => {
      readyRef.current = false;
      window.clearTimeout(vectorTimer);
      window.clearTimeout(failTimer);
      resizeObserver.disconnect();
      applyDataRef.current = () => undefined;
      map.remove();
      mapRef.current = null;
    };
    // Карта создаётся один раз: центр и данные дальше обновляются отдельными эффектами
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Обновление маршрута, точки и круга точности
  useEffect(() => {
    applyDataRef.current();
  }, [segments, marker, accuracyMeters]);

  // Слежение за текущей позицией не меняет выбранный пользователем масштаб
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !follow || !marker) return;
    map.easeTo({ center: toLonLat(marker), duration: 700 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [follow, marker?.[0], marker?.[1]]);

  // Смена центра до старта (или при открытии другой пробежки)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    if (follow && marker) return;
    map.jumpTo({ center: toLonLat(center) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.[0], center?.[1]]);

  return (
    <div className="app-map" style={{ position: 'relative', height: '100%', width: '100%' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* ВРЕМЕННО: причины, по которым карта не отрисовалась */}
      {debugInfo && (
        <div
          style={{
            position: 'absolute',
            left: 8,
            bottom: 8,
            right: 8,
            zIndex: 3,
            background: 'rgba(0, 0, 0, 0.75)',
            color: '#FF9800',
            fontFamily: 'Arial',
            fontSize: 10,
            lineHeight: 1.3,
            padding: '6px 8px',
            borderRadius: 8,
            pointerEvents: 'none',
          }}
        >
          {debugInfo}
        </div>
      )}

      {onLocate && (
        <button
          type="button"
          onClick={onLocate}
          title="Где я"
          aria-label="Где я"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 2,
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            border: '1px solid rgba(255, 255, 255, 0.3)',
            background: follow ? 'rgba(9, 107, 17, 0.95)' : 'rgba(70, 70, 70, 0.9)',
            color: '#FFFFFF',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.4)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
        </button>
      )}
    </div>
  );
};
