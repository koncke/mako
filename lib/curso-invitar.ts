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
// la pueden llamar. El CRM la copió pieza por pieza (su primera versión, lib/curso-invitar-auto.ts;
// hoy lib/crm-curso-al-ganar.ts, que ya llama a ésta) y con eso había dos invitaciones que divergen. Acá queda UNA (`invitarAlCurso`), y las dos puertas la envuelven: la
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

import { emailNormalizado, emailUtilizable } from './agencia-altas';
import type { ResultadoInvitacion } from './invitacion-aviso';

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
  'sin-clases': 'Sus productos todavía no tienen clases.',
  cortado: 'Su acceso está cortado. Primero vuelve a habilitarlo.',
  'no-ganado': 'Ya no figura como cliente.',
};

/** Lo que la invitación necesita del mundo. Las reales salen de `depsReales`; el test pasa las suyas. */
export type DepsInvitar = {
  /** `runWithWorkspace`: todo lo de adentro corre en ESE inquilino. */
  enWorkspace<T>(ws: number, fn: () => Promise<T>): Promise<T>;
  /** ¿La capa de ESE workspace (su fila, no una sesión) incluye Customer Success? */
  capaConCs(ws: number): Promise<boolean>;
  lead(leadId: number): Promise<{ nombre: string | null; email: string | null; ganado: boolean } | null>;
  /** El acceso del CLIENTE sin crearlo. `null` = nunca se le dio. */
  acceso(leadId: number): Promise<{ revocado: boolean; invitacionEnviadaAt: string | null; ingresos?: number } | null>;
  /** Los nombres de SUS productos que tienen clases (la regla del portal: `productosDelAlumno`). */
  cursos(leadId: number): Promise<string[]>;
  /** El link de entrada de la versión vigente, CREANDO el acceso si no estaba. `null` = cortado o sin secreto. */
  linkDeEntrada(leadId: number, ws: number, autor: string): Promise<string | null>;
  reclamar(leadId: number): Promise<boolean>;
  soltar(leadId: number): Promise<void>;
  negocio(ws: number): Promise<string | null>;
  /** El login, para la línea de «entra con Google». */
  entrarConGoogle(): string;
  /** El mail. NUNCA tira por contrato (`invitarAlCursoPorEmail`); igual se ataja. */
  mandar(m: { email: string; nombre: string | null; programa: string; negocio: string | null; enlace: string; entrarConGoogle: string }): Promise<ResultadoInvitacion>;
  marcar(leadId: number, email: string, autor: string): Promise<void>;
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
  p: { ws: number; leadId: number; email?: string | null; autor: string; reenviar?: boolean },
  deps?: DepsInvitar,
): Promise<IntentoInvitar> {
  if (!idValido(p.ws) || !idValido(p.leadId)) return { tipo: 'error', error: 'Faltan datos.' };
  const autor = (p.autor ?? '').trim() || 'MaKo';
  const reenviar = p.reenviar === true;
  try {
    const d = deps ?? (await depsReales());
    return await d.enWorkspace(p.ws, async (): Promise<IntentoInvitar> => {
      if (!(await d.capaConCs(p.ws))) return { tipo: 'error', error: 'Esta cuenta no tiene Customer Success.' };

      const lead = await d.lead(p.leadId);
      if (!lead) return { tipo: 'error', error: 'Ese cliente no existe.' };
      if (!lead.ganado) return { tipo: 'no', motivo: 'no-ganado' };

      const previo = await d.acceso(p.leadId);
      if (previo?.revocado) return { tipo: 'no', motivo: 'cortado' };
      if (!reenviar && previo?.invitacionEnviadaAt) return { tipo: 'no', motivo: 'ya-invitado' };
      if (!reenviar && (previo?.ingresos ?? 0) > 0) return { tipo: 'no', motivo: 'ya-entro' };

      const cursos = await d.cursos(p.leadId);
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
      if (!reenviar && !(await d.reclamar(p.leadId))) return { tipo: 'no', motivo: 'ya-invitado' };

      const negocio = await d.negocio(p.ws).catch(() => null);
      const programa = new Intl.ListFormat('es', { style: 'long', type: 'conjunction' }).format(cursos);
      let inv: ResultadoInvitacion;
      try {
        inv = await d.mandar({ email: correo, nombre: lead.nombre, programa, negocio, enlace, entrarConGoogle: d.entrarConGoogle() });
      } catch (e) {
        inv = { enviado: false, error: texto(e, 'el envío falló'), enlace };
      }

      if (!inv.enviado) {
        // No salió: se suelta el reclamo para que el próximo intento pueda mandarla. Nada anotado.
        if (!reenviar) await d.soltar(p.leadId);
        return { tipo: 'mandado', enviado: false, email: correo, anotado: false, fallo: inv.error || 'el envío falló' };
      }

      // ⚠️ DE ACÁ PARA ABAJO NADA TIRA: el mail ya salió.
      let anotado = false;
      try {
        await d.marcar(p.leadId, correo, autor);
        anotado = true;
      } catch (e) {
        console.error('[curso-invitar] la invitación salió y no se pudo anotar:', texto(e, ''));
      }
      if (!lead.email?.trim()) {
        try { await d.guardarEmailDelLead(p.leadId, correo); } catch (e) {
          console.error('[curso-invitar] no pude guardar el email del cliente:', texto(e, ''));
        }
      }
      return { tipo: 'mandado', enviado: true, email: correo, anotado, fallo: null };
    });
  } catch (e) {
    return { tipo: 'error', error: texto(e, 'No se pudo invitar.') };
  }
}

