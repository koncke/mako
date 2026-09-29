'use client';

// =============================================================================
// Recordatorios — «si no contestás, ¿te lo vuelvo a mandar?»
// =============================================================================
// Vivía adentro de «⚙️ Editar el flujo (avanzado)», que el dueño mandó a sacar:
// «no tiene sentido si literalmente YA lo estoy editando». Sube al detalle porque
// es lo único de aquel panel que está cableado de punta a punta para un aviso.
//
// ── Por qué esto SÍ y el resto de aquel editor no ───────────────────────────
// Un aviso del catálogo NO pasa por el motor de flujos: sale por el choke point de
// `lib/avisos.ts`. Lo único que ese choke point sí mira del flujo es el paso
// `insistir` — lee `getFlujo(tipo)`, lo busca, y abre una fila en `insistencias`
// que drena un cron cada media hora. Así que acá se edita ESE paso y nada más: el
// disparador por evento y los pasos de mensaje/acción de aquel panel gobiernan el
// otro camino, y para un aviso serían controles que no cambian nada.
//
// ⚠️ SALEN POR WHATSAPP, y sólo si el aviso salió. El choke point abre la
// insistencia adentro del `if (env.ok)` del envío, que es correcto —insistir sobre
// un mensaje que nunca salió es contar repeticiones de algo que nadie vio— y tiene
// una consecuencia que la pantalla dice: con WhatsApp apagado para este mensaje, no
// hay recordatorio posible.
//
// ⚠️ APAGARLOS CIERRA LOS QUE YA ESTÁN EN VUELO. El drenador no consulta ningún
// interruptor: manda hasta agotar las veces. Sin cerrar las filas abiertas, apagar
// el recordatorio dejaba saliendo hasta cinco mensajes más — un interruptor que
// miente, y lo que sigue saliendo es lo que quema la línea del cliente.

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { INSISTIR_MAX_VECES, INSISTIR_MIN_MINUTOS, sanearInsistir, type Flujo, type Paso } from '@/lib/flujos-tipos';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

const input: CSSProperties = {
  padding: '6px 9px', borderRadius: 8, border: '1px solid var(--border-strong)',
  background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, fontFamily: SANS, outline: 'none',
};
const rotulo: CSSProperties = {
  fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase',
  color: 'var(--dim)', display: 'block', marginBottom: 8,
};

/** El paso `insistir` de un flujo, si lo tiene. */
function insistirDe(f: Flujo | null): Extract<Paso, { tipo: 'insistir' }> | null {
  const p = f?.pasos.find((x) => x.tipo === 'insistir');
  return p?.tipo === 'insistir' ? p : null;
}

