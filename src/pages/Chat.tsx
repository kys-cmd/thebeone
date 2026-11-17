import { Navigate } from 'react-router-dom';

/**
 * 실시간 채팅/메신저 기능이 비활성화되어 /chat 진입 시 메인 홈으로 리다이렉트합니다.
 */
export default function ChatPage() {
  return <Navigate to="/" replace />;
}
