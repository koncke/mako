// =============================================================================
// cruce — atar un CLIENTE de la cartera con sus PROYECTOS del tablero
// =============================================================================
// El tablero del cliente (experimento_tareas / tarea_categorias) archiva el trabajo
// de un cliente en un proyecto que se llama «Cliente: NOMBRE» (PREFIJO_CLIENTE, en
// lib/todo-proyectos-catalogo.ts). Ese nombre es lo ÚNICO que une hoy la cartera de
// Customer Success con el tablero — y un nombre es un PARECIDO, no una clave.
//
// ⚠️ LA CLAVE HONESTA EXISTE Y CASI NADIE LA ESCRIBE. `experimento_tareas` tiene
// `cliente_lead_id` (mig 0159) y `tarea_categorias` NO tiene ninguna columna de lead:
// o sea que a nivel TAREA hay clave y a nivel PROYECTO no hay. Medido el 25/09/2026 en
// el ws1: 0 de 212 tareas la traen escrita (el único escritor es lib/plan-propuesta.ts,
// y sólo para lo que nace de un borrador de reunión con el cliente resuelto). Por eso
// acá conviven las dos vías, y la pantalla DICE por cuál entró cada cosa.
//
// ⚠️ Y EL PARECIDO FALLA EN LAS DOS DIRECCIONES, medido sobre los 14 leads ganados del
// ws1 contra sus 9 proyectos «Cliente: …»:
//   · 6 cruzan · 8 clientes sin proyecto · 3 proyectos (30 tareas) sin cliente.
//   · «Cendejas IESCA Inmobiliaria» (lead) NO cruza con «Cliente: Jesús Cendejas»,
//     porque el cruce del repo (`esElProyectoDe`, lib/reunion-cliente.ts) exige que
//     TODAS las palabras del cliente estén en el proyecto, y «iesca» no está.
//   · «Macario Romero» está partido en TRES proyectos y el cruce encontraba uno:
//     la ficha mostraría 17 tareas de 30 afirmando que eso es todo su trabajo.
// De ahí las tres decisiones de este módulo, y ninguna es cosmética:
//   1. El subconjunto vale en LAS DOS DIRECCIONES (cliente ⊆ proyecto o proyecto ⊆
//      cliente), que es lo que arregla el caso Cendejas.
//   2. Un cliente puede atar con VARIOS proyectos, y se devuelven todos.
//   3. Lo que no ata NO SE ESCONDE: sale la lista de clientes sin proyecto y la de
//      proyectos de cliente sin dueño. «Un cliente sin proyecto y un proyecto sin
//      cliente casi siempre son el mismo, corrido» (AGENTS.md).
//
// Sin `server-only` A PROPÓSITO: es la condición que decide qué trabajo se le muestra
// a quién, así que tiene que poder importarla un test (tests/cs-cruce.test.ts) y el
// componente cliente que pinta el rótulo de cómo se ató cada cosa.
// =============================================================================

/** Cómo quedó atado un proyecto a un cliente. El orden es de más duro a más blando. */
export type ComoAto =
  /** `cliente_lead_id` en una de sus tareas: es una CLAVE, no un parecido. */
  | 'clave'
  /** Las palabras de uno están todas en el otro. Es fuerte, pero sigue siendo el nombre. */
  | 'nombre'
  /** Comparten una palabra que no comparte nadie más. Es un PARECIDO y se dice. */
  | 'parecido';

export type ClienteCruce = { leadId: number; nombre: string; empresa: string | null };
export type ProyectoCruce = { id: number; nombre: string };

export type Atadura = { proyectoId: number; como: ComoAto };

export type Cruce = {
  /** leadId → los proyectos que le tocan, del más duro al más blando. */
  porLead: Map<number, Atadura[]>;
  /** Proyectos que SON de un cliente y no ató con ninguno de la cartera. */
  huerfanos: number[];
  /** Clientes de la cartera que no ataron con ningún proyecto. */
  sinProyecto: number[];
};

const norm = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** El prefijo con el que el tablero nombra a un proyecto de cliente, y sus variantes
 *  vivas. Se saca antes de sacar las palabras: si no, «cliente» sería la palabra que
 *  todos comparten y todo cruzaría con todo. */
const PREFIJO = /^(cliente|cuenta)\s*:?\s+/;

/**
 * Palabras que no distinguen a nadie: formas societarias y conectores. Sin esta lista,
 * «Grupo Esquer» y «Grupo Vértice» comparten «grupo» y el cruce blando los ata.
 */
const RUIDO = new Set([
  'del', 'los', 'las', 'por', 'con', 'para', 'the', 'and',
  'sas', 'srl', 'sac', 'sapi', 'spa', 'ltd', 'llc', 'inc', 'cia', 'cía',
  'grupo', 'empresa', 'cuenta', 'cliente', 'proyecto',
]);

/**
 * Las palabras con las que se reconoce a alguien. Normalizadas (sin acentos, sin
 * mayúsculas, sin puntuación), de 3 letras para arriba, sin ruido y sin repetir.
 *
 * ⚠️ 3 y no 2: «HMO» tiene que entrar (es la ciudad con la que el dueño nombra dos
 * cuentas) y «de» no.
 */
