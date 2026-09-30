import { create } from 'zustand';
import type {
  ThinkingLevel,
  MotionBlueprint,
  GenerationRecord,
  GenerateTextSettings,
} from '@genc/shared-types';

interface GenerationStoreState {
  mode: 'text' | 'image';
  prompt: string;
  selectedModel: string;
  customModel: string;
  thinkingLevel: ThinkingLevel;
  variations: number;
  batchSize: number;
  isGenerating: boolean;
  statusMessage: string | null;
  error: string | null;
  retriesUsed: number;
  currentBlueprint: MotionBlueprint | null;
  currentCode: string | null;
  generations: GenerationRecord[];

  setMode: (mode: 'text' | 'image') => void;
  setPrompt: (prompt: string) => void;
  setSelectedModel: (model: string) => void;
  setCustomModel: (customModel: string) => void;
  setThinkingLevel: (level: ThinkingLevel) => void;
  setVariations: (variations: number) => void;
  setBatchSize: (batchSize: number) => void;
  setCurrentBlueprint: (blueprint: MotionBlueprint | null) => void;
  setCurrentCode: (code: string | null) => void;
  clearError: () => void;
  generate: (settings?: GenerateTextSettings) => Promise<boolean>;
  loadGenerations: () => Promise<void>;
}

export const useGenerationStore = create<GenerationStoreState>((set, get) => ({
  mode: 'text',
  prompt: '',
  selectedModel: 'Gemi 3.6F',
  customModel: '',
  thinkingLevel: 'high',
  variations: 1,
  batchSize: 1,
  isGenerating: false,
  statusMessage: null,
  error: null,
  retriesUsed: 0,
  currentBlueprint: null,
  currentCode: null,
  generations: [],

  setMode: (mode) => set({ mode }),
  setPrompt: (prompt) => set({ prompt, error: null }),
  setSelectedModel: (selectedModel) => set({ selectedModel }),
  setCustomModel: (customModel) => set({ customModel }),
  setThinkingLevel: (thinkingLevel) => set({ thinkingLevel }),
  setVariations: (variations) => set({ variations }),
  setBatchSize: (batchSize) => set({ batchSize }),
  setCurrentBlueprint: (currentBlueprint) => set({ currentBlueprint }),
  setCurrentCode: (currentCode) => set({ currentCode }),
  clearError: () => set({ error: null }),

  generate: async (settings) => {
    const { prompt, selectedModel, customModel, thinkingLevel, variations, batchSize } = get();

    if (!prompt.trim()) {
      set({ error: 'Silakan masukkan prompt deskripsi motion graphics terlebih dahulu.' });
      return false;
    }

    if (!window.electronAPI) {
      set({ error: 'Electron API tidak tersedia di environment ini.' });
      return false;
    }

    const effectiveModel =
      selectedModel === 'Custom' && customModel.trim() ? customModel.trim() : selectedModel;

    const totalTasks = variations * batchSize;

    set({
      isGenerating: true,
      error: null,
      retriesUsed: 0,
      statusMessage: `Menghasilkan ${totalTasks} task motion graphics via ${effectiveModel}...`,
    });

    try {
      const result = await window.electronAPI.generateText({
        prompt: prompt.trim(),
        model: effectiveModel,
        thinkingLevel,
        variations,
        batchSize,
        settings,
      });

      const hasCodes = result.codes && result.codes.length > 0;
      const hasBlueprints = result.blueprints && result.blueprints.length > 0;

      if (result.success && (hasCodes || hasBlueprints)) {
        const codes = result.codes;
        const lastCode = codes && codes.length > 0 ? codes[codes.length - 1] ?? null : null;
        const lastBlueprint = hasBlueprints ? result.blueprints[result.blueprints.length - 1] ?? null : null;

        set({
          isGenerating: false,
          currentCode: lastCode,
          currentBlueprint: lastBlueprint,
          retriesUsed: result.retriesUsed ?? 0,
          statusMessage: `Selesai! ${result.completedTasks}/${result.totalTasks} motion graphics berhasil dihasilkan.${
            result.retriesUsed ? ` (${result.retriesUsed}x koreksi otomatis)` : ''
          }`,
        });
        get().loadGenerations();
        return true;
      } else {
        set({
          isGenerating: false,
          error: result.error ?? 'Gagal menghasilkan Canvas2D code dari AI.',
          statusMessage: null,
        });
        return false;
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      set({
        isGenerating: false,
        error: errorMsg,
        statusMessage: null,
      });
      return false;
    }
  },

  loadGenerations: async () => {
    try {
      if (!window.electronAPI) return;
      const history = await window.electronAPI.getGenerations(30);
      set({ generations: history });
    } catch {
      // ignore
    }
  },
}));
