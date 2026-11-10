// =============================================================================
// Por qué no sale el mensaje, y el agregado que entra por evento (23/10/2026, P0 de #289)
// =============================================================================
// Martín, por el Cerebro: «probamos en vivo la automatización de Mauricio y no funcionó, no salió ni a mí ni a su esposa».
// Medido en producción: los dos se inscribieron por evento en 8 s (inscripciones #291 y #292) y el motor cortó por el
// horario de oficina (9 a 21 en Tijuana: lo probaron a las 21:47 de allá) sin escribirlo en ningún lado. Lo que se fija:
//   · `porQueNoSale` EJECUTADO, con el caso de la prueba: «No salió: fuera del horario de oficina (9 a 21, hora de
//     Tijuana). Sale mañana 9:00.», y los demás frenos del motor en su orden;
//   · el lead lo DICE: el chip del CRM, la ficha y su historial al inscribirse; la tarjeta del lienzo, con cuántos esperan;
//   · el AGREGADO a un CRM (los 300 del Sprint) entra por evento con la regla del barrido, y el «Mover» en lote del CRM
//     mueve su fila (no le pisa la casa con una etapa de otro CRM).
//
// PROBADO ROMPIÉNDOLO: ver el pie. Correr: node --import tsx --test tests/automations-por-que-no-sale.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { porQueNoSale, type ContextoDelEnvio, type FilaQueEspera } from '../lib/por-que-no-sale';
import { enColaPorPaso } from '../lib/en-cola-por-paso';
import { enAutomatizacionesDe } from '../lib/automatizaciones-del-lead-reglas';
import { agregadoEntraPorEvento } from '../lib/nutricion-ambito';
import { chipDeAutomatizacion, estadoDeAutomatizacion, lineaDeAutomatizacion } from '../app/crm/automatizacion-lead';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const tramo = (src: string, desde: string, hasta: string) => { const i = src.indexOf(desde); assert.ok(i >= 0, `no está «${desde}»`); return src.slice(i, src.indexOf(hasta, i + desde.length)); };

const OFICINA = { activo: true, desde: 9, hasta: 21, dias: [0, 1, 2, 3, 4, 5, 6] } as const;
const PRUEBA = Date.parse('2026-10-23T04:48:00Z'); // 21:48 del 22/10 en Tijuana: la prueba de Martín, recién inscripto.
const ctx = (o: Partial<ContextoDelEnvio> = {}): ContextoDelEnvio => ({
  ahoraMs: PRUEBA, tz: 'America/Tijuana', whatsappPrendido: true, linea: { dia: 65, usadoDia: 0, hora: 15, usadoHora: 0 }, ...o,
});
const fila = (o: Partial<FilaQueEspera> = {}): FilaQueEspera => ({
  proximoEnvioAt: '2026-10-23T04:47:52.437Z', automatizacionActiva: true, canal: 'whatsapp', hayLinea: true, horario: { ...OFICINA, dias: [...OFICINA.dias] }, ...o,
});

test('el caso de la prueba: fuera del horario de oficina, en palabras, con cuándo sale', () => {
  assert.deepEqual(porQueNoSale(fila(), ctx()), {
    texto: 'No salió: fuera del horario de oficina (9 a 21, hora de Tijuana). Sale cuando abre: mañana 9:00.',
    corto: 'Abre mañana 9:00',
    saleAt: '2026-10-23T16:00:00.000Z',
  });
  // Lo que el motor manda IGUAL fuera del horario (el carril del recordatorio, «MaKo en WhatsApp» que lo manda igual): nada.
  assert.equal(porQueNoSale(fila({ correFueraDeHorario: true }), ctx()), null, 'dijo «fuera de horario» de algo que sale igual');
  // «Misma persona» se fue (23/10/2026, Martín: «elimina "Misma persona"»): aunque a ese lead le haya salido un WhatsApp hace
  // 48 minutos, el motivo es el horario, y se promete la apertura. Un dato viejo de «mismaPersona» no cambia nada.
  assert.deepEqual(
    porQueNoSale({ ...fila(), mismaPersona: { horas: 20, ultimoMs: Date.parse('2026-10-23T04:00:00Z') } } as never, ctx()),
    porQueNoSale(fila(), ctx()),
  );
  assert.doesNotMatch(porQueNoSale(fila(), ctx())?.texto ?? '', /Misma persona/);
  // Adentro del horario y sin nada que lo frene: no dice nada (sale en la próxima vuelta del motor).
  assert.equal(porQueNoSale(fila(), ctx({ ahoraMs: Date.parse('2026-10-23T18:00:00Z') })), null);
  // Sin horario (manda a cualquier hora): nada.
  assert.equal(porQueNoSale(fila({ horario: null }), ctx()), null);
  // Lo que vence más tarde, de noche: lo dice antes de que pase.
  assert.equal(
    porQueNoSale(fila({ proximoEnvioAt: '2026-10-23T05:30:00Z' }), ctx({ ahoraMs: Date.parse('2026-10-23T03:00:00Z') }))?.texto,
    'Cae fuera del horario de oficina (9 a 21, hora de Tijuana). Sale cuando abre: mañana 9:00.',
  );
});

