// =============================================================================
// vigia-aprobaciones — qué aprobaciones de las apps de MaKo están pendientes, y cuándo avisar (PURO)
// =============================================================================
// Pedido de Martín (4/11/2026), textual: «crea un script que me vaya avisando de todas las notficaciones de aprobaciones
// pendientes que tenemos de las diferentes apps que vamos creando... En Meta, la extensión, playstore, appstore, google, etc...».
//
// Este módulo decide; no lee ni manda nada. Lo usan:
//   · lib/vigia-aprobaciones-fuentes.ts — lee cada fuente y devuelve una `Lectura`;
//   · lib/vigia-aprobaciones-server.ts  — junta las lecturas, guarda el estado y avisa (cron cada hora, /api/cron/vigia-aprobaciones);
//   · la operación `ver_aprobaciones_pendientes` (área operaciones de la API de MaKo): la lista cuando Martín la pide.
//
// LAS REGLAS, y cada una tiene su test (tests/vigia-aprobaciones.test.ts):
//   1. SE AVISA SÓLO CUANDO ALGO CAMBIA a aprobado, rechazado o «piden algo». Pasar a revisión, quedar sin enviar o seguir
//      igual NO avisa: Martín pidió el 4/11 que no le manden nada de rutina. Nunca un «sin novedades».
//   2. «NO PUDE LEER» NO CAMBIA NADA. Una fuente que no contesta deja el estado guardado como estaba: la falta de dato no es
//      una aprobación ni un rechazo. Si sigue sin poder leerse un día entero, se avisa UNA vez (y no otra hasta que vuelva).
//   3. LO QUE NO TIENE API (o le falta la credencial) se dice UNA sola vez: «hay que mirarlo a mano», con su link. No se
//      inventa un estado para eso, ni aprobado ni pendiente.
//   4. LA PRIMERA LECTURA de un ítem (o la primera desde otra fuente) no avisa una aprobación vieja: sólo lo que pide algo
//      (rechazado o «piden algo»), que es lo que espera una acción de Martín.
//   5. ALGO QUE ESTABA PUBLICADO Y DEJA DE APARECER se cree a la SEGUNDA lectura seguida: una ficha de tienda que contesta
//      404 una vez no es una app bajada (AGENTS.md, «"No pude leer" es un tercer estado»).
//
// SIN `server-only`, a propósito: lo prueba un test y lo lee la operación de la API.
// =============================================================================

/** El estado de una aprobación, ya traducido del idioma de cada plataforma. */
export type Estado =
  | 'aprobado'      // publicada, aprobada o verificada
  | 'en_revision'   // la plataforma la está mirando
  | 'rechazado'     // la plataforma dijo que no
  | 'piden_algo'    // la plataforma espera algo de nosotros (una advertencia, un contrato, un registro DNS)
  | 'sin_enviar'    // está en borrador o se retiró: le toca a MaKo mandarla
  | 'sin_publicar'; // no está publicada, y la fuente no dice en qué etapa va

/** Lo que devuelve un lector. Uno por ítem y por vuelta. */
export type Lectura =
  | {
    tipo: 'leido';
    /** De dónde salió (`asc-api`, `itunes`, `cws-api`, `cws-ficha`…). Cambiar de fuente cuenta como primera lectura (regla 4). */
    fuente: string;
    estado: Estado;
    /** La versión de lo que se mira, si la hay («1.0», «0.74.5»). Una versión nueva aprobada avisa. */
    version?: string | null;
    /** Una frase para Martín: qué falta o qué significa este estado. Nunca decide nada. */
    detalle?: string | null;
    /** Lo que ya está aprobado por partes (los permisos de Meta, los dominios verificados). Uno nuevo avisa. */
    logros?: readonly string[];
    /** Las credenciales que faltan para leer MÁS de lo que se leyó (la ficha pública no dice si hay algo en revisión). */
    faltan?: readonly string[];
  }
  | { tipo: 'sin_credencial'; faltan: readonly string[] }
  | { tipo: 'no_pude'; motivo: string }
  | { tipo: 'a_mano' };

