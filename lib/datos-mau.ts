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
  /** Se muestra bajo los botones cuando hay algo que aclarar. */
  nota?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// El registro
// ─────────────────────────────────────────────────────────────────────────────

export const AMBITOS: Record<AmbitoKey, AmbitoDef> = {
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
  setting: {
    titulo: 'Jugadas y voz',
    seccion: 'Chat Agent',
    label: 'las jugadas y la voz de Mau',
    settings: ['mako.voz_guia'],
    tablas: [
      // Pausadas SIEMPRE: un workspace de prueba no arranca mandando solo.
      { tabla: 'nutricion_secuencias', omitir: ['id'], forzar: { activa: false }, dedupPor: 'clave' },
      { tabla: 'setting_audios', omitir: ['id'], limite: 40, ordenar: { col: 'created_at' } },
    ],
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

/**
 * Credenciales que NO viajan al workspace de prueba: son de la AGENCIA (las paga
 * y las gestiona ella, son globales a la plataforma). Todo lo demás sí viaja.
 *
 * Va como lista NEGRA a propósito. Con lista blanca, cada servicio nuevo del
 * catálogo quedaba afuera EN SILENCIO — así se perdió GEMINI_API_KEY, que el
 * onboarding le pide al cliente en un paso propio y que lib/ai-cheap.ts resuelve
 * por workspace. El modo de falla correcto es "copié de más", no "no copié nada".
 */
const SERVICIOS_AGENCIA = new Set(['anthropic', 'openai', 'email']);
const credencialViaja = (servicioKey: string) => !SERVICIOS_AGENCIA.has(servicioKey);

// Una entrada POR INTEGRACIÓN del catálogo, no un solo botón que las trae todas
// juntas y sin nombre. El dueño pidió ver cada conexión (Meta, WhatsApp,
// Gemini…) y poder traerla una por una — acá vive el apartado.
for (const s of SERVICIOS_METODO) {
  if (!credencialViaja(s.key)) continue; // anthropic/openai/email: de agencia, no viajan
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

type Recibo = { settings: string[]; filas: Record<string, Array<string | number>> };
const keyRecibo = (a: AmbitoKey) => `mako.datos_mau.${a}`;

async function leerRecibo(ws: number, ambito: AmbitoKey): Promise<Recibo> {
  const sb = getSupabaseServer();
  const { data } = await sb.from('app_settings').select('value').eq('workspace_id', ws).eq('key', keyRecibo(ambito)).maybeSingle();
  const raw = (data as { value?: string } | null)?.value;
  if (!raw) return { settings: [], filas: {} };
  try {
    const p = JSON.parse(raw) as Partial<Recibo>;
    return { settings: Array.isArray(p.settings) ? p.settings : [], filas: p.filas && typeof p.filas === 'object' ? p.filas : {} };
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
      if ((p.settings ?? []).length || hayFilas) out.push(k);
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

async function copiarTabla(t: TablaClon, destino: number, recibo: Recibo, avisos: string[]): Promise<number> {
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
  if (t.ordenar) q = q.order(t.ordenar.col, { ascending: t.ordenar.asc ?? false });
  if (t.limite) q = q.limit(t.limite);
  const { data, error: eSel } = await q;
  if (eSel) { avisos.push(`${t.tabla}: ${eSel.message}`); return 0; }
  let origen = (data ?? []) as Array<Record<string, unknown>>;
  if (!origen.length) return 0;

  // Lo que el destino ya tiene con esa clave no se vuelve a traer: un UNIQUE por
  // workspace haría fallar el insert ENTERO, y con él todo el ámbito.
  if (t.dedupPor) {
    const { data: yaHay } = await sb.from(t.tabla).select(t.dedupPor).eq('workspace_id', destino);
    const existentes = new Set(((yaHay ?? []) as unknown as Array<Record<string, unknown>>).map((r) => String(r[t.dedupPor!])));
    origen = origen.filter((f) => !existentes.has(String(f[t.dedupPor!])));
    if (!origen.length) return 0;
  }

  const nuevas = origen.map((f, i) => prepararFila(f, t, destino, i));
  const { data: ins, error } = await sb.from(t.tabla).insert(nuevas).select('id');
  if (error) { avisos.push(`${t.tabla}: ${error.message}`); return 0; }

  const ids = ((ins ?? []) as Array<{ id: string | number }>).map((r) => r.id);
  (recibo.filas[t.tabla] ??= []).push(...ids);

  // Los hijos se copian remapeando el FK al id nuevo. El insert de arriba
  // devuelve los ids EN EL MISMO ORDEN que se enviaron, así que el mapeo viejo→
  // nuevo sale de aparear ambas listas por posición.
  for (const h of t.hijos ?? []) {
    const mapa = new Map<string | number, string | number>();
    origen.forEach((f, i) => { if (ids[i] != null && f.id != null) mapa.set(f.id as string | number, ids[i]); });
    if (!mapa.size) continue;
    try {
      let qh = sb.from(h.tabla).select('*').eq('workspace_id', OWNER_WS).in(h.fk, [...mapa.keys()]);
      if (h.limite) qh = qh.limit(h.limite);
      const { data: dh } = await qh;
      const hijas = ((dh ?? []) as Array<Record<string, unknown>>)
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
      const n = await copiarTabla(t, destino, recibo, avisos);
      if (n) { detalle[t.tabla] = n; copiado += n; }
    } catch (e) {
      avisos.push(`${t.tabla}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── Credenciales (integraciones) ──
  if (def.credenciales) {
    const { credWs, guardarCredencial, IdentificadorOcupadoError } = await import('./credenciales');
    for (const s of SERVICIOS_METODO) {
      // Con servicioFiltro (el caso normal: un ámbito = una integración) solo
      // entra ESE servicio. Sin él, el ámbito trae todas las que no son de agencia.
      if (def.servicioFiltro ? s.key !== def.servicioFiltro : !credencialViaja(s.key)) continue;
      for (const campo of s.campos) {
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

  await sb.from('app_settings').delete().eq('workspace_id', destino).eq('key', keyRecibo(ambito));
  return { borrado, detalle };
}
