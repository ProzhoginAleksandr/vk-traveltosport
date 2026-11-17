// src/utils/shareImage.ts
// Рисует картинку-карточку пробежки (формат истории VK, 1080×1920):
// фон — фото пользователя или фирменный градиент, поверх — маршрут и метрики.
// Расположение метрик задаётся «стилями» (LAYOUTS) — данными, а не кодом,
// поэтому новый стиль добавляется одним объектом в массив.
//
// Карту с тайлами намеренно не рисуем: тайлы с чужого домена «пачкают» canvas
// (CORS), и из него нельзя получить картинку. Маршрут рисуется векторно.
import type { SavedTrack } from './trackStorage';

export interface RenderOptions {
  photo: HTMLImageElement | null;
  /** Скрыть первые и последние 200 м маршрута (чтобы не светить дом) */
  hideEnds: boolean;
  /** Индекс стиля из LAYOUTS */
  layoutIndex: number;
  /** Логотип приложения (подготовленный PNG с прозрачностью). Если не загрузился — рисуется текстовая подпись */
  logo?: HTMLImageElement | null;
}

const W = 1080;
const H = 1920;
const PRIVACY_ZONE_M = 200;

/** Цвет линии маршрута */
const ROUTE_COLOR = '#bedda2';

const FONT_TITLE = 'Oswald, Impact, "Arial Narrow", Arial, sans-serif';
const FONT_TEXT = 'Oswald, Impact, "Arial Narrow", Arial, sans-serif';

