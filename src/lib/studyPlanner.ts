import type { AnalyzedSection, PlanDay, SavedStudyPlan } from '../types';

const STORAGE_KEY = 'genai-study-plans';
const PROGRESS_KEY = 'genai-study-progress';

export interface StudyProgress {
  planId: string;
  dayIndex: number; // 0-based index into plan.days
}

export function getStudyProgress(): StudyProgress | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStudyProgress(progress: StudyProgress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch (e) {
    console.error('setStudyProgress:', e);
  }
}

/**
 * Proportional Cumulative Scheduling — preserves textbook reading order.
 *
 * Algorithm:
 *   1. Compute total workload W = sum of all section workloadScores.
 *   2. Walk sections in page order (left to right).
 *   3. For day D, the cumulative workload target at the end of day D is (D/N)×W.
 *   4. Flush the current bucket into a new day once cumulative workload
 *      reaches that day's target (or when the last section is reached).
 *   5. Pad remaining days as review days if content runs out early.
 *
 * Why this instead of greedy bin-packing:
 *   The greedy approach (assign each section to the least-loaded day) maximises
 *   workload balance but scatters sections from different chapters into the same
 *   day, forcing the student to context-switch constantly. Proportional cumulative
 *   keeps every day's sections contiguous in the book, so each day reads like a
 *   natural continuation of the previous one.
 */
export function scheduleDays(sections: AnalyzedSection[], numDays: number): PlanDay[] {
  if (sections.length === 0 || numDays <= 0) return [];

  const totalScore = sections.reduce((s, sec) => s + sec.workloadScore, 0);
  const days: PlanDay[] = [];
  let bucket: AnalyzedSection[] = [];
  let cumulative = 0;
  let dayNum = 1;

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    bucket.push(sec);
    cumulative += sec.workloadScore;

    const isLast          = i === sections.length - 1;
    const targetForThisDay = (dayNum / numDays) * totalScore;

    if (isLast || (cumulative >= targetForThisDay && dayNum < numDays)) {
      days.push(buildDay(dayNum, bucket));
      dayNum++;
      bucket = [];
    }
  }

  // Pad with review days if there was less content than requested days
  while (days.length < numDays) {
    days.push({
      day:                days.length + 1,
      sections:           [],
      totalWorkloadScore: 0,
      estimatedHours:     0,
      mainConceptFocus:   'Review & consolidate previous material',
      difficulty:         'light',
    });
  }

  return days;
}

function buildDay(dayNum: number, sections: AnalyzedSection[]): PlanDay {
  const totalScore = sections.reduce((s, sec) => s + sec.workloadScore, 0);
  // Convert effort-minutes → wall-clock hours (÷45 accounts for re-reading and pauses)
  const estimatedHours = Math.round((totalScore / 45) * 10) / 10;
  const avgScore = totalScore / Math.max(sections.length, 1);
  const difficulty: PlanDay['difficulty'] =
    avgScore > 40 ? 'heavy' : avgScore > 20 ? 'moderate' : 'light';
  // Main concept = title of the highest-workload section in the day
  const topSection = sections.reduce(
    (best, s) => (s.workloadScore > (best?.workloadScore ?? 0) ? s : best),
    sections[0],
  );
  const mainConceptFocus = topSection?.title ?? 'Review';
  return { day: dayNum, sections, totalWorkloadScore: Math.round(totalScore), estimatedHours, mainConceptFocus, difficulty };
}

export function savePlan(plan: SavedStudyPlan): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list: SavedStudyPlan[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex((p) => p.id === plan.id);
    if (idx >= 0) list[idx] = plan;
    else list.push(plan);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('savePlan:', e);
  }
}

export function loadAllPlans(): SavedStudyPlan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function deletePlan(id: string): void {
  try {
    const list = loadAllPlans().filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('deletePlan:', e);
  }
}
