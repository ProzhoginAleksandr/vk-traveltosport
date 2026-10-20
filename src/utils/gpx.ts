// src/utils/gpx.ts
import type { LatLon } from './geoMath';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface GpxTrack {
  date: string;
  points: ReadonlyArray<LatLon & { timestamp: number; isPaused?: boolean }>;
}

/** Собирает GPX 1.1. Точки на паузе пропускаются, после паузы начинается новый сегмент */
export const trackToGpx = (track: GpxTrack, name?: string): string => {
  const day = new Date(track.date);
  const title =
    name ??
    `Пробежка ${Number.isNaN(day.getTime()) ? '' : day.toLocaleDateString('ru-RU')}`.trim();

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="TraveltoSport" xmlns="http://www.topografix.com/GPX/1/1">',
    `  <metadata><name>${esc(title)}</name>${Number.isNaN(day.getTime()) ? '' : `<time>${day.toISOString()}</time>`}</metadata>`,
    '  <trk>',
    `    <name>${esc(title)}</name>`,
    '    <type>running</type>',
  ];

  let open = false;
  for (const p of track.points) {
    if (p.isPaused) {
      if (open) {
        lines.push('    </trkseg>');
        open = false;
      }
      continue;
    }
    if (!open) {
      lines.push('    <trkseg>');
      open = true;
    }
    const t = new Date(p.timestamp);
    const time = Number.isNaN(t.getTime()) ? '' : `<time>${t.toISOString()}</time>`;
    lines.push(`      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}">${time}</trkpt>`);
  }
  if (open) lines.push('    </trkseg>');

  lines.push('  </trk>', '</gpx>');
  return lines.join('\n');
};

/** Достаёт координаты маршрута из GPX (trkpt и rtept). Нужен для режима симуляции */
export const parseGpx = (text: string): LatLon[] => {
  const result: LatLon[] = [];
  const tagRe = /<(?:trkpt|rtept)\b([^>]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(text)) !== null) {
    const attrs = m[1];
    const lat = /\blat\s*=\s*"([^"]+)"/.exec(attrs);
    const lon = /\blon\s*=\s*"([^"]+)"/.exec(attrs);
    if (!lat || !lon) continue;
    const la = parseFloat(lat[1]);
    const lo = parseFloat(lon[1]);
    if (Number.isFinite(la) && Number.isFinite(lo)) result.push({ lat: la, lon: lo });
  }
  return result;
};
