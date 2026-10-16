// =============================================================================
// El comportamiento del Diagnóstico reconoce una landing con la dirección de antes y la de hoy
// =============================================================================
// Integración de la tanda 4 (14/10/2026): las landings del editor se mudaron a hola-mako.site. El
// Pixel manda desde entonces `hola-mako.site/<slug>` (`location.href`), y una landing analizada o
// medida ANTES dice `hola-mako.com/l/<slug>`. `getComportamiento` (lib/landing-analyst.ts, server-only)
// comparaba por igualdad: el Diagnóstico decía «sin datos» (y la IA analizaba creyendo que nadie la
// vio) y las dos bases contaban como OTRA landing en `visitantes_compartidos`. Todo sin un error.
//
// La decisión vive en `visitasDeLaLanding` (lib/landing-url.ts, sin server-only): acá se EJECUTA, y
// se mira que `getComportamiento` la use (es server-only: se lee su fuente sin comentarios).
//
// PROBADO ROMPIÉNDOLO (14/10/2026), base 2 / 0, restaurado de memoria (sha256 igual):
//   · `mias` por igualdad (sin urlLandingVigente)                     → 1 / 1
//   · `compartidos` comparando sin urlLandingVigente                   → 1 / 1
//   · getComportamiento con su filtro propio (sin visitasDeLaLanding)  → 1 / 1
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { claveDeLanding, visitasDeLaLanding } from '../lib/landing-url';

const RAIZ = join(__dirname, '..');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

type V = { visitor_id: string; landing_url: string | null };
const v = (visitor_id: string, landing_url: string | null): V => ({ visitor_id, landing_url });

test('las visitas de una landing del editor: la dirección de antes y la de hoy son la MISMA landing', () => {
  const visitas = [
    v('a', 'https://hola-mako.com/l/mi-oferta?utm_source=fb'), // medida antes de la mudanza
    v('b', 'https://hola-mako.site/mi-oferta?fbclid=1'), // la de hoy
    v('a', 'https://hola-mako.site/mi-oferta'), // la misma persona, después: NO es «otra landing»
    v('c', 'https://hola-mako.site/otra'),
    v('d', null),
  ];
  for (const analizada of ['https://hola-mako.com/l/mi-oferta', 'https://hola-mako.site/mi-oferta']) {
    const r = visitasDeLaLanding(visitas, claveDeLanding(analizada));
    assert.deepEqual(r.mias.map((x) => x.visitor_id), ['a', 'b', 'a'], analizada);
    assert.equal(r.compartidos, false, `${analizada}: las dos bases de la misma landing no son «otra landing»`);
  }
  // El control: quien SÍ vio otra landing se dice.
  const conOtra = visitasDeLaLanding([...visitas, v('b', 'https://hola-mako.site/otra')], claveDeLanding('https://hola-mako.site/mi-oferta'));
  assert.equal(conOtra.compartidos, true);
  // Lo que no es de MaKo no se traduce: el `/l/` de un cliente es otra página.
  assert.deepEqual(visitasDeLaLanding([v('e', 'https://tunegocio.com/l/mi-oferta')], claveDeLanding('https://hola-mako.site/mi-oferta')).mias, []);
});

test('getComportamiento decide sus visitas con visitasDeLaLanding (no con una igualdad propia)', () => {
  const src = sinComentarios(readFileSync(join(RAIZ, 'lib/landing-analyst.ts'), 'utf8').replace(/\r\n/g, '\n'));
  const i = src.indexOf('export async function getComportamiento');
  const cuerpo = src.slice(i, src.indexOf('\nexport ', i + 10));
  assert.ok(i >= 0 && cuerpo.length > 300, 'no encuentro getComportamiento');
  assert.match(cuerpo, /const \{ mias, compartidos \} = visitasDeLaLanding\(visitas, url\);/);
  assert.doesNotMatch(cuerpo, /landing_url\) === url|u !== url/, 'volvió la igualdad de antes de la mudanza');
});
