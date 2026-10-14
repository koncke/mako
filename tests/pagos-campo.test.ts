// =============================================================================
// La escritura campo por campo de Pagos: las reglas puras (lib/pagos-campo.ts)
// =============================================================================
// Pedido de Martín del 14/10/2026 («edita todo en la misma tab y depreca "Editar deal →"»), diseño en
// docs/diseno-ficha-bloques.md §3 Pagos. Lo que se fija, EJECUTANDO las funciones:
//   1. un campo del deal se MERGEA: los demás (y el documento fiscal) quedan;
//   2. las obligaciones se editan renglón por renglón, y una pestaña vieja no edita el renglón equivocado;
//   3. un cambio de la venta escribe lo mismo que el wizard (a suscripción, sin monto de cierre; a becado, sin
//      plata y nunca con cuotas cobradas) y trae el compare-and-set y su Deshacer;
//   4. las cuotas se reconcilian POR ID: nada se borra e inserta, y una cuota con un link sin pagar o un
//      recordatorio corriendo no se toca;
//   5. el plan uniforme mantiene el calendario de siempre;
//   6. un pago en otra moneda guarda la moneda y su valor en dólares DECLARADO, y sin moneda es USD.
//
// PROBADO ROMPIÉNDOLO (14/10/2026), una rotura por vez sobre lib/pagos-campo.ts con un script que reemplaza,
// corre y restaura byte a byte. Con el código como está: 13 pases, 0 fallos. Rota (pases / fallos):
//   · `fusionarCampo` devolviendo `{ [campo]: valor }` (el reemplazo de antes)              → 12 / 1
//   · `aplicarObligacion` sin el chequeo de `esperado`                                       → 12 / 1
//   · `patchDeVenta` a suscripción sin `monto_cierre_usd: null`                              → 12 / 1
//   · `patchDeVenta` a «sin cobro» sin el `if (opts.hayCobradas)`                            → 12 / 1
//   · `casar` sin el `if (p.includes('recordatorio'))` (una cuota con recordatorio se edita) → 12 / 1
//   · el bucle final sin el `if (p.length)` (se borra una cuota con link o recordatorio)     →  9 / 4
//   (la línea que estaba acá —«el modo 'lista' casando por orden también sobre las protegidas»— probaba justo el
//   comportamiento que DUPLICABA la deuda: se corrigió el 14/10 y sus roturas están abajo.)
//   · el número nuevo sin contar las que se van a borrar (choca el índice único)             → 10 / 3
//   · `pagoEnMoneda` aceptando otra moneda sin el valor en dólares                           → 12 / 1
//   · `pagoEnMoneda` leyendo «sin moneda» como la del negocio (devolviendo 'MXN')            → 12 / 1
//   · `lineasDeCuotas` sin las líneas de las cuotas quitadas                                 → 12 / 1
//   · `avisoDeConservadas` callado aunque haya cuotas sin tocar                              → 12 / 1
//
// Y las dos fallas ALTAS de la revisión (14/10/2026, tarde), con 16 tests y la base en 16 / 0:
//   · 'lista' sin casar primero las protegidas (lo de antes: la deuda dos veces)            → 14 / 2
//   · una protegida sin vencimiento igual que se queda sin deseada                          → 14 / 2
//   · `ajustarSobre` sin la base (el parcial escrito como plan entero)                      → 15 / 1
//   · `ajustarSobre` inventando el día 1 cuando no hay día de pago                          → 15 / 1
//   · una clave en `undefined` pisando la base                                              → 15 / 1
//   · `planComoEstaba` sin limpiar un monto negativo                                        → 15 / 1
//   · `ajustarPlanAction` sin el plan de la base                                            → 15 / 1
//   · `guardar_cuotas` contestando «Listo» sin decir lo que no se tocó                      → 15 / 1
// Correr: npx tsx --test tests/pagos-campo.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ajustarSobre, aplicarObligacion, avisoDeConservadas, cuotasDelPlan, etiquetaDePago, fusionarCampo, lineasDeCuotas, pagoEnMoneda, patchDeVenta,
  planComoEstaba, reconciliarCuotas, rotuloCampoDeal, validarPlan, valorDeCampoDeal, type CuotaExistente,
} from '../lib/pagos-campo';

