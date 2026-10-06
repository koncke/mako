'use client';

// =============================================================================
// RecordatorioReunion — la tarjeta chica de /chatbot: el recordatorio de la reunión AL LEAD
// =============================================================================
// Un renglón con el interruptor y un botón que abre los tres textos (24 h, 1 h y 15 min antes).
// Decisión de Martín (06/10/2026): «A: 24h, 1h y 15min con link, ws1, apago n8n». Lo que manda y
// cuándo vive en lib/reunion-recordatorio.ts y lib/recordatorio-lead.ts; acá sólo se prende y se
// editan los textos, por /api/chat-agent/recordatorio-reunion (guard de admin).
//
// ⚠️ ES UN RENGLÓN Y NO UNA TARJETA GRANDE a propósito: la tab es el lienzo, y Martín sacó el
// título entero de esta pantalla para ganarle alto a la pizarra. Los textos van en un Modal.
//
// ⚠️ EL INTERRUPTOR ES UN SWITCH (prende YA, sin «Guardar»): es lo que dice app/_ui/Toggle.tsx.
// Los textos sí se guardan con un botón, porque se escriben de a varios.
//
// ⚠️ PRENDIDO NO ES «SALE»: si el envío de WhatsApp del negocio está apagado, no sale nada, y el
// renglón lo dice. `envioWhatsapp: null` = no se pudo leer, y entonces no se afirma nada.

import { useCallback, useEffect, useState } from 'react';
import { Modal, Button, Switch, Textarea } from '@/app/_ui';

type ToqueDto = { min: number; texto: string; porDefecto: boolean; textoDefault: string };
type Estado = { activo: boolean; envioWhatsapp: boolean | null; toques: ToqueDto[]; variables: string[] };

const ROTULO: Record<number, string> = { 1440: '24 h antes', 60: '1 h antes', 15: '15 min antes' };
const URL_API = '/api/chat-agent/recordatorio-reunion';

export function RecordatorioReunion() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  /** Los textos que se están editando en el modal. null = cerrado. */
  const [borrador, setBorrador] = useState<Record<number, string> | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(URL_API, { cache: 'no-store' });
      if (r.status === 403) { setSinPermiso(true); return; }
      const j = await r.json();
      if (!j.ok) { setErr(j.error || 'No se pudo leer.'); return; }
      setEstado(j as Estado);
      setErr(null);
    } catch {
      setErr('Sin conexión.');
    }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  async function guardar(cuerpo: { activo?: boolean; textos?: Record<number, string> }): Promise<boolean> {
    setGuardando(true); setErr(null);
    try {
      const r = await fetch(URL_API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) { setErr(j.error || 'No se pudo guardar.'); return false; }
      setEstado(j as Estado);
      return true;
    } catch {
      setErr('Sin conexión.');
      return false;
    } finally {
      setGuardando(false);
    }
  }

  if (sinPermiso) return null;

  const activo = estado?.activo ?? false;
  // Mientras carga no se afirma nada: el switch queda deshabilitado y sin glosa.
  const hint = !estado ? (err ?? undefined) : (
    <>
      {activo ? '24 h, 1 h y 15 min antes, por WhatsApp' : 'Apagado'}
      {activo && estado.envioWhatsapp === false && <span style={{ color: 'var(--warn)' }}> · No sale: envío apagado</span>}
      {err && <span style={{ color: 'var(--bad)' }}> · {err}</span>}
    </>
  );

  return (
    <div style={{ flex: 'none', margin: '0 24px 12px', display: 'flex', alignItems: 'center', gap: 12, padding: '2px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* El rótulo del switch ES el título del renglón: así el control tiene nombre para el
            lector de pantalla sin repetir el texto al lado. */}
        <Switch checked={activo} disabled={!estado || guardando} label="Recordatorio de la reunión" hint={hint}
          onChange={(v) => {
            if (!estado) return;
            // Optimista: el switch responde al toque y vuelve atrás si el server no lo guardó.
            setEstado({ ...estado, activo: v });
            void guardar({ activo: v }).then((ok) => { if (!ok) setEstado((e) => (e ? { ...e, activo: !v } : e)); });
          }} />
      </div>
      <Button variant="secondary" size="sm" disabled={!estado}
        onClick={() => estado && setBorrador(Object.fromEntries(estado.toques.map((t) => [t.min, t.texto])))}>
        Textos
      </Button>

      {borrador && estado && (
        <Modal titulo="Recordatorio de la reunión" onCerrar={() => setBorrador(null)}
          pie={(
            <>
              {/* Cada botón nombra su acción y su objeto: «Cancelar» / «Guardar» a secas no
                  (AGENTS.md, «Un contrato de datos no es un layout»). */}
              <Button variant="secondary" onClick={() => setBorrador(null)}>No guardar</Button>
              <Button variant="primary" loading={guardando}
                onClick={() => void guardar({ textos: borrador }).then((ok) => { if (ok) setBorrador(null); })}>
                Guardar textos
              </Button>
            </>
          )}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>
              Variables: {estado.variables.map((v) => `{{${v}}}`).join(' ')}. Sin link, ese renglón no sale.
            </div>
            {estado.toques.map((t) => {
              const valor = borrador[t.min] ?? '';
              return (
                <div key={t.min} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <label className="mk-label" htmlFor={`recordatorio-${t.min}`} style={{ marginBottom: 0 }}>{ROTULO[t.min] ?? `${t.min} min antes`}</label>
                    {valor.trim() !== t.textoDefault && (
                      <button type="button" onClick={() => setBorrador({ ...borrador, [t.min]: t.textoDefault })}
                        style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: 12, color: 'var(--primary)', cursor: 'pointer' }}>
                        Original
                      </button>
                    )}
                  </div>
                  <Textarea id={`recordatorio-${t.min}`} rows={3} value={valor}
                    onChange={(e) => setBorrador({ ...borrador, [t.min]: e.target.value })} />
                </div>
              );
            })}
            {err && <div style={{ fontSize: 12.5, color: 'var(--bad)' }}>{err}</div>}
          </div>
        </Modal>
      )}
    </div>
  );
}
