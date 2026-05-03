'use client';

import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { CreateProfileForm } from './CreateProfileForm';
import { useAuthStore } from '@/lib/auth-store';
import { cn } from '@/lib/utils';

export function LoginScreen() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { profiles, login, deleteProfile } = useAuthStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfileId || !password) return;

    setError('');
    setIsLoggingIn(true);

    try {
      const success = await login(selectedProfileId, password);
      if (!success) {
        setError('Incorrect password');
        setPassword('');
      }
    } catch {
      setError('Login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDelete = (profileId: string) => {
    deleteProfile(profileId);
    setConfirmDelete(null);
    if (selectedProfileId === profileId) {
      setSelectedProfileId(null);
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-cdata-yellow/5 rounded-full blur-3xl animate-pulse-gentle" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cdata-yellow/5 rounded-full blur-3xl animate-pulse-gentle" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cdata-yellow/3 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-lg bg-white rounded-2xl border border-gray-200 shadow-xl p-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-cdata-yellow rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="font-bold text-cdata-black text-3xl">T</span>
          </div>
          <h1 className="text-2xl font-bold text-cdata-black font-grafier">Talent Intelligence</h1>
          <p className="text-sm text-gray-500 mt-2">
            {showCreateForm ? 'Create your account to get started' : 'Select your profile to continue'}
          </p>
        </div>

        {/* Create Profile Form */}
        {showCreateForm ? (
          <div className="animate-in">
            <CreateProfileForm
              onBack={() => setShowCreateForm(false)}
              onCreated={() => setShowCreateForm(false)}
            />
          </div>
        ) : (
          <div className="animate-in">
            {/* Profile list */}
            {profiles.length > 0 && (
              <div className="space-y-2 mb-4">
                {profiles.map((stored) => (
                  <div key={stored.profile.id} className="relative group">
                    <button
                      onClick={() => {
                        setSelectedProfileId(stored.profile.id);
                        setError('');
                        setPassword('');
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
                        selectedProfileId === stored.profile.id
                          ? 'border-cdata-yellow bg-cdata-yellow/5 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <div className="w-10 h-10 rounded-full bg-cdata-yellow/20 flex items-center justify-center flex-shrink-0">
                        <span className="font-semibold text-cdata-black text-sm">
                          {stored.profile.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 text-sm truncate">{stored.profile.name}</p>
                        <p className="text-xs text-gray-500 truncate">{stored.profile.email}</p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full capitalize">
                        {stored.profile.role.replace('_', ' ')}
                      </span>
                    </button>

                    {/* Delete button */}
                    {confirmDelete === stored.profile.id ? (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(stored.profile.id)}
                          className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDelete(stored.profile.id);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Password form */}
            {selectedProfileId && (
              <form onSubmit={handleLogin} className="mb-4 animate-in">
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <PasswordInput
                  value={password}
                  onChange={setPassword}
                  placeholder="Enter your password"
                  autoFocus
                />
                {error && (
                  <p className="text-sm text-red-500 mt-2">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={isLoggingIn || !password}
                  className="w-full btn-cdata-primary mt-3 flex items-center justify-center gap-2"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>
            )}

            {/* Create New Profile button - always visible */}
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full p-3 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-500 hover:border-cdata-yellow hover:text-cdata-black transition-all"
            >
              + Create New Profile
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-500">
            Powered by{' '}
            <span className="font-semibold text-cdata-black">CData Connect AI</span>
          </p>
        </div>
      </div>
    </div>
  );
}
