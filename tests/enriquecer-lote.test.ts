// =============================================================================
// Completar en LOTE desde el tablero, y «los que ya están, en gris abajo» (24/10/2026)
// =============================================================================
// Dos pedidos de Martín del mismo día, por el Cerebro:
//   1. «¿cómo comienzo a scrapear los datos de mis leads?... Eso debería poder hacerlo en lote, con el multiple check, no sólo
//      cuando cargo nuevos de grupos». «Completar desde mi WhatsApp» y «Datos de empresa» pasan a la barra de lote del CRM, con
//      las mismas máquinas que el modal del grupo (app/crm/enriquecer-cliente.ts) y los mismos núcleos en el server.
//   2. «si ya cargué un grupo o detecta que esos números ya están, no me debe cargar nuevamente... Debería aparecer en gris
//      abajo de todo».
// Las máquinas se prueban POR COMPORTAMIENTO, con dobles de las acciones del server: la cola, los pendientes al frente, el
// «Parar», el corte que se dice. El cableado, leyendo los archivos. Números inventados.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { coberturaDeFichas, correrPerfiles, guardarFichasEnTandas, preguntaDePerfiles, resumenDeFichas, resumenDePerfiles } from '../app/crm/enriquecer-cliente';
import { TANDA_FICHAS, type FichaWa } from '../lib/grupo-wa-reglas';

const leer = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const ficha = (i: number, extra: Partial<FichaWa> = {}): FichaWa => ({
  telefono: String(5491100000000 + i), agenda: null, pushname: `Persona ${i}`, empresa: null, esEmpresa: false, grupos: [], ...extra,
});
const ok = (o: Partial<{ nombres: number; empresas: number; pendientes: string[] }> = {}) =>
  ({ ok: true as const, recibidas: 0, deLeads: 0, nombres: o.nombres ?? 0, empresas: o.empresas ?? 0, grupos: 0, errores: 0, pendientes: o.pendientes ?? [] });

test('1. las fichas, de a tandas: todas, en orden, y lo que el server no llegó a guardar vuelve AL FRENTE', async () => {
  const fichas = Array.from({ length: TANDA_FICHAS * 2 + 5 }, (_, i) => ficha(i));
  const llamadas: string[][] = [];
  let primera = true;
  const a = await guardarFichasEnTandas(fichas, async (tanda) => {
    llamadas.push(tanda.map((f) => f.telefono));
    // La primera tanda corta por tiempo: los últimos 3 quedan pendientes.
    if (primera) { primera = false; return ok({ nombres: tanda.length - 3, pendientes: tanda.slice(-3).map((f) => f.telefono) }); }
    return ok({ nombres: tanda.length });
  }, { parar: () => false });
  assert.equal(a.error, null);
  assert.equal(a.parado, false);
  assert.equal(a.guardadas, fichas.length, 'quedaron fichas sin guardar');
  assert.equal(a.nombres, fichas.length);
  assert.ok(llamadas.every((t) => t.length <= TANDA_FICHAS), 'una tanda más grande que TANDA_FICHAS');
  assert.deepEqual(llamadas[1].slice(0, 3), llamadas[0].slice(-3), 'los pendientes no volvieron al frente de la cola');
  assert.deepEqual([...new Set(llamadas.flat())].sort(), fichas.map((f) => f.telefono).sort(), 'alguna ficha no se mandó nunca');
});

