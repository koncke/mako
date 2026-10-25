'use client';
// =============================================================================
// PedirAlEquipo — «Eso no está en MaKo»: el botón que se lo pasa al equipo, debajo del globo de MaKo (24/10/2026, f23)
// =============================================================================
// La llamada con Leandro (36:27): MaKo le describió un bloque de Instagram en Configuraciones que no existía. Martín: «si
// Mako detecta que lo que le preguntó no está, que levante un ticket o que le diga al usuario no, eso no está, pero se lo
// voy a levantar al equipo... Para eso existe la tiquetera que ya está implementada». MaKo lo dice en su respuesta y pone
// en `falta` qué pidió (lib/flujo-ia-intencion.ts, LO_QUE_NO_ES_TARJETA); este botón lo manda como un PEDIDO a la Ticketera.
// ⚠️ El texto del ticket NO sale del navegador: la ruta (app/api/chat-agent/secuencias/ia/falta) lo busca en el chat GUARDADO
//    de esa automatización. Lo que viaja de acá sólo dice cuál es.
// =============================================================================

import { useState, type CSSProperties } from 'react';
import { RUTA_FALTA } from './pedir-al-equipo';

/** El rótulo del botón y lo que dice cuando salió. */
export const ROTULO_PEDIR = 'Pedírselo al equipo';
export const ROTULO_PEDIDO = 'Se lo pasamos al equipo';

const S_BOTON: CSSProperties = {
  marginTop: 6, padding: '4px 10px', border: '1px solid var(--line)', borderRadius: 999, background: 'var(--surface)',
  color: 'var(--ink)', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
};
const S_NOTA: CSSProperties = { display: 'block', marginTop: 6, fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' };

export function PedirAlEquipo({ secuenciaId, falta }: { secuenciaId: number; falta: string }) {
  const [estado, setEstado] = useState<{ k: 'listo' } | { k: 'mandando' } | { k: 'mandado'; id: number } | { k: 'fallo'; texto: string }>({ k: 'listo' });
  const mandar = async () => {
    if (estado.k === 'mandando' || estado.k === 'mandado') return;
    setEstado({ k: 'mandando' });
    try {
      const r = await fetch(RUTA_FALTA, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ secuenciaId, falta }) });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; id?: number; error?: string } | null;
      if (j?.ok && typeof j.id === 'number') setEstado({ k: 'mandado', id: j.id });
      else setEstado({ k: 'fallo', texto: j?.error || 'No salió. Vuelve a tocar en un rato.' });
    } catch {
      setEstado({ k: 'fallo', texto: 'No salió: revisa tu conexión y vuelve a tocar.' });
    }
  };
  if (estado.k === 'mandado') return <span data-pedido-equipo="" role="status" style={S_NOTA}>{ROTULO_PEDIDO} · ticket #{estado.id}</span>;
  return (
    <span data-pedir-equipo="">
      <button type="button" style={S_BOTON} onClick={() => void mandar()} disabled={estado.k === 'mandando'}
        title="Lo manda a la Ticketera como un pedido">
        {estado.k === 'mandando' ? 'Mandando…' : ROTULO_PEDIR}
      </button>
      {estado.k === 'fallo' && <span role="status" style={S_NOTA}>{estado.texto}</span>}
    </span>
  );
}
