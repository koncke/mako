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
//   3. NADA SE MIRA «A MANO» (5/11/2026, Martín: «todo deberías poder revisarlo tú, no hay nada que debería hacerlo yo a
//      mano»). Lo que tiene API se lee por API; lo que no, de su PANEL: una tarea programada del Cerebro lo abre con la sesión de
//      Martín y guarda lo que dice (scripts/vigia-paneles.mts → `CLAVE_PANELES`). Lo que todavía no se puede leer dice
//      EXACTAMENTE qué falta (una clave, o que la tarea lea ese panel), UNA sola vez por cada cosa que falta. No se inventa un
//      estado para eso, ni aprobado ni pendiente.
//   4. LA PRIMERA LECTURA de un ítem (o la primera desde otra fuente) no avisa una aprobación vieja: sólo lo que pide algo
//      (rechazado o «piden algo»), que es lo que espera una acción de Martín.
//   5. ALGO QUE ESTABA PUBLICADO Y DEJA DE APARECER se cree a la SEGUNDA lectura seguida: una ficha de tienda que contesta
//      404 una vez no es una app bajada (AGENTS.md, «"No pude leer" es un tercer estado»).
//   6. UNA LECTURA DE PANEL VALE UN DÍA (`VIEJO_MS`). Pasado eso es «no pude leer» desde la hora en que se leyó: la tarea que
//      la escribe es de una sesión de Claude, y su silencio lo mide el servidor, no ella (AGENTS.md, «un cron de SESIÓN no es
//      infraestructura»). Así, un día sin leerse avisa UNA vez, por la regla 2.
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
    /** Cuándo se leyó, si no fue en esta vuelta (la lectura de un panel trae la hora en que la tarea lo miró). */
    leidoAt?: string;
  }
  /** Falta algo para leerlo solo: una credencial, o que la tarea del Cerebro lea su panel (`FALTA_LECTURA_PANEL`). */
  | { tipo: 'sin_credencial'; faltan: readonly string[] }
  /** `desde`: desde cuándo no se puede leer, si se sabe (un panel viejo: la hora de su última lectura). */
  | { tipo: 'no_pude'; motivo: string; desde?: string };

/** Un ítem del inventario. */
export type ItemVigia = {
  id: string;
  /** Cómo se llama para Martín: la app y la plataforma. */
  nombre: string;
  /** Dónde se mira o se contesta. */
  link: string;
  /** Qué hace Martín si la rechazan o piden algo. Una frase, empieza con un verbo que él puede hacer. */
  queHacer: string;
  /** No tiene API: lo lee la tarea del Cerebro de este panel (scripts/vigia-paneles.mts). */
  panel?: PanelVigia;
  /**
   * Un hecho que ya no cambia (una tienda cerrada para siempre): su estado se lee de acá, con de dónde sale. No es una lectura
   * inventada: es lo que dijo la plataforma, una vez y por escrito. Sin API ni panel que mirar.
   */
  definitivo?: { estado: Estado; fuente: string };
  /** Lo último que se sabe y de dónde, con fecha. Es un recuerdo, no una medición: se dice como tal. */
  nota?: string;
};

/**
 * Cómo se lee un panel que no tiene API: la página que abre la tarea del Cerebro (con la sesión de Martín en su navegador),
 * qué mirar ahí y cómo se traduce lo que dice a un `Estado`. ⚠️ Los textos de `traduccion` son los que se esperan, NO medidos
 * (la nube no ve los paneles): si la página dice otra cosa, la tarea guarda «no pude leer» con el texto literal
 * (`--no-pude`), y la tabla se corrige con eso. Nunca se adivina un estado.
 */
