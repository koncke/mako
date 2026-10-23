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
//
// 23/10/2026 (Martín, por el Cerebro): «Hay DOS "Misma persona": queda UNA. Ordená los ajustes en bloques por canal
// (WhatsApp, Email…)», «"propio" se dice "Horario de oficina"» y «Todo vive en UNA sola pantalla, sin pestañas ni nombre de
// pestaña: sólo el título "Configuraciones"». Desde ese día: `AjustesDeLaAutomatizacion`, una pantalla: «Horario de
// oficina» y un bloque por canal.
//
// 23/10/2026 (Martín, por el Cerebro): «justamente pusimos las configuraciones personalizadas para cada automatización... No
// quiero nada para todas las automatizaciones». Se fue lo «De la línea, para todas» (por día, por hora, «misma persona por
// defecto» y el bloque «MaKo contesta sola», que sólo tenía eso): los topes duros de la línea siguen cuidando al número por
// dentro (lib/limites-envio.ts), sin mostrarse ni editarse.
//
// 23/10/2026, más tarde (Martín): «Elimina "Vista previa del link"... Y elimina "Misma persona"... Y en Email también pon
// goteo y tope por día... que el botón de "on-off" esté al lado de donde se configuran el resto de cosas no es muy
// intuitivo». Quedan Goteo y Tope por día en cada canal, cada fila como en Ajustes de iOS (el interruptor en la fila del
// nombre y el número debajo, sólo prendida: `FilaOpcion` con `debajo`).
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { Spinner } from '@/app/_ui';
import { HorarioEnvioPanel, Interruptor, type FuenteHorario } from '@/app/configuraciones/HorarioEnvioPanel';
import { getConfigAutomatizacionAction, saveConfigAutomatizacionAction } from './config-automatizacion-actions';
import { Numero } from './LimitesEnvioPanel';
import { FilaOpcion, GrupoOpciones, Unidad, TarjetaOpciones } from './FilasOpciones';
import { HORARIO_SUGERIDO } from '@/lib/horario-envio';
import { textoPrioridad } from '@/lib/nutricion-prioridad';
import { RANGOS_GOTEO, RANGOS_GOTEO_EMAIL, type ConfigAutomatizacion } from '@/lib/config-automatizacion';
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
 * EL HORARIO DE OFICINA DE ESTA AUTOMATIZACIÓN (23/10/2026: «"propio" se dice "Horario de oficina"»): el panel de siempre
 * (`HorarioEnvioPanel`) con el horario que VALE para ella —el suyo, o el del negocio si no tiene— y guardando en ella. Era
 * «Horario propio» (encender = copiar el del negocio) y abajo otro «Horario de oficina»: dos interruptores para una cosa.
 * Apagado = manda a cualquier hora. Lo que se toca pasa a ser suyo.
 */
export function HorarioDeLaAutomatizacion({ secuenciaId, onSucio }: { secuenciaId: number; onSucio?: (s: boolean) => void }) {
  const { d, error, poner } = useConfig(secuenciaId);
  if (!d) return error ? <p role="alert" style={{ fontSize: 13.5, color: 'var(--bad)', fontFamily: SANS }}>{error}<ReportarASoporte /></p> : <Spinner />;
  const fuente: FuenteHorario = {
    zonaSoloLectura: true,
    leer: async () => ({ horario: d.config.horario ?? d.horarioNegocio ?? { ...HORARIO_SUGERIDO, activo: false }, zona: d.zona, puedeEditar: d.puedeEditar }),
    guardar: async (h) => {
      const r = await saveConfigAutomatizacionAction(secuenciaId, { horario: h });
      if (r.ok && r.config) poner(r.config);
      return { ok: r.ok, error: r.error, horario: r.config?.horario ?? undefined };
    },
  };
  return <HorarioEnvioPanel fuente={fuente} onSucio={onSucio} />;
}

/** Las partes del goteo, una por canal (lib/config-automatizacion.ts). */
type ParteGoteo = 'goteo' | 'goteoEmail';
/** Un cambio de esta automatización: por parte, los campos que cambian (`null` = se saca). */
type CambioAntiban = Partial<Record<ParteGoteo, Record<string, number | null>>>;

/**
 * LO DE ESTA AUTOMATIZACIÓN EN CADA CANAL (22/10/2026), como estado de la pantalla: el goteo de sus mensajes (lib/goteo.ts,
 * la llamada con Mauricio: «envía uno, tal vez espera 4 minutos o 5, envía el otro») y su tope por día (un SUB-tope adentro
 * del de la línea), en WhatsApp y —desde el 23/10/2026, Martín: «en Email también pon goteo y tope por día»— en Email.
 * Apagado = el campo AUSENTE (sin goteo / sin tope propio). Al prenderlo arranca con el número sugerido.
 * (Hasta el 23/10/2026 también estaban «Misma persona» y «Vista previa del link»: Martín, «elimina "Vista previa del link",
 * eso no se debe configurar en Configuraciones... Y elimina "Misma persona"». La vista previa se saca en el mensaje, con la X
 * de la tarjeta del link; «Misma persona» se fue también del motor.)
 * UN guardado para todo (`pendiente` lo junta en el respiro). Devuelve las filas, que la pantalla reparte por canal.
 */