test('2. nunca un bucle que no termina, nunca un corte callado, y «Parar» frena entre tandas', async () => {
  const fichas = Array.from({ length: TANDA_FICHAS + 10 }, (_, i) => ficha(i));
  // Una tanda que vuelve ENTERA sin guardar: corta y lo dice, con cuántos quedaron.
  // El doble corta solo a la 4.ª vuelta: si la guarda se rompe, el test da rojo en vez de quedarse colgado.
  let vueltas = 0;
  const sinAvance = await guardarFichasEnTandas(fichas, async (tanda) => {
    if (++vueltas > 3) throw new Error('siguió llamando sin avanzar');
    return ok({ pendientes: tanda.map((f) => f.telefono) });
  }, { parar: () => false });
  assert.equal(vueltas, 1, 'siguió llamando sin avanzar');
  assert.match(sinAvance.error ?? '', /quedaron 50 sin guardar/);
  // El server dice que no: se corta, se dice el error y cuántos quedaron.
  const mal = await guardarFichasEnTandas(fichas, async () => ({ ok: false as const, error: 'Sólo el administrador…' }), { parar: () => false });
  assert.match(mal.error ?? '', /^Sólo el administrador… · quedaron 50 sin guardar\.$/);
  // La acción tira (se cayó la red): igual.
  const tira = await guardarFichasEnTandas(fichas, async () => { throw new Error('Failed to fetch'); }, { parar: () => false });
  assert.match(tira.error ?? '', /^Failed to fetch · quedaron 50 sin guardar\.$/);
  // «Parar» después de la primera tanda: no manda la segunda.
  let llamadas = 0;
  let pare = false;
  const parado = await guardarFichasEnTandas(fichas, async (t) => { llamadas++; pare = true; return ok({ nombres: t.length }); }, { parar: () => pare });
  assert.equal(llamadas, 1);
  assert.equal(parado.parado, true);
  assert.equal(parado.guardadas, TANDA_FICHAS);
  // El avance se dice antes de cada tanda.
  const avances: string[] = [];
  await guardarFichasEnTandas(fichas, async (t) => ok({ nombres: t.length }), { parar: () => false, alAvanzar: (g, tot) => avances.push(`${g}/${tot}`) });
  assert.deepEqual(avances, [`0/${fichas.length}`, `${TANDA_FICHAS}/${fichas.length}`]);
});

test('3. la cobertura y el aviso: lo que su WhatsApp tiene, lo escrito, y si paró o se cortó', () => {
  const fichas = [ficha(1, { agenda: 'Ana' }), ficha(2, { pushname: null, esEmpresa: true, empresa: 'La Espiga' }), ficha(3, { pushname: null, grupos: ['A', 'B'] })];
  assert.deepEqual(coberturaDeFichas(fichas), { conNombre: 2, deEmpresa: 1, enVarios: 1 });
  const base = { nombres: 2, empresas: 1, guardadas: 3, total: 3, parado: false, error: null };
  assert.equal(resumenDeFichas(221, fichas, base), 'De 221, tu WhatsApp tiene el nombre de 2, 1 son cuenta de empresa y 1 están en 2 o más grupos tuyos · 2 nombres completados, 1 empresa.');
  assert.match(resumenDeFichas(221, fichas, { ...base, parado: true }), / Paraste antes de terminar\.$/);
  assert.match(resumenDeFichas(221, fichas, { ...base, error: 'Se cortó guardando: quedaron 9 sin guardar.' }), /quedaron 9 sin guardar\.$/, 'el corte no se dice');
});

const perf = (o: Partial<{ revisados: number; empresas: number; completados: number; campos: number; pendientes: number; sinRespuesta: string[]; sigue: boolean; corte: 'dia' | null }>) => ({
  ok: true as const, total: 221, pendientes: o.pendientes ?? 221, quedanHoy: 120, estaCorrida: 40, revisados: o.revisados ?? 0, empresas: o.empresas ?? 0,
  completados: o.completados ?? 0, campos: o.campos ?? 0, errores: 0, sinRespuesta: o.sinRespuesta ?? [], sigue: o.sigue ?? false, corte: o.corte ?? null,
});

test('4. «Datos de empresa»: suma lo hecho entre llamadas, saltea a los que no contestaron, y dice por qué no siguió', async () => {
  const pedidos: Array<{ hechas: number; saltear: string[] }> = [];
  const respuestas = [
    perf({ revisados: 15, empresas: 6, completados: 2, campos: 3, pendientes: 221, sinRespuesta: ['1155550001'], sigue: true }),
    perf({ revisados: 15, empresas: 5, completados: 1, campos: 1, pendientes: 207, sigue: true }),
    perf({ revisados: 10, empresas: 3, pendientes: 192, corte: 'dia' }),
  ];
  const a = await correrPerfiles({ pendientes: 221, estaCorrida: 40 }, async (hechas, saltear) => { pedidos.push({ hechas, saltear }); return respuestas[pedidos.length - 1]; }, { parar: () => false });
  assert.deepEqual(pedidos.map((x) => x.hechas), [0, 15, 30], 'el avance necesita lo ya consultado');
  assert.deepEqual(pedidos[1].saltear, ['1155550001'], 'el que no contestó vuelve a ser el primero de la llamada siguiente');
  assert.equal(a.hechas, 40);
  assert.equal(a.empresas, 14);
  assert.equal(a.completados, 3);
  assert.equal(a.pendientes, 182);
  assert.equal(a.corte, 'dia');
  // UNA SOLA PASADA (25/10/2026, f14: «no debería volver a tocar nada»): lo único que corta es el tope del día, y se dice en
  // una línea. No dice «mañana sigue»: no sigue nada solo, hay que tocarlo (MaKo no hace nada por detrás).
  assert.equal(resumenDePerfiles(a), '14 de 40 tienen cuenta de empresa · 3 con datos nuevos (4 entre web, Instagram, correo y dirección). Faltan 182: tócalo mañana (120 consultas por día cuidan tu línea de un bloqueo).');
  // Sin el tope del día, los que quedan son los que no contestaron: nada de «vuelve a tocar para seguir».
  assert.equal(resumenDePerfiles({ ...a, corte: null, pendientes: 3 }), '14 de 40 tienen cuenta de empresa · 3 con datos nuevos (4 entre web, Instagram, correo y dirección). 3 no contestaron.');
  assert.doesNotMatch(resumenDePerfiles({ ...a, corte: null }), /vuelve a tocar/);
});

