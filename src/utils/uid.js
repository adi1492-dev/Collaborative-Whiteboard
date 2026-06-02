/**
 * Utility for generating fast, pseudo-random unique IDs.
 * Combines timestamp with random string for collision resistance.
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}
