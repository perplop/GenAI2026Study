<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# StudySmart — AI-Powered Study Companion

StudySmart deconstructs textbook PDFs into digestible knowledge nodes, then generates personalized study plans with AI-powered quizzes, flashcards, and nightly reviews.

## Prerequisites

- **Node.js** (v18+)
- **MongoDB** (required for user accounts and persistent data; optional for guest mode)

## Quick Start (Guest Mode — No MongoDB)

If you just want to try the app without setting up a database:

```bash
npm install
npm run dev
```

Open http://localhost:3000 and click **"Continue without an account"**. All data is stored locally in your browser.

## Full Setup (With Authentication & Data Persistence)

### 1. Install dependencies

```bash
npm install
```

### 2. Install and start MongoDB

```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

Verify it's running:

```bash
mongosh --eval "db.runCommand({ ping: 1 })"
```

### 3. Configure environment variables

Copy the example env file and set your API key (optional — AI features fall back gracefully without it):

```bash
cp .env.example .env
```

Edit `.env`:

```
VITE_OPENAI_API_KEY="your-api-key-here"
APP_URL="http://localhost:3000"
```

### 4. Start the auth server

In a separate terminal:

```bash
node server/server.js
```

This starts the authentication and data API server on **http://localhost:4000**, connected to MongoDB at `mongodb://localhost:27017/login_demo`.

### 5. Start the app

```bash
npm run dev
```

Open **http://localhost:3000**. You can now sign up, log in, and all study data persists in MongoDB.

## Architecture

| Component | Port | Purpose |
|---|---|---|
| Main server (`server.ts`) | 3000 | Vite dev server + PDF file upload API |
| Auth server (`server/server.js`) | 4000 | Authentication (JWT + sessions) + user data API (MongoDB) |
| MongoDB | 27017 | User accounts, study plans, progress, quiz scores, activities |

### Frontend

- React 19 + TypeScript
- Vite 6
- Tailwind CSS 4 (Material Design 3 theme)
- Framer Motion (animations)
- pdfjs-dist (client-side PDF parsing and rendering)
- OpenAI SDK (AI features via OpenAI-compatible API)

### Backend

- Express (both servers)
- Mongoose + MongoDB (user data)
- bcrypt (password hashing)
- JWT + express-session (authentication)
- Multer (file uploads)

## Features

- **PDF Upload & Parsing** — drag-and-drop upload, client-side text extraction and section detection
- **Study Plan Generation** — rule-based workload-balanced scheduling with AI-enriched learning goals
- **Study View** — read parsed content, inline PDF viewer, section navigation
- **AI Quizzes** — comprehension questions generated from actual textbook content (cached)
- **AI Flashcards** — key term/definition pairs generated per section
- **AI Scholar Summary** — context-aware summaries of each section
- **Practice Lab** — AI-generated multiple-choice questions with topic selection and score tracking
- **Nightly Review** — AI-generated editorial recap with key takeaways and study tips
- **Analytics** — study time charts, quiz accuracy trends, section completion heatmap
- **Dark Mode** — full dark theme with persistence
- **Authentication** — signup/login with MongoDB-backed sessions, guest mode fallback
- **Per-User Data** — each account has isolated study plans, progress, and quiz scores

## Project Structure

```
├── server.ts                    # Main Vite + file upload server (port 3000)
├── server/
│   ├── server.js                # Auth + data API server (port 4000)
│   ├── middleware/auth.js       # JWT authentication middleware
│   ├── routes/data.js           # User data CRUD routes
│   └── models/                  # Mongoose models
│       ├── User.js
│       ├── StudyPlan.js
│       ├── StudyProgress.js
│       ├── Activity.js
│       ├── QuizScore.js
│       └── UserStudyData.js
├── src/
│   ├── App.tsx                  # Main app (views, routing, state)
│   ├── AnalyticsView.tsx        # Study analytics page
│   ├── PdfViewer.tsx            # Inline PDF renderer
│   ├── AuthPage.tsx             # Login/signup page
│   ├── LoginForm.tsx
│   ├── SignupForm.tsx
│   ├── lib/
│   │   ├── apiClient.ts         # API client with localStorage fallback
│   │   ├── studyPlanner.ts      # Study plan scheduling + persistence
│   │   ├── activityTracker.ts   # Activity, quiz, streak tracking
│   │   ├── aiGenerator.ts       # AI content generation + caching
│   │   ├── userContext.ts       # Per-user localStorage namespacing
│   │   ├── pdfParser.ts         # PDF text extraction + page rendering
│   │   ├── sectionSplitter.ts   # Rule-based section detection + scoring
│   │   └── utils.ts             # Tailwind class utility
│   ├── types.ts                 # TypeScript interfaces
│   └── index.css                # Tailwind + dark mode theme
└── .env.example                 # Environment variable template
```
