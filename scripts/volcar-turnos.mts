// Vuelca, para cada frase y cada contexto, el turno REAL del árbol que está en el cwd: el veredicto del clasificador, las herramientas en
// orden (con un hash de su definición), las del registro, las áreas y la instrucción. Lo corre scripts/medir-turnos-por-sha.mts, UNA VEZ por
// árbol y en su propio proceso: tsx resuelve `@/` con el tsconfig del cwd y los módulos se cachean por proceso, así que cargar dos árboles en
// uno comparte `lib/capas`, `lib/api-mako/registro` y todo lo que importan, y lo que se mide no es ningún commit (docs/hallazgos-ia.md,
// «El arnés por SHA»).
//
// Uso (cwd = el árbol): node --conditions=react-server --import tsx scripts/volcar-turnos.mts <app|whatsapp> <frases.json> <salida.jsonl>
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [canal, archivoFrases, salida] = process.argv.slice(2);
if (!['app', 'whatsapp'].includes(canal) || !archivoFrases || !salida) throw new Error('uso: volcar-turnos.mts <app|whatsapp> <frases.json> <salida.jsonl>');

const arbol = process.cwd();
const imp = (rel: string) => import(pathToFileURL(join(arbol, rel)).href);
const intencion = await imp('lib/mako-intencion.ts');
const doer = await imp('lib/doer-herramientas.ts');
const registro = await imp('lib/api-mako/registro.ts');
const reglasApp = await imp('lib/mako-turno-app-reglas.ts');
const { MAKO_TOOLS } = await imp('lib/mako-tools.ts');
const { MAKO_ACCION_TOOLS } = await imp('lib/mako-doer-acciones.ts');

const ticket = registro.porId('levantar_ticket');
const DE_SIEMPRE = [...MAKO_TOOLS, ...MAKO_ACCION_TOOLS, ...(ticket ? [registro.aToolDef(ticket)] : [])];
const VISTA = canal === 'app'
  ? { canal: 'app', alcance: 'proponer', ws: 13, rol: 'admin', tabs: null }
  : { canal: 'whatsapp', alcance: 'ejecutar', ws: 13, rol: 'admin', tabs: null };
/** Los contextos del turno. En la app: sin nada, con una tarjeta abierta y con una pregunta de MaKo; en WhatsApp, los 12 del doer. */
const CONTEXTOS: Array<[string, Record<string, unknown>]> = canal === 'app'
  ? [['{}', {}], ['pend', { hayPendientes: true }], ['pregunto', { makoPregunto: true }]]
  : [
    ['{}', {}], ['pend', { hayPendientes: true }], ['pendAgenda', { hayPendientes: true, hayPendienteDeAgenda: true }], ['pregunto', { makoPregunto: true }],
    ['preguntoPend', { makoPregunto: true, hayPendientes: true }], ['agendaAbierta', { hayAgendaAbierta: true }], ['reunionOTarea', { preguntoReunionOTarea: true, makoPregunto: true }],
    ['siguePedidoAgenda', { siguePedidoDeAgenda: true }], ['prometio', { pedidoPrometido: 'consultar' }], ['prometioActuar', { pedidoPrometido: 'actuar' }],
    ['media', { hayMedia: true }], ['contacto', { hayContacto: true }],
  ];

const hash = (x: unknown) => createHash('md5').update(JSON.stringify(x)).digest('hex').slice(0, 10);
const ordenado = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
const nombre = (t: { name: string }) => t.name;

function turno(texto: string, ctx: Record<string, unknown>) {
  const v = intencion.clasificarIntencion(texto, canal === 'app' ? { canal: 'app', ...ctx } : ctx);
  const entrada = {
    veredicto: v, texto, contextoDelSi: v.sigueOfrecimiento ? 'agendame con Juan Pérez mañana\n¿Querés que te agende la llamada con Juan mañana a las 10?' : null,
    agendaAbierta: !!ctx.hayAgendaAbierta, deSiempre: DE_SIEMPRE, vista: VISTA, hayPendientes: !!ctx.hayPendientes,
    resumenesPendientes: ctx.hayPendientes ? ['Cancelar la reunión con Juan Pérez del jueves 10:00', 'Mover a Ana Llamas a descalificados'] : [],
  };
  const t = canal === 'app' ? reglasApp.herramientasDelChat(entrada) : doer.herramientasDelTurno(entrada);
  return {
    v: ordenado(v), aviso: v.dudosa && intencion.avisoDeDuda ? intencion.avisoDeDuda(v) : null,
    tools: t.tools.map((x: { name: string }) => `${nombre(x)}#${hash(x)}`), delRegistro: t.delRegistro.map(nombre), areas: t.areas, ofrece: t.ofrece, instruccion: t.instruccion,
  };
}

const frases: string[] = JSON.parse(readFileSync(archivoFrases, 'utf8')).frases;
// A disco cada tanto y de forma síncrona: con decenas de miles de turnos, un stream que nunca cede el turno al event loop junta todo en memoria.
writeFileSync(salida, '');
let pendiente: string[] = [];
const vaciar = () => { if (pendiente.length) { appendFileSync(salida, pendiente.join('')); pendiente = []; } };
let n = 0;
const origen = console.warn;
console.warn = () => {}; // el registro avisa por consola lo que no entró en el presupuesto: con decenas de miles de turnos tapa todo
for (const f of frases) {
  for (const [nom, ctx] of CONTEXTOS) {
    let r: unknown;
    try { r = turno(f, ctx); } catch (e) { r = { error: String(e instanceof Error ? e.message : e).slice(0, 200) }; }
    pendiente.push(`${JSON.stringify({ k: `${f}|${nom}`, r })}\n`);
    if (++n % 2000 === 0) vaciar();
  }
}
console.warn = origen;
vaciar();
console.log(`${canal}: ${n} turnos de ${frases.length} frases (${arbol})`);
