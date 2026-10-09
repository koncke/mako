// =============================================================================
// VARIOS CRON en el motor (lib/nutricion.ts): el cableado de las cuatro puertas
// =============================================================================
// Sexta tanda del Chatbot (09/10/2026), CRON punto 10 («agrega la opción de tener más de un CRON»).
// La decisión vive en lib/disparadores.ts y la prueba tests/disparadores.test.ts EJECUTÁNDOLA; esto
// es el otro lado: que el motor la USE en las cuatro puertas por donde se inscribe a alguien (el
// evento, el barrido, su dry-run) y en la que le manda al grupo. lib/nutricion.ts arrastra el runtime
// de Next y no carga bajo tsx: se lee el FUENTE, sin comentarios (la convención de la casa es
// explicar en prosa lo que no tiene que estar).
//
// ⚠️ UN GUARD DE CABLEADO NO REEMPLAZA A UN TEST DE LA FUNCIÓN: contesta «¿está enchufado?», nunca
// «¿hace lo que dice?». Las funciones puras tienen el suyo.
//
// PROBADO ROMPIÉNDOLO (09/10/2026), contra una base de 6 pass / 0 fail, una rotura por vez y
// restaurando de memoria:
//   · el evento sin `vistasPorDisparador` (vuelve a mirar sólo las columnas)           → 5 / 1
//   · el evento sin el `!s.cron` (un Recurrente dispara también con el evento)         → 5 / 1
//   · el commit sin `reclamarOcurrenciaExtra` (un CRON extra con horario sin el CAS)   → 5 / 1
//   · el dry-run mandándole al grupo                                                   → 5 / 1
//   · `mandarRecurrenteAlGrupo` cayendo al dueño sin workspace                         → 5 / 1
//   · `leerFilasDeSecuencias` sin pedir la lista                                       → 5 / 1
// Restaurado: 6 / 0.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const NUTRI = sinComentarios(leer('lib/nutricion.ts'));

/** El cuerpo de una función de primer nivel: de su firma hasta el `}` en columna 0. */
function cuerpo(firma: string): string {
  const i = NUTRI.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const j = NUTRI.indexOf('\n}\n', i);
  assert.ok(j > i, `no encontré el cierre de «${firma}»`);
  return NUTRI.slice(i, j);
}

test('el EVENTO pregunta por cada CRON, saltea los Recurrentes y deja UNA por automatización', () => {
  const ev = cuerpo('export async function enrolarPorEvento(');
  assert.match(ev, /\(await getSecuenciasActivas\(\)\)\.flatMap\(\(s\) => vistasPorDisparador\(s\)\)\.filter\(\(s\) => claves\.includes\(s\.trigger_tipo\) && !s\.cron\)/);
  // Lo nuevo lo decide `disparaPorEvento` (el «Ignorar», el subtipo del canal)…
  assert.match(ev, /const porLoNuevo = delEvento\.filter\(\(s\) => TRIGGERS_SOLO_EVENTO\.has\(s\.trigger_tipo\) && disparaPorEvento\(s\.disparador, evento, ctx\)\);/);
  // …y se junta DESPUÉS de los filtros de siempre, una vez por automatización.
  const i = ev.indexOf("if (evento === 'etiqueta') delEvento = secuenciasDeEtiqueta(");
  const j = ev.indexOf('delEvento = unaPorSecuencia([...delEvento, ...porLoNuevo]);');
  assert.ok(i > 0 && j > i, 'lo nuevo se junta antes del filtro de la etiqueta (y se lo come) o no se junta');
  assert.ok(j < ev.indexOf('aTiempo('), 'el tope de antigüedad tiene que mirar también a lo nuevo');
});

test('el EVENTO conoce los cuatro nuevos (el contrato con «canales» y «probar»)', () => {
  const tabla = NUTRI.slice(NUTRI.indexOf('const TRIGGERS_POR_EVENTO'), NUTRI.indexOf('\n};', NUTRI.indexOf('const TRIGGERS_POR_EVENTO')));
  for (const [ev, trig] of [['etiqueta_quitada', 'TRIGGER_ETIQUETA_QUITADA'], ['instagram', 'TRIGGER_INSTAGRAM'], ['messenger', 'TRIGGER_MESSENGER'], ['email_recibido', 'TRIGGER_EMAIL_RECIBIDO']]) {
    assert.match(tabla, new RegExp(`\\n {2}${ev}: \\[${trig}\\],`), `el evento ${ev} no inscribe a nadie`);
  }
  assert.match(NUTRI, /\| 'etiqueta_quitada' \| 'instagram' \| 'messenger' \| 'email_recibido';/);
  assert.match(NUTRI, /subtipo\?: string;/);
});

