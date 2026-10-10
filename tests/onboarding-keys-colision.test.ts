// =============================================================================
// Dos tabs con la misma key de paso se marcan solas entre sí
// =============================================================================
// `onboarding.tab.pasos` es un registro POR WORKSPACE, no por tab: `marcarPasoTab`
// anota ahí toda key que se cierra, y `getEstadoTab` da un paso por hecho «si lo
// marcó ESTA tab o si ya lo hizo otra». Eso es correcto y deliberado — conectar el
// WhatsApp desde /whatsapp tiene que contar también en /automations, porque es el mismo
// número visto desde dos puertas.
//
// Lo que NO es correcto es que dos pasos DISTINTOS compartan nombre. Ahí el cruce
// deja de ser una comodidad y pasa a ser un salteo: la segunda tab da por hecha una
// pantalla que nadie vio.
//
// ── POR QUÉ HACE FALTA ESTE TEST Y NO ALCANZABAN LOS TRES QUE YA HABÍA ──────
//
// El catálogo advierte esta trampa CUATRO veces en prosa. Y aun así, el 03/09/2026
// se midió viva en dos clientes: `instagram` usaba `contexto` y `ensayo` a secas,
// las mismas dos keys del Chat Agent. En el ws11, `instagram.contexto` tiene el
// timestamp 2026-08-10T20:36:51.948Z y el `contexto` del Chat Agent tiene
// ...52.603Z — 0,6 s después: lo marcó /automations. El ws13, igual.
//
// Lo caro es el segundo paso: el ensayo de Instagram previsualiza el borrador de un
// DM, y saltearlo enciende el auto-respondedor sin que nadie haya leído una sola
// respuesta.
//
// Los tres tests que ya existían son todos de la forma «mis pasos empiezan con MI
// prefijo», uno por tab (`cg_`, `vg_`). Un test así es ESTRUCTURALMENTE incapaz de
// encontrar esta colisión, porque las dos tabs que colisionaban no tenían ninguna
// regla de prefijo que romper. La pregunta que hay que hacerle al catálogo no es
// «¿esta tab respeta su prefijo?» sino «¿qué key aparece en más de una tab?».
//
// ⚠️ Y LA LISTA BLANCA ES EL PUNTO. Un test que sólo prohibiera repetir dejaría
// afuera los pasos que se comparten A PROPÓSITO, que son reales. Al declararlos acá
// —uno por uno, con el porqué— compartir una key pasa a ser una DECISIÓN escrita en
// vez de un descuido que nadie ve.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TAB_ONBOARDINGS } from '../lib/tab-onboarding-catalogo';

/**
 * Las keys que SÍ se comparten, y por qué. Cada una es la misma configuración
 * vista desde dos puertas: hacerla en una tab tiene que contar en la otra.
 *
 * Sumar algo acá es declarar «estas dos tabs configuran LO MISMO». Si no lo son,
 * lo que falta es un prefijo, no una entrada en esta lista.
 */
const COMPARTIDAS_A_PROPOSITO: Record<string, string> = {
  wa_no_oficial: 'El WhatsApp por QR: el mismo número en /whatsapp y en /automations.',
  // 05/10/2026 — se fueron seis, y las dos razones están en el producto:
  //  · /automations dejó de ser un wizard (#833): su lista quedó en UN paso, el QR, así que
  //    `wa_no_oficial_prueba`, `email_conectar` y `email_prueba` ya no las comparte con nadie
  //    (viven en /whatsapp y en /email, cada una en su tab).
  //  · el WhatsApp OFICIAL salió del producto (#832): `wa_oficial`, `wa_oficial_plantilla` y
  //    `wa_oficial_prueba` no están en ninguna tab.
  // Quedan declaradas abajo SOLO si vuelven a aparecer en dos listas a la vez.
  // 06/10/2026 — se fue `conectar` (la cuenta de Instagram, que compartían Instagram,
  // Reels y Stories): la tab Instagram salió del producto y Reels y Stories ya no
  // piden ninguna cuenta.
};

test('ninguna key de paso aparece en dos tabs sin estar declarada como compartida', () => {
  const donde = new Map<string, string[]>();
  for (const [tab, def] of Object.entries(TAB_ONBOARDINGS)) {
    for (const p of def.pasos) {
      donde.set(p.key, [...(donde.get(p.key) ?? []), tab]);
    }
  }

  const colisiones = [...donde.entries()]
    .filter(([key, tabs]) => tabs.length > 1 && !(key in COMPARTIDAS_A_PROPOSITO))
    .map(([key, tabs]) => `«${key}» está en ${tabs.join(' y ')}`);

  assert.deepEqual(
    colisiones, [],
    'Estas keys se marcan solas entre tabs vía onboarding.tab.pasos.\n'
    + 'Si son la MISMA configuración vista desde dos puertas, declaralas en\n'
    + 'COMPARTIDAS_A_PROPOSITO con el porqué. Si NO lo son, ponele a cada una el\n'
    + 'prefijo de su tab (`ig_`, `reels_`, `carousels_`…), que es lo que ya hacen\n'
    + 'las demás:\n  ' + colisiones.join('\n  '),
  );
});

test('lo declarado como compartido existe de verdad en más de una tab', () => {
  // ⚠️ El inverso, y no es simetría por prolijidad: una lista blanca que sobrevive
  // al paso que la justificaba deja permiso escrito para una colisión FUTURA — la
  // próxima tab que estrene esa key entra en silencio, autorizada por una entrada
  // que ya no describe nada.
  const donde = new Map<string, string[]>();
  for (const [tab, def] of Object.entries(TAB_ONBOARDINGS)) {
    for (const p of def.pasos) donde.set(p.key, [...(donde.get(p.key) ?? []), tab]);
  }

  const sobran = Object.keys(COMPARTIDAS_A_PROPOSITO)
    .filter((k) => (donde.get(k) ?? []).length < 2);

  assert.deepEqual(
    sobran, [],
    'Estas keys están declaradas como compartidas y hoy no las comparte nadie.\n'
    + 'Sacalas de COMPARTIDAS_A_PROPOSITO: si no, autorizan una colisión que todavía\n'
    + 'no existe:\n  ' + sobran.join('\n  '),
  );
});

// Acá vivía «los pasos de Instagram no comparten key con el Chat Agent», que fijaba
// por su nombre el caso medido del 03/09/2026. La tab Instagram salió del producto el
// 06/10/2026 (decisión de Martín) y con ella su onboarding: el caso general lo siguen
// cubriendo los dos tests de arriba, y que la tab no vuelva lo cuida
// tests/sin-instagram.test.ts.
