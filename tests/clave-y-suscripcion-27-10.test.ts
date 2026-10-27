// =============================================================================
// «Tus cuentas de IA»: la clave de API no es la suscripción, y Gemini ya no se ofrece (27/10/2026)
// =============================================================================
// Leila, en la llamada con Martín (el pendiente 876470842-21, por el Cerebro): «Tus cuentas de IA» mezcla clave de API con
// suscripción. Arriba decía «Anthropic API · Conectada» y abajo su Claude Max («Cuenta 1 · Max»): las dos se leían como «mi
// Claude está conectado», sin saber con cuál contestaba MaKo. Y la fila de la clave abría «¿Cómo la conectas?», que ofrecía
// también la computadora: tocar la CLAVE te llevaba a elegir la suscripción.
//
// Ahora cada fila de «Claves de API» es SÓLO la clave («Clave cargada» o «Sin clave», y abre el modal de SU clave), cada cuenta
// de la computadora dice «Suscripción Max», y el «?» del título dice la diferencia. Gemini no se ofrece desde el 25/10: su fila
// sale, salvo en el negocio que ya la tiene cargada (once, medido el 27/10), porque MaKo la sigue usando y esconderla sería
// esconder una clave en uso.
//
// PROBADO ROMPIÉNDOLO (27/10/2026): ver `ROTURAS` al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { IAS_DEL_CLIENTE } from '../lib/conectar-ia-reglas';
import { resumenDeCuentas } from '../lib/ia-pc-reglas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const PANTALLA = sinComentarios(leer('app/integraciones/TusCuentasIA.tsx'));
const bloque = (src: string, desde: string) => {
  const ini = src.indexOf(desde);
  assert.ok(ini >= 0, `no se encontró ${desde}`);
  return src.slice(ini, src.indexOf('\n}\n', ini));
};
const CLAVES = bloque(PANTALLA, 'function ClavesDeApi(');

test('1. cada fila de «Claves de API» es SÓLO la clave: dice «Clave cargada» o «Sin clave» y abre el modal de su clave', () => {
  assert.match(PANTALLA, /const estadoDeClave = \(cargada: boolean, retirada: boolean\): string =>\n\s*\(cargada \? \(retirada \? 'Cargada · ya no se ofrece' : 'Clave cargada'\) : 'Sin clave'\);/);
  assert.match(CLAVES, /\{estadoDeClave\(st\.conectada, retirada\)\}/, 'la fila no dice el estado de la CLAVE');
  // «Conectada» a secas era lo que se leía como la suscripción.
  assert.doesNotMatch(CLAVES, /'Conectada'|'Sin conectar'/, 'volvió «Conectada» a secas');
  // Ninguna fila lleva a «¿Cómo la conectas?» (que ofrece la computadora): todas abren el modal de su clave.
  assert.doesNotMatch(CLAVES, /onElegir|setEligiendo/, 'una fila de clave vuelve a abrir la elección con la computadora');
  assert.match(CLAVES, /return <BotonIntegracion key=\{key\} servicio=\{key\} className="tci-api"/);
  assert.match(PANTALLA, /<ClavesDeApi esAdmin=\{!!estado\?\.esAdmin\} \/>/);
});