export type PanelVigia = {
  url: string;
  /** Qué mirar en esa página, en una frase. */
  mirar: string;
  /** Si la página dice esto (sin mayúsculas ni tildes), el estado es éste. Se prueba en orden: el primero que aparece gana. */
  traduccion: ReadonlyArray<{ dice: string; estado: Estado }>;
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
    panel: {
      url: 'https://play.google.com/console/developers',
      mirar: 'El cartel de arriba de la página de inicio y la sección «Verificación de identidad» de los detalles de la cuenta.',
      traduccion: [
        { dice: 'rechaz', estado: 'rechazado' },
        { dice: 'se requiere una accion', estado: 'piden_algo' },
        { dice: 'verifica tu identidad', estado: 'piden_algo' },
        { dice: 'estamos verificando', estado: 'en_revision' },
        { dice: 'en revision', estado: 'en_revision' },
        { dice: 'solicitar acceso a produccion', estado: 'sin_enviar' },
        { dice: 'se verifico tu identidad', estado: 'aprobado' },
        { dice: 'identidad verificada', estado: 'aprobado' },
      ],
    },
    nota: 'El 3/11/2026 Google estaba revisando la identidad. No tiene API: Google avisa por mail.',
  },
  {
    id: 'chrome-web-store',
    nombre: 'Extensión de Chrome (Chrome Web Store)',
    link: 'https://chrome.google.com/webstore/devconsole',
    queHacer: 'Lee el motivo en el panel de la tienda: la versión corregida se manda sola.',
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
    panel: {
      url: `https://developers.facebook.com/apps/${META_APP_ID_VIGIA}/settings/basic/`,
      mirar: 'Las dos verificaciones: la del negocio y la de acceso. Si una está aprobada y la otra no, manda la que no.',
      traduccion: [
        { dice: 'rechaz', estado: 'rechazado' },
        { dice: 'se requiere una accion', estado: 'piden_algo' },
        { dice: 'action required', estado: 'piden_algo' },
        { dice: 'en revision', estado: 'en_revision' },
        { dice: 'in review', estado: 'en_revision' },
        { dice: 'iniciar verificacion', estado: 'sin_enviar' },
        { dice: 'start verification', estado: 'sin_enviar' },
        { dice: 'no verificad', estado: 'sin_enviar' },
        { dice: 'not verified', estado: 'sin_enviar' },
        { dice: 'unverified', estado: 'sin_enviar' },
        { dice: 'verificad', estado: 'aprobado' },
        { dice: 'verified', estado: 'aprobado' },
      ],
    },
    nota: 'La API de Meta no dice el estado de la verificación de acceso (medido el 11/09/2026).',
  },
  {
    id: 'google-oauth',
    nombre: 'App de Google (inicio de sesión y agenda)',
    link: 'https://console.cloud.google.com/auth/verification?project=mako-500317',
    queHacer: 'Contesta el mail de Google en el mismo hilo.',
    panel: {
      url: 'https://console.cloud.google.com/auth/verification?project=mako-500317',
      mirar: 'El estado de la verificación, arriba del «Centro de verificación».',
      traduccion: [
        { dice: 'rechaz', estado: 'rechazado' },
        { dice: 'se necesita una accion', estado: 'piden_algo' },
        { dice: 'action needed', estado: 'piden_algo' },
        { dice: 'en revision', estado: 'en_revision' },
        { dice: 'pending', estado: 'en_revision' },
        { dice: 'sin verificar', estado: 'sin_enviar' },
        { dice: 'not verified', estado: 'sin_enviar' },
        { dice: 'unverified', estado: 'sin_enviar' },
        { dice: 'verificacion completada', estado: 'aprobado' },
        { dice: 'verified', estado: 'aprobado' },
      ],
    },
    nota: 'Aprobada el 26/10/2026 (docs/verificacion-google.md). Sumar Tareas o Gmail pide otra verificación.',
  },
  {
    id: 'resend-dominios',
    nombre: 'Dominios de correo de MaKo (Resend)',
    link: 'https://resend.com/domains',
    queHacer: 'Revisa los registros DNS del dominio en Resend.',
  },
  // ⚠️ RECHAZADA EL 5/11/2026, Y ES DEFINITIVO (docs/creem-retiros.md). El nombre lo dice, el «qué hacer» no manda a
  // contestarle a Creem, y su estado es un hecho registrado (`definitivo`), no una lectura. Cuando haya otro proveedor, entra
  // como un ítem nuevo, y éste se puede sacar.
  {
    id: 'creem-tienda',
    nombre: 'Creem: la tienda de MaKo, rechazada el 5/11/2026 (definitivo)',
    link: 'https://www.creem.io/dashboard',
    // Ni API ni panel: es un HECHO que no cambia (5/11/2026). Mirar el panel de una tienda cerrada para siempre no dice nada
    // nuevo, y «míralo a mano» era pedirle a Martín un trabajo inútil. Se lee de acá (`lecturaDefinitiva`).
    definitivo: { estado: 'rechazado', fuente: 'el mail de Creem del 5/11/2026 (docs/creem-retiros.md)' },
    queHacer: 'Lee docs/creem-retiros.md: Creem no reabre la cuenta, y los cobros de fuera de Argentina pasan a otro proveedor.',
    nota: 'Enviada el 5/11/2026 a nombre de Leandro y rechazada ese mismo día, a las pocas horas, por mail y sin el motivo. Es definitivo: sus términos (§20.6) no reabren la cuenta de una persona conectada a una que Creem cerró.',
  },
  {
    id: 'firma-windows',
    nombre: 'Certificado para firmar el instalador de Windows (SSL.com)',
    link: 'https://secure.ssl.com/certificate_orders',
    queHacer: 'Contesta lo que pida SSL.com en el pedido.',
    panel: {
      url: 'https://secure.ssl.com/certificate_orders',
      mirar: 'El estado del pedido del certificado de firma de código, en la lista de «Orders».',
      traduccion: [
        { dice: 'rejected', estado: 'rechazado' },
        { dice: 'canceled', estado: 'rechazado' },
        { dice: 'documents required', estado: 'piden_algo' },
        { dice: 'action required', estado: 'piden_algo' },
        { dice: 'validating', estado: 'en_revision' },
        { dice: 'pending', estado: 'en_revision' },
        { dice: 'issued', estado: 'aprobado' },
      ],
    },
    nota: 'La validación de identidad se mira en el panel de ssl.com, en «Orders». Su API pide claves de cuenta que no están cargadas.',
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
  // Lo que falta para leerlo solo.
  faltan?: string[];
  /** Lo que falta que ya se avisó (las claves de `faltan`, ordenadas y juntas): se avisa otra vez sólo si cambia. */
  faltaAvisada?: string;
  /** El nombre de antes de `faltaAvisada` (hasta el 5/11/2026): una fila con esto ya avisó lo que le faltaba. */
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

export type TipoAviso = 'aprobado' | 'rechazado' | 'piden_algo' | 'bajada' | 'sin_leer' | 'falta';

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
      const sinLeerDesde = p.sinLeerDesde ?? l.desde ?? ahora;
      let avisoSinLeer = p.avisoSinLeer ?? false;
      if (!avisoSinLeer && ahoraMs - Date.parse(sinLeerDesde) >= SIN_LEER_AVISA_MS) {
        avisos.push({ item: item.id, tipo: 'sin_leer', motivo: l.motivo });
        avisoSinLeer = true;
      }
      items[item.id] = limpio({ ...loLeido(p), faltan: p.faltan, faltaAvisada: p.faltaAvisada, aManoAvisado: p.aManoAvisado, sinLeerDesde, motivo: l.motivo, avisoSinLeer });
      continue;
    }

    if (l.tipo === 'sin_credencial') {
      const faltan = [...l.faltan];
      const firma = [...faltan].sort().join('|');
      // Una fila de antes del 5/11 que ya había avisado lo que le faltaba no vuelve a avisar por el cambio de nombre.
      const avisada = p.faltaAvisada ?? (p.aManoAvisado ? firma : undefined);
      if (avisada !== firma) avisos.push({ item: item.id, tipo: 'falta', faltan });
      items[item.id] = limpio({ ...loLeido(p), faltan, faltaAvisada: firma });
      continue;
    }

    // ── Leído ──
    const leidoAt = l.leidoAt ?? ahora;
    const base: ItemGuardado = {
      fuente: l.fuente, leidoAt, faltan: l.faltan?.length ? [...l.faltan] : undefined,
    };
    const logros = l.logros?.length ? [...new Set(l.logros)].sort() : undefined;
    const primera = p.estado == null || p.fuente !== l.fuente;

    if (primera) {
      if (PIDE_ACCION.has(l.estado)) avisos.push({ item: item.id, tipo: l.estado as 'rechazado' | 'piden_algo', estado: l.estado, version: l.version, detalle: l.detalle });
      items[item.id] = limpio({ ...base, estado: l.estado, version: l.version ?? null, detalle: l.detalle ?? null, logros, desde: leidoAt });
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
      desde: cambioEstado ? leidoAt : (p.desde ?? leidoAt),
    });
  }
  return { nuevo: { v: 1, ultimaVuelta: ahora, items }, avisos };
}

