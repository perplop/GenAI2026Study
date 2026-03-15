import React, { useState, useEffect, useRef, useCallback } from 'react';
import AuthPage from './AuthPage';
import AnalyticsView from './AnalyticsView';
import PdfViewer from './PdfViewer';
import type { AuthUser } from './LoginForm';
import { 
  LayoutDashboard, 
  BookOpen, 
  Zap, 
  Library, 
  Bell,
  Settings, 
  Plus,
  ChevronLeft,
  ChevronRight,
  Microscope,
  Variable,
  History,
  FileText,
  CheckCircle2,
  ArrowRight,
  Upload,
  PenTool,
  HelpCircle,
  TrendingUp,
  Flame,
  Bookmark,
  Flag,
  Lightbulb,
  ArrowLeft,
  Download,
  Maximize2,
  Moon,
  Sparkles,
  Menu,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import OpenAI from "openai";
import { cn } from './lib/utils';
import { Activity, Module, QuizQuestion, LibraryItem, AnalyzedSection, PlanDay, SavedStudyPlan } from './types';
import { parseTextbook, ParsedPage } from './lib/pdfParser';
import { splitIntoSections } from './lib/sectionSplitter';
import { scheduleDays, savePlan, loadAllPlans, deletePlan, getStudyProgress, setStudyProgress, type StudyProgress } from './lib/studyPlanner';
import {
  logActivity, loadActivities, relativeTime,
  getStreak, recordPracticeDay,
  saveQuizScore, loadQuizScores,
  getDailyGoal, setDailyGoalTarget, addStudiedMinutes,
  type TrackedActivity,
  type QuizScore,
  type DailyGoalData,
} from './lib/activityTracker';
import {
  generateQuizzes, generateFlashcards, generateReviewSummary,
  generateScholarTip, generateScholarSummary,
  type GeneratedQuiz, type GeneratedFlashcard, type ReviewSummary,
} from './lib/aiGenerator';
import { setCurrentUserId } from './lib/userContext';

// --- Mock Data ---

const ACTIVITIES: Activity[] = [
  {
    id: '1',
    type: 'quiz',
    title: 'Completed Mini-Quiz',
    description: 'Score: 95% in Cell Structure & Function. Great job on the ATP synthesis questions!',
    timestamp: '2h ago'
  },
  {
    id: '2',
    type: 'highlight',
    title: 'New Highlights Added',
    description: 'Added 12 annotations to The Industrial Revolution: Part II chapter.',
    timestamp: 'Yesterday'
  },
  {
    id: '3',
    type: 'flashcard',
    title: 'Flashcard Streak',
    description: "You've mastered 45 terms in Spanish Vocabulary. Keep it up!",
    timestamp: '2 days ago'
  }
];

const MODULES: Module[] = [
  { id: '1', title: '4.1 Discovery of Cells', status: 'completed' },
  { id: '2', title: '4.2 Prokaryotic Cells', status: 'completed' },
  { id: '3', title: '4.3 Eukaryotic Cells', status: 'processing' },
  { id: '4', title: '4.4 The Plasma Membrane', status: 'locked' },
  { id: '5', title: '4.5 Summary & Review', status: 'locked' }
];

// --- Components ---

const ProgressBar = ({ progress, className }: { progress: number; className?: string }) => (
  <div className={cn("w-full h-1.5 bg-outline-variant/10 rounded-full overflow-hidden", className)}>
    <motion.div 
      initial={{ width: 0 }}
      animate={{ width: `${progress}%` }}
      transition={{ duration: 1, ease: "easeOut" }}
      className="h-full bg-primary rounded-full"
    />
  </div>
);

const Sidebar = ({ 
  activeView, 
  setView, 
  isOpen, 
  onClose 
}: { 
  activeView: string; 
  setView: (v: string) => void;
  isOpen: boolean;
  onClose: () => void;
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'study-today', label: 'Study Today', icon: BookOpen },
    { id: 'library', label: 'Library', icon: Library },
    { id: 'timeline', label: 'Nightly Review', icon: Moon },
    { id: 'practice', label: 'Practice', icon: HelpCircle },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={cn(
        "fixed inset-y-0 left-0 w-72 bg-surface-container-low border-r border-outline-variant/15 flex flex-col z-[70] transition-transform duration-300 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <button 
              onClick={() => {
                setView('dashboard');
                onClose();
              }}
              className="font-headline font-bold text-on-surface hover:text-primary transition-colors"
            >
              Dashboard
            </button>
            <button onClick={onClose} className="lg:hidden p-2 text-on-surface-variant hover:text-primary">
              <X size={20} />
            </button>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setView(item.id);
                  onClose();
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
                  activeView === item.id 
                    ? "bg-surface-container-lowest text-primary editorial-shadow" 
                    : "text-on-surface-variant hover:bg-surface-container-high"
                )}
              >
                <item.icon size={20} className={cn(activeView === item.id && "fill-primary/20")} />
                <span className={cn("font-label text-sm", activeView === item.id ? "font-bold" : "font-medium")}>
                  {item.label}
                </span>
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-8 border-t border-outline-variant/10">
          <button 
            onClick={() => {
              setView('curate');
              onClose();
            }}
            className="w-full py-4 bg-primary text-on-primary font-label text-sm font-bold rounded-xl hover:bg-primary-dim transition-all editorial-shadow flex items-center justify-center gap-2"
          >
            <Upload size={18} />
            Upload Textbook
          </button>
        </div>
      </aside>
    </>
  );
};

const NOTIF_ICONS: Record<string, React.ReactNode> = {
  quiz: <Zap size={14} className="text-primary" />,
  highlight: <PenTool size={14} className="text-secondary" />,
  flashcard: <Bookmark size={14} className="text-tertiary" />,
  plan: <FileText size={14} className="text-primary" />,
  study: <BookOpen size={14} className="text-secondary" />,
  practice: <HelpCircle size={14} className="text-tertiary" />,
};

