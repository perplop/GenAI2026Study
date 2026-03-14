// server/server.js
// Express server providing secure authentication with MongoDB, sessions, and optional JWT.

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import bcrypt from 'bcrypt';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import User from './models/User.js';

// Ensure we load environment variables from either project root .env or server/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();

// --- Configuration ---
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/login_demo';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change_this_session_secret';
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_jwt_secret';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

// --- MongoDB connection ---
mongoose
  .connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// --- Middleware ---
app.use(express.json());

// Allow the React dev server to talk to this API with cookies.
// Using origin: true reflects whatever origin is making the request (dev-friendly).
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(
  session({
    name: 'sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // set to true behind HTTPS in production
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24,
    },
    store: MongoStore.create({
      mongoUrl: MONGO_URI,
      collectionName: 'sessions',
    }),
  })
);

// --- Helpers ---
function isValidEmail(email) {
  return typeof email === 'string' && /^\S+@\S+\.\S+$/.test(email);
}

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

function sendError(res, statusCode, message) {
  return res.status(statusCode).json({ success: false, error: message });
}

// --- Auth routes ---

// Register a new user: validate, hash password, store safely, and log them in
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!isValidEmail(email)) {
      return sendError(res, 400, 'A valid email is required.');
    }
    if (!isValidPassword(password)) {
      return sendError(res, 400, 'Password must be at least 8 characters.');
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return sendError(res, 409, 'A user with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({ email, passwordHash });

    // Immediately create a session so the new user is logged in
    req.session.userId = user._id.toString();

    // Also issue a JWT so the client can call protected APIs if needed
    const token = jwt.sign(
      { sub: user._id.toString(), email: user.email },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.status(201).json({
      success: true,
      user: { id: user._id, email: user.email },
      token,
    });
  } catch (err) {
    console.error('Register error:', err);
    return sendError(res, 500, 'Internal server error.');
  }
});

// Login: validate input, verify password, set session, return JWT
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!isValidEmail(email) || !isValidPassword(password)) {
      return sendError(res, 400, 'Invalid email or password format.');
    }

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      return sendError(res, 401, 'Invalid email or password.');
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      return sendError(res, 401, 'Invalid email or password.');
    }

    // Store user ID in the session so the user stays logged in
    req.session.userId = user._id.toString();

    // Optional JWT for token-based auth
    const token = jwt.sign(
      { sub: user._id.toString(), email: user.email },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.json({
      success: true,
      user: { id: user._id, email: user.email },
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    return sendError(res, 500, 'Internal server error.');
  }
});

// Check current session
app.get('/api/me', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.json({ loggedIn: false });
    }

    const user = await User.findById(req.session.userId).select('email');
    if (!user) {
      return res.json({ loggedIn: false });
    }

    return res.json({
      loggedIn: true,
      user: { id: user._id, email: user.email },
    });
  } catch (err) {
    console.error('Me error:', err);
    return sendError(res, 500, 'Internal server error.');
  }
});

// Logout route
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return sendError(res, 500, 'Could not log out.');
    }
    res.clearCookie('sid');
    return res.json({ success: true });
  });
});

// --- Protected example route using session ---
app.get('/api/protected-with-session', (req, res) => {
  if (!req.session.userId) {
    return sendError(res, 401, 'Not authenticated.');
  }
  return res.json({ success: true, userId: req.session.userId });
});

// --- Protected example route using JWT ---
app.get('/api/protected-with-jwt', (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const [, token] = auth.split(' ');
    if (!token) {
      return sendError(res, 401, 'Missing token.');
    }
    const payload = jwt.verify(token, JWT_SECRET);
    return res.json({ success: true, userId: payload.sub, email: payload.email });
  } catch (err) {
    console.error('JWT verify error:', err);
    return sendError(res, 401, 'Invalid or expired token.');
  }
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`Auth server running on http://localhost:${PORT}`);
});

