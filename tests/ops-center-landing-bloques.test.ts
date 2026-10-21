// =============================================================================
// Ops Center 1.12 y 1.13 — los DATOS de lo que el chat dibuja de una landing (lib/editor-landing/bloques-chat.ts)
// =============================================================================
// Martín (20/10/2026): «quiero que en Ops Center se pueda hacer todo, editar videos, crear webs, etc...». Las piezas 1.12
// (la tarjeta de la landing y elegir entre 3: diseños, temas, formato de Replicar) y 1.13 (publicar con Copiar y Abrir,
// y el dominio con sus registros DNS y su estado) de docs/ops-center-principal.md. El marco que las lleva al hilo es de
// Ops Center 3 (1.7); esto fija lo que cada bloque dice, contra los catálogos reales:
//   · la tarjeta: el estado (borrador / publicada / pausada), el link sólo si está en internet, «Abrir en el editor» con
//     la ruta de ADENTRO de la app, y la miniatura con la primera sección y el tema;
//   · elegir entre 3: tres opciones que EXISTEN en el catálogo que dibuja la pantalla, distintas entre sí, con la
//     recomendada marcada y la operación que corre al elegir;
//   · el dominio: la tabla DNS tal cual, cuántos faltan (sin contar el www informativo) y qué vuelve a mirar el DNS.
//
// PROBADO ROMPIÉNDOLO (20/10/2026; arnés que rompe UNA cosa, corre este archivo, restaura y compara el sha256; las 9
// restauradas con el mismo hash; base 6 / 0). Pasan / fallan:
//   R1  la tarjeta de un borrador lleva el link público                        → 5 / 1
//   R2  una publicada con el sitio apagado no dice «pausada»                   → 5 / 1
//   R3  «Abrir en el editor» con una URL entera (sin el ?ws= de la pestaña)    → 4 / 2
//   R4  dos de los tres diseños arrancan igual (Audaz en vez de MaKo)          → 5 / 1
//   R5  «sin video» no pone Minimal primero                                    → 5 / 1
//   R6  elegir el tema ofrece el que ya tiene                                  → 5 / 1
//       (con «mako» seguía verde: no es el primero de su grupo. Ahora también el primero de cada grupo.)
//   R7  los tres temas del mismo grupo                                         → 5 / 1
//   R8  el www informativo cuenta como registro que falta                      → 5 / 1
//   R9  Replicar sin Landing primero                                           → 5 / 1
//
// Correr: node --import tsx --test tests/ops-center-landing-bloques.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OPCIONES_POR_BLOQUE, bloqueDireccion, bloqueDominio, bloqueLanding, bloquePublicada, elegirDiseno, elegirFormatoReplicar, elegirTema,
  estadoDeLanding, rutaEditor,
} from '../lib/editor-landing/bloques-chat';
import { DISENOS_LANDING } from '../lib/editor-landing/disenos-landing';
import { TEMAS } from '../lib/editor-landing/temas';
import { FORMATOS_REPLICAR } from '../lib/editor-landing/replicar-reglas';
import { plantillasDe } from '../app/web-generator/crear/tipo';
import type { JsonNodo } from '../lib/editor-landing/doc';

