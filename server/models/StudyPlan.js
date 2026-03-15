import mongoose from 'mongoose';

const studyPlanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  planId: { type: String, required: true },
  bookTitle: { type: String, required: true },
  createdAt: { type: String },
  numDays: { type: Number },
  totalSections: { type: Number },
  days: { type: mongoose.Schema.Types.Mixed, default: [] },
}, { timestamps: false });

studyPlanSchema.index({ userId: 1, planId: 1 }, { unique: true });

export default mongoose.model('StudyPlan', studyPlanSchema);
