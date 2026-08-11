// =============================================================================
// Whop — la plataforma donde el cliente ve los videos del programa
// =============================================================================
// QUÉ SE LEE DE ACÁ, Y QUÉ NO. Verificado contra la API real el 2026-08-11:
//
//   SÍ  · el avance: qué clase completó cada alumno. Sale del webhook
//         `course_lesson_interaction.completed` y de `listarAlumnos()`. Con eso
//         se recuerda al que se quedó y se le arma a Mauricio el resumen antes
//         de la llamada.
//   NO  · las RESPUESTAS de la tarea. Whop tiene lecciones tipo `quiz` y
//         `knowledge_check`, y un endpoint para ENVIAR un assessment — pero
//         ninguno para LEERLO. Tampoco hay dónde guardar datos propios por
//         miembro. Y el bucle necesita justo eso: leer lo que contestó,
//         reescribirlo con lo hablado en la junta y devolvérselo para que
//         apruebe. Por eso la tarea vive en MaKo y Whop solo la linkea.
//
// UNA SOLA CREDENCIAL, A PROPÓSITO. Casi todos los endpoints piden `company_id`,
// pero NO se le pregunta al usuario: sale de `GET /accounts/me`, que es lo único
// que la API key ya identifica sola. Un campo menos que llenar mal (ver la
// memoria «Minimizar config del usuario»).
// =============================================================================

import 'server-only';

import { credWs } from './credenciales';

const BASE = 'https://api.whop.com/api/v1';

/** El app oficial de Cursos de Whop. Es global (no por cuenta) y está fijo acá
 *  porque `GET /experiences` lo devuelve embebido pero `POST /experiences` lo
 *  EXIGE, y no hay endpoint que lo busque por nombre.
 *  Cómo se vuelve a encontrar si Whop lo rota: `GET /apps?limit=50` paginando y
 *  buscar `name === 'Courses'` con `verified: true`. */
export const APP_CURSOS = 'app_0vPZThfBpAwLo';

export type WhopRes<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

export type Pagina<T> = {
  data: T[];
  page_info: { end_cursor: string | null; has_next_page: boolean };
};

export type Curso = { id: string; title: string; experience_id?: string; visibility?: 'visible' | 'hidden' };
export type Capitulo = { id: string; title: string | null; course_id?: string };
export type TipoLeccion = 'text' | 'video' | 'pdf' | 'multi' | 'quiz' | 'knowledge_check';
export type Leccion = { id: string; title: string | null; lesson_type: TipoLeccion; chapter_id?: string; content?: string | null };
export type Experiencia = { id: string; name: string; app?: { id: string; name: string } };
export type Alumno = { id: string; user?: { id: string; username?: string; email?: string }; completed_lessons_count?: number; progress?: number };
export type Interaccion = { id: string; course_lesson_id?: string; user_id?: string; completed_at?: string | null };

// ── El transporte ────────────────────────────────────────────────────────────

/** No lanza: lo usa la pantalla de integraciones para pintar el estado. */
export async function whopConfigurado(ws?: number): Promise<boolean> {
  return Boolean(await credWs('WHOP_API_KEY', ws));
}

async function whopFetch<T>(path: string, init?: RequestInit, ws?: number): Promise<WhopRes<T>> {
  const token = await credWs('WHOP_API_KEY', ws);
  if (!token) return { ok: false, error: 'Whop no está conectado: falta la API key.' };

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...init?.headers },
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    return { ok: false, error: `Whop no respondió: ${e instanceof Error ? e.message : String(e)}` };
  }

  const texto = await res.text();
  if (!res.ok) {
    // Whop devuelve { error: { type, message } }. Se saca el mensaje humano
    // porque es el que dice qué falta (ej. «Missing required parameter: company_id»).
    let msg = texto.slice(0, 300);
    try { msg = JSON.parse(texto)?.error?.message ?? msg; } catch { /* se queda el crudo */ }
    return { ok: false, error: `Whop ${res.status}: ${msg}`, status: res.status };
  }
  if (!texto) return { ok: true, data: undefined as T };
  try { return { ok: true, data: JSON.parse(texto) as T }; }
  catch { return { ok: false, error: 'Whop devolvió algo que no es JSON.' }; }
}

// ── La company, que se deriva y no se pregunta ───────────────────────────────

/** Cacheado POR WORKSPACE: el valor se deriva de la credencial de ESE workspace
 *  y nunca se comparte entre dos. Un caché global sin esa clave sería un IDOR
 *  silencioso — el segundo cliente heredaría la company del primero. */
const companyPorWs = new Map<number, { id: string; hasta: number }>();
const TTL_COMPANY = 10 * 60 * 1000;

export async function whopCompanyId(ws?: number): Promise<WhopRes<string>> {
  const clave = ws ?? -1;
  const hit = companyPorWs.get(clave);
  if (hit && hit.hasta > Date.now()) return { ok: true, data: hit.id };

  const r = await whopFetch<{ id: string; title?: string }>('/accounts/me', undefined, ws);
  if (!r.ok) return r;
  if (!r.data?.id) return { ok: false, error: 'Whop no devolvió la company de esta key.' };
  companyPorWs.set(clave, { id: r.data.id, hasta: Date.now() + TTL_COMPANY });
  if (ws) void registrarRuteo(ws, r.data.id);
  return { ok: true, data: r.data.id };
}

