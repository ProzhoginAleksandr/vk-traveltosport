import { VKUser } from './userUtils';

export const saveCalculation = (user: VKUser | null, type: string, value: string) => {
  if (!user) return;
  const historyKey = `user_history_${user.id}`;
  const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
  history.push({ type, value, date: new Date().toISOString() });
  localStorage.setItem(historyKey, JSON.stringify(history));

  const statsKey = `user_stats_${user.id}`;
  const stats = JSON.parse(localStorage.getItem(statsKey) || '{"totalCalculations":0,"lastCalculation":"—","bestPace":null,"bestVo2":null}');
  stats.totalCalculations += 1;
  stats.lastCalculation = `${type}: ${value}`;
  // можно обновлять лучший темп и VO₂
  localStorage.setItem(statsKey, JSON.stringify(stats));
};