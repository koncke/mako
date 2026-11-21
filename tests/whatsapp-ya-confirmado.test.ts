// EL WHATSAPP YA CONFIRMADO EN EL ONBOARDING V2 (20/11/2026, el Cerebro, recorriéndolo en producción después de «Reiniciar onboarding»
// con el número verificado, el caso de Leila): MaKo decía «toca «Abrir WhatsApp»… te contesto con un código» sin botón ni caja,
// dibujaba una burbuja «Listo, ya lo cargué.» que ella nunca escribió, y faltaba la tarjeta del contacto. Ahora: «Tu WhatsApp … ya está
// confirmado», la tarjeta de MaKo, «Guárdame en tus contactos…» y «¿Guardaste el contacto de MaKo?». El camino del código, igual.
// Roto a propósito el 20/11 (cada uno cae): la ruta sin marcar `telefonoYa` (3), la ruta escribiendo «Listo, ya lo cargué.» también en
// el V2 (3), la conversación con el mensaje del código (1), sin la tarjeta (1), y la tarjeta sólo en el último mensaje de MaKo (4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CODIGO_CARGADO, V2_AGENDADO, V2_CONTACTO, V2_AGENDADO_NO, V2_AGENDADO_NO_YA, V2_CODIGO, V2_GUARDAME, V2_NEGOCIO, V2_NEGOCIO_YA, V2_YA_CONFIRMADO,
  etapaDeArranqueV2, mensajesDeArranqueV2, type EstadoArranque, type HechosArranque,
} from '../lib/onboarding-arranque';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const H: HechosArranque = { modo: 'oferta', v2: true, nombreCuenta: '', nombreWorkspace: '', faseGuardada: false, canalNegocio: null, loQueVende: false, conCrm: true, conTelefono: true, terminado: false };
const textos = (e: EstadoArranque) => mensajesDeArranqueV2(e, H).map((m) => `${m.de}: ${m.texto}${m.tarjeta ? ` [${m.tarjeta}]` : ''}`);

test('1. ya confirmado: MaKo lo dice con el número, la tarjeta de su contacto y «Guárdame…»; ni el código ni «Listo, ya lo cargué.»', () => {
  const e: EstadoArranque = { nombre: 'Leila', telefono: 'verificado', telefonoNumero: '+5215555550101', telefonoVisto: '+52 1 55 5555 0101', telefonoYa: true };
  assert.equal(etapaDeArranqueV2(e, H), 'agendado');
  assert.deepEqual(textos(e), [
    'mako: ¡Hola! Para empezar, ¿cómo te llamas?',
    'yo: Leila',
    'mako: Un gusto, Leila. ¿A qué WhatsApp te escribo con los avisos y los reportes?',
    'yo: +52 1 55 5555 0101',
    `mako: ${V2_YA_CONFIRMADO('+52 1 55 5555 0101')}`,
    `mako: ${V2_CONTACTO} [contacto]`,
    `mako: ${V2_GUARDAME}`,
    `mako: ${V2_AGENDADO}`,
  ]);
  const todo = textos(e).join('\n');
  assert.ok(!todo.includes(V2_CODIGO) && !todo.includes(CODIGO_CARGADO));

  // Con «No»: la segunda dice que la tarjeta está arriba (no hubo código que la trajera); y el negocio, sin volver a decir «confirmado».
  const no = { ...e, agendado: 'no' as const };
  assert.ok(textos(no).includes(`mako: ${V2_AGENDADO_NO_YA}`) && !textos(no).includes(`mako: ${V2_AGENDADO_NO}`));
  const sigue = { ...e, agendado: 'si' as const };
  assert.equal(etapaDeArranqueV2(sigue, H), 'negocio');
  assert.equal(textos(sigue).at(-1), `mako: ${V2_NEGOCIO_YA}`);
});

test('2. el camino del código no cambia: el mensaje del código, «Listo, ya lo cargué.» al confirmarlo y «Listo, tu WhatsApp quedó confirmado»', () => {
  const codigo: EstadoArranque = { nombre: 'Leila', telefono: 'codigo', telefonoNumero: '+5215555550101', telefonoEntrante: true };
  assert.equal(textos(codigo).at(-1), `mako: ${V2_CODIGO} [codigo]`);
  const confirmado: EstadoArranque = { nombre: 'Leila', telefono: 'verificado', telefonoNumero: '+5215555550101', agendado: 'si' };
  const t = textos(confirmado);
  assert.ok(t.includes(`mako: ${V2_CODIGO}`) && t.includes(`yo: ${CODIGO_CARGADO}`) && !t.some((x) => x.includes('[contacto]')));
  assert.equal(t.at(-1), `mako: ${V2_NEGOCIO}`);
  // `telefonoYa` sin el número verificado no cuenta (un «Cambiar número» lo borra igual).
  assert.ok(textos({ ...codigo, telefonoYa: true }).at(-1)!.includes(V2_CODIGO));
});

test('3. la ruta: con `yaVerificado` en el V2 marca `telefonoYa` y NO escribe «Listo, ya lo cargué.»; «Cambiar número» lo borra', () => {
  const ruta = sinComentarios(leer('app/api/onboarding/arranque/route.ts'));
  assert.match(ruta, /const yaEnElV2 = r\.yaVerificado && h\.v2;/);
  assert.match(ruta, /telefonoYa: yaEnElV2 \? true : undefined \}\);/);
  assert.match(ruta, /if \(r\.yaVerificado && !yaEnElV2\) await anotarRespuesta\(\{ \.\.\.e, telefono: 'verificado', telefonoNumero: `\+\$\{digitos\}` \}, h, CODIGO_CARGADO, confirmado\);/);
  assert.equal((ruta.match(/telefonoEntrante: undefined, telefonoYa: undefined/g) ?? []).length, 2, '«Cambiar número» y «Usar otro número»');
  assert.match(sinComentarios(leer('lib/onboarding-arranque.ts')), /CAMBIAR_NUMERO\) return \{ ok: true, patch: \{[^}]*telefonoYa: undefined(?:, simulacion: undefined)? \} \}/);
});

test('4. la tarjeta del contacto queda en la conversación (no sólo en el último mensaje), con «Guardar contacto»', () => {
  const ui = sinComentarios(leer('app/onboarding/ChatArranqueV2.tsx'));
  assert.match(ui, /if \(m\.tarjeta === 'contacto'\) return <TarjetaContactoMako \/>;\n\s*if \(m\.id !== ultimoMako\?\.id\) return null;/);
  // En SU burbuja (20/11, Martín: la confirmación, la tarjeta y «Guárdame…» separados): sin el texto, sólo la tarjeta.
  assert.match(ui, /if \(m\.tarjeta === 'contacto'\) return t \? filaMako\(m\.id, <div className="arr-v2__en-mensaje">\{t\}<\/div>\) : null;/);
  const tarjeta = sinComentarios(leer('app/onboarding/TarjetaContactoMako.tsx'));
  assert.match(tarjeta, /download="MaKo\.vcf"/);
  assert.match(tarjeta, /TEL;TYPE=CELL;waid=\$\{WHATSAPP_MAKO\.numero\}/);
});
