/**
 * API client for MongoDB-backed user data.
 * Falls back to localStorage for guest mode or when the auth server is down.
 */
import { getCurrentUserId, userKey } from './userContext';

const AUTH_API = 'http://localhost:4000/api/data';

function isGuest(): boolean {
  const id = getCurrentUserId();
  return !id || id === 'guest' || id === '_guest';
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${AUTH_API}${path}`, { ...opts, headers: { ...authHeaders(), ...opts?.headers } });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// ── Helpers for localStorage fallback ─────────────────────────────────────

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(userKey(key));
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function lsSet(key: string, value: unknown): void {
  try { localStorage.setItem(userKey(key), JSON.stringify(value)); } catch { /* ignore */ }
}

// ── Study Plans ───────────────────────────────────────────────────────────

export interface SavedStudyPlanData {
  id: string;
  bookTitle: string;
  createdAt: string;
  numDays: number;
  totalSections: number;
  days: unknown[];
  pdfFileName?: string;
}

export async function fetchPlans(): Promise<SavedStudyPlanData[]> {
  if (isGuest()) return lsGet('study-plans', []);
  try {
    const plans = await apiFetch<SavedStudyPlanData[]>('/plans');
    lsSet('study-plans', plans); // write-through cache
    return plans;
  } catch {
    return lsGet('study-plans', []);
  }
}

export async function upsertPlan(plan: SavedStudyPlanData): Promise<void> {
  // Always write localStorage (cache)
  const local: SavedStudyPlanData[] = lsGet('study-plans', []);
  const idx = local.findIndex(p => p.id === plan.id);
  if (idx >= 0) local[idx] = plan; else local.push(plan);
  lsSet('study-plans', local);

  if (isGuest()) return;
  try {
    await apiFetch(`/plans/${plan.id}`, { method: 'PUT', body: JSON.stringify(plan) });
  } catch { /* localStorage already updated */ }
}

export async function removePlan(planId: string): Promise<void> {
  const local: SavedStudyPlanData[] = lsGet('study-plans', []);
  lsSet('study-plans', local.filter(p => p.id !== planId));

  if (isGuest()) return;
  try {
    await apiFetch(`/plans/${planId}`, { method: 'DELETE' });
  } catch { /* localStorage already updated */ }
}

// ── Study Progress ────────────────────────────────────────────────────────

export interface ProgressData { planId: string; dayIndex: number }

export async function fetchProgress(): Promise<ProgressData | null> {
  if (isGuest()) return lsGet<ProgressData | null>('study-progress', null);
  try {
    const data = await apiFetch<ProgressData | null>('/progress');
    if (data) lsSet('study-progress', data);
    return data;
  } catch {
    return lsGet<ProgressData | null>('study-progress', null);
  }
}

export async function updateProgress(progress: ProgressData): Promise<void> {
  lsSet('study-progress', progress);
  if (isGuest()) return;
  try {
    await apiFetch('/progress', { method: 'PUT', body: JSON.stringify(progress) });
  } catch { /* localStorage already updated */ }
}

// ── Activities ────────────────────────────────────────────────────────────

export interface ActivityData {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
}

export async function fetchActivities(): Promise<ActivityData[]> {
  if (isGuest()) return lsGet('activities', []);
  try {
    const data = await apiFetch<ActivityData[]>('/activities');
    lsSet('activities', data);
    return data;
  } catch {
    return lsGet('activities', []);
  }
}

export async function createActivity(activity: ActivityData): Promise<void> {
  // Write-through localStorage
  const local: ActivityData[] = lsGet('activities', []);
  local.unshift(activity);
  if (local.length > 50) local.length = 50;
  lsSet('activities', local);

  if (isGuest()) return;
  try {
    await apiFetch('/activities', { method: 'POST', body: JSON.stringify(activity) });
  } catch { /* localStorage already updated */ }
}

// ── Quiz Scores ───────────────────────────────────────────────────────────

export interface QuizScoreData {
  planId: string;
  sectionTitle: string;
  correct: number;
  total: number;
  timestamp: string;
}

export async function fetchQuizScores(): Promise<QuizScoreData[]> {
  if (isGuest()) return lsGet('quiz-scores', []);
  try {
    const data = await apiFetch<QuizScoreData[]>('/quiz-scores');
    lsSet('quiz-scores', data);
    return data;
  } catch {
    return lsGet('quiz-scores', []);
  }
}

export async function createQuizScore(score: QuizScoreData): Promise<void> {
  const local: QuizScoreData[] = lsGet('quiz-scores', []);
  local.unshift(score);
  if (local.length > 100) local.length = 100;
  lsSet('quiz-scores', local);

  if (isGuest()) return;
  try {
    await apiFetch('/quiz-scores', { method: 'POST', body: JSON.stringify(score) });
  } catch { /* localStorage already updated */ }
}

// ── Streak ────────────────────────────────────────────────────────────────

export interface StreakData { currentStreak: number; lastPracticeDate: string }

export async function fetchStreak(): Promise<StreakData> {
  if (isGuest()) return lsGet('practice-streak', { currentStreak: 0, lastPracticeDate: '' });
  try {
    const data = await apiFetch<StreakData>('/streak');
    lsSet('practice-streak', data);
    return data;
  } catch {
    return lsGet('practice-streak', { currentStreak: 0, lastPracticeDate: '' });
  }
}

export async function updateStreak(data: StreakData): Promise<void> {
  lsSet('practice-streak', data);
  if (isGuest()) return;
  try {
    await apiFetch('/streak', { method: 'PUT', body: JSON.stringify(data) });
  } catch { /* localStorage already updated */ }
}

// ── Daily Goal ────────────────────────────────────────────────────────────

export interface DailyGoalData { targetHours: number; studiedMinutes: number; date: string }

export async function fetchDailyGoal(): Promise<DailyGoalData> {
  const today = new Date().toISOString().slice(0, 10);
  if (isGuest()) {
    const d = lsGet<DailyGoalData>('daily-goal', { targetHours: 2, studiedMinutes: 0, date: today });
    return d.date === today ? d : { targetHours: d.targetHours, studiedMinutes: 0, date: today };
  }
  try {
    const d = await apiFetch<DailyGoalData>('/daily-goal');
    const result = d.date === today ? d : { targetHours: d.targetHours || 2, studiedMinutes: 0, date: today };
    lsSet('daily-goal', result);
    return result;
  } catch {
    const d = lsGet<DailyGoalData>('daily-goal', { targetHours: 2, studiedMinutes: 0, date: today });
    return d.date === today ? d : { targetHours: d.targetHours, studiedMinutes: 0, date: today };
  }
}

export async function updateDailyGoal(data: DailyGoalData): Promise<void> {
  lsSet('daily-goal', data);
  if (isGuest()) return;
  try {
    await apiFetch('/daily-goal', { method: 'PUT', body: JSON.stringify(data) });
  } catch { /* localStorage already updated */ }
}
