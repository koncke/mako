import 'server-only';

// =============================================================================
// reunion-cliente — ¿de qué CLIENTE es esta reunión? (y a qué proyecto va)
// =============================================================================
// El problema medido: de 51 tareas que salieron de reuniones con clientes de
// Mauricio, el modelo archivó bien 2. Repartió el trabajo de una sola llamada
// entre proyectos temáticos que él mismo inventó ("Sistemas y Formulario
// Operativo", "Capacitación Operativa"), y hasta metió tareas de un cliente en el
// proyecto de OTRO. Mauricio lo dijo en una línea: «si proviene de una llamada con
// cliente, debería clasificarla al cliente».
//
// LA REGLA, entonces: el proyecto lo define LA REUNIÓN, no el tema de cada tarea.
// Una llamada con Sergio Esquer deja tareas de Grupo Esquer, hablen de sistemas, de
// capacitación o de cobranza. El tema es el título de la tarea; el cliente es dónde
// se archiva.
//
// Y se resuelve en el SERVIDOR con datos duros (el email del invitado contra el
// CRM), no pidiéndole al modelo que adivine del texto. Es determinístico, barato y
// auditable — el mismo criterio que ya usa reunion-clasificar.ts para decidir si una
// reunión es de ventas o de equipo.
//
// REGLA DURA: sin certeza NO se inventa nada. Se devuelve null y el que llama
// pregunta. Archivar en el cliente equivocado es peor que no archivar: ensucia el
// plan de dos clientes a la vez y nadie se entera.
// =============================================================================

import { getTenantDb } from './workspace';
import { listCategorias, crearCategoria } from './todo';

/** El cliente al que pertenece una reunión, con de dónde salió la certeza. */
export type ClienteDeReunion = {
  leadId: number;
  /** Cómo se lo nombra: la empresa si la hay, si no la persona. */
  nombre: string;
  empresa: string | null;
  /** email con el que se lo reconoció (para el rastro en el historial). */
  email: string;
  via: 'email-invitado' | 'historial-reunion' | 'nombre-en-texto';
  confianza: 'alta' | 'media';
};

const norm = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** Nombre del proyecto de un cliente. Tope 40 (crearCategoria trunca ahí). */
export const nombreProyectoCliente = (c: { empresa: string | null; nombre: string }): string =>
  (c.empresa?.trim() || c.nombre.trim()).slice(0, 40);

/**
 * ¿Esta reunión es con un cliente del workspace? Dos vías, las dos con evidencia:
 *
 *  A) el email de un invitado externo está en el CRM (`leads.email`) → alta.
 *  B) el CRM no lo trae, pero YA hubo reuniones con el mismo título apuntando a un
 *     único lead → media. Hace falta porque Fathom, en varias grabaciones, devuelve
 *     como participante SOLO al que grabó: sin esta vía, media agenda queda sin
 *     cliente aunque el CRM lo tenga.
 *
 * Si hay más de un lead candidato, devuelve null: con dos clientes en la misma
 * llamada, elegir uno es adivinar.
 */
export async function resolverClienteDeReunion(r: {
  titulo?: string | null;
  participantes?: Array<{ nombre?: string; email?: string | null }>;
  /** emails sueltos (host, action items) por si no vienen como participantes. */
  emails?: string[];
}): Promise<ClienteDeReunion | null> {
  const candidatos = [
    ...(r.participantes ?? []).map((p) => p.email ?? ''),
    ...(r.emails ?? []),
  ].map((e) => norm(e)).filter((e) => e.includes('@'));
  // Sin un solo email del que agarrarse queda el título, que es la vía de la mitad de
  // la agenda: Fathom devuelve como participante SOLO al que grabó en muchas
  // grabaciones, y ahí la única señal es que la reunión se llama "Baja Teriyaki -
  // Seguimiento". Es más débil que el email, por eso va última y nunca lo pisa.
  if (!candidatos.length) return porTitulo(r.titulo);

  try {
    const db = await getTenantDb();
    const { data, error } = await db.from('leads').select('id, nombre, empresa, email').in('email', [...new Set(candidatos)]);
    if (error) { console.error('[reunion-cliente] leads:', error.message); return null; }
    const leads = (data ?? []) as Array<{ id: number; nombre: string | null; empresa: string | null; email: string | null }>;
    // Sin lead, o con VARIOS: no se elige. Dos clientes en la misma llamada es un
    // caso real (una presentación conjunta) y ahí la respuesta correcta es preguntar.
    const unicos = new Map(leads.map((l) => [l.id, l]));
    if (unicos.size !== 1) {
      if (unicos.size > 1) console.warn(`[reunion-cliente] «${r.titulo ?? ''}»: ${unicos.size} clientes en la misma reunión — no asigno, que elija el dueño`);
      // Con VARIOS no se elige nunca. Con NINGUNO todavía queda el título.
      return unicos.size > 1 ? null : await porTitulo(r.titulo);
    }
    const l = [...unicos.values()][0];
    return {
      leadId: l.id,
      nombre: (l.nombre ?? l.empresa ?? l.email ?? '').trim(),
      empresa: l.empresa?.trim() || null,
      email: (l.email ?? '').trim(),
      via: 'email-invitado',
      confianza: 'alta',
    };
  } catch (e) { console.error('[reunion-cliente] resolver', e); return null; }
}

