import { Router } from 'express';
import StudyPlan from '../models/StudyPlan.js';
import StudyProgress from '../models/StudyProgress.js';
import Activity from '../models/Activity.js';
import QuizScore from '../models/QuizScore.js';
import UserStudyData from '../models/UserStudyData.js';

const router = Router();

// ── Study Plans ────────────────────────────────────────────────────────────

router.get('/plans', async (req, res) => {
  try {
    const docs = await StudyPlan.find({ userId: req.userId }).sort({ createdAt: -1 }).lean();
    const plans = docs.map(d => ({
      id: d.planId,
      bookTitle: d.bookTitle,
      createdAt: d.createdAt,
      numDays: d.numDays,
      totalSections: d.totalSections,
      days: d.days,
      pdfFileName: d.pdfFileName,
    }));
    res.json(plans);
  } catch (e) {
    console.error('GET /plans error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.put('/plans/:planId', async (req, res) => {
  try {
    const { bookTitle, createdAt, numDays, totalSections, days, pdfFileName } = req.body;
    await StudyPlan.findOneAndUpdate(
      { userId: req.userId, planId: req.params.planId },
      { userId: req.userId, planId: req.params.planId, bookTitle, createdAt, numDays, totalSections, days, pdfFileName },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (e) {
    console.error('PUT /plans error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.delete('/plans/:planId', async (req, res) => {
  try {
    await StudyPlan.deleteOne({ userId: req.userId, planId: req.params.planId });
    res.json({ success: true });
  } catch (e) {
    console.error('DELETE /plans error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── Study Progress ─────────────────────────────────────────────────────────

router.get('/progress', async (req, res) => {
  try {
    const doc = await StudyProgress.findOne({ userId: req.userId }).lean();
    res.json(doc ? { planId: doc.planId, dayIndex: doc.dayIndex } : null);
  } catch (e) {
    console.error('GET /progress error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.put('/progress', async (req, res) => {
  try {
    const { planId, dayIndex } = req.body;
    await StudyProgress.findOneAndUpdate(
      { userId: req.userId },
      { userId: req.userId, planId, dayIndex },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (e) {
    console.error('PUT /progress error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── Activities ─────────────────────────────────────────────────────────────

router.get('/activities', async (req, res) => {
  try {
    const docs = await Activity.find({ userId: req.userId }).sort({ timestamp: -1 }).limit(50).lean();
    res.json(docs.map(d => ({
      id: d.activityId,
      type: d.type,
      title: d.title,
      description: d.description,
      timestamp: d.timestamp,
    })));
  } catch (e) {
    console.error('GET /activities error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/activities', async (req, res) => {
  try {
    const { id, type, title, description, timestamp } = req.body;
    await Activity.create({ userId: req.userId, activityId: id, type, title, description, timestamp });
    // Trim to 50
    const count = await Activity.countDocuments({ userId: req.userId });
    if (count > 50) {
      const oldest = await Activity.find({ userId: req.userId }).sort({ timestamp: 1 }).limit(count - 50);
      await Activity.deleteMany({ _id: { $in: oldest.map(d => d._id) } });
    }
    res.json({ success: true });
  } catch (e) {
    console.error('POST /activities error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── Quiz Scores ────────────────────────────────────────────────────────────

router.get('/quiz-scores', async (req, res) => {
  try {
    const docs = await QuizScore.find({ userId: req.userId }).sort({ timestamp: -1 }).limit(100).lean();
    res.json(docs.map(d => ({
      planId: d.planId,
      sectionTitle: d.sectionTitle,
      correct: d.correct,
      total: d.total,
      timestamp: d.timestamp,
    })));
  } catch (e) {
    console.error('GET /quiz-scores error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/quiz-scores', async (req, res) => {
  try {
    const { planId, sectionTitle, correct, total, timestamp } = req.body;
    await QuizScore.create({ userId: req.userId, planId, sectionTitle, correct, total, timestamp });
    const count = await QuizScore.countDocuments({ userId: req.userId });
    if (count > 100) {
      const oldest = await QuizScore.find({ userId: req.userId }).sort({ timestamp: 1 }).limit(count - 100);
      await QuizScore.deleteMany({ _id: { $in: oldest.map(d => d._id) } });
    }
    res.json({ success: true });
  } catch (e) {
    console.error('POST /quiz-scores error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── Streak ─────────────────────────────────────────────────────────────────

router.get('/streak', async (req, res) => {
  try {
    const doc = await UserStudyData.findOne({ userId: req.userId }).lean();
    res.json(doc?.streak ?? { currentStreak: 0, lastPracticeDate: '' });
  } catch (e) {
    console.error('GET /streak error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.put('/streak', async (req, res) => {
  try {
    const { currentStreak, lastPracticeDate } = req.body;
    await UserStudyData.findOneAndUpdate(
      { userId: req.userId },
      { $set: { 'streak.currentStreak': currentStreak, 'streak.lastPracticeDate': lastPracticeDate } },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (e) {
    console.error('PUT /streak error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── Daily Goal ─────────────────────────────────────────────────────────────

router.get('/daily-goal', async (req, res) => {
  try {
    const doc = await UserStudyData.findOne({ userId: req.userId }).lean();
    res.json(doc?.dailyGoal ?? { targetHours: 2, studiedMinutes: 0, date: '' });
  } catch (e) {
    console.error('GET /daily-goal error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.put('/daily-goal', async (req, res) => {
  try {
    const { targetHours, studiedMinutes, date } = req.body;
    await UserStudyData.findOneAndUpdate(
      { userId: req.userId },
      { $set: { 'dailyGoal.targetHours': targetHours, 'dailyGoal.studiedMinutes': studiedMinutes, 'dailyGoal.date': date } },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (e) {
    console.error('PUT /daily-goal error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
