'use client';

// =============================================================================
// AgendarR2 — la segunda reunión queda desde la ficha, sin salir de la llamada
// =============================================================================
// Vive dentro de ReunionesCard, debajo de los bloques de R1/R2, porque es ahí
// donde ya se está mirando la reunión. Y vive en UN lugar aunque se dibuje en
// dos: `ReunionesCard` lo monta el modal (app/crm/LeadSheet.tsx) y la ruta
// (app/crm/[id]/page.tsx), así que colgarlo de la card lo deja en los dos sin
// enhebrar un prop por dos árboles.
//
// ── EL CONTROL NO SE DIBUJA SI NO SE PUEDE USAR ──────────────────────────────
// Dos condiciones, y las dos apagan el botón ENTERO en vez de dejarlo contestar
// un error:
//   · el negocio tiene Calendly conectado Y cargado el event type de la R2
//     (`puedeAgendarR2Action`, que lo pregunta con `integracionConectada`);
//   · el lead tiene email, porque Calendly lo EXIGE para reservar
//     (lib/calendly-agenda.ts → `reservarReunion`).
// Un botón que contesta «falta configurar algo» se lee como que la app está rota.
//
// ── POR QUÉ SE REUSA SelectorHora ────────────────────────────────────────────
// Es el desplegable modelo Google Calendar que el dueño pidió de frente, después
// de rechazar la grilla de botones amontonados («no deberían ser todos botones
// amontonados… puedes replicar el modelo de Google Calendar, como un
// desplegable»). Dibujar acá otra lista de chips sería volver a lo rechazado.
//
// ⚠️ Y trae una trampa para este caso: su campo ACEPTA TEXTO LIBRE («6 y cuarto»).
// Para Google eso es legítimo; para Calendly no existe más horario que los que él
// devolvió. Así que lo elegido se resuelve siempre contra la lista (`startIsoDe`)
// y sin hueco exacto el botón de reservar queda apagado, con el motivo dicho.
// =============================================================================

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Button } from '@/app/_ui';
import { SelectorHora } from '../SelectorHora';
import { labelDeDia, slotsDelDia, startIsoDe, type DiaConHuecos } from '../agendar-r2';
import { huecosR2Action, puedeAgendarR2Action, reservarR2Action } from '../agendar-r2-actions';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

const bloque: CSSProperties = {
  background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 13, padding: '14px 18px', fontFamily: SANS,
};
const label: CSSProperties = {
  fontFamily: MONO, fontSize: 11, letterSpacing: '.1em',
  textTransform: 'uppercase', color: 'var(--dim)',
};
const linkStyle: CSSProperties = {
  fontSize: 13, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none',
};

type Hecho =
  | { modo: 'reserva'; cuando: string; joinUrl: string | null }
  | { modo: 'link'; url: string };

