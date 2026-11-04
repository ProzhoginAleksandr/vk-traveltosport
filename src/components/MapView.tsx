// src/components/MapView.tsx
// Ленивая обёртка над картой.
//
// MapLibre GL JS вместе с воркером весит около мегабайта, и держать его
// в основном бандле незачем: приложение грузится быстрее, а движок карты
// подтягивается отдельным чанком в момент, когда карта действительно нужна.
import { Suspense, lazy, type ComponentProps } from 'react';
import type { MapSegment } from './MapCanvas';

export type { MapSegment };

const MapCanvas = lazy(() => import('./MapCanvas').then((module) => ({ default: module.MapCanvas })));

type MapCanvasProps = ComponentProps<typeof MapCanvas>;

export const MapView = (props: MapCanvasProps) => (
  <Suspense
    fallback={
      <div
        className="app-map"
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255, 255, 255, 0.55)',
          fontSize: 13,
        }}
      >
        Загружаем карту…
      </div>
    }
  >
    <MapCanvas {...props} />
  </Suspense>
);
