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
  USD_POR_CLIP, USD_POR_CLIP_SUELTO, CLIPS_POR_MINUTO, CLIPS_POR_MES, MT_POR_CLIP, PAQUETES,
  pisoMarginal, rateDelPlan, respetaElPiso, paqueteDeMinutos, gananciaDe, margenDe, minutosDelPlan,
  IMAGENES_POR_MES, IMAGENES_POR_CLIP, GENERA_VIDEO, USD_DEL_PLAN,
} from '../lib/mako-tokens-paquetes';
import { CUPO_MENSUAL, IMAGENES_DEL_CUPO, MT_POR_IMAGEN, PISO_DE_MARGEN_BRUTO, mtDeImagenes, usdDeMt } from '../lib/mako-tokens-reglas';

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
    assert.equal(CUPO_MENSUAL[plan] % MT_POR_IMAGEN.normal, 0,
      `${plan}: su cupo de ${CUPO_MENSUAL[plan]} MT deja un resto que no compra ni una imagen`);
  }
  // Y redondas de verdad, que es lo único que pidió: nada de 958.
  assert.equal(IMAGENES_DEL_CUPO.pro % 500, 0, 'el número del de US$47 lo lee un cliente antes de comprar');
  assert.equal(IMAGENES_DEL_CUPO.growth % 500, 0, 'y el del de US$97 también');
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
  assert.equal(IMAGENES_POR_CLIP, 75, 'cada clip que no hace le compra 75 imágenes más');
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
  // ⚠️ EL EJEMPLO SE DERIVA DEL PISO, no se escribe a mano (15/11/2026). Acá decía `1.5`, que estaba debajo del piso de ese
  // momento (US$1,667) y quedó ARRIBA cuando el de US$97 volvió a 6 minutos y el piso bajó a US$1,389. El test se puso rojo
  // diciendo «por debajo del piso» sobre un precio que ya no lo estaba — el mismo error que el del divisor clavado, dos
  // tests más arriba, y en el mismo archivo. Un ejemplo numérico de un límite MÓVIL tiene que moverse con el límite.
  assert.equal(respetaElPiso(pisoMarginal()! * 0.9), false, 'por debajo del piso, a un Pro le conviene recargar antes que subir');
  assert.equal(respetaElPiso(pisoMarginal()!), false, 'empatar el piso no alcanza: no habría razón para subir');
});

test('el precio suelto siempre es más caro que subir de plan: el escalón se sostiene', () => {
  const piso = pisoMarginal()!;
  assert.ok(USD_POR_CLIP_SUELTO > piso,
    `el clip suelto (US$${USD_POR_CLIP_SUELTO}) tiene que salir más que subir de plan (US$${piso.toFixed(2)})`);
});

test('un paquete se arma por minutos y los MT salen de la unidad, no del precio', () => {
  const p = paqueteDeMinutos(1);
  assert.equal(p.clips, CLIPS_POR_MINUTO);
  assert.equal(p.usd, CLIPS_POR_MINUTO * USD_POR_CLIP_SUELTO);
  assert.equal(p.mt, CLIPS_POR_MINUTO * MT_POR_CLIP, 'los MT miden COSTO: no se mueven si cambia el precio');
});

// ⚠️ EL MARGEN DEL PAQUETE TIENE QUE SER **EL MISMO** QUE EL DEL PLAN, y el 15/11/2026 Martín lo pidió con esas palabras:
// «tampoco tienes que reducir el porcentaje de los MaKo Tokens. Debería quedarnos más o menos el mismo margen de ganancia».
// Con la tarifa (`MT_POR_DOLAR` = 250) sale EXACTO y no «más o menos»: US$1 compra 250 MT, que cuestan US$0,25 → 75%, que es
// el mismo 25% del precio que el plan destina a IA. Antes el paquete se vendía por minutos a un precio puesto a mano, y el
// margen quedaba a la deriva del costo del modelo: con el clip de Omni, el minuto a US$18 dejaba 70% sin que nadie lo
// decidiera. Lo que este test fija es que no se pueda volver a desacoplar.
test('los paquetes dejan el MISMO margen que el plan, y la tarifa es lo que lo garantiza', () => {
  assert.ok(PAQUETES.length >= 3);
  const margenes = PAQUETES.map(margenDe);
  for (const m of margenes) assert.ok(Math.abs(m - margenes[0]) < 1e-9, 'un paquete con otro margen pide explicar por qué');
  // El margen del plan: su cupo es el techo de IA, y el resto del precio es margen bruto.
  const margenDelPlan = 1 - usdDeMt(CUPO_MENSUAL.growth) / USD_DEL_PLAN.growth;
  assert.ok(margenes[0] >= 0.75, `el margen del paquete dio ${(margenes[0] * 100).toFixed(1)}% y tiene que ser 75% o más`);
  assert.ok(Math.abs(margenes[0] - margenDelPlan) < 0.01,
    `el paquete deja ${(margenes[0] * 100).toFixed(1)}% y el plan ${(margenDelPlan * 100).toFixed(1)}%: se desacoplaron`);
  // Y redondos en las DOS unidades (Martín, 15/11: «que el cálculo de los MaKo Tokens sean redondos para el cliente»).
  for (const p of PAQUETES) {
    assert.equal(p.usd % 10, 0, `el paquete de US$${p.usd} no es un precio redondo`);
    assert.equal(p.mt % 500, 0, `el paquete de US$${p.usd} da ${p.mt} MT, que no es redondo`);
  }
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
