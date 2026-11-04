// WhatsApp baneó la línea de MaKo (el …2605, 03/11/2026) y Martín pidió seguir por su número, con un botón para apagarlo. Su
// número es una línea de NEGOCIO (`mako_ws9`), y ahí un `fromMe` es MaKo O él escribiendo desde el teléfono: tirarlos todos por
// eco dejaba a MaKo sorda con el dueño. El anillo es el que separa, y el canal no se toca: «Desconectar» borra su línea.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { esEcoDeMaKo, vozPropiaDeMaKo } from '../lib/doer-para-quien';

const leer = (p: string) => readFileSync(p, 'utf8');
const base = { fromMe: true, msgId: 'ABC', enviados: [] as string[] };
const eco = (instancia: string, voz: string, enviados: string[] = []) =>
  esEcoDeMaKo({ ...base, instancia, voz: vozPropiaDeMaKo(voz), enviados });

test('con la voz en una línea de negocio, lo que no está en el anillo es el dueño escribiendo', () => {
  assert.equal(eco('mako_ws9', 'mako_ws9'), false);
  assert.equal(eco('mako_ws13_7ny3qw', 'mako_ws13_7ny3qw'), false);
});

test('con la voz en una línea de negocio, lo que MaKo mandó sigue siendo eco', () => {
  assert.equal(eco('mako_ws9', 'mako_ws9', ['ABC']), true);
});

test('con la voz en la línea de MaKo, todo fromMe sigue siendo ella', () => {
  assert.equal(eco('mako_superadmin_x', 'mako_superadmin_x'), true);
  assert.equal(eco('mako_superadmin', 'mako_superadmin'), true);
  assert.equal(vozPropiaDeMaKo(null), null);
});

test('el botón mueve la voz y NUNCA el canal: «Desconectar» borraría el WhatsApp personal', () => {
  const canal = leer('lib/mako-canal.ts');
  const f = canal.slice(canal.indexOf('export async function usarNumeroPersonalComoVoz'));
  assert.ok(f.length > 0);
  assert.match(f, /setInstanciaVoz\(personal\.linea\)/);
  assert.match(f, /setInstanciaVoz\(canal\)/);
  assert.doesNotMatch(f, /KEY_CANAL_INSTANCIA|cambiarSettingSi/);
});

test('al prender le abre los grupos a la línea, y al apagar se los vuelve a cerrar', () => {
  const canal = leer('lib/mako-canal.ts');
  const f = canal.slice(canal.indexOf('export async function usarNumeroPersonalComoVoz'));
  assert.ok(f.indexOf('permitirGruposEnInstancia(personal.linea)') < f.indexOf('setInstanciaVoz(personal.linea)'), 'la voz no puede quedar sorda');
  assert.match(f, /permitirGruposEnInstancia\(personal\.linea, false\)/);
  assert.match(leer('lib/evolution.ts'), /groupsIgnore: !permitir/);
});

test('con la voz en el negocio, la plataforma no manda por el canal caído', () => {
  const p = leer('lib/linea-plataforma.ts');
  const f = p.slice(p.indexOf('export async function lineaDeMaKoPara'));
  assert.match(f, /if \(voz && !esLineaDeMaKo\(voz\)\) return null;/);
});

test('el panel tiene el botón y sólo un admin lo puede tocar', () => {
  const ruta = leer('app/api/admin/mako-canal/route.ts');
  const post = ruta.slice(ruta.indexOf('export async function POST'));
  assert.ok(post.indexOf('getSesionAdmin') > 0 && post.indexOf('getSesionAdmin') < post.indexOf("case 'voz-personal':"));
  const panel = leer('app/agencia/CanalMaKoPanel.tsx');
  assert.match(panel, /action: 'voz-personal', activar/);
  assert.match(panel, /!personal\?\.esVoz && !autoVozRef\.current/, 'el panel le sacaba la voz sola al abrirse');
});
