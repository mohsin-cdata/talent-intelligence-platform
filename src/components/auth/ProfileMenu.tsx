'use client';

import { useState, useRef, useEffect } from 'react';
import { LogOut, Settings, User, ChevronDown, X, Mail, Shield, Clock } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { cn } from '@/lib/utils';

interface ProfileMenuProps {
  onOpenWizard: () => void;
}

export function ProfileMenu({ onOpenWizard }: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { getActiveProfile, logout, hasCredentials } = useAuthStore();
  const profile = getActiveProfile();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!profile) return null;

  const initials = profile.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'flex items-center gap-2 p-1.5 rounded-lg transition-colors',
            'hover:bg-gray-100',
            isOpen && 'bg-gray-100'
          )}
        >
          <div className="w-7 h-7 rounded-full bg-cdata-yellow/30 flex items-center justify-center">
            <span className="text-xs font-semibold text-cdata-black">{initials}</span>
          </div>
          <ChevronDown className={cn('w-3 h-3 text-gray-400 transition-transform', isOpen && 'rotate-180')} />
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-1 w-60 bg-white rounded-xl border border-gray-200 shadow-xl z-50 overflow-hidden animate-in">
            {/* Profile info */}
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="font-medium text-sm text-gray-800 truncate">{profile.name}</p>
              <p className="text-xs text-gray-500 truncate">{profile.email}</p>
              <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded capitalize mt-1 inline-block">
                {profile.role.replace('_', ' ')}
              </span>
            </div>

            {/* Actions */}
            <div className="py-1">
              {/* View Profile */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  setShowProfile(true);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <User className="w-4 h-4 text-gray-400" />
                View Profile
              </button>

              {/* Connection Setup - more prominent */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenWizard();
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                  !hasCredentials()
                    ? 'text-orange-700 bg-orange-50 hover:bg-orange-100'
                    : 'text-gray-700 hover:bg-gray-50'
                )}
              >
                <Settings className={cn('w-4 h-4', !hasCredentials() ? 'text-orange-500' : 'text-gray-400')} />
                <div className="text-left">
                  <p className="font-medium">Connection Setup</p>
                  {!hasCredentials() && (
                    <p className="text-[10px] text-orange-500">Action required</p>
                  )}
                </div>
              </button>

              <div className="border-t border-gray-100 my-1" />

              <button
                onClick={() => {
                  setIsOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4 text-red-400" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Profile Popup Modal */}
      {showProfile && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 animate-in">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="relative bg-gradient-to-r from-cdata-yellow/20 to-cdata-yellow/5 px-6 py-8 text-center">
              <button
                onClick={() => setShowProfile(false)}
                className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-black/10 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
              <div className="w-20 h-20 rounded-full bg-cdata-yellow/30 flex items-center justify-center mx-auto mb-3 border-4 border-white shadow">
                <span className="text-2xl font-bold text-cdata-black">{initials}</span>
              </div>
              <h2 className="text-xl font-bold text-cdata-black">{profile.name}</h2>
              <span className="inline-block mt-1 px-2.5 py-0.5 bg-white/80 text-gray-600 rounded-full text-xs font-medium capitalize">
                {profile.role.replace('_', ' ')}
              </span>
            </div>

            {/* Details */}
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="text-sm font-medium text-gray-800">{profile.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Credentials</p>
                  <p className="text-sm font-medium text-gray-800">
                    {hasCredentials() ? 'Configured (encrypted)' : 'Not configured'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Member since</p>
                  <p className="text-sm font-medium text-gray-800">
                    {new Date(profile.createdAt).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowProfile(false);
                  onOpenWizard();
                }}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Edit Connections
              </button>
              <button
                onClick={() => setShowProfile(false)}
                className="px-4 py-2 text-sm text-cdata-black bg-cdata-yellow rounded-lg hover:bg-cdata-yellow/90 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
