// =============================================================================
// Los paquetes: el piso que manda es UNO, y no es el que parece (7/11/2026)
// =============================================================================
// El 7/11 recomendé US$3 el clip usando como piso «lo que el plan cobra por clip» (US$2,69). Eso
// daba un paquete de US$90 por 5 minutos contra un plan de US$97 que da 6 minutos Y todo el
// producto: absurdo, y lo cazó Martín. La causa: **el plan no cobra clips, cobra el producto.**
//
// Estos tests fijan esa distinción, que es la que se vuelve a perder: `respetaElPiso` mira el
// marginal y SOLO el marginal, y un precio que pase el promedio del plan pero no el marginal tiene
// que dar falso.
//
// Correr: node --import tsx --test tests/mako-tokens-paquetes.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  USD_POR_CLIP, USD_POR_CLIP_SUELTO, USD_POR_MINUTO_SUELTO, CLIPS_POR_MINUTO, CLIPS_POR_MES, MT_POR_CLIP, MT_POR_MINUTO, PAQUETES,
  pisoMarginal, pisoPorMinuto, rateDelPlan, respetaElPiso, paqueteDeMinutos, gananciaDe, margenDe, minutosDelPlan,
  IMAGENES_POR_MES, IMAGENES_POR_CLIP, GENERA_VIDEO, USD_DEL_PLAN, MT_POR_DOLAR, MARGEN_BRUTO_DEL_EXTRA,
} from '../lib/mako-tokens-paquetes';
import {
  CUPO_MENSUAL, IMAGENES_DEL_CUPO, MINUTOS_DEL_CUPO_PRO, MT_POR_IMAGEN, MT_POR_USD, PISO_DE_MARGEN_BRUTO, USD_POR_SEGUNDO,
  mtDeImagenes, mtDeVideo, usdDeMt,
} from '../lib/mako-tokens-reglas';
import { MODELOS_VIDEO, MODELO_OMNI } from '../lib/apimart-reglas';

// =============================================================================
// EL CUPO ES UNA BOLSA SOLA, Y ESO ES LO QUE HAY QUE PROTEGER (15/11/2026)
// =============================================================================
// La pregunta de Martín que lo destapó: «si una persona no genera 500 imágenes, le alcanzaría para generar más videos,
// más clips, ¿no?». Sí — y los topes por tipo se lo impedían sin ninguna razón.
//
// ⚠️ LOS TOPES POR TIPO ERAN UN PARCHE DE UN PRECIO MAL PUESTO, y es el hallazgo que vale guardar. Nacieron esa misma
// mañana porque a Martín le preocupaba «que genere una cantidad de videos y de imágenes que no debería», y la
// preocupación era REAL: el clip se cobraba 500 MT cuando costaba 896, así que el cupo no era un techo — se podía
// gastar MÁS de lo que el cupo decía. Arreglado el precio del token (al costo), el cupo volvió a ser el techo y el tope
// quedó sin trabajo. **Un tope que tapa un precio mal puesto parece una protección y es un parche; se arregla el precio
// y el tope se cae solo.**
//
// LO QUE ESTOS TESTS FIJAN AHORA:
//   1. que el de US$47 NO genere video (el único tope que queda, y es de producto, no de margen);
//   2. que los extremos de la bolsa se DERIVEN del cupo y no se escriban a mano;
//   3. y la propiedad que hace segura la bolsa única: **ninguna mezcla puede bajar el margen**, porque el token se cobra
//      al costo y entonces el gasto máximo de un cliente es su cupo, gaste en lo que gaste.
// =============================================================================

test('el de US$47 no genera video: es el único tope por tipo que queda', () => {
  assert.equal(GENERA_VIDEO.pro, false, 'el plan de US$47 no genera video');
  assert.equal(GENERA_VIDEO.growth, true, 'el de US$97 sí');
  assert.equal(CLIPS_POR_MES.pro, 0, 'y por eso su extremo de video es cero');
  assert.equal(minutosDelPlan('pro'), 0);
  assert.equal(CLIPS_POR_MES.free, 1, 'la prueba de 7 días da UN clip, no un video');
  // Coherencia: un plan que no genera video no puede tener clips, y uno que sí, no puede tener cero.
  for (const plan of ['free', 'pro', 'growth'] as const) {
    assert.equal(CLIPS_POR_MES[plan] > 0, GENERA_VIDEO[plan],
      `${plan}: GENERA_VIDEO dice ${GENERA_VIDEO[plan]} y tiene ${CLIPS_POR_MES[plan]} clips`);
  }
});

