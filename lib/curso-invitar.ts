import 'server-only';

// =============================================================================
// curso-invitar — invitar a un cliente al curso, CON o SIN sesión
// =============================================================================
// Pedido de Martín (07/10/2026, items 9 y 19 del curso tipo Skool): invitar desde la tarjeta del
// kanban, desde la ficha, desde el editor del curso… y desde el CRM, sin nadie logueado («poder
// automatizar la invitación al curso cuando un lead cae a Ganado»). El contrato lo fija
// docs/diseno-curso-skool.md:
//
//   invitarAlCursoSinSesion({ ws, leadId, email?, autor }): Promise<
//     { ok: true; enviado: boolean; motivo?: 'ya-invitado' | 'ya-entro' | 'sin-email' | 'sin-clases' | 'cortado' | 'no-ganado' }
//     | { ok: false; error: string }>
//
// ⚠️ ES UNA SOLA INVITACIÓN Y TIENE DOS PUERTAS. La lógica vivía adentro de `invitarAlCursoAction`
// (app/customer-success/curso-ficha-actions.ts), que pregunta por la SESIÓN: un webhook o un cron no
// la pueden llamar. La primera versión del CRM la copió pieza por pieza, y con eso había dos
// invitaciones que divergen; hoy el CRM (lib/crm-curso-al-ganar.ts) llama a ésta. Acá queda UNA
// (`invitarAlCurso`), y las dos puertas la envuelven: la
// action con su `puerta()` (sesión, capa y lead ganado) y `invitarAlCursoSinSesion` con lo que un
// llamador sin sesión no puede saber — la capa DEL WORKSPACE (no la de una sesión que no hay) y que
// el lead siga ganado.
//
// ⚠️ SIN SESIÓN ES IDEMPOTENTE: si ya se le mandó (`invitacion_enviada_at`), no manda y contesta
// `motivo: 'ya-invitado'`. Y no alcanza con mirarlo: hay TRES lugares que pasan un lead a Ganado y
// dos pueden disparar en el mismo segundo; los dos leían «sin invitar» y salían dos mails. Por eso
// RECLAMA la fila antes de mandar (`reclamarInvitacion`, compare-and-set, mig 0219) y el segundo no
// la encuentra. La puerta CON sesión no reclama: «Reenviar invitación» es justamente mandarla otra vez.
//
// ⚠️ `ok: true, enviado: false` SIEMPRE TRAE `motivo`. Un mail que Resend rechazó NO es un motivo
// para no invitar: es un fallo, y vuelve como `{ ok: false, error }` para que quien llama lo diga
// (el historial del lead, la pantalla). Con el fallo adentro de `ok: true`, el CRM lo anotaría como
// «no hacía falta» sobre un cliente que se quedó sin su acceso.
//
// ⚠️ EL ORDEN, y por qué:
//   1. el workspace se PINNEA primero (`runWithWorkspace`): sin sesión, `getTenantDb` caería al
//      workspace por defecto (el ws1, un cliente) y leería —o escribiría— en otro negocio;
//   2. la capa del workspace, leída de su fila: `getCapaActual` está cacheada POR REQUEST, y un cron
//      que recorre inquilinos le preguntaría al primero por todos;
//   3. el lead y su estado; el acceso (CORTADO gana: una máquina no abre una puerta que una persona
//      cerró), y si ya se invitó; que tenga curso; el email;
//   4. el link de ENTRADA de la versión vigente (`linkDeEntradaAlumno`, que crea la fila si no
//      estaba): hasta acá se armaba a mano con un `TODO-COMPARTIR`;
//   5. el mail, y SÓLO SI SALIÓ se anota (`marcarInvitacion`, que además suelta el reclamo);
//   6. si el lead no tenía email en el CRM, se le guarda: es el mismo dato.
// Después del envío nada puede tirar: un error ahí haría que alguien la reenvíe.
//
// ⚠️ NUNCA CREA UNA CUENTA: ni `usuarios` ni `mako_session` (medido: con una fila en `usuarios` el
// alumno leía el CRM del dueño — lib/alumno-sesion.ts). El alumno entra con el link del mail, con
// Google o pidiendo el link con su email en /login.
//
// ⚠️ LAS DEPENDENCIAS SE INYECTAN, y las reales se cargan con `import()` adentro de `depsReales`.
// No es estilo: un test tiene que poder EJECUTAR el orden de arriba con una base simulada
// (tests/curso-invitar.test.ts, en un proceso hijo con la condición `react-server`), y con los
// imports estáticos de la base el grafo arrastraría Supabase y las credenciales.

