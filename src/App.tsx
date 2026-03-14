import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  BookOpen, 
  Zap, 
  Library, 
  Search, 
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
  Clock,
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
import { GoogleGenAI } from "@google/genai";
import { cn } from './lib/utils';
import { Course, Activity, Module, QuizQuestion, LibraryItem } from './types';

// --- Mock Data ---

const COURSES: Course[] = [
  {
    id: '1',
    title: 'Biology 101',
    chapter: 'Chapter 4: Cell Structure',
    progress: 45,
    totalModules: 28,
    completedModules: 12,
    color: 'bg-primary',
    icon: 'biotech'
  },
  {
    id: '2',
    title: 'Calculus II',
    chapter: 'Integration Techniques',
    progress: 18,
    totalModules: 22,
    completedModules: 4,
    color: 'bg-secondary',
    icon: 'functions'
  },
  {
    id: '3',
    title: 'World History',
    chapter: 'The Renaissance Era',
    progress: 72,
    totalModules: 29,
    completedModules: 21,
    color: 'bg-tertiary',
    icon: 'history'
  }
];

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
    { id: 'timeline', label: 'Nightly Review', icon: Moon },
    { id: 'practice', label: 'Practice', icon: HelpCircle },
    { id: 'library', label: 'Library', icon: Library },
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
              className="text-left group"
            >
              <h2 className="font-headline text-2xl font-bold text-on-surface leading-tight group-hover:text-primary transition-colors">StudySmart</h2>
              <p className="font-label text-xs text-on-surface-variant mt-1 uppercase tracking-widest">Academic Focus</p>
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