// ── 1. Campos del deal ────────────────────────────────────────────────────────

test('un campo del deal se MERGEA: el resto de la sección y el documento fiscal quedan', () => {
  const actual = { razon: 'Acme SA', id_fiscal: 'RFC1', doc_path: 'ws/1/fiscal.pdf', doc_nombre: 'fiscal.pdf' };
  const r = fusionarCampo(actual, 'domicilio', 'Calle 1');
  assert.deepEqual(r.seccion, { razon: 'Acme SA', id_fiscal: 'RFC1', doc_path: 'ws/1/fiscal.pdf', doc_nombre: 'fiscal.pdf', domicilio: 'Calle 1' });
  assert.equal(r.antes, null);
  assert.equal(r.cambio, true);
  // Vaciar es null, no borrar la clave; y lo mismo que había no es un cambio.
  assert.deepEqual(fusionarCampo(actual, 'razon', null).seccion.doc_path, 'ws/1/fiscal.pdf');
  assert.equal(fusionarCampo(actual, 'razon', 'Acme SA').cambio, false);
  assert.equal(fusionarCampo(null, 'que_es', 'Mentoría').antes, null);
  assert.equal(rotuloCampoDeal('fiscal', 'razon'), 'Datos fiscales · Razón social');
});

test('el valor de un campo se limpia: texto, fechas AAAA-MM-DD, correo con arroba, y lo desconocido no entra', () => {
  assert.deepEqual(valorDeCampoDeal('promesa', 'resultado', '  Bajar 5 kg  '), { ok: true, valor: 'Bajar 5 kg' });
  assert.deepEqual(valorDeCampoDeal('promesa', 'resultado', '   '), { ok: true, valor: null });
  assert.equal(valorDeCampoDeal('servicio', 'fecha_inicio', '14/10/2026').ok, false);
  assert.deepEqual(valorDeCampoDeal('servicio', 'fecha_inicio', '2026-10-14'), { ok: true, valor: '2026-10-14' });
  assert.equal(valorDeCampoDeal('fiscal', 'correo', 'sin-arroba').ok, false);
  assert.equal(valorDeCampoDeal('fiscal', 'doc_path', 'x').ok, false, 'el documento lo escribe la subida, no un campo');
  assert.equal(valorDeCampoDeal('fiscal', 'razon', { a: 1 }).ok, false, 'un objeto no se guarda como «[object Object]»');
  assert.equal(valorDeCampoDeal('servicio', 'que_es', 'x'.repeat(2001)).ok, false);
});

// ── 2. Obligaciones ───────────────────────────────────────────────────────────

test('obligaciones: agregar, editar y quitar un renglón, cada uno con su Deshacer que vuelve la misma lista', () => {
  const base = { cliente: ['Asistir', 'Pagar'], prestador: ['Entregar'] };
  const ag = aplicarObligacion(base, { accion: 'agregar', parte: 'cliente', texto: 'Mandar fotos' });
  assert.ok(ag.ok);
  assert.deepEqual(ag.obligaciones, { cliente: ['Asistir', 'Pagar', 'Mandar fotos'], prestador: ['Entregar'] });
  const vuelta = aplicarObligacion(ag.obligaciones, ag.deshacer);
  assert.ok(vuelta.ok);
  assert.deepEqual(vuelta.obligaciones, base);

  const ed = aplicarObligacion(base, { accion: 'editar', parte: 'prestador', indice: 0, texto: 'Entregar el plan', esperado: 'Entregar' });
  assert.ok(ed.ok);
  assert.equal(ed.antes, 'Entregar');
  assert.deepEqual(ed.obligaciones.prestador, ['Entregar el plan']);
  const ed2 = aplicarObligacion(ed.obligaciones, ed.deshacer);
  assert.ok(ed2.ok);
  assert.deepEqual(ed2.obligaciones, base);

  const qu = aplicarObligacion(base, { accion: 'quitar', parte: 'cliente', indice: 0, esperado: 'Asistir' });
  assert.ok(qu.ok);
  assert.deepEqual(qu.obligaciones.cliente, ['Pagar']);
  const qu2 = aplicarObligacion(qu.obligaciones, qu.deshacer);
  assert.ok(qu2.ok);
  assert.deepEqual(qu2.obligaciones, base, 'deshacer un quitar lo devuelve a SU lugar');
});

