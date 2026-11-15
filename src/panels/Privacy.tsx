// src/panels/Privacy.tsx
// Экран «Данные и конфиденциальность»: что хранится, где лежит, как забрать
// копию и как всё удалить. Без сервера единственный источник правды — устройство,
// поэтому пользователю важно видеть это явно.
import { useEffect, useRef, useState } from 'react';
import { Panel, Text, Button } from '@vkontakte/vkui';
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router';

import { AppTabbar } from '../components/AppTabbar';
import { BackButton } from '../components/BackButton';
import { PageBackground } from '../components/PageBackground';
import { getBuildId } from '../utils/buildInfo';
import { saveFile, textToFile } from '../utils/fileExport';
import {
  appDataSizeKb,
  buildBackup,
  clearAppData,
  restoreBackup,
} from '../utils/appData';
import { clearErrorLog, getErrorLog } from '../utils/errorLog';
import { COLORS, FONT_SIZE, LINE_HEIGHT, RADIUS, SPACING } from '../styles/tokens';

const FONT = 'Oswald, Impact, "Arial Narrow", Arial, sans-serif';

interface PrivacyProps {
  id: string;
}

type Message = { type: 'ok' | 'error'; text: string } | null;

export const Privacy = ({ id }: PrivacyProps) => {
  const routeNavigator = useRouteNavigator();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<Message>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dataSize, setDataSize] = useState(0);
  const [errors, setErrors] = useState(getErrorLog());

  useEffect(() => {
    setDataSize(appDataSizeKb());
  }, []);

  const handleExport = async () => {
    try {
      const backup = buildBackup();
      const date = new Date().toISOString().slice(0, 10);
      const file = textToFile(
        JSON.stringify(backup, null, 2),
        `traveltosport-backup-${date}.json`,
        'application/json'
      );
      const result = await saveFile(file);
      setMessage(
        result === 'failed'
          ? { type: 'error', text: 'Не удалось сохранить файл. Попробуйте открыть приложение в браузере.' }
          : { type: 'ok', text: 'Копия сформирована и передана в меню сохранения.' }
      );
    } catch {
      setMessage({ type: 'error', text: 'Не удалось собрать копию данных.' });
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const restored = restoreBackup(await file.text());
      setMessage({ type: 'ok', text: `Восстановлено записей: ${restored}. Перезапускаем…` });
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Не удалось прочитать файл копии.',
      });
    }
  };

  const handleDelete = () => {
    const removed = clearAppData();
    clearErrorLog();
    setConfirmDelete(false);
    setMessage({ type: 'ok', text: `Удалено записей: ${removed}. Перезапускаем…` });
    window.setTimeout(() => window.location.reload(), 900);
  };

  const handleClearErrors = () => {
    clearErrorLog();
    setErrors([]);
    setMessage({ type: 'ok', text: 'Журнал ошибок очищен.' });
  };

  return (
    <Panel id={id} style={{ background: 'transparent', padding: 0 }}>
      <PageBackground variant="violet" pattern="topo" paddingBottom={96} style={{ fontFamily: FONT }}>
        <BackButton to="/profile" />

        <Text
          style={{
            color: COLORS.text,
            fontSize: FONT_SIZE.title,
            lineHeight: LINE_HEIGHT.title,
            fontStyle: 'italic',
            marginTop: SPACING.md,
            marginBottom: SPACING.sm,
          }}
        >
          Данные и конфиденциальность
        </Text>
        <Text style={{ ...caption, marginBottom: SPACING.lg }}>
          Приложение работает без сервера: всё, что оно знает о вас, лежит на этом устройстве.
          Ниже — что именно, как забрать копию и как всё удалить.
        </Text>

        <div style={card}>
          <Text style={sectionTitle}>Что хранится</Text>
          <Text style={paragraph}>
            Имя, фамилия, фото и id из ВКонтакте — для профиля и рейтингов.{'\n'}
            Пробежки: маршрут (точки GPS), дистанция, время и темп.{'\n'}
            Программа подготовки: цель, даты, отметки о тренировках.{'\n'}
            Игровая статистика, настройки и счётчики показов рекламы.
          </Text>
          <Text style={{ ...caption, marginTop: SPACING.sm }}>
            Объём сохранённых данных: {dataSize} КБ.
          </Text>
        </div>

        <div style={card}>
          <Text style={sectionTitle}>Где это лежит</Text>
          <Text style={paragraph}>
            Только в памяти мини-приложения на устройстве (localStorage). На серверы мы ничего не
            отправляем. При очистке кэша приложения данные исчезают — поэтому и есть резервная
            копия.
          </Text>
        </div>

        <div style={card}>
          <Text style={sectionTitle}>Резервная копия</Text>
          <Text style={paragraph}>
            Скачайте файл с планом, пробежками и настройками. Его можно восстановить на этом же или
            другом устройстве.
          </Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md }}>
            <Button size="m" appearance="accent" onClick={() => void handleExport()}>
              Скачать копию
            </Button>
            <Button size="m" mode="secondary" onClick={() => fileInputRef.current?.click()}>
              Восстановить из файла
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={(event) => void handleImport(event)}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        <div style={card}>
          <Text style={sectionTitle}>Реклама и геолокация</Text>
          <Text style={paragraph}>
            Реклама показывается через рекламную сеть ВКонтакте; её правила описаны в{' '}
            <a
              href="https://vk.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              style={link}
            >
              политике ВКонтакте
            </a>
            . Геолокация используется только при записи пробежки; трекер сейчас отключён, поэтому
            доступ к ней не запрашивается.
          </Text>
        </div>

        <div style={card}>
          <Text style={sectionTitle}>Удаление данных</Text>
          <Text style={paragraph}>
            Удаляет всё, что приложение сохранило на устройстве: пробежки, план, настройки,
            игровую статистику и журнал ошибок. Отменить это нельзя.
          </Text>
          {confirmDelete ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md }}>
              <Button size="m" appearance="negative" onClick={handleDelete}>
                Да, удалить всё
              </Button>
              <Button size="m" mode="tertiary" onClick={() => setConfirmDelete(false)}>
                Отмена
              </Button>
            </div>
          ) : (
            <Button
              size="m"
              mode="secondary"
              style={{ marginTop: SPACING.md }}
              onClick={() => setConfirmDelete(true)}
            >
              Удалить все данные
            </Button>
          )}
        </div>

        <div style={card}>
          <Text style={sectionTitle}>Политика и поддержка</Text>
          <Text style={paragraph}>
            <a href="./privacy.html" target="_blank" rel="noopener noreferrer" style={link}>
              Политика конфиденциальности
            </a>
          </Text>
          <Text style={{ ...caption, marginTop: SPACING.xs }}>
            Сборка {getBuildId() || 'dev'} · вопросы и проблемы: автор Александр Прожогин,{' '}
            <a
              href="https://vk.ru/prozhogin.aleksandr"
              target="_blank"
              rel="noopener noreferrer"
              style={link}
            >
              профиль ВКонтакте
            </a>
            .
          </Text>
        </div>

        <div style={card}>
          <Text style={sectionTitle}>Журнал ошибок</Text>
          {errors.length === 0 ? (
            <Text style={paragraph}>Ошибок не записано.</Text>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
              {errors.slice(0, 5).map((entry) => (
                <Text key={entry.at + entry.message} style={caption}>
                  {new Date(entry.at).toLocaleString('ru-RU')} · {entry.source}:{' '}
                  {entry.message.slice(0, 160)}
                </Text>
              ))}
            </div>
          )}
          {errors.length > 0 ? (
            <Button size="s" mode="tertiary" style={{ marginTop: SPACING.sm }} onClick={handleClearErrors}>
              Очистить журнал
            </Button>
          ) : null}
        </div>

        {message ? (
          <Text
            style={{
              ...caption,
              color: message.type === 'ok' ? COLORS.accent : COLORS.danger,
              marginTop: SPACING.md,
            }}
          >
            {message.text}
          </Text>
        ) : null}

        <div style={{ marginTop: SPACING.lg }}>
          <Button mode="secondary" size="m" onClick={() => routeNavigator.push('/profile')}>
            Вернуться в профиль
          </Button>
        </div>
      </PageBackground>

      <AppTabbar active="profile" />
    </Panel>
  );
};

const card = {
  background: COLORS.surface,
  border: `1px solid ${COLORS.border}`,
  borderRadius: RADIUS.lg,
  padding: SPACING.lg,
  marginTop: SPACING.md,
  fontFamily: FONT,
};

const sectionTitle = {
  color: COLORS.text,
  fontSize: FONT_SIZE.subtitleSmall,
  lineHeight: LINE_HEIGHT.title,
  fontStyle: 'italic' as const,
  marginBottom: SPACING.sm,
};

const paragraph = {
  color: COLORS.text,
  fontSize: FONT_SIZE.body,
  lineHeight: LINE_HEIGHT.body,
  fontFamily: FONT,
};

const caption = {
  color: COLORS.textSecondary,
  fontSize: FONT_SIZE.caption,
  lineHeight: LINE_HEIGHT.caption,
  fontFamily: FONT,
};

const link = {
  color: COLORS.text,
  textDecoration: 'none',
  borderBottom: '1px solid rgba(255, 255, 255, 0.35)',
};

export default Privacy;
