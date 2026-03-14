// models/User.js
// Mongoose User model with safe password storage (bcrypt hash only).

import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    // Store only the bcrypt hash, never the plain password
    passwordHash: {
      type: String,
      required: true,
      minlength: 60,
      select: false,
    },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

export default User;

