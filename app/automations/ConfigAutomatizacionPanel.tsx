'use client';

// =============================================================================
// ConfigAutomatizacionPanel — el horario y las horas entre mensajes de UNA automatización (20/10/2026)
// =============================================================================
// Martín, 16/10/2026 (punto 5, texto entero en docs/relevo/chatbot.md): «"configuraciones" ya no viva para todo
// Automations, sino para cada chat en los 3 puntos... si estoy corriendo ads en Meta y llegan leads, ahí no hay riesgo,
// pero si tengo configurado eso y no salen mensajes si es un problema... como también el horario de oficina para cada
// automatización». Lo abren la tuerca del título (SecuenciaPerfil) y «Configuraciones» del «⋯» de la fila.
//
// Sin nada propio, cada parte dice «Como el negocio» con lo que vale: así arranca toda automatización que ya existía.
// Las reglas, en lib/config-automatizacion.ts.
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Spinner } from '@/app/_ui';
import { HorarioEnvioPanel, Interruptor, type FuenteHorario } from '@/app/configuraciones/HorarioEnvioPanel';
import { getConfigAutomatizacionAction, saveConfigAutomatizacionAction } from './config-automatizacion-actions';
import { Numero } from './LimitesEnvioPanel';
import { HORARIO_SUGERIDO } from '@/lib/horario-envio';
import { RANGOS_LIMITES } from '@/lib/limites-envio';
import { textoDeHorario, RANGOS_GOTEO, type ConfigAutomatizacion } from '@/lib/config-automatizacion';
import { textoDeGoteo } from '@/lib/goteo';

const SANS = "'Geist', sans-serif";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, fontFamily: SANS };

type Leido = Awaited<ReturnType<typeof getConfigAutomatizacionAction>>;

/** Lo leído, una vez, para las dos pestañas. */
function useConfig(secuenciaId: number) {
  const [d, setD] = useState<Leido | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let vivo = true;
    getConfigAutomatizacionAction(secuenciaId)
      .then((x) => { if (vivo) setD(x); })
      .catch(() => { if (vivo) setError('No pude leer la configuración.'); });
    return () => { vivo = false; };
  }, [secuenciaId]);
  return { d, error, poner: (config: ConfigAutomatizacion) => setD((x) => (x ? { ...x, config } : x)) };
}

/**
 * EL HORARIO DE ESTA AUTOMATIZACIÓN: «Propio» apagado = el del negocio (dicho con sus horas); prendido, el panel de
 * siempre (`HorarioEnvioPanel`) guardando en ESTA automatización, que arranca con lo del negocio.
 */
export function HorarioDeLaAutomatizacion({ secuenciaId, onSucio }: { secuenciaId: number; onSucio?: (s: boolean) => void }) {
  const { d, error, poner } = useConfig(secuenciaId);
  const [aviso, setAviso] = useState('');
  const [vuelta, setVuelta] = useState(0);
  if (!d) return error ? <p role="alert" style={{ fontSize: 13.5, color: 'var(--bad)', fontFamily: SANS }}>{error}</p> : <Spinner />;
  const propio = d.config.horario !== undefined;
  const off = !d.puedeEditar;
  const alternar = (v: boolean) => {
    setAviso('');
    const horario = v ? (d.horarioNegocio ?? { ...HORARIO_SUGERIDO, activo: false }) : null;
    void saveConfigAutomatizacionAction(secuenciaId, { horario })
      .then((r) => { if (!r.ok || !r.config) { setAviso(r.error || 'No se pudo guardar.'); return; } poner(r.config); setVuelta((n) => n + 1); })
      .catch(() => setAviso('No se pudo guardar.'));
  };
  const fuente: FuenteHorario = {
    titulo: 'Horario de esta automatización',
    // El huso es del NEGOCIO: acá se ve, no se cambia (revisión del 20/10/2026).
    zonaSoloLectura: true,
    leer: async () => ({ horario: d.config.horario ?? d.horarioNegocio ?? { ...HORARIO_SUGERIDO, activo: false }, zona: d.zona, puedeEditar: d.puedeEditar }),
    guardar: async (h) => {
      const r = await saveConfigAutomatizacionAction(secuenciaId, { horario: h });
      if (r.ok && r.config) poner(r.config);
      return { ok: r.ok, error: r.error, horario: r.config?.horario ?? undefined };
    },
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div data-horario-propio={propio ? 'si' : 'no'} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Horario propio</div>
          <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 2 }}>
            {/* Propio y APAGADO es «manda a cualquier hora» (revisión del 20/10/2026): la tarjeta lo dice con todas las letras. */}
            {propio && !d.config.horario?.activo
              ? <span data-sin-horario="" style={{ color: 'var(--warn)' }}>Sólo para esta automatización: {textoDeHorario(null)}.</span>
              : propio ? 'Sólo para esta automatización.' : `Como el negocio: ${textoDeHorario(d.horarioNegocio)}.`}
          </div>
        </div>
        <Interruptor on={propio} disabled={off} etiqueta={propio ? 'Volver al horario del negocio' : 'Ponerle un horario propio'} onCambio={alternar} />
      </div>
      {aviso && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--bad)', fontFamily: SANS }}>{aviso}</p>}
      {propio && <HorarioEnvioPanel key={vuelta} fuente={fuente} onSucio={onSucio} />}
    </div>
  );
}

