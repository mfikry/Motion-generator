import { create } from 'zustand';

export interface RenderSettingsState {
  timeAnim: number;
  noText: boolean;
  backgroundAnimations: boolean;
  greenScreen: boolean;
  introOutro: boolean;
  rulesLevel: 'simple' | 'high' | 'expert';
  easingPreset: string;
  colorsBg: string;

  // Actions
  setTimeAnim: (sec: number) => void;
  toggleNoText: () => void;
  toggleBackgroundAnimations: () => void;
  toggleGreenScreen: () => void;
  setGreenScreen: (val: boolean) => void;
  setBackgroundAnimations: (val: boolean) => void;
  setIntroOutro: (val: boolean) => void;
  setRulesLevel: (level: 'simple' | 'high' | 'expert') => void;
  setEasingPreset: (preset: string) => void;
  setColorsBg: (color: string) => void;
}

export const useRenderSettingsStore = create<RenderSettingsState>((set) => ({
  timeAnim: 15,
  noText: true,
  backgroundAnimations: true,
  greenScreen: false,
  introOutro: false,
  rulesLevel: 'high',
  easingPreset: 'Cubic Ease',
  colorsBg: '#000000',

  setTimeAnim: (timeAnim) => set({ timeAnim }),
  toggleNoText: () => set((s) => ({ noText: !s.noText })),
  toggleBackgroundAnimations: () => set((s) => ({ backgroundAnimations: !s.backgroundAnimations })),
  toggleGreenScreen: () => set((s) => ({ greenScreen: !s.greenScreen })),
  setGreenScreen: (greenScreen) => set({ greenScreen }),
  setBackgroundAnimations: (backgroundAnimations) => set({ backgroundAnimations }),
  setIntroOutro: (introOutro) => set({ introOutro }),
  setRulesLevel: (rulesLevel) => set({ rulesLevel }),
  setEasingPreset: (easingPreset) => set({ easingPreset }),
  setColorsBg: (colorsBg) => set({ colorsBg }),
}));
