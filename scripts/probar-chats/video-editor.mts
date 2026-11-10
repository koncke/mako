// =============================================================================
// Arnés del chat del Video Editor: los pedidos REALES de los clientes, contra la función de la ruta (9/11/2026)
// =============================================================================
// Martín, 9/11: «que se pueda editar perfectamente por prompting». Esto llama al `POST` de app/api/video-editor/ia con la
// sesión del super admin en el ws 9 (el espacio de MaKo: corre con la red gratis de la plataforma, sin IA de un cliente,
// cliente-prueba-ws3 en la memoria) y una línea de tiempo ARMADA ACÁ con textos neutros (nunca el material de un cliente
// a una IA). Mide la mitad del servidor: qué operaciones devuelve la IA para cada pedido. Que el editor las aplique en
// pantalla se mira en el navegador.
//
// ⚠️ NO LEVANTA TICKETS. El chat levanta uno solo si el modelo marca `[[no-pude]]`/`[[no-existe]]`
// (lib/no-existe-server.ts): acá ese módulo se reemplaza por uno que sólo ANOTA qué ticket habría salido, con las mismas
// funciones puras que decide la causa. Sin eso, cada corrida le dejaría tickets de prueba a la Ticketera de Martín.
//
//   node --env-file=C:/dev/mako-api/.env.local --conditions=react-server --import tsx scripts/probar-chats/video-editor.mts [filtro] [--veces 2]
// =============================================================================
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

const RAIZ = join(import.meta.dirname, '..', '..');
const requerir = createRequire(import.meta.url);
const WS = 9;
const EMAIL = 'martinkoncke@gmail.com';

type Sesion = { sub: string; email: string; nombre: string; rol: 'admin'; exp: number; ws: number | null; rolWs: 'admin'; mfa: string };
let sesion: Sesion | null = null;

function reemplazar(rel: string, exports: Record<string, unknown>) {
  const archivo = join(RAIZ, rel);
  const Modulo = requerir('node:module') as { new (id: string): { filename: string; loaded: boolean; exports: unknown } };
  const m = new Modulo(archivo);
  m.filename = archivo;
  m.loaded = true;
  m.exports = exports;
  (requerir.cache as Record<string, unknown>)[archivo] = m;
}

// La sesión (como scripts/probar-chats/entorno.mts).
reemplazar('lib/auth.ts', { getUsuarioActual: async () => sesion, getSesionAdmin: async () => sesion });

// Los tickets: se anota lo que habría salido, sin escribir.
const ticketsQueSaldrian: string[] = [];
{
  const { sacarNoExiste } = await import('../../lib/no-existe');
  const { sacarNoPude, causaDelNoPude } = await import('../../lib/no-pude');
  const { esReglaUOpinion } = await import('../../lib/no-pude-frases');
  const anotar = (respuesta: string) => {
    const ne = sacarNoExiste(respuesta);
    const np = sacarNoPude(ne.texto);
    const noPudo = np.noPudo && !esReglaUOpinion(np.noPudo) ? np.noPudo : null;
    const causa = causaDelNoPude({ noExiste: ne.falta, noPudo });
    if (causa) ticketsQueSaldrian.push(`${causa}: ${ne.falta ?? np.noPudo}`);
    return { texto: np.texto, falta: ne.falta, linea: causa ? `(acá saldría un ticket «${causa}»)` : null };
  };
  reemplazar('lib/no-existe-server.ts', {
    conPedidoDeNoExisteDeLaSesion: async (r: string) => anotar(r),
    conPedidoDeNoExiste: async (r: string) => anotar(r),
    ticketDeNoExiste: async () => null,
    superficieDeChat: () => 'video-editor',
    lineaDelTicket: (n: number) => `ticket ${n}`,
  });
}

// La caché de Next, de paso (entorno.mts, punto 3).
{
  const g = globalThis as { __incrementalCache?: unknown };
  g.__incrementalCache ??= { isOnDemandRevalidate: false, generateCacheKey: async (k: string) => k, get: async () => null, set: async () => {} };
}