test('los demás frenos del motor, en su orden', () => {
  const adentro = ctx({ ahoraMs: Date.parse('2026-10-23T18:00:00Z') }); // 11:00 en Tijuana.
  assert.equal(porQueNoSale(fila({ automatizacionActiva: false }), adentro)?.corto, 'En pausa');
  assert.equal(porQueNoSale(fila(), { ...adentro, whatsappPrendido: false })?.texto, 'No sale: el envío de WhatsApp del negocio está apagado.');
  assert.equal(porQueNoSale(fila({ hayLinea: false }), adentro)?.texto, 'No sale: el negocio no tiene una línea de WhatsApp.');
  // El envío apagado no frena un email ni una acción.
  assert.equal(porQueNoSale(fila({ canal: 'email' }), { ...adentro, whatsappPrendido: false }), null);
  // Y el del EMAIL (10/11/2026): apagado frena sólo al email, y sin saberlo (no se pudo leer) no se afirma nada.
  assert.equal(porQueNoSale(fila({ canal: 'email' }), { ...adentro, emailPrendido: false })?.corto, 'Email apagado');
  assert.equal(porQueNoSale(fila({ canal: 'email' }), adentro), null, 'sin el dato del email no se inventa un freno');
  assert.equal(porQueNoSale(fila(), { ...adentro, emailPrendido: false }), null, 'el email apagado no frena un WhatsApp');
  // Sin «Misma persona» (23/10/2026): un WhatsApp de hace un minuto a ese lead ya no lo frena ni lo dice; adentro del horario y
  // sin tope, sale en la próxima vuelta.
  assert.equal(porQueNoSale({ ...fila(), mismaPersona: { horas: 20, ultimoMs: Date.parse('2026-10-23T17:59:00Z') } } as never, adentro), null, '«Misma persona» volvió a frenar');
  assert.equal(
    porQueNoSale(fila({ ultimoFallo: { error: 'WhatsApp de empresa desconectado (hay que volver a vincular el QR)', at: 0 } }), adentro)?.texto,
    'No salió: WhatsApp de empresa desconectado (hay que volver a vincular el QR).',
  );
  // Un fallo NO avanza: el motor lo reprograma. Lo dice igual, con cuándo lo vuelve a intentar (lo encontró el arnés del ws3).
  assert.equal(
    porQueNoSale(fila({ proximoEnvioAt: '2026-10-23T20:00:00Z', ultimoFallo: { error: 'WhatsApp de empresa desconectado', at: 0 } }), adentro)?.texto,
    'No salió: WhatsApp de empresa desconectado. Lo vuelve a intentar hoy 13:00 (hora de Tijuana).',
  );
  assert.equal(porQueNoSale(fila(), { ...adentro, linea: { dia: 65, usadoDia: 65, hora: 15, usadoHora: 0 } })?.corto, 'Tope del día');
  assert.equal(porQueNoSale(fila(), { ...adentro, linea: { dia: 65, usadoDia: 3, hora: 15, usadoHora: 15 } })?.corto, 'Tope de la hora');
  // El carril no pasa por los topes de la línea: no se dicen. (Hasta el 23/10/2026 tampoco un lead con la reunión encima; el
  // motor ya no lo saltea: los topes de la línea sí lo frenan, y por eso `sinAntiBan` es sólo del carril.)
  assert.equal(porQueNoSale(fila({ sinAntiBan: true }), { ...adentro, linea: { dia: 65, usadoDia: 65, hora: 15, usadoHora: 15 } }), null);
  assert.equal(porQueNoSale(fila({ sinAntiBan: false }), { ...adentro, linea: { dia: 65, usadoDia: 65, hora: 15, usadoHora: 15 } })?.corto, 'Tope del día');
  // Fuera del horario manda el horario, aunque también esté el tope: es lo que corta primero el motor.
  assert.equal(porQueNoSale(fila(), { ...ctx(), linea: { dia: 65, usadoDia: 65, hora: 15, usadoHora: 0 } })?.corto, 'Abre mañana 9:00');
});

