import { View, SplitLayout, SplitCol } from '@vkontakte/vkui';
import { useActiveVkuiLocation } from '@vkontakte/vk-mini-apps-router';
import {
  Home,
  RunnerCalculator,
  PaceConverter,
  HeartRateZones,
  RacePace,
  Vo2Predictor,
  BrainBooster,
  RunnerDictionary,
  PairGame,
  TrainingDiary,
  RacePlan,
  Tracker,
  TrainingImport,
  Profile,
  Privacy,
  SplitMemoryGame,
  DictionaryQuiz,
} from './panels';
import { PANELS } from './routes';

export const App = () => {
  const { panel: activePanel = PANELS.HOME } = useActiveVkuiLocation();

  return (
    <SplitLayout>
      <SplitCol>
        <View activePanel={activePanel}>
          {/* Калькулятор бегуна */}
          <Home id={PANELS.HOME} />
          <RunnerCalculator id={PANELS.RUNNER_CALCULATOR} />
          <PaceConverter id={PANELS.PACE_CONVERTER} />
          <HeartRateZones id={PANELS.HEART_RATE_ZONES} />
          <RacePace id={PANELS.RACE_PACE} />
          <Vo2Predictor id={PANELS.VO2_PREDICTOR} />

          {/* Брейнбустер */}
          <BrainBooster id={PANELS.BRAIN_BOOSTER} />
          <RunnerDictionary id={PANELS.RUNNER_DICTIONARY} />
          <PairGame id={PANELS.PAIR_GAME} />
          <SplitMemoryGame id={PANELS.SPLIT_MEMORY_GAME} />
          <DictionaryQuiz id={PANELS.DICTIONARY_QUIZ} />

          {/* Дневник тренировок */}
          <TrainingDiary id={PANELS.TRAINING_DIARY} />
          <RacePlan id={PANELS.RACE_PLAN} />
          <Tracker id={PANELS.TRACKER} />
          <TrainingImport id={PANELS.TRAINING_IMPORT} />
          <Profile id={PANELS.PROFILE} />
          <Privacy id={PANELS.PRIVACY} />
        </View>
      </SplitCol>
    </SplitLayout>
  );
};