interface Pt {
  lat: number;
  lon: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Align = 'left' | 'center' | 'right';
type StatKey = 'distance' | 'duration' | 'pace' | 'speed';

/* --------------------------------- стили ----------------------------------- */

interface StatSpec {
  key: StatKey;
  /** Опорная точка по X: левый край, центр или правый край — зависит от align */
  x: number;
  /** Базовая линия значения */
  y: number;
  align: Align;
  /** Размер шрифта значения; единицы измерения рисуются в 0.4 от него */
  size: number;
  /** Подпись («ВРЕМЯ», «ТЕМП») над значением */
  label?: boolean;
  /** Максимальная ширина: если не помещается — размер уменьшается */
  maxW?: number;
}

interface TextSpec {
  x: number;
  y: number;
  align: Align;
  size: number;
}

interface LogoSpec {
  /** Опорная точка по X: левый край, центр или правый край — зависит от align */
  x: number;
  /** Нижний край логотипа */
  y: number;
  align: Align;
  /** Ширина; высота считается по пропорциям картинки */
  width: number;
}

export interface LayoutSpec {
  id: string;
  name: string;
  /** Где затемнять фото, чтобы текст читался */
  route: Box;
  /** Множитель толщины линии маршрута */
  lineScale?: number;
  stats: StatSpec[];
  date: TextSpec | null;
  /** Текстовая подпись — запасной вариант, пока логотип не загрузился или недоступен */
  brand: TextSpec;
  logo: LogoSpec;
}

export const LAYOUTS: readonly LayoutSpec[] = [
  {
    id: 'classic',
    name: 'Классика',
    route: { x: 240, y: 350, w: 600, h: 650 },
    stats: [
      { key: 'distance', x: 540, y: 1450, align: 'center', size: 230 },
      { key: 'duration', x: 324, y: 1685, align: 'center', size: 84, label: true, maxW: 420 },
      { key: 'pace', x: 756, y: 1685, align: 'center', size: 84, label: true, maxW: 420 },
    ],
    date: { x: 90, y: 130, align: 'left', size: 44 },
    brand: { x: 540, y: 1830, align: 'center', size: 52 },
    logo: { x: 540, y: 1885, align: 'center', width: 300 },
  },
  {
    id: 'big',
    name: 'Крупно',
    route: { x: 260, y: 320, w: 560, h: 580 },
    stats: [
      { key: 'distance', x: 540, y: 1370, align: 'center', size: 330 },
      { key: 'duration', x: 190, y: 1640, align: 'center', size: 72, label: true, maxW: 300 },
      { key: 'pace', x: 540, y: 1640, align: 'center', size: 72, label: true, maxW: 300 },
      { key: 'speed', x: 890, y: 1640, align: 'center', size: 72, label: true, maxW: 300 },
    ],
    date: { x: 90, y: 130, align: 'left', size: 44 },
    brand: { x: 540, y: 1830, align: 'center', size: 48 },
    logo: { x: 540, y: 1885, align: 'center', width: 280 },
  },
  {
    id: 'minimal',
    name: 'Минимал',
    route: { x: 240, y: 300, w: 600, h: 720 },
    stats: [
      { key: 'distance', x: 200, y: 1580, align: 'center', size: 70, label: true, maxW: 300 },
      { key: 'duration', x: 540, y: 1580, align: 'center', size: 70, label: true, maxW: 300 },
      { key: 'pace', x: 880, y: 1580, align: 'center', size: 70, label: true, maxW: 300 },
    ],
    date: { x: 90, y: 110, align: 'left', size: 40 },
    brand: { x: 540, y: 1830, align: 'center', size: 44 },
    logo: { x: 540, y: 1885, align: 'center', width: 280 },
  },
  {
    id: 'left',
    name: 'Слева',
    route: { x: 560, y: 420, w: 400, h: 800 },
    lineScale: 0.85,
    stats: [
      { key: 'distance', x: 80, y: 1010, align: 'left', size: 190, maxW: 400 },
      { key: 'duration', x: 80, y: 1250, align: 'left', size: 100, label: true, maxW: 400 },
      { key: 'pace', x: 80, y: 1470, align: 'left', size: 100, label: true, maxW: 400 },
      { key: 'speed', x: 80, y: 1690, align: 'left', size: 100, label: true, maxW: 400 },
    ],
    date: { x: 80, y: 130, align: 'left', size: 44 },
    brand: { x: 80, y: 1840, align: 'left', size: 46 },
    logo: { x: 80, y: 1888, align: 'left', width: 260 },
  },
  {
    id: 'right',
    name: 'Справа',
    route: { x: 120, y: 420, w: 400, h: 800 },
    lineScale: 0.85,
    stats: [
      { key: 'distance', x: 1000, y: 1010, align: 'right', size: 190, maxW: 400 },
      { key: 'duration', x: 1000, y: 1250, align: 'right', size: 100, label: true, maxW: 400 },
      { key: 'pace', x: 1000, y: 1470, align: 'right', size: 100, label: true, maxW: 400 },
      { key: 'speed', x: 1000, y: 1690, align: 'right', size: 100, label: true, maxW: 400 },
    ],
    date: { x: 1000, y: 130, align: 'right', size: 44 },
    brand: { x: 1000, y: 1840, align: 'right', size: 46 },
    logo: { x: 1000, y: 1888, align: 'right', width: 260 },
  },
  {
    id: 'top',
    name: 'Сверху',
    route: { x: 260, y: 700, w: 560, h: 660 },
    stats: [
      { key: 'distance', x: 540, y: 400, align: 'center', size: 280 },
      { key: 'duration', x: 200, y: 620, align: 'center', size: 80, label: true, maxW: 320 },
      { key: 'pace', x: 540, y: 620, align: 'center', size: 80, label: true, maxW: 320 },
      { key: 'speed', x: 880, y: 620, align: 'center', size: 80, label: true, maxW: 320 },
    ],
    date: { x: 90, y: 120, align: 'left', size: 44 },
    brand: { x: 540, y: 1850, align: 'center', size: 44 },
    logo: { x: 540, y: 1890, align: 'center', width: 260 },
  },
  {
    id: 'compact',
    name: 'Мелко',
    route: { x: 240, y: 330, w: 600, h: 660 },
    lineScale: 0.8,
    stats: [
      { key: 'distance', x: 90, y: 1600, align: 'left', size: 110, label: true, maxW: 310 },
      { key: 'duration', x: 540, y: 1600, align: 'center', size: 110, label: true, maxW: 280 },
      { key: 'pace', x: 990, y: 1600, align: 'right', size: 110, label: true, maxW: 310 },
    ],
    date: { x: 90, y: 130, align: 'left', size: 44 },
    brand: { x: 540, y: 1840, align: 'center', size: 44 },
    logo: { x: 540, y: 1885, align: 'center', width: 240 },
  },
];

/* ------------------------------ форматирование ----------------------------- */

const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const formatPaceValue = (paceSecPerKm: number): string => {
  if (!paceSecPerKm || paceSecPerKm <= 0) return '—';
  const mins = Math.floor(paceSecPerKm / 60);
  const secs = Math.round(paceSecPerKm % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

const statParts = (track: SavedTrack, key: StatKey): { label: string; value: string; unit: string } => {
  switch (key) {
    case 'distance':
      return { label: 'ДИСТАНЦИЯ', value: (track.distance / 1000).toFixed(2), unit: 'км' };
    case 'duration':
      return { label: 'ВРЕМЯ', value: formatDuration(track.duration), unit: '' };
    case 'pace': {
      const value = formatPaceValue(track.pace);
      return { label: 'ТЕМП', value, unit: value === '—' ? '' : '/км' };
    }
    case 'speed':
      return { label: 'СКОРОСТЬ', value: track.speed.toFixed(1), unit: 'км/ч' };
  }
};

/* --------------------------------- маршрут --------------------------------- */

const toRad = (d: number): number => (d * Math.PI) / 180;

const haversine = (a: Pt, b: Pt): number => {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

// «Зона приватности»: отрезаем начало и конец маршрута
const trimEnds = (points: Pt[], meters: number): Pt[] => {
  if (points.length < 3) return points;

  const cum: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + haversine(points[i - 1], points[i]));
  }
  const total = cum[cum.length - 1];
  if (total < meters * 4) return points; // слишком короткий маршрут — не режем

  const trimmed = points.filter((_, i) => cum[i] >= meters && cum[i] <= total - meters);
  return trimmed.length >= 2 ? trimmed : points;
};

const drawRoute = (ctx: CanvasRenderingContext2D, points: Pt[], box: Box, lineScale: number) => {
  if (points.length < 2) return;

  // Равнопрямоугольная проекция: долготу сжимаем на cos(широты)
  const lat0 = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const k = Math.cos(toRad(lat0));
  const xy = points.map((p) => ({ x: p.lon * k, y: -p.lat }));

  const xs = xy.map((p) => p.x);
  const ys = xy.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  if (spanX < 1e-9 && spanY < 1e-9) return;

  const scale = Math.min(box.w / (spanX || 1e-9), box.h / (spanY || 1e-9));
  const offX = box.x + (box.w - spanX * scale) / 2;
  const offY = box.y + (box.h - spanY * scale) / 2;
  const pts = xy.map((p) => ({ x: offX + (p.x - minX) * scale, y: offY + (p.y - minY) * scale }));

  const trace = () => {
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  };

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // тень → тёмная подложка → светлая линия: так трек читается и на светлом фото
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 18;
  ctx.strokeStyle = 'rgba(9, 16, 10, 0.55)';
  ctx.lineWidth = 18 * lineScale;
  trace();
  ctx.stroke();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.strokeStyle = ROUTE_COLOR;
  ctx.lineWidth = 9 * lineScale;
  trace();
  ctx.stroke();

  // начало и конец
  const dot = (p: { x: number; y: number }, color: string) => {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 18 * lineScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 9 * lineScale, 0, Math.PI * 2);
    ctx.fill();
  };
  dot(pts[0], ROUTE_COLOR);
  dot(pts[pts.length - 1], '#F44336');
};

/* ---------------------------------- фон ------------------------------------ */

const drawBackground = (ctx: CanvasRenderingContext2D, photo: HTMLImageElement | null) => {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);

