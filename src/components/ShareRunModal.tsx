// src/components/ShareRunModal.tsx
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import bridge from '@vkontakte/vk-bridge';
import { Icon24Download, Icon24Fullscreen, Icon24Share } from '@vkontakte/icons';

import type { SavedTrack } from '../utils/trackStorage';
import {
  LAYOUTS,
  dataUrlToFile,
  loadImageFromFile,
  loadImageFromUrl,
  renderRunImage,
} from '../utils/shareImage';
import { saveFile } from '../utils/fileExport';
import logoUrl from '../assets/images/TTSlogoShare.png';

interface ShareRunModalProps {
  track: SavedTrack;
  onClose: () => void;
}

const SWIPE_THRESHOLD_PX = 40;

// Клиент VK не сообщает, дошёл ли файл до галереи, поэтому при любом исходе
// напоминаем про ручное сохранение из просмотра крупным планом.
const SAVE_FALLBACK_HINT =
  'Если картинка не появилась в «Загрузках» — откройте её крупно и удерживайте палец: в меню телефона будет «Сохранить изображение».';

const buttonBase: CSSProperties = {
  width: '100%',
  padding: '14px 0',
  borderRadius: 12,
  border: '1px solid rgba(255, 255, 255, 0.15)',
  color: '#FFFFFF',
  fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
  fontSize: 16,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
};

const arrowStyle: CSSProperties = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 36,
  height: 36,
  borderRadius: '50%',
  border: '1px solid rgba(255, 255, 255, 0.25)',
  background: 'rgba(0, 0, 0, 0.45)',
  color: '#FFFFFF',
  fontSize: 22,
  lineHeight: 1,
  cursor: 'pointer',
  padding: 0,
  zIndex: 2,
};

