// src/routes.ts
import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
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

export type ViewId = (typeof VIEWS)[keyof typeof VIEWS];

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
  TRACKER:            'tracker',
  TRAINING_IMPORT:    'training_import',
  PROFILE:            'profile',
} as const;

export type PanelId = (typeof PANELS)[keyof typeof PANELS];

/* ------------------------------------------------------------------ */
/*  Lazy-компоненты панелей                                            */
/*  Каждый import() станет отдельным чанком при сборке.                */
/*  Требует export default в каждом файле panels/*.                    */
/* ------------------------------------------------------------------ */

type LazyPanel = LazyExoticComponent<ComponentType<any>>;

export const LAZY_PANELS: Record<PanelId, LazyPanel> = {
  // Калькулятор бегуна
  [PANELS.HOME]:              lazy(() => import('./panels/Home')),
  [PANELS.RUNNER_CALCULATOR]: lazy(() => import('./panels/RunnerCalculator')),
  [PANELS.PACE_CONVERTER]:    lazy(() => import('./panels/PaceConverter')),
  [PANELS.HEART_RATE_ZONES]:  lazy(() => import('./panels/HeartRateZones')),
  [PANELS.RACE_PACE]:         lazy(() => import('./panels/RacePace')),
  [PANELS.VO2_PREDICTOR]:     lazy(() => import('./panels/Vo2Predictor')),

  // Брейнбустер
  [PANELS.BRAIN_BOOSTER]:     lazy(() => import('./panels/BrainBooster')),
  [PANELS.RUNNER_DICTIONARY]: lazy(() => import('./panels/RunnerDictionary')),
  [PANELS.PAIR_GAME]:         lazy(() => import('./panels/games/PairGame')),
  [PANELS.SPLIT_MEMORY_GAME]: lazy(() => import('./panels/games/SplitMemoryGame')),
   [PANELS.DICTIONARY_QUIZ]:   lazy(() => import('./panels/games/DictionaryQuiz')),

  // Дневник — тут самое важное для оптимизации (Tracker тянет Leaflet)
  [PANELS.TRAINING_DIARY]:    lazy(() => import('./panels/TrainingDiary')),
  [PANELS.TRACKER]:           lazy(() => import('./panels/Tracker')),
  [PANELS.TRAINING_IMPORT]:   lazy(() => import('./panels/TrainingImport')),
  [PANELS.PROFILE]:           lazy(() => import('./panels/Profile')),
};

/* ------------------------------------------------------------------ */
/*  Какие панели живут в каком View — используется в App.tsx и таббаре */
/* ------------------------------------------------------------------ */

export const VIEW_PANELS: Record<ViewId, PanelId[]> = {
  [VIEWS.RUNNER_CALCULATOR]: [
    PANELS.HOME,
    PANELS.RUNNER_CALCULATOR,
    PANELS.PACE_CONVERTER,
    PANELS.HEART_RATE_ZONES,
    PANELS.RACE_PACE,
    PANELS.VO2_PREDICTOR,
  ],
  [VIEWS.BRAINBOOSTER]: [
    PANELS.BRAIN_BOOSTER,
    PANELS.RUNNER_DICTIONARY,
    PANELS.PAIR_GAME,
    PANELS.SPLIT_MEMORY_GAME,
    PANELS.DICTIONARY_QUIZ,
  ],
  [VIEWS.DIARY]: [
    PANELS.TRAINING_DIARY,
    PANELS.TRACKER,
    PANELS.TRAINING_IMPORT,
    PANELS.PROFILE,
  ],
};

export const DEFAULT_VIEW_PANELS: Record<ViewId, PanelId> = {
  [VIEWS.RUNNER_CALCULATOR]: PANELS.HOME,
  [VIEWS.BRAINBOOSTER]:      PANELS.BRAIN_BOOSTER,
  [VIEWS.DIARY]:             PANELS.TRAINING_DIARY,
};

/* ------------------------------------------------------------------ */
/*  Конфиг роутера — URL как источник истины для view/panel            */
/*  element не задаём: рендер делает App.tsx через LAZY_PANELS.        */
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
  { path: `/${PANELS.TRACKER}`,         view: VIEWS.DIARY, panel: PANELS.TRACKER },
  { path: `/${PANELS.TRAINING_IMPORT}`, view: VIEWS.DIARY, panel: PANELS.TRAINING_IMPORT },
  { path: `/${PANELS.PROFILE}`,         view: VIEWS.DIARY, panel: PANELS.PROFILE },
];

export const router = createHashRouter(routes);