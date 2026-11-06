// Qué tipo de carrusel es y si parece contenido (lib/carruseles/clasificar.ts), con lo que se midió en la primera carga de la
// biblioteca (4/11/2026): 142 de 160 «sin tipo», y la foto del embarazo de una creadora primera por outlier. Corre el código.
//
// Probado rompiéndolo (4/11/2026), base 8/0:
//   · sin la lista amplia (un número con «formas», «lessons»…) → 2 rojos (el tipo y volver a clasificar);
//   · sin leer la PORTADA antes que el pie → 1 rojo;
//   · «Cómo» sin tilde también como tutorial («Como emprendedora…») → 1 rojo;
//   · `pareceContenido` que da false a un pie corto CON cierre («Guárdalo») → 1 rojo;
//   · `ordenarCarruseles` sin bajar lo personal → 1 rojo; bajándolo también en «Más nuevos» → 1 rojo;
//   · `esperadoDelPlan` con el tope en vez de lo medido → 1 rojo;
//   · `confianzaDeCuenta` que confirma sin mirar el nombre → 1 rojo; `nombreCoincide` sin exigir el nombre de pila → 1 rojo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { altDelItem, pareceContenido, portadaDice, textoDePortada, tipoDeCarrusel } from '../lib/carruseles/clasificar';
import { ordenarCarruseles, type Carrusel } from '../lib/carruseles/explorar';
import {
  MEDIDO_CARRUSELES, PUBLICACIONES_POR_TEMA, confianzaDeCuenta, cuentaDudosa, esperadoDelPlan, nombreCoincide, parecidoConNombre, planDeLectura, reclasificacion,
  type CuentaBiblioteca, type TemaBiblioteca,
} from '../lib/carruseles/biblioteca';

test('el tipo: lo que dice el catálogo de Spy sigue igual, y entran las listas que no decían su sustantivo', () => {
  assert.equal(tipoDeCarrusel({ texto: '7 errores al vender por WhatsApp' }), 'lista', 'lo de antes no cambia');
  assert.equal(tipoDeCarrusel({ texto: '5 formas de conseguir clientes sin anuncios' }), 'lista');
  assert.equal(tipoDeCarrusel({ texto: '3 lessons I learned building a $100M company' }), 'lista', 'en inglés, como escriben las cuentas de la lista');
  assert.equal(tipoDeCarrusel({ texto: '7 simple ways to raise your prices' }), 'lista', 'una palabra entre el número y el sustantivo');
  assert.equal(tipoDeCarrusel({ texto: 'Hace 5 años empecé con 0 seguidores' }), '', 'un número sin un sustantivo contable no es una lista');
  assert.equal(tipoDeCarrusel({ texto: 'En 2024 things changed a lot' }), '', 'un año no es una cantidad');
  assert.equal(tipoDeCarrusel({ texto: "Here's how to write a hook that stops the scroll" }), 'tutorial');
  assert.equal(tipoDeCarrusel({ texto: 'Antes / después de ordenar mi oferta' }), 'antes-despues');
  assert.equal(tipoDeCarrusel({ texto: 'Nobody tells you this about pricing' }), 'opinion');
});

test('el tipo: «Cómo» con tilde al arrancar el gancho es un tutorial; sin tilde o como pregunta, no se adivina', () => {
  assert.equal(tipoDeCarrusel({ texto: 'Cómo armar tu primera oferta\nGuárdalo para después' }), 'tutorial');
  assert.equal(tipoDeCarrusel({ texto: 'Como emprendedora aprendí a decir que no' }), '');
  assert.equal(tipoDeCarrusel({ texto: '¿Cómo te fue este mes?' }), '');
  assert.equal(tipoDeCarrusel({ texto: 'Guía rápida para tu primer anuncio' }), 'tutorial');
  assert.equal(tipoDeCarrusel({ texto: 'Guárdalo 📌' }), '', 'un pie que sólo pide guardar no dice su tipo');
});

