// =============================================================================
// /m/chats — mientras se leen las conversaciones: el segmentado y las filas (v3, 14/10/2026)
// =============================================================================

import { SkeletonFilas } from '@/app/m/_ui';
import './chats.css';

export default function ChatsCargando() {
  return (
    <div aria-busy="true" aria-label="Cargando los chats">
      <div className="mk-skel m-chats-skel-seg" />
      <div className="m-chats-lista"><SkeletonFilas filas={7} /></div>
    </div>
  );
}