test('las cifras que se PROMETEN son redondas, y la bolsa las compra exactas', () => {
  // ⚠️ LA VITRINA Y LA BOLSA TIENEN QUE DAR EL MISMO NÚMERO POR LOS DOS CAMINOS (15/11/2026). Martín: «en el de $47 haz
  // que se redondee a 1000 imágenes, porque eso queda marketinero». Se decide el número redondo y el cupo es su costo;
  // esta igualdad es la que se rompe si alguien pone un cupo que no es múltiplo exacto del costo de una imagen, y
  // entonces la vitrina promete 1.000 y la bolsa compra 999. Vale por los dos lados a propósito.
  for (const plan of ['free', 'pro', 'growth'] as const) {
    assert.equal(IMAGENES_POR_MES[plan], IMAGENES_DEL_CUPO[plan],
      `${plan}: la vitrina promete ${IMAGENES_DEL_CUPO[plan]} imágenes y el cupo compra ${IMAGENES_POR_MES[plan]}`);
    // Lo que sobra después de la última imagen tiene que ser MENOS que una imagen: ni se promete de más ni queda una sin
    // prometer. Decía «múltiplo exacto de 12», y valía mientras el cupo de los dos planes se decidía en imágenes; desde el
    // 17/11/2026 el de US$47 se decide proporcional (7.000) y le sobran 4 MT, que pagan texto.
    const resto = CUPO_MENSUAL[plan] - IMAGENES_DEL_CUPO[plan] * MT_POR_IMAGEN.normal;
    assert.ok(resto >= 0 && resto < MT_POR_IMAGEN.normal, `${plan}: su cupo de ${CUPO_MENSUAL[plan]} MT deja ${resto} sin prometer`);
  }
  // ⚠️ EL DE US$47 ES PROPORCIONAL AL DE US$97 (17/11/2026). Martín: «no tiene sentido de que en el de 97 le demos 14.400 y
  // en el de 47 12.000 tokens. Tiene que ser proporcional». 14.400 × 47 ÷ 97 = 6.977 → 7.000 (la centena más cercana). Si
  // se toca el cupo del de US$97, esto se pone rojo y pide recalcular el del de US$47: no se arrastra solo a propósito,
  // porque es un número que lee un cliente.
  assert.equal(CUPO_MENSUAL.pro, 7_000);
  assert.equal(CUPO_MENSUAL.pro, Math.round((CUPO_MENSUAL.growth * USD_DEL_PLAN.pro) / USD_DEL_PLAN.growth / 100) * 100,
    'el cupo del de US$47 dejó de ser proporcional al del de US$97');
  assert.ok(Math.abs(usdDeMt(CUPO_MENSUAL.pro) / USD_DEL_PLAN.pro - usdDeMt(CUPO_MENSUAL.growth) / USD_DEL_PLAN.growth) < 0.001,
    'por dólar, los dos planes tienen que dar lo mismo de IA (a una décima de punto)');
  assert.equal(IMAGENES_DEL_CUPO.pro, 583, 'sus imágenes salen del cupo: 7.000 ÷ 12');
  // ⚠️ El de US$97 se decide en MINUTOS desde el 17/11/2026 (Martín, la opción B: 10 minutos), y sus imágenes son la
  // consecuencia: 1.200. Lo redondo ahí son los minutos, y la bolsa los compra exactos.
  assert.equal(MINUTOS_DEL_CUPO_PRO, 10, 'el de US$97 trae 10 minutos de video');
  assert.equal(CUPO_MENSUAL.growth, MINUTOS_DEL_CUPO_PRO * MT_POR_MINUTO, 'el cupo del de US$97 es lo que cuestan sus minutos');
  assert.equal(CUPO_MENSUAL.growth, 14_400);
  assert.equal(minutosDelPlan('growth'), MINUTOS_DEL_CUPO_PRO, 'y la bolsa compra los 10 minutos exactos, sin resto');
  assert.equal(IMAGENES_DEL_CUPO.growth % 100, 0, 'sus imágenes también se leen: 1.200');
});

