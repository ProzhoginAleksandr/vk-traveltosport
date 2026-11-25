// src/panels/Profile.tsx
import { useState, useEffect } from 'react';
import {
  Panel,
  Group,
  Div,
  Text,
  Avatar,
  Title,
  Cell,
  Button,
  Header,
  Card,
  CardGrid,
  Spinner,
} from '@vkontakte/vkui';
import profileHeaderImage from '../assets/images/ProfileHeader.webp';
import { AppTabbar } from '../components/AppTabbar';
import { RankBadge } from '../components/RankBadge';
import { ShareRunModal } from '../components/ShareRunModal';
import { trackToGpx } from '../utils/gpx';
import { saveFile, textToFile } from '../utils/fileExport';
import { PageBackground } from '../components/PageBackground';
import { BackButton } from '../components/BackButton';
import { getCurrentUser, VKUser } from '../utils/userUtils';
import {
  loadUserTracks,
  clearUserTracks,
  deleteUserTrack,
  SavedTrack,
} from '../utils/trackStorage';
import { getBuildId } from '../utils/buildInfo';
import { syncClubContribution } from '../utils/club';
import { clearCloudTracks, removeTrackFromCloud } from '../utils/trackSync';
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router';

interface ProfileProps {
  id: string;
}

// 🕐 Форматирование времени
const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// 🏃 Форматирование темпа
const formatPace = (paceSecPerKm: number): string => {
  if (!paceSecPerKm || paceSecPerKm <= 0) return '—';
  const mins = Math.floor(paceSecPerKm / 60);
  const secs = Math.round(paceSecPerKm % 60);
  return `${mins}:${String(secs).padStart(2, '0')} /км`;
};

