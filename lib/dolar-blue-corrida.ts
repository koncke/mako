// =============================================================================
// dolar-blue-corrida — la corrida diaria del precio en pesos al dólar blue, con todo lo que toca el mundo POR PARÁMETRO (16/11/2026)
// =============================================================================
// La cuenta y los frenos, en ./dolar-blue-reglas.ts; lo de verdad (la red, los settings de la plataforma y el aviso), en
// ./dolar-blue.ts (`depsDeProduccion`). Acá no hay `server-only` a propósito: así tests/dolar-blue.test.ts la corre entera, sin red
// ni base, con lo que le inyecta.
//
// LO QUE NO TOCA, Y POR QUÉ NO PUEDE TOCARLO:
//   · Un link de pago ya emitido: el cobro guarda su propio monto y su moneda (`crearCobro`, tabla `cobros`) cuando se crea, y la
//     página /pagar/<token> cobra ESE monto. Esta corrida no lee ni escribe cobros: sus únicas escrituras son `planes.mako` (sólo
//     el precio en pesos) y su estado (`CLAVE_ESTADO_BLUE`), y no recibe con qué hacer otra cosa. Tampoco las suscripciones ya
//     autorizadas en Mercado Pago, que tienen su monto allá (el cron de la pasarela restaura al monto DEL COBRO, no al del setting:
//     lib/primer-mes.ts).
//   · Un precio en pesos cambiado a mano (segunda revisión del 16/11/2026, hallazgo 2): si un precio de hoy no es el que dejó la
//     última corrida (`escritos` del estado), no se toca nada, la automatización se apaga sola y queda el aviso (`avisoDeAMano`).
//   · El resto del setting: se edita lo leído (`settingConPesos`) y se escribe con compare-and-set contra lo leído: si Martín
//     cambió algo en Settings › Payments entre la lectura y la escritura, esta corrida pierde y no pisa nada (vuelve a probar mañana,
//     y ahí lo ve como un cambio a mano).
//   · Lo que se escribe tiene que volver a leerse igual con `planesDeSetting`: mismos planes, y cada uno con el precio nuevo. Si no,
//     no se escribe (la misma regla de `guardarPrecioLocal`, lib/compra-plan.ts).
// LOS AVISOS: uno por cada freno, que dice qué pasa mañana y cómo frenarlo (`avisoDelFreno`); uno por cada cambio aplicado de más de
// un 5 %, y siempre el grande (`seAvisaElCambio`, `avisoDelCambio`); y el del precio cambiado a mano.
// =============================================================================

import { createHash } from 'node:crypto';
import { CLAVE_PLANES, planesDeSetting } from './planes-mako';
import {
  CLAVE_ESTADO_BLUE, FUENTES_BLUE, MONEDA_PESOS, avisoDeAMano, avisoDelCambio, avisoDelFreno, cambiadosAMano, cotizacionDeLosPrecios, decidir,
  leerEstado, mapaDePesos, pesosDeLosPlanes, planesCrudos, seAvisaElCambio, settingConPesos, type AvisoBlue, type Cambio, type Cotizacion, type EstadoBlue,
} from './dolar-blue-reglas';

/** Todo lo que toca el mundo, para poder correrla sin red ni base (tests/dolar-blue.test.ts). */
export type DepsBlue = {
  /** GET de un JSON; tira si no contesta o no es un 200. */
  consultar: (url: string) => Promise<unknown>;
  /** Un setting del negocio de la plataforma (estricto: «no pude leer» tira, nunca se lee como «no existe»). */
  leer: (clave: string) => Promise<string | null>;
  /** Compare-and-set de un setting de la plataforma: escribe sólo si todavía vale `esperado`. */
  cambiarSi: (clave: string, esperado: string | null, nuevo: string) => Promise<boolean>;
  /** Escribe un setting de la plataforma (sólo el estado de esta automatización). */
  guardar: (clave: string, valor: string) => Promise<void>;
  /** El aviso de un freno, de un cambio o de un precio cambiado a mano. Nunca tira. */
  avisar: (aviso: AvisoBlue) => Promise<void>;
  ahoraMs: () => number;
};

export type CorridaBlue = {
  estado: 'aplicado' | 'sin-cambios' | 'frenado' | 'apagado' | 'sin-pesos' | 'cambio-mientras' | 'a-mano' | 'en-seco';
  /** La cotización que se aplicó (o se habría aplicado): la primera al día. */
  cotizacion: Cotizacion | null;
  /** La del otro servicio, cuando contestó y coincidió. */
  confirmacion?: Cotizacion | null;
  /** Los planes cuyo precio en pesos cambió (o cambiaría, en seco). */
  cambios: Cambio[];
  /** La cotización contra la que se comparó (la de los precios en vigor) y el salto. */
  contra?: number | null;
  salto?: number | null;
  motivo?: string;
};

