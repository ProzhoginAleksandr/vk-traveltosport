// src/components/racePlan/ui.ts
// Общие стили блока «План до старта»: те же карточки, что и на остальных
// экранах приложения, чтобы раздел не выбивался из оформления.

import type { CSSProperties } from 'react';
import { COLORS, FONT_SIZE, LINE_HEIGHT, RADIUS, SPACING } from '../../styles/tokens';

export const FONT = 'Oswald, Impact, "Arial Narrow", Arial, sans-serif';

export const cardStyle: CSSProperties = {
  background: COLORS.surface,
  border: `1px solid ${COLORS.border}`,
  borderRadius: RADIUS.lg,
  padding: SPACING.lg,
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
  boxSizing: 'border-box',
};

export const chipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  borderRadius: RADIUS.sm,
  background: COLORS.surfaceStrong,
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  fontSize: FONT_SIZE.caption,
  lineHeight: LINE_HEIGHT.caption,
  whiteSpace: 'nowrap',
};

export const captionStyle: CSSProperties = {
  color: COLORS.textSecondary,
  fontSize: FONT_SIZE.caption,
  lineHeight: LINE_HEIGHT.caption,
};

export const sectionTitleStyle: CSSProperties = {
  color: COLORS.text,
  fontSize: FONT_SIZE.subtitleSmall,
  lineHeight: LINE_HEIGHT.title,
  margin: `${SPACING.xxl}px 0 ${SPACING.md}px`,
};

export const mutedButtonStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: COLORS.textSecondary,
  fontFamily: FONT,
  fontSize: FONT_SIZE.body,
  padding: `${SPACING.sm}px 0`,
  cursor: 'pointer',
};

/** Пунктирная кнопка выбора: цель, уровень, дни недели */
export const choiceStyle = (selected: boolean): CSSProperties => ({
  flex: '1 1 auto',
  minWidth: 76,
  padding: '10px 12px',
  borderRadius: RADIUS.md,
  border: `1px solid ${selected ? COLORS.accent : COLORS.border}`,
  background: selected ? 'rgba(76, 175, 80, 0.16)' : COLORS.surface,
  color: COLORS.text,
  fontFamily: FONT,
  fontSize: FONT_SIZE.body,
  lineHeight: LINE_HEIGHT.body,
  cursor: 'pointer',
  transition: 'border-color 120ms ease, background 120ms ease',
});

export const fieldStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 14px',
  borderRadius: RADIUS.md,
  border: `1px solid ${COLORS.borderStrong}`,
  background: 'rgba(0, 0, 0, 0.35)',
  color: COLORS.text,
  fontFamily: FONT,
  fontSize: FONT_SIZE.subtitleSmall,
  lineHeight: LINE_HEIGHT.title,
  colorScheme: 'dark',
};
