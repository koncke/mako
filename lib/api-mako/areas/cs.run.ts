// =============================================================================
// api-mako/areas/cs.run — los cuerpos del área `cs`
// =============================================================================
// Un runner por id de cs.def.ts. Lecturas: { leer }. Acciones: { preparar, ejecutar }
// y { proponer } para las que dejan un borrador en /whatsapp. Todo corre adentro de
// runWithWorkspace(ctx.ws): las libs que scopean con getTenantDb scopean solas; las
// que reciben `ws` (shares, whop) lo reciben de ctx.ws, nunca del input. Nunca se
// escribe desde leer() ni desde preparar().
//   Excepción aceptada por escrito: listarCursos/whopCuenta (lib/whop.ts) resuelven
//   la company con whopCompanyId, que con el caché frío hace registrarRuteo →
//   upsertRouting('whop', …). Es un efecto de la lib, best-effort, idempotente,
//   primer-reclamante-gana y sobre la company de la PROPIA key del workspace; el
//   webhook lo necesita igual. La alternativa sería una variante sin registro en
//   whop.ts (deuda de esa lib).
//
// ⚠️ LO QUE LA CARTERA NO SABE, Y EL MODELO TIENE QUE LEER:
//   · compromisosAbiertos está clavado en 0 en lib/cs-cartera.ts: no se calcula. Se
//     devuelve null y se dice, para que nadie afirme «sin compromisos».
//   · cs_respuestas está casi vacía (ningún cliente contestó todavía): un 0 en
//     bloques no significa «atrasado».
//   · «sesiones» cuenta TODAS las llamadas analizadas del lead, incluida la de venta.
//   · Sin contrato legible el reloj viene null: se dice «sin dato», nunca se estima.
//   · cartera() (lib/cs-cartera.ts) convierte CUALQUIER error de sesiones, cuotas,
//     respuestas, estados y links en []: un 0 ahí puede ser una lectura fallida y la
//     cancha se recalcula sobre esos ceros. DEUDA: que cartera() propague el error
//     (toca la lib y la pantalla). Mientras tanto se dice en las notas.
// =============================================================================

import 'server-only';
import type { Ejecutado, Preparado, Runners } from '../tipos';
import { APP_BASE_URL } from '@/lib/app-url';
import { OWNER_WS } from '@/lib/workspace';
import { cartera, type Cancha, type ClienteCartera, type EstadoCliente } from '@/lib/cs-cartera';
import { avanceDeCliente } from '@/lib/cs-respuestas';
import { vistaDeTarea } from '@/lib/cs-tarea-vista';
import { reconstruirMapa } from '@/lib/cs-avance';
import { borradorHayQueAprobar, borradorVioYNoContesto, primerNombre } from '@/lib/cs-mensajes';
import { sincronizarPrograma } from '@/lib/cs-sync-whop';
import { whopConfigurado, whopCuenta, listarCursos, listarAlumnos, listarInteracciones } from '@/lib/whop';
import { revocarShare } from '@/lib/shares';
import {
  PROGRAMA, GRABACIONES, TOTAL_CLASES, TOTAL_MODULOS, TOTAL_GRABACIONES, CLASES_QUE_DESTRABAN, claseDe, rotuloDe,
} from '@/lib/programa-catalogo';
import { camposDe, TOTAL_CAMPOS } from '@/lib/programa-campos';
import { casosDe, casosDeCliente, bloquesConHistorico } from '@/lib/cs-historico';
import {
  COBERTURA, DEFECTOS, DIVERGENCIA, INVENTARIO, MODULOS_DOC, MODULOS_EN_CERO, TAREAS, coberturaDe, moduloDoc,
} from '@/lib/banco-skills';
import {
  clienteDelWorkspace, linksVivosDe, estadoGuardadoDe, marcarEstadoCliente, ganadosPorEmail,
  bloqueDe, bloquesDe, mapaLeccionesEstricto, borradoresMakoDelLead,
} from './cs.helpers';
import { chatEmpresaPorUltimos10 } from './whatsapp.helpers';

// ── utilidades ───────────────────────────────────────────────────────────────

type In = Record<string, unknown>;

const json = (o: unknown): string => JSON.stringify(o);
const fallo = (content: string) => ({ content, isError: true });
const num = (i: In, k: string): number | null => (typeof i[k] === 'number' && Number.isFinite(i[k]) ? (i[k] as number) : null);
const str = (i: In, k: string): string => (typeof i[k] === 'string' ? (i[k] as string).trim() : '');
const lista = (i: In, k: string): string[] => (Array.isArray(i[k]) ? (i[k] as unknown[]).map((x) => String(x).trim()).filter(Boolean) : []);
const corto = (s: string | null | undefined, n: number): string | null => (s == null ? null : s.length > n ? `${s.slice(0, n)}… [recortado: ${s.length} caracteres en total]` : s);
const digitos = (s: string | null | undefined): string => (s ?? '').replace(/\D/g, '');
const norm = (s: string | null | undefined): string => (s ?? '').trim().toLowerCase();
const DESTRABAN: ReadonlySet<string> = new Set(CLASES_QUE_DESTRABAN);