// ── «TAMBIÉN POR WHATSAPP» (item 21 del audio del 08/10/2026, minuto 09:30) ───────────────────────
// «Puedes conectar tu email, puedes conectar tu WhatsApp y a la persona le puede llegar por ambos lados».
// `canales` (default `['email']`, saneado por `canalesDeInvitacion`, lib/curso-invitar-canales.ts): con
// 'whatsapp', DESPUÉS de que el correo salió y quedó anotado, el mismo link de entrada sale también por
// la línea de WhatsApp de por default del negocio (`mandarWhatsapp`), con un texto corto
// (`textoInvitacionWhatsapp`, lib/invitacion-aviso.ts).
//
// ⚠️ EL WHATSAPP ES ADICIONAL Y VA DESPUÉS DEL CORREO. Si el correo no sale, el WhatsApp tampoco: la
//    invitación tiene UN estado y se lo da el correo (ver `canalesDeInvitacion`). Un WhatsApp que llega y
//    una invitación que figura «sin mandar» se reenviaría en el próximo «Invitar»: un mensaje de más.
// ⚠️ Y NO TIRA ABAJO NADA: el correo ya salió cuando se intenta. Lo que pasó viaja aparte (`whatsapp`)
//    y la pantalla lo dice en la fila.
// ⚠️ LA INVITACIÓN AUTOMÁTICA AL GANAR (lib/crm-curso-al-ganar.ts, del CRM) NO PASA `canales`: sigue
//    siendo sólo correo. Su REMITENTE sí cambió con el de todos (lib/invitaciones.ts): es el mismo mail.

// ── A UN CURSO, NO A TODOS (puntos 6 y 7 del audio del 08/10/2026 a la noche) ──────────────────────
// «Le envió la invitación a dos productos en lugar de enviarle la invitación al producto en donde estaba
// parado» y «tengo acceso a los dos cursos, cuando sólo le había invitado al curso de Fiesta Music».
// `productoId` = el producto DESDE el que se invita (el editor del curso, la tarjeta del kanban, la tabla
// Avance). Con él:
//   · el mail nombra SÓLO ese curso (`cursos`), nunca los otros productos del cliente;
//   · tiene que ser un producto del que es cliente (la regla del kanban), o es un error;
//   · «ya invitado» y «ya entró» se preguntan POR ESE PRODUCTO (`invitadoAlProducto`): un alumno de Fiesta
//     Music no está invitado a Service Delivery, y el reclamo sin sesión también es por producto;
//   · al salir el mail, su acceso pasa a abrir ese curso (`marcar` → `productosTrasInvitar`,
//     lib/curso-invitar-reglas.ts). El portal le muestra sólo lo que su acceso abre (`productosDelAlumno`).
// Sin `productoId` (la ficha y el CRM, hasta que digan cuál) es lo de antes, con UNA diferencia: el mail
// nombra los cursos que el alumno VE (`productosDelAlumno`), nunca uno que su acceso no le abre.

import { emailNormalizado, emailUtilizable } from './agencia-altas';
import type { ResultadoInvitacion } from './invitacion-aviso';
import { canalesDeInvitacion } from './curso-invitar-canales';
import { invitadoAlProducto, entroAlProducto, type ProductosDelAcceso } from './curso-invitar-reglas';

/** Por qué NO se mandó, cuando no mandar es lo correcto. */
// `ya-entro` (08/10/2026, lo señaló el chat del CRM): tiene acceso, nunca se le mandó el mail y ya
// ENTRÓ (con un link copiado o mandado por WhatsApp). Mandarle «te invitamos» a alguien que ya usa el
// curso es ruido; sin sesión no se manda. Con sesión («Reenviar») sí: lo pide una persona.
export type MotivoNoInvita = 'ya-invitado' | 'ya-entro' | 'sin-email' | 'sin-clases' | 'cortado' | 'no-ganado';

