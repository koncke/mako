// =============================================================================
// Un DM pagado de Instagram no deja un lead huérfano con el anuncio (17/10/2026)
// =============================================================================
// docs/relevo/crm-tanda-b1.md (revisión de b4): en un anuncio click-to-DM, Meta manda dos mensajes de la misma persona
// nueva casi juntos —el primero sin `referral`, el segundo con el anuncio—. Los dos pedidos ven `lead_id` null y los dos
// crean un lead; el compare-and-set de `ig_conversaciones` deja uno. El otro quedaba HUÉRFANO con `meta_ad_id`, la
// entrada y el @: las métricas por anuncio le contaban un lead que nunca agenda y el real quedaba sin atribuir.
// Ahora (lib/zernio-entrante.ts, `quitarHuerfano`) el que perdió se borra y le pasa al que ganó el anuncio y la entrada
// sólo si no los tiene. Asserts sobre el fuente (el módulo lleva `server-only`).
//
// Probado rompiéndolo (17/10/2026; base 3 / 0). Una rotura por vez, restaurando (pasan / fallan):
//   · crearLeadDe sin llamar a quitarHuerfano al perder                    -> 2 / 1
//   · el anuncio se le pisa al ganador (sin `.is('meta_ad_id', null)`)     -> 2 / 1
//   · se borra aunque el ganador sea el mismo lead                         -> 2 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(import.meta.dirname, '..', 'lib/zernio-entrante.ts'), 'utf8').replace(/\r\n/g, '\n');
const cuerpo = (firma: string): string => {
  const i = SRC.indexOf(firma);
  assert.ok(i >= 0, `no encontré ${firma}`);
  return SRC.slice(i, SRC.indexOf('\n}\n', i));
};

test('al perder el compare-and-set, el lead recién creado se quita y se devuelve el que ganó', () => {
  const c = cuerpo('async function crearLeadDe(');
  assert.match(c, /await quitarHuerfano\(lead\.id, ganador, e\.anuncioId \?\? null, entrada\);\s*console\.warn\([^\n]*\);\s*return ganador;/);
});

test('al ganador se le pasa el anuncio y la entrada SÓLO si no los tiene', () => {
  const q = cuerpo('async function quitarHuerfano(');
  assert.match(q, /\.update\(\{ meta_ad_id: anuncioId \}\)\.eq\('id', ganador\)\.is\('meta_ad_id', null\)/);
  assert.match(q, /\.update\(\{ entrada_social: entrada \}\)\.eq\('id', ganador\)\.is\('entrada_social', null\)/);
});

test('nunca se borra el lead que quedó unido', () => {
  const q = cuerpo('async function quitarHuerfano(');
  const iGuarda = q.indexOf('if (ganador === huerfano) return;');
  const iBorra = q.indexOf("borrarLeadConCamino(db, ws, huerfano, 'zernio_duplicado'");
  assert.ok(iGuarda > 0 && iBorra > iGuarda, 'la guarda va antes del borrado');
});
