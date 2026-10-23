// =============================================================================
// Offer: lo que encontró la prueba de los chats del 22/10/2026 (8 fallas confirmadas contra producción, be4b9189a)
// =============================================================================
// El Cerebro corrió un arnés contra el POST real de /api/offer en el ws3 (rama probar-chats-offer, 3 corridas). Lo de
// acá fija, sin IA, lo que el código decide en cada una:
//   1. lo que el modelo sacó de lo cargado en MaKo se guardaba como dicho por el dueño (fuente 'chat');
//   2. «¿ya quedó guardada mi oferta?» se contestaba que sí sin una versión guardada (el turno no sabía el estado);
//   3. el PDF decía «Dónde cierras la venta: Llamada de venta» y «Cómo decirlo en la llamada» de una oferta sin llamadas;
//   5. «¿cuántas ofertas tengo?» no se contestaba (no había regla para contestar lo que pregunta el dueño);
//   6. «[de: chat]» quedaba guardado en las piezas (el modelo copiaba la marca del prompt);
//   7. el PDF: «tu primer cliente en 14 días» salía sin número, la fecha «24/10» salía «[completar]/10», la caja de
//      completar se quedaba con un resto («/10)») y los pasos salían «1. 1.»;
//   8. la pieza «otras» se anotaba sin que el dueño la contestara, y «1: sólo esta» se contaba como 1 oferta más.
// Y lo que pisaba el perfil del negocio (el Sprint de Mauricio) está en tests/offer-archivero.test.ts.
//
// ⚠️ PROBADO ROMPIENDO LO QUE PERSIGUE (22/10/2026, arnés romper-c.mjs en el scratchpad de la sesión, con el «sin pisar»
// de tests/offer-archivero.test.ts): la base en verde (20 de 20); 18 roturas, las 18 cazadas. Los números, al
// lado de cada test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sinNumeroDelante, type PiezasSabidas } from '../lib/offer-marco';
import {
  cifrasDelNegocio, conCanalDeLaOferta, entradaCompletar, estadoDeLaOferta, filtrarCifras, fundirPiezasDelTurno, ofertasDeclaradas,
  parseTurno, resultadoMedible, sanearPiezas,
} from '../lib/offer-reglas';
import type { Diagnostico } from '../lib/fase-diagnostico';

const leer = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const AT = '2026-10-22T06:49:00.000Z';
const turno = (piezas: Record<string, unknown>) => parseTurno(JSON.stringify({ respuesta: '¿Y cuánto cuesta?', opciones: [], piezas, listo: false, diagnostico: null, diagnostico_respuesta: null }));

// rotura (el origen «contexto» se ignora): 1 fallo. rotura (la ruta funde sin `fundirPiezasDelTurno`): 1 fallo.
test('1 · lo que el modelo sacó de lo cargado en MaKo va como «negocio», de un documento como «doc», y lo del dueño como siempre', () => {
  const t = turno({
    entregables: { valor: '4 sesiones individuales por videollamada', de: 'contexto' },
    prueba: { valor: 'Casos en su landing', de: 'documento' },
    precio: 'USD 270, pago único',
  });
  assert.ok(t);
  const p = fundirPiezasDelTurno({}, t, { porDefecto: 'chat', preguntoOtras: false, at: AT });
  assert.equal(p.entregables?.fuente, 'negocio');
  assert.equal(p.prueba?.fuente, 'doc');
  assert.equal(p.precio?.fuente, 'chat');
  assert.match(leer('app/api/offer/route.ts'), /const fundidas = conCobroDelPrecio\(conLoQueDijoElDueno\(\s*turnoIA \? fundirPiezasDelTurno\(f\.piezas, turnoIA, \{ porDefecto: fuente, preguntoOtras \}\) : f\.piezas, u\.texto,\s*\)\);/);
});

// rotura (`otras` entra aunque MaKo no la preguntó): 1 fallo. rotura («1: sólo esta» cuenta 1): 1 fallo.
// rotura (la ruta no mira la última pregunta de MaKo): 1 fallo.
test('8 · «otras» sólo con la respuesta a ESA pregunta, y «1: sólo esta» no es otra oferta', () => {
  const t = turno({ otras: '0', ventas: '0: no vendí ninguno' });
  assert.ok(t);
  assert.equal(fundirPiezasDelTurno({}, t, { porDefecto: 'chat', preguntoOtras: false, at: AT }).otras, undefined);
  assert.equal(fundirPiezasDelTurno({}, t, { porDefecto: 'chat', preguntoOtras: false, at: AT }).ventas?.valor, '0: no vendí ninguno');
  assert.equal(fundirPiezasDelTurno({}, t, { porDefecto: 'chat', preguntoOtras: true, at: AT }).otras?.valor, '0');
  assert.equal(ofertasDeclaradas('1: sólo esta'), 0);
  assert.equal(ofertasDeclaradas('2: mentoría grupal y Negocio que Escala'), 2);
  assert.match(leer('app/api/offer/route.ts'), /const preguntoOtras = preguntaPorOtrasOfertas\(\[\.\.\.f\.mensajes\]\.reverse\(\)\.find\(\(m\) => m\.de === 'mako' && !m\.leyendo\)\?\.texto \?\? ''\);/);
});