/** El contrato de docs/diseno-curso-skool.md, letra por letra. */
export type ResultadoInvitarSinSesion =
  | { ok: true; enviado: boolean; motivo?: MotivoNoInvita }
  | { ok: false; error: string };

/**
 * Lo que pasó, con todo lo que la pantalla necesita para decirlo (la puerta con sesión arma su
 * aviso con `anotado` y `fallo`). La puerta sin sesión lo reduce al contrato.
 */
export type IntentoInvitar =
  | { tipo: 'no'; motivo: MotivoNoInvita }
  | { tipo: 'error'; error: string }
  | {
    tipo: 'mandado';
    /** Salió de verdad (`inv.enviado`), no «hubo un resultado». */
    enviado: boolean;
    /** A qué dirección. */
    email: string;
    /** Salió y quedó escrito. `false` con `enviado` = hay que decirlo, o alguien la reenvía. */
    anotado: boolean;
    /** Por qué no salió (lo que dijo el envío). `null` si salió. */
    fallo: string | null;
    /** El WhatsApp, SÓLO si se pidió (`canales`). `motivo` = por qué no salió, corto. */
    whatsapp?: { enviado: boolean; motivo?: string };
    /**
     * Con qué remitente salió (o se intentó): el del negocio o el de MaKo. Lo necesita la pantalla para
     * decir DE QUIÉN fue un correo que no salió (`correoQueFallo`, lib/curso-invitar-reglas.ts).
     */
    via?: 'negocio' | 'mako';
  };

/**
 * Cómo se le dice cada motivo a una persona. Corto: lo dibuja un modal o una línea del historial.
 *
 * ⚠️ `no-ganado` es un lead DE ESTE workspace que ya no está en Ganado (lo que no es de este
 * workspace no llega acá: `lead` no lo encuentra y es un error). Decirle «no es de este workspace»
 * afirmaba algo falso y mandaba a buscarlo en otra cuenta (revisión del 08/10/2026).
 */
export const TEXTO_NO_INVITA: Record<MotivoNoInvita, string> = {
  'ya-invitado': 'Ya está invitado.',
  'ya-entro': 'Ya entró al curso.',
  'sin-email': 'Falta su email.',
  'sin-clases': 'El curso todavía no tiene clases.',
  cortado: 'Su acceso está cortado. Primero vuelve a habilitarlo.',
  'no-ganado': 'Ya no figura como cliente.',
};

