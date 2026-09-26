// =============================================================================
// api-mako/areas/cs.run — los cuerpos del área `cs`
// =============================================================================
// Un runner por id de cs.def.ts. Lecturas: { leer }. Acciones: { preparar, ejecutar }.
// Todo corre adentro de runWithWorkspace(ctx.ws): las libs que scopean con
// getTenantDb scopean solas. Nunca se escribe desde leer() ni desde preparar().
//
// ⚠️ QUEDARON TRES DE DIECISIETE (26/09/2026). Las otras catorce eran el programa
// de 44 clases de un cliente —el temario, su cuestionario, su curso en Whop, los
// casos de otros clientes suyos y el banco de material— y se fueron con
// `app/customer-success/programa/`. El porqué del gating está en cs.def.ts.
//
// ⚠️ LO QUE LA CARTERA NO SABE, Y EL MODELO TIENE QUE LEER:
//   · `senal.nivel` puede ser **null**, y null es «no se puede saber» — no «está
//     bien». Sale así cuando falta el contrato, cuando el cliente recién cerró o
//     cuando una lectura falló. Se cuenta en su propio casillero (`sin-datos`) y
//     nunca se suma a `bien`.
//   · «sesiones» cuenta TODAS las llamadas analizadas del lead, incluida la de venta.
//   · Sin contrato legible el reloj viene null: se dice «sin dato», nunca se estima.
//   · `tareas_abiertas` / `tareas_atrasadas` vienen en null cuando la cartera se lee
//     por acá: el cruce con el tablero lo enchufa la PÁGINA (conTrabajo, lib/cs-senal.ts),
//     porque necesita la lista de clientes que cartera() acaba de traer. DEUDA
//     anotada: por la API, la señal nunca dispara «tareas atrasadas».
//   · Cada lectura de la cartera (cobros, contacto) trae su propio flag `*_leidos`.
//     Un 0 con el flag en false es «no pude leer», no «no hay».
// =============================================================================

import 'server-only';
import type { Ejecutado, Preparado, Runners } from '../tipos';
import { cartera, type ClienteCartera, type EstadoCliente } from '@/lib/cs-cartera';
import { claveNivel, type ClaveNivel } from '@/lib/cs-senal';
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
  'tareas_abiertas y tareas_atrasadas null = el tablero no se pudo leer o el cliente no cruzó con ningún proyecto. No es cero.',
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

// ── los runners ──────────────────────────────────────────────────────────────

export const RUNNERS: Runners = {
  // ── Lecturas ───────────────────────────────────────────────────────────────
  ver_cartera_cs: {
    leer: async (input) => {
      const todos = await cartera();
      const filtro = str(input, 'atencion') as ClaveNivel | '';
      const incluirCerrados = input.incluirCerrados === true;
      const cerrados = todos.filter((c) => c.estado === 'graduado' || c.estado === 'baja');
      const abiertos = incluirCerrados ? todos : todos.filter((c) => !(c.estado === 'graduado' || c.estado === 'baja'));
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
        notas: NOTAS_CARTERA,
        clientes: mostrados.map(filaCartera),
      });
    },
  },

  ver_cliente_cs: {
    leer: async (input) => {
      const leadId = num(input, 'leadId');
      const c = (await cartera()).find((x) => x.leadId === leadId);
      if (!c) return fallo(NO_ES_CLIENTE(leadId));
      const guardado = await estadoGuardadoDe(c.leadId);
      return json({
        ...filaCartera(c),
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
