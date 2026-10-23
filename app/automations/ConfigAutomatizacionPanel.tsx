'use client';

// =============================================================================
// ConfigAutomatizacionPanel — el horario y el anti-ban de UNA automatización (20/10/2026)
// =============================================================================
// Martín, 16/10/2026 (punto 5, texto entero en docs/relevo/chatbot.md): «"configuraciones" ya no viva para todo
// Automations, sino para cada chat en los 3 puntos... si estoy corriendo ads en Meta y llegan leads, ahí no hay riesgo,
// pero si tengo configurado eso y no salen mensajes si es un problema... como también el horario de oficina para cada
// automatización». Lo abren la tuerca del título (SecuenciaPerfil) y «Configuraciones» del «⋯» de la fila.
//
// 22/10/2026 (Martín, por el Cerebro, con captura de #289): «Cada opción se prende y se apaga con un interruptor on/off,
// igual que «Horario de oficina»... Apagada, no aplica, y el número se ve gris. Chau los «Quitar»» y «Elimina todo el
// texto innecesario». Desde ese día: filas de FilasOpciones.tsx (nombre, número, unidad, interruptor), sin «Como el
// negocio» ni descripciones; lo que hace falta explicar va en su ⓘ. Las reglas, en lib/config-automatizacion.ts.
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { Spinner } from '@/app/_ui';
import { HorarioEnvioPanel, Interruptor, type FuenteHorario } from '@/app/configuraciones/HorarioEnvioPanel';
import { getConfigAutomatizacionAction, saveConfigAutomatizacionAction } from './config-automatizacion-actions';
import { Numero } from './LimitesEnvioPanel';
import { FilaOpcion, GrupoOpciones, Unidad, TarjetaOpciones } from './FilasOpciones';
import { HORARIO_SUGERIDO } from '@/lib/horario-envio';
import { RANGOS_LIMITES } from '@/lib/limites-envio';
import { textoDeHorario, RANGOS_GOTEO, PERSONA_SIN_ESPERA, type ConfigAutomatizacion } from '@/lib/config-automatizacion';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

const SANS = "'Geist', sans-serif";

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
 * EL HORARIO DE ESTA AUTOMATIZACIÓN: «Horario propio» apagado = el del negocio (dicho en su ⓘ); prendido, el panel de
 * siempre (`HorarioEnvioPanel`, «Horario de oficina») guardando en ESTA automatización, que arranca con lo del negocio.
 * Propio con «Horario de oficina» apagado = manda a cualquier hora (lo dice ese interruptor).
 */
export function HorarioDeLaAutomatizacion({ secuenciaId, onSucio }: { secuenciaId: number; onSucio?: (s: boolean) => void }) {
  const { d, error, poner } = useConfig(secuenciaId);
  const [aviso, setAviso] = useState('');
  const [vuelta, setVuelta] = useState(0);
  if (!d) return error ? <p role="alert" style={{ fontSize: 13.5, color: 'var(--bad)', fontFamily: SANS }}>{error}<ReportarASoporte /></p> : <Spinner />;
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
    // El huso es del NEGOCIO: acá se ve (en el ⓘ), no se cambia (revisión del 20/10/2026).
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
      <TarjetaOpciones>
        <FilaOpcion primera nombre="Horario propio" info={`Apagado, usa el del negocio: ${textoDeHorario(d.horarioNegocio)}.`} datos={{ 'data-horario-propio': propio ? 'si' : 'no' }}
          interruptor={<Interruptor on={propio} disabled={off} etiqueta={propio ? 'Volver al horario del negocio' : 'Ponerle un horario propio'} onCambio={alternar} />} />
      </TarjetaOpciones>
      {aviso && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--bad)', fontFamily: SANS }}>{aviso}<ReportarASoporte /></p>}
      {propio && <HorarioEnvioPanel key={vuelta} fuente={fuente} onSucio={onSucio} />}
    </div>
  );
}

