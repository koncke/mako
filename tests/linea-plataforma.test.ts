// =============================================================================
// SUPERADMIN: LA LÍNEA Y EL EMAIL DE MaKo SON LOS DE LA PLATAFORMA, Y DE NINGÚN CLIENTE (15/10/2026)
// =============================================================================
// Martín (el 3 de las doce): «en SuperAdmin me dice que no tengo conectado WhatsApp y Gmail, cuando si lo tengo... Está
// el WhatsApp de MaKo y el Gmail de MaKo». Decidido por el coordinador (camino (a), docs/hallazgos-comunicacion.md):
//   · en la plataforma, la línea de MaKo es la de POR DEFECTO para mandar y para el estado de Automations; lo que entra
//     sigue yendo al canal de MaKo, y una tarjeta que espera respuesta dice «No escucha respuestas»;
//   · el email de la plataforma sale con equipo@hola-mako.com (se reclamó el dominio, decisión 22);
//   · NADA de eso vale para un negocio cliente.
//
// ⚠️ PROBADO ROMPIENDO (15/10/2026, scratchpad romper-linea.mjs, una rotura por vez y restaurada con sha1 igual).
// Base 4 pass / 0 fail; los números medidos de cada rotura, al lado de su test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { elegirLinea } from '../lib/lineas-whatsapp';
import { chipDeTarjeta, CHIP_NO_ESCUCHA, type EstadoMedios } from '../lib/medios-automatizacion';
import { remitenteDelNegocio } from '../lib/email-remitente';
import { normalizar, type PasoGrafo } from '../lib/flujo-grafo';

const leer = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const MAKO = 'mako_superadmin_muylqv8r';
const virtual = { id: 0, instance_name: MAKO, es_default: true };
const propia = { id: 7, instance_name: 'mako_ws9', es_default: false };

// rotura 1 (`elegirLinea` acepta cualquier línea de MaKo sin que se la pasen): 3 pass / 1 fail, cae éste.
test('la línea de MaKo es de la plataforma SÓLO si quien manda la pasa; en un cliente, nunca', () => {
  // La plataforma, con la línea de MaKo: es la de por defecto, y se puede pedir por su nombre.
  assert.deepEqual(elegirLinea([virtual, propia], null, 9, MAKO), { ok: true, instance: MAKO });
  assert.deepEqual(elegirLinea([virtual, propia], MAKO, 9, MAKO), { ok: true, instance: MAKO });
  assert.deepEqual(elegirLinea([virtual, propia], 'mako_ws9', 9, MAKO), { ok: true, instance: 'mako_ws9' }, '«conectar otro número» sigue');
  // Sin que se la pasen (las operaciones de la línea, o un cliente), NO ES DEL NEGOCIO, aunque esté en la lista.
  const ajena = { ok: false, motivo: 'Esa línea de WhatsApp no es de este negocio.' };
  assert.deepEqual(elegirLinea([propia], MAKO, 9), ajena);
  assert.deepEqual(elegirLinea([{ id: 1, instance_name: 'mako_ws1', es_default: true }], MAKO, 1), ajena, 'un cliente no manda por la línea de MaKo');
  assert.deepEqual(elegirLinea([virtual], MAKO, 1), ajena, 'ni si la línea de MaKo apareciera en su lista');
  assert.deepEqual(elegirLinea([virtual], null, 1), { ok: false, motivo: 'La línea de WhatsApp de este negocio está mal registrada.' });
});

// rotura 2 (`lineaDeEnvio` sin `lineasParaMandar`): 3 pass / 1 fail, cae éste. rotura 3 (`lineaEstricta` con la línea de
// MaKo, que la vuelve QR-able desde el ws 9): 3 pass / 1 fail, cae éste. rotura 4 (`lineaDeMaKoPara` sin mirar si es la
// plataforma): 3 pass / 1 fail, cae éste.
test('sólo el ENVÍO y el estado ven la línea de MaKo; las operaciones de la línea, no; y sólo en la plataforma', () => {
  const ev = leer('lib/evolution.ts');
  const envio = ev.slice(ev.indexOf('async function lineaDeEnvio('), ev.indexOf('async function lineaDeEnvio(') + 600);
  assert.match(envio, /const \{ lineas, deMaKo \} = await lineasParaMandar\(ws\);\n\s+const e = elegirLinea\(lineas, linea, ws, deMaKo\);/);
  const estricta = ev.slice(ev.indexOf('async function lineaEstricta('), ev.indexOf('export async function lineaParaLeer'));
  assert.match(estricta, /elegirLinea\(await listarLineas\(\), linea, ws\)/, 'QR, desconectar y webhook siguen con las líneas del negocio');
  assert.doesNotMatch(estricta, /deMaKo|lineasParaMandar/);
  const lp = leer('lib/linea-plataforma.ts');
  assert.match(lp, /const plataforma = await wsSuperAdmin\(\)\.catch\(\(\) => -1\);\n\s+if \(ws !== plataforma\) return null;/);
  assert.match(leer('lib/disparadores-canales.ts'), /await lineasParaMandar\(wsWa\)/, 'el estado mira las MISMAS líneas con las que se manda');
});

// rotura 5 (sin el chip de «No escucha respuestas»): 3 pass / 1 fail, cae éste.
test('una tarjeta que espera respuesta por la línea de MaKo lo dice, sin frenar ni ofrecer conectar', () => {
  const estado: EstadoMedios = { whatsapp: { porDefecto: { conectado: true, noEscucha: true }, lineas: { [MAKO]: { conectado: true, noEscucha: true } } } };
  const pasos = normalizar([
    { id: 'm', canal: 'whatsapp', proveedor: 'no_oficial', cuerpo: 'Hola', siguiente: null, delay_horas: 0 },
    { id: 'ai', canal: 'whatsapp', cuerpo: '', nodo: 'respuesta', paso_ia: true, objetivo: 'Que agende', casos: [], si_no: null, delay_horas: 0 },
  ] as PasoGrafo[]);
  const ai = pasos.find((p) => p.id === 'ai')!;
  assert.deepEqual(chipDeTarjeta(ai, estado, null), { texto: CHIP_NO_ESCUCHA, medio: 'whatsapp', frena: false, informa: true });
  assert.equal(chipDeTarjeta(pasos.find((p) => p.id === 'm')!, estado, null), null, 'un mensaje sale: sin chip');
  assert.match(leer('app/automations/FlujoLienzo.tsx'), /onConectar=\{!chip\.informa && rolAdmin && paso \?/);
});

// rotura 6 (`porDominio` sin mirar `plataforma`): 3 pass / 1 fail, cae éste.
test('el email de un negocio nunca sale con MaKo; el de la plataforma, sí (con su dominio reclamado)', () => {
  const hechos = { resendFrom: 'MaKo <equipo@hola-mako.com>', resendDominio: 'hola-mako.com', credFrom: null, keyPropia: false };
  assert.deepEqual(remitenteDelNegocio({ ...hechos, plataforma: false }), { puede: false, motivo: 'de-mako' });
  assert.deepEqual(remitenteDelNegocio({ ...hechos, plataforma: true }), { puede: true, from: 'MaKo <equipo@hola-mako.com>', via: 'dominio' });
});