test('obligaciones: una pestaña vieja no edita ni quita el renglón equivocado', () => {
  // La otra pestaña ya quitó «Asistir»: el renglón 0 ahora es «Pagar».
  const ahora = { cliente: ['Pagar'], prestador: [] };
  const r = aplicarObligacion(ahora, { accion: 'quitar', parte: 'cliente', indice: 0, esperado: 'Asistir' });
  assert.equal(r.ok, false);
  assert.equal(aplicarObligacion(ahora, { accion: 'editar', parte: 'cliente', indice: 3, texto: 'x', esperado: 'x' }).ok, false);
  assert.equal(aplicarObligacion(ahora, { accion: 'agregar', parte: 'cliente', texto: '   ' }).ok, false, 'un renglón vacío no entra');
  // Lo que no es lista (un jsonb roto) se lee vacío, no rompe.
  const roto = aplicarObligacion({ cliente: 'texto suelto' }, { accion: 'agregar', parte: 'cliente', texto: 'Uno' });
  assert.ok(roto.ok);
  assert.deepEqual(roto.obligaciones, { cliente: ['Uno'], prestador: [] });
});

// ── 3. La venta ───────────────────────────────────────────────────────────────

test('la venta: el monto va a la columna de SU tipo, con el compare-and-set y su Deshacer', () => {
  const unico = { venta_tipo: 'unico', monto_cierre_usd: 1500, suscripcion_monto_usd: null, suscripcion_meses: null };
  const r = patchDeVenta(unico, { campo: 'monto', valor: 1800 }, { hayCobradas: false });
  assert.ok(r.ok);
  assert.deepEqual(r.patch, { monto_cierre_usd: 1800 });
  assert.equal(r.tipoEsperado, 'unico');
  assert.deepEqual(r.deshacer, [{ campo: 'monto', valor: 1500 }]);

  const sus = { venta_tipo: 'suscripcion', monto_cierre_usd: null, suscripcion_monto_usd: 444, suscripcion_meses: null };
  const m = patchDeVenta(sus, { campo: 'monto', valor: 500 }, { hayCobradas: true });
  assert.ok(m.ok);
  assert.deepEqual(m.patch, { suscripcion_monto_usd: 500 }, 'la plata de una suscripción es su mensualidad, no el monto de cierre');
  assert.equal(m.tipoEsperado, 'suscripcion');
  const p = patchDeVenta(sus, { campo: 'plazo', valor: 6 }, { hayCobradas: true });
  assert.ok(p.ok);
  assert.deepEqual(p.patch, { suscripcion_meses: 6 });
  assert.equal(patchDeVenta(unico, { campo: 'plazo', valor: 6 }, { hayCobradas: false }).ok, false, 'un pago único no tiene plazo');
  assert.equal(patchDeVenta(unico, { campo: 'monto', valor: -5 }, { hayCobradas: false }).ok, false);
  const becado = { venta_tipo: 'sin_cobro', monto_cierre_usd: null };
  assert.equal(patchDeVenta(becado, { campo: 'monto', valor: 100 }, { hayCobradas: false }).ok, false, 'un becado no tiene monto');
});

