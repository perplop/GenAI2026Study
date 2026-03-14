// src/LoginForm.tsx
// React login form that talks to the Node.js backend, validates input,
// and handles errors safely.

import React, { useState, FormEvent } from 'react';

export interface AuthUser {
  id: string;
  email: string;
}

interface LoginFormProps {
  onLoginSuccess?: (user: AuthUser, token?: string) => void;
}

function isValidEmail(email: string) {
  return /^\S+@\S+\.\S+$/.test(email);
}

function isValidPassword(password: string) {
  return password.length >= 8;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validateFields = () => {
    let ok = true;

    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address.');
      ok = false;
    } else {
      setEmailError(null);
    }

    if (!isValidPassword(password)) {
      setPasswordError('Password must be at least 8 characters.');
      ok = false;
    } else {
      setPasswordError(null);
    }

    return ok;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validateFields()) return;

    try {
      setSubmitting(true);

      const res = await fetch('http://localhost:4000/api/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setServerError(data?.error ?? 'Login failed. Please try again.');
        return;
      }

      const user: AuthUser = data.user;
      const token: string | undefined = data.token;

      if (token) {
        // Optional: store token; be aware localStorage is vulnerable to XSS.
        localStorage.setItem('auth_token', token);
      }

      setEmail('');
      setPassword('');

      if (onLoginSuccess) {
        onLoginSuccess(user, token);
      }
    } catch (err) {
      console.error('Login request error:', err);
      setServerError('Unexpected error. Please try again later.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col justify-center px-6 py-8 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 shadow-sm">
      <h2 className="font-headline text-2xl font-bold mb-4 text-on-surface text-center">Login</h2>

      {serverError && (
        <div className="mb-4 text-sm text-error bg-error-container/20 border border-error/40 rounded-lg px-3 py-2">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant mb-1"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={validateFields}
            className="w-full px-3 py-2 rounded-lg border border-outline-variant/40 bg-surface text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
            required
          />
          {emailError && <p className="mt-1 text-xs text-error">{emailError}</p>}
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant mb-1"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={validateFields}
            className="w-full px-3 py-2 rounded-lg border border-outline-variant/40 bg-surface text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
            required
          />
          {passwordError && <p className="mt-1 text-xs text-error">{passwordError}</p>}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-lg bg-primary text-on-primary font-headline font-bold text-sm tracking-wide hover:bg-primary-dim transition-colors disabled:opacity-70"
        >
          {submitting ? 'Logging in…' : 'Login'}
        </button>
      </form>
    </div>
  );
};

export default LoginForm;

