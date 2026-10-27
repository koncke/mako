// =============================================================================
// Arnés: una PREGUNTA en «Editar» con el MODELO REAL (27/10/2026, 874749710-11; docs/hallazgos-chatbot.md)
// =============================================================================
// SIN LA BASE: no lee ni escribe nada en producción. Arma el `system` y el `user` como la ruta
// (app/api/chat-agent/secuencias/ia/route.ts) con un flujo de mentira, decide el camino con la regla de la ruta
// (`vaAExplicar` + `esPreguntaDirecta`) y llama al modelo DIRECTO: Claude con la clave de la plataforma y Gemini flash-lite
// (lo de la mayoría de los negocios). Lo que va a explicar sólo puede devolver {"respuesta"}: la ruta devuelve el borrador
// tal cual. Lo que va a editar pasa por `revisarEdicion`, y se ve si cambió tarjetas o si su respuesta se rechaza (el
// reintento la obligaría a cambiar algo: así se tocaba el lienzo).
// Gasta unas pocas llamadas de la clave de la plataforma (Claude) y de la gratis de Gemini.
// Correr: node --env-file=.env.local --import tsx scripts/arnes-pregunta-en-editar.mts ["una frase"]
// =============================================================================
export {};   // un .mts sin import ni export es un script GLOBAL para tsc (guardas-push.sh)
const base0 = process.cwd().split(String.fromCharCode(92)).join('/');
const imp = (p: string) => import(`file:///${base0}/${p}`);
const intencion = await imp('lib/flujo-ia-intencion.ts');
const consulta = await imp('lib/flujo-ia-consulta.ts');
const fia = await imp('lib/flujo-ia.ts');
const { revisarEdicion } = await imp('lib/flujo-ia-revision-editar.ts');
const { normalizar } = await imp('lib/flujo-grafo.ts');

// Una espera del lienzo es una tarjeta `esperar` (`espera.minutos`): con un `delay_horas` en el mensaje el modelo ve dos
// mensajes seguidos y contesta «sale sin demora» (la trampa del primer intento).
const base = normalizar([
  { id: 'entrada', nodo: 'inicio', canal: 'whatsapp', cuerpo: '', siguiente: 'm1' },
  { id: 'm1', canal: 'whatsapp', proveedor: 'no_oficial', cuerpo: 'Hola {{nombre}}, gracias por escribirnos. ¿En qué te puedo ayudar?', siguiente: 'e1', delay_horas: 0 },
  { id: 'e1', canal: 'whatsapp', nodo: 'esperar', cuerpo: '', espera: { minutos: 1440 }, siguiente: 'm2', delay_horas: 0 },
  { id: 'm2', canal: 'whatsapp', proveedor: 'no_oficial', cuerpo: '{{nombre}}, ¿pudiste ver lo que te mandé?', siguiente: null, delay_horas: 0 },
]);
const ctx = { etiquetas: [], productos: [], audios: [], archivos: [], acciones: [], links: {}, disparadores: [{ value: 'venta:3:nuevo', label: 'Llega a «Nuevo»' }], disparadorActual: 'venta:3:nuevo' };
const PERFIL = 'Vendo cursos de liderazgo para dueños de pymes, por WhatsApp e Instagram.';

const jsonDe = (t: string) => { const i = t.indexOf('{'), f = t.lastIndexOf('}'); try { return JSON.parse(t.slice(i, f + 1)); } catch { return null; } };
async function claude(system: string, user: string): Promise<string> {
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY ?? '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 1200, system, messages: [{ role: 'user', content: user }] }), signal: AbortSignal.timeout(60_000) });
  const j = await r.json(); if (!r.ok) throw new Error(`claude ${r.status}: ${JSON.stringify(j).slice(0, 160)}`);
  return (j.content ?? []).map((c: { text?: string }) => c.text ?? '').join('');
}
async function gemini(system: string, user: string): Promise<string> {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', { method: 'POST', headers: { authorization: `Bearer ${process.env.GEMINI_API_KEY ?? ''}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'gemini-flash-lite-latest', messages: [{ role: 'system', content: system }, { role: 'user', content: user }], response_format: { type: 'json_object' } }), signal: AbortSignal.timeout(60_000) });
  const j = await r.json(); if (!r.ok) throw new Error(`gemini ${r.status}: ${JSON.stringify(j).slice(0, 160)}`);
  return j.choices?.[0]?.message?.content ?? '';
}
const MODELOS: Array<[string, (s: string, u: string) => Promise<string>]> = [['Claude', claude], ['Gemini', gemini]];