/** Un cambio del anti-ban de esta automatización: por parte, los campos que cambian (`null` = se saca). */
type CambioAntiban = { goteo?: Record<string, number | null>; personaHoras?: Record<string, number | null> };

/**
 * EL ANTI-BAN DE ESTA AUTOMATIZACIÓN (22/10/2026): el goteo de sus WhatsApp (lib/goteo.ts, la llamada con Mauricio: «envía
 * uno, tal vez espera 4 minutos o 5, envía el otro»), su tope por día (un SUB-tope adentro del de la línea) y las horas
 * entre dos mensajes a la misma persona por canal. Cada fila con su interruptor:
 *   · goteo y tope: apagado = el campo AUSENTE (sin goteo / sin tope propio). Al prenderlo arranca con el número gris.
 *   · misma persona: prendido = el propio, o el del negocio si no tiene (ausente); apagado = `PERSONA_SIN_ESPERA` (0 h).
 *     Prenderlo de nuevo lo vuelve al del negocio (`null`).
 * Era «Goteo de sus WhatsApp» y «A la misma persona, en esta automatización»: dos tarjetas con su párrafo, «Poner N»,
 * «Quitar» y «Como el negocio». Ahora UN guardado para las dos partes (`pendiente` las junta en el respiro).
 */
export function AntibanDeLaAutomatizacion({ secuenciaId, onSucio }: { secuenciaId: number; onSucio?: (s: boolean) => void }) {
  const { d, error, poner } = useConfig(secuenciaId);
  const [aviso, setAviso] = useState('');
  const [invalido, setInvalido] = useState<Record<string, string>>({});
  const [enVuelo, setEnVuelo] = useState(false);
  const respiro = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * ⚠️ LO TOCADO SE VE YA Y SE JUNTA (revisión del 20/10/2026). Sin esto, tres ▲ rápidos sobre 20 calculaban 21 los tres
   * (el valor no cambiaba hasta que volvía el server) y un ▲ en Email dentro del respiro tiraba el de WhatsApp. `local`
   * es lo que se ve hasta que el server contesta (null = sacado); `pendiente`, lo que sale al vencer el respiro.
   */
  const [local, setLocal] = useState<Record<string, number | null>>({});
  const pendiente = useRef<CambioAntiban>({});
  useEffect(() => () => { if (respiro.current) clearTimeout(respiro.current); }, []);
  useEffect(() => { onSucio?.(enVuelo); }, [enVuelo, onSucio]);
  if (!d) return error ? <p role="alert" style={{ fontSize: 13.5, color: 'var(--bad)', fontFamily: SANS }}>{error}<ReportarASoporte /></p> : <Spinner />;
  const off = !d.puedeEditar;
  const guardar = (parte: 'goteo' | 'personaHoras', cambio: Record<string, number | null>) => {
    setAviso('');
    pendiente.current = { ...pendiente.current, [parte]: { ...(pendiente.current[parte] ?? {}), ...cambio } };
    setLocal((p) => ({ ...p, ...Object.fromEntries(Object.entries(cambio).map(([k, v]) => [`${parte}.${k}`, v])) }));
    if (respiro.current) clearTimeout(respiro.current);
    setEnVuelo(true);
    respiro.current = setTimeout(() => {
      const envio = pendiente.current;
      pendiente.current = {};
      // Lo que se mandó deja de ser «local» (si no se tocó otra vez mientras tanto): manda lo que contestó el server.
      const soltar = () => setLocal((p) => {
        const q = { ...p };
        for (const [parteEnviada, campos] of Object.entries(envio)) for (const [k, v] of Object.entries(campos ?? {})) if (q[`${parteEnviada}.${k}`] === v) delete q[`${parteEnviada}.${k}`];
        return q;
      });
      void saveConfigAutomatizacionAction(secuenciaId, envio)
        .then((r) => { setEnVuelo(false); soltar(); if (!r.ok || !r.config) { setAviso(r.error || 'No se pudo guardar.'); return; } poner(r.config); })
        .catch(() => { setEnVuelo(false); soltar(); setAviso('No se pudo guardar.'); });
    }, 350);
  };
  /** Lo guardado de un campo, con lo tocado encima (undefined = ausente). */
  const leido = (parte: 'goteo' | 'personaHoras', campo: string): number | undefined => {
    const k = `${parte}.${campo}`;
    if (k in local) return local[k] ?? undefined;
    return (d.config[parte] as Record<string, number> | undefined)?.[campo];
  };
  const filaGoteo = (campo: 'minutos' | 'dia', nombre: string, objeto: string, unidad: string, info: string, sugerido: number) => {
    const v = leido('goteo', campo);
    const on = v !== undefined;
    const clave = `goteo.${campo}`;
    return (
      <FilaOpcion key={clave} nombre={nombre} info={info} error={invalido[clave]} datos={{ 'data-goteo-campo': campo }}
        interruptor={<Interruptor on={on} disabled={off} etiqueta={on ? `Apagar ${objeto}` : `Prender ${objeto}`} onCambio={(x) => guardar('goteo', { [campo]: x ? sugerido : null })} />}>
        <Numero valor={v ?? sugerido} min={RANGOS_GOTEO[campo][0]} max={RANGOS_GOTEO[campo][1]} disabled={off} apagado={!on} etiqueta={`${nombre} · ${unidad}`}
          onCambio={(n) => guardar('goteo', { [campo]: n })} onInvalido={(e) => setInvalido((p) => ({ ...p, [clave]: e ?? '' }))} />
        <Unidad apagada={!on}>{unidad}</Unidad>
      </FilaOpcion>
    );
  };
  const filaPersona = (canal: 'whatsapp' | 'email', rango: readonly [number, number]) => {
    const propio = leido('personaHoras', canal);
    const on = propio !== PERSONA_SIN_ESPERA;
    const valor = propio !== undefined && propio !== PERSONA_SIN_ESPERA ? propio : d.personaNegocio[canal];
    const clave = `personaHoras.${canal}`;
    const deQue = canal === 'whatsapp' ? 'mensajes' : 'emails';
    return (
      <FilaOpcion key={clave} nombre="Misma persona" info={`Horas entre dos ${deQue} a la misma persona. Apagado, no espera.`} error={invalido[clave]} datos={{ 'data-persona': canal }}
        interruptor={<Interruptor on={on} disabled={off} etiqueta={on ? `Apagar la espera entre dos ${deQue}` : `Prender la espera entre dos ${deQue}`} onCambio={(x) => guardar('personaHoras', { [canal]: x ? null : PERSONA_SIN_ESPERA })} />}>
        <Numero valor={valor} min={rango[0]} max={rango[1]} disabled={off} apagado={!on} etiqueta={`${canal === 'whatsapp' ? 'WhatsApp' : 'Email'} · horas entre dos mensajes`}
          onCambio={(n) => guardar('personaHoras', { [canal]: n })} onInvalido={(e) => setInvalido((p) => ({ ...p, [clave]: e ?? '' }))} />
        <Unidad apagada={!on}>h</Unidad>
      </FilaOpcion>
    );
  };
  return (
    <TarjetaOpciones etiqueta="Esta automatización" datos={{ 'data-goteo': secuenciaId }}>
      <GrupoOpciones titulo="WhatsApp" primero />
      {filaGoteo('minutos', 'Goteo', 'el goteo', 'min', 'Sus WhatsApp salen de a uno, con esta espera entre dos.', 5)}
      {filaGoteo('dia', 'Por día', 'el tope por día', 'mensajes', `El tope de esta automatización, adentro del de la línea (${d.lineaWa.dia} por día y ${d.lineaWa.hora} por hora).`, Math.min(50, d.lineaWa.dia))}
      {filaPersona('whatsapp', RANGOS_LIMITES.wa.personaHoras)}
      <GrupoOpciones titulo="Email" />
      {filaPersona('email', RANGOS_LIMITES.email.personaHoras)}
      {aviso && <p role="alert" style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--bad)' }}>{aviso}<ReportarASoporte /></p>}
    </TarjetaOpciones>
  );
}
