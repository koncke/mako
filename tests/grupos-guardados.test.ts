// =============================================================================
// Qué grupos de WhatsApp se guardan, y qué NO se les hace
// =============================================================================
// El webhook descartaba TODOS los mensajes de grupo, y por eso los 24 audios del
// grupo «Makito» —11 minutos de feedback— están perdidos: Evolution no guarda la
// media, guarda el link del CDN de WhatsApp, y ese link caduca. Medido el
// 27/09/2026: el de un audio del 24/08 venció el 23/09 19:09 UTC.
//
// Abrir la puerta a un grupo es fácil; lo que NO puede pasar es que el grupo
// entre a la maquinaria de leads. Eso es lo que fija este archivo.
//
// Probado rompiéndolo — con el código como está, 6 pases y 0 fallos; rotas de a una:
//   · la lista pasa a ser negra («todos menos…»)     → 5 pasan / 1 falla
//   · el grupo vuelve a fabricar un teléfono         → 5 / 1
//   · el grupo puede pausar una nutrición            → 5 / 1
//   · vuelve el descarte total de `@g.us`            → 5 / 1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GRUPOS_GUARDADOS, grupoSeGuarda, esGrupoJid } from '../lib/grupos-guardados';

const sinComentarios = (t: string) => t.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const webhook = sinComentarios(readFileSync(join(import.meta.dirname, '../lib/evolution-mensajes.ts'), 'utf8'));

test('la lista es BLANCA: sólo entra lo que está nombrado', () => {
  // ⚠️ La línea de voz de MaKo es el WhatsApp PERSONAL de Martín — 77 grupos, con
  // «Primos 🇵🇾», «Círculo Financiero» y «LOS BUSTOS» adentro. Con una lista negra,
  // cada grupo nuevo entra por omisión y la vida privada de una persona termina en
  // la base del producto sin que nadie lo decida. Es la regla de AGENTS.md: un
  // guard sobre algo así se escribe en POSITIVO.
  assert.ok(grupoSeGuarda('120363411300409914@g.us'), 'Makito se guarda');
  for (const ajeno of [
    '120363315519703997@g.us',   // Primos 🇵🇾
    '120363027828100511@g.us',   // Círculo Financiero
    '5216862614375-1435517154@g.us', // LOS BUSTOS
    '120363411646661065@g.us',   // MaKo <> Mauricio Bustos — tampoco, hasta que se pida
  ]) {
    assert.ok(!grupoSeGuarda(ajeno), `${ajeno} NO se guarda: no está en la lista`);
  }
  assert.ok(!grupoSeGuarda('5491133334444@s.whatsapp.net'), 'un 1-a-1 no pasa por acá');
});

test('cada grupo de la lista dice POR QUÉ está', () => {
  // Sin el porqué, en tres meses nadie sabe si se puede sacar.
  for (const g of GRUPOS_GUARDADOS) {
    assert.ok(esGrupoJid(g.jid), `${g.nombre}: el jid tiene que ser de grupo`);
    assert.ok(g.nombre.trim(), 'con nombre');
    assert.ok(g.porque.trim().length > 40, `${g.nombre}: el porqué tiene que explicarse`);
  }
});

test('el webhook abre la puerta por NOMBRE, no por descarte', () => {
  assert.ok(/if \(esGrupo && !grupoSeGuarda\(chatJid\)\) return;/.test(webhook), 'la puerta consulta la lista');
  // Y el descarte viejo —que tiraba todo grupo— no puede seguir vivo.
  assert.ok(!/chatJid\.endsWith\('@g\.us'\) \|\| chatJid\.startsWith\('status@'\)\) return/.test(webhook), 'el descarte total se fue');
});

test('⚠️ un grupo NUNCA fabrica un teléfono', () => {
  // `jidToNumero('120363411300409914@g.us')` devuelve ese número de 18 dígitos. Si
  // entra como teléfono, `matchLeadPorTelefono` puede engancharlo con un lead real:
  // es el incidente de los 1.438 contactos, otra vez.
  assert.ok(
    /const telefono = esGrupo \|\| chatJid\.endsWith\('@lid'\) \? null :/.test(webhook),
    'el teléfono de un grupo es null, sin excepción',
  );
});

test('⚠️ un grupo NUNCA pausa la nutrición de nadie', () => {
  // Con el teléfono en null el lead no resuelve y la rama no se alcanza — pero la
  // protección se escribe igual, para que se LEA acá y no dependa de una implicación
  // a tres saltos de distancia.
  assert.ok(
    /if \(!esGrupo && !fromMe && leadId/.test(webhook),
    'la pausa de nutrición excluye a los grupos explícitamente',
  );
});

test('el inbox 1-a-1 sigue sin mostrar grupos', () => {
  // Guardarlos no puede convertirlos en una conversación de la bandeja: ahí se
  // listan personas, y un grupo sin teléfono se vería como un contacto roto.
  const filtros = (webhook.match(/endsWith\('@g\.us'\)/g) ?? []).length;
  assert.ok(filtros >= 3, `siguen los filtros del listado de conversaciones (hay ${filtros})`);
});
