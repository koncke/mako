// =============================================================================
// El interruptor «Etapa del kanban» y «Eliminar módulo»: quitar una etapa del kanban desde el curso
// =============================================================================
// Pedido de Martín (08/10/2026, item 15): «la sección del kanban… como el típico desplazable de activo o
// no activo. Y si se desactiva se elimina esa etapa del kanban, y si hay leads debería preguntar a dónde
// los mueve… en módulo falta la opción de eliminar módulo, si se elimina, se elimina también la etapa».
//
// Lo que se EJECUTA (lib/curso-modulos.ts, puro):
//   · `decidirQuitarEtapa`: la entrada no se quita, con clientes se PREGUNTA, el destino es otra etapa,
//     y las fases quedan.
//   · `planConEtapaDevuelta`: el «Deshacer» devuelve la MISMA etapa en el MISMO lugar.
// Lo que se LEE del fuente, porque toca la base (y lo que importa es QUÉ LLAMA):
//   · a los clientes los muda el choke point en SILENCIO (`silencioso: true`), antes de tocar el kanban;
//   · en silencio, el choke point NO enrola: cierra lo agendado de la etapa que deja y BLOQUEA las
//     secuencias de la nueva, y eso que bloquea es lo que la red del cron respeta.
//
// PROBADO ROMPIÉNDOLO: la tabla con los números está al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ERROR_ENTRADA, decidirQuitarEtapa, planConEtapaDevuelta, derivarModulos } from '../lib/curso-modulos';
import type { EtapaEntrega, FaseEntrega } from '../lib/servicio-etapas';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El bloque que arranca en `desde` y termina en el primer `hasta` después de él (su cierre real). */
const bloque = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»: ¿se movió?`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre «${hasta}» de «${desde}»`);
  return src.slice(i, j);
};

const e = (key: string, fase?: string): EtapaEntrega => ({ key, label: key.toUpperCase(), color: 'gris', ...(fase ? { fase } : {}) } as unknown as EtapaEntrega);
const ENTREGA = {
  etapas: [e('bienvenida', 'f1'), e('diagnostico', 'f1'), e('hito1', 'f2'), e('cierre', 'f2')],
  fases: [{ key: 'f1', label: 'Arranque', color: 'azul' }, { key: 'f2', label: 'Cierre', color: 'verde' }] as unknown as FaseEntrega[],
};

test('la ENTRADA del kanban no se quita: un cliente sin fila está en la primera, y sacarla los movería en silencio', () => {
  assert.deepEqual(decidirQuitarEtapa(ENTREGA, 'bienvenida', 0), { ok: false, error: ERROR_ENTRADA });
  assert.deepEqual(decidirQuitarEtapa(ENTREGA, 'nada', 0), { ok: false, error: 'Esa etapa ya no existe.' });
});

test('con clientes adentro y sin destino PREGUNTA (las otras etapas, en orden), y no decide nada', () => {
  const r = decidirQuitarEtapa(ENTREGA, 'hito1', 3);
  assert.equal(r.ok, false);
  assert.deepEqual(!r.ok && r.pregunta, {
    clientes: 3, destinos: [{ key: 'bienvenida', label: 'BIENVENIDA' }, { key: 'diagnostico', label: 'DIAGNOSTICO' }, { key: 'cierre', label: 'CIERRE' }],
  });
  // Un destino que no es OTRA etapa de este kanban se rechaza (ni ella misma, ni una inventada).
  assert.equal(decidirQuitarEtapa(ENTREGA, 'hito1', 3, 'hito1').ok, false);
  assert.equal(decidirQuitarEtapa(ENTREGA, 'hito1', 3, 'onboarding').ok, false);
});

test('quitarla deja el kanban SIN ella y con las fases intactas; sin clientes no hay destino que guardar', () => {
  const r = decidirQuitarEtapa(ENTREGA, 'hito1', 2, 'cierre');
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.etapas.map((x) => x.key), ['bienvenida', 'diagnostico', 'cierre']);
  assert.deepEqual(r.fases, ENTREGA.fases, 'quitar una columna no le borra el color a las demás');
  assert.equal(r.destino, 'cierre');
  assert.deepEqual([r.etapa.key, r.indice], ['hito1', 2], 'devuelve cómo era y dónde estaba: es lo que usa el «Deshacer»');
  const vacia = decidirQuitarEtapa(ENTREGA, 'hito1', 0, 'cierre');
  assert.ok(vacia.ok && vacia.destino === null, 'sin clientes no se muda a nadie');
});

