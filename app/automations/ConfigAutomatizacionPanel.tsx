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
//
// 24/10/2026 23:00 (Martín, f21 de la llamada con Leandro): «Uno solo: un solo interruptor de goteo (y uno de tope por día)
// que valga para todos los canales»; f20: «no está en Instagram». Desde ese día, UN bloque «Todos los canales» con Goteo y
// Tope por día, que valen para WhatsApp, email, Instagram y Messenger (cada canal cuenta lo suyo, lib/goteo.ts). Si vuelve a
// aparecer un interruptor por canal, es una regresión.
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { Spinner } from '@/app/_ui';
import { HorarioEnvioPanel, Interruptor, type FuenteHorario } from '@/app/configuraciones/HorarioEnvioPanel';
import { getConfigAutomatizacionAction, saveConfigAutomatizacionAction } from './config-automatizacion-actions';
import { Numero } from './LimitesEnvioPanel';
import { FilaOpcion, GrupoOpciones, Unidad, TarjetaOpciones } from './FilasOpciones';
import { HORARIO_SUGERIDO } from '@/lib/horario-envio';
import { textoPrioridad } from '@/lib/nutricion-prioridad';
import { RANGOS_GOTEO, horarioParaMostrar, type ConfigAutomatizacion } from '@/lib/config-automatizacion';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

const SANS = "'Geist', sans-serif";

type Leido = Awaited<ReturnType<typeof getConfigAutomatizacionAction>>;

/**
 * UNA SOLA LECTURA EN VUELO POR AUTOMATIZACIÓN (23/10/2026, «Rendimiento y loaders»): el horario y lo de cada canal montan
 * `useConfig` a la vez, y las server actions de Next corren de a UNA por cliente: la segunda esperaba a la primera y se
 * veían dos ruedas. Las dos esperan la misma promesa.
 */
const enVuelo = new Map<number, Promise<Leido>>();
function leerUnaVez(secuenciaId: number): Promise<Leido> {
  let p = enVuelo.get(secuenciaId);
  if (!p) {
    p = getConfigAutomatizacionAction(secuenciaId).finally(() => enVuelo.delete(secuenciaId));
    enVuelo.set(secuenciaId, p);
  }
  return p;
}

/** Lo leído, una vez, para las dos partes de la pantalla. */
function useConfig(secuenciaId: number) {
  const [d, setD] = useState<Leido | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let vivo = true;
    leerUnaVez(secuenciaId)
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
    // El huso se ve y se cambia acá, y es el del NEGOCIO (23/10/2026): lo dice la línea de debajo.
    zonaDelNegocio: true,
    // El que VALE (`horarioParaMostrar`): con el de fábrica y un horario del negocio, el del negocio (5/11/2026).
    leer: async () => ({ horario: horarioParaMostrar(d.config, d.horarioNegocio) ?? { ...HORARIO_SUGERIDO, activo: false }, zona: d.zona, puedeEditar: d.puedeEditar }),
    guardar: async (h) => {
      const r = await saveConfigAutomatizacionAction(secuenciaId, { horario: h });
      if (r.ok && r.config) poner(r.config);
      return { ok: r.ok, error: r.error, horario: r.config?.horario ?? undefined };
    },
  };
  return <HorarioEnvioPanel fuente={fuente} onSucio={onSucio} />;
}

/** Un cambio del goteo de esta automatización: los campos que cambian (`null` = se saca). */
type CambioGoteo = Record<string, number | null | { dia: number; sube: number }>;

/** El ⓘ del bloque: para qué canales vale, y cómo cuenta (lib/goteo.ts). */
export const INFO_TODOS_LOS_CANALES = 'Valen para WhatsApp, email, Instagram y Messenger: cada canal cuenta sus mensajes.';

