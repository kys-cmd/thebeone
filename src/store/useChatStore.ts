import { create } from 'zustand';

interface ChatState {
  isOpen: boolean;
  activeRoomId: string | null;
  activeRoomName: string;
  openChat: (roomId?: string | null, roomName?: string) => void;
  closeChat: () => void;
  setActiveRoom: (roomId: string | null, roomName?: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  isOpen: false,
  activeRoomId: null,
  activeRoomName: '',
  openChat: (roomId = null, roomName = '') => set({ 
    isOpen: true, 
    activeRoomId: roomId, 
    activeRoomName: roomName 
  }),
  closeChat: () => set({ isOpen: false }),
  setActiveRoom: (roomId, roomName = '') => set({ 
    activeRoomId: roomId, 
    activeRoomName: roomName 
  }),
}));