test('la venta: cambiar el tipo escribe lo mismo que el wizard, y salir de becado es «Quitar Sin cobro»', () => {
  const unico = { venta_tipo: 'unico', monto_cierre_usd: 1500, suscripcion_monto_usd: null, suscripcion_meses: null };
  const aSus = patchDeVenta(unico, { campo: 'tipo', valor: 'suscripcion' }, { hayCobradas: false });
  assert.ok(aSus.ok);
  assert.deepEqual(aSus.patch, { venta_tipo: 'suscripcion', monto_cierre_usd: null, suscripcion_monto_usd: null, suscripcion_meses: null },
    'una suscripción no tiene monto de cierre: contarlo inflaba el revenue único');
  assert.deepEqual(aSus.deshacer, [{ campo: 'tipo', valor: 'unico' }, { campo: 'monto', valor: 1500 }]);

  const sus = { venta_tipo: 'suscripcion', monto_cierre_usd: null, suscripcion_monto_usd: 444, suscripcion_meses: 6 };
  const aUnico = patchDeVenta(sus, { campo: 'tipo', valor: 'unico' }, { hayCobradas: true });
  assert.ok(aUnico.ok);
  assert.deepEqual(aUnico.patch, { venta_tipo: 'unico', suscripcion_monto_usd: null, suscripcion_meses: null });
  assert.deepEqual(aUnico.deshacer, [{ campo: 'tipo', valor: 'suscripcion' }, { campo: 'monto', valor: 444 }, { campo: 'plazo', valor: 6 }]);

  const aBecado = patchDeVenta(unico, { campo: 'tipo', valor: 'sin_cobro' }, { hayCobradas: false });
  assert.ok(aBecado.ok);
  assert.deepEqual(aBecado.patch, { venta_tipo: 'sin_cobro', monto_cierre_usd: null, suscripcion_monto_usd: null, suscripcion_meses: null }, 'NULL, nunca 0');
  assert.deepEqual(aBecado.deshacer, [{ campo: 'tipo', valor: 'unico' }, { campo: 'monto', valor: 1500 }]);
  assert.equal(patchDeVenta(unico, { campo: 'tipo', valor: 'sin_cobro' }, { hayCobradas: true }).ok, false, 'con plata cobrada no puede ser becado');

  const salir = patchDeVenta({ venta_tipo: 'sin_cobro' }, { campo: 'tipo', valor: 'unico' }, { hayCobradas: false });
  assert.equal(salir.ok, false);
  assert.equal((salir as { usarQuitarSinCobro?: boolean }).usarQuitarSinCobro, true);
  assert.equal(patchDeVenta({ venta_tipo: 'sin_cobro' }, { campo: 'tipo', valor: 'suscripcion' }, { hayCobradas: false }).ok, false);
  const igual = patchDeVenta(unico, { campo: 'tipo', valor: 'unico' }, { hayCobradas: false });
  assert.ok(igual.ok && igual.nada);
  // La fecha no depende del tipo: sin compare-and-set.
  const f = patchDeVenta(unico, { campo: 'fecha', valor: '2026-10-14' }, { hayCobradas: false });
  assert.ok(f.ok);
  assert.equal(f.tipoEsperado, null);
});

// ── 4. Reconciliar cuotas ─────────────────────────────────────────────────────

const Q = (id: number, numero: number, monto: number, fecha: string | null, extra: Partial<CuotaExistente> = {}): CuotaExistente =>
  ({ id, numero, monto_usd: monto, fecha_esperada: fecha, pagado: false, ...extra });

test('porId: la que trae id se actualiza POR ID, la nueva se inserta, la quitada se borra; nada se borra e inserta', () => {
  const ex = [Q(10, 0, 1000, '2026-10-01', { pagado: true }), Q(11, 1, 500, '2026-11-01'), Q(12, 2, 500, '2026-12-01'), Q(13, 3, 500, '2027-01-01')];
  const r = reconciliarCuotas(ex, [
    { id: 11, monto_usd: 500, fecha_esperada: '2026-11-01' },      // igual
    { id: 12, monto_usd: 600, fecha_esperada: '2026-12-15' },      // cambia
    { id: null, monto_usd: 700, fecha_esperada: '2027-02-01' },    // nueva
    { id: 10, monto_usd: 1, fecha_esperada: null },                // una cobrada que vino en la lista: no se toca
  ], 'porId');
  assert.deepEqual(r.actualizar.map((u) => [u.id, u.monto_usd, u.fecha_esperada]), [[12, 600, '2026-12-15']]);
  assert.deepEqual(r.actualizar[0].antes, { monto_usd: 500, fecha_esperada: '2026-12-01' }, 'el antes, para el historial y para Deshacer');
  assert.deepEqual(r.insertar, [{ numero: 4, monto_usd: 700, fecha_esperada: '2027-02-01' }]);
  assert.deepEqual(r.borrar.map((b) => b.id), [13]);
  assert.deepEqual(r.conservar, []);
});

