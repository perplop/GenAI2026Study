import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, BookOpen, HelpCircle, Clock, Flame, CheckCircle2 } from 'lucide-react';
import { cn } from './lib/utils';
import { loadAllPlans, getStudyProgress } from './lib/studyPlanner';
import { loadActivities, loadQuizScores, getStreak, getDailyGoal, type TrackedActivity, type QuizScore, type DailyGoalData } from './lib/activityTracker';
import type { SavedStudyPlan } from './types';

// ── Helpers ────────────────────────────────────────────────────────────────

function last7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function dayLabel(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

function parseStudyHours(desc: string): number {
  const match = desc.match(/~([\d.]+)h/);
  return match ? parseFloat(match[1]) : 0;
}

// ── Stat Card ──────────────────────────────────────────────────────────────

const StatCard = ({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-surface-container-lowest rounded-2xl p-6 editorial-shadow border border-outline-variant/10"
  >
    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4", color)}>
      {icon}
    </div>
    <p className="font-headline text-3xl font-extrabold text-on-surface">{value}</p>
    <p className="font-label text-sm text-on-surface-variant mt-1">{label}</p>
    {sub && <p className="font-label text-xs text-on-surface-variant/60 mt-0.5">{sub}</p>}
  </motion.div>
);

// ── Bar Chart (SVG) ────────────────────────────────────────────────────────

const BarChart = ({ data, labels }: { data: number[]; labels: string[] }) => {
  const max = Math.max(...data, 1);
  const barW = 36;
  const gap = 14;
  const chartH = 160;
  const chartW = data.length * (barW + gap) - gap;

  return (
    <svg viewBox={`0 0 ${chartW + 40} ${chartH + 40}`} className="w-full h-48">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(frac => {
        const y = chartH - frac * chartH + 10;
        return (
          <g key={frac}>
            <line x1={30} y1={y} x2={chartW + 40} y2={y} stroke="currentColor" className="text-outline-variant/20" strokeWidth={0.5} />
            <text x={26} y={y + 4} textAnchor="end" className="fill-on-surface-variant" fontSize={9} fontFamily="Manrope">
              {(max * frac).toFixed(1)}h
            </text>
          </g>
        );
      })}
      {/* Bars */}
      {data.map((val, i) => {
        const barH = max > 0 ? (val / max) * chartH : 0;
        const x = 34 + i * (barW + gap);
        const y = chartH - barH + 10;
        return (
          <g key={i}>
            <motion.rect
              initial={{ height: 0, y: chartH + 10 }}
              animate={{ height: barH, y }}
              transition={{ duration: 0.6, delay: i * 0.08 }}
              x={x} width={barW} rx={4}
              className="fill-primary"
            />
            <text x={x + barW / 2} y={chartH + 28} textAnchor="middle" className="fill-on-surface-variant" fontSize={10} fontFamily="Manrope">
              {labels[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ── Line Chart (SVG) ───────────────────────────────────────────────────────

const LineChart = ({ data, labels }: { data: number[]; labels: string[] }) => {
  const max = Math.max(...data, 1);
  const padL = 34;
  const padR = 10;
  const padT = 10;
  const padB = 30;
  const w = 350;
  const h = 180;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const points = data.map((val, i) => {
    const x = padL + (data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2);
    const y = padT + plotH - (val / max) * plotH;
    return { x, y, val };
  });

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-48">
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map(frac => {
        const y = padT + plotH - frac * plotH;
        return (
          <g key={frac}>
            <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="currentColor" className="text-outline-variant/20" strokeWidth={0.5} />
            <text x={padL - 4} y={y + 3} textAnchor="end" className="fill-on-surface-variant" fontSize={9} fontFamily="Manrope">
              {Math.round(max * frac)}%
            </text>
          </g>
        );
      })}
      {/* Line */}
      {points.length > 1 && (
        <motion.polyline
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1 }}
          points={polyline}
          fill="none" stroke="currentColor" className="text-primary" strokeWidth={2.5} strokeLinejoin="round"
        />
      )}
      {/* Dots + labels */}
      {points.map((p, i) => (
        <g key={i}>
          <motion.circle
            initial={{ r: 0 }}
            animate={{ r: 4 }}
            transition={{ delay: 0.3 + i * 0.1 }}
            cx={p.x} cy={p.y} className="fill-primary"
          />
          <text x={p.x} y={h - 6} textAnchor="middle" className="fill-on-surface-variant" fontSize={9} fontFamily="Manrope">
            {labels[i]}
          </text>
        </g>
      ))}
    </svg>
  );
};

// ── Heatmap ────────────────────────────────────────────────────────────────

const SectionHeatmap = ({ plans, progressData }: { plans: SavedStudyPlan[]; progressData: { planId: string; dayIndex: number } | null }) => {
  if (plans.length === 0) return <p className="text-on-surface-variant italic text-sm">No plans to display.</p>;

  return (
    <div className="space-y-4">
      {plans.map(plan => {
        const isCurrentPlan = progressData?.planId === plan.id;
        const completedDayIdx = isCurrentPlan ? progressData!.dayIndex : 0;
        return (
          <div key={plan.id}>
            <p className="font-label text-xs font-bold text-on-surface-variant mb-2 truncate">{plan.bookTitle}</p>
            <div className="flex flex-wrap gap-1">
              {plan.days.map((day, di) => {
                const isDone = isCurrentPlan && di < completedDayIdx;
                const isCurrent = isCurrentPlan && di === completedDayIdx;
                return (
                  <div
                    key={di}
                    title={`Day ${day.day}: ${day.mainConceptFocus} (${day.difficulty})`}
                    className={cn(
                      "w-5 h-5 rounded-sm transition-colors",
                      isDone ? "bg-primary" : isCurrent ? "bg-primary-container" : "bg-surface-container-high"
                    )}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-4 mt-2 font-label text-xs text-on-surface-variant">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-primary inline-block" /> Completed</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-primary-container inline-block" /> Current</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-surface-container-high inline-block" /> Upcoming</span>
      </div>
    </div>
  );
};

// ── Main Analytics View ────────────────────────────────────────────────────

interface AnalyticsViewProps {
  setView: (v: string) => void;
}

const AnalyticsView: React.FC<AnalyticsViewProps> = ({ setView }) => {
  const [plans, setPlans] = useState<SavedStudyPlan[]>([]);
  const [progress, setProgress] = useState<{ planId: string; dayIndex: number } | null>(null);
  const [activities, setActivities] = useState<TrackedActivity[]>([]);
  const [quizScores, setQuizScores] = useState<QuizScore[]>([]);
  const [streak, setStreakVal] = useState(0);
  const [dailyGoal, setDailyGoalVal] = useState<DailyGoalData>({ targetHours: 2, studiedMinutes: 0, date: '' });

  useEffect(() => {
    loadAllPlans().then(setPlans);
    getStudyProgress().then(setProgress);
    loadActivities().then(setActivities);
    loadQuizScores().then(setQuizScores);
    getStreak().then(setStreakVal);
    getDailyGoal().then(setDailyGoalVal);
  }, []);

  // ── Compute stats ──────────────────────────────────────────────────────

  const totalPlans = plans.length;

  const totalSectionsCompleted = plans.reduce((sum, plan) => {
    const isCurrentPlan = progress?.planId === plan.id;
    const doneIdx = isCurrentPlan ? progress!.dayIndex : 0;
    return sum + plan.days.slice(0, doneIdx).flatMap(d => d.sections).length;
  }, 0);

  const totalStudyHours = activities
    .filter(a => a.type === 'study')
    .reduce((sum, a) => sum + parseStudyHours(a.description), 0);

  const totalQuizzes = quizScores.length;
  const totalCorrect = quizScores.reduce((s, q) => s + q.correct, 0);
  const avgAccuracy = totalQuizzes > 0 ? Math.round((totalCorrect / totalQuizzes) * 100) : 0;

  // ── 7-day study time ───────────────────────────────────────────────────

  const days7 = last7Days();
  const studyByDay = days7.map(day => {
    const dayActivities = activities.filter(a => a.type === 'study' && a.timestamp.startsWith(day));
    return dayActivities.reduce((sum, a) => sum + parseStudyHours(a.description), 0);
  });

  // ── Quiz accuracy by day ──────────────────────────────────────────────

  const quizDays = [...new Set(quizScores.map(q => q.timestamp.slice(0, 10)))].sort().slice(-7);
  const accuracyByDay = quizDays.map(day => {
    const dayScores = quizScores.filter(q => q.timestamp.startsWith(day));
    const total = dayScores.length;
    const correct = dayScores.reduce((s, q) => s + q.correct, 0);
    return total > 0 ? Math.round((correct / total) * 100) : 0;
  });

  return (
    <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-10">
      {/* Header */}
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="text-primary" size={28} />
          <h1 className="font-headline text-5xl font-extrabold tracking-tight text-on-surface">Analytics</h1>
        </div>
        <p className="text-xl text-on-surface-variant font-body italic">Track your learning journey with data-driven insights.</p>
      </header>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard
          icon={<BookOpen size={20} className="text-primary" />}
          label="Study Plans"
          value={String(totalPlans)}
          sub={`${totalSectionsCompleted} sections completed`}
          color="bg-primary/10"
        />
        <StatCard
          icon={<Clock size={20} className="text-secondary" />}
          label="Total Study Hours"
          value={totalStudyHours.toFixed(1)}
          sub={`${dailyGoal.studiedMinutes}m studied today`}
          color="bg-secondary/10"
        />
        <StatCard
          icon={<HelpCircle size={20} className="text-tertiary" />}
          label="Quiz Accuracy"
          value={`${avgAccuracy}%`}
          sub={`${totalCorrect}/${totalQuizzes} correct`}
          color="bg-tertiary/10"
        />
        <StatCard
          icon={<Flame size={20} className="text-error" />}
          label="Practice Streak"
          value={`${streak} days`}
          sub={streak >= 3 ? 'Keep it up!' : 'Practice today!'}
          color="bg-error/10"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        {/* Study Time Chart */}
        <div className="bg-surface-container-lowest rounded-2xl p-8 editorial-shadow border border-outline-variant/10">
          <h2 className="font-headline text-lg font-bold text-on-surface mb-6">Study Time (Last 7 Days)</h2>
          {studyByDay.some(v => v > 0) ? (
            <BarChart data={studyByDay} labels={days7.map(dayLabel)} />
          ) : (
            <div className="flex items-center justify-center h-48 text-on-surface-variant italic text-sm">
              Complete study days to see your time chart.
            </div>
          )}
        </div>

        {/* Quiz Accuracy Trend */}
        <div className="bg-surface-container-lowest rounded-2xl p-8 editorial-shadow border border-outline-variant/10">
          <h2 className="font-headline text-lg font-bold text-on-surface mb-6">Quiz Accuracy Trend</h2>
          {accuracyByDay.length > 0 ? (
            <LineChart data={accuracyByDay} labels={quizDays.map(dayLabel)} />
          ) : (
            <div className="flex items-center justify-center h-48 text-on-surface-variant italic text-sm">
              Take quizzes to see your accuracy trend.
            </div>
          )}
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-surface-container-lowest rounded-2xl p-8 editorial-shadow border border-outline-variant/10">
        <h2 className="font-headline text-lg font-bold text-on-surface mb-6">Section Completion</h2>
        <SectionHeatmap plans={plans} progressData={progress} />
      </div>
    </div>
  );
};

export default AnalyticsView;