/**
 * La invitación SIN SESIÓN, con el contrato de docs/diseno-curso-skool.md. La usa el CRM (un
 * webhook, un cron, MaKo por WhatsApp). `autor` firma `invitado_por` y el historial.
 */
export async function invitarAlCursoSinSesion(p: { ws: number; leadId: number; email?: string; autor: string }): Promise<ResultadoInvitarSinSesion> {
  return aContrato(await invitarAlCurso({ ws: p.ws, leadId: p.leadId, email: p.email ?? null, autor: p.autor, reenviar: false }));
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
  const [workspace, datos, alumno, invitaciones, capas, appUrl, productos] = await Promise.all([
    import('./workspace'), import('./curso-datos'), import('./alumno-acceso'), import('./invitaciones'),
    import('./capas'), import('./app-url'), import('./productos'),
  ]);
  return {
    enWorkspace: (ws, fn) => workspace.runWithWorkspace(ws, fn),
    capaConCs: async (ws) => {
      const w = await workspace.getWorkspace(ws);
      return w != null && capas.tabEnCapa('customer-success', capas.capaDef(w.capa).id);
    },
    lead: async (leadId) => {
      const db = await workspace.getTenantDb();
      const { data, error } = await db.from('leads').select('id, nombre, email, estado_lead').eq('id', leadId).maybeSingle();
      if (error) throw new Error(error.message);
      const f = data as { nombre: string | null; email: string | null; estado_lead: string | null } | null;
      return f ? { nombre: (f.nombre ?? '').trim() || null, email: f.email?.trim() || null, ganado: f.estado_lead === 'ganado' } : null;
    },
    acceso: async (leadId) => {
      const a = await datos.accesoDe(leadId);
      return a ? { revocado: a.revocado, invitacionEnviadaAt: a.invitacionEnviadaAt, ingresos: a.ingresos } : null;
    },
    cursos: async (leadId) => {
      // La MISMA regla que el portal y la ficha: los productos del ALUMNO, y de ésos los que tienen clases.
      const ids = await datos.productosDelAlumno(leadId);
      if (!ids.length) return [];
      const [catalogo, conClases] = await Promise.all([
        productos.listProductos(false),
        Promise.all(ids.map(async (id) => ((await datos.clasesDelProducto(id)).length > 0 ? id : null))),
      ]);
      const nombre = new Map(catalogo.map((x) => [Number(x.id), (x.nombre ?? '').trim()]));
      return conClases.filter((id): id is number => id != null).map((id) => nombre.get(id) || 'tu programa');
    },
    linkDeEntrada: (leadId, ws, autor) => alumno.linkDeEntradaAlumno(leadId, ws, autor),
    reclamar: (leadId) => datos.reclamarInvitacion(leadId),
    soltar: (leadId) => datos.soltarInvitacion(leadId),
    negocio: async (ws) => (await workspace.getWorkspace(ws))?.nombre?.trim() || null,
    entrarConGoogle: () => appUrl.linkApp('/login', null),
    mandar: (m) => invitaciones.invitarAlCursoPorEmail(m),
    marcar: (leadId, email, autor) => datos.marcarInvitacion(leadId, email, autor),
    guardarEmailDelLead: async (leadId, email) => {
      const db = await workspace.getTenantDb();
      const { error } = await db.from('leads').update({ email }).eq('id', leadId);
      if (error) throw new Error(error.message);
    },
  };
}
