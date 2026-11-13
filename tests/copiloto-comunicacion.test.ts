// =============================================================================
// Marketing CoPilot — «Oferta y comunicación» (12/11/2026): lo que decide el código, sin base ni IA
// =============================================================================
// Fija lo que pidió Martín en las vueltas 18 y 19 de la maqueta y lo que no se puede romper al programarlo:
//   · la cabecera de cada caja dice lo que falta en UNA línea (el nombre si entra, si no cuántas);
//   · una lectura nueva de MaKo NUNCA pisa lo que la persona confirmó;
//   · marcar confirma lo leído y desmarcar lo deja «por confirmar» (no borra lo que se sabe); lo vacío no se marca;
//   · la nota la calcula el código (promedio × 10) y una respuesta de la IA a medias no vale;
//   · nada de lo que trae la IA entra sin sanear (claves del catálogo, la fuente «chat» sólo la pone la persona).
// Probado rompiéndolo: al pie.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OC, RUBRICA_OC, clavesOC, decirOC, estadoDeGrupoOC, fundirLecturaOC, grupoParaAbrirOC, marcarOC, sanearGuardadoOC, totalNotaOC,
  type CosaOC, type GuardadoOC,
} from '../lib/copiloto/comunicacion';
import { parseLecturaOC, promptOC } from '../lib/copiloto/comunicacion-lectura';

const T = '2026-11-12T10:00:00.000Z';
const vacia: CosaOC = { estado: 'vacia', valor: '', fuente: null, at: null };
const leida = (valor: string): CosaOC => ({ estado: 'negocio', valor, fuente: { tipo: 'anuncio', texto: 'Tu anuncio' }, at: T });
const lista = (valor: string): CosaOC => ({ estado: 'confirmada', valor, fuente: { tipo: 'chat', texto: 'Lo dijiste en el chat' }, at: T });
const cosasDe = (p: 'angulos' | 'voz', m: Record<string, CosaOC>) => Object.fromEntries(clavesOC(p).map((k) => [k, m[k] ?? vacia]));

test('las tres partes: ángulos y voz con sus grupos, y la oferta sobre las piezas de Offer, sin claves repetidas', () => {
  for (const p of ['oferta', 'angulos', 'voz'] as const) {
    const ks = clavesOC(p);
    assert.equal(new Set(ks).size, ks.length, `${p}: una clave en dos grupos`);
    for (const k of ks) assert.ok(OC[p].items[k], `${p}: «${k}» no está en el catálogo`);
  }
  assert.deepEqual(OC.angulos.grupos.map((g) => g.titulo), ['Tu dolor', 'Tus ángulos', 'De dónde salen', 'Cómo los mides']);
  assert.equal(clavesOC('oferta').length, 20, 'las 20 piezas de Offer');
  assert.equal(RUBRICA_OC.angulos.length, 9);
  assert.equal(RUBRICA_OC.voz.length, 9);
});

test('la cabecera de cada caja: el nombre si entra; si no, cuántas (en el teléfono, siempre cuántas)', () => {
  const g = OC.angulos.grupos[0]; // dolor, dolor2, palabras
  assert.deepEqual(estadoDeGrupoOC('angulos', g, cosasDe('angulos', {})), { e: 'falta', dice: 'Todo por hacer', tel: 'Todo por hacer' });
  assert.deepEqual(estadoDeGrupoOC('angulos', g, cosasDe('angulos', { dolor: lista('x'), dolor2: leida('y') })), { e: 'falta', dice: 'Falta: sus palabras', tel: 'Falta 1' });
  const voz = OC.voz.grupos[0]; // tono, arranque, atraen, evitar
  const r = estadoDeGrupoOC('voz', voz, cosasDe('voz', { tono: lista('x'), arranque: lista('y') }));
  assert.equal(r.e, 'falta');
  assert.equal(r.dice, 'Faltan 2', '«Falta: palabras que atraen y palabras que evitar» parte el nombre del grupo en dos renglones');
  assert.deepEqual(estadoDeGrupoOC('angulos', g, cosasDe('angulos', { dolor: lista('x'), dolor2: leida('y'), palabras: lista('z') })), { e: 'confirmar', dice: '1 por confirmar', tel: '1 por confirmar' }, '«Por confirmar: otro dolor» no entra en la línea');
  assert.equal(estadoDeGrupoOC('angulos', g, cosasDe('angulos', { dolor: lista('x'), dolor2: lista('y'), palabras: lista('z') })).e, 'listo');
});

test('se abre solo el primer grupo al que le falta algo; con todo completo, ninguno', () => {
  const todoLeido = Object.fromEntries(clavesOC('angulos').map((k) => [k, leida(k)]));
  assert.equal(grupoParaAbrirOC('angulos', cosasDe('angulos', { ...todoLeido, piden: vacia })), 'De dónde salen');
  assert.equal(grupoParaAbrirOC('angulos', cosasDe('angulos', todoLeido)), null);
});

test('una lectura nueva de MaKo NUNCA pisa lo que la persona confirmó; lo que estaba por confirmar sí se actualiza', () => {
  const g: GuardadoOC = { cosas: {
    dolor: { valor: 'Publicas y no vendes', estado: 'confirmada', fuente: { tipo: 'chat', texto: 'Lo dijiste en el chat' }, at: T },
    ganador: { valor: 'Viejo', estado: 'negocio', fuente: null, at: T },
  } };
  const r = fundirLecturaOC(g, { dolor: { valor: 'Otra cosa', fuente: null }, ganador: { valor: 'Trabaja con los founders', fuente: { tipo: 'anuncio', texto: '31 agendas' } }, piden: { valor: '   ', fuente: null } }, '2026-11-13T00:00:00.000Z');
  assert.equal(r.cosas.dolor.valor, 'Publicas y no vendes');
  assert.equal(r.cosas.dolor.estado, 'confirmada');
  assert.equal(r.cosas.ganador.valor, 'Trabaja con los founders');
  assert.equal(r.cosas.ganador.estado, 'negocio', 'lo leído entra por confirmar, nunca confirmado');
  assert.equal(r.cosas.piden, undefined, 'un valor vacío no se guarda');
  assert.equal(r.leidoAt, '2026-11-13T00:00:00.000Z');
});

