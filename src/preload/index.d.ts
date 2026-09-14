import type { DiwanApi } from '@shared/api';

declare global {
  interface Window {
    diwan: DiwanApi;
  }
}

export {};
