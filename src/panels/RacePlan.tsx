// src/panels/RacePlan.tsx
// Экран «Программа подготовки»: онбординг с нуля и сам план с отметками.
// План хранится на устройстве, поэтому экран не делает сетевых запросов.

import { useState } from 'react';
import { Panel } from '@vkontakte/vkui';
import { Icon24ChevronLeft } from '@vkontakte/icons';
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router';

import racePlanHeaderImage from '../assets/images/RacePlanHeader.webp';
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
import { buildRacePlan } from '../utils/racePlan';
import { track } from '../utils/analytics';
import { COLORS, RADIUS, SPACING } from '../styles/tokens';

interface RacePlanProps {
  id: string;
}

export const RacePlan = ({ id }: RacePlanProps) => {
  const routeNavigator = useRouteNavigator();
  const [state, setState] = useState<PlanState | null>(() => loadPlanState());
  const [editing, setEditing] = useState(false);

  const handleCreate = (input: PlanInput) => {
    const plan = buildRacePlan(input);
    track('plan_created', {
      goal_km: input.goalKm,
      level: input.level,
      days: input.daysPerWeek,
      weeks: plan.weeksTotal,
      has_result: input.recentResult ? 1 : 0,
      target_source: plan.paces.goalSource,
      planned_gain_pct: Math.round(plan.paces.gainRatio * 1000) / 10,
    });
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
    track('plan_deleted');
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
        {/* Кнопка «Назад» */}
        <div style={{ paddingTop: 12, display: 'flex', alignItems: 'center' }}>
          <button
            type="button"
            aria-label="Назад"
            onClick={handleBack}
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
            }}
          >
            <Icon24ChevronLeft />
          </button>
        </div>

        {/* Header раздела */}
        <div
          style={{
            paddingTop: 4,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            marginBottom: SPACING.md,
          }}
        >
          <img
            src={racePlanHeaderImage}
            alt="Программа подготовки"
            style={{ width: '100%', maxWidth: '380px', height: 'auto', objectFit: 'contain' }}
          />
        </div>

        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          {state && !editing ? (
            <PlanOverview
              state={state}
              onChange={handleChange}
              onEdit={() => {
                track('plan_edit_opened');
                setEditing(true);
              }}
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
