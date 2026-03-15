import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  activityId: { type: String, required: true },
  type: { type: String, enum: ['quiz', 'highlight', 'flashcard', 'plan', 'study', 'practice'], required: true },
  title: { type: String },
  description: { type: String },
  timestamp: { type: String },
});

export default mongoose.model('Activity', activitySchema);