test('el «Deshacer» devuelve la MISMA etapa en el MISMO lugar, con su fase; nunca antes de la entrada', () => {
  const sin = decidirQuitarEtapa(ENTREGA, 'hito1', 0);
  assert.ok(sin.ok);
  if (!sin.ok) return;
  const despues = { etapas: sin.etapas, fases: sin.fases };
  // Los módulos de hoy: el suelto que quedó en su lugar (clave nueva) ya no está; vuelve con la vieja.
  const modulos = derivarModulos(despues.etapas, []).map((m) => ({ clave: m.clave, vinculado: m.vinculado }));
  const claves = ['bienvenida', 'diagnostico', 'hito1', 'cierre'];
  const p = planConEtapaDevuelta(despues, modulos, claves, sin.etapa, sin.indice);
  assert.ok(p.ok, !p.ok ? p.error : '');
  if (!p.ok) return;
  assert.deepEqual(p.etapas.map((x) => [x.key, x.fase]), [['bienvenida', 'f1'], ['diagnostico', 'f1'], ['hito1', 'f2'], ['cierre', 'f2']]);
  // Un índice 0 (o basura) no le gana a la entrada: va después de ella.
  const p0 = planConEtapaDevuelta(despues, modulos, ['bienvenida', 'hito1', 'diagnostico', 'cierre'], sin.etapa, 0);
  assert.ok(p0.ok && p0.etapas[0].key === 'bienvenida');
  // Y si la secuencia de módulos la pone PRIMERA, se rechaza: la entrada es la de antes (`ERROR_PRIMERA`).
  // (Romper el acotado del índice a 1 sigue en verde: lo que manda es el orden de los módulos, y la
  // entrada la cuida `planReorden` con la primera de ANTES, que es lo que esta línea fija.)
  const primero = planConEtapaDevuelta(despues, modulos, ['hito1', 'bienvenida', 'diagnostico', 'cierre'], sin.etapa, 2);
  assert.equal(primero.ok, false, 'devolverla delante de la entrada movería en silencio a los clientes sin fila');
});

// ── Lo que se LEE del fuente: QUÉ LLAMA ──────────────────────────────────────

const DATOS = sinComentarios(leer('lib/curso-modulos-datos.ts'));
const CHOKE = sinComentarios(leer('lib/cs-mover-etapa.ts'));
const NUTRI = sinComentarios(leer('lib/nutricion.ts'));

