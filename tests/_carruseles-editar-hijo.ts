// =============================================================================
// Hijo de tests/carruseles-editar.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// `lib/carruseles/replica-servidor.ts` lleva `server-only`: corre en un node aparte con `--conditions=react-server`. Corre
// `replicarEjemplo` ENTERA —el orquestador de «Editar»— contra un PostgREST de mentira (tests/_postgrest-de-mentira.ts). De
// mentira es sólo lo de AFUERA: la base, el bucket y la RED de las IAs. La cascada (`lib/ai-cheap.ts`) corre de verdad, así
// que lo que se mira es el PEDIDO que le llega al proveedor: cuántas imágenes lleva, por qué endpoint sale y cuánto lugar
// pidió para la respuesta. El tope de salida del 6/11/2026 (8.000 tokens en vez de 512) sólo se puede comprobar así.
//
// ⚠️ `fetchSeguro` usa node:https con DNS real: en un test no puede bajar nada de internet. Lo que sí se prueba acá es la
// DECISIÓN —que una portada de un CDN ajeno NUNCA se baje con `fetch` pelado— haciendo que el `fetch` de mentira SÍ le
// contestaría con la imagen: si apareciera entre las vistas, se bajó por el camino equivocado. Que la bajada por `fetchSeguro`
// funciona se midió a mano con la IA real (scripts/carruseles-probar-editar.mts --ws 9 --id -895, 6/11/2026: 1 de 9 láminas).
//
// Por qué un hijo y no un test de las funciones puras: lo que falló en producción el 6/11/2026 no estaba en ninguna de ellas
// (el prompt, `leerReplica` y `documentoDeReplica` tenían 21 tests en verde). Estaba en las DECISIONES del orquestador.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
// Ninguna clave de la PLATAFORMA en el entorno: la IA que corre es la del negocio, como en producción (D6b).
for (const k of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY']) delete process.env[k];

const WS = 3;
const PLATAFORMA = 9;
/** El bucket de las miniaturas: `esNuestra` mira justo esta parte de la URL (lib/spy-miniaturas.ts). */
const NUESTRA = 'http://supa.test/storage/v1/object/public/spy-miniaturas/spy/instagram/portada.jpg';
/**
 * Un host del CDN de Instagram (está permitido: `esCdnPermitido`) que NO EXISTE, a propósito: así `fetchSeguro` falla en el
 * DNS, rápido e igual en todas las máquinas, y este test no depende de internet ni de lo que conteste Instagram hoy.
 */
const CDN = 'https://portada-de-prueba-que-no-existe.cdninstagram.com/v/t51.1/portada.jpg';
const AJENA = 'https://cualquier-cdn.example.com/portada.jpg';

/** Un JPEG de mentira: lo único que se le mira son los 3 bytes de la firma (`tipoDeImagen`). */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0, 0, 0, 0]);

const pg = crearPostgrest({
  tablas: ['workspaces', 'credenciales', 'carruseles_biblioteca_piezas', 'carruseles_biblioteca_cuentas', 'app_settings', 'anthropic_usage', 'ia_cuotas', 'ia_rebotes'],
});

/** Cada pedido que le llegó a una IA: por dónde salió, cuántas imágenes llevaba y cuánto lugar pidió para la respuesta. */
export type PedidoIA = { via: 'vision-nativa' | 'chat' | 'claude'; modelo: string; imagenes: number; tope: number | null };
let pedidos: PedidoIA[] = [];
/** Los hosts que se pidieron afuera de la base: así se ve por qué camino bajó cada imagen. */
let red: string[] = [];
/** Qué contesta la IA en esta corrida: el JSON, o un status de error (429 sin cuota, 500 un bache). */
let contesta: { json?: string; status?: number } = {};