/** Por HTTP NO salen `atoro`, `puntos` ni `graba`: nombran clientes reales de Mauricio
 *  con detalles de su negocio (TEXX, HMO, Baja Teriyaki, Patricia…, en
 *  lib/programa-catalogo.ts). Mismo criterio que dejó ver_casos_historicos sin HTTP.
 *  Que ese material termine en los videos no lo vuelve público hoy: el video no está
 *  grabado y lo que se diga en él lo decide Mauricio al grabar. */
const SIN_CASOS_HTTP = 'Por la API no vienen el atoro, los puntos a grabar ni de qué va el video: nombran clientes reales. Se ven desde WhatsApp o la app.';

const NO_ES_CLIENTE = (id: number | null) => `El lead #${id ?? '?'} no es un cliente ganado de este negocio. Los clientes del programa salen de ver_cartera_cs.`;
const NO_WHOP = 'Whop no está conectado en este negocio (falta la API key). Se conecta en Integraciones.';
const CURSO_PROGRAMA = 'Sistema Negocio que Escala™';

/** El mapa lección→clase, o null si no se pudo leer (no es lo mismo que vacío). Lee con
 *  getSettingEstricto: getMapaLecciones de la lib convierte un 5xx en {} y el null
 *  nunca llegaba. */
const mapaOnull = async (): Promise<Record<string, string> | null> => mapaLeccionesEstricto().catch(() => null);

/** Freno local de reconstruir_mapa_lecciones_whop: dos «sí» seguidos no duplican la
 *  tanda de ~14 consultas a Whop. Memoria del proceso, como el de lib/cs-avance.ts
 *  (reconstruirConFreno no está exportado: deuda). */
const ultimaReconstruccion = new Map<number, number>();
const ESPERA_RECONSTRUIR_MS = 10 * 60 * 1000;

const NOTAS_CARTERA = [
  'compromisos_abiertos es null para todos: todavía no se calcula. No afirmes que un cliente no tiene compromisos.',
  'Bloques en 0 no significa atrasado: casi ningún cliente contestó todavía por su link.',
  'sesiones_analizadas cuenta TODAS las llamadas analizadas del lead, incluida la de venta: verifica antes de decir «hace N días de la última sesión de entrega».',
  'semana_del_contrato y semanas_del_contrato null = el contrato no lo dice: di «sin dato», no estimes. plazo_vencido no autoriza a marcarlo graduado.',
  'links_vivos no descuenta los vencidos; el detalle está en ver_links_cliente.',
  'cuotas_vencidas, sesiones_analizadas, links_vivos y los bloques en 0 pueden ser una lectura fallida: la cartera no distingue «no hay» de «no pude leer». Antes de afirmar un 0 importante (por ejemplo, «no debe nada»), verifícalo en su pantalla.',
];

function filaCartera(c: ClienteCartera) {
  return {
    leadId: c.leadId, nombre: c.nombre, empresa: c.empresa,
    cancha: c.cancha, razon: c.razon, estado_en_programa: c.estado,
    semana_del_contrato: c.reloj.semana, semanas_del_contrato: c.reloj.semanasTotales,
    plazo_vencido: c.reloj.terminado,
    ultima_sesion_hace_dias: c.ultimaSesionHace, ultima_sesion_titulo: c.ultimaSesionTitulo,
    sesiones_analizadas: c.sesiones,
    cuotas_vencidas: c.cuotasVencidas, cuota_vencida_mas_vieja_hace_dias: c.cuotaVencidaDias,
    compromisos_abiertos: null,
    bloques_contestados: c.contestados, bloques_aprobados: c.aprobados,
    bloques_esperando_su_ok: c.esperandoSuOk, clases_vistas_sin_contestar: c.vistosSinContestar,
    bloque_actual: c.bloqueActual,
    links_vivos: c.links, entro_por_su_link_hace_dias: c.entroHace,
  };
}

/** El borrador pendiente de este lead que ya nombra estos bloques con esta marca de texto. */
async function borradorIgual(leadId: number, marca: string, clases: string[]) {
  const pend = await borradoresMakoDelLead(leadId);
  return pend.find((b) => b.texto.includes(marca) && clases.every((id) => b.texto.includes(rotuloDe(id))));
}

type Tipo = 'aprobar' | 'recordar';

/** El proponer de los dos borradores al cliente: valida contra la base, deduplica y
 *  deja UNA fila en wa_borradores. El borrador ES la propuesta (se revisa en /whatsapp). */
