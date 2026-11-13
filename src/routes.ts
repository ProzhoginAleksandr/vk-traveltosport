// src/routes.ts
import {
  createHashRouter,
  type RouteWithoutRoot,
} from '@vkontakte/vk-mini-apps-router';

/* ------------------------------------------------------------------ */
/*  View-и (Epic stories / разделы нижнего таббара)                    */
/* ------------------------------------------------------------------ */

export const VIEWS = {
  RUNNER_CALCULATOR: 'runnerCalculatorView',
  BRAINBOOSTER:      'brainBoosterView',
  DIARY:             'diaryView',
} as const;

/* ------------------------------------------------------------------ */
/*  Панели                                                             */
/* ------------------------------------------------------------------ */

export const PANELS = {
  // --- Калькулятор бегуна ---
  HOME:               'home',
  RUNNER_CALCULATOR:  'runner_calculator',
  PACE_CONVERTER:     'pace_converter',
  HEART_RATE_ZONES:   'heart_rate_zones',
  RACE_PACE:          'race_pace',
  VO2_PREDICTOR:      'vo2_predictor',

  // --- Брейнбустер ---
  BRAIN_BOOSTER:      'brain_booster',
  RUNNER_DICTIONARY:  'runner_dictionary',
  PAIR_GAME:          'pair_game',
  SPLIT_MEMORY_GAME:  'split_memory_game',
  DICTIONARY_QUIZ:    'dictionary_quiz',

  // --- Дневник тренировок ---
  TRAINING_DIARY:     'training_diary',
  RACE_PLAN:          'race_plan',
  TRACKER:            'tracker',
  TRAINING_IMPORT:    'training_import',
  PROFILE:            'profile',
} as const;

/* ------------------------------------------------------------------ */
/*  Конфиг роутера — URL как источник истины для view/panel            */
/*  element не задаём: нужный компонент рендерит App.tsx по PANELS.    */
/* ------------------------------------------------------------------ */

const routes: RouteWithoutRoot[] = [
  // Калькулятор бегуна
  { path: '/',                       view: VIEWS.RUNNER_CALCULATOR, panel: PANELS.HOME },
  { path: `/${PANELS.RUNNER_CALCULATOR}`, view: VIEWS.RUNNER_CALCULATOR, panel: PANELS.RUNNER_CALCULATOR },
  { path: `/${PANELS.PACE_CONVERTER}`,    view: VIEWS.RUNNER_CALCULATOR, panel: PANELS.PACE_CONVERTER },
  { path: `/${PANELS.HEART_RATE_ZONES}`,  view: VIEWS.RUNNER_CALCULATOR, panel: PANELS.HEART_RATE_ZONES },
  { path: `/${PANELS.RACE_PACE}`,         view: VIEWS.RUNNER_CALCULATOR, panel: PANELS.RACE_PACE },
  { path: `/${PANELS.VO2_PREDICTOR}`,     view: VIEWS.RUNNER_CALCULATOR, panel: PANELS.VO2_PREDICTOR },

  // Брейнбустер
  { path: `/${PANELS.BRAIN_BOOSTER}`,     view: VIEWS.BRAINBOOSTER, panel: PANELS.BRAIN_BOOSTER },
  { path: `/${PANELS.RUNNER_DICTIONARY}`, view: VIEWS.BRAINBOOSTER, panel: PANELS.RUNNER_DICTIONARY },
  { path: `/${PANELS.PAIR_GAME}`,         view: VIEWS.BRAINBOOSTER, panel: PANELS.PAIR_GAME },
  { path: `/${PANELS.SPLIT_MEMORY_GAME}`, view: VIEWS.BRAINBOOSTER, panel: PANELS.SPLIT_MEMORY_GAME },
  { path: `/${PANELS.DICTIONARY_QUIZ}`,   view: VIEWS.BRAINBOOSTER, panel: PANELS.DICTIONARY_QUIZ },

  // Дневник тренировок
  { path: `/${PANELS.TRAINING_DIARY}`,  view: VIEWS.DIARY, panel: PANELS.TRAINING_DIARY },
  { path: `/${PANELS.RACE_PLAN}`,       view: VIEWS.DIARY, panel: PANELS.RACE_PLAN },
  { path: `/${PANELS.TRACKER}`,         view: VIEWS.DIARY, panel: PANELS.TRACKER },
  { path: `/${PANELS.TRAINING_IMPORT}`, view: VIEWS.DIARY, panel: PANELS.TRAINING_IMPORT },
  { path: `/${PANELS.PROFILE}`,         view: VIEWS.DIARY, panel: PANELS.PROFILE },
];

export const router = createHashRouter(routes);
