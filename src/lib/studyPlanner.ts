import type { AnalyzedSection, PlanDay, SavedStudyPlan } from '../types';

const STORAGE_KEY = 'genai-study-plans';

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
