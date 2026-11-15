// =============================================================================
// Marketing CoPilot — TRES acciones por red, y las de la red donde estás parado (15/11/2026)
// =============================================================================
// Martín, textual: «en lugar de que salga un accionable de cada red social, ya sea anuncios, Instagram o YouTube, yo lo que
// haría es que, si estoy parado en anuncios, que salgan tres accionables o acciones que tomó MaKo para anuncios, y lo mismo
// luego cuando cambio a Instagram que salgan tres y YouTube que salgan tres también».
//
// QUÉ FIJA ESTE ARCHIVO, y por qué cada cosa:
//   1. QUE NO SE CRUCEN LAS REDES. Las acciones ya venían etiquetadas (`TareaCoPilot.tarjeta`) y la pantalla agrupa por esa
//      etiqueta, así que el riesgo no es que no haya filtro: es que una tarea NAZCA con la tarjeta equivocada y aparezca
//      en la red de al lado. Eso no se ve mirando la pantalla — se ve acá.
//   2. QUE NO SE RELLENE HASTA TRES. `ACCIONES_POR_RED` es un tope, no una cuota, y ésta es la parte que importa: hoy
//      `propuestasDelPiloto` da como máximo DOS de Instagram y UNA de YouTube, y sólo con datos leídos. Si alguien
//      “completa” la terna con una frase genérica, está inventando una acción que MaKo no tomó. La regla de la casa es que
//      una pantalla que dice la verdad incompleta vale más que una completa y falsa.
//   3. QUE LAS ACCIONES SEAN ACCIONES. Lo que se mostraba antes en el paso del piloto eran las frases de `cosasDelPiloto`,
//      derivadas de la configuración y en presente («Publico lo que programas»). Un título así, en imperativo o no, no se
//      puede hacer: el test exige que cada acción traiga algo que hacer (`href`, `abre`) y que no sea una descripción.
//
// PROBADO ROMPIÉNDOLO (15/11/2026): cambiando `tarjeta: 'youtube'` por `'instagram'` en la propuesta de los shorts
// (lib/copiloto/piloto-redes.ts) → rojo en el primer test; subiendo ACCIONES_POR_RED a 9 → el segundo sigue verde (es un
// tope, no una cuota) pero el tercero avisa si alguna propuesta pierde su «Hacerlo».
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACCIONES_POR_RED, TARJETAS_COPILOTO, tareasDelCoPilot, type ResumenParaTareas, type TarjetaCoPilot } from '../lib/copiloto/tareas';
import { pilotoDeFabrica, propuestasDelPiloto, type VistoParaProponer } from '../lib/copiloto/piloto-redes';

/** Un negocio con las dos redes conectadas y datos leídos: el caso donde el piloto SÍ tiene algo que proponer. */
const visto = (cambios: Partial<VistoParaProponer> = {}): VistoParaProponer => ({
  lunes: '2026-11-09',
  reelTop: { vistas: 12_400, url: 'https://instagram.com/p/abc' },
  numeroReel: 8_000,
  largosPublicados: 2,
  instagram: true,
  youtube: true,
  ...cambios,
});

const resumen = (propuestas: ResumenParaTareas['propuestas']): ResumenParaTareas => ({
  oferta: { sesion: 18, notaOferta: true, notaAngulos: true, notaVoz: true, faltan: { oferta: 0, angulos: 0, voz: 0 } },
  anuncios: { conectada: true, funnel: 'VSL y llamada', semana: [] },
  web: [],
  redes: { instagram: { conectada: true }, youtube: { conectada: true } },
  seguidos: 4,
  propuestas,
});

/** Las acciones de UNA red, como las arma la pantalla: agrupadas por tarjeta y cortadas en el tope. */
function deLaRed(red: TarjetaCoPilot, propuestas: ResumenParaTareas['propuestas']) {
  const { tareas } = tareasDelCoPilot(resumen(propuestas));
  return tareas.filter((t) => t.tarjeta === red).slice(0, ACCIONES_POR_RED);
}