/**
 * EL GOTEO DE ESTA AUTOMATIZACIÓN (22/10/2026), como estado de la pantalla: el de sus mensajes (lib/goteo.ts, la llamada con
 * Mauricio: «envía uno, tal vez espera 4 minutos o 5, envía el otro») y su tope por día (un SUB-tope adentro del de la
 * línea). UNO para todos los canales desde el 24/10/2026 (f21); hasta ese día había uno de WhatsApp y otro de Email.
 * Apagado = el campo AUSENTE (sin goteo / sin tope propio). Al prenderlo arranca con el número sugerido.
 * (Hasta el 23/10/2026 también estaban «Misma persona» y «Vista previa del link»: Martín, «elimina "Vista previa del link",
 * eso no se debe configurar en Configuraciones... Y elimina "Misma persona"». La vista previa se saca en el mensaje, con la X
 * de la tarjeta del link; «Misma persona» se fue también del motor.)
 * UN guardado para todo (`pendiente` lo junta en el respiro). Devuelve las filas del bloque «Todos los canales».
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
  const [local, setLocal] = useState<CambioGoteo>({});
  const pendiente = useRef<CambioGoteo>({});
  useEffect(() => () => { if (respiro.current) clearTimeout(respiro.current); }, []);
  useEffect(() => { onSucio?.(enVuelo); }, [enVuelo, onSucio]);
  const off = !d?.puedeEditar;
  const guardar = (cambio: CambioGoteo) => {
    setAviso('');
    pendiente.current = { ...pendiente.current, ...cambio };
    setLocal((p) => ({ ...p, ...cambio }));
    if (respiro.current) clearTimeout(respiro.current);
    setEnVuelo(true);
    respiro.current = setTimeout(() => {
      const envio = pendiente.current;
      pendiente.current = {};
      // Lo que se mandó deja de ser «local» (si no se tocó otra vez mientras tanto): manda lo que contestó el server.
      const soltar = () => setLocal((p) => {
        const q = { ...p };
        for (const [k, v] of Object.entries(envio)) if (q[k] === v) delete q[k];
        return q;
      });
      void saveConfigAutomatizacionAction(secuenciaId, { goteo: envio })
        .then((r) => { setEnVuelo(false); soltar(); if (!r.ok || !r.config) { setAviso(r.error || 'No se pudo guardar.'); return; } poner(r.config); })
        .catch(() => { setEnVuelo(false); soltar(); setAviso('No se pudo guardar.'); });
    }, 350);
  };
  /** Lo guardado de un campo, con lo tocado encima (undefined = ausente). */
  const leido = (campo: 'minutos' | 'dia'): number | undefined => (campo in local ? (local[campo] as number | null) ?? undefined : d?.config.goteo?.[campo]);
  /**
   * UNA FILA COMO EN AJUSTES DE iOS (23/10/2026, Martín: «que el botón de "on-off" esté al lado de donde se configuran el
   * resto de cosas no es muy intuitivo»): el nombre con su interruptor en la fila, y el número en un renglón de abajo SÓLO
   * con la opción prendida («Uno cada [5] min»). Apagada no hay número que mirar.
   */
  const filaGoteo = (campo: 'minutos' | 'dia', nombre: string, objeto: string, antes: string, unidad: string, info: string, sugerido: number) => {
    const v = leido(campo);
    const on = v !== undefined;
    return (
      <FilaOpcion key={campo} nombre={nombre} info={info} error={invalido[campo]} datos={{ 'data-goteo-campo': campo }}
        interruptor={<Interruptor on={on} disabled={off} etiqueta={on ? `Apagar ${objeto}` : `Prender ${objeto}`} onCambio={(x) => guardar({ [campo]: x ? sugerido : null })} />}
        debajo={on ? (
          <>
            <Unidad>{antes}</Unidad>
            <Numero valor={v} min={RANGOS_GOTEO[campo][0]} max={RANGOS_GOTEO[campo][1]} disabled={off} etiqueta={`${nombre} · ${unidad}`}
              onCambio={(n) => guardar({ [campo]: n })} onInvalido={(e) => setInvalido((p) => ({ ...p, [campo]: e ?? '' }))} />
            <Unidad>{unidad}</Unidad>
          </>
        ) : undefined} />
    );
  };
  return {
    listo: !!d, error, aviso,
    /** El ⓘ del bloque: para qué canales vale, y la regla de la línea de WhatsApp que sigue frenando por dentro aunque ya no se
     *  edite acá (nada se decide por detrás: «Primero lo que entra» y lo que la campaña le deja, con los números del negocio). */
    info: d ? `${INFO_TODOS_LOS_CANALES} ${textoPrioridad(d.lineaWa)}` : undefined,
    /** El goteo y el tope por día, para todos los canales. */
    filas: d ? [
      filaGoteo('minutos', 'Goteo', 'el goteo', 'Uno cada', 'min', 'Los mensajes salen de a uno, con esta espera entre dos.', 5),
      filaGoteo('dia', 'Tope por día', 'el tope por día', 'Hasta', 'por día', 'Cuántos mensajes de esta automatización salen como mucho por día.', Math.min(50, d.lineaWa.dia)),
      <FilaArranque key="arranque" tope={leido('dia')} arranque={('arranque' in local ? local.arranque as { dia: number; sube: number } | null : d.config.goteo?.arranque) ?? undefined}
        off={off} error={invalido.arranque} guardar={guardar} onInvalido={(e) => setInvalido((p) => ({ ...p, arranque: e ?? '' }))} />,
    ] : [],
  };
}

