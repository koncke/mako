// =============================================================================
// copiloto — la batería de conversaciones del Marketing CoPilot, con el TURNO DE VERDAD (9/11/2026)
// =============================================================================
// Martín (9/11/2026): «Hacé la prueba con diferentes funnels: ¿qué pasa si una persona quiere hacer un funnel de anuncios,
// después un orgánico, después un YouTube, después email…? Si le estás recomendando bien, si le falta información, si le
// falta hacer preguntas». Este arnés corre cada conversación con `turnoApp` (lib/mako-turno-app.ts) y el MISMO contexto que
// arma la ruta para la tab (app/api/mako/chat/route.ts → `contextoDelChat`): reglas, perfil, conocimiento, fichas y las
// herramientas propias del CoPilot. El modelo es el que le toca al negocio (en el ws 9, la red de la plataforma).
//
// LO QUE PONE ESTE ARCHIVO, además de lo de ./entorno.mts:
//   1. EL PERFIL DEL COPILOT EN MEMORIA (lib/media-buyer/copiloto-store.ts reemplazado en la caché de `require`): cada caso
//      arranca con el suyo y lo que MaKo propone guardar con `copiloto_media_buyer` se aplica acá cuando la persona
//      «toca Confirmar» (el arnés lo hace por ella). Nada se escribe en `app_settings`.
//   2. EL NEGOCIO DE CADA CASO (`--negocio=caso`, por defecto): el perfil del negocio, su fase, sus objetivos, sus
//      experimentos, su embudo, su oferta y su Second Brain salen del caso, no del ws 9 (que es MaKo). Con
//      `--negocio=real` va lo del ws 9 tal cual: el caso «mako» mide si usa la información de un negocio de verdad.
//   3. LA PERSONA: un modelo aparte (Haiku) contesta lo que MaKo pregunta con la ficha del caso y nada más; los cambios de
//      funnel («¿y si en vez de anuncios hago orgánico?») los mete el guion en su turno, digan lo que digan.
//   4. LA CLAVE DEL CHAT es una de prueba (`mako-movil:prueba-copiloto`): las conversaciones no aparecen en la lista de
//      nadie. Las tarjetas que MaKo propone quedan en `pendientes` de esa clave y vencen solas a las dos horas.
//
// Uso (desde la raíz del repo):
//   node --env-file=<ruta a .env.local> --conditions=react-server --import tsx scripts/probar-chats/copiloto.mts \
//        [--casos=infoproductor,coach] [--negocio=caso|real] [--salida=archivo.json]
// ⚠️ Sólo el ws 9 (el de MaKo, sin IA de un cliente) o los de prueba: nunca un negocio de cliente.
// =============================================================================

import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { RAIZ } from './entorno.mjs';
import { CASOS, type CasoCopiloto } from './copiloto-casos.mjs';

