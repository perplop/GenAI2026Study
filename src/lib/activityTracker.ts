/** Lightweight activity tracker — backed by API for logged-in users, localStorage for guests. */
import {
  fetchActivities, createActivity,
  fetchQuizScores, createQuizScore,
  fetchStreak, updateStreak,
  fetchDailyGoal, updateDailyGoal,
  type ActivityData, type QuizScoreData, type StreakData, type DailyGoalData,
} from './apiClient';

// Re-export types under the names the rest of the app uses
export type TrackedActivity = ActivityData;
export type QuizScore = QuizScoreData;
export { type DailyGoalData };

export async function logActivity(
  type: TrackedActivity['type'],
  title: string,
  description: string
): Promise<TrackedActivity> {
  const activity: TrackedActivity = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    type,
    title,
    description,
    timestamp: new Date().toISOString(),
  };
  await createActivity(activity);
  return activity;
}

export async function loadActivities(): Promise<TrackedActivity[]> {
  return fetchActivities();
}

/** Human-friendly relative time string. */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

// ── Streak tracking ────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function getStreak(): Promise<number> {
  const data = await fetchStreak();
  if (data.lastPracticeDate === todayStr() || data.lastPracticeDate === yesterdayStr()) {
    return data.currentStreak;
  }
  return 0;
}

export async function recordPracticeDay(): Promise<number> {
  const today = todayStr();
  const data = await fetchStreak();
  if (data.lastPracticeDate === today) return data.currentStreak;
  let newStreak: number;
  if (data.lastPracticeDate === yesterdayStr()) {
    newStreak = data.currentStreak + 1;
  } else {
    newStreak = 1;
  }
  const updated: StreakData = { currentStreak: newStreak, lastPracticeDate: today };
  await updateStreak(updated);
  return newStreak;
}

// ── Quiz score tracking ────────────────────────────────────────────────────

export async function saveQuizScore(score: QuizScore): Promise<void> {
  return createQuizScore(score);
}

export async function loadQuizScores(): Promise<QuizScore[]> {
  return fetchQuizScores();
}

// ── Daily study goal ───────────────────────────────────────────────────────

export async function getDailyGoal(): Promise<DailyGoalData> {
  return fetchDailyGoal();
}

export async function setDailyGoalTarget(hours: number): Promise<void> {
  const data = await fetchDailyGoal();
  await updateDailyGoal({ ...data, targetHours: hours, date: todayStr() });
}

export async function addStudiedMinutes(mins: number): Promise<void> {
  const data = await fetchDailyGoal();
  await updateDailyGoal({ ...data, studiedMinutes: data.studiedMinutes + mins, date: todayStr() });
}