export function AgendarR2({ leadId, email }: { leadId: number; email: string | null }) {
  const router = useRouter();
  const tieneEmail = !!email?.trim();

  // null = todavía no se sabe. Mientras no se sepa no se dibuja nada: aparecer y
  // desaparecer es peor que tardar un instante en aparecer.
  const [puede, setPuede] = useState<boolean | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [dias, setDias] = useState<DiaConHuecos[] | null>(null);
  const [tz, setTz] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dia, setDia] = useState('');
  const [hora, setHora] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [hecho, setHecho] = useState<Hecho | null>(null);

  useEffect(() => {
    if (!tieneEmail) { setPuede(false); return; }
    let vivo = true;
    puedeAgendarR2Action()
      .then((r) => { if (vivo) setPuede(r); })
      .catch(() => { if (vivo) setPuede(false); });
    return () => { vivo = false; };
  }, [tieneEmail]);

  // Los horarios se piden al ABRIR, no al cargar la ficha: es un viaje a Calendly
  // y la mayoría de las fichas se abren para otra cosa.
  useEffect(() => {
    if (!abierto || dias) return;
    let vivo = true;
    setCargando(true);
    setError(null);
    huecosR2Action()
      .then((r) => {
        if (!vivo) return;
        if (!r.ok) { setError(r.error); return; }
        setDias(r.dias);
        setTz(r.tz);
        setDia(r.dias[0]?.dia ?? '');
      })
      .catch((e: unknown) => { if (vivo) setError(e instanceof Error ? e.message : 'No se pudieron leer los horarios.'); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [abierto, dias]);

  const slots = useMemo(() => (dias && dia ? slotsDelDia(dias, dia) : null), [dias, dia]);
  const startIso = dias && dia && hora ? startIsoDe(dias, dia, hora) : null;

  const reservar = () => {
    if (!startIso) return;
    setGuardando(true);
    setError(null);
    reservarR2Action(leadId, startIso)
      .then((r) => {
        if (!r.ok) { setError(r.error); return; }
        setHecho(r.modo === 'reserva' ? { modo: 'reserva', cuando: r.cuando, joinUrl: r.joinUrl } : { modo: 'link', url: r.url });
        setAbierto(false);
        // La vista de atrás se sincroniza sola (el rastro nuevo del historial, y
        // la fecha de la R2 cuando entre por el webhook de Calendly). No es un
        // reload: re-renderiza los server components y deja la ficha abierta.
        router.refresh();
      })
      .catch((e: unknown) => { setError(e instanceof Error ? e.message : 'No se pudo reservar.'); })
      .finally(() => { setGuardando(false); });
  };

  // ⚠️ DESPUÉS DE TODOS LOS HOOKS. Un hook detrás de un return temprano se llama
  // en unos renders y no en otros, y eso es la pantalla entera en blanco con un
  // «Minified React error #300» que no nombra ni el archivo (ver AGENTS.md).
  if (puede !== true) return null;

  if (hecho) {
    return hecho.modo === 'reserva' ? (
      <div style={{ ...bloque, borderColor: 'var(--good)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--good)' }}>R2 agendada · {hecho.cuando}</div>
        <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 4 }}>Calendly envió la invitación.</div>
        {hecho.joinUrl && (
          <a href={hecho.joinUrl} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, display: 'inline-block', marginTop: 8 }}>Abrir la reunión →</a>
        )}
      </div>
    ) : (
      <div style={{ ...bloque, borderColor: 'var(--warn)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Calendly no la reservó</div>
        <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 4 }}>El formulario ya tiene sus datos.</div>
        <a href={hecho.url} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, display: 'inline-block', marginTop: 8 }}>Abrir el formulario →</a>
      </div>
    );
  }

  if (!abierto) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <Button variant="secondary" size="sm" onClick={() => setAbierto(true)}>Agendar la R2</Button>
      </div>
    );
  }

  const sinHorarios = !!dias && dias.length === 0;

  return (
    <div style={bloque}>
      <div style={{ ...label, marginBottom: 10 }}>Agendar la R2</div>

      {cargando && <div style={{ fontSize: 13, color: 'var(--dim)' }}>Buscando horarios…</div>}

      {sinHorarios && <div style={{ fontSize: 13, color: 'var(--dim)' }}>Sin horarios libres en 31 días.</div>}

      {!!dias && dias.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Sólo los días que TIENEN horarios. Un calendario completo donde el
              80% de los días no se puede elegir es un calendario que hay que
              tantear; acá cada chip es un día agendable. */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {dias.map((d) => {
              const activo = d.dia === dia;
              return (
                <button
                  key={d.dia} type="button"
                  onClick={() => { setDia(d.dia); setHora(''); }}
                  style={{
                    padding: '7px 13px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                    fontFamily: SANS, cursor: 'pointer',
                    background: activo ? 'var(--ink)' : 'var(--surface)',
                    border: '1px solid ' + (activo ? 'var(--ink)' : 'var(--border-strong)'),
                    color: activo ? 'var(--on-ink)' : 'var(--ink)',
                  }}
                >{labelDeDia(d.dia)}</button>
              );
            })}
          </div>

          <SelectorHora
            value={hora}
            onChange={setHora}
            ariaLabel="Horario de la R2"
            slots={slots}
            ancla={slots?.[0]?.hora || undefined}
            nota={tz ? `Horarios en ${tz}.` : null}
          />

          {/* El campo del selector acepta texto libre, y Calendly no acepta más
              horario que los que devolvió: si lo tipeado no es uno de ellos se
              dice acá, en vez de dejar que la reserva vuelva con un 400. */}
          {hora && !startIso && (
            <div style={{ fontSize: 12.5, color: 'var(--bad)' }}>Elige un horario de la lista.</div>
          )}
        </div>
      )}

      {error && <div style={{ fontSize: 12.5, color: 'var(--bad)', marginTop: 10, lineHeight: 1.45 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <Button variant="primary" size="sm" disabled={!startIso} loading={guardando} onClick={reservar}>Reservar</Button>
        <Button variant="tertiary" size="sm" onClick={() => { setAbierto(false); setHora(''); setError(null); }}>Cancelar</Button>
      </div>
    </div>
  );
}