/** Lo que la invitación necesita del mundo. Las reales salen de `depsReales`; el test pasa las suyas. */
export type DepsInvitar = {
  /** `runWithWorkspace`: todo lo de adentro corre en ESE inquilino. */
  enWorkspace<T>(ws: number, fn: () => Promise<T>): Promise<T>;
  /** ¿La capa de ESE workspace (su fila, no una sesión) incluye Customer Success? */
  capaConCs(ws: number): Promise<boolean>;
  /** `telefono`: el del CRM, para «También por WhatsApp» (no se lee si no se pidió). */
  lead(leadId: number): Promise<{ nombre: string | null; email: string | null; ganado: boolean; telefono?: string | null } | null>;
  /**
   * El acceso del CLIENTE sin crearlo. `null` = nunca se le dio. `productos` (mig 0232) = qué cursos
   * abre (`null` o ausente = todos sus productos).
   */
  acceso(leadId: number): Promise<{ revocado: boolean; invitacionEnviadaAt: string | null; ingresos?: number; productos?: ProductosDelAcceso } | null>;
  /**
   * Los nombres de los cursos que nombra el mail. Con `productoId`: SÓLO ése, si es un producto del que
   * es cliente (la regla del kanban) — `null` si no lo es —, y `[]` si todavía no tiene clases. Sin
   * producto: los que VE (`productosDelAlumno`) que tienen clases.
   */
  cursos(leadId: number, productoId: number | null, cualquierEtapa?: boolean): Promise<string[] | null>;
  /** El link de entrada de la versión vigente, CREANDO el acceso si no estaba. `null` = cortado o sin secreto. */
  linkDeEntrada(leadId: number, ws: number, autor: string): Promise<string | null>;
  /** El reclamo sin sesión (compare-and-set). Con `productoId`, «nadie lo invitó a ESE producto». */
  reclamar(leadId: number, productoId: number | null): Promise<boolean>;
  soltar(leadId: number): Promise<void>;
  negocio(ws: number): Promise<string | null>;
  /** El login, para la línea de «entra con Google». */
  entrarConGoogle(): string;
  /**
   * El mail. NUNCA tira por contrato (`invitarAlCursoPorEmail`); igual se ataja. `ws` es el del ALUMNO:
   * decide el remitente (el del negocio si tiene su dominio conectado, si no el de MaKo).
   */
  mandar(m: { ws: number; email: string; nombre: string | null; programa: string; negocio: string | null; enlace: string; entrarConGoogle: string }): Promise<ResultadoInvitacion & { remitente?: 'negocio' | 'mako' }>;
  /**
   * El WhatsApp, por la línea de por default del negocio, con el mismo link de entrada. Se llama SÓLO con
   * 'whatsapp' en `canales` y con el correo ya salido. NUNCA tira por contrato; igual se ataja.
   */
  mandarWhatsapp(m: { leadId: number; telefono: string | null; nombre: string | null; programa: string; negocio: string | null; enlace: string }): Promise<{ enviado: boolean; motivo?: string }>;
  /** Anota que SALIÓ, y con `productoId` su acceso pasa a abrir ese curso (`marcarInvitacion`). */
  marcar(leadId: number, email: string, autor: string, productoId: number | null): Promise<void>;
  guardarEmailDelLead(leadId: number, email: string): Promise<void>;
};

const texto = (e: unknown, def: string) => (e instanceof Error && e.message ? e.message : def);
const idValido = (n: unknown): n is number => Number.isInteger(n) && (n as number) > 0;

/**
 * LA invitación. `reenviar: true` es la puerta con sesión («Invitar» / «Reenviar invitación» los
 * aprieta una persona): no corta por «ya invitado» y no reclama. Sin sesión, `false`.
 *
 * Nunca tira: lo que falla vuelve como `{ tipo: 'error' }` (un webhook no puede caerse por esto).
 */
