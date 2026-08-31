import type { LoopSeedApi } from '../shared/contracts';

declare global {
  interface Window {
    loopseed: LoopSeedApi;
  }
}

export {};