/** LAS HORAS ENTRE DOS MENSAJES A LA MISMA PERSONA de esta automatización, por canal (sin propio: las del negocio). */
export function PersonaDeLaAutomatizacion({ secuenciaId, onSucio }: { secuenciaId: number; onSucio?: (s: boolean) => void }) {
  const { d, error, poner } = useConfig(secuenciaId);
  const [aviso, setAviso] = useState('');
  const [invalido, setInvalido] = useState<Record<string, string>>({});
  const [enVuelo, setEnVuelo] = useState(false);
  const respiro = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * ⚠️ LO TOCADO SE VE YA Y SE JUNTA (revisión del 20/10/2026). Sin esto, tres ▲ rápidos sobre 20 calculaban 21 los tres
   * (el valor no cambiaba hasta que volvía el server) y un ▲ en Email dentro del respiro tiraba el de WhatsApp. `local`
   * es lo que se ve hasta que el server contesta (null = «como el negocio»); `pendiente`, lo que sale al vencer el respiro.
   */
  const [local, setLocal] = useState<Record<string, number | null>>({});
  const pendiente = useRef<Record<string, number | null>>({});
  useEffect(() => () => { if (respiro.current) clearTimeout(respiro.current); }, []);
  useEffect(() => { onSucio?.(enVuelo); }, [enVuelo, onSucio]);
  if (!d) return error ? <p role="alert" style={{ fontSize: 13.5, color: 'var(--bad)', fontFamily: SANS }}>{error}</p> : <Spinner />;
  const off = !d.puedeEditar;
  const guardar = (cambio: Record<string, number | null>) => {
    setAviso('');
    pendiente.current = { ...pendiente.current, ...cambio };
    setLocal((p) => ({ ...p, ...cambio }));
    if (respiro.current) clearTimeout(respiro.current);
    setEnVuelo(true);
    respiro.current = setTimeout(() => {
      const personaHoras = pendiente.current;
      pendiente.current = {};
      // Lo que se mandó deja de ser «local» (si no se tocó otra vez mientras tanto): manda lo que contestó el server.
      const soltar = () => setLocal((p) => {
        const q = { ...p };
        for (const [k, v] of Object.entries(personaHoras)) if (q[k] === v) delete q[k];
        return q;
      });
      void saveConfigAutomatizacionAction(secuenciaId, { personaHoras })
        .then((r) => { setEnVuelo(false); soltar(); if (!r.ok || !r.config) { setAviso(r.error || 'No se pudo guardar.'); return; } poner(r.config); })
        .catch(() => { setEnVuelo(false); soltar(); setAviso('No se pudo guardar.'); });
    }, 350);
  };
  const filas = [
    { canal: 'whatsapp' as const, rotulo: 'WhatsApp', rango: RANGOS_LIMITES.wa.personaHoras },
    { canal: 'email' as const, rotulo: 'Email', rango: RANGOS_LIMITES.email.personaHoras },
  ];
  return (
    <section aria-label="A la misma persona" style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>A la misma persona, en esta automatización</div>
      <div style={{ fontSize: 13, color: 'var(--dim)' }}>Las horas que espera entre dos mensajes a alguien. Con leads de un anuncio, pocas; prospectando en frío, más.</div>
      {filas.map((f) => {
        const propio = f.canal in local ? (local[f.canal] ?? undefined) : d.config.personaHoras?.[f.canal];
        const valor = propio ?? d.personaNegocio[f.canal];
        return (
          <div key={f.canal} data-persona={f.canal} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ flex: '1 1 120px', minWidth: 0, fontSize: 14, color: 'var(--ink)' }}>{f.rotulo}</span>
            <Numero valor={valor} min={f.rango[0]} max={f.rango[1]} disabled={off} etiqueta={`${f.rotulo} · horas entre dos mensajes`}
              onCambio={(n) => guardar({ [f.canal]: n })} onInvalido={(e) => setInvalido((p) => ({ ...p, [f.canal]: e ?? '' }))} />
            <span style={{ flex: '0 0 auto', fontSize: 13, color: 'var(--dim)' }}>horas</span>
            {propio === undefined
              ? <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>Como el negocio</span>
              : !off && (
                <button type="button" onClick={() => guardar({ [f.canal]: null })}
                  style={{ border: 'none', background: 'transparent', padding: 0, fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}>
                  Como el negocio ({d.personaNegocio[f.canal]} h)
                </button>
              )}
            {invalido[f.canal] && <span role="alert" style={{ flexBasis: '100%', fontSize: 12.5, color: 'var(--bad)' }}>{invalido[f.canal]}</span>}
          </div>
        );
      })}
      {aviso && <span role="alert" style={{ fontSize: 13, color: 'var(--bad)' }}>{aviso}</span>}
    </section>
  );
}

