// =============================================================================
// api-mako/areas/equipo.run — los cuerpos del área `equipo`
// =============================================================================
// Un runner por id de equipo.def.ts. Lecturas: { leer }. Acciones: { preparar, ejecutar }.
// Todo corre adentro de runWithWorkspace(ctx.ws). Nunca se escribe desde leer() ni
// desde preparar().
//
// Cuatro cosas que no se ven leyendo las libs y que gobiernan este archivo:
//
//  1. tzDeWorkspace ESCRIBE. Si la zona no está fijada la averigua (Cal.com, Google,
//     lada) y la GUARDA. Una lectura no puede hacer eso: ver_zona_horaria_workspace
//     lee el setting crudo y dice «no fijada» en vez de llamarla.
//  2. «LA PERSONA» SALE DE LA COOKIE. getPerfil/getNotifInApp resuelven a quién
//     leen con getUsuarioActual(). Por eso las dos lecturas son solo de la app, y
//     las escrituras de la persona (editar_perfil, configurar_notificaciones_inapp)
//     no están: ver la cabecera de equipo.def.ts.
//  3. setNotifPrefs REESCRIBE EL JSON ENTERO. ejecutar() relee las preferencias en
//     el momento del «sí» y cambia solo el campo pedido: el payload no lleva el
//     objeto entero, que para entonces puede estar viejo.
//  4. EL EQUIPO NO ES TENANT-SCOPED (ver equipo.helpers.ts): todo id de miembro se
//     resuelve contra equipoDe(ctx.ws), en preparar Y en ejecutar.
//  5. AVISOS_WA_EN_VIVO NO ES «LO QUE SE DISPARA». Es la lista CURADA que pinta
//     Configuraciones › Notificaciones. El choke point (emitirAviso → avisoWaActivo)
//     mira el interruptor de CUALQUIER tipo, y hoy salen avisos que no están en esa
//     lista (reunion-recordatorio, lead-de-landing, meta-cuenta-frenada…). Por eso
//     se lista y se deja silenciar todo el catálogo de voz, y la marca es
//     `en_configuraciones`, que es lo único que esa lista sabe de verdad.
// =============================================================================

import 'server-only';
import { revalidatePath } from 'next/cache';
import type { Runners, Preparado, Ejecutado, SalidaLectura } from '../tipos';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspace, getRolWsEfectivo, estaImpersonando } from '@/lib/workspace';
import { capaDef } from '@/lib/capas';
import { getSetting } from '@/lib/settings';
import { KEY_TIMEZONE, TZ_DEFAULT, esTzValida, setTimezoneWorkspace } from '@/lib/timezone';
import { getPerfil, getNotifPrefs, setNotifPrefs, avisoWaActivo, getNotifInApp, DEFAULT_PERFIL, type NotifPrefs } from '@/lib/perfil';
import { AVISOS_WA_EN_VIVO, NOTIF_IN_APP, soloDigitos, telefonoValido, emailValido, inAppActivo } from '@/lib/notif-catalogo';
import { CATALOGO_AVISOS, esAvisoSoloSuperAdmin } from '@/lib/avisos-catalogo';
import { AVISOS_POR_EVENTO } from '@/lib/aviso-evento';
import { getDestinatarios, setDestinatarios, type ResultadoGuardar } from '@/lib/notif-destinatarios';
import { getGrupoJidMaKo, getEstadoVerificacionContacto } from '@/lib/mako-grupo';
import { buildReporteDiario, buildReporteHorario, buildReporteSemanal } from '@/lib/reportes';
import { estadoPlantillaReporte, asegurarPlantillaReporte, PLANTILLA_REPORTE_NOMBRE } from '@/lib/reporte-template';
import { listDrafts, setDraftStatus } from '@/lib/meta-templates';
import { listarUsuarios, crearUsuario, actualizarUsuario, eliminarUsuario, type Usuario } from '@/lib/usuarios';
import { invitarPorEmail } from '@/lib/invitaciones';
import type { RolWorkspace } from '@/lib/auth-session';
import {
  EMAIL_RE, equipoDe, miembroDe, esUltimoAdminActivo, buscarEnEquipo,
  listarIdentidadesFiscales, identidadFiscalPorId, guardarIdentidadFiscal, borrarIdentidadFiscal,
  type IdentidadFiscalFila,
} from './equipo.helpers';

// ── utilidades ───────────────────────────────────────────────────────────────

const str = (input: Record<string, unknown>, k: string): string | null => {
  const v = input[k];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};
