// =============================================================================
// Leila 2: al activar una automatización «llega a etapa», los que YA están en la etapa (28/10/2026)
// =============================================================================
// Leila (ws11), 20/10 17:38: «la activé para todos los que están en reactivación… todavía no pasa nada». Lo medido en el
// código: el barrido SÍ mira a los que ya están parados en la etapa, pero con la ventana anti-revival de 90 días sobre el
// último HITO del lead (el alta, la agenda, una reunión), y mover a alguien de etapa NO es un hito. Los de «reactivación»
// son justo leads viejos movidos a mano: quedaban afuera en cada pasada, sin un aviso. La ventana se queda; al activar, la
// pantalla cuenta y ofrece incluirlos (con el goteo de siempre).
// Fija:
//   · lo puro (lib/etapa-existentes.ts): el último hito (la MISMA regla que el barrido), la pregunta y el aviso;
//   · el motor (leyendo el fuente: `server-only`): el barrido NUNCA pide sin ventana; contar e incluir pasan por la misma
//     puerta que el barrido (`aTiempo` + `aInscribir`), un CRON con horario no se ofrece, y sólo se incluye en una activa;
//   · la ruta: contar es del admin, e incluir va sólo al prender;
//   · la pantalla: «Activar» cuenta antes y pregunta, y «Incluirlas» viaja en el toggle.
// Correr: node --import tsx --test tests/etapa-existentes.test.ts
// ROTURAS (28/10/2026, una por vez y restaurada; base 5 / 0): la ventana sin saltear → 4 / 1; el barrido pidiendo sin
// ventana → 4 / 1; contar un CRON con horario → 4 / 1; incluir en una pausada → 4 / 1; contar sin ser admin → 4 / 1; incluir
// al pausar → 4 / 1; «Activar» sin contar → 4 / 1; el toggle sin `incluirExistentes` → 4 / 1; la pregunta sin los viejos → 4 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ultimoHitoMs, hayQuePreguntar, preguntaExistentes, textoAlActivar, VENTANA_HITO_DIAS } from '../lib/etapa-existentes';

const RAIZ = join(__dirname, '..');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n'));
/** El cuerpo de una función de nivel superior (hasta la llave que cierra en la columna 0). */
const funcion = (src: string, firma: string) => { const i = src.indexOf(firma); assert.ok(i >= 0, `no encontré ${firma}`); return src.slice(i, src.indexOf('\n}\n', i)); };

test('el último hito: el alta, la agenda o una reunión; mover de etapa no cuenta', () => {
  const lead = { created_at: '2026-03-01T10:00:00Z', fecha_agenda: '2026-05-02T10:00:00Z', fecha_junta_1: null, fecha_junta_2: 'basura' };
  assert.equal(ultimoHitoMs(lead), Date.parse('2026-05-02T10:00:00Z'));
  assert.equal(ultimoHitoMs({}), 0);
  // Un lead de marzo movido a «reactivación» el 20/10: para la ventana sigue siendo de mayo (no hay dónde leer el cambio).
  const corte = Date.parse('2026-10-20T00:00:00Z') - VENTANA_HITO_DIAS * 86400_000;
  assert.ok(ultimoHitoMs(lead) < corte, 'el de reactivación queda afuera de la ventana: por eso se pregunta');
});

test('la pregunta y el aviso: cuántos entran solos, cuántos no, corto', () => {
  assert.equal(hayQuePreguntar(null), false);
  assert.equal(hayQuePreguntar({ etapas: ['reactivacion'], entran: 4, viejos: 0 }), false, 'si entran todos, no se pregunta');
  assert.equal(hayQuePreguntar({ etapas: ['reactivacion'], entran: 0, viejos: 3 }), true);
  assert.equal(preguntaExistentes({ etapas: ['reactivacion'], entran: 12, viejos: 25 }, ['Reactivación']),
    'En «Reactivación» hay 37 personas. 12 entran ahora; 25 no se movieron en 90 días. ¿Las incluyo? Salen de a poco.');
  assert.equal(preguntaExistentes({ etapas: ['a', 'b'], entran: 0, viejos: 1 }, ['Frío', 'Perdido']),
    'En «Frío» y «Perdido» hay 1 persona. 1 no se movió en 90 días. ¿La incluyo? Salen de a poco.');
  assert.equal(textoAlActivar(0, 0), 'Activada ✓');
  assert.equal(textoAlActivar(12, 25), 'Activada ✓ · entran 37 personas que ya estaban en la etapa');
  assert.equal(textoAlActivar(1, 0), 'Activada ✓ · entra 1 persona que ya estaba en la etapa');
});

