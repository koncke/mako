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
//   · El resto del setting: se edita lo leído (`settingConPesos`) y se escribe con compare-and-set contra lo leído: si Martín
//     cambió algo en /admin/cobros entre la lectura y la escritura, esta corrida pierde y no pisa nada (vuelve a probar mañana).
//   · Lo que se escribe tiene que volver a leerse igual con `planesDeSetting`: mismos planes, y cada uno con el precio nuevo. Si no,
//     no se escribe (la misma regla de `guardarPrecioLocal`, lib/compra-plan.ts).
// LOS AVISOS (16/11/2026, revisión, hallazgo 1): uno por cada freno, que dice qué pasa mañana y cómo frenarlo (`avisoDelFreno`), y
// uno SIEMPRE que se aplica un cambio grande, el que confirmaron los dos servicios (`avisoDelCambio`). Antes el día 2 de un dato roto
// se aplicaba en silencio.
// =============================================================================

import { CLAVE_PLANES, planesDeSetting } from './planes-mako';
import {
  CLAVE_ESTADO_BLUE, FUENTES_BLUE, MONEDA_PESOS, avisoDelCambio, avisoDelFreno, cotizacionDeLosPrecios, decidir, leerEstado, planesCrudos,
  settingConPesos, type AvisoBlue, type Cambio, type Cotizacion, type EstadoBlue,
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
  /** El aviso de un freno o de un cambio grande. Nunca tira. */
  avisar: (aviso: AvisoBlue) => Promise<void>;
  ahoraMs: () => number;
};

export type CorridaBlue = {
  estado: 'aplicado' | 'sin-cambios' | 'frenado' | 'apagado' | 'sin-pesos' | 'cambio-mientras' | 'en-seco';
  /** La cotización que se aplicó (o se habría aplicado): la primera al día. */
  cotizacion: Cotizacion | null;
  /** La del otro servicio, cuando confirmó un salto grande. */
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

/** ¿Lo escrito se vuelve a leer igual? Los mismos planes, y cada cambio con su precio en pesos nuevo. */
function seReleeIgual(antes: string, nuevo: string, cambios: readonly Cambio[]): boolean {
  const a = planesDeSetting(antes), d = planesDeSetting(nuevo);
  if (a.length !== d.length || a.some((p, i) => p.id !== d[i]?.id || p.precioUsd !== d[i]?.precioUsd)) return false;
  return cambios.every((c) => d.find((p) => p.id === c.id)?.preciosLocales[MONEDA_PESOS] === c.despues);
}

/** El nombre de cada plan del setting, para el aviso («MaKo Essential: de $ 73.555 a $ 75.000»). */
const nombresDe = (planes: ReadonlyArray<Record<string, unknown>>): Record<string, string> =>
  Object.fromEntries(planes.filter((p) => typeof p.id === 'string').map((p) => [p.id as string, typeof p.nombre === 'string' && p.nombre ? p.nombre : (p.id as string)]));

/**
 * LA CORRIDA. `enSeco`: dice lo que haría sin escribir ni avisar. Nunca escribe otra cosa que `planes.mako` (sólo el precio en
 * pesos) y su estado (`CLAVE_ESTADO_BLUE`). Lo que no se pudo leer de la base TIRA (lo atrapa el cron): mejor una corrida perdida
 * que una decisión tomada sobre «no había nada».
 */
export async function actualizarPesosAlBlue(d: DepsBlue, o: { enSeco?: boolean } = {}): Promise<CorridaBlue> {
  const estado = leerEstado(await d.leer(CLAVE_ESTADO_BLUE));
  if (estado.apagada) return { estado: 'apagado', cotizacion: null, cambios: [], motivo: `Apagada a mano (${CLAVE_ESTADO_BLUE}).` };
  const crudo = await d.leer(CLAVE_PLANES);
  const planes = planesCrudos(crudo);
  // Sin el setting, los planes son los de fábrica, sin precio en pesos: Mercado Pago no se ofrece y no hay nada que poner al día.
  // Tampoco si ningún plan tiene precio en pesos. No es un freno (no hay aviso): es que no hay nada que hacer.
  const vigente = planes ? cotizacionDeLosPrecios(planes) : null;
  if (!planes || crudo == null || vigente == null) return { estado: 'sin-pesos', cotizacion: null, cambios: [], motivo: 'Ningún plan tiene precio en pesos.' };

  const leidas = await leerCotizaciones(d.consultar);
  const ahora = d.ahoraMs();
  const en = new Date(ahora).toISOString();
  const decision = decidir(leidas, { vigente, ahoraMs: ahora });
  const c = decision.tipo === 'aplicar' ? decision.cotizacion : (leidas[0] ?? null);
  // La que se leyó queda anotada para mirarla. Ya no decide nada: el salto se mide contra los precios en vigor (el freno 2).
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
    if (!(await d.cambiarSi(CLAVE_PLANES, crudo, nuevo))) {
      // Alguien guardó los planes entre la lectura y la escritura: no se pisa. Mañana se vuelve a leer.
      await d.guardar(CLAVE_ESTADO_BLUE, JSON.stringify(leida));
      return { estado: 'cambio-mientras', ...base, cambios: [], motivo: 'Los planes cambiaron mientras se calculaba: no se pisaron.' };
    }
  }
  await d.guardar(CLAVE_ESTADO_BLUE, JSON.stringify({ ...leida, freno: null, ...(cambios.length ? { aplicada: { venta: decision.venta, en, cambios } } : {}) }));
  // Un cambio GRANDE (más del 15 %, confirmado por los dos servicios) siempre se avisa: es plata, y Martín tiene que poder frenarlo.
  if (cambios.length && decision.grande && decision.confirmacion && decision.contra != null && decision.salto != null && c) {
    await d.avisar(avisoDelCambio({ venta: decision.venta, contra: decision.contra, salto: decision.salto, fuente: c.fuente, confirmacion: decision.confirmacion, cambios, nombres: nombresDe(planes) }));
  }
  return { estado: cambios.length ? 'aplicado' : 'sin-cambios', ...base, cambios };
}
