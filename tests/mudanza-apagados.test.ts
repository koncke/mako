// =============================================================================
// Mudar un aviso a SuperAdmin no lo prende para todos: lo que nacía apagado se crea PAUSADO (17/10/2026)
// =============================================================================
// «Nada por detrás», lote 3. Un aviso del catálogo sin `porDefecto` nacía APAGADO en /mensajes (`estaPrendida`,
// lib/plantillas.ts), y un evento de la plataforma NO lee ese interruptor: lo decide su fila del ws 9. Medido el 17/10:
// ningún negocio tenía prendido `landing-cambio`, `lead-de-landing`, los dos de la prueba del Pixel, `lead-fusionado` ni
// `flow-puente-ausente`, o sea que no le llegaban a nadie, y la mudanza creaba su fila PRENDIDA: al desplegar, empezaban a
// llegarle a TODOS. Ahora la mudanza los crea pausados (y `--pausar` pausó los seis ya creados): el texto es editable en
// SuperAdmin y prenderlo es decisión de quien lo ve.
//
// PROBADO ROMPIÉNDOLO (17/10/2026, arnés `romper.py` + `roturas-apagados.json`; base 2 / 0). Pasan / fallan:
//   1. la mudanza vuelve a prender todo lo que crea                                → 1 / 1
//   2. «nacía apagado» se lee del evento y no del catálogo del aviso                 → 1 / 1
//
// Correr: node --import tsx --test tests/mudanza-apagados.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EVENTOS_MAKO } from '../lib/disparadores';
import { CATALOGO_AVISOS } from '../lib/avisos-catalogo';

const leer = (rel: string): string => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('la mudanza crea PAUSADO lo que nacía apagado, y sólo prende lo demás', () => {
  const src = leer('scripts/mudanza-avisos-plataforma.mts');
  assert.match(src, /const naciaApagado = \(evento: string\): boolean => \{\n\s+const aviso = EVENTOS_MAKO\.find\(\(e\) => e\.subtipo === evento\)\?\.aviso;\n\s+return !CATALOGO_AVISOS\.find\(\(a\) => a\.id === aviso\)\?\.porDefecto;/);
  const crear = src.slice(src.indexOf('const apagada = naciaApagado(m.evento);'));
  assert.ok(crear.length > 0);
  const i = crear.indexOf('if (apagada) continue;');
  const j = crear.indexOf('await setSecuenciaActiva(r.id, true);');
  assert.ok(i > 0 && i < j, 'prende sin preguntar si nacía apagado');
});

// Revisión del Cerebro (17/10/2026): sin `--eventos=`, MUDADOS es TODOS y `--pausar` pausaba también #260 (`oferta_lista`) y la
// fila de `meta_cuenta_recuperada`, prendidas a propósito. La guarda va ANTES de importar nada que toque la base.
// PROBADO ROMPIÉNDOLO: sin la guarda de `--pausar` → 2 / 1; sin la de `--eventos` sin «=» → 2 / 1.
test('`--pausar` exige la lista explícita de eventos, y `--eventos` sin «=» no cae en TODOS', () => {
  const src = leer('scripts/mudanza-avisos-plataforma.mts');
  const guardaPausar = src.indexOf("if (process.argv.includes('--pausar') && !pedidos) throw");
  const guardaIgual = src.indexOf("throw new Error('--eventos va con «=»: --eventos=a,b')");
  const primeraBase = src.indexOf("await import('../lib/workspace')");
  assert.ok(guardaPausar > 0, '--pausar sin --eventos= pausaría las filas prendidas a propósito');
  assert.ok(guardaIgual > 0, '--eventos a,b (sin «=») caería en TODOS');
  assert.ok(guardaPausar < primeraBase && guardaIgual < primeraBase, 'las guardas van antes de tocar la base');
});

test('los mudados que nacían apagados son los seis medidos el 17/10 (los demás nacían prendidos)', () => {
  const src = leer('scripts/mudanza-avisos-plataforma.mts');
  const mudados = [...src.matchAll(/\{ plantilla: '[^']+', evento: '([a-z_]+)' \}/g)].map((m) => m[1]);
  const apagados = mudados.filter((ev) => {
    const aviso = EVENTOS_MAKO.find((e) => e.subtipo === ev)?.aviso;
    return !CATALOGO_AVISOS.find((a) => a.id === aviso)?.porDefecto;
  });
  // `oferta_lista` y `meta_cuenta_recuperada` también nacían apagados, pero sus filas (#260 y la de la cuenta recuperada) se
  // prendieron A PROPÓSITO el 16/10, cuando se mudaron (la oferta lista es nueva; la recuperada es la contracara de la cuenta
  // frenada, que nace prendida). Existen, así que la mudanza no las toca; `--pausar` sólo pausa lo que se le nombra.
  assert.deepEqual(apagados.sort(), ['flow_puente_ausente', 'landing_cambio', 'lead_de_landing', 'lead_formulario_meta', 'lead_fusionado', 'meta_cuenta_recuperada', 'oferta_lista', 'prueba_grabada', 'prueba_recibida'].sort(),
    'un aviso nuevo que nacía apagado: su fila va pausada y entra en esta lista a sabiendas');
});