test('⚠️ una cuota con un link sin pagar o con un recordatorio corriendo NO se borra ni cambia lo que no puede', () => {
  const ex = [
    Q(21, 1, 500, '2026-11-01', { protegida: ['link'] }),
    Q(22, 2, 500, '2026-12-01', { protegida: ['recordatorio'] }),
    Q(23, 3, 500, '2027-01-01', { protegida: ['link'] }),
    Q(24, 4, 500, '2027-02-01', { protegida: ['recordatorio'] }),
  ];
  const r = reconciliarCuotas(ex, [
    { id: 21, monto_usd: 500, fecha_esperada: '2026-11-20' },   // link: la FECHA se mueve
    { id: 22, monto_usd: 500, fecha_esperada: '2026-12-20' },   // recordatorio: nada
    { id: 23, monto_usd: 900, fecha_esperada: '2027-01-01' },   // link: el MONTO no
    // la 24 (recordatorio) no vino: no se borra
  ], 'porId');
  assert.deepEqual(r.actualizar.map((u) => [u.id, u.fecha_esperada]), [[21, '2026-11-20']]);
  assert.deepEqual(r.conservar.map((c) => [c.id, c.motivo]).sort(), [[22, 'recordatorio'], [23, 'link'], [24, 'recordatorio']]);
  assert.deepEqual(r.borrar, [], 'una cuota protegida no se borra nunca');
});

test('lista (sin ids): las iguales conservan su id, por orden sólo sobre las no protegidas, y los números no chocan', () => {
  const ex = [Q(31, 1, 500, '2026-11-01'), Q(32, 2, 500, '2026-12-01', { protegida: ['link'] }), Q(33, 3, 500, '2027-01-01'), Q(34, 4, 99, null, { proveedor: 'stripe', devuelta: true } as Partial<CuotaExistente>)];
  const r = reconciliarCuotas(ex, [
    { monto_usd: 500, fecha_esperada: '2026-12-01' },   // igual a la 32 (la del link): se queda con su id
    { monto_usd: 450, fecha_esperada: '2026-11-15' },   // por orden → la 31 (la primera libre no protegida)
  ], 'lista');
  assert.deepEqual(r.actualizar.map((u) => [u.id, u.monto_usd]), [[31, 450]]);
  assert.deepEqual(r.borrar.map((b) => b.id), [33]);
  assert.deepEqual(r.insertar, []);
  assert.deepEqual(r.conservar, []);
  // La devuelta (reembolso) no es deuda: nunca entra en la cuenta.
  assert.ok(![...r.actualizar.map((u) => u.id), ...r.borrar.map((b) => b.id)].includes(34));
  // ⚠️ La protegida se lleva la deseada ANTES que la libre: no se puede borrar, así que si la libre se quedaba con
  // la deseada la deuda quedaba en 500 + 900 por una sola cuota pedida. Su monto no cambia (tiene link), se dice en
  // `conservar`, y la libre que sobra se borra.
  const r3 = reconciliarCuotas([Q(71, 1, 500, '2026-11-01', { protegida: ['link'] }), Q(72, 2, 500, '2026-12-01')], [{ monto_usd: 900, fecha_esperada: '2027-01-01' }], 'lista');
  assert.deepEqual(r3.actualizar, []);
  assert.deepEqual(r3.conservar, [{ id: 71, numero: 1, motivo: 'link' }]);
  assert.deepEqual(r3.borrar.map((b) => b.id), [72]);
  assert.deepEqual(r3.insertar, []);
  // Un número nuevo va después del ÚLTIMO que existe, contando las que se van a borrar (se inserta antes de borrar).
  const r2 = reconciliarCuotas([Q(41, 5, 100, '2026-11-01')], [{ monto_usd: 1, fecha_esperada: null }, { monto_usd: 2, fecha_esperada: null }], 'porId');
  assert.deepEqual(r2.insertar.map((i) => i.numero), [6, 7]);
  assert.deepEqual(r2.borrar.map((b) => b.id), [41]);
});

/** La deuda que queda después de aplicar el plan: lo que no se borró (con su monto nuevo si se actualizó) + lo insertado. */
const deudaDespues = (ex: CuotaExistente[], r: ReturnType<typeof reconciliarCuotas>): number => {
  const nuevo = new Map(r.actualizar.map((u) => [u.id, u.monto_usd]));
  const borradas = new Set(r.borrar.map((b) => b.id));
  const quedan = ex.filter((q) => !q.pagado && !q.devuelta && !borradas.has(q.id)).reduce((t, q) => t + (nuevo.get(q.id) ?? q.monto_usd), 0);
  return quedan + r.insertar.reduce((t, i) => t + i.monto_usd, 0);
};

