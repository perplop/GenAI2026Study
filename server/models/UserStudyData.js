import mongoose from 'mongoose';

const userStudyDataSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  streak: {
    currentStreak: { type: Number, default: 0 },
    lastPracticeDate: { type: String, default: '' },
  },
  dailyGoal: {
    targetHours: { type: Number, default: 2 },
    studiedMinutes: { type: Number, default: 0 },
    date: { type: String, default: '' },
  },
});

export default mongoose.model('UserStudyData', userStudyDataSchema);