test('la portada (el texto que escribe Instagram) dice el tipo antes que el pie', () => {
  const alt = "Photo by Estudio Lumen on November 03, 2026. May be an image of text that says '5 errores al subir tus precios'.";
  assert.equal(textoDePortada(alt), '5 errores al subir tus precios');
  assert.equal(portadaDice(alt), 'texto');
  assert.equal(tipoDeCarrusel({ texto: 'Guárdalo 📌', portada: textoDePortada(alt) }), 'lista');
  assert.equal(textoDePortada('Photo by X on May 2. May be an image of 1 person and smiling.'), null, 'sin «that says» no hay texto del creador');
  assert.equal(portadaDice('Photo by X. May be an image of 2 people, baby and indoors.'), 'personas');
  assert.equal(portadaDice('Photo by X.'), null);
  assert.equal(altDelItem({ alt: 'May be an image of text' }), 'May be an image of text');
  assert.equal(altDelItem({ childPosts: [{ alt: 'May be an image of text that says "Hola"' }] }), 'May be an image of text that says "Hola"');
  assert.equal(altDelItem({ caption: 'x' }), null, 'el actor puede no mandarlo: entonces no hay');
});

test('parece contenido: medible, con tres valores; un pie corto sin nada es personal, uno que pide algo no', () => {
  assert.equal(pareceContenido({ texto: 'Anytime now….', formato: null, cierre: null }), false, 'el caso medido: la foto del embarazo');
  assert.equal(pareceContenido({ texto: 'Guárdalo 📌', formato: null, cierre: 'guardar' }), true, 'pide algo al final: es contenido');
  assert.equal(pareceContenido({ texto: 'algo', formato: 'lista', cierre: null }), true);
  assert.equal(pareceContenido({ texto: 'Top 3 del mes', formato: null, cierre: null }), null, 'con un número no se dice que es personal');
  assert.equal(pareceContenido({ texto: 'Un texto largo que cuenta algo de su semana con muchas palabras y sin nada más', formato: null, cierre: null }), null, 'un pie largo sin señal: no se puede decir');
  assert.equal(pareceContenido({ texto: null, formato: null, cierre: null }), null);
  assert.equal(pareceContenido({ texto: 'Anytime now', formato: null, cierre: null, portada: 'texto' }), true, 'la portada con texto gana');
  assert.equal(pareceContenido({ texto: 'Un pie largo que cuenta muchas cosas de la vida y de la familia y del verano', formato: null, cierre: null, portada: 'personas' }), false);
});

let n = 0;
const c = (p: Partial<Carrusel>): Carrusel => ({
  id: ++n, competidorId: -1, origen: 'biblioteca', creador: { nombre: 'Estudio Lumen', usuario: 'estudio.lumen', foto: null }, url: null, miniatura: null,
  texto: null, gancho: null, tipoGancho: null, cierre: null, formato: '', medio: 'carrusel', laminas: 5, megusta: 100, comentarios: 10,
  publicada: '2026-11-01', traida: '2026-11-02', outlier: 1, ...p,
});

test('lo personal baja en «Mayor outlier» y «Más interacción», con su número; en las fechas no se mueve', () => {
  const embarazo = c({ outlier: 9.7, megusta: 90_000, pareceContenido: false, publicada: '2026-11-03' });
  const lista = c({ outlier: 3, megusta: 5_000, pareceContenido: true, publicada: '2026-11-01' });
  const nose = c({ outlier: 2, megusta: 4_000, publicada: '2026-10-20' });
  assert.deepEqual(ordenarCarruseles([embarazo, lista, nose], 'outlier').map((x) => x.id), [lista.id, nose.id, embarazo.id]);
  assert.deepEqual(ordenarCarruseles([embarazo, lista, nose], 'interaccion').map((x) => x.id), [lista.id, nose.id, embarazo.id]);
  assert.deepEqual(ordenarCarruseles([embarazo, lista, nose], 'nuevos').map((x) => x.id), [embarazo.id, lista.id, nose.id], 'por fecha manda la fecha');
  assert.equal(ordenarCarruseles([embarazo], 'outlier')[0].outlier, 9.7, 'se ve, con su número');
});

