// src/components/BackButton.tsx
// Единая кнопка «Назад» для всех разделов, кроме главной.
// Ведёт на уровень выше: из инструмента — в его раздел, из раздела — на главную.
import { Icon24ChevronLeft } from '@vkontakte/icons';
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router';

import { COLORS, RADIUS, SPACING } from '../styles/tokens';

interface BackButtonProps {
  /** Куда вернуться. По умолчанию — главная */
  to?: string;
}

export const BackButton = ({ to = '/' }: BackButtonProps) => {
  const routeNavigator = useRouteNavigator();

  return (
    <div style={{ display: 'flex', alignItems: 'center', paddingTop: SPACING.md }}>
      <button
        type="button"
        aria-label="Назад"
        onClick={() => routeNavigator.push(to)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 44,
          height: 44,
          borderRadius: RADIUS.md,
          border: `1px solid ${COLORS.border}`,
          background: COLORS.surface,
          color: COLORS.text,
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <Icon24ChevronLeft />
      </button>
    </div>
  );
};

export default BackButton;
