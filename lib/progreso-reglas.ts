// =============================================================================
// Progreso del Centro de Operaciones — las reglas, sin base, sin red y sin React
// =============================================================================
// Pedido de Martín (15/10/2026): «quiero que dentro del Centro, construyas una sección de "Progreso"
// donde se vea lo que estamos trabajando actualmente, mis pedidos y los pushes. Hazlo tipo tabla y
// que este BIEN diseñado». Y horas después, desde el teléfono: «Sigo sin ver los pendientes».
//
// Tres vistas, copiadas de apps que ya resolvieron «en qué anda cada cosa»:
//   · En curso: los frentes con actividad (la vista de tabla de GitHub Projects, agrupada).
//   · Pedidos: lo que Martín pidió, y qué salió de cada pedido (el «Activity» de un issue de Linear).
//   · Pushes: lo que llegó a producción (la lista de deployments de Vercel).
//
// ⚠️ LAS FUENTES SON LAS QUE YA EXISTEN, y cada una dice algo distinto:
//   · Las bitácoras de /admin/dev (`app/admin/dev/<área>/bitacora.ts`) traen los pedidos TEXTUALES y lo
//     que salió de cada uno. Viajan dentro del build: dicen lo que está DESPLEGADO, nunca lo que está
//     escrito en la PC sin subir (eso lo sube el cartero, cuando esté instalado).
//   · La API de Vercel trae cada push a producción con su commit, su estado y cuánto tardó.
// ⚠️ Un pedido se ve recién cuando un chat lo anota en su bitácora: lo que Martín pidió y nadie anotó
//    todavía no está, y la pantalla lo dice.
// ⚠️ SIN `server-only`, a propósito: lo leen el servidor, las pantallas y los tests.

/** Lo mínimo de un hito de bitácora (app/admin/dev/_registro/tipos.ts → Hito). */
export type HitoP = {
  fecha: string;
  hora: string;
  chat: string;
  /** La sesión que lo anotó (`local_…`/`cli_…`), si el hito la trae. */
  sesion?: string;
  cuenta: string;
  actor: string;
  tipo: string;
  titulo: string;
  pedido?: string;
  puntos: string[];
  commits?: Array<{ sha: string; msg: string }>;
};

export type AreaP = { slug: string; titulo: string; bitacora: readonly HitoP[]; /** La pantalla donde se mira (areas.ts). */ verEnApp?: string | null };

const MES: Record<string, number> = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11 };
/** Las bitácoras anotan la hora de Argentina (UTC-3, sin horario de verano). */
const DESFASE_AR_MS = 3 * 60 * 60 * 1000;

/**
 * «15 oct» + «05:01» → el instante (hora de Argentina). La bitácora no escribe el año: es el de `ahora`,
 * salvo que eso caiga más de un día en el futuro (una entrada de diciembre leída en enero).
 */
export function instanteHito(fecha: string, hora: string, ahora: number): number | null {
  const m = String(fecha ?? '').trim().match(/^(\d{1,2})\s+([a-záéíóú]{3})/i);
  if (!m) return null;
  const mes = MES[m[2].toLowerCase()];
  if (mes == null) return null;
  const [hh, mm] = String(hora ?? '').split(':').map(Number);
  const anio = new Date(ahora - DESFASE_AR_MS).getUTCFullYear();
  const t = (y: number) => Date.UTC(y, mes, Number(m[1]), Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0) + DESFASE_AR_MS;
  const este = t(anio);
  return este > ahora + 86_400_000 ? t(anio - 1) : este;
}

export const ROTULO_TIPO: Record<string, string> = {
  prompt: 'Pedido', implementacion: 'Hecho', correccion: 'Corrección', investigacion: 'Investigando', cosecha: 'Cosecha',
};

// El Centro ya no tiene pestañas (15/10/2026, a la noche; Martín: «Elimina lo de "Avances y pushes", quiero que cada
// chat tenga arriba, en su topbar un botón para ver los avances»): lo que eran Avance y Pushes es la barra derecha de
// cada conversación (app/admin/operaciones/Avance.tsx). Un `?tab=` viejo abre los chats.

// ── En curso ──────────────────────────────────────────────────────────────────────────────────
export type Frente = {
  slug: string;
  area: string;
  chat: string;
  /** Lo último que pasó en ese frente. */
  ultimo: string;
  tipo: string;
  instante: number;
  /** Cuántos hitos tuvo en la ventana. */
  movimientos: number;
  /** Pedidos de la ventana que todavía no tienen nada hecho. */
  pendientes: number;
};

