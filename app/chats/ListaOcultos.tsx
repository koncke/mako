'use client';

// =============================================================================
// ListaOcultos — los chats de WhatsApp que se sacaron de la lista, con «Mostrar de nuevo» (24/10/2026)
// =============================================================================
// docs/diseno-chats.md §8.4: lo que sólo tenía la tab vieja de /whatsapp viene a Chats, porque /whatsapp ya no se dibuja.
// «Ocultar» (el «⋯» de la conversación) saca un chat personal de la lista y de lo que lee MaKo; acá se ven y se devuelven.
//
// ⚠️ NO SE MUESTRA EL HISTORIAL de un oculto (la regla de la tab vieja: «su historial no se muestra ni MaKo lo lee»): la
//    fila dice quién es y ofrece devolverlo, nada más.
// ⚠️ UNA LECTURA POR NÚMERO (`?ocultos=1&linea=`), como la lista: sin la línea, el espejo de dos números sale mezclado.

import { useCallback, useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import type { LineaChat } from '@/lib/chats-tipos';
import { AvatarRio, postJson } from './ventana-piezas';

type Oculto = { chatJid: string; telefono: string | null; nombre: string; leadId: number | null; linea: string };

export function ListaOcultos({ ws, lineas, onMostrado, onAviso }: {
  ws: number | null;
  lineas: LineaChat[];
  /** Volvió a la lista: Chats la relee. */
  onMostrado: () => void;
  onAviso: (texto: string, error?: boolean) => void;
}) {
  const [ocultos, setOcultos] = useState<Oculto[] | null>(null);
  const [error, setError] = useState(false);
  const [mostrando, setMostrando] = useState<string | null>(null);

  const leer = useCallback(async () => {
    setError(false);
    try {
      const porLinea = await Promise.all(lineas.map(async (l) => {
        const r = await fetch(`/api/whatsapp/evolution/mensajes?ocultos=1&linea=${encodeURIComponent(l.linea)}`, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
        const j = (await r.json().catch(() => null)) as { ok?: boolean; conversaciones?: Array<Omit<Oculto, 'linea'>> } | null;
        if (!r.ok || !j?.ok) throw new Error(`Error ${r.status}`);
        return (j.conversaciones ?? []).map((c) => ({ ...c, linea: l.linea }));
      }));
      setOcultos(porLinea.flat());
    } catch {
      setError(true);
    }
  }, [lineas]);
  useEffect(() => { void leer(); }, [leer]);

  async function mostrar(o: Oculto) {
    if (!o.telefono || mostrando) return;
    setMostrando(o.chatJid);
    const j = await postJson<{ ok: boolean; error?: string }>('/api/whatsapp/evolution/block', { telefono: o.telefono, action: 'unhide', leadId: o.leadId });
    setMostrando(null);
    if (!j.ok) { onAviso('No se pudo mostrar', true); return; }
    setOcultos((xs) => (xs ?? []).filter((x) => x.chatJid !== o.chatJid || x.linea !== o.linea));
    onAviso('Volvió a la lista');
    onMostrado();
  }

  if (error) {
    return (
      <div className="rio-vacio">
        <span>No pude leer los ocultos.</span>
        <button type="button" className="rio-btn" onClick={() => void leer()}>Reintentar</button>
      </div>
    );
  }
  if (!ocultos) return <div className="rio-vacio"><LoaderCircle size={20} className="rio-girando" aria-label="Cargando" /></div>;
  if (!ocultos.length) return <div className="rio-vacio">No hay chats ocultos.</div>;
  return (
    <div className="rio-filas" role="list">
      {ocultos.map((o) => (
        <div key={`${o.linea}:${o.chatJid}`} role="listitem" className="rio-fila rio-fila-oculta">
          <AvatarRio ws={ws} nombre={o.nombre} size={32} tel={o.telefono} canal="whatsapp" />
          <span className="rio-fila-cuerpo">
            <span className="rio-nombre">{o.nombre}</span>
            {o.telefono && <span className="rio-preview">+{o.telefono}</span>}
          </span>
          <button type="button" className="rio-btn" disabled={!o.telefono || mostrando === o.chatJid} onClick={() => void mostrar(o)}>Mostrar</button>
        </div>
      ))}
    </div>
  );
}