/**
 * Deja anotado que esta company es de este workspace, para que el webhook —que
 * llega SIN sesión— sepa a quién entregarle el evento.
 *
 * Se hace acá y no pidiéndole el id al usuario porque el id se DERIVA de su
 * propia key: preguntárselo sería un campo más para llenar mal, y peor, un campo
 * que si se llena con el id de otro secuestra los webhooks ajenos. Derivado de
 * la key, eso no puede pasar.
 *
 * Best-effort a propósito: si falla, el avance llega igual en la pasada del
 * cron. `upsertRouting` es primer-reclamante-gana y NO pisa al que ya está.
 */
async function registrarRuteo(ws: number, companyId: string): Promise<void> {
  try {
    const { upsertRouting } = await import('./webhook-routing');
    await upsertRouting('whop', companyId, ws);
  } catch { /* el ruteo es una optimización, no una condición del acceso */ }
}

/** El workspace dueño de un evento entrante de Whop, o null. Fail-closed: sin
 *  mapeo NO se asume el dueño — entregarle a ws1 el evento de otro sería
 *  escribirle avance falso a un cliente. */
export async function wsDeCompany(companyId: string | null | undefined): Promise<number | null> {
  if (!companyId) return null;
  const { wsPorIdentificador } = await import('./webhook-routing');
  return wsPorIdentificador('whop', companyId);
}

/** La cuenta detrás de la key: sirve para mostrar A QUÉ negocio quedó conectado,
 *  que es la única forma de que el usuario note que pegó la key equivocada. */
export async function whopCuenta(ws?: number): Promise<WhopRes<{ id: string; title: string | null; route: string | null }>> {
  const r = await whopFetch<{ id: string; title: string | null; route: string | null }>('/accounts/me', undefined, ws);
  if (!r.ok) return r;
  return { ok: true, data: { id: r.data.id, title: r.data.title ?? null, route: r.data.route ?? null } };
}

// ── Paginación ───────────────────────────────────────────────────────────────

/** Whop pagina por cursor y `has_next_page`. Sin esto, una lista de más de 50
 *  se corta EN SILENCIO y parece que el cliente no avanzó. */
async function todas<T>(path: string, ws?: number, tope = 20): Promise<WhopRes<T[]>> {
  const acc: T[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < tope; i++) {
    const sep = path.includes('?') ? '&' : '?';
    const url: string = cursor ? `${path}${sep}after=${encodeURIComponent(cursor)}` : path;
    const r: WhopRes<Pagina<T>> = await whopFetch<Pagina<T>>(url, undefined, ws);
    if (!r.ok) return r;
    acc.push(...(r.data.data ?? []));
    if (!r.data.page_info?.has_next_page) return { ok: true, data: acc };
    cursor = r.data.page_info.end_cursor;
    if (!cursor) return { ok: true, data: acc };
  }
  return { ok: true, data: acc };
}

// ── Lectura ──────────────────────────────────────────────────────────────────

export async function listarExperiencias(ws?: number): Promise<WhopRes<Experiencia[]>> {
  const biz = await whopCompanyId(ws);
  if (!biz.ok) return biz;
  return todas<Experiencia>(`/experiences?company_id=${biz.data}`, ws);
}

export async function listarCursos(ws?: number): Promise<WhopRes<Curso[]>> {
  const biz = await whopCompanyId(ws);
  if (!biz.ok) return biz;
  return todas<Curso>(`/courses?company_id=${biz.data}`, ws);
}

export async function listarCapitulos(cursoId: string, ws?: number): Promise<WhopRes<Capitulo[]>> {
  return todas<Capitulo>(`/course_chapters?course_id=${encodeURIComponent(cursoId)}`, ws);
}

export async function listarLecciones(capituloId: string, ws?: number): Promise<WhopRes<Leccion[]>> {
  return todas<Leccion>(`/course_lessons?chapter_id=${encodeURIComponent(capituloId)}`, ws);
}

/** Los alumnos de un curso, con su avance. Es la mitad del «quién se quedó». */
export async function listarAlumnos(cursoId: string, ws?: number): Promise<WhopRes<Alumno[]>> {
  return todas<Alumno>(`/course_students?course_id=${encodeURIComponent(cursoId)}`, ws);
}

/** Qué lecciones tocó cada alumno. La otra mitad: `listarAlumnos` da el total,
 *  esto da CUÁL, que es lo que decide qué bloque toca en la próxima junta. */
export async function listarInteracciones(cursoId: string, ws?: number): Promise<WhopRes<Interaccion[]>> {
  return todas<Interaccion>(`/course_lesson_interactions?course_id=${encodeURIComponent(cursoId)}`, ws);
}

// ── Escritura ────────────────────────────────────────────────────────────────

