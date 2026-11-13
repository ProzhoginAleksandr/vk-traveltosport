// src/panels/RacePlan.tsx
// Экран «Программа подготовки»: онбординг с нуля и сам план с отметками.
// План хранится на устройстве, поэтому экран не делает сетевых запросов.

import { useState } from 'react';
import { Panel, Text } from '@vkontakte/vkui';
import { Icon24ChevronLeft } from '@vkontakte/icons';
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router';

import { AppTabbar } from '../components/AppTabbar';
import { PageBackground } from '../components/PageBackground';
import { PlanOnboarding } from '../components/racePlan/PlanOnboarding';
import { PlanOverview } from '../components/racePlan/PlanOverview';
import { FONT } from '../components/racePlan/ui';
import {
  clearPlanState,
  createPlanState,
  loadPlanState,
  savePlanState,
  type PlanState,
} from '../utils/planStorage';
import type { PlanInput } from '../utils/racePlan';
import { COLORS, FONT_SIZE, LINE_HEIGHT, RADIUS, SPACING } from '../styles/tokens';

interface RacePlanProps {
  id: string;
}

export const RacePlan = ({ id }: RacePlanProps) => {
  const routeNavigator = useRouteNavigator();
  const [state, setState] = useState<PlanState | null>(() => loadPlanState());
  const [editing, setEditing] = useState(false);

  const handleCreate = (input: PlanInput) => {
    const next = createPlanState(input);
    savePlanState(next);
    setState(next);
    setEditing(false);
  };

  const handleChange = (next: PlanState) => {
    savePlanState(next);
    setState(next);
  };

  const handleDelete = () => {
    clearPlanState();
    setState(null);
    setEditing(false);
  };

  const handleBack = () => {
    if (editing) {
      setEditing(false);
      return;
    }
    routeNavigator.push('/');
  };

  return (
    <Panel id={id} style={{ background: 'transparent', padding: 0 }}>
      <PageBackground variant="violet" pattern="track" paddingBottom={96} style={{ fontFamily: FONT }}>
        {/* Header раздела появится позже: изображение встанет над строкой с кнопкой «Назад» */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.sm,
            paddingTop: 20,
            marginBottom: SPACING.lg,
          }}
        >
          <button
            type="button"
            aria-label="Назад"
            onClick={handleBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: RADIUS.md,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.surface,
              color: COLORS.text,
              cursor: 'pointer',
            }}
          >
            <Icon24ChevronLeft />
          </button>
          <Text
            style={{
              color: COLORS.text,
              fontSize: FONT_SIZE.title,
              lineHeight: LINE_HEIGHT.title,
              fontStyle: 'italic',
            }}
          >
            Программа подготовки
          </Text>
        </div>

        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          {state && !editing ? (
            <PlanOverview
              state={state}
              onChange={handleChange}
              onEdit={() => setEditing(true)}
              onDelete={handleDelete}
            />
          ) : (
            <PlanOnboarding
              initial={state?.input}
              onSubmit={handleCreate}
              onCancel={() => (state ? setEditing(false) : routeNavigator.push('/'))}
            />
          )}
        </div>
      </PageBackground>

      <AppTabbar active="diary" />
    </Panel>
  );
};

export default RacePlan;
