import { create } from 'zustand';
import type { ApiKeyMetadata, ApiKeyPoolStatus } from '@genc/shared-types';

interface ApiKeyStoreState {
  keys: ApiKeyMetadata[];
  poolStatus: ApiKeyPoolStatus;
  isModalOpen: boolean;
  isLoading: boolean;
  isValidating: boolean;
  error: string | null;

  openModal: () => void;
  closeModal: () => void;
  clearError: () => void;
  loadKeys: () => Promise<void>;
  addKey: (key: string, label: string) => Promise<{ success: boolean; error?: string }>;
  removeKey: (id: string) => Promise<{ success: boolean; error?: string }>;
  validateKey: (id: string) => Promise<void>;
  validateAllKeys: () => Promise<void>;
}

export const useApiKeyStore = create<ApiKeyStoreState>((set, get) => ({
  keys: [],
  poolStatus: { total: 0, valid: 0, rateLimited: 0, invalid: 0 },
  isModalOpen: false,
  isLoading: false,
  isValidating: false,
  error: null,

  openModal: () => {
    set({ isModalOpen: true, error: null });
    get().loadKeys();
  },

  closeModal: () => {
    set({ isModalOpen: false, error: null });
  },

  clearError: () => {
    set({ error: null });
  },

  loadKeys: async () => {
    try {
      if (!window.electronAPI) return;
      set({ isLoading: true, error: null });
      const [keys, poolStatus] = await Promise.all([
        window.electronAPI.listApiKeys(),
        window.electronAPI.getApiKeyPoolStatus(),
      ]);
      set({ keys, poolStatus, isLoading: false });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      set({ isLoading: false, error: errorMsg });
    }
  },

  addKey: async (key: string, label: string) => {
    try {
      if (!window.electronAPI) {
        return { success: false, error: 'Electron API unavailable' };
      }
      set({ isLoading: true, error: null });
      const result = await window.electronAPI.addApiKey(key, label);
      if (result.success) {
        await get().loadKeys();
        return { success: true };
      } else {
        set({ isLoading: false, error: result.error ?? 'Failed to add key' });
        return { success: false, error: result.error };
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      set({ isLoading: false, error: errorMsg });
      return { success: false, error: errorMsg };
    }
  },

  removeKey: async (id: string) => {
    try {
      if (!window.electronAPI) {
        return { success: false, error: 'Electron API unavailable' };
      }
      const result = await window.electronAPI.removeApiKey(id);
      if (result.success) {
        await get().loadKeys();
        return { success: true };
      } else {
        set({ error: result.error ?? 'Failed to remove key' });
        return { success: false, error: result.error };
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      set({ error: errorMsg });
      return { success: false, error: errorMsg };
    }
  },

  validateKey: async (id: string) => {
    try {
      if (!window.electronAPI) return;
      set({ isValidating: true, error: null });
      await window.electronAPI.validateApiKey(id);
      await get().loadKeys();
      set({ isValidating: false });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      set({ isValidating: false, error: errorMsg });
    }
  },

  validateAllKeys: async () => {
    try {
      if (!window.electronAPI) return;
      set({ isValidating: true, error: null });
      await window.electronAPI.validateAllApiKeys();
      await get().loadKeys();
      set({ isValidating: false });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      set({ isValidating: false, error: errorMsg });
    }
  },
}));