const NotificationPanel = ({ isOpen, onClose, activities }: { isOpen: boolean; onClose: () => void; activities: TrackedActivity[] }) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[80]"
        />
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          className="fixed top-16 right-6 w-80 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl editorial-shadow z-[90] overflow-hidden"
        >
          <div className="p-4 border-b border-outline-variant/10 flex items-center justify-between">
            <h3 className="font-headline font-bold">Notifications</h3>
            <button onClick={onClose} className="p-1 hover:bg-surface-container-high rounded-full transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {activities.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant text-sm italic">No activity yet. Upload a textbook to get started!</div>
            ) : activities.slice(0, 10).map((activity) => (
              <div key={activity.id} className="p-4 border-b border-outline-variant/5 last:border-0 hover:bg-surface-container-low transition-colors cursor-pointer">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    {NOTIF_ICONS[activity.type] ?? <Zap size={14} className="text-primary" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface">{activity.title}</p>
                    <p className="text-xs text-on-surface-variant line-clamp-2 mt-0.5">{activity.description}</p>
                    <p className="text-[10px] text-on-surface-variant/60 mt-1">{relativeTime(activity.timestamp)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {activities.length > 0 && (
            <div className="p-3 bg-surface-container-low text-center">
              <span className="text-xs font-bold text-on-surface-variant">{activities.length} total events</span>
            </div>
          )}
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

const SettingsPanel = ({
  isOpen,
  onClose,
  darkMode,
  onToggleDarkMode,
  aiAssistance,
  onToggleAI,
  onSignOut,
}: {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  aiAssistance: boolean;
  onToggleAI: () => void;
  onSignOut: () => void;
}) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[80]"
        />
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          className="fixed top-16 right-6 w-80 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl editorial-shadow z-[90] overflow-hidden"
        >
          <div className="p-4 border-b border-outline-variant/10 flex items-center justify-between">
            <h3 className="font-headline font-bold">Settings</h3>
            <button onClick={onClose} className="p-1 hover:bg-surface-container-high rounded-full transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="p-4 space-y-6">
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Preferences</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Dark Mode</span>
                <button
                  onClick={onToggleDarkMode}
                  className={cn("w-10 h-5 rounded-full relative transition-colors", darkMode ? "bg-primary" : "bg-outline-variant/20")}
                >
                  <div className={cn("absolute top-1 w-3 h-3 rounded-full transition-all", darkMode ? "right-1 bg-on-primary" : "left-1 bg-on-surface-variant")} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">AI Assistance</span>
                <button
                  onClick={onToggleAI}
                  className={cn("w-10 h-5 rounded-full relative transition-colors", aiAssistance ? "bg-primary" : "bg-outline-variant/20")}
                >
                  <div className={cn("absolute top-1 w-3 h-3 rounded-full transition-all", aiAssistance ? "right-1 bg-on-primary" : "left-1 bg-on-surface-variant")} />
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Account</p>
              <button className="w-full text-left text-sm font-medium py-2 hover:text-primary transition-colors">Profile Details</button>
              <button className="w-full text-left text-sm font-medium py-2 hover:text-primary transition-colors">Subscription Plan</button>
              <button
                onClick={() => { onSignOut(); onClose(); }}
                className="w-full text-left text-sm font-medium py-2 text-error hover:underline transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

const TopNav = ({
  onMenuClick,
  setView,
  onNotificationClick,
  onSettingsClick,
  hasNotifications,
  userEmail,
}: {
  onMenuClick: () => void;
  setView: (v: string) => void;
  onNotificationClick: () => void;
  onSettingsClick: () => void;
  hasNotifications: boolean;
  userEmail?: string;
}) => (
  <nav className="sticky top-0 z-50 glass-panel border-b border-outline-variant/10 px-6 py-4 flex items-center justify-between h-16">
    <div className="flex items-center gap-4 lg:gap-12">
      <button onClick={onMenuClick} className="lg:hidden p-2 text-on-surface-variant hover:text-primary">
        <Menu size={24} />
      </button>
      <button 
        onClick={() => setView('dashboard')}
        className="font-headline font-extrabold text-primary text-2xl tracking-tight hidden sm:block hover:opacity-80 transition-opacity"
      >
        StudySmart
      </button>
    </div>
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={onNotificationClick}
          className="text-on-surface-variant hover:text-primary transition-colors relative"
        >
          <Bell size={24} />
          {hasNotifications && <span className="absolute top-0 right-0 w-2 h-2 bg-error rounded-full border-2 border-surface"></span>}
        </button>
        <button 
          onClick={onSettingsClick}
          className="text-on-surface-variant hover:text-primary transition-colors"
        >
          <Settings size={24} />
        </button>
        <div className="w-10 h-10 rounded-full border-2 border-surface-container-highest bg-primary flex items-center justify-center text-on-primary font-headline font-bold text-sm">
          {userEmail ? userEmail[0].toUpperCase() : '?'}
        </div>
      </div>
    </div>
  </nav>
);

// --- Views ---

const ScholarTipWidget = ({ plans }: { plans: SavedStudyPlan[] }) => {
  const [tip, setTip] = useState<string | null>(null);
  const [progress, setProgressState] = useState<StudyProgress | null>(null);
  const [quizScores, setQuizScores] = useState<QuizScore[]>([]);

  useEffect(() => {
    getStudyProgress().then(setProgressState);
    loadQuizScores().then(setQuizScores);
  }, []);

  const plan = progress ? plans.find(p => p.id === progress.planId) : plans[0];
  const currentSection = plan?.days[progress?.dayIndex ?? 0]?.sections[0];
  const totalQ = quizScores.length;
  const correctQ = quizScores.reduce((s, q) => s + q.correct, 0);
  const accuracy = totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : undefined;

  useEffect(() => {
    generateScholarTip(plan?.bookTitle ?? 'your textbook', currentSection?.title, accuracy)
      .then(t => { if (t) setTip(t); });
  }, [plan?.bookTitle, currentSection?.title, accuracy]);

  return (
    <div className="bg-primary-container/20 rounded-2xl p-8">
      <div className="flex items-center gap-4 mb-4">
        <Sparkles className="text-primary" />
        <h4 className="font-headline font-bold">Scholar Tip</h4>
      </div>
      <p className="text-sm text-on-primary-container leading-relaxed">
        {tip ?? 'Students who use Active Recall retain 40% more information after one week. Try the mini-quiz in the Study View today!'}
      </p>
    </div>
  );
};

const PLAN_CARD_COLORS = ['bg-primary', 'bg-secondary', 'bg-tertiary'] as const;

const DashboardView = ({
  setView,
  view,
  onOpenPlan,
  onStudyPlan,
  activities,
}: {
  setView: (v: string) => void;
  view: string;
  onOpenPlan: (planId: string) => void;
  onStudyPlan: (planId: string) => void;
  activities: TrackedActivity[];
}) => {
  const [plans, setPlans] = useState<SavedStudyPlan[]>([]);
  const [progress, setProgressState] = useState<StudyProgress | null>(null);
  const [dailyGoal, setDailyGoalState] = useState<DailyGoalData>({ targetHours: 2, studiedMinutes: 0 });

  useEffect(() => {
    loadAllPlans().then(setPlans);
    getStudyProgress().then(setProgressState);
    getDailyGoal().then(setDailyGoalState);
  }, []);

  useEffect(() => {
    if (view === 'dashboard') {
      loadAllPlans().then(setPlans);
      getStudyProgress().then(setProgressState);
      getDailyGoal().then(setDailyGoalState);
    }
  }, [view]);

  const goalPercent = dailyGoal.targetHours > 0
    ? Math.min(100, Math.round((dailyGoal.studiedMinutes / (dailyGoal.targetHours * 60)) * 100))
    : 0;
  const goalStrokeDashoffset = 440 - (440 * goalPercent) / 100;
  const hoursLeft = Math.max(0, dailyGoal.targetHours - dailyGoal.studiedMinutes / 60);

  return (
  <div className="max-w-[1440px] mx-auto px-6 py-10 lg:px-16">
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-20 items-end">
      <div className="lg:col-span-7">
        <p className="font-label text-primary font-bold tracking-widest uppercase text-xs mb-4">Welcome back</p>
        <h1 className="font-headline text-5xl lg:text-7xl font-extrabold text-on-surface leading-tight mb-6">
          Master the <span className="italic font-body font-light text-primary">Art</span> of Learning.
        </h1>
      </div>
      <div className="lg:col-span-5 flex justify-end">
        <button 
          onClick={() => setView('study')}
          className="group relative flex items-center justify-center bg-primary text-on-primary px-10 py-5 rounded-xl font-headline font-bold text-lg hover:bg-primary-dim transition-all overflow-hidden shadow-xl shadow-primary/20"
        >
          <span className="relative z-10 flex items-center gap-3">
            Start Studying <ArrowRight size={20} />
          </span>
        </button>
      </div>
    </section>

    <section className="mb-16">
      <div className="flex items-center justify-between mb-8">
        <h2 className="font-headline text-2xl font-bold">Active Courses</h2>
        <button
          onClick={() => setView('library')}
          className="font-label text-sm font-semibold text-primary hover:underline"
        >
          View all in Library
        </button>
      </div>
      <div className="flex overflow-x-auto gap-6 no-scrollbar pb-6 -mx-4 px-4">
        {plans.map((plan, idx) => {
          const isCurrentPlan = progress?.planId === plan.id;
          const daysRead = isCurrentPlan && progress != null ? progress.dayIndex : 0;
          const totalDays = plan.days.length;
          const progressPercent = totalDays > 0 ? Math.round((daysRead / totalDays) * 100) : 0;
          return (
          <button
            key={plan.id}
            type="button"
            onClick={() => onStudyPlan(plan.id)}
            className="min-w-[320px] text-left bg-surface-container-lowest p-6 rounded-xl border border-transparent hover:border-primary/10 transition-all cursor-pointer group shadow-sm"
          >
            <div className={cn(
              "w-12 h-12 rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform bg-opacity-20",
              PLAN_CARD_COLORS[idx % 3]
            )}>
              <BookOpen size={24} className={cn(
                idx % 3 === 0 && "text-primary",
                idx % 3 === 1 && "text-secondary",
                idx % 3 === 2 && "text-tertiary"
              )} />
            </div>
            <h3 className="font-headline text-xl font-bold mb-1 truncate">{plan.bookTitle}</h3>
            <p className="text-on-surface-variant font-label text-sm mb-4">
              {plan.numDays} days · {plan.totalSections} sections
            </p>
            {/* Per-plan progress bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">Progress</span>
                <span className="font-label text-xs text-on-surface-variant">
                  <span className={cn(isCurrentPlan && "font-bold text-primary")}>{daysRead}</span>
                  <span className="text-on-surface-variant/80"> / {totalDays} days</span>
                </span>
              </div>
              <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
                <motion.div
                  className={cn(
                    'h-full rounded-full',
                    idx % 3 === 0 && 'bg-primary',
                    idx % 3 === 1 && 'bg-secondary',
                    idx % 3 === 2 && 'bg-tertiary'
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] text-on-surface-variant font-label">
                Created {new Date(plan.createdAt).toLocaleDateString()}
              </p>
              <span className="font-label text-xs font-semibold text-primary">Start studying →</span>
            </div>
          </button>
          );
        })}
        <button
          type="button"
          onClick={() => setView('curate')}
          className="min-w-[320px] bg-surface-container-low rounded-xl border-2 border-dashed border-outline-variant/30 hover:border-primary/40 transition-all flex flex-col items-center justify-center p-6 gap-4 group"
        >
          <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-primary/10 text-primary group-hover:scale-110 transition-transform">
            <Plus size={28} />
          </div>
          <span className="font-headline text-lg font-bold text-on-surface">Add a course</span>
          <span className="font-label text-sm text-on-surface-variant text-center">Upload a textbook PDF to create a new study plan</span>
        </button>
      </div>
    </section>

    <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-8 bg-surface-container-low rounded-2xl p-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-headline text-2xl font-bold">Recent Activity</h2>
        </div>
        {activities.length === 0 ? (
          <p className="text-on-surface-variant italic text-sm">No activity yet. Upload a textbook to create your first study plan!</p>
        ) : (
        <div className="space-y-6">
          {activities.slice(0, 5).map((activity) => (
            <div key={activity.id} className="flex gap-6 items-start">
              <div className={cn(
                "shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
                (activity.type === 'quiz' || activity.type === 'practice') && "bg-primary/10 text-primary",
                (activity.type === 'highlight' || activity.type === 'study') && "bg-secondary/10 text-secondary",
                (activity.type === 'flashcard' || activity.type === 'plan') && "bg-tertiary/10 text-tertiary"
              )}>
                {(activity.type === 'quiz' || activity.type === 'practice') && <HelpCircle size={20} />}
                {activity.type === 'study' && <BookOpen size={20} />}
                {activity.type === 'plan' && <FileText size={20} />}
                {activity.type === 'highlight' && <PenTool size={20} />}
                {activity.type === 'flashcard' && <FileText size={20} />}
              </div>
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <h4 className="font-headline font-bold">{activity.title}</h4>
                  <span className="text-xs font-label text-on-surface-variant">{relativeTime(activity.timestamp)}</span>
                </div>
                <p className="text-sm text-on-surface-variant leading-relaxed">{activity.description}</p>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
      <div className="lg:col-span-4 space-y-8">
        <div className="bg-surface-container-lowest rounded-2xl p-8 shadow-sm border border-outline-variant/10 flex flex-col items-center text-center">
          <div className="relative w-40 h-40 flex items-center justify-center mb-6">
            <svg className="w-full h-full -rotate-90">
              <circle className="text-surface-container-highest" cx="80" cy="80" fill="transparent" r="70" stroke="currentColor" strokeWidth="8"></circle>
              <motion.circle
                initial={{ strokeDashoffset: 440 }}
                animate={{ strokeDashoffset: goalStrokeDashoffset }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
                className="text-primary" cx="80" cy="80" fill="transparent" r="70" stroke="currentColor" strokeDasharray="440" strokeWidth="8"
              ></motion.circle>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-headline text-3xl font-extrabold text-on-surface">{Math.round(dailyGoal.studiedMinutes / 6) / 10}h</span>
              <span className="font-label text-xs uppercase tracking-widest text-on-surface-variant">Today</span>
            </div>
          </div>
          <h3 className="font-headline text-lg font-bold mb-2">Daily Focus Goal</h3>
          <p className="text-sm text-on-surface-variant mb-6">
            {goalPercent >= 100
              ? "You've reached your study goal for today!"
              : `You're ${goalPercent}% of the way to your study goal. ${hoursLeft.toFixed(1)}h to go!`}
          </p>
          <button
            onClick={async () => {
              const next = dailyGoal.targetHours === 2 ? 3 : dailyGoal.targetHours === 3 ? 4 : dailyGoal.targetHours === 4 ? 1 : 2;
              await setDailyGoalTarget(next);
              setDailyGoalState(prev => ({ ...prev, targetHours: next }));
            }}
            className="w-full py-3 rounded-full border border-primary text-primary font-headline font-bold text-sm hover:bg-primary/5 transition-colors"
          >
            Goal: {dailyGoal.targetHours}h — Adjust
          </button>
        </div>
        <ScholarTipWidget plans={plans} />
      </div>
    </section>
  </div>
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms));


const OPENAI_BASE_URL = "https://vjioo4r1vyvcozuj.us-east-2.aws.endpoints.huggingface.cloud/v1";
const OPENAI_MODEL = "openai/gpt-oss-120b";

function makeOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY ?? "test",
    baseURL: OPENAI_BASE_URL,
    dangerouslyAllowBrowser: true,
  });
}

// ---------------------------------------------------------------------------
// AI enrichment: ONE call — returns a short learning goal per day
// ---------------------------------------------------------------------------
async function enrichDaysWithAI(days: PlanDay[]): Promise<PlanDay[]> {
  if (days.length === 0) return days;
  const ai = makeOpenAIClient();
  const prompt =
    `For each study day below, write a concise learning goal (max 8 words).\n` +
    `Return ONLY a JSON object: {"goals": ["...", ...]}\n\n` +
    days.map(d => `Day ${d.day}: ${d.sections.map(s => s.title).join(', ') || 'Review'}`).join('\n');
  try {
    const resp = await ai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });
    const goals: string[] = JSON.parse(resp.choices[0]?.message?.content ?? '{}').goals ?? [];
    return days.map((d, i) => ({ ...d, mainConceptFocus: goals[i] || d.mainConceptFocus }));
  } catch {
    return days; // fallback: rule-derived title stays
  }
}


// ---------------------------------------------------------------------------
// CurateView — upload → rule-based parse + split → schedule → save
// ---------------------------------------------------------------------------
const CurateView = ({ setView }: { setView: (v: string) => void }) => {
  type Status = 'idle' | 'parsing' | 'configuring' | 'generating' | 'saved' | 'error';
  const [status, setStatus] = useState<Status>('idle');
  const [parseProgress, setParseProgress] = useState({ current: 0, total: 0 });
  const [parsedData, setParsedData] = useState<{
    pages: ParsedPage[];
    totalPages: number;
    fileName: string;
    sections: AnalyzedSection[];
    file: File;
  } | null>(null);
  const [numDays, setNumDays] = useState(14);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file || file.type !== 'application/pdf') {
      setError('Please upload a PDF file.');
      return;
    }
    setError(null);
    setStatus('parsing');
    setParseProgress({ current: 0, total: 0 });
    try {
      const result = await parseTextbook(file, (current, total) => setParseProgress({ current, total }));
      const sections = splitIntoSections(result.pages, result.totalPages, result.fileName);
      setParsedData({ pages: result.pages, totalPages: result.totalPages, fileName: result.fileName, sections, file });
      setStatus('configuring');
    } catch (e) {
      console.error(e);
      setError('Failed to parse the PDF. Please try another file.');
      setStatus('error');
    }
  };

  const handleGeneratePlan = async () => {
    if (!parsedData) return;
    setStatus('generating');
    try {
      let days = scheduleDays(parsedData.sections, numDays);
      days = await enrichDaysWithAI(days);
      const planTitle = parsedData.fileName.replace(/\.pdf$/i, '');
      // Upload PDF to server for later viewing
      let pdfFileName: string | undefined;
      try {
        const formData = new FormData();
        formData.append('file', parsedData.file);
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          pdfFileName = uploadData.file?.id;
        }
      } catch { /* upload failed — plan still works without PDF viewer */ }

      await savePlan({
        id: Date.now().toString(),
        bookTitle: planTitle,
        createdAt: new Date().toISOString(),
        numDays: days.length,
        totalSections: parsedData.sections.length,
        days,
        pdfFileName,
      });
      await logActivity('plan', 'Study Plan Created', `Generated ${days.length}-day plan for "${planTitle}" with ${parsedData.sections.length} sections.`);
      setStatus('saved');
    } catch (e) {
      console.error(e);
      setError('Failed to generate study plan. Check the console.');
      setStatus('error');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const parsePercent = parseProgress.total > 0
    ? Math.round((parseProgress.current / parseProgress.total) * 100) : 0;

  // ---- IDLE / ERROR ----
  if (status === 'idle' || status === 'error') {
    return (
      <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-10">
          <header className="space-y-2">
            <h1 className="font-headline text-5xl font-extrabold tracking-tight text-on-surface">Curate Your Library</h1>
            <p className="text-xl text-on-surface-variant max-w-2xl leading-relaxed">
              Upload your textbook PDF. The rule-based engine splits it into sections, scores each one, and builds a balanced day-by-day study plan.
            </p>
          </header>
          <section className="relative group">
            <div
              className="bg-surface-container-low rounded-xl p-1 border-2 border-dashed border-outline-variant/30 group-hover:border-primary/40 transition-all cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
            >
              <div className="bg-surface-container-lowest rounded-lg p-12 flex flex-col items-center text-center editorial-shadow">
                <div className="relative mb-8 w-64 h-48 flex items-center justify-center">
                  <div className="absolute inset-0 bg-primary-container/20 rounded-xl rotate-3 scale-95 group-hover:rotate-6 transition-transform" />
                  <div className="absolute inset-0 bg-secondary-container/20 rounded-xl -rotate-2 scale-95 group-hover:-rotate-4 transition-transform" />
                  <div className="relative bg-white p-6 rounded-lg editorial-shadow border border-outline-variant/10 w-32 h-44 z-10 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="h-2 w-full bg-surface-container-highest rounded-full" />
                      <div className="h-2 w-3/4 bg-surface-container-highest rounded-full" />
                      <div className="h-2 w-5/6 bg-surface-container-highest rounded-full" />
                    </div>
                    <div className="flex justify-center"><Sparkles className="text-primary" size={32} /></div>
                  </div>
                  <div className="absolute top-0 right-0 translate-x-4 -translate-y-4 bg-primary-container p-3 rounded-full editorial-shadow">
                    <FileText className="text-on-primary-container" size={16} />
                  </div>
                </div>
                <div className="mt-4 flex flex-col items-center gap-4">
                  <button
                    className="bg-primary text-on-primary px-8 py-4 rounded-xl font-headline font-bold text-lg hover:bg-primary-dim transition-all editorial-shadow flex items-center gap-3"
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  >
                    <Upload size={24} /> Upload Textbook PDF
                  </button>
                  <p className="font-label text-sm text-on-surface-variant">PDF up to 50 MB — drag & drop supported</p>
                  {error && <p className="font-label text-sm text-error font-semibold">{error}</p>}
                </div>
              </div>
            </div>
          </section>
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: <Zap size={28} className="text-primary" />, title: 'Rule-Based Splitting', desc: 'Chapter headings, numbered sections, and ALL-CAPS markers are detected to split the textbook.' },
              { icon: <TrendingUp size={28} className="text-secondary" />, title: 'Workload Scoring', desc: 'Reading time, concept density, and formula density are combined into a workload score per section.' },
              { icon: <Lightbulb size={28} className="text-tertiary" />, title: 'AI Goal Enrichment', desc: 'One AI call adds a concise learning goal to each day after the schedule is rule-generated.' },
            ].map(card => (
              <div key={card.title} className="bg-surface-container-low p-6 rounded-xl space-y-3">
                {card.icon}
                <h4 className="font-headline text-base font-bold">{card.title}</h4>
                <p className="text-on-surface-variant text-sm leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </section>
        </div>
        <aside className="lg:col-span-4 lg:sticky lg:top-28 h-fit">
          <div className="bg-surface-container-low rounded-xl overflow-hidden editorial-shadow">
            <div className="bg-primary px-6 py-8 text-on-primary">
              <h2 className="font-headline text-2xl font-bold tracking-tight">Your Library</h2>
              <p className="text-on-primary/80 font-label text-sm mt-1">No textbook loaded yet</p>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-on-surface-variant font-label text-sm italic">Upload a PDF to generate and save your first plan.</p>
              <button onClick={() => setView('library')} className="w-full text-center font-label text-sm font-bold text-primary hover:underline">
                View Saved Plans →
              </button>
            </div>
          </div>
        </aside>
        <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleInputChange} />
      </div>
    );
  }

  // ---- PARSING ----
  if (status === 'parsing') {
    return (
      <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-10 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="w-16 h-16 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <div>
            <h2 className="font-headline text-2xl font-bold text-on-surface mb-1">Parsing Textbook</h2>
            <p className="font-label text-sm text-on-surface-variant">Extracting text and detecting section boundaries…</p>
          </div>
          <div className="space-y-2">
            <ProgressBar progress={parsePercent} className="h-3" />
            <div className="flex justify-between font-label text-xs font-bold text-on-surface-variant uppercase tracking-widest">
              <span>Page {parseProgress.current} of {parseProgress.total || '…'}</span>
              <span>{parsePercent}%</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- CONFIGURING ----
  if (status === 'configuring' && parsedData) {
    const typeCounts = parsedData.sections.reduce(
      (acc, s) => { acc[s.sectionType] = (acc[s.sectionType] ?? 0) + 1; return acc; },
      {} as Record<string, number>
    );
    const totalScore    = parsedData.sections.reduce((s, sec) => s + sec.workloadScore, 0);
    const estMinsPerDay = numDays > 0 ? Math.round(totalScore / numDays) : 0;
    const estHrsPerDay  = Math.round((estMinsPerDay / 45) * 10) / 10;
    const typeColors: Record<string, string> = {
      intro:      'bg-secondary-container text-on-secondary-container',
      conceptual: 'bg-primary-container text-on-primary-container',
      example:    'bg-tertiary-container text-on-tertiary-container',
      advanced:   'bg-error/10 text-error',
    };
    return (
      <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-8">
          <header className="space-y-1">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-secondary" size={28} />
              <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface">Textbook Parsed</h1>
            </div>
            <p className="font-label text-sm text-on-surface-variant pl-1">{parsedData.fileName} — {parsedData.totalPages} pages</p>
          </header>

          {/* Section breakdown */}
          <div className="bg-surface-container-low rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-headline font-bold text-on-surface">Section Breakdown</h3>
              <span className="font-label text-xs text-on-surface-variant">{parsedData.sections.length} sections detected</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(Object.entries(typeCounts) as [string, number][]).map(([type, count]) => (
                <div key={type} className={cn('rounded-lg p-4 text-center', typeColors[type] ?? 'bg-surface-container text-on-surface')}>
                  <div className="font-headline text-2xl font-bold">{count}</div>
                  <div className="font-label text-xs capitalize mt-0.5">{type}</div>
                </div>
              ))}
            </div>
            <div className="border-t border-outline-variant/10 pt-4 grid grid-cols-2 gap-4 font-label text-sm">
              <div>
                <span className="text-on-surface-variant">Est. total reading</span>
                <span className="block font-bold text-on-surface mt-0.5">{Math.round(totalScore / 45 * 10) / 10} hrs</span>
              </div>
              <div>
                <span className="text-on-surface-variant">Overall difficulty</span>
                <span className="block font-bold text-on-surface mt-0.5">
                  {totalScore / parsedData.sections.length > 30 ? 'Heavy' : totalScore / parsedData.sections.length > 15 ? 'Moderate' : 'Light'}
                </span>
              </div>
            </div>
          </div>

          {/* Days input */}
          <div className="bg-surface-container-low rounded-xl p-6 space-y-5">
            <h3 className="font-headline font-bold text-on-surface">Set Your Study Schedule</h3>
            <div className="flex items-center gap-4">
              <label className="font-label text-sm text-on-surface-variant w-36 shrink-0">Study days</label>
              <input type="range" min={1} max={90} value={numDays}
                onChange={(e) => setNumDays(Number(e.target.value))}
                className="flex-1 accent-primary" />
              <input type="number" min={1} max={90} value={numDays}
                onChange={(e) => setNumDays(Math.max(1, Math.min(90, Number(e.target.value))))}
                className="w-16 text-center bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-2 py-1.5 font-headline font-bold text-on-surface text-sm" />
            </div>
            <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 flex items-center justify-between">
              <span className="font-label text-sm text-on-surface-variant">Estimated per day</span>
              <span className="font-headline font-bold text-primary">~{estHrsPerDay} hrs / day</span>
            </div>
          </div>

          <div className="flex gap-4">
            <button onClick={handleGeneratePlan}
              className="flex-1 bg-primary text-on-primary py-4 rounded-xl font-headline font-bold text-lg hover:bg-primary-dim transition-all editorial-shadow flex items-center justify-center gap-3">
              <Sparkles size={22} /> Generate {numDays}-Day Study Plan
            </button>
            <button onClick={() => { setParsedData(null); setStatus('idle'); }}
              className="px-6 py-4 rounded-xl font-label font-bold text-sm text-on-surface-variant border border-outline-variant/20 hover:bg-surface-container-high transition-all">
              Upload Different
            </button>
          </div>
        </div>

        {/* Section list preview */}
        <aside className="lg:col-span-4 lg:sticky lg:top-28 h-fit">
          <div className="bg-surface-container-low rounded-xl overflow-hidden editorial-shadow">
            <div className="bg-secondary px-6 py-5 text-on-secondary">
              <h2 className="font-headline text-lg font-bold">Detected Sections</h2>
              <p className="text-on-secondary/80 font-label text-xs mt-0.5">{parsedData.sections.length} sections · {parsedData.totalPages} pages</p>
            </div>
            <div className="divide-y divide-outline-variant/10 max-h-[65vh] overflow-y-auto">
              {parsedData.sections.map((sec, i) => (
                <div key={i} className="px-5 py-3 flex items-start gap-3 hover:bg-surface-container-high/50 transition-all">
                  <span className={cn('mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0', typeColors[sec.sectionType] ?? 'bg-surface-container text-on-surface')}>
                    {sec.sectionType[0].toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="font-label text-xs font-bold text-on-surface truncate">{sec.title}</p>
                    <p className="font-label text-[10px] text-on-surface-variant">pp. {sec.startPage}–{sec.endPage} · {sec.estimatedReadingMinutes} min read</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    );
  }

  // ---- GENERATING ----
  if (status === 'generating') {
    return (
      <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-10 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-full max-w-md space-y-6 text-center">
          <Sparkles className="text-primary mx-auto animate-pulse" size={48} />
          <div>
            <h2 className="font-headline text-2xl font-bold text-on-surface mb-1">Building Your Schedule</h2>
            <p className="font-label text-sm text-on-surface-variant">Scoring sections, balancing workload, enriching goals with AI…</p>
          </div>
          <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-pulse w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  // ---- SAVED ----
  if (status === 'saved' && parsedData) {
    return (
      <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-10 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="w-20 h-20 bg-secondary-container rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="text-secondary" size={40} />
          </div>
          <div>
            <h2 className="font-headline text-3xl font-bold text-on-surface">Plan Created!</h2>
            <p className="text-on-surface-variant font-label text-sm mt-1">
              <span className="font-bold">{parsedData.fileName.replace(/\.pdf$/i, '')}</span> — {numDays} days · {parsedData.sections.length} sections
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <button onClick={() => setView('library')}
              className="w-full bg-primary text-on-primary py-4 rounded-xl font-headline font-bold text-lg hover:bg-primary-dim transition-all editorial-shadow flex items-center justify-center gap-3">
              <BookOpen size={22} /> View in Library
            </button>
            <button onClick={() => { setParsedData(null); setStatus('idle'); }}
              className="w-full py-3 rounded-xl font-label font-bold text-sm text-on-surface-variant border border-outline-variant/20 hover:bg-surface-container-high transition-all">
              Upload Another Textbook
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

// ---------------------------------------------------------------------------
// PlansView — Library tab: lists + views saved study plans from localStorage
// ---------------------------------------------------------------------------
const DIFF_COLORS: Record<string, string> = {
  light:    'bg-secondary-container text-on-secondary-container',
  moderate: 'bg-tertiary-container text-on-tertiary-container',
  heavy:    'bg-error/10 text-error',
};
const TYPE_COLORS: Record<string, string> = {
  intro:      'bg-secondary-container/60 text-on-secondary-container',
  conceptual: 'bg-primary-container/60 text-on-primary-container',
  example:    'bg-tertiary-container/60 text-on-tertiary-container',
  advanced:   'bg-error/10 text-error',
};

const PlansView = ({
  setView,
  view,
  initialSelectedPlanId,
  onClearSelection,
  onStudyPlan,
}: {
  setView: (v: string) => void;
  view: string;
  initialSelectedPlanId: string | null;
  onClearSelection: () => void;
  onStudyPlan: (planId: string) => void;
}) => {
  const [plans, setPlans]       = useState<SavedStudyPlan[]>([]);
  const [selected, setSelected] = useState<SavedStudyPlan | null>(null);
  const [progress, setProgressState] = useState<StudyProgress | null>(null);

  useEffect(() => {
    loadAllPlans().then(setPlans);
    getStudyProgress().then(setProgressState);
  }, []);

  useEffect(() => {
    if (view === 'library') {
      loadAllPlans().then(setPlans);
      getStudyProgress().then(setProgressState);
    }
  }, [view]);

  useEffect(() => {
    if (initialSelectedPlanId && plans.length > 0) {
      const plan = plans.find((p) => p.id === initialSelectedPlanId);
      if (plan) setSelected(plan);
    }
  }, [initialSelectedPlanId, plans]);

  const handleBackToList = () => {
    setSelected(null);
    onClearSelection();
  };

  const handleDelete = async (id: string) => {
    await deletePlan(id);
    const updated = await loadAllPlans();
    setPlans(updated);
    if (selected?.id === id) {
      setSelected(null);
      onClearSelection();
    }
  };

  // ---- Plan detail ----
  if (selected) {
    const isCurrentPlan = progress?.planId === selected.id;
    return (
      <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-10 space-y-8">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleBackToList}
            className="flex items-center gap-2 font-label text-sm font-bold text-primary hover:underline"
          >
            <ArrowLeft size={16} /> All Plans
          </button>
          <h1 className="font-headline text-3xl font-extrabold text-on-surface">{selected.bookTitle}</h1>
          <span className="ml-auto font-label text-xs text-on-surface-variant mr-4">
            {selected.numDays} days · {selected.totalSections} sections · {new Date(selected.createdAt).toLocaleDateString()}
          </span>
          <button
            onClick={() => onStudyPlan(selected.id)}
            className="shrink-0 bg-primary text-on-primary px-5 py-2.5 rounded-xl font-headline font-bold text-sm hover:bg-primary-dim transition-all editorial-shadow flex items-center gap-2"
          >
            <BookOpen size={16} /> Study This Plan
          </button>
        </div>

        <div className="space-y-4">
          {selected.days.map((day) => {
            const dayIndex0 = day.day - 1;
            const isRead = isCurrentPlan && progress != null && dayIndex0 < progress.dayIndex;
            return (
            <div
              key={day.day}
              className={cn(
                'rounded-xl overflow-hidden editorial-shadow',
                isRead ? 'bg-surface-container-high ring-1 ring-outline-variant/20' : 'bg-surface-container-low'
              )}
            >
              {/* Day header */}
              <div className="px-6 py-4 flex items-center gap-4 border-b border-outline-variant/10">
                <span className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center font-headline text-sm font-bold text-on-primary-container shrink-0">
                  {day.day}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-headline font-bold text-on-surface truncate">{day.mainConceptFocus}</p>
                  <p className="font-label text-xs text-on-surface-variant">{day.sections.length} section{day.sections.length !== 1 ? 's' : ''} · ~{day.estimatedHours} hrs</p>
                </div>
                <span className={cn('px-2 py-0.5 rounded-full font-label text-xs font-bold capitalize', DIFF_COLORS[day.difficulty] ?? '')}>
                  {day.difficulty}
                </span>
              </div>
              {/* Sections */}
              {day.sections.length === 0
                ? <p className="px-6 py-4 font-label text-sm italic text-on-surface-variant">Review day — revisit previous material.</p>
                : (
                  <div className="divide-y divide-outline-variant/5">
                    {day.sections.map((sec, i) => (
                      <div key={i} className="px-6 py-3 flex items-start gap-3">
                        <span className={cn('mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0', TYPE_COLORS[sec.sectionType] ?? '')}>
                          {sec.sectionType[0].toUpperCase()}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-label text-sm font-bold text-on-surface">{sec.title}</p>
                          <p className="font-label text-xs text-on-surface-variant">pp. {sec.startPage}–{sec.endPage} · {sec.estimatedReadingMinutes} min read</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ---- Plan list ----
  return (
    <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-10 space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface">Your Library</h1>
          <p className="text-on-surface-variant font-label text-sm mt-1">{plans.length} saved plan{plans.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setView('curate')}
          className="flex items-center gap-2 bg-primary text-on-primary px-5 py-3 rounded-xl font-headline font-bold text-sm hover:bg-primary-dim transition-all editorial-shadow">
          <Plus size={18} /> New Plan
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
          <BookOpen className="text-outline-variant" size={48} />
          <p className="font-headline text-xl font-bold text-on-surface">No plans yet</p>
          <p className="text-on-surface-variant font-label text-sm">Upload a textbook to generate your first study plan.</p>
          <button onClick={() => setView('curate')}
            className="mt-2 bg-primary text-on-primary px-6 py-3 rounded-xl font-headline font-bold text-sm hover:bg-primary-dim transition-all">
            Upload Textbook
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isRead = progress?.planId === plan.id;
            return (
            <div
              key={plan.id}
              className={cn(
                'rounded-xl overflow-hidden editorial-shadow hover:shadow-lg transition-all cursor-pointer group',
                isRead ? 'bg-surface-container-high ring-1 ring-outline-variant/30' : 'bg-surface-container-low'
              )}
              onClick={() => setSelected(plan)}>
              <div className="bg-primary px-6 py-5 text-on-primary">
                <h3 className="font-headline text-lg font-bold truncate">{plan.bookTitle}</h3>
                <p className="text-on-primary/70 font-label text-xs mt-0.5">{new Date(plan.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-surface-container-lowest rounded-lg p-3 text-center">
                    <div className="font-headline text-2xl font-bold text-on-surface">{plan.numDays}</div>
                    <div className="font-label text-xs text-on-surface-variant">days</div>
                  </div>
                  <div className="bg-surface-container-lowest rounded-lg p-3 text-center">
                    <div className="font-headline text-2xl font-bold text-on-surface">{plan.totalSections}</div>
                    <div className="font-label text-xs text-on-surface-variant">sections</div>
                  </div>
                </div>
                <p className="font-label text-xs text-on-surface-variant italic truncate">Day 1: {plan.days[0]?.mainConceptFocus ?? '—'}</p>
                <div className="flex items-center justify-between">
                  <button onClick={() => setSelected(plan)}
                    className="font-label text-xs font-bold text-primary group-hover:underline flex items-center gap-1">
                    View Plan <ArrowRight size={12} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(plan.id); }}
                    className="font-label text-xs text-on-surface-variant hover:text-error transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Study Today — resume from last position (or first unread day)
// ---------------------------------------------------------------------------
const STUDY_TODAY_DIFF_COLORS: Record<string, string> = {
  light: 'bg-secondary-container text-on-secondary-container',
  moderate: 'bg-tertiary-container text-on-tertiary-container',
  heavy: 'bg-error/10 text-error',
};
const STUDY_TODAY_TYPE_COLORS: Record<string, string> = {
  intro: 'bg-secondary-container/60 text-on-secondary-container',
  conceptual: 'bg-primary-container/60 text-on-primary-container',
  example: 'bg-tertiary-container/60 text-on-tertiary-container',
  advanced: 'bg-error/10 text-error',
};

const StudyTodayView = ({ setView }: { setView: (v: string) => void }) => {
  const [progress, setProgress] = useState<StudyProgress | null>(null);
  const [plans, setPlans] = useState<SavedStudyPlan[]>([]);
  const [selectedPlanIdLocal, setSelectedPlanIdLocal] = useState<string | null>(null);

  useEffect(() => {
    getStudyProgress().then(setProgress);
    loadAllPlans().then(setPlans);
  }, []);

  const resolved = (() => {
    if (plans.length === 0) return null;
    // Use explicitly selected plan, then progress, then first plan
    const plan = selectedPlanIdLocal
      ? plans.find(p => p.id === selectedPlanIdLocal) ?? plans[0]
      : progress
        ? plans.find((p) => p.id === progress.planId) ?? plans[0]
        : plans[0];
    const dayIndex = plan && progress?.planId === plan.id ? progress.dayIndex : 0;
    const day = plan?.days[dayIndex] ?? plan?.days[0];
    return plan && day ? { plan, day, dayIndex } : plan ? { plan, day: plan.days[0], dayIndex: 0 } : null;
  })();

  const handleCompleteToday = async () => {
    if (!resolved) return;
    const { plan, day, dayIndex } = resolved;
    const estMins = Math.round(day.estimatedHours * 60);
    await addStudiedMinutes(estMins);
    await logActivity('study', `Completed Day ${day.day}`, `Finished ${day.sections.length} section(s) in "${plan.bookTitle}" (~${day.estimatedHours}h).`);
    const nextIndex = dayIndex + 1;
    if (nextIndex < plan.days.length) {
      await setStudyProgress({ planId: plan.id, dayIndex: nextIndex });
      setProgress({ planId: plan.id, dayIndex: nextIndex });
    } else {
      await setStudyProgress({ planId: plan.id, dayIndex: 0 });
      setProgress({ planId: plan.id, dayIndex: 0 });
    }
  };

  if (plans.length === 0) {
    return (
      <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-10 flex flex-col items-center justify-center min-h-[50vh] text-center">
        <BookOpen className="text-on-surface-variant/40 mb-6" size={56} />
        <h1 className="font-headline text-3xl font-bold text-on-surface mb-2">Study Today</h1>
        <p className="text-on-surface-variant font-label text-sm max-w-md mb-8">
          You don&apos;t have any study plans yet. Upload a textbook to create a plan, then come back here to pick up where you left off.
        </p>
        <button
          onClick={() => setView('curate')}
          className="bg-primary text-on-primary px-6 py-3 rounded-xl font-headline font-bold text-sm hover:bg-primary-dim transition-all editorial-shadow"
        >
          Upload Textbook
        </button>
      </div>
    );
  }

  if (!resolved) {
    return (
      <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-10">
        <h1 className="font-headline text-3xl font-bold text-on-surface mb-4">Study Today</h1>
        <p className="text-on-surface-variant font-label text-sm">No day to show. Open a plan from the Library to start.</p>
        <button onClick={() => setView('library')} className="mt-4 text-primary font-label font-bold hover:underline">
          Go to Library →
        </button>
      </div>
    );
  }

  const { plan, day, dayIndex } = resolved;
  const isLastDay = dayIndex >= plan.days.length - 1;

  return (
    <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-10 space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface">Study Today</h1>
          <p className="text-on-surface-variant font-label text-sm mt-1">
            {plan.bookTitle} · Day {day.day} of {plan.numDays}
          </p>
        </div>
        {plans.length > 1 && (
          <select
            value={plan.id}
            onChange={(e) => {
              setSelectedPlanIdLocal(e.target.value);
              setStudyProgress({ planId: e.target.value, dayIndex: 0 }).then(() => {
                setProgress({ planId: e.target.value, dayIndex: 0 });
              });
            }}
            className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-4 py-2.5 font-label text-sm text-on-surface focus:ring-2 focus:ring-primary/30 focus:outline-none shrink-0"
          >
            {plans.map(p => (
              <option key={p.id} value={p.id}>{p.bookTitle}</option>
            ))}
          </select>
        )}
      </header>

      <div className="bg-surface-container-low rounded-xl overflow-hidden editorial-shadow">
        <div className="px-6 py-5 flex items-center gap-4 border-b border-outline-variant/10 bg-primary/5">
          <span className="w-12 h-12 rounded-xl bg-primary-container flex items-center justify-center font-headline text-lg font-bold text-on-primary-container shrink-0">
            {day.day}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-headline text-xl font-bold text-on-surface truncate">{day.mainConceptFocus}</p>
            <p className="font-label text-sm text-on-surface-variant">
              {day.sections.length} section{day.sections.length !== 1 ? 's' : ''} · ~{day.estimatedHours} hrs
            </p>
          </div>
          <span className={cn('px-3 py-1 rounded-full font-label text-xs font-bold capitalize', STUDY_TODAY_DIFF_COLORS[day.difficulty] ?? '')}>
            {day.difficulty}
          </span>
        </div>
        {day.sections.length === 0 ? (
          <p className="px-6 py-8 font-label text-sm italic text-on-surface-variant">Review day — revisit previous material.</p>
        ) : (
          <div className="divide-y divide-outline-variant/5">
            {day.sections.map((sec, i) => (
              <div key={i} className="px-6 py-4 flex items-start gap-3">
                <span className={cn('mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0', STUDY_TODAY_TYPE_COLORS[sec.sectionType] ?? '')}>
                  {sec.sectionType[0].toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-label text-sm font-bold text-on-surface">{sec.title}</p>
                  <p className="font-label text-xs text-on-surface-variant">pp. {sec.startPage}–{sec.endPage} · {sec.estimatedReadingMinutes} min read</p>
                </div>
                <span className={cn('shrink-0 px-2 py-0.5 rounded font-label text-[10px] font-bold', STUDY_TODAY_DIFF_COLORS[day.difficulty] ?? '')}>
                  {sec.workloadScore} pts
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="px-6 py-5 border-t border-outline-variant/10 flex justify-end">
          <button
            type="button"
            onClick={handleCompleteToday}
            className="bg-primary text-on-primary px-6 py-3 rounded-xl font-headline font-bold text-sm hover:bg-primary-dim transition-all editorial-shadow"
          >
            {isLastDay ? 'Finish day · Start over' : 'Mark as done · Next day'}
          </button>
        </div>
      </div>
    </div>
  );
};

const LibraryView = ({ items }: { items: LibraryItem[] }) => {
  return (
    <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-10">
      <header className="mb-12">
        <h1 className="font-headline text-5xl font-extrabold tracking-tight text-on-surface">Your Library</h1>
        <p className="text-xl text-on-surface-variant mt-2 italic font-body">Access your deconstructed textbooks and study materials.</p>
      </header>

      {items.length === 0 ? (
        <div className="bg-surface-container-low rounded-2xl p-20 text-center border-2 border-dashed border-outline-variant/20">
          <Library size={64} className="mx-auto text-on-surface-variant/20 mb-6" />
          <h3 className="font-headline text-2xl font-bold text-on-surface">Your library is empty</h3>
          <p className="text-on-surface-variant mt-2">Upload your first textbook in the Curate section to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {items.map((item) => (
            <div 
              key={item.id}
              onClick={() => window.open(item.path, '_blank')}
              className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 hover:border-primary/30 transition-all cursor-pointer group editorial-shadow"
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <FileText className="text-primary" />
              </div>
              <h3 className="font-headline text-lg font-bold text-on-surface mb-1 truncate" title={item.name}>
                {item.name}
              </h3>
              <p className="text-[10px] text-on-surface-variant font-label uppercase tracking-widest mb-6">
                {(item.size / (1024 * 1024)).toFixed(2)} MB • {new Date(item.uploadedAt).toLocaleDateString()}
              </p>
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest">
                <span>Open Resource</span>
                <Maximize2 size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const AISummary = ({ context, aiEnabled, sectionTitle, bookTitle }: { context?: string; aiEnabled: boolean; sectionTitle?: string; bookTitle?: string }) => {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset summary when section changes
  useEffect(() => { setSummary(null); }, [sectionTitle]);

  const handleGenerate = async () => {
    if (!aiEnabled) {
      setSummary("AI Assistance is disabled. Enable it in Settings to generate summaries.");
      return;
    }
    setLoading(true);
    try {
      const result = await generateScholarSummary(
        sectionTitle ?? 'Current Section',
        context ?? '',
        bookTitle ?? 'Textbook'
      );
      setSummary(result ?? "Could not generate summary. Check your API key in .env.");
    } catch {
      setSummary("Failed to connect to AI scholar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-12 p-8 bg-primary-container/10 rounded-xl border border-primary/10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Sparkles className="text-primary" />
          <h3 className="font-headline font-bold text-on-surface">AI Scholar Summary</h3>
        </div>
        {!summary && !loading && (
          <button onClick={handleGenerate} className="text-sm font-label font-bold text-primary hover:underline">
            Generate Summary
          </button>
        )}
      </div>
      {loading && (
        <div className="flex items-center gap-3 text-on-surface-variant italic">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span>Analyzing "{sectionTitle ?? 'section'}"...</span>
        </div>
      )}
      {summary && (
        <div className="prose prose-sm prose-primary max-w-none text-on-surface-variant leading-relaxed">
          <p className="whitespace-pre-wrap">{summary}</p>
        </div>
      )}
    </div>
  );
};

const StudyView = ({ setView, aiEnabled, activePlanId }: { setView: (v: string) => void; aiEnabled: boolean; activePlanId?: string | null }) => {
  const [plans, setPlans] = useState<SavedStudyPlan[]>([]);
  const [progress, setProgressState] = useState<StudyProgress | null>(null);

  useEffect(() => {
    loadAllPlans().then(setPlans);
    getStudyProgress().then(setProgressState);
  }, []);

  // If a specific plan was requested, use it; otherwise fall back to progress or first plan
  const plan = activePlanId
    ? plans.find(p => p.id === activePlanId) ?? plans[0]
    : progress ? plans.find(p => p.id === progress.planId) ?? plans[0] : plans[0];
  const dayIndex = plan && progress?.planId === plan.id ? progress.dayIndex : 0;
  const day = plan?.days[dayIndex];
  const allSections = plan?.days.flatMap(d => d.sections) ?? [];
  const completedSections = plan ? plan.days.slice(0, dayIndex).flatMap(d => d.sections).length : 0;
  const totalSections = allSections.length;
  const progressPct = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;

  const [sideTab, setSideTab] = useState<'toc' | 'quiz' | 'flashcards'>('toc');
  const [selectedSectionIdx, setSelectedSectionIdx] = useState(0);
  const currentSection = day?.sections[selectedSectionIdx] ?? day?.sections[0];

  // AI Quiz state
  const [aiQuizzes, setAiQuizzes] = useState<GeneratedQuiz[]>([]);
  const [aiQuizIdx, setAiQuizIdx] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [quizRevealed, setQuizRevealed] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);

  // Flashcard state
  const [flashcards, setFlashcards] = useState<GeneratedFlashcard[]>([]);
  const [flashIdx, setFlashIdx] = useState(0);
  const [flashRevealed, setFlashRevealed] = useState(false);
  const [flashLoading, setFlashLoading] = useState(false);

  // Load AI quizzes when section changes
  useEffect(() => {
    setAiQuizzes([]);
    setAiQuizIdx(0);
    setQuizAnswer(null);
    setQuizRevealed(false);
    setFlashcards([]);
    setFlashIdx(0);
    setFlashRevealed(false);
    if (currentSection?.textExcerpt && aiEnabled) {
      setQuizLoading(true);
      generateQuizzes(currentSection.title, currentSection.textExcerpt, 3)
        .then(qs => { setAiQuizzes(qs); setQuizLoading(false); })
        .catch(() => setQuizLoading(false));
      setFlashLoading(true);
      generateFlashcards(currentSection.title, currentSection.textExcerpt, 5)
        .then(fc => { setFlashcards(fc); setFlashLoading(false); })
        .catch(() => setFlashLoading(false));
    }
  }, [currentSection?.title, aiEnabled]);

  const currentQuiz = aiQuizzes[aiQuizIdx];

  if (!plan) {
    return (
      <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-10 flex flex-col items-center justify-center min-h-[50vh] text-center">
        <BookOpen className="text-on-surface-variant/40 mb-6" size={56} />
        <h1 className="font-headline text-3xl font-bold text-on-surface mb-2">Start Reading</h1>
        <p className="text-on-surface-variant font-label text-sm max-w-md mb-8">Upload a textbook and generate a study plan first, then come back here to read.</p>
        <button onClick={() => setView('curate')} className="bg-primary text-on-primary px-6 py-3 rounded-xl font-headline font-bold text-sm hover:bg-primary-dim transition-all editorial-shadow">Upload Textbook</button>
      </div>
    );
  }

  return (
  <div className="flex min-h-[calc(100vh-4rem)]">
    <aside className="w-72 bg-surface-container-low border-r border-outline-variant/5 flex flex-col sticky top-16 h-[calc(100vh-4rem)] hidden xl:flex">
      <div className="p-8">
        <div className="mb-8">
          <h2 className="font-headline text-2xl font-bold text-on-surface leading-tight">{plan.bookTitle}</h2>
          <p className="font-label text-xs text-on-surface-variant mt-1">Day {(day?.day ?? 1)} of {plan.numDays}</p>
        </div>
        <nav className="space-y-1">
          <button onClick={() => setSideTab('toc')} className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group", sideTab === 'toc' ? "bg-surface-container-lowest text-primary editorial-shadow" : "text-on-surface-variant hover:bg-surface-container-high")}>
            <BookOpen size={20} className={cn(sideTab === 'toc' && "fill-primary/10")} />
            <span className={cn("font-label text-sm", sideTab === 'toc' ? "font-bold" : "font-medium")}>Table of Contents</span>
          </button>
          <button onClick={() => setSideTab('quiz')} className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group", sideTab === 'quiz' ? "bg-surface-container-lowest text-primary editorial-shadow" : "text-on-surface-variant hover:bg-surface-container-high")}>
            <HelpCircle size={20} className={cn(sideTab === 'quiz' && "fill-primary/10")} />
            <span className={cn("font-label text-sm", sideTab === 'quiz' ? "font-bold" : "font-medium")}>Mini-Quizzes {aiQuizzes.length > 0 ? `(${aiQuizzes.length})` : ''}</span>
          </button>
          <button onClick={() => setSideTab('flashcards')} className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group", sideTab === 'flashcards' ? "bg-surface-container-lowest text-primary editorial-shadow" : "text-on-surface-variant hover:bg-surface-container-high")}>
            <FileText size={20} className={cn(sideTab === 'flashcards' && "fill-primary/10")} />
            <span className={cn("font-label text-sm", sideTab === 'flashcards' ? "font-bold" : "font-medium")}>Flashcards {flashcards.length > 0 ? `(${flashcards.length})` : ''}</span>
          </button>
        </nav>
        {sideTab === 'toc' && day && (
          <div className="mt-6 space-y-1">
            {day.sections.map((sec, i) => (
              <button key={i} onClick={() => setSelectedSectionIdx(i)}
                className={cn("w-full text-left px-3 py-2 rounded-lg text-xs font-label transition-all",
                  i === selectedSectionIdx ? "bg-primary/10 text-primary font-bold" : "text-on-surface-variant hover:bg-surface-container-high"
                )}>
                {sec.title}
              </button>
            ))}
          </div>
        )}
        {sideTab === 'flashcards' && (
          <div className="mt-6 space-y-2">
            {flashLoading ? (
              <div className="flex items-center gap-2 text-on-surface-variant text-xs italic px-3">
                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Generating flashcards...
              </div>
            ) : flashcards.length === 0 ? (
              <p className="text-xs text-on-surface-variant italic px-3">{aiEnabled ? 'No flashcards yet.' : 'Enable AI Assistance in Settings.'}</p>
            ) : flashcards.map((fc, i) => (
              <button key={i} onClick={() => { setFlashIdx(i); setFlashRevealed(false); }}
                className={cn("w-full text-left px-3 py-2 rounded-lg text-xs font-label transition-all",
                  i === flashIdx ? "bg-primary/10 text-primary font-bold" : "text-on-surface-variant hover:bg-surface-container-high"
                )}>
                {fc.term}
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
    <main className="flex-1 overflow-y-auto bg-surface pb-24">
      <div className="max-w-4xl mx-auto px-10 pt-10 mb-16">
        <div className="flex items-end justify-between mb-3">
          <div>
            <span className="font-label text-[10px] uppercase tracking-widest text-primary font-bold">Current Progress</span>
            <h4 className="font-headline text-lg font-bold text-on-surface">Course Completion</h4>
          </div>
          <span className="font-label text-xs text-on-surface-variant font-medium">{completedSections} of {totalSections} sections finished</span>
        </div>
        <ProgressBar progress={progressPct} className="h-1.5" />
      </div>
      <article className="max-w-3xl mx-auto px-10">
        <header className="mb-12">
          <h1 className="font-headline text-5xl font-extrabold text-on-surface mb-6 leading-[1.1]">{currentSection?.title ?? 'Study Session'}</h1>
          <div className="flex items-center gap-4 text-on-surface-variant font-label text-sm italic border-l-2 border-primary/20 pl-4">
            <span>Reading Time: {currentSection?.estimatedReadingMinutes ?? 0} mins</span>
            <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
            <span>Type: {currentSection?.sectionType ?? 'N/A'}</span>
            <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
            <span>pp. {currentSection?.startPage}–{currentSection?.endPage}</span>
          </div>
        </header>
        <div className="space-y-8 text-lg text-on-surface leading-relaxed">
          {currentSection?.textExcerpt ? (
            currentSection.textExcerpt.split('\n\n').filter(Boolean).map((para, i) => (
              <p key={i}>{para}</p>
            ))
          ) : (
            <p className="italic text-on-surface-variant">
              No text content available for this section. Open the original PDF to read pages {currentSection?.startPage}–{currentSection?.endPage}.
            </p>
          )}

          {/* AI-Generated Mini-Quiz */}
          {currentSection && (
          <section className="my-16 p-10 bg-surface-container-low rounded-xl border border-outline-variant/5 editorial-shadow">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center">
                <HelpCircle size={20} className="text-on-primary-container" />
              </div>
              <h3 className="font-headline text-sm font-bold text-primary tracking-wide uppercase">
                Mini-Quiz: Understanding Check
                {aiQuizzes.length > 1 && <span className="ml-2 text-on-surface-variant font-normal">({aiQuizIdx + 1}/{aiQuizzes.length})</span>}
              </h3>
            </div>
            {quizLoading ? (
              <div className="flex items-center gap-3 text-on-surface-variant italic py-4">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span>Generating comprehension questions...</span>
              </div>
            ) : !currentQuiz ? (
              <p className="text-on-surface-variant italic">{aiEnabled ? 'No quiz questions could be generated for this section.' : 'Enable AI Assistance in Settings to generate quiz questions.'}</p>
            ) : (
              <>
                <p className="font-body text-xl font-medium text-on-surface mb-8">{currentQuiz.question}</p>
                <div className="space-y-3">
                  {currentQuiz.options.map((opt, idx) => {
                    const isSelected = quizAnswer === idx;
                    const isCorrect = idx === currentQuiz.correctIndex;
                    const showCorrect = quizRevealed && isCorrect;
                    const showWrong = quizRevealed && isSelected && !isCorrect;
                    return (
                    <button
                      key={idx}
                      onClick={async () => {
                        if (quizRevealed) return;
                        setQuizAnswer(idx);
                        setQuizRevealed(true);
                        const correct = idx === currentQuiz.correctIndex;
                        logActivity('quiz', correct ? 'Quiz Correct' : 'Quiz Attempt', `${correct ? 'Correctly answered' : 'Attempted'} quiz for "${currentSection.title}".`);
                        saveQuizScore({ planId: plan.id, sectionTitle: currentSection.title, correct: correct ? 1 : 0, total: 1, timestamp: new Date().toISOString() });
                      }}
                      className={cn(
                        "w-full text-left p-4 rounded-lg border transition-all flex items-center gap-4 group",
                        showCorrect ? "bg-green-100 border-green-400 dark:bg-green-900/30 dark:border-green-600"
                        : showWrong ? "bg-red-100 border-red-400 dark:bg-red-900/30 dark:border-red-600"
                        : isSelected ? "bg-primary/10 border-primary/30"
                        : "bg-surface-container-lowest border-outline-variant/10 hover:border-primary/40 hover:bg-primary/5"
                      )}
                    >
                      <span className={cn(
                        "w-6 h-6 rounded-full border flex items-center justify-center font-label text-[10px] font-bold transition-colors",
                        showCorrect ? "bg-green-500 border-green-500 text-white"
                        : showWrong ? "bg-red-500 border-red-500 text-white"
                        : isSelected ? "bg-primary border-primary text-on-primary"
                        : "border-outline text-on-surface-variant group-hover:border-primary group-hover:text-primary"
                      )}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className={cn(
                        "font-label text-sm transition-colors flex-1",
                        (showCorrect || (isSelected && !quizRevealed)) ? "text-on-surface font-semibold" : "text-on-surface-variant group-hover:text-on-surface"
                      )}>
                        {opt}
                      </span>
                      {showCorrect && <CheckCircle2 size={16} className="ml-auto text-green-600" />}
                      {showWrong && <X size={16} className="ml-auto text-red-500" />}
                    </button>
                    );
                  })}
                </div>
                {quizRevealed && (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm text-on-surface-variant bg-surface-container-high/50 p-3 rounded-lg">
                      <span className="font-bold">Explanation: </span>{currentQuiz.explanation}
                    </p>
                    <div className="flex gap-3">
                      {aiQuizzes.length > 1 && (
                        <button
                          onClick={() => { setAiQuizIdx(i => (i + 1) % aiQuizzes.length); setQuizAnswer(null); setQuizRevealed(false); }}
                          className="text-sm font-label font-bold text-primary hover:underline"
                        >
                          Next Question →
                        </button>
                      )}
                      <button
                        onClick={() => { setQuizAnswer(null); setQuizRevealed(false); }}
                        className="text-sm font-label font-bold text-on-surface-variant hover:underline"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
          )}

          {/* Flashcard Section (inline) */}
          {flashcards.length > 0 && (
          <section className="my-12 p-8 bg-tertiary-container/10 rounded-xl border border-tertiary/10">
            <div className="flex items-center gap-3 mb-6">
              <FileText className="text-tertiary" size={20} />
              <h3 className="font-headline text-sm font-bold text-tertiary tracking-wide uppercase">Flashcard: Key Terms ({flashIdx + 1}/{flashcards.length})</h3>
            </div>
            <div
              onClick={() => setFlashRevealed(r => !r)}
              className="cursor-pointer min-h-[120px] flex flex-col items-center justify-center text-center p-6 bg-surface-container-lowest rounded-xl border border-outline-variant/10 editorial-shadow hover:shadow-lg transition-all"
            >
              <p className="font-headline text-2xl font-bold text-on-surface mb-2">{flashcards[flashIdx]?.term}</p>
              {flashRevealed ? (
                <p className="text-base text-on-surface-variant leading-relaxed">{flashcards[flashIdx]?.definition}</p>
              ) : (
                <p className="text-sm text-on-surface-variant italic">Click to reveal definition</p>
              )}
            </div>
            <div className="flex justify-between mt-4">
              <button disabled={flashIdx === 0} onClick={() => { setFlashIdx(i => i - 1); setFlashRevealed(false); }}
                className="text-sm font-label font-bold text-primary hover:underline disabled:opacity-30">← Previous</button>
              <button disabled={flashIdx >= flashcards.length - 1} onClick={() => { setFlashIdx(i => i + 1); setFlashRevealed(false); }}
                className="text-sm font-label font-bold text-primary hover:underline disabled:opacity-30">Next →</button>
            </div>
          </section>
          )}

          <AISummary context={currentSection?.textExcerpt} aiEnabled={aiEnabled} sectionTitle={currentSection?.title} bookTitle={plan.bookTitle} />

          <blockquote className="my-12 pl-8 border-l-4 border-primary italic font-light text-2xl text-on-surface-variant font-body">
            "Understanding requires not just reading, but actively engaging with the material."
          </blockquote>

          {/* Section navigation */}
          {day && day.sections.length > 1 && (
            <div className="flex justify-between pt-8 border-t border-outline-variant/10">
              <button
                disabled={selectedSectionIdx === 0}
                onClick={() => setSelectedSectionIdx(i => i - 1)}
                className="flex items-center gap-2 text-sm font-label font-bold text-primary hover:underline disabled:opacity-30 disabled:no-underline"
              >
                <ArrowLeft size={16} /> Previous Section
              </button>
              <button
                disabled={selectedSectionIdx >= day.sections.length - 1}
                onClick={() => setSelectedSectionIdx(i => i + 1)}
                className="flex items-center gap-2 text-sm font-label font-bold text-primary hover:underline disabled:opacity-30 disabled:no-underline"
              >
                Next Section <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* Inline PDF Viewer */}
          {plan.pdfFileName && currentSection && (
            <section className="my-12">
              <div className="flex items-center gap-3 mb-4">
                <Maximize2 size={20} className="text-primary" />
                <h3 className="font-headline text-sm font-bold text-primary tracking-wide uppercase">Original PDF — Pages {currentSection.startPage}–{currentSection.endPage}</h3>
              </div>
              <PdfViewer
                pdfUrl={`/api/files/${plan.pdfFileName}`}
                startPage={currentSection.startPage}
                endPage={currentSection.endPage}
              />
            </section>
          )}
        </div>
      </article>
    </main>
  </div>
  );
};

const PracticeView = ({ setView, aiEnabled }: { setView: (v: string) => void; aiEnabled: boolean }) => {
  const [plans, setPlans] = useState<SavedStudyPlan[]>([]);
  const [progress, setProgressState] = useState<StudyProgress | null>(null);
  const [streak, setStreak] = useState<number>(0);
  const [quizScores, setQuizScores] = useState<QuizScore[]>([]);

  useEffect(() => {
    loadAllPlans().then(setPlans);
    getStudyProgress().then(setProgressState);
    getStreak().then(setStreak);
    loadQuizScores().then(setQuizScores);
  }, []);

  const allSections = plans.flatMap(p => p.days.flatMap(d => d.sections));
  const plan = progress ? plans.find(p => p.id === progress.planId) : plans[0];

  // Unique topics for sidebar
  const topics = [...new Set(allSections.map(s => s.chapterTitle))];
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  // Set initial topic once plans load
  useEffect(() => {
    if (topics.length > 0 && selectedTopic === null) {
      setSelectedTopic(topics[0]);
    }
  }, [plans]);

  const topicSections = selectedTopic ? allSections.filter(s => s.chapterTitle === selectedTopic) : allSections;

  // AI-generated questions
  const [aiQuestions, setAiQuestions] = useState<GeneratedQuiz[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [qIdx, setQIdx] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [quizRevealed, setQuizRevealed] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  // Generate questions when topic changes
  useEffect(() => {
    setAiQuestions([]);
    setQIdx(0);
    setQuizAnswer(null);
    setQuizRevealed(false);
    if (topicSections.length > 0 && aiEnabled) {
      setAiLoading(true);
      // Generate from multiple sections for variety
      const sectionsWithText = topicSections.filter(s => s.textExcerpt);
      const combined = sectionsWithText.map(s => `Section "${s.title}":\n${s.textExcerpt?.slice(0, 500)}`).join('\n\n');
      if (combined) {
        generateQuizzes(selectedTopic ?? 'Practice', combined, 5)
          .then(qs => { setAiQuestions(qs); setAiLoading(false); })
          .catch(() => setAiLoading(false));
      } else {
        setAiLoading(false);
      }
    }
  }, [selectedTopic, aiEnabled]);

  const currentQ = aiQuestions[qIdx];
  const totalQ = aiQuestions.length;

  // Focus suggestion from quiz scores
  const wrongTopics = quizScores.filter(s => s.correct === 0).map(s => s.sectionTitle);
  const focusSuggestion = wrongTopics.length > 0
    ? `Based on your quiz results, review "${wrongTopics[0]}". You missed questions in this area.`
    : 'You\'re doing great! Keep practicing to maintain your knowledge.';

  if (allSections.length === 0) {
    return (
      <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-10 flex flex-col items-center justify-center min-h-[50vh] text-center">
        <HelpCircle className="text-on-surface-variant/40 mb-6" size={56} />
        <h1 className="font-headline text-3xl font-bold text-on-surface mb-2">Practice Laboratory</h1>
        <p className="text-on-surface-variant font-label text-sm max-w-md mb-8">Upload a textbook and generate a study plan to unlock practice questions.</p>
        <button onClick={() => setView('curate')} className="bg-primary text-on-primary px-6 py-3 rounded-xl font-headline font-bold text-sm hover:bg-primary-dim transition-all editorial-shadow">Upload Textbook</button>
      </div>
    );
  }

  return (
  <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-10">
    <div className="flex flex-col lg:flex-row justify-between items-end gap-8 mb-12">
      <div className="max-w-xl">
        <h1 className="font-headline text-5xl font-extrabold tracking-tight text-on-surface mb-4">Practice <span className="text-primary italic font-body font-light">Laboratory</span></h1>
        <p className="font-body text-xl text-on-surface-variant leading-relaxed">Refine your understanding through targeted challenges. The path to mastery is built on consistent repetition and focused analysis.</p>
      </div>
      <div className="bg-surface-container-lowest p-6 rounded-xl shadow-xl shadow-on-surface/5 w-full lg:w-80 border border-outline-variant/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame className="text-error" size={20} />
            <span className="font-headline font-bold text-lg">{streak || 0} Day Streak</span>
          </div>
          {streak >= 3 && <span className="font-label text-xs font-bold bg-secondary-container px-2 py-1 rounded-full text-on-secondary-container">Keep it up!</span>}
        </div>
        <div className="space-y-2">
          <div className="flex justify-between font-label text-[10px] uppercase font-bold text-on-surface-variant">
            <span>Session Score</span>
            <span>{score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0}%</span>
          </div>
          <ProgressBar progress={score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0} className="h-1.5" />
          <p className="font-body text-xs italic text-on-surface-variant">{score.correct} of {score.total} correct this session</p>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/15">
          <h3 className="font-headline font-bold text-sm uppercase tracking-widest text-on-surface mb-6">Topic Selection</h3>
          <div className="space-y-3">
            {topics.map(topic => (
              <button key={topic} onClick={() => setSelectedTopic(topic)}
                className={cn("w-full flex items-center justify-between p-4 rounded-lg text-left group transition-all",
                  selectedTopic === topic ? "bg-surface-container-lowest border border-primary/20" : "bg-surface-container-lowest/50 hover:bg-surface-container-lowest"
                )}>
                <span className={cn("font-headline text-sm", selectedTopic === topic ? "font-bold text-primary" : "font-medium text-on-surface-variant")}>{topic}</span>
                {selectedTopic === topic ? <CheckCircle2 size={16} className="text-primary" /> : <ChevronRight size={16} className="text-outline-variant group-hover:text-primary" />}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-primary p-6 rounded-xl text-on-primary">
          <Lightbulb className="mb-4" />
          <h4 className="font-headline font-bold text-lg mb-2">Focus Suggestion</h4>
          <p className="font-body text-sm leading-relaxed opacity-90">{focusSuggestion}</p>
        </div>
      </div>
      <div className="lg:col-span-8">
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 overflow-hidden">
          <div className="bg-surface-container-high/50 px-8 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <span className="font-label text-xs font-bold text-primary tracking-widest uppercase">
                {totalQ > 0 ? `Question ${qIdx + 1} of ${totalQ}` : 'Practice Mode'}
              </span>
              <div className="h-1 w-1 rounded-full bg-outline-variant"></div>
              <span className="font-label text-xs font-bold text-on-surface-variant uppercase tracking-widest">{selectedTopic ?? ''}</span>
            </div>
            <div className="flex gap-2">
              <Bookmark size={20} className="text-on-surface-variant hover:text-primary cursor-pointer" />
              <Flag size={20} className="text-on-surface-variant hover:text-primary cursor-pointer" />
            </div>
          </div>
          <div className="p-12">
            {aiLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-on-surface-variant italic font-label">Generating practice questions from your textbook...</p>
              </div>
            ) : !currentQ ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                <HelpCircle className="text-on-surface-variant/30" size={48} />
                <p className="text-on-surface-variant font-label">{aiEnabled ? 'No questions could be generated. Try a different topic.' : 'Enable AI Assistance in Settings to generate practice questions.'}</p>
              </div>
            ) : (
              <>
                <h2 className="font-body text-3xl leading-snug text-on-surface mb-10">{currentQ.question}</h2>
                <div className="space-y-3 max-w-xl mx-auto">
                  {currentQ.options.map((opt, idx) => {
                    const isSelected = quizAnswer === idx;
                    const isCorrect = idx === currentQ.correctIndex;
                    const showCorrect = quizRevealed && isCorrect;
                    const showWrong = quizRevealed && isSelected && !isCorrect;
                    return (
                    <button
                      key={idx}
                      onClick={async () => {
                        if (quizRevealed) return;
                        setQuizAnswer(idx);
                        setQuizRevealed(true);
                        const correct = idx === currentQ.correctIndex;
                        setScore(s => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }));
                        recordPracticeDay();
                        logActivity('practice', correct ? 'Correct Answer' : 'Practice Attempt', `${correct ? 'Correctly answered' : 'Attempted'} practice question on "${selectedTopic}".`);
                        saveQuizScore({ planId: plan?.id ?? '', sectionTitle: selectedTopic ?? '', correct: correct ? 1 : 0, total: 1, timestamp: new Date().toISOString() });
                      }}
                      className={cn(
                        "w-full text-left p-4 rounded-lg border transition-all flex items-center gap-4 group",
                        showCorrect ? "bg-green-100 border-green-400 dark:bg-green-900/30 dark:border-green-600"
                        : showWrong ? "bg-red-100 border-red-400 dark:bg-red-900/30 dark:border-red-600"
                        : isSelected ? "bg-primary/10 border-primary/30"
                        : "bg-surface-container-lowest border-outline-variant/10 hover:border-primary/40 hover:bg-primary/5"
                      )}
                    >
                      <span className={cn(
                        "w-8 h-8 rounded-full border flex items-center justify-center font-label text-xs font-bold transition-colors shrink-0",
                        showCorrect ? "bg-green-500 border-green-500 text-white"
                        : showWrong ? "bg-red-500 border-red-500 text-white"
                        : isSelected ? "bg-primary border-primary text-on-primary"
                        : "border-outline text-on-surface-variant group-hover:border-primary group-hover:text-primary"
                      )}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className={cn(
                        "font-label text-sm transition-colors flex-1",
                        (showCorrect || (isSelected && !quizRevealed)) ? "text-on-surface font-semibold" : "text-on-surface-variant group-hover:text-on-surface"
                      )}>
                        {opt}
                      </span>
                      {showCorrect && <CheckCircle2 size={16} className="ml-auto text-green-600 shrink-0" />}
                      {showWrong && <X size={16} className="ml-auto text-red-500 shrink-0" />}
                    </button>
                    );
                  })}
                </div>
                {quizRevealed && (
                  <div className="max-w-xl mx-auto mt-6 space-y-4">
                    <p className="text-sm text-on-surface-variant bg-surface-container-high/50 p-3 rounded-lg">
                      <span className="font-bold">Explanation: </span>{currentQ.explanation}
                    </p>
                    <button
                      onClick={() => { setQIdx(i => (i + 1) % Math.max(1, totalQ)); setQuizAnswer(null); setQuizRevealed(false); }}
                      className="w-full py-5 bg-primary text-on-primary rounded-xl font-headline font-bold text-lg hover:bg-primary-dim shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-3 group"
                    >
                      Next Question
                      <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

const NightlyReviewView = ({ setView, aiEnabled }: { setView: (v: string) => void; aiEnabled: boolean }) => {
  const [plans, setPlans] = useState<SavedStudyPlan[]>([]);
  const [progress, setProgressState] = useState<StudyProgress | null>(null);
  const [quizScores, setQuizScores] = useState<QuizScore[]>([]);

  useEffect(() => {
    loadAllPlans().then(setPlans);
    getStudyProgress().then(setProgressState);
    loadQuizScores().then(setQuizScores);
  }, []);

  const plan = progress ? plans.find(p => p.id === progress.planId) : plans[0];
  const dayIndex = plan && progress?.planId === plan.id ? Math.max(0, progress.dayIndex - 1) : 0;
  const day = plan?.days[dayIndex];
  const planScores = quizScores.filter(s => s.planId === (plan?.id ?? ''));
  const totalQuiz = planScores.length;
  const correctQuiz = planScores.reduce((s, q) => s + q.correct, 0);
  const retentionPct = totalQuiz > 0 ? Math.round((correctQuiz / totalQuiz) * 100) : 0;

  // AI review summary
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    if (plan && day && aiEnabled) {
      setReviewLoading(true);
      generateReviewSummary(plan.bookTitle, day.day, day.sections)
        .then(s => { setReviewSummary(s); setReviewLoading(false); })
        .catch(() => setReviewLoading(false));
    }
  }, [plan?.id, day?.day, aiEnabled]);

  if (!plan || !day) {
    return (
      <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-10 flex flex-col items-center justify-center min-h-[50vh] text-center">
        <Moon className="text-on-surface-variant/40 mb-6" size={56} />
        <h1 className="font-headline text-3xl font-bold text-on-surface mb-2">Nightly Review</h1>
        <p className="text-on-surface-variant font-label text-sm max-w-md mb-8">Complete a study day first to see your nightly review.</p>
        <button onClick={() => setView('curate')} className="bg-primary text-on-primary px-6 py-3 rounded-xl font-headline font-bold text-sm hover:bg-primary-dim transition-all editorial-shadow">Upload Textbook</button>
      </div>
    );
  }

  const sections = day.sections;
  const topSections = sections.slice(0, 4);

  return (
  <div className="max-w-[1440px] mx-auto p-6 lg:p-12 w-full">
    <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div className="max-w-2xl">
        <h1 className="font-headline text-5xl font-extrabold text-on-surface tracking-tight leading-none mb-4">Nightly Review</h1>
        <p className="font-body text-xl text-on-surface-variant italic">Your recap for {plan.bookTitle} — Day {day.day}</p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => setView('study')}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-on-primary hover:bg-primary-dim transition-all editorial-shadow font-headline font-semibold"
        >
          <Maximize2 size={20} />
          Open Full Study View
        </button>
      </div>
    </header>
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <div className="lg:col-span-8 bg-surface-container-lowest p-8 md:p-16 editorial-shadow rounded-xl border border-outline-variant/10 min-h-[800px]">
        <div className="max-w-2xl mx-auto space-y-12">
          <div className="border-b-2 border-primary/10 pb-8 flex justify-between items-start">
            <div>
              <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary mb-2 block">Course Summary: {plan.bookTitle}</span>
              <h2 className="font-headline text-3xl font-bold text-on-surface">{reviewSummary?.headline ?? day.mainConceptFocus}</h2>
              <p className="font-body text-on-surface-variant">Daily Digest — {new Date().toLocaleDateString()}</p>
            </div>
            <div className="w-16 h-16 bg-surface-container-low rounded-lg flex items-center justify-center">
              <Sparkles className="text-primary" size={32} />
            </div>
          </div>

          {/* AI-generated recap or loading state */}
          {reviewLoading ? (
            <div className="flex items-center gap-3 text-on-surface-variant italic py-8">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Generating your nightly review...</span>
            </div>
          ) : reviewSummary ? (
            <>
              <section className="space-y-6">
                <h3 className="font-headline text-xl font-bold text-on-surface border-l-4 border-primary pl-4">Recap</h3>
                {reviewSummary.recap.split('\n').filter(Boolean).map((para, i) => (
                  <p key={i} className="text-lg leading-relaxed text-on-surface">{para}</p>
                ))}
              </section>
              <section className="space-y-4">
                <h3 className="font-headline text-xl font-bold text-on-surface border-l-4 border-primary pl-4">Key Takeaways</h3>
                <ul className="space-y-3">
                  {reviewSummary.keyTakeaways.map((t, i) => (
                    <li key={i} className="flex items-start gap-3 text-base text-on-surface">
                      <CheckCircle2 size={18} className="text-primary shrink-0 mt-1" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <div className="bg-primary-container/20 rounded-xl p-6 border border-primary/10">
                <div className="flex items-center gap-3 mb-2">
                  <Lightbulb size={18} className="text-primary" />
                  <span className="font-headline font-bold text-sm text-primary uppercase tracking-wider">Study Tip</span>
                </div>
                <p className="text-base text-on-surface leading-relaxed">{reviewSummary.studyTip}</p>
              </div>
            </>
          ) : (
            <>
              <section className="space-y-6">
                <h3 className="font-headline text-xl font-bold text-on-surface border-l-4 border-primary pl-4">Today's Sections</h3>
                <p className="text-lg leading-relaxed text-on-surface">
                  You covered <span className="font-bold">{sections.length} section{sections.length !== 1 ? 's' : ''}</span> today,
                  estimated at <span className="bg-tertiary-container/40 px-1 rounded">~{day.estimatedHours} hours</span> of study time.
                  Difficulty: <span className="font-bold capitalize">{day.difficulty}</span>.
                </p>
              </section>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6">
                {topSections.map((sec, i) => (
                  <div key={i} className="p-6 bg-surface-container-low rounded-xl">
                    <span className="font-headline font-bold text-primary block mb-2">{sec.title}</span>
                    <p className="text-base text-on-surface-variant">
                      {sec.textExcerpt ? sec.textExcerpt.slice(0, 150) + '…' : `${sec.sectionType} section — pp. ${sec.startPage}–${sec.endPage}, ${sec.estimatedReadingMinutes} min read.`}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <aside className="lg:col-span-4 space-y-8">
        <div className="bg-primary-container p-8 rounded-xl editorial-shadow">
          <h4 className="font-headline font-bold text-on-primary-container mb-4">Review Progress</h4>
          <div className="space-y-6">
            <div className="flex justify-between items-end">
              <span className="font-label text-sm text-on-primary-container">Quiz Accuracy</span>
              <span className="font-headline text-3xl font-bold text-on-primary-container">{totalQuiz > 0 ? retentionPct : '—'}%</span>
            </div>
            <ProgressBar progress={retentionPct} className="h-2 bg-on-primary-container/10" />
            <p className="font-body text-on-primary-container italic text-base">
              {totalQuiz > 0
                ? `${correctQuiz} of ${totalQuiz} quiz answers correct across all sessions.`
                : 'Take a quiz in the Study View to track your retention.'}
            </p>
          </div>
        </div>
      </aside>
    </div>
  </div>
  );
};

// --- Main App ---

export default function App() {
  // Auth state
  const [authedUser, setAuthedUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem('genai-user');
      const user = raw ? JSON.parse(raw) : null;
      if (user?.id) setCurrentUserId(user.id);
      return user;
    } catch { return null; }
  });
  const [checkingSession, setCheckingSession] = useState(true);

  // Check existing session on mount (with timeout so we don't hang if auth server is down)
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token || authedUser) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      fetch('http://localhost:4000/api/me', { credentials: 'include', signal: controller.signal })
        .then(r => r.json())
        .then(data => {
          if (data.loggedIn && data.user) {
            setAuthedUser(data.user);
            localStorage.setItem('genai-user', JSON.stringify(data.user));
          }
        })
        .catch(() => { /* auth server not running — keep local user */ })
        .finally(() => { clearTimeout(timeout); setCheckingSession(false); });
    } else {
      setCheckingSession(false);
    }
  }, []);

  // Keep userContext in sync with auth state
  useEffect(() => {
    setCurrentUserId(authedUser?.id ?? '_guest');
  }, [authedUser]);

  const handleAuthSuccess = useCallback((user: AuthUser) => {
    setCurrentUserId(user.id);
    setAuthedUser(user);
    localStorage.setItem('genai-user', JSON.stringify(user));
  }, []);

  const handleSkipAuth = useCallback(() => {
    const guestUser: AuthUser = { id: 'guest', email: 'guest@local' };
    setCurrentUserId(guestUser.id);
    setAuthedUser(guestUser);
    localStorage.setItem('genai-user', JSON.stringify(guestUser));
  }, []);

  const [view, setView] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [studyPlanId, setStudyPlanId] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [activities, setActivities] = useState<TrackedActivity[]>([]);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('genai-dark-mode') === 'true');
  const [aiAssistance, setAiAssistance] = useState(() => localStorage.getItem('genai-ai-off') !== 'true');

  // Refresh activities when navigating
  useEffect(() => {
    loadActivities().then(setActivities);
  }, [view]);

  // Apply dark mode class to root element
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('genai-dark-mode', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('genai-ai-off', String(!aiAssistance));
  }, [aiAssistance]);

  useEffect(() => {
    if (view !== 'library') setSelectedPlanId(null);
  }, [view]);

  const handleOpenPlan = (planId: string) => {
    setSelectedPlanId(planId);
    setView('library');
  };

  const handleStudyPlan = (planId: string) => {
    setStudyPlanId(planId);
    setView('study');
  };

  const handleSignOut = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('genai-user');
    setAuthedUser(null);
    fetch('http://localhost:4000/api/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
  };

  const fetchLibrary = async () => {
    try {
      const response = await fetch("/api/library");
      if (response.ok) {
        const data = await response.json();
        setLibraryItems(data);
      }
    } catch (error) {
      console.error("Failed to fetch library:", error);
    }
  };

  useEffect(() => {
    fetchLibrary();
  }, []);

  // Auth gate — rendered conditionally instead of early returns (hooks must be unconditional)
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authedUser) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4">
        <AuthPage onAuthSuccess={handleAuthSuccess} />
        <div className="text-center mt-6 mb-8">
          <button
            onClick={handleSkipAuth}
            className="text-sm text-on-surface-variant hover:text-primary transition-colors underline"
          >
            Continue without an account (local only)
          </button>
          <p className="text-xs text-on-surface-variant/60 mt-2">Your study plans will be saved locally in your browser.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <TopNav
        setView={setView}
        onMenuClick={() => setIsSidebarOpen(true)}
        onNotificationClick={() => setShowNotifications(!showNotifications)}
        onSettingsClick={() => setShowSettings(!showSettings)}
        hasNotifications={activities.length > 0}
        userEmail={authedUser?.email}
      />
      <NotificationPanel isOpen={showNotifications} onClose={() => setShowNotifications(false)} activities={activities} />
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(d => !d)}
        aiAssistance={aiAssistance}
        onToggleAI={() => setAiAssistance(a => !a)}
        onSignOut={handleSignOut}
      />

      <div className="flex flex-1">
        <Sidebar
          activeView={view}
          setView={setView}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {view === 'dashboard' && <DashboardView setView={setView} view={view} onOpenPlan={handleOpenPlan} onStudyPlan={handleStudyPlan} activities={activities} />}
              {view === 'study-today' && <StudyTodayView setView={setView} />}
              {view === 'curate' && <CurateView setView={setView} />}
              {view === 'library' && (
                <PlansView
                  setView={setView}
                  view={view}
                  initialSelectedPlanId={selectedPlanId}
                  onClearSelection={() => setSelectedPlanId(null)}
                  onStudyPlan={handleStudyPlan}
                />
              )}
              {view === 'study' && <StudyView setView={setView} aiEnabled={aiAssistance} activePlanId={studyPlanId} />}
              {view === 'practice' && <PracticeView setView={setView} aiEnabled={aiAssistance} />}
              {view === 'timeline' && <NightlyReviewView setView={setView} aiEnabled={aiAssistance} />}
              {view === 'analytics' && <AnalyticsView setView={setView} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