export function Recordatorios({ plantillaId, endpoint, porWhatsApp }: {
  plantillaId: string;
  endpoint: string;
  /** ¿Este mensaje sale hoy por WhatsApp? Sin eso, el recordatorio no puede salir. */
  porWhatsApp: boolean;
}) {
  const [flujo, setFlujo] = useState<Flujo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const j = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'flujo-get', id: plantillaId }),
      }).then((r) => r.json());
      setFlujo(j?.ok ? (j.flujo as Flujo | null) : null);
    } catch { setFlujo(null); } finally { setCargando(false); }
  }, [endpoint, plantillaId]);

  useEffect(() => { void cargar(); }, [cargar]);

  async function guardar(f: Flujo | null) {
    setBusy(true); setFlash(null);
    try {
      const j = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'flujo-set', id: plantillaId, flujo: f }),
      }).then((r) => r.json());
      if (!j?.ok) { setFlash(j?.error || 'No se pudo guardar'); return; }
      setFlujo((j.flujo as Flujo | null) ?? null);
      setFlash('Guardado ✓');
      setTimeout(() => setFlash(null), 1800);
    } catch (e) {
      setFlash(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally { setBusy(false); }
  }

  const paso = insistirDe(flujo);

  /** Prender: un flujo mínimo cuyo único paso es el recordatorio. */
  function prender() {
    const nuevo = sanearInsistir({ texto: '', cadaMin: INSISTIR_MIN_MINUTOS, veces: 2 });
    const base: Flujo = flujo ?? { version: 1, activo: true, disparador: { tipo: 'manual' }, pasos: [] };
    void guardar({ ...base, activo: true, pasos: [...base.pasos.filter((p) => p.tipo !== 'insistir'), nuevo] });
  }

  /** Apagar: se saca el paso, y si el flujo queda vacío se va entero. */
  function apagar() {
    if (!flujo) return;
    const pasos = flujo.pasos.filter((p) => p.tipo !== 'insistir');
    void guardar(pasos.length ? { ...flujo, pasos } : null);
  }

  function cambiar(p: Extract<Paso, { tipo: 'insistir' }>) {
    if (!flujo) return;
    setFlujo({ ...flujo, pasos: flujo.pasos.map((x) => (x.tipo === 'insistir' ? p : x)) });
  }

  if (cargando) return <div style={{ fontSize: 12.5, color: 'var(--faint)', fontFamily: MONO }}>Cargando…</div>;

  return (
    <div>
      <span style={rotulo}>¿Y si no contestas?</span>

      <div style={{ display: 'flex', gap: 7, marginBottom: paso ? 10 : 0 }}>
        <Opcion activa={!paso} onClick={() => paso && apagar()} disabled={busy}>Se manda una vez</Opcion>
        <Opcion activa={!!paso} onClick={() => !paso && prender()} disabled={busy}>Te lo recuerdo</Opcion>
      </div>

      {paso && (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--ink)', flexWrap: 'wrap' }}>
            Cada
            <input
              type="number" min={INSISTIR_MIN_MINUTOS} step={15} value={paso.cadaMin} disabled={busy}
              onChange={(e) => cambiar(sanearInsistir({ ...paso, cadaMin: Number(e.target.value) }))}
              onBlur={() => void guardar(flujo)}
              style={{ ...input, width: 76 }}
            />
            minutos, hasta
            <input
              type="number" min={1} max={INSISTIR_MAX_VECES} value={paso.veces} disabled={busy}
              onChange={(e) => cambiar(sanearInsistir({ ...paso, veces: Number(e.target.value) }))}
              onBlur={() => void guardar(flujo)}
              style={{ ...input, width: 62 }}
            />
            veces
          </label>

          {/* El techo se DICE, no se ofrece como campo: es lo único que impide que
              esto se convierta en quemar la línea de WhatsApp del cliente, y
              `sanearInsistir` lo recorta arriba aunque por la API llegue otra cosa. */}
          <div style={{ fontSize: 11, color: 'var(--faint)', lineHeight: 1.45, marginTop: 7 }}>
            Se corta apenas alguien escribe «ok» en el grupo, y de noche espera a la mañana.
            El máximo son {INSISTIR_MAX_VECES} mensajes cada {INSISTIR_MIN_MINUTOS} minutos.
          </div>

          {!porWhatsApp && (
            <div style={{ fontSize: 11.5, color: 'var(--warn)', lineHeight: 1.45, marginTop: 6 }}>
              Los recordatorios salen por WhatsApp, y este mensaje lo tienes apagado ahí.
            </div>
          )}
        </>
      )}

      {flash && (
        <div style={{ marginTop: 7, fontSize: 12, fontWeight: 600, color: flash.includes('✓') ? 'var(--good)' : 'var(--bad)' }}>{flash}</div>
      )}
    </div>
  );
}

function Opcion({ activa, onClick, disabled, children }: {
  activa: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} aria-pressed={activa}
      style={{
        padding: '5px 12px', borderRadius: 999, cursor: disabled ? 'default' : 'pointer',
        fontSize: 12.5, fontWeight: 600, fontFamily: SANS,
        border: `1px solid ${activa ? 'var(--primary)' : 'var(--border-strong)'}`,
        background: activa ? 'var(--primary-bg)' : 'var(--surface)',
        color: activa ? 'var(--primary)' : 'var(--dim)', opacity: disabled ? 0.6 : 1,
      }}
    >
      {activa ? '✓ ' : ''}{children}
    </button>
  );
}