test('el motor: la ventana se puede saltear SÓLO al contar e incluir; el barrido nunca', () => {
  const src = leer('lib/nutricion.ts');
  const cohorte = funcion(src, 'async function cohorteDeTrigger(');
  assert.match(cohorte, /const corte = o\.sinVentana \? -Infinity : Date\.now\(\) - VENTANA_HITO_DIAS \* 86400 \* 1000;/);
  assert.match(cohorte, /\.filter\(\(l\) => ultimoHitoMs\(l\) >= corte\)/, 'la casa usa la regla pura');
  assert.match(funcion(src, 'export async function leadsDeCohorte('), /cohorteDeTrigger\(triggerTipo, etapa \?\? null, await ambitoDeFunnel\(funnelId\), etiquetaId \?\? null, o\)/);
  // El barrido (el plan y el commit) pide la cohorte de siempre: con la ventana.
  for (const f of ['export async function planificarInscripciones(', 'export async function comprometerInscripciones(']) {
    const cuerpo = funcion(src, f);
    // Sin un sexto argumento (las opciones, `sinVentana`): `))` en el plan, `);` en el commit, que desde el 6/11/2026 la lee
    // aparte para saltear sólo esa automatización si la cohorte no se pudo leer.
    assert.match(cuerpo, /leadsDeCohorte\(sec\.trigger_tipo, etapasDe\(sec\), sec\.funnel_id, sec\.producto_id, sec\.etiqueta_id\)[);]/, `${f} cambió cómo pide la cohorte`);
    assert.doesNotMatch(cuerpo, /sinVentana/, `${f} no puede saltear la ventana`);
  }
  // Contar: por la MISMA puerta que el barrido, sólo CRON por etapa y sin horario.
  const contar = funcion(src, 'async function existentesPorCron(');
  assert.match(contar, /if \(vista\.trigger_tipo !== TRIGGER_ETAPA \|\| vista\.cron\) continue;/);
  assert.match(contar, /aTiempo\(supabase, vista, await pedir\(false\)\)/);
  assert.match(contar, /aTiempo\(supabase, vista, await pedir\(true\)\)\)\.filter\(\(id\) => !vistos\.has\(id\) && !conVentana\.has\(id\)\)/, 'los viejos son los que la ventana deja afuera');
  assert.match(contar, /await aInscribir\(supabase, vista, viejos\)/, 'quien ya tiene fila no se cuenta ni se inscribe dos veces');
  // Incluir: sólo en una activa, con la fila del barrido.
  const incluir = funcion(src, 'export async function incluirExistentes(');
  assert.match(incluir, /if \(!sec\?\.activa\) return 0;/);
  assert.match(incluir, /paso_actual: 0,\s*estado: 'activa',\s*proximo_envio_at: n\.proximo_envio_at,/);
  assert.match(incluir, /reactivarReusables\(supabase, vista, viejos\.reusar\)/);
  assert.doesNotMatch(incluir, /recientes/, 'los que entran solos los inscribe el barrido, no esto');
});

test('la ruta: contar es del admin, e incluir va sólo al prender', () => {
  const r = leer('app/api/whatsapp/secuencias/route.ts');
  const get = funcion(r, 'export async function GET(');
  assert.match(get, /if \(existentes != null\) \{\s*if \(\(await getRolWsEfectivo\(\)\) !== 'admin'\)/);
  assert.match(get, /existentes: await existentesEnEtapa\(id\)/);
  assert.match(r, /if \(body\.activa && body\.incluirExistentes === true\) \{\s*incluidos = await incluirExistentes\(id\)/);
  assert.ok(r.indexOf('await setSecuenciaActiva(id, body.activa') < r.indexOf('incluidos = await incluirExistentes(id)'), 'se incluye DESPUÉS de prender');
});

test('la pantalla: «Activar» cuenta antes y pregunta; «Incluirlas» viaja en el toggle', () => {
  const p = leer('app/automations/SecuenciaPerfil.tsx');
  assert.match(p, /conAvisoDuplicada\(true, 'Activar igual', \(\) => void conExistentes\(\(\) => void conRitmo\(\(\) => void toggle\(\)\)\), abiertoPublicado\)/);
  assert.match(p, /fetch\(`\/api\/whatsapp\/secuencias\?existentes=\$\{secuencia\.id\}`\)/);
  assert.match(p, /if \(!hayQuePreguntar\(e\)\) \{ seguir\(\); return; \}/);
  assert.match(p, /const incluir = !activa && incluirExistentes\.current;/);
  assert.match(p, /\.\.\.\(incluir \? \{ incluirExistentes: true \} : \{\}\)/);
  assert.match(p, /onConfirm=\{\(\) => \{ const s = avisoExistentes\.seguir; setAvisoExistentes\(null\); incluirExistentes\.current = true; s\(\); \}\}/);
  assert.match(p, /textoAlActivar\(entranAlActivar\.current, Number\(r\.incluidos\) \|\| 0\)/);
});