/** Un ítem del inventario. */
export type ItemVigia = {
  id: string;
  /** Cómo se llama para Martín: la app y la plataforma. */
  nombre: string;
  /** Dónde se mira o se contesta. */
  link: string;
  /** Qué hace Martín si la rechazan o piden algo. Una frase, empieza con un verbo que él puede hacer. */
  queHacer: string;
  /** No tiene API: siempre se mira a mano. */
  aMano?: boolean;
  /** Para un ítem a mano: lo último que se sabe y de dónde, con fecha. Es un recuerdo, no una medición: se dice como tal. */
  nota?: string;
};

// ── El inventario (4/11/2026) ────────────────────────────────────────────────
// Salió de leer docs/tiendas-play-appstore.md, docs/relevo/nube-tiendas.md, docs/hallazgos-extension.md, docs/hallazgos-ads.md,
// docs/verificacion-google.md y docs/plan-instalador-escritorio.md. Qué lee cada uno y con qué, en lib/vigia-aprobaciones-fuentes.ts.
// ⚠️ UN ÍTEM NUEVO se suma ACÁ y en `LECTORES` (lib/vigia-aprobaciones-fuentes.ts); el test falla si uno no tiene al otro.

/** La app de iPhone en App Store Connect (Apple ID). */
export const APPLE_ID_APP = '6830383006';
/** La app de Android y de iPhone (el mismo id en las dos tiendas). */
export const PAQUETE_APP = 'com.holamako.app';
/** La app «MaKo» de Meta (lib/meta-login.ts, `META_APP_ID`). Se repite acá para que este módulo no importe nada del servidor. */
export const META_APP_ID_VIGIA = '2586146911825340';

export const ITEMS: readonly ItemVigia[] = [
  {
    id: 'app-store',
    nombre: 'App de iPhone (App Store)',
    link: `https://appstoreconnect.apple.com/apps/${APPLE_ID_APP}/distribution`,
    queHacer: 'Lee el motivo en App Store Connect y contéstalo ahí.',
  },
  {
    id: 'play-prueba-cerrada',
    nombre: 'App de Android, prueba cerrada (Google Play)',
    link: 'https://play.google.com/console',
    queHacer: 'Lee el motivo en Play Console, en el resumen de la publicación.',
  },
  {
    id: 'play-produccion',
    nombre: 'App de Android, producción (Google Play)',
    link: 'https://play.google.com/console',
    queHacer: 'Lee el motivo en Play Console, en el resumen de la publicación.',
  },
  {
    id: 'play-cuenta',
    nombre: 'Cuenta de Play Console (identidad y acceso a producción)',
    link: 'https://play.google.com/console',
    queHacer: 'Revisa el pedido en Play Console.',
    aMano: true,
    nota: 'El 3/11/2026 Google estaba revisando la identidad. No tiene API: Google avisa por mail.',
  },
  {
    id: 'chrome-web-store',
    nombre: 'Extensión de Chrome (Chrome Web Store)',
    link: 'https://chrome.google.com/webstore/devconsole',
    queHacer: 'Lee el motivo en el panel de la tienda, corrige y vuelve a subir la versión.',
  },
  {
    id: 'meta-permisos',
    nombre: 'App «MaKo» de Meta: permisos aprobados',
    link: `https://developers.facebook.com/apps/${META_APP_ID_VIGIA}/`,
    queHacer: 'Mira el pedido en el panel de la app de Meta, en Revisión de la app.',
  },
  {
    id: 'meta-verificaciones',
    nombre: 'Meta: verificación del negocio y de acceso',
    link: `https://developers.facebook.com/apps/${META_APP_ID_VIGIA}/settings/basic/`,
    queHacer: 'Mira el estado en el panel de la app de Meta.',
    aMano: true,
    nota: 'La API de Meta no dice el estado de la verificación de acceso (medido el 11/09/2026).',
  },
  {
    id: 'google-oauth',
    nombre: 'App de Google (inicio de sesión y agenda)',
    link: 'https://console.cloud.google.com/auth/verification?project=mako-500317',
    queHacer: 'Contesta el mail de Google en el mismo hilo.',
    aMano: true,
    nota: 'Aprobada el 26/10/2026 (docs/verificacion-google.md). Sumar Tareas o Gmail pide otra verificación.',
  },
  {
    id: 'resend-dominios',
    nombre: 'Dominios de correo de MaKo (Resend)',
    link: 'https://resend.com/domains',
    queHacer: 'Revisa los registros DNS del dominio en Resend.',
  },
  // ⚠️ RECHAZADA EL 5/11/2026, Y ES DEFINITIVO (docs/creem-retiros.md). Sigue «a mano» —su API no dice el estado, y un lector
  // sin red no inventa uno (regla 3)—, pero el NOMBRE ya lo dice: el aviso «míralo a mano» y la lista lo muestran rechazado, y
  // el «qué hacer» no manda a contestarle a Creem. Cuando haya otro proveedor, entra como un ítem nuevo, y éste se puede sacar.
  {
    id: 'creem-tienda',
    nombre: 'Creem: la tienda de MaKo, rechazada el 5/11/2026 (definitivo)',
    link: 'https://www.creem.io/dashboard',
    aMano: true,
    queHacer: 'Lee docs/creem-retiros.md: Creem no reabre la cuenta, y los cobros de fuera de Argentina pasan a otro proveedor.',
    nota: 'Enviada el 5/11/2026 a nombre de Leandro y rechazada ese mismo día, a las pocas horas, por mail y sin el motivo. Es definitivo: sus términos (§20.6) no reabren la cuenta de una persona conectada a una que Creem cerró.',
  },
  {
    id: 'firma-windows',
    nombre: 'Certificado para firmar el instalador de Windows (SSL.com)',
    link: 'https://www.ssl.com/',
    queHacer: 'Contesta lo que pida SSL.com en el pedido.',
    aMano: true,
    nota: 'La validación de identidad se mira en el panel de ssl.com, en «Orders». No tiene API.',
  },
];