export function useAntibanDeLaAutomatizacion(secuenciaId: number, onSucio?: (s: boolean) => void) {
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
  const off = !d?.puedeEditar;
  const guardar = (parte: ParteGoteo, cambio: Record<string, number | null>) => {
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
  const leido = (parte: ParteGoteo, campo: string): number | undefined => {
    const k = `${parte}.${campo}`;
    if (k in local) return local[k] ?? undefined;
    return (d?.config[parte] as Record<string, number> | undefined)?.[campo];
  };
  /**
   * UNA FILA COMO EN AJUSTES DE iOS (23/10/2026, Martín: «que el botón de "on-off" esté al lado de donde se configuran el
   * resto de cosas no es muy intuitivo»): el nombre con su interruptor en la fila, y el número en un renglón de abajo SÓLO
   * con la opción prendida («Uno cada [5] min»). Apagada no hay número que mirar.
   */
  const filaGoteo = (parte: ParteGoteo, campo: 'minutos' | 'dia', nombre: string, objeto: string, antes: string, unidad: string, info: string, sugerido: number) => {
    const rangos = parte === 'goteo' ? RANGOS_GOTEO : RANGOS_GOTEO_EMAIL;
    const v = leido(parte, campo);
    const on = v !== undefined;
    const clave = `${parte}.${campo}`;
    return (
      <FilaOpcion key={clave} nombre={nombre} info={info} error={invalido[clave]} datos={{ 'data-goteo-campo': campo, 'data-goteo-canal': parte === 'goteo' ? 'whatsapp' : 'email' }}
        interruptor={<Interruptor on={on} disabled={off} etiqueta={on ? `Apagar ${objeto}` : `Prender ${objeto}`} onCambio={(x) => guardar(parte, { [campo]: x ? sugerido : null })} />}
        debajo={on ? (
          <>
            <Unidad>{antes}</Unidad>
            <Numero valor={v} min={rangos[campo][0]} max={rangos[campo][1]} disabled={off} etiqueta={`${nombre} · ${unidad}`}
              onCambio={(n) => guardar(parte, { [campo]: n })} onInvalido={(e) => setInvalido((p) => ({ ...p, [clave]: e ?? '' }))} />
            <Unidad>{unidad}</Unidad>
          </>
        ) : undefined} />
    );
  };
  return {
    listo: !!d, error, aviso,
    /** El ⓘ del bloque WhatsApp: la regla que sigue frenando por dentro aunque la línea ya no se edite acá (nada se decide
     *  por detrás: «Primero lo que entra» y lo que la campaña le deja, con los números del negocio). */
    infoWhatsapp: d ? textoPrioridad(d.lineaWa) : undefined,
    /** Las de WhatsApp: el goteo y el tope por día. */
    whatsapp: d ? [
      filaGoteo('goteo', 'minutos', 'Goteo', 'el goteo de los WhatsApp', 'Uno cada', 'min', 'Sus WhatsApp salen de a uno, con esta espera entre dos.', 5),
      filaGoteo('goteo', 'dia', 'Tope por día', 'el tope por día de los WhatsApp', 'Hasta', 'por día', 'Cuántos WhatsApp de esta automatización salen como mucho por día.', Math.min(50, d.lineaWa.dia)),
    ] : [],
    /** Las de Email: lo mismo, con sus rangos (23/10/2026). */
    email: d ? [
      filaGoteo('goteoEmail', 'minutos', 'Goteo', 'el goteo de los emails', 'Uno cada', 'min', 'Sus emails salen de a uno, con esta espera entre dos.', 5),
      filaGoteo('goteoEmail', 'dia', 'Tope por día', 'el tope por día de los emails', 'Hasta', 'por día', 'Cuántos emails de esta automatización salen como mucho por día.', Math.min(100, d.lineaEmailDia)),
    ] : [],
  };
}

/**
 * LA PANTALLA DE CONFIGURACIONES DE UNA AUTOMATIZACIÓN (23/10/2026): «Horario de oficina» y un bloque por canal, con lo de
 * ESTA automatización y nada más (nada «para todas»: ver la cabecera): Goteo y Tope por día en cada canal. `onSucio` por
 * parte: el modal no se cierra con un guardado en vuelo.
 */
export function AjustesDeLaAutomatizacion({ secuenciaId, onSucioHorario, onSucioAntiban }: {
  secuenciaId: number; onSucioHorario?: (s: boolean) => void; onSucioAntiban?: (s: boolean) => void;
}) {
  const auto = useAntibanDeLaAutomatizacion(secuenciaId, onSucioAntiban);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: SANS }}>
      <HorarioDeLaAutomatizacion secuenciaId={secuenciaId} onSucio={onSucioHorario} />
      {!auto.listo
        ? (auto.error ? <p role="alert" style={{ margin: 0, fontSize: 13.5, color: 'var(--bad)' }}>{auto.error}<ReportarASoporte /></p> : <Spinner />)
        : (
          <>
            <TarjetaOpciones etiqueta="WhatsApp" datos={{ 'data-canal': 'whatsapp', 'data-goteo': secuenciaId }}>
              <GrupoOpciones titulo="WhatsApp" info={auto.infoWhatsapp} primero />
              {auto.whatsapp}
            </TarjetaOpciones>
            <TarjetaOpciones etiqueta="Email" datos={{ 'data-canal': 'email' }}>
              <GrupoOpciones titulo="Email" primero />
              {auto.email}
            </TarjetaOpciones>
            {auto.aviso && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--bad)' }}>{auto.aviso}<ReportarASoporte /></p>}
          </>
        )}
    </div>
  );
}
