// =============================================================================
// Para una integración JAMÁS se sale de la tab (Martín, 14/10/2026)
// =============================================================================
// Textual: «si una persona entra allí y no tiene el google calendar conectado, que salte el modal que tenemos en
// integraciones allí mismo para que lo pueda conectar. Esto significa también el botón de "Conectar" si no lo tiene
// conectado debería saltar el pop-up ahí. Esto como regla siempre, en todas las tabs, para una integración jamás se debe
// salir de la tab.»
//
// Lo que se fija:
//   · `servicioDeLink` (lib/integracion-en-tab.ts): qué integración nombra un link a /integraciones, y cuáles NO se
//     abren sueltas (la landing y el agente: su modal necesita datos que sólo arma /integraciones);
//   · `volverDeLaPestana`: a dónde vuelve un OAuth, sin el `?ws=` ni el resultado anterior;
//   · la pieza ÚNICA (app/_components/ConectarIntegracion.tsx) monta `ServicioSuelto` por portal y en la pila;
//   · el BARRIDO: ningún archivo de app/ (fuera de /integraciones) lleva un link a /integraciones sin estar en la lista
//     de abajo con su porqué. Un link nuevo es una decisión: o es «conectar» (y va con el modal) o es «ir a mirar».
//
// PROBADO ROMPIÉNDOLO (14/10/2026), con el arnés que restaura de memoria, contra una base en verde (5 / 0):
//   · `SIN_MODAL_SUELTO` sin 'landing' → 4 / 1;
//   · `volverDeLaPestana` sin sacar el `ws` → 4 / 1;
//   · `<Link href="/integraciones?abrir=meta">` de vuelta en app/crm/lead-view/CalificacionCard.tsx → 3 / 2 (el barrido
//     y «lo que se convirtió»);
//   · `CapaIntegracion` sin `createPortal` → 4 / 1;
//   · app/landing-analyst/PulsoPaginas.tsx sin su link (una excepción que ya no corresponde) → 4 / 1.
// Restaurado: 5 / 0.
// Y los dos del cobro de la landing (14/10/2026, mismo arnés): el `<Link href="/integraciones" target="_blank">` de
// vuelta en DialogoPublicar → 3 / 2 (el barrido y «lo que se convirtió»); en CobroBoton → 3 / 2. Restaurado: 5 / 0.
//
// Correr: npx tsx --test tests/integracion-sin-salir.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { servicioDeLink, volverDeLaPestana, SIN_MODAL_SUELTO } from '../lib/integracion-en-tab';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('qué integración nombra un link, y cuáles no se abren sueltas', () => {
  assert.equal(servicioDeLink('/integraciones?abrir=meta'), 'meta');
  assert.equal(servicioDeLink('/integraciones?servicio=elevenlabs'), 'elevenlabs');
  assert.equal(servicioDeLink('https://hola-mako.com/integraciones?abrir=gemini&ws=3'), 'gemini');
  // La grilla entera no es «conectar ESTA integración»: sigue siendo un link.
  assert.equal(servicioDeLink('/integraciones'), null);
  assert.equal(servicioDeLink('/integraciones#saldo-ia'), null);
  assert.equal(servicioDeLink('/crm?abrir=meta'), null);
  assert.equal(servicioDeLink('/integraciones?abrir=../x'), null);
  assert.equal(servicioDeLink(null), null);
  for (const k of SIN_MODAL_SUELTO) assert.equal(servicioDeLink(`/integraciones?abrir=${k}`), null, `la ${k} no se abre suelta`);
  assert.deepEqual([...SIN_MODAL_SUELTO], ['landing', 'agente']);
});

test('a dónde vuelve un OAuth: la tab con su query, sin el ws ni el resultado anterior', () => {
  assert.equal(volverDeLaPestana('/calendario', '?vista=mes&fecha=2026-10-14&ws=13&gcal=csrf'), '/calendario?vista=mes&fecha=2026-10-14');
  assert.equal(volverDeLaPestana('/crm', ''), '/crm');
  assert.equal(volverDeLaPestana('/crm', '?meta=ok'), '/crm');
});