export const itemPorId = (id: string): ItemVigia | undefined => ITEMS.find((i) => i.id === id);

// ── El estado guardado ──────────────────────────────────────────────────────

export type ItemGuardado = {
  // Lo último que se LEYÓ (no se toca cuando no se pudo leer).
  estado?: Estado;
  version?: string | null;
  detalle?: string | null;
  fuente?: string;
  logros?: string[];
  /** Desde cuándo está en este estado (ISO). */
  desde?: string;
  /** La última lectura buena (ISO). */
  leidoAt?: string;
  /** Cuántas lecturas seguidas dijeron «ya no está publicado» sobre algo aprobado (regla 5). */
  bajadaVista?: number;
  // Lo que no se pudo leer.
  sinLeerDesde?: string;
  motivo?: string;
  avisoSinLeer?: boolean;
  // Lo que se mira a mano.
  faltan?: string[];
  aManoAvisado?: boolean;
};

export type Guardado = { v: 1; ultimaVuelta?: string; items: Record<string, ItemGuardado> };

/** La clave de `app_settings` (en el workspace de la plataforma) donde vive el estado. */
export const CLAVE_ESTADO = 'vigia.aprobaciones';

/** Lo guardado, o un estado vacío si no hay nada o no se entiende. Un texto roto NO es «todo aprobado»: es empezar de cero. */
export function leerGuardado(crudo: string | null | undefined): Guardado {
  if (!crudo) return { v: 1, items: {} };
  try {
    const o = JSON.parse(crudo) as Partial<Guardado>;
    if (!o || typeof o !== 'object' || !o.items || typeof o.items !== 'object') return { v: 1, items: {} };
    return { v: 1, ultimaVuelta: typeof o.ultimaVuelta === 'string' ? o.ultimaVuelta : undefined, items: o.items as Record<string, ItemGuardado> };
  } catch {
    return { v: 1, items: {} };
  }
}

// ── La vuelta ───────────────────────────────────────────────────────────────

export type TipoAviso = 'aprobado' | 'rechazado' | 'piden_algo' | 'bajada' | 'sin_leer' | 'a_mano';

export type Aviso = {
  item: string;
  tipo: TipoAviso;
  estado?: Estado;
  version?: string | null;
  detalle?: string | null;
  /** Lo aprobado por partes que no estaba en la vuelta anterior. */
  nuevos?: string[];
  motivo?: string;
  faltan?: string[];
};

