// =============================================================================
// por-que-no-sale-db — lo del negocio para decir por qué no le sale el mensaje a un lead (server-only, 23/10/2026)
// =============================================================================
// Lo puro, y el porqué entero, en lib/por-que-no-sale.ts. Acá se lee UNA vez por pedido (un tablero del CRM, la ficha, el
// lienzo, el historial al inscribirse) con las MISMAS lecturas que el motor: el horario del negocio y el de cada
// automatización, la zona, el envío de WhatsApp, las líneas, los topes y lo que ya salió y el último
// intento que falló. Si algo no se puede leer, no se dice nada (undefined): «no pude leer» no es «nada lo frena», pero
// tampoco se le inventa un motivo al lead.
//
// ⚠️ EN TANDAS Y PAGINADO (revisión adversarial del 23/10/2026): un tablero pide 500 leads y el lienzo hasta 2000
// inscripciones. Un `.in()` suelto se corta en 1000 filas sin orden (el último WhatsApp sale mal y «Misma persona»
// miente) y con 2000 ids la URL se pasa de largo. Es la misma trampa que el motor ya cerró (`leadsConEnvioReciente`).
// =============================================================================
import 'server-only';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { getSettingEstricto } from './settings';
import { KEY_HORARIO_ENVIO, horarioVigente } from './horario-envio';
import { KEY_LIMITES_ENVIO, limitesDeFabrica, limitesVigentes } from './limites-envio';
import { opcionesDeRango } from './limites-envio-cuenta';
import { horarioDeLaAutomatizacion } from './config-automatizacion';
import { configsDelNegocio } from './config-automatizacion-db';
import { zonaDelNegocioEstricta } from './timezone';
import { envioEmailHabilitado, envioWhatsappHabilitado } from './envio-flags';
import { listarLineas } from './evolution';
import { leerTodo, type ConsultaPaginada } from './supabase-paginado';
import { enTandas } from './ids-con-filas';
import { porQueNoSale, type ContextoDelEnvio } from './por-que-no-sale';
import { indiceActual, esHiloDelCarril, esTarjetaMako } from './nutricion-grafo-motor';
import { esperaQueAbra } from './mako-tarjeta';
import { lineaDelPaso } from './mensaje-partes';
import { idDe, type PasoGrafo } from './flujo-grafo';
import type { FilaAutomatizacion, FilaInscripcion, FrenoDeFila } from './automatizaciones-del-lead-reglas';

/** Lo de una inscripción que hace falta para su último fallo (`id`: el de la fila de `nutricion_inscripciones`). */
type ConId = FilaInscripcion & { id?: number | null };


type Intento = { id: number; inscripcion_id: number | null; nodo_id: string | null; error: string | null; estado: string; created_at: string };

/**
 * El `frenoDe` para `enAutomatizacionesDe`: por qué no le sale a cada fila viva. undefined = no hay ninguna que mirar, o no
 * se pudo leer lo del negocio (entonces la ficha sigue diciendo lo de siempre).
 */