export async function invitarAlCurso(
  p: {
    ws: number; leadId: number; email?: string | null; autor: string; reenviar?: boolean;
    /** Por dónde: `['email']` (default) o `['email', 'whatsapp']`. Lo sanea `canalesDeInvitacion`. */
    canales?: unknown;
    /** A QUÉ curso (ver la cabecera, «A UN CURSO, NO A TODOS»). Sin él, lo de antes. */
    productoId?: number | null;
    /**
     * INVITAR A ALGUIEN QUE TODAVÍA NO COMPRÓ. Pedido de Martín el 13/10/2026: «Incluir un buscador
     * de leads en la ventana de invitación a cursos que permita seleccionar contactos en cualquier
     * etapa del embudo y no solo los ganados» (Fathom 858545195 @91:40).
     *
     * ⚠️ VA EN POSITIVO Y SÓLO LO PONE EL CAMINO MANUAL. Lo levanta una persona que eligió a ese
     *    lead en un buscador y apretó invitar; el camino AUTOMÁTICO —`crm-curso-al-ganar`, que se
     *    dispara al pasar a Ganado— nunca lo manda, porque ahí la precondición ES haber ganado.
     *    Sin este reparto, «ganar» dejaría de ser lo que abre el curso y cualquier webhook podría
     *    darle acceso a un lead frío sin que nadie lo decidiera.
     *
     * ⚠️ Y LEVANTA LAS DOS GUARDAS, que son dos preguntas distintas: estar en Ganado, y ser cliente
     *    de ESE producto (un ganado de otro producto no es cliente de éste). Levantar sólo la
     *    primera deja el error «No es cliente de ese producto» y el buscador no invita a nadie —
     *    que es exactamente la mitad que se olvida.
     *
     * Lo que NO levanta, a propósito: el acceso cortado, el email que no sirve y el curso sin
     * clases. Ésas no son «todavía no compró»: son que no hay a dónde mandarlo.
     */
    cualquierEtapa?: boolean;
  },
  deps?: DepsInvitar,
): Promise<IntentoInvitar> {
  if (!idValido(p.ws) || !idValido(p.leadId)) return { tipo: 'error', error: 'Faltan datos.' };
  if (p.productoId != null && !idValido(p.productoId)) return { tipo: 'error', error: 'Falta el producto.' };
  const productoId = p.productoId ?? null;
  const autor = (p.autor ?? '').trim() || 'MaKo';
  const reenviar = p.reenviar === true;
  const cualquierEtapa = p.cualquierEtapa === true;
  // ⚠️ Sin producto, el permiso no tiene a qué abrirle: `productosDelAlumno` de alguien que no compró
  // devuelve vacío y el intento terminaría en «el curso todavía no tiene clases» — un motivo que
  // manda a cargar clases cuando lo que falta es decir A CUÁL. Se falla acá, antes de escribir nada.
  if (cualquierEtapa && p.productoId == null) return { tipo: 'error', error: 'Falta a qué curso invitarlo.' };
  const conWhatsapp = canalesDeInvitacion(p.canales).includes('whatsapp');
  try {
    const d = deps ?? (await depsReales());
    return await d.enWorkspace(p.ws, async (): Promise<IntentoInvitar> => {
      if (!(await d.capaConCs(p.ws))) return { tipo: 'error', error: 'Esta cuenta no tiene Customer Success.' };

      const lead = await d.lead(p.leadId);
      if (!lead) return { tipo: 'error', error: 'Ese cliente no existe.' };
      // Con el permiso puesto, la etapa del embudo no decide: una persona eligió a este lead.
      if (!lead.ganado && !cualquierEtapa) return { tipo: 'no', motivo: 'no-ganado' };

      const previo = await d.acceso(p.leadId);
      if (previo?.revocado) return { tipo: 'no', motivo: 'cortado' };
      // Por producto: invitado a OTRO curso no es «ya invitado» a éste (ver la cabecera). `productos`
      // ausente (quien no lo leyó) cuenta como «todos», que es lo de antes.
      const deEste = previo ? { ...previo, productos: previo.productos ?? null } : null;
      const yaInvitado = productoId != null ? invitadoAlProducto(deEste, productoId) : !!previo?.invitacionEnviadaAt;
      const yaEntro = productoId != null ? entroAlProducto(deEste, productoId) : (previo?.ingresos ?? 0) > 0;
      if (!reenviar && yaInvitado) return { tipo: 'no', motivo: 'ya-invitado' };
      if (!reenviar && yaEntro) return { tipo: 'no', motivo: 'ya-entro' };

      const cursos = await d.cursos(p.leadId, productoId, cualquierEtapa);
      if (cursos === null) return { tipo: 'error', error: 'No es cliente de ese producto.' };
      if (!cursos.length) return { tipo: 'no', motivo: 'sin-clases' };

      // El email pedido gana; sin pedido, el del CRM. Uno pedido que no sirve es un error del que
      // llama (no un motivo): se dice, en vez de caer en silencio al del CRM.
      const pedido = typeof p.email === 'string' && p.email.trim() ? emailNormalizado(p.email) : null;
      if (pedido != null && !emailUtilizable(pedido)) return { tipo: 'error', error: 'Ese email no sirve.' };
      const correo = pedido ?? (lead.email?.trim() ? emailNormalizado(lead.email) : '');
      if (!emailUtilizable(correo)) return { tipo: 'no', motivo: 'sin-email' };

      const enlace = await d.linkDeEntrada(p.leadId, p.ws, autor);
      if (!enlace) {
        // Lo cortaron entre la lectura y acá, o no hay secreto para firmar: son dos cosas.
        const ahora = await d.acceso(p.leadId);
        return ahora?.revocado ? { tipo: 'no', motivo: 'cortado' } : { tipo: 'error', error: 'No pude armar su link.' };
      }

      // ⚠️ EL RECLAMO VA DESPUÉS DE CREAR LA FILA (es un update sobre ella) y ANTES del mail.
      if (!reenviar && !(await d.reclamar(p.leadId, productoId))) return { tipo: 'no', motivo: 'ya-invitado' };

      const negocio = await d.negocio(p.ws).catch(() => null);
      const programa = new Intl.ListFormat('es', { style: 'long', type: 'conjunction' }).format(cursos);
      let inv: ResultadoInvitacion & { remitente?: 'negocio' | 'mako' };
      try {
        inv = await d.mandar({ ws: p.ws, email: correo, nombre: lead.nombre, programa, negocio, enlace, entrarConGoogle: d.entrarConGoogle() });
      } catch (e) {
        inv = { enviado: false, error: texto(e, 'el envío falló'), enlace };
      }
      const via = inv.remitente === 'negocio' || inv.remitente === 'mako' ? { via: inv.remitente } : {};

      if (!inv.enviado) {
        // No salió: se suelta el reclamo para que el próximo intento pueda mandarla. Nada anotado —ni el
        // producto: un intento que no le llegó a nadie no le abre nada (lib/curso-invitar-reglas.ts). Y el
        // WhatsApp tampoco sale (ver la cabecera): la invitación no existe hasta que salga el correo.
        if (!reenviar) await d.soltar(p.leadId);
        return {
          tipo: 'mandado', enviado: false, email: correo, anotado: false, fallo: inv.error || 'el envío falló', ...via,
          ...(conWhatsapp ? { whatsapp: { enviado: false, motivo: 'no salió el correo' } } : {}),
        };
      }

      // ⚠️ DE ACÁ PARA ABAJO NADA TIRA: el mail ya salió.
      let anotado = false;
      try {
        await d.marcar(p.leadId, correo, autor, productoId);
        anotado = true;
      } catch (e) {
        console.error('[curso-invitar] la invitación salió y no se pudo anotar:', texto(e, ''));
      }
      if (!lead.email?.trim()) {
        try { await d.guardarEmailDelLead(p.leadId, correo); } catch (e) {
          console.error('[curso-invitar] no pude guardar el email del cliente:', texto(e, ''));
        }
      }
      // «También por WhatsApp»: el MISMO link de entrada, después de que el correo salió y se anotó.
      if (!conWhatsapp) return { tipo: 'mandado', enviado: true, email: correo, anotado, fallo: null, ...via };
      let whatsapp: { enviado: boolean; motivo?: string };
      try {
        whatsapp = await d.mandarWhatsapp({ leadId: p.leadId, telefono: lead.telefono ?? null, nombre: lead.nombre, programa, negocio, enlace });
      } catch (e) {
        console.error('[curso-invitar] el WhatsApp de la invitación falló:', texto(e, ''));
        whatsapp = { enviado: false, motivo: 'no salió' };
      }
      return { tipo: 'mandado', enviado: true, email: correo, anotado, fallo: null, whatsapp, ...via };
    });
  } catch (e) {
    return { tipo: 'error', error: texto(e, 'No se pudo invitar.') };
  }
}

