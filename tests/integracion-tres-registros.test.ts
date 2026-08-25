// =============================================================================
// Los TRES registros que necesita una integración, y que nadie recuerda de memoria
// =============================================================================
// Agregar una integración no es agregarla a un lugar: son tres, en tres archivos
// distintos, y el compilador no ve ninguno de los tres.
//
//   1. lib/integraciones-catalogo.ts  → la TARJETA (existe, en qué categoría)
//   2. lib/metodo-catalogo.ts         → los CAMPOS (qué se le pide y su tutorial)
//   3. lib/metodo-verificar.ts        → el PING (cómo se comprueba)
//   +  app/_components/ServicioVisual.tsx → el LOGO
//
// Cada uno falla distinto, y ninguno falla ruidoso:
//
// · Sin el PING, el tilde de cada campo dice «servicio inválido» — y como el tilde
//   verifica ANTES de guardar, el cliente NO PUEDE GUARDAR NADA. Le pasó al cliente
//   con Cal.com el 24/08/2026, en producción: el mensaje culpa al servicio que él
//   acababa de elegir bien. lib/metodo-verificar.ts YA tenía el aviso escrito
//   («SIN ESTO LA BARRA DICE "servicio inválido"… es el TERCER registro») y aun así
//   volvió a pasar. Un comentario no es un control.
//
// · Sin el LOGO, el fallback dibujaba el de OTRA MARCA (Supabase). La tarjeta de una
//   agenda salió con el logo de una base de datos y se reportó como «el logo está
//   mal». No estaba mal: era de otro producto.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFS_TEST } from '../lib/integraciones-catalogo';

const leer = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

/** Las keys del catálogo de campos (`SERVICIOS_METODO`), leídas del fuente. */
const keysDelMetodo = (): string[] => {
  const s = leer('../lib/metodo-catalogo.ts');
  const dentro = s.slice(s.indexOf('SERVICIOS_METODO'), s.indexOf('export const serviciosPara'));
  return [...dentro.matchAll(/^\s{2,4}key: '([a-z0-9_-]+)',/gm)].map((m) => m[1]);
};

test('toda integración que pide credenciales tiene su VERIFICADOR', () => {
  const pings = leer('../lib/metodo-verificar.ts');
  const sinPing: string[] = [];
  for (const key of keysDelMetodo()) {
    // El registro de pings son métodos de un objeto: `async <key>(v) {`.
    if (!new RegExp(`async ${key}\\s*\\(`).test(pings)) sinPing.push(key);
  }
  assert.deepEqual(
    sinPing, [],
    `estos servicios piden credenciales y no tienen ping en lib/metodo-verificar.ts: ${sinPing.join(', ')}. ` +
    'El tilde de cada campo verifica ANTES de guardar, así que sin ping el cliente ve ' +
    '«servicio inválido No la guardé» y no puede conectar NADA.',
  );
});

test('toda tarjeta del catálogo tiene su LOGO propio, no el de otra marca', () => {
  const visual = leer('../app/_components/ServicioVisual.tsx');
  // El mapa `ICON`: entradas `key: { … }` hasta el cierre del objeto.
  const mapa = visual.slice(visual.indexOf('export const ICON'), visual.indexOf('export const iconFor'));
  const sinLogo = DEFS_TEST
    .filter((d) => !new RegExp(`^\\s{2}${d.key}:\\s*\\{`, 'm').test(mapa))
    .map((d) => d.key);
  assert.deepEqual(
    sinLogo, [],
    `estas integraciones no tienen entrada en ICON (app/_components/ServicioVisual.tsx): ${sinLogo.join(', ')}. ` +
    'Sin entrada caen en el fallback, y el fallback NO es «falta el ícono»: es un letter-mark. ' +
    'Antes era el logo de Supabase, o sea el de otra marca.',
  );
});

test('el fallback del logo NO puede ser el logo de otro servicio', () => {
  // La regla del archivo: «si no conseguimos el vector oficial, NO se dibuja uno
  // parecido: va un letter-mark». Un logo AJENO es todavía peor que uno parecido,
  // porque no se lee como un error nuestro sino como que la app se confundió.
  const visual = leer('../app/_components/ServicioVisual.tsx');
  const fallback = visual.slice(visual.indexOf('export const iconFor'), visual.indexOf('export function SvcIcon'));
  assert.ok(/letter:/.test(fallback), 'el fallback tiene que ser un letter-mark');
  assert.ok(!/sym:\s*'ic-/.test(fallback), 'el fallback no puede apuntar al símbolo de una marca: sería mostrar el logo de otro producto');
});

test('Cal.com tiene los tres registros y su logo, y no comparte nada con Calendly', () => {
  // El caso que destapó todo esto. Son dos empresas distintas: si alguna vez
  // comparten ping, ícono o servicio de ruteo, vuelve el bug original.
  assert.ok(DEFS_TEST.some((d) => d.key === 'calcom'), 'falta la tarjeta de Cal.com');
  assert.ok(keysDelMetodo().includes('calcom'), 'faltan los campos de Cal.com');
  assert.ok(/async calcom\s*\(/.test(leer('../lib/metodo-verificar.ts')), 'falta el ping de Cal.com');
  assert.ok(/^\s{2}calcom:\s*\{/m.test(leer('../app/_components/ServicioVisual.tsx')), 'falta el logo de Cal.com');

  const routing = leer('../lib/webhook-routing.ts');
  assert.ok(/CALCOM_EVENT_TYPE_J1: 'calcom'/.test(routing), 'Cal.com necesita su propio servicio de ruteo');
  assert.ok(!/CALCOM_EVENT_TYPE_J\d: 'calendly'/.test(routing),
    'compartir el índice de ruteo con Calendly haría que un slug repetido rutee la reserva al workspace equivocado');
});

test('el campo que hace funcionar la integración va PRIMERO', () => {
  // El orden no es cosmético: la validación exige los campos obligatorios antes de
  // dejar guardar nada, así que si arriba está el opcional, la persona lo llena
  // primero y le rebota sobre el campo que acaba de completar bien. Pasó con
  // Cal.com: la API key (opcional) estaba encima del secret del webhook.
  const metodo = leer('../lib/metodo-catalogo.ts');
  const bloque = metodo.slice(metodo.indexOf("key: 'calcom'"), metodo.indexOf("key: 'calcom'") + 2500);
  const campos = [...bloque.matchAll(/\{ env: '([A-Z0-9_]+)'[^}]*?\}/g)].map((m) => ({ env: m[1], opcional: /opcional: true/.test(m[0]) }));
  assert.ok(campos.length >= 2, 'no se pudieron leer los campos de Cal.com');
  assert.equal(campos[0].opcional, false, `el primer campo de Cal.com es «${campos[0].env}» y está marcado opcional: el obligatorio va primero`);
});
