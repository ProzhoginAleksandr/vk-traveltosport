// src/components/AppTabbar.tsx
import { FixedLayout, Tabbar, TabbarItem } from '@vkontakte/vkui';
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router';

import homeIcon from '../assets/images/HomeIcon.png';
import calcIcon from '../assets/images/CalculatorIcon.png';
import brainIcon from '../assets/images/BrainBoosterIcon.png';
import diaryIcon from '../assets/images/DiaryIcon.png';
import profileIcon from '../assets/images/ProfileIcon.png';

import { showAdAndNavigate } from '../utils/adUtils';

type ActiveTab = 'home' | 'calculator' | 'brainbooster' | 'diary' | 'profile';

interface AppTabbarProps {
  active: ActiveTab;
}

export const AppTabbar = ({ active }: AppTabbarProps) => {
  const routeNavigator = useRouteNavigator();

  const handleTab = (targetPath: string, targetTab: ActiveTab) => {
    if (active === targetTab) return;
    showAdAndNavigate(targetPath, routeNavigator);
  };

  return (
    <FixedLayout vertical="bottom">
      <Tabbar
        style={{
          padding: '12px 0px',
          background: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(12px)',
          boxShadow: 'none',
          borderTop: 'none',
        }}
      >
        <TabbarItem
          onClick={() => handleTab('/', 'home')}
          label="Главная"
          selected={active === 'home'}
        >
          <img src={homeIcon} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
        </TabbarItem>

        <TabbarItem
          onClick={() => handleTab('/runner_calculator', 'calculator')}
          label="Калькулятор"
          selected={active === 'calculator'}
        >
          <img src={calcIcon} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
        </TabbarItem>

        <TabbarItem
          onClick={() => handleTab('/brain_booster', 'brainbooster')}
          label="Брейнбустер"
          selected={active === 'brainbooster'}
        >
          <img src={brainIcon} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
        </TabbarItem>

        <TabbarItem
          onClick={() => handleTab('/training_diary', 'diary')}
          label="Дневник"
          selected={active === 'diary'}
        >
          <img src={diaryIcon} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
        </TabbarItem>

        <TabbarItem
          onClick={() => handleTab('/profile', 'profile')}
          label="Профиль"
          selected={active === 'profile'}
        >
          <img src={profileIcon} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
        </TabbarItem>
      </Tabbar>
    </FixedLayout>
  );
};