// =============================================================================
// La API de MaKo declara los botones de un DM de Instagram (25/10/2026)
// =============================================================================
// El Cerebro (25/10, con el pedido de Leandro): «La API de MaKo no los declara. Leandro configura con su Claude por la API, y ya
// le pasó con Instagram» (memoria api-mako-con-cada-feature). Fija:
//   · `cambiar_botones_mensaje`: por HTTP (lo que usa el Claude de un cliente), de PANTALLA (la persona lo confirma), con
//     `botones` que puede ir vacía (los saca), en el snapshot de HTTP y en docs/api-mako.md;
//   · lo que decide sin escribir (`botonesParaGuardar`, lib/botones-api.ts): sólo un DM de Instagram o Messenger, hasta 3, un
//     título de hasta 20, UNA cosa por botón, «sigue» a otra tarjeta de la misma automatización, un link web; el id de un
//     botón que se queda; y nada que no se pueda publicar (sólo los errores NUEVOS);
//   · la ficha y las inscripciones del lead dicen los botones y si espera un toque; crear con IA dice que los arma.
// Correr: node --import tsx --test tests/api-mako-botones.test.ts
// ROTURAS (25/10/2026, una por vez y restaurada; base 5 / 0): la operación sin http → 4 / 1; «sigue» a la misma tarjeta
// aceptado → 4 / 1; el id de antes perdido → 4 / 1; un error que el flujo ya tenía frena el cambio → 4 / 1; la ficha sin
// los botones → 4 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { porId } from '../lib/api-mako/registro';
import { botonesParaGuardar } from '../lib/botones-api';
import { botonesDe } from '../lib/botones-social';
import type { PasoGrafo } from '../lib/flujo-grafo';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const GATE: PasoGrafo[] = [
  { id: 'cron', nodo: 'inicio', canal: 'instagram', siguiente: 'm1' } as PasoGrafo,
  { id: 'm1', canal: 'instagram', cuerpo: '¡Ey! Te dejo el recurso:', siguiente: null, botones: [{ id: 'b1', titulo: 'Obtener recurso', siguiente: 'c1' }] } as PasoGrafo,
  { id: 'c1', nodo: 'condicion', canal: 'instagram', ramas: [{ id: 'r1', modo: 'todas', filas: [{ campo: 'sigue_instagram' }], siguiente: 'm2' }], si_no: 'm3' } as PasoGrafo,
  { id: 'm2', canal: 'instagram', cuerpo: '¡Aquí está! https://fiesta.example/recurso', siguiente: null } as PasoGrafo,
  { id: 'm3', canal: 'instagram', cuerpo: 'Síguenos y toca el botón.', siguiente: null, botones: [{ id: 'b1', titulo: 'Ya te sigo', siguiente: 'c1' }] } as PasoGrafo,
  { id: 'w1', canal: 'whatsapp', cuerpo: 'Hola', siguiente: null } as PasoGrafo,
];

test('la operación: por HTTP, de pantalla, y «botones» puede ir vacía (los saca)', () => {
  const d = porId('cambiar_botones_mensaje');
  assert.ok(d, 'no está declarada');
  assert.ok(d.canales.includes('http'), 'el Claude de un cliente usa HTTP');
  assert.equal(d.tipo, 'accion');
  assert.equal((d as { confirmacion?: string }).confirmacion, 'pantalla');
  const b = d.parametros.find((p) => p.nombre === 'botones')!;
  assert.equal(b.vaciaEsValor, true);
  assert.equal(b.obligatorio, undefined, '[] tiene que llegar');
  assert.ok(leer('tests/api-mako-http.snapshot.txt').split('\n').includes('cambiar_botones_mensaje'));
  assert.match(leer('docs/api-mako.md'), /cambiar_botones_mensaje/);
});