// La #289 de la prueba, como está publicada (sin los textos).
const SEC = {
  id: 289, nombre: 'Sprint · apertura', activa: true, archivada_at: null, instance_name: null,
  pasos: [
    { id: 'm1', canal: 'whatsapp', cuerpo: 'Hola {{nombre}}', siguiente: null },
    { id: 'entrada', nodo: 'inicio', canal: 'whatsapp', cuerpo: '', siguiente: 'm1' },
  ],
};
const INSC = (lead: number) => ({ id: 290 + lead, lead_id: lead, secuencia_id: 289, estado: 'activa', paso_actual: 0, nodo_actual: null, proximo_envio_at: '2026-10-23T04:47:52.437Z' });

test('el lead lo dice: el chip del CRM, la ficha y su línea; y la tarjeta del lienzo dice cuántos esperan', () => {
  const vistos: Array<string | null> = [];
  const frenoDe = (f: { proximo_envio_at: string | null }, _s: unknown, canal: string | null) => { vistos.push(canal); return porQueNoSale(fila({ proximoEnvioAt: f.proximo_envio_at, canal }), ctx()); };
  const m = enAutomatizacionesDe([INSC(1), INSC(2)], [SEC], frenoDe);
  assert.deepEqual(vistos, ['whatsapp', 'whatsapp'], 'el freno no recibió el canal del mensaje que le toca');
  const auts = m.get(1)!;
  assert.equal(auts[0].frenado?.corto, 'Abre mañana 9:00');
  assert.deepEqual(chipDeAutomatizacion(auts), {
    texto: 'Abre mañana 9:00', tono: 'gris',
    detalle: '«Sprint · apertura» · «Hola» · No salió: fuera del horario de oficina (9 a 21, hora de Tijuana). Sale cuando abre: mañana 9:00.',
  });
  assert.equal(estadoDeAutomatizacion(auts[0], () => 'NUNCA'), 'No salió: fuera del horario de oficina (9 a 21, hora de Tijuana). Sale cuando abre: mañana 9:00.');
  assert.match(lineaDeAutomatizacion(auts[0]), /· No salió: fuera del horario/);
  // Sin freno, lo de siempre.
  const sin = enAutomatizacionesDe([INSC(1)], [SEC], () => null).get(1)!;
  assert.equal(chipDeAutomatizacion(sin)?.texto, 'En automatización');
  assert.equal(estadoDeAutomatizacion(sin[0], () => '23 oct, 04:47'), 'Lo próximo sale 23 oct, 04:47');
  // La tarjeta del lienzo: los dos, en la tarjeta del primer mensaje.
  assert.deepEqual(enColaPorPaso([INSC(1), INSC(2)], SEC, frenoDe), {
    m1: { cuantos: 2, chip: '2 esperando · Abre mañana 9:00', texto: 'No salió: fuera del horario de oficina (9 a 21, hora de Tijuana). Sale cuando abre: mañana 9:00.' },
  });
  assert.deepEqual(enColaPorPaso([INSC(1)], SEC, () => null), {}, 'una tarjeta sin frenados dibuja chip');
});

