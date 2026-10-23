// =============================================================================
// Los scripts de Calendly sobre OTRO negocio (23/10/2026): sin --ws hacen lo de siempre; con --ws no se pueden equivocar
// =============================================================================
// Medido ese día: la agenda de MaKo (ws 9) no tenía ni ruteo ni aviso, y todo el lanzamiento del 25/10 vende por ella
// (docs/hallazgos-integraciones.md). scripts/backfill-calendly.ts y scripts/arreglar-webhook-calendly.ts nacieron para el
// ws 1 de Mauricio, con el token de .env.local, y ESCRIBEN en producción. Lo que se fija acá:
//   · lib/calendly-scripts-reglas.ts: los argumentos son ESTRICTOS (un flag mal escrito no cae en silencio al ws 1) y el
//     aviso de la organización sólo se borra si es de esta cuenta, decidido con datos de Calendly y no con «tiene clave»;
//   · los scripts: con --ws el token es el de ESE negocio (nunca el de .env.local), el backfill trae sólo lo que rutea a
//     él y NO lo que está vinculado a una etapa, y el arreglo frena antes del primer DELETE.
//
// Probado rompiéndolo (23/10/2026). Una rotura por vez, restaurando (pasan / fallan): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { argsDeScriptCalendly, puedeBorrarAvisos } from '../lib/calendly-scripts-reglas';

const RAIZ = join(import.meta.dirname, '..');

/**
 * La fuente SIN comentarios (los reemplaza por espacios, así las posiciones y los renglones no se mueven). Con un regex por
 * línea una guardia pasaba gracias a una nota «antes: …» con el código viejo adentro, y en este repo esas notas abundan.
 */
function sinComentarios(src: string): string {
  const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true);
  const rangos = new Map<number, number>();
  const visitar = (n: ts.Node) => {
    for (const r of [...(ts.getLeadingCommentRanges(src, n.pos) ?? []), ...(ts.getTrailingCommentRanges(src, n.end) ?? [])]) rangos.set(r.pos, r.end);
    for (const h of n.getChildren(sf)) visitar(h);
  };
  visitar(sf);
  let salida = src;
  for (const [ini, fin] of rangos) salida = salida.slice(0, ini) + salida.slice(ini, fin).replace(/[^\n]/g, ' ') + salida.slice(fin);
  return salida;
}
const fuente = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n'));

const args = (argv: string[], permitidos: string[] = []) => argsDeScriptCalendly(argv, permitidos);

test('los argumentos: sin --ws es lo de siempre; --ws=N un número; --simulacro es --dry', () => {
  assert.deepEqual(args(['node', 'x.ts']), { ok: true, args: { ws: null, simulacro: false, reemplazar: false } });
  assert.deepEqual(args(['node', 'x.ts', '--ws=9', '--simulacro']), { ok: true, args: { ws: 9, simulacro: true, reemplazar: false } });
  assert.equal((args(['--dry']) as { args: { simulacro: boolean } }).args.simulacro, true);
  assert.equal((args(['--ws=9', '--reemplazar'], ['--reemplazar']) as { args: { reemplazar: boolean } }).args.reemplazar, true);
  for (const malo of ['--ws=', '--ws=abc', '--ws=0', '--ws=-1', '--ws=9;1', '--ws=09', '--ws=1e1']) assert.equal(args([malo]).ok, false, malo);
});

test('los argumentos son ESTRICTOS: un flag mal escrito no cae en silencio al ws 1 ni escribe cuando se quería medir', () => {
  // Cada uno de estos hubiera corrido sobre el ws 1 con el token de Mauricio, y escrito de verdad (revisión del 23/10).
  for (const malo of [['--ws', '9'], ['--ws'], ['--WS=9'], ['-ws=9'], ['--dry-run'], ['--simulacro=1'], ['--simulacion'], ['--wss=9']]) {
    assert.equal(args(malo).ok, false, malo.join(' '));
  }
  // Repetido gana el primero sin avisar: tampoco.
  assert.equal(args(['--ws=9', '--ws=1']).ok, false);
  assert.equal(args(['--dry', '--dry']).ok, false, 'el mismo flag dos veces');
  // El mensaje dice cómo se escribe.
  assert.match((args(['--ws', '9']) as { error: string }).error, /--ws=9/);
  // Cada script acepta SÓLO los suyos: el backfill no tiene --reemplazar, y --desde= es del backfill.
  assert.equal(args(['--reemplazar']).ok, false);
  assert.equal(args(['--desde=2026-10-01']).ok, false);
  assert.equal(args(['--desde=2026-10-01', '--ws=9'], ['--desde=']).ok, true);
  assert.equal(args(['--desde=2026-10-01', '--desde=2026-09-01'], ['--desde=']).ok, false);
  // Lo que no empieza con «-» no es un flag (la ruta de node y del script).
  assert.equal(args(['C:\\Program Files\\nodejs\\node.exe', 'C:\\x\\scripts\\backfill-calendly.ts', '--ws=9']).ok, true);
});

