'use client';

// =============================================================================
// /admin/copywriting - el cerebro de redaccion de MaKo
// =============================================================================
// Era la tercera sub-tab de /admin y se fue a su propia ruta el 27/09/2026, a
// pedido: «lo de copywriting ni siquiera deberia estar alli, ponlo como otra tab
// en la seccion de admin en la sidebar».
//
// Y la mudanza arregla de paso algo que ya estaba reportado dos veces como «me
// redirige»: la unica forma de llegar era el deep-link /admin?tab=copy, leido por
// un `useEffect` de MONTAJE. Estando ya en /admin, una navegacion del router no
// remonta nada, asi que el link te dejaba mirando Clientes. Una ruta no tiene ese
// problema. El link viejo sigue andando: /admin?tab=copy redirige aca.
//
// ⚠️ LO QUE NO SE ARREGLO, y queda escrito para el que venga: esto escribe en
// `OWNER_WS` (lib/copywriting-metodo.ts), que vale 1 y ES MAURICIO, UN CLIENTE.
// Lo de la PLATAFORMA va en `wsSuperAdmin()` — AGENTS.md lo tiene con su caso
// medido. O sea que hoy la metodologia y el swipe de MaKo viven adentro de la
// cuenta de un cliente. No se toco en esta mudanza porque cambiarlo MUEVE DATOS
// que ya estan cargados, y eso es una decision con su propio backfill.

import { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from '@/app/_components/ChatItemMenu';
import { MONO, card, input, labelStyle, btnDark, btnGhost, chip, bannerError } from '../estilos';

// =============================================================================
// TAB — MaKo (cerebro de copywriting: metodología curada + swipe de ejemplos)
// =============================================================================
// Owner-only. La metodología eleva TODA la redacción de MaKo (nutrición, asesor
// de WhatsApp, plantillas). Los ejemplos son emails reales que cargás como
// referencia; MaKo los usa de few-shot al escribir. Ambos se guardan en el
// workspace del dueño y se comparten (read-only) a la IA de todos los clientes.

type EjemploSwipe = { id: number; titulo: string; fuente: string | null; cuerpo: string; created_at: string };

export function Copywriting() {
  const [cargando, setCargando] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [metodo, setMetodo] = useState(false);
  const [ejemplos, setEjemplos] = useState<EjemploSwipe[]>([]);

  const [sembrando, setSembrando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const [asunto, setAsunto] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [nota, setNota] = useState('');
  const [fuente, setFuente] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errEj, setErrEj] = useState<string | null>(null);
  const [aBorrar, setABorrar] = useState<EjemploSwipe | null>(null);

  const cargar = useCallback(async () => {
    setErr(null);
    try {
      const j = await (await fetch('/api/mako/copywriting', { cache: 'no-store' })).json();
      if (!j.ok) { setErr(j.error ?? 'No se pudo cargar.'); return; }
      setMetodo(Boolean(j.metodoSembrado));
      setEjemplos((j.ejemplos ?? []) as EjemploSwipe[]);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const post = async (body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; creadas?: number }> => {
    try { return await (await fetch('/api/mako/copywriting', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(); }
    catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
  };

  const sembrar = async () => {
    if (sembrando) return;
    setSembrando(true); setAviso(null);
    try {
      const j = await post({ action: 'seed' });
      if (!j.ok) { setAviso(j.error ?? 'No se pudo sembrar.'); return; }
      setMetodo(true);
      setAviso(j.creadas ? `Listo — MaKo aprendió ${j.creadas} marcos de copywriting.` : 'La metodología ya estaba cargada.');
    } finally { setSembrando(false); }
  };

  const agregar = async () => {
    if (guardando || !cuerpo.trim()) return;
    setGuardando(true); setErrEj(null);
    try {
      const j = await post({ action: 'add-ejemplo', asunto: asunto.trim(), cuerpo: cuerpo.trim(), nota: nota.trim(), fuente: fuente.trim() });
      if (!j.ok) { setErrEj(j.error ?? 'No se pudo guardar el ejemplo.'); return; }
      setAsunto(''); setCuerpo(''); setNota(''); setFuente('');
      await cargar();
    } finally { setGuardando(false); }
  };

  const borrar = async (id: number) => {
    const j = await post({ action: 'del-ejemplo', id });
    if (!j.ok) { setErrEj(j.error ?? 'No se pudo borrar.'); return; }
    await cargar();
  };

  if (cargando) return <div style={{ ...card, color: 'var(--faint)', fontFamily: MONO, fontSize: 13 }}>Cargando…</div>;
  if (err) {
    return (
      <div style={{ ...bannerError, display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'space-between' }}>
        <span>{err}</span>
        <button style={{ ...btnDark, padding: '8px 14px', flex: 'none' }} onClick={() => { setCargando(true); cargar(); }}>Reintentar</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Metodología curada ─────────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>Metodología de copywriting</div>
          {metodo
            ? <span style={chip('var(--good-bg)', 'var(--good)')}>cargada ✓</span>
            : <span style={chip('var(--warn-bg)', 'var(--warn)')}>sin cargar</span>}
        </div>
        <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 16, lineHeight: 1.55 }}>
          Marcos probados (AIDA, PAS, gatillos de psicología, anatomía de secuencias, asuntos, CTA, qué nunca hacer). Se cargan como conocimiento del área <b>mensajes</b> y elevan <b>toda</b> la redacción de MaKo: la nutrición, el asesor de WhatsApp y las plantillas. Se edita después en <b>Conocimiento</b>.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={{ ...btnDark, opacity: sembrando ? 0.5 : 1 }} disabled={sembrando} onClick={sembrar}>
            {sembrando ? 'Cargando…' : metodo ? 'Volver a sembrar' : 'Cargar metodología'}
          </button>
          {aviso && <span style={{ fontSize: 13, color: 'var(--good)', fontWeight: 600 }}>{aviso}</span>}
        </div>
      </div>

      {/* ── Swipe de ejemplos ──────────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--ink)', marginBottom: 4 }}>Ejemplos reales (swipe)</div>
        <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 16, lineHeight: 1.55 }}>
          Pega emails o mensajes que te lleguen y te parezcan buenos. MaKo los usa de referencia (few-shot) al escribir. No hace falta que sean tuyos: sirven como muestra de estructura y tono.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Asunto <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--faint)' }}>(opcional)</span></label>
            <input style={input} value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="El asunto del email" />
          </div>
          <div>
            <label style={labelStyle}>De quién / fuente <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--faint)' }}>(opcional)</span></label>
            <input style={input} value={fuente} onChange={(e) => setFuente(e.target.value)} placeholder="Ej. Newsletter de X" />
          </div>
        </div>
        <label style={labelStyle}>Mensaje</label>
        <textarea value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} rows={6} placeholder="Pega aquí el cuerpo del email / mensaje."
          style={{ ...input, resize: 'vertical', lineHeight: 1.5, marginBottom: 12 }} />
        <label style={labelStyle}>Por qué te gustó <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--faint)' }}>(opcional, pero ayuda a MaKo)</span></label>
        <input style={{ ...input, marginBottom: 14 }} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. El asunto genera curiosidad y el cierre no presiona." />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={{ ...btnDark, opacity: guardando || !cuerpo.trim() ? 0.5 : 1 }} disabled={guardando || !cuerpo.trim()} onClick={agregar}>{guardando ? 'Guardando…' : 'Guardar ejemplo'}</button>
          {errEj && <span style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600 }}>{errEj}</span>}
        </div>
      </div>

      {ejemplos.length > 0 && (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '13px 18px', fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', borderBottom: '1px solid var(--border)' }}>{ejemplos.length} {ejemplos.length === 1 ? 'ejemplo' : 'ejemplos'} cargados</div>
          {ejemplos.map((ej, i) => (
            <div key={ej.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 18px', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ej.titulo || '(sin asunto)'}</div>
                {ej.fuente && <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 1 }}>{ej.fuente}</div>}
                <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 5, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ej.cuerpo}</div>
              </div>
              <button style={{ ...btnGhost, padding: '6px 10px', fontSize: 12.5, color: 'var(--bad)', flex: 'none' }} onClick={() => setABorrar(ej)}>Borrar</button>
            </div>
          ))}
        </div>
      )}

      {aBorrar && (
        <ConfirmDialog
          titulo="¿Borrar este ejemplo?"
          detalle="MaKo deja de usarlo como referencia. Esta acción no se puede deshacer."
          confirmLabel="Borrar"
          danger
          onCancel={() => setABorrar(null)}
          onConfirm={() => { const ej = aBorrar; setABorrar(null); borrar(ej.id); }}
        />
      )}
    </div>
  );
}
