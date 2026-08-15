'use client';

// =============================================================================
// InboxDms — conversaciones de Instagram + el borrador de MaKo con envío a 1 clic
// =============================================================================
// El espejo local (ig_conversaciones / ig_mensajes) lo alimenta el webhook de
// Zernio. El borrador del chatbot es una fila estado='borrador' (patrón
// wa_borradores): acá se destaca, se puede EDITAR antes de enviar, y el envío
// pega a POST /api/instagram/enviar — CONTRATO con el agente del webhook:
//   body { id: number (ig_mensajes.id del borrador), texto: string (editado) }
//   → { ok: boolean, error?: string }
// El rótulo del estado de MaKo sale de la gramática (<Mako compacto>), nunca de
// un string inventado acá.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Avatar, Badge, Button, EmptyState, Mako, SkeletonLines, Status, Textarea } from '@/app/_ui';
import type { ConversacionIg, MensajeIg } from './ig-datos';
import { descartarBorradorDmAction, listarInboxAction, listarMensajesAction } from './actions';

// ── Ventana de 24h de Meta ───────────────────────────────────────────────────

function ventanaRestante(iso: string | null): { abierta: boolean; label: string } {
  if (!iso) return { abierta: false, label: 'Sin ventana' };
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return { abierta: false, label: 'Ventana cerrada' };
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return { abierta: true, label: h > 0 ? `Ventana: ${h} h ${m} min` : `Ventana: ${m} min` };
}

const hora = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

// ── Componente ───────────────────────────────────────────────────────────────