/**
 * La invitación SIN SESIÓN, con el contrato de docs/diseno-curso-skool.md. La usa el CRM (un
 * webhook, un cron, MaKo por WhatsApp). `autor` firma `invitado_por` y el historial.
 *
 * `productoId` (opcional, 09/10/2026): el producto del embudo donde ganó. Con él, el mail nombra sólo
 * ese curso y el acceso abre sólo ése (ver la cabecera). Sin él, lo de antes.
 */
export async function invitarAlCursoSinSesion(p: { ws: number; leadId: number; email?: string; autor: string; productoId?: number | null }): Promise<ResultadoInvitarSinSesion> {
  return aContrato(await invitarAlCurso({ ws: p.ws, leadId: p.leadId, email: p.email ?? null, autor: p.autor, reenviar: false, productoId: p.productoId ?? null }));
}

/** El intento, reducido al contrato. Exportada para que el test la ejecute con su base simulada. */
export function aContrato(r: IntentoInvitar): ResultadoInvitarSinSesion {
  if (r.tipo === 'error') return { ok: false, error: r.error };
  if (r.tipo === 'no') return { ok: true, enviado: false, motivo: r.motivo };
  if (!r.enviado) return { ok: false, error: `No salió el correo: ${r.fallo ?? 'sin motivo'}` };
  return { ok: true, enviado: true };
}

