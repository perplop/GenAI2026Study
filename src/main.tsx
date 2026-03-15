import { StrictMode, useState, useEffect, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import AuthPage from './AuthPage.tsx';
import type { AuthUser } from './LoginForm';
import './index.css';

const AUTH_API = 'http://localhost:3000';

function toAuthUser(raw: { id?: unknown; email?: string } | null): AuthUser | null {
  if (!raw || !raw.email) return null;
  return { id: String(raw.id ?? ''), email: raw.email };
}

function getInitialDarkMode(): boolean {
  try {
    return localStorage.getItem('darkMode') === 'true';
  } catch {
    return false;
  }
}

function Root() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(getInitialDarkMode);

  useLayoutEffect(() => {
    try {
      document.documentElement.classList.toggle('dark', darkMode);
    } catch {
      // ignore
    }
  }, [darkMode]);

  useEffect(() => {
    try {
      localStorage.setItem('darkMode', String(darkMode));
    } catch {
      // ignore
    }
  }, [darkMode]);

  // Check session on load so login state matches server (cookie)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${AUTH_API}/api/me`, { credentials: 'include' });
        const data = await res.json();
        if (cancelled) return;
        if (data.loggedIn && data.user) {
          setUser(toAuthUser(data.user));
        } else {
          setUser(null);
          try { localStorage.removeItem('user'); localStorage.removeItem('auth_token'); } catch {}
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          try { localStorage.removeItem('user'); localStorage.removeItem('auth_token'); } catch {}
        }
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleAuthSuccess = (u: AuthUser) => {
    setUser(toAuthUser(u) ?? u);
    try {
      localStorage.setItem('user', JSON.stringify({ id: String(u.id), email: u.email }));
    } catch {
      // ignore
    }
  };

  const handleSignOut = async () => {
    try {
      await fetch(`${AUTH_API}/api/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Logout error', err);
    } finally {
      setUser(null);
      try {
        localStorage.removeItem('user');
        localStorage.removeItem('auth_token');
      } catch {
        // ignore
      }
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-surface">
        <AuthPage onAuthSuccess={handleAuthSuccess} />
      </div>
    );
  }

  return (
    <App
      user={user}
      onSignOut={handleSignOut}
      darkMode={darkMode}
      onDarkModeToggle={() => setDarkMode((prev) => !prev)}
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
