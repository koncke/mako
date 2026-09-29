'use client';

// =============================================================================
// Disparador — el primer paso del mensaje: qué lo hace salir, y cada cuánto
// =============================================================================
// El pedido llegó dos veces. Primero: «el primer paso debería ser el disparador y
// eso se DEBE poder configurar… ¿qué lo dispara? un evento o está configurado por
// tiempo cada X tiempo por ejemplo», y «falta poder editar la frecuencia». Después,
// sobre la versión que quedó en prosa: «el "Qué lo dispara" NO es editable».
//
// ── LAS DOS MITADES, Y CUÁL DE LAS DOS ES UNA DECISIÓN ──────────────────────
// QUÉ lo dispara no es una opción, y medirlo es lo que lo demuestra: de los 65
// mensajes del catálogo, 19 tienen un call site que los emite. Lo que hace salir a
// cada uno es ese call site —un webhook de Calendly, un cron que vigila un umbral,
// un cambio de estado— o sea que el disparador es lo que el mensaje ES. Un
// desplegable para convertir «un lead canceló la reunión» en «cada 3 días» sería el
// control que se dibuja y no cambia nada, y encima en el primer renglón de la
// pantalla, que es donde más se cree lo que dice.
//
// CADA CUÁNTO sí es una decisión del negocio, y es la que faltaba. Se guarda por
// mensaje y la aplica el choke point (`lib/avisos.ts` para los avisos,
// `despacharReporte` para los tres reportes) con el mismo reclamo atómico que ya
// cortaba los duplicados.
//
// ⚠️ Y SÓLO ESPACIA, NUNCA APRIETA. Lo que pide quien emite es el techo de
// frecuencia; acá se elige cualquier cosa por debajo, y el choke point toma el MAYOR
// de los dos. Por eso esta pantalla no puede producir un mensaje de más: en el peor
// caso produce uno de menos, que es exactamente lo que se eligió.
//
// ⚠️ NO HAY BOTÓN DE GUARDAR: se guarda al elegir, con el valor viejo de vuelta si
// falla. Es la regla que ya rige el resto de esta tab («que el botón de "Guardar" no
// exista»), y un desplegable que queda distinto de lo que está guardado es peor que
// uno lento.

import { useState, type CSSProperties } from 'react';
import { Dropdown } from '../components/Dropdown';
import { FRECUENCIAS, SIN_LIMITE, sanearFrecuencia } from '@/lib/disparador-mensaje';

const MONO = "'Geist Mono', monospace";
const rotulo: CSSProperties = {
  fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase',
  color: 'var(--dim)', display: 'block', marginBottom: 8,
};

export function Disparador({ id, disparador, frecuenciaMin, endpoint, onCambio }: {
  id: string;
  /** Qué lo hace salir, en palabras. Sale del catálogo: es un hecho, no una opción. */
  disparador: string;
  /** Lo guardado hoy, en minutos. 0 = sin límite propio. */
  frecuenciaMin: number;
  endpoint: string;
  /** Para que la lista de al lado refresque su copia de la plantilla. */
  onCambio?: () => void;
}) {
  const [min, setMin] = useState<number>(sanearFrecuencia(frecuenciaMin));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function elegir(v: string) {
    const nuevo = sanearFrecuencia(Number(v));
    if (nuevo === min) return;
    const previo = min;
    setMin(nuevo); setBusy(true); setError(null);
    try {
      const j = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'frecuencia', id, frecuenciaMin: nuevo }),
      }).then((r) => r.json());
      if (!j?.ok) { setMin(previo); setError(j?.error || 'No se pudo guardar'); return; }
      onCambio?.();
    } catch (e) {
      setMin(previo);
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally { setBusy(false); }
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <span style={rotulo}>Qué lo dispara</span>

      {/* El HECHO. Va arriba y sin control al lado a propósito: lo que sigue configura
          cada cuánto te llega, no qué lo produce. */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '11px 13px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <span style={{ fontSize: 16, flex: 'none', lineHeight: 1.3 }}>⚡</span>
        <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5 }}>{disparador}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 11 }}>
        <span style={{ fontSize: 12.5, color: 'var(--ink)' }}>Cada cuánto, como máximo</span>
        <Dropdown
          value={String(min)}
          options={FRECUENCIAS.map((f) => ({ value: String(f.min), label: f.label }))}
          onChange={(v) => void elegir(v)}
          width={216}
          disabled={busy}
          ariaLabel={`Cada cuánto llega «${disparador.slice(0, 40)}»`}
        />
      </div>

      {/* La dirección se DICE, porque es lo que hace que el control no dé miedo: no hay
          forma de pedir más mensajes de los que hay. */}
      <div style={{ fontSize: 11, color: 'var(--faint)', lineHeight: 1.45, marginTop: 7 }}>
        {min === SIN_LIMITE
          ? 'Llega cada vez que pasa.'
          : 'Si vuelve a pasar antes, queda en el historial y no te escribe.'}
      </div>

      {error && (
        <div style={{ marginTop: 7, fontSize: 12, fontWeight: 600, color: 'var(--bad)' }}>{error}</div>
      )}
    </div>
  );
}
