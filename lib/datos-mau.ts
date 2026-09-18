// =============================================================================
// datos-mau — traer (y devolver) los datos del dueño, POR LUGAR
// =============================================================================
// Probar una tab de punta a punta necesita datos adentro. Rehacerlos a mano en
// el workspace de prueba es media hora por tab, así que cada lugar donde falta
// algo ofrece dos botones: "Completar con los datos de Mau" y "Eliminar los
// datos de Mau". Este archivo es el registro de QUÉ significa eso en cada lugar.
//
// Tres reglas que no se negocian:
//
//   1. Solo hacia un workspace de PRUEBA. Nunca al del dueño (se rechaza), y
//      solo lo puede disparar un super-admin de la agencia.
//   2. Nada que pueda ALCANZAR a una persona real se copia tal cual. Los leads
//      llegan con el teléfono y el email neutralizados: se ve el CRM lleno y con
//      sentido, pero ningún envío de prueba puede terminar en el celular de un
//      cliente de Mauricio. Lo mismo con su contacto, sus grupos de WhatsApp y
//      los flags de envío, que directamente no viajan.
//   3. Borrar borra lo que TRAJIMOS, no lo que hay. Cada copia deja un registro
//      (`mako.datos_mau.<ámbito>`) con los ids insertados y las claves escritas;
//      "Eliminar" recorre ese registro. Lo que el usuario creó probando queda.
//
// Para sumar un lugar nuevo: agregá una entrada a AMBITOS. No hace falta tocar
// ni la API ni el componente.

import 'server-only';
import { getSupabaseServer } from './supabase';
import { leerPorPaginas } from './supabase-paginado';
import { OWNER_WS } from './auth-session';
import { SERVICIOS_METODO } from './metodo-catalogo';

// ─────────────────────────────────────────────────────────────────────────────
// Forma del registro
// ─────────────────────────────────────────────────────────────────────────────

type TablaClon = {
  tabla: string;
  /**
   * Columnas que no viajan.
   *
   * OJO CON `id`. Hay dos familias de tabla y confundirlas rompe el insert:
   *  · id automático (bigserial / identity) y PK global → va en `omitir`, lo
   *    genera la base. Ej.: nutricion_secuencias, leads, mako_knowledge.
   *  · id de TEXTO sin default y PK compuesta (workspace_id, id) → NO se omite.
   *    Omitirlo tira "null value in column id violates not-null". Preservarlo
   *    además mantiene coherentes las referencias por id: el storage_path del
   *    Archivero es `<ws>/<id>`, y plan_tareas.labels apunta a ids de proyecto.
   *    Ej.: archivero_files, plan_proyectos, plan_tareas.
   */
  omitir?: string[];
  /** Valores impuestos en el destino (ej. una secuencia llega siempre pausada). */
  forzar?: Record<string, unknown>;
  /** Columnas cuyo valor real se reemplaza. Reciben la fila y devuelven el reemplazo. */
  neutralizar?: Record<string, (fila: Record<string, unknown>, i: number) => unknown>;
  /** Singleton por workspace (una fila, id = workspace_id). */
  singleton?: boolean;
  /** Cuántas filas como mucho: alcanza para que la tab se vea viva. */
  limite?: number;
  /** Orden de traída (para que el límite se quede con lo más reciente). */
  ordenar?: { col: string; asc?: boolean };
  /**
   * Columna con UNIQUE por workspace: las filas cuyo valor ya exista en el
   * destino se saltean en vez de reventar el insert entero. Pasa siempre que el
   * destino ya sembró sus plantillas (nutricion_secuencias, por ejemplo).
   */
  dedupPor?: string;
  /**
   * Trae solo las filas donde esta columna es NULL. Existe por las secuencias
   * ARCHIVADAS: viajaban igual, llegaban invisibles al destino (la lista las
   * filtra), le ocupaban la `clave` —bloqueando el dedup de una copia futura—
   * y su etapa volvía a contar como hueco. Ruido que nadie podía ver ni borrar.
   */
  soloNulo?: string;
  /**
   * Reescribe IDS DE FILAS que viven DENTRO de un jsonb. `campo` es la columna
   * (un array de objetos), `clave` la propiedad con el id viejo y `desde` la
   * tabla ya copiada de cuyo mapa viejo→nuevo se traduce.
   *
   * Sin esto, un paso de nota de voz llegaba apuntando al `audio_id` del dueño:
   * como vive en un jsonb no hay FK que proteste, así que el insert entra limpio
   * y la rotura es muda. En el mejor caso el motor falla («el audio del paso ya
   * no existe») y reintenta para siempre; en el peor, ese id existe por
   * casualidad en el destino y sale el audio EQUIVOCADO con la voz del dueño.
   */
  remapJson?: { campo: string; clave: string; desde: string };
  /** Tablas que apuntan a esta por FK: se copian remapeando el id nuevo. */
  hijos?: Array<{ tabla: string; fk: string; omitir?: string[]; limite?: number }>;
};

/**
 * String y no un union literal: además de los ámbitos fijos de abajo, hay uno
 * POR CADA integración del catálogo (`cred_meta`, `cred_whatsapp`, …), generado
 * dinámicamente — ver el loop después de AMBITOS.
 */
export type AmbitoKey = string;

