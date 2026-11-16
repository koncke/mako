// =============================================================================
// «Aprobado, ábreles las cuentas» (16/11/2026, Martín en el grupo de SuperAdmin, Código Inmobiliario)
// =============================================================================
// EL CASO: el comprobante de 59,54 USDT (orden 4660001999873228880) llegó a revisión con «debía 89.31 USD» (tres entradas de US$29,77:
// Giselle, Pablo y Marcela). Juan Francisco escribió, justo después de la foto, «Giselle Belanti y Marcela Fernández». Martín: «Aprobado,
// abreles las cuentas. Y siempre que me digas este mensaje por aqui, adjunta tambien el comprobante». MaKo propuso marcar las TRES y pidió
// un «sí»; con el «Si», «No puedo hacerlo desde acá: sólo el super admin…». Y al grupo de la agencia sólo salió el recibo.
// Lo que fija, una falla por bloque:
//   1. el super admin también por el canal: el dueño en el grupo de la plataforma (`duenoDeLaPlataforma`), en las cinco de la mensualidad;
//   2. el «aprobado» ES la confirmación: el código deja la pendiente al mandar a revisar, y la puerta del «sí» puro no la frena;
//   3. el reparto: nunca más que lo pagado; si calza con varias, lo que se dijo; si nadie lo dijo, se pregunta;
//   4. el aviso a Martín lleva el comprobante;
//   5. con el recibo, a la agencia: quiénes quedaron activos (un solo lugar que lo arma).
// Probado rompiéndolo (16/11/2026, una rotura por vez, restaurada): ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  avisoDeComprobanteParaRevisar, clientesNombrados, cuentasActivasDelPago, diferencialDe, repartoDelComprobante, textoDeComprobante, textoDeCuentasActivas,
  type Pendiente,
} from '../lib/agencia-mes-reglas';
import { makoPreguntoAlgo } from '../lib/mako-intencion';
import { rechazoSiNoEsConfirmacionPura } from '../lib/confirmacion-pura';
import { porId } from '../lib/api-mako/registro';
import { esAccion } from '../lib/api-mako/tipos';
import { viajaEnLaAccion } from '../lib/despacho-grupo';
import { marcasDeVoseo } from '../lib/voseo';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const tramo = (src: string, desde: string, hasta: string) => { const a = src.indexOf(desde); assert.ok(a >= 0, `no está «${desde}»`); const b = src.indexOf(hasta, a + desde.length); return src.slice(a, b < 0 ? undefined : b); };

// La cartera de Código esa noche (las cuentas y los nombres de tests/hilo-del-superadmin.test.ts).
const CLIENTES = [
  { ws: 31, nombre: 'Giselle' }, { ws: 32, nombre: 'Pablo Chavez' }, { ws: 33, nombre: 'Marcela' }, { ws: 34, nombre: 'Nico Sellers' },
  { ws: 35, nombre: 'Brigitte Eberlin' }, { ws: 36, nombre: 'Natalia' }, { ws: 37, nombre: 'Patricia Contreras' }, { ws: 38, nombre: 'Sergio Arriata' },
];
const entrada = (ws: number, nombre: string): Pendiente => ({ tipo: 'entrada', ws, nombre, plan: 'esencial', entrada: diferencialDe('2026-11-16', 47), pagadoUsd: 0, debeUsd: 29.77, limite: '2026-11-16' });
const TRES: Pendiente[] = [entrada(31, 'Giselle'), entrada(32, 'Pablo Chavez'), entrada(33, 'Marcela')];
const suma = (xs: Array<{ montoUsd: number }>) => Math.round(xs.reduce((a, x) => a + x.montoUsd, 0) * 100) / 100;