const MIO = 'https://api.calendly.com/users/YO';
const base = { porWs: true, ws: 9, avisos: [{ creator: MIO }], yo: MIO, negociosDeLosTipos: [9], reemplazar: false };

test('borrar un aviso a MaKo: sin --ws como siempre; con --ws sólo si es de esta cuenta, y con datos de Calendly', () => {
  // Sin --ws, o sin aviso que borrar: nada que frenar.
  assert.equal(puedeBorrarAvisos({ ...base, porWs: false, avisos: [{ creator: 'otro' }], negociosDeLosTipos: null }).puede, true);
  assert.equal(puedeBorrarAvisos({ ...base, avisos: [], negociosDeLosTipos: null }).puede, true);
  // El aviso es mío, y los tipos de evento de la organización rutean todos a este negocio.
  assert.equal(puedeBorrarAvisos(base).puede, true);
  assert.equal(puedeBorrarAvisos({ ...base, negociosDeLosTipos: [] }).puede, true, 'una organización sin ruteo todavía');
  // Lo creó otro usuario de Calendly (o no dice quién).
  assert.equal(puedeBorrarAvisos({ ...base, avisos: [{ creator: 'otro' }] }).puede, false);
  assert.equal(puedeBorrarAvisos({ ...base, avisos: [{ creator: MIO }, { creator: null }] }).puede, false);
  assert.equal(puedeBorrarAvisos({ ...base, yo: null }).puede, false);
  // No se pudo leer los tipos de evento: no se adivina.
  assert.equal(puedeBorrarAvisos({ ...base, negociosDeLosTipos: null }).puede, false);
});

test('dos negocios en la MISMA organización de Calendly: borrar el aviso les quita las reservas a los dos', () => {
  // El caso que la «clave guardada» no veía: el aviso es mío (lo creé yo), pero un tipo de evento de la organización
  // rutea al ws 1; con la clave nueva guardada sólo en el 9, las reservas del 1 se verifican contra la vieja y dan 401.
  const r = puedeBorrarAvisos({ ...base, negociosDeLosTipos: [9, 1] });
  assert.equal(r.puede, false);
  assert.match(r.motivo!, /ws 1\b/);
  assert.match(puedeBorrarAvisos({ ...base, negociosDeLosTipos: [1, 3] }).motivo!, /los ws 1, 3/);
  // Con --reemplazar, sabiéndolo.
  assert.equal(puedeBorrarAvisos({ ...base, negociosDeLosTipos: [9, 1], reemplazar: true }).puede, true);
  assert.equal(puedeBorrarAvisos({ ...base, avisos: [{ creator: 'otro' }], negociosDeLosTipos: null, reemplazar: true }).puede, true);
});

test('la fuente se lee SIN comentarios: una nota «antes: …» no hace pasar una guardia', () => {
  const src = "const WS = ARGS.ws ?? 9; // antes: const WS = ARGS.ws ?? 1;\n/* const WS = ARGS.ws ?? 1; */\n/**\n * const WS = ARGS.ws ?? 1;\n */\nconst x = 'http://no es comentario';\n";
  const limpia = sinComentarios(src);
  assert.doesNotMatch(limpia, /\?\? 1;/);
  assert.match(limpia, /const WS = ARGS\.ws \?\? 9;/);
  assert.match(limpia, /'http:\/\/no es comentario'/, 'un // dentro de un string no es un comentario');
});

test('backfill: sin --ws el dueño y .env.local; con --ws el token de ese negocio, sólo lo que rutea a él y no lo vinculado', () => {
  const s = fuente('scripts/backfill-calendly.ts');
  assert.match(s, /argsDeScriptCalendly\(process\.argv, \['--desde='\]\)/, 'estricto, con su único flag propio');
  assert.match(s, /const WS = ARGS\.ws \?\? OWNER_WS;/);
  assert.match(s, /runWithWorkspace\(WS, \(\) => main\(\)\)/);
  assert.match(s, /if \(ARGS\.ws != null\) \{\s*if \(!TOKEN_DEL_WS\) throw[^\n]*\n\s*return TOKEN_DEL_WS;\s*\}\s*const t = process\.env\.CALENDLY_API_TOKEN;/,
    'con --ws nunca cae al token de .env.local');
  assert.match(s, /TOKEN_DEL_WS = await credWsEstricta\('CALENDLY_API_TOKEN', ARGS\.ws, \{ ilegibleTira: true \}\)/, 'una fila ilegible no cae a .env.local');
  // La R1 y la R2 salen del NEGOCIO (si no, con --ws=9 se clasifica con la R2 de Mauricio) y de la lectura ESTRICTA del webhook.
  assert.match(s, /credWsEstricta\('CALENDLY_EVENT_TYPE_J1', WS\)/);
  assert.match(s, /credWsEstricta\('CALENDLY_EVENT_TYPE_J2', WS\)/);
  assert.doesNotMatch(s, /credWs\(/, 'ninguna lectura no estricta: una base que tose daría null y una R2 entraría como R1');
  assert.match(s, /if \(destino !== ARGS\.ws\) continue;/);
  assert.match(s, /\(await rutaDeReserva\('calendly', candidatos, ARGS\.ws\)\)\.ruta\) \{[^}]*continue;/, 'lo vinculado a una etapa no se importa como R1');
  assert.match(s, /eventos\.splice\(0, eventos\.length, \.\.\.delWs\)/);
});