export function clavesDe(nombre: string): string[] {
  const limpio = norm(nombre).replace(PREFIJO, '');
  const palabras = limpio.replace(/[^a-z0-9ñ]+/g, ' ').trim().split(/\s+/);
  const out: string[] = [];
  for (const w of palabras) {
    if (w.length < 3 || RUIDO.has(w)) continue;
    if (!out.includes(w)) out.push(w);
  }
  return out;
}

/** Cómo se llama un cliente para el cruce: la empresa si la hay, si no la persona.
 *  Es el mismo criterio que `nucleoCliente` (lib/reunion-cliente.ts), que es el que
 *  usa el ruteo para CREAR el proyecto — cruzar con otro criterio del que crea es
 *  garantizar que no se encuentren. */
const nucleoDe = (c: ClienteCruce): string => (c.empresa?.trim() || c.nombre.trim());

/** ¿Están todas las palabras de `a` en `b`? Con `a` vacío no: un cliente sin ninguna
 *  palabra útil cruzaría con todo. */
const contenido = (a: string[], b: string[]): boolean =>
  a.length > 0 && a.every((w) => b.includes(w));

/**
 * El cruce. `esDeCliente` se INYECTA (en producción es `esProyectoDeCliente`, de
 * lib/todo-rutear.ts, que es server-only): copiar acá su regex sería el segundo lugar
 * donde vive la misma regla, y el segundo se queda viejo.
 *
 * `leadPorProyecto` es la vía dura: para cada proyecto, los leads que alguna de sus
 * tareas declara en `cliente_lead_id`. Gana siempre sobre el nombre.
 */
export function atar(
  clientes: ClienteCruce[],
  proyectos: ProyectoCruce[],
  opciones: {
    esDeCliente: (nombre: string) => boolean;
    leadPorProyecto?: Map<number, Set<number>>;
  },
): Cruce {
  const porLead = new Map<number, Atadura[]>(clientes.map((c) => [c.leadId, []]));
  const atados = new Set<number>();
  const leads = new Set(clientes.map((c) => c.leadId));

  const clavesCliente = new Map<number, string[]>(clientes.map((c) => [c.leadId, clavesDe(nucleoDe(c))]));
  const clavesProy = new Map<number, string[]>(proyectos.map((p) => [p.id, clavesDe(p.nombre)]));

  const agregar = (leadId: number, proyectoId: number, como: ComoAto) => {
    const lista = porLead.get(leadId);
    if (!lista || lista.some((a) => a.proyectoId === proyectoId)) return;
    lista.push({ proyectoId, como });
    atados.add(proyectoId);
  };

  // ── 1. La CLAVE. Una tarea que declara su lead ata el proyecto entero. ───────
  for (const p of proyectos) {
    for (const leadId of opciones.leadPorProyecto?.get(p.id) ?? []) {
      if (leads.has(leadId)) agregar(leadId, p.id, 'clave');
    }
  }

  // ── 2. El NOMBRE, en las dos direcciones. ───────────────────────────────────
  for (const c of clientes) {
    const cc = clavesCliente.get(c.leadId) ?? [];
    for (const p of proyectos) {
      const cp = clavesProy.get(p.id) ?? [];
      if (contenido(cc, cp) || contenido(cp, cc)) agregar(c.leadId, p.id, 'nombre');
    }
  }

  // ── 3. El PARECIDO, y sólo con una palabra que no comparta nadie más. ───────
  // El umbral se eligió mirando los datos, no por razonable: «hmo» está en dos
  // proyectos del ws1 («Cliente: Macario Romero — HMO» y «Cliente: Congelados HMO»),
  // así que atar por una palabra compartida cualquiera le metería a un cliente el
  // trabajo de otro. Exigir que la palabra sea ÚNICA de los dos lados deja pasar
  // «cendejas» (un solo proyecto, un solo lead) y frena «hmo».
  const veces = (mapa: Map<number, string[]>): Map<string, number> => {
    const f = new Map<string, number>();
    for (const ws of mapa.values()) for (const w of ws) f.set(w, (f.get(w) ?? 0) + 1);
    return f;
  };
  const fProy = veces(clavesProy);
  const fCli = veces(clavesCliente);

  for (const c of clientes) {
    const cc = clavesCliente.get(c.leadId) ?? [];
    for (const p of proyectos) {
      if (atados.has(p.id)) continue;
      if (!opciones.esDeCliente(p.nombre)) continue;
      const cp = clavesProy.get(p.id) ?? [];
      const distintiva = cc.find((w) => cp.includes(w) && fProy.get(w) === 1 && fCli.get(w) === 1);
      if (distintiva) agregar(c.leadId, p.id, 'parecido');
    }
  }

  // ── Lo que no ató. No se esconde: son el mismo dato visto de los dos lados. ──
  const huerfanos = proyectos.filter((p) => !atados.has(p.id) && opciones.esDeCliente(p.nombre)).map((p) => p.id);
  const sinProyecto = clientes.filter((c) => !(porLead.get(c.leadId) ?? []).length).map((c) => c.leadId);

  // El orden importa en la pantalla: primero lo que se sabe, después lo que se parece.
  const peso: Record<ComoAto, number> = { clave: 0, nombre: 1, parecido: 2 };
  for (const lista of porLead.values()) lista.sort((a, b) => peso[a.como] - peso[b.como]);

  return { porLead, huerfanos, sinProyecto };
}
