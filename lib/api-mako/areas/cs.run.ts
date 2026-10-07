// =============================================================================
// api-mako/areas/cs.run — los cuerpos del área `cs`
// =============================================================================
// Un runner por id de cs.def.ts. Lecturas: { leer }. Acciones: { preparar, ejecutar }.
// Todo corre adentro de runWithWorkspace(ctx.ws): las libs que scopean con
// getTenantDb scopean solas. Nunca se escribe desde leer() ni desde preparar().
//
// ⚠️ QUEDARON TRES DE DIECISIETE (26/09/2026). Las otras catorce eran el programa
// de 44 clases de un cliente —el temario, su cuestionario, su curso en la plataforma externa, los
// casos de otros clientes suyos y el banco de material— y se fueron con
// `app/customer-success/programa/`. El porqué del gating está en cs.def.ts. El 06/10/2026
// se sumó la cuarta, `ver_avance_curso_cs`: el curso que vive EN MaKo (mig 0202).
//
// ⚠️ LO QUE LA CARTERA NO SABE, Y EL MODELO TIENE QUE LEER:
//   · `senal.nivel` puede ser **null**, y null es «no se puede saber» — no «está
//     bien». Sale así cuando falta el contrato, cuando el cliente recién cerró o
//     cuando una lectura falló. Se cuenta en su propio casillero (`sin-datos`) y
//     nunca se suma a `bien`.
//   · «sesiones» cuenta TODAS las llamadas analizadas del lead, incluida la de venta.
//   · Sin contrato legible el reloj viene null: se dice «sin dato», nunca se estima.
//   · `tareas_abiertas` / `tareas_atrasadas` salen del TABLERO, enchufado acá con
//     `conTrabajo` (lib/cs-senal.ts) después de `tableroDeLaCartera` — los dos pasos que
//     describe la cabecera de lib/cs-cartera.ts. Hasta el 06/10/2026 esto decía que lo
//     enchufaba «la PÁGINA», y era falso: la página no lee la cartera, así que por la API
//     la señal no podía disparar «tareas atrasadas» NUNCA. Vienen en null SÓLO si el
//     tablero no se pudo leer (`tablero_leido: false`).
//   · Cada lectura de la cartera (cobros, contacto, tablero) trae su propio flag `*_leido(s)`.
//     Un 0 con el flag en false es «no pude leer», no «no hay».
// =============================================================================

import 'server-only';
import type { Ejecutado, Preparado, Runners } from '../tipos';
import { cartera, type ClienteCartera, type EstadoCliente } from '@/lib/cs-cartera';
import { claveNivel, conTrabajo, type ClaveNivel } from '@/lib/cs-senal';
import { getWorkspace } from '@/lib/workspace';
import { tableroDeCapa } from '@/lib/tablero-de-capa';
import { clientesGanados } from '@/lib/clientes-ganados';
import { tableroDeLaCartera } from '@/app/customer-success/trabajo';
import { universoDeLaEntrega } from '@/app/customer-success/entrega';
import { esDelProducto, salioDeLaEntrega } from '@/app/customer-success/pertenencia';
import { clasesDelProducto, progresoDelCliente, progresoDeClientes, accesoDe } from '@/lib/curso-datos';
import { accesosDeClientes } from '@/lib/curso-admin';
import { avanceDeCurso, accesoParaMako, NOTAS_CURSO } from '@/lib/curso-resumen';
import type { Progreso } from '@/lib/curso';
import { clienteDelWorkspace, estadoGuardadoDe, marcarEstadoCliente } from './cs.helpers';

// ── utilidades ───────────────────────────────────────────────────────────────

type In = Record<string, unknown>;

const json = (o: unknown): string => JSON.stringify(o);
const fallo = (content: string) => ({ content, isError: true });
const num = (i: In, k: string): number | null => (typeof i[k] === 'number' && Number.isFinite(i[k]) ? (i[k] as number) : null);
const str = (i: In, k: string): string => (typeof i[k] === 'string' ? (i[k] as string).trim() : '');