test('los extremos de la bolsa salen del CUPO, no de un número escrito a mano', () => {
  // Todo en video, o todo en imágenes: son los dos extremos de la MISMA bolsa, no dos cajones.
  assert.equal(CLIPS_POR_MES.growth, Math.floor(CUPO_MENSUAL.growth / MT_POR_CLIP),
    'los clips del de US$97 tienen que ser lo que su cupo compra, nada más');
  for (const plan of ['free', 'pro', 'growth'] as const) {
    assert.equal(IMAGENES_POR_MES[plan], Math.floor(CUPO_MENSUAL[plan] / mtDeImagenes(1)),
      `las imágenes de ${plan} tienen que ser lo que su cupo compra`);
  }
  // La equivalencia que explica la bolsa en una línea, y que es lo que se le dice al cliente.
  assert.equal(IMAGENES_POR_CLIP, MT_POR_CLIP / mtDeImagenes(1));
  assert.equal(IMAGENES_POR_CLIP, 20, 'cada clip de 10 s que no hace le compra 20 imágenes más (con el clip de Kling eran 75)');
  assert.equal(MT_POR_MINUTO / mtDeImagenes(1), 120, 'y cada minuto, 120');
  // El plan barato tiene menos de todo, porque tiene menos bolsa.
  assert.ok(IMAGENES_POR_MES.pro < IMAGENES_POR_MES.growth, 'el plan barato tiene una bolsa más chica');
});

test('NINGUNA mezcla puede bajar del piso de margen: el cupo es el techo, gaste en lo que gaste', () => {
  // Esta es LA propiedad que hace segura la bolsa única, y la razón por la que los topes por tipo no hacían falta.
  //
  // ⚠️ EL TECHO ES `PISO_DE_MARGEN_BRUTO`, NO EL 25% CLAVADO QUE DECÍA ACÁ (15/11/2026). Las 1.000 imágenes redondas del
  // de US$47 cuestan 25,5% de su precio, así que este test se puso rojo con la decisión de Martín ADENTRO — y un test que
  // se pone rojo porque el dueño decidió algo tiene mal escrito el límite, no el número. El límite real es el margen que
  // el negocio no baja, y vive en una constante con el porqué al lado; el 25% era una meta, no un piso.
  for (const [plan, precio] of [['pro', USD_DEL_PLAN.pro], ['growth', USD_DEL_PLAN.growth]] as const) {
    const techo = usdDeMt(CUPO_MENSUAL[plan]);
    assert.ok(1 - techo / precio >= PISO_DE_MARGEN_BRUTO - 1e-9,
      `${plan}: su cupo vale US$${techo} de un precio de US$${precio}, o sea ${((1 - techo / precio) * 100).toFixed(1)}% de margen, y el piso es ${PISO_DE_MARGEN_BRUTO * 100}%`);
    // Y se comprueba con mezclas reales, no sólo con la cuenta: cualquier combinación que entre en el cupo cuesta menos
    // que el cupo. Se recorre de 0 clips hasta el máximo, llenando el resto con imágenes.
    for (let clips = 0; clips <= CLIPS_POR_MES[plan]; clips++) {
      const mtClips = clips * MT_POR_CLIP;
      const imgs = Math.floor((CUPO_MENSUAL[plan] - mtClips) / mtDeImagenes(1));
      const gasto = mtClips + mtDeImagenes(imgs);
      assert.ok(gasto <= CUPO_MENSUAL[plan],
        `${plan}: ${clips} clips + ${imgs} imágenes piden ${gasto} MT de un cupo de ${CUPO_MENSUAL[plan]}`);
      assert.ok(1 - usdDeMt(gasto) / precio >= PISO_DE_MARGEN_BRUTO - 1e-9,
        `${plan}: la mezcla de ${clips} clips + ${imgs} imágenes deja ${((1 - usdDeMt(gasto) / precio) * 100).toFixed(1)}% de margen`);
    }
  }
});

