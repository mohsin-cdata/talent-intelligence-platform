import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserProfile, StoredProfile, UserCredentials, UserRole, EncryptedData } from '@/types';
import { encrypt, decrypt, hashPassword } from './crypto';

interface AuthState {
  // Persisted to localStorage
  profiles: StoredProfile[];
  activeProfileId: string | null;

  // In-memory only (NOT persisted)
  sessionPassword: string | null;
  decryptedCredentials: UserCredentials | null;
  isAuthenticated: boolean;

  // Actions
  createProfile: (name: string, email: string, role: UserRole, password: string) => Promise<UserProfile>;
  login: (profileId: string, password: string) => Promise<boolean>;
  logout: () => void;
  deleteProfile: (profileId: string) => void;
  saveCredentials: (credentials: UserCredentials) => Promise<void>;
  getDecryptedCredentials: () => UserCredentials | null;
  getActiveProfile: () => UserProfile | null;
  updateProfile: (profileId: string, updates: Partial<UserProfile>) => void;
  hasCredentials: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeProfileId: null,
      sessionPassword: null,
      decryptedCredentials: null,
      isAuthenticated: false,

      createProfile: async (name, email, role, password) => {
        const { hash, salt } = await hashPassword(password);

        const profile: UserProfile = {
          id: `profile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name,
          email,
          role,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };

        const storedProfile: StoredProfile = {
          profile,
          passwordHash: hash,
          passwordSalt: salt,
          credentials: null,
        };

        set((state) => ({
          profiles: [...state.profiles, storedProfile],
          activeProfileId: profile.id,
          sessionPassword: password,
          isAuthenticated: true,
          decryptedCredentials: null,
        }));

        return profile;
      },

      login: async (profileId, password) => {
        const state = get();
        const stored = state.profiles.find((p) => p.profile.id === profileId);
        if (!stored) return false;

        const { hash } = await hashPassword(password, stored.passwordSalt);
        if (hash !== stored.passwordHash) return false;

        let decrypted: UserCredentials | null = null;
        if (stored.credentials) {
          try {
            const json = await decrypt(stored.credentials, password);
            decrypted = JSON.parse(json);
          } catch {
            decrypted = null;
          }
        }

        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.profile.id === profileId
              ? { ...p, profile: { ...p.profile, lastLoginAt: new Date().toISOString() } }
              : p
          ),
          activeProfileId: profileId,
          sessionPassword: password,
          isAuthenticated: true,
          decryptedCredentials: decrypted,
        }));

        return true;
      },

      logout: () => {
        set({
          activeProfileId: null,
          sessionPassword: null,
          decryptedCredentials: null,
          isAuthenticated: false,
        });
      },

      deleteProfile: (profileId) => {
        set((state) => ({
          profiles: state.profiles.filter((p) => p.profile.id !== profileId),
          ...(state.activeProfileId === profileId
            ? {
                activeProfileId: null,
                sessionPassword: null,
                decryptedCredentials: null,
                isAuthenticated: false,
              }
            : {}),
        }));
      },

      saveCredentials: async (credentials) => {
        const state = get();
        if (!state.activeProfileId || !state.sessionPassword) return;

        const encrypted = await encrypt(
          JSON.stringify(credentials),
          state.sessionPassword
        );

        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.profile.id === state.activeProfileId
              ? { ...p, credentials: encrypted as EncryptedData }
              : p
          ),
          decryptedCredentials: credentials,
        }));
      },

      getDecryptedCredentials: () => {
        return get().decryptedCredentials;
      },

      getActiveProfile: () => {
        const state = get();
        const stored = state.profiles.find((p) => p.profile.id === state.activeProfileId);
        return stored?.profile || null;
      },

      updateProfile: (profileId, updates) => {
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.profile.id === profileId
              ? { ...p, profile: { ...p.profile, ...updates } }
              : p
          ),
        }));
      },

      hasCredentials: () => {
        const state = get();
        const stored = state.profiles.find((p) => p.profile.id === state.activeProfileId);
        return !!stored?.credentials;
      },
    }),
    {
      name: 'talent-intel-auth',
      partialize: (state) => ({
        profiles: state.profiles,
        activeProfileId: state.activeProfileId,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
