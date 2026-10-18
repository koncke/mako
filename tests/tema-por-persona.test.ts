// =============================================================================
// El claro/oscuro de cada persona en la computadora (17/10/2026, tarjeta #883)
// =============================================================================
// «Que cada persona elija tema claro u oscuro en la computadora (hoy sólo en el teléfono) y que todas las pantallas lo
// respeten». Claro por defecto (Martín: «por defecto es white mode»; el onboarding claro «como todo»).
//
// Lo que se fija:
//   · el script del primer pintado pone el oscuro SÓLO si la persona lo eligió, nunca por el sistema, y nunca en una
//     página pública (se CORRE, en un documento de mentira, no se lee como texto);
//   · el taller de paletas del super admin ya no le borra el modo a nadie;
//   · el interruptor está en la barra, y el layout monta el arranque antes del taller.
//
// Probado ROMPIÉNDOLO, de a uno, con la base en 5 pases y 0 fallos (números en el pie del archivo).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MODO_ANTES_DE_PINTAR } from '../app/_components/ModoArranque';
import { isPublicLandingPath } from '../app/_components/PublicRouteGate';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** Corre el script como lo correría el navegador, con lo que haya guardado y en esa ruta. */
function correr(guardado: string | null, ruta: string, sistemaOscuro = false): string | null {
  const attrs = new Map<string, string>();
  const documento = { documentElement: { setAttribute: (k: string, v: string) => attrs.set(k, v) } };
  const almacen = { getItem: (k: string) => (k === 'mako.modo' ? guardado : null) };
  const matchMedia = () => ({ matches: sistemaOscuro });
  new Function('document', 'localStorage', 'location', 'matchMedia', MODO_ANTES_DE_PINTAR)(documento, almacen, { pathname: ruta }, matchMedia);
  return attrs.get('data-tema') ?? null;
}

test('oscuro SÓLO si la persona lo eligió: sin elección, claro, aunque el sistema esté en oscuro', () => {
  assert.equal(correr('oscuro', '/crm'), 'oscuro');
  assert.equal(correr('claro', '/crm'), null);
  assert.equal(correr(null, '/crm', true), null, 'siguió al sistema: un cliente nuevo con Windows en oscuro abría MaKo en oscuro');
  assert.equal(correr('oscuro', '/general?ws=3'.split('?')[0]), 'oscuro');
});

test('nunca en una página pública: las mismas que no llevan la barra', () => {
  for (const ruta of ['/', '/vsl', '/vsl/estrategia', '/compartido', '/compartido/abc', '/mi-curso', '/pagar/tok123', '/crm', '/chats', '/vslx', '/compartidos']) {
    const publica = isPublicLandingPath(ruta);
    assert.equal(correr('oscuro', ruta) === null, publica, `${ruta}: ${publica ? 'pública pintada en oscuro' : 'de la app sin el oscuro elegido'}`);
  }
});

test('el taller de paletas del super admin ya no le borra el modo a nadie', () => {
  const t = sinComentarios(leer('app/_components/TemaCandidato.tsx'));
  assert.doesNotMatch(t, /removeAttribute\(ATTR_MODO\)|removeAttribute\('\$\{ATTR_MODO\}'\)/, 'el taller vuelve a apagar el oscuro elegido');
  assert.doesNotMatch(t, /removeItem\(LS_MODO\)/, 'sacar un tema borra la elección de la persona');
  // Y el interruptor arranca en claro sin elección (no en el del sistema).
  const i = sinComentarios(leer('app/_components/InterruptorModo.tsx'));
  assert.doesNotMatch(i, /prefers-color-scheme/, 'el interruptor vuelve a seguir al sistema');
});

test('el layout monta el arranque ANTES del taller, sólo con sesión, y la barra tiene el interruptor', () => {
  const l = sinComentarios(leer('app/layout.tsx'));
  const arranque = l.indexOf('{sesion && <ModoArranque />}');
  assert.ok(arranque > 0, 'el layout no aplica la elección');
  assert.ok(arranque < l.indexOf('{esAdmin && <TemaCandidato />}'), 'el arranque va antes del taller');
  assert.match(l, /\{sesion && <ModoDelUsuario \/>\}/, 'sin la mitad de cliente, navegar pierde el oscuro');
  assert.match(sinComentarios(leer('app/_components/Sidebar.tsx')), /\{open && <InterruptorModo compacto \/>\}/, 'la barra no tiene el interruptor');
});

test('un solo template literal (el minificador se come el texto entre dos)', () => {
  const src = sinComentarios(leer('app/_components/ModoArranque.tsx'));
  const decl = src.slice(src.indexOf('export const MODO_ANTES_DE_PINTAR'), src.indexOf('export function ModoArranque'));
  assert.equal((decl.match(/`/g) ?? []).length, 2, 'el script está partido en varios templates');
  assert.doesNotMatch(decl, /`\s*\+|\+\s*`/);
});

// Rompiéndolo (17/10/2026), base 5 / 0:
//   · el script sigue a matchMedia sin elección                                 → 4 / 1
//   · el script sin el corte de las páginas públicas                            → 4 / 1
//   · TemaCandidato vuelve a removeAttribute(ATTR_MODO) en su efecto            → 4 / 1
//   · el layout sin <ModoDelUsuario />                                          → 4 / 1
//   · el script partido en dos templates con +                                  → 4 / 1