test('el precio decidido pasa el piso, y uno por debajo no', () => {
  assert.equal(respetaElPiso(USD_POR_CLIP_SUELTO), true, `US$${USD_POR_CLIP_SUELTO} tiene que pasar`);
  // ⚠️ Y EMPATA EL PISO, A PROPÓSITO (17/11/2026): el minuto extra sale US$5, lo mismo que cada minuto del salto de US$47
  // a US$97 (US$50 ÷ 10). Empatar alcanza porque el de US$47 no genera video: recargando no consigue ni un segundo.
  assert.equal(GENERA_VIDEO.pro, false, 'si el de US$47 volviera a generar video, empatar el piso ya no alcanzaría');
  assert.equal(USD_POR_MINUTO_SUELTO, 5, 'el minuto extra sale US$5 exactos');
  assert.equal(pisoPorMinuto(), 5, 'y el minuto del escalón, también');
  // ⚠️ EL EJEMPLO SE DERIVA DEL PISO, no se escribe a mano (15/11/2026). Acá decía `1.5`, que estaba debajo del piso de ese
  // momento (US$1,667) y quedó ARRIBA cuando el de US$97 volvió a 6 minutos y el piso bajó a US$1,389. El test se puso rojo
  // diciendo «por debajo del piso» sobre un precio que ya no lo estaba — el mismo error que el del divisor clavado, dos
  // tests más arriba, y en el mismo archivo. Un ejemplo numérico de un límite MÓVIL tiene que moverse con el límite.
  assert.equal(respetaElPiso(pisoMarginal()! * 0.9), false, 'por debajo del piso, a un Pro le conviene recargar antes que subir');
  // Empatar el piso alcanza SÓLO con el candado de video (ver arriba y `respetaElPiso`).
  assert.equal(respetaElPiso(pisoMarginal()!), !GENERA_VIDEO.pro, 'con el candado, empatar alcanza; sin él, no');
});

test('el precio suelto nunca es más barato que subir de plan: el escalón se sostiene', () => {
  // Decía «siempre MÁS caro». Desde el 17/11/2026 es IGUAL (US$5 el minuto por los dos caminos) y el escalón lo sostiene el
  // candado de video del de US$47: ver `respetaElPiso`.
  const piso = pisoMarginal()!;
  assert.ok(USD_POR_CLIP_SUELTO >= piso - 1e-9,
    `el clip suelto (US$${USD_POR_CLIP_SUELTO}) no puede salir menos que subir de plan (US$${piso.toFixed(2)})`);
});

test('un paquete se arma por minutos y los MT salen de la unidad, no del precio', () => {
  const p = paqueteDeMinutos(1);
  assert.equal(p.clips, CLIPS_POR_MINUTO);
  assert.equal(p.usd, USD_POR_MINUTO_SUELTO, 'un minuto sale lo que dice la tarifa: US$5');
  assert.equal(p.mt, CLIPS_POR_MINUTO * MT_POR_CLIP, 'los MT miden COSTO: no se mueven si cambia el precio');
});

// ⚠️ EL MARGEN DEL PAQUETE TIENE QUE SER **EL MISMO** QUE EL DEL PLAN, y el 15/11/2026 Martín lo pidió con esas palabras:
// «tampoco tienes que reducir el porcentaje de los MaKo Tokens. Debería quedarnos más o menos el mismo margen de ganancia».
// Con la tarifa (`MT_POR_DOLAR` = 250) sale EXACTO y no «más o menos»: US$1 compra 250 MT, que cuestan US$0,25 → 75%, que es
// el mismo 25% del precio que el plan destina a IA. Antes el paquete se vendía por minutos a un precio puesto a mano, y el
// margen quedaba a la deriva del costo del modelo: con el clip de Omni, el minuto a US$18 dejaba 70% sin que nadie lo
// decidiera. Lo que este test fija es que no se pueda volver a desacoplar.
// ⚠️ 17/11/2026: EL MARGEN DEL EXTRA DEJÓ DE SER EL DEL PLAN, POR DECISIÓN DE MARTÍN. El 16/11: «si compran de más, sí
// estaría bueno como reducir tal vez un poco ese margen»; el 17/11 eligió la opción B: US$1 = 288 MT, lineal, 71,2% bruto de
// IA. Lo que este test fija ahora es que el margen del extra sea UNO solo (la tarifa es lineal), que salga de la tarifa y no
// de un número a mano, y que nunca se venda un MT por debajo de lo que cuesta.
test('los paquetes dejan el margen de la tarifa, uno solo, y nunca venden por debajo del costo', () => {
  assert.ok(PAQUETES.length >= 3);
  const margenes = PAQUETES.map(margenDe);
  for (const m of margenes) assert.ok(Math.abs(m - margenes[0]) < 1e-9, 'un paquete con otro margen pide explicar por qué');
  assert.ok(Math.abs(margenes[0] - MARGEN_BRUTO_DEL_EXTRA) < 1e-9, 'el margen del paquete ES el de la tarifa');
  assert.ok(Math.abs(MARGEN_BRUTO_DEL_EXTRA - 0.712) < 1e-9, `la opción B deja 71,2% y dio ${(MARGEN_BRUTO_DEL_EXTRA * 100).toFixed(1)}%`);
  assert.ok(MT_POR_DOLAR < MT_POR_USD, 'un dólar no puede comprar más MaKo Tokens de los que cuesta');
  // Y el plan sigue dejando más que el extra: el extra rinde más, el plan es el producto.
  const margenDelPlan = 1 - usdDeMt(CUPO_MENSUAL.growth) / USD_DEL_PLAN.growth;
  assert.ok(margenDelPlan > MARGEN_BRUTO_DEL_EXTRA, `el plan deja ${(margenDelPlan * 100).toFixed(1)}% y el extra ${(MARGEN_BRUTO_DEL_EXTRA * 100).toFixed(1)}%`);
  // Redondos en DÓLARES y en MINUTOS (Martín, 17/11: «pongas 0 minutos o 4 minutos, 10 minutos»): cada US$10 son 2 minutos.
  for (const p of PAQUETES) {
    assert.equal(p.usd % 10, 0, `el paquete de US$${p.usd} no es un precio redondo`);
    assert.equal(p.mt % MT_POR_MINUTO, 0, `el paquete de US$${p.usd} da ${p.mt} MT, que no son minutos enteros`);
    assert.equal(p.minutos, p.usd / 5, `el paquete de US$${p.usd} tiene que dar ${p.usd / 5} minutos y da ${p.minutos}`);
  }
});