/**
 * EL GOTEO DE ESTA AUTOMATIZACIÓN (22/10/2026, la llamada con Mauricio: «envía uno, tal vez espera 4 minutos o 5, envía el
 * otro»): los minutos entre dos WhatsApp suyos y su tope por día. Es un SUB-tope adentro del de la línea, que va dicho al
 * lado (lib/goteo.ts). Vacío = sin goteo. Los días de la semana son los de su horario (la otra pestaña).
 */
export function GoteoDeLaAutomatizacion({ secuenciaId, onSucio }: { secuenciaId: number; onSucio?: (s: boolean) => void }) {
  const { d, error, poner } = useConfig(secuenciaId);
  const [aviso, setAviso] = useState('');
  const [enVuelo, setEnVuelo] = useState(false);
  const [local, setLocal] = useState<Record<string, number | null>>({});
  const pendiente = useRef<Record<string, number | null>>({});
  const respiro = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (respiro.current) clearTimeout(respiro.current); }, []);
  useEffect(() => { onSucio?.(enVuelo); }, [enVuelo, onSucio]);
  if (!d) return error ? <p role="alert" style={{ fontSize: 13.5, color: 'var(--bad)', fontFamily: SANS }}>{error}</p> : <Spinner />;
  const off = !d.puedeEditar;
  // Lo tocado se ve ya y se junta en UN guardado (el mismo molde que «A la misma persona», arriba).
  const guardar = (cambio: Record<string, number | null>) => {
    setAviso('');
    pendiente.current = { ...pendiente.current, ...cambio };
    setLocal((p) => ({ ...p, ...cambio }));
    if (respiro.current) clearTimeout(respiro.current);
    setEnVuelo(true);
    respiro.current = setTimeout(() => {
      const goteo = pendiente.current;
      pendiente.current = {};
      const soltar = () => setLocal((p) => { const q = { ...p }; for (const [k, v] of Object.entries(goteo)) if (q[k] === v) delete q[k]; return q; });
      void saveConfigAutomatizacionAction(secuenciaId, { goteo })
        .then((r) => { setEnVuelo(false); soltar(); if (!r.ok || !r.config) { setAviso(r.error || 'No se pudo guardar.'); return; } poner(r.config); })
        .catch(() => { setEnVuelo(false); soltar(); setAviso('No se pudo guardar.'); });
    }, 350);
  };
  const valorDe = (campo: 'minutos' | 'dia'): number | undefined => (campo in local ? (local[campo] ?? undefined) : d.config.goteo?.[campo]);
  const filas = [
    { campo: 'minutos' as const, rotulo: 'Uno cada', unidad: 'minutos', rango: RANGOS_GOTEO.minutos, sugerido: 5 },
    { campo: 'dia' as const, rotulo: 'Hasta', unidad: 'por día', rango: RANGOS_GOTEO.dia, sugerido: Math.min(50, d.lineaWa.dia) },
  ];
  const actual = { minutos: valorDe('minutos'), dia: valorDe('dia') };
  return (
    <section aria-label="Goteo" data-goteo={secuenciaId} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Goteo de sus WhatsApp</div>
      <div style={{ fontSize: 13, color: 'var(--dim)' }}>
        {textoDeGoteo(actual)}: {d.lineaWa.dia} por día y {d.lineaWa.hora} por hora para todas.
      </div>
      {filas.map((f) => {
        const v = valorDe(f.campo);
        return (
          <div key={f.campo} data-goteo-campo={f.campo} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ flex: '1 1 120px', minWidth: 0, fontSize: 14, color: 'var(--ink)' }}>{f.rotulo}</span>
            {v === undefined
              ? !off && (
                <button type="button" onClick={() => guardar({ [f.campo]: f.sugerido })}
                  style={{ border: 'none', background: 'transparent', padding: 0, fontFamily: SANS, fontSize: 13, fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}>
                  Poner {f.sugerido} {f.unidad}
                </button>
              )
              : (
                <>
                  <Numero valor={v} min={f.rango[0]} max={f.rango[1]} disabled={off} etiqueta={`Goteo · ${f.rotulo} ${f.unidad}`}
                    onCambio={(n) => guardar({ [f.campo]: n })} onInvalido={(e) => setAviso(e ?? '')} />
                  <span style={{ flex: '0 0 auto', fontSize: 13, color: 'var(--dim)' }}>{f.unidad}</span>
                  {!off && (
                    <button type="button" onClick={() => guardar({ [f.campo]: null })}
                      style={{ border: 'none', background: 'transparent', padding: 0, fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}>
                      Quitar
                    </button>
                  )}
                </>
              )}
          </div>
        );
      })}
      {aviso && <span role="alert" style={{ fontSize: 13, color: 'var(--bad)' }}>{aviso}</span>}
    </section>
  );
}