/** Los frentes con actividad en los últimos `horas`, el más reciente primero. */
export function frentesEnCurso(areas: readonly AreaP[], ahora: number, horas = 48): Frente[] {
  const desde = ahora - horas * 3_600_000;
  const out: Frente[] = [];
  for (const a of areas) {
    const conT = a.bitacora.map((h) => ({ h, t: instanteHito(h.fecha, h.hora, ahora) }))
      .filter((x): x is { h: HitoP; t: number } => x.t != null && x.t >= desde && x.t <= ahora + 60_000);
    if (!conT.length) continue;
    const ult = conT.reduce((a2, b) => (b.t >= a2.t ? b : a2));
    const pendientes = cadenas(a, ahora).filter((c) => c.instante >= desde && c.estado === 'pendiente').length;
    out.push({
      slug: a.slug, area: a.titulo, chat: ult.h.chat, ultimo: ult.h.titulo, tipo: ult.h.tipo,
      instante: ult.t, movimientos: conT.length, pendientes,
    });
  }
  return out.sort((x, y) => y.instante - x.instante);
}

// ── Pedidos ───────────────────────────────────────────────────────────────────────────────────
export type EstadoPedidoP = 'pendiente' | 'en_curso' | 'hecho';
/** Con sus palabras: «terminadas, empezadas» y lo pendiente. */
export const ROTULO_PEDIDO: Record<EstadoPedidoP, string> = { pendiente: 'Sin empezar', en_curso: 'Empezado', hecho: 'Terminado' };

export type PasoP = {
  instante: number | null; chat: string; sesion: string | null; tipo: string; titulo: string; commits: Array<{ sha: string; msg: string }>;
  /** La cuenta de Claude que lo anotó: el avance de un chat la muestra como chip (Martín: «con un chip... de en que
   *  cuenta se trabajó... Y en el progreso, en el detalle»). */
  cuenta: string | null;
};

export type PedidoP = {
  /** Estable entre cargas: el área y su lugar en la bitácora (se escribe al final, así que no se corre). Con
   *  fecha, hora y el principio del texto chocaban dos pedidos del mismo día anotados con la hora «—». */
  id: string;
  texto: string;
  titulo: string;
  instante: number;
  /** Dónde lo anotaron. Un mismo pedido puede estar en varias áreas: van todas. */
  areas: string[];
  /** El chat que lo tomó (el del primer paso después del pedido), o null si nadie todavía. */
  tomo: string | null;
  estado: EstadoPedidoP;
  pasos: PasoP[];
  commits: Array<{ sha: string; msg: string }>;
  /** Cuántos pedidos más se anotaron en la misma tanda: lo que siguió responde a todos juntos. */
  junto: number;
  /** Lo último que se movió: el pedido o su último paso. */
  ultimo: number;
  /** Cuándo se anotó lo que lo cerró (la implementación, la corrección o el commit), si se cerró. */
  cierre: number | null;
  /** Dónde lo pidió Martín: el chat del hito del pedido (26 de 289 se piden en uno y los trabaja otro). */
  pidioEn: { chat: string; sesion: string | null };
};

/** Lo que cierra un pedido: un paso que HIZO algo (la bitácora viaja con el build, así que está subido). */
const CIERRA = new Set(['implementacion', 'correccion']);

/**
 * Los pedidos de UN área con lo que salió de cada uno. Un pedido es un hito `prompt`, y su respuesta es lo
 * que sigue en la bitácora hasta el pedido siguiente (las bitácoras se escriben en orden, «se agrega AL
 * FINAL»). Con una implementación, una corrección o un commit en esa respuesta está hecho; con pasos que
 * sólo investigan, en curso; sin nada, pendiente.
 *
 * ⚠️ LOS PEDIDOS SE ANOTAN EN TANDA (medido el 15/10/2026): un chat anota los cuatro pedidos de un mensaje
 * de Martín seguidos y DESPUÉS lo que hizo. Con «lo que sigue hasta el próximo prompt», 72 de los 80
 * «pendientes» de 14 días tenían el trabajo hecho más abajo, y la pestaña decía 78 pendientes. Los prompts
 * seguidos son una tanda y comparten la respuesta que viene después de la tanda (`junto` lo dice).
 */