/** El cliente que NOMBRA el título de la reunión, cuando no hubo email que mirar. */
async function porTitulo(titulo?: string | null): Promise<ClienteDeReunion | null> {
  const t = (titulo ?? '').trim();
  return t.length >= 4 ? clienteEnTexto(t).catch(() => null) : null;
}

/**
 * El proyecto de ese cliente en el tablero: el que ya existe (match por nombre SIN
 * acentos, que es donde se colaban los duplicados tipo "Vértice"/"Vertice") o uno
 * nuevo. Devuelve el id de la categoría.
 *
 * "Crearlo si no está" es explícito del pedido: lo que NO se hace es inventar
 * proyectos POR TEMA. Uno por cliente, y todas sus tareas ahí.
 */
export async function proyectoDeCliente(c: ClienteDeReunion): Promise<number | null> {
  const nombre = nombreProyectoCliente(c);
  if (!nombre) return null;
  try {
    const cats = await listCategorias();
    // Coincidencia exacta normalizada, o el proyecto cuyo nombre CONTIENE al del
    // cliente ("Cuenta Grupo Esquer" para el lead "Grupo Esquer"): el dueño ya le
    // puso su nombre y no hay que crearle otro al lado.
    const n = norm(nombre);
    const ya = cats.find((x) => norm(x.nombre) === n)
      ?? cats.find((x) => n.length > 4 && norm(x.nombre).includes(n));
    if (ya) return ya.id;
    const nueva = await crearCategoria(nombre, '#0E9B8E');
    console.log(`[reunion-cliente] proyecto creado para el cliente: «${nombre}» (#${nueva.id})`);
    return nueva.id;
  } catch (e) { console.error('[reunion-cliente] proyectoDeCliente', e); return null; }
}

/**
 * El cliente NOMBRADO en un texto (título + detalle de una tarea). Es la vía para
 * los orígenes que NO son una reunión —WhatsApp, Claude Code, alta manual—, donde
 * no hay email de invitado del que agarrarse.
 *
 * Solo matchea la EMPRESA o el nombre COMPLETO, como frase entera y de 4 letras
 * para arriba. Nunca un nombre de pila suelto: "Adriana" matchea tres leads que no
 * tienen nada que ver entre sí, y ahí el match no informa, inventa. Con más de un
 * candidato devuelve null: que pregunte.
 */
export async function clienteEnTexto(texto: string): Promise<ClienteDeReunion | null> {
  const t = ` ${norm(texto)} `;
  if (t.trim().length < 4) return null;
  try {
    const db = await getTenantDb();
    // Solo los CLIENTES, no todo el CRM. Un cliente es un lead GANADO; el resto son
    // prospectos y no tienen proyecto en el plan. Y además es lo que hace viable la
    // búsqueda: traer "los primeros 500 leads" sin orden es una lotería —en un CRM de
    // cientos de filas los 9 clientes reales podían no entrar en esa página.
    const { data } = await db.from('leads').select('id, nombre, empresa, email').eq('estado_lead', 'ganado').limit(200);
    const leads = (data ?? []) as Array<{ id: number; nombre: string | null; empresa: string | null; email: string | null }>;
    const hits = leads.filter((l) => {
      // Empresa siempre; nombre de persona SOLO si es completo (tiene apellido).
      const claves = [norm(l.empresa ?? ''), norm(l.nombre ?? '').includes(' ') ? norm(l.nombre ?? '') : '']
        .filter((k) => k.length >= 4);
      return claves.some((k) => t.includes(` ${k} `));
    });
    const unicos = new Map(hits.map((l) => [l.id, l]));
    if (unicos.size !== 1) return null;
    const l = [...unicos.values()][0];
    return {
      leadId: l.id,
      nombre: (l.nombre ?? l.empresa ?? '').trim(),
      empresa: l.empresa?.trim() || null,
      email: (l.email ?? '').trim(),
      via: 'nombre-en-texto',
      confianza: 'media',
    };
  } catch (e) { console.error('[reunion-cliente] clienteEnTexto', e); return null; }
}

/**
 * El proyecto que le toca a UNA tarea suelta (sin reunión detrás): el del cliente
 * que nombra, y si no nombra a ninguno, el que venía sugerido. Devuelve también por
 * qué, para el historial. Es el punto por el que pasan WhatsApp y Claude Code.
 */
