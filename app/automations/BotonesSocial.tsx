'use client';

// =============================================================================
// BotonesSocial — los BOTONES de un mensaje de Instagram o Messenger, en su editor (24/10/2026)
// =============================================================================
// Martín (trabajo 49ff20a3): «Aun no arreglaste lo de los botones en Automations de Instagram», con un DM de Fiesta Music
// que trae «Obtener recurso». Como en ManyChat: los botones se ven debajo del último mensaje, como los ve la persona en
// Instagram, y se tocan para editarlos ahí mismo. Dos clases (lib/botones-social.ts):
//   · «Sigue el flujo»: es una SALIDA de la tarjeta. En el lienzo, una fila con su círculo y su ＋: lo que pasa al tocarlo
//     (el link, «¿Te sigue?») se conecta desde ahí, como una fila de una condición;
//   · «Abre un link»: abre la página. No mueve nada.
// Hasta 3 (Meta), títulos de hasta 20. Lo que no se puede publicar (sin a dónde, un link que no es una dirección, un texto
// de más de 640) lo dice Publicar (`validarGrafo`), no este editor.
// =============================================================================

import { useState, type CSSProperties } from 'react';
import { TOPE_BOTONES, TOPE_TITULO_BOTON, type BotonSocial } from '@/lib/botones-social';

/** Un id que esta tarjeta no usa todavía. Pura y exportada para el test. */
export function idDeBotonNuevo(botones: readonly BotonSocial[]): string {
  const usados = new Set(botones.map((b) => b.id));
  let k = botones.length + 1;
  while (usados.has(`b${k}`)) k++;
  return `b${k}`;
}

const pildora: CSSProperties = {
  display: 'block', width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: 600, textAlign: 'center',
  cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
};
const campo: CSSProperties = {
  width: '100%', boxSizing: 'border-box', height: 32, padding: '0 9px', borderRadius: 8, border: '1px solid var(--border-strong)',
  background: 'var(--surface)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: 13,
};

export function BotonesSocial({ botones, onCambio, deshabilitado = false }: {
  botones: readonly BotonSocial[];
  onCambio: (b: BotonSocial[]) => void;
  deshabilitado?: boolean;
}) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const cambiar = (id: string, patch: Partial<BotonSocial>) => onCambio(botones.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const agregar = () => {
    const id = idDeBotonNuevo(botones);
    onCambio([...botones, { id, titulo: 'Botón', siguiente: null }]);
    setAbierto(id);
  };
  const quitar = (id: string) => { onCambio(botones.filter((b) => b.id !== id)); setAbierto(null); };
  return (
    <div data-botones-social="" style={{ alignSelf: 'flex-end', width: 'min(240px, 100%)', display: 'flex', flexDirection: 'column', gap: 5, marginTop: 2 }}>
      {botones.map((b) => (abierto === b.id ? (
        <div key={b.id} data-boton-editando={b.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, borderRadius: 10, border: '1px solid var(--primary)', background: 'var(--surface)' }}>
          <input value={b.titulo} maxLength={TOPE_TITULO_BOTON} disabled={deshabilitado} aria-label="Nombre del botón" autoFocus
            onChange={(e) => cambiar(b.id, { titulo: e.target.value })} style={campo} />
          <div role="radiogroup" aria-label="Qué hace el botón" style={{ display: 'flex', gap: 4 }}>
            {([['flujo', 'Sigue el flujo'], ['link', 'Abre un link']] as const).map(([k, r]) => {
              const activo = k === 'link' ? b.url != null : b.url == null;
              return (
                <button key={k} type="button" role="radio" aria-checked={activo} disabled={deshabilitado}
                  onClick={() => cambiar(b.id, k === 'link' ? { url: b.url ?? 'https://', siguiente: null } : { url: null, siguiente: b.siguiente ?? null })}
                  style={{ flex: 1, height: 28, borderRadius: 999, border: activo ? '1px solid var(--primary)' : '1px solid var(--border)', background: activo ? 'var(--primary-bg)' : 'var(--surface)', color: activo ? 'var(--primary)' : 'var(--dim)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {r}
                </button>
              );
            })}
          </div>
          {b.url != null && (
            <input value={b.url} disabled={deshabilitado} aria-label="El link del botón" inputMode="url" placeholder="https://"
              onChange={(e) => cambiar(b.id, { url: e.target.value })} style={campo} />
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" disabled={deshabilitado} onClick={() => quitar(b.id)}
              style={{ height: 28, padding: '0 10px', borderRadius: 8, border: '1px solid var(--bad)', background: 'var(--surface)', color: 'var(--bad)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Quitar</button>
            <button type="button" onClick={() => setAbierto(null)}
              style={{ marginLeft: 'auto', height: 28, padding: '0 12px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Listo</button>
          </div>
        </div>
      ) : (
        <button key={b.id} type="button" data-boton={b.id} disabled={deshabilitado} onClick={() => setAbierto(b.id)}
          title={b.url ? `Abre ${b.url}` : b.siguiente ? 'Sigue el flujo' : 'Sigue el flujo: conéctalo en el lienzo'}
          style={{ ...pildora, ...(b.url == null && !b.siguiente ? { borderStyle: 'dashed' } : {}) }}>
          {b.titulo}
        </button>
      )))}
      {botones.length < TOPE_BOTONES && (
        <button type="button" data-agregar-boton="" disabled={deshabilitado} onClick={agregar}
          style={{ ...pildora, background: 'transparent', border: '1px dashed var(--border-strong)', color: 'var(--dim)', fontWeight: 500 }}>
          + Botón
        </button>
      )}
    </div>
  );
}
