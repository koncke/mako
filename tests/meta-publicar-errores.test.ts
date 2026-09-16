// =============================================================================
// Por qué Meta no dejó publicar: los tres rechazos reproducidos en ws13
// =============================================================================
// Los subcodes y los casos salen de la reproducción del 2026-09-11 (ver la cabecera
// de lib/meta-publicar-errores.ts). Lo que se fija acá es que cada rechazo diga de
// QUIÉN es y QUÉ HACER, y que las guardas que evitan llegar a él estén puestas.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { explicarRechazoPublicacion, SUB_APP_EN_DESARROLLO, SUB_FALTA_ORIGEN_CONVERSION, SUB_SIN_PERMISO_PAGINA } from '../lib/meta-publicar-errores';

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r/g, '');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('cada rechazo nombra a Meta primero, dice que no es de MaKo y da la salida', () => {
  const pagina = explicarRechazoPublicacion(SUB_SIN_PERMISO_PAGINA)!;
  assert.match(pagina, /^Meta rechazó el anuncio: usa un post de otra página/);
  assert.match(pagina, /No es un error de MaKo/);
  assert.match(pagina, /Elige un ganador de tu propia página/);
  //   ROTO A PROPÓSITO (2026-09-11): sin traducir el 1885499 la función devuelve null y
  //   este test cae — pass 1 / fail 1. Quedaba el texto crudo de Meta que vio el cliente.

  // ⚠️ El 1885183 NUNCA le pide al cliente que publique su app (regla de Martín, 16/09):
  // mandarlo a developers.facebook.com a cambiarle el modo a una app es pedirle que haga de
  // programador para usar MaKo. Lo que se fija acá es la PROHIBICIÓN, no la redacción.
  //   ROTO A PROPÓSITO (2026-09-16): devolviendo el copy viejo («pasar esa app a modo
  //   público en developers.facebook.com»), pass 1 / fail 1.
  const app = explicarRechazoPublicacion(SUB_APP_EN_DESARROLLO)!;
  assert.match(app, /^Meta rechazó el anuncio/);
  assert.match(app, /No es un error de MaKo/);
  assert.doesNotMatch(app, /developers\.facebook|modo p(ú|u)blico|«Live»|publicar (esa|tu) app|modo de desarrollo/i);
  assert.doesNotMatch(app, /app/i, 'ni siquiera nombrarle la app: nombrarla invita a ir a tocarla');

  // El del pixel sólo se traduce cuando SÍ es el caso medido: ganador + formulario.
  assert.match(explicarRechazoPublicacion(SUB_FALTA_ORIGEN_CONVERSION, { reusaGanador: true, pideFormulario: true })!, /sube el creativo/);
  assert.equal(explicarRechazoPublicacion(SUB_FALTA_ORIGEN_CONVERSION, { reusaGanador: false, pideFormulario: true }), null);
  assert.equal(explicarRechazoPublicacion(123456), null);
  assert.equal(explicarRechazoPublicacion(undefined), null);
});

test('publicar usa la traducción, y el wizard no deja llegar a los rechazos que puede ver', () => {
  const ruta = sinComentarios(leer('app/api/ads-manager/campaign-create/route.ts'));
  assert.match(ruta, /explicarRechazoPublicacion\(/);

  const modal = sinComentarios(leer('app/ads-manager/NuevaCampanaModal.tsx'));
  // Formulario + ganador reusado no avanza (1487888 medido).
  assert.match(modal, /pideForm && usables\(\)\.some\(\(t\) => t\.kind === 'existing'\)\) return false/);
  //   ROTO A PROPÓSITO (2026-09-11): sacando la guarda del paso de destino, pass 1 / fail 1.
  // Los ganadores de páginas donde la conexión no es anunciante no se pueden agregar (1885499).
  assert.match(modal, /if \(ganadoresBloqueados\?\.\[s\.ad_id\]\) return;/);

  // Meta v25 exige este campo al crear una campaña SIN presupuesto de campaña (medido).
  assert.match(sinComentarios(leer('lib/meta-ads-create.ts')), /is_adset_budget_sharing_enabled/);
});