// 📅 Форматирование даты
const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const Profile = ({ id }: ProfileProps) => {
  const routeNavigator = useRouteNavigator();
  const [user, setUser] = useState<VKUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tracks, setTracks] = useState<SavedTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<SavedTrack | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [exportInfo, setExportInfo] = useState('');

  // Загрузка пользователя и его треков
  useEffect(() => {
    let isMounted = true;
    let currentUserId: number | null = null;

    const refreshTracks = () => {
      if (!isMounted || !currentUserId) return;
      const saved = loadUserTracks(currentUserId);
      saved.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTracks(saved);
    };

    const loadUserData = async () => {
      setIsLoading(true);
      const userData = await getCurrentUser();

      if (!isMounted) return;
      setUser(userData);
      currentUserId = userData?.id ?? null;

      if (userData) {
        const saved = loadUserTracks(userData.id);
        saved.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setTracks(saved);
      }
      setIsLoading(false);
    };

    loadUserData();
    window.addEventListener('traveltosport:tracks-restored', refreshTracks);

    return () => {
      isMounted = false;
      window.removeEventListener('traveltosport:tracks-restored', refreshTracks);
    };
  }, []);

  // 🗑️ Удаление одного трека
  const handleDeleteTrack = (trackId: string) => {
    if (!user) return;
    if (!confirm('Удалить эту пробежку?')) return;
    deleteUserTrack(user.id, trackId);
    const updated = tracks.filter((t) => t.id !== trackId);
    setTracks(updated);
    setSelectedTrack(null);
    setShareOpen(false);
    // Убираем и облачную копию, иначе она вернётся после очистки кэша
    void removeTrackFromCloud(trackId);
    // Удалённая тренировка больше не должна входить в клубный пробег
    void syncClubContribution({ allowDecrease: true });
  };

  // 🗑️ Очистка всех треков
  const handleClearAll = () => {
    if (!user) return;
    if (!confirm('Удалить ВСЕ пробежки? Это действие нельзя отменить.')) return;
    clearUserTracks(user.id);
    setTracks([]);
    setSelectedTrack(null);
    setShareOpen(false);
    void clearCloudTracks();
    void syncClubContribution({ allowDecrease: true });
  };

  // 🔙 Возврат к списку из детального просмотра
  const handleBack = () => {
    setSelectedTrack(null);
    setShareOpen(false);
    setExportInfo('');
  };

  // ⬇️ Экспорт выбранной пробежки в GPX (резервная копия и перенос в другие приложения)
  const handleExportGpx = async () => {
    if (!selectedTrack) return;
    const file = textToFile(
      trackToGpx(selectedTrack),
      `traveltosport_${selectedTrack.id}.gpx`,
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

  // Общая статистика
  const totalDistance = tracks.reduce((sum, t) => sum + t.distance, 0);
  const totalTime = tracks.reduce((sum, t) => sum + t.duration, 0);
  const totalRuns = tracks.length;

  return (
    <Panel id={id} style={{ background: 'transparent', padding: 0 }}>
      <style>{`
        .vkuiGroup { background: transparent !important; }
        .vkuiCard { background: transparent !important; }
        .vkuiCell { background: transparent !important; }
      `}</style>

      
        <PageBackground variant="amber" pattern="ridge">
          <BackButton to="/" />

        {/* Header */}
        <div
          style={{
            paddingTop: '20px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <img
            src={profileHeaderImage}
            alt="Профиль"
            style={{ width: '100%', maxWidth: '380px', height: 'auto', objectFit: 'contain' }}
          />
        </div>

        {/* Карточка пользователя */}
        <Group
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            marginTop: '16px',
            marginBottom: '12px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            padding: '4px 0',
          }}
        >
          <Div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px' }}>
            {isLoading ? (
              <Spinner size="m" />
            ) : (
              <>
                <Avatar src={user?.photo_100} size={72} />
                <div>
                  <Title
                    level="2"
                    style={{ marginBottom: 4, color: '#FFFFFF', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}
                  >
                    {user ? `${user.first_name} ${user.last_name}` : 'Гость'}
                  </Title>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.6)', marginBottom: 8 }}>
                    ID: {user?.id || '—'}
                  </Text>
                  <RankBadge runsCount={totalRuns} />
                </div>
              </>
            )}
          </Div>
        </Group>

        {/* Детальный просмотр трека */}
        {selectedTrack ? (
          <>
            

            <Group
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                marginBottom: '12px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                padding: '16px',
              }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>
                📅 {formatDate(selectedTrack.date)}
              </Text>

              <CardGrid size="l">
                <Card
                  style={{
                    padding: '12px',
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '12px',
                  }}
                >
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Дистанция</Text>
                  <Text style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF' }}>
                    {(selectedTrack.distance / 1000).toFixed(2)} км
                  </Text>
                </Card>
                <Card
                  style={{
                    padding: '12px',
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '12px',
                  }}
                >
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Время</Text>
                  <Text style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF' }}>
                    {formatDuration(selectedTrack.duration)}
                  </Text>
                </Card>
                <Card
                  style={{
                    padding: '12px',
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '12px',
                  }}
                >
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Темп</Text>
                  <Text style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF' }}>
                    {formatPace(selectedTrack.pace)}
                  </Text>
                </Card>
                <Card
                  style={{
                    padding: '12px',
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '12px',
                  }}
                >
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Скорость</Text>
                  <Text style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF' }}>
                    {selectedTrack.speed.toFixed(2)} км/ч
                  </Text>
                </Card>
              </CardGrid>
            </Group>

            <Group
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                padding: '16px',
              }}
            >
              <Button
                size="l"
                stretched
                mode="secondary"
                onClick={() => setShareOpen(true)}
                style={{
                  width: '100%',
                  background: 'rgba(76, 175, 80, 0.6)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#FFFFFF',
                  fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
                  fontSize: '15px',
                  height: '56px',
                  marginBottom: '12px',
                }}
              >
                📤 Поделиться пробежкой
              </Button>
              <Button
                size="l"
                stretched
                mode="secondary"
                onClick={handleExportGpx}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.18)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#FFFFFF',
                  fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
                  fontSize: '15px',
                  height: '56px',
                  marginBottom: exportInfo ? '8px' : '12px',
                }}
              >
                ⬇ Экспорт GPX
              </Button>
              {exportInfo && (
                <Text
                  style={{
                    color: '#FF9800',
                    fontSize: '13px',
                    textAlign: 'center',
                    marginBottom: '12px',
                    whiteSpace: 'normal',
                  }}
                >
                  {exportInfo}
                </Text>
              )}
              <Button
                size="l"
                stretched
                mode="secondary"
                onClick={handleBack}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.25)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#FFFFFF',
                  fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
                  fontSize: '15px',
                  height: '56px',
                  marginBottom: '12px',
                }}
              >
                ← К списку пробежек
              </Button>
              <Button
                size="l"
                stretched
                mode="secondary"
                onClick={() => handleDeleteTrack(selectedTrack.id)}
                style={{
                  width: '100%',
                  background: 'rgba(244, 67, 54, 0.5)',
                  borderRadius: '12px',
                  border: '1px solid rgba(244, 67, 54, 0.7)',
                  color: '#FFFFFF',
                  fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
                  fontSize: '15px',
                  height: '56px',
                }}
              >
                Удалить пробежку
              </Button>
            </Group>
          </>
        ) : (
          <>
            {/* Общая статистика */}
            <Group
              header={
                <Header style={{ color: '#FFFFFF', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>
                  Общая статистика
                </Header>
              }
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                marginBottom: '12px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                padding: '16px',
              }}
            >
              <CardGrid size="l">
                <Card
                  style={{
                    padding: '12px',
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '12px',
                  }}
                >
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Пробежек</Text>
                  <Text style={{ fontSize: '22px', fontWeight: 700, color: '#FFFFFF' }}>
                    {totalRuns}
                  </Text>
                </Card>
                <Card
                  style={{
                    padding: '12px',
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '12px',
                  }}
                >
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Всего км</Text>
                  <Text style={{ fontSize: '22px', fontWeight: 700, color: '#FFFFFF' }}>
                    {(totalDistance / 1000).toFixed(1)}
                  </Text>
                </Card>
                <Card
                  style={{
                    padding: '12px',
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '12px',
                  }}
                >
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>
                    Всего времени
                  </Text>
                  <Text style={{ fontSize: '22px', fontWeight: 700, color: '#FFFFFF' }}>
                    {formatDuration(totalTime)}
                  </Text>
                </Card>
              </CardGrid>
            </Group>

            {/* Список пробежек */}
            <Group
              header={
                <Header style={{ color: '#FFFFFF', fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif' }}>
                  🏃 Мои пробежки
                </Header>
              }
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                marginBottom: '12px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                padding: '4px 0',
              }}
            >
              {tracks.length === 0 ? (
                <Div>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.6)', textAlign: 'center' }}>
                    История пуста. Загрузите первую пробежку!
                  </Text>
                </Div>
              ) : (
                tracks.map((track) => (
                  <Cell
                    key={track.id}
                    onClick={() => setSelectedTrack(track)}
                    style={{ background: 'transparent' }}
                  >
                    <div style={{ width: '100%' }}>
                      <Text weight="2" style={{ color: '#FFFFFF', marginBottom: 4 }}>
                        {formatDate(track.date)}
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>
                        {(track.distance / 1000).toFixed(2)} км &nbsp;·&nbsp;{' '}
                        {formatDuration(track.duration)} &nbsp;·&nbsp; {formatPace(track.pace)}
                      </Text>
                    </div>
                  </Cell>
                ))
              )}
            </Group>

            {/* Кнопка очистки */}
            {tracks.length > 0 && (
              <Group
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  padding: '16px',
                }}
              >
                <Button
                  size="l"
                  stretched
                  mode="secondary"
                  onClick={handleClearAll}
                  style={{
                    width: '100%',
                    background: 'rgba(244, 67, 54, 0.4)',
                    borderRadius: '12px',
                    border: '1px solid rgba(244, 67, 54, 0.6)',
                    color: '#FFFFFF',
                    fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
                    fontSize: '15px',
                    height: '56px',
                  }}
                >
                  Очистить всё
                </Button>
              </Group>
            )}
          </>
        )}

      <Group
        style={{
          background: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          marginTop: '16px',
          padding: '4px 0',
        }}
      >
        <Cell onClick={() => routeNavigator.push('/privacy')} style={{ color: '#FFFFFF' }}>
          <div>
            <Text
              weight="2"
              style={{
                color: '#FFFFFF',
                fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
              }}
            >
              Данные и конфиденциальность
            </Text>
            <Text
              style={{
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '13px',
                fontFamily: 'Oswald, Impact, "Arial Narrow", Arial, sans-serif',
              }}
            >
              Что хранится, резервная копия и удаление
            </Text>
          </div>
        </Cell>
      </Group>

      {/* Метка сборки: сразу видно, какой бандл исполняется на устройстве */}
      <Div style={{ textAlign: 'center', paddingTop: 0, paddingBottom: 4 }}>
        <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 13 }}>
          сборка {getBuildId() || 'dev'}
        </Text>
      </Div>
      </PageBackground>

      {/* Окно «Поделиться пробежкой» */}
      {shareOpen && selectedTrack && (
        <ShareRunModal track={selectedTrack} onClose={() => setShareOpen(false)} />
      )}

      <AppTabbar active="profile" />
    </Panel>
  );
};
export default Profile;