export async function proyectoParaTarea(t: { titulo: string; detalle?: string | null; proyectoSugerido?: string }): Promise<{ nombre: string | undefined; cliente: ClienteDeReunion | null; porProyecto?: string }> {
  const texto = `${t.titulo} ${t.detalle ?? ''}`;
  const cliente = await clienteEnTexto(texto).catch(() => null);
  if (cliente) return { nombre: nombreProyectoCliente(cliente), cliente };
  // Segunda vía: el texto nombra un proyecto que YA EXISTE. Es la señal más fuerte
  // de todas —el dueño ya decidió que ese cliente merece un proyecto y le puso el
  // nombre— y además es literalmente "usá los que hay en vez de inventar uno".
  // Cubre a los clientes que todavía no están marcados como ganados en el CRM.
  const yaExiste = await proyectoNombradoEnTexto(texto).catch(() => null);
  if (yaExiste) return { nombre: yaExiste, cliente: null, porProyecto: yaExiste };
  return { nombre: t.proyectoSugerido?.trim() || undefined, cliente: null };
}

// Los proyectos del seed de arranque son de TEMAS, no de clientes: que una tarea diga
// "seguimiento por whatsapp" no la hace del proyecto "Montar el seguimiento por
// WhatsApp". Se excluyen del match por texto.
const GENERICOS = ['setup inicial', 'anuncio ganador', 'primeros 10 clientes', 'validar el funnel',
  'seguimiento por whatsapp', 'escalar la campa', 'banco de creativos', 'tablero de n'];

/** El proyecto EXISTENTE que el texto nombra, si hay exactamente uno y no es genérico. */
export async function proyectoNombradoEnTexto(texto: string): Promise<string | null> {
  const t = ` ${norm(texto)} `;
  try {
    const cats = await listCategorias();
    const hits = cats.filter((c) => {
      const n = norm(c.nombre);
      if (n.length < 5 || GENERICOS.some((g) => n.includes(g))) return false;
      // El nombre completo, o el núcleo sin el prefijo que le puso el dueño
      // ("Cuenta Grupo Esquer" → "grupo esquer", "Cliente Baja Teriyaki" → "baja teriyaki").
      const nucleo = n.replace(/^(cuenta|cliente|proyecto)\s+/, '');
      return t.includes(` ${n} `) || (nucleo.length >= 5 && t.includes(` ${nucleo} `));
    });
    return hits.length === 1 ? hits[0].nombre : null;
  } catch { return null; }
}

/** Una opción de la pregunta "¿a qué cliente va esta reunión?". */
export type OpcionCliente = { nombre: string; sub: string };

/**
 * Las opciones para PREGUNTAR cuando no hubo certeza. La regla del dueño es "si no
 * estás seguro, preguntá" — pero preguntar con un campo abierto es pedirle que
 * escriba un nombre nuevo, que es exactamente cómo aparecen los proyectos inventados.
 * Así que la pregunta es cerrada y lo que se ofrece ya existe: primero quien estuvo
 * en la llamada, después sus proyectos, después el resto de sus clientes.
 *
 * Devuelve [] cuando no hay nada que ofrecer: ahí no se pregunta al vacío.
 */
export async function opcionesDeCliente(r: {
  participantes?: Array<{ nombre?: string; email?: string | null }>;
  emails?: string[];
}): Promise<OpcionCliente[]> {
  const emails = [...(r.participantes ?? []).map((p) => p.email ?? ''), ...(r.emails ?? [])]
    .map((e) => norm(e)).filter((e) => e.includes('@'));
  const out: OpcionCliente[] = [];
  const vistos = new Set<string>();
  const sumar = (nombre: string, sub: string) => {
    const n = norm(nombre);
    if (!n || vistos.has(n)) return;
    vistos.add(n); out.push({ nombre: nombre.trim().slice(0, 40), sub });
  };
  try {
    const db = await getTenantDb();
    const [enLlamada, clientes, cats] = await Promise.all([
      emails.length
        ? db.from('leads').select('nombre, empresa').in('email', [...new Set(emails)]).then((x) => x.data ?? [])
        : Promise.resolve([]),
      db.from('leads').select('nombre, empresa').eq('estado_lead', 'ganado').limit(200).then((x) => x.data ?? []),
      listCategorias(),
    ]);
    type L = { nombre: string | null; empresa: string | null };
    for (const l of enLlamada as L[]) sumar(l.empresa?.trim() || l.nombre?.trim() || '', 'Estuvo en la reunión');
    for (const c of cats) if (!GENERICOS.some((g) => norm(c.nombre).includes(g))) sumar(c.nombre, 'Proyecto que ya existe');
    for (const l of clientes as L[]) sumar(l.empresa?.trim() || l.nombre?.trim() || '', 'Cliente del CRM');
  } catch (e) { console.error('[reunion-cliente] opcionesDeCliente', e); }
  return out.slice(0, 14);
}

/** La línea que queda en el historial de la tarea. Nada de MaKo sin explicación. */
export const razonArchivado = (c: ClienteDeReunion, reunion: string): string =>
  `MaKo la archivó en «${nombreProyectoCliente(c)}»: la reunión${reunion ? ` «${reunion}»` : ''} es con ${c.nombre}${c.email ? ` (${c.email})` : ''}`;