test('a los clientes de la etapa los muda el choke point EN SILENCIO, uno por uno, y quitar no escribe sin decidir antes', () => {
  const mover = bloque(DATOS, 'async function moverClientesEnSilencio(', '\n}\n');
  assert.match(mover, /await moverClienteDeEtapa\(\{ leadId, productoId, etapa: destino, por, silencioso: true \}\)/);
  assert.doesNotMatch(DATOS, /from\('cliente_entrega'\)\.(update|upsert|insert|delete)\(/, 'nadie escribe cliente_entrega a mano: va por el choke point');
  // Apagar el interruptor: decide (y pregunta) ANTES de cualquier escritura.
  const desv = bloque(DATOS, 'if (!vincular) {', 'const usadas = await clavesUsadas(productoId, cur.entrega, cur.filas);\n    const previa');
  const i = (s: string) => { const k = desv.indexOf(s); assert.ok(k >= 0, `falta ${s}`); return k; };
  assert.ok(i('if (!d.ok) return d;') < i('moverClientesEnSilencio('), 'la pregunta sale antes de mover a nadie');
  assert.ok(i('if (no.length) return') < i("from('curso_modulos').insert("), 'si un cliente no se movió, no se toca nada más');
  // Y el clic del menú pasa el destino de la pregunta y quién lo hizo (la línea del historial lo firma).
  const acc = sinComentarios(leer('app/customer-success/curso/modulos-actions.ts'));
  assert.match(bloque(acc, 'export async function vincularModuloAction(', '\n}\n'), /por: await autorActual\(\)/);
});

test('el choke point EN SILENCIO bloquea las secuencias de la nueva ANTES de mover (y sin poder, no mueve), cierra lo de la que deja y no enrola', () => {
  const fn = bloque(CHOKE, 'export async function moverClienteDeEtapa(', 'export async function sacarClienteDeEntrega(');
  const pos = (s: string, desde = 0) => { const k = fn.indexOf(s, desde); assert.ok(k >= 0, `falta ${s}`); return k; };
  // ANTES de escribir la columna (revisión final del 08/10/2026): bloqueado después, un fallo al leer las
  // secuencias dejaba al cliente movido y sin bloqueo, y la red del cron lo enrolaba en la próxima corrida.
  const antes = bloque(fn, 'if (pedido.silencioso) {', "from('cliente_entrega').update(");
  assert.match(antes, /await silenciarEntregaDeEtapa\(pedido\.leadId, hacia, pedido\.productoId\)/, 'bloquea antes de mover');
  assert.match(antes, /catch \(e\) \{[\s\S]*return fallo\(pedido,/, 'sin poder bloquear, NO se mueve (fail-closed)');
  // DESPUÉS de la columna y de su historial: cierra lo agendado de la que deja, y vuelve sin enrolar.
  const sil = bloque(fn.slice(pos("from('lead_audit').insert")), 'if (pedido.silencioso) {', 'return { ...base, cambio: true };');
  assert.match(sil, /await cerrarEntregaDeEtapa\(pedido\.leadId, desde, pedido\.productoId, hacia\)/, 'sin la etapa nueva, un CRON de varias etapas se corta al moverse entre dos suyas (cuarta tanda, punto 14)');
  assert.doesNotMatch(sil, /enrolarPorEvento|avisarEntradaAEtapa|enviar/, 'en silencio no se enrola ni se manda nada');
  const despues = pos('if (pedido.silencioso) {', pos("from('lead_audit').insert"));
  assert.ok(despues < pos('enrolarPorEvento('), 'el silencio corta ANTES del enrolamiento');
  // Y sólo lo pide quien quita una etapa: el resto de la app mueve con mensajes, como siempre. Se barre
  // el DISCO y no `git ls-files` (un archivo nuevo sin agregar no aparecería).
  const llamadores = ['app', 'lib'].flatMap((d) => fuentes(join(RAIZ, d)))
    .filter((f) => sinComentarios(readFileSync(f, 'utf8')).includes('silencioso: true'))
    .map((f) => f.slice(RAIZ.length + 1).replace(/\\/g, '/'));
  assert.deepEqual(llamadores.sort(), ['lib/curso-modulos-datos.ts']);
});

/** Los .ts / .tsx de una carpeta, recursivo. */
function fuentes(dir: string): string[] {
  const { readdirSync } = require('node:fs') as typeof import('node:fs');
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = join(dir, d.name);
    if (d.isDirectory()) return d.name === 'node_modules' ? [] : fuentes(p);
    return /\.(ts|tsx)$/.test(d.name) ? [p] : [];
  });
}

test('lo que BLOQUEA las secuencias es una inscripción CERRADA, y la red del cron la respeta', () => {
  const sil = bloque(NUTRI, 'export async function silenciarEntregaDeEtapa(', '\n}\n');
  assert.match(sil, /secuenciasDeEntrega\(await getSecuenciasActivas\(\), key, productoId\)/, 'las mismas secuencias que enrolaría el evento');
  assert.match(sil, /estado: 'cancelada', proximo_envio_at: null,/);
  assert.match(sil, /desenlace: 'cancelado'/);
  assert.doesNotMatch(sil, /procesarEnvios|enrolarPorEvento|'activa'/, 'bloquear no puede mandar nada');
  // Y TIRA si una no quedó bloqueada (revisión final): el choke point no mueve sin el bloqueo.
  assert.match(sil, /if \(error\.code === '23505'\) continue;/, 'la que ya tenía fila ya está frenada');
  assert.match(sil, /if \(fallas\.length\) throw new Error\(/, 'una que no se bloqueó corta el movimiento');
  // La red del cron (`aInscribir`) saltea a quien YA tiene una fila de esa secuencia, y una de entrega no
  // se reusa (sólo las que preparan una reunión): si esto cambia, la fila de arriba deja de bloquear y el
  // movimiento silencioso le escribe al cliente en la próxima corrida.
  const ai = bloque(NUTRI, 'async function aInscribir(', '\n}\n');
  assert.match(ai, /const pendientes = candidatos\.filter\(\(id\) => !conFila\.has\(id\)\);/);
  // Undécima tanda (M2): «prepara una reunión» mira la automatización ENTERA (`preparaReunion`).
  assert.match(NUTRI, /const reusaInscripciones = \(s: Pick<Secuencia, 'trigger_tipo' \| 'pasos' \| 'etapa' \| 'etapas' \| 'disparadores'>\): boolean =>\s*preparaReunion\(s\) && s\.pasos\.length > 0;/);
});

// ── Probado ROMPIÉNDOLO (08/10/2026) ──────────────────────────────────────────
// Una rotura por vez, restaurada deshaciendo el reemplazo (scratchpad/estructura/romper.mjs y
// romper2.mjs). Sin romper: 7/0.
//   · la entrada se quita · con clientes no pregunta · acepta un destino inventado · borra las fases ·
//     devuelve la etapa al final y no en su lugar                                → 6 / 1 cada una
//   · muda a los clientes CON mensajes (`silencioso: false`)                     → 5 / 2
//   · sigue aunque un cliente no se movió · en silencio también enrola · el silencio no corta antes del
//     enrolamiento · el bloqueo se escribe 'activa' · la red del cron deja de saltear a quien tiene fila ·
//     otro llamador (invitar) pide silencio                                       → 6 / 1 cada una
//   · DEFENSA DOBLE de la entrada al devolver: el índice acotado a 1 (→ 0) sola, o comparar la primera
//     contra el kanban NUEVO sola → 7 / 0 las dos (una cubre a la otra); las dos juntas → 6 / 1.
// Revisión final (08/10/2026), con el bloqueo movido ANTES de la columna (scratchpad/revision/romper.mjs):
//   · sin el bloqueo antes de mover · el `catch` sigue y mueve igual (sin `return fallo`) · sin cerrar lo
//     de la etapa que deja                                                          → 6 / 1 cada una
//   · `silencioso: false` al mudar                                                  → 5 / 2
//   · `silenciarEntregaDeEtapa` que anota y sigue cuando un insert falla (sin el `throw`) → 6 / 1
