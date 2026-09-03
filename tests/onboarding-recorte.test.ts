// =============================================================================
// El onboarding se recortó, y los cinco pasos que salieron aterrizaron en otra tab
// =============================================================================
// EL CAMBIO, del 03/09/2026. El onboarding global pedía 12 pasos antes de dejar entrar
// a nadie, y cinco de ellos —lead magnet, avatares, cara de marca, personalidad,
// matriz— son la FÁBRICA DE CREATIVOS, o sea la configuración de una tab. Se mudaron al
// Copy Generator (/ads-writer), que es donde se usan, y el Video Generator quedó detrás
// de él: primero el guion, después el video.
//
// Estos tests existen porque la mudanza toca cuatro reglas que fallan EN SILENCIO, y
// tres de las cuatro ya se cobraron una vez en este repo:
//
//   1. Dos listas de pasos que tienen que decir lo mismo (el catálogo y la pantalla).
//      El 02/09/2026 se desfasaron en el Video Generator y el paso 1 pedía completar el
//      paso 2, sin forma de avanzar, con un cliente delante.
//   2. Las keys de pasos colisionan entre tabs vía KEY_PASOS_COMPARTIDOS: terminar el
//      ensayo de una marca el de otra como hecho. Documentado tres veces en el catálogo
//      porque ya pasó dos.
//   3. Sacar pasos de una capa deja código apuntándoles. Lo que se saca del RECORRIDO
//      tiene que seguir existiendo en el CATÁLOGO, o el estado guardado del cliente que
//      ya los contestó deja de tener dónde vivir.
//   4. El requisito entre tabs tiene que mirarse ANTES del propio. Mirarlo después es no
//      mirarlo nunca.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TAB_ONBOARDINGS } from '../lib/tab-onboarding-catalogo';
import { CAPAS, PASOS_ONBOARDING } from '../lib/capas';

const leer = (p: string) => readFileSync(resolve(import.meta.dirname, p), 'utf8');

/** El fuente sin comentarios: las aserciones en negativo matchean la PROSA que explica
 *  el bug si no se los saca, y ya pasó — un test que se encuentra a sí mismo. */
const sinComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

test('la pantalla del Copy Generator y el catálogo declaran los MISMOS pasos, en el mismo orden', () => {
  // `marcarPasoTab` valida contra el catálogo en el server: no deja cerrar un paso si
  // falta uno ANTERIOR de esa lista. Si las dos listas se desfasan, el primer paso
  // devuelve «antes falta completar X» —que es el segundo— y no hay salida.
  const def = TAB_ONBOARDINGS['ads-writer'];
  assert.ok(def, 'desapareció el onboarding del Copy Generator');

  const pantalla = leer('../app/ads-writer/OnboardingCopyGen.tsx');
  const m = /const PASOS = \[([^\]]*)\] as const/.exec(pantalla);
  assert.ok(m, 'no encontré el array PASOS de OnboardingCopyGen');
  const enPantalla = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);

  assert.deepEqual(
    enPantalla,
    def.pasos.map((p) => p.key),
    'la pantalla y el catálogo del Copy Generator dejaron de decir lo mismo: el wizard queda sin forma de avanzar',
  );
});

test('las keys del Copy Generator no colisionan con las de ninguna otra tab', () => {
  // KEY_PASOS_COMPARTIDOS es un registro POR WORKSPACE con las keys peladas: dos tabs
  // que usan la misma key comparten el paso, esté o no pensado. Para los pasos que SON
  // la misma configuración eso es lo correcto (conectar Instagram desde Reels o desde
  // Stories); para los que no, es que terminar uno marque otro como hecho.
  const mias = new Set(TAB_ONBOARDINGS['ads-writer'].pasos.map((p) => p.key));
  for (const k of mias) {
    assert.ok(k.startsWith('cg_'), `el paso «${k}» del Copy Generator perdió el prefijo cg_`);
  }
  for (const [tab, def] of Object.entries(TAB_ONBOARDINGS)) {
    if (tab === 'ads-writer') continue;
    for (const p of def.pasos) {
      assert.ok(!mias.has(p.key), `la tab «${tab}» usa «${p.key}», que también es del Copy Generator`);
    }
  }
});

test('el Video Generator va DESPUÉS del Copy Generator', () => {
  // «Primero va el guion y luego el video… si no está hecho el primero, no debería
  // dejarte hacer el segundo». Lo que filma esta tab son los guiones que se escriben
  // en la otra: sin ellos abre con una lista vacía y ninguna explicación.
  assert.equal(TAB_ONBOARDINGS['video-generator'].requiere, 'ads-writer',
    'el Video Generator dejó de depender del Copy Generator');
});

test('el requisito se mira ANTES del onboarding propio', () => {
  // Mirarlo después es no mirarlo: la tab de atrás tiene su propio recorrido pendiente
  // también, así que el propio ganaría siempre y el requisito no ataría nada.
  const src = sinComentarios(leer('../lib/tab-onboarding-state.ts'));
  const iReq = src.indexOf('def?.requiere');
  const iPropio = src.indexOf('onboardingTabPendiente(tab)');
  assert.ok(iReq >= 0, 'onboardingRequeridoPara dejó de mirar el requisito');
  assert.ok(iPropio >= 0, 'no encontré la rama del onboarding propio');
  assert.ok(iReq < iPropio, 'el requisito volvió a mirarse DESPUÉS del propio: no ata nada');
});

