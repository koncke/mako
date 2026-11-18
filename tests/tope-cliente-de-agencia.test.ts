// F148 (18/11/2026): el cliente de una AGENCIA no lee «Pasa a MaKo Pro» en un cartel de tope ni en un candado. Su plan lo
// cambia su agencia (#494): el link ya se cambiaba por «Pídele a tu agencia que te pase a Pro.» (`ctaDeTope`), pero el texto
// de al lado seguía diciendo «… Pasa a MaKo Pro para tener más.». Se ejecutan las reglas puras con los CTA de verdad.
//
// Probado rompiéndolo (base 5/0):
//   · `textoDelTopeSegun` sin mirar el CTA (devuelve el texto tal cual) → 4/1;
//   · `sinPasarAPro` sin la frase del candado («Pasa a Pro para usarlo.») → 3/2;
//   · un cartel (app/crm/PasarAPro.tsx) dibujando `textoTope(tope)` sin `TextoDelTope` → 4/1;
//   · la puerta de la API (`correrOperacion`, lib/api-mako/ejecutar.ts) devolviendo el error sin `errorDelPlanParaElNegocio` → 4/1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FRASE_PASAR_A_PRO_SOLO, FRASE_PASAR_A_PRO_TOPE, sinPasarAPro, textoSoloPro, textoTope } from '../lib/topes-plan';
import { ctaDeTope, textoDelTopeSegun, textoTopeParaClienteDeAgencia, TEXTO_PEDIR_PRO_A_LA_AGENCIA } from '../lib/plan-esencial-reglas';
import { TEXTO_DOMINIO_SOLO_PRO } from '../lib/editor-landing/tope-landings';
import { marcasDeVoseo } from '../lib/voseo';

const leer = (rel: string) => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

const cliente = ctaDeTope({ clienteDeAgencia: true, agenciaAdentroDe: null, superAdminMira: null });
const negocio = ctaDeTope({ clienteDeAgencia: false, agenciaAdentroDe: null, superAdminMira: null });
const agenciaAdentro = ctaDeTope({ clienteDeAgencia: true, agenciaAdentroDe: 24, superAdminMira: null });

test('sin la frase de pasar a Pro, el resto del texto queda igual', () => {
  assert.equal(sinPasarAPro(textoTope(1)), 'Llegaste al tope de tu plan (1).');
  assert.equal(sinPasarAPro(textoSoloPro('scraper-whatsapp')), 'Traer los contactos de un grupo de WhatsApp es de MaKo Pro.');
  assert.equal(sinPasarAPro(TEXTO_DOMINIO_SOLO_PRO), 'El dominio propio es de MaKo Pro.', 'los candados escritos a mano, también');
  assert.equal(sinPasarAPro('No se pudo guardar.'), 'No se pudo guardar.', 'un texto sin la frase vuelve tal cual');
  assert.ok(textoTope(3).endsWith(FRASE_PASAR_A_PRO_TOPE) && textoSoloPro('ia-editores').endsWith(FRASE_PASAR_A_PRO_SOLO),
    'los textos se arman con las frases que se sacan');
});

test('el cliente de una agencia lee el tope sin «Pasa a MaKo Pro»; el negocio y la agencia adentro, tal cual', () => {
  assert.equal(cliente.tipo, 'pedir');
  assert.equal(textoDelTopeSegun(textoTope(1), cliente), 'Llegaste al tope de tu plan (1).');
  assert.doesNotMatch(textoDelTopeSegun(textoSoloPro('comunidad'), cliente), /Pasa a/);
  assert.equal(textoDelTopeSegun(textoTope(1), negocio), textoTope(1), 'a quien compra su plan, el texto de siempre');
  assert.equal(textoDelTopeSegun(textoTope(1), agenciaAdentro), textoTope(1), 'la agencia adentro de su cliente SÍ puede pasarlo a Pro');
});