async function proponerBorrador(input: In, tipo: Tipo) {
  const leadId = num(input, 'leadId');
  const cliente = await clienteDelWorkspace(leadId);
  if (!cliente) return { error: NO_ES_CLIENTE(leadId) };
  const tel = digitos(cliente.telefono);
  if (tel.length < 8) return { error: `${cliente.nombre} no tiene teléfono cargado en el CRM: no hay a dónde dejarle el borrador.` };

  const filas = (await bloquesDe(cliente.id)).filter((f) => !f.area);
  const candidatos = tipo === 'aprobar'
    ? filas.filter((f) => f.estado === 'revisada_ia')
    : filas.filter((f) => f.visto_at && f.estado === 'pendiente');
  const validos = new Set(candidatos.map((f) => f.clase_id));
  const pedidas = lista(input, 'clases');
  const queCumple = tipo === 'aprobar' ? 'esperando su ok (revisada_ia)' : 'vistos y sin contestar';
  if (!validos.size) {
    return { error: tipo === 'aprobar'
      ? `${cliente.nombre} no tiene bloques esperando su ok: no hay nada que avisarle.`
      : `${cliente.nombre} no tiene clases vistas y sin contestar. Al que ni abrió la clase no le corresponde este recordatorio.` };
  }
  const malas = pedidas.filter((id) => !validos.has(id));
  if (malas.length) return { error: `Estos bloques no están ${queCumple} para ${cliente.nombre}: ${malas.join(', ')}. Los que sí: ${[...validos].join(', ')}.` };
  const clases = pedidas.length ? [...new Set(pedidas)] : [...validos];

  const marca = tipo === 'aprobar' ? 'te dejé mejorad' : 'vi que miraste';
  // El link NO lleva un jid inventado con los dígitos del CRM (muchas veces sin lada):
  // con un ?chat= que no está en su lista, EmpresaInbox abre la PRIMERA conversación,
  // la de otra persona, al lado del borrador. Se abre la real o la cola.
  const chat = tel.length >= 10 ? await chatEmpresaPorUltimos10(tel.slice(-10)) : null;
  const url = chat ? `${APP_BASE_URL}/whatsapp?canal=empresa&chat=${encodeURIComponent(chat.chatJid)}` : `${APP_BASE_URL}/whatsapp?canal=empresa`;
  // crearBorrador inserta a secas: un reintento apilaría el mismo aviso dos veces.
  const ya = await borradorIgual(cliente.id, marca, clases);
  if (ya) return { id: String(ya.id), url, nueva: false };

  const r = tipo === 'aprobar'
    ? await borradorHayQueAprobar({ leadId: cliente.id, nombre: cliente.nombre, clases })
    : await borradorVioYNoContesto({ leadId: cliente.id, nombre: cliente.nombre, clases });
  if (!r.ok) return { error: r.error };
  // ⚠️ crearBorrador devuelve void y se traga el error del insert, y las funciones de
  // cs-mensajes contestan ok igual: se relee, y si no está, NO se dice que quedó.
  const creado = await borradorIgual(cliente.id, marca, clases);
  if (!creado) return { error: 'No pude dejar el borrador en la cola. No se envió nada.' };
  return {
    id: String(creado.id), url, nueva: true,
    extra: {
      para: primerNombre(cliente.nombre), bloques: clases.map(rotuloDe),
      nota: 'Quedó en la cola de borradores de /whatsapp: una persona lo manda con un clic. No se envió nada.',
    },
  };
}

// ── los runners ──────────────────────────────────────────────────────────────