/** Las secciones del panel de agencia: agrupan los ámbitos por recorrido. */
export const SECCIONES = ['Onboarding principal', 'Integraciones', 'Chat Agent', 'Datos del negocio', 'Configuración'] as const;
export type Seccion = (typeof SECCIONES)[number];

type AmbitoDef = {
  /** Nombre corto y visible del ámbito ("El Archivero", "Los leads"). */
  titulo: string;
  /** A qué grupo pertenece dentro del panel. */
  seccion: Seccion;
  /** Lo que el botón promete, en una línea: "Completar con {label}". */
  label: string;
  settings?: string[];
  tablas?: TablaClon[];
  /** Copia credenciales del dueño. Sin `servicioFiltro`, copia TODAS las que no son de agencia. */
  credenciales?: boolean;
  /** Con `credenciales: true`, restringe la copia a UN servicio del catálogo (ej. 'meta'). */
  servicioFiltro?: string;
  /**
   * Copia el perfil del dueño (nombre, foto y campos del jsonb) PISANDO el
   * usuario que el destino ya tiene. No es un setting ni una TablaClon:
   * `usuarios` son cuentas de login y clonar una fila crearía un acceso nuevo
   * con el email del dueño, que además es UNIQUE. Mismo patrón declarativo que
   * `credenciales`: un flag, su bloque en la copia y su rama en el borrado.
   */
  perfil?: boolean;
  /**
   * Settings cuyo VALOR guarda ids de filas: se copian tal cual y después se
   * traducen con el mapa viejo→nuevo de la tabla `desde`. Copiarlos sin
   * traducir es peor que no copiarlos: el destino se pinta configurado y
   * apunta a filas que no son suyas.
   */
  settingsRemap?: Array<{ key: string; desde: string }>;
  /** Se muestra bajo los botones cuando hay algo que aclarar. */
  nota?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// El registro
// ─────────────────────────────────────────────────────────────────────────────

export const AMBITOS: Record<AmbitoKey, AmbitoDef> = {
  // Primera a propósito: el orden del objeto manda el orden del panel, y la
  // identidad va antes que todo lo demás — es el nombre que firma cada audio y
  // cada mensaje ("Hola, soy Mauricio Bustos").
  // `user_nombre` viaja por la maquinaria de settings (es el nombre con el que
  // sale el OTP); `user_email` y `user_telefono` NO: son los canales por los que
  // una prueba terminaría alcanzando al Mauricio de verdad.
  perfil: {
    titulo: 'Nombre y foto',
    seccion: 'Onboarding principal',
    label: 'el nombre, la foto y el cargo de Mau',
    perfil: true,
    settings: ['user_nombre'],
    nota: 'No se copian el email ni el teléfono: son los canales por los que una prueba llegaría al dueño.',
  },
  negocio: {
    titulo: 'Brief y diagnóstico',
    seccion: 'Onboarding principal',
    label: 'el brief y el diagnóstico de Mau',
    settings: [
      'mako.onboarding.answers', 'negocio.fase.diagnostico',
      'mako.fase.general', 'mako.fase.comercial', 'mako.fase.marketing', 'mako.fase.crm', 'mako.fase.closing',
    ],
  },
  archivero: {
    titulo: 'El Archivero',
    seccion: 'Onboarding principal',
    label: 'los documentos de Mau',
    settings: ['mako.archivero.manual', 'mako.archivero.panorama'],
    tablas: [{ tabla: 'archivero_files', limite: 200, ordenar: { col: 'created_at' } }],
  },
  // Lugar propio y no parte de 'negocio' porque es un PASO propio del wizard: el
  // que quiere probar el cierre de un deal necesita el catálogo aunque no traiga
  // el brief. Se lleva el flag de siembra para que el seed desde la 'oferta' no
  // vuelva a correr sobre un catálogo ya copiado.
  productos: {
    titulo: 'Productos y ofertas',
    seccion: 'Onboarding principal',
    label: 'el catálogo de productos de Mau',
    settings: ['mako.productos.seeded'],
    tablas: [{ tabla: 'productos', dedupPor: 'nombre', limite: 50, ordenar: { col: 'orden', asc: true } }],
  },
  funnel: {
    titulo: 'El funnel',
    seccion: 'Onboarding principal',
    label: 'el funnel de Mau',
    settings: ['onboarding.funnel_tipos'],
    // pipeline_stages NO se copia: no tiene columna `id` y su PK es `key`
    // GLOBAL, sin workspace_id — copiarla choca con la del dueño. Además quedó
    // sin uso para el funnel (migración 0025).
    tablas: [{ tabla: 'funnel_config', singleton: true }],
  },
  creativos: {
    titulo: 'Avatares y ángulos',
    seccion: 'Onboarding principal',
    label: 'los avatares y ángulos de Mau',
    settings: [
      'mako.avatares', 'mako.avatares.contexto', 'mako.razones', 'mako.entregable',
      'mako.persona', 'mako.personalidad', 'mako.formatos_recom',
      'script_avatares', 'script_angles', 'mako.guion_angulos', 'mako.guion_estructuras',
    ],
  },
  // Trae TODO el recorrido del Chat Agent, no solo el resultado: la idea es
  // poder rehacer el onboarding entero en la cuenta de prueba, y para eso
  // hacen falta la voz destilada Y su evidencia, los tres audios con su mapa
  // por clave, el link del video, lo respondido en el ensayo y los objetivos
  // que el dueño escribió a mano.
  setting: {
    titulo: 'Chat Agent completo',
    seccion: 'Chat Agent',
    label: 'los audios, la voz y las secuencias de mensajes de Mau',
    settings: [
      // Voz: el resumen que se muestra Y de dónde salió, si no la pantalla de
      // voz llega llena pero sin nada que se pueda editar ni entender.
      'mako.voz_guia', 'mako.chat_agent.voz.evidencia', 'mako.chat_agent.voz.manual',
      // Audios y ensayo.
      'chat_agent.audios_clave', 'chat_agent.link_video', 'chat_agent.ensayo',
      // Los objetivos que el dueño escribió con la opción «Otro».
      'chat_agent.objetivos_custom',
    ],
    // `chat_agent.audios_clave` guarda IDS de setting_audios: copiado tal cual
    // apunta a las filas del dueño. Se traduce con el mapa de la copia.
    settingsRemap: [{ key: 'chat_agent.audios_clave', desde: 'setting_audios' }],
    tablas: [
      // LOS AUDIOS VAN PRIMERO, y no es cosmético: de esta copia sale el mapa
      // viejo→nuevo con el que después se reescriben los `audio_id` de los
      // pasos y el setting de arriba. Al revés, no habría nada que traducir.
      // Dedup por `media_path`: el path viaja verbatim, así que identifica al
      // mismo audio en los dos workspaces. Sin él, cada «Completar» sumaba tres
      // audios más y el mapa de claves apuntaba a la última tanda mientras las
      // secuencias seguían en la primera.
      { tabla: 'setting_audios', omitir: ['id'], limite: 40, ordenar: { col: 'created_at' }, dedupPor: 'media_path' },
      // Pausadas SIEMPRE: un workspace de prueba no arranca mandando solo.
      // Los PASOS viajan con la fila (son la columna jsonb `pasos`, no una
      // tabla hija), así que la secuencia no llega vacía — lo único que hay que
      // arreglarles de adentro es a qué audio apuntan.
      {
        tabla: 'nutricion_secuencias',
        omitir: ['id'],
        forzar: { activa: false },
        dedupPor: 'clave',
        soloNulo: 'archivada_at',
        remapJson: { campo: 'pasos', clave: 'audio_id', desde: 'setting_audios' },
      },
    ],
    nota: 'Los audios se escuchan desde el archivo del dueño. Si borras uno aquí, se borra para él: para probar, graba los tuyos.',
  },
  crm: {
    titulo: 'Leads del CRM',
    seccion: 'Datos del negocio',
    label: 'los leads de Mau',
    tablas: [{
      tabla: 'leads',
      omitir: ['id'],
      limite: 300,
      ordenar: { col: 'created_at' },
      // El CRM se ve lleno y real, pero ningún mensaje de prueba puede salir
      // hacia una persona de verdad: los canales de contacto quedan muertos.
      // `telefono_normalizado` es la llave con la que un WhatsApp entrante
      // encuentra a su lead: si viajara real, un envío de prueba saldría al
      // número de verdad aunque `telefono` esté maquillado. Va neutralizado
      // igual, y coherente con el teléfono falso.
      neutralizar: {
        telefono: (_f, i) => `+000000${String(10000 + i).slice(-5)}`,
        telefono_normalizado: (_f, i) => `000000${String(10000 + i).slice(-5)}`,
        email: (_f, i) => `lead${i}@prueba.local`,
        whatsapp: () => null,
        chat_jid: () => null,
        // UNIQUE global, sin workspace_id (idx_leads_meta_lead_id): si viaja,
        // el segundo workspace con el mismo lead de formulario no entra.
        meta_lead_id: () => null,
      },
      hijos: [{ tabla: 'lead_respuestas', fk: 'lead_id', omitir: ['id'], limite: 1200 }],
    }],
    nota: 'Los leads llegan con el teléfono y el email neutralizados: ninguna prueba puede alcanzar a un cliente real.',
  },
  plan: {
    titulo: 'El plan',
    seccion: 'Datos del negocio',
    label: 'el plan de Mau',
    tablas: [
      { tabla: 'tarea_categorias', omitir: ['id'] },
      { tabla: 'plan_proyectos', limite: 60, ordenar: { col: 'created_at' } },
      { tabla: 'plan_tareas', limite: 600, ordenar: { col: 'created_at' } },
    ],
  },
  conocimiento: {
    titulo: 'Cursos y conocimiento',
    seccion: 'Datos del negocio',
    label: 'los cursos y el conocimiento de Mau',
    tablas: [{ tabla: 'mako_knowledge', omitir: ['id'], limite: 400, ordenar: { col: 'created_at' } }],
  },
  prompts: {
    titulo: 'Prompts y modelos',
    seccion: 'Configuración',
    label: 'los prompts y modelos de Mau',
    settings: [
      'mako.prompts', 'mako.prompt-overrides', 'mako.modelos', 'mako.nucleo',
      'mako.modo.analista', 'mako.modo.closer', 'mako.modo.comparador', 'mako.modo.consultor', 'mako.modo.guiones',
      'mako.context.chart_standard', 'mako.context.general_fallback', 'mako.context.whatsapp_consultor',
      'mako.plantillas.store',
    ],
  },
  objetivos: {
    titulo: 'Objetivos',
    seccion: 'Onboarding principal',
    label: 'los objetivos de Mau',
    settings: ['objetivo_cash_usd', 'objetivo_cierres'],
  },
  // Bulk: todas las credenciales del dueño de una — el atajo que ya usaba
  // /integraciones. Convive con las entradas individuales de abajo (una por
  // servicio), que son las que el dueño pidió poder ver y traer una por una.
  integraciones: {
    titulo: 'Todas las integraciones',
    seccion: 'Integraciones',
    label: 'todas las conexiones de Mau de una sola vez',
    credenciales: true,
    nota: 'No se copian el teléfono, el email ni los grupos de WhatsApp: las pruebas deben llegarte a ti, no al dueño.',
  },
};

export type ResultadoMau = { copiado: number; detalle: Record<string, number>; avisos: string[] };

// Una entrada POR INTEGRACIÓN del catálogo, no un solo botón que las trae todas
// juntas y sin nombre. El dueño pidió ver CADA conexión (Meta, WhatsApp, Claude,
// Gemini…) y poder traerla una por una — incluidas las que paga la agencia
// (anthropic/openai/email): copiarlas no cambia quién paga la llamada (ver
// [[byok-ia-no-usa-key-del-cliente]]), solo enciende el estado "conectado" en
// el workspace de prueba, que es justo lo que hace falta para probar esa tab.
for (const s of SERVICIOS_METODO) {
  AMBITOS[`cred_${s.key}`] = {
    titulo: s.nombre,
    seccion: 'Integraciones',
    label: `la conexión de ${s.nombre}`,
    credenciales: true,
    servicioFiltro: s.key,
    nota: 'No se copian el teléfono, el email ni los grupos de WhatsApp: las pruebas deben llegarte a ti, no al dueño.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// El registro de lo que trajimos (para poder devolverlo intacto)
// ─────────────────────────────────────────────────────────────────────────────

/** Lo que el usuario del destino tenía ANTES de que el perfil de Mau lo pisara. */
type PerfilPrevio = {
  usuarioId: number;
  nombre: string | null;
  foto_url: string | null;
  perfil: Record<string, unknown>;
};

type Recibo = {
  settings: string[];
  filas: Record<string, Array<string | number>>;
  perfil?: PerfilPrevio;
};
const keyRecibo = (a: AmbitoKey) => `mako.datos_mau.${a}`;

/**
 * Campos del jsonb del perfil que viajan. `telefono` NO: se usa para mandar
 * avisos por WhatsApp, así que copiarlo haría que una prueba del cliente de
 * prueba le suene el celular a Mauricio. `email` tampoco está: es columna de
 * login y UNIQUE.
 */
const PERFIL_EXTRA = ['cargo', 'empresa', 'web', 'bio', 'timezone'] as const;

type FilaUsuario = {
  id: number; nombre: string | null; foto_url: string | null;
  perfil?: Record<string, unknown> | null; rol_ws?: string | null;
};

/**
 * El admin-cliente del workspace, con fallback al primer miembro. Mismo criterio
 * que usuarioDelPerfil() (lib/perfil.ts): si divergiera, /perfil mostraría una
 * fila y esto escribiría en otra.
 */
async function usuarioAdminDe(ws: number): Promise<FilaUsuario | null> {
  const { data } = await getSupabaseServer()
    .from('usuarios').select('id, nombre, foto_url, perfil, rol_ws')
    .eq('workspace_id', ws).neq('estado', 'suspendido')
    .order('id', { ascending: true }).limit(20);
  const filas = (data ?? []) as FilaUsuario[];
  return filas.find((u) => u.rol_ws === 'admin') ?? filas[0] ?? null;
}

/**
 * Trae nombre, foto y perfil de Mau PISANDO el usuario que el destino ya tiene.
 *
 * Se escribe con getSupabaseServer() y `.eq('workspace_id', destino)` a mano, NO
 * con setPerfil(): setPerfil resuelve a quién escribe por la SESIÓN, y acá el
 * destino llega por parámetro — un admin parado en el cliente A terminaría
 * pisando el perfil de A creyendo tocar el de B.
 *
 * La foto viaja como URL, no duplicada: el bucket `avatars` es público y cada
 * subida escribe un path nuevo con timestamp (nunca sobrescribe), así que la URL
 * del dueño resuelve desde cualquier workspace. Duplicar el objeto dejaría
 * basura que nadie limpia.
 */
async function copiarPerfilDelDueno(destino: number, recibo: Recibo, avisos: string[]): Promise<number> {
  const [origen, dest] = await Promise.all([usuarioAdminDe(OWNER_WS), usuarioAdminDe(destino)]);
  if (!origen) { avisos.push('El dueño no tiene un usuario con perfil cargado.'); return 0; }
  if (!dest) { avisos.push('Este cliente no tiene ningún usuario: el nombre y la foto no se pudieron traer.'); return 0; }

  // El respaldo se escribe SOLO la primera vez. Si se guardara en cada copia, la
  // segunda anotaría los datos de Mau como "lo que había antes" y "Eliminar"
  // dejaría el perfil del dueño pegado para siempre.
  recibo.perfil ??= {
    usuarioId: dest.id,
    nombre: dest.nombre,
    foto_url: dest.foto_url,
    perfil: (dest.perfil ?? {}) as Record<string, unknown>,
  };

  // Merge, no reemplazo: lo que el destino tenga fuera de estas claves se respeta.
  const extra: Record<string, unknown> = { ...(dest.perfil ?? {}) };
  const oExtra = (origen.perfil ?? {}) as Record<string, unknown>;
  for (const k of PERFIL_EXTRA) {
    const val = oExtra[k];
    if (typeof val === 'string' && val.trim()) extra[k] = val;
  }

  const { error } = await getSupabaseServer().from('usuarios').update({
    nombre: origen.nombre ?? '',
    foto_url: origen.foto_url ?? null,
    perfil: extra,
    updated_at: new Date().toISOString(),
  }).eq('id', dest.id).eq('workspace_id', destino); // cinturón: nunca fuera del destino
  if (error) { avisos.push(`perfil: ${error.message}`); return 0; }
  return 1;
}

async function leerRecibo(ws: number, ambito: AmbitoKey): Promise<Recibo> {
  const sb = getSupabaseServer();
  const { data } = await sb.from('app_settings').select('value').eq('workspace_id', ws).eq('key', keyRecibo(ambito)).maybeSingle();
  const raw = (data as { value?: string } | null)?.value;
  if (!raw) return { settings: [], filas: {} };
  try {
    const p = JSON.parse(raw) as Partial<Recibo>;
    return {
      settings: Array.isArray(p.settings) ? p.settings : [],
      filas: p.filas && typeof p.filas === 'object' ? p.filas : {},
      // El recibo se reconstruye campo por campo: una clave que no se nombre acá
      // desaparece en silencio, y con ella la única forma de revertir el perfil.
      perfil: p.perfil && typeof p.perfil === 'object' ? (p.perfil as PerfilPrevio) : undefined,
    };
  } catch { return { settings: [], filas: {} }; }
}

async function guardarRecibo(ws: number, ambito: AmbitoKey, r: Recibo): Promise<void> {
  const sb = getSupabaseServer();
  await sb.from('app_settings').upsert(
    { workspace_id: ws, key: keyRecibo(ambito), value: JSON.stringify(r) },
    { onConflict: 'workspace_id,key' },
  );
}

/** Los ámbitos que hoy tienen datos traídos del dueño (para pintar el botón correcto). */
export async function ambitosCompletados(ws: number): Promise<AmbitoKey[]> {
  const sb = getSupabaseServer();
  const { data } = await sb.from('app_settings').select('key, value')
    .eq('workspace_id', ws).like('key', 'mako.datos_mau.%');
  const out: AmbitoKey[] = [];
  for (const r of ((data ?? []) as Array<{ key: string; value: string }>)) {
    const k = r.key.replace('mako.datos_mau.', '') as AmbitoKey;
    if (!(k in AMBITOS)) continue;
    try {
      const p = JSON.parse(r.value) as Recibo;
      const hayFilas = Object.values(p.filas ?? {}).some((v) => Array.isArray(v) && v.length > 0);
      // El perfil cuenta como traído aunque no escriba filas: si no, el ámbito se
      // pinta apagado y el botón para devolverlo nunca aparece.
      if ((p.settings ?? []).length || hayFilas || p.perfil) out.push(k);
    } catch { /* recibo ilegible: se ignora */ }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Traer
// ─────────────────────────────────────────────────────────────────────────────

function prepararFila(fila: Record<string, unknown>, t: TablaClon, destino: number, i: number): Record<string, unknown> {
  const out: Record<string, unknown> = { ...fila };
  for (const c of t.omitir ?? []) delete out[c];
  for (const [col, fn] of Object.entries(t.neutralizar ?? {})) {
    // Solo se toca lo que la tabla realmente tiene: el registro no puede
    // inventar una columna y romper el insert.
    if (col in fila) out[col] = fn(fila, i);
  }
  Object.assign(out, t.forzar ?? {});
  out.workspace_id = destino;
  return out;
}

/** Mapa de id viejo (del dueño) → id nuevo (del destino), por tabla copiada. */
type Mapas = Record<string, Map<string, string | number>>;

/**
 * Reescribe los ids que viven dentro de un jsonb (`pasos[].audio_id`). Lo que
 * no encuentra en el mapa se pone en null: un id del dueño que sobrevive es
 * peor que un hueco, porque el destino cree que tiene un audio y manda otro.
 */
function remapearJson(fila: Record<string, unknown>, r: NonNullable<TablaClon['remapJson']>, mapa: Map<string, string | number> | undefined): void {
  const arr = fila[r.campo];
  if (!Array.isArray(arr)) return;
  fila[r.campo] = arr.map((it) => {
    if (!it || typeof it !== 'object') return it;
    const o = it as Record<string, unknown>;
    if (o[r.clave] == null) return o;
    return { ...o, [r.clave]: mapa?.get(String(o[r.clave])) ?? null };
  });
}

async function copiarTabla(t: TablaClon, destino: number, recibo: Recibo, avisos: string[], mapas: Mapas): Promise<number> {
  const sb = getSupabaseServer();

  if (t.singleton) {
    const { data } = await sb.from(t.tabla).select('*').eq('workspace_id', OWNER_WS).limit(1);
    const fila = ((data ?? []) as Array<Record<string, unknown>>)[0];
    if (!fila) return 0;
    const nueva = { ...prepararFila(fila, t, destino, 0), id: destino };
    const { error } = await sb.from(t.tabla).upsert(nueva, { onConflict: 'workspace_id' });
    if (error) { avisos.push(`${t.tabla}: ${error.message}`); return 0; }
    (recibo.filas[t.tabla] ??= []).push(destino);
    return 1;
  }

  let q = sb.from(t.tabla).select('*').eq('workspace_id', OWNER_WS);
  if (t.soloNulo) q = q.is(t.soloNulo, null);
  if (t.ordenar) q = q.order(t.ordenar.col, { ascending: t.ordenar.asc ?? false });
  if (t.limite) q = q.limit(t.limite);
  const { data, error: eSel } = await q;
  if (eSel) { avisos.push(`${t.tabla}: ${eSel.message}`); return 0; }
  let origen = (data ?? []) as Array<Record<string, unknown>>;
  if (!origen.length) return 0;

  // Lo que el destino ya tiene con esa clave no se vuelve a traer: un UNIQUE por
  // workspace haría fallar el insert ENTERO, y con él todo el ámbito.
  if (t.dedupPor) {
    const { data: yaHay } = await sb.from(t.tabla).select(`id, ${t.dedupPor}`).eq('workspace_id', destino);
    // Clave → id QUE YA ESTÁ en el destino. No alcanza con saber cuáles
    // saltear: lo que apunta a esas filas (un audio_id, un setting) necesita
    // su id igual. Sin esto, copiar dos veces dejaba las secuencias apuntando
    // a la tanda vieja y el mapa de audios a la nueva.
    const existentes = new Map<string, string | number>();
    for (const r of ((yaHay ?? []) as unknown as Array<Record<string, unknown>>)) {
      existentes.set(String(r[t.dedupPor!]), r.id as string | number);
    }
    const yaEstaban = origen.filter((f) => existentes.has(String(f[t.dedupPor!])));
    const salteadas = yaEstaban.map((f) => String(f[t.dedupPor!]));
    const mapaPrevio = (mapas[t.tabla] ??= new Map());
    for (const f of yaEstaban) {
      const id = existentes.get(String(f[t.dedupPor!]));
      if (id != null && f.id != null) mapaPrevio.set(String(f.id), id);
    }
    origen = origen.filter((f) => !existentes.has(String(f[t.dedupPor!])));
    // Antes se salteaban en silencio y el resultado decía «copiado: N» como si
    // nada. Justo las dos secuencias del onboarding tienen clave fija, así que
    // una cuenta de prueba que ya lo hubiera corrido a medias descartaba
    // exactamente las versiones de Mauricio que se querían replicar.
    if (salteadas.length) {
      avisos.push(`${t.tabla}: ${salteadas.length} ya existían en este cliente y no se pisaron (${salteadas.slice(0, 4).join(', ')}${salteadas.length > 4 ? '…' : ''}). Bórralas primero si quieres las de Mau.`);
    }
    if (!origen.length) return 0;
  }

  const nuevas = origen.map((f, i) => prepararFila(f, t, destino, i));
  if (t.remapJson) {
    const mapa = mapas[t.remapJson.desde];
    if (!mapa) avisos.push(`${t.tabla}: no había mapa de ${t.remapJson.desde}, los ${t.remapJson.clave} quedan vacíos.`);
    for (const f of nuevas) remapearJson(f, t.remapJson, mapa);
  }
  const { data: ins, error } = await sb.from(t.tabla).insert(nuevas).select('id');
  if (error) { avisos.push(`${t.tabla}: ${error.message}`); return 0; }

  const ids = ((ins ?? []) as Array<{ id: string | number }>).map((r) => r.id);
  (recibo.filas[t.tabla] ??= []).push(...ids);
  // El insert devuelve los ids EN EL MISMO ORDEN en que se enviaron, así que el
  // mapa viejo→nuevo sale de aparear ambas listas por posición. Queda guardado
  // para las tablas y los settings que referencian estas filas.
  const mapaPropio = (mapas[t.tabla] ??= new Map());
  origen.forEach((f, i) => { if (ids[i] != null && f.id != null) mapaPropio.set(String(f.id), ids[i]); });

  // Los hijos se copian remapeando el FK al id nuevo. El insert de arriba
  // devuelve los ids EN EL MISMO ORDEN que se enviaron, así que el mapeo viejo→
  // nuevo sale de aparear ambas listas por posición.
  for (const h of t.hijos ?? []) {
    const mapa = new Map<string | number, string | number>();
    origen.forEach((f, i) => { if (ids[i] != null && f.id != null) mapa.set(f.id as string | number, ids[i]); });
    if (!mapa.size) continue;
    try {
      // Paginado por `id`, con el `limite` como corte ESCRITO (devolver false).
      // Antes era `.limit(h.limite)`, y `lead_respuestas` pide 1200: PostgREST
      // corta en 1000 sin avisar, así que el tope declarado era mentira.
      const dh: Array<Record<string, unknown>> = [];
      const keys = [...mapa.keys()];
      await leerPorPaginas<Record<string, unknown>>(sb, h.tabla, '*', (pag) => {
        for (const f of pag) {
          if (h.limite && dh.length >= h.limite) return false;
          dh.push(f);
        }
      }, { eq: { workspace_id: OWNER_WS }, filtros: (q) => q.in(h.fk, keys) });
      const hijas = dh
        .map((f) => {
          const o: Record<string, unknown> = { ...f };
          for (const c of h.omitir ?? []) delete o[c];
          o[h.fk] = mapa.get(f[h.fk] as string | number);
          o.workspace_id = destino;
          return o;
        })
        .filter((f) => f[h.fk] != null);
      if (!hijas.length) continue;
      const { data: insH, error: eH } = await sb.from(h.tabla).insert(hijas).select('id');
      if (eH) { avisos.push(`${h.tabla}: ${eH.message}`); continue; }
      (recibo.filas[h.tabla] ??= []).push(...((insH ?? []) as Array<{ id: string | number }>).map((r) => r.id));
    } catch (e) {
      avisos.push(`${h.tabla}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return ids.length;
}

/** Trae al workspace `destino` los datos del dueño que corresponden a `ambito`. */
export async function completarConDatosDelDueno(ambito: AmbitoKey, destino: number): Promise<ResultadoMau> {
  if (destino === OWNER_WS) throw new Error('Estás en el workspace del dueño. Entra a uno de prueba.');
  const def = AMBITOS[ambito];
  if (!def) throw new Error(`Ámbito desconocido: ${ambito}`);

  const sb = getSupabaseServer();
  const recibo = await leerRecibo(destino, ambito);
  const avisos: string[] = [];
  const detalle: Record<string, number> = {};
  // Los ids que va generando cada tabla copiada, para que lo que apunte a esas
  // filas —un jsonb, un setting— pueda traducirse en vez de quedar apuntando
  // a las filas del dueño.
  const mapas: Mapas = {};
  let copiado = 0;

  // ── Settings ──
  if (def.settings?.length) {
    const { data } = await sb.from('app_settings').select('key, value')
      .eq('workspace_id', OWNER_WS).in('key', def.settings);
    const filas = ((data ?? []) as Array<{ key: string; value: string }>)
      .filter((r) => (r.value ?? '').trim().length > 0)
      .map((r) => ({ workspace_id: destino, key: r.key, value: r.value }));
    if (filas.length) {
      const { error } = await sb.from('app_settings').upsert(filas, { onConflict: 'workspace_id,key' });
      if (error) throw new Error(`settings: ${error.message}`);
      for (const f of filas) if (!recibo.settings.includes(f.key)) recibo.settings.push(f.key);
      detalle.configuración = filas.length;
      copiado += filas.length;
    }
    // Los objetivos se cuentan desde HOY: con la fecha de Mau, el tablero de
    // prueba compararía contra meses de historia que no tiene y arrancaría rojo.
    if (ambito === 'objetivos') {
      await sb.from('app_settings').upsert(
        { workspace_id: destino, key: 'objetivo_desde', value: new Date().toISOString().slice(0, 10) },
        { onConflict: 'workspace_id,key' },
      );
      if (!recibo.settings.includes('objetivo_desde')) recibo.settings.push('objetivo_desde');
    }
  }

  // ── Tablas ──
  for (const t of def.tablas ?? []) {
    try {
      const n = await copiarTabla(t, destino, recibo, avisos, mapas);
      if (n) { detalle[t.tabla] = n; copiado += n; }
    } catch (e) {
      avisos.push(`${t.tabla}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── Settings que guardaban ids de filas ──
  // Va después de las tablas a propósito: el mapa viejo→nuevo recién existe
  // cuando las filas ya se insertaron. Se reescribe sobre lo ya copiado.
  for (const r of def.settingsRemap ?? []) {
    const mapa = mapas[r.desde];
    if (!mapa?.size) continue;
    try {
      const { data } = await sb.from('app_settings').select('value')
        .eq('workspace_id', destino).eq('key', r.key).maybeSingle();
      const raw = (data as { value?: string } | null)?.value;
      if (!raw) continue;
      // La forma es {clave: idViejo}: se traduce el VALOR. Lo que no esté en el
      // mapa se descarta — dejar el id del dueño haría que el destino se
      // pintara configurado apuntando a una fila ajena.
      const obj = JSON.parse(raw) as Record<string, unknown>;
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) continue;
      const traducido: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        const nuevo = mapa.get(String(v));
        if (nuevo != null) traducido[k] = nuevo;
      }
      await sb.from('app_settings').upsert(
        { workspace_id: destino, key: r.key, value: JSON.stringify(traducido) },
        { onConflict: 'workspace_id,key' },
      );
    } catch (e) {
      avisos.push(`${r.key}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── Credenciales (integraciones) ──
  if (def.credenciales) {
    const { credWs, guardarCredencial, esCredencialDeLaCasa, IdentificadorOcupadoError } = await import('./credenciales');
    for (const s of SERVICIOS_METODO) {
      // Con servicioFiltro (el caso normal: un ámbito = una integración) solo
      // entra ESE servicio. Sin él, el ámbito ("Todas las integraciones") las trae todas.
      if (def.servicioFiltro && s.key !== def.servicioFiltro) continue;
      for (const campo of s.campos) {
        // ⚠️ LO QUE ES DE LA CASA NO SE COPIA A UN WORKSPACE.
        //
        // Este bucle trae las credenciales del ws1 al workspace destino, y el
        // ws1 es Mauricio: un CLIENTE. Pero `credWs(env, OWNER_WS)` cae al
        // `process.env` de la plataforma, así que lo que se copiaba no era
        // siempre una conexión de Mauricio — a veces era la cuenta de MaKo.
        //
        // Medido el 02/09/2026: el ws4 tenía la key de ElevenLabs de MaKo
        // sembrada por acá, idéntica a la del ws1 y a la del super admin.
        // Borrarla de la base no alcanzaba: el próximo «traer datos de Mau» la
        // volvía a poner.
        //
        // Se pregunta a la MISMA lista que gobierna la migración del entorno,
        // no a `soloPlataforma`: ese flag se saca cuando una credencial pasa a
        // BYOK —es justo lo que se hizo con ElevenLabs— así que un filtro
        // colgado de él se apaga solo en el momento en que más se lo necesita.
        if (esCredencialDeLaCasa(campo.env)) continue;
        const valor = await credWs(campo.env, OWNER_WS);
        if (!valor) continue;
        try {
          await guardarCredencial(destino, campo.env, valor, s.key, 'datos-mau');
          if (!recibo.settings.includes(`cred:${campo.env}`)) recibo.settings.push(`cred:${campo.env}`);
          copiado += 1;
          detalle.credenciales = (detalle.credenciales ?? 0) + 1;
        } catch (e) {
          // Credencial de ruteo ya reclamada por el dueño: se salta, no es fatal.
          if (!(e instanceof IdentificadorOcupadoError)) {
            avisos.push(`${campo.env}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }
    }
  }

  // ── Perfil del dueño (nombre, foto, cargo) ──
  if (def.perfil) {
    try {
      const n = await copiarPerfilDelDueno(destino, recibo, avisos);
      if (n) { detalle.perfil = n; copiado += n; }
    } catch (e) {
      avisos.push(`perfil: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  await guardarRecibo(destino, ambito, recibo);
  if (def.nota) avisos.unshift(def.nota);
  return { copiado, detalle, avisos };
}

// ─────────────────────────────────────────────────────────────────────────────
// Devolver
// ─────────────────────────────────────────────────────────────────────────────

/** Borra del workspace `destino` exactamente lo que se trajo del dueño. */
export async function eliminarDatosDelDueno(ambito: AmbitoKey, destino: number): Promise<{ borrado: number; detalle: Record<string, number> }> {
  if (destino === OWNER_WS) throw new Error('Estás en el workspace del dueño. Aquí no se borra nada.');
  const sb = getSupabaseServer();
  const recibo = await leerRecibo(destino, ambito);
  const detalle: Record<string, number> = {};
  let borrado = 0;

  // Filas primero, hijos antes que padres: el orden inverso al de la copia
  // respeta las FKs sin tener que declararlas otra vez.
  const tablas = Object.keys(recibo.filas).reverse();
  for (const tabla of tablas) {
    const ids = recibo.filas[tabla] ?? [];
    if (!ids.length) continue;
    try {
      // De a tandas: una lista de 1200 ids en un solo .in() revienta la URL.
      for (let i = 0; i < ids.length; i += 200) {
        const tanda = ids.slice(i, i + 200);
        const { error } = await sb.from(tabla).delete().eq('workspace_id', destino).in('id', tanda);
        if (error) throw new Error(error.message);
        detalle[tabla] = (detalle[tabla] ?? 0) + tanda.length;
        borrado += tanda.length;
      }
    } catch { /* la fila ya no está: nada que borrar */ }
  }

  // Settings y credenciales.
  const claves = recibo.settings.filter((k) => !k.startsWith('cred:'));
  const creds = recibo.settings.filter((k) => k.startsWith('cred:')).map((k) => k.slice(5));
  if (claves.length) {
    await sb.from('app_settings').delete().eq('workspace_id', destino).in('key', claves);
    detalle.configuración = claves.length;
    borrado += claves.length;
  }
  if (creds.length) {
    const { eliminarCredencial } = await import('./credenciales');
    for (const c of creds) {
      try { await eliminarCredencial(destino, c); borrado += 1; } catch { /* ya no está */ }
    }
    detalle.credenciales = creds.length;
  }

  // El perfil no se BORRA: se devuelve. Borrarlo sería vaciarle el nombre a una
  // cuenta de login que el cliente de prueba ya tenía. El recibo guardó lo que
  // había antes de pisarlo, así que revertir es escribir eso de vuelta.
  if (recibo.perfil) {
    const p = recibo.perfil;
    const { error } = await sb.from('usuarios').update({
      nombre: p.nombre ?? '',
      foto_url: p.foto_url,
      perfil: p.perfil ?? {},
      updated_at: new Date().toISOString(),
    }).eq('id', p.usuarioId).eq('workspace_id', destino); // un recibo corrupto no puede tocar al dueño
    if (!error) { detalle.perfil = 1; borrado += 1; }
  }

  await sb.from('app_settings').delete().eq('workspace_id', destino).eq('key', keyRecibo(ambito));
  return { borrado, detalle };
}