// ── El mensaje ──────────────────────────────────────────────────────────────

const conPunto = (s: string) => (/[.!?…]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);
const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
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
      return `❓ *${it.nombre}*: hace un día que no puedo leerlo (${a.motivo ?? 'sin respuesta'}). Está en ${it.link}`;
    default:
      return null;
  }
}

const ORDEN: Record<TipoAviso, number> = { rechazado: 0, piden_algo: 1, bajada: 2, sin_leer: 3, aprobado: 4, falta: 5 };

/**
 * UN mensaje por vuelta con todo lo que pasó, o null si no hay nada (regla 1: nunca un «sin novedades»). Lo que pide una
 * acción va primero. Lo que falta para leer algo solo va al final, en un bloque, en palabras.
 */
export function mensajeDeAvisos(avisos: readonly Aviso[]): { titulo: string; texto: string } | null {
  if (!avisos.length) return null;
  const ordenados = [...avisos].sort((a, b) => ORDEN[a.tipo] - ORDEN[b.tipo]);
  const renglones = ordenados.filter((a) => a.tipo !== 'falta').map(renglon).filter((x): x is string => !!x);
  const faltas = ordenados.filter((a) => a.tipo === 'falta');
  if (faltas.length) {
    renglones.push('🔑 Para leer esto solo falta:');
    for (const a of faltas) {
      const it = itemPorId(a.item);
      if (!it) continue;
      const falta = faltaEnPalabras(a.faltan ?? []).map((f) => minuscula(f.texto)).join('; ');
      renglones.push(`• ${it.nombre}: ${falta || 'algo que no sé nombrar'}.`);
    }
  }
  if (!renglones.length) return null;
  const novedades = ordenados.filter((a) => a.tipo !== 'falta').length;
  const titulo = novedades === 0 ? 'Aprobaciones: falta algo para leerlas solas'
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

/** El color del punto de la pastilla (los tonos de app/_ui/tokens.ts). El color nunca va solo: lo acompaña `estadoCorto`. */
export type TonoFila = 'bad' | 'warn' | 'info' | 'neutral' | 'good';

/** Qué falta para leer algo solo, en palabras, y la tarjeta de Integraciones donde se carga (si se carga ahí). */
export type FaltaFila = { texto: string; integracion: string | null };

/**
 * Las credenciales que el vigía puede pedir, en las palabras de Martín y con la tarjeta donde se cargan. La pantalla no
 * muestra el nombre de una variable: muestra esto y un botón que abre esa tarjeta ahí mismo (AGENTS.md, «para conectar una
 * integración jamás se sale de la tab»). Lo que no está acá se muestra tal cual: ya viene en palabras (el de Resend).
 */
export const FALTA_EN_PALABRAS: Readonly<Record<string, FaltaFila>> = {
  ASC_ISSUER_ID: { texto: 'La clave de App Store Connect', integracion: 'app-store-connect' },
  ASC_KEY_ID: { texto: 'La clave de App Store Connect', integracion: 'app-store-connect' },
  ASC_P8: { texto: 'La clave de App Store Connect', integracion: 'app-store-connect' },
  TIENDAS_GOOGLE_CUENTA_SERVICIO: { texto: 'La cuenta de servicio de Google', integracion: 'tiendas-google' },
  CWS_PUBLISHER_ID: { texto: 'El id de editor de la Chrome Web Store', integracion: 'tiendas-google' },
  MAKO_META_APP_SECRET: { texto: 'El secreto de la app de Meta (variable de Vercel)', integracion: null },
  LECTURA_DEL_PANEL: { texto: 'Que la tarea del Cerebro lea su panel, con tu sesión en el navegador', integracion: null },
};

/** Lo que falta, en palabras y sin repetir (las tres claves de Apple son UNA cosa para Martín). */
export function faltaEnPalabras(faltan: readonly string[]): FaltaFila[] {
  const out: FaltaFila[] = [];
  for (const f of faltan) {
    const p = FALTA_EN_PALABRAS[f] ?? { texto: f.charAt(0).toUpperCase() + f.slice(1), integracion: null };
    if (!out.some((x) => x.texto === p.texto)) out.push(p);
  }
  return out;
}

/** Después de esto sin una lectura buena, la fila se marca vieja: lo que dice puede haber cambiado. */
export const VIEJO_MS = SIN_LEER_AVISA_MS;

/** La palabra de la pastilla, por estado. Corta: el detalle va en su propio renglón. */
export const ESTADO_CORTO: Record<Estado, string> = {
  aprobado: 'Aprobado',
  en_revision: 'En revisión',
  rechazado: 'Rechazado',
  piden_algo: 'Piden algo',
  sin_enviar: 'Sin enviar',
  sin_publicar: 'No publicado',
};

const TONO_ESTADO: Record<Estado, TonoFila> = {
  aprobado: 'good', en_revision: 'info', rechazado: 'bad', piden_algo: 'warn', sin_enviar: 'neutral', sin_publicar: 'neutral',
};

/**
 * El orden de la lista: primero lo que pide algo (un rechazo, un pedido), después lo que no se puede leer o le falta algo
 * para leerse, lo que está en revisión, lo que no se envió, y al final lo aprobado. Menor = más arriba.
 */
const PRIORIDAD_ESTADO: Record<Estado, number> = {
  rechazado: 0, piden_algo: 0, en_revision: 2, sin_enviar: 3, sin_publicar: 3, aprobado: 4,
};

export type FilaLista = {
  id: string;
  nombre: string;
  /** En palabras: el estado, qué falta para leerlo solo o «no pude leerlo». */
  situacion: string;
  /** Una o dos palabras para la pastilla («En revisión», «No pude leerlo»). */
  estadoCorto: string;
  tono: TonoFila;
  /** El orden (0 = pide algo). Ver `PRIORIDAD_ESTADO`. */
  prioridad: number;
  estado: Estado | null;
  version: string | null;
  detalle: string | null;
  /** Desde cuándo está así (ISO), si se sabe. */
  desde: string | null;
  /** La última vez que se leyó bien (ISO). */
  leido: string | null;
  /** Pasó más de un día desde la última lectura buena (`VIEJO_MS`): lo que dice puede haber cambiado. */
  viejo: boolean;
  /** Por qué no se pudo leer en la última vuelta, si no se pudo. */
  motivo: string | null;
  link: string;
  /** Las credenciales que faltan para leerlo (o para leer más). Los nombres crudos: para la API. */
  faltan: string[];
  /** Lo mismo, en palabras y con la tarjeta donde se carga: para la pantalla. */
  falta: FaltaFila[];
  nota: string | null;
  /** Qué hace Martín, sólo cuando pide algo (rechazado o «piden algo»). */
  queHacer: string | null;
  /** Sigue esperando algo: todo lo que no está aprobado, o que no se sabe. */
  esperando: boolean;
};

/**
 * La lista entera, lo que pide algo primero (`prioridad`, y dentro de cada una el orden del inventario). Un ítem sin lectura
 * todavía dice «Todavía no lo revisé». `ahoraMs` decide qué fila está vieja.
 */
export function listaDeAprobaciones(g: Guardado | null, ahoraMs: number = Date.now()): FilaLista[] {
  const filas = ITEMS.map((it): FilaLista => {
    const s = g?.items?.[it.id] ?? {};
    const estado = s.estado ?? null;
    const faltan = s.faltan ?? [];
    let situacion: string;
    let estadoCorto: string;
    let tono: TonoFila;
    let prioridad: number;
    if (s.sinLeerDesde && !estado) {
      situacion = `No pude leerlo (${s.motivo ?? 'sin respuesta'})`; estadoCorto = 'No pude leerlo'; tono = 'warn'; prioridad = 1;
    } else if (!estado && faltan.length) {
      situacion = `Falta: ${faltaEnPalabras(faltan).map((f) => minuscula(f.texto)).join('; ')}`;
      estadoCorto = faltan.includes(FALTA_LECTURA_PANEL) ? 'Sin leer' : 'Falta una clave'; tono = 'neutral'; prioridad = 1;
    } else if (!estado) {
      situacion = 'Todavía no lo revisé'; estadoCorto = 'Sin revisar'; tono = 'neutral'; prioridad = 3;
    } else {
      situacion = ROTULO_ESTADO[estado] + (s.sinLeerDesde ? ` (lo último que leí; ahora no puedo: ${s.motivo ?? 'sin respuesta'})` : '');
      estadoCorto = ESTADO_CORTO[estado]; tono = TONO_ESTADO[estado]; prioridad = PRIORIDAD_ESTADO[estado];
    }
    const leidoMs = s.leidoAt ? Date.parse(s.leidoAt) : NaN;
    return {
      id: it.id,
      nombre: it.nombre,
      situacion,
      estadoCorto,
      tono,
      prioridad,
      estado,
      version: s.version ?? null,
      detalle: s.detalle ?? null,
      desde: s.desde ?? null,
      leido: s.leidoAt ?? null,
      viejo: Number.isFinite(leidoMs) && ahoraMs - leidoMs > VIEJO_MS,
      motivo: s.sinLeerDesde ? (s.motivo ?? 'sin respuesta') : null,
      link: it.link,
      faltan,
      falta: faltaEnPalabras(faltan),
      nota: it.nota ?? null,
      queHacer: estado === 'rechazado' || estado === 'piden_algo' ? it.queHacer : null,
      esperando: estado !== 'aprobado',
    };
  });
  // `sort` es estable: dentro de cada prioridad queda el orden del inventario.
  return filas.map((f, i) => ({ f, i })).sort((a, b) => a.f.prioridad - b.f.prioridad || a.i - b.i).map((x) => x.f);
}

/** La lista en texto, para la consola. */
export function textoDeLaLista(filas: readonly FilaLista[], ultimaVuelta?: string | null): string {
  const out: string[] = [];
  out.push(ultimaVuelta ? `Última revisión: ${ultimaVuelta}` : 'Todavía no corrió ninguna revisión.');
  const linea = (f: FilaLista) => {
    const partes = [`${f.nombre}: ${f.situacion}${f.version ? ` (${f.version})` : ''}`];
    if (f.detalle) partes.push(f.detalle);
    if (f.nota) partes.push(f.nota);
    if (f.falta.length) partes.push(`Para leerlo solo falta: ${f.falta.map((x) => minuscula(x.texto)).join('; ')}.`);
    if (f.viejo) partes.push('Lectura de hace más de un día.');
    partes.push(f.link);
    return `• ${partes.join(' · ')}`;
  };
  const esperan = filas.filter((f) => f.esperando);
  const listos = filas.filter((f) => !f.esperando);
  out.push('', `Esperando (${esperan.length}):`, ...esperan.map(linea));
  if (listos.length) out.push('', `Aprobado (${listos.length}):`, ...listos.map(linea));
  return out.join('\n');
}

// ── Las lecturas de los PANELES (5/11/2026) ────────────────────────────────
// Lo que no tiene API se lee de su panel: una tarea programada del Cerebro abre la página con la sesión de Martín en su
// navegador y guarda lo que dice con scripts/vigia-paneles.mts (`--guardar <id> <estado> <nota>`). Se guarda en su PROPIA
// clave y no en `CLAVE_ESTADO`: el cron escribe ésa cada hora con compare-and-set, y dos escritores con dos ritmos son dos
// claves (AGENTS.md). El vigía la lee en cada vuelta (`lecturaDePanel`) y la trata como cualquier lectura.

/** La clave de `app_settings` (en el workspace de la plataforma) con lo que se leyó de cada panel. */
export const CLAVE_PANELES = 'vigia.paneles';
/** Lo que falta mientras nadie leyó el panel de un ítem sin API (una clave de `faltan`; en palabras, en `FALTA_EN_PALABRAS`). */
export const FALTA_LECTURA_PANEL = 'LECTURA_DEL_PANEL';
/** El largo máximo de la nota de una lectura de panel: es una frase, no la página. */
export const MAX_NOTA_PANEL = 300;

export const ESTADOS_APROBACION: readonly Estado[] = ['aprobado', 'en_revision', 'rechazado', 'piden_algo', 'sin_enviar', 'sin_publicar'];
export const esEstado = (x: unknown): x is Estado => typeof x === 'string' && (ESTADOS_APROBACION as readonly string[]).includes(x);

/** Lo que se leyó de UN panel: un estado (con su nota), o que no se pudo leer (con el motivo). Siempre con la hora. */
export type LecturaPanel = { estado: Estado; nota?: string; leidoAt: string } | { noPude: string; leidoAt: string };
export type PanelesGuardados = { v: 1; items: Record<string, LecturaPanel> };

/** Corta sin partir un emoji (AGENTS.md, «un `slice` de texto corta MEDIO emoji»). */
const cortar = (s: string, n: number): string => {
  const cps = [...s.replace(/\s+/g, ' ').trim()];
  return cps.length > n ? `${cps.slice(0, n - 1).join('')}…` : cps.join('');
};

/** Lo guardado de los paneles, o vacío. Una entrada que no se entiende se descarta (no es una lectura). */
export function leerPaneles(crudo: string | null | undefined): PanelesGuardados {
  const vacio: PanelesGuardados = { v: 1, items: {} };
  if (!crudo) return vacio;
  let o: unknown;
  try { o = JSON.parse(crudo); } catch { return vacio; }
  const items = (o && typeof o === 'object' ? (o as { items?: unknown }).items : null);
  if (!items || typeof items !== 'object') return vacio;
  const out: Record<string, LecturaPanel> = {};
  for (const [id, x] of Object.entries(items as Record<string, unknown>)) {
    if (!itemPorId(id)?.panel || !x || typeof x !== 'object') continue;
    const r = x as Record<string, unknown>;
    if (typeof r.leidoAt !== 'string' || !Number.isFinite(Date.parse(r.leidoAt))) continue;
    if (esEstado(r.estado)) out[id] = { estado: r.estado, leidoAt: r.leidoAt, ...(typeof r.nota === 'string' && r.nota ? { nota: r.nota } : {}) };
    else if (typeof r.noPude === 'string' && r.noPude) out[id] = { noPude: r.noPude, leidoAt: r.leidoAt };
  }
  return { v: 1, items: out };
}

/**
 * El estado que dice el texto de un panel, según su tabla (`PanelVigia.traduccion`), o null si no dice nada conocido. Se
 * compara sin mayúsculas ni tildes. Null NO es un estado: quien lo recibe guarda «no pude leer» con el texto literal.
 */
export function estadoDeTextoDePanel(id: string, texto: string): Estado | null {
  const panel = itemPorId(id)?.panel;
  if (!panel) return null;
  const plano = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  for (const t of panel.traduccion) if (plano.includes(t.dice)) return t.estado;
  return null;
}

/**
 * Anota una lectura de panel sobre lo guardado (puro: devuelve lo nuevo, no escribe). Sólo para un ítem que tiene panel, con
 * un estado conocido o con el motivo de por qué no se pudo leer. Lo usan el script de la PC y la operación de la API.
 */
export function anotarPanel(
  previo: PanelesGuardados | null,
  id: string,
  lectura: { estado: string; nota?: string | null } | { noPude: string },
  ahoraMs: number,
): { ok: true; nuevo: PanelesGuardados; lectura: LecturaPanel } | { ok: false; error: string } {
  const item = itemPorId(id);
  if (!item) return { ok: false, error: `No existe la aprobación «${id}». Son: ${ITEMS.map((i) => i.id).join(', ')}.` };
  if (!item.panel) return { ok: false, error: `${item.nombre} se lee por API, no de su panel.` };
  const leidoAt = new Date(ahoraMs).toISOString();
  let nueva: LecturaPanel;
  if ('noPude' in lectura) {
    const motivo = cortar(String(lectura.noPude ?? ''), MAX_NOTA_PANEL);
    if (!motivo) return { ok: false, error: 'Falta el motivo de por qué no se pudo leer el panel.' };
    nueva = { noPude: motivo, leidoAt };
  } else {
    if (!esEstado(lectura.estado)) return { ok: false, error: `«${lectura.estado}» no es un estado. Son: ${ESTADOS_APROBACION.join(', ')}.` };
    const nota = cortar(String(lectura.nota ?? ''), MAX_NOTA_PANEL);
    nueva = { estado: lectura.estado, leidoAt, ...(nota ? { nota } : {}) };
  }
  return { ok: true, nuevo: { v: 1, items: { ...(previo?.items ?? {}), [id]: nueva } }, lectura: nueva };
}

/** Una fecha corta para un motivo («el 5/11 a las 14:30», en UTC: el motivo no sabe la zona de quien lo lee). */
const cuandoCorto = (iso: string): string => {
  const d = new Date(iso);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `el ${d.getUTCDate()}/${d.getUTCMonth() + 1} a las ${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())} UTC`;
};

/**
 * Lo que se leyó del panel de un ítem, como una `Lectura` del vigía (regla 6):
 *   · nunca se leyó → falta que la tarea lo lea (`sin_credencial` con `FALTA_LECTURA_PANEL`);
 *   · se leyó hace menos de un día → la lectura, con la hora en que se miró (`leidoAt`);
 *   · la tarea dijo que no pudo → «no pude», con su motivo;
 *   · pasó más de un día → «no pude», desde la hora en que se leyó: el silencio de la tarea lo mide el servidor.
 */
export function lecturaDePanel(paneles: PanelesGuardados | null, id: string, ahoraMs: number): Lectura {
  const l = paneles?.items?.[id];
  if (!l) return { tipo: 'sin_credencial', faltan: [FALTA_LECTURA_PANEL] };
  const edad = ahoraMs - Date.parse(l.leidoAt);
  if (edad > VIEJO_MS) return { tipo: 'no_pude', motivo: `nadie leyó el panel desde ${cuandoCorto(l.leidoAt)}`, desde: l.leidoAt };
  if ('noPude' in l) return { tipo: 'no_pude', motivo: `el panel: ${l.noPude}`, desde: l.leidoAt };
  return { tipo: 'leido', fuente: 'panel', estado: l.estado, detalle: l.nota ?? null, leidoAt: l.leidoAt };
}

/** La lectura de un ítem `definitivo`: el hecho registrado, con su fuente. Sin red y sin fecha propia (vale en cada vuelta). */
export function lecturaDefinitiva(it: ItemVigia): Lectura | null {
  if (!it.definitivo) return null;
  return { tipo: 'leido', fuente: 'registro', estado: it.definitivo.estado, detalle: `Según ${it.definitivo.fuente}` };
}

/** Lo que tiene que hacer la tarea del Cerebro, en texto: un panel por párrafo, con su página, qué mirar y la traducción. */
export function instruccionesDePaneles(): string {
  const out: string[] = [];
  for (const it of ITEMS) {
    if (!it.panel) continue;
    out.push(`${it.id} — ${it.nombre}`);
    out.push(`  Abrir: ${it.panel.url}`);
    out.push(`  Mirar: ${it.panel.mirar}`);
    out.push(`  Si dice… → estado: ${it.panel.traduccion.map((t) => `«${t.dice}» → ${t.estado}`).join(' · ')}`);
    out.push('');
  }
  return out.join('\n');
}
