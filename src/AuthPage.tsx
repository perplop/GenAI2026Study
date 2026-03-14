// src/AuthPage.tsx
// Combined entry page that lets the user choose between logging in or signing up.

import React, { useState } from 'react';
import LoginForm, { AuthUser } from './LoginForm';
import SignupForm from './SignupForm';

interface AuthPageProps {
  onAuthSuccess: (user: AuthUser) => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  return (
    <main className="flex-1 flex items-center justify-center bg-surface px-4 py-10">
      {/* Fixed-size auth card so it doesn't jump when toggling modes.
          Made taller & wider so error messages don't clip content. */}
      <div className="w-full max-w-5xl h-[640px] flex flex-col md:flex-row bg-surface-container-lowest rounded-3xl border border-outline-variant/25 overflow-hidden shadow-lg">
        <div className="hidden md:flex md:w-1/2 bg-primary-container items-center justify-center p-10">
          <div className="space-y-4 text-on-primary-container">
            <h1 className="font-headline text-3xl font-extrabold tracking-tight">
              StudySmart
            </h1>
            <p className="font-body text-sm opacity-90">
              Create an account or log in to sync your courses, progress, and nightly reviews.
            </p>
          </div>
        </div>
        <div className="w-full md:w-1/2 p-8 flex flex-col">
          <div className="flex mb-6 rounded-full bg-surface-container-low border border-outline-variant/40 p-1">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 py-2 text-sm font-label rounded-full transition-colors ${
                mode === 'login'
                  ? 'bg-primary text-on-primary font-bold'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 text-sm font-label rounded-full transition-colors ${
                mode === 'signup'
                  ? 'bg-primary text-on-primary font-bold'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              Sign up
            </button>
          </div>
          {mode === 'login' ? (
            <LoginForm onLoginSuccess={(user) => onAuthSuccess(user)} />
          ) : (
            <SignupForm
              onSignupSuccess={(user) => {
                // After successful sign up, immediately treat the user as authenticated.
                onAuthSuccess(user);
              }}
            />
          )}
        </div>
      </div>
    </main>
  );
};

export default AuthPage;