/** El camino de la ruta en «Editar»: explicar (sólo contesta) o editar, con su `system` y su `user`. */
function camino(pedido: string) {
  const explica = intencion.vaAExplicar('editar', false, consulta.esConsulta(pedido), intencion.esPreguntaDirecta(pedido));
  const extras = intencion.extrasDelUser('editar', []);
  if (explica) {
    const cron = ctx.disparadores.find((x) => x.value === ctx.disparadorActual)?.label ?? null;
    return { explica, system: consulta.EXPLICAR_IA_SYSTEM_TEMPLATE, user: [consulta.userDeExplicar({ cron, flujo: JSON.stringify(fia.aIA(base, ctx)), pregunta: pedido }), ...extras].join('\n\n') };
  }
  return { explica, system: fia.EDITAR_IA_SYSTEM_TEMPLATE, user: [fia.userDeEditar(ctx, { perfil: PERFIL, voz: null, pedido }, base), ...extras].join('\n\n') };
}
function leer(pedido: string, c: ReturnType<typeof camino>, texto: string): string {
  const obj = jsonDe(texto);
  if (!obj) return `✖ sin JSON: «${texto.slice(0, 80)}»`;
  if (c.explica) {
    const x = consulta.deIARespuesta(obj); const falso = x.r.respuesta ? intencion.lugarInventado(x.r.respuesta) : null;
    return `${x.r.respuesta && !falso ? '✔' : '✖'} contesta, lienzo intacto${falso ? ' · LUGAR INVENTADO' : ''}: «${x.r.respuesta.replace(/\s+/g, ' ').slice(0, 150)}»`;
  }
  const { r, errores } = revisarEdicion({ obj, base, ctx, pedido, historial: [], intencion: 'editar', control: { yaPidioLoQueFalta: false } });
  if (r.respuesta && !errores.length) return `· editar CONTESTÓ (no tocó): «${r.respuesta.replace(/\s+/g, ' ').slice(0, 130)}»`;
  const n = r.cambiadas.length + r.quitadas.length + r.agregadas.length;
  return `${n ? '⚠ editar CAMBIÓ' : '· editar sin cambios'} (${r.cambiadas.length}/${r.quitadas.length}/${r.agregadas.length})${errores.length ? ` · se rechaza para el reintento: ${errores[0].slice(0, 90)}` : ''}`;
}

const FRASES = process.argv[2] ? [process.argv[2]] : [
  // Leandro, ws10, 25/10 (los chats del lienzo, leídos en producción).
  'y en instagram? porque no me aparece en la configuración.', 'existe un tope de comentarios que se puede responder por día?', 'como levanto un ticket',
  'Hola MaKo, ¿qué hace esta automatización? Gracias', 'MaKo, a cuántos les llega esto', 'desde qué número sale', 'quiero saber cuántos les llega por día',
  'Explícame qué hace esta automatización', 'Che, cuándo sale el segundo?',
  // Pedidos con signos: van a editar.
  '¿Le agregás un audio al final?',
];
for (const p of FRASES) {
  const c = camino(p);
  console.log(`\n«${p}» → ${c.explica ? 'contesta' : 'EDITA'}`);
  for (const [nombre, llamar] of MODELOS) {
    try { console.log(`  ${nombre}: ${leer(p, c, await llamar(c.system, c.user))}`); }
    catch (e) { console.log(`  ${nombre}: ✖ ${(e as Error).message}`); }
  }
}