/**
 * Las dependencias de verdad. Con `import()` y no arriba: ver la cabecera.
 *
 * ⚠️ `capaConCs` lee la CAPA DE LA FILA del workspace y no `getCapaActual`, que está cacheada por
 * request y sin argumento: en un cron que recorre inquilinos contestaría la del primero para todos.
 */
async function depsReales(): Promise<DepsInvitar> {
  const [workspace, datos, alumno, invitaciones, capas, appUrl, entrega, nombreDeCurso] = await Promise.all([
    import('./workspace'), import('./curso-datos'), import('./alumno-acceso'), import('./invitaciones'),
    import('./capas'), import('./app-url'), import('@/app/customer-success/entrega'),
    import('./curso-nombre-datos'),
  ]);
  return {
    enWorkspace: (ws, fn) => workspace.runWithWorkspace(ws, fn),
    capaConCs: async (ws) => {
      const w = await workspace.getWorkspace(ws);
      return w != null && capas.tabEnCapa('customer-success', capas.capaDef(w.capa).id);
    },
    lead: async (leadId) => {
      const db = await workspace.getTenantDb();
      const { data, error } = await db.from('leads').select('id, nombre, email, telefono, estado_lead').eq('id', leadId).maybeSingle();
      if (error) throw new Error(error.message);
      const f = data as { nombre: string | null; email: string | null; telefono: string | null; estado_lead: string | null } | null;
      return f ? {
        nombre: (f.nombre ?? '').trim() || null, email: f.email?.trim() || null, ganado: f.estado_lead === 'ganado',
        telefono: f.telefono?.trim() || null,
      } : null;
    },
    acceso: async (leadId) => {
      const a = await datos.accesoDe(leadId);
      return a ? { revocado: a.revocado, invitacionEnviadaAt: a.invitacionEnviadaAt, ingresos: a.ingresos, productos: a.productos } : null;
    },
    cursos: async (leadId, productoId, cualquierEtapa) => {
      // Con producto: ¿es cliente de ése? (la regla del KANBAN, `productosDelCliente`: todavía no lo
      // abre su acceso, justamente se lo está invitando). Sin producto: los que VE (`productosDelAlumno`,
      // la regla del portal), así el mail nunca nombra un curso que su acceso no le abre.
      //
      // ⚠️ CON `cualquierEtapa` MANDA EL PRODUCTO ELEGIDO, no de quién es cliente: el caso entero es
      //    invitar a alguien que todavía NO compró, así que preguntar de qué es cliente devolvería
      //    `null` siempre y el buscador no invitaría a nadie. Exige el producto a propósito —sin él
      //    no hay a qué curso invitarlo, y abrirle «los que ve» sería ninguno—.
      const ids = productoId != null
        ? (cualquierEtapa || (await entrega.productosDelCliente(leadId)).productos.includes(productoId) ? [productoId] : null)
        : await datos.productosDelAlumno(leadId);
      if (ids == null) return null;
      if (!ids.length) return [];
      const conClases = (await Promise.all(
        ids.map(async (id) => ((await datos.clasesDelProducto(id)).length > 0 ? id : null)),
      )).filter((id): id is number => id != null);
      if (!conClases.length) return [];
      // ⚠️ EL NOMBRE SALE DE `nombresDeCursos`, NO DE `productos.nombre`. Pedido de Martín del
      //    13/10/2026: «los cursos deberían tener el nombre de una OFERTA». Esa función es el ÚNICO
      //    lugar que lo decide (el título puesto a mano, si no la oferta principal única y activa, y
      //    si no, NINGUNO: el curso vuelve sin nombre y acá cae al genérico «tu programa»). Desde
      //    `0a24ca6a` (14/10) el producto ya no es un respaldo, y es a propósito: «Elimina el nombre
      //    del "producto" que hoy en día se llama "nuevo CRM", no debe aparecer nunca como nombre del
      //    curso». O sea que un curso sin oferta sale como «tu programa» en el mail — feo, y mucho
      //    menos feo que decirle al alumno que compró el «nuevo CRM».
      //    Ya la usan el portal, el editor, la vista previa y la ficha. Este era el
      //    último call site que leía la tabla cruda — o sea el único por el que el curso podía
      //    llamarse distinto en el MAIL que en la pantalla, y el mail es lo que ve el alumno primero.
      const nombre = await nombreDeCurso.nombresDeCursos(conClases, { conTitulo: true });
      return conClases.map((id) => nombre.get(id)?.trim() || 'tu programa');
    },
    linkDeEntrada: (leadId, ws, autor) => alumno.linkDeEntradaAlumno(leadId, ws, autor),
    reclamar: (leadId, productoId) => datos.reclamarInvitacion(leadId, new Date(), productoId),
    soltar: (leadId) => datos.soltarInvitacion(leadId),
    negocio: async (ws) => (await workspace.getWorkspace(ws))?.nombre?.trim() || null,
    entrarConGoogle: () => appUrl.linkApp('/login', null),
    mandar: (m) => invitaciones.invitarAlCursoPorEmail(m),
    mandarWhatsapp: (m) => mandarInvitacionPorWhatsapp(m),
    marcar: (leadId, email, autor, productoId) => datos.marcarInvitacion(leadId, email, autor, null, productoId),
    guardarEmailDelLead: async (leadId, email) => {
      const db = await workspace.getTenantDb();
      const { error } = await db.from('leads').update({ email }).eq('id', leadId);
      if (error) throw new Error(error.message);
    },
  };
}

