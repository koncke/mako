// =============================================================================
// Con qué página e Instagram sale el anuncio: cuándo se pregunta y qué se valida
// =============================================================================
// Las opciones reales de ws13 (medidas el 2026-09-11) más casos con varias páginas,
// que ninguna conexión real tenía ese día para probar.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hayQuePreguntar, identidadPorDefecto, instagramsPara, validarIdentidad, type PaginaOpcion } from '../lib/meta-identidad';

const JOAN: PaginaOpcion = { id: '609876446197646', nombre: 'Joan', puedeAnunciar: true, instagram: { id: '17841457836922256', username: 'joandowd.gm' } };
const IG_CUENTA_WS13 = [{ id: '17841457836922256', username: 'joandowd.gm' }];
const AJENA: PaginaOpcion = { id: '770269612845316', nombre: 'Otra', puedeAnunciar: false, instagram: null };
const MARCA2: PaginaOpcion = { id: '111', nombre: 'Marca 2', puedeAnunciar: true, instagram: { id: '900', username: 'marca2' } };

test('ws13 tal como está: una página, un Instagram → no se pregunta nada', () => {
  assert.equal(hayQuePreguntar([JOAN], IG_CUENTA_WS13), false);
  // El Instagram de la página y el de la cuenta son el mismo: no se duplica.
  assert.equal(instagramsPara(JOAN, IG_CUENTA_WS13).length, 1);
  assert.deepEqual(identidadPorDefecto([JOAN], IG_CUENTA_WS13, JOAN.id), { pageId: JOAN.id, instagramId: '17841457836922256' });
  // Una página donde NO es anunciante no cuenta como opción ni hace preguntar.
  assert.equal(hayQuePreguntar([JOAN, AJENA], IG_CUENTA_WS13), false);
  //   ROTO A PROPÓSITO (2026-09-11): contando como opción la página sin ADVERTISE, pass 1 / fail 2
  //   — el wizard habría ofrecido publicar con la página que da 1885499.
});

test('con varias páginas usables se pregunta, y el default es la de la credencial', () => {
  assert.equal(hayQuePreguntar([JOAN, MARCA2], []), true);
  assert.deepEqual(identidadPorDefecto([JOAN, MARCA2], [], MARCA2.id), { pageId: '111', instagramId: '900' });
  // Si la de la credencial no se puede usar, cae a una usable — nunca a la ajena.
  assert.equal(identidadPorDefecto([AJENA, JOAN], [], AJENA.id)?.pageId, JOAN.id);
  assert.equal(identidadPorDefecto([AJENA], [], AJENA.id), null);
  // Una página con dos Instagram posibles también es una elección.
  assert.equal(hayQuePreguntar([JOAN], [{ id: '555', username: 'otro' }]), true);
});

test('lo que llega del navegador se valida contra la conexión', () => {
  assert.equal(validarIdentidad({ pageId: JOAN.id, instagramId: '17841457836922256' }, [JOAN], IG_CUENTA_WS13), null);
  assert.equal(validarIdentidad({ pageId: JOAN.id, instagramId: null }, [JOAN], IG_CUENTA_WS13), null); // sólo Facebook
  assert.match(validarIdentidad({ pageId: AJENA.id, instagramId: null }, [JOAN, AJENA], [])!, /no es anunciante en «Otra»/);
  assert.match(validarIdentidad({ pageId: '999', instagramId: null }, [JOAN], [])!, /no está en tu conexión/);
  assert.match(validarIdentidad({ pageId: JOAN.id, instagramId: '900' }, [JOAN, MARCA2], IG_CUENTA_WS13)!, /Instagram no está vinculada/);
  //   ROTO A PROPÓSITO (2026-09-11): sin validar el Instagram, pass 2 / fail 1.
});

test('la identidad elegida llega a todo lo que publica, y se valida antes de crear', () => {
  const leer = (f: string) => readFileSync(join(process.cwd(), f), 'utf8').replace(/\r/g, '');
  const lib = leer('lib/meta-ads-create.ts');
  // Instagram elegido manda, incluido «sólo Facebook».
  assert.match(lib, /if \(identidad\) return identidad\.instagramId;/);
  //   ROTO A PROPÓSITO (2026-09-11): sin esa línea el Instagram elegido se ignora y sale el
  //   primero que devuelve Meta — pass 3 / fail 1.
  // El creativo nuevo, el formulario y el objeto promocionado usan la página efectiva.
  assert.match(lib, /return \{ page_id: await paginaDe\(identidad\), video_data \};/);
  assert.match(lib, /return \{ page_id: await paginaDe\(identidad\) \};/);
  const ruta = leer('app/api/ads-manager/campaign-create/route.ts');
  assert.match(ruta, /validarIdentidad\(spec\.identidad/);
  assert.match(ruta, /createAdCreative\(ad\.creative, ad\.name, spec\.identidad\)/);
});