test('⚠️ el BARRIDO: cada CRON, el compare-and-set del extra, el grupo sólo con la ocurrencia reclamada', () => {
  const c = cuerpo('export async function comprometerInscripciones(');
  assert.match(c, /for \(const sec of vistasPorDisparador\(base\)\) \{/);
  assert.match(c, /if \(!barreElDisparador\(sec\) && !sec\.disparador\.grupo\) continue;/);
  // El primero, con las columnas de siempre; los demás, con la revisión de la lista.
  assert.match(c, /if \(sec\.disparador\.indice === 0\) \{/);
  assert.match(c, /else reclamada = await reclamarOcurrenciaExtra\(supabase, sec\.id, lista, sec\.disparador\.id, agenda\.proxima\);/);
  // El grupo, DESPUÉS de reclamar la ocurrencia y sólo si toca.
  const grupo = c.indexOf('await mandarRecurrenteAlGrupo(base, sec.disparador, sec.cron_proxima_at)');
  assert.ok(grupo > c.indexOf('if (agenda.toca && !reclamada) continue;') && grupo > c.indexOf('if (!agenda.toca) continue;'), 'al grupo le llega antes de reclamar la ocurrencia: dos ticks, dos mensajes');
  // La misma persona, una vez aunque la alcancen dos CRON.
  assert.match(c, /\.filter\(\(id\) => !yaInscriptos\.has\(id\)\);/);
  const extra = cuerpo('async function reclamarOcurrenciaExtra(');
  assert.match(extra, /\.eq\('id', secuenciaId\)\.eq\('disparadores_rev', estado\.rev\)/, 'el CRON extra avanza sin compare-and-set');
  assert.match(extra, /if \(estado\.rev == null\) return false;/);
});

test('el DRY-RUN mira cada CRON igual que el commit, y no escribe ni le manda nada al grupo', () => {
  const p = cuerpo('export async function planificarInscripciones(');
  assert.match(p, /for \(const sec of vistasPorDisparador\(base\)\) \{/);
  assert.match(p, /if \(!barreElDisparador\(sec\)\) continue;/);
  assert.doesNotMatch(p, /mandarRecurrenteAlGrupo|reclamarOcurrenciaExtra|cron_proxima_at:/);
  assert.match(p, /\.filter\(\(id\) => !yaEnElPlan\.has\(id\)\);/);
});

test('⚠️ el grupo: el workspace del CONTEXTO, nunca el dueño; por `emitirAviso`, una vez por ocurrencia', () => {
  const g = cuerpo('async function mandarRecurrenteAlGrupo(');
  assert.match(g, /const ws = wsEnContexto\(\);\n\s*if \(ws == null\) \{/);
  assert.doesNotMatch(g, /OWNER_WS|getWorkspaceActual/);
  assert.match(g, /await emitirAviso\(\{\n\s*ws, tipo: 'chatbot-aviso-equipo'/);
  assert.match(g, /dedupKey: `recurrente:\$\{sec\.id\}:\$\{d\.id\}:\$\{ocurrencia \?\? ''\}`/);
  assert.match(g, /const textos = textosParaElGrupo\(sec\.pasos\);/);
});

test('las lecturas del motor piden la lista y, sin la 0241, vuelven a lo de siempre (sólo con la COLUMNA que falta)', () => {
  const l = cuerpo('async function leerFilasDeSecuencias(');
  assert.match(l, /const conLista = await pedir\(`\$\{COLS_SECUENCIA\}, \$\{COL_ETAPAS\}, \$\{COLS_DISPARADORES\}`\);/);
  assert.match(l, /if \(!esColumnaInexistente\(conLista\.error\)\) throw new Error/);
  assert.ok(l.indexOf('conLista') < l.indexOf('const conEtapas'), 'el camino de antes va DESPUÉS');
  // Y las dos lecturas arman la lista con `disparadoresDe` (lib/disparadores.ts).
  assert.equal([...NUTRI.matchAll(/\.\.\.listaDe\(r\),/g)].length, 2);
  assert.match(NUTRI, /disparadores: disparadoresDe\(r\),/);
});

// La ficha que lee MaKo (y un token por /api/v1) dice TODOS los CRON: sin la lista, `trigger` y `etapa`
// —que son sólo el primero— se leían como «tiene un solo disparador». Verificado sacando la línea
// (09/10/2026, este archivo, base 7 / 0): 6 / 1.
test('la ficha de una secuencia (API de MaKo) trae la lista de CRON, no sólo el primero', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/chatbot.run.ts'));
  const ini = run.indexOf('ficha_secuencia_mensajes: {');
  const ficha = run.slice(ini, run.indexOf('pasos: s.pasos.map(', ini));
  assert.ok(ini >= 0 && ficha.length > 0 && ficha.length < 1500, `el recorte mide ${ficha.length}: está mirando otra cosa`);
  assert.match(ficha, /disparadores: s\.disparadores \?\? \[\],/);
});
