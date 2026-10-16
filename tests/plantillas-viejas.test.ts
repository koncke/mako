// =============================================================================
// Las plantillas que quedaron viejas (sexta tanda, 09/10/2026, General 15)
// =============================================================================
// Pedido literal de Martín: «Hay plantillas que quedaron viejas con todos los cambios, incluso que no
// tienen sentido porque quedaron con configuraciones viejas obsoletas... Cuando termines de
// implementar todo, revisalas». Lo que se midió y se arregló está en docs/hallazgos-chatbot.md →
// «Sexta tanda, parte «plantillas»». Acá, lo que impide que vuelvan a quedar viejas:
//
//   1. Un mensaje de MaKo en WhatsApp cuyo texto arma el código (`textoDelCodigo`) no se ofrece para
//      editar, y uno que lee su plantilla sí — cruzado contra los EMISORES, en las dos direcciones.
//   2. La ruta y el editor hacen la MISMA pregunta (`seEditaElTexto`), y el flujo sigue editable.
//   3. La línea del CRON de un mensaje del cliente no dice el nombre interno de una pieza.
//   4. Los pasos que el código corre (`correSuFlujo`, la cobranza) no se dibujan como rotos, y la
//      plantilla de fábrica de la cobranza se dibuja con las tarjetas de la casa.
//   5. Un paso al grupo manda SU texto (lib/flujos.ts), sin IA.
//   6. Ningún evento del CRON de un mensaje se ofrece sin un emisor.
//   7. Las automatizaciones que siembra la plataforma nacen como TARJETAS.
//   8. Crear con IA no nace con «Tu negocio», y el catálogo no habla de la línea oficial ni de la
//      «nutrición».
//
// ⚠️ PROBADOS ROMPIÉNDOLOS (09/10/2026, arnés que restaura de MEMORIA, base en verde: 12 de 12),
// una rotura por vez, y el número es el de este archivo:
//   · sacarle `textoDelCodigo` a `reunion-recordatorio` → 1 fallo (test 1);
//   · ponerle `textoDelCodigo` a `cuota-vencida` → 2 fallos (tests 1 y 2: deja de ser editable);
//     (desde el 11/10/2026 la lista del cliente está vacía y `cuota-vencida` es un EVENTO de MaKo: el test 1 la
//     cruza igual —su marca decide si su fila ofrece «Lo que arma MaKo»— y el test 2 ya no la ofrece editable);
//   · pasarle un `texto` al `emitirDelCatalogo(d.avisoId` del cron de cobranza → 1 fallo (test 1);
//   · cambiarle la pregunta a la ruta (`!seEditaElTexto(id) && false`) → 1 fallo (test 2);
//   · devolver el editor del mensaje a `if (!editable)` → 1 fallo (test 2);
//   · devolver «Cron reunion-recordatorio (cada 10 min): …» al catálogo → 1 fallo (test 3);
//   · sacarle `correSuFlujo` a `cuota-por-vencer` → 1 fallo (test 4);
//   · `corren` sin `correSuFlujo` (`… && correSuFlujo(a.id) && false`) → 1 fallo (test 5);
//   · devolver el título «Espera» al DELAY de un aviso → 1 fallo (test 5);
//   · devolver la rama del grupo a `generarMensajeAviso(flujoId, …)` → 1 fallo (test 6);
//   · devolver «Un lead escribe por WhatsApp» a `EVENTOS` → 1 fallo (test 7);
//   · `comoNace` devolviendo la lista (`pasos: p.pasos`) → 1 fallo (test 8);
//   · el insert de la semilla con `pasos: plan.pasos` → 1 fallo (test 8);
//   · el esqueleto sin pasar por `abrirFlujo` → 1 fallo (test 9);
//   · devolver «{{nombre}} y {{negocio}}» a la regla 2 de Crear con IA → 1 fallo (test 10);
//   · devolver el ejemplo viejo de `nutricion-frenada` («expiró el token de WhatsApp») → 1 fallo (test 11).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import {
  CATALOGO_AVISOS, AVISOS_DEL_CLIENTE, seEditaElTexto, textoLoArmaElCodigo, correSuFlujo,
} from '../lib/avisos-catalogo';
import { AVISOS_POR_EVENTO } from '../lib/aviso-evento';
import type { Flujo } from '../lib/flujos-tipos';
import { grafoDeAviso, disparadorCorto } from '../lib/flujo-aviso';
import { EVENTOS, EVENTOS_SIN_EMISOR, rotuloDeEvento, describirDisparador } from '../lib/flujos-tipos';
import { planosDeAudios, comoNace, pasosDeEsqueleto, RELLENO_ESQUELETO } from '../lib/setting-semillas';
import { esFlujoExplicito } from '../lib/flujo-legado';
import { claseDe, validarGrafo } from '../lib/flujo-grafo';
import { CREAR_IA_SYSTEM_TEMPLATE, EDITAR_IA_SYSTEM_TEMPLATE } from '../lib/flujo-ia';
import { TITULO } from '../lib/flujo-conversacion';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
// Las líneas PRIMERO y los bloques después (AGENTS.md: un `/*` dentro de un `//` se come el código).
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
/** El código de la app (lo que está en el índice). */
const ARCHIVOS = execFileSync('git', ['ls-files', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter((f) => /\.(ts|tsx)$/.test(f) && existsSync(join(RAIZ, f)));
const FUENTES = new Map(ARCHIVOS.map((f) => [f, sinComentarios(leer(f))]));

/** El texto de la llamada que arranca en `i`, hasta SU paréntesis de cierre. */
function llamada(src: string, i: number): string {
  let d = 0;
  for (let k = src.indexOf('(', i); k < src.length; k++) {
    if (src[k] === '(') d++;
    else if (src[k] === ')') { d -= 1; if (d === 0) return src.slice(i, k + 1); }
  }
  return src.slice(i);
}
/** ¿La llamada le pasa un `texto` (`texto:`, o el atajo `texto,` / `texto }`)? `contexto:` no cuenta. */
const pasaTexto = (c: string) => /\btexto\s*[:,}]/.test(c);

/** Quién emite cada aviso del catálogo, y si le pasa un texto armado. */
const EMISORES = (() => {
  const out = new Map<string, Array<{ archivo: string; texto: boolean }>>();
  const sumar = (id: string, e: { archivo: string; texto: boolean }) => out.set(id, [...(out.get(id) ?? []), e]);
  for (const [archivo, src] of FUENTES) {
    for (const m of src.matchAll(/emitirDelCatalogo\(\s*'([a-z0-9-]+)'/g)) sumar(m[1], { archivo, texto: pasaTexto(llamada(src, m.index!)) });
    // Los eventos de la PLATAFORMA que no tienen camino viejo se emiten así (16/10/2026, `oferta_lista`): nunca llevan texto.
    for (const m of src.matchAll(/emitirEventoDePlataforma\(\s*'([a-z0-9-]+)'/g)) sumar(m[1], { archivo, texto: false });
    for (const m of src.matchAll(/emitirAviso\(\s*\{/g)) {
      const t = /tipo:\s*'([a-z0-9-]+)'/.exec(llamada(src, m.index!));
      if (t) sumar(t[1], { archivo, texto: true });   // `emitirAviso` siempre recibe su texto
    }
  }
  return out;
})();

/** Los dos avisos de la cobranza los emite el cron con el id en una variable (`d.avisoId`). */
const CRON_COBRANZA = 'app/api/cron/cobranza/route.ts';
const IDS_COBRANZA = [...new Set([...leer('lib/cobranza.ts').matchAll(/avisoId: '([a-z0-9-]+)'/g)].map((m) => m[1]))].sort();

// ── 1. El texto que se ofrece para editar es el que sale ─────────────────────────────
// ⚠️ Desde el 11/10/2026 `AVISOS_DEL_CLIENTE` está vacía: los que cruza este test son los EVENTOS de MaKo
// (`AVISOS_POR_EVENTO`), cuya marca `textoDelCodigo` decide si su emisor pasa el texto armado (`{{mensaje_mako}}`,
// lib/aviso-evento.ts), y el reporte semanal, que lo sigue armando el código. Undécima tanda: ese texto ya NO se ofrece en
// ningún «{ }» (es el aviso entero pegado en un token); se sigue resolviendo para las filas vivas hasta la limpieza, así
// que la marca y este cruce se quedan hasta entonces (docs/diseno-undecima-tanda.md §8.7).
const CRUZADOS = [...new Set([...AVISOS_DEL_CLIENTE, ...AVISOS_POR_EVENTO, 'reporte-semanal'])];
test('1. el texto que arma el código (`textoDelCodigo`) es el que sale, cruzado contra sus emisores', () => {
  assert.ok(EMISORES.size > 20, `se leyeron ${EMISORES.size} avisos emitidos: el barrido quedó viejo`);
  assert.deepEqual(IDS_COBRANZA, ['cuota-por-vencer', 'cuota-vencida'], 'lib/cobranza.ts cambió sus avisos: revisá este test');
  const src = FUENTES.get(CRON_COBRANZA)!;
  const i = src.indexOf('emitirDelCatalogo(d.avisoId');
  assert.ok(i > 0, 'el cron de cobranza ya no emite con `emitirDelCatalogo(d.avisoId`: el barrido quedó viejo');
  const cobranzaPasaTexto = pasaTexto(llamada(src, i));

  assert.ok(CRUZADOS.length >= 4, `se cruzan ${CRUZADOS.length}: el universo quedó vacío`);
  for (const id of CRUZADOS) {
    const em = [...(EMISORES.get(id) ?? []), ...(IDS_COBRANZA.includes(id) ? [{ archivo: CRON_COBRANZA, texto: cobranzaPasaTexto }] : [])];
    if (id === 'reporte-semanal') {
      // El reporte no pasa por `emitirDelCatalogo`: lo arma `buildReporteSemanal` y lo manda `despacharReporte`.
      const cron = FUENTES.get('app/api/cron/reporte-semanal/route.ts')!;
      assert.match(cron, /buildReporteSemanal\(/);
      assert.match(cron, /despacharReporte\(/);
      assert.doesNotMatch(FUENTES.get('lib/reportes.ts')!, /from '\.\/plantillas'/, 'el reporte pasó a leer la plantilla: sacale `textoDelCodigo`');
      assert.equal(textoLoArmaElCodigo(id), true, 'el reporte semanal lo arma el código y se ofrece para editar');
      continue;
    }
    assert.ok(em.length > 0, `«${id}» se le muestra al cliente y nada lo emite: es una plantilla que nadie puede activar`);
    if (textoLoArmaElCodigo(id)) {
      const leen = em.filter((e) => !e.texto).map((e) => e.archivo);
      assert.deepEqual(leen, [], `«${id}» tiene \`textoDelCodigo\` y estos emisores usan la plantilla: sacale la marca`);
    } else {
      const arman = em.filter((e) => e.texto).map((e) => e.archivo);
      assert.deepEqual(arman, [], `«${id}» se ofrece para editar y estos emisores mandan su propio texto: el que edita el cliente no sale (ponele \`textoDelCodigo\`)`);
    }
  }
});

// ── 2. La ruta y el editor preguntan lo mismo, y el flujo sigue siendo del cliente ──────
test('2. `seEditaElTexto` es la pregunta de la ruta Y del editor; el ＋ del flujo no cuelga de ella', () => {
  // Desde el 11/10/2026 la lista del cliente está vacía: lo que dice la cobranza lo escribe el negocio en las
  // tarjetas de su automatización (la plantilla «Cobranza de cuotas vencidas»), no en el store.
  assert.equal(seEditaElTexto('cuota-vencida'), false, 'la cobranza volvió a editarse en el store: es un evento de MaKo');
  assert.equal(seEditaElTexto('reporte-semanal'), false);
  assert.equal(seEditaElTexto('meta-cuenta-frenada'), false, 'un aviso de la agencia no es del cliente');
  assert.equal(seEditaElTexto('custom-1-abc'), false, 'uno que no es del catálogo tampoco es de la lista del cliente');

  const ruta = FUENTES.get('app/api/perfil/plantillas/route.ts')!;
  assert.match(ruta, /const esAdministrativo = \(id: string\) => !seEditaElTexto\(id\);/, 'la ruta dejó de hacer la misma pregunta que el editor');
  const modal = FUENTES.get('app/agencia/TemplateDetalleModal.tsx')!;
  assert.match(modal, /const puedeEditarElMensaje = endpoint === ENDPOINT_AGENCIA \|\| \(id != null && seEditaElTexto\(id\)\);/);
  assert.match(modal, /textoEditable=\{puedeEditarElMensaje\}/);
  // El flujo (el ＋, el CRON por evento, los pasos) sigue con la pregunta de siempre.
  assert.match(modal, /editable=\{puedeEditarTexto\}/);
  const lienzo = FUENTES.get('app/agencia/FlujoAviso.tsx')!;
  assert.match(lienzo, /if \(!textoEditable\) \{/, 'el editor del mensaje volvió a colgar de `editable`: apagar el texto apaga el ＋');
  assert.match(lienzo, /onAgregarTras=\{editable \?/);
});

// ── 3. La tarjeta CRON de un mensaje del cliente no dice el nombre de una pieza ───────
test('3. la línea del CRON («Hoy sale solo: …») de un mensaje del cliente se lee como un momento', () => {
  for (const id of AVISOS_DEL_CLIENTE) {
    const c = CATALOGO_AVISOS.find((x) => x.id === id);
    assert.ok(c, `«${id}» está en la lista del cliente y no en el catálogo`);
    const linea = disparadorCorto(c.disparador);
    // Un backtick, un `after()`, un slug con guiones, «cron …», «webhook» o «secuencia»: el nombre
    // interno de una cosa no es el nombre de la cosa (AGENTS.md).
    assert.doesNotMatch(linea, /`|\(\)|\b[a-z]+-[a-z]+\b|\bcron\b|webhook|secuencia/i, `«${id}» dibuja «${linea}»`);
  }
});

// ── 4. Los pasos que el código corre ─────────────────────────────────────────────────
test('4. `correSuFlujo` es exactamente lo que corre el único llamador de `correrFlujoDe`', () => {
  const llamadores = [...FUENTES].filter(([f, s]) => f !== 'lib/flujos.ts' && /correrFlujoDe\(/.test(s)).map(([f]) => f);
  assert.deepEqual(llamadores, [CRON_COBRANZA], 'hay otro código que corre el flujo de un aviso: sumá sus avisos a `correSuFlujo`');
  // `cuota-vencida` NO, desde el 11/10/2026: es un evento de MaKo y su cadencia es la fila del negocio. Con su
  // flujo corriendo, la cadencia de fábrica saldría ADEMÁS de la de la plantilla.
  assert.deepEqual(CATALOGO_AVISOS.filter((c) => c.correSuFlujo).map((c) => c.id).sort(), IDS_COBRANZA.filter((id) => !AVISOS_POR_EVENTO.has(id)));
  assert.equal(correSuFlujo('cuota-vencida'), false);
  assert.equal(correSuFlujo('cuota-por-vencer'), true);
  assert.equal(correSuFlujo('reunion-recordatorio'), false);
});

// ── 5. Un flujo que el código corre, dibujado ────────────────────────────────────────
// ⚠️ Hasta el 11/10/2026 esto dibujaba la cadencia de FÁBRICA de `cuota-vencida` (`flujoPorDefecto`). Ese día la
// cadencia pasó a ser la plantilla «Cobranza de cuotas vencidas» (lib/plantillas-automatizaciones.ts, sus textos
// literales los fija tests/automations-mako-en-whatsapp.test.ts) y el catálogo la soltó. Lo que este test fija del
// lienzo de /mensajes sigue: un aviso cuyo flujo corre el código (`cuota-por-vencer`) no se dibuja «roto».
test('5. un flujo que corre el código (`correSuFlujo`): tarjetas de la casa, con su texto, y ninguna «rota»', () => {
  assert.equal(CATALOGO_AVISOS.find((c) => c.id === 'cuota-vencida')!.flujoPorDefecto, undefined,
    'volvió la cadencia de fábrica de la cobranza al catálogo: correría ADEMÁS de la automatización del negocio');
  const cat = CATALOGO_AVISOS.find((c) => c.id === 'cuota-por-vencer')!;
  const f: Flujo = {
    version: 1, activo: true, disparador: { tipo: 'manual' },
    pasos: [
      { tipo: 'esperar', horas: 48 },
      { tipo: 'mensaje', canal: 'aviso_dueno', texto: '💸 Sigue sin cobrarse la cuota {{cuota_numero}} de {{lead_nombre}}.' },
      { tipo: 'esperar', horas: 72 },
      { tipo: 'mensaje', canal: 'aviso_dueno', texto: '💸 Último recordatorio por la cuota {{cuota_numero}}.' },
    ],
  };
  const aviso = {
    disparador: cat.disparador, frecuenciaMin: 0, texto: cat.ejemplo,
    canales: { wa: true, email: false }, insistir: null, evento: f.disparador, pasos: f.pasos,
  };
  const pasos = grafoDeAviso({ ...aviso, id: 'cuota-por-vencer' }).nodos.filter((n) => n.id.startsWith('paso-'));
  assert.equal(pasos.length, 4);
  assert.deepEqual(pasos.filter((n) => n.advertencia).map((n) => n.id), [],
    'los pasos que el cron corre se dibujan «sólo corre con un evento»: la plantilla de fábrica sale rota');
  assert.deepEqual(pasos.map((n) => n.titulo), [TITULO.esperar, TITULO.mako, TITULO.esperar, TITULO.mako]);
  assert.deepEqual(pasos.map((n) => n.tipo), ['espera', 'mako', 'espera', 'mako']);
  assert.match(pasos[1].detalle ?? '', /^💸 Sigue sin cobrarse/u, 'la tarjeta del mensaje al grupo no dice lo que manda');
  // Sin el id (o en un aviso que el código no corre), la advertencia es cierta y se queda.
  const sinId = grafoDeAviso(aviso).nodos.filter((n) => n.id.startsWith('paso-'));
  assert.equal(sinId.filter((n) => n.advertencia).length, 4);
  // Y ningún paso de un aviso conserva los títulos de antes.
  const todos = grafoDeAviso({ ...aviso, pasos: [{ tipo: 'accion' }, { tipo: 'esperar', horas: 1 }, { tipo: 'condicional', condicion: 'contestaron' }, { tipo: 'mensaje', canal: 'aviso_dueno', texto: 'x' }] });
  for (const n of todos.nodos) assert.ok(!['Hace algo', 'Espera', 'Si pasa esto', 'Te lo recuerda'].includes(n.titulo), `volvió el título «${n.titulo}»`);
});

// ── 6. Un paso al grupo manda su texto ───────────────────────────────────────────────
test('6. el paso «mensaje al grupo» manda SU texto con los datos puestos por código (lib/flujos.ts)', () => {
  const src = FUENTES.get('lib/flujos.ts')!;
  const ini = src.indexOf("if (paso.canal === 'aviso_dueno') {");
  assert.ok(ini > 0, 'no encontré la rama del mensaje al grupo');
  const rama = src.slice(ini, src.indexOf('return;', src.indexOf('enviarAlGrupoMaKo', ini)));
  assert.ok(rama.length > 100 && rama.length < 1200, `el recorte mide ${rama.length}: mira otra cosa`);
  assert.match(rama, /const propio = \(paso\.texto \?\? ''\)\.trim\(\);/);
  assert.match(rama, /propio\s*\?\s*await conVariables\(propio,/, 'el paso volvió a pedirle a la IA la plantilla PRINCIPAL: su texto no sale');
});

// ── 7. Ningún evento sin emisor se ofrece ────────────────────────────────────────────
test('7. todo evento del CRON de un mensaje tiene quien lo emita; el que no, se nombra y no se ofrece', () => {
  const emitidos = new Set([...FUENTES.values()].flatMap((s) => [...s.matchAll(/dispararEvento\(\s*'([a-z._]+)'/g)].map((m) => m[1])));
  assert.ok(emitidos.size >= 3, `se leyeron ${emitidos.size} eventos emitidos: el barrido quedó viejo`);
  for (const e of EVENTOS) assert.ok(emitidos.has(e.key), `«${e.label}» se ofrece y nada lo emite: un mensaje que lo elija no sale nunca`);
  for (const e of EVENTOS_SIN_EMISOR) {
    assert.ok(!emitidos.has(e.key), `«${e.key}» volvió a tener emisor: pasalo a \`EVENTOS\``);
    assert.match(rotuloDeEvento(e.key) ?? '', /ya no se dispara/);
    assert.match(describirDisparador({ tipo: 'evento', evento: e.key }), /ya no se dispara/);
  }
});

// ── 8. Las del onboarding nacen como tarjetas ────────────────────────────────────────
const rndDe = (semilla = 1) => { let s = semilla; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };

test('8. las tres automatizaciones del onboarding nacen como TARJETAS, sin GO TO y con la estrategia limpia', () => {
  const planos = planosDeAudios({ bienvenida: 11, agenda_con_bienvenida: 12, agenda_primer_contacto: 13 }, 'https://ejemplo.com/video');
  assert.deepEqual(planos.map((p) => p.clave), ['chat-agent-bienvenida', 'chat-agent-post-agenda-conocido', 'chat-agent-post-agenda-nuevo']);
  for (const p of planos) {
    const n = comoNace(p, rndDe());
    assert.ok(esFlujoExplicito(n.pasos), `«${p.nombre}» nace como una lista de antes`);
    assert.deepEqual(validarGrafo(n.pasos), [], `«${p.nombre}» nace sin poder publicarse`);
    assert.ok(!n.pasos.some((x) => claseDe(x) === 'ir_a'), `«${p.nombre}» nace con un GO TO`);
    assert.ok(!n.pasos.some((x) => Number(x.delay_horas) > 0 || x.requiere || x.ancla), `«${p.nombre}» nace con una espera o una condición escondida en un paso`);
    assert.equal(n.estrategia.modo, 'automatico');
    assert.equal(n.estrategia.desenlace.falloHoras, 0, 'nace con el fallo por silencio del motor viejo además de sus tarjetas');
    assert.equal(n.estrategia.desenlace.logradoSecuencia, null, 'nace encadenada a otra automatización (el GO TO de antes)');
    assert.deepEqual(n.estrategia.escenarios, []);
    // Lo que el motor hacía con la lista se conserva: el audio una hora después, con su id de antes
    // (el que permite cambiárselo al re-grabar).
    const audio = n.pasos.find((x) => x.tipo === 'audio');
    assert.equal(audio?.id, 'o0');
    assert.ok(n.pasos.some((x) => claseDe(x) === 'esperar' && x.espera?.minutos === 60), `«${p.nombre}» perdió la hora antes del audio`);
  }
  // La post-agenda sigue avisando «no confirmó», ahora con su tarjeta MaKo en WhatsApp.
  const pa = comoNace(planos[1], rndDe());
  assert.ok(pa.pasos.some((x) => x.accion?.operacion === 'avisar_al_equipo' && /no confirmó/.test(String(x.accion?.params?.titulo ?? ''))));
  // Y la que se escribe en la base es la que nace (no la lista).
  const src = FUENTES.get('lib/secuencias-audios.ts')!;
  const insert = src.slice(src.indexOf(".from('nutricion_secuencias').insert("));
  assert.match(insert.slice(0, 400), /pasos: nace\.pasos/, 'el alta volvió a escribir la lista');
  assert.match(insert.slice(0, 400), /estrategia: nace\.estrategia/);
});

// ── 9. La de la API, colgada de una etapa ────────────────────────────────────────────
test('9. el esqueleto de `crear_secuencia_mensajes` nace como tarjetas y su relleno no sale nunca', () => {
  const e = pasosDeEsqueleto(rndDe());
  assert.ok(esFlujoExplicito(e), 'nace como una lista de antes');
  assert.ok(!e.some((x) => Number(x.delay_horas) > 0), 'la espera volvió a ser un campo del mensaje');
  assert.ok(e.some((x) => claseDe(x) === 'esperar' && x.espera?.minutos === 48 * 60), 'perdió las 48 h entre el email y el WhatsApp');
  const mensajes = e.filter((x) => claseDe(x) === 'mensaje');
  assert.deepEqual(mensajes.map((x) => x.canal), ['email', 'whatsapp']);
  // El relleno lo tiene que reconocer el motor (`RX_RELLENO`, lib/nutricion.ts): si no, el esqueleto sale.
  const m = /const RX_RELLENO = \/(.+)\/i;/.exec(leer('lib/nutricion.ts'));
  assert.ok(m, 'no encontré RX_RELLENO en lib/nutricion.ts');
  const rx = new RegExp(m[1], 'i');
  for (const x of mensajes) assert.match(x.cuerpo, rx);
  assert.match(RELLENO_ESQUELETO, rx);
  assert.doesNotMatch(RELLENO_ESQUELETO, /paso de redacción/, 'el relleno volvió a mandar a un wizard que no existe');
  assert.match(FUENTES.get('lib/setting-secuencias.ts')!, /pasos: pasosDeEsqueleto\(\)/);
});

// ── 10 y 11. Lo que se escribe ───────────────────────────────────────────────────────
test('10. Crear con IA no le ofrece al modelo «Tu negocio»', () => {
  for (const t of [CREAR_IA_SYSTEM_TEMPLATE, EDITAR_IA_SYSTEM_TEMPLATE]) {
    assert.doesNotMatch(t, /\{\{negocio\}\}/, 'el prompt vuelve a ofrecer {{negocio}}, el dato que se sacó de todos los «{ }»');
  }
});

test('11. el catálogo de mensajes no habla de la línea oficial ni de la «nutrición»', () => {
  for (const c of CATALOGO_AVISOS) {
    const visible = `${c.titulo}\n${c.ejemplo}`;
    assert.doesNotMatch(visible, /\bnutrici[oó]n\b|\bsecuencias?\b|ventana de 24|token de whatsapp|plantilla de meta/i,
      `«${c.id}» habla de algo que ya no existe: «${visible.slice(0, 80)}…»`);
  }
  assert.ok(!CATALOGO_AVISOS.some((c) => c.id === 'plantilla-estado'), 'volvió el aviso de las plantillas de la línea oficial');
});

test('12. lo que el cliente ve en «MaKo en WhatsApp» existe en el catálogo', () => {
  for (const id of AVISOS_DEL_CLIENTE) assert.ok(CATALOGO_AVISOS.some((c) => c.id === id), `«${id}» no existe`);
  assert.ok(!AVISOS_DEL_CLIENTE.includes('lead-no-confirmo'), 'volvió «lead-no-confirmo», que no lo emite nada vivo: decisión de Martín');
});