export const ShareRunModal = ({ track, onClose }: ShareRunModalProps) => {
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [hideEnds, setHideEnds] = useState(true);
  const [styleIndex, setStyleIndex] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [saveInfo, setSaveInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  // ready: загрузка логотипа закончилась (успешно или нет); image: сам логотип или null
  const [logo, setLogo] = useState<{ ready: boolean; image: HTMLImageElement | null }>({
    ready: false,
    image: null,
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const cache = useRef<Map<number, string>>(new Map());

  const canStory = useMemo(() => {
    try {
      return bridge.supports('VKWebAppShowStoryBox');
    } catch {
      return false;
    }
  }, []);

  // Нативное скачивание файла умеют только мобильные клиенты VK (Android/iOS),
  // на веб-платформе supports() вернёт false — там работаем браузерными способами.
  const canNativeDownload = useMemo(() => {
    try {
      return bridge.supports('VKWebAppDownloadFile');
    } catch {
      return false;
    }
  }, []);

  // Логотип грузим до первой отрисовки, чтобы карточка не мигала версией без него
  useEffect(() => {
    let cancelled = false;
    loadImageFromUrl(logoUrl)
      .then((image) => {
        if (!cancelled) setLogo({ ready: true, image });
      })
      .catch((err) => {
        console.warn('Логотип не загрузился, используется текстовая подпись:', err);
        if (!cancelled) setLogo({ ready: true, image: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* ------------------------ рендер и кэш всех стилей ------------------------ */

  // Рисуем стиль по требованию и запоминаем: листать стили можно без задержек
  const getImage = useCallback(
    (index: number): string => {
      const cached = cache.current.get(index);
      if (cached) return cached;
      const url = renderRunImage(track, { photo, hideEnds, layoutIndex: index, logo: logo.image });
      cache.current.set(index, url);
      return url;
    },
    [track, photo, hideEnds, logo.image]
  );

  // Фото, трек или флажок изменились — кэш устарел.
  // Этот эффект объявлен раньше остальных, поэтому выполняется первым.
  useEffect(() => {
    cache.current.clear();
  }, [getImage]);

  useEffect(() => {
    if (!logo.ready) return;
    let cancelled = false;

    const render = () => {
      if (cancelled) return;
      try {
        setPreview(getImage(styleIndex));
        setError('');
      } catch (err) {
        console.error('Ошибка создания изображения:', err);
        setError('Не удалось создать изображение');
      }
    };

    // Канвас рисует только уже загруженными шрифтами, поэтому дожидаемся Oswald,
    // иначе в карточку попадёт запасной шрифт.
    const fontsReady =
      typeof document.fonts?.load === 'function'
        ? Promise.all([
            document.fonts.load('700 40px Oswald'),
            document.fonts.load('400 20px Oswald'),
          ]).catch(() => undefined)
        : Promise.resolve(undefined);

    void fontsReady.then(render);

    return () => {
      cancelled = true;
    };
  }, [getImage, styleIndex, logo.ready]);

  // В фоне готовим остальные стили, чтобы свайп был мгновенным
  useEffect(() => {
    if (!logo.ready) return;
    let cancelled = false;
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;

    const step = () => {
      if (cancelled || i >= LAYOUTS.length) return;
      try {
        getImage(i);
      } catch {
        return;
      }
      i += 1;
      timer = setTimeout(step, 40);
    };

    timer = setTimeout(step, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [getImage, logo.ready]);

  /* ------------------------------ переключение ------------------------------ */

  const go = useCallback((delta: 1 | -1) => {
    setDirection(delta === 1 ? 'next' : 'prev');
    setStyleIndex((i) => (i + delta + LAYOUTS.length) % LAYOUTS.length);
  }, []);

  const jumpTo = (index: number) => {
    if (index === styleIndex) return;
    setDirection(index > styleIndex ? 'next' : 'prev');
    setStyleIndex(index);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewerOpen) setViewerOpen(false);
        else onClose();
      } else if (!viewerOpen && e.key === 'ArrowRight') go(1);
      else if (!viewerOpen && e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose, viewerOpen]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    swipeStart.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy) * 1.2) {
      go(dx < 0 ? 1 : -1);
    }
  };

  /* --------------------------------- действия -------------------------------- */

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPhoto(await loadImageFromFile(file));
    } catch {
      setError('Не удалось открыть фото. Попробуйте другое.');
    }
  };

  const shareToStory = async () => {
    if (!preview) return;
    setBusy(true);
    setError('');
    try {
      await bridge.send('VKWebAppShowStoryBox', {
        background_type: 'image',
        blob: preview, // data:image/jpeg;base64,...
        locked: true,
      });
    } catch (err) {
      // Код 4 — пользователь закрыл редактор, это не ошибка
      const e = err as { error_data?: { error_code?: number } };
      if (e?.error_data?.error_code !== 4) {
        console.warn('VKWebAppShowStoryBox:', err);
        setError('Не удалось открыть редактор историй. Откройте картинку крупно и сделайте скриншот.');
      }
    } finally {
      setBusy(false);
    }
  };

  // Сохранение картинки. Порядок принципиален: системное меню вызывается СИНХРОННО
  // из обработчика нажатия — если перед вызовом сделать хотя бы один await,
  // браузер отклонит запрос с «Must be handling a user gesture».
  const saveImage = () => {
    if (!preview) return;
    setSaveInfo('');

    const filename = `traveltosport_${Date.now()}.jpg`;
    let file: File | null = null;
    try {
      file = dataUrlToFile(preview, filename);
    } catch {
      file = null;
    }

    const canShareFile =
      !!file &&
      typeof navigator.share === 'function' &&
      (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] }));

    if (file && canShareFile) {
      setBusy(true);
      navigator
        .share({ files: [file], title: 'Моя пробежка', text: 'TraveltoSport' })
        .then(() =>
          setSaveInfo('Меню закрыто. Если вы выбрали «Сохранить в галерею» — картинка уже там.')
        )
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') {
            setSaveInfo('Сохранение отменено.');
            return;
          }
          console.warn('navigator.share:', err);
          setSaveInfo(SAVE_FALLBACK_HINT);
          setViewerOpen(true);
        })
        .finally(() => setBusy(false));
      return;
    }

    // Дальше — клиенты без системного меню (обычно WebView приложения VK).
    setBusy(true);
    void (async () => {
      try {
        if (canNativeDownload) {
          // Мост VK не умеет таймауты сам: если клиент не ответит, кнопка зависнет навсегда.
          const data = await Promise.race([
            bridge.send('VKWebAppDownloadFile', { url: preview, filename }).catch(() => null),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
          ]);
          if (data?.result) {
            setSaveInfo(`Файл ${filename} отправлен в «Загрузки» устройства.`);
            return;
          }
        }

        if (file) {
          const result = await saveFile(file);
          if (result === 'download-attempted') {
            setSaveInfo(`Скачивание запущено: ${filename}. ${SAVE_FALLBACK_HINT}`);
            return;
          }
        }

        setSaveInfo(SAVE_FALLBACK_HINT);
        setViewerOpen(true);
      } finally {
        setBusy(false);
      }
    })();
  };

  const layout = LAYOUTS[styleIndex];
  const slideAnimation =
    direction === 'next' ? 'srmSlideNext 0.22s ease-out' : 'srmSlidePrev 0.22s ease-out';

  return (
    <>
      {createPortal(
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        >
          <style>{`
            @keyframes srmSlideNext { from { opacity: 0; transform: translateX(36px); } to { opacity: 1; transform: none; } }
            @keyframes srmSlidePrev { from { opacity: 0; transform: translateX(-36px); } to { opacity: 1; transform: none; } }
            @media (prefers-reduced-motion: reduce) { .srmSlide { animation: none !important; } }
          `}</style>

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Поделиться пробежкой"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 380,
              maxHeight: '94vh',
              overflowY: 'auto',
              boxSizing: 'border-box',
              padding: 20,
              borderRadius: 20,
              color: '#FFFFFF',
              background: 'linear-gradient(160deg, #1c4934 0%, #01130f 100%)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif', fontSize: 20, textAlign: 'center', marginBottom: 12 }}>
              Поделиться пробежкой
            </div>

            {/* Превью: листается свайпом влево/вправо */}
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                aria-label="Предыдущий стиль"
                onClick={() => go(-1)}
                style={{ ...arrowStyle, left: 0 }}
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Следующий стиль"
                onClick={() => go(1)}
                style={{ ...arrowStyle, right: 0 }}
              >
                ›
              </button>

              <div
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                onPointerCancel={() => (swipeStart.current = null)}
                style={{ width: '100%', maxWidth: 250, touchAction: 'pan-y' }}
              >
                {preview ? (
                  <img
                    key={styleIndex}
                    className="srmSlide"
                    src={preview}
                    alt={`Карточка пробежки, стиль «${layout.name}»`}
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                    style={{
                      display: 'block',
                      width: '100%',
                      aspectRatio: '9 / 16',
                      objectFit: 'cover',
                      borderRadius: 16,
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      animation: slideAnimation,
                      // Разрешаем системное меню по долгому нажатию, если WebView его поддерживает
                      WebkitTouchCallout: 'default',
                      WebkitUserSelect: 'auto',
                      userSelect: 'auto',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      height: 360,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0.7,
                    }}
                  >
                    Создаём изображение…
                  </div>
                )}
              </div>
            </div>

            {/* Название стиля и индикатор */}
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <div style={{ fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif', fontSize: 16 }}>{layout.name}</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
                {LAYOUTS.map((l, i) => (
                  <button
                    key={l.id}
                    type="button"
                    aria-label={`Стиль «${l.name}»`}
                    onClick={() => jumpTo(i)}
                    style={{
                      width: i === styleIndex ? 20 : 8,
                      height: 8,
                      borderRadius: 4,
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      background: i === styleIndex ? '#4CAF50' : 'rgba(255, 255, 255, 0.3)',
                      transition: 'width 0.2s',
                    }}
                  />
                ))}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.6)', marginTop: 8, fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>
                Свайпайте влево и вправо, чтобы сменить стиль
              </div>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFile}
              style={{ display: 'none' }}
            />

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                style={{ ...buttonBase, background: 'rgba(255, 255, 255, 0.2)' }}
              >
                {photo ? '🖼 Заменить фото' : '🖼 Добавить своё фото'}
              </button>
              {photo && (
                <button
                  type="button"
                  onClick={() => setPhoto(null)}
                  aria-label="Убрать фото"
                  style={{ ...buttonBase, width: 56, background: 'rgba(244, 67, 54, 0.4)' }}
                >
                  ✕
                </button>
              )}
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginTop: 14,
                fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={hideEnds}
                onChange={(e) => setHideEnds(e.target.checked)}
                style={{ width: 20, height: 20 }}
              />
              Скрыть начало и конец маршрута (200 м)
            </label>

            {error && (
              <div style={{ color: '#FF9800', fontSize: 13, marginTop: 12, fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
              {canStory && (
                <button
                  type="button"
                  onClick={shareToStory}
                  disabled={busy || !preview}
                  style={{
                    ...buttonBase,
                    background: 'rgba(76, 175, 80, 0.75)',
                    opacity: busy || !preview ? 0.6 : 1,
                  }}
                >
                  <Icon24Share />
                  Опубликовать в истории VK
                </button>
              )}
              <button
                type="button"
                onClick={saveImage}
                disabled={busy || !preview}
                style={{
                  ...buttonBase,
                  background: 'rgba(255, 255, 255, 0.2)',
                  opacity: busy || !preview ? 0.6 : 1,
                }}
              >
                <Icon24Download />
                Сохранить картинку
              </button>
              <button
                type="button"
                onClick={() => setViewerOpen(true)}
                disabled={!preview}
                style={{ ...buttonBase, background: 'rgba(255, 255, 255, 0.12)' }}
              >
                <Icon24Fullscreen />
                Открыть крупно
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{ ...buttonBase, background: 'transparent', border: 'none', opacity: 0.8 }}
              >
                Закрыть
              </button>
            </div>

            {saveInfo && (
              <div
                style={{
                  fontSize: 13,
                  color: '#FF9800',
                  textAlign: 'center',
                  marginTop: 8,
                  fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
                }}
              >
                {saveInfo}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Просмотр крупно: запасной путь — скриншот или долгое нажатие.
          Это отдельный портал: у основного окна есть backdrop-filter,
          и fixed-элемент внутри него был бы ограничен его размерами. */}
      {viewerOpen &&
        preview &&
        createPortal(
          <div
            onClick={() => setViewerOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1100,
              background: '#000000',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 12,
              boxSizing: 'border-box',
            }}
          >
            <img
              src={preview}
              alt="Карточка пробежки"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '100%',
                maxHeight: 'calc(100% - 56px)',
                objectFit: 'contain',
                WebkitTouchCallout: 'default',
                WebkitUserSelect: 'auto',
                userSelect: 'auto',
              }}
            />
            <div
              style={{
                color: 'rgba(255,255,255,0.7)',
                fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
                fontSize: 13,
                marginTop: 10,
                textAlign: 'center',
              }}
            >
              Нажмите и удерживайте картинку → «Сохранить изображение» (на iPhone — «Добавить в
              фото») · Нажмите на фон, чтобы закрыть
            </div>
            <button
              type="button"
              aria-label="Закрыть"
              onClick={() => setViewerOpen(false)}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.15)',
                color: '#FFFFFF',
                fontSize: 20,
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>,
          document.body
        )}
    </>
  );
};

export default ShareRunModal;