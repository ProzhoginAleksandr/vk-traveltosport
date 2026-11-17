// src/hooks/useClubStats.ts
// Сводка клубного пробега: сразу отдаём кэш, затем синхронизируем свой вклад
// и забираем свежие суммы.
import { useEffect, useState } from 'react';

import { CLUB_ENABLED } from '../config/club';
import {
  getCachedClubStats,
  getOwnMonthKm,
  syncClubContribution,
  type ClubStats,
} from '../utils/club';

export interface ClubView {
  stats: ClubStats | null;
  ownKm: number | null;
  loading: boolean;
  refresh: () => void;
}

export const useClubStats = (): ClubView => {
  const [stats, setStats] = useState<ClubStats | null>(() => getCachedClubStats());
  const [ownKm, setOwnKm] = useState<number | null>(null);
  const [loading, setLoading] = useState(CLUB_ENABLED);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!CLUB_ENABLED) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void (async () => {
      const own = await getOwnMonthKm();
      if (active) setOwnKm(own);
      const fresh = await syncClubContribution();
      if (active) {
        if (fresh) setStats(fresh);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [tick]);

  return {
    stats,
    ownKm,
    loading,
    refresh: () => setTick((value) => value + 1),
  };
};