/**
 * La invitación por WHATSAPP (la dependencia real de `mandarWhatsapp`). Corre ADENTRO del workspace del
 * alumno (`enWorkspace`): la línea, el interruptor y el espejo son de ese negocio.
 *
 * Por dónde y cuándo NO sale, en el orden en que se pregunta — los mismos cortes que los mensajes del
 * curso (lib/curso-mensajes.ts), que son los que el negocio ya conoce:
 *   1. sin teléfono en el CRM → no hay a quién;
 *   2. el envío de WhatsApp del negocio APAGADO (`envio_whatsapp_enabled`) → no sale nada que le escriba a
 *      un lead, ni a mano (en el ws1 está PRENDIDO: esto le llega de verdad a sus clientes);
 *   3. la línea de por default sin CONECTAR → mandar por un socket caído es un «no salió» seguro;
 *   4. el contacto bloqueado;
 *   5. se manda por la línea de POR DEFAULT (`enviarYEspejar` sin `linea` → `elegirLinea`,
 *      lib/lineas-whatsapp.ts), que es el número que el cliente conoce, y queda espejado en su hilo.
 *
 * ⚠️ NO MARCA `link_enviado_at` (lib/curso-mensajes.ts): el contacto de esta invitación ya quedó anotado
 *    con el correo (`invitacion_enviada_at`), que es lo que mira el recordatorio de clases.
 */
async function mandarInvitacionPorWhatsapp(m: {
  leadId: number; telefono: string | null; nombre: string | null; programa: string; negocio: string | null; enlace: string;
}): Promise<{ enviado: boolean; motivo?: string }> {
  const [{ normalizarTelefono }, flags, evolution, bloqueos, envio, { textoInvitacionWhatsapp }] = await Promise.all([
    import('./leads'), import('./envio-flags'), import('./evolution'), import('./evolution-block'),
    import('./evolution-envio'), import('./invitacion-aviso'),
  ]);
  const telefono = normalizarTelefono(m.telefono);
  if (!telefono) return { enviado: false, motivo: 'sin teléfono' };
  if (!(await flags.envioWhatsappHabilitado())) return { enviado: false, motivo: 'envío de WhatsApp apagado' };
  const linea = await evolution.getInstanciaRow();
  if (linea?.estado !== 'conectado') return { enviado: false, motivo: 'WhatsApp sin conectar' };
  if (await bloqueos.estaBloqueado(telefono)) return { enviado: false, motivo: 'contacto bloqueado' };
  const r = await envio.enviarYEspejar({
    telefono, leadId: m.leadId,
    texto: textoInvitacionWhatsapp({ nombre: m.nombre, programa: m.programa, negocio: m.negocio, enlace: m.enlace }),
  });
  return r.ok ? { enviado: true } : { enviado: false, motivo: r.error?.trim() || 'no salió' };
}
