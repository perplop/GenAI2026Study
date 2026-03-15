/**
 * Simple module-level store for the current user ID.
 * All localStorage utilities use this to namespace their keys per user.
 */

let currentUserId: string = '_guest';

export function setCurrentUserId(id: string): void {
  currentUserId = id || '_guest';
}

export function getCurrentUserId(): string {
  return currentUserId;
}

/** Returns a localStorage key prefixed with the current user ID. */
export function userKey(key: string): string {
  return `${currentUserId}:${key}`;
}
