'use client';

// =============================================================================
// PanelBorradores — la cola de borradores del WhatsApp
// =============================================================================
// Lo monta la bandeja del número de empresa (EmpresaInbox). Hasta el 09/10/2026 lo
// montaba también la bandeja oficial (Chatwoot), que se borró con la integración.
//
// EL BOTÓN DE ENVIAR SE DIBUJA SOLO SI HAY POR DÓNDE. Lo decide el SERVIDOR
// (`?camino=1` → lib/borrador-camino.ts): un borrador cuyo número está desconectado
// o ya no está vinculado no tiene por dónde salir, y un botón que falla se lee como
// que la app está rota. Cuando no se puede, en lugar del botón va el motivo en una
// frase, y «Descartar» sigue disponible.
//
// El POST vuelve a verificar: entre el dibujo y el clic el número se puede caer,
// así que este gate es para no ofrecer lo imposible, nunca la única guarda.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { IconDraft } from './composer-icons';

type Camino = { via: 'empresa' | null; motivo: string | null };
type BorradorEnCola = {
  id: number; leadId: number | null; telefono: string; texto: string; origen: string;
  leadNombre: string | null; createdAt: string;
  /**
   * Un borrador de NOTA DE VOZ o de ARCHIVO (mig 0223): al aprobarse sale el audio o el archivo,
   * y `texto` es su pie. Antes el de audio guardaba «🎙 Nota de voz: …» y eso era lo que salía.
   */
  audioId?: number | null; adjuntoId?: number | null;
  /** Ausente = la lectura barata todavía no lo resolvió. El servidor nunca manda `null`. */
  camino?: Camino;
};

// Quién generó el borrador, en cristiano (el slug crudo no se muestra).
const ORIGEN_LABEL: Record<string, string> = {
  nutricion: 'Nutrición',
  mako: 'MaKo',
  manual: 'Manual',
  post_llamada: 'Post-llamada · MaKo',
};

async function jget<T>(url: string): Promise<T> { const r = await fetch(url, { cache: 'no-store' }); return r.json() as Promise<T>; }
async function jpost<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json() as Promise<T>;
}

const RUTA = '/api/whatsapp/evolution/borradores';

export function PanelBorradores({ onEnviado }: { onEnviado?: () => void | Promise<void> } = {}) {
  const [borradores, setBorradores] = useState<BorradorEnCola[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // La CINTA sólo necesita cuántos hay: eso es una lectura de nuestra DB. El
  // CAMINO se pide aparte (`?camino=1`), al abrir el panel: cuesta una lectura de
  // las líneas del negocio, y pagarla cada 20 s para una cinta que dice un número
  // no le sirve a nadie.
  const cargar = useCallback(async (conCamino: boolean) => {
    const j = await jget<{ ok: boolean; borradores: BorradorEnCola[] }>(conCamino ? `${RUTA}?camino=1` : RUTA);
    if (j.ok) setBorradores(j.borradores);
  }, []);
  useEffect(() => { void cargar(false); const t = setInterval(() => void cargar(false), 20000); return () => clearInterval(t); }, [cargar]);
  // Al abrir el panel se resuelve el camino de cada uno: es lo que decide si el
  // botón de enviar se dibuja.
  useEffect(() => { if (abierto) void cargar(true); }, [abierto, cargar]);

  const accion = useCallback(async (id: number, action: 'enviar' | 'descartar') => {
    setBusy(id); setErr(null);
    try {
      const j = await jpost<{ ok: boolean; error?: string }>(RUTA, { id, action });
      if (!j.ok) { setErr(j.error || 'No se pudo completar'); return; }
      await cargar(true);
      if (action === 'enviar') await onEnviado?.();
    } finally { setBusy(null); }
  }, [cargar, onEnviado]);

  // Sin cola no hay nada que ofrecer: ni cinta ni panel (el hook de arriba ya corrió).
  if (borradores.length === 0) return null;

  return (
    <>
      <button onClick={() => setAbierto(true)} title="Mensajes que MaKo dejó listos para que los mandes con 1 clic"
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', marginBottom: '6px', borderRadius: '12px', border: '1px solid var(--warn-fill)', background: 'var(--warn-bg)', color: 'var(--warn)', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Geist', sans-serif", textAlign: 'left' }}>
        <IconDraft /> {borradores.length} borrador{borradores.length > 1 ? 'es' : ''} por enviar
      </button>

      {abierto && (
        <div onClick={() => setAbierto(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '560px', maxHeight: '85vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: '16px', padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)' }}>Borradores por enviar</div>
              <button onClick={() => setAbierto(false)} title="Cerrar" style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--faint)', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--dim)', marginBottom: '14px', lineHeight: 1.5 }}>A leads calientes el sistema no manda solo (anti-baneo). Revisa y envía con 1 clic — o descarta.</div>
            {err && <div style={{ marginBottom: '12px', padding: '9px 12px', borderRadius: '9px', border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)', fontSize: '12.5px' }}>{err}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {borradores.map((b) => {
                // `undefined` = el camino todavía no llegó (la lectura barata no lo
                // trae): el botón va DESHABILITADO, nunca dibujado y después borrado
                // — un control que desaparece bajo el dedo se lee como un clic que no
                // registró. `null` = no hay por dónde: en su lugar va el motivo.
                const via = b.camino?.via;
                const sinResolver = b.camino === undefined;
                return (
                  <div key={b.id} style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 14px', background: 'var(--surface-2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--ink)' }}>{b.leadNombre || b.telefono}</span>
                      <span style={{ fontSize: '11px', color: 'var(--faint)', fontFamily: "'Geist Mono', monospace" }}>{ORIGEN_LABEL[b.origen] ?? b.origen}</span>
                    </div>
                    {(b.audioId || b.adjuntoId) && <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--dim)', marginBottom: '4px' }}>{b.audioId ? '🎙 Nota de voz' : '📎 Archivo'}</div>}
                    {b.texto && <div style={{ fontSize: '13.5px', color: 'var(--ink)', lineHeight: 1.5, whiteSpace: 'pre-wrap', marginBottom: '10px' }}>{b.texto}</div>}
                    {via === null && <div style={{ fontSize: '11.5px', color: 'var(--warn)', marginBottom: '8px', lineHeight: 1.45 }}>{b.camino?.motivo ?? 'No hay por dónde mandarlo.'}</div>}
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button onClick={() => void accion(b.id, 'descartar')} disabled={busy === b.id} style={{ padding: '7px 14px', borderRadius: '9px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Descartar</button>
                      {via !== null && (
                        <button onClick={() => void accion(b.id, 'enviar')} disabled={busy === b.id || sinResolver} style={{ padding: '7px 16px', borderRadius: '9px', border: 'none', background: 'var(--wa)', color: '#fff', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 600, cursor: busy === b.id || sinResolver ? 'default' : 'pointer', opacity: busy === b.id || sinResolver ? 0.6 : 1 }}>{busy === b.id ? 'Enviando…' : sinResolver ? 'Comprobando…' : 'Enviar ✓'}</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
