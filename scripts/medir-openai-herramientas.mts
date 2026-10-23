// =============================================================================
// medir-openai-herramientas — qué tan bien sigue herramientas al estilo MaKo cada modelo de OpenAI, y cuánto cuesta un turno
// =============================================================================
// Uso (el .env.local sale del directorio desde donde se corre; sólo LEE la base, y gasta crédito de OpenAI de MaKo):
//   npx tsx --conditions=react-server <este repo>/scripts/medir-openai-herramientas.mts gpt-5.6-luna gpt-6-luna gpt-6.1-sol
//
// Para qué (23/10/2026, el Cerebro: «"Tu ChatGPT" con modelo a elegir… Por defecto, uno capaz de orquestar herramientas, no
// gpt-4o-mini. Elegí cuál con datos… Antes de pasar la punta, probalo de punta a punta con la clave del ws9 (la de MaKo), nunca
// con la de un cliente»). El default de `MODELO_SU_OPENAI_DEFAULT` (lib/chat-ia-reglas.ts) salió de números PUBLICADOS porque
// ese día la cuenta de OpenAI de MaKo no tenía crédito (429 `credit_balance_exhausted` en todo pedido). Esto lo confirma o lo
// cambia, con la clave de la PLATAFORMA y nunca con la de un cliente.
//
// Lo que mide, y por qué así:
//   · El cuerpo del pedido es el de la capa barata (`paramsDeSalida`, lib/ai-cheap-techo.ts): si un modelo rechaza los campos
//     de salida, acá sale el 400 que vería un cliente, no uno que armó la prueba.
//   · Cuatro herramientas con la forma de las de MaKo (buscar un id, mover con un enum, crear con fecha, una métrica) y tres
//     pedidos × 2: encadenar (buscar → mover → tarea de mañana a las 10), contestar con UNA herramienta, y NO llamar ninguna.
//   · El mismo plazo por pedido que la capa barata (45 s): un modelo que razona y tarda más, acá falla igual que en el chat.
//   · ⚠️ El system es de una línea y el del Ops Center pesa 13-16 mil tokens: los segundos y el costo que salen acá son un
//     PISO. Lo que decide es «acertó N/6»; la latencia real la da la prueba de punta a punta.
//   · Nunca imprime la clave.
// =============================================================================
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const imp = (rel: string) => import(pathToFileURL(path.join(REPO, rel)).href);
const dotenv = await import(pathToFileURL(path.join(REPO, 'node_modules', 'dotenv', 'lib', 'main.js')).href);
(dotenv.default ?? dotenv).config({ path: path.join(process.cwd(), '.env.local'), quiet: true });

const { credDelCliente } = await imp('lib/credenciales.ts');
const { wsSuperAdmin } = await imp('lib/workspace.ts');
const { paramsDeSalida } = await imp('lib/ai-cheap-techo.ts');

const MODELOS = process.argv.slice(2);
if (!MODELOS.length) { console.error('Pasá los modelos a medir: gpt-5.6-luna gpt-6-luna …'); process.exit(2); }
// US$ por millón (entrada, salida). Fuente: developers.openai.com/api/docs/pricing, leída el 23/10/2026.
const PRECIO: Record<string, [number, number]> = {
  'gpt-4o-mini': [0.15, 0.6], 'gpt-5.4-mini': [0.75, 4.5], 'gpt-5.6-luna': [0.2, 1.2], 'gpt-6-luna': [0.1, 0.5], 'gpt-6.1-sol': [2, 10],
};

const ws = await wsSuperAdmin();
const KEY: string | null = await credDelCliente('OPENAI_API_KEY', ws);
if (!KEY) { console.error(`El workspace de la plataforma (ws${ws}) no tiene su clave de OpenAI.`); process.exit(1); }