/** Cuánto tiene que pasar sin poder leer una fuente para avisar (regla 2). */
export const SIN_LEER_AVISA_MS = 24 * 3600_000;

const PIDE_ACCION: ReadonlySet<Estado> = new Set(['rechazado', 'piden_algo']);

/** Lo leído de un ítem, sin lo que dice si se pudo o no leer. */
const loLeido = (p: ItemGuardado): ItemGuardado => ({
  estado: p.estado, version: p.version, detalle: p.detalle, fuente: p.fuente, logros: p.logros, desde: p.desde,
  leidoAt: p.leidoAt, bajadaVista: p.bajadaVista,
});

/** Saca las claves `undefined` (el JSON guardado queda igual de una vuelta a otra si nada cambió). */
function limpio<T extends Record<string, unknown>>(o: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out as T;
}

/**
 * Una vuelta: con lo guardado y lo que se leyó ahora, el estado nuevo y los avisos. Un ítem del inventario sin lectura cuenta como
 * «no pude leer» (nadie lo leyó no es que esté bien). Lo guardado de un ítem que salió del inventario se descarta.
 */
export function vuelta(previo: Guardado | null, lecturas: Readonly<Record<string, Lectura>>, ahoraMs: number): { nuevo: Guardado; avisos: Aviso[] } {
  const ahora = new Date(ahoraMs).toISOString();
  const items: Record<string, ItemGuardado> = {};
  const avisos: Aviso[] = [];
  for (const item of ITEMS) {
    const p: ItemGuardado = previo?.items?.[item.id] ?? {};
    const l: Lectura = lecturas[item.id] ?? { tipo: 'no_pude', motivo: 'no se leyó en esta vuelta' };

    if (l.tipo === 'no_pude') {
      const sinLeerDesde = p.sinLeerDesde ?? ahora;
      let avisoSinLeer = p.avisoSinLeer ?? false;
      if (!avisoSinLeer && ahoraMs - Date.parse(sinLeerDesde) >= SIN_LEER_AVISA_MS) {
        avisos.push({ item: item.id, tipo: 'sin_leer', motivo: l.motivo });
        avisoSinLeer = true;
      }
      items[item.id] = limpio({ ...loLeido(p), faltan: p.faltan, aManoAvisado: p.aManoAvisado, sinLeerDesde, motivo: l.motivo, avisoSinLeer });
      continue;
    }

    if (l.tipo === 'sin_credencial' || l.tipo === 'a_mano') {
      const faltan = l.tipo === 'sin_credencial' ? [...l.faltan] : undefined;
      if (!p.aManoAvisado) avisos.push({ item: item.id, tipo: 'a_mano', faltan });
      items[item.id] = limpio({ ...loLeido(p), faltan, aManoAvisado: true });
      continue;
    }

    // ── Leído ──
    const base: ItemGuardado = {
      fuente: l.fuente, leidoAt: ahora, faltan: l.faltan?.length ? [...l.faltan] : undefined,
    };
    const logros = l.logros?.length ? [...new Set(l.logros)].sort() : undefined;
    const primera = p.estado == null || p.fuente !== l.fuente;

    if (primera) {
      if (PIDE_ACCION.has(l.estado)) avisos.push({ item: item.id, tipo: l.estado as 'rechazado' | 'piden_algo', estado: l.estado, version: l.version, detalle: l.detalle });
      items[item.id] = limpio({ ...base, estado: l.estado, version: l.version ?? null, detalle: l.detalle ?? null, logros, desde: ahora });
      continue;
    }

    // Regla 5: lo publicado que deja de aparecer se cree a la segunda lectura seguida.
    if (p.estado === 'aprobado' && l.estado === 'sin_publicar') {
      const vistas = (p.bajadaVista ?? 0) + 1;
      if (vistas < 2) {
        items[item.id] = limpio({ ...loLeido(p), ...base, bajadaVista: vistas });
        continue;
      }
      avisos.push({ item: item.id, tipo: 'bajada', estado: l.estado, version: p.version, detalle: l.detalle });
      items[item.id] = limpio({ ...base, estado: l.estado, version: l.version ?? null, detalle: l.detalle ?? null, logros, desde: ahora });
      continue;
    }

    const cambioEstado = p.estado !== l.estado;
    const cambioVersion = (p.version ?? null) !== (l.version ?? null);
    const nuevos = (logros ?? []).filter((x) => !(p.logros ?? []).includes(x));
    if (cambioEstado || cambioVersion) {
      if (l.estado === 'aprobado' || PIDE_ACCION.has(l.estado)) {
        avisos.push({
          item: item.id, tipo: l.estado as 'aprobado' | 'rechazado' | 'piden_algo', estado: l.estado, version: l.version, detalle: l.detalle,
          ...(nuevos.length ? { nuevos } : {}),
        });
      } else if (nuevos.length) {
        avisos.push({ item: item.id, tipo: 'aprobado', estado: l.estado, nuevos });
      }
    } else if (nuevos.length) {
      avisos.push({ item: item.id, tipo: 'aprobado', estado: l.estado, nuevos });
    }
    items[item.id] = limpio({
      ...base, estado: l.estado, version: l.version ?? null, detalle: l.detalle ?? null, logros,
      desde: cambioEstado ? ahora : (p.desde ?? ahora),
    });
  }
  return { nuevo: { v: 1, ultimaVuelta: ahora, items }, avisos };
}