/** Lo que contestó cada servicio de `FUENTES_BLUE`, en su orden, con un número que se entiende. Se leen los dos. */
export async function leerCotizaciones(consultar: DepsBlue['consultar']): Promise<Cotizacion[]> {
  const out: Cotizacion[] = [];
  for (const f of FUENTES_BLUE) {
    try {
      const c = f.leer(await consultar(f.url));
      if (c) out.push({ ...c, fuente: f.nombre });
      else console.warn(`[dolar-blue] ${f.nombre} contestó algo que no es una cotización del blue.`);
    } catch (e) {
      console.warn(`[dolar-blue] ${f.nombre} no contestó: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return out;
}

/** La cotización del blue: la del primer servicio que contesta con un número que se entiende. */
export async function leerCotizacion(consultar: DepsBlue['consultar']): Promise<Cotizacion | null> {
  return (await leerCotizaciones(consultar))[0] ?? null;
}

/**
 * La `Idempotency-Key` del correo de un aviso: el tipo, el día y la huella de TODO lo que se manda (como `claveDelCorreo`,
 * lib/aplicacion-accelerator-servidor.ts). ⚠️ ERA SÓLO EL TIPO Y EL DÍA (segunda revisión, hallazgo 9): un segundo aviso distinto del
 * mismo tipo el mismo día (el cron reintentado, o corrido a mano) llevaba la misma clave con otro cuerpo, Resend contestaba 409 y el
 * aviso quedaba sólo en el log. El mismo aviso repetido sigue sin duplicarse: misma huella, misma clave.
 */
export function claveDelAviso(p: { tipo: string; dia: string; to: string; tag: string; asunto: string; preheader: string; cuerpo: string }): string {
  const huella = createHash('sha256').update([p.to, p.tag, p.asunto, p.preheader, p.cuerpo].join('\u0000')).digest('hex').slice(0, 32);
  return `dolar-blue-${p.tipo}-${p.dia}-${huella}`;
}

/** ¿Lo escrito se vuelve a leer igual? Los mismos planes, y cada cambio con su precio en pesos nuevo. */
function seReleeIgual(antes: string, nuevo: string, cambios: readonly Cambio[]): boolean {
  const a = planesDeSetting(antes), d = planesDeSetting(nuevo);
  if (a.length !== d.length || a.some((p, i) => p.id !== d[i]?.id || p.precioUsd !== d[i]?.precioUsd)) return false;
  return cambios.every((c) => d.find((p) => p.id === c.id)?.preciosLocales[MONEDA_PESOS] === c.despues);
}

/** El nombre de cada plan del setting, para el aviso («MaKo Essential: de $ 73.555 a $ 75.000»). Un plan apagado lo dice. */
const nombresDe = (planes: ReadonlyArray<Record<string, unknown>>): Record<string, string> =>
  Object.fromEntries(planes.filter((p) => typeof p.id === 'string').map((p) => [
    p.id as string, `${typeof p.nombre === 'string' && p.nombre ? p.nombre : (p.id as string)}${p.activo === false ? ' (apagado, no se ofrece)' : ''}`,
  ]));

/** El estado sin lo que dice qué escribió el cron: al apagarse solo, al prenderlo de nuevo no hay con qué comparar. */
function sinLoEscrito(e: EstadoBlue): EstadoBlue {
  const out = { ...e };
  delete out.escritos;
  delete out.escribiendo;
  return out;
}

/**
 * LA CORRIDA. `enSeco`: dice lo que haría sin escribir ni avisar. Nunca escribe otra cosa que `planes.mako` (sólo el precio en
 * pesos) y su estado (`CLAVE_ESTADO_BLUE`). Lo que no se pudo leer de la base TIRA (lo atrapa el cron): mejor una corrida perdida
 * que una decisión tomada sobre «no había nada».
 */
export async function actualizarPesosAlBlue(d: DepsBlue, o: { enSeco?: boolean } = {}): Promise<CorridaBlue> {
  const estado = leerEstado(await d.leer(CLAVE_ESTADO_BLUE));
  if (estado.apagada) return { estado: 'apagado', cotizacion: null, cambios: [], motivo: `Apagada (${CLAVE_ESTADO_BLUE}).` };
  const crudo = await d.leer(CLAVE_PLANES);
  const planes = planesCrudos(crudo);
  // Sin el setting, los planes son los de fábrica, sin precio en pesos: Mercado Pago no se ofrece y no hay nada que poner al día.
  // Tampoco si ningún plan activo tiene precio en pesos. No es un freno (no hay aviso): es que no hay nada que hacer.
  const vigente = planes ? cotizacionDeLosPrecios(planes) : null;
  if (!planes || crudo == null || vigente == null) return { estado: 'sin-pesos', cotizacion: null, cambios: [], motivo: 'Ningún plan activo tiene precio en pesos.' };
  const ahora = d.ahoraMs();
  const en = new Date(ahora).toISOString();

  // UN PRECIO CAMBIADO A MANO (hallazgo 2): si alguno de hoy no es el que dejó el cron, no se lee el blue ni se toca nada. La
  // automatización se apaga sola (el mismo `apagada` del freno de emergencia) y lo avisa una vez, con cómo prenderla.
  const escritos = mapaDePesos(estado.escritos);
  const aMano = escritos ? cambiadosAMano(pesosDeLosPlanes(planes), [escritos, mapaDePesos(estado.escribiendo)]) : [];
  if (aMano.length) {
    const aviso = avisoDeAMano(aMano, nombresDe(planes));
    if (!o.enSeco) {
      await d.guardar(CLAVE_ESTADO_BLUE, JSON.stringify({ ...sinLoEscrito(estado), apagada: true, freno: { motivo: aviso.resumen, en } }));
      await d.avisar(aviso);
    }
    return { estado: 'a-mano', cotizacion: null, cambios: [], motivo: aviso.resumen };
  }

  const leidas = await leerCotizaciones(d.consultar);
  const decision = decidir(leidas, { vigente, ahoraMs: ahora });
  const c = decision.tipo === 'aplicar' ? decision.cotizacion : (leidas[0] ?? null);
  // La que se leyó queda anotada para mirarla. No decide nada: el salto se mide contra los precios en vigor.
  const leida: EstadoBlue = { ...estado, ...(c ? { ultima: { ...c, leidaEn: en } } : {}) };

  if (decision.tipo === 'frenar') {
    if (!o.enSeco) {
      await d.guardar(CLAVE_ESTADO_BLUE, JSON.stringify({ ...leida, freno: { motivo: decision.motivo, en } }));
      await d.avisar(avisoDelFreno(decision.motivo, decision.queSigue));
    }
    return { estado: 'frenado', cotizacion: c, cambios: [], contra: decision.contra, salto: decision.salto, motivo: decision.motivo };
  }

  const { planes: nuevos, cambios } = settingConPesos(planes, decision.venta);
  const base = { cotizacion: c, confirmacion: decision.confirmacion, contra: decision.contra, salto: decision.salto };
  if (o.enSeco) return { estado: 'en-seco', ...base, cambios };
  if (cambios.length) {
    const nuevo = JSON.stringify(nuevos);
    if (!seReleeIgual(crudo, nuevo, cambios)) {
      const motivo = 'El precio en pesos nuevo no pasó la validación de los planes: no se escribió.';
      await d.guardar(CLAVE_ESTADO_BLUE, JSON.stringify({ ...leida, freno: { motivo, en } }));
      await d.avisar(avisoDelFreno(motivo, 'Mañana a las 18:05 (hora de Argentina) se vuelve a probar.'));
      return { estado: 'frenado', ...base, cambios: [], motivo };
    }
    // Lo que se va a escribir, ANTES de escribirlo: si los planes se escriben y el estado de abajo no, mañana esos precios siguen
    // siendo del cron (`escribiendo`) y no se leen como un cambio a mano.
    await d.guardar(CLAVE_ESTADO_BLUE, JSON.stringify({ ...leida, escribiendo: pesosDeLosPlanes(nuevos) }));
    if (!(await d.cambiarSi(CLAVE_PLANES, crudo, nuevo))) {
      // Alguien guardó los planes entre la lectura y la escritura: no se pisa. Mañana se vuelve a leer.
      await d.guardar(CLAVE_ESTADO_BLUE, JSON.stringify(leida));
      return { estado: 'cambio-mientras', ...base, cambios: [], motivo: 'Los planes cambiaron mientras se calculaba: no se pisaron.' };
    }
  }
  const hecho: EstadoBlue = { ...leida, freno: null, escritos: pesosDeLosPlanes(cambios.length ? nuevos : planes), ...(cambios.length ? { aplicada: { venta: decision.venta, en, cambios } } : {}) };
  delete hecho.escribiendo;
  await d.guardar(CLAVE_ESTADO_BLUE, JSON.stringify(hecho));
  // Todo cambio de más de un 5 % se avisa, y siempre uno grande (más del 15 %, confirmado por los dos servicios): es plata, y
  // Martín tiene que poder frenarlo.
  if (seAvisaElCambio(decision, cambios) && decision.contra != null && decision.salto != null && c) {
    await d.avisar(avisoDelCambio({ venta: decision.venta, contra: decision.contra, salto: decision.salto, fuente: c.fuente, confirmacion: decision.confirmacion, cambios, nombres: nombresDe(planes) }));
  }
  return { estado: cambios.length ? 'aplicado' : 'sin-cambios', ...base, cambios };
}