export function cadenas(a: AreaP, ahora: number): PedidoP[] {
  const out: PedidoP[] = [];
  const b = a.bitacora;
  for (let ini = 0; ini < b.length; ini++) {
    if (b[ini].tipo !== 'prompt') continue;
    let fin = ini;
    while (fin + 1 < b.length && b[fin + 1].tipo === 'prompt') fin++;
    const pasos: PasoP[] = [];
    for (let j = fin + 1; j < b.length && b[j].tipo !== 'prompt'; j++) {
      const p = b[j];
      pasos.push({
        instante: instanteHito(p.fecha, p.hora, ahora), chat: p.chat, sesion: p.sesion ?? null, tipo: p.tipo, titulo: p.titulo,
        commits: (p.commits ?? []).map((c) => ({ sha: c.sha, msg: c.msg })), cuenta: p.cuenta || null,
      });
    }
    const commits = pasos.flatMap((p) => p.commits);
    const estado: EstadoPedidoP = commits.length || pasos.some((p) => CIERRA.has(p.tipo)) ? 'hecho' : pasos.length ? 'en_curso' : 'pendiente';
    const cierre = pasos.find((p) => CIERRA.has(p.tipo) || p.commits.length)?.instante ?? null;
    const ultimoPaso = Math.max(...pasos.map((p) => p.instante ?? 0), 0);
    for (let i = ini; i <= fin; i++) {
      const h = b[i];
      const instante = instanteHito(h.fecha, h.hora, ahora);
      if (instante == null) continue;
      const texto = (h.pedido ?? '').trim() || h.titulo;
      out.push({
        id: `${a.slug}:${i}`,
        texto, titulo: h.titulo, instante, areas: [a.titulo],
        tomo: pasos[0]?.chat ?? null,
        estado, pasos, commits, junto: fin - ini,
        ultimo: Math.max(instante, ultimoPaso), cierre: estado === 'hecho' ? (cierre ?? ultimoPaso) || null : null,
        pidioEn: { chat: h.chat, sesion: h.sesion ?? null },
      });
    }
    ini = fin;
  }
  return out;
}

const normal = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Los pedidos de los últimos `dias`, de todas las áreas, el más reciente primero. El mismo pedido anotado
 * en dos bitácoras (un pedido que tocó dos áreas) es UNO: se juntan sus áreas, sus pasos y sus commits, y
 * vale el estado más avanzado.
 */
export function pedidosRecientes(areas: readonly AreaP[], ahora: number, dias = 14): PedidoP[] {
  const desde = ahora - dias * 86_400_000;
  const por = new Map<string, PedidoP>();
  const orden: EstadoPedidoP[] = ['pendiente', 'en_curso', 'hecho'];
  for (const a of areas) {
    for (const p of cadenas(a, ahora)) {
      if (p.instante < desde) continue;
      const clave = `${normal(p.texto).slice(0, 160)}|${Math.round(p.instante / 3_600_000)}`;
      const ya = por.get(clave);
      if (!ya) { por.set(clave, p); continue; }
      ya.areas = [...new Set([...ya.areas, ...p.areas])];
      ya.pasos = [...ya.pasos, ...p.pasos];
      const vistos = new Set(ya.commits.map((c) => c.sha));
      ya.commits = [...ya.commits, ...p.commits.filter((c) => !vistos.has(c.sha))];
      if (orden.indexOf(p.estado) > orden.indexOf(ya.estado)) ya.estado = p.estado;
      ya.tomo = ya.tomo ?? p.tomo;
      ya.junto = Math.max(ya.junto, p.junto);
      ya.ultimo = Math.max(ya.ultimo, p.ultimo);
      if (p.cierre != null && (ya.cierre == null || p.cierre < ya.cierre)) ya.cierre = p.cierre;
    }
  }
  return [...por.values()].sort((x, y) => y.instante - x.instante);
}

/** Lo que viaja a la pantalla de cada pedido, recortado (son ~300 en 14 días): el texto entero va
 *  hasta 800 caracteres, y de cada paso, el título y hasta 6 commits. `corto`: lo terminado hace rato,
 *  que se lee de pasada (`pedidosDelCentro`). */