// ── El mensaje ──────────────────────────────────────────────────────────────

const conPunto = (s: string) => (/[.!?…]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);
const ver = (v?: string | null) => (v ? ` (${v})` : '');

function renglon(a: Aviso): string | null {
  const it = itemPorId(a.item);
  if (!it) return null;
  const det = a.detalle ? ` ${conPunto(a.detalle)}` : '';
  switch (a.tipo) {
    case 'aprobado':
      if (a.nuevos?.length && a.estado !== 'aprobado') return `✅ *${it.nombre}*: aprobó ${a.nuevos.join(', ')}.`;
      return `✅ *${it.nombre}*: aprobado${ver(a.version)}.${a.nuevos?.length ? ` Se sumó: ${a.nuevos.join(', ')}.` : ''}${det}`;
    case 'rechazado':
      return `⛔ *${it.nombre}*: rechazado${ver(a.version)}.${det} ${it.queHacer} ${it.link}`;
    case 'piden_algo':
      return `⚠️ *${it.nombre}*: piden algo${ver(a.version)}.${det} ${it.queHacer} ${it.link}`;
    case 'bajada':
      return `⚠️ *${it.nombre}*: ya no figura como aprobado${ver(a.version)}.${det} Míralo: ${it.link}`;
    case 'sin_leer':
      return `❓ *${it.nombre}*: hace un día que no puedo leerlo (${a.motivo ?? 'sin respuesta'}). Míralo a mano: ${it.link}`;
    default:
      return null;
  }
}

const ORDEN: Record<TipoAviso, number> = { rechazado: 0, piden_algo: 1, bajada: 2, sin_leer: 3, aprobado: 4, a_mano: 5 };

/**
 * UN mensaje por vuelta con todo lo que pasó, o null si no hay nada (regla 1: nunca un «sin novedades»). Lo que pide una
 * acción va primero. Lo que hay que mirar a mano va al final, en un bloque.
 */
export function mensajeDeAvisos(avisos: readonly Aviso[]): { titulo: string; texto: string } | null {
  if (!avisos.length) return null;
  const ordenados = [...avisos].sort((a, b) => ORDEN[a.tipo] - ORDEN[b.tipo]);
  const renglones = ordenados.filter((a) => a.tipo !== 'a_mano').map(renglon).filter((x): x is string => !!x);
  const aMano = ordenados.filter((a) => a.tipo === 'a_mano');
  if (aMano.length) {
    renglones.push('👀 Esto no lo puedo leer solo. Míralo a mano cuando quieras:');
    for (const a of aMano) {
      const it = itemPorId(a.item);
      if (!it) continue;
      const falta = a.faltan?.length ? ` (para leerlo solo falta: ${a.faltan.join(', ')})` : '';
      renglones.push(`• ${it.nombre}: ${it.link}${falta}`);
    }
  }
  if (!renglones.length) return null;
  const novedades = ordenados.filter((a) => a.tipo !== 'a_mano').length;
  const titulo = novedades === 0 ? 'Aprobaciones para mirar a mano'
    : novedades === 1 ? `Aprobaciones: ${itemPorId(ordenados[0].item)?.nombre ?? 'una novedad'}`
      : `Aprobaciones: ${novedades} novedades`;
  return { titulo, texto: renglones.join('\n') };
}