const requerir = createRequire(import.meta.url);
const arg = (n: string): string | null => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : null;
};
const WS = Number(arg('ws') ?? 9);
if (![3, 4, 9].includes(WS)) throw new Error(`el arnés del CoPilot corre en el ws 9 o en uno de prueba, no en el ws ${WS}`);
const SOLO = (arg('casos') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const NEGOCIO: 'caso' | 'real' = arg('negocio') === 'real' ? 'real' : 'caso';
const SHA = (() => { try { return execFileSync('git', ['-C', RAIZ, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return '?'; } })();
const SALIDA = arg('salida') ?? join(tmpdir(), 'probar-chats', `copiloto-${SHA.slice(0, 9)}-${Date.now()}.json`);

/** Un módulo de la app reemplazado en la caché de `require` (antes de que nadie lo importe). */
function reemplazar(rel: string, armar: (real: Record<string, unknown>) => Record<string, unknown>): void {
  const archivo = join(RAIZ, ...rel.split('/'));
  const real = requerir(archivo) as Record<string, unknown>;
  const copia: Record<string, unknown> = {};
  for (const k of Object.keys(real)) copia[k] = real[k];
  const exp = armar(copia);
  const Modulo = requerir('node:module') as { new (id: string): { filename: string; loaded: boolean; exports: unknown } };
  const m = new Modulo(archivo);
  m.filename = archivo;
  m.loaded = true;
  m.exports = exp;
  (requerir.cache as Record<string, unknown>)[archivo] = m;
}

// ── 1. El perfil del CoPilot, en memoria ─────────────────────────────────────────────────
let perfil: Record<string, unknown> = {};
reemplazar('lib/media-buyer/copiloto-store.ts', (r) => ({
  ...r,
  leerPerfilCopiloto: async () => ({ ...perfil }),
  leerPerfilCopilotoEstricto: async () => ({ ...perfil }),
  guardarPerfilCopiloto: async (_ws: number, p: Record<string, unknown>) => { perfil = { ...p }; },
}));

// ── 2. El negocio del caso ───────────────────────────────────────────────────────────────
let casoActual: CasoCopiloto | null = null;
if (NEGOCIO === 'caso') {
  const del = (k: keyof CasoCopiloto['negocio']) => async () => casoActual?.negocio[k] ?? '';
  reemplazar('lib/onboarding.ts', (r) => ({ ...r, perfilNegocioTexto: del('perfil') }));
  reemplazar('lib/fase-store.ts', (r) => ({ ...r, faseNegocioTexto: del('fase') }));
  reemplazar('lib/objectives.ts', (r) => ({ ...r, objetivosContextoTexto: del('objetivos') }));
  reemplazar('lib/experimentos.ts', (r) => ({ ...r, resumenExperimentos: async () => '' }));
  reemplazar('lib/persona.ts', (r) => ({ ...r, resumenCaraDeMarca: async () => '' }));
  reemplazar('lib/tab-onboarding-state.ts', (r) => ({ ...r, resumenOnboardingTabs: async () => '' }));
  reemplazar('lib/cerebro-para-chat.ts', (r) => ({ ...r, paqueteParaElTurno: del('cerebro') }));
  reemplazar('lib/ofertas.ts', (r) => ({ ...r, listarOfertas: async () => casoActual?.negocio.ofertas ?? [] }));
}

// ── 3. Lo que ve el modelo y lo que hace, anotado ────────────────────────────────────────
type Llamada = { herramienta: string; entrada: unknown; salida: string };
const LECTURAS_QUE_PASAN = new Set(['ver_copiloto_media_buyer', 'leer_modulo_knowledge', 'ver_modulo_knowledge']);
const registro: { system: string; tools: string[]; llamadas: Llamada[]; modelo: string | null } = { system: '', tools: [], llamadas: [], modelo: null };
reemplazar('lib/anthropic.ts', (r) => ({
  ...r,
  chatClaudeTools: async (system: string, msgs: unknown, tools: Array<{ name: string }>, runTool: (n: string, i: unknown) => Promise<unknown>, opts: unknown) => {
    registro.system = system;
    registro.tools = tools.map((t) => t.name);
    const envuelto = async (n: string, i: unknown) => {
      // Con el negocio del caso, una lectura de la CUENTA (Meta, CRM, el plan del ws 9) devuelve lo del caso: si no, el modelo
      // leería la cuenta de MaKo y hablaría de otro negocio. Las del CoPilot, el cálculo y el método de los cursos pasan.
      const deLaCuenta = NEGOCIO === 'caso' && /^(ver|listar|leer|buscar|consultar)_/.test(n) && !LECTURAS_QUE_PASAN.has(n);
      const out = deLaCuenta
        ? JSON.stringify(casoActual?.lecturas?.[n] ?? { ok: true, datos: null, nota: 'Este negocio todavía no tiene datos de eso en MaKo (no conectó la cuenta o no cargó nada).' })
        : await runTool(n, i);
      const txt = typeof out === 'string' ? out : JSON.stringify((out as { content?: unknown })?.content ?? out);
      registro.llamadas.push({ herramienta: n, entrada: i, salida: String(txt).slice(0, 2500) });
      return out;
    };
    const res = await (r.chatClaudeTools as (...a: unknown[]) => Promise<{ text?: string; model?: string; provider?: string }>)(system, msgs, tools, envuelto, opts);
    registro.modelo = [res?.provider, res?.model].filter(Boolean).join(':') || null;
    return res;
  },
}));

// ── La app, ya con todo reemplazado ──────────────────────────────────────────────────────
const { turnoApp, confirmarDesdeTarjeta } = await import('../../lib/mako-turno-app');
const { createSession } = await import('../../lib/chart-chats');
const { runWithWorkspace } = await import('../../lib/workspace');
const { HERRAMIENTAS_DEL_COPILOTO } = await import('../../lib/media-buyer/copiloto-contexto');
const { contextoDelCopilotoVigente } = await import('../../lib/media-buyer/copiloto-contexto-vigente');
const { desdeDelCopiloto, sanearPerfil } = await import('../../lib/media-buyer/copiloto');
const { getSupabaseServer } = await import('../../lib/supabase');

const CLAVE = 'mako-movil:prueba-copiloto';
const persona = { ws: WS, rol: 'admin' as const, actor: 'arnes-copiloto', chartKey: CLAVE };

// ── La persona que escribe: un modelo chico (Haiku) con la ficha del caso ────────────────
// No es la IA del negocio ni la del turno: sólo hace de persona. Con Haiku porque la Gemini de la plataforma en el ws 9 tiene
// dos claves vencidas (9/11/2026) y la persona tardaba más que MaKo.
async function contestaLaPersona(caso: CasoCopiloto, hilo: Array<{ quien: 'persona' | 'mako'; texto: string }>): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('falta ANTHROPIC_API_KEY');
  const system = `Eres ${caso.quien}. Le escribes a MaKo, el asistente de marketing de tu app, desde el teléfono. Contesta SÓLO lo que MaKo te preguntó, corto (1 a 3 frases), como un dueño de negocio real en un chat, en español neutro. Usa SOLO estos datos; si te pregunta algo que no está aquí, di que no sabes o que no lo tienes claro (no inventes números). No cuentes datos que no te preguntaron. No hagas preguntas nuevas salvo que no entiendas. Si MaKo ya te dio un plan y no te preguntó nada, di qué te parece en una frase (con una duda real si la tienes).
TUS DATOS:
${caso.ficha}`;
  const historial = hilo.map((m) => `${m.quien === 'persona' ? 'TÚ' : 'MAKO'}: ${m.texto}`).join('\n\n');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5', max_tokens: 300, temperature: 0.4, system,
      messages: [{ role: 'user', content: `La conversación hasta ahora:

${historial}

Escribe SOLO tu próximo mensaje para MaKo, sin comillas ni prefijos.` }],
    }),
  });
  const j = (await r.json()) as { content?: Array<{ text?: string }>; error?: { message?: string } };
  const t = j.content?.map((p) => p.text ?? '').join('').trim();
  if (!t) throw new Error(`la persona no contestó: ${j.error?.message ?? JSON.stringify(j).slice(0, 200)}`);
  return t.replace(/^(TÚ|TU|Yo):\s*/i, '');
}

