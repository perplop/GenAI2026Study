import type { AnalyzedSection, PlanDay, SavedStudyPlan } from '../types';
import { fetchPlans, upsertPlan, removePlan, fetchProgress, updateProgress } from './apiClient';

export interface StudyProgress {
  planId: string;
  dayIndex: number; // 0-based index into plan.days
}

export async function getStudyProgress(): Promise<StudyProgress | null> {
  return fetchProgress();
}

export async function setStudyProgress(progress: StudyProgress): Promise<void> {
  return updateProgress(progress);
}

/** Distribute sections across numDays by balancing total workload score (greedy). */
export function scheduleDays(sections: AnalyzedSection[], numDays: number): PlanDay[] {
  if (numDays < 1 || sections.length === 0) {
    return [];
  }
  const totalScore = sections.reduce((s, sec) => s + sec.workloadScore, 0);
  const targetPerDay = totalScore / numDays;
  const days: PlanDay[] = Array.from({ length: numDays }, (_, i) => ({
    day: i + 1,
    sections: [],
    totalWorkloadScore: 0,
    estimatedHours: 0,
    mainConceptFocus: `Day ${i + 1}`,
    difficulty: 'moderate' as const,
  }));

  for (const sec of sections) {
    let bestIdx = 0;
    let bestTotal = days[0].totalWorkloadScore;
    for (let d = 1; d < days.length; d++) {
      if (days[d].totalWorkloadScore < bestTotal) {
        bestTotal = days[d].totalWorkloadScore;
        bestIdx = d;
      }
    }
    days[bestIdx].sections.push(sec);
    days[bestIdx].totalWorkloadScore += sec.workloadScore;
  }

  for (const d of days) {
    d.estimatedHours = Math.round((d.totalWorkloadScore / 45) * 10) / 10;
    const avg = d.sections.length ? d.totalWorkloadScore / d.sections.length : 0;
    d.difficulty = avg > 30 ? 'heavy' : avg > 15 ? 'moderate' : 'light';
    d.mainConceptFocus =
      d.sections.length > 0
        ? d.sections.map((s) => s.title).slice(0, 2).join(', ')
        : 'Review';
  }

  return days;
}

export async function savePlan(plan: SavedStudyPlan): Promise<void> {
  return upsertPlan(plan as any);
}

export async function loadAllPlans(): Promise<SavedStudyPlan[]> {
  return fetchPlans() as Promise<SavedStudyPlan[]>;
}

export async function deletePlan(id: string): Promise<void> {
  return removePlan(id);
}
