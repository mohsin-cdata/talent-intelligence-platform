'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from './auth-store';

// Lazy-load LoginScreen to avoid potential import issues blocking hydration
import dynamic from 'next/dynamic';
const LoginScreen = dynamic(
  () => import('@/components/auth/LoginScreen').then((m) => ({ default: m.LoginScreen })),
  {
    loading: () => (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 bg-cdata-yellow rounded-2xl flex items-center justify-center animate-pulse">
          <span className="font-bold text-cdata-black text-2xl">T</span>
        </div>
      </div>
    ),
  }
);

const SKIP_AUTH = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [mounted, setMounted] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  // Step 1: Wait for client mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Step 2: Once mounted, check auth state
  useEffect(() => {
    if (!mounted) return;

    if (SKIP_AUTH) {
      setAuthChecked(true);
      setShowLogin(false);
      return;
    }

    // Give Zustand persist time to hydrate from localStorage
    const timer = setTimeout(() => {
      const state = useAuthStore.getState();
      // Check if user has a persisted active profile (survived refresh)
      const hasActiveProfile = !!state.activeProfileId && state.profiles.some(
        (p) => p.profile.id === state.activeProfileId
      );
      setShowLogin(!hasActiveProfile);
      // Ensure isAuthenticated matches persisted state
      if (hasActiveProfile && !state.isAuthenticated) {
        useAuthStore.setState({ isAuthenticated: true });
      }
      setAuthChecked(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [mounted]);

  // Subscribe to auth changes (login/logout)
  useEffect(() => {
    if (!authChecked) return;

    const unsub = useAuthStore.subscribe((state) => {
      const hasActiveProfile = !!state.activeProfileId && state.profiles.some(
        (p) => p.profile.id === state.activeProfileId
      );
      setShowLogin(!hasActiveProfile);
    });

    return unsub;
  }, [authChecked]);

  // Show loading spinner until mounted + auth checked
  if (!mounted || !authChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-cdata-yellow rounded-2xl flex items-center justify-center animate-pulse mx-auto mb-4">
            <span className="font-bold text-cdata-black text-2xl">T</span>
          </div>
          <p className="text-xs text-gray-400">
            {!mounted ? 'Initializing...' : 'Checking auth...'}
          </p>
        </div>
      </div>
    );
  }

  // Not authenticated -> show login screen
  if (showLogin) {
    return <LoginScreen />;
  }

  // Authenticated -> render app
  return <>{children}</>;
}