export function recortarPedido(p: PedidoP, corto = false): PedidoP {
  const commit = (c: { sha: string; msg: string }) => ({ sha: c.sha, msg: c.msg.slice(0, corto ? 100 : 140) });
  return {
    ...p,
    texto: p.texto.slice(0, corto ? 300 : 800),
    pasos: p.pasos.slice(0, corto ? 4 : 12).map((s) => ({ ...s, titulo: s.titulo.slice(0, corto ? 120 : 200), commits: s.commits.slice(0, corto ? 2 : 6).map(commit) })),
    commits: p.commits.slice(0, corto ? 4 : 20).map(commit),
  };
}

/** Todo el historial: las bitácoras empiezan en 2026, así que diez años son «todas las fechas». */
export const DIAS_HISTORIAL = 3650;
/** Lo terminado en los últimos días va entero; lo de antes, corto. */
export const DIAS_ENTERO = 14;

/**
 * Los pedidos que ve el Centro: TODAS las fechas (Martín, 16/10/2026: «Deberías traer mayor historial porque el
 * "progreso" de la mayoría es casi nulo... Sobre todo me interesa ver las cosas que pedí y están pendientes»). Lo que
 * no está terminado va entero siempre; lo terminado hace más de `DIAS_ENTERO`, corto.
 * ⚠️ El peso, medido el 16/10/2026: 295 pedidos en 14 días eran 448 KB; los 387 de todas las fechas, 650 KB enteros.
 * ⚠️ Y LA VENTANA NO ERA LO QUE FALTABA: con todas las fechas sólo suman 92 pedidos. El avance casi vacío venía de que
 * 75 de los 81 chats de las bitácoras se conocen sólo por un nombre que ningún chat vivo tiene (lib/centro-chats.ts →
 * `completarChats`, el paso 3, los manda al jefe de su tab).
 */
export function pedidosDelCentro(areas: readonly AreaP[], ahora: number): PedidoP[] {
  const desde = ahora - DIAS_ENTERO * 86_400_000;
  return pedidosRecientes(areas, ahora, DIAS_HISTORIAL).map((p) => recortarPedido(p, p.estado === 'hecho' && p.ultimo < desde));
}

/**
 * Los cuatro grupos de la pantalla. «Trabajando ahora» es lo empezado que un chat movió en las últimas 48 h;
 * lo empezado que quedó quieto va aparte, para que no se lea como trabajo vivo. Sin el cartero, «ahora» es
 * lo ANOTADO: lo que un chat hace en este momento y todavía no escribió en su bitácora no se ve.
 */
export type GrupoPedido = 'ahora' | 'sin_empezar' | 'empezado' | 'terminado';
export const GRUPOS_PEDIDO: readonly GrupoPedido[] = ['ahora', 'sin_empezar', 'empezado', 'terminado'];
export const ROTULO_GRUPO: Record<GrupoPedido, string> = {
  ahora: 'Trabajando ahora', sin_empezar: 'Sin empezar', empezado: 'Empezado, sin movimiento', terminado: 'Terminado',
};
export const VENTANA_AHORA_MS = 48 * 3_600_000;

export function grupoPedido(p: Pick<PedidoP, 'estado' | 'ultimo'>, ahora: number): GrupoPedido {
  if (p.estado === 'hecho') return 'terminado';
  if (p.estado === 'pendiente') return 'sin_empezar';
  return ahora - p.ultimo <= VENTANA_AHORA_MS ? 'ahora' : 'empezado';
}

// ── Pushes ────────────────────────────────────────────────────────────────────────────────────
export type EstadoPush = 'listo' | 'error' | 'construyendo' | 'en_cola' | 'cancelado';
export const ROTULO_PUSH: Record<EstadoPush, string> = {
  listo: 'Listo', error: 'Error', construyendo: 'Construyendo', en_cola: 'En cola', cancelado: 'Cancelado',
};

export type PushP = {
  id: string;
  sha: string | null;
  /** La primera línea del commit. Un redeploy sin git dice que lo es. */
  mensaje: string;
  /** El cuerpo del commit, sin los trailers (lo que el push trae, en palabras del que lo hizo). */
  cuerpo: string;
  estado: EstadoPush;
  creado: number;
  /** Cuánto tardó el build (de que arrancó a que quedó listo o falló), si se sabe. */
  duracionMs: number | null;
  /** El que está sirviendo producción ahora: el más nuevo que quedó listo. */
  actual: boolean;
  /** La cuenta de Claude del trailer `Claude-Cuenta`, si el commit lo trae. */
  cuenta: string | null;
};