test('el AGREGADO entra por evento con la regla del barrido', () => {
  const ahora = Date.parse('2026-10-23T12:00:00Z');
  const corte = ahora - 90 * 86400_000;
  const filaSt0 = [{ lead_id: 7, funnel_id: 44, etapa: 'st0', created_at: '2026-10-20T10:00:00Z', etapa_desde: '2026-10-23T11:59:00Z' }];
  const abierto = [{ id: 7, funnel_id: 3, estado_lead: 'abierto', created_at: '2026-06-15T10:00:00Z' }];
  const propio = { modo: 'propio', id: 44 } as const;
  assert.equal(agregadoEntraPorEvento(propio, ['st0'], 7, corte, filaSt0, abierto), true, 'el agregado que movieron a la etapa no entra');
  assert.equal(agregadoEntraPorEvento({ modo: 'todos' }, ['st0'], 7, corte, filaSt0, abierto), false, 'entró a una de «Todos los productos»');
  assert.equal(agregadoEntraPorEvento(null, ['st0'], 7, corte, filaSt0, abierto), false);
  assert.equal(agregadoEntraPorEvento(propio, ['lead'], 7, corte, filaSt0, abierto), false, 'entró a la de otra etapa');
  assert.equal(agregadoEntraPorEvento(propio, ['st0'], 7, corte, filaSt0, [{ ...abierto[0], estado_lead: 'perdido' }]), false, 'entró un lead cerrado');
  assert.equal(agregadoEntraPorEvento(propio, ['st0'], 7, corte, filaSt0, [{ ...abierto[0], funnel_id: 44 }]), false, 'su casa es este CRM: decide la casa');
  // Agregado en el mismo alta que el lead (una campaña con varios CRM): lo saluda la casa.
  const recien = [{ lead_id: 7, funnel_id: 44, etapa: 'st0', created_at: '2026-10-23T11:58:00Z', etapa_desde: '2026-10-23T11:58:00Z' }];
  assert.equal(agregadoEntraPorEvento(propio, ['st0'], 7, corte, recien, [{ ...abierto[0], created_at: '2026-10-23T11:57:00Z' }]), false, 'entró la fila que nació con el lead');
});

