// =============================================================================
// /mako — "Preguntale a MaKo": chat general + historial de todos los chats
// =============================================================================

import { MakoTab } from './MakoTab';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function MakoPage() {
  return <MakoTab />;
}
