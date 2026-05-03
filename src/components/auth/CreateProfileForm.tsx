'use client';

import { useState } from 'react';
import { ArrowLeft, UserPlus, Loader2 } from 'lucide-react';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { useAuthStore } from '@/lib/auth-store';
import { UserRole, USER_ROLES } from '@/types';
import { cn } from '@/lib/utils';

interface CreateProfileFormProps {
  onBack?: () => void;
  onCreated: () => void;
}

export function CreateProfileForm({ onBack, onCreated }: CreateProfileFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('recruiter');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const { createProfile } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Valid email is required');
      return;
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsCreating(true);
    try {
      await createProfile(name.trim(), email.trim(), role, password);
      onCreated();
    } catch (err) {
      setError('Failed to create profile');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to login
        </button>
      )}

      <div className="text-center mb-6">
        <div className="w-14 h-14 bg-cdata-yellow rounded-2xl flex items-center justify-center mx-auto mb-3">
          <UserPlus className="w-7 h-7 text-cdata-black" />
        </div>
        <h2 className="text-xl font-bold text-cdata-black font-grafier">Create Profile</h2>
        <p className="text-sm text-gray-500 mt-1">Set up your Talent Intelligence account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Doe"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-cdata-yellow focus:ring-2 focus:ring-cdata-yellow/20 focus:outline-none text-sm"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="john@company.com"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-cdata-yellow focus:ring-2 focus:ring-cdata-yellow/20 focus:outline-none text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
          <div className="grid grid-cols-2 gap-2">
            {USER_ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRole(r.id)}
                className={cn(
                  'px-3 py-2 rounded-lg border text-left transition-all text-xs',
                  role === r.id
                    ? 'border-cdata-yellow bg-cdata-yellow/10 text-cdata-black'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                )}
              >
                <p className="font-medium">{r.label}</p>
                <p className="text-gray-400 mt-0.5">{r.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <PasswordInput
            value={password}
            onChange={setPassword}
            placeholder="Min 4 characters"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
          <PasswordInput
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Re-enter password"
          />
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        <button
          type="submit"
          disabled={isCreating}
          className="w-full btn-cdata-primary flex items-center justify-center gap-2"
        >
          {isCreating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Profile'
          )}
        </button>
      </form>
    </div>
  );
}
