// =============================================================================
// «Vista previa del link»: YA NO está en Configuraciones; se saca en el mensaje, con la X de su tarjeta (23/10/2026)
// =============================================================================
// Historia: el interruptor estaba suelto debajo del chat de cada WhatsApp (#869, lo pidió Mauricio: «es más discreto»);
// por la mañana del 23/10 pasó a una fila de Configuraciones › WhatsApp (`sinVistaPrevia` de la automatización). Después,
// Martín (23/10/2026): «Elimina "Vista previa del link", eso no se debe configurar en Configuraciones... Sino en la tarjeta
// de WhatsApp o donde haya pegado el link, simplemente sacándolo como se hace en WhatsApp, que te sale la tarjeta con una
// X para sacarla». Quedó así:
//   · la fila, `sinVistaPrevia` de la automatización y `sinVistaPreviaDe` se fueron (lo guardado se ignora al leer);
//   · la vista previa vuelve a ser SÓLO la de cada mensaje (`sin_vista_previa` del paso, que el motor ya honraba);
//   · en el editor del WhatsApp, con un link, se ve su tarjeta (`VistaPreviaDelLink`); la X pone `sin_vista_previa: true`.
// Este archivo fija que no vuelva a Configuraciones y que el editor la tenga.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as cfg from '../lib/config-automatizacion';
import { configParaGuardar, sanearConfigAutomatizacion, tieneConfigPropia } from '../lib/config-automatizacion';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('el dato ya no existe: no se guarda, y lo que quedó guardado se ignora al leer', () => {
  // Pedir guardarla o sacarla da error (un escritor viejo se entera en vez de creer que quedó).
  for (const v of [true, null, false]) {
    const r = configParaGuardar({}, { sinVistaPrevia: v });
    assert.equal(r.ok, false, `guardar sinVistaPrevia: ${String(v)} tendría que dar error`);
    assert.match(!r.ok ? r.error : '', /vista previa de un link se saca en el mensaje/);
  }
  // Lo guardado antes (ninguna automatización lo tenía, medido el 23/10) se ignora y no cuenta como «algo propio».
  assert.deepEqual(sanearConfigAutomatizacion('{"sinVistaPrevia":true}'), {});
  assert.deepEqual(sanearConfigAutomatizacion('{"sinVistaPrevia":true,"goteo":{"minutos":5}}'), { goteo: { minutos: 5 } });
  assert.equal(tieneConfigPropia({ sinVistaPrevia: true } as never), false, 'una clave vieja no puede dejar la configuración «con algo propio»');
});

test('la función `sinVistaPreviaDe` se fue: lo del mensaje es lo único que vale', () => {
  assert.equal('sinVistaPreviaDe' in cfg, false, 'volvió el «o lo de la automatización»');
  assert.doesNotMatch(leer('lib/config-automatizacion.ts'), /sinVistaPreviaDe|sinVistaPrevia\?: true/);
});

test('el motor y el recordatorio usan SÓLO lo del mensaje, sin leer la configuración de la automatización', () => {
  const motor = leer('lib/nutricion.ts');
  assert.match(motor, /const sinTarjeta = sinVistaPrevia\(paso\);/);
  assert.match(motor, /const sinTarjeta = sinVistaPrevia\(p\);/);
  assert.doesNotMatch(motor, /sinVistaPreviaDe/);
  const recordatorio = leer('lib/reunion-recordatorio.ts');
  assert.match(recordatorio, /sinVistaPrevia: t\.sinVistaPrevia === true \}\)/);
  assert.doesNotMatch(recordatorio, /sinVistaPreviaDe|configsDelNegocio/, 'el recordatorio volvió a leer las configuraciones por la vista previa');
});

test('la pantalla de Configuraciones ya no tiene «Vista previa del link»', () => {
  const panel = leer('app/automations/ConfigAutomatizacionPanel.tsx');
  assert.doesNotMatch(panel.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''), /Vista previa del link|data-vista-previa-config|filaVistaPrevia|sinVistaPrevia/);
  assert.doesNotMatch(leer('app/automations/config-automatizacion-actions.ts'), /sinVistaPrevia/);
});

test('el editor del WhatsApp muestra la tarjeta del link con su X, y la X pone `sin_vista_previa: true` en ESE mensaje', () => {
  const lienzo = leer('app/automations/FlujoLienzo.tsx');
  assert.match(lienzo, /import \{ sinVistaPrevia, primerLink \} from '@\/lib\/mensaje-partes';/);
  // Sólo en el WhatsApp no oficial (el oficial es una plantilla de Meta y no arma tarjeta).
  assert.match(lienzo, /\{noOficial && <VistaPreviaDelLink paso=\{paso\} cambiar=\{cambiar\} \/>\}/);
  const cuerpo = lienzo.slice(lienzo.indexOf('function VistaPreviaDelLink('), lienzo.indexOf('function VistaPreviaDelLink(') + 3500);
  assert.match(cuerpo, /const link = primerLink\(paso\);/);
  assert.match(cuerpo, /if \(!link \|\| sacada\) return null;/, 'sin link, o ya sacada, no se dibuja nada');
  assert.match(cuerpo, /aria-label="Sacar la vista previa del link"/);
  assert.match(cuerpo, /onClick=\{\(\) => \{ setSacadaCon\(link\); cambiar\(\{ sin_vista_previa: true \}, true\); \}\}/);
  // Si cambia el link, la tarjeta vuelve (como pegar otro link en WhatsApp).
  assert.match(cuerpo, /link !== sacadaCon\) \{ setSacadaCon\(null\); cambiar\(\{ sin_vista_previa: false \}, true\); \}/);
  // Y no volvió el interruptor suelto de la tarjeta.
  assert.doesNotMatch(lienzo, /label="Vista previa del link"|data-vista-previa(?!-link)/);
});