test('3. el reparto: lo que dijo quien pagó decide entre las que calzan; nunca más que lo pagado; si nadie lo dijo, se pregunta', () => {
  // Lo que escribió Juan Francisco nombra a Giselle y a Marcela; «Aprobado, abreles las cuentas» no nombra a nadie.
  assert.deepEqual(clientesNombrados(['Giselle Belanti y Marcela Fernández'], CLIENTES), [31, 33]);
  assert.deepEqual(clientesNombrados(['Aprobado, abreles las cuentas. Y siempre que me digas este mensaje por aqui, adjunta tambien el comprobante'], CLIENTES), []);
  // Una palabra que es de DOS clientes no nombra a ninguno.
  assert.deepEqual(clientesNombrados(['la de Pablo'], [{ ws: 1, nombre: 'Pablo Chavez' }, { ws: 2, nombre: 'Pablo Ruiz' }]), []);
  assert.deepEqual(clientesNombrados(['chavez'], [{ ws: 1, nombre: 'Pablo Chavez' }, { ws: 2, nombre: 'Pablo Ruiz' }]), [1]);

  // EL CASO: 59,54 calza con tres pares; lo dicho en el grupo elige Giselle + Marcela, por 59,54 y no 89,31.
  const r = repartoDelComprobante(59.54, TRES, { nombrados: [[], [31, 33]] });
  assert.equal(r.tipo, 'aplicar');
  if (r.tipo !== 'aplicar') return;
  assert.deepEqual(r.claves, ['entrada:31', 'entrada:33']);
  assert.equal(suma(r.aplicado), 59.54);
  assert.equal(r.porNombre, true);
  assert.equal(r.parcial, null);
  // Sin que nadie lo diga, se pregunta (nunca las tres, nunca la primera).
  const sinNombres = repartoDelComprobante(59.54, TRES);
  assert.equal(sinNombres.tipo, 'preguntar');
  assert.equal(sinNombres.tipo === 'preguntar' && sinNombres.opciones.length, 3);
  // Nombrar a las tres con plata para dos no es una opción: se pregunta.
  assert.equal(repartoDelComprobante(59.54, TRES, { nombrados: [[31, 32, 33]] }).tipo, 'preguntar');
  // Lo que dice quien aprueba va antes que lo que dijo quien pagó.
  const deMartin = repartoDelComprobante(59.54, TRES, { nombrados: [[31, 32], [31, 33]] });
  assert.deepEqual(deMartin.tipo === 'aplicar' && deMartin.claves, ['entrada:31', 'entrada:32']);
  // Un nombrado que no está en juego (Nico ya pagó) no estorba.
  assert.deepEqual((repartoDelComprobante(59.54, TRES, { nombrados: [[31, 33, 34]] }) as { claves?: string[] }).claves, ['entrada:31', 'entrada:33']);
  // Lo elegido al proponer: sólo eso, y si ya no se debe, ya no va.
  assert.deepEqual((repartoDelComprobante(59.54, TRES, { claves: ['entrada:31', 'entrada:33'] }) as { claves?: string[] }).claves, ['entrada:31', 'entrada:33']);
  assert.equal(repartoDelComprobante(59.54, TRES.slice(1), { claves: ['entrada:31', 'entrada:33'] }).tipo, 'no');
  assert.equal(repartoDelComprobante(89.31 * 2, TRES).tipo, 'no', 'de más: lo decide una persona');
  // NUNCA MÁS QUE LO PAGADO, con cualquier monto y cualquier cosa dicha.
  for (const monto of [10, 29.77, 40, 59.54, 70, 89.31]) {
    for (const nombrados of [[], [[31]], [[31, 33]], [[31, 32, 33]], [[32], [33]]]) {
      const x = repartoDelComprobante(monto, TRES, { nombrados });
      if (x.tipo === 'aplicar') assert.ok(suma(x.aplicado) <= monto + 0.01, `${monto} con ${JSON.stringify(nombrados)} aplica ${suma(x.aplicado)}`);
    }
  }
});