export async function frenosDelNegocio(filas: readonly ConId[], secs: readonly FilaAutomatizacion[]): Promise<FrenoDeFila | undefined> {
  const vivas = filas.filter((f) => f.estado === 'activa');
  if (!vivas.length) return undefined;
  const ahoraMs = Date.now();
  try {
    const ws = await getWorkspaceActual();
    if (ws == null) return undefined;
    const [hNeg, limitesCrudos, configs, tz, waOn, lineas, uso, emailOn] = await Promise.all([
      getSettingEstricto(KEY_HORARIO_ENVIO).then(horarioVigente),
      getSettingEstricto(KEY_LIMITES_ENVIO),
      configsDelNegocio(),
      zonaDelNegocioEstricta(ws).catch(() => null),
      envioWhatsappHabilitado(),
      listarLineas(),
      // Los MISMOS contadores que el motor (lo que salió en 24 h y en esta hora). Import dinámico: lib/nutricion.ts es grande
      // y este módulo lo carga el CRM.
      import('./nutricion').then((m) => m.usoDelCupo()),
      // El de email (10/11/2026): el mismo interruptor que mira el motor. Sin poder leerlo, no se afirma nada.
      envioEmailHabilitado().catch(() => undefined),
    ]);
    const limites = limitesVigentes(limitesCrudos, limitesDeFabrica(process.env), await opcionesDeRango());
    // El tope de HOY, con la rampa de la línea (5/11/2026): el mismo que el motor, con el mismo piso si no se puede leer.
    const diaHoy = await import('./nutricion').then((m) => m.topeDeHoyDelNegocio('whatsapp', limites.wa));
    const ctx: ContextoDelEnvio = {
      ahoraMs, tz, whatsappPrendido: waOn, ...(emailOn === undefined ? {} : { emailPrendido: emailOn }),
      linea: { dia: diaHoy, usadoDia: uso.waDia, hora: limites.wa.hora, usadoHora: uso.waHora, ...(diaHoy < limites.wa.dia ? { diaLinea: limites.wa.dia } : {}) },
    };

    // El último intento de cada inscripción en 24 h (un fallo NO avanza: lo que falló sigue siendo la tarjeta en la que está).
    // (Hasta el 23/10/2026 se leía además el último WhatsApp de cada lead y su reunión, para «Misma persona», que se fue.)
    const db = await getTenantDb();
    const leads = [...new Set(vivas.map((f) => Number(f.lead_id)))];
    const desde = new Date(ahoraMs - 24 * 3600_000).toISOString();
    const intentos: Intento[] = [];
    for (const tanda of enTandas(leads, 200)) {
      intentos.push(...await leerTodo<Intento>(db, 'nutricion_envios', 'id, inscripcion_id, nodo_id, error, estado, created_at', {
        orden: 'id', filtros: (q) => q.in('lead_id', tanda).gte('created_at', desde) as ConsultaPaginada,
      }));
    }
    // El ÚLTIMO intento de cada inscripción (por id, el más nuevo primero): si salió después de fallar, ya no está frenada.
    const fallos = new Map<number, { error: string; at: number; nodo: string | null }>();
    const visto = new Set<number>();
    for (const e of intentos.sort((a, b) => b.id - a.id)) {
      const id = Number(e.inscripcion_id);
      if (!id || visto.has(id)) continue;
      visto.add(id);
      if (e.estado === 'fallo' && e.error) fallos.set(id, { error: e.error, at: Date.parse(e.created_at), nodo: e.nodo_id ?? null });
    }

    return (f, s, canal) => {
      if (f.estado !== 'activa') return null;
      const c = configs.get(Number(s.id)) ?? {};
      const pasos = (Array.isArray(s.pasos) ? s.pasos : []) as PasoGrafo[];
      const i = pasos.length ? indiceActual(pasos, { paso_actual: f.paso_actual ?? 0, nodo_actual: f.nodo_actual }) : -1;
      const paso = i >= 0 ? pasos[i] : undefined;
      // La línea por la que sale ESTA tarjeta, como el motor: la suya, la de la automatización, o la por default.
      const pedida = lineaDelPaso(paso) ?? s.instance_name ?? null;
      const hayLinea = pedida ? lineas.some((l) => l.instance_name === pedida) : lineas.length > 0;
      const id = Number((f as ConId).id);
      // El fallo cuenta si es de la tarjeta en la que está parada (un fallo no avanza: casi siempre lo es).
      const falloAca = id ? fallos.get(id) ?? null : null;
      const ultimoFallo = falloAca && (falloAca.nodo == null || (i >= 0 && falloAca.nodo === idDe(pasos[i], i))) ? falloAca : null;
      const carril = i >= 0 && esHiloDelCarril(pasos, i);
      const makoIgual = esTarjetaMako(paso) && !esperaQueAbra((paso?.accion as { params?: Record<string, unknown> } | null | undefined)?.params);
      return porQueNoSale({
        proximoEnvioAt: f.proximo_envio_at, automatizacionActiva: s.activa === true, canal, hayLinea,
        horario: horarioDeLaAutomatizacion(c, hNeg),
        ultimoFallo,
        correFueraDeHorario: carril || makoIgual,
        sinAntiBan: carril,
      }, ctx);
    };
  } catch (e) {
    console.error('[por-que-no-sale] no pude leer lo del negocio:', e instanceof Error ? e.message : String(e));
    return undefined;
  }
}