const manana = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const tools = [
  { type: 'function', function: { name: 'buscar_lead', description: 'Busca un lead del CRM por nombre. Devuelve su id.', parameters: { type: 'object', properties: { nombre: { type: 'string' } }, required: ['nombre'] } } },
  { type: 'function', function: { name: 'mover_lead', description: 'Mueve un lead a otra etapa del embudo.', parameters: { type: 'object', properties: { lead_id: { type: 'integer' }, etapa: { type: 'string', enum: ['nuevo', 'contactado', 'reunion_agendada', 'propuesta', 'ganado', 'perdido'] } }, required: ['lead_id', 'etapa'] } } },
  { type: 'function', function: { name: 'crear_tarea', description: 'Crea una tarea en el plan, opcionalmente atada a un lead.', parameters: { type: 'object', properties: { titulo: { type: 'string' }, fecha: { type: 'string', description: 'YYYY-MM-DD' }, hora: { type: 'string', description: 'HH:MM' }, lead_id: { type: 'integer' } }, required: ['titulo', 'fecha'] } } },
  { type: 'function', function: { name: 'metricas_leads', description: 'Cuántos leads entraron en un período.', parameters: { type: 'object', properties: { periodo: { type: 'string', enum: ['hoy', 'semana', 'mes'] } }, required: ['periodo'] } } },
];
const SYSTEM = `Sos MaKo, el asistente del CRM de un negocio. Hoy es ${new Date().toISOString().slice(0, 10)}. Usá las herramientas para hacer lo que te piden; no inventes ids. Respondé en español, corto.`;
type Llamada = { name: string; args: Record<string, unknown> };
const ESCENARIOS: Array<{ nombre: string; pedido: string; ok: (c: Llamada[]) => boolean }> = [
  { nombre: 'encadenar', pedido: 'Pasá a Juan Pérez a reunión agendada y anotame llamarlo mañana a las 10.',
    ok: (c) => {
      const m = c.find((x) => x.name === 'mover_lead'); const t = c.find((x) => x.name === 'crear_tarea');
      return c.some((x) => x.name === 'buscar_lead') && m?.args.lead_id === 42 && m?.args.etapa === 'reunion_agendada'
        && t?.args.lead_id === 42 && t?.args.fecha === manana && /^10:?0?0?/.test(String(t?.args.hora ?? ''));
    } },
  { nombre: 'una-herramienta', pedido: '¿Cuántos leads entraron esta semana?',
    ok: (c) => c.length === 1 && c[0].name === 'metricas_leads' && c[0].args.periodo === 'semana' },
  { nombre: 'ninguna', pedido: 'Gracias, eso es todo por hoy.', ok: (c) => c.length === 0 },
];
const resultadoDe = (name: string, args: Record<string, unknown>) => name === 'buscar_lead' ? { id: 42, nombre: 'Juan Pérez' }
  : name === 'metricas_leads' ? { periodo: args.periodo, leads: 17 } : { ok: true };

async function turno(modelo: string, pedido: string) {
  const msgs: Array<Record<string, unknown>> = [{ role: 'system', content: SYSTEM }, { role: 'user', content: pedido }];
  const calls: Llamada[] = []; let tin = 0; let tout = 0; const t0 = Date.now();
  for (let paso = 0; paso < 6; paso++) {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelo, messages: msgs, tools, tool_choice: 'auto', ...paramsDeSalida({ nombre: 'openai' }, modelo, 1400, 0.2) }),
      signal: AbortSignal.timeout(45_000),
    }).catch((e: unknown) => e instanceof Error ? e : new Error(String(e)));
    if (r instanceof Error) return { error: `no contestó en 45 s (${r.message.slice(0, 80)})` };
    const j = await r.json().catch(() => ({})) as Record<string, any>;
    if (!r.ok) return { error: `${r.status} ${String(j.error?.message ?? '').slice(0, 140)}` };
    tin += j.usage?.prompt_tokens ?? 0; tout += j.usage?.completion_tokens ?? 0;
    const m = j.choices?.[0]?.message; if (!m) return { error: 'sin mensaje' };
    msgs.push(m);
    if (!m.tool_calls?.length) {
      if (!String(m.content ?? '').trim()) return { error: `contestó VACÍO (finish_reason: ${j.choices[0].finish_reason})` };
      break;
    }
    for (const tc of m.tool_calls) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments); } catch { args = { _invalido: tc.function.arguments }; }
      calls.push({ name: tc.function.name, args });
      msgs.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(resultadoDe(tc.function.name, args)) });
    }
  }
  return { calls, tin, tout, ms: Date.now() - t0 };
}

console.log(`Clave: la del workspace de la plataforma (ws${ws}). ${MODELOS.length} modelo(s) × ${ESCENARIOS.length} pedidos × 2.`);
for (const modelo of MODELOS) {
  let bien = 0; let total = 0; let usd = 0; let ms = 0; let medidos = 0; const fallos: string[] = [];
  for (const e of ESCENARIOS) for (let rep = 0; rep < 2; rep++) {
    total++;
    const r = await turno(modelo, e.pedido);
    if ('error' in r) { fallos.push(`${e.nombre}: ${r.error}`); continue; }
    medidos++; ms += r.ms;
    const [pi, po] = PRECIO[modelo] ?? [0, 0]; usd += (r.tin * pi + r.tout * po) / 1e6;
    if (e.ok(r.calls)) bien++; else fallos.push(`${e.nombre}: ${JSON.stringify(r.calls).slice(0, 160)}`);
  }
  const prom = (x: number) => (medidos ? x / medidos : 0);
  console.log(`${modelo.padEnd(14)} acertó ${bien}/${total} · ${(prom(ms) / 1000).toFixed(1)} s/turno · US$${prom(usd).toFixed(5)}/turno${PRECIO[modelo] ? '' : ' (sin precio en la tabla)'}`);
  for (const f of fallos.slice(0, 4)) console.log(`   ✗ ${f}`);
}