const ESTADO_VERCEL: Record<string, EstadoPush> = {
  READY: 'listo', ERROR: 'error', BUILDING: 'construyendo', INITIALIZING: 'construyendo', QUEUED: 'en_cola', CANCELED: 'cancelado',
};

/** Una lista de deployments de producción de Vercel (`/v6/deployments`) → los pushes, el más nuevo primero. */
export function pushesDeVercel(deployments: readonly Record<string, unknown>[]): PushP[] {
  const out: PushP[] = deployments.map((d) => {
    const meta = (d.meta ?? {}) as Record<string, unknown>;
    const msg = typeof meta.githubCommitMessage === 'string' ? meta.githubCommitMessage.replace(/\r/g, '') : '';
    const [primera = '', ...resto] = msg.split('\n');
    const cuerpoLineas = resto.filter((l) => !/^(Claude-Cuenta|Co-Authored-By):/i.test(l.trim()));
    const cuenta = msg.match(/^Claude-Cuenta:\s*(claude\d{1,2})\s*$/im)?.[1] ?? null;
    const sha = typeof meta.githubCommitSha === 'string' && /^[0-9a-f]{7,40}$/.test(meta.githubCommitSha) ? meta.githubCommitSha.slice(0, 9) : null;
    const creado = Number(d.created ?? d.createdAt) || 0;
    const arranco = Number(d.buildingAt) || creado;
    const listo = Number(d.ready) || 0;
    const estado = ESTADO_VERCEL[String(d.state ?? d.readyState ?? '')] ?? 'en_cola';
    return {
      id: String(d.uid ?? sha ?? creado),
      sha,
      mensaje: primera.trim() || (sha ? sha : 'Redeploy sin datos de git'),
      cuerpo: cuerpoLineas.join('\n').trim(),
      estado,
      creado,
      duracionMs: listo > arranco && (estado === 'listo' || estado === 'error') ? listo - arranco : null,
      actual: false,
      cuenta,
    };
  }).sort((a, b) => b.creado - a.creado);
  const vivo = out.find((p) => p.estado === 'listo');
  if (vivo) vivo.actual = true;
  return out;
}

// ── Qué trae cada push ────────────────────────────────────────────────────────────────────────
/** Dos shas abreviados son el mismo commit si uno empieza con el otro (con 7 caracteres como mínimo). */
const mismoCommit = (a: string | null, b: string | null) =>
  !!a && !!b && a.length >= 7 && b.length >= 7 && (a.startsWith(b) || b.startsWith(a));

/**
 * El push que subió UN commit, sólo si ese commit es la PUNTA del deploy (el más viejo que la tiene: los de
 * después son redeploys). Sin git no se puede saber si un commit va ADENTRO de un push: sólo si lo encabeza.
 *
 * ⚠️ POR QUÉ NO HAY «EL PUSH DE ESTE PEDIDO» EN LA FILA (medido el 15/10/2026 contra git):
 *   · Por la hora («el primer push después de que se anotó»): acertó 110 de 202. El commit sale en el push de
 *     otro chat, o espera al del coordinador. Nombraba el push equivocado casi la mitad de las veces.
 *   · Por la punta exacta del ÚLTIMO commit del pedido (el que lo termina): 0 de 88 en tres días. El último
 *     commit anotado casi nunca encabeza un push (va con la cosecha, o adentro de un merge).
 * Que un pedido terminado está EN PRODUCCIÓN sí es exacto: la pantalla lee la bitácora de la versión publicada.
 * Unir cada pedido con su push necesita preguntarle a GitHub si el commit es ancestro del deploy (`compare`),
 * y el token de la plataforma contesta 404 desde la transferencia del repo.
 */
export function pushDelCommit(sha: string, pushes: readonly PushP[]): PushP | null {
  return [...pushes].reverse().find((x) => x.estado === 'listo' && mismoCommit(sha, x.sha)) ?? null;
}

/** Desde el push: los pedidos que tienen anotado el commit que lo encabeza. Eso es exacto: ese push los trajo. */
export function pedidosDeLosPushes(pedidos: readonly PedidoP[], pushes: readonly PushP[]): Map<string, PedidoP[]> {
  const out = new Map<string, PedidoP[]>();
  for (const x of pushes) {
    const trae = pedidos.filter((p) => p.commits.some((c) => mismoCommit(c.sha, x.sha)));
    if (trae.length) out.set(x.id, trae);
  }
  return out;
}