export function InboxDms({ avisar }: { avisar: (msg: string) => void }) {
  const [convs, setConvs] = useState<ConversacionIg[] | null>(null);
  const [errorInbox, setErrorInbox] = useState<string | null>(null);
  const [activaId, setActivaId] = useState<number | null>(null);

  const [mensajes, setMensajes] = useState<MensajeIg[] | null>(null);
  const [errorHilo, setErrorHilo] = useState<string | null>(null);

  // Texto editable POR borrador (id → texto). El usuario corrige antes de enviar.
  const [ediciones, setEdiciones] = useState<Record<number, string>>({});
  // Estado por acción, nunca un busy compartido (regla de la skill).
  const [busyEnviar, setBusyEnviar] = useState<number | null>(null);
  const [busyDescartar, setBusyDescartar] = useState<number | null>(null);

  const cargarInbox = useCallback(async () => {
    const r = await listarInboxAction();
    if (!r.ok) { setErrorInbox(r.error); return; }
    setErrorInbox(null);
    setConvs(r.conversaciones);
  }, []);

  const cargarHilo = useCallback(async (convId: number) => {
    const r = await listarMensajesAction(convId);
    if (!r.ok) { setErrorHilo(r.error); return; }
    setErrorHilo(null);
    setMensajes(r.mensajes);
    setEdiciones((prev) => {
      const sig = { ...prev };
      for (const m of r.mensajes) {
        if (m.estado === 'borrador' && sig[m.id] === undefined) sig[m.id] = m.texto ?? '';
      }
      return sig;
    });
  }, []);

  useEffect(() => { void cargarInbox(); }, [cargarInbox]);
  useEffect(() => {
    if (activaId != null) { setMensajes(null); void cargarHilo(activaId); }
  }, [activaId, cargarHilo]);

  const activa = useMemo(() => convs?.find((c) => c.id === activaId) ?? null, [convs, activaId]);
  const ventana = ventanaRestante(activa?.ventanaExpiraAt ?? null);

  const enviar = async (m: MensajeIg) => {
    const texto = (ediciones[m.id] ?? m.texto ?? '').trim();
    if (!texto) { setErrorHilo('El mensaje no puede salir vacío.'); return; }
    setBusyEnviar(m.id);
    setErrorHilo(null);
    try {
      // Ruta del agente del webhook (contrato arriba). No es una server action
      // a propósito: el envío y su idempotencia viven en un solo lugar.
      const res = await fetch('/api/instagram/enviar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: m.id, texto }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setErrorHilo(data.error ?? `No se pudo enviar (HTTP ${res.status}).`);
        return;
      }
      avisar('Respuesta enviada.');
      if (activaId != null) await cargarHilo(activaId);
      await cargarInbox();
    } catch (e) {
      setErrorHilo(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyEnviar(null);
    }
  };

  const descartar = async (m: MensajeIg) => {
    setBusyDescartar(m.id);
    const r = await descartarBorradorDmAction(m.id);
    setBusyDescartar(null);
    if (!r.ok) { setErrorHilo(r.error ?? 'No se pudo descartar.'); return; }
    avisar('Borrador descartado.');
    if (activaId != null) await cargarHilo(activaId);
    await cargarInbox();
  };

  if (errorInbox) return <Alert tono="bad">{errorInbox}</Alert>;
  if (convs === null) return <SkeletonLines lines={5} />;
  if (convs.length === 0) {
    return (
      <EmptyState
        titulo="Todavía no hay conversaciones"
        detalle="Cuando alguien te escriba por DM, la conversación aparece aquí y MaKo deja su borrador de respuesta listo para revisar."
      />
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 320px) 1fr', gap: 16, alignItems: 'start' }}>
      {/* ── Lista de conversaciones ── */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--surface)', overflow: 'hidden' }}>
        <div style={{ maxHeight: '64vh', overflowY: 'auto' }}>
          {convs.map((c) => {
            const v = ventanaRestante(c.ventanaExpiraAt);
            const on = c.id === activaId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActivaId(c.id)}
                aria-current={on || undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                  padding: '11px 13px', border: 'none', borderBottom: '1px solid var(--border)',
                  background: on ? 'var(--surface-2)' : 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <Avatar name={c.username ?? '?'} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 'var(--fs-md)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.username ? `@${c.username}` : 'Sin nombre'}
                    </span>
                    {c.borradoresPendientes > 0 && <Badge tono="mako">{c.borradoresPendientes}</Badge>}
                  </span>
                  <span style={{ display: 'block', fontSize: 'var(--fs-sm)', color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.ultimoTexto ?? '—'}
                  </span>
                  <span style={{ display: 'block', fontSize: 11.5, color: v.abierta ? 'var(--faint)' : 'var(--warn)' }}>
                    {v.label}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Hilo ── */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--surface)', minHeight: 320, display: 'flex', flexDirection: 'column' }}>
        {activa === null ? (
          <EmptyState inline titulo="Elige una conversación" detalle="El historial y los borradores de MaKo se muestran aquí." />
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <Avatar name={activa.username ?? '?'} />
              <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{activa.username ? `@${activa.username}` : 'Sin nombre'}</span>
              <span style={{ flex: 1 }} />
              <Status tono={ventana.abierta ? 'good' : 'warn'}>{ventana.label}</Status>
            </div>

            <div style={{ flex: 1, minHeight: 0, maxHeight: '48vh', overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {errorHilo && <Alert tono="bad">{errorHilo}</Alert>}
              {mensajes === null ? (
                <SkeletonLines lines={4} />
              ) : (
                mensajes.filter((m) => m.estado !== 'borrador').map((m) => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: m.direccion === 'saliente' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '72%', padding: '8px 12px', borderRadius: 12, fontSize: 'var(--fs-md)', lineHeight: 1.5,
                      background: m.direccion === 'saliente' ? 'var(--primary-bg)' : 'var(--surface-2)',
                      border: '1px solid var(--border)', color: 'var(--ink)', whiteSpace: 'pre-wrap',
                    }}>
                      {m.texto ?? <em style={{ color: 'var(--faint)' }}>(sin texto)</em>}
                      {m.adjuntos.length > 0 && (
                        <div style={{ marginTop: 4, fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>
                          {m.adjuntos.map((a) => `Adjunto: ${a.filename ?? a.type ?? 'archivo'}`).join(' · ')}
                        </div>
                      )}
                      <div style={{ marginTop: 3, fontSize: 11, color: 'var(--faint)', textAlign: m.direccion === 'saliente' ? 'right' : 'left' }}>
                        {hora(m.createdAt)}
                        {m.estado === 'error' && m.error && <span style={{ color: 'var(--bad)' }}> · {m.error}</span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* ── El borrador de MaKo, destacado y editable ── */}
            {(mensajes ?? []).filter((m) => m.estado === 'borrador').map((m) => (
              <div key={m.id} style={{ borderTop: '1px solid var(--mako-border)', background: 'var(--mako-bg)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Mako estado="aprobacion" compacto />
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>
                    Borrador de MaKo · edítalo si hace falta y envíalo
                  </span>
                </div>
                <Textarea
                  value={ediciones[m.id] ?? m.texto ?? ''}
                  onChange={(e) => setEdiciones((prev) => ({ ...prev, [m.id]: e.target.value }))}
                  rows={3}
                  aria-label="Texto de la respuesta"
                />
                {!ventana.abierta && (
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink)' }}>
                    La ventana de 24 h de Meta está cerrada: el envío sale con la etiqueta
                    HUMAN_AGENT (la única que Instagram acepta fuera de ventana) y puede ser
                    rechazado si pasó demasiado tiempo.
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <Button size="sm" variant="tertiary" onClick={() => void descartar(m)} loading={busyDescartar === m.id} disabled={busyEnviar === m.id}>
                    Descartar borrador
                  </Button>
                  <Button size="sm" variant="primary" onClick={() => void enviar(m)} loading={busyEnviar === m.id} disabled={busyDescartar === m.id}>
                    Enviar respuesta
                  </Button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