test('la cadena de requisitos tiene tope: un ciclo en el catálogo no cuelga el render', () => {
  // Un dato mal escrito no puede colgar una page. Y el catálogo de HOY tampoco puede
  // tener un ciclo — se comprueba recorriéndolo, no confiando en el tope.
  const src = sinComentarios(leer('../lib/tab-onboarding-state.ts'));
  assert.match(src, /saltos\s*<\s*\d+/, 'la cadena de `requiere` se recorre sin tope');

  for (const [tab, def] of Object.entries(TAB_ONBOARDINGS)) {
    const vistos = new Set([tab]);
    let cur = def.requiere;
    while (cur) {
      assert.ok(!vistos.has(cur), `ciclo de \`requiere\` en el catálogo, entrando por «${tab}»`);
      vistos.add(cur);
      assert.ok(TAB_ONBOARDINGS[cur], `«${tab}» requiere «${cur}», que no existe en el catálogo`);
      cur = TAB_ONBOARDINGS[cur].requiere;
    }
  }
});

test('el onboarding global ya no pide la fábrica de creativos', () => {
  const mudados = ['entregable', 'avatares', 'persona', 'personalidad', 'angulos'] as const;
  for (const paso of mudados) {
    assert.ok(!CAPAS.completo.onboarding.includes(paso),
      `«${paso}» volvió al onboarding global: vive en el Copy Generator`);
  }
  // Y la Retro pasó a ser una OPCIÓN de la pantalla final, no un paso obligatorio.
  assert.ok(!CAPAS.completo.onboarding.includes('retro'),
    'la Retro volvió a ser un paso del wizard en vez de una opción del cierre');
});

test('lo que salió del RECORRIDO sigue existiendo en el CATÁLOGO', () => {
  // ⚠️ Son dos cosas distintas y confundirlas rompe al cliente que ya contestó. El
  // estado guarda TODOS los pasos posibles aunque la capa muestre unos pocos: así,
  // quien ya cargó sus avatares no los vuelve a cargar si mañana suben de capa. Borrar
  // la key del catálogo tira ese dato al piso.
  for (const paso of ['entregable', 'avatares', 'persona', 'personalidad', 'angulos', 'retro']) {
    assert.ok((PASOS_ONBOARDING as readonly string[]).includes(paso),
      `se borró «${paso}» del catálogo de pasos: el cliente que ya lo contestó pierde el dato`);
  }
});

test('toda capa recorre pasos que existen', () => {
  for (const [id, capa] of Object.entries(CAPAS)) {
    for (const paso of capa.onboarding) {
      assert.ok((PASOS_ONBOARDING as readonly string[]).includes(paso),
        `la capa «${id}» recorre «${paso}», que no está en PASOS_ONBOARDING`);
    }
  }
});

test('cada onboarding de tab tiene un nombre corto legible', () => {
  // La pantalla final los nombra dentro de una frase («Te falta: Copy Generator ·
  // Video Generator · WhatsApp»). Derivarlo del título con un regex daba «generador de
  // video» y «email», medido contra el catálogo real.
  for (const [tab, def] of Object.entries(TAB_ONBOARDINGS)) {
    assert.ok(def.nombre, `la tab «${tab}» no declara \`nombre\`: se va a nombrar con su título entero`);
    assert.match(def.nombre!, /^[A-ZÁÉÍÓÚÑ]/,
      `el nombre de «${tab}» («${def.nombre}») arranca en minúscula: queda mal dentro de una frase`);
    assert.ok(!/^Configuraci/i.test(def.nombre!),
      `el nombre de «${tab}» todavía es el título completo`);
  }
});

test('el wizard global no promete una tab que ya no es su destino', () => {
  // Terminar el onboarding ya NO redirige a /plan: levanta la pantalla de cierre, donde
  // el cliente elige. Un botón que dice «Ver mi plan →» y aterriza en otra cosa es la
  // clase de mentira chica que hace que nadie lea los botones.
  const src = leer('../app/onboarding/OnboardingWizard.tsx');
  assert.ok(/setCierre\(/.test(src), 'el wizard dejó de levantar la pantalla de cierre');
  assert.ok(!/confirmLabel=\{[^}]*'Ver mi plan/.test(sinComentarios(src)),
    'el botón final volvió a prometer /plan');
});

test('la pantalla de cierre no manda a ningún lado sin la pestaña del cliente', () => {
  // La CUARTA forma de navegar. Un link sin `?ws=` no falla: te deja mirando otra cuenta.
  const src = sinComentarios(leer('../app/onboarding/Listo.tsx'));
  const hrefs = [...src.matchAll(/href=\{([^}]*)\}/g)].map((m) => m[1]);
  assert.ok(hrefs.length > 0, 'no encontré ningún link en la pantalla de cierre');
  for (const h of hrefs) {
    assert.match(h, /conWs\(/, `un link de la pantalla de cierre no pasa por conWs(): ${h}`);
  }
});