test('⚠️ lista: una protegida NUNCA deja su deseada en «insertar» (la misma deuda dos veces)', () => {
  // Caso A del chat de Pagos (14/10/2026): A vencida con recordatorio, B y C libres; se piden dos de 1500.
  // Con las libres casadas primero, A quedaba sin deseada, se conservaba igual y el total daba 4000.
  for (const orden of [[1, 2, 3], [3, 1, 2]]) {
    const ex = [
      Q(81, orden[0], 1000, '2026-09-01', { protegida: ['recordatorio'] }),
      Q(82, orden[1], 1000, '2026-10-01'),
      Q(83, orden[2], 1000, '2026-11-01'),
    ];
    const r = reconciliarCuotas(ex, [{ monto_usd: 1500, fecha_esperada: '2026-10-01' }, { monto_usd: 1500, fecha_esperada: '2026-11-01' }], 'lista');
    assert.equal(deudaDespues(ex, r), 2500, `la protegida (número ${orden[0]}) se queda en 1000, una libre pasa a 1500 y la otra se borra`);
    assert.deepEqual(r.insertar, [], 'nunca hay un insertar mientras quede una protegida sin casar');
    assert.deepEqual(r.conservar, [{ id: 81, numero: orden[0], motivo: 'recordatorio' }], 'y la protegida queda avisada');
  }
  // Caso B: una cuota de 500 con link; se pide 500 con otra fecha → se mueve la fecha de ESA cuota.
  const exB = [Q(91, 1, 500, '2026-11-01', { protegida: ['link'] })];
  const rB = reconciliarCuotas(exB, [{ monto_usd: 500, fecha_esperada: '2026-11-20' }], 'lista');
  assert.deepEqual(rB.actualizar.map((u) => [u.id, u.fecha_esperada]), [[91, '2026-11-20']]);
  assert.deepEqual(rB.insertar, []);
  assert.deepEqual(rB.conservar, []);
  // Invariante: cada deseada termina en UNO de igual / actualizar / conservar / insertar, nunca en dos.
  const exC = [Q(1, 1, 300, '2026-11-01', { protegida: ['link'] }), Q(2, 2, 300, '2026-12-01', { protegida: ['recordatorio'] }), Q(3, 3, 300, '2027-01-01')];
  const deseadas = [{ monto_usd: 300, fecha_esperada: '2027-01-01' }, { monto_usd: 400, fecha_esperada: '2026-12-01' }, { monto_usd: 400, fecha_esperada: '2026-11-15' }];
  const rC = reconciliarCuotas(exC, deseadas, 'lista');
  const iguales = 1; // la 3, idéntica
  assert.equal(rC.actualizar.length + rC.conservar.length + iguales + rC.insertar.length, deseadas.length);
});

test('slots (plan uniforme): por número, la pagada cubre su número, y la que sobra se borra si no está protegida', () => {
  const ex = [Q(50, 0, 1000, '2026-10-01', { pagado: true }), Q(51, 1, 500, '2026-11-05'), Q(52, 2, 500, '2026-12-05'), Q(53, 3, 500, '2027-01-05', { protegida: ['recordatorio'] })];
  const deseadas = cuotasDelPlan({ cobro_inicial_usd: 1000, monto_cuota_usd: 600, total_cuotas: 2, dia_de_pago: 10 }, '2026-10-01');
  assert.deepEqual(deseadas.map((d) => [d.numero, d.monto_usd, d.fecha_esperada]), [[0, 1000, '2026-10-01'], [1, 600, '2026-11-10'], [2, 600, '2026-12-10']]);
  const r = reconciliarCuotas(ex, deseadas, 'slots');
  assert.deepEqual(r.actualizar.map((u) => [u.id, u.monto_usd, u.fecha_esperada]), [[51, 600, '2026-11-10'], [52, 600, '2026-12-10']]);
  assert.deepEqual(r.insertar, [], 'el inicial cobrado cubre el número 0');
  assert.deepEqual(r.conservar, [{ id: 53, numero: 3, motivo: 'recordatorio' }]);
  assert.deepEqual(r.borrar, []);
  // Un número que falta se inserta CON su número.
  const r2 = reconciliarCuotas([Q(60, 1, 500, '2026-11-10')], cuotasDelPlan({ cobro_inicial_usd: null, monto_cuota_usd: 500, total_cuotas: 2, dia_de_pago: 10 }, '2026-10-01'), 'slots');
  assert.deepEqual(r2.insertar, [{ numero: 2, monto_usd: 500, fecha_esperada: '2026-12-10' }]);
  assert.deepEqual(r2.actualizar, []);
});