test('lo que contesta el server al cliente de una agencia: el tope y a quién pedírselo, sin los planes', () => {
  const t = textoTopeParaClienteDeAgencia(1);
  assert.equal(t, `Llegaste al tope de tu plan (1). ${TEXTO_PEDIR_PRO_A_LA_AGENCIA}`);
  assert.doesNotMatch(t, /Pasa a MaKo Pro|\/planes/);
  assert.deepEqual(marcasDeVoseo(t), []);
});

test('los carteles que dibujan un tope o un candado pasan su texto por `TextoDelTope`', () => {
  // La decisión vive en `useTextoDelTope` (app/_components/CtaPasarAPro.tsx), con la MISMA `ctaDeTope` que el link.
  const cta = leer('app/_components/CtaPasarAPro.tsx');
  assert.match(cta, /return textoDelTopeSegun\(texto, cta\);/);
  const carteles: Array<[string, RegExp]> = [
    ['app/crm/PasarAPro.tsx', /<TextoDelTope texto=\{textoTope\(tope\)\} \/>/],
    ['app/_components/CandadoSoloPro.tsx', /<TextoDelTope texto=\{textoSoloPro\(funcion\)\} \/>/],
    ['app/_components/CartelSoloPro.tsx', /<TextoDelTope texto=\{texto\} \/><\/p>/],
    ['app/whatsapp/EvolutionConnect.tsx', /<TextoDelTope texto=\{texto\} \/>/],
    ['app/crm/TraerDeGrupoWA.tsx', /<TextoDelTope texto=\{err \?\? /],
    ['app/equipo/EquipoView.tsx', /<TextoDelTope texto=\{errCrear\} \/>/],
    ['app/integraciones/CuentasDePago.tsx', /<TextoDelTope texto=\{msg\.text\} \/>/],
    ['app/automations/SecuenciaPerfil.tsx', /<TextoDelTope texto=\{err\} \/> <CtaPasarAPro>/],
    ['app/web-generator/editor/dialogos/DialogoPublicar.tsx', /<TextoDelTope texto=\{TEXTO_DOMINIO_SOLO_PRO\} \/>/],
  ];
  for (const [rel, re] of carteles) assert.match(leer(rel), re, `${rel} dibuja el texto del tope sin pasar por TextoDelTope`);
  // Y CartelSoloPro tiene dos formas (la pantalla y el aviso corto): las dos.
  assert.equal((leer('app/_components/CartelSoloPro.tsx').match(/<TextoDelTope texto=\{texto\} \/>/g) ?? []).length, 2);
});

test('la API de MaKo no le ofrece los planes al cliente de una agencia: al crear un CRM y en todo error de un tope o candado', () => {
  const run = leer('lib/api-mako/areas/crm.run.ts');
  assert.match(run, /if \(tope && enElTope\(tope, 'crm\.funnels'\)\) return \{ error: await textoTopeDelNegocio\(ctx\.ws, tope\.tope\) \};/);
  const srv = leer('lib/tope-texto-agencia.ts');
  assert.match(srv, /return deAgencia !== false \? textoTopeParaClienteDeAgencia\(tope\) : `\$\{textoTope\(tope\)\} Planes: \/planes\.`;/,
    'con «no sé» no se ofrece (es un upsell)');
  // La puerta de TODA la API: un error con «Pasa a … Pro» pasa por acá antes de volver (el chat, WhatsApp, un token).
  assert.match(srv, /if \(sin === texto\) return texto;/, 'un texto sin la frase no lee nada');
  assert.match(srv, /return esDeAgencia !== false \? `\$\{sin\} \$\{TEXTO_PEDIR_PRO_A_LA_AGENCIA\}` : texto;/);
  const ejecutar = leer('lib/api-mako/ejecutar.ts');
  const puerta = ejecutar.slice(ejecutar.indexOf('async function correrOperacion('), ejecutar.indexOf('async function correrCruda('));
  assert.match(puerta, /const r = await correrCruda\(id, inputCrudo, ctx, origen, vistaPrevia\);/);
  assert.match(puerta, /return r\.ok \? r : \{ \.\.\.r, error: await errorDelPlanParaElNegocio\(ctx\.ws, r\.error\) \};/,
    'todo error de la API pasa por acá antes de volver');
});