export const RUNNERS: Runners = {
  // ── Lecturas de clientes ───────────────────────────────────────────────────
  ver_cartera_cs: {
    leer: async (input) => {
      const todos = await cartera();
      const cancha = str(input, 'cancha') as Cancha | '';
      const incluirCerrados = input.incluirCerrados === true;
      const cerrados = todos.filter((c) => c.estado === 'graduado' || c.estado === 'baja');
      const abiertos = incluirCerrados ? todos : todos.filter((c) => !(c.estado === 'graduado' || c.estado === 'baja'));
      const mostrados = cancha ? abiertos.filter((c) => c.cancha === cancha) : abiertos;
      const porCancha = (xs: ClienteCartera[]) => ({
        tuya: xs.filter((c) => c.cancha === 'tuya').length,
        suya: xs.filter((c) => c.cancha === 'suya').length,
        'al-dia': xs.filter((c) => c.cancha === 'al-dia').length,
      });
      return json({
        total_clientes_ganados: todos.length,
        mostrados: mostrados.length,
        quedaron_afuera: {
          cerrados_graduados_o_baja: incluirCerrados ? 0 : cerrados.length,
          por_filtro_de_cancha: abiertos.length - mostrados.length,
        },
        por_cancha: porCancha(abiertos),
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
      const [avance, guardado] = await Promise.all([avanceDeCliente(c.leadId), estadoGuardadoDe(c.leadId)]);
      const u = avance.ultimo;
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
        ultimo_bloque_tocado: u ? {
          claseId: u.clase_id, rotulo: rotuloDe(u.clase_id), area: u.area || null, estado: u.estado, actualizado: u.updated_at,
        } : null,
        notas: [
          ...NOTAS_CARTERA,
          'La garantía puede cambiar qué significa que se pasó del plazo (por ejemplo, sesiones sin costo hasta terminar la instalación): no concluyas que terminó por el reloj.',
          'La historia de la venta vive en el CRM, no aquí.',
        ],
      });
    },
  },

  ver_tarea_cliente: {
    leer: async (input, ctx) => {
      const leadId = num(input, 'leadId');
      const cliente = await clienteDelWorkspace(leadId);
      if (!cliente) return fallo(NO_ES_CLIENTE(leadId));
      const soloMov = input.soloConMovimiento !== false;
      // Por WhatsApp el turno tiene techo: las respuestas van más cortas.
      const tope = ctx.canal === 'whatsapp' ? 250 : 700;
      const v = await vistaDeTarea(ctx.ws, cliente.id);
      let omitidas = 0;
      const modulos = v.modulos.map((m) => {
        const clases = m.clases.filter((c) => {
          const mov = c.estado !== 'pendiente' || c.vista || Boolean(c.respuestaIa);
          if (soloMov && !mov) { omitidas++; return false; }
          return true;
        }).map((c) => ({
          claseId: c.claseId, numero: c.numero, titulo: c.titulo, estado: c.estado,
          obligatorias_sin_contestar: c.faltan, vio_la_clase_en_whop: c.vista,
          respuesta: corto(c.respuesta || null, tope), propuesta_de_mako: corto(c.respuestaIa, tope),
        }));
        return { moduloId: m.moduloId, numero: m.numero, titulo: m.titulo, lo_contesta_el_lider_de_area: m.loContestaElLider, se_repite_por_area: m.porArea, clases };
      }).filter((m) => m.clases.length);
      return json({
        cliente: v.nombre ?? cliente.nombre,
        totales: { clases: v.totales.clases, aprobadas: v.totales.listas, esperando_su_ok: v.totales.esperandoSuOk },
        clase_para_abrir: v.inicial,
        clases_omitidas_sin_movimiento: omitidas,
        notas: [
          'Solo la vuelta general: las respuestas por área de los módulos que se repiten por área no aparecen aquí.',
          'Las respuestas largas vienen recortadas: el texto completo de un bloque está en ver_bloque_cliente.',
        ],
        modulos,
      });
    },
  },

  ver_bloque_cliente: {
    leer: async (input) => {
      const leadId = num(input, 'leadId');
      const cliente = await clienteDelWorkspace(leadId);
      if (!cliente) return fallo(NO_ES_CLIENTE(leadId));
      const claseId = str(input, 'claseId');
      const hit = claseDe(claseId);
      if (!hit) return fallo(`«${claseId}» no es una clase del temario. Los ids tienen la forma «m7c1» y salen de ver_programa_cs.`);
      const area = str(input, 'area');
      const b = await bloqueDe(cliente.id, claseId, area);
      const valores = (b?.valores ?? {}) as Record<string, unknown>;
      return json({
        cliente: cliente.nombre,
        clase: { claseId, rotulo: rotuloDe(claseId), pregunta: hit.clase.pregunta, area: area || null },
        tocado_por_el_cliente: Boolean(b),
        ...(b ? {} : { nota: 'El cliente nunca tocó este bloque (ni lo vio en Whop ni contestó). No es un error.' }),
        estado: b?.estado ?? 'pendiente',
        campos: camposDe(claseId).map((c) => ({
          id: c.id, pregunta: c.label, tipo: c.tipo, obligatorio: Boolean(c.obligatorio), valor: valores[c.id] ?? null,
        })),
        respuesta_en_prosa: b?.respuesta ?? null,
        propuesta_de_mako: b?.respuesta_ia ?? null,
        reunion_de_la_propuesta: b?.fuente_reunion ?? null,
        fechas: b ? { vio_la_clase: b.visto_at, contesto: b.contestada_at, mako_propuso: b.revisada_at, aprobo: b.aprobada_at, ultima_modificacion: b.updated_at } : null,
      });
    },
  },

  ver_links_cliente: {
    leer: async (input, ctx) => {
      const leadId = num(input, 'leadId');
      const cliente = await clienteDelWorkspace(leadId);
      if (!cliente) return fallo(NO_ES_CLIENTE(leadId));
      const vivos = await linksVivosDe(ctx.ws, cliente.id);
      return json({
        cliente: cliente.nombre,
        links_sin_revocar: vivos.length,
        vencidos_entre_ellos: vivos.filter((l) => l.vencido).length,
        ...(vivos.filter((l) => !l.vencido).length > 1 ? { alerta: 'Tiene más de un link vivo: son dos formas de entrar. Conviene cortar y emitir uno solo.' } : {}),
        nota: 'El link en sí nunca se devuelve: el token no se puede volver a leer. Para darle uno nuevo, se emite desde la pantalla de Customer Success.',
        links: vivos.map((l) => ({
          id: l.id, etiqueta: l.etiqueta, empieza_con: l.token_prefijo, emitido: l.created_at,
          vence: l.expira_at, vencido: l.vencido, visitas: l.visitas ?? 0, ultima_visita: l.ultima_visita,
        })),
      });
    },
  },

  ver_avance_whop: {
    leer: async (input, ctx) => {
      if (!(await whopConfigurado(ctx.ws))) return fallo(NO_WHOP);
      let cursoId = str(input, 'cursoId');
      if (!cursoId) {
        const cursos = await listarCursos(ctx.ws);
        if (!cursos.ok) return fallo(cursos.error);
        const c = cursos.data.find((x) => norm(x.title) === norm(CURSO_PROGRAMA));
        if (!c) return fallo(`No encontré en Whop el curso «${CURSO_PROGRAMA}». Cursos que hay: ${cursos.data.map((x) => `${x.title} (${x.id})`).join(', ') || 'ninguno'}.`);
        cursoId = c.id;
      }
      const [alumnos, interacciones, mapa, clientes] = await Promise.all([
        listarAlumnos(cursoId, ctx.ws), listarInteracciones(cursoId, ctx.ws), mapaOnull(), ganadosPorEmail(),
      ]);
      if (!alumnos.ok) return fallo(alumnos.error);
      if (!interacciones.ok) return fallo(interacciones.error);
      const porUsuario = new Map<string, string[]>();
      for (const it of interacciones.data) {
        if (!it.completed_at || !it.user_id || !it.course_lesson_id) continue;
        const a = porUsuario.get(it.user_id) ?? [];
        a.push(mapa?.[it.course_lesson_id] ?? `lección desconocida ${it.course_lesson_id}`);
        porUsuario.set(it.user_id, a);
      }
      const filas = alumnos.data.map((a) => {
        const email = norm(a.user?.email);
        const cli = email ? clientes.get(email) ?? null : null;
        return {
          alumno_id: a.id, usuario: a.user?.username ?? null, email: a.user?.email ?? null,
          cliente_del_crm: cli ? { leadId: cli.id, nombre: cli.nombre } : null,
          lecciones_completadas_segun_whop: a.completed_lessons_count ?? null,
          clases_completadas: a.user?.id ? porUsuario.get(a.user.id) ?? [] : [],
        };
      });
      return json({
        cursoId, alumnos: filas.length,
        sin_cliente_en_el_crm: filas.filter((f) => !f.cliente_del_crm).length,
        notas: [
          'El cruce con el CRM es por email EXACTO contra los clientes ganados: si compró en Whop con otro email, sale sin cliente.',
          mapa ? '«lección desconocida» = la lección no está en el mapa: reconstruir_mapa_lecciones_whop lo repara.' : 'No se pudo leer el mapa de lecciones: las clases salen como lección desconocida.',
          'Whop pagina y la lectura se detiene en 20 páginas por lista: con un curso muy grande puede faltar la cola.',
        ],
        detalle: filas,
      });
    },
  },

  ver_casos_historicos: {
    leer: async (input) => {
      const claseId = str(input, 'claseId');
      const cliente = str(input, 'cliente');
      const nota = 'Material solo para el consultor: nombra clientes reales. Nunca se lo muestres ni se lo cites a otro cliente.';
      if (!claseId && !cliente) {
        const bloques = bloquesConHistorico();
        return json({ nota, bloques_con_casos: bloques.map((id) => ({ claseId: id, rotulo: rotuloDe(id), casos: casosDe(id).length })) });
      }
      if (claseId && !claseDe(claseId)) return fallo(`«${claseId}» no es una clase del temario (forma «m7c1»).`);
      let casos = claseId ? casosDe(claseId) : casosDeCliente(cliente);
      if (claseId && cliente) casos = casos.filter((c) => norm(c.cliente).includes(norm(cliente)));
      return json({
        nota, total: casos.length,
        casos: casos.map((c) => ({ cliente: c.cliente, claseId: c.claseId, rotulo: rotuloDe(c.claseId), tipo: c.tipo, que_paso: c.que, leccion: c.leccion, fuente: c.fuente })),
      });
    },
  },

  ver_material_banco: {
    leer: async (input) => {
      const numero = num(input, 'numero');
      const aviso = 'La numeración es la del DOCUMENTO de Mauricio (13 módulos, 0 a 12), no la del temario cargado (ver_programa_cs): desde el módulo 5 nombran cosas distintas.';
      if (numero != null) {
        const m = moduloDoc(numero);
        const c = coberturaDe(numero);
        if (!m) return fallo(`El documento no tiene módulo ${numero} (van de 0 a 12).`);
        return json({
          aviso, modulo: m,
          cobertura: c ? {
            nivel: c.nivel, accion: c.accion, tarea: c.tarea, ojo: c.ojo ?? null, falta_grabar: c.falta,
            piezas: c.piezas.map((p) => ({ archivo: p.archivo, formato: p.formato, aporta: p.aporta, sirve_como_clase: Boolean(p.esClase) })),
          } : null,
          divergencia_con_el_temario: DIVERGENCIA.find((d) => d.numero === numero) ?? null,
        });
      }
      return json({
        aviso,
        inventario: INVENTARIO,
        modulos: MODULOS_DOC.map((m) => {
          const c = COBERTURA.find((x) => x.modulo === m.numero);
          return { numero: m.numero, titulo: m.titulo, etapa: m.etapa, nivel: c?.nivel ?? null, accion: c?.accion ?? null, piezas: c?.piezas.length ?? 0, faltan_contenidos: c?.falta.length ?? null };
        }),
        modulos_en_cero: MODULOS_EN_CERO,
        defectos: DEFECTOS.map((d) => ({ titulo: d.titulo, lo_ve_el_cliente: d.loVeElCliente, arreglo: d.arreglo, archivos: d.archivos.length })),
        tareas_para_mauricio: TAREAS.map((t) => ({ titulo: t.titulo, porque: t.porque, listo_cuando: t.listoCuando, peso: t.peso })),
        divergencia_con_el_temario: DIVERGENCIA,
        nota: 'Con numero trae las piezas y lo que falta grabar de ese módulo.',
      });
    },
  },

  // ── Lecturas del programa ─────────────────────────────────────────────────
  ver_programa_cs: {
    leer: async (input, ctx) => {
      const http = ctx.canal === 'http';
      const wa = ctx.canal === 'whatsapp';
      const mapa = await mapaOnull();
      const enWhop = mapa ? new Set(Object.values(mapa)) : null;
      const cargada = (id: string): boolean | null => (enWhop ? enWhop.has(id) : null);
      const notaWhop = enWhop ? null : 'No se pudo leer el mapa de Whop: en_whop viene null (no se sabe), no false.';
      const claseId = str(input, 'claseId');
      const moduloId = str(input, 'moduloId');

      if (claseId) {
        const hit = claseDe(claseId);
        if (!hit) return fallo(`«${claseId}» no es una clase del temario (forma «m7c1»).`);
        const { modulo: m, clase: c } = hit;
        return json({
          ...(notaWhop ? { nota: notaWhop } : {}),
          ...(http ? { aviso: SIN_CASOS_HTTP } : {}),
          modulo: { id: m.id, numero: m.numero, titulo: m.titulo, fase: m.fase, lo_contesta: m.quien, se_repite_por_area: Boolean(m.porArea) },
          clase: {
            id: c.id, rotulo: rotuloDe(c.id), titulo: c.titulo, pregunta: c.pregunta,
            ...(http ? {} : { de_que_va_el_video: c.graba, puntos_a_grabar: c.puntos ?? [], atoro: c.atoro ?? null }),
            comparte_video_con: c.mismoVideoQue ?? null,
            destraba_un_atoro_caro: DESTRABAN.has(c.id), en_whop: cargada(c.id),
            preguntas_del_formulario: camposDe(c.id).map((f) => ({
              id: f.id, pregunta: f.label, tipo: f.tipo, obligatoria: Boolean(f.obligatorio),
              ...(f.ayuda ? { ayuda: f.ayuda } : {}), ...(f.opciones ? { opciones: f.opciones } : {}), ...(f.columnas ? { columnas: f.columnas } : {}),
            })),
          },
        });
      }

      const totales = { modulos: TOTAL_MODULOS, clases: TOTAL_CLASES, preguntas: TOTAL_CAMPOS, videos: TOTAL_GRABACIONES, clases_en_whop: enWhop ? enWhop.size : null };
      if (moduloId) {
        const m = PROGRAMA.find((x) => x.id === moduloId);
        if (!m) return fallo(`«${moduloId}» no es un módulo del temario. Los que hay: ${PROGRAMA.map((x) => x.id).join(', ')}.`);
        return json({
          ...(notaWhop ? { nota: notaWhop } : {}), ...(http ? { aviso: SIN_CASOS_HTTP } : {}), totales,
          modulo: {
            id: m.id, numero: m.numero, titulo: m.titulo, fase: m.fase, lo_contesta: m.quien, se_repite_por_area: Boolean(m.porArea),
            clases: m.clases.map((c) => ({
              id: c.id, rotulo: rotuloDe(c.id), titulo: c.titulo, pregunta: c.pregunta, ...(http ? {} : { atoro: c.atoro ?? null }),
              preguntas_del_formulario: camposDe(c.id).length, destraba_un_atoro_caro: DESTRABAN.has(c.id), en_whop: cargada(c.id),
            })),
          },
        });
      }
      return json({
        ...(notaWhop ? { nota: notaWhop } : {}), totales,
        detalle: wa
          ? 'Resumen corto (sin la pregunta de cada clase, para no llenar el chat). Con moduloId trae las preguntas y los atoros; con claseId, la clase completa.'
          : 'Resumen. Con moduloId trae los atoros; con claseId, la clase completa con preguntas y puntos a grabar.',
        modulos: PROGRAMA.map((m) => ({
          id: m.id, numero: m.numero, titulo: m.titulo, fase: m.fase, lo_contesta: m.quien, se_repite_por_area: Boolean(m.porArea),
          clases: m.clases.map((c) => (wa
            ? { id: c.id, rotulo: rotuloDe(c.id), titulo: c.titulo, en_whop: cargada(c.id) }
            : { id: c.id, rotulo: rotuloDe(c.id), pregunta: c.pregunta, en_whop: cargada(c.id) })),
        })),
      });
    },
  },

  ver_grabaciones_programa: {
    leer: async (input, ctx) => {
      const http = ctx.canal === 'http';
      // Sin moduloId son ~10 KB solo de «de qué va»: por WhatsApp no entra en el turno.
      const sinDeQueVa = http || (ctx.canal === 'whatsapp' && !str(input, 'moduloId'));
      const moduloId = str(input, 'moduloId');
      if (moduloId && !PROGRAMA.some((m) => m.id === moduloId)) return fallo(`«${moduloId}» no es un módulo del temario. Los que hay: ${PROGRAMA.map((x) => x.id).join(', ')}.`);
      const grabs = moduloId ? GRABACIONES.filter((g) => g.modulo.id === moduloId) : GRABACIONES;
      const conPuntos = Boolean(moduloId);
      return json({
        videos_en_total: TOTAL_GRABACIONES, mostrados: grabs.length,
        notas: [
          'No se sabe qué video ya está grabado: ese dato no existe.',
          http ? SIN_CASOS_HTTP
            : conPuntos ? 'Los puntos van en orden: son el esqueleto del video, no un guion.'
              : sinDeQueVa ? 'Sin moduloId no vienen de qué va cada video ni los puntos (son largos): pide un módulo para verlos.'
                : 'Sin moduloId los puntos a cubrir no vienen (son largos): pide un módulo para verlos.',
        ],
        videos: grabs.map((g) => ({
          encabeza: g.id, modulo: { id: g.modulo.id, numero: g.modulo.numero, titulo: g.modulo.titulo },
          destraba_un_atoro_caro: g.clases.some((c) => DESTRABAN.has(c.id)),
          clases: g.clases.map((c) => ({
            id: c.id, rotulo: rotuloDe(c.id), ...(sinDeQueVa ? {} : { de_que_va: c.graba }),
            ...(conPuntos && !http ? { puntos: c.puntos ?? [] } : { cantidad_de_puntos: c.puntos?.length ?? 0 }),
          })),
        })),
      });
    },
  },

  ver_estado_whop: {
    leer: async (_input, ctx) => {
      const conectado = await whopConfigurado(ctx.ws);
      const mapa = await mapaOnull();
      const lecciones = mapa ? Object.keys(mapa).length : null;
      // Las CLAVES son lecciones de Whop; dos pueden apuntar a la misma clase (duplicadas
      // o un segundo curso con los mismos títulos). Lo que decide la nota son las clases.
      const clases = mapa ? new Set(Object.values(mapa)).size : null;
      if (!conectado) return json({ conectado: false, nota: NO_WHOP, lecciones_mapeadas: lecciones, clases_con_leccion: clases });
      const cuenta = await whopCuenta(ctx.ws);
      return json({
        conectado: true,
        cuenta: cuenta.ok ? { id: cuenta.data.id, nombre: cuenta.data.title, ruta: cuenta.data.route } : null,
        ...(cuenta.ok ? {} : { error_al_leer_la_cuenta: cuenta.error }),
        lecciones_mapeadas: lecciones, clases_con_leccion: clases, clases_del_temario: TOTAL_CLASES,
        nota: clases == null
          ? 'No se pudo leer el mapa de lecciones (null no es cero).'
          : clases < TOTAL_CLASES ? `Hay ${TOTAL_CLASES - clases} clases sin lección mapeada: su avance llega como «lección desconocida». reconstruir_mapa_lecciones_whop o sincronizar_programa_whop lo arreglan.` : 'Todas las clases tienen su lección mapeada.',
        ...(lecciones != null && clases != null && lecciones > clases ? { alerta: `Hay ${lecciones - clases} lecciones de Whop que apuntan a una clase que ya tiene otra: lecciones duplicadas o un segundo curso con los mismos títulos.` } : {}),
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
        resumen: `Pasar a ${cliente.nombre} de «${actual.estado}» a «${estado}» en el programa${motivo ? ` (motivo: ${motivo})` : actual.motivo ? ' (se conserva el motivo anterior)' : ''}.${efecto}`,
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
      return { ok: true, resumen: `${cliente.nombre} quedó en «${estado}» dentro del programa.`, datos: { leadId: cliente.id, estado } };
    },
  },

  revocar_links_tarea_cs: {
    preparar: async (input, ctx): Promise<Preparado> => {
      const leadId = num(input, 'leadId');
      const cliente = await clienteDelWorkspace(leadId);
      if (!cliente) return { error: NO_ES_CLIENTE(leadId) };
      const vivos = await linksVivosDe(ctx.ws, cliente.id);
      if (!vivos.length) return { error: `${cliente.nombre} no tiene ningún link vivo: no hay nada que cortar.` };
      return {
        payload: { leadId: cliente.id },
        resumen: `Cortar ${vivos.length === 1 ? 'el link' : `los ${vivos.length} links`} de la tarea de ${cliente.nombre}. Se queda sin acceso al instante y no se puede deshacer: para volver a entrar hay que emitirle uno nuevo desde Customer Success. Sus respuestas no se tocan.`,
      };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      const leadId = typeof payload.leadId === 'number' ? payload.leadId : null;
      const cliente = await clienteDelWorkspace(leadId);
      if (!cliente) return { ok: false, resumen: NO_ES_CLIENTE(leadId) };
      // Los vivos AL CONFIRMAR (pudo emitirse otro entre proponer y confirmar). Cada
      // revocación se cuenta: la action de la pantalla se traga los errores.
      const vivos = await linksVivosDe(ctx.ws, cliente.id);
      const fallidos: number[] = [];
      for (const l of vivos) {
        try { await revocarShare(ctx.ws, l.id); } catch { fallidos.push(l.id); }
      }
      const quedan = (await linksVivosDe(ctx.ws, cliente.id)).length;
      if (quedan) return { ok: false, resumen: `${cliente.nombre} todavía tiene ${quedan} link(s) vivo(s): no se pudieron cortar todos. Vuelve a intentarlo o córtalo desde Customer Success.`, datos: { revocados: vivos.length - fallidos.length, quedan } };
      return { ok: true, resumen: `Listo: ${vivos.length === 1 ? 'se cortó el link' : `se cortaron ${vivos.length} links`} de ${cliente.nombre}. Ya no puede entrar.`, datos: { revocados: vivos.length } };
    },
  },

  reconstruir_mapa_lecciones_whop: {
    preparar: async (_input, ctx): Promise<Preparado> => {
      if (!(await whopConfigurado(ctx.ws))) return { error: NO_WHOP };
      const mapa = await mapaOnull();
      const antes = mapa ? Object.keys(mapa).length : null;
      return { payload: {}, resumen: `Rearmar el mapa entre las lecciones de Whop y las ${TOTAL_CLASES} clases del temario (hoy hay ${antes ?? 'un número que no se pudo leer de'} lecciones mapeadas). Si falla a mitad, no se pisa el mapa actual.` };
    },
    ejecutar: async (_payload, ctx): Promise<Ejecutado> => {
      if (!(await whopConfigurado(ctx.ws))) return { ok: false, resumen: NO_WHOP };
      const hace = Date.now() - (ultimaReconstruccion.get(ctx.ws) ?? 0);
      if (hace < ESPERA_RECONSTRUIR_MS) return { ok: false, resumen: `El mapa se reconstruyó hace ${Math.max(1, Math.round(hace / 60000))} min desde aquí: se espera a los 10 min para no repetir la tanda de consultas a Whop. No se hizo nada.` };
      const previo = await mapaOnull();
      // Sin el mapa actual leído, la lib compara contra {} y una tanda a medias lo pisaría.
      if (!previo) return { ok: false, resumen: 'No pude leer el mapa actual de lecciones: no se reconstruye a ciegas. No se hizo nada.' };
      // reconstruirMapa no avisa si Whop falló: con la lista de cursos caída devuelve {} sin guardar.
      const cursos = await listarCursos(ctx.ws);
      if (!cursos.ok) return { ok: false, resumen: `Whop no respondió la lista de cursos: ${cursos.error}. No se tocó el mapa.` };
      ultimaReconstruccion.set(ctx.ws, Date.now());
      const antes = Object.keys(previo).length;
      const clasesAntes = new Set(Object.values(previo)).size;
      try { await reconstruirMapa(ctx.ws); } catch (e) {
        return { ok: false, resumen: `La reconstrucción se cortó: ${e instanceof Error ? e.message : String(e)}. El mapa anterior (${antes} lecciones) no se pisó.` };
      }
      const nuevo = await mapaOnull();
      if (!nuevo) return { ok: false, resumen: 'No pude releer el mapa después de reconstruirlo: no sé si cambió. Revísalo con ver_estado_whop.', datos: { antes } };
      const despues = Object.keys(nuevo).length;
      const clasesDespues = new Set(Object.values(nuevo)).size;
      if (!despues) return { ok: false, resumen: 'Whop no devolvió ninguna lección que coincida con el temario. El mapa quedó como estaba.', datos: { antes, despues } };
      // Sin cambios no es un éxito comprobado: la lib conserva el mapa previo cuando un
      // capítulo falla a mitad y no lo informa (deuda de lib/cs-avance.ts).
      if (JSON.stringify(nuevo) === JSON.stringify(previo) && clasesDespues < TOTAL_CLASES) {
        return { ok: false, resumen: `El mapa no cambió (${antes} lecciones, ${clasesDespues} de ${TOTAL_CLASES} clases con lección). Puede que Whop haya fallado a mitad (la reconstrucción no lo informa) o que esas clases no existan en Whop con su título: se conservó el anterior.`, datos: { antes, despues, clases_con_leccion: clasesDespues } };
      }
      return { ok: true, resumen: `Mapa de lecciones: ${antes} antes, ${despues} ahora; ${clasesAntes} → ${clasesDespues} de ${TOTAL_CLASES} clases con lección.${despues === antes ? ' Sin cambios.' : ''}`, datos: { antes, despues, clases_con_leccion: clasesDespues } };
    },
  },

  // ── Acciones en pantalla ──────────────────────────────────────────────────
  sincronizar_programa_whop: {
    preparar: async (_input, ctx): Promise<Preparado> => {
      // En positivo: el temario es de Mauricio y solo se sincroniza desde SU workspace.
      if (ctx.ws !== OWNER_WS) return { error: 'El programa solo se sincroniza desde el workspace principal.' };
      if (!(await whopConfigurado(ctx.ws))) return { error: NO_WHOP };
      return { payload: {}, resumen: `Sincronizar el temario a Whop: ${TOTAL_MODULOS} capítulos y ${TOTAL_CLASES} lecciones (crea las que falten, reescribe las que cambiaron y pisa lo editado a mano en Whop). El curso queda oculto. Puede tardar más de un minuto.` };
    },
    ejecutar: async (_payload, ctx): Promise<Ejecutado> => {
      if (ctx.ws !== OWNER_WS) return { ok: false, resumen: 'El programa solo se sincroniza desde el workspace principal.' };
      const r = await sincronizarPrograma(ctx.ws);
      if (!r.ok) return { ok: false, resumen: `Whop cortó la sincronización: ${r.error}. Lo que ya se creó quedó; volver a correrla completa lo que falta sin duplicar.` };
      return { ok: true, resumen: `Programa sincronizado a Whop: ${r.creadas} lecciones creadas, ${r.reescritas} reescritas, ${r.sinCambios} sin cambios; ${r.mapa} lecciones mapeadas.`, datos: { creadas: r.creadas, reescritas: r.reescritas, sinCambios: r.sinCambios, mapa: r.mapa } };
    },
  },

  avisar_bloques_para_aprobar: {
    proponer: (input) => proponerBorrador(input, 'aprobar'),
    ejecutar: async () => ({ ok: false, resumen: 'Este aviso se manda desde la cola de borradores de /whatsapp, no por aquí.' }),
  },

  recordar_tarea_sin_contestar: {
    proponer: (input) => proponerBorrador(input, 'recordar'),
    ejecutar: async () => ({ ok: false, resumen: 'Este recordatorio se manda desde la cola de borradores de /whatsapp, no por aquí.' }),
  },
};