test('cableado: la entrada queda en el historial, el agregado dispara el evento, el lote mueve la fila, el lienzo pide la cola', () => {
  const motor = leer('lib/nutricion.ts');
  const evento = tramo(motor, 'export async function enrolarPorEvento(', '\n}\n');
  assert.match(evento, /try \{ await viaRapidaConTurno\(leadId\); \}\n\s+catch \(e\) \{[^\n]*\}\n\s+await anotarLaEntrada\(leadId, entro\);/, 'la entrada no queda dicha después de la vía rápida');
  assert.match(evento, /if \(evento === 'etapa' && ctx\?\.agregado\) \{/);
  assert.match(evento, /\|\| agregadoEntraPorEvento\(/);
  assert.match(tramo(motor, 'async function anotarLaEntrada(', '\n}\n'), /logLeadEvent\(leadId, 'Automatización', `Entró a «\$\{a\.nombre\}»\.\$\{a\.frenado \? ` \$\{a\.frenado\.texto\}` : ''\}`, 'MaKo'\)/);
  const lf = leer('lib/lead-funnel.ts');
  assert.match(tramo(lf, 'export async function moverEtapaEnProducto(', '\n}\n'), /await enrolarAgregado\(leadId, funnelId, etapa, \{ enLote: opts\?\.enLote, \.\.\.\(informe \? \{ persona: autor, informe \} : \{\}\) \}\);\n\s+return \{ antes: fila\.etapa, automatizaciones: informe \};/, 'mover la tarjeta del agregado no lo inscribe');
  // AGREGARLO no dispara (revisión adversarial): la página de gracias y el cobro agregan y mueven a Ganado en el mismo pedido.
  assert.doesNotMatch(tramo(lf, 'export async function agregarAProducto(', '\n}\n'), /enrolarAgregado|enrolarPorEvento/, 'agregarlo le manda la prospección de la entrada a quien acaba de pagar');
  assert.match(tramo(lf, 'async function enrolarAgregado(', '\n}\n'), /enrolarPorEvento\(leadId, 'etapa', \{\s*etapa, funnelId, agregado: true, \.\.\.\(o\?\.enLote \? \{ sinViaRapida: true \} : \{\}\),\s*\.\.\.\(o\?\.persona && o\.informe \? \{ persona: o\.persona, informe: o\.informe \} : \{\}\),\s*\}\)/);
  // En LOTE, sin vía rápida: el tick lo manda con el tope de la hora.
  assert.match(evento, /if \(ctx\?\.sinViaRapida\) \{[\s\S]*?return arrancadas;\n\s+\}\n[\s\S]*?try \{ await viaRapidaConTurno\(leadId\); \}/, 'el lote corre la vía rápida');
  const crm = leer('app/crm/actions.ts');
  const lote = tramo(crm, 'export async function moverLeadsDeEtapaAction(', '\n}\n');
  assert.match(lote, /const agregados = await agregadosDelCrm\(ids, funnelId \?\? null\);/);
  assert.match(lote, /const real = agregados\.get\(id\);\n\s+if \(real != null\) \{\n\s+await moverEtapaEnProducto\(id, real, stageKey, \{ enLote: true \}\);/, 'el lote le pisa la casa al agregado, o corre la vía rápida');
  // De a tandas desde el 24/10/2026 (tests/crm-lote-tandas.test.ts), siempre con el CRM que se mira.
  // (Con el motivo de descalificar en bloque desde el 28/10/2026: tests/crm-acciones-bloque.test.ts.)
  assert.match(leer('app/crm/AccionesLoteLeads.tsx'), /moverLeadsDeEtapaAction\(tanda, pide\.stage\.key, funnelActivo, motivo\)/);
  assert.match(leer('lib/automatizaciones-del-lead.ts'), /return enAutomatizacionesDe\(filas, automatizaciones, await frenosDelNegocio\(filas, automatizaciones\)\);/);
  const lienzo = leer('app/automations/FlujoLienzo.tsx');
  assert.match(lienzo, /fetch\(`\/api\/flujos\/en-cola\?sec=\$\{secuenciaId\}`/);
  assert.match(lienzo, /\{enCola\[n\.id\] && <ChipEnCola nodo=\{n\} chip=\{enCola\[n\.id\]\.chip\} texto=\{enCola\[n\.id\]\.texto\} \/>\}/, 'la tarjeta no dice quién espera');
  // ⚠️ REESCRITO EL 23/10/2026 (chat «CRM»): el bloque de la ficha se mudó de charla.tsx a automatizaciones.tsx (Martín: «un
  //    bloque... relacionado a las automatizaciones... para tener más claridad de lo que pasa»). Lo que dice cuando algo lo
  //    frena: desde el rediseño del 24/10/2026, el estado en dos palabras con el porqué entero al pasar (`porque`, el
  //    `frenado.texto`) y, en el riel, lo próximo que no sale (tests/ficha-automatizaciones-tarjeta.test.ts).
  assert.match(leer('app/crm/lead-view/ficha/resumen/tarjeta-automatizacion.tsx'), /<span className="fr-aut-estado" title=\{e\.porque \?\? undefined\}>/);
  assert.match(leer('app/crm/automatizacion-lead.ts'), /\(\{ forma, tono, texto, at, soloDia, porque: i\.frenado\?\.texto \?\? null \}\)/);
});

// ── ROTURAS (23/10/2026) ───────────────────────────────────────────────────────────────────────────
// Con romper-varios.mjs del scratchpad, una por vez. Base 5 / 0:
//   P1. `porQueNoSale` sin la puerta del horario                                               → rojo
//   P2. el chip del CRM no dice el freno                                                       → rojo
//   P3. la entrada no queda en el historial después de la vía rápida                           → rojo
//   P4. mover la tarjeta de un agregado no lo inscribe                                         → rojo
//   P5. el agregado entra a una de «Todos los productos»                                       → rojo
//   P6. el «Mover» en lote no mira los agregados                                               → rojo
//   P7. la tarjeta del lienzo no dibuja quién espera                                           → rojo
//   P8. la ficha no recibe el freno (sin `frenosDelNegocio`)                                   → rojo
//   P9. el fallo reprogramado vuelve a callarse (sólo lo vencido)                              → rojo
//   P10. dice «fuera de horario» de lo que el motor manda igual                               → rojo
//   P11. agregar a un CRM vuelve a disparar el evento (la prospección a quien pagó)           → rojo
//   P12. el lote corre la vía rápida                                                           → rojo