const NotificationPanel = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
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
            {ACTIVITIES.map((activity) => (
              <div key={activity.id} className="p-4 border-b border-outline-variant/5 last:border-0 hover:bg-surface-container-low transition-colors cursor-pointer">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    {activity.type === 'quiz' && <Zap size={14} className="text-primary" />}
                    {activity.type === 'highlight' && <PenTool size={14} className="text-secondary" />}
                    {activity.type === 'flashcard' && <Bookmark size={14} className="text-tertiary" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface">{activity.title}</p>
                    <p className="text-xs text-on-surface-variant line-clamp-2 mt-0.5">{activity.description}</p>
                    <p className="text-[10px] text-on-surface-variant/60 mt-1">{activity.timestamp}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 bg-surface-container-low text-center">
            <button className="text-xs font-bold text-primary hover:underline">View all activity</button>
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

const SettingsPanel = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
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
                <button className="w-10 h-5 bg-outline-variant/20 rounded-full relative transition-colors">
                  <div className="absolute left-1 top-1 w-3 h-3 bg-on-surface-variant rounded-full" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">AI Assistance</span>
                <button className="w-10 h-5 bg-primary rounded-full relative transition-colors">
                  <div className="absolute right-1 top-1 w-3 h-3 bg-on-primary rounded-full" />
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Account</p>
              <button className="w-full text-left text-sm font-medium py-2 hover:text-primary transition-colors">Profile Details</button>
              <button className="w-full text-left text-sm font-medium py-2 hover:text-primary transition-colors">Subscription Plan</button>
              <button className="w-full text-left text-sm font-medium py-2 text-error hover:underline transition-colors">Sign Out</button>
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
  onSettingsClick
}: { 
  onMenuClick: () => void;
  setView: (v: string) => void;
  onNotificationClick: () => void;
  onSettingsClick: () => void;
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
      <div className="hidden md:flex items-center bg-surface-container-low px-4 py-2 rounded-full w-72 group focus-within:ring-2 ring-primary/20 transition-all">
        <Search size={18} className="text-on-surface-variant" />
        <input 
          className="bg-transparent border-none focus:ring-0 text-sm font-label ml-2 w-full placeholder:text-on-surface-variant/60" 
          placeholder="Search resources..." 
          type="text" 
        />
      </div>
    </div>
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={onNotificationClick}
          className="text-on-surface-variant hover:text-primary transition-colors relative"
        >
          <Bell size={24} />
          <span className="absolute top-0 right-0 w-2 h-2 bg-error rounded-full border-2 border-surface"></span>
        </button>
        <button 
          onClick={onSettingsClick}
          className="text-on-surface-variant hover:text-primary transition-colors"
        >
          <Settings size={24} />
        </button>
        <img 
          alt="User Profile" 
          className="w-10 h-10 rounded-full border-2 border-surface-container-highest object-cover" 
          src="https://picsum.photos/seed/student/100/100" 
        />
      </div>
    </div>
  </nav>
);

// --- Views ---

const DashboardView = ({ setView }: { setView: (v: string) => void }) => (
  <div className="max-w-[1440px] mx-auto px-6 py-10 lg:px-16">
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-20 items-end">
      <div className="lg:col-span-7">
        <p className="font-label text-primary font-bold tracking-widest uppercase text-xs mb-4">Welcome back, Alex</p>
        <h1 className="font-headline text-5xl lg:text-7xl font-extrabold text-on-surface leading-tight mb-6">
          Master the <span className="italic font-body font-light text-primary">Art</span> of Learning.
        </h1>
        <p className="text-xl text-on-surface-variant max-w-xl leading-relaxed">
          You've completed <span className="text-on-surface font-semibold">12 of 28 modules</span> this week. Pick up where you left off in Biology 101.
        </p>
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
        <div className="flex gap-2">
          <button className="p-2 border border-outline-variant/20 rounded-full hover:bg-surface-container-high transition-colors">
            <ChevronLeft size={20} />
          </button>
          <button className="p-2 border border-outline-variant/20 rounded-full hover:bg-surface-container-high transition-colors text-primary">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
      <div className="flex overflow-x-auto gap-6 no-scrollbar pb-6 -mx-4 px-4">
        {COURSES.map((course) => (
          <div 
            key={course.id}
            className="min-w-[320px] bg-surface-container-lowest p-6 rounded-xl border border-transparent hover:border-primary/10 transition-all cursor-pointer group shadow-sm"
          >
            <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform bg-opacity-20", course.color.replace('bg-', 'bg-opacity-20 '))}>
              {course.icon === 'biotech' && <Microscope className="text-primary" />}
              {course.icon === 'functions' && <Variable className="text-secondary" />}
              {course.icon === 'history' && <History className="text-tertiary" />}
            </div>
            <h3 className="font-headline text-xl font-bold mb-1">{course.title}</h3>
            <p className="text-on-surface-variant font-label text-sm mb-6">{course.chapter}</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-label">
                <span className="text-on-surface-variant font-medium">Progress</span>
                <span className="text-primary font-bold">{course.progress}%</span>
              </div>
              <ProgressBar progress={course.progress} />
              <p className="text-[10px] text-on-surface-variant mt-1">{course.completedModules} of {course.totalModules} modules finished</p>
            </div>
          </div>
        ))}
      </div>
    </section>

    <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-8 bg-surface-container-low rounded-2xl p-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-headline text-2xl font-bold">Recent Activity</h2>
          <button className="font-label text-sm font-semibold text-primary hover:underline">View All</button>
        </div>
        <div className="space-y-6">
          {ACTIVITIES.map((activity) => (
            <div key={activity.id} className="flex gap-6 items-start">
              <div className={cn(
                "shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
                activity.type === 'quiz' && "bg-primary/10 text-primary",
                activity.type === 'highlight' && "bg-secondary/10 text-secondary",
                activity.type === 'flashcard' && "bg-tertiary/10 text-tertiary"
              )}>
                {activity.type === 'quiz' && <HelpCircle size={20} />}
                {activity.type === 'highlight' && <PenTool size={20} />}
                {activity.type === 'flashcard' && <FileText size={20} />}
              </div>
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <h4 className="font-headline font-bold">{activity.title}</h4>
                  <span className="text-xs font-label text-on-surface-variant">{activity.timestamp}</span>
                </div>
                <p className="text-sm text-on-surface-variant leading-relaxed">{activity.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="lg:col-span-4 space-y-8">
        <div className="bg-surface-container-lowest rounded-2xl p-8 shadow-sm border border-outline-variant/10 flex flex-col items-center text-center">
          <div className="relative w-40 h-40 flex items-center justify-center mb-6">
            <svg className="w-full h-full -rotate-90">
              <circle className="text-surface-container-highest" cx="80" cy="80" fill="transparent" r="70" stroke="currentColor" strokeWidth="8"></circle>
              <motion.circle 
                initial={{ strokeDashoffset: 440 }}
                animate={{ strokeDashoffset: 132 }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
                className="text-primary" cx="80" cy="80" fill="transparent" r="70" stroke="currentColor" strokeDasharray="440" strokeWidth="8"
              ></motion.circle>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-headline text-3xl font-extrabold text-on-surface">4.5h</span>
              <span className="font-label text-xs uppercase tracking-widest text-on-surface-variant">Today</span>
            </div>
          </div>
          <h3 className="font-headline text-lg font-bold mb-2">Daily Focus Goal</h3>
          <p className="text-sm text-on-surface-variant mb-6">You're 70% of the way to your study goal for today. 1.5h to go!</p>
          <button className="w-full py-3 rounded-full border border-primary text-primary font-headline font-bold text-sm hover:bg-primary/5 transition-colors">Adjust Goal</button>
        </div>
        <div className="bg-primary-container/20 rounded-2xl p-8">
          <div className="flex items-center gap-4 mb-4">
            <Sparkles className="text-primary" />
            <h4 className="font-headline font-bold">Scholar Tip</h4>
          </div>
          <p className="text-sm text-on-primary-container leading-relaxed">
            Students who use <span className="font-bold">Active Recall</span> for Biology chapters retain 40% more information after one week. Try the mini-quiz today!
          </p>
        </div>
      </div>
    </section>
  </div>
);

const FileUploader = ({ onUploadSuccess }: { onUploadSuccess: () => void }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const MAX_SIZE = 200 * 1024 * 1024; // 200MB

  const handleFile = async (selectedFile: File) => {
    setError(null);
    if (selectedFile.size > MAX_SIZE) {
      setError("File size exceeds 200MB limit.");
      return;
    }
    setFile(selectedFile);
    
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      // Start progress simulation
      simulateUpload();

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");
      
      onUploadSuccess();
    } catch (err) {
      setError("Failed to upload file to server.");
      setFile(null);
      if (uploadIntervalRef.current) clearInterval(uploadIntervalRef.current);
    }
  };

  const simulateUpload = () => {
    if (uploadIntervalRef.current) clearInterval(uploadIntervalRef.current);
    setProgress(0);
    uploadIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (uploadIntervalRef.current) clearInterval(uploadIntervalRef.current);
          return 100;
        }
        return prev + 5;
      });
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (uploadIntervalRef.current) clearInterval(uploadIntervalRef.current);
    };
  }, []);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFile(droppedFile);
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) handleFile(selectedFile);
  };

  return (
    <div 
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "bg-surface-container-low rounded-xl p-1 border-2 border-dashed transition-all",
        isDragging ? "border-primary bg-primary/5" : "border-outline-variant/30 group-hover:border-primary/40"
      )}
    >
      <div className="bg-surface-container-lowest rounded-lg p-12 flex flex-col items-center text-center editorial-shadow">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={onFileSelect} 
          className="hidden" 
          accept=".pdf,.epub,.docx"
        />
        
        <div className="relative mb-8 w-64 h-48 flex items-center justify-center">
          <div className="absolute inset-0 bg-primary-container/20 rounded-xl rotate-3 scale-95 transition-transform group-hover:rotate-6"></div>
          <div className="absolute inset-0 bg-secondary-container/20 rounded-xl -rotate-2 scale-95 transition-transform group-hover:-rotate-4"></div>
          <div className="relative bg-white p-6 rounded-lg editorial-shadow border border-outline-variant/10 w-32 h-44 z-10 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="h-2 w-full bg-surface-container-highest rounded-full"></div>
              <div className="h-2 w-3/4 bg-surface-container-highest rounded-full"></div>
              <div className="h-2 w-5/6 bg-surface-container-highest rounded-full"></div>
            </div>
            <div className="flex justify-center">
              <Sparkles className="text-primary" size={32} />
            </div>
          </div>
          <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 bg-primary-container p-3 rounded-full editorial-shadow">
            <FileText className="text-on-primary-container" size={16} />
          </div>
          <div className="absolute bottom-4 left-0 transform -translate-x-6 bg-tertiary-container p-3 rounded-full editorial-shadow">
            <HelpCircle className="text-on-tertiary-container" size={16} />
          </div>
        </div>

        <div className="space-y-4 w-full">
          {file ? (
            <div className="space-y-4 w-full max-w-xs mx-auto">
              <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-lg border border-outline-variant/10 relative group/file">
                <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <FileText size={20} />
                </div>
                <div className="text-left overflow-hidden pr-8">
                  <p className="text-sm font-bold text-on-surface truncate">{file.name}</p>
                  <p className="text-[10px] text-on-surface-variant uppercase font-label">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
                <button 
                  onClick={() => {
                    setFile(null);
                    setProgress(0);
                    if (uploadIntervalRef.current) clearInterval(uploadIntervalRef.current);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors"
                  title="Cancel Upload"
                >
                  <X size={16} />
                </button>
              </div>
              
              <div className="space-y-2">
                {progress < 100 ? (
                  <>
                    <ProgressBar progress={progress} className="h-2" />
                    <div className="flex justify-between font-label text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                      <span>Deconstructing...</span>
                      <span>{progress}%</span>
                    </div>
                  </>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-2 py-2"
                  >
                    <div className="flex items-center gap-2 text-primary">
                      <CheckCircle2 size={20} />
                      <span className="font-headline font-bold uppercase tracking-widest text-sm">Upload Complete</span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant font-label uppercase tracking-widest italic">Ready for analysis in your library</p>
                  </motion.div>
                )}
              </div>
            </div>
          ) : (
            <>
              <h3 className="font-headline text-2xl font-bold text-on-surface">Ready for Deconstruction</h3>
              <p className="text-on-surface-variant text-sm max-w-xs mx-auto leading-relaxed">
                Drag and drop your textbook here or click to browse your computer.
              </p>
            </>
          )}
          
          {error && (
            <motion.p 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-error text-xs font-bold uppercase tracking-widest"
            >
              {error}
            </motion.p>
          )}
        </div>

        {!file && (
          <div className="mt-12 flex flex-col items-center gap-4">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-primary text-on-primary px-8 py-4 rounded-xl font-headline font-bold text-lg hover:bg-primary-dim transition-all editorial-shadow flex items-center gap-3"
            >
              <Upload size={24} />
              Upload New Textbook
            </button>
            <p className="font-label text-sm text-on-surface-variant">PDF, EPUB, or DOCX up to 200MB</p>
          </div>
        )}
        
        {file && progress === 100 && (
          <button 
            onClick={() => setFile(null)}
            className="mt-8 text-primary font-label text-sm font-bold hover:underline"
          >
            Upload another file
          </button>
        )}
      </div>
    </div>
  );
};

