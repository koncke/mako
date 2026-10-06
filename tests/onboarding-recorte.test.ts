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
  // la misma configuración eso es lo correcto (conectar el WhatsApp desde /whatsapp o
  // desde /chatbot); para los que no, es que terminar uno marque otro como hecho.
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

test('el botón de avance tiene tinta propia para su fondo, en TODAS las paletas', () => {
  // ⚠️ El onboarding fuerza el tema oscuro, y ahí `--primary` SUBE de luminosidad para
  // poder leerse como texto (#2F6FED → #7FA6F8). Un `#fff` clavado encima da 2,41:1 —
  // por debajo hasta del 3:1 de texto grande— en el ÚNICO control de avance, repetido
  // en las once pantallas del recorrido. No se vio antes porque hasta el 03/09/2026 el
  // wizard heredaba el tema claro del cliente.
  const shell = leer('../app/_components/WizardShell.tsx');
  assert.ok(!/avanza \? '#fff'/.test(shell),
    'el botón de avance volvió a clavar #fff sobre --primary: en oscuro eso es 2,41:1');
  assert.match(shell, /var\(--on-primary\)/, 'el botón de avance dejó de usar --on-primary');

  // El token tiene que existir en toda paleta que redefina --primary: si una lo cambia
  // y no declara su tinta, hereda la del `:root` — que es la del OTRO fondo.
  const css = leer('../app/globals.css');
  const bloques = [...css.matchAll(/--primary:\s*#[0-9A-Fa-f]{6}/g)].length;
  const tintas = [...css.matchAll(/--on-primary:\s*#[0-9A-Fa-f]{6}/g)].length;
  assert.ok(tintas >= bloques - 1,
    `hay ${bloques} definiciones de --primary y solo ${tintas} de --on-primary: alguna paleta hereda la tinta del otro fondo`);
});

test('el tema prestado se puede devolver', () => {
  // `TemaOscuro` decide si sacar el atributo mirando si YA estaba al montarse. Con
  // `TemaOscuroScript` puesto SIEMPRE estaba, así que el cleanup no sacaba nada nunca:
  // entrar a una pantalla oscura y volver por el sidebar —navegación de cliente, sin
  // documento nuevo— dejaba la app ENTERA oscura, incluido quien eligió el tema claro.
  // La marca que deja el script es lo único que distingue «prestado» de «propio».
  const script = sinComentarios(leer('../app/_components/TemaOscuroScript.tsx'));
  const comp = sinComentarios(leer('../app/_components/TemaOscuro.tsx'));
  assert.match(script, /data-tema-prestado/, 'el script dejó de marcar que el oscuro lo puso él');
  assert.match(comp, /data-tema-prestado/, 'el cleanup volvió a deducir el estado previo del atributo');
  assert.match(comp, /removeAttribute/, 'el cleanup dejó de devolver el tema');
});

test('el cliente que ya hizo la fábrica de creativos no la rehace', () => {
  // Los cinco pasos vivían en el onboarding global con otras claves, así que el estado
  // nuevo nace vacío y la tab figura pendiente hasta para quien la terminó hace meses.
  // Con el `requiere`, eso EXPULSA a ese cliente de /video-generator hacia un wizard sin
  // salida, a recargar lo que ya cargó.
  const puente = leer('../lib/copygen-puente.ts');
  for (const viejo of ['entregable', 'avatares', 'persona', 'personalidad', 'angulos']) {
    assert.ok(new RegExp(`'${viejo}'`).test(puente), `el puente no cubre el paso «${viejo}»`);
  }
  // Y las dos puertas lo corren ANTES de preguntar si falta.
  //
  // ⚠️ Se comparan las LLAMADAS (`await x(`), no los nombres: los tres símbolos
  // aparecen primero en sus `import`, así que buscar el nombre pelado compara el orden
  // de los imports y da un veredicto sobre otra cosa. La primera versión de este test
  // hacía exactamente eso y fallaba sobre código correcto.
  for (const p of ['../app/ads-writer/page.tsx', '../app/video-generator/page.tsx']) {
    const src = sinComentarios(leer(p));
    const iPuente = src.indexOf('await puentearPasosCopyGen(');
    const guards = ['await onboardingTabPendiente(', 'await onboardingRequeridoPara(']
      .map((g) => src.indexOf(g)).filter((i) => i >= 0);
    assert.ok(iPuente >= 0, `${p}: no llama al puente`);
    assert.ok(guards.length > 0, `${p}: no encontré la llamada al guard`);
    assert.ok(iPuente < Math.min(...guards),
      `${p}: el puente corre DESPUÉS del guard, así que no llega a tiempo`);
  }
});

test('la pantalla de cierre no ofrece caminos que la capa no puede abrir', () => {
  // La capa 'pm' hace onboarding y llega a esta pantalla, pero solo ve el plan y MaKo:
  // sus links a creativos, CRM, Retro y /general rebotan contra requireCapa y lo dejan
  // en otro lado sin explicación. Cuatro caminos ofrecidos y ninguno cumple.
  const route = sinComentarios(leer('../app/api/onboarding/listo/route.ts'));
  assert.match(route, /const ve = \{/, 'el endpoint dejó de calcular qué ve la capa');
  assert.match(route, /pendientes, config, ve \}/, 'el endpoint calcula `ve` y no lo devuelve');
  const listo = sinComentarios(leer('../app/onboarding/Listo.tsx'));
  for (const k of ['ve.creativos', 've.crm', 've.retro']) {
    assert.ok(listo.includes(k), `la pantalla de cierre no consulta ${k}`);
  }
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