// ── Novedades: lo que se subió, en palabras de producto ──────────────────────────────────────
/**
 * La pestaña Pushes, como la pidió Martín (15/10/2026): «El tema de los pushes no lo pongas con lenguaje
 * tecnico... Para eso ya me voy a ir a ver vercel... Esa tab es para mi, quiero saber exactamente que se
 * pusheo así puedo ir a ver y dar feedback de ese trabajo», y «No necesariamente como bullets, pero si
 * texto formateado y bonito, y claro de leer».
 *
 * ⚠️ SALE DE LOS HITOS, NO DE LOS COMMITS. Un hito de implementación o de corrección ya está escrito en
 * palabras de producto (título + puntos) y es una unidad de TRABAJO (varios commits son uno). Y está
 * subido: la pantalla lee la bitácora de la versión publicada. El commit no se muestra (ni hash, ni prefijo).
 * ⚠️ «Dónde mirarlo» es el `verEnApp` que declara el área en /admin/dev; si el área no tiene pantalla, la
 * novedad lo dice y no se le inventa un link. Y no se nombra un chat que no consta.
 */
export type NovedadP = {
  id: string;
  instante: number;
  area: string;
  verEnApp: string | null;
  titulo: string;
  puntos: string[];
  correccion: boolean;
};

const ES_TRABAJO = new Set(['implementacion', 'correccion']);

export function novedades(areas: readonly AreaP[], ahora: number, dias = 14): NovedadP[] {
  const desde = ahora - dias * 86_400_000;
  const out: NovedadP[] = [];
  for (const a of areas) {
    a.bitacora.forEach((h, i) => {
      if (!ES_TRABAJO.has(h.tipo)) return;
      const t = instanteHito(h.fecha, h.hora, ahora);
      if (t == null || t < desde || t > ahora + 60_000) return;
      out.push({
        id: `${a.slug}:${i}`, instante: t, area: a.titulo, verEnApp: a.verEnApp || null,
        titulo: h.titulo.slice(0, 200), puntos: (h.puntos ?? []).slice(0, 6).map((p) => p.slice(0, 400)),
        correccion: h.tipo === 'correccion',
      });
    });
  }
  return out.sort((x, y) => y.instante - x.instante);
}

/** El estado de producción en una frase, sin términos técnicos: lo único de Vercel que le sirve. */
export function estadoDeProduccion(pushes: readonly PushP[], ahora: number): { ok: boolean; frase: string } | null {
  const ultimo = pushes[0];
  const vivo = pushes.find((p) => p.estado === 'listo');
  if (!ultimo) return null;
  if (ultimo.estado === 'error') {
    return { ok: false, frase: `El último intento de publicar falló ${hace(ultimo.creado, ahora)}: sigue andando la versión anterior${vivo ? `, de ${hace(vivo.creado, ahora)}` : ''}.` };
  }
  if (ultimo.estado === 'construyendo' || ultimo.estado === 'en_cola') return { ok: true, frase: 'Se está publicando un cambio nuevo.' };
  return vivo ? { ok: true, frase: `Producción al día: lo último se publicó ${hace(vivo.creado, ahora)}.` } : null;
}

/** El día de una novedad, con el día de Argentina: «Hoy», «Ayer» o «13 oct». */
export function diaDeNovedad(instante: number, ahora: number): string {
  const dia = (t: number) => Math.floor((t - DESFASE_AR_MS) / 86_400_000);
  const d = dia(ahora) - dia(instante);
  if (d <= 0) return 'Hoy';
  if (d === 1) return 'Ayer';
  const f = new Date(instante - DESFASE_AR_MS);
  return `${f.getUTCDate()} ${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][f.getUTCMonth()]}`;
}

// ── Formato ───────────────────────────────────────────────────────────────────────────────────
/** «hace 20 s», «hace 4 min», «hace 2 h», «hace 3 días». */
export function hace(instante: number | null, ahora: number): string {
  if (instante == null || !Number.isFinite(instante)) return '—';
  const s = Math.max(0, Math.round((ahora - instante) / 1000));
  if (s < 60) return `hace ${s} s`;
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86_400) return `hace ${Math.round(s / 3600)} h`;
  const d = Math.round(s / 86_400);
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
}

/** «4m 56s», «46s». */
export function duracion(ms: number | null): string {
  if (ms == null) return '—';
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}
