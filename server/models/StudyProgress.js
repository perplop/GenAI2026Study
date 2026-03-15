import mongoose from 'mongoose';

const studyProgressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  planId: { type: String, required: true },
  dayIndex: { type: Number, required: true, default: 0 },
});

export default mongoose.model('StudyProgress', studyProgressSchema);
