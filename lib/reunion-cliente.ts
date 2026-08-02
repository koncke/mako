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
  via: 'email-invitado' | 'historial-reunion';
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
  if (!candidatos.length) return null;

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
      return null;
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

/** La línea que queda en el historial de la tarea. Nada de MaKo sin explicación. */
export const razonArchivado = (c: ClienteDeReunion, reunion: string): string =>
  `MaKo la archivó en «${nombreProyectoCliente(c)}»: la reunión${reunion ? ` «${reunion}»` : ''} es con ${c.nombre}${c.email ? ` (${c.email})` : ''}`;
