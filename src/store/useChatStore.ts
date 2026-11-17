import { create } from 'zustand';

interface ChatState {
  isOpen: boolean;
  activeRoomId: string | null;
  activeRoomName: string;
  openChat: (roomId?: string | null, roomName?: string) => void;
  closeChat: () => void;
  setActiveRoom: (roomId: string | null, roomName?: string) => void;
}

/**
 * 실시간 채팅 비활성화 상태 스토어 (모든 호출을 안전하게 무시하고 닫힌 상태 유지)
 */
export const useChatStore = create<ChatState>((set) => ({
  isOpen: false,
  activeRoomId: null,
  activeRoomName: '',
  openChat: () => set({ isOpen: false, activeRoomId: null, activeRoomName: '' }),
  closeChat: () => set({ isOpen: false, activeRoomId: null, activeRoomName: '' }),
  setActiveRoom: () => set({ activeRoomId: null, activeRoomName: '' }),
}));