const cuerpo = (init: RequestInit): Record<string, unknown> => {
  try { return JSON.parse(String(init.body ?? '{}')) as Record<string, unknown>; } catch { return {}; }
};

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
  const u = new URL(url);
  if (u.host === 'supa.test' && u.pathname.startsWith('/rest/')) return pg.responder(u, init);
  red.push(u.host);
  // Nuestro bucket contesta la imagen. Un CDN ajeno TAMBIÉN la contestaría: si llega a la IA por acá, se bajó mal.
  if (u.host === 'supa.test' || u.host.endsWith('.cdninstagram.com') || u.host.endsWith('.fbcdn.net')) {
    return new Response(JPEG, { status: 200, headers: { 'content-type': 'image/jpeg' } });
  }
  if (u.host === 'api.anthropic.com') {
    const b = cuerpo(init);
    const partes = ((b.messages as Array<{ content?: unknown }>)?.[0]?.content ?? []) as Array<Record<string, unknown>>;
    pedidos.push({
      via: 'claude', modelo: String(b.model ?? '?'),
      imagenes: Array.isArray(partes) ? partes.filter((p) => p.type === 'image').length : 0,
      tope: (b.max_tokens as number | undefined) ?? null,
    });
    if (contesta.status) return new Response(JSON.stringify({ type: 'error', error: { message: contesta.status === 429 ? 'rate_limit: quota' : 'internal error' } }), { status: contesta.status, headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify({ content: [{ type: 'text', text: contesta.json ?? '' }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (u.host === 'generativelanguage.googleapis.com') {
    const b = cuerpo(init);
    const nativa = /:generateContent$/.test(u.pathname);
    if (nativa) {
      const partes = ((b.contents as Array<{ parts?: unknown[] }>)?.[0]?.parts ?? []) as Array<Record<string, unknown>>;
      pedidos.push({
        via: 'vision-nativa', modelo: /models\/([^:]+):/.exec(u.pathname)?.[1] ?? '?',
        imagenes: partes.filter((p) => p.inline_data || p.inlineData).length,
        tope: ((b.generationConfig as { maxOutputTokens?: number } | undefined)?.maxOutputTokens) ?? null,
      });
    } else {
      pedidos.push({
        via: 'chat', modelo: String(b.model ?? '?'), imagenes: 0,
        tope: (b.max_tokens as number | undefined) ?? (b.max_completion_tokens as number | undefined) ?? null,
      });
    }
    if (contesta.status) {
      return new Response(JSON.stringify({ error: { code: contesta.status, message: contesta.status === 429 ? 'Resource has been exhausted: quota' : 'internal error' } }), { status: contesta.status, headers: { 'content-type': 'application/json' } });
    }
    const texto = contesta.json ?? '';
    const resp = nativa
      ? { candidates: [{ content: { parts: [{ text: texto }] }, finishReason: 'STOP' }] }
      : { choices: [{ message: { content: texto }, finish_reason: 'stop' }] };
    return new Response(JSON.stringify(resp), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return new Response('no', { status: 403 });
}) as typeof fetch;

/** Un carrusel de la biblioteca de 9 láminas, de las que NO se guardó ninguna: el caso que falló el 6/11/2026. */
function sembrar(portada: string | null) {
  pg.db.carruseles_biblioteca_cuentas.length = 0;
  pg.db.carruseles_biblioteca_piezas.length = 0;
  const ahora = new Date().toISOString();
  pg.db.carruseles_biblioteca_cuentas.push({
    id: 7, instagram: 'creadorajeno', nombre: 'Creador Ajeno', fuente: 'lista', referente: null, estado: 'activa', motivo: null,
    foto: null, leida_en: ahora,
  });
  pg.db.carruseles_biblioteca_piezas.push({
    id: 55, ref: 'ABC123', cuenta_id: 7, tema_id: null, url: 'https://instagram.com/p/ABC123', miniatura: portada,
    texto: 'A los 22 anos escribio sus 10 metas. Comenta METAS y te mando la lista.', formato: 'lista', cierre: 'comentario',
    medio: 'carrusel', laminas: 9, megusta: 900, comentarios: 80, vistas: 10_000, laminas_imagenes: null, cta: 'METAS',
    cta_via: 'comentario', parece_contenido: true, publicada_en: ahora, visto_primera_vez: ahora, dejo_de_verse_en: null,
    texto_leido_en: ahora, metricas_leidas_en: ahora,
  });
}

/** Lo que devolvería un modelo que entendió el pedido: 9 láminas, con un @ que NADIE cargó y el mail del negocio. */
const RESPUESTA_IA = JSON.stringify({
  proporcion: '4:5',
  titulo: 'Mis 9 pasos',
  laminas: Array.from({ length: 9 }, (_, i) => ({
    fondo: '#101010',
    foto: null,
    textos: [
      { rol: 'titulo', letra: 'gruesa', texto: `PASO ${i + 1} PARA TU NEGOCIO`, x: 0.08, y: 0.2, ancho: 0.84, tamano: 0.1, color: '#FFFFFF', negrita: true, alinear: 'left', mayus: true },
      { rol: 'firma', letra: 'sans', texto: 'Sonrisa Llena @sonrisallena · hola@sonrisallena.com', x: 0.08, y: 0.9, ancho: 0.84, tamano: 0.03, color: '#FFFFFF', negrita: false, alinear: 'left', mayus: false },
    ],
  })),
});

export type Salida = {
  ok: boolean; sinIA?: boolean; aviso?: string | null; conectar?: string | null; vistas?: number; errores?: string[];
  laminasMostradas: number; textos: string[]; pedidos: PedidoIA[]; red: string[]; paginas: number; permitida: boolean;
};

async function main() {
  const { cifrarSecreto } = await import('../lib/credenciales');
  const ahora = new Date().toISOString();
  pg.db.workspaces.push({ id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo', created_at: ahora }, { id: WS, capa: 'cliente', nombre: 'Sonrisa Llena', created_at: ahora });

  const { runWithWorkspace } = await import('../lib/workspace');
  const { replicarEjemplo, esImagenPermitida } = await import('../lib/carruseles/replica-servidor');

  /** `conIA`: las claves que tiene cargadas el negocio (D6b: la IA que corre es la suya, nunca la de la plataforma). */
  const correr = async (o: { portada: string | null; conIA: Array<'GEMINI_API_KEY' | 'ANTHROPIC_API_KEY'>; responde: typeof contesta }): Promise<Salida> => {
    sembrar(o.portada);
    pg.db.credenciales.length = 0;
    for (const clave of o.conIA) pg.db.credenciales.push({ workspace_id: WS, clave, valor_enc: cifrarSecreto(`negocio-${'x'.repeat(30)}`, WS, clave), servicio: clave.split('_')[0].toLowerCase() });
    red = []; pedidos = []; contesta = o.responde;
    const mostradas: Array<Record<string, unknown>> = [];
    const r = await runWithWorkspace(WS, () => replicarEjemplo(WS, 'test', { que: 'carrusel', id: -55 }, {
      seco: true, timeoutMs: 5_000,
      alEvento: (e) => { if (e.fase === 'lamina') mostradas.push(e.pagina); },
    }));
    const textos = mostradas.flatMap((p) => ((p.objects as Array<Record<string, unknown>>) ?? []).filter((x) => x.type === 'textbox').map((x) => String(x.text)));
    const doc = (r as { doc?: { pages?: unknown[] } }).doc;
    return {
      ok: r.ok, sinIA: (r as { sinIA?: boolean }).sinIA, aviso: (r as { aviso?: string | null }).aviso ?? null,
      conectar: (r as { conectar?: string | null }).conectar ?? null, vistas: (r as { vistas?: number }).vistas,
      errores: (r as { errores?: string[] }).errores, laminasMostradas: mostradas.length, textos,
      pedidos: [...pedidos], red: [...new Set(red)], paginas: doc?.pages?.length ?? 0, permitida: esImagenPermitida(o.portada ?? ''),
    };
  };

  const SU_GEMINI: Array<'GEMINI_API_KEY'> = ['GEMINI_API_KEY'];
  const out: Record<string, Salida> = {
    // 1. La portada está en NUESTRO bucket: se baja con `fetch` y la IA la mira.
    nuestra: await correr({ portada: NUESTRA, conIA: SU_GEMINI, responde: { json: RESPUESTA_IA } }),
    // 2. La portada quedó con la URL del CDN de Instagram (la miniatura que no se pudo copiar): el caso del 6/11.
    cdn: await correr({ portada: CDN, conIA: SU_GEMINI, responde: { json: RESPUESTA_IA } }),
    // 3. Ninguna imagen que se pueda bajar: el camino de SÓLO TEXTO, el que iba por `chatCheap` con 512 tokens.
    sinImagen: await correr({ portada: AJENA, conIA: SU_GEMINI, responde: { json: RESPUESTA_IA } }),
    // 4. El MISMO caso con su Claude Y su Gemini cargados: lo que distingue la cascada de `chatCheap` es que PRUEBA SU CLAUDE
    //    primero (eso era el agujero del 6/11, y sin dos claves no se ve: con una sola, las dos puertas salen igual).
    dosClaves: await correr({ portada: AJENA, conIA: ['GEMINI_API_KEY', 'ANTHROPIC_API_KEY'], responde: { json: RESPUESTA_IA } }),
    // 5. La IA que mira se cae por un bache del proveedor: se prueba sin mirar antes de dejar guías.
    reintentaSinVer: await correr({ portada: NUESTRA, conIA: SU_GEMINI, responde: { status: 500 } }),
    // 6. Su cuenta sin cuota: el aviso dice de quién es y manda a Integraciones.
    sinCuota: await correr({ portada: NUESTRA, conIA: SU_GEMINI, responde: { status: 429 } }),
    // 7. Sin ninguna IA conectada: guías, y el modal NO queda en blanco.
    sinIA: await correr({ portada: NUESTRA, conIA: [], responde: {} }),
  };
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
