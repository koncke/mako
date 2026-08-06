// Chat Analyst — analiza las conversaciones (WhatsApp, Email, Instagram) como
// Closing Analyst analiza las llamadas: qué se dijo, dónde se cayó y qué hacer.
import { ComingSoon } from '../_components/ComingSoon';
import { requireRolWs } from '@/lib/tab-access';

export default async function ChatAnalystPage() {
  await requireRolWs([], { nav: 'chat-analyst' });
  return <ComingSoon title="Chat Analyst" icon="chats" />;
}