  if (photo) {
    // «cover»: заполняем весь кадр, лишнее обрезаем по центру
    const s = Math.max(W / photo.width, H / photo.height);
    const w = photo.width * s;
    const h = photo.height * s;
    ctx.drawImage(photo, (W - w) / 2, (H - h) / 2, w, h);

    // Ровная тёмная вуаль вместо градиентов: фото остаётся читаемым,
    // а трек и подписи не теряются на светлых участках
    ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
    ctx.fillRect(0, 0, W, H);
    return;
  }

  // Фирменный градиент приложения (как в PageBackground, вариант green)
  const R = Math.hypot(W, H);

  const topLeft = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
  topLeft.addColorStop(0, '#096b11');
  topLeft.addColorStop(0.07, '#1c4934');
  topLeft.addColorStop(0.2, '#01130f');
  topLeft.addColorStop(1, '#000000');
  ctx.fillStyle = topLeft;
  ctx.fillRect(0, 0, W, H);

  const bottomRight = ctx.createRadialGradient(W, H, 0, W, H, R);
  bottomRight.addColorStop(0, '#096b11');
  bottomRight.addColorStop(0.17, '#1c4934');
  bottomRight.addColorStop(0.4, '#01130f');
  bottomRight.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = bottomRight;
  ctx.fillRect(0, 0, W, H);
};

/* --------------------------------- текст ----------------------------------- */

const withShadow = (ctx: CanvasRenderingContext2D, draw: () => void) => {
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 14;
  draw();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
};