export async function crearExperiencia(nombre: string, ws?: number): Promise<WhopRes<Experiencia>> {
  const biz = await whopCompanyId(ws);
  if (!biz.ok) return biz;
  return whopFetch<Experiencia>('/experiences', {
    method: 'POST',
    body: JSON.stringify({ app_id: APP_CURSOS, company_id: biz.data, name: nombre }),
  }, ws);
}

export async function crearCurso(
  input: { experienceId: string; titulo: string; bajada?: string; visible?: boolean; enOrden?: boolean },
  ws?: number,
): Promise<WhopRes<Curso>> {
  return whopFetch<Curso>('/courses', {
    method: 'POST',
    body: JSON.stringify({
      experience_id: input.experienceId,
      title: input.titulo,
      tagline: input.bajada ?? null,
      // Por defecto NACE OCULTO. Un curso a medio cargar visible es peor que no
      // tenerlo: el cliente entra, ve tres clases sueltas y se va.
      visibility: input.visible ? 'visible' : 'hidden',
      require_completing_lessons_in_order: input.enOrden ?? true,
    }),
  }, ws);
}

export async function crearCapitulo(cursoId: string, titulo: string, ws?: number): Promise<WhopRes<Capitulo>> {
  return whopFetch<Capitulo>('/course_chapters', {
    method: 'POST',
    body: JSON.stringify({ course_id: cursoId, title: titulo }),
  }, ws);
}

export async function crearLeccion(
  input: {
    capituloId: string;
    titulo: string;
    tipo?: TipoLeccion;
    /** Markdown. Acá va el enunciado de la tarea y el link a MaKo. */
    contenido?: string;
    embed?: { tipo: 'youtube' | 'loom'; id: string };
  },
  ws?: number,
): Promise<WhopRes<Leccion>> {
  return whopFetch<Leccion>('/course_lessons', {
    method: 'POST',
    body: JSON.stringify({
      chapter_id: input.capituloId,
      // `text` mientras no haya video: una lección `video` sin embed queda rota
      // en la UI de Whop y el alumno no la puede completar.
      lesson_type: input.tipo ?? (input.embed ? 'video' : 'text'),
      title: input.titulo.slice(0, 120), // el límite de Whop; cortar acá evita un 400 opaco
      content: input.contenido ?? null,
      embed_type: input.embed?.tipo ?? null,
      embed_id: input.embed?.id ?? null,
    }),
  }, ws);
}

/** Reescribe el cuerpo (y opcionalmente el video) de una lección que ya existe.
 *
 *  Hace falta de verdad: el cargador es idempotente por TÍTULO, así que sin esto
 *  una lección creada con el texto equivocado se queda con él para siempre — y
 *  el día que se grabe el video no habría forma de engancharlo sin borrar y
 *  volver a crear, perdiendo el avance de quien ya la completó. */
export async function actualizarLeccion(
  leccionId: string,
  cambios: { titulo?: string; contenido?: string; tipo?: TipoLeccion; embed?: { tipo: 'youtube' | 'loom'; id: string } },
  ws?: number,
): Promise<WhopRes<Leccion>> {
  const body: Record<string, unknown> = {};
  if (cambios.titulo !== undefined) body.title = cambios.titulo.slice(0, 120);
  if (cambios.contenido !== undefined) body.content = cambios.contenido;
  if (cambios.tipo !== undefined) body.lesson_type = cambios.tipo;
  if (cambios.embed) { body.embed_type = cambios.embed.tipo; body.embed_id = cambios.embed.id; body.lesson_type = cambios.tipo ?? 'video'; }
  return whopFetch<Leccion>(`/course_lessons/${encodeURIComponent(leccionId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  }, ws);
}

// ── El webhook ───────────────────────────────────────────────────────────────

// La firma la verifica `lib/standard-webhooks.ts`: Whop firma con Standard
// Webhooks (Svix), el MISMO esquema que Fathom y Resend. No hay una tercera
// implementación acá a propósito.
//
// ⚠️ Lo escribí mal la primera vez —estilo Stripe, `t=…,v1=<hex>`, con el
// secreto crudo como clave— y habría rechazado el 100% de los webhooks con un
// error indistinguible de un secreto mal pegado. Los tres detalles que fallan
// siempre están escritos arriba de standard-webhooks.ts.

export type EventoWhop = {
  /** ej. `course_lesson_interaction.completed` */
  event?: string;
  action?: string;
  data?: Record<string, unknown>;
};

/** El id de lección que trae un evento de avance, mirando los nombres que Whop
 *  usa indistintamente. Devuelve null en vez de inventar: un id equivocado
 *  marca completado el bloque de otra clase. */
export function leccionDelEvento(ev: EventoWhop): string | null {
  const d = ev.data ?? {};
  for (const k of ['course_lesson_id', 'lesson_id', 'id']) {
    const v = d[k];
    if (typeof v === 'string' && v.startsWith('less')) return v;
  }
  const anidado = d.course_lesson as { id?: unknown } | undefined;
  if (anidado && typeof anidado.id === 'string') return anidado.id;
  return null;
}
