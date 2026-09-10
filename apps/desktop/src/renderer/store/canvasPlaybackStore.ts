import { create } from 'zustand';
import type { MotionPreviewRenderer } from '../canvas/pixi-renderer';

export interface CanvasPlaybackState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  fps: number;
  rendererInstance: MotionPreviewRenderer | null;

  // Actions
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setFps: (fps: number) => void;
  setRendererInstance: (renderer: MotionPreviewRenderer | null) => void;

  play: () => void;
  pause: () => void;
  seek: (t: number) => void;
  reset: () => void;
}

export const useCanvasPlaybackStore = create<CanvasPlaybackState>((set, get) => ({
  currentTime: 0,
  duration: 15,
  isPlaying: false,
  fps: 60,
  rendererInstance: null,

  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setFps: (fps) => set({ fps }),
  setRendererInstance: (rendererInstance) => set({ rendererInstance }),

  play: () => {
    const { rendererInstance } = get();
    if (rendererInstance) {
      rendererInstance.play();
    }
  },

  pause: () => {
    const { rendererInstance } = get();
    if (rendererInstance) {
      rendererInstance.pause();
    }
  },

  seek: (t: number) => {
    const { rendererInstance } = get();
    if (rendererInstance) {
      rendererInstance.seek(t);
      set({ currentTime: t });
    }
  },

  reset: () => {
    const { rendererInstance } = get();
    if (rendererInstance) {
      rendererInstance.reset();
      set({ currentTime: 0, isPlaying: false });
    }
  },
}));