test('el historial de una reconciliación: una línea por cuota con su antes y su después, y lo que no se tocó con el porqué', () => {
  const r = reconciliarCuotas(
    [Q(81, 0, 1000, '2026-10-01'), Q(82, 1, 500, '2026-11-01'), Q(83, 2, 500, '2026-12-01', { protegida: ['link'] })],
    [{ id: 81, monto_usd: 900, fecha_esperada: '2026-10-01' }, { id: null, monto_usd: 300, fecha_esperada: null }],
    'porId',
  );
  assert.deepEqual(lineasDeCuotas(r), [
    { campo: 'Cobro inicial', valor_anterior: 'USD 1000 · vence 01/10/2026', valor_nuevo: 'USD 900 · vence 01/10/2026' },
    { campo: 'Cuota 3', valor_anterior: null, valor_nuevo: 'USD 300 · vence sin fecha' },
    { campo: 'Cuota 1', valor_anterior: 'USD 500 · vence 01/11/2026', valor_nuevo: null },
  ]);
  assert.equal(avisoDeConservadas(r), 'Cuota 2: tiene un link sin pagar');
  assert.equal(avisoDeConservadas({ actualizar: [], insertar: [], borrar: [], conservar: [] }), null);
});

// ── 5. El plan ────────────────────────────────────────────────────────────────

test('⚠️ ajustar el plan escribe SÓLO lo que cambió, encima de lo que está en la base', () => {
  const base = { cobro_inicial_usd: 1000, monto_cuota_usd: 1000, total_cuotas: 3, dia_de_pago: 15 };
  // Cambiar sólo el inicial: las cuotas 1 a 3 y el día 15 quedan (antes se borraban y se corrían al día 1).
  const v = ajustarSobre(base, { cobro_inicial_usd: 500 });
  assert.ok(v.ok);
  if (!v.ok) return;
  assert.deepEqual(v.plan, { cobro_inicial_usd: 500, monto_cuota_usd: 1000, total_cuotas: 3, dia_de_pago: 15 });
  const cuotas = cuotasDelPlan(v.plan, '2026-10-01');
  assert.deepEqual(cuotas.map((c) => [c.numero, c.monto_usd, c.fecha_esperada]), [[0, 500, '2026-10-01'], [1, 1000, '2026-11-15'], [2, 1000, '2026-12-15'], [3, 1000, '2027-01-15']]);
  // Un null explícito vacía a propósito (sacar el inicial); una clave en undefined se conserva.
  const sinInicial = ajustarSobre(base, { cobro_inicial_usd: null, dia_de_pago: undefined });
  assert.ok(sinInicial.ok && sinInicial.plan.cobro_inicial_usd === null && sinInicial.plan.dia_de_pago === 15);
  // Un lead sin plan en la base (cuotas cargadas a mano): no se inventa el día 1, se pide.
  const vacio = { cobro_inicial_usd: null, monto_cuota_usd: null, total_cuotas: null, dia_de_pago: null };
  const sinDia = ajustarSobre(vacio, { monto_cuota_usd: 1200, total_cuotas: 3 });
  assert.equal(sinDia.ok, false);
  if (!sinDia.ok) assert.deepEqual(sinDia.faltan, ['dia_de_pago']);
  // El Deshacer escribe el plan anterior TAL CUAL, nulls incluidos (antes se descartaba si no pasaba la validación).
  assert.deepEqual(planComoEstaba(vacio), vacio);
  assert.deepEqual(planComoEstaba({ cobro_inicial_usd: '250', monto_cuota_usd: -5, total_cuotas: 9, dia_de_pago: 10 }), { cobro_inicial_usd: 250, monto_cuota_usd: null, total_cuotas: null, dia_de_pago: 10 });
});