/** EL ARRANQUE GRADUAL (lib/goteo.ts): sólo con tope por día, que es hasta dónde sube, y al apagar el tope se va con él (`configParaGuardar`). */
function FilaArranque({ tope, arranque, off, error, guardar, onInvalido }: {
  tope: number | undefined; arranque: { dia: number; sube: number } | undefined; off: boolean; error?: string;
  guardar: (c: CambioGoteo) => void; onInvalido: (e: string | null | undefined) => void;
}) {
  if (tope === undefined) return null;
  const on = !!arranque;
  return (
    <FilaOpcion nombre="Arranque gradual" info="Sólo WhatsApp. Empieza con menos y sube cada día que llega a su tope, hasta el tope por día. Si pasa más de 2 días sin mandar, vuelve a empezar." error={error} datos={{ 'data-goteo-campo': 'arranque' }}
      interruptor={<Interruptor on={on} disabled={off} etiqueta={on ? 'Apagar el arranque gradual' : 'Prender el arranque gradual'} onCambio={(x) => guardar({ arranque: x ? { dia: Math.min(20, tope), sube: 20 } : null })} />}
      debajo={arranque ? (
        <>
          <Unidad>Empieza con</Unidad>
          <Numero valor={arranque.dia} min={RANGOS_GOTEO.dia[0]} max={RANGOS_GOTEO.dia[1]} disabled={off} etiqueta="Arranque gradual · el primer día"
            onCambio={(n) => guardar({ arranque: { ...arranque, dia: n } })} onInvalido={onInvalido} />
          <Unidad>y sube</Unidad>
          <Numero valor={arranque.sube} min={RANGOS_GOTEO.dia[0]} max={RANGOS_GOTEO.dia[1]} disabled={off} etiqueta="Arranque gradual · cuánto sube por día"
            onCambio={(n) => guardar({ arranque: { ...arranque, sube: n } })} onInvalido={onInvalido} />
          <Unidad>por día</Unidad>
        </>
      ) : undefined} />
  );
}

/**
 * LA PANTALLA DE CONFIGURACIONES DE UNA AUTOMATIZACIÓN (23/10/2026): «Horario de oficina» y, desde el 24/10/2026 (f21), UN
 * bloque «Todos los canales» con Goteo y Tope por día, con lo de ESTA automatización y nada más (nada «para todas»: ver la
 * cabecera). `onSucio` por parte: el modal no se cierra con un guardado en vuelo.
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
            <TarjetaOpciones etiqueta="Todos los canales" datos={{ 'data-goteo': secuenciaId }}>
              <GrupoOpciones titulo="Todos los canales" info={auto.info} primero />
              {auto.filas}
            </TarjetaOpciones>
            {auto.aviso && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--bad)' }}>{auto.aviso}<ReportarASoporte /></p>}
          </>
        )}
    </div>
  );
}