const drawStat = (ctx: CanvasRenderingContext2D, spec: StatSpec, track: SavedTrack) => {
  const { label, value, unit } = statParts(track, spec.key);

  const measure = (size: number) => {
    const unitSize = Math.round(size * 0.4);
    ctx.font = `${size}px ${FONT_TITLE}`;
    const vw = ctx.measureText(value).width;
    ctx.font = `${unitSize}px ${FONT_TITLE}`;
    const uw = unit ? ctx.measureText(unit).width : 0;
    const gap = unit ? Math.round(size * 0.1) : 0;
    return { unitSize, vw, uw, gap, total: vw + gap + uw };
  };

  // Если значение не помещается в отведённую ширину — уменьшаем шрифт
  let size = spec.size;
  let m = measure(size);
  const maxW = spec.maxW ?? (spec.align === 'center' ? W - 120 : W - 160);
  if (m.total > maxW) {
    size = Math.floor(size * (maxW / m.total));
    m = measure(size);
  }

  const startX =
    spec.align === 'left' ? spec.x : spec.align === 'center' ? spec.x - m.total / 2 : spec.x - m.total;

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  withShadow(ctx, () => {
    ctx.font = `${size}px ${FONT_TITLE}`;
    ctx.fillText(value, startX, spec.y);
    if (unit) {
      ctx.font = `${m.unitSize}px ${FONT_TITLE}`;
      ctx.fillText(unit, startX + m.vw + m.gap, spec.y);
    }
  });

  if (spec.label) {
    const labelSize = Math.round(Math.min(38, Math.max(26, size * 0.4)));
    ctx.font = `bold ${labelSize}px ${FONT_TEXT}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.textAlign = spec.align;
    withShadow(ctx, () => ctx.fillText(label, spec.x, spec.y - size * 0.8 - 14));
  }
};

const drawText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  spec: TextSpec,
  font: string,
  color: string
) => {
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = spec.align;
  ctx.font = `${font.replace('{size}', String(spec.size))}`;
  ctx.fillStyle = color;
  withShadow(ctx, () => ctx.fillText(text, spec.x, spec.y));
};

const drawLogo = (ctx: CanvasRenderingContext2D, logo: HTMLImageElement, spec: LogoSpec) => {
  const height = spec.width * (logo.height / logo.width);
  const left =
    spec.align === 'left' ? spec.x : spec.align === 'center' ? spec.x - spec.width / 2 : spec.x - spec.width;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  withShadow(ctx, () => ctx.drawImage(logo, left, spec.y - height, spec.width, height));
};

/* ------------------------------- публичный API ------------------------------ */

/** Возвращает JPEG в виде data URL (с префиксом data:image/jpeg;base64,) */
export const renderRunImage = (track: SavedTrack, options: RenderOptions): string => {
  const layout = LAYOUTS[options.layoutIndex] ?? LAYOUTS[0];

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas недоступен');

  drawBackground(ctx, options.photo);

  const raw: Pt[] = track.points.map((p) => ({ lat: p.lat, lon: p.lon }));
  const route = options.hideEnds ? trimEnds(raw, PRIVACY_ZONE_M) : raw;
  drawRoute(ctx, route, layout.route, layout.lineScale ?? 1);

  layout.stats.forEach((spec) => drawStat(ctx, spec, track));

  if (layout.date) {
    drawText(ctx, formatDate(track.date), layout.date, `bold {size}px ${FONT_TEXT}`, '#FFFFFF');
  }
  if (options.logo) {
    drawLogo(ctx, options.logo, layout.logo);
  } else {
    drawText(ctx, 'TraveltoSport', layout.brand, `{size}px ${FONT_TITLE}`, 'rgba(255, 255, 255, 0.9)');
  }

  return canvas.toDataURL('image/jpeg', 0.9);
};

const imageCache = new Map<string, Promise<HTMLImageElement>>();

/** Загружает картинку по адресу (например, импортированный логотип). Результат кэшируется */
export const loadImageFromUrl = (url: string): Promise<HTMLImageElement> => {
  const cached = imageCache.get(url);
  if (cached) return cached;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      imageCache.delete(url); // неудачу не запоминаем — можно попробовать снова
      reject(new Error('Не удалось загрузить изображение'));
    };
    img.src = url;
  });
  imageCache.set(url, promise);
  return promise;
};

export const loadImageFromFile = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось загрузить изображение'));
    };
    img.src = url;
  });

export const dataUrlToFile = (dataUrl: string, filename: string): File => {
  const [head, body] = dataUrl.split(',');
  const mime = /data:(.*?);base64/.exec(head)?.[1] ?? 'image/jpeg';
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
};