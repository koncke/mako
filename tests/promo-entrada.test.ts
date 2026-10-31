// =============================================================================
// El 50% del primer mes con reloj: el reloj no miente, y apagado no promete nada
// =============================================================================
// Roturas: que vencida vuelva a empezar → 1 fallo. Aceptar una cookie tocada → 1 fallo. Arrancar el reloj con la promo apagada → 1 fallo.
// Sacar `#precios` del cartel → 1 fallo. Volver a un `position: fixed` → 1 fallo (tapa el botón de comprar en el teléfono).
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { abrirPromo, firmarVencimiento, leerVencimiento, promoVigente } from '../lib/promo-entrada';
import { PROMO_ENTRADA, precioPrimerMes, textoReloj, textoUsd } from '../lib/promo-entrada-reglas';
import { esPublica, esPublicaDeEscritura } from '../lib/rutas-publicas';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const PRENDIDA = { prendida: true, secreto: 'secreto-de-prueba' };
const DIEZ = PROMO_ENTRADA.minutos * 60_000;
const T0 = 1_800_000_000_000;

test('la primera visita arranca el reloj; recargar sigue por donde iba', () => {
  const a = abrirPromo(null, T0, PRENDIDA);
  assert.deepEqual(a.estado, { hay: true, restanteMs: DIEZ });
  assert.ok(a.cookieNueva);
  const b = abrirPromo(a.cookieNueva, T0 + 60_000, PRENDIDA);
  assert.deepEqual(b.estado, { hay: true, restanteMs: DIEZ - 60_000 });
  assert.equal(b.cookieNueva, null, 'recargar no le da un reloj nuevo');
});

test('en cero se terminó: no reaparece al recargar, ni después', () => {
  const { cookieNueva } = abrirPromo(null, T0, PRENDIDA);
  assert.deepEqual(abrirPromo(cookieNueva, T0 + DIEZ, PRENDIDA).estado, { hay: false });
  const unMes = abrirPromo(cookieNueva, T0 + 30 * 86_400_000, PRENDIDA);
  assert.deepEqual(unMes.estado, { hay: false });
  assert.equal(unMes.cookieNueva, null);
  assert.equal(promoVigente(cookieNueva, T0 + DIEZ, PRENDIDA), false, 'el cobro tampoco la acepta');
  assert.equal(promoVigente(cookieNueva, T0 + DIEZ - 1, PRENDIDA), true);
});

test('una cookie tocada no vale: ni estirar el reloj, ni otra firma', () => {
  const c = firmarVencimiento(T0, PRENDIDA.secreto);
  assert.equal(leerVencimiento(c, PRENDIDA.secreto), T0);
  assert.equal(leerVencimiento(c.replace(String(T0), String(T0 + DIEZ)), PRENDIDA.secreto), null);
  assert.equal(leerVencimiento(firmarVencimiento(T0, 'otro'), PRENDIDA.secreto), null);
  assert.equal(leerVencimiento('basura', PRENDIDA.secreto), null);
  assert.equal(promoVigente(c.replace(String(T0), String(T0 + DIEZ)), T0, PRENDIDA), false);
});

test('apagada no promete nada: sin cartel, sin reloj corriendo, y el cobro dice que no', () => {
  const apagada = { prendida: false, secreto: 'x' };
  assert.deepEqual(abrirPromo(null, T0, apagada), { estado: { hay: false }, cookieNueva: null });
  assert.equal(promoVigente(firmarVencimiento(T0 + DIEZ, 'x'), T0, apagada), false);
  assert.deepEqual(abrirPromo(null, T0, { prendida: true, secreto: undefined }), { estado: { hay: false }, cookieNueva: null });
});

test('lo que dice el cartel', () => {
  assert.equal(textoUsd(precioPrimerMes(47)), '23,50');
  assert.equal(textoUsd(precioPrimerMes(97)), '48,50');
  assert.equal(textoReloj(DIEZ), '10:00');
  assert.equal(textoReloj(61_000), '01:01');
  assert.equal(textoReloj(1), '00:01');
  assert.equal(textoReloj(-5), '00:00');
  assert.deepEqual([...PROMO_ENTRADA.planes], ['esencial', 'pro']);
});

test('la ruta es pública, escribe sólo su cookie, y el cartel no tapa el botón de comprar', () => {
  assert.ok(esPublica('/api/promo-entrada'));
  assert.ok(esPublicaDeEscritura('/api/promo-entrada'));
  const ruta = leer('app/api/promo-entrada/route.ts');
  assert.match(ruta, /HttpOnly; SameSite=Lax/);
  assert.match(ruta, /new URL\(origen\)\.host === req\.headers\.get\('host'\)/);
  assert.doesNotMatch(ruta, /supabase|getUsuarioActual/);
  const cartel = leer('app/vsl/CartelPromo.tsx');
  assert.match(cartel, /position: sticky/);
  assert.doesNotMatch(cartel, /position: fixed/);
  assert.match(cartel, /href="#precios"/);
  assert.match(cartel, /después, el precio de siempre/);
  assert.match(leer('app/vsl/Landing.tsx'), /<CartelPromo planes=\{planes\} \/>/);
  assert.match(leer('app/vsl/PreciosLanding.tsx'), /id="precios"/);
});