const NO_ES_CLIENTE = (id: number | null) => `El lead #${id ?? '?'} no es un cliente ganado de este negocio. Los clientes salen de ver_cartera_cs.`;

// ⚠️ LA CARTERA SE REARMÓ EL 26/09/2026 Y DEJÓ DE SER LA DE UN CLIENTE. Se fueron
// los campos del programa de 44 clases (bloques, clases vistas, bloque actual, links
// y el par cancha/razón) y entró `senal`, que es la misma que ordena la pantalla:
// nivel `atencion` | `bien` | **null**, y null es «no se puede saber».
//
// Estas notas viajan al modelo con cada lectura, así que dicen lo que el payload NO
// puede afirmar. Es la única defensa contra un 0 leído como un hecho.
const NOTAS_CARTERA = [
  'senal.nivel null NO es «está bien»: es «no se puede saber» (sin contrato cargado, sin datos, o una lectura que falló). Nunca lo reportes como un cliente al día.',
  'sesiones_analizadas cuenta TODAS las llamadas analizadas del lead, incluida la de venta: verifica antes de decir «hace N días de la última sesión de entrega».',
  'semana_del_contrato y semanas_del_contrato null = el contrato no lo dice: di «sin dato», no estimes. plazo_vencido no autoriza a marcarlo graduado.',
  'tareas_abiertas y tareas_atrasadas null = el tablero no se pudo leer (tablero_leido false). No es cero. Un 0 con el tablero leído es que no tiene trabajo abierto con su nombre.',
  'Una cuota impaga SIN fecha esperada no está vencida: son dos cosas distintas (cuotas_impagas_sin_fecha).',
  'cuotas_vencidas y sesiones_analizadas en 0 pueden ser una lectura fallida: mira cobros_leidos y contacto_leido antes de afirmar un 0 importante (por ejemplo, «no debe nada»).',
];

function filaCartera(c: ClienteCartera) {
  return {
    leadId: c.leadId, nombre: c.nombre, empresa: c.empresa,
    atencion: c.senal.nivel, razon: c.senal.motivo, regla: c.senal.regla,
    estado_en_programa: c.estado,
    semana_del_contrato: c.reloj.semana, semanas_del_contrato: c.reloj.semanasTotales,
    plazo_vencido: c.reloj.terminado,
    ultima_sesion_hace_dias: c.ultimaSesionHace, ultima_sesion_titulo: c.ultimaSesionTitulo,
    sesiones_analizadas: c.sesiones,
    cuotas_vencidas: c.cuotasVencidas, cuota_vencida_mas_vieja_hace_dias: c.cuotaVencidaDias,
    cuotas_impagas_sin_fecha: c.cuotasImpagasSinFecha,
    ultimo_mensaje_whatsapp_hace_dias: c.ultimoMensajeHace,
    espera_respuesta_hace_dias: c.esperaRespuestaHace,
    cerro_hace_dias: c.diasDesdeElCierre,
    tareas_abiertas: c.tareasAbiertas, tareas_atrasadas: c.tareasAtrasadas,
    cobros_leidos: c.cobrosLeidos, contacto_leido: c.contactoLeido,
  };
}

/**
 * La cartera CON el trabajo del tablero enchufado: `cartera()` → `tableroDeLaCartera` →
 * `conTrabajo`, que recalcula la señal (ahí entra «tiene tareas atrasadas») y reordena.
 *
 * ⚠️ EL TABLERO SE ELIGE POR LA CAPA DEL WORKSPACE, NO POR LA SESIÓN. `tableroDeLaCartera`
 * sin `forzado` pregunta a `tableroActual()`, que lee la cookie: por WhatsApp no hay, y el
 * super-admin leería `experimento_tareas` —cero filas en su workspace— y MaKo le contestaría
 * «0 atrasadas» para todos sus clientes. `tableroDeCapa` es el mismo criterio que usa el resto
 * de la API (`usaPlanBoard`, plan.helpers.ts).
 *
 * ⚠️ SE CRUZA CONTRA `clientesGanados()`, la MISMA lista que usa la pantalla, y no contra la
 * cartera: el cruce blando decide si una palabra distingue a alguien mirando a todos, y con
 * otra lista MaKo y la pantalla atarían distinto el mismo proyecto.
 *
 * Si el tablero no se puede leer, la cartera vuelve igual, ordenada, con el trabajo en null
 * («no lo sé») y `tableroLeido: false`. Nunca 0.
 */