test('volver a clasificar lo guardado: llena lo que falta, nunca pisa, y sin texto no toca nada', () => {
  assert.deepEqual(reclasificacion({ texto: '5 formas de cobrar más. Guárdalo', formato: null, cierre: null, parece_contenido: null }),
    { formato: 'lista', cierre: 'guardar', parece_contenido: true });
  assert.deepEqual(reclasificacion({ texto: 'Anytime now….', formato: null, cierre: null }), { parece_contenido: false });
  assert.equal(reclasificacion({ texto: '5 formas de cobrar más', formato: 'tutorial', cierre: 'link', parece_contenido: true }), null, 'lo que ya está (puede venir de la portada) no se pisa');
  assert.equal(reclasificacion({ texto: null, formato: null, cierre: null }), null, 'el texto vencido no se reemplaza por una adivinanza');
});

const cuenta = (p: Partial<CuentaBiblioteca>): CuentaBiblioteca => ({ id: 1, instagram: 'a', nombre: 'A', fuente: 'lista', referente: null, estado: 'activa', motivo: null, foto: null, leida_en: null, ...p });

test('el plan en seco dice lo ESPERADO con lo medido, no el techo; y un tema pide lo que devuelve', () => {
  assert.equal(PUBLICACIONES_POR_TEMA, 30, 'medido: una página de hashtag devolvió 15 a 30 de 80');
  const temas: TemaBiblioteca[] = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, hashtag: `tema${i}x`, nombre: `Tema ${i}`, activo: true, leido_en: null }));
  const cuentas = Array.from({ length: 7 }, (_, i) => cuenta({ id: i + 1, instagram: `cuenta.${i}` }));
  const plan = planDeLectura(cuentas, temas, { techoUsd: 2, ahora: Date.parse('2026-11-04T12:00:00Z') });
  assert.equal(plan.lecturas.length, 17, 'con 30 por tema entran las 17 fuentes en US$2 (con 80, el techo dejaba afuera)');
  const e = esperadoDelPlan(plan.lecturas);
  assert.equal(e.carruseles, 10 * MEDIDO_CARRUSELES.porTema + 7 * MEDIDO_CARRUSELES.porCuenta, 'unos 160: lo que entró de verdad el 4/11');
  assert.ok(e.usdProbable <= plan.totalUsd);
  assert.equal(cuentaDudosa(1), true, '@sofiacontreras trajo 1: dudosa');
  assert.equal(cuentaDudosa(30), false);
});

test('confirmar una cuenta: el nombre, verificada o grande, y que publique; buscar ordena por parecido', () => {
  const real = { usuario: 'hormozi', nombre: 'Alex Hormozi', seguidores: 3_400_000, publicaciones: 1_900, verificada: true };
  assert.equal(confianzaDeCuenta(real, 'Alex Hormozi').nivel, 'confirmada');
  const fan = { usuario: 'hormoziw', nombre: 'Hormozi Wisdom', seguidores: 12_000, publicaciones: 300, verificada: false };
  assert.equal(confianzaDeCuenta(fan, 'Alex Hormozi').nivel, 'dudosa', 'el @ lo nombra, pero el nombre no es el suyo y es chica');
  const otra = { usuario: 'damaristradesww', nombre: 'Damaris', seguidores: 900, publicaciones: 40, verificada: false };
  assert.equal(confianzaDeCuenta(otra, 'Alex Hormozi').nivel, 'no-parece');
  const copia = { usuario: 'alexhormozi.oficial', nombre: 'Alex Hormozi', seguidores: 3_000, publicaciones: 12, verificada: false };
  assert.equal(confianzaDeCuenta(copia, 'Alex Hormozi').nivel, 'dudosa', 'con el nombre igual pero chica y sin verificar no se confirma');
  const pariente = { usuario: 'leilahormozi', nombre: 'Leila Hormozi', seguidores: 2_000_000, publicaciones: 1_200, verificada: true };
  assert.notEqual(confianzaDeCuenta(pariente, 'Alex Hormozi').nivel, 'confirmada', 'grande y verificada, pero es de OTRA persona: el nombre manda');
  assert.equal(confianzaDeCuenta(pariente, 'Leila Hormozi').nivel, 'confirmada');
  assert.equal(parecidoConNombre({ usuario: 'hormozi', nombre: 'Alex Hormozi' }, 'Alex Hormozi'), 2);
  assert.equal(nombreCoincide('Adrià Sola | Marketing', 'Adrià Sola Pastor'), true, 'el nombre de pila y un apellido alcanzan');
  assert.equal(nombreCoincide('Sola Pastor', 'Adrià Sola Pastor'), false, 'sin el nombre de pila no');
  assert.equal(nombreCoincide('Víctor Heras', 'Víctor Heras'), true);
  assert.equal(parecidoConNombre({ usuario: 'hormoziw' }, 'Alex Hormozi'), 1);
  assert.equal(parecidoConNombre({ usuario: 'damaristradesww' }, 'Alex Hormozi'), 0);
});