test('cada acción aparece SÓLO en su red: ninguna se cruza a la de al lado', () => {
  const propuestas = propuestasDelPiloto(pilotoDeFabrica(null), visto());
  assert.ok(propuestas.length > 0, 'con las dos redes conectadas y datos leídos tiene que proponer algo');
  // Toda propuesta nace con una tarjeta que existe, y es la red de la que habla.
  for (const p of propuestas) {
    assert.ok(TARJETAS_COPILOTO.includes(p.tarjeta), `«${p.titulo}» nació con una tarjeta que no existe: ${p.tarjeta}`);
    // La clave arranca con el nombre de su red: es lo que ata la propuesta a su tarjeta y lo que se rompe al copiar y pegar.
    assert.ok(p.clave.startsWith(`${p.tarjeta}:`), `la clave «${p.clave}» no es de la tarjeta «${p.tarjeta}»`);
  }
  // Y en la pantalla, la red donde estás parado no muestra nada de la otra.
  for (const red of ['instagram', 'youtube'] as const) {
    for (const t of deLaRed(red, propuestas)) {
      assert.equal(t.tarjeta, red, `estando en ${red} apareció una acción de ${t.tarjeta}: «${t.titulo}»`);
    }
  }
  // Las de YouTube no se cuelan en Instagram, que es el cruce concreto que puede pasar (las dos son «redes»).
  const enInstagram = deLaRed('instagram', propuestas).map((t) => t.titulo).join(' | ');
  assert.doesNotMatch(enInstagram, /shorts/i, 'una propuesta de YouTube apareció en Instagram');
});

test('con menos de tres se muestran las que hay, y con cero no se inventa ninguna', () => {
  // El tope no rellena: hoy el piloto puede dar como máximo dos de Instagram y una de YouTube.
  const propuestas = propuestasDelPiloto(pilotoDeFabrica(null), visto());
  for (const red of ['instagram', 'youtube'] as const) {
    assert.ok(deLaRed(red, propuestas).length <= ACCIONES_POR_RED, `${red} se pasó del tope de ${ACCIONES_POR_RED}`);
  }
  // SIN DATOS LEÍDOS no hay propuesta que inventar: ni reel top, ni video largo publicado.
  const sinDatos = propuestasDelPiloto(pilotoDeFabrica(null), visto({ reelTop: null, largosPublicados: 0 }));
  assert.equal(sinDatos.length, 0, `sin datos leídos no se propone nada, y propuso: ${sinDatos.map((p) => p.titulo).join(' | ')}`);
  // Y con el piloto apagado, tampoco: lo que no está configurado no se promete.
  const apagado = { instagram: { reelsSemana: 0, historiasSemana: 0, carruselesSemana: 0, variaciones: 0, proponerHook: false, proponerCarrusel: false, reelDePrueba: 'no' as const }, youtube: { largosMes: 0, shortsPorVideo: 0, proponerShorts: false } };
  assert.equal(propuestasDelPiloto(apagado, visto()).length, 0, 'con el piloto apagado no hay propuestas');
});

test('una acción se puede HACER: trae su «Hacerlo», y no es una descripción de lo que el piloto haría', () => {
  const propuestas = propuestasDelPiloto(pilotoDeFabrica(null), visto());
  for (const p of propuestas) {
    // Lo que la distingue de un bullet de `cosasDelPiloto`: tiene a dónde ir o qué abrir.
    assert.ok(p.href || p.abre, `«${p.titulo}» no tiene nada que hacer: sería una descripción, no una acción`);
    // Y está escrita como algo que la persona hace, no como algo que MaKo «hace» en presente. Las de antes empezaban con
    // «Publico…», «Te aviso…», «Te propongo…»: ésas son descripciones del piloto.
    assert.doesNotMatch(p.titulo, /^(Publico|Te aviso|Te propongo|Tus reels salen|Tu ritmo)/,
      `«${p.titulo}» está escrita como una descripción del piloto, no como una acción`);
  }
  // El número vive en UN solo lugar: si alguien escribe otro 3 a mano en una pantalla, esto no lo ve, pero al menos la
  // constante es la que leen las tres tarjetas (lib/copiloto/tareas.ts).
  assert.equal(ACCIONES_POR_RED, 3, 'Martín pidió tres por red (15/11/2026)');
});
