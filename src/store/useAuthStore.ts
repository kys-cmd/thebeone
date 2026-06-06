import { create } from 'zustand';
import { Profile } from '@/types';

interface AuthState {
  user: Profile | null;
  provider: string | null;
  isLoading: boolean;
  setUser: (user: Profile | null, provider?: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  provider: null,
  isLoading: true,
  setUser: (user, provider = null) => set({ user, provider }),
  setLoading: (isLoading) => set({ isLoading }),
}));