test('la pieza es UNA: monta el ServicioSuelto de /integraciones, por portal y en la pila de modales', () => {
  const pieza = sinComentarios(leer('app/_components/ConectarIntegracion.tsx'));
  assert.match(pieza, /const ServicioSuelto = dynamic\(\(\) => import\('@\/app\/integraciones\/ServicioSuelto'\), \{ ssr: false/);
  assert.match(pieza, /return createPortal\(/);
  assert.match(pieza, /useCapaModal\(true, \{ anidada: true \}\)/);
  assert.match(pieza, /e\.stopImmediatePropagation\(\);\s*cerrarRef\.current\(\);/);
  // El clic adentro no sube hasta quien lo montó (un portal burbujea por el árbol de React).
  assert.match(pieza, /onClick=\{frenar\} onMouseDown=\{frenar\}/);
  assert.match(pieza, /onClick=\{\(e\) => \{ e\.stopPropagation\(\); abrir\(servicio\); \}\}/);
  // Y `ServicioSuelto` es el modal de la grilla, no uno propio.
  assert.match(leer('app/integraciones/ServicioSuelto.tsx'), /import \{ ServicioModal \} from '\.\/IntegracionesBoard';/);
});

/**
 * LOS LINKS A /integraciones QUE QUEDAN, en positivo y archivo por archivo, con su porqué. Todo lo demás de app/ que
 * «conecta» algo abre el modal ahí mismo (`BotonIntegracion`, `LinkIntegracion`, `useConectarIntegracion`).
 * `pendiente`: lo tiene que pasar al modal la sesión de General/Dashboard (no se tocó a propósito el 14/10/2026); no se
 * exige que siga ahí.
 */
const QUEDAN: Record<string, { porque: string; pendiente?: true }> = {
  'app/_components/SaldoMaKo.tsx': { porque: 'ir a MIRAR el saldo de la IA (#saldo-ia), no conectar' },
  'app/admin/cobros/page.tsx': { porque: 'abre /integraciones en el workspace de MaKo (`?ws=` explícito): el modal se abriría en el de la pestaña' },
  'app/admin/ui/CatalogoUI.tsx': { porque: 'el catálogo de la UI: un ejemplo del componente' },
  'app/api-mako/Articulos.tsx': { porque: 'el agente de Claude (token clásico): su modal no se abre suelto' },
  'app/api-mako/Tokens.tsx': { porque: 'el agente de Claude (token clásico): su modal no se abre suelto' },
  'app/crm/lead-view/TrackingTimelineCard.tsx': { porque: 'el código del Pixel (la landing): su modal no se abre suelto' },
  'app/landing-analyst/LandingAnalystApp.tsx': { porque: 'ver el código del Pixel (la landing)' },
  'app/landing-analyst/PulsoPaginas.tsx': { porque: 'copiar la línea del Pixel (la landing)' },
  'app/marketing/salud/page.tsx': { porque: 'un alias de ruta que redirige a /integraciones' },
  'app/general/bloques/Norte.tsx': { porque: 'el «Conectar» del semáforo SIN FUENTES no nombra una integración: va a la grilla (abd91fdb, docs/hallazgos-objectives.md)' },
};

/** Un literal que ARRANCA con /integraciones (no la prosa, no /api/integraciones, no /admin/dev/integraciones). */
const LINK = /['"`]\/integraciones(?:[?#'"`]|$)/m;

test('el barrido: ningún link a /integraciones fuera de la lista', () => {
  const archivos = execFileSync('git', ['ls-files', 'app'], { cwd: RAIZ, encoding: 'utf8' }).split('\n')
    .filter((f) => /\.(tsx?)$/.test(f) && !f.startsWith('app/integraciones/') && !f.startsWith('app/admin/dev/') && !f.startsWith('app/admin/docs/')
      && !f.startsWith('app/api/') && f !== 'app/_components/nav.ts');
  const con: string[] = [];
  for (const f of archivos) {
    let src: string;
    try { src = sinComentarios(leer(f)); } catch { continue; }
    if (LINK.test(src)) con.push(f);
  }
  const fuera = con.filter((f) => !QUEDAN[f]);
  assert.deepEqual(fuera, [], 'un link a /integraciones nuevo: si conecta algo, va con el modal (app/_components/ConectarIntegracion.tsx); si es para mirar, se suma a QUEDAN con su porqué');
  const viejas = Object.entries(QUEDAN).filter(([f, q]) => !q.pendiente && !con.includes(f)).map(([f]) => f);
  assert.deepEqual(viejas, [], 'una excepción que ya no corresponde: se saca de la lista');
});

test('lo que se convirtió el 14/10/2026 abre el modal y no navega', () => {
  const casos: Array<[string, RegExp]> = [
    ['app/calendario/CalendarioApp.tsx', /abrirIntegracion\('google'\)/],
    ['app/crm/lead-view/CalificacionCard.tsx', /<BotonIntegracion servicio="meta" /],
    ['app/crm/CampanasModal.tsx', /<BotonIntegracion servicio="meta" /],
    ['app/crm/CrmBoard.tsx', /<BotonIntegracion servicio="google" /],
    ['app/crm/[id]/CobrarConLink.tsx', /<BotonIntegracion servicio="stripe" /],
    ['app/ads-manager/OnboardingAdsManager.tsx', /onClick=\{\(\) => abrir\('meta'\)\}/],
    ['app/automations/VozAIStep.tsx', /<BotonIntegracion servicio="elevenlabs" /],
    ['app/automations/EditorDisparadores.tsx', /<BotonIntegracion servicio="mercadopago" /],
    ['app/automations/ChatMako.tsx', /<LinkIntegracion href=\{link\}/],
    ['app/email/EmailApp.tsx', /<BotonIntegracion servicio="email" /],
    // El cobro de la landing (Stripe, y sólo Stripe: `pasarelaDeLanding`): el aviso de Publicar y el panel del botón.
    ['app/web-generator/editor/dialogos/DialogoPublicar.tsx', /<BotonIntegracion servicio="stripe" onConectado=\{recargarCobro\}/],
    ['app/web-generator/editor/nodos/CobroBoton.tsx', /onClick=\{\(e\) => \{ e\.stopPropagation\(\); abrir\('stripe'\); \}\}/],
  ];
  for (const [f, re] of casos) {
    const src = sinComentarios(leer(f));
    assert.match(src, re, `${f} ya no abre el modal`);
    assert.doesNotMatch(src, LINK, `${f} volvió a navegar a /integraciones`);
  }
});