test('2. el «aprobado» confirma: la pendiente la deja el código, la puerta del «sí» puro no la frena, y el aviso lo dice', () => {
  const def = porId('aplicar_comprobante_agencia');
  assert.ok(def && esAccion(def), 'no está la acción del comprobante aprobado');
  if (!def || !esAccion(def)) return;
  assert.equal(def.confirmacion, 'chat');
  assert.deepEqual(def.gating, { rolMinimo: 'admin', soloPlataforma: true });
  assert.ok(viajaEnLaAccion('aplicar_comprobante_agencia'), 'se delegaría en vez de proponerse');
  // «Aprobado, abreles las cuentas…» no es un «sí» puro: si la acción fuera de terceros o de plata, volvería a pedir el «sí».
  const rechazo = rechazoSiNoEsConfirmacionPura({
    canal: 'whatsapp', aTerceros: def.aTerceros, plata: def.plata, titulo: def.titulo, resumen: 'r', id: def.id,
    mensaje: 'Aprobado, abreles las cuentas. Y siempre que me digas este mensaje por aqui, adjunta tambien el comprobante',
    enElGrupo: { pidio: null, confirma: '5491100000000@s.whatsapp.net', aMaKo: false }, nacioEnLaApp: false,
  });
  assert.equal(rechazo, null, `el «aprobado» no confirma: ${rechazo}`);
  // El aviso con la propuesta: pregunta (el «aprobado» sigue la oferta), dice qué se marca y que el «aprobado» alcanza.
  const aviso = avisoDeComprobanteParaRevisar({
    agencia: 'Código Inmobiliario', agenciaWs: 13, porque: 'la lectura tiene dudas: el monto', lectura: 'Binance, 59.54 USDT, orden N.º 4660001999873228880.',
    debe: 'entrada de Giselle (cuenta 31) US$ 29,77 · entrada de Pablo Chavez (cuenta 32) US$ 29,77 · entrada de Marcela (cuenta 33) US$ 29,77',
    propuesta: 'Con lo que pagó marco: la entrada de Giselle y la entrada de Marcela.',
  });
  assert.match(aviso, /Con lo que pagó marco: la entrada de Giselle y la entrada de Marcela\. Si está bien, ¿lo marco como pagado\? Con tu «aprobado» queda hecho\.$/);
  assert.equal(makoPreguntoAlgo(aviso), true);
  assert.deepEqual(marcasDeVoseo(aviso), []);
  // Sin propuesta, el de siempre (tests/hilo-del-superadmin.test.ts).
  assert.match(avisoDeComprobanteParaRevisar({ agencia: 'A', agenciaWs: 1, porque: 'p', lectura: 'l.', debe: 'd' }), /Lo que debía: d\. Si está bien, ¿lo marco como pagado\?$/);

  // El cableado: la revisión deja la pendiente (fuera del turno de la agencia: una del grupo de la app no se confirmaría por WhatsApp), con un día de vida.
  const comp = leer('lib/agencia-mes-comprobante.ts');
  const revisar = tramo(comp, 'const revisar = async', 'const totalDebe');
  assert.match(revisar, /await proponerComprobanteAMartin\(m, \{/);
  assert.match(revisar, /ordenLeida && usada === false && l\.monto && l\.monto > 0 && esDolar\(l\.moneda\)/, 'propone sin orden, sin saber si se usó o en otra moneda');
  assert.match(revisar, /debe: loQueDebe\(m\.pendientes\), propuesta,/);
  const proponer = tramo(comp, 'export async function proponerComprobanteAMartin', '\n}\n');
  assert.match(proponer, /conSalidaDelGrupo\(\{ ws: wsP, clave: grupoJid, soloApp: false, hayInvitado: false \}, \(\) => crearPendiente\(wsP, \{/);
  assert.match(proponer, /tipo: TIPO_APLICAR_COMPROBANTE, payload: \{ \.\.\.pago, claves \}/);
  assert.match(comp, /export const TIPO_APLICAR_COMPROBANTE = 'aplicar_comprobante_agencia';/);
  assert.match(comp, /const TTL_REVISION_MIN = 24 \* 60;/);
  // Lo decide el código al confirmar, con lo que se debe AHORA: la pregunta no quema la pendiente; lo que ya no va, la cierra.
  const run = leer('lib/api-mako/areas/cobros.run.ts');
  const aplicar = tramo(run, '  aplicar_comprobante_agencia: {', '\n  },\n');
  assert.match(aplicar, /faltaParaConfirmar: async \(payload, ctx\) => \{[\s\S]*aQueVaElComprobante\(payload, ctx\.mensajeUsuario \?\? ''\)[\s\S]*return a\.tipo === 'no' \? \{ yaNoVale: a\.texto \} : a\.texto;/);
  assert.match(aplicar, /ejecutar: \(payload, ctx\) => seguro\('aplicar el comprobante'[\s\S]*aplicarComprobanteAprobado\(a, autorDe\(ctx\)\)/);
});

test('1. el super admin por el canal: el dueño en el grupo de la plataforma, en las cinco de la mensualidad; la sesión, en la app', () => {
  const run = leer('lib/api-mako/areas/cobros.run.ts');
  const quien = tramo(run, 'async function superAdminQueConfirma', '\n}\n');
  assert.match(quien, /if \(ctx\.canal === 'whatsapp' && ctx\.duenoDeLaPlataforma === true\) return ctx\.ws === \(await wsSuperAdmin\(\)\.catch\(\(\) => null\)\);/);
  assert.match(quien, /return esSuperAdmin\(\);/);
  for (const id of ['marcar_mensualidad_pagada', 'corregir_reloj_mensualidad', 'prender_mensualidad_agencia', 'marcar_entrada_pagada', 'aplicar_comprobante_agencia']) {
    const t = tramo(run, `  ${id}: {`, '\n  },\n');
    assert.doesNotMatch(t, /esSuperAdmin\(\)/, `${id} mira sólo la sesión: por WhatsApp, Martín no es el super admin`);
    assert.equal((t.match(/superAdminQueConfirma\(ctx\)/g) ?? []).length, 2, `${id}: al confirmar y al ejecutar`);
  }
  // Lo pone el doer por QUIEN escribe (su línea, la letra de la app o su teléfono de admin), nunca por el grupo, ni a un invitado o al equipo.
  const doer = leer('lib/mako-doer-in.ts');
  const ctxApi = tramo(doer, 'const ctxApi: CtxApi = {', '// Quién escribe, para el ticket');
  assert.match(ctxApi, /\.\.\.\(escribeElDueno && !hayInvitado \? \{ duenoDeLaPlataforma: true as const \} : \{\}\),/);
  assert.ok(doer.indexOf('const escribeElDueno = esElGrupoDeLaPlataforma && !data.loteDeVarios') < doer.indexOf('const ctxApi: CtxApi = {'), 'escribeElDueno se arma después del ctx');
});

test('3-bis. un «marcar» con una orden ya anotada o un pago de más se frena antes del «sí»', () => {
  const run = leer('lib/api-mako/areas/cobros.run.ts');
  for (const id of ['marcar_mensualidad_pagada', 'marcar_entrada_pagada']) {
    assert.match(tramo(run, `  ${id}: {`, 'faltaParaConfirmar'), /const noVa = ordenQueNoVa\(pago\.pago, \w+\.debeUsd, m\.libro\.ordenes\);\s*if \(noVa\) return noVa;/, id);
  }
  const f = tramo(run, 'function ordenQueNoVa', '\n}\n');
  assert.match(f, /if \(ordenes\.has\(pago\.orden\)\)/);
  assert.match(f, /if \(pago\.montoUsd > debeUsd \* 1\.01 \+ 0\.01\)/);
});

test('4. el aviso de revisión lleva el comprobante, y el grupo de SuperAdmin lo manda con el texto de pie (o el texto solo, si no sale)', () => {
  const comp = leer('lib/agencia-mes-comprobante.ts');
  const revisar = tramo(comp, 'const revisar = async', 'const totalDebe');
  assert.match(revisar, /\}\), archivoDe\(p\.bytes, mime\)\);/, 'el aviso de revisión salió sin el comprobante');
  assert.equal((comp.match(/avisarAMartin\([^\n]*archivoDe\(p\.bytes, mime\)\)/g) ?? []).length, 3, 'los otros avisos del comprobante (sin leer, sin mensualidad) también lo llevan');
  const mes = leer('lib/agencia-mes.ts');
  assert.match(mes, /export async function avisarAMartin\(texto: string, archivo\?: ArchivoDelAviso \| null\)/);
  assert.match(mes, /enviarAlGrupoSuperAdmin\(texto, archivo \? \{ archivo \} : \{\}\)/);
  const grupo = tramo(leer('lib/mako-grupo.ts'), 'export async function enviarAlGrupoSuperAdmin', '\n}\n');
  assert.match(grupo, /const media: MediaGrupo \| null = o\.archivo \? \{ tipo: o\.archivo\.mime === 'application\/pdf' \? 'document' : 'image',/);
  assert.match(grupo, /const partes: PartePreparada\[\] \| null = o\.archivo && media\s*\?\s*\[\{ tipo: 'media', base64: o\.archivo\.base64, media, \.\.\.\(conPie \? \{ caption: texto \} : \{\}\) \}, \.\.\.\(conPie \? \[\] : \[\{ tipo: 'texto' as const, texto \}\]\)\]/, 'el archivo no arma la parte (con el texto de pie, o aparte si es largo)');
  assert.match(grupo, /const conArchivo = partes \? await enviarPartesAJid\(jid, partes\)\.catch\(\(\) => null\) : null;/);
  assert.match(grupo, /if \(conArchivo\?\.ok && conArchivo\.ids\.length\) \{[\s\S]*?\} else \{\s*const e = await enviarTextoVozMaKo\(jid, texto\);/, 'si el archivo no sale, no sale el texto');
  assert.match(grupo, /copiarAlGrupo\(wsApp, \{ texto, de: 'mako', \.\.\.\(partes \? \{ partes \} : \{\}\) \}\)/, 'el hilo de la app no lleva el comprobante');
});

test('5. con el recibo, a la agencia: quiénes quedaron activos y que ya pueden entrar; un solo lugar que lo arma', () => {
  // El caso: Giselle y Marcela pagaron su entrada y se reabrieron.
  const activas = cuentasActivasDelPago({ agenciaWs: 13, completas: ['entrada:31', 'entrada:33'], reabiertas: [31, 33], clientes: CLIENTES });
  assert.deepEqual(activas, { clientes: ['Giselle', 'Marcela'], agencia: false });
  assert.equal(textoDeCuentasActivas(activas), 'Ya quedaron activas las cuentas de Giselle y Marcela: pueden entrar tranquilamente.');
  assert.equal(textoDeCuentasActivas({ clientes: ['Giselle'], agencia: false }), 'Ya quedó activa la cuenta de Giselle: puede entrar tranquilamente.');
  // El mes de la agencia: su cuenta también, y los clientes que reabrió.
  const mes = cuentasActivasDelPago({ agenciaWs: 13, completas: ['mes:2026-11'], reabiertas: [13, 34, 36], clientes: CLIENTES });
  assert.deepEqual(mes, { clientes: ['Nico Sellers', 'Natalia'], agencia: true });
  assert.equal(textoDeCuentasActivas(mes), 'Ya quedaron activas las cuentas de Nico Sellers y Natalia: pueden entrar tranquilamente. La cuenta de la agencia también sigue activa.');
  assert.equal(textoDeCuentasActivas({ clientes: [], agencia: true }), 'La cuenta de la agencia sigue activa.');
  assert.equal(textoDeCuentasActivas({ clientes: [], agencia: false }), '');
  // El «Recibí tu pago» del comprobante leído usa el mismo texto.
  assert.match(textoDeComprobante({ tipo: 'cubre', montoUsd: 59.54, conceptos: ['la entrada de Giselle', 'la entrada de Marcela'], activas }), /Te mando el recibo\.\nYa quedaron activas las cuentas de Giselle y Marcela: pueden entrar tranquilamente\.$/);
  for (const t of [textoDeCuentasActivas(activas), textoDeCuentasActivas(mes)]) assert.deepEqual(marcasDeVoseo(t), [], t);

  // UN SOLO LUGAR: el recibo de un pago de agencia sale sólo por `cerrarElPagoDeAgencia`, que después reabre y le dice a la agencia quiénes.
  const src = leer('lib/agencia-mes.ts');
  const cerrar = tramo(src, 'export async function cerrarElPagoDeAgencia', '\n}\n');
  assert.ok(cerrar.indexOf('emitirReciboDeLoCompleto(') < cerrar.indexOf('revisarPausasDeAgencia(') && cerrar.indexOf('revisarPausasDeAgencia(') < cerrar.indexOf('textoAlGrupoDeLaAgencia('), 'el orden: recibo, reabrir, el texto');
  assert.match(cerrar, /const texto = textoDeCuentasActivas\(activas\);/);
  const libs = ['lib/agencia-mes.ts', 'lib/agencia-mes-comprobante.ts', 'lib/api-mako/areas/cobros.run.ts'].map((f) => [f, leer(f)] as const);
  const llamadas = libs.flatMap(([f, s]) => [...s.matchAll(/(?<!function )emitirReciboDeLoCompleto\(/g)].map(() => f));
  assert.deepEqual(llamadas, ['lib/agencia-mes.ts'], 'un recibo de agencia sale por fuera de cerrarElPagoDeAgencia');
  for (const f of ['export async function marcarMesPagado', 'export async function marcarEntradaPagada']) assert.match(tramo(src, f, '\n}\n'), /await cerrarElPagoDeAgencia\(m, /, `${f} no avisa quiénes quedaron activos`);
  const comp = leer('lib/agencia-mes-comprobante.ts');
  assert.equal((comp.match(/await cerrarElPagoDeAgencia\(m, r\.completas, (AUTOR|autor), \{ conTexto: false \}\)/g) ?? []).length, 2, 'el comprobante leído y el aprobado');
  assert.equal((comp.match(/activas: cierre\.activas/g) ?? []).length, 4, 'el «Recibí tu pago» (cubre y parcial, leído y aprobado) sin quiénes quedaron activos');
});

// ── Probado rompiéndolo (16/11/2026, una rotura por vez, restaurada; 6 pasan sin romper) ─────────────────────────────
//   el doer sin `duenoDeLaPlataforma` · `marcar_entrada_pagada` con `esSuperAdmin()` · `superAdminQueConfirma` sin mirar la plataforma → 1
//   la acción con `aTerceros` · la revisión sin `proponerComprobanteAMartin` · la pendiente sin `conSalidaDelGrupo` → 2
//   `repartoDelComprobante` sin lo que se dijo · con el ambiguo aplicando TODAS (el bug del 16/11) → 3 · `marcar` sin `ordenQueNoVa` → 3-bis
//   el aviso sin `archivoDe` · `enviarAlGrupoSuperAdmin` ignorando el archivo → 4
//   `textoDeCuentasActivas` sin los nombres · `marcarEntradaPagada` por fuera de `cerrarElPagoDeAgencia` · el cierre sin el texto → 5
