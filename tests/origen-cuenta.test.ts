// =============================================================================
// El ORIGEN de una cuenta de MaKo (lib/origen-cuenta.ts): de qué landing / funnel vino
// =============================================================================
// Pedido (23/10/2026): «Cuando la persona se registra o paga en MaKo, ese origen queda guardado en su cuenta,
// para que el onboarding sepa de qué funnel vino». Lo que fija este test:
//   · el slug de una landing de MaKo sale de la URL de la visita (hola-mako.com/, /vsl/<slug>, hola-mako.site);
//   · la landing es la de la PRIMERA visita (el primer toque), aunque las visitas lleguen desordenadas;
//   · las UTM del lead mandan; si no las trae, las de esa primera visita; lo que no se sabe es null, nunca inventado;
//   · lo guardado se vuelve a leer validado (un avatar que no es de la lista no pasa).
// Probado rompiéndolo (23/10/2026): sin el `sort` de `origenDe` falla 1 de 6 («el primer toque»: sale 'coaches').
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANDINGS_MAKO, leerOrigen, origenDe, slugDeLandingMako } from '../lib/origen-cuenta';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Los slugs que sube scripts/landings-mako-funnels.mts (las claves de su COPY): el script corre al importarlo.
const fuente = readFileSync(join(__dirname, '..', 'scripts', 'landings-mako-funnels.mts'), 'utf8');
const COPY_SLUGS = [...fuente.slice(fuente.indexOf('export const COPY'), fuente.indexOf('const esc =')).matchAll(/^  '?([a-z0-9-]+)'?: {$/gm)].map((m) => m[1]);

test('el slug sale de la URL de la visita', () => {
  assert.equal(slugDeLandingMako('https://hola-mako.com/?utm_source=meta'), 'principal');
  assert.equal(slugDeLandingMako('https://www.hola-mako.com/'), 'principal');
  assert.equal(slugDeLandingMako('https://hola-mako.com/vsl/inmobiliarias?utm_campaign=x'), 'inmobiliarias');
  assert.equal(slugDeLandingMako('https://hola-mako.site/coaches'), 'coaches');
  assert.equal(slugDeLandingMako('https://hola-mako.site/hola-mako'), 'principal');
  assert.equal(slugDeLandingMako('https://hola-mako.com/crm'), null);
  assert.equal(slugDeLandingMako('https://otra.com/vsl/coaches'), null);
  assert.equal(slugDeLandingMako('no es una url'), null);
});

test('las 24 de funcionalidad viejas, no', () => {
  assert.equal(slugDeLandingMako('https://hola-mako.com/vsl/crm'), null);
});

test('el primer toque: la landing de la primera visita, aunque lleguen desordenadas', () => {
  const o = origenDe({ id: 7, visitor_id: 'v-1' }, [
    { landing_url: 'https://hola-mako.com/vsl/coaches?utm_source=ig', created_at: '2026-10-24T10:00:00Z' },
    { landing_url: 'https://hola-mako.com/vsl/inmobiliarias?utm_source=meta&utm_campaign=c1', created_at: '2026-10-23T10:00:00Z' },
  ], '2026-10-25T00:00:00Z');
  assert.equal(o.landing, 'inmobiliarias');
  assert.equal(o.avatar, 'inmobiliarias');
  assert.equal(o.funcionalidad, null);
  assert.deepEqual(o.utm, { source: 'meta', medium: null, campaign: 'c1', content: null }, 'sin UTM en el lead, las de esa visita');
  assert.equal(o.visitorId, 'v-1');
  assert.equal(o.leadId, 7);
});

test('las UTM del lead mandan, y sin visitas la página de registro', () => {
  const o = origenDe({ id: 8, utm_source: 'meta', utm_campaign: 'ads-1', pagina_registro: 'https://hola-mako.com/vsl/automatizaciones' }, [], 'x');
  assert.equal(o.landing, 'automatizaciones');
  assert.equal(o.funcionalidad, 'automatizaciones');
  assert.equal(o.utm.source, 'meta');
  assert.equal(o.utm.campaign, 'ads-1');
  const nada = origenDe({ id: 9 }, [], 'x');
  assert.equal(nada.landing, null);
  assert.equal(nada.visitorId, null);
});

test('lo guardado se lee validado', () => {
  const o = origenDe({ id: 1, utm_source: 'meta' }, [{ landing_url: 'https://hola-mako.com/', created_at: '1' }], '2026-10-23T00:00:00Z');
  assert.deepEqual(leerOrigen(JSON.stringify(o)), o);
  assert.equal(leerOrigen(JSON.stringify({ ...o, avatar: 'astronautas' }))?.avatar, null);
  assert.equal(leerOrigen('{'), null);
  assert.equal(leerOrigen(null), null);
});

test('cada landing de las que se suben tiene su origen en la lista', () => {
  assert.equal(COPY_SLUGS.length, 8, COPY_SLUGS.join(','));
  for (const slug of COPY_SLUGS) assert.ok(LANDINGS_MAKO[slug], `${slug} no está en LANDINGS_MAKO`);
});
