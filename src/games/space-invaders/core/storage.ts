import { HI_SCORE_KEY } from '../config';

export function loadHiScore(): number {
  try {
    return Number(localStorage.getItem(HI_SCORE_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function saveHiScore(value: number): void {
  try {
    localStorage.setItem(HI_SCORE_KEY, String(value));
  } catch {
    // storage unavailable (private mode, etc.)
  }
}