test('5. «Datos de empresa» no corta callado: el server que no consulta ninguno, el error, la red, el tope de vueltas y «Parar»', async () => {
  const cuenta = { pendientes: 221, estaCorrida: 40 };
  const nada = await correrPerfiles(cuenta, async () => perf({ revisados: 0, sigue: true }), { parar: () => false });
  assert.match(nada.error ?? '', /no llegó a consultar ninguno/, 'sin avance, cortó sin decirlo');
  const mal = await correrPerfiles(cuenta, async () => ({ ok: false as const, error: 'Conecta una línea de WhatsApp…' }), { parar: () => false });
  assert.equal(mal.error, 'Conecta una línea de WhatsApp…');
  const tira = await correrPerfiles(cuenta, async () => { throw new Error('Failed to fetch'); }, { parar: () => false });
  assert.equal(tira.error, 'Failed to fetch');
  let n = 0;
  const siempre = await correrPerfiles(cuenta, async () => {
    if (++n > 60) throw new Error('un bucle sin fin'); // el doble corta solo: una regresión es un rojo, no un test colgado
    return perf({ revisados: 1, sigue: true });
  }, { parar: () => false });
  // 30 vueltas (25/10/2026, sin tope por corrida): alcanzan para las 120 del día aunque cada llamada consulte sólo 4.
  assert.ok(n <= 30, 'un bucle sin fin');
  assert.match(siempre.error ?? '', /Se cortó después de 30 consultas/, 'el tope de vueltas cortó callado');
  let llamadas = 0;
  const parado = await correrPerfiles(cuenta, async () => { llamadas++; return perf({ revisados: 15, sigue: true }); }, { parar: () => llamadas >= 1 });
  assert.equal(llamadas, 1);
  assert.equal(parado.parado, true);
  assert.match(resumenDePerfiles(parado), / Paraste antes de terminar\.$/);
});

// La pregunta, CORTA (25/10/2026): Martín en la llamada con Leandro (24/10, f13), sobre la de antes —que decía además el cupo del
// día y que sólo se completa lo vacío, unas 40 palabras—: «el texto muy largo. No me gustan textos largos».
test('6. la pregunta antes de consultar: cuántos ahora de cuántos faltan y en cuánto, en una línea', () => {
  assert.equal(preguntaDePerfiles({ pendientes: 221, estaCorrida: 40 }, 2), '40 de los 221 que faltan, unos 2 min. No les llega nada.');
  assert.equal(preguntaDePerfiles({ pendientes: 3, estaCorrida: 3 }, 1), 'Los 3 que faltan, un minuto. No les llega nada.');
  // Desde el tablero la línea no se ve: se nombra (la consulta sale por ESA línea).
  assert.equal(preguntaDePerfiles({ pendientes: 3, estaCorrida: 3 }, 1, 'Ventas'), 'Los 3 que faltan, un minuto, desde «Ventas». No les llega nada.');
  assert.ok(preguntaDePerfiles({ pendientes: 1_221, estaCorrida: 40 }, 12, 'Ventas').split(/\s+/).length <= 16, 'volvió a ser un párrafo (la de antes: unas 40 palabras)');
});