test('2. el «?» del título dice la diferencia (el MISMO texto de «¿Cómo la conectas?»), a la vista y al lector', () => {
  assert.match(PANTALLA, /const NO_ES_LO_MISMO = 'No es lo mismo que la clave: tu computadora contesta lo que le pides en el chat, con tu suscripción/);
  assert.match(CLAVES, /<span className="tci-ayuda tci-ayuda--titulo" title=\{NO_ES_LO_MISMO\} aria-hidden>\?<\/span>/);
  assert.match(CLAVES, /<section className="tci-bloque" aria-label="Claves de API" aria-describedby=\{idAyuda\}>/);
  assert.match(CLAVES, /<span id=\{idAyuda\} hidden>\{NO_ES_LO_MISMO\}<\/span>/);
  // Al lado del título y no en la esquina: `.tci-ayuda` es absoluta (la de las opciones grandes) y viene DESPUÉS en el CSS, así
  // que la del título necesita las DOS clases para ganarle (con una sola, el «?» se iba a la esquina de la página).
  const css = leer('app/integraciones/tus-cuentas-ia.css');
  assert.match(css, /^\.tci-ayuda\.tci-ayuda--titulo \{ position: static;/m);
  assert.match(css, /^\.tci-bloque__titulo--ayuda \{ display: flex;/m);
});

test('3. la suscripción lleva su nombre en cada cuenta: «Suscripción Max», o «Suscripción» sin plan', () => {
  const cuenta = bloque(sinComentarios(leer('app/integraciones/CuentasYDispositivos.tsx')), 'export function BloqueCuenta(');
  assert.match(cuenta, /<span className="tci-plan">\{cuenta\.plan \? `Suscripción \$\{cuenta\.plan\}` : 'Suscripción'\}<\/span>/,
    'la cuenta de la computadora no dice que es la suscripción');
});

test('4. Gemini no se ofrece: su fila sólo existe cargada, sin el verde, y no se nombra en «Tus cuentas de IA»', () => {
  assert.deepEqual([...IAS_DEL_CLIENTE], ['claude', 'chatgpt'], '«Nueva cuenta» vuelve a ofrecer Gemini');
  assert.match(PANTALLA, /const CLAVES_RETIRADAS: ReadonlySet<string> = new Set\(\['gemini'\]\);/);
  assert.match(CLAVES, /if \(retirada && !st\?\.conectada\) return null;/, 'la fila de Gemini se ofrece sin estar cargada');
  assert.match(CLAVES, /data-conectada=\{\(st\.conectada && !retirada\) \|\| undefined\} data-retirada=\{retirada \|\| undefined\}/,
    'una retirada cargada se pinta de verde, como lista para usar');
  assert.match(leer('app/integraciones/tus-cuentas-ia.css'), /^\.tci-api__estado\[data-retirada\] \{ color: var\(--faint\); \}/m);
  // Los textos de «Tus cuentas de IA», en la computadora y en el teléfono.
  const lugares = ['app/integraciones/TusCuentasIA.tsx', 'app/perfil/ia/page.tsx', 'app/m/configuraciones/integraciones/IntegracionesM.tsx'];
  for (const f of lugares) {
    const textos = [...sinComentarios(leer(f)).matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`|>([^<>{}\n]+)</g)].map((m) => m[1] ?? m[2] ?? m[3] ?? m[4] ?? '');
    const conGemini = textos.filter((t) => /gemini/i.test(t) && /\s/.test(t));
    assert.deepEqual(conGemini, [], `${f} todavía le habla de Gemini a quien entra`);
  }
  assert.doesNotMatch(bloque(PANTALLA, 'export function TarjetaTusCuentasIA('), /SERVICIO_DE_CLAVE\.gemini/, 'la tarjeta sigue con el logo de Gemini');
  const sinNada = resumenDeCuentas({ pcs: [], grupos: { cuentas: [], sinCuenta: [] } }, true);
  assert.equal(sinNada.linea, 'Conecta tu Claude o tu GPT: con eso contesta tu Ops Center.');
});

// ── ROTURAS (27/10/2026) ───────────────────────────────────────────────────────
// Una por vez, restaurando de memoria y comprobando el contenido. Base: 4 / 0. Las 11 cazadas, cada una 3 / 1:
//   C1.  la fila vuelve a decir «Conectada» / «Sin conectar»                     → 1.
//   C2.  la de Anthropic vuelve a abrir «¿Cómo la conectas?» (`onElegir`)        → 1.
//   C3.  el «?» del título con una sola clase (se iba a la esquina de la página)  → 2.
//   C4.  la sección sin `aria-describedby` (el lector no recibe la diferencia)  → 2.
//   C5.  la cuenta dice sólo «Max», sin «Suscripción»                             → 3.
//   C6.  Gemini se ofrece sin estar cargada                                     → 4.
//   C7.  Gemini cargada, en verde como lista para usar                            → 4.
//   C8.  la bajada de «Tus cuentas de IA» vuelve a nombrar a Gemini               → 4.
//   C9.  «Nueva cuenta» vuelve a ofrecer Gemini (IAS_DEL_CLIENTE)                 → 4.
//   C10. el teléfono («Tu Claude, tu GPT o tu Gemini») vuelve                     → 4.
//   C11. la tarjeta de /integraciones vuelve con el logo de Gemini                 → 4.
// Restaurado: 4 / 0.