// LA OPCIÓN B DE MARTÍN, TAL CUAL (17/11/2026): el de US$97 trae 10 minutos y US$100 extra suman 20 más: 30 en total.
test('la opción B: 10 minutos en el plan, 20 más con US$100, 30 en total', () => {
  const cien = PAQUETES.find((p) => p.usd === 100);
  assert.ok(cien, 'el paquete de US$100 tiene que existir: es el tope de la barra');
  assert.equal(cien!.mt, 28_800);
  assert.equal(cien!.minutos, 20);
  assert.equal(minutosDelPlan('growth') + cien!.minutos, 30, 'Martín: «que con esos $100 extra ya le alcance los 30 minutos»');
});

// ⚠️ EL COSTO DEL VIDEO ES EL OMNI DE MARTÍN, Y HABÍA DOS PRECIOS PARA LOS MISMOS 10 SEGUNDOS (17/11/2026). `MT_POR_CLIP`
// decía 900 (el clip de `kling-v3-omni`, de Kling) y `mtDeVideo(10)` daba 384 (el segundo de seedance). Ninguno era Omni 1.2
// Flash de Google, el de Flow. Ahora sale todo del catálogo y los dos caminos dan lo mismo.
test('el video cuesta lo del Omni 1.2, y los mismos segundos cuestan lo mismo por cualquier camino', () => {
  assert.equal(MODELO_OMNI, 'gemini-omni-1.2-flash-ext', 'el Omni de Martín es el de Google, no el de Kling');
  assert.equal(USD_POR_SEGUNDO.normal, MODELOS_VIDEO[MODELO_OMNI].usdPorSegundo, 'el segundo de video sale del catálogo');
  assert.equal(MT_POR_CLIP, mtDeVideo(10), 'el clip y diez segundos sueltos son el mismo número');
  assert.equal(MT_POR_CLIP, 240);
  assert.equal(MT_POR_MINUTO, 1_440, 'un minuto: 60 × US$0,024 = US$1,44');
  assert.equal(MT_POR_MINUTO, mtDeVideo(60));
  assert.ok(Math.abs(USD_POR_CLIP - 0.24) < 1e-9);
});

test('ninguna ganancia es negativa, y cada paquete cubre su costo', () => {
  for (const p of PAQUETES) {
    assert.ok(gananciaDe(p) > 0, `el paquete de ${p.minutos} min no cubre su costo`);
    assert.ok(p.usd > p.clips * USD_POR_CLIP);
  }
});

test('el paquete grande da MÁS video que el plan, y eso está bien', () => {
  // Es la comparación que chocaba: con el precio viejo, US$90 daba 5 minutos contra los 6 del plan
  // de US$97. Ahora el paquete de precio parecido da MÁS video — el plan gana por el producto, no
  // por los minutos, y así cada uno se entiende solo.
  const grande = PAQUETES[PAQUETES.length - 1];
  assert.ok(grande.minutos > minutosDelPlan('growth'),
    `el paquete grande da ${grande.minutos} min y el plan ${minutosDelPlan('growth')}`);
});