test('arreglo del aviso: sin --ws el ws 1 y .env.local; con --ws su token; frena ANTES del primer DELETE', () => {
  const s = fuente('scripts/arreglar-webhook-calendly.ts');
  assert.match(s, /argsDeScriptCalendly\(process\.argv, \['--reemplazar'\]\)/);
  assert.match(s, /const WS = ARGS\.ws \?\? 1;/);
  assert.match(s, /ARGS\.ws != null \? await credWsEstricta\('CALENDLY_API_TOKEN', ARGS\.ws, \{ ilegibleTira: true \}\) : process\.env\.CALENDLY_API_TOKEN/);
  assert.doesNotMatch(s, /credWs\('CALENDLY_API_TOKEN'/);
  // Si la lista de avisos falla, ni se mide ni se sigue: «0 avisos» por un 403 se leía como «no hay aviso».
  const lista = s.indexOf('if (!antes.ok)');
  assert.ok(lista > 0 && lista < s.indexOf('const nuestras'), 'la lectura fallida corta antes de contar');
  // La decisión se toma con TODOS los datos: lo que se borraría, quién es el dueño del token, y a qué negocios rutea la organización.
  assert.match(s, /porWs: ARGS\.ws != null, ws: WS, avisos: nuestras, yo: me\.json\.resource\.uri \?\? null, negociosDeLosTipos, reemplazar: ARGS\.reemplazar/);
  assert.match(s, /const negociosDeLosTipos = ARGS\.ws != null && nuestras\.length > 0 \? await negociosDeLosTiposDeEvento\(org\) : \[\];/);
  assert.match(s, /if \(!r\.ok\) return null;/, 'un tipo de evento que no se pudo leer no es «ninguno»');
  assert.match(s, /return siguiente \? null : \[\.\.\.ws\];/, 'una lista cortada por el tope de páginas tampoco');
  // El freno va DESPUÉS del simulacro (que tiene que poder medir) y ANTES del primer DELETE.
  const freno = s.indexOf('if (!puede) process.exit(1);');
  assert.ok(freno > s.indexOf('if (DRY) {') && freno < s.indexOf("method: 'DELETE'"), 'el freno, entre el simulacro y el borrado');
  assert.match(s, /guardarCredencial\(WS, 'CALENDLY_WEBHOOK_SIGNING_KEY'/);
});

// Roturas (23/10/2026), cada una restaurada (pasan / fallan):
//   · `argsDeScriptCalendly` ignora el flag que no conoce (lo de siempre)                          -> falla «ESTRICTOS»
//   · `argsDeScriptCalendly` acepta --ws=0                                                         -> falla «los argumentos»
//   · `argsDeScriptCalendly` no ve el --ws repetido                                                -> falla «ESTRICTOS»
//   · `puedeBorrarAvisos` siempre true (borra el aviso que firmó otro)                             -> falla «borrar un aviso»
//   · `puedeBorrarAvisos` no mira los tipos de evento de la organización (la «clave guardada»)     -> falla «dos negocios»
//   · `puedeBorrarAvisos` con tipos ilegibles (null) lo da por bueno                               -> falla «borrar un aviso»
//   · backfill: con --ws cae al token de .env.local                                                -> falla «backfill»
//   · backfill: la R2 sale del dueño (`OWNER_WS`) en vez de WS                                     -> falla «backfill»
//   · backfill: la R1 con `credWs` (no estricta)                                                   -> falla «backfill»
//   · backfill: sin el salto de lo vinculado a una etapa                                           -> falla «backfill»
//   · backfill: con --ws trae todas las reservas de la cuenta, no sólo las que rutean              -> falla «backfill»
//   · arreglo: sin --ws apunta al ws 9                                                             -> falla «arreglo»
//   · arreglo: el freno antes del simulacro (no se podría medir)                                   -> falla «arreglo»
//   · arreglo: sin cortar cuando la lista de avisos falla                                          -> falla «arreglo»
//   · arreglo: `porWs: false` en la llamada a `puedeBorrarAvisos`                                  -> falla «arreglo»
//   · una nota «antes: …» con el código viejo deja pasar una guardia                               -> falla «SIN comentarios»
