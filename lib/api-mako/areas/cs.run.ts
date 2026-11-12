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
import type { Ctx, Ejecutado, Preparado, Runners } from '../tipos';
import { cartera, type ClienteCartera, type EstadoCliente } from '@/lib/cs-cartera';
import { darDeBajaClienteDeAgencia } from '@/lib/agencia-baja';
import { planCuentaDe, type PlanCuenta } from '@/lib/agencia-cobro-reglas';
import { claveNivel, conTrabajo, type ClaveNivel } from '@/lib/cs-senal';
import { getWorkspace, getTenantDb, wsSuperAdmin } from '@/lib/workspace';
import { tableroDeCapa } from '@/lib/tablero-de-capa';
import { clientesGanados } from '@/lib/clientes-ganados';
import { tableroDeLaCartera } from '@/app/customer-success/trabajo';
import { universoDeLaEntrega } from '@/app/customer-success/entrega';
import { esDelProducto, salioDeLaEntrega } from '@/app/customer-success/pertenencia';
import { clasesDelProducto, progresoDelCliente, progresoDeClientes, accesoDe } from '@/lib/curso-datos';
import { accesosDeClientes } from '@/lib/curso-admin';
import { avanceDeCurso, accesoParaMako, NOTAS_CURSO } from '@/lib/curso-resumen';
import { filasDeModulos } from '@/lib/curso-modulos-datos';
import { derivarModulos, type FilaModulo } from '@/lib/curso-modulos';
import type { Progreso } from '@/lib/curso';
import { clienteDelWorkspace, estadoGuardadoDe, marcarEstadoCliente } from './cs.helpers';
import { carteraDeAgencia, esAgencia, puedeEntrarAhora } from '@/lib/agencia';
import { aplicarPlantillaACliente, aplicarPlantillaModelo } from '@/lib/plantillas-modelo';
import { PLANTILLAS_MODELO, esModeloCliente } from '@/lib/plantillas-modelo-reglas';
import { abrirCuentaDePartner, cuentasDePartner, leadParaPartners } from '@/lib/partners';
import { estadoAgency, sumarseComoAgency } from '@/lib/agency';
import { quienPagaDe, ROTULO_QUIEN_PAGA, TEXTO_NO_AGENCY } from '@/lib/agency-reglas';
import { ESTADOS_CARTERA, type EstadoCartera } from '@/lib/agencia-cartera';
import { cobrosDeClientesDeAgencia } from '@/lib/agencia-cobro';
import { mensualidadDeAgencia, mensualidadParaMako } from '@/lib/agencia-mes';
import { negociosDelPedido, type FilaCarteraLeida, type NegocioLeido } from '@/lib/buscar-negocio-reglas';
import { getSupabaseServer } from '@/lib/supabase';
import { productosDelAlumno } from '@/lib/curso-datos';
import { invitarAlCurso, TEXTO_NO_INVITA } from '@/lib/curso-invitar';
import { invitadoAlProducto, entroAlProducto, correoQueFallo } from '@/lib/curso-invitar-reglas';
import { emailNormalizado, emailUtilizable } from '@/lib/agencia-altas';
import { listProductos } from '@/lib/productos';
import { productosDelCliente } from '@/app/customer-success/entrega';
import { POR_MAKO, moverClienteDeEtapa } from '@/lib/cs-mover-etapa';
import { quitarClienteDeProducto, volverClienteAProducto } from '@/lib/cs-quitar-producto';
import { entregaDeProductoEstricta } from '@/lib/entrega-servicio';
import { etapaDe, etapaInicial, type EtapaEntrega } from '@/lib/servicio-etapas';
import { getTarjetaClientes, setTarjetaClientes } from '@/lib/perfil';
import {
  CAMPOS_TARJETA_CLIENTE, CAMPOS_TARJETA_CLIENTE_DEFAULT, DETALLE_FORMA_TARJETA_CLIENTE, FORMAS_TARJETA_CLIENTE, NOMBRE_CAMPO_TARJETA_CLIENTE,
  NOMBRE_FORMA_TARJETA_CLIENTE, PLANTILLAS_TARJETA_CLIENTE, camposTarjetaClienteDe, type CampoTarjetaCliente, type FormaTarjetaCliente,
} from '@/lib/tarjeta-clientes';
import { idPlantillaNueva, pedidoDeTarjeta, plantillaPuesta } from '@/lib/plantillas-tarjeta';

// ── utilidades ───────────────────────────────────────────────────────────────

type In = Record<string, unknown>;

const json = (o: unknown): string => JSON.stringify(o);
const fallo = (content: string) => ({ content, isError: true });
const num = (i: In, k: string): number | null => (typeof i[k] === 'number' && Number.isFinite(i[k]) ? (i[k] as number) : null);
const str = (i: In, k: string): string => (typeof i[k] === 'string' ? (i[k] as string).trim() : '');

const NO_ES_CLIENTE = (id: number | null) => `El lead #${id ?? '?'} no es un cliente ganado de este negocio. Los clientes salen de ver_cartera_cs.`;

// ── Lo de `invitar_cliente_curso_cs` (#874, traído de wip/api-acciones-1410) ──────────────────────
/** Una lista de textos: sin vacíos ni repetidos. */
const textos = (i: In, k: string): string[] =>
  Array.isArray(i[k]) ? [...new Set((i[k] as unknown[]).filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean))] : [];
const msgDe = (e: unknown) => (e instanceof Error && e.message ? e.message : String(e));
/** Quién firma el historial: quien confirma (la sesión, o «API · token»), o MaKo. */
const autorDe = (ctx: Ctx): string => ctx.actor?.trim() || POR_MAKO;
/** preparar() no lanza: «no pude leer» se dice como lo que es, y no se escribe nada. */
const revisando = (fn: (input: In, ctx: Ctx) => Promise<Preparado>) =>
  async (input: In, ctx: Ctx): Promise<Preparado> => {
    try { return await fn(input, ctx); } catch (e) { return { error: `No pude revisarlo (${msgDe(e)}). Reintenta en un momento.`, falla: true }; }
  };