test('7. el server del lote: sólo los tildados, por los MISMOS núcleos del grupo, y sólo el admin', () => {
  const lote = leer('app/crm/enriquecer-lote-server.ts');
  assert.match(lote, /return completarFichas\(\{ fichas: p\.fichas, autor: p\.autor, hasta: p\.hasta, soloIds: new Set\(p\.ids\) \}\);/, 'las fichas del lote se escriben fuera de los tildados');
  assert.match(lote, /const linea = \(await lineasDelNegocio\(\)\)\.find\(\(l\) => l\.conectada\) \?\? null;/, 'consulta por una línea que no es del negocio o no está conectada');
  assert.match(lote, /if \(buscarTelefono\(telIdx, t\.telefono\) !== t\.id\) return \[\];/, 'un teléfono de dos leads se adivina');
  // Con su código de país, como todo envío: si no, se consulta un número que no existe y queda «ya consultado» para siempre.
  assert.match(lote, /const n = numeroParaWhatsApp\(t\.telefono, linea\.numero\);\n\s+if \(!n\.ok\) \{ sinPais\+\+; return \[\]; \}\n\s+return \[\{ telefono: n\.numero, id: t\.id \}\];/, 'se consulta el número sin su código de país');
  assert.match(lote, /const r = await completarPerfiles\(\{ linea: linea\.linea, candidatos, autor: p\.autor, hechas: p\.hechas, saltear: p\.saltear, hasta: p\.hasta, soloContar: p\.soloContar \}\);/, 'el lote no le pasa al núcleo el tope de la corrida, los salteados o el techo de tiempo');
  assert.match(lote, /return r\.ok \? \{ \.\.\.r, lineaNombre: linea\.etiqueta, sinPais \} : r;/, 'la pregunta no puede nombrar la línea ni los sin país');
  assert.match(lote, /const db = await getTenantDb\(\);/, 'los teléfonos, de otro negocio');
  assert.doesNotMatch(sinComentarios(lote), /createLead|insert\(|\.update\(|agregarAProducto|ponerEtiqueta|setPipelineStage|sendText|\/message\//, 'el lote crea, mueve o manda');
  // El núcleo de las fichas filtra por los tildados.
  const server = leer('app/crm/grupo-wa-server.ts');
  const nucleo = server.slice(server.indexOf('export async function completarFichas('));
  assert.match(nucleo.slice(0, nucleo.indexOf('\n}\n')), /typeof id === 'number' && \(!p\.soloIds \|\| p\.soloIds\.has\(id\)\)/);
  // Las acciones: TODAS con la puerta del admin, y con techo de tiempo las que escriben.
  const acciones = leer('app/crm/enriquecer-actions.ts');
  const exportadas = [...acciones.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
  // `pedidosDeFichasAction` reemplazó a `telefonosDeLeadsAction` el 25/10/2026 (teléfono, `@lid` y grupo de cada tildado).
  assert.deepEqual(exportadas, ['pedidosDeFichasAction', 'completarFichasDeLeadsAction', 'completarPerfilesDeLeadsAction']);
  for (const f of exportadas) {
    const cuerpo = acciones.slice(acciones.indexOf(`export async function ${f}`));
    assert.match(cuerpo.slice(0, 400), /await exigirSesion\(\);\n {2}if \(\(await getRolWsEfectivo\(\)\) !== 'admin'\) return \{ ok: false, error: SOLO_ADMIN \};/, `${f}: sin la puerta del admin`);
  }
  assert.equal([...acciones.matchAll(/hasta: Date\.now\(\) \+ 40_000/g)].length, 2, 'una acción que escribe sin techo de tiempo');
  // Los ids que manda el navegador, limpios en las TRES (enteros positivos, sin repetir, con tope).
  assert.equal([...acciones.matchAll(/ids: idsLimpios\(p\.ids\)/g)].length, 2, 'una acción usa los ids del navegador sin limpiar');
  assert.match(acciones, /pedidosDeFichas\(idsLimpios\(ids\)\)/, 'los teléfonos, con ids sin limpiar');
  // Los pedidos: el grupo sale del HISTORIAL del lead, y el `@lid` de la LISTA del grupo (una lectura con caché), nunca de una
  // consulta de perfil por persona (eso sí gasta la red de la línea).
  const pedidos = lote.slice(lote.indexOf('export async function pedidosDeFichas('), lote.indexOf('/** Las fichas de SU WhatsApp Web'));
  assert.match(pedidos, /\.from\('lead_audit'\)\.select\('valor_nuevo'\)\.eq\('campo', EVENTO_TRAIDO_DE_GRUPO\)\.in\('lead_id', ids\.slice\(i, i \+ 200\)\)/);
  assert.match(pedidos, /const leidos = await participantesDelGrupo\(l\.linea, g\.jid\)/);
  assert.doesNotMatch(pedidos, /fetchBusinessProfile|\bev\(|fresco|true\)/, 'los pedidos consultan perfiles o releen el grupo sin caché');
  const lote2 = leer('app/crm/enriquecer-lote-server.ts');
  assert.match(lote2, /\.filter\(\(x\): x is number => Number\.isInteger\(x\) && \(x as number\) > 0\)\)\]\.slice\(0, TOPE_LOTE_COMPLETAR\)/);
});

test('8. la barra de lote del tablero: «Completar» sólo para el admin, con pregunta, avance y «Parar»', () => {
  const barra = sinComentarios(leer('app/crm/AccionesLoteLeads.tsx'));
  assert.match(barra, /\{puedeCompletar && \(\n\s+<Dropdown\n\s+value="" resetAfterSelect placeholder="Completar"/, 'sin el desplegable, o sin la puerta del admin');
  assert.match(leer('app/crm/CrmBoard.tsx'), /puedeCompletar=\{!!puedeCrearCrm\}/, 'el tablero no le dice a la barra quién es admin');
  // Sin la extensión, la opción dice qué falta, y SE PUEDE TOCAR (25/10/2026, Martín: «Si me dice "Instala la extensión de
  // MaKo", si le apreto debería automáticamente salirme el desplegable»): abre la instalación y espera (tests/wa-fichas-071).
  assert.match(barra, /value: 'whatsapp', label: 'Desde mi WhatsApp', icono: 'whatsapp',\n/);
  assert.doesNotMatch(barra, /disabled: extWa !== 'si'/, 'la opción volvió a ser un texto muerto');
  assert.match(barra, /extWa === 'vieja' \? lineaDeVersion\(VERSION_FICHAS, 'Actualiza la extensión de MaKo'\) : 'Instala la extensión de MaKo'/);
  // Las dos preguntan antes; «Datos de empresa» cuenta ANTES de preguntar.
  assert.match(barra, /if \(v === 'whatsapp'\) \{\n\s+if \(extWa === 'si'\) \{ setPide\(\{ tipo: 'whatsapp' \}\); return; \}/);
  assert.match(barra, /const c = await completarPerfilesDeLeadsAction\(\{ ids, soloContar: true \}\);/);
  assert.match(barra, /\{pide\?\.tipo === 'whatsapp' && \(\n\s+<Confirm/);
  assert.match(barra, /\{pide\?\.tipo === 'empresa' && \(\n\s+<Confirm[\s\S]{0,200}message=\{preguntaDePerfiles\(pide\.cuenta,/);
  // Las corridas: con las máquinas compartidas, la pregunta cerrada ANTES (si no, tapa el avance y el «Parar»).
  // Desde la 0.72.0 (26/10/2026) «Desde mi WhatsApp» no escribe en la barra: su avance va al desplegable de la extensión.
  assert.match(barra, /const correrWhatsapp = async \(\) => \{\n\s+cerrar\(\);\n\s+setEsperaExt\(false\);\n\s+const deEstos = \[\.\.\.ids\];\n\s+if \(!empezarLargo\(''\)\) return;\n\s+setEnExtension\(true\);/);
  assert.match(barra, /const correrEmpresa = async \(cuenta: CuentaPerfiles\) => \{\n\s+cerrar\(\);\n\s+const deEstos = \[\.\.\.ids\];\n\s+if \(!empezarLargo\(`Consultando perfiles: 0 de/);
  assert.match(barra, /await guardarFichasEnTandas\(fichas, \(tanda\) => completarFichasDeLeadsAction\(\{ ids: deEstos, fichas: tanda \}\), \{\n\s+parar: \(\) => parar\.current,/);
  assert.match(barra, /await correrPerfiles\(cuenta, \(hechas, saltear\) => completarPerfilesDeLeadsAction\(\{ ids: deEstos, hechas, saltear \}\), \{\n\s+parar: \(\) => parar\.current,/);
  // ⚠️ «COMPLETAR» NO VA EN `start` (useTransition): en el React de Next 16, lo puesto en la parte síncrona de una transición
  // async no se dibuja hasta que la acción ENTERA termina, y el «Parar» no aparecía nunca (la revisión del 24/10/2026).
  for (const f of ['pedirCompletar', 'correrWhatsapp', 'correrEmpresa', 'empezarLargo', 'terminarLargo']) {
    const ini = barra.indexOf(`const ${f} = `);
    assert.ok(ini > 0, `no encontré ${f}`);
    const cuerpo = barra.slice(ini, barra.indexOf('\n  };\n', ini));
    assert.doesNotMatch(cuerpo, /\bstart\(/, `${f} corre adentro de una transición: su estado no se dibuja hasta el final`);
  }
  // El arranque: estado y «Parar» rearmado ANTES del primer await, candado de módulo y aviso al tablero.
  const empezar = barra.slice(barra.indexOf('const empezarLargo = '), barra.indexOf('\n  };\n', barra.indexOf('const empezarLargo = ')));
  assert.match(empezar, /if \(corridaViva\) return false;\n\s+corridaViva = true;\n\s+parar\.current = false;\n\s+setLargo\(true\); setAvance\(primerAvance\);\n\s+onCorriendo\?\.\(true\);/, '«Parar» no se rearma, o no hay candado');
  assert.match(barra, /^let corridaViva = false;$/m, 'el candado tiene que ser de módulo: un estado nuevo lo olvida al volver a montar la barra');
  // El final: limpia la selección SÓLO si terminó entera y sigue siendo la misma; a medias, el aviso va con tono.
  const terminar = barra.slice(barra.indexOf('const terminarLargo = '), barra.indexOf('\n  };\n', barra.indexOf('const terminarLargo = ')));
  assert.match(terminar, /onListo\(entera \? r : \{ \.\.\.r, tono: 'warn' \}\);/);
  assert.match(terminar, /if \(entera && misma\) onLimpiar\(\);/, 'limpia la selección aunque haya que volver a tocar, o borra una selección nueva');
  assert.match(barra, /entera = !a\.parado && !a\.error && a\.pendientes <= 0;/);
  // Mientras corre: la barra no se va, y nada más se puede tocar (cada pregunta abierta tapaba el «Parar»).
  assert.match(barra, /if \(n === 0 && !largo\) return null;/);
  assert.match(barra, /const ocupado = corriendo \|\| largo \|\| contando;/);
  assert.ok([...barra.matchAll(/buttonStyle=\{estiloDrop\}/g)].length >= 5, 'no encontré los desplegables de la barra');
  assert.doesNotMatch(barra, /buttonStyle=\{estiloDrop\}(?! disabled=\{ocupado\})/, 'un desplegable de la barra sigue activo mientras corre');
  // El clic derecho llama a las MISMAS funciones que los desplegables; la guarda está adentro (setPide, etiquetar, agregarAFunnel).
  assert.match(barra, /const setPide = \(p: Pendiente \| null\) => \{ if \(p && ocupadoAhora\.current\) return; setPideEstado\(p\); \};/, 'el clic derecho abre preguntas mientras corre');
  assert.match(barra, /const etiquetar = \(e: Etiqueta\) => \{\n\s+if \(ocupadoAhora\.current\) return;/);
  assert.match(barra, /const agregarAFunnel = \(fid: number \| null\) => \{\n\s+if \(ocupado\) return;/);
  assert.equal([...barra.matchAll(/setPideEstado\(/g)].length, 2, 'una pregunta se abre sin la guarda');
  const board = leer('app/crm/CrmBoard.tsx');
  assert.match(board, /\{\(elegidos\.length > 0 \|\| completandoLote\) && \(/, 'el tablero desmonta la barra (con su «Parar») si se vacía la selección por otro camino');
  assert.match(board, /onCorriendo=\{setCompletandoLote\}/);
  assert.match(board, /\} : undefined, r\.tono\);/, 'el aviso de un lote a medias sale como un «listo» de 3 s');
  // El «Completando N de M» de la barra pasó al desplegable (0.72.0); el «Parar» de la barra sigue para «Datos de empresa».
  assert.match(barra, /alAvanzar: \(guardados, total\) => avisarExtraccion\(id, \{ fase: 'guardando', guardados, total \}\),/);
  assert.match(barra, /\{largo && !enExtension && \(\n\s+<button type="button" data-parar-completar onClick=\{\(\) => \{ parar\.current = true;/, 'sin «Parar»');
  assert.match(barra, /onClick=\{largo \? undefined : onLimpiar\}/, 'limpiar la selección a mitad desmonta la barra con su «Parar»');
  // La extensión lee SÓLO los teléfonos de los tildados (con su `@lid` y sus grupos, desde el 25/10/2026), y cuenta cada paso.
  assert.match(barra, /const t = await pedidosDeFichasAction\(deEstos\);[\s\S]{0,600}pedirFichasDeWhatsappWeb\(t\.pedidos\.map\(\(p\) => \(\{ telefono: p\.telefono, lid: p\.lid \}\)\), \{\n\s+grupos: t\.grupos, visible: true, titulo, id,/);
  // Más de 5.000 tildados: la pregunta dice que se toman los primeros (nunca un corte callado).
  assert.equal([...barra.matchAll(/n > TOPE_LOTE_COMPLETAR \? ` Se toman los primeros/g)].length, 2);
});

test('8b. el núcleo de perfiles: candado por línea, y el corte por tiempo deja lugar para la peor vuelta', () => {
  const server = leer('app/crm/grupo-wa-server.ts');
  const f = server.slice(server.indexOf('export async function completarPerfiles('));
  const cuerpo = f.slice(0, f.indexOf('\n}\n'));
  assert.ok(cuerpo.indexOf('if (p.soloContar) return') < cuerpo.indexOf('const candado = await tomarCandado(p.linea);'), 'contar no tiene que tomar el candado');
  assert.match(cuerpo, /const candado = await tomarCandado\(p\.linea\);\n\s+if \(!candado\) return \{ ok: false, error: 'Ya hay una consulta de perfiles corriendo en esta línea/, 'dos llamadas a la vez consultan los mismos teléfonos');
  assert.match(cuerpo, /await soltarCandado\(p\.linea, candado\);\n\s+\}/, 'el candado no se suelta en el finally');
  assert.match(cuerpo, /if \(p\.hasta != null && Date\.now\(\) \+ ESPERA_PERFIL_MS \+ TOPE_PERFIL_MS > p\.hasta\) \{ sigue = true; break; \}/, 'la última consulta puede pasar los 60 s');
  const candado = server.slice(server.indexOf('async function tomarCandado('), server.indexOf('async function soltarCandado('));
  assert.match(candado, /if \(raw && vence > Date\.now\(\)\) return null;/, 'un candado vencido traba la línea para siempre');
  assert.match(candado, /return \(await cambiarSettingSi\(claveCandado\(linea\), raw, nuevo\)\) \? nuevo : null;/, 'el candado sin compare-and-set');
  assert.match(server, /await borrarSettingSi\(claveCandado\(linea\), valor\)/, 'se suelta el candado de otro');
  // La etiqueta que falla se dice con cuántos y qué hacer (volver a traer ya no la repara).
  assert.match(server, /errores\.push\(`La etiqueta «\$\{origen\.nombre\}» no se pudo poner a \$\{traidos\.length\}: ponla desde la barra de lote del CRM`\);/);
});

test('9. traer de un grupo: los que ya están NO se vuelven a cargar; van abajo, en gris, sin casilla, y el pie lo cuenta', () => {
  const ui = leer('app/crm/TraerDeGrupoWA.tsx');
  // Sin los admins si se pidió «Ignorar admins» (26/10/2026).
  assert.match(ui, /setSel\(new Set\(r\.participantes\.filter\(\(p\) => !p\.enElCrm && !\(sinAdminsAhora\.current && p\.admin\)\)\.map\(\(p\) => p\.telefono\)\)\);/, 'arranca con los que ya están tildados');
  // Y entre los nuevos, los que tienen nombre primero (27/10/2026): los que ya están siguen abajo.
  assert.match(ui, /return \[\.\.\.nuevosAhora\.filter\(\(p\) => !!p\.nombre\), \.\.\.nuevosAhora\.filter\(\(p\) => !p\.nombre\), \.\.\.pasan\.filter\(\(p\) => p\.enElCrm\)\];/, 'los que ya están no van abajo');
  assert.match(ui, /const todos = nuevos\.length > 0 && nuevos\.every\(\(p\) => sel\.has\(p\.telefono\)\);/);
  assert.match(ui, /setSel\(todos \? new Set\(\) : new Set\(nuevos\.map\(\(p\) => p\.telefono\)\)\)/, '«tildar todos» tilda también a los que ya están');
  assert.match(ui, /if \(p\.enElCrm\) return; \/\/ ya está: no se trae, no se tilda/);
  assert.match(ui, /const tels = soloNombres \? \[\] : \[\.\.\.sel\]\.filter\(\(t\) => !yaEnElCrm\.has\(t\)\);/, 'se mandan a traer los que ya están');
  // El renglón gris: sin casilla y con el rótulo que dice cuántos.
  const gris = ui.slice(ui.indexOf('if (p.enElCrm) {'), ui.indexOf('const on = sel.has(p.telefono);'));
  assert.ok(gris.length > 100, 'no encontré los renglones de los que ya están');
  assert.doesNotMatch(gris, /type="checkbox"|onClick=/, 'el que ya está tiene casilla o se puede tildar');
  assert.match(gris, /color: 'var\(--faint\)'/, 'no va en gris');
  assert.match(gris, /`Ya están en tu CRM · \$\{miles\(yaEstan\)\}`/);
  // La línea de resumen (26/10/2026, Martín: «Elimina los textos innecesarios»): sólo «86 para extraer», sin los chips.
  assert.match(ui, /texto: `\$\{miles\(sel\.size\)\} para extraer`,/);
  assert.doesNotMatch(ui, /tono: 'gris' as const/, 'volvieron los chips «ya están · sin número · no les manda nada»');
  // Y el server tampoco los vuelve a cargar (la API de MaKo trae «todos»): ni funnel ni etiqueta.
  const server = leer('app/crm/grupo-wa-server.ts');
  assert.match(server, /if \(existente !== undefined\) \{ yaEstaban\+\+; return; \}/);
  const run = leer('lib/api-mako/areas/crm.run.ts');
  assert.match(run, /\$\{ya \? ` \(\$\{ya\} ya son leads: no se vuelven a cargar\)` : ''\}/, 'la API todavía promete sumarlos');
  assert.match(run, /Traer \$\{p\.participantes\.length - ya\} contactos nuevos/);
  // Ya están todos: no se propone un «Traer 0».
  assert.match(run, /if \(ya >= p\.participantes\.length\) return \{ error: `Los de «\$\{grupo\.nombre\}» ya están todos en tu CRM: no hay nadie nuevo para traer\.`, yaEstaba: true \};/);
  // Lo que lee la IA para elegir la acción no puede prometer lo que ya no hace.
  const def = leer('lib/api-mako/areas/crm.def.ts');
  const op = def.slice(def.indexOf("id: 'traer_contactos_de_grupo'"), def.indexOf("id: 'traer_contactos_de_grupo'") + 2200);
  assert.doesNotMatch(op, /SUMA a este funnel|suma al funnel al que ya es lead|a todos les pone la etiqueta/, 'la descripción de la API promete sumar a los que ya son leads');
  assert.match(op, /A los que ya son leads del CRM no los toca/);
  // El modal: un corte va al resumen, que releer el grupo no borra.
  const modal = leer('app/crm/TraerDeGrupoWA.tsx');
  // Desde el 26/10/2026 los nombres van dentro de «Extraer»: el corte de los dos (traer y guardar) va al mismo resumen.
  assert.match(modal, /const corte = t\?\.corte \|\| a\?\.error \|\| \(a\?\.parado \? 'La paraste\.' : ''\);/, 'el corte de los nombres se borra al releer el grupo');
  assert.match(modal, /setHecho\(titular \? `\$\{resumen\}\.\$\{cola\}` : `«\$\{grupo\.nombre\}»: \$\{resumen\}\.\$\{cola\}`\);/);
  assert.doesNotMatch(modal, /if \(a\.error\) setErr\(a\.error\);/);
  assert.match(modal, /if \(r\.pendientes\.length >= tanda\.length\) \{ corte = 'WhatsApp está tardando\.'; break; \}/, 'el corte de «Extraer» va a err y se borra al releer');
  assert.match(modal, /corte \? ` \$\{corte\}\$\{t && t\.quedan > 0 \? ` Quedaron \$\{miles\(t\.quedan\)\}: vuelve a tocar «Extraer»\.` : ''\}` : '',/);
});

test('10. un aviso largo se puede leer: el Toast le da tiempo según el largo, y uno a medias se queda', () => {
  const toast = leer('app/_ui/Toast.tsx');
  assert.match(toast, /const largo = typeof toast\.msg === 'string' \? Math\.min\(12_000, toast\.msg\.length \* 60\) : 0;/);
  assert.match(toast, /: toast\.tono === 'warn' \? Math\.max\(ms, 8000\) :/, 'un aviso a medias dura lo que un «listo»');
  // Desde el 24/10/2026 pasa por `esperarPausa` (no se va mientras se lo mira, tests/avisos-se-cierran.test.ts).
  assert.match(toast, /setTimeout\(esperarPausa\(\(\) => setToast\(null\)\), Math\.max\(base, largo\)\);/, 'un resumen de 200 letras se va a los 3,2 s');
});