const { runWithWorkspace } = await import('../../lib/workspace');
const { getSupabaseServer } = await import('../../lib/supabase');
// La ruta entera (app/api/video-editor/ia/route.ts) trae la puerta del editor, que importa next/navigation y con
// --conditions=react-server rompe (createContext). Se llama a lo que la ruta llama, `editarVideo`, con el mismo cuerpo.
const { editarVideo } = await import('../../lib/editor-video/ia');

{
  const { data, error } = await getSupabaseServer().from('usuarios').select('id, email, nombre, rol, workspace_id, estado').eq('email', EMAIL).maybeSingle();
  if (error || !data || data.rol !== 'admin') throw new Error(`No encontré al super admin: ${error?.message ?? 'no está'}`);
  sesion = { sub: String(data.id), email: data.email, nombre: data.nombre ?? '', rol: 'admin', exp: 0, ws: WS, rolWs: 'admin', mfa: 'totp' };
}

// ── La línea de tiempo: tres tomas en la principal, subtítulos por palabra y un audio en Multimedia ──────────────────
const disponibles = {
  transiciones: { mezclar: 'Mezclar', 'fundido-negro': 'Fundido a negro', 'barrido-izquierda': 'Barrido a la izquierda', zoom: 'Zoom', destello: 'Destello blanco' },
  filtros: { calido: 'Cálido', 'blanco-negro': 'Blanco y negro', cine: 'Cine', vivido: 'Vívido' },
  efectos: { glitch: 'Glitch', 'zoom-pulsante': 'Zoom pulsante', sacudida: 'Sacudida', vineta: 'Viñeta' },
  animaciones: { entrada: { aparecer: 'Aparecer', subir: 'Subir', acercar: 'Acercar' }, salida: { desvanecer: 'Desvanecer', bajar: 'Bajar' }, bucle: { pulso: 'Pulso', latido: 'Latido' } },
  fuentes: ['Montserrat', 'Bebas Neue', 'Anton', 'Poppins'],
};
const sub = (ref: string, inicio: number, fin: number, texto: string) => ({ ref, tipo: 'texto', texto, inicio, fin, posicion: [0, -620], subtitulo: true });
const vista = (conSubtitulos: boolean) => ({
  duracion_total: 30,
  cabezal: 0,
  lienzo: { ancho: 1080, alto: 1920 },
  elegidos: [] as string[],
  ...(conSubtitulos ? { transcripcion_por_palabra: true, estilo_subtitulos: { fuente: 'Montserrat', tamano: 5, color: '#ffffff', negrita: true } } : {}),
  pistas: [
    ...(conSubtitulos ? [{ tipo: 'texto', elementos: [
      sub('t1', 0, 3.2, 'eh bueno hoy te cuento cómo conseguir clientes'),
      sub('t2', 3.2, 7.5, 'sin gastar en publicidad este, es más simple de lo que crees'),
      sub('t3', 7.5, 12, 'el primer paso es tener una oferta clara'),
      sub('t4', 12, 18, 'o sea que la persona entienda qué gana en cinco segundos'),
      sub('t5', 18, 24, 'el segundo paso es responder rápido cada mensaje'),
      sub('t6', 24, 30, 'escríbeme la palabra CLIENTES y te paso la guía'),
    ] }] : []),
    { tipo: 'video', principal: true, elementos: [
      { ref: 'v1', tipo: 'video', nombre: 'toma-1.mp4', inicio: 0, fin: 10, silenciado: false, volumen_db: 0 },
      { ref: 'v2', tipo: 'video', nombre: 'toma-2.mp4', inicio: 10, fin: 20, silenciado: false, volumen_db: 0 },
      { ref: 'v3', tipo: 'video', nombre: 'toma-3.mp4', inicio: 20, fin: 30, silenciado: false, volumen_db: 0 },
    ] },
  ],
  medios: [
    { ref: 'm1', nombre: 'toma-1.mp4', tipo: 'video', duracion: 10 },
    { ref: 'm2', nombre: 'toma-2.mp4', tipo: 'video', duracion: 10 },
    { ref: 'm3', nombre: 'toma-3.mp4', tipo: 'video', duracion: 10 },
    // Un audio de Multimedia NO va: la vista lista sólo videos y fotos (`mediosParaReemplazo(medios, "ambos")`, chat/linea.ts).
  ],
  disponibles,
});