test('cambiar los botones: el id de antes se queda, uno nuevo toma uno libre, y un link web', () => {
  const r = botonesParaGuardar(GATE, 'm1', [{ titulo: 'Ver la clase', link: 'https://fiesta.example/clase' }, { titulo: 'obtener recurso', sigue: 'c1' }], 'Recurso');
  assert.ok(r.ok, r.ok ? '' : r.error);
  assert.deepEqual(r.ok && r.botones.map((b) => [b.id, b.titulo, b.siguiente ?? b.url]), [['b2', 'Ver la clase', 'https://fiesta.example/clase'], ['b1', 'obtener recurso', 'c1']]);
  assert.match(r.ok ? r.resumen : '', /«Ver la clase» abre https:\/\/fiesta\.example\/clase · «obtener recurso» sigue en c1/);
  // [] los saca (los de «Ya te sigo»: la condición sigue teniendo quien llegue).
  const sin = botonesParaGuardar(GATE, 'm3', [], 'Recurso');
  assert.ok(sin.ok && botonesDe(sin.pasos.find((p) => p.id === 'm3')).length === 0 && !('botones' in sin.pasos.find((p) => p.id === 'm3')!), sin.ok ? '' : sin.error);
  // Sacarle el único botón a «Obtener recurso» deja la condición y sus mensajes sueltos: no se publica, y se dice.
  const suelta = botonesParaGuardar(GATE, 'm1', [], 'Recurso');
  assert.ok(!suelta.ok && /tarjetas sueltas: c1, m2, m3/.test(suelta.error), suelta.ok ? 'se aceptó' : suelta.error);
});

test('lo que no se puede, dicho: otra tarjeta, otro canal, de más, a la misma, sin decidir, una dirección mala', () => {
  const err = (t: string, l: unknown[]) => { const r = botonesParaGuardar(GATE, t, l as never, 'Recurso'); return r.ok ? '' : r.error; };
  assert.match(err('zz', []), /no tiene una tarjeta «zz»/);
  assert.match(err('w1', [{ titulo: 'A', sigue: 'c1' }]), /de un mensaje de Instagram o Messenger/);
  assert.match(err('c1', [{ titulo: 'A', sigue: 'm2' }]), /de un mensaje de Instagram o Messenger/);
  assert.match(err('m1', [1, 2, 3, 4].map((k) => ({ titulo: `B${k}`, sigue: 'c1' }))), /hasta 3 botones/);
  assert.match(err('m1', [{ titulo: 'Un título larguísimo de más', sigue: 'c1' }]), /pasa de 20 letras/);
  assert.match(err('m1', [{ titulo: 'A' }]), /hace UNA cosa/);
  assert.match(err('m1', [{ titulo: 'A', sigue: 'c1', link: 'https://x.example' }]), /hace UNA cosa/);
  assert.match(err('m1', [{ titulo: 'A', sigue: 'm1' }]), /no es otra tarjeta/, 'un botón que vuelve al mismo mensaje');
  assert.match(err('m1', [{ titulo: 'A', sigue: 'otra' }]), /no es otra tarjeta/);
  assert.match(err('m1', [{ titulo: 'A', link: 'javascript:alert(1)' }]), /no es una dirección web/);
});

test('un error que el flujo ya tenía no frena; uno NUEVO, sí', () => {
  // El flujo ya tiene un problema (una condición sin ramas): cambiar un botón igual se puede.
  const roto = GATE.map((p) => (p.id === 'c1' ? { ...p, ramas: [] } : p)) as PasoGrafo[];
  assert.ok(botonesParaGuardar(roto, 'm3', [{ titulo: 'Ya te sigo', sigue: 'c1' }], 'Recurso').ok);
  // Un texto de más de 640 con botones no se publica (`problemasDeBotones`): eso sí es nuevo.
  const largo = GATE.map((p) => (p.id === 'm2' ? { ...p, cuerpo: 'x'.repeat(700) } : p)) as PasoGrafo[];
  const r = botonesParaGuardar(largo, 'm2', [{ titulo: 'Más', sigue: 'm3' }], 'Recurso');
  assert.ok(!r.ok && /Así no se puede publicar/.test(r.error), r.ok ? 'se aceptó' : r.error);
});

test('la ficha dice los botones; las inscripciones, si espera un toque; crear con IA, que los arma', () => {
  const run = leer('lib/api-mako/areas/chatbot.run.ts');
  assert.match(run, /\.\.\.\(botonesDe\(p\)\.length \? \{ botones: botonesDe\(p\)\.map\(\(b\) => \(b\.url \? \{ id: b\.id, titulo: b\.titulo, link: b\.url \} : \{ id: b\.id, titulo: b\.titulo, sigue: b\.siguiente \?\? null \}\)\) \} : \{\}\),/);
  assert.match(run, /espera_toque: vivas\.get\(Number\(f\.secuencia_id\)\)!\.esperaToque/);
  const def = leer('lib/api-mako/areas/chatbot.def.ts');
  assert.match(def, /un mensaje de Instagram o Messenger, sus botones: id, titulo y «sigue»/);
  assert.match(def, /Por Instagram o Messenger arma también los botones del DM, y el recurso a cambio de seguir la cuenta/);
  assert.match(def, /espera_toque: está parado en un DM con botones/);
});