test('marcar confirma lo leído, desmarcar lo deja por confirmar (no borra lo que sabe), y lo vacío no se marca', () => {
  const g: GuardadoOC = { cosas: { tono: { valor: 'Directo', estado: 'negocio', fuente: null, at: T } } };
  assert.equal(marcarOC(g, 'tono', true, T).cosas.tono.estado, 'confirmada');
  const des = marcarOC(marcarOC(g, 'tono', true, T), 'tono', false, T);
  assert.equal(des.cosas.tono.estado, 'negocio');
  assert.equal(des.cosas.tono.valor, 'Directo');
  assert.equal(marcarOC(g, 'origen', true, T), g, 'una vacía no se marca: primero se dice qué es');
});

test('lo que dice la persona queda confirmado, con el chat de fuente', () => {
  const r = decirOC({ cosas: {} }, 'palabras', '  «Publico todos los días y no me escribe nadie»  ', T);
  assert.equal(r.cosas.palabras.estado, 'confirmada');
  assert.equal(r.cosas.palabras.valor, '«Publico todos los días y no me escribe nadie»');
  assert.equal(r.cosas.palabras.fuente?.tipo, 'chat');
  assert.equal(decirOC({ cosas: {} }, 'palabras', '   ', T).cosas.palabras, undefined);
});

test('lo guardado se sanea: sólo claves del catálogo, estados válidos y la nota recalculada por el código', () => {
  const g = sanearGuardadoOC('voz', {
    cosas: { tono: { valor: 'Directo', estado: 'inventado', fuente: { tipo: 'chat', texto: 'x' } }, hackeo: { valor: 'x' }, casos: { valor: '' } },
    nota: { total: 99, criterios: [{ id: 'V1', nota: 14, porque: 'a' }, { id: 'V2', nota: 0, porque: 'b' }, { id: 'ZZ', nota: 5 }], lei: [] },
  });
  assert.deepEqual(Object.keys(g.cosas), ['tono']);
  assert.equal(g.cosas.tono.estado, 'negocio');
  assert.deepEqual(g.nota?.criterios.map((c) => c.nota), [10, 1], 'las notas van del 1 al 10');
  assert.equal(g.nota?.total, 55, 'el total lo calcula el código: (10 + 1) / 2 × 10, nunca el 99 que vino');
  assert.equal(totalNotaOC([{ nota: 8 }, { nota: 7 }, { nota: 2 }]), 57);
});

test('la respuesta de la IA: sólo lo encontrado, la fuente «chat» nunca la pone la IA, y sin los nueve criterios no vale', () => {
  const nueve = RUBRICA_OC.angulos.map((r, i) => ({ id: r.id, nota: i + 1, porque: `porque ${i}` }));
  const raw = '```json\n' + JSON.stringify({
    cosas: { dolor: { valor: 'Publicas y no vendes', fuente: 'llamada', de: '9 de tus 23 llamadas' }, ganador: { valor: 'Founders', fuente: 'chat', de: 'x' }, inventada: { valor: 'x' }, piden: { valor: '' } },
    criterios: nueve, lei: [{ titulo: 'Tu dolor', texto: 'Publicas y no vendes.' }],
  }) + '\n```';
  const r = parseLecturaOC('angulos', raw)!;
  assert.ok(r);
  assert.deepEqual(Object.keys(r.cosas).sort(), ['dolor', 'ganador']);
  assert.deepEqual(r.cosas.dolor.fuente, { tipo: 'llamada', texto: '9 de tus 23 llamadas' });
  assert.equal(r.cosas.ganador.fuente?.tipo, 'negocio', '«chat» es lo que dijo la persona, no lo que leyó MaKo');
  assert.equal(r.criterios.length, 9);
  assert.equal(parseLecturaOC('angulos', JSON.stringify({ cosas: {}, criterios: nueve.slice(0, 8) })), null, 'una nota a medias no sirve');
  assert.equal(parseLecturaOC('angulos', 'no es json'), null);
});

test('el prompt: nunca inventar, de nicho y nada viral, juzgar por agendas y no por vistas, y en español neutro', () => {
  const { system, user } = promptOC('angulos', '### SUS ANUNCIOS\n- «A»: 3 agendas');
  assert.match(system, /Sólo lo que está en el material/);
  assert.match(system, /nada viral/);
  assert.match(system, /NUNCA por vistas/);
  assert.match(system, /sin voseo/);
  for (const k of clavesOC('angulos')) assert.ok(user.includes(`- ${k} («`), `falta ${k} en el prompt`);
  assert.doesNotMatch(system + user, /\b(vos|tenés|querés|podés|acá)\b/i, 'voseo en el prompt');
});

// Probado rompiéndolo (12/11/2026):
//   · `fundirLecturaOC` sin el `continue` de lo confirmado → «Publicas y no vendes» pasaba a «Otra cosa»: rojo.
//   · `corto` con 40 en vez de 24 → la cabecera de «Cómo hablas» volvía a decir las dos palabras largas: rojo.
//   · `parseLecturaOC` aceptando la fuente «chat» → rojo en «la fuente chat nunca la pone la IA».
