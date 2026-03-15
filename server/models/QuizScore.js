import mongoose from 'mongoose';

const quizScoreSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  planId: { type: String },
  sectionTitle: { type: String },
  correct: { type: Number },
  total: { type: Number },
  timestamp: { type: String },
});

export default mongoose.model('QuizScore', quizScoreSchema);