// ── La batería: lo que pidieron los clientes en producción (video_editor_chats) y lo que pidió Martín ────────────────
type Caso = { id: string; pedido: string; subtitulos?: boolean; espera: string; ok: (ops: Array<Record<string, unknown>>, resumen: string) => boolean };
const tiene = (ops: Array<Record<string, unknown>>, op: string) => ops.some((o) => o.op === op);
const CASOS: Caso[] = [
  // Reales (Leila, Leandro, Mauricio, Martín; textuales)
  { id: 'silencios-1', pedido: 'Quiero borrar silencios', espera: 'borrar_silencios', ok: (o) => tiene(o, 'borrar_silencios') },
  { id: 'silencios-2', pedido: 'Limpia silencios, ruidos', espera: 'borrar_silencios + reducir_ruido, SIN silenciar', ok: (o) => tiene(o, 'borrar_silencios') && tiene(o, 'reducir_ruido') && !tiene(o, 'silenciar') },
  { id: 'silencios-3', pedido: 'Puedes eliminar los silencios?', espera: 'borrar_silencios', ok: (o) => tiene(o, 'borrar_silencios') },
  { id: 'subtitulos-1', pedido: 'subtitultulame el video', espera: 'generar_subtitulos', ok: (o) => tiene(o, 'generar_subtitulos') },
  { id: 'subtitulos-2', pedido: 'agregale al clip subtitulos', espera: 'generar_subtitulos', ok: (o) => tiene(o, 'generar_subtitulos') },
  { id: 'muletillas', pedido: 'Quita las muletillas del video.', subtitulos: true, espera: 'eliminar_muletillas', ok: (o) => tiene(o, 'eliminar_muletillas') },
  { id: 'resaltar', pedido: 'no encuentro como resaltar ciertas palabras', subtitulos: true, espera: 'resaltar_palabras o palabras_clave', ok: (o) => tiene(o, 'resaltar_palabras') || tiene(o, 'palabras_clave') },
  { id: 'transicion', pedido: 'Pon la transición Mezclar en cada corte de la pista principal.', espera: 'transicion mezclar en v1 y v2', ok: (o) => o.filter((x) => x.op === 'transicion' && x.id === 'mezclar').length >= 2 },
  { id: 'titulo', pedido: 'Agrega al inicio un título de 3 segundos que diga: Prueba TB2', espera: 'agregar_texto 0-3 s', ok: (o) => o.some((x) => x.op === 'agregar_texto' && x.inicio === 0 && x.duracion === 3) },
  { id: 'reporte', pedido: 'levanta reporte que se bugguea el vídeo', espera: 'que levante el reporte (ticket), no «hazlo desde soporte»', ok: (_o, r) => /ticket/i.test(r) && !/plataforma de soporte/i.test(r) },
  { id: 'frame', pedido: 'No me deja marcar un frame exacto', espera: 'explicar cómo (flechas / cabezal) o ticket; no «no se puede» seco', ok: (_o, r) => !/^No se puede marcar/i.test(r) },
  { id: 'sihazlo', pedido: 'si hazlo', espera: '(sin historia no puede saber qué; ver el panel)', ok: () => true },
  // La batería de Martín
  { id: 'musica', pedido: 'Ponele la música de fondo bajita a todo el video', espera: 'agregar musica-de-fondo.mp3 (m4) a −18 dB', ok: (o) => o.length > 0 },
  { id: 'velocidad', pedido: 'Acelera la toma 2 a 1.5x', espera: 'velocidad v2 1.5', ok: (o) => o.some((x) => x.op === 'velocidad' && x.ref === 'v2' && x.x === 1.5) },
  { id: 'velocidad-todo', pedido: 'ponelo todo un poco más rápido', espera: 'velocidad en v1, v2, v3', ok: (o) => o.filter((x) => x.op === 'velocidad').length >= 3 },
  { id: 'texto-cta', pedido: 'Al final poné un texto grande que diga "Escribime CLIENTES" los últimos 4 segundos', espera: 'agregar_texto 26-30', ok: (o) => o.some((x) => x.op === 'agregar_texto' && Number(x.inicio) >= 25) },
  { id: 'keyframes', pedido: 'Hacé un zoom lento de 100% a 120% en la primera toma', espera: 'fotogramas clave (no existen por chat → ticket no-existe) o efecto acercar', ok: (o, r) => o.length > 0 || /ticket/i.test(r) },
  { id: 'cortar', pedido: 'Cortá el video en el segundo 15', espera: 'dividir v2 en 15', ok: (o) => o.some((x) => x.op === 'dividir' && x.en === 15) },
  { id: 'filtro', pedido: 'Ponele un filtro cálido a todo', espera: 'filtro calido en v1, v2, v3', ok: (o) => o.filter((x) => x.op === 'filtro' && x.id === 'calido').length >= 3 },
  { id: 'fundido', pedido: 'Que empiece con un fundido desde negro y termine igual', espera: 'fundido de entrada en v1 y de salida en v3 (o transición)', ok: (o) => o.length >= 1 },
  { id: 'automatica', pedido: 'editámelo automático como un reel', espera: 'edicion_automatica', ok: (o) => tiene(o, 'edicion_automatica') },
  { id: 'estilo-subs', pedido: 'Los subtítulos en amarillo y con la fuente Bebas Neue', subtitulos: true, espera: 'estilo_texto sobre los subtítulos', ok: (o) => o.some((x) => x.op === 'estilo_texto') },
];