type Turno = {
  n: number; persona: string; guion: boolean; mako: string; aviso: string | null; ms: number; modelo: string | null;
  herramientas: string[]; llamadas: Llamada[]; propuestas: Array<{ titulo: string; resumen: string }>;
  perfilAntes: Record<string, unknown>; perfilDespues: Record<string, unknown>; systemChars: number;
};

async function correrCaso(caso: CasoCopiloto): Promise<{ caso: string; turnos: Turno[]; systemPrimero: string }> {
  casoActual = caso;
  perfil = { ...(caso.perfil ?? {}) };
  const sesion = await runWithWorkspace(WS, () => createSession(CLAVE, `Prueba CoPilot · ${caso.id} · ${SHA.slice(0, 7)}`, ''));
  const hilo: Array<{ quien: 'persona' | 'mako'; texto: string }> = [];
  const turnos: Turno[] = [];
  let systemPrimero = '';
  const tope = Number(arg('turnos') ?? 0) || caso.turnos;
  for (let n = 1; n <= Math.min(tope, caso.turnos); n++) {
    const guion = caso.guion[n];
    const texto = guion ?? (n === 1 ? caso.apertura : await contestaLaPersona(caso, hilo));
    registro.system = ''; registro.tools = []; registro.llamadas = []; registro.modelo = null;
    const perfilAntes = { ...perfil };
    const t0 = Date.now();
    const r = await turnoApp(persona, sesion.id, {
      mensaje: texto, contexto: await contextoDelCopilotoVigente(sanearPerfil(perfil)), referente: (perfil.referente as string | undefined) ?? null,
      propias: HERRAMIENTAS_DEL_COPILOTO, guardarAdjuntos: true, plazoMs: 420_000, desde: desdeDelCopiloto(),
    });
    const ms = Date.now() - t0;
    const mako = (r?.mensajes ?? []).filter((m) => m.role === 'assistant').map((m) => m.content).join('\n').trim();
    // «Confirmar» por la persona: lo que MaKo propuso guardar en el CoPilot se guarda (en memoria) con el mismo camino.
    for (const p of r?.propuestas ?? []) {
      if (!/Marketing CoPilot/i.test(p.titulo)) continue;
      await confirmarDesdeTarjeta(persona, sesion.id, p.pendienteId).catch((e: unknown) => console.error('  confirmar', e instanceof Error ? e.message : e));
    }
    if (n === 1) systemPrimero = registro.system;
    hilo.push({ quien: 'persona', texto }, { quien: 'mako', texto: mako || `(sin respuesta: ${r?.aviso ?? '?'})` });
    turnos.push({
      n, persona: texto, guion: !!guion || n === 1, mako, aviso: r?.aviso ?? null, ms, modelo: registro.modelo, herramientas: registro.tools,
      llamadas: registro.llamadas.slice(), propuestas: (r?.propuestas ?? []).map((p) => ({ titulo: p.titulo, resumen: p.resumen })),
      perfilAntes, perfilDespues: { ...perfil }, systemChars: registro.system.length,
    });
    console.log(`\n[${caso.id} ${n}] PERSONA: ${texto}\n[${caso.id} ${n}] MAKO (${Math.round(ms / 1000)} s, ${registro.modelo ?? '?'}, ${registro.llamadas.map((l) => l.herramienta).join(',') || 'sin herramientas'}): ${mako || r?.aviso}`);
  }
  return { caso: caso.id, turnos, systemPrimero };
}

const elegidos = CASOS.filter((c) => !SOLO.length || SOLO.includes(c.id));
const resultados = [];
for (const c of elegidos) {
  try { resultados.push(await correrCaso(c)); } catch (e) { console.error(`[${c.id}] se cayó:`, e instanceof Error ? e.stack : e); resultados.push({ caso: c.id, error: String(e) }); }
  mkdirSync(dirname(SALIDA), { recursive: true });
  writeFileSync(SALIDA, JSON.stringify({ sha: SHA, ws: WS, negocio: NEGOCIO, cuando: new Date().toISOString(), resultados }, null, 1));
}
console.log(`\nGuardado: ${SALIDA}`);
void getSupabaseServer;
process.exit(0);