async function carteraConTrabajo(ws: number): Promise<{ clientes: ClienteCartera[]; tableroLeido: boolean }> {
  const base = await cartera();
  if (!base.length) return { clientes: base, tableroLeido: true };
  let porLead: Parameters<typeof conTrabajo>[1] = null;
  try {
    const [ganados, w] = await Promise.all([clientesGanados(), getWorkspace(ws)]);
    const t = await tableroDeLaCartera(ganados, tableroDeCapa(w?.capa));
    porLead = t.ok ? t.porLead : null;
  } catch (e) {
    console.warn(`[api-mako cs] ws${ws}: no pude leer el tablero de la cartera:`, e instanceof Error ? e.message : e);
  }
  return { clientes: conTrabajo(base, porLead), tableroLeido: porLead != null };
}

// ── los runners ──────────────────────────────────────────────────────────────

export const RUNNERS: Runners = {
  // ── Lecturas ───────────────────────────────────────────────────────────────
  ver_cartera_cs: {
    leer: async (input, ctx) => {
      const { clientes: todos, tableroLeido } = await carteraConTrabajo(ctx.ws);
      const filtro = str(input, 'atencion') as ClaveNivel | '';
      const incluirCerrados = input.incluirCerrados === true;
      // «Cerrados» = los que salieron de la entrega: el MISMO par que deja a un cliente fuera de
      // la cohorte de una secuencia de entrega (app/customer-success/pertenencia.ts).
      const cerrados = todos.filter((c) => salioDeLaEntrega(c.estado));
      const abiertos = incluirCerrados ? todos : todos.filter((c) => !salioDeLaEntrega(c.estado));
      const mostrados = filtro ? abiertos.filter((c) => claveNivel(c.senal.nivel) === filtro) : abiertos;
      // ⚠️ LOS TRES SE CUENTAN POR SEPARADO Y «sin-datos» NO SE SUMA A «bien». Es
      // toda la diferencia entre «tengo 9 clientes al día» y «tengo 4 al día y de 5
      // no sé nada», y la segunda es la que manda a hacer algo.
      const porNivel = (xs: ClienteCartera[]) => ({
        atencion: xs.filter((c) => c.senal.nivel === 'atencion').length,
        'sin-datos': xs.filter((c) => c.senal.nivel === null).length,
        bien: xs.filter((c) => c.senal.nivel === 'bien').length,
      });
      return json({
        total_clientes_ganados: todos.length,
        mostrados: mostrados.length,
        quedaron_afuera: {
          cerrados_graduados_o_baja: incluirCerrados ? 0 : cerrados.length,
          por_filtro_de_atencion: abiertos.length - mostrados.length,
        },
        por_nivel: porNivel(abiertos),
        tablero_leido: tableroLeido,
        notas: NOTAS_CARTERA,
        clientes: mostrados.map(filaCartera),
      });
    },
  },

  ver_cliente_cs: {
    leer: async (input, ctx) => {
      const leadId = num(input, 'leadId');
      const { clientes, tableroLeido } = await carteraConTrabajo(ctx.ws);
      const c = clientes.find((x) => x.leadId === leadId);
      if (!c) return fallo(NO_ES_CLIENTE(leadId));
      const guardado = await estadoGuardadoDe(c.leadId);
      return json({
        ...filaCartera(c),
        tablero_leido: tableroLeido,
        contacto: { email: c.email, telefono: c.telefono },
        motivo_del_estado: guardado.motivo, estado_desde: guardado.estado_at,
        contrato: {
          que_es: c.promesa.queEs, resultado_prometido: c.promesa.resultado, garantia: c.promesa.garantia,
          sesiones_pactadas: c.promesa.sesiones,
          semanas_totales: c.reloj.semanasTotales, fuente_de_la_duracion: c.reloj.fuente,
          arranque: c.reloj.arranque, fuente_del_arranque: c.reloj.fuenteArranque,
          semana_actual: c.reloj.semana, plazo_vencido: c.reloj.terminado,
        },
        notas: [
          ...NOTAS_CARTERA,
          'La garantía puede cambiar qué significa que se pasó del plazo (por ejemplo, sesiones sin costo hasta terminar la instalación): no concluyas que terminó por el reloj.',
          'La historia de la venta vive en el CRM, no aquí.',
        ],
      });
    },
  },

  /**
   * El avance del curso (mig 0202). LECTURA PURA: nunca `linkDeAcceso`, que CREA la fila del
   * acceso del cliente —una lectura de MaKo no puede abrirle una puerta a nadie—, ni nada que
   * mande. El acceso se lee con `accesoDe`, que no crea. Lo fija tests/api-mako-cs.test.ts
   * sobre el código sin comentarios.
   *
   * ⚠️ LA ENTREGA SE LEE ESTRICTA (`universoDeLaEntrega`): con `cliente_entrega` caída, la
   * versión de la pantalla pone a todos en la primera etapa, y MaKo contestaría «va por
   * Bienvenida» sobre alguien que va por el hito tres. Mejor un error que un dato inventado.
   * El acceso es lo único que puede faltar sin tumbar la respuesta: vuelve `null` y la nota
   * lo dice (es lo mismo que hace la tab Curso).
   */
  ver_avance_curso_cs: {
    leer: async (input) => {
      const leadId = num(input, 'leadId');
      const u = await universoDeLaEntrega();
      const nombres = new Map(u.ganados.map((g) => [g.id, g.nombre]));
      if (leadId != null && !nombres.has(leadId)) return fallo(NO_ES_CLIENTE(leadId));

      // Los servicios con curso cargado. `clasesDelProducto` TIRA si no puede leer: una lista
      // vacía sobre una consulta caída diría «su servicio no tiene curso».
      const cursos = (await Promise.all(u.servicios.map(async (s) => ({ s, clases: await clasesDelProducto(s.productoId) }))))
        .filter((x) => x.clases.length > 0);
      const deCliente = (id: number) => cursos.filter(({ s }) => esDelProducto(id, s.productoId, u.casa, u.filas[s.productoId] ?? {}));
      const avance = (id: number, x: (typeof cursos)[number], prog: ReadonlyMap<number, Pick<Progreso, 'estado' | 'pct'>> | undefined) =>
        avanceDeCurso({
          etapas: x.s.etapas, clases: x.clases,
          etapaGuardada: u.filas[x.s.productoId]?.[id]?.etapa ?? null,
          estadoDe: (claseId) => prog?.get(claseId)?.estado,
          pctDe: (claseId) => prog?.get(claseId)?.pct,
        });

      if (leadId != null) {
        const [progreso, acceso] = await Promise.all([
          progresoDelCliente(leadId),
          accesoDe(leadId).then((a) => ({ ok: true as const, a }), () => ({ ok: false as const })),
        ]);
        const suyos = deCliente(leadId);
        return json({
          leadId, nombre: nombres.get(leadId) || 'Sin nombre',
          cursos: suyos.map((x) => ({ producto_id: x.s.productoId, producto: x.s.nombre, ...avance(leadId, x, progreso) })),
          ...(suyos.length ? {} : { sin_curso: 'Ninguno de los servicios de este cliente tiene un curso cargado.' }),
          acceso: acceso.ok ? accesoParaMako(acceso.a) : null,
          notas: NOTAS_CURSO,
        });
      }

      const ids = u.ganados.map((g) => g.id);
      const [progresos, accesos] = await Promise.all([
        progresoDeClientes(ids),
        accesosDeClientes(ids).catch(() => null),
      ]);
      const filas = cursos.flatMap((x) => ids
        .filter((id) => esDelProducto(id, x.s.productoId, u.casa, u.filas[x.s.productoId] ?? {}))
        .map((id) => {
          const a = avance(id, x, progresos.get(id));
          const acc = accesos ? (accesos.get(id) ?? { estado: 'sin-link' as const, ingresos: 0, ultimoIngresoAt: null }) : null;
          return {
            leadId: id, nombre: nombres.get(id) || 'Sin nombre', producto: x.s.nombre,
            etapa: a.etapa_actual?.nombre ?? null, etapa_huerfana: a.etapa_huerfana,
            etapa_completa: a.etapa_completa,
            tareas_enviadas: a.tareas_de_la_etapa?.enviadas ?? null, tareas: a.tareas_de_la_etapa?.total ?? null,
            pendientes_total: a.pendientes_total,
            pct_visto: a.videos_de_la_etapa?.pct_visto ?? null, videos_sin_medir: a.videos_de_la_etapa?.sin_medir ?? 0,
            acceso: acc ? { estado: acc.estado, ingresos: acc.ingresos, ultimo_ingreso: acc.ultimoIngresoAt } : null,
          };
        }));
      return json({
        clientes_ganados: ids.length,
        cursos: cursos.map((x) => ({ producto_id: x.s.productoId, producto: x.s.nombre, clases: x.clases.length })),
        ...(cursos.length ? {} : { sin_curso: 'Ningún servicio de este negocio tiene un curso cargado todavía.' }),
        accesos_leidos: accesos != null,
        notas: [...NOTAS_CURSO, 'Para el detalle de un cliente (sus pendientes con nombre, todas las etapas), pide de nuevo con su leadId.'],
        filas,
      });
    },
  },

  // ── Acciones por chat ─────────────────────────────────────────────────────
  marcar_estado_cliente_cs: {
    preparar: async (input): Promise<Preparado> => {
      const leadId = num(input, 'leadId');
      const cliente = await clienteDelWorkspace(leadId);
      if (!cliente) return { error: NO_ES_CLIENTE(leadId) };
      const estado = str(input, 'estado') as EstadoCliente;
      const motivo = str(input, 'motivo');
      const actual = await estadoGuardadoDe(cliente.id);
      if (actual.estado === estado && !motivo) return { error: `${cliente.nombre} ya está en «${estado}».` };
      if (estado === 'baja' && !motivo) return { error: `Antes de dar de baja a ${cliente.nombre}, pide el motivo: es lo único que después sirve para no repetirla.`, faltan: ['motivo'] };
      const efecto = estado === 'graduado' || estado === 'baja' ? ' Sale de la vista principal de la cartera.' : '';
      return {
        payload: { leadId: cliente.id, estado, motivo: motivo || null },
        resumen: `Pasar a ${cliente.nombre} de «${actual.estado}» a «${estado}» en la entrega${motivo ? ` (motivo: ${motivo})` : actual.motivo ? ' (se conserva el motivo anterior)' : ''}.${efecto}`,
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const leadId = typeof payload.leadId === 'number' ? payload.leadId : null;
      const cliente = await clienteDelWorkspace(leadId);
      if (!cliente) return { ok: false, resumen: NO_ES_CLIENTE(leadId) };
      const estado = String(payload.estado) as EstadoCliente;
      const motivo = typeof payload.motivo === 'string' && payload.motivo.trim() ? payload.motivo.trim() : null;
      const err = await marcarEstadoCliente(cliente.id, estado, motivo);
      if (err) return { ok: false, resumen: `No se pudo guardar el estado de ${cliente.nombre}: ${err}` };
      return { ok: true, resumen: `${cliente.nombre} quedó en «${estado}».`, datos: { leadId: cliente.id, estado } };
    },
  },
};