// rotura (la marca no se saca al entrar): 1 fallo. rotura (ni al leer lo guardado): 1 fallo.
test('6 · «[de: chat]» no queda en las piezas: ni lo que trae el modelo ni lo ya guardado', () => {
  const t = turno({ prueba: 'Sin casos ni testimonios todavía (0) [de: chat]' });
  assert.equal(t?.piezas.prueba, 'Sin casos ni testimonios todavía (0)');
  const guardadas = sanearPiezas({ precio: { valor: 'USD 270, pago único, sin llamadas [de: chat]', fuente: 'chat', at: AT } }) as PiezasSabidas;
  assert.equal(guardadas.precio?.valor, 'USD 270, pago único, sin llamadas');
});

// rotura (el estado dice «guardada» sin mirar la versión): 1 fallo. rotura (el turno no lo recibe): 1 fallo.
test('2 · el turno sabe si la oferta está armada y si está guardada', () => {
  assert.match(estadoDeLaOferta({ conclusiones: [], ofertaId: null, ofertaVersion: null }), /todavía NO está armada ni guardada/);
  assert.match(estadoDeLaOferta({ conclusiones: [{ version: 1 }, { version: 2 }], ofertaId: 24, ofertaVersion: 1 }), /la versión 2 está armada \(en PDF\) pero NO está guardada/);
  assert.match(estadoDeLaOferta({ conclusiones: [{ version: 1 }], ofertaId: 24, ofertaVersion: 1 }), /la versión 1 está armada y GUARDADA en MaKo/);
  assert.match(leer('app/api/offer/route.ts'), /contexto: \[ctx\.texto, estadoDeLaOferta\(fila\)\]\.filter\(\(x\) => x\.trim\(\)\)\.join\('\\n\\n'\),/);
});

// rotura (sin la regla de contestar): 1 fallo.
test('5 · el turno contesta primero lo que le preguntan', () => {
  const ia = leer('lib/offer-ia.ts');
  assert.match(ia, /20\. Si el dueño te PREGUNTA algo .* contéstalo primero/);
  assert.match(ia, /Si el dueño te preguntó algo, contéstalo primero; después, UNA sola pregunta\./);
  assert.match(ia, /\{"valor": "…", "de": "contexto"\}/);
});

// rotura (conCanalDeLaOferta no cambia el canal): 1 fallo. rotura (el PDF vuelve a «en la llamada»): 1 fallo.
test('3 · el canal del PDF es el del funnel de ESTA oferta, y el guion del precio no dice «llamada»', () => {
  const fase = { fase: 1, cuello: 'conversion', canal: 'llamadas', consistencia: 0.8 } as unknown as Diagnostico;
  assert.equal(conCanalDeLaOferta(fase, 'webinar')?.canal, 'webinar');
  assert.equal(conCanalDeLaOferta(fase, null)?.canal, 'llamadas', 'sin canal del funnel, el del negocio');
  assert.equal(conCanalDeLaOferta(null, 'webinar'), null);
  assert.match(leer('app/api/offer/route.ts'), /const fase = conCanalDeLaOferta\(faseVigenteDe\(ctx\), ctx\.funnel\?\.canal \?\? null, canalQueDijo\(fila\.mensajes\.filter\(\(m\) => m\.de === 'yo'\)\.map\(\(m\) => m\.texto\)\)\);/);
  const pdf = leer('lib/offer-pdf.ts');
  assert.match(pdf, /const ROTULO_COMO_DECIRLO = 'Cómo decirlo';/);
  assert.doesNotMatch(pdf, /'Cómo decirlo en la llamada'/);
});

// rotura (resultadoMedible sin los números con letras): 1 fallo. rotura (la fecha se mira por número): 1 fallo.
// rotura (la caja de completar se queda con el resto): 1 fallo. rotura (los pasos sin `sinNumeroDelante`): 1 fallo.
test('7 · el PDF: «tu primer cliente en 14 días» tiene número, la fecha dada queda, la caja no se queda con un resto, y sin «1. 1.»', () => {
  assert.equal(resultadoMedible('Tu primer cliente de diseño en 14 días'), true);
  assert.equal(resultadoMedible('Diseñar la primera versión de su sistema en 3 días'), true);
  assert.equal(resultadoMedible('Ordenar tu negocio en 30 días'), false, 'sin número del resultado, sigue sin serlo');
  const permitidas = cifrasDelNegocio(['El lanzamiento es el 24/10, a las 7 de la tarde.']);
  assert.equal(filtrarCifras('Arranca el 24/10 con cupos limitados.', permitidas), 'Arranca el 24/10 con cupos limitados.');
  assert.equal(filtrarCifras('Arranca el 25/10 con cupos limitados.', permitidas), 'Arranca el [completar] con cupos limitados.');
  assert.equal(entradaCompletar('Prueba', 'Más de 30 casos desde el [completar]/10)'), 'Prueba: Más de 30 casos desde el …/10)');
  assert.equal(entradaCompletar('Prueba', '[completar] cuántos clientes lograron el resultado'), 'Prueba: cuántos clientes lograron el resultado');
  assert.equal(sinNumeroDelante('1. Diagnóstico del equipo'), 'Diagnóstico del equipo');
  assert.equal(sinNumeroDelante('Paso 2: Ejecución'), 'Ejecución');
  assert.equal(sinNumeroDelante('3 días de práctica'), '3 días de práctica', 'un número que es parte del texto queda');
  assert.match(leer('lib/offer-pdf.ts'), /\{ t: `\$\{i \+ 1\}\. \$\{sinNumeroDelante\(x\)\}` \}/);
  assert.match(leer('app/offer/Conclusion.tsx'), /items=\{lista\(p\.mecanismo\?\.pasos\)\.map\(sinNumeroDelante\)\}/);
});