const argv = process.argv.slice(2);
const filtro = argv.find((a) => !a.startsWith('--'));
const veces = Number(argv[argv.indexOf('--veces') + 1]) || 1;
const casos = CASOS.filter((c) => !filtro || c.id.startsWith(filtro));

const resultados: Array<Record<string, unknown>> = [];
let fallos = 0;
for (const c of casos) {
  for (let i = 0; i < veces; i++) {
    ticketsQueSaldrian.length = 0;
    const t0 = Date.now();
    const r = await runWithWorkspace(WS, async () => editarVideo({ instruccion: c.pedido, linea: JSON.stringify(vista(!!c.subtitulos)), alcance: 'video' }));
    const res = { status: r.ok ? 200 : r.status };
    const json = r as unknown as { ok?: boolean; resumen?: string; operaciones?: Array<Record<string, unknown>>; descartes?: string[]; error?: string } | null;
    const ops = json?.operaciones ?? [];
    const resumen = json?.resumen ?? json?.error ?? '';
    const bien = !!json?.ok && c.ok(ops, resumen);
    if (!bien) fallos += 1;
    const ms = Date.now() - t0;
    console.log(`${bien ? '✔' : '✖'} ${c.id}${veces > 1 ? ` #${i + 1}` : ''} (${(ms / 1000).toFixed(1)} s) «${c.pedido}»\n   espera: ${c.espera}\n   dijo: ${resumen.replace(/\s+/g, ' ').slice(0, 300)}\n   ops: ${JSON.stringify(ops).slice(0, 400)}${json?.descartes?.length ? `\n   descartes: ${json.descartes.join(' · ').slice(0, 300)}` : ''}${ticketsQueSaldrian.length ? `\n   ticket: ${ticketsQueSaldrian.join(' | ')}` : ''}`);
    resultados.push({ id: c.id, vez: i + 1, bien, ms, status: res.status, resumen, ops, descartes: json?.descartes ?? [], tickets: [...ticketsQueSaldrian] });
  }
}
const salida = join(RAIZ, '..', `video-editor-arnes-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}.json`);
writeFileSync(salida, JSON.stringify(resultados, null, 1));
console.log(`\n${resultados.length - fallos}/${resultados.length} bien · ${salida}`);
process.exit(0);
