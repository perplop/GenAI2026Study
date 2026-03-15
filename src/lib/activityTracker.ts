/** Lightweight localStorage-based activity tracker. */
import { userKey } from './userContext';

const MAX_ACTIVITIES = 50;

export interface TrackedActivity {
  id: string;
  type: 'quiz' | 'highlight' | 'flashcard' | 'plan' | 'study' | 'practice';
  title: string;
  description: string;
  timestamp: string; // ISO string
}

export function logActivity(
  type: TrackedActivity['type'],
  title: string,
  description: string
): TrackedActivity {
  const activity: TrackedActivity = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    type,
    title,
    description,
    timestamp: new Date().toISOString(),
  };
  const all = loadActivities();
  all.unshift(activity);
  if (all.length > MAX_ACTIVITIES) all.length = MAX_ACTIVITIES;
  try {
    localStorage.setItem(userKey('activities'),JSON.stringify(all));
  } catch (e) {
    console.error('logActivity:', e);
  }
  return activity;
}

export function loadActivities(): TrackedActivity[] {
  try {
    const raw = localStorage.getItem(userKey('activities'));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
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


interface StreakData {
  currentStreak: number;
  lastPracticeDate: string; // YYYY-MM-DD
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function getStreak(): number {
  try {
    const raw = localStorage.getItem(userKey('practice-streak'));
    if (!raw) return 0;
    const data: StreakData = JSON.parse(raw);
    if (data.lastPracticeDate === todayStr() || data.lastPracticeDate === yesterdayStr()) {
      return data.currentStreak;
    }
    return 0; // streak broken
  } catch {
    return 0;
  }
}

export function recordPracticeDay(): number {
  const today = todayStr();
  try {
    const raw = localStorage.getItem(userKey('practice-streak'));
    let data: StreakData = raw ? JSON.parse(raw) : { currentStreak: 0, lastPracticeDate: '' };
    if (data.lastPracticeDate === today) return data.currentStreak; // already recorded today
    if (data.lastPracticeDate === yesterdayStr()) {
      data.currentStreak += 1;
    } else {
      data.currentStreak = 1;
    }
    data.lastPracticeDate = today;
    localStorage.setItem(userKey('practice-streak'),JSON.stringify(data));
    return data.currentStreak;
  } catch {
    return 1;
  }
}

// ── Quiz score tracking ────────────────────────────────────────────────────


export interface QuizScore {
  planId: string;
  sectionTitle: string;
  correct: number;
  total: number;
  timestamp: string;
}

export function saveQuizScore(score: QuizScore): void {
  try {
    const raw = localStorage.getItem(userKey('quiz-scores'));
    const list: QuizScore[] = raw ? JSON.parse(raw) : [];
    list.unshift(score);
    if (list.length > 100) list.length = 100;
    localStorage.setItem(userKey('quiz-scores'),JSON.stringify(list));
  } catch (e) {
    console.error('saveQuizScore:', e);
  }
}

export function loadQuizScores(): QuizScore[] {
  try {
    const raw = localStorage.getItem(userKey('quiz-scores'));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ── Daily study goal ───────────────────────────────────────────────────────


interface DailyGoalData {
  targetHours: number;
  studiedMinutes: number;
  date: string; // YYYY-MM-DD
}

export function getDailyGoal(): DailyGoalData {
  try {
    const raw = localStorage.getItem(userKey('daily-goal'));
    if (raw) {
      const data: DailyGoalData = JSON.parse(raw);
      if (data.date === todayStr()) return data;
    }
  } catch { /* ignore */ }
  return { targetHours: 2, studiedMinutes: 0, date: todayStr() };
}

export function setDailyGoalTarget(hours: number): void {
  const data = getDailyGoal();
  data.targetHours = hours;
  data.date = todayStr();
  localStorage.setItem(userKey('daily-goal'),JSON.stringify(data));
}

export function addStudiedMinutes(mins: number): void {
  const data = getDailyGoal();
  data.studiedMinutes += mins;
  data.date = todayStr();
  localStorage.setItem(userKey('daily-goal'),JSON.stringify(data));
}