const PRIMERA: JsonNodo = { type: 'tarjeta', attrs: { id: 't1' }, content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Hola' }] }] };
const base = { id: 28, titulo: 'Landing del webinar', tema: 'mako', primera: PRIMERA, slug: null as string | null, publicadoAt: null as string | null };

test('la tarjeta de una landing: su estado, el link sólo si está en internet, y «Abrir en el editor» adentro de la app', () => {
  const borrador = bloqueLanding(base, 'https://hola-mako.site/x');
  assert.deepEqual([borrador.k, borrador.estado, borrador.url], ['landing', 'borrador', null], 'un borrador no tiene link público');
  assert.deepEqual(borrador.abrir, { titulo: 'Abrir en el editor', href: '/web-generator/28' });
  assert.doesNotMatch(borrador.abrir.href, /^https?:|[?&]ws=/, 'la ruta es de adentro: el ?ws= lo pega el Link de la pantalla');
  assert.deepEqual(borrador.miniatura, { tarjeta: PRIMERA, tema: 'mako', proporcion: null });

  const publicada = { ...base, slug: 'webinar', publicadoAt: '2026-10-20T12:00:00Z' };
  assert.deepEqual([bloqueLanding(publicada, 'https://hola-mako.site/webinar').estado, bloqueLanding(publicada, 'https://hola-mako.site/webinar').url], ['publicada', 'https://hola-mako.site/webinar']);
  assert.equal(estadoDeLanding({ ...publicada, sitioActivo: false }), 'pausada');
  assert.equal(estadoDeLanding({ ...publicada, sitioActivo: true }), 'publicada');
  assert.equal(estadoDeLanding({ slug: 'x', publicadoAt: null }), 'borrador', 'con slug pero sin publicar es un borrador');

  const presentacion = bloqueLanding({ ...base, formato: 'presentacion', proporcion: '4:3' }, null);
  assert.deepEqual([presentacion.formato, presentacion.miniatura.proporcion], ['presentacion', '4:3']);
  assert.equal(bloqueLanding({ ...base, titulo: '  ' }, null).titulo, 'Sin título');
  assert.equal(rutaEditor(5), '/web-generator/5');
});

test('«armame una landing» sin diseño: tres diseños que la pantalla sabe dibujar, distintos entre sí', () => {
  const dibujables = new Set(plantillasDe('landing').filter((p) => p.pideObjetivo).map((p) => p.id));
  const b = elegirDiseno('armame una landing');
  assert.deepEqual([b.k, b.que, b.operacion, b.parametro], ['elegir', 'diseno', 'crear_landing_desde_diseno', 'diseno']);
  assert.equal(b.opciones.length, OPCIONES_POR_BLOQUE);
  assert.equal(new Set(b.opciones.map((o) => o.id)).size, OPCIONES_POR_BLOQUE, 'dos opciones iguales');
  for (const o of b.opciones) {
    assert.ok(dibujables.has(o.id), `«${o.id}» no está en las plantillas que dibuja la pantalla`);
    assert.equal(o.cuando, DISENOS_LANDING.find((d) => d.id === o.id)?.descripcion);
  }
  // Tres maneras distintas de arrancar: video al costado, video al centro, sólo texto.
  const videos = b.opciones.map((o) => DISENOS_LANDING.find((d) => d.id === o.id)?.video ?? null);
  assert.equal(new Set(videos).size, 3, `los tres arrancan igual: ${videos.join(', ')}`);
  assert.equal(b.recomendada, b.opciones[0].id);
  // Lo que dice el pedido los ordena.
  assert.equal(elegirDiseno('una landing simple, sin video').opciones[0].id, 'minimal');
  assert.ok(elegirDiseno('quiero algo oscuro y elegante').opciones.some((o) => o.id === 'oscuro-moderno'));
});

test('elegir el tema: tres del catálogo, nunca el que ya tiene, dos de su grupo y uno del otro', () => {
  const b = elegirTema('mako', TEMAS);
  const actual = TEMAS.find((t) => t.id === 'mako')!;
  assert.equal(b.opciones.length, OPCIONES_POR_BLOQUE);
  assert.ok(!b.opciones.some((o) => o.id === 'mako'), 'ofreció el tema que ya tiene');
  const grupos = b.opciones.map((o) => TEMAS.find((t) => t.id === o.id)?.grupo);
  assert.ok(grupos.every(Boolean), 'ofreció un tema que no está en el catálogo');
  assert.equal(grupos.filter((g) => g === actual.grupo).length, 2);
  assert.equal(grupos.filter((g) => g !== actual.grupo).length, 1);
  assert.deepEqual([b.operacion, b.parametro], ['cambiar_tema_landing', 'tema']);
  // El que ya tiene, aunque sea el primero de su grupo (el que saldría primero): nunca.
  for (const g of ['claro', 'oscuro'] as const) {
    const primero = TEMAS.find((t) => t.grupo === g)!;
    assert.ok(!elegirTema(primero.id, TEMAS).opciones.some((o) => o.id === primero.id), `ofreció «${primero.id}», el que ya tiene`);
  }
  // Con un tema desconocido no se rompe: tres igual.
  assert.equal(elegirTema('ws:999', TEMAS).opciones.length, OPCIONES_POR_BLOQUE);
});

test('el formato de Replicar: los tres de la pantalla, con Landing primero y recomendada', () => {
  const b = elegirFormatoReplicar();
  assert.deepEqual(b.opciones.map((o) => o.id).sort(), [...FORMATOS_REPLICAR].sort());
  assert.deepEqual([b.opciones[0].id, b.recomendada, b.operacion, b.parametro], ['landing', 'landing', 'replicar_landing', 'formato']);
  assert.ok(b.opciones.every((o) => o.cuando.length > 0 && o.cuando.length <= 70), 'cada formato dice cuándo conviene, en una línea');
});

test('publicar: el link con Abrir y la vuelta al editor; la dirección ocupada dice por qué y una parecida', () => {
  const p = bloquePublicada({ id: 28, titulo: 'Webinar', url: 'https://hola-mako.site/webinar' });
  assert.deepEqual([p.k, p.url, p.abrir.href, p.editor.href], ['publicada', 'https://hola-mako.site/webinar', 'https://hola-mako.site/webinar', '/web-generator/28']);
  assert.deepEqual(bloqueDireccion({ id: 28, slug: 'webinar', disponible: true, motivo: 'x', sugerencia: 'y' }), { k: 'direccion', id: 28, slug: 'webinar', libre: true, motivo: null, sugerencia: null });
  assert.deepEqual(bloqueDireccion({ id: 28, slug: 'webinar', disponible: false, motivo: 'La usa otra landing.', sugerencia: 'webinar-2' }).sugerencia, 'webinar-2');
});

test('el dominio: la tabla DNS tal cual, cuántos faltan sin el www informativo, y qué vuelve a mirar el DNS', () => {
  const registros = [
    { tipo: 'A', nombre: '@', valor: '76.76.21.21', listo: false, para: 'apuntar' },
    { tipo: 'CNAME', nombre: 'www', valor: 'cname.vercel-dns.com', listo: false, para: 'www' },
    { tipo: 'TXT', nombre: '_mako', valor: 'mako-123', listo: true, para: 'mako' },
    { tipo: 'TXT', nombre: '_vercel', valor: 'vc-456', listo: null },
  ];
  const b = bloqueDominio(28, { dominio: 'midominio.com', estado: 'pendiente', registros, falta: 'Falta el registro A.' });
  assert.deepEqual(b.registros, registros);
  assert.equal(b.faltan, 1, 'el www que MaKo suma es informativo; null (no se pudo leer) no es «falta»');
  assert.deepEqual(b.verificar, { operacion: 'verificar_dominio_landing', id: 28 });
  assert.equal(b.falta, 'Falta el registro A.');
  const ok = bloqueDominio(28, { dominio: 'midominio.com', estado: 'verificado', registros, falta: 'viejo' });
  assert.deepEqual([ok.faltan, ok.falta], [0, null]);
});