test('el tipo en portugués, alemán e inglés (6/11/2026: 1.253 de 1.470 quedaban sin tipo)', () => {
  assert.equal(tipoDeCarrusel({ texto: '5 erros que travam suas vendas' }), 'lista', 'portugués');
  assert.equal(tipoDeCarrusel({ texto: '7 dicas simples para vender mais' }), 'lista');
  assert.equal(tipoDeCarrusel({ texto: '5 Fehler, die dich Kunden kosten' }), 'lista', 'alemán');
  assert.equal(tipoDeCarrusel({ texto: '3 Gründe, warum dein Post nicht ankommt' }), 'lista', 'sin la diéresis');
  assert.equal(tipoDeCarrusel({ texto: '8 skills worth learning this year' }), 'lista', 'inglés');
  assert.equal(tipoDeCarrusel({ texto: 'Como vender mais no Instagram sem anúncios' }), 'tutorial');
  assert.equal(tipoDeCarrusel({ texto: 'Aprenda a precificar seu serviço' }), 'tutorial');
  assert.equal(tipoDeCarrusel({ texto: 'So gewinnst du Kunden ohne Werbung' }), 'tutorial');
  assert.equal(tipoDeCarrusel({ texto: 'How to price your service without guessing' }), 'tutorial');
  assert.equal(tipoDeCarrusel({ texto: 'Here’s the step-by-step ⬇️ every day I post' }), 'tutorial');
  assert.equal(tipoDeCarrusel({ texto: 'Passo a passo para montar sua oferta' }), 'tutorial');
  assert.equal(tipoDeCarrusel({ texto: 'Antes e depois do nosso redesenho' }), 'antes-despues');
  assert.equal(tipoDeCarrusel({ texto: 'Mito ou verdade? Vender barato atrai clientes' }), 'mito');
  assert.equal(tipoDeCarrusel({ texto: 'Unpopular opinion: your logo does not matter' }), 'opinion');
  assert.equal(tipoDeCarrusel({ texto: 'Likes don’t pay the bills. These numbers do. 1️⃣ Where from 2️⃣ How many 3️⃣ How much' }), 'lista', 'tres puntos numerados');
  assert.equal(tipoDeCarrusel({ texto: 'To get leads: 1) Make something good 2) Advertise it 3) Trade it' }), 'lista');
});

test('lo que NO dice su tipo queda sin tipo, en cualquier idioma', () => {
  assert.equal(tipoDeCarrusel({ texto: 'Como está sua semana? Conta pra mim' }), '', '«Como está» no es «Como + infinitivo»');
  assert.equal(tipoDeCarrusel({ texto: 'Como vender mais?' }), '', 'una pregunta no es un tutorial');
  assert.equal(tipoDeCarrusel({ texto: 'Como emprendedora, aprendí que nadie te regala nada' }), '');
  assert.equal(tipoDeCarrusel({ texto: 'Em 2027 a nossa equipe cresceu 10 vezes' }), '');
  assert.equal(tipoDeCarrusel({ texto: 'Das Ergebnis kostete 1.5 Millionen und 2.5 Jahre' }), '', 'decimales no son 1. 2. 3.');
  assert.equal(tipoDeCarrusel({ texto: 'Aim high, but give yourself time to get there.' }), '');
});
