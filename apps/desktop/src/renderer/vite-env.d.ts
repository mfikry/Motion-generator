/// <reference types="vite/client" />

interface Window {
  __sandboxedValidator?: {
    validate: (code: string) => Promise<{ valid: boolean; errors?: string[] }>;
  };
}