/** ejecutar() no lanza (tipos.ts): si algo falla, ok:false con el motivo. */
const sinLanzar = (que: string, fn: (payload: In, ctx: Ctx) => Promise<Ejecutado>) =>
  async (payload: In, ctx: Ctx): Promise<Ejecutado> => {
    try { return await fn(payload, ctx); } catch (e) {
      console.error(`[api-mako cs] ${que}:`, msgDe(e));
      return { ok: false, resumen: `No se pudo ${que} (${msgDe(e)}).` };
    }
  };
/** ¿Es un servicio del que es CLIENTE? La regla del kanban (`productosDelCliente`). */
async function esServicioSuyo(leadId: number, productoId: number): Promise<boolean> {
  return (await productosDelCliente(leadId)).productos.includes(productoId);
}
/** De esos productos, los que tienen al menos una clase, con su nombre (los que nombra el mail de la invitación). */
async function cursosDe(ids: readonly number[]): Promise<Array<{ productoId: number; nombre: string }>> {
  if (!ids.length) return [];
  const [catalogo, clases] = await Promise.all([
    listProductos(false),
    Promise.all(ids.map(async (id) => [id, await clasesDelProducto(id)] as const)),
  ]);
  const nombre = new Map(catalogo.map((p) => [Number(p.id), p.nombre]));
  return clases.filter(([, cs]) => cs.length > 0).map(([id]) => ({ productoId: id, nombre: nombre.get(id) ?? 'Producto' }));
}

/**
 * Quién paga, dicho para el resumen que confirma una persona. Si paga el cliente, los DOS caminos (25/10/2026): sin link
 * del primer mes (MaKo sin Mercado Pago, sin precio en pesos, la pasarela caída) su acceso no sale y la cuenta espera la
 * firma de MaKo (lib/partners.ts). Prometía «le llega su acceso ya».
 */
const textoQuienPaga = (paga: 'agencia' | 'cliente'): string =>
  paga === 'cliente'
    ? `${ROTULO_QUIEN_PAGA.cliente}: si MaKo ya puede cobrarle, le llega su acceso y, al terminar su onboarding, le aparece el pago; si no, su cuenta espera a que MaKo la habilite.`
    : `${ROTULO_QUIEN_PAGA.agencia}: queda esperando el pago de su primer mes, con tu tarjeta.`;

/**
 * Abrir la cuenta y contarlo. ⚠️ El link de pago lo escribe el CÓDIGO, nunca el modelo (AGENTS.md: un dato exacto que
 * pasa por un LLM deja de serlo); y sólo si paga la agencia: si paga el cliente, lo ve él en su cartel.
 */