const num = (input: Record<string, unknown>, k: string): number | null => {
  const v = input[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};
const bool = (input: Record<string, unknown>, k: string): boolean | null => {
  const v = input[k];
  return typeof v === 'boolean' ? v : null;
};
const json = (x: unknown): string => JSON.stringify(x);
/** En guardar_identidad_fiscal: el valor que pide vaciar un campo (ver su def). */
const VACIAR = '-';
const errorLectura = (msg: string): SalidaLectura => ({ content: msg, isError: true });
const siNo = (b: boolean) => (b ? 'prendido' : 'apagado');

/** Una escritura que no lanza: el contrato de Ejecutado. */
async function escribir(fn: () => Promise<Ejecutado | string>): Promise<Ejecutado> {
  try {
    const r = await fn();
    return typeof r === 'string' ? { ok: true, resumen: r } : r;
  } catch (e) {
    return { ok: false, resumen: `No se pudo guardar (${e instanceof Error ? e.message : 'error'}).` };
  }
}

function invalidar(ruta: string): void {
  try { revalidatePath(ruta); } catch { /* fuera de un request: vence sola */ }
}

const horaEn = (tz: string): string => {
  try { return new Date().toLocaleString('es-MX', { timeZone: tz, dateStyle: 'medium', timeStyle: 'short' }); } catch { return ''; }
};

/** El email de la sesión que está frente a la pantalla, o null (WhatsApp, HTTP). */
async function emailDeSesion(): Promise<string | null> {
  try { return (await getUsuarioActual())?.email?.trim().toLowerCase() || null; } catch { return null; }
}

const nombreRol: Record<RolWorkspace, string> = { admin: 'admin', closer: 'closer', setter: 'setter' };
const quienEs = (u: Usuario) => `${u.nombre || u.email} (${u.email}, ${u.rol_ws ? nombreRol[u.rol_ws] : 'admin: sin rol guardado'})`;
const noMiembro = (id: number) => `No hay nadie con id ${id} en el equipo de este negocio. Pide listar_equipo.`;

const miembroParaModelo = (u: Usuario) => ({
  id: u.id,
  nombre: u.nombre || null,
  email: u.email,
  rol_ws: u.rol_ws,
  estado: u.estado,
  ultimo_login: u.ultimo_login,
  aviso_de_acceso_enviado: u.invitacion_enviada_at,
  sin_avisar: u.estado === 'invitado' && !u.invitacion_enviada_at,
});

const tituloAviso = (id: string): string =>
  AVISOS_WA_EN_VIVO.find((a) => a.id === id)?.titulo ?? CATALOGO_AVISOS.find((a) => a.id === id)?.titulo ?? id;

/** Lo que se puede silenciar: todo aviso del catálogo de voz y de la lista curada,
 *  menos los REPORTES (categoría `reporte`), que no pasan por el interruptor de
 *  avisos y se gobiernan con configurar_reporte. */
const esReporteDelCatalogo = (id: string) => CATALOGO_AVISOS.some((a) => a.id === id && a.categoria === 'reporte');
const avisoSilenciable = (id: string) =>
  !esReporteDelCatalogo(id) && (AVISOS_WA_EN_VIVO.some((a) => a.id === id) || CATALOGO_AVISOS.some((a) => a.id === id));

/** Lo que contesta MaKo si le piden prender o apagar uno de los tres eventos de MaKo (11/10/2026). */
const MENSAJE_ES_AUTOMATIZACION = 'Ese mensaje es una automatización: se prende en Automations.';

type Reporte = 'horario' | 'diario' | 'semanal';
type CampoReporte = 'activo' | 'wa' | 'email';
type Seccion = keyof NotifPrefs['secciones'];
const CAMPO_TXT: Record<CampoReporte, string> = { activo: 'entero', wa: 'por WhatsApp', email: 'por email' };

/** Los destinatarios con el teléfono y el email pedidos, comparados como se guardan. */
const mismoTel = (a: string, b: string) => soloDigitos(a) === soloDigitos(b);
const mismoMail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function resumenGuardado(r: ResultadoGuardar, base: string): Ejecutado {
  if (!r.ok) return { ok: false, resumen: `${base}: no se pudo guardar (${r.error ?? 'error'}).` };
  const partes = [base];
  if (r.grupo === 'creado') partes.push('Se creó el grupo de WhatsApp de MaKo.');
  if (r.grupo === 'sin_numeros') partes.push('Quedó sin teléfonos: nadie recibe reportes por WhatsApp.');
  if (r.noAgregados?.length) partes.push(`No entraron al grupo: ${r.noAgregados.map((n) => `${n.telefono} (${n.motivo})`).join('; ')}.${r.linkGrupo ? ` Link del grupo para pasarlo a mano: ${r.linkGrupo}` : ''}`);
  return { ok: true, resumen: partes.join(' '), datos: { telefonos: r.destinatarios.telefonos, emails: r.destinatarios.emails, grupo: r.grupo ?? null } };
}

async function nombreNegocio(ws: number): Promise<string> {
  try { return (await getWorkspace(ws))?.nombre ?? ''; } catch { return ''; }
}

// ── runners ──────────────────────────────────────────────────────────────────

export const RUNNERS: Runners = {
  // ── Lecturas ────────────────────────────────────────────────────────────────
  ver_perfil: {
    leer: async (_input, ctx) => {
      if (ctx.canal !== 'app') return errorLectura('El perfil es de la persona logueada: solo se puede ver desde la app.');
      if (!(await emailDeSesion())) return errorLectura('No hay una sesión con cuenta propia: no hay perfil que mostrar.');
      const p = await getPerfil();
      return json({
        nombre: p.nombre || null, email: p.email, telefono_personal: p.telefono || null, cargo: p.cargo || null,
        empresa: p.empresa || null, web: p.web || null, bio: p.bio || null, zona_horaria_personal: p.timezone,
        // getPerfil rellena la zona por defecto cuando nunca se eligió, y no dice que lo hizo.
        zona_horaria_puede_ser_la_por_defecto: p.timezone === DEFAULT_PERFIL.timezone,
        foto_url: p.avatarUrl || null,
        nota: `null = campo vacío. Si zona_horaria_puede_ser_la_por_defecto es true, ${DEFAULT_PERFIL.timezone} puede no haberla elegido la persona: no lo presentes como su elección. La zona horaria personal no gobierna horarios del negocio (ver_zona_horaria_workspace) y el teléfono personal no es el de los reportes (ver_destinatarios_notificaciones).`,
      });
    },
  },

  quien_soy: {
    leer: async (_input, ctx) => {
      const w = await getWorkspace(ctx.ws);
      const base: Record<string, unknown> = {
        canal: ctx.canal,
        rol: ctx.rol,
        negocio: w ? { id: w.id, nombre: w.nombre, capa: w.capa, estado: w.estado } : { id: ctx.ws, nombre: null },
      };
      if (ctx.canal === 'app') {
        const [email, rolWs, impersonando] = await Promise.all([emailDeSesion(), getRolWsEfectivo().catch(() => null), estaImpersonando().catch(() => false)]);
        base.email = email;
        base.rol_en_negocio = rolWs;
        base.vista_de_agencia = impersonando;
      } else {
        base.nota = 'Por WhatsApp el pedido viene del grupo del dueño: corre con rol admin y sin una persona identificada.';
      }
      return json(base);
    },
  },

  ver_workspace: {
    leer: async (_input, ctx) => {
      const w = await getWorkspace(ctx.ws);
      if (!w) return errorLectura('No encuentro el negocio de este contexto.');
      const capa = capaDef(w.capa);
      return json({
        id: w.id, nombre: w.nombre, slug: w.slug, estado: w.estado, capa: w.capa, capa_nombre: capa.nombre ?? w.capa,
        tabs_de_la_capa: capa.navKeys ?? 'todas', creado: w.created_at,
      });
    },
  },

  ver_zona_horaria_workspace: {
    leer: async () => {
      const raw = await getSetting(KEY_TIMEZONE);
      if (raw && esTzValida(raw)) return json({ zona_horaria: raw, fijada: true, hora_local_ahora: horaEn(raw) });
      return json({
        zona_horaria: null, fijada: false, se_usa_mientras_tanto: TZ_DEFAULT, hora_local_ahora_en_esa_zona: horaEn(TZ_DEFAULT),
        nota: 'Nunca se fijó. MaKo intenta averiguarla (Cal.com, Google Calendar, lada del teléfono principal) la próxima vez que calendariza; si no puede, usa America/Tijuana. Para fijarla: fijar_zona_horaria_workspace.',
      });
    },
  },

  listar_equipo: {
    leer: async (_input, ctx) => {
      const equipo = await equipoDe(ctx.ws);
      if (!equipo.length) return json({ total: 0, miembros: [], nota: 'El negocio no tiene miembros cargados (los administradores de la agencia no se listan).' });
      return json({ total: equipo.length, miembros: equipo.map(miembroParaModelo) });
    },
  },

  buscar_miembro_equipo: {
    leer: async (input, ctx) => {
      const email = str(input, 'email');
      const nombre = str(input, 'nombre');
      if (!email && !nombre) return errorLectura('Pasa email o nombre.');
      const hallados = await buscarEnEquipo(ctx.ws, { email, nombre });
      if (hallados.length === 1) return json({ encontrado: true, miembro: miembroParaModelo(hallados[0]) });
      if (!hallados.length) return json({ encontrado: false, motivo: 'Nadie del equipo de este negocio coincide. Pide listar_equipo para ver a todos.' });
      return json({ encontrado: false, motivo: `Coinciden ${hallados.length} personas: pide que aclare cuál.`, candidatos: hallados.map((u) => ({ id: u.id, nombre: u.nombre, email: u.email, rol_ws: u.rol_ws })) });
    },
  },

  ver_preferencias_notificaciones: {
    leer: async () => {
      const p = await getNotifPrefs();
      const canal = (c: NotifPrefs['horario']) => ({ activo: c.activo, whatsapp: c.wa, email: c.email });
      const apagados = Object.entries(p.avisos).filter(([, v]) => v === false).map(([id]) => ({ id, titulo: tituloAviso(id) }));
      return json({
        reportes: { horario: canal(p.horario), diario: canal(p.diario), semanal: canal(p.semanal) },
        secciones: p.secciones,
        avisos_whatsapp_apagados: apagados,
        nota: 'Un aviso que no figura como apagado sale. Si nunca se configuró nada, valen los valores por defecto: los tres reportes activos por WhatsApp, y el diario y el semanal también por email.',
      });
    },
  },

  listar_avisos_disponibles: {
    leer: async (input) => {
      const completo = bool(input, 'completo') === true;
      const curados = AVISOS_WA_EN_VIVO.map((a) => ({
        id: a.id, titulo: a.titulo, en_configuraciones: true,
        ...(completo ? { cuando_llega: a.sub, categoria: CATALOGO_AVISOS.find((c) => c.id === a.id)?.categoria ?? null } : {}),
      }));
      const ids = new Set(curados.map((a) => a.id));
      const resto = CATALOGO_AVISOS.filter((a) => !ids.has(a.id) && a.categoria !== 'reporte').map((a) => ({
        id: a.id, titulo: a.titulo, en_configuraciones: false,
        ...(completo ? { cuando_llega: null, categoria: a.categoria } : {}),
      }));
      return json({
        total: curados.length + resto.length,
        en_configuraciones: curados.length,
        avisos: [...curados, ...resto],
        nota: 'Todos se pueden silenciar con configurar_aviso_whatsapp: el envío de cualquier aviso mira ese interruptor. en_configuraciones: false solo dice que no figura en la pantalla Configuraciones › Notificaciones; varios de esos llegan igual (recordatorio de reunión, lead de la landing, cuenta de Meta frenada o recuperada). Esta lista no sabe cuáles del catálogo todavía no tienen un evento que los dispare. Los reportes horario, diario y semanal no están aquí: van con configurar_reporte.',
      });
    },
  },

  esta_aviso_activo: {
    leer: async (input, ctx) => {
      const aviso = str(input, 'aviso')!;
      const conocido = AVISOS_WA_EN_VIVO.some((a) => a.id === aviso) || CATALOGO_AVISOS.some((a) => a.id === aviso);
      if (!conocido) return errorLectura(`No existe el aviso «${aviso}». Pide listar_avisos_disponibles.`);
      if (esReporteDelCatalogo(aviso)) return errorLectura(`«${aviso}» es un reporte, no un aviso: su estado está en ver_preferencias_notificaciones.`);
      return json({
        aviso, titulo: tituloAviso(aviso),
        prendido_para_el_negocio: await avisoWaActivo(ctx.ws, aviso),
        en_configuraciones: AVISOS_WA_EN_VIVO.some((a) => a.id === aviso),
        nota: 'Solo mira el interruptor del negocio, que el envío de cualquier aviso consulta. en_configuraciones: false no quiere decir que no llegue: solo que no figura en esa pantalla. La agencia puede tener apagada la plantilla general de ese aviso, y eso esta lectura no lo ve.',
      });
    },
  },

  ver_destinatarios_notificaciones: {
    leer: async (_input, ctx) => {
      const [d, jid] = await Promise.all([getDestinatarios(), getGrupoJidMaKo(ctx.ws)]);
      return json({
        telefonos: d.telefonos, emails: d.emails,
        telefono_principal: d.telefonos[0] ?? null,
        tiene_grupo_whatsapp: !!jid,
        nota: 'El primer teléfono es el principal (con él se armó el grupo de WhatsApp de MaKo). Quitar a alguien de la lista no lo saca del grupo.',
      });
    },
  },

  ver_notificaciones_inapp: {
    leer: async (_input, ctx) => {
      if (ctx.canal !== 'app') return errorLectura('El pop-up y el sonido son de la persona logueada: solo se ven desde la app.');
      if (!(await emailDeSesion())) return errorLectura('No hay una sesión con cuenta propia.');
      const v = await getNotifInApp();
      return json({
        popup_general: v.popup, sonido_general: v.sonido,
        notificaciones: NOTIF_IN_APP.map((n) => ({
          id: n.id, titulo: n.titulo,
          popup: inAppActivo(v, n.id, 'popup'),
          sonido: n.sonido ? inAppActivo(v, n.id, 'sonido') : false,
          puede_sonar: n.sonido,
        })),
        nota: 'popup y sonido por notificación ya incluyen el efecto del interruptor general.',
      });
    },
  },

  generar_reporte: {
    leer: async (input) => {
      const tipo = str(input, 'tipo') as Reporte;
      const prefs = await getNotifPrefs();
      const r = tipo === 'horario' ? await buildReporteHorario(prefs) : tipo === 'semanal' ? await buildReporteSemanal(prefs) : await buildReporteDiario(prefs);
      const activo = prefs[tipo].activo;
      const sec = prefs.secciones;
      const ninguna = !sec.semaforo && !sec.ads && !sec.wins && !sec.pendientes;
      // Lo que lib/reportes.ts NO distingue (sus catch están vacíos): hay que decirlo
      // acá o el modelo afirma «todo en orden» sobre una fuente caída.
      const ciego = tipo === 'horario'
        ? ' El reporte horario NO distingue «sin alertas» de «fuente caída»: si Meta, la cobranza o el CRM no respondieron, igual dice «Todo tranquilo». No lo presentes como que todo está en orden: di que no encontró alertas.'
        : sec.pendientes
          ? ` Si la sección de pendientes${tipo === 'semanal' ? ' (cuotas por cobrar)' : ''} no aparece, puede ser que no haya o que la fuente no respondió: el reporte no los distingue.`
          : '';
      return [
        r.texto,
        '',
        `— Vista previa, NO se envió. Fechas en hora de Tijuana; montos en USD salvo el gastado de Meta (MXN).${activo ? '' : ` Ojo: el reporte ${tipo} está APAGADO en las preferencias y el cron no lo manda.`}${ninguna ? ' Ojo: las cuatro secciones (semáforo, ads, wins, pendientes) están APAGADAS: el reporte sale vacío por configuración, no porque no haya nada.' : ''} Una sección que dice «no disponible» o «sin datos» es una fuente que no respondió, no un cero.${ciego}`,
      ].join('\n');
    },
  },

  ver_estado_plantilla_reporte: {
    leer: async () => {
      const e = await estadoPlantillaReporte();
      const que: Record<string, string> = {
        approved: 'Aprobada: el reporte diario puede abrir la ventana de 24 horas.',
        pending: 'En revisión de Meta: todavía no se puede mandar.',
        rejected: 'Rechazada: el reporte diario no abre la ventana. Revisa el motivo y usa asegurar_plantilla_reporte.',
        ausente: 'No existe en Meta. Usa asegurar_plantilla_reporte para crearla y mandarla a aprobar.',
        error: 'No se pudo consultar Meta (sin WhatsApp oficial conectado o Meta no respondió).',
      };
      return json({ plantilla: 'reporte_mako', estado: e.estado, motivo: e.motivo, que_significa: que[e.estado] ?? null });
    },
  },

  listar_identidades_fiscales: {
    leer: async () => {
      const ids = await listarIdentidadesFiscales();
      if (!ids.length) return json({ total: 0, identidades: [], nota: 'El negocio no tiene identidades fiscales cargadas.' });
      return json({ total: ids.length, identidades: ids.map((i) => ({ id: i.id, nombre: i.nombre, id_fiscal: i.id_fiscal, domicilio: i.domicilio, correo: i.correo, predeterminada: i.es_default })) });
    },
  },

  ver_estado_verificacion_contacto: {
    leer: async (_input, ctx) => {
      const v = await getEstadoVerificacionContacto(ctx.ws);
      return json({
        telefono: v.telefono || null, verificado: v.verificado,
        nota: v.telefono ? null : 'Nunca se pidió verificar un teléfono (el paso del onboarding no se hizo).',
      });
    },
  },

  // ── Acciones por chat ───────────────────────────────────────────────────────
  fijar_zona_horaria_workspace: {
    preparar: async (input): Promise<Preparado> => {
      const tz = str(input, 'timezone')!;
      if (!esTzValida(tz)) return { error: `«${tz}» no es una zona horaria IANA válida (por ejemplo America/Cancun o America/Argentina/Buenos_Aires).`, faltan: ['timezone'] };
      const actual = await getSetting(KEY_TIMEZONE);
      if (actual === tz) return { error: `La zona del negocio ya es ${tz}.` };
      return {
        payload: { timezone: tz },
        resumen: `Fijar la zona horaria del negocio en ${tz} (ahí ahora: ${horaEn(tz)}). Antes: ${actual && esTzValida(actual) ? actual : `sin fijar (se usaba ${TZ_DEFAULT} o la autodetectada)`}. Cambia reuniones, «hoy» y avisos; los reportes siguen en hora de Tijuana.`,
      };
    },
    ejecutar: async (payload, ctx) => escribir(async () => {
      const tz = String(payload.timezone ?? '');
      await setTimezoneWorkspace(ctx.ws, tz);
      return `Zona horaria del negocio fijada en ${tz}.`;
    }),
  },

  configurar_reporte: {
    preparar: async (input): Promise<Preparado> => {
      const reporte = str(input, 'reporte') as Reporte;
      const campo = str(input, 'campo') as CampoReporte;
      const valor = bool(input, 'valor')!;
      const prefs = await getNotifPrefs();
      if (prefs[reporte][campo] === valor) return { error: `El reporte ${reporte} ${CAMPO_TXT[campo]} ya está ${siNo(valor)}.` };
      const aviso = campo !== 'activo' && !prefs[reporte].activo && valor ? ` Ojo: el reporte ${reporte} entero está apagado; hasta prenderlo no sale por ningún canal.` : '';
      return { payload: { reporte, campo, valor }, resumen: `${valor ? 'Prender' : 'Apagar'} el reporte ${reporte} ${CAMPO_TXT[campo]}.${aviso}` };
    },
    ejecutar: async (payload) => escribir(async () => {
      const reporte = String(payload.reporte) as Reporte;
      const campo = String(payload.campo) as CampoReporte;
      if (!['horario', 'diario', 'semanal'].includes(reporte) || !['activo', 'wa', 'email'].includes(campo)) return { ok: false, resumen: 'Pedido inválido.' };
      const prefs = await getNotifPrefs();
      await setNotifPrefs({ ...prefs, [reporte]: { ...prefs[reporte], [campo]: payload.valor === true } });
      return `Reporte ${reporte} ${CAMPO_TXT[campo]}: ${siNo(payload.valor === true)}.`;
    }),
  },

  configurar_seccion_reporte: {
    preparar: async (input): Promise<Preparado> => {
      const seccion = str(input, 'seccion') as Seccion;
      const valor = bool(input, 'valor')!;
      const prefs = await getNotifPrefs();
      if (prefs.secciones[seccion] === valor) return { error: `La sección ${seccion} ya está ${valor ? 'incluida' : 'fuera'} de los reportes.` };
      return { payload: { seccion, valor }, resumen: `${valor ? 'Incluir' : 'Sacar'} la sección ${seccion} en los tres reportes (horario, diario y semanal).` };
    },
    ejecutar: async (payload) => escribir(async () => {
      const seccion = String(payload.seccion) as Seccion;
      if (!['semaforo', 'ads', 'wins', 'pendientes'].includes(seccion)) return { ok: false, resumen: 'Sección inválida.' };
      const prefs = await getNotifPrefs();
      await setNotifPrefs({ ...prefs, secciones: { ...prefs.secciones, [seccion]: payload.valor === true } });
      return `Sección ${seccion}: ${payload.valor === true ? 'incluida' : 'fuera'} de los reportes.`;
    }),
  },

  configurar_aviso_whatsapp: {
    preparar: async (input): Promise<Preparado> => {
      const aviso = str(input, 'aviso')!;
      const valor = bool(input, 'valor')!;
      if (esReporteDelCatalogo(aviso)) return { error: `«${aviso}» es un reporte, no un aviso: usa configurar_reporte.` };
      // Los tres que son EVENTOS de MaKo («media hora antes», «un lead te escribió», «cuota vencida») son
      // automatizaciones desde el 11/10/2026: los prende la fila del negocio, no `notification_prefs`, así que
      // prenderlos acá sería un interruptor que no hace nada (docs/diseno-mako-en-whatsapp-unificado.md).
      if (AVISOS_POR_EVENTO.has(aviso)) return { error: MENSAJE_ES_AUTOMATIZACION };
      if (!avisoSilenciable(aviso)) return { error: `No existe el aviso «${aviso}». Pide listar_avisos_disponibles.`, faltan: ['aviso'] };
      // Los que configura SÓLO el super admin (la caída y la vuelta del WhatsApp, la grabación de Fathom):
      // Martín, 10/10/2026. Ni por MaKo: se cambian desde /mensajes (lib/avisos-catalogo.ts, AVISOS_SOLO_SUPERADMIN).
      if (esAvisoSoloSuperAdmin(aviso)) return { error: `El aviso «${tituloAviso(aviso)}» lo configura la agencia: no se cambia desde aquí.` };
      const prefs = await getNotifPrefs();
      const actual = prefs.avisos[aviso] !== false;
      if (actual === valor) return { error: `El aviso «${tituloAviso(aviso)}» ya está ${siNo(valor)}.` };
      return { payload: { aviso, valor }, resumen: `${valor ? 'Prender' : 'Apagar'} el aviso de WhatsApp «${tituloAviso(aviso)}».${valor ? '' : ' Solo corta el WhatsApp al grupo del negocio.'}` };
    },
    ejecutar: async (payload) => escribir(async () => {
      const aviso = String(payload.aviso ?? '');
      // Una pendiente propuesta ANTES del 11/10/2026 sobre uno de los tres eventos no se aplica al confirmarla.
      if (AVISOS_POR_EVENTO.has(aviso)) return { ok: false, resumen: MENSAJE_ES_AUTOMATIZACION };
      if (!avisoSilenciable(aviso)) return { ok: false, resumen: `El aviso «${aviso}» ya no existe.` };
      // Una pendiente propuesta ANTES del 10/10/2026 sobre uno del super admin no se aplica al confirmarla.
      if (esAvisoSoloSuperAdmin(aviso)) return { ok: false, resumen: `El aviso «${tituloAviso(aviso)}» lo configura la agencia.` };
      const prefs = await getNotifPrefs();
      await setNotifPrefs({ ...prefs, avisos: { ...prefs.avisos, [aviso]: payload.valor === true } });
      return `Aviso «${tituloAviso(aviso)}»: ${siNo(payload.valor === true)}.`;
    }),
  },

  quitar_destinatario_notificaciones: {
    preparar: async (input): Promise<Preparado> => {
      const telefono = str(input, 'telefono');
      const email = str(input, 'email');
      if (!telefono && !email) return { error: 'Pasa el telefono o el email a sacar.', faltan: ['telefono', 'email'] };
      const d = await getDestinatarios();
      const partes: string[] = [];
      if (telefono) {
        const i = d.telefonos.findIndex((t) => mismoTel(t, telefono));
        if (i < 0) return { error: `El teléfono ${telefono} no está en la lista.`, disponibles: { telefonos: d.telefonos } };
        // El principal no sale por chat: cambiarlo mueve la apertura diaria y el número
        // del dueño, agregar_destinatario lo devuelve al FINAL (nunca vuelve a ser el
        // principal), y por WhatsApp cualquiera del grupo corre con rol admin.
        if (i === 0) return { error: `${d.telefonos[0]} es el teléfono principal (a dónde llega la apertura diaria y con el que MaKo reconoce al dueño): no se quita desde aquí. Se cambia en Configuraciones › Notificaciones.` };
        partes.push(`sacar el teléfono ${d.telefonos[i]}`);
      }
      if (email) {
        const e = d.emails.find((m) => mismoMail(m, email));
        if (!e) return { error: `El email ${email} no está en la lista.`, disponibles: { emails: d.emails } };
        partes.push(`sacar el email ${e}`);
      }
      return {
        payload: { telefono: telefono ?? null, email: email ?? null },
        resumen: `Destinatarios de reportes y avisos: ${partes.join(' ')}. No se lo saca del grupo de WhatsApp.`,
      };
    },
    ejecutar: async (payload, ctx) => escribir(async () => {
      const d = await getDestinatarios();
      const tel = typeof payload.telefono === 'string' ? payload.telefono : null;
      const mail = typeof payload.email === 'string' ? payload.email : null;
      // Entre el «sí» y la propuesta el orden pudo cambiar: se vuelve a mirar.
      if (tel && d.telefonos[0] && mismoTel(d.telefonos[0], tel)) return { ok: false, resumen: `${d.telefonos[0]} pasó a ser el teléfono principal: no se quita desde aquí. Se cambia en Configuraciones › Notificaciones.` };
      const nuevo = {
        telefonos: tel ? d.telefonos.filter((t) => !mismoTel(t, tel)) : d.telefonos,
        emails: mail ? d.emails.filter((m) => !mismoMail(m, mail)) : d.emails,
      };
      const r = await setDestinatarios(nuevo, await nombreNegocio(ctx.ws));
      return resumenGuardado(r, 'Destinatario quitado');
    }),
  },

  reenviar_invitacion: {
    preparar: async (input, ctx): Promise<Preparado> => {
      const id = num(input, 'miembro_id')!;
      const m = await miembroDe(ctx.ws, id);
      if (!m) return { error: noMiembro(id) };
      if (m.estado === 'suspendido') return { error: `${m.nombre || m.email} está suspendido: reactívalo antes (suspender_miembro con estado activo).` };
      const ya = m.invitacion_enviada_at ? ` Ya se le mandó el ${m.invitacion_enviada_at.slice(0, 10)}.` : ' Nunca se le avisó.';
      return { payload: { miembro_id: id }, resumen: `Reenviar el mail de acceso a ${quienEs(m)}.${ya}` };
    },
    ejecutar: async (payload, ctx) => escribir(async () => {
      const m = await miembroDe(ctx.ws, Number(payload.miembro_id));
      if (!m) return { ok: false, resumen: 'Esa persona ya no está en el equipo.' };
      const inv = await invitarPorEmail({ email: m.email, nombre: m.nombre, rolWs: m.rol_ws, workspace: await nombreNegocio(ctx.ws) });
      if (inv.enviado) return { ok: true, resumen: `Mail de acceso reenviado a ${m.email}.` };
      return { ok: false, resumen: `No salió el mail a ${m.email} (${inv.error ?? 'error'}). Pásale este link a mano y dile que entre con Google usando ${m.email}: ${inv.enlace}`, datos: { enlace: inv.enlace } };
    }),
  },

  suspender_miembro: {
    preparar: async (input, ctx): Promise<Preparado> => {
      const id = num(input, 'miembro_id')!;
      const estado = str(input, 'estado') as 'activo' | 'suspendido';
      const m = await miembroDe(ctx.ws, id);
      if (!m) return { error: noMiembro(id) };
      if (m.estado === estado) return { error: `${m.nombre || m.email} ya está ${estado}.` };
      if (estado === 'activo' && m.estado === 'invitado') return { error: `${m.nombre || m.email} no está suspendido: nunca entró. Usa reenviar_invitacion.` };
      if (estado === 'suspendido') {
        const yo = await emailDeSesion();
        if (yo && yo === m.email.toLowerCase()) return { error: 'No puedes suspenderte a ti mismo.' };
        if (await esUltimoAdminActivo(ctx.ws, m)) return { error: `${m.nombre || m.email} es el único administrador activo del negocio: nombra otro admin antes.` };
      }
      return {
        payload: { miembro_id: id, estado },
        resumen: estado === 'suspendido' ? `Suspender a ${quienEs(m)}: deja de poder usar MaKo (la sesión que tenga abierta se corta al cargar la próxima página).` : `Reactivar a ${quienEs(m)}: vuelve a poder entrar.`,
      };
    },
    ejecutar: async (payload, ctx) => escribir(async () => {
      const estado = payload.estado === 'activo' ? 'activo' : 'suspendido';
      const m = await miembroDe(ctx.ws, Number(payload.miembro_id));
      if (!m) return { ok: false, resumen: 'Esa persona ya no está en el equipo.' };
      // preparar() miró la sesión de quien PROPUSO; por WhatsApp no hay sesión y quien
      // confirma en la bandeja puede ser el propio suspendido.
      const yo = await emailDeSesion();
      if (estado === 'suspendido' && yo && yo === m.email.toLowerCase()) return { ok: false, resumen: 'No puedes suspenderte a ti mismo.' };
      if (estado === 'suspendido' && await esUltimoAdminActivo(ctx.ws, m)) return { ok: false, resumen: `${m.nombre || m.email} quedó como único administrador activo: no se suspende.` };
      await actualizarUsuario(m.id, { estado });
      invalidar('/equipo');
      return `${m.nombre || m.email}: ${estado}.`;
    }),
  },

  hacer_default_identidad_fiscal: {
    preparar: async (input): Promise<Preparado> => {
      const id = num(input, 'id')!;
      const i = await identidadFiscalPorId(id);
      if (!i) return { error: `No hay una identidad fiscal con id ${id} en este negocio. Pide listar_identidades_fiscales.` };
      if (i.es_default) return { error: `«${i.nombre}» ya es la predeterminada.` };
      return { payload: { id }, resumen: `Marcar «${i.nombre}»${i.id_fiscal ? ` (${i.id_fiscal})` : ''} como la identidad fiscal predeterminada en «Facturado por».` };
    },
    ejecutar: async (payload) => escribir(async () => {
      const i = await identidadFiscalPorId(Number(payload.id));
      if (!i) return { ok: false, resumen: 'Esa identidad fiscal ya no existe.' };
      await guardarIdentidadFiscal(i.id, { nombre: i.nombre, id_fiscal: i.id_fiscal, domicilio: i.domicilio, correo: i.correo, es_default: true });
      invalidar('/configuraciones');
      return `«${i.nombre}» es ahora la identidad fiscal predeterminada.`;
    }),
  },

  // ── Acciones por pantalla ───────────────────────────────────────────────────
  agregar_destinatario_notificaciones: {
    preparar: async (input): Promise<Preparado> => {
      const telefono = str(input, 'telefono');
      const email = str(input, 'email');
      if (!telefono && !email) return { error: 'Pasa un telefono (con lada) o un email.', faltan: ['telefono', 'email'] };
      if (telefono && !telefonoValido(telefono)) return { error: `«${telefono}» no parece un teléfono: necesita al menos 8 dígitos, con lada de país.`, faltan: ['telefono'] };
      if (email && !emailValido(email)) return { error: `«${email}» no es un email válido.`, faltan: ['email'] };
      const d = await getDestinatarios();
      if (telefono && d.telefonos.some((t) => mismoTel(t, telefono))) return { error: `El teléfono ${telefono} ya recibe los reportes.` };
      if (email && d.emails.some((m) => mismoMail(m, email))) return { error: `El email ${email} ya recibe los reportes.` };
      const partes: string[] = [];
      if (telefono) partes.push(`el teléfono ${soloDigitos(telefono)}${d.telefonos.length ? ' (se suma al grupo de WhatsApp de MaKo)' : ' (es el primero: con él se crea el grupo de WhatsApp de MaKo)'}`);
      if (email) partes.push(`el email ${email.toLowerCase()}`);
      return { payload: { telefono: telefono ?? null, email: email ?? null }, resumen: `Sumar a los reportes y avisos del negocio ${partes.join(' y ')}.` };
    },
    ejecutar: async (payload, ctx) => escribir(async () => {
      const d = await getDestinatarios();
      const tel = typeof payload.telefono === 'string' ? payload.telefono : null;
      const mail = typeof payload.email === 'string' ? payload.email : null;
      const nuevo = {
        telefonos: tel && !d.telefonos.some((t) => mismoTel(t, tel)) ? [...d.telefonos, tel] : d.telefonos,
        emails: mail && !d.emails.some((m) => mismoMail(m, mail)) ? [...d.emails, mail.trim().toLowerCase()] : d.emails,
      };
      const r = await setDestinatarios(nuevo, await nombreNegocio(ctx.ws));
      return resumenGuardado(r, 'Destinatario agregado');
    }),
  },

  invitar_miembro_equipo: {
    preparar: async (input): Promise<Preparado> => {
      const email = (str(input, 'email') ?? '').toLowerCase();
      if (!EMAIL_RE.test(email)) return { error: `«${email}» no es un email válido.`, faltan: ['email'] };
      const rol = (str(input, 'rol_ws') ?? 'setter') as RolWorkspace;
      const nombre = str(input, 'nombre');
      // Neutro a propósito: decir «en otro negocio» le cuenta a un admin-cliente quién tiene cuenta en otro tenant.
      if ((await listarUsuarios()).some((u) => u.email === email)) return { error: `Ese email ya tiene una cuenta en MaKo: no se puede invitar.` };
      const alcance = rol === 'admin' ? ' Como admin va a ver TODO el negocio: integraciones, prompts y equipo.' : '';
      return {
        payload: { email, nombre: nombre ?? '', rol_ws: rol },
        resumen: `Invitar a ${nombre ? `${nombre} ` : ''}<${email}> como ${rol} y mandarle el mail de acceso. Tiene que entrar con Google usando exactamente ese email.${alcance}`,
      };
    },
    ejecutar: async (payload, ctx) => escribir(async () => {
      const email = String(payload.email ?? '').toLowerCase();
      const rol = (['admin', 'closer', 'setter'] as const).find((r) => r === payload.rol_ws) ?? 'setter';
      const nombre = String(payload.nombre ?? '');
      if (!EMAIL_RE.test(email)) return { ok: false, resumen: 'Email inválido.' };
      if ((await listarUsuarios()).some((u) => u.email === email)) return { ok: false, resumen: 'Ese email ya tiene una cuenta en MaKo: no se puede invitar.' };
      const quien = ctx.actor || (await emailDeSesion()) || `MaKo (${ctx.canal})`;
      const nuevo = await crearUsuario({ email, nombre: nombre || undefined, rol: 'usuario', rol_ws: rol, workspace_id: ctx.ws, invitado_por: quien });
      const inv = await invitarPorEmail({ email, nombre: nombre || undefined, rolWs: rol, workspace: await nombreNegocio(ctx.ws) });
      invalidar('/equipo');
      const base = `Cuenta creada para ${email} como ${rol} (id ${nuevo.id}).`;
      if (inv.enviado) return { ok: true, resumen: `${base} Mail de acceso enviado.`, datos: { miembro_id: nuevo.id } };
      return { ok: true, resumen: `${base} El mail NO salió (${inv.error ?? 'error'}): pásale este link a mano y dile que entre con Google usando ${email}: ${inv.enlace}`, datos: { miembro_id: nuevo.id, enlace: inv.enlace } };
    }),
  },

  cambiar_rol_miembro: {
    preparar: async (input, ctx): Promise<Preparado> => {
      const id = num(input, 'miembro_id')!;
      const rol = str(input, 'rol_ws') as RolWorkspace;
      const m = await miembroDe(ctx.ws, id);
      if (!m) return { error: noMiembro(id) };
      if (m.rol_ws === rol) return { error: `${m.nombre || m.email} ya es ${rol}.` };
      if (rol !== 'admin' && await esUltimoAdminActivo(ctx.ws, m)) return { error: `${m.nombre || m.email} es el único administrador activo del negocio: nombra otro admin antes.` };
      const alcance = rol === 'admin' ? ' Como admin va a ver TODO el negocio: integraciones, prompts y equipo.' : '';
      return { payload: { miembro_id: id, rol_ws: rol }, resumen: `Cambiar el rol de ${quienEs(m)} a ${rol}.${alcance}` };
    },
    ejecutar: async (payload, ctx) => escribir(async () => {
      const rol = (['admin', 'closer', 'setter'] as const).find((r) => r === payload.rol_ws);
      if (!rol) return { ok: false, resumen: 'Rol inválido.' };
      const m = await miembroDe(ctx.ws, Number(payload.miembro_id));
      if (!m) return { ok: false, resumen: 'Esa persona ya no está en el equipo.' };
      if (rol !== 'admin' && await esUltimoAdminActivo(ctx.ws, m)) return { ok: false, resumen: `${m.nombre || m.email} quedó como único administrador activo: no se le cambia el rol.` };
      await actualizarUsuario(m.id, { rol_ws: rol });
      invalidar('/equipo');
      return `${m.nombre || m.email} ahora es ${rol}.`;
    }),
  },

  eliminar_miembro: {
    preparar: async (input, ctx): Promise<Preparado> => {
      const id = num(input, 'miembro_id')!;
      const m = await miembroDe(ctx.ws, id);
      if (!m) return { error: noMiembro(id) };
      const yo = await emailDeSesion();
      if (yo && yo === m.email.toLowerCase()) return { error: 'No puedes eliminarte a ti mismo.' };
      if (await esUltimoAdminActivo(ctx.ws, m)) return { error: `${m.nombre || m.email} es el único administrador activo del negocio: nombra otro admin antes.` };
      return { payload: { miembro_id: id }, resumen: `ELIMINAR la cuenta de ${quienEs(m)}. Es irreversible: para que vuelva hay que invitarla de nuevo. Si solo quieres cortarle el acceso, suspéndela.` };
    },
    ejecutar: async (payload, ctx) => escribir(async () => {
      const m = await miembroDe(ctx.ws, Number(payload.miembro_id));
      if (!m) return { ok: false, resumen: 'Esa persona ya no está en el equipo.' };
      const yo = await emailDeSesion();
      if (yo && yo === m.email.toLowerCase()) return { ok: false, resumen: 'No puedes eliminarte a ti mismo.' };
      if (await esUltimoAdminActivo(ctx.ws, m)) return { ok: false, resumen: `${m.nombre || m.email} quedó como único administrador activo: no se elimina.` };
      await eliminarUsuario(m.id);
      invalidar('/equipo');
      return `Cuenta de ${m.nombre || m.email} eliminada.`;
    }),
  },

  guardar_identidad_fiscal: {
    preparar: async (input): Promise<Preparado> => {
      const id = num(input, 'id');
      const nombre = str(input, 'nombre')!;
      const previa = id ? await identidadFiscalPorId(id) : null;
      if (id && !previa) return { error: `No hay una identidad fiscal con id ${id} en este negocio. Pide listar_identidades_fiscales.` };
      // La pantalla genérica no distingue «no vino» de «lo vació»: validarInput omite los
      // dos. Sin una marca, borrar un RFC equivocado caía a `previa` y quedaba el viejo.
      // Convención: un guion (-) vacía el campo; ausente, se conserva.
      const campo = (k: 'id_fiscal' | 'domicilio' | 'correo'): string | null => {
        const v = str(input, k);
        if (v === VACIAR) return null;
        return v ?? previa?.[k] ?? null;
      };
      const correo = campo('correo');
      if (correo && !emailValido(correo)) return { error: `«${correo}» no es un correo válido.`, faltan: ['correo'] };
      const esDefault = bool(input, 'es_default');
      const fila: IdentidadFiscalFila = {
        nombre,
        id_fiscal: campo('id_fiscal'),
        domicilio: campo('domicilio'),
        correo,
        es_default: esDefault ?? previa?.es_default ?? false,
      };
      const datos = `«${fila.nombre}», id fiscal ${fila.id_fiscal ?? '—'}, domicilio ${fila.domicilio ?? '—'}, correo ${fila.correo ?? '—'}${fila.es_default ? ', predeterminada' : ''}`;
      return { payload: { id: id ?? null, fila }, resumen: id ? `Editar la identidad fiscal #${id}: ${datos}.` : `Crear la identidad fiscal ${datos}.` };
    },
    ejecutar: async (payload) => escribir(async () => {
      const f = (payload.fila ?? {}) as Record<string, unknown>;
      const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
      const nombre = s(f.nombre);
      if (!nombre) return { ok: false, resumen: 'La razón social es obligatoria.' };
      const id = typeof payload.id === 'number' ? payload.id : null;
      if (id && !(await identidadFiscalPorId(id))) return { ok: false, resumen: 'Esa identidad fiscal ya no existe.' };
      const nuevoId = await guardarIdentidadFiscal(id, { nombre, id_fiscal: s(f.id_fiscal), domicilio: s(f.domicilio), correo: s(f.correo), es_default: f.es_default === true });
      invalidar('/configuraciones');
      return { ok: true, resumen: id ? `Identidad fiscal «${nombre}» actualizada.` : `Identidad fiscal «${nombre}» creada.`, datos: { id: nuevoId } };
    }),
  },

  borrar_identidad_fiscal: {
    preparar: async (input): Promise<Preparado> => {
      const id = num(input, 'id')!;
      const i = await identidadFiscalPorId(id);
      if (!i) return { error: `No hay una identidad fiscal con id ${id} en este negocio. Pide listar_identidades_fiscales.` };
      return { payload: { id }, resumen: `BORRAR la identidad fiscal «${i.nombre}»${i.id_fiscal ? ` (${i.id_fiscal})` : ''}${i.es_default ? ', que es la predeterminada' : ''}. Los deals que la tenían en «Facturado por» quedan sin identidad.` };
    },
    ejecutar: async (payload) => escribir(async () => {
      const i = await identidadFiscalPorId(Number(payload.id));
      if (!i) return { ok: false, resumen: 'Esa identidad fiscal ya no existe.' };
      await borrarIdentidadFiscal(i.id);
      invalidar('/configuraciones');
      return `Identidad fiscal «${i.nombre}» borrada.`;
    }),
  },

  asegurar_plantilla_reporte: {
    preparar: async (): Promise<Preparado> => {
      const e = await estadoPlantillaReporte();
      if (e.estado === 'approved' || e.estado === 'pending') return { error: `La plantilla «reporte_mako» ya está ${e.estado === 'approved' ? 'aprobada' : 'en revisión'}: no hace falta mandarla.` };
      if (e.estado === 'error') return { error: `No se pudo consultar Meta (${e.motivo ?? 'sin WhatsApp oficial conectado'}).` };
      // enviarBorradorAMeta solo manda un borrador en `borrador` o `rejected`, y
      // upsertDraft no le resetea el status: si Meta ya no la tiene (o el rechazo no
      // se reconcilió) y acá quedó `pending`/`approved`, el envío falla siempre.
      const previo = (await listDrafts()).find((d) => d.name === PLANTILLA_REPORTE_NOMBRE);
      const trabado = previo && previo.status !== 'borrador' && previo.status !== 'rejected' ? previo.status : null;
      return {
        payload: {},
        resumen: `Crear la plantilla de WhatsApp «reporte_mako» y mandarla a aprobación de Meta (hoy en Meta: ${e.estado}${e.motivo ? `, motivo: ${e.motivo}` : ''}).${trabado ? ` El borrador guardado en MaKo figura «${trabado}», que Meta ya no confirma: se vuelve a borrador antes de enviarlo.` : ''} Meta tarda horas o días en decidir.`,
      };
    },
    ejecutar: async () => escribir(async () => {
      const e = await estadoPlantillaReporte();
      if (e.estado === 'rejected' || e.estado === 'ausente') {
        const previo = (await listDrafts()).find((d) => d.name === PLANTILLA_REPORTE_NOMBRE);
        if (previo?.id && previo.status !== 'borrador' && previo.status !== 'rejected') await setDraftStatus(previo.id, 'borrador');
      }
      const r = await asegurarPlantillaReporte();
      if (!r.ok) return { ok: false, resumen: `No se pudo mandar la plantilla (${r.error ?? r.estado}).` };
      return `Plantilla «reporte_mako»: ${r.estado === 'pending' ? 'enviada a aprobación de Meta' : r.estado}.`;
    }),
  },
};