// ── La lista, cuando Martín la pide ─────────────────────────────────────────

export const ROTULO_ESTADO: Record<Estado, string> = {
  aprobado: 'Aprobado',
  en_revision: 'En revisión',
  rechazado: 'Rechazado',
  piden_algo: 'Piden algo',
  sin_enviar: 'Sin enviar',
  sin_publicar: 'Todavía no publicado',
};

export type FilaLista = {
  id: string;
  nombre: string;
  /** En palabras: el estado, «hay que mirarlo a mano» o «no pude leerlo». */
  situacion: string;
  estado: Estado | null;
  version: string | null;
  detalle: string | null;
  /** Desde cuándo está así (ISO), si se sabe. */
  desde: string | null;
  /** La última vez que se leyó bien (ISO). */
  leido: string | null;
  link: string;
  /** Las credenciales que faltan para leerlo (o para leer más). */
  faltan: string[];
  nota: string | null;
  /** Sigue esperando algo: todo lo que no está aprobado, o que no se sabe. */
  esperando: boolean;
};

/** La lista entera, lo que espera primero. Un ítem sin lectura todavía dice «Todavía no lo revisé». */
export function listaDeAprobaciones(g: Guardado | null): FilaLista[] {
  const filas = ITEMS.map((it): FilaLista => {
    const s = g?.items?.[it.id] ?? {};
    const estado = s.estado ?? null;
    let situacion: string;
    if (it.aMano) situacion = 'Hay que mirarlo a mano';
    else if (s.sinLeerDesde && !estado) situacion = `No pude leerlo (${s.motivo ?? 'sin respuesta'})`;
    else if (!estado && s.faltan?.length) situacion = 'Hay que mirarlo a mano';
    else if (!estado) situacion = 'Todavía no lo revisé';
    else situacion = ROTULO_ESTADO[estado] + (s.sinLeerDesde ? ` (lo último que leí; ahora no puedo: ${s.motivo ?? 'sin respuesta'})` : '');
    return {
      id: it.id,
      nombre: it.nombre,
      situacion,
      estado,
      version: s.version ?? null,
      detalle: s.detalle ?? null,
      desde: s.desde ?? null,
      leido: s.leidoAt ?? null,
      link: it.link,
      faltan: s.faltan ?? [],
      nota: it.nota ?? null,
      esperando: estado !== 'aprobado',
    };
  });
  return [...filas.filter((f) => f.esperando), ...filas.filter((f) => !f.esperando)];
}

/** La lista en texto, para la consola. */
export function textoDeLaLista(filas: readonly FilaLista[], ultimaVuelta?: string | null): string {
  const out: string[] = [];
  out.push(ultimaVuelta ? `Última revisión: ${ultimaVuelta}` : 'Todavía no corrió ninguna revisión.');
  const linea = (f: FilaLista) => {
    const partes = [`${f.nombre}: ${f.situacion}${f.version ? ` (${f.version})` : ''}`];
    if (f.detalle) partes.push(f.detalle);
    if (f.nota) partes.push(f.nota);
    if (f.faltan.length) partes.push(`Para leerlo solo falta: ${f.faltan.join(', ')}.`);
    partes.push(f.link);
    return `• ${partes.join(' · ')}`;
  };
  const esperan = filas.filter((f) => f.esperando);
  const listos = filas.filter((f) => !f.esperando);
  out.push('', `Esperando (${esperan.length}):`, ...esperan.map(linea));
  if (listos.length) out.push('', `Aprobado (${listos.length}):`, ...listos.map(linea));
  return out.join('\n');
}