async function abrirYContar(ctx: Ctx, p: { nombre: string; email: string; leadId: number | null; paga: 'agencia' | 'cliente'; plan?: PlanCuenta }): Promise<Ejecutado> {
  const pagador = ctx.actor && ctx.actor.includes('@') ? ctx.actor : null;
  const r = await abrirCuentaDePartner({ agenciaWs: ctx.ws, nombre: p.nombre, email: p.email, leadId: p.leadId, pagador, paga: p.paga, plan: p.plan ?? 'esencial' });
  if (!r.ok) return { ok: false, resumen: r.error };
  if (r.link && r.paga === 'agencia') ctx.aPersona?.(`Link de su primer mes: ${r.link}`);
  // ⚠️ «PAGA TU CLIENTE» SIN LINK DEL PRIMER MES (25/10/2026): su acceso NO salió (lib/partners.ts) y la cuenta espera la
  // firma de MaKo, como si pagara la agencia. Decía «su acceso no salió: reenvíaselo desde Agency Dashboard»: falso, e
  // imposible con la cuenta pendiente (no hay «Reenviar el acceso» y /api/agencia/reinvitar lo rechaza). Con link y el
  // mail caído, tampoco: el aviso es a mano, como en la computadora (`avisoInvitacion`).
  const resumen = r.paga === 'cliente' && r.link
    ? (r.acceso?.enviado ? 'Quedó su cuenta abierta y le llegó su acceso. Al terminar su onboarding le aparece el pago.' : 'Quedó su cuenta abierta, pero el mail de su acceso no salió: avísale tú que entre a MaKo con Google desde ese email. Al terminar su onboarding le aparece el pago.')
    : (r.link ? 'Quedó su cuenta abierta. El link de su primer mes también está en Agency Dashboard.' : 'Quedó su cuenta abierta, esperando que MaKo la habilite: ahí le llega su acceso.');
  return { ok: true, resumen, datos: { clienteWs: r.clienteWs, paga: r.paga } };
}

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
  // #866 y #867 (17/10/2026): lo que una agencia tiene que pagar por sus clientes. Los links no pasan por el modelo: la
  // persona los tiene en su tarjeta de Customer Success. Fuera de una agencia, lo dice.
  ver_pagos_clientes_agencia: {
    leer: async (_input, ctx) => {
      if (!(await esAgencia(ctx.ws))) return fallo('Este negocio no es una agencia: no paga clientes en MaKo.');
      const [cobros, cartera] = await Promise.all([cobrosDeClientesDeAgencia(ctx.ws), carteraDeAgencia(ctx.ws)]);
      const nombres = new Map<number, string>();
      for (const w of await Promise.all(Object.keys(cobros).map((k) => getWorkspace(Number(k)).catch(() => null)))) if (w) nombres.set(Number(w.id), w.nombre);
      const estado = new Map(cartera.map((f) => [Number(f.cliente_ws), f.estado]));
      return json({
        clientes: Object.entries(cobros).map(([k, c]) => ({
          cliente_ws: Number(k), nombre: nombres.get(Number(k)) ?? null, cuenta: estado.get(Number(k)) ?? null,
          primer_mes_sin_pagar: !!c.pagar,
          renovacion: c.renovacion ? { desde: c.renovacion.desde, activada: c.renovacion.activada } : null,
        })),
        nota: 'Los links están en MaKo Partners, en la cuenta de cada cliente: «Pagar su mes» o «Activar renovación».',
      });
    },
  },

  // ── MaKo Partners (17/10/2026): las cuentas de MaKo de los clientes de una agencia (lib/partners.ts) ──────────
  ver_clientes_partners: {
    leer: async (_input, ctx) => {
      const r = await cuentasDePartner(ctx.ws);
      if (!r.ok) return fallo(r.error);
      return json({
        clientes: r.cuentas.map((c) => ({
          cliente_ws: c.ws, nombre: c.nombre, cuenta: c.estado, desde: c.desde, plan: c.plan,
          // Cuántas personas entran, nunca quiénes: los emails de otro negocio no viajan al modelo.
          personas: c.equipo ? c.equipo.length : null,
          paga: c.paga,
          primer_mes_sin_pagar: !!c.cobro?.pagar,
          renovacion: c.cobro?.renovacion ? { desde: c.cobro.renovacion.desde, activada: c.cobro.renovacion.activada } : null,
          lead_crm: c.lead ? { id: c.lead.id, nombre: c.lead.nombre } : null,
        })),
        precio_usd_por_cliente: r.precio.usd,
        nota: 'personas null = la cuenta todavía no está activa (o no se pudo leer). paga: agencia (la agencia paga con su tarjeta) o cliente (el cliente paga al terminar su onboarding). Los links de pago están en Agency Dashboard.',
      });
    },
  },

  llevar_a_partners: {
    preparar: revisando(async (input, ctx) => {
      if (!(await esAgencia(ctx.ws))) return { error: 'Este negocio no es Agency: se suma desde Agency Dashboard (con el plan MaKo Pro).' };
      const leadId = num(input, 'leadId');
      const lead = leadId != null ? await leadParaPartners(leadId) : null;
      if (!lead) return { error: `El lead #${leadId ?? '?'} no es de este CRM.` };
      if (lead.clienteWs) return { error: `${lead.nombre || 'Ese lead'} ya tiene su cuenta en Agency Dashboard.`, yaEstaba: true };
      const pedido = str(input, 'email');
      const correo = emailNormalizado(pedido || lead.email || '');
      if (pedido && !emailUtilizable(correo)) return { error: 'Ese email no sirve.' };
      if (!emailUtilizable(correo)) return { error: `${lead.nombre || 'El lead'} no tiene email en el CRM. Pásalo en email: es por donde le llega el acceso.`, faltan: ['email'] };
      const paga = quienPagaDe(str(input, 'paga'));
      return {
        payload: { leadId: lead.id, email: correo, paga },
        resumen: `Abrirle a ${lead.nombre || `el lead #${lead.id}`} su cuenta de MaKo (${correo}) como cliente de tu agencia. ${textoQuienPaga(paga)}`,
      };
    }),
    ejecutar: sinLanzar('abrir la cuenta', async (payload, ctx) => {
      const leadId = typeof payload.leadId === 'number' ? payload.leadId : null;
      return abrirYContar(ctx, { nombre: '', email: String(payload.email ?? ''), leadId, paga: quienPagaDe(payload.paga) });
    }),
  },

  // ── Agency Dashboard (25/10/2026): lib/agency.ts ─────────────────────────────────────────────────────────────────
  ver_agency: {
    leer: async (_input, ctx) => {
      const e = await estadoAgency(ctx.ws);
      const cuentas: Record<EstadoCartera, number> = { pendiente: 0, aprobado: 0, revocado: 0 };
      if (e.esAgency) {
        for (const f of await carteraDeAgencia(ctx.ws)) {
          const est = (ESTADOS_CARTERA as readonly string[]).includes(f.estado) ? (f.estado as EstadoCartera) : 'pendiente';
          cuentas[est] += 1;
        }
      }
      return json({
        es_agency: e.esAgency,
        se_sumo: e.sumada === null ? null : !!e.sumada,
        puede_sumarse: e.puede.ok,
        por_que_no: e.puede.ok ? null : TEXTO_NO_AGENCY[e.puede.motivo],
        perfil: e.perfil ? { clientes: e.perfil.clientes, rubro: e.perfil.rubro || null, paga_hoy: e.perfil.pagaHoy } : null,
        cuentas: e.esAgency ? cuentas : null,
        nota: 'se_sumo null = no se pudo leer. cuentas: pendiente (espera su pago o que MaKo la habilite), aprobado (activa), revocado.',
      });
    },
  },

  sumarse_como_agency: {
    preparar: revisando(async (input, ctx) => {
      const e = await estadoAgency(ctx.ws);
      if (e.esAgency) return { error: 'Este negocio ya es Agency: sus clientes están en Agency Dashboard.', yaEstaba: true };
      if (!e.puede.ok) return { error: TEXTO_NO_AGENCY[e.puede.motivo] };
      const perfil = { clientes: str(input, 'clientes') || null, rubro: str(input, 'rubro'), pagaHoy: str(input, 'pagaHoy') || null };
      return {
        payload: perfil,
        resumen: 'Sumar este negocio como Agency: vas a abrir las cuentas de MaKo de tus clientes y administrarlas desde Agency Dashboard.',
      };
    }),
    ejecutar: sinLanzar('sumarte como Agency', async (payload, ctx) => {
      const quien = ctx.actor && ctx.actor.includes('@') ? ctx.actor : null;
      const r = await sumarseComoAgency({ ws: ctx.ws, quien, perfil: payload });
      if (!r.ok) return { ok: false, resumen: r.error };
      return { ok: true, resumen: r.yaEstaba ? 'Ya eras Agency.' : 'Listo: ya eres Agency. Tus clientes viven en Agency Dashboard.' };
    }),
  },

  abrir_cuenta_cliente_agency: {
    preparar: revisando(async (input, ctx) => {
      if (!(await esAgencia(ctx.ws))) return { error: 'Este negocio no es Agency: se suma desde Agency Dashboard (con el plan MaKo Pro).' };
      const nombre = str(input, 'nombre').slice(0, 120);
      if (!nombre) return { error: 'Falta su nombre.', faltan: ['nombre'] };
      const correo = emailNormalizado(str(input, 'email'));
      if (!emailUtilizable(correo)) return { error: 'Hace falta un email que sirva: es por donde le llega el acceso.', faltan: ['email'] };
      const paga = quienPagaDe(str(input, 'paga'));
      const plan = planCuentaDe(str(input, 'plan'));
      return {
        payload: { nombre, email: correo, paga, plan },
        resumen: `Abrirle a ${nombre} su cuenta de MaKo (${correo}) como cliente de tu agencia. ${textoQuienPaga(paga)}`,
      };
    }),
    ejecutar: sinLanzar('abrir la cuenta', async (payload, ctx) =>
      abrirYContar(ctx, { nombre: String(payload.nombre ?? ''), email: String(payload.email ?? ''), leadId: null, paga: quienPagaDe(payload.paga), plan: planCuentaDe(payload.plan) })),
  },

  // Dar de baja la cuenta de un cliente (29/10/2026): ver cs.def.ts. La fila de la cartera se repregunta al ejecutar.
  dar_de_baja_cliente_agency: {
    preparar: revisando(async (input, ctx) => {
      if (!(await esAgencia(ctx.ws))) return { error: 'Este negocio no es Agency: se suma desde Agency Dashboard.' };
      const clienteWs = num(input, 'clienteWs');
      if (clienteWs == null) return { error: 'Falta el número de cuenta del cliente.', faltan: ['clienteWs'] };
      return {
        payload: { clienteWs },
        resumen: `Dar de baja la cuenta del cliente ${clienteWs}: se cancela su cobro, dejas de administrarla y le avisamos. Sus datos quedan guardados; si quiere seguir, paga él.`,
      };
    }),
    ejecutar: sinLanzar('dar de baja la cuenta', async (payload, ctx) => {
      const clienteWs = typeof payload.clienteWs === 'number' ? payload.clienteWs : NaN;
      const r = await darDeBajaClienteDeAgencia({ agenciaWs: ctx.ws, clienteWs, autor: 'MaKo (pedido de la agencia)' });
      return r.ok ? { ok: true, resumen: r.resumen } : { ok: false, resumen: r.error };
    }),
  },

  // La plantilla de un modelo de negocio (MAU-01): ver cs.def.ts. Con `clienteWs`, la agencia sobre un cliente de su
  // cartera (lo repregunta `aplicarPlantillaACliente` al ejecutar: entre la propuesta y el «sí» la cartera puede cambiar).
  aplicar_plantilla_de_modelo: {
    preparar: revisando(async (input, ctx) => {
      const modelo = str(input, 'modelo');
      if (!esModeloCliente(modelo)) return { error: 'Esa plantilla no existe: tienda-b2c, b2b-crm o manufactura.', faltan: ['modelo'] };
      const clienteWs = num(input, 'clienteWs');
      if (clienteWs != null) {
        if (!(await esAgencia(ctx.ws))) return { error: 'Este negocio no es Agency: se suma desde Agency Dashboard.' };
        if (!(await puedeEntrarAhora(ctx.ws, clienteWs))) return { error: 'Ese cliente no está en tu cartera.' };
      }
      const p = PLANTILLAS_MODELO[modelo];
      return {
        payload: { modelo, clienteWs },
        resumen: `Aplicar la plantilla ${p.nombre} ${clienteWs != null ? `a la cuenta del cliente ${clienteWs}` : 'a este negocio'}: el funnel «${p.funnel.nombre}», el objetivo del trimestre con ${p.kpis.length} KPIs y la guía para cargar sus datos en su Plan. Lo que ya tenga con el mismo nombre no se duplica.`,
      };
    }),
    ejecutar: sinLanzar('aplicar la plantilla', async (payload, ctx) => {
      const modelo = payload.modelo;
      if (!esModeloCliente(modelo)) return { ok: false, resumen: 'Esa plantilla no existe.' };
      const clienteWs = typeof payload.clienteWs === 'number' ? payload.clienteWs : null;
      const r = clienteWs != null
        ? await aplicarPlantillaACliente({ agenciaWs: ctx.ws, superAdmin: false }, clienteWs, modelo, 'ia')
        : await aplicarPlantillaModelo(modelo, 'ia');
      return r.ok ? { ok: true, resumen: r.resumen, datos: { ...r.hecho } } : { ok: false, resumen: r.error };
    }),
  },

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
      // Los módulos SUELTOS de cada curso (D1): MaKo los nombra en vez de contarlos como clases
      // «sin etapa». Si no se pueden leer, se dice como siempre (`clases_sin_etapa`): es una lectura.
      const filasMods = await filasDeModulos(cursos.map((x) => x.s.productoId)).catch(() => new Map<number, FilaModulo[]>());
      const sueltosDe = (productoId: number) => derivarModulos(cursos.find((x) => x.s.productoId === productoId)?.s.etapas ?? [], filasMods.get(productoId) ?? [])
        .filter((m) => !m.vinculado).map((m) => ({ key: m.clave, label: m.nombre }));
      const deCliente = (id: number) => cursos.filter(({ s }) => esDelProducto(id, s.productoId, u.casa, u.filas[s.productoId] ?? {}));
      const avance = (id: number, x: (typeof cursos)[number], prog: ReadonlyMap<number, Pick<Progreso, 'estado' | 'pct'>> | undefined) =>
        avanceDeCurso({
          etapas: x.s.etapas, clases: x.clases, sueltos: sueltosDe(x.s.productoId),
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

  invitar_cliente_curso_cs: {
    preparar: revisando(async (input) => {
      const leadId = num(input, 'leadId');
      const cliente = await clienteDelWorkspace(leadId);
      if (!cliente) return { error: NO_ES_CLIENTE(leadId) };
      const acc = await accesoDe(cliente.id);
      if (acc?.revocado) return { error: TEXTO_NO_INVITA.cortado };
      // A UN CURSO (09/10/2026): con `productoId` se lo invita a ése, como la ficha y la tarjeta del kanban,
      // y «ya invitado» / «ya entró» se preguntan POR ESE CURSO — las MISMAS reglas que `invitarAlCurso`
      // (lib/curso-invitar-reglas.ts). Tiene que ser un servicio del que es cliente (la regla del kanban).
      const productoId = num(input, 'productoId');
      if (productoId != null && !(await esServicioSuyo(cliente.id, productoId))) return { error: `Ese servicio no es de ${cliente.nombre}.` };
      const reenviar = input.reenviar === true;
      const yaInvitado = productoId != null ? invitadoAlProducto(acc, productoId) : !!acc?.invitacionEnviadaAt;
      const yaEntro = productoId != null ? entroAlProducto(acc, productoId) : (acc?.ingresos ?? 0) > 0;
      if (!reenviar && yaInvitado) return { error: `${TEXTO_NO_INVITA['ya-invitado']} Para mandarla otra vez, pide reenviar: true.`, yaEstaba: true };
      if (!reenviar && yaEntro) return { error: `${TEXTO_NO_INVITA['ya-entro']} Para mandarla igual, pide reenviar: true.`, yaEstaba: true };
      // Los cursos que nombra el mail: ése, o (sin producto) los que ya VE — los mismos que arma `invitarAlCurso`.
      const cursos = await cursosDe(productoId != null ? [productoId] : await productosDelAlumno(cliente.id));
      if (!cursos.length) return { error: TEXTO_NO_INVITA['sin-clases'] };
      const pedido = str(input, 'email');
      const correo = emailNormalizado(pedido || cliente.email || '');
      if (pedido && !emailUtilizable(correo)) return { error: 'Ese email no sirve.' };
      if (!emailUtilizable(correo)) return { error: `${TEXTO_NO_INVITA['sin-email']} Pásalo en email.`, faltan: ['email'] };
      const conWhatsapp = textos(input, 'canales').includes('whatsapp');
      if (conWhatsapp && !cliente.telefono) return { error: `${cliente.nombre} no tiene teléfono en el CRM: el WhatsApp no saldría. Pídelo sólo por email.` };
      return {
        payload: { leadId: cliente.id, productoId, email: correo, canales: conWhatsapp ? ['email', 'whatsapp'] : ['email'], reenviar },
        resumen: `Invitar a ${cliente.nombre} al curso (${cursos.map((c) => c.nombre).join(', ')}) por email a ${correo}${conWhatsapp ? ' y por WhatsApp' : ''}. Se le crea el acceso si no lo tenía${productoId != null ? ', y pasa a abrirle ese curso' : ''}.${pedido && !cliente.email ? ' El email queda guardado en el CRM.' : ''}`,
      };
    }),
    ejecutar: sinLanzar('invitarlo', async (p, ctx) => {
      if (!(await clienteDelWorkspace(Number(p.leadId)))) return { ok: false, resumen: NO_ES_CLIENTE(Number(p.leadId)) };
      const productoId = typeof p.productoId === 'number' ? p.productoId : null;
      // El núcleo vuelve a mirar todo (cortado, «de ese producto», el reclamo): entre la propuesta y el «sí» pudo cambiar.
      const r = await invitarAlCurso({ ws: ctx.ws, leadId: Number(p.leadId), email: String(p.email), autor: autorDe(ctx), reenviar: p.reenviar === true, canales: p.canales, productoId });
      if (r.tipo === 'error') return { ok: false, resumen: `No se pudo invitar: ${r.error}` };
      if (r.tipo === 'no') return { ok: false, resumen: TEXTO_NO_INVITA[r.motivo] };
      // ⚠️ EL ÉXITO SALE DE `enviado`, nunca de que haya un resultado. Y si no salió por CONFIGURACIÓN se
      // dice de quién (lib/curso-invitar-reglas.ts): culpar al negocio de lo nuestro es el error medido.
      if (!r.enviado) {
        const quien = correoQueFallo({ error: r.fallo, via: r.via });
        const de = quien === 'tuyo' ? ' Es la configuración del correo de tu negocio (su remitente o su key de Resend).'
          : quien === 'mako' ? ' Es el correo de MaKo, no el de tu negocio.' : '';
        return { ok: false, resumen: `No salió el correo a ${r.email}: ${r.fallo ?? 'el envío falló'}.${de}` };
      }
      const wa = r.whatsapp ? (r.whatsapp.enviado ? ' También salió por WhatsApp.' : ` El WhatsApp no salió (${r.whatsapp.motivo ?? 'sin motivo'}).`) : '';
      return {
        ok: true,
        resumen: `Invitación enviada a ${r.email}.${r.anotado ? '' : ' ⚠️ Salió, pero no quedó anotada: no la reenvíes por eso.'}${wa}`,
        datos: { leadId: Number(p.leadId), email: r.email, anotada: r.anotado, whatsapp: r.whatsapp ?? null },
      };
    }),
  },

  // ── La tarjeta de un cliente, de cada persona (21/10/2026) ──────────────────────────────────────
  // El molde es `ver_campos_tarjeta_crm` / `personalizar_tarjetas_crm` (crm.run.ts). La cuenta de QUÉ se pidió (una
  // plantilla por su nombre, o la forma y los datos, y guardarla) vive una vez en `pedidoDeTarjeta`
  // (lib/plantillas-tarjeta.ts), para Clientes y el Plan.
  ver_tarjeta_clientes: {
    leer: async () => {
      const { forma, campos, plantillas, guardable } = await getTarjetaClientes();
      const plantilla = (p: { nombre: string; forma: FormaTarjetaCliente; campos: readonly CampoTarjetaCliente[] }) =>
        ({ nombre: p.nombre, forma: p.forma, campos: [...p.campos] });
      return json({
        forma: { forma, nombre: NOMBRE_FORMA_TARJETA_CLIENTE[forma] },
        formas: FORMAS_TARJETA_CLIENTE.map((f) => ({ forma: f, nombre: NOMBRE_FORMA_TARJETA_CLIENTE[f], detalle: DETALLE_FORMA_TARJETA_CLIENTE[f] })),
        campos: campos.map((c) => ({ campo: c, nombre: NOMBRE_CAMPO_TARJETA_CLIENTE[c] })),
        plantillaPuesta: plantillaPuesta([...PLANTILLAS_TARJETA_CLIENTE, ...plantillas], forma, campos)?.nombre ?? 'Personalizada',
        plantillasDeFabrica: PLANTILLAS_TARJETA_CLIENTE.map(plantilla),
        plantillasPropias: plantillas.map(plantilla),
        catalogo: CAMPOS_TARJETA_CLIENTE.map((c) => ({ campo: c, nombre: NOMBRE_CAMPO_TARJETA_CLIENTE[c], deSiempre: CAMPOS_TARJETA_CLIENTE_DEFAULT.includes(c) })),
        guardable,
        dondeSeCambia: 'En Clientes (vista kanban), «⋯» › «Personalizar tarjetas», o clic derecho en una tarjeta › «Personalizar tarjeta».',
      });
    },
  },
  // La tarjeta es de UNA persona (usuarios.perfil): la pendiente lleva su email y sólo la confirma ella. Desde la bandeja,
  // otro del equipo le estaría cambiando la tarjeta a alguien que no la pidió (y la escritura cae en la fila de quien
  // confirma, no de quien pidió: `setTarjetaClientes` lee la sesión).
  personalizar_tarjetas_clientes: {
    faltaParaConfirmar: async (payload, ctx) => {
      const de = String(payload.email ?? '').toLowerCase();
      const quien = String(ctx.quien?.email ?? ctx.actor ?? '').toLowerCase();
      return de && quien && de !== quien ? `Esta tarjeta es la de ${payload.email}: la confirma esa persona desde su chat.` : null;
    },
    preparar: revisando(async (input, ctx) => {
      const email = ctx.quien?.email ?? ctx.actor ?? '';
      if (!email) return { error: 'La tarjeta es de cada persona y este pedido no dice de quién: se cambia desde el chat de la app o en Clientes.' };
      const actual = await getTarjetaClientes();
      if (!actual.guardable) return { error: 'Tu sesión no tiene un usuario propio: la tarjeta se cambia en Clientes, «⋯» › «Personalizar tarjetas».' };
      const r = pedidoDeTarjeta(input, actual, {
        fabrica: PLANTILLAS_TARJETA_CLIENTE, formas: FORMAS_TARJETA_CLIENTE, campos: CAMPOS_TARJETA_CLIENTE,
        limpiarCampos: camposTarjetaClienteDe, nombreCampo: NOMBRE_CAMPO_TARJETA_CLIENTE, donde: 'Clientes',
      }, idPlantillaNueva());
      if (!r.ok) return { error: r.error, ...(r.disponibles !== undefined ? { disponibles: r.disponibles } : {}), ...(r.yaEstaba ? { yaEstaba: true } : {}) };
      const datos = r.campos.length ? r.campos.map((c) => NOMBRE_CAMPO_TARJETA_CLIENTE[c]).join(', ') : 'sólo el nombre';
      return {
        payload: { email, forma: r.forma, campos: r.campos, ...(r.propias ? { plantillas: r.propias } : {}) },
        resumen: `Tu tarjeta de clientes ${r.plantilla ? `como «${r.plantilla}»` : `en forma ${NOMBRE_FORMA_TARJETA_CLIENTE[r.forma]}`} (${datos})`
          + (input.guardarComo ? `, guardada como plantilla «${String(input.guardarComo).trim()}»` : '') + '. Sólo la tuya: el resto del equipo sigue viendo la suya.',
      };
    }),
    ejecutar: sinLanzar('personalizar la tarjeta', async (payload) => {
      const r = await setTarjetaClientes(payload.campos, payload.forma, payload.plantillas);
      if (!r.guardado) return { ok: false, resumen: 'No pude guardarla: tu sesión no tiene un usuario propio. Se cambia en Clientes, «⋯» › «Personalizar tarjetas».' };
      return { ok: true, resumen: `Listo: tu tarjeta de clientes quedó en forma ${NOMBRE_FORMA_TARJETA_CLIENTE[r.forma]}. Se ve al volver a Clientes.` };
    }),
  },

  // ── La ENTREGA de un cliente (23/10/2026, P0-5): ver cs.def.ts. Las MISMAS funciones que el kanban y la ficha. ──
  mover_cliente_entrega: {
    preparar: revisando(async (input) => {
      const cliente = await clienteDelWorkspace(num(input, 'leadId'));
      if (!cliente) return { error: NO_ES_CLIENTE(num(input, 'leadId')) };
      const suyos = (await productosDelCliente(cliente.id)).productos;
      const s = await servicioPedido(num(input, 'productoId'), suyos);
      if ('error' in s) return s;
      const e = etapaPedida(s.etapas, str(input, 'etapa'));
      if ('error' in e) return e;
      const desde = await etapaGuardada(cliente.id, s.id);
      if (desde === e.key) return { error: `${cliente.nombre} ya está en «${e.label}» en la entrega de «${s.nombre}».`, yaEstaba: true };
      const entra = !suyos.includes(s.id);
      return {
        payload: { leadId: cliente.id, productoId: s.id, etapa: e.key },
        resumen: `Pasar a ${cliente.nombre} a «${e.label}» en la entrega de «${s.nombre}»${desde ? ` (hoy está en «${etapaDe(s.etapas, desde)?.label ?? desde}»)` : ''}.`
          + (entra ? ' No era de ese servicio: lo suma a esa entrega.' : '')
          + ' Si esa etapa tiene automatizaciones de entrega, arrancan y le pueden escribir.',
      };
    }),
    ejecutar: sinLanzar('moverlo en la entrega', async (p, ctx) => {
      const leadId = Number(p.leadId);
      if (!(await clienteDelWorkspace(leadId))) return { ok: false, resumen: NO_ES_CLIENTE(leadId) };
      // El choke point vuelve a validar el servicio y la etapa (pudieron cambiar entre la propuesta y el «sí»), escribe
      // el historial y enrola: no hay una segunda forma de escribir `cliente_entrega`.
      const m = await moverClienteDeEtapa({ leadId, productoId: Number(p.productoId), etapa: String(p.etapa), por: autorDe(ctx) });
      if (!m.ok) return { ok: false, resumen: `No se pudo mover: ${m.motivo ?? 'sin motivo'}` };
      if (!m.cambio) return { ok: true, resumen: `Ya estaba en «${m.rotulo}»: no se cambió nada.`, datos: { leadId, productoId: m.productoId, etapa: m.hacia } };
      return { ok: true, resumen: `Listo: quedó en «${m.rotulo}» en la entrega de «${m.producto}».`, datos: { leadId, productoId: m.productoId, desde: m.desde, etapa: m.hacia } };
    }),
  },
  quitar_cliente_de_servicio: {
    preparar: revisando(async (input) => {
      const cliente = await clienteDelWorkspace(num(input, 'leadId'));
      if (!cliente) return { error: NO_ES_CLIENTE(num(input, 'leadId')) };
      const suyos = (await productosDelCliente(cliente.id)).productos;
      const productoId = num(input, 'productoId');
      if (productoId == null) return { error: 'Falta el servicio.', faltan: ['productoId'], disponibles: await serviciosDe(suyos) };
      if (!suyos.includes(productoId)) return { error: `${cliente.nombre} no está en ese servicio.`, yaEstaba: true };
      // La MISMA regla que va a aplicar `quitarClienteDeProducto`, para fallar en preparar() y no al confirmar.
      if (suyos.length < 2) return { error: `Es el único servicio de ${cliente.nombre}: quitarlo lo dejaría sin ninguno.` };
      const nombre = (await serviciosDe([productoId]))[0]?.nombre ?? `el servicio #${productoId}`;
      return {
        payload: { leadId: cliente.id, productoId },
        resumen: `Quitar a ${cliente.nombre} de «${nombre}»: deja ese kanban y sigue en sus otros servicios. Sin aviso al cliente.`,
      };
    }),
    ejecutar: sinLanzar('quitarlo del servicio', async (p, ctx) => {
      const leadId = Number(p.leadId);
      if (!(await clienteDelWorkspace(leadId))) return { ok: false, resumen: NO_ES_CLIENTE(leadId) };
      const r = await quitarClienteDeProducto(leadId, Number(p.productoId), autorDe(ctx));
      if (!r.ok) return { ok: false, resumen: `No se pudo quitar: ${r.error}` };
      return {
        ok: true,
        resumen: `Listo: ya no está en ese servicio. Para volver, devolver_cliente_a_servicio${r.etapa ? ` con la etapa ${r.etapa}` : ''}.`,
        datos: { leadId, productoId: Number(p.productoId), etapa: r.etapa },
      };
    }),
  },
  devolver_cliente_a_servicio: {
    preparar: revisando(async (input) => {
      const cliente = await clienteDelWorkspace(num(input, 'leadId'));
      if (!cliente) return { error: NO_ES_CLIENTE(num(input, 'leadId')) };
      const suyos = (await productosDelCliente(cliente.id)).productos;
      const productoId = num(input, 'productoId');
      if (productoId != null && suyos.includes(productoId)) return { error: `${cliente.nombre} ya está en ese servicio.`, yaEstaba: true };
      const s = await servicioPedido(productoId, suyos, true);
      if ('error' in s) return s;
      const e = etapaPedida(s.etapas, str(input, 'etapa'));
      if ('error' in e) return e;
      return {
        payload: { leadId: cliente.id, productoId: s.id, etapa: str(input, 'etapa') ? e.key : null },
        resumen: `Devolver a ${cliente.nombre} a «${s.nombre}», en «${e.label}». Si esa etapa tiene automatizaciones de entrega, arrancan y le pueden escribir.`,
      };
    }),
    ejecutar: sinLanzar('devolverlo al servicio', async (p, ctx) => {
      const leadId = Number(p.leadId);
      const productoId = Number(p.productoId);
      if (!(await clienteDelWorkspace(leadId))) return { ok: false, resumen: NO_ES_CLIENTE(leadId) };
      const etapa = typeof p.etapa === 'string' && p.etapa ? p.etapa : null;
      const por = autorDe(ctx);
      // El deshacer de la ficha: saca la marca de «fuera» y, con etapa, lo repone ahí. ⚠️ Sin etapa, si el servicio no era
      // el de su embudo, sacar la marca no lo devuelve (no tenía fila que reponer): entonces entra a la primera etapa por el
      // choke point. Se mira lo que QUEDÓ, no lo que se pidió.
      const r = await volverClienteAProducto(leadId, productoId, etapa, null, por);
      if (!r.ok) return { ok: false, resumen: `No se pudo devolver: ${r.error}` };
      if (!(await productosDelCliente(leadId)).productos.includes(productoId)) {
        const m = await moverClienteDeEtapa({ leadId, productoId, etapa: null, por });
        if (!m.ok) return { ok: false, resumen: `No se pudo devolver: ${m.motivo ?? 'sin motivo'}` };
      }
      return { ok: true, resumen: 'Listo: volvió a ese servicio.', datos: { leadId, productoId } };
    }),
  },

  // La mensualidad por fuera de MaKo (lib/agencia-mes.ts): lo que la agencia paga este mes y desde cuándo cuenta cada cliente.
  ver_mensualidad_agencia: {
    leer: async (_input, ctx) => {
      if (!(await esAgencia(ctx.ws))) return fallo('Este negocio no es Agency: no tiene mensualidad de clientes.');
      const m = await mensualidadDeAgencia(ctx.ws);
      if (!m.ok) return fallo(`No pude armar la mensualidad: ${m.error}`);
      if (!m.config) return json({ prendida: false, nota: 'Tu agencia no tiene la mensualidad por fuera de MaKo: tus cuentas se pagan con su link (ver_pagos_clientes_agencia).' });
      return json(mensualidadParaMako(m));
    },
  },

  // El negocio por su nombre (lib/buscar-negocio-reglas.ts): sólo en la plataforma, y leído ESTRICTO: una cartera que no se pudo
  // leer diría «sin agencia» de un cliente que sí la tiene.
  buscar_negocio: {
    leer: async (input, ctx) => {
      if (ctx.ws !== (await wsSuperAdmin())) return fallo('Buscar negocios es sólo de la plataforma.');
      const pedido = str(input, 'nombre');
      if (!pedido) return fallo('Falta el nombre o el número del negocio.');
      const db = getSupabaseServer();
      const [w, c] = await Promise.all([
        db.from('workspaces').select('id, nombre, capa, estado').order('id', { ascending: true }),
        db.from('agencia_clientes').select('agencia_ws, cliente_ws, estado'),
      ]);
      if (w.error || c.error) return fallo(`No pude leer los negocios: ${(w.error ?? c.error)!.message}`);
      const negocios: NegocioLeido[] = ((w.data ?? []) as Array<{ id: number; nombre: string | null; capa: string | null; estado: string | null }>)
        .map((x) => ({ ws: Number(x.id), nombre: x.nombre, capa: x.capa, estado: x.estado }));
      const cartera: FilaCarteraLeida[] = ((c.data ?? []) as FilaCarteraLeida[]).map((x) => ({ agencia_ws: Number(x.agencia_ws), cliente_ws: Number(x.cliente_ws), estado: x.estado }));
      const halladas = negociosDelPedido(pedido, negocios, cartera);
      return json({
        pedido,
        negocios: halladas,
        nota: halladas.length === 0 ? 'Ningún negocio se llama así: pide el nombre de otra forma o su número.' : halladas.length > 1 ? 'Hay más de uno: pregunta cuál.' : 'Lo que paga una agencia lo trae ver_mensualidades_agencias (con agenciaWs o agencia).',
      });
    },
  },
};

/** Los servicios por id, con su nombre (los del negocio: `listProductos` scopea). */
async function serviciosDe(ids: readonly number[]): Promise<Array<{ productoId: number; nombre: string }>> {
  const catalogo = await listProductos();
  return ids.map((id) => ({ productoId: id, nombre: catalogo.find((p) => Number(p.id) === id)?.nombre ?? `Servicio #${id}` }));
}

/**
 * El servicio pedido, de ESTE negocio, con sus etapas leídas ESTRICTO: validar contra las de fábrica dejaría a un cliente
 * en una columna que el kanban no dibuja (lib/cs-mover-etapa.ts). Sin servicio, o uno que no existe, vuelve con los suyos.
 * `cualquiera` = no hace falta que sea suyo todavía (devolver).
 */
async function servicioPedido(productoId: number | null, suyos: readonly number[], cualquiera = false): Promise<{ id: number; nombre: string; etapas: readonly EtapaEntrega[] } | { error: string; faltan?: string[]; disponibles?: unknown }> {
  const catalogo = await listProductos();
  const prod = productoId == null ? null : catalogo.find((p) => Number(p.id) === productoId);
  if (!prod) {
    const lista = cualquiera ? catalogo.map((p) => ({ productoId: Number(p.id), nombre: p.nombre })) : await serviciosDe(suyos);
    return { error: productoId == null ? 'Falta el servicio.' : `El servicio #${productoId} no es de este negocio.`, ...(productoId == null ? { faltan: ['productoId'] } : {}), disponibles: lista };
  }
  const entrega = await entregaDeProductoEstricta(Number(prod.id));
  if (!entrega) return { error: `No pude leer las etapas de la entrega de «${prod.nombre}». Intenta de nuevo.` };
  return { id: Number(prod.id), nombre: prod.nombre, etapas: entrega.etapas };
}

/** La etapa por su clave o su nombre (sin mayúsculas ni tildes). Vacía = la primera. Si no existe, vuelve con las que hay. */
function etapaPedida(etapas: readonly EtapaEntrega[], pedida: string): EtapaEntrega | { error: string; disponibles: unknown } {
  const sin = (x: string) => x.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const key = pedida.trim() ? (etapas.find((e) => e.key === pedida.trim()) ?? etapas.find((e) => sin(e.label ?? '') === sin(pedida)))?.key : etapaInicial(etapas);
  const e = etapaDe(etapas, key ?? null);
  if (!e) return { error: pedida.trim() ? `Esa entrega no tiene la etapa «${pedida.trim()}».` : 'Esa entrega no tiene etapas.', disponibles: etapas.map((x) => ({ key: x.key, nombre: x.label })) };
  return e;
}

/** La etapa GUARDADA del cliente en ese servicio (su fila de `cliente_entrega`), o null si no tiene fila. Tira si no pudo leer. */
async function etapaGuardada(leadId: number, productoId: number): Promise<string | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('cliente_entrega').select('etapa').eq('lead_id', leadId).eq('producto_id', productoId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { etapa: string } | null)?.etapa ?? null;
}
