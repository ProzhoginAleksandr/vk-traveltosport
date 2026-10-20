// src/utils/geoSimulator.ts
// Режим симуляции для разработки: «прогоняет» GPX как будто это живая пробежка,
// чтобы тестировать трекер на компьютере.
import { haversine, type LatLon } from './geoMath';
import type { GeoPosition } from './geo';

export const createRouteWalker = (route: ReadonlyArray<LatLon>) => {
  const cumulative: number[] = [0];
  for (let i = 1; i < route.length; i++) {
    cumulative.push(cumulative[i - 1] + haversine(route[i - 1], route[i]));
  }
  const total = cumulative[cumulative.length - 1] ?? 0;

  /** Позиция на маршруте через `meters` метров от старта */
  const positionAt = (meters: number): LatLon => {
    if (route.length === 0) return { lat: 0, lon: 0 };
    if (meters <= 0) return route[0];
    if (meters >= total) return route[route.length - 1];

    let i = 1;
    while (i < cumulative.length && cumulative[i] < meters) i++;
    const segLen = cumulative[i] - cumulative[i - 1];
    const t = segLen > 0 ? (meters - cumulative[i - 1]) / segLen : 0;
    return {
      lat: route[i - 1].lat + (route[i].lat - route[i - 1].lat) * t,
      lon: route[i - 1].lon + (route[i].lon - route[i - 1].lon) * t,
    };
  };

  return { total, positionAt };
};

/** Раз в секунду отдаёт позицию, продвигаясь по маршруту на metersPerSecond. Возвращает функцию остановки */
export const startSimulation = (
  route: ReadonlyArray<LatLon>,
  metersPerSecond: number,
  onPosition: (position: GeoPosition) => void,
  onDone: () => void
): (() => void) => {
  const walker = createRouteWalker(route);
  let timer: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  if (route.length < 2 || walker.total <= 0) {
    onDone();
    return stop;
  }

  let walked = 0;
  const tick = () => {
    const p = walker.positionAt(walked);
    onPosition({ lat: p.lat, lon: p.lon, accuracy: 5 });
    if (walked >= walker.total) {
      stop();
      onDone();
      return;
    }
    walked += metersPerSecond;
  };

  tick();
  timer = setInterval(tick, 1000);
  return stop;
};
