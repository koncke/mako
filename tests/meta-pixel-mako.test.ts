// =============================================================================
// El píxel de Meta de MaKo en su propia landing (08/10/2026)
// =============================================================================
// Dos reglas que, si se rompen, no dan error: ensucian los datos con los que Meta
// optimiza los anuncios de MaKo. (1) Sólo se mide en el dominio de producción; un
// preview de Vercel o localhost meterían visitas de prueba en las audiencias. (2) Una
// agenda cuenta sólo si el mensaje viene de Calendly; un `message` lo manda
// cualquier iframe, y un Schedule falso le enseña a Meta a buscar a quien no agendó.
//
// Verificado rompiéndolo (08/10/2026), de a una y restaurando de memoria:
//   · debeMedir devolviendo true siempre                       → 1 fallo
//   · esAgendaDeCalendly sin comparar el origen                → 1 fallo
//   · Landing cargando el píxel sin el if (debeMedir(...))     → 1 fallo
//   · Landing sin el guard de un solo Schedule (agendo)        → 1 fallo

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { debeMedir, esAgendaDeCalendly, PIXEL_META_MAKO } from '../lib/meta-pixel-mako';

const sinComentarios = (src: string) => src
  .replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

test('sólo mide en el dominio de producción', () => {
  assert.equal(debeMedir('hola-mako.com'), true);
  assert.equal(debeMedir('www.hola-mako.com'), true);
  assert.equal(debeMedir('HOLA-MAKO.COM'), true);
  for (const h of ['localhost', '127.0.0.1', 'mako-abc123-mbustos.vercel.app', 'hola-mako.com.evil.tld', 'evilhola-mako.com']) {
    assert.equal(debeMedir(h), false, `midió en ${h}`);
  }
});

test('una agenda cuenta sólo si viene de Calendly y es la de agendar', () => {
  const ok = { event: 'calendly.event_scheduled', payload: {} };
  assert.equal(esAgendaDeCalendly('https://calendly.com', ok), true);
  assert.equal(esAgendaDeCalendly('https://evil.tld', ok), false);
  assert.equal(esAgendaDeCalendly('https://calendly.com.evil.tld', ok), false);
  assert.equal(esAgendaDeCalendly('https://calendly.com', { event: 'calendly.page_height' }), false);
  assert.equal(esAgendaDeCalendly('https://calendly.com', 'calendly.event_scheduled'), false);
  assert.equal(esAgendaDeCalendly('https://calendly.com', null), false);
});

test('el ID es el del conjunto de datos «MaKo» del portafolio de MaKo', () => {
  assert.equal(PIXEL_META_MAKO, '1869323014511830');
});

test('la landing carga el píxel sólo detrás de debeMedir, y manda un solo Schedule', () => {
  const src = sinComentarios(readFileSync(join(process.cwd(), 'app/vsl/Landing.tsx'), 'utf8'));
  const ini = src.indexOf('if (debeMedir(window.location.hostname))');
  assert.ok(ini > 0, 'el píxel tiene que cargarse detrás de debeMedir');
  const bloque = src.slice(ini, src.indexOf('return () => cleanup.forEach', ini));
  assert.ok(bloque.length > 0 && bloque.length < 1500, `el recorte mide ${bloque.length}`);
  assert.match(bloque, /cargarPixelMeta\(\)/);
  assert.match(bloque, /if \(agendo \|\| !esAgendaDeCalendly\(e\.origin, e\.data\)\) return;/);
  // Y fuera de ese bloque nadie carga el píxel. La regex salta la DEFINICIÓN
  // («function cargarPixelMeta(): Fbq»), que la primera versión contaba como llamada.
  const fuera = src.slice(0, ini) + src.slice(ini + bloque.length);
  assert.equal((fuera.match(/(?<!function )cargarPixelMeta\(\)(?!:)/g) || []).length, 0, 'cargarPixelMeta llamado fuera del guard');
});