const CurateView = ({ onUploadSuccess }: { onUploadSuccess: () => void }) => (
  <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
    <div className="lg:col-span-8 space-y-10">
      <header className="space-y-2">
        <h1 className="font-headline text-5xl font-extrabold tracking-tight text-on-surface">Curate Your Library</h1>
        <p className="text-xl text-on-surface-variant max-w-2xl leading-relaxed">
          Upload your course materials. Our AI scholar meticulously deconstructs your textbook into digestible nodes of knowledge.
        </p>
      </header>
      <section className="relative group">
        <FileUploader onUploadSuccess={onUploadSuccess} />
      </section>
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface-container-low p-8 rounded-xl space-y-4">
          <Zap className="text-primary" size={32} />
          <h4 className="font-headline text-xl font-bold">Concept Mapping</h4>
          <p className="text-on-surface-variant leading-relaxed">Our AI identifies cross-chapter dependencies to build a logical learning path tailored to your curriculum.</p>
        </div>
        <div className="bg-surface-container-low p-8 rounded-xl space-y-4">
          <TrendingUp className="text-secondary" size={32} />
          <h4 className="font-headline text-xl font-bold">Metadata Extraction</h4>
          <p className="text-on-surface-variant leading-relaxed">Automatically tagging keywords, key figures, and essential dates for instant flashcard generation.</p>
        </div>
      </section>
    </div>
    <aside className="lg:col-span-4 lg:sticky lg:top-28 h-fit space-y-6">
      <div className="bg-surface-container-low rounded-xl overflow-hidden editorial-shadow">
        <div className="bg-primary px-6 py-8 text-on-primary">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h2 className="font-headline text-2xl font-bold tracking-tight">Biology 101</h2>
              <p className="text-on-primary/80 font-label text-sm">Chapter 4: Cell Structure</p>
            </div>
            <span className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
              <BookOpen className="text-white" />
            </span>
          </div>
        </div>
        <div className="p-6 space-y-8">
          <div>
            <h3 className="font-label text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4">Extracted Table of Contents</h3>
            <div className="space-y-1">
              {MODULES.map((mod) => (
                <div 
                  key={mod.id}
                  className={cn(
                    "group flex items-center gap-4 p-3 rounded-lg transition-all cursor-pointer",
                    mod.status === 'completed' && "bg-surface-container-lowest border border-primary/10",
                    mod.status === 'processing' && "bg-primary-container/20 border border-primary/20 animate-pulse",
                    mod.status === 'locked' && "hover:bg-surface-container-high opacity-50"
                  )}
                >
                  {mod.status === 'completed' && <CheckCircle2 size={20} className="text-primary fill-primary/10" />}
                  {mod.status === 'processing' && <Clock size={20} className="text-primary" />}
                  {mod.status === 'locked' && <Settings size={20} className="text-on-surface-variant" />}
                  <span className={cn(
                    "font-headline text-sm",
                    mod.status === 'completed' && "font-semibold text-on-surface",
                    mod.status === 'processing' && "font-semibold text-primary",
                    mod.status === 'locked' && "font-medium text-on-surface-variant"
                  )}>
                    {mod.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </aside>
  </div>
);

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

const AISummary = () => {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generateSummary = async () => {
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Summarize the key points about the cell nucleus in a bulleted list for a biology student.",
      });
      setSummary(response.text || "Could not generate summary.");
    } catch (error) {
      console.error("AI Error:", error);
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
          <button 
            onClick={generateSummary}
            className="text-sm font-label font-bold text-primary hover:underline"
          >
            Generate Summary
          </button>
        )}
      </div>
      {loading && (
        <div className="flex items-center gap-3 text-on-surface-variant italic">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span>Deconstructing knowledge...</span>
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

const StudyView = () => (
  <div className="flex min-h-[calc(100vh-4rem)]">
    <aside className="w-72 bg-surface-container-low border-r border-outline-variant/5 flex flex-col sticky top-16 h-[calc(100vh-4rem)] hidden xl:flex">
      <div className="p-8">
        <div className="mb-8">
          <h2 className="font-headline text-2xl font-bold text-on-surface leading-tight">Biology 101</h2>
          <p className="font-label text-xs text-on-surface-variant mt-1">Chapter 4: Cell Structure</p>
        </div>
        <nav className="space-y-1">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-lowest text-primary editorial-shadow transition-all group">
            <BookOpen size={20} className="fill-primary/10" />
            <span className="font-label text-sm font-bold">Table of Contents</span>
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-surface-container-high transition-all group">
            <PenTool size={20} />
            <span className="font-label text-sm font-medium">Highlights</span>
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-surface-container-high transition-all group">
            <HelpCircle size={20} />
            <span className="font-label text-sm font-medium">Mini-Quizzes</span>
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-surface-container-high transition-all group">
            <FileText size={20} />
            <span className="font-label text-sm font-medium">Flashcards</span>
          </button>
        </nav>
      </div>
    </aside>
    <main className="flex-1 overflow-y-auto bg-surface pb-24">
      <div className="max-w-4xl mx-auto px-10 pt-10 mb-16">
        <div className="flex items-end justify-between mb-3">
          <div>
            <span className="font-label text-[10px] uppercase tracking-widest text-primary font-bold">Current Progress</span>
            <h4 className="font-headline text-lg font-bold text-on-surface">Course Completion</h4>
          </div>
          <span className="font-label text-xs text-on-surface-variant font-medium">12 of 28 modules finished</span>
        </div>
        <ProgressBar progress={45} className="h-1.5" />
      </div>
      <article className="max-w-3xl mx-auto px-10">
        <header className="mb-12">
          <h1 className="font-headline text-5xl font-extrabold text-on-surface mb-6 leading-[1.1]">The Nucleus: The Cell's Control Center</h1>
          <div className="flex items-center gap-4 text-on-surface-variant font-label text-sm italic border-l-2 border-primary/20 pl-4">
            <span>Reading Time: 8 mins</span>
            <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
            <span>Complexity: Intermediate</span>
          </div>
        </header>
        <div className="space-y-8 text-lg text-on-surface leading-relaxed">
          <p>
            The nucleus is often described as the "brain" or the "command center" of the eukaryotic cell. Encased in a double membrane called the nuclear envelope, it houses the cell's genetic material—DNA. This genetic blueprint is meticulously organized into structures called chromosomes, which are composed of chromatin (a complex of DNA and proteins). 
          </p>
          <section className="my-16 p-10 bg-surface-container-low rounded-xl border border-outline-variant/5 editorial-shadow">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center">
                <HelpCircle size={20} className="text-on-primary-container" />
              </div>
              <h3 className="font-headline text-sm font-bold text-primary tracking-wide uppercase">Mini-Quiz: Understanding Check</h3>
            </div>
            <p className="font-body text-xl font-medium text-on-surface mb-8">
              Which structure within the nucleus is primarily responsible for the production of ribosomal subunits?
            </p>
            <div className="space-y-3">
              {['Nuclear Envelope', 'Chromatin', 'Nucleolus', 'Nuclear Pore'].map((opt, idx) => (
                <button 
                  key={opt}
                  className={cn(
                    "w-full text-left p-4 rounded-lg border transition-all flex items-center gap-4 group",
                    opt === 'Nucleolus' 
                      ? "bg-primary/10 border-primary/30" 
                      : "bg-surface-container-lowest border-outline-variant/10 hover:border-primary/40 hover:bg-primary/5"
                  )}
                >
                  <span className={cn(
                    "w-6 h-6 rounded-full border flex items-center justify-center font-label text-[10px] font-bold transition-colors",
                    opt === 'Nucleolus' ? "bg-primary border-primary text-on-primary" : "border-outline text-on-surface-variant group-hover:border-primary group-hover:text-primary"
                  )}>
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className={cn(
                    "font-label text-sm transition-colors",
                    opt === 'Nucleolus' ? "text-on-surface font-semibold" : "text-on-surface-variant group-hover:text-on-surface"
                  )}>
                    {opt}
                  </span>
                  {opt === 'Nucleolus' && <CheckCircle2 size={16} className="ml-auto text-primary" />}
                </button>
              ))}
            </div>
          </section>
          <p>
            The nucleoplasm, the fluid inside the nucleus, provides the structural support needed for these components to maintain their spatial orientation. Beyond just storage, the nucleus acts as the interpretive center of the cell, where genetic information is transcribed into messenger RNA (mRNA) before being exported for protein synthesis.
          </p>
          <AISummary />
          <blockquote className="my-12 pl-8 border-l-4 border-primary italic font-light text-2xl text-on-surface-variant font-body">
            "The nucleus is not just a library of information; it is the active editor and director of the cellular performance."
          </blockquote>
        </div>
      </article>
    </main>
  </div>
);

const PracticeView = () => (
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
            <span className="font-headline font-bold text-lg">7 Day Streak</span>
          </div>
          <span className="font-label text-xs font-bold bg-secondary-container px-2 py-1 rounded-full text-on-secondary-container">Keep it up!</span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between font-label text-[10px] uppercase font-bold text-on-surface-variant">
            <span>Course Completion</span>
            <span>45%</span>
          </div>
          <ProgressBar progress={45} className="h-1.5" />
          <p className="font-body text-xs italic text-on-surface-variant">12 of 28 modules finished</p>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/15">
          <h3 className="font-headline font-bold text-sm uppercase tracking-widest text-on-surface mb-6">Topic Selection</h3>
          <div className="space-y-3">
            <button className="w-full flex items-center justify-between p-4 bg-surface-container-lowest rounded-lg border border-primary/20 text-left group">
              <span className="font-headline font-bold text-sm text-primary">Cell Organelles</span>
              <CheckCircle2 size={16} className="text-primary" />
            </button>
            {['Membrane Transport', 'Energy Metabolism'].map(topic => (
              <button key={topic} className="w-full flex items-center justify-between p-4 bg-surface-container-lowest/50 rounded-lg hover:bg-surface-container-lowest transition-all text-left group">
                <span className="font-headline font-medium text-sm text-on-surface-variant">{topic}</span>
                <ChevronRight size={16} className="text-outline-variant group-hover:text-primary" />
              </button>
            ))}
          </div>
        </div>
        <div className="bg-primary p-6 rounded-xl text-on-primary">
          <Lightbulb className="mb-4" />
          <h4 className="font-headline font-bold text-lg mb-2">Focus Suggestion</h4>
          <p className="font-body text-sm leading-relaxed opacity-90">Based on your last quiz, you should focus on Mitochondrial structures. You missed 3 questions related to ATP synthesis.</p>
        </div>
      </div>
      <div className="lg:col-span-8">
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 overflow-hidden">
          <div className="bg-surface-container-high/50 px-8 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <span className="font-label text-xs font-bold text-primary tracking-widest uppercase">Question 14 of 25</span>
              <div className="h-1 w-1 rounded-full bg-outline-variant"></div>
              <span className="font-label text-xs font-bold text-on-surface-variant uppercase tracking-widest">Cell Structure</span>
            </div>
            <div className="flex gap-2">
              <Bookmark size={20} className="text-on-surface-variant hover:text-primary cursor-pointer" />
              <Flag size={20} className="text-on-surface-variant hover:text-primary cursor-pointer" />
            </div>
          </div>
          <div className="p-12">
            <h2 className="font-body text-3xl leading-snug text-on-surface mb-8">Identify the organelle responsible for synthesizing ribosomal RNA and assembling ribosomal subunits.</h2>
            <div className="bg-surface-container-low rounded-xl p-8 border-l-4 border-primary/30 italic font-body text-lg text-on-surface-variant mb-12">
              "This structure is not membrane-bound and appears as a dense region within the nucleus during interphase."
            </div>
            <div className="max-w-md mx-auto space-y-6">
              <div className="space-y-2">
                <label className="font-label text-xs font-bold text-on-surface-variant uppercase tracking-widest ml-1">Your Answer</label>
                <input className="w-full px-6 py-4 bg-surface-container-low border-none rounded-xl focus:ring-4 focus:ring-primary/10 text-lg font-body placeholder:italic transition-all" placeholder="Type answer here..." type="text" />
              </div>
              <button className="w-full py-5 bg-primary text-on-primary rounded-xl font-headline font-bold text-lg hover:bg-primary-dim shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-3 group">
                Check Answer
                <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const NightlyReviewView = () => (
  <div className="max-w-[1440px] mx-auto p-6 lg:p-12 w-full">
    <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div className="max-w-2xl">
        <h1 className="font-headline text-5xl font-extrabold text-on-surface tracking-tight leading-none mb-4">Nightly Review</h1>
        <p className="font-body text-xl text-on-surface-variant italic">Your 15-minute power-recap for Biology 101</p>
      </div>
      <div className="flex gap-3">
        <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-surface-container-high hover:bg-surface-container-highest transition-colors font-headline font-semibold text-on-surface border border-outline-variant/20">
          <Download size={20} />
          Download PDF
        </button>
        <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-on-primary hover:bg-primary-dim transition-all editorial-shadow font-headline font-semibold">
          <Maximize2 size={20} />
          Open Full Review
        </button>
      </div>
    </header>
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <div className="lg:col-span-8 bg-surface-container-lowest p-8 md:p-16 editorial-shadow rounded-xl border border-outline-variant/10 min-h-[800px]">
        <div className="max-w-2xl mx-auto space-y-12">
          <div className="border-b-2 border-primary/10 pb-8 flex justify-between items-start">
            <div>
              <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary mb-2 block">Course Summary: BIO 101</span>
              <h2 className="font-headline text-3xl font-bold text-on-surface">Cell Structure Recap</h2>
              <p className="font-body text-on-surface-variant">Daily Digest • October 24, 2023</p>
            </div>
            <div className="w-16 h-16 bg-surface-container-low rounded-lg flex items-center justify-center">
              <Sparkles className="text-primary" size={32} />
            </div>
          </div>
          <section className="space-y-6">
            <h3 className="font-headline text-xl font-bold text-on-surface border-l-4 border-primary pl-4">The Core Concept</h3>
            <p className="text-lg leading-relaxed text-on-surface">
              Eukaryotic cells represent a leap in complexity, characterized by membrane-bound organelles. Think of the cell not as a soup, but as a <span className="bg-tertiary-container/40 px-1 rounded">highly disciplined factory</span> where each station has a specific, isolated task to perform.
            </p>
          </section>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6">
            <div className="p-6 bg-surface-container-low rounded-xl">
              <span className="font-headline font-bold text-primary block mb-2">Mitochondria</span>
              <p className="text-base">The double-membrane power plant. Site of cellular respiration and ATP production.</p>
            </div>
            <div className="p-6 bg-surface-container-low rounded-xl">
              <span className="font-headline font-bold text-primary block mb-2">Golgi Apparatus</span>
              <p className="text-base">The shipping and receiving department. Modifies and packages proteins for transport.</p>
            </div>
          </div>
          <section className="relative aspect-video bg-surface-container-high rounded-xl overflow-hidden group">
            <img alt="Cell Diagram" className="w-full h-full object-cover mix-blend-multiply opacity-60" src="https://picsum.photos/seed/cell/800/450" />
            <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-sm p-4 rounded-lg">
              <p className="text-sm font-label text-on-surface-variant italic">Fig 1.1: Functional mapping of the endomembrane system and protein synthesis pathway.</p>
            </div>
          </section>
        </div>
      </div>
      <aside className="lg:col-span-4 space-y-8">
        <div className="bg-primary-container p-8 rounded-xl editorial-shadow">
          <h4 className="font-headline font-bold text-on-primary-container mb-4">Review Progress</h4>
          <div className="space-y-6">
            <div className="flex justify-between items-end">
              <span className="font-label text-sm text-on-primary-container">Concepts Retained</span>
              <span className="font-headline text-3xl font-bold text-on-primary-container">84%</span>
            </div>
            <ProgressBar progress={84} className="h-2 bg-on-primary-container/10" />
            <p className="font-body text-on-primary-container italic text-base">You've mastered the <span className="font-bold">Mitochondrial Matrix</span> concept today.</p>
          </div>
        </div>
      </aside>
    </div>
  </div>
);

// --- Main App ---

export default function App() {
  const [view, setView] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNightlyFABVisible, setIsNightlyFABVisible] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);

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

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <TopNav 
        setView={setView}
        onMenuClick={() => setIsSidebarOpen(true)} 
        onNotificationClick={() => setShowNotifications(!showNotifications)}
        onSettingsClick={() => setShowSettings(!showSettings)}
      />
      <NotificationPanel isOpen={showNotifications} onClose={() => setShowNotifications(false)} />
      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />
      
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
              {view === 'dashboard' && <DashboardView setView={setView} />}
              {view === 'curate' && <CurateView onUploadSuccess={fetchLibrary} />}
              {view === 'study' && <StudyView />}
              {view === 'practice' && <PracticeView />}
              {view === 'timeline' && <NightlyReviewView />}
              {view === 'library' && <LibraryView items={libraryItems} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Floating Action Button */}
      <AnimatePresence>
        {isNightlyFABVisible && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="fixed bottom-8 right-8 z-50 flex items-center"
          >
            <button 
              onClick={() => setView('timeline')}
              className="flex items-center gap-3 h-14 px-6 rounded-l-full bg-primary text-on-primary editorial-shadow hover:bg-primary-dim transition-all group"
            >
              <Moon size={20} className="group-hover:rotate-12 transition-transform fill-on-primary" />
              <span className="font-headline font-bold text-sm tracking-wide">Nightly Review</span>
            </button>
            <button 
              onClick={() => setIsNightlyFABVisible(false)}
              className="h-14 w-12 flex items-center justify-center bg-primary-dim text-on-primary rounded-r-full border-l border-on-primary/10 hover:bg-primary transition-all"
              title="Hide Nightly Review"
            >
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