test('el plan se valida como lo pide la base (1 a 6 cuotas, día 1 a 28) y el inicial 0 es «sin inicial»', () => {
  assert.deepEqual(validarPlan({ cobro_inicial_usd: 0, monto_cuota_usd: 250.555, total_cuotas: 3, dia_de_pago: 5 }),
    { ok: true, plan: { cobro_inicial_usd: null, monto_cuota_usd: 250.56, total_cuotas: 3, dia_de_pago: 5 } });
  assert.equal(validarPlan({ monto_cuota_usd: 100, total_cuotas: 7 }).ok, false);
  assert.equal(validarPlan({ monto_cuota_usd: 100, total_cuotas: 2, dia_de_pago: 31 }).ok, false);
  assert.equal(validarPlan({}).ok, false);
  assert.deepEqual(validarPlan({ cobro_inicial_usd: 900 }), { ok: true, plan: { cobro_inicial_usd: 900, monto_cuota_usd: null, total_cuotas: null, dia_de_pago: null } });
});

// ── 6. La moneda de un pago a mano ────────────────────────────────────────────

test('un pago a mano en otra moneda guarda la moneda y su valor en dólares DECLARADO; sin moneda es USD', () => {
  assert.deepEqual(pagoEnMoneda({ montoUsd: 500, moneda: 'mxn', montoOriginal: 8600 }), { ok: true, montoUsd: 500, moneda: 'MXN', montoOriginal: 8600 });
  const sinUsd = pagoEnMoneda({ moneda: 'ARS', montoOriginal: 450000 });
  assert.equal(sinUsd.ok, false, 'nunca una tasa inventada');
  assert.deepEqual((sinUsd as { faltan?: string[] }).faltan, ['montoUsd']);
  // El valor de la cuota que se salda sirve de dólares declarados.
  assert.deepEqual(pagoEnMoneda({ moneda: 'ARS', montoOriginal: 450000 }, { montoUsdPorDefecto: 400 }), { ok: true, montoUsd: 400, moneda: 'ARS', montoOriginal: 450000 });
  assert.equal(pagoEnMoneda({ montoUsd: 500, moneda: 'MXN' }).ok, false, 'falta cuánto en pesos');
  assert.equal(pagoEnMoneda({ montoUsd: 500, moneda: 'pesos' }).ok, false);
  // ⚠️ Sin moneda es dólares (lo que mandan las pantallas viejas), con moneda y monto original null.
  assert.deepEqual(pagoEnMoneda({ montoUsd: 500 }), { ok: true, montoUsd: 500, moneda: null, montoOriginal: null });
  assert.deepEqual(pagoEnMoneda({ montoUsd: 500, moneda: 'USD' }), { ok: true, montoUsd: 500, moneda: 'USD', montoOriginal: 500 });
  assert.deepEqual(etiquetaDePago({ concepto: '  Adelanto  ', metodo: 'transferencia' }), { concepto: 'Adelanto', metodo: 'transferencia' });
  assert.deepEqual(etiquetaDePago({ metodo: 'bitcoin' }), { concepto: null, metodo: 'otro' });
});

// ── 7. Quién usa las piezas (un arreglo puro sin enchufar no arregla nada) ────────
const fuente = (r: string) => readFileSync(new URL(r, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('las acciones ajustan sobre la base y deshacen tal cual; la API y el wizard dicen lo que no se tocó', () => {
  const acciones = fuente('../app/crm/[id]/pagos-campo-actions.ts');
  assert.match(acciones, /const v = ajustarSobre\(planAntes, plan\);/, 'ajustarPlanAction valida el plan MEZCLADO con la base');
  assert.match(acciones, /update\(\{ \.\.\.planComoEstaba\(plan\) \}\)/, 'el Deshacer devuelve el plan anterior tal cual');
  assert.doesNotMatch(acciones, /validarPlan\(plan/, 'ningún plan parcial se valida como plan entero');
  const api = fuente('../lib/api-mako/areas/crm.run.ts');
  assert.match(api, /const cambios = await saveLeadPlanManual\(/);
  assert.match(api, /const sinTocar = avisoDeConservadas\(cambios\);/, 'guardar_cuotas no contesta «Listo» sobre lo que no escribió');
  const wizard = fuente('../app/crm/actions.ts');
  assert.match(wizard, /sinTocar = avisoDeConservadas\(cambios\);/, 'el wizard de Ganado deja en el historial lo que no se tocó');
});
