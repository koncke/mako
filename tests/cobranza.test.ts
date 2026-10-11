// =============================================================================
// La cobranza por WhatsApp: cuándo entra una cuota, y qué NO puede llevarse puesto
// =============================================================================
// La tarjeta #19 la repartió Martín al chat del chatbot el 04/10/2026 — «debería hacer
// recordatorios a clientes como en el grupo de MaKo en WhatsApp» — y sobre la cadencia
// dijo: «Para eso estamos configurando el chatbot, que cada usuario lo pueda editar! Y
// en la plantilla por defecto, haz lo que te parezca mejor».
//
// De ahí sale qué persigue este archivo: que la cadencia NO esté cableada en el código
// que dispara (si lo estuviera, el cliente no podría editarla), que una cuota entre UNA
// vez, que marcar el pago CORTE lo que está en vuelo, y que un dato exacto que viaja
// días no se vuelva mentira en el camino.
//
// ⚠️ PROBADOS ROMPIENDO LAS PIEZAS, 04/10/2026. Las DOCE roturas se cazan, 1 fallo cada
// una: avisar el día exacto sin ventana (una cuota que el cron no vio ese día se pierde
// para siempre) · dedupear por lead en vez de por cuota (dos cuotas del mismo cliente y
// sólo avisa una) · avisar una cuota que vence en 5 días · avisar una que venció hace 30
// · hacer que `cuota_dias` viaje con la corrida · cablear un `esperar` adentro del cron
// (la cadencia deja de ser editable) · que el cron no corra el flujo (la cadencia que la
// persona VE no la corre nadie) · sacarle a `marcarPago` el corte · que el corte mire el
// lead en vez de la cuota · que la cadencia por defecto le escriba al LEAD · que nazca
// apagada · y que un recordatorio use el dato que envejece.
//
// ⚠️ Y UNA DE ESAS DOCE SALIÓ CIEGA EN EL PRIMER INTENTO, por cómo estaba escrita la
// rotura y no por el test: duplicar la función en vez de agregarle la clave deja la que
// el código usa intacta. Una rotura que no toca el camino que se ejecuta no prueba nada.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  disparosDeCobranza, enDias, VENTANA_VENCIDA_DIAS, DIAS_ANTES,
  TTL_UNA_POR_CUOTA_MIN, CLAVES_DE_CUOTA, CLAVE_QUE_ENVEJECE,
  type CuotaParaAvisar,
} from '../lib/cobranza';
import { VARIABLES_AVISO, variablesOfrecidas } from '../lib/variables-aviso';
import { CATALOGO_AVISOS } from '../lib/avisos-catalogo';
import { plantillaPorId } from '../lib/plantillas-automatizaciones';
import { claseDe } from '../lib/flujo-grafo';
import { grafoDeAviso } from '../lib/flujo-aviso';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');

const cuota = (o: Partial<CuotaParaAvisar> = {}): CuotaParaAvisar => ({
  pago_id: 77, lead_id: 2498, lead_nombre: 'Sofía Contreras',
  numero: 2, monto_usd: 1700, fecha_esperada: '2026-10-10', dias: -1, ...o,
});

// ── Cuándo entra una cuota ──────────────────────────────────────────────────

test('⚠️ una cuota entra cualquier día de la VENTANA, no sólo el primero', () => {
  // Avisar sólo cuando `dias === -1` parece lo prolijo y pierde la cuota para siempre si
  // ese día el cron no corrió, o el workspace no tenía la línea conectada, o la fila se
  // cargó tarde. Con ventana + dedup por cuota, cualquier día sirve y entra UNA vez.
  for (const d of [-1, -3, -VENTANA_VENCIDA_DIAS]) {
    const out = disparosDeCobranza({ vencidas: [cuota({ dias: d })], porVencer: [] });
    assert.equal(out.length, 1, `con ${d} días de atraso no entró`);
    assert.equal(out[0]!.avisoId, 'cuota-vencida');
  }
});

test('y NO entra lo que todavía no venció ni lo que venció hace un mes', () => {
  // El de arriba es el que importa: una cuota de hace 30 días no es «acaba de vencer»,
  // y meterla al recordatorio automático es empezar a cobrar hoy algo de hace un mes.
  assert.equal(disparosDeCobranza({ vencidas: [cuota({ dias: 0 })], porVencer: [] }).length, 0);
  assert.equal(disparosDeCobranza({ vencidas: [cuota({ dias: -30 })], porVencer: [] }).length, 0);
  // Y la de «por vencer» entra sólo en su ventana.
  assert.equal(disparosDeCobranza({ vencidas: [], porVencer: [cuota({ dias: DIAS_ANTES })] }).length, 1);
  assert.equal(disparosDeCobranza({ vencidas: [], porVencer: [cuota({ dias: DIAS_ANTES + 4 })] }).length, 0);
});

test('⚠️ el dedup es por CUOTA, no por lead ni por tipo', () => {
  // Dos cuotas del MISMO cliente vencidas el mismo día son dos hechos y dos cobros. Con
  // la clave por lead —o sin clave, que es la clave por tipo— sale una y la otra queda
  // muda, sin que nada lo diga. Es el mismo bug que ya se pagó con los agendados.
  const out = disparosDeCobranza({
    vencidas: [cuota({ pago_id: 77, numero: 2 }), cuota({ pago_id: 78, numero: 3 })],
    porVencer: [],
  });
  assert.equal(out.length, 2);
  assert.equal(new Set(out.map((d) => d.dedupKey)).size, 2, 'las dos cuotas comparten la clave de dedup');
  assert.ok(out.every((d) => d.dedupKey.includes(String(d.cuota.pago_id))));
  // Y la ventana del dedup cubre un plan de 6 cuotas mensuales: si fuera más corta, la
  // cuota 2 volvería a entrar al mes siguiente como si fuera nueva.
  assert.ok(TTL_UNA_POR_CUOTA_MIN >= 60 * 24 * 90, 'la ventana del dedup no cubre un plan de pagos');
});

// ── Los datos exactos ───────────────────────────────────────────────────────

test('⚠️ lo que VIAJA con la corrida no incluye el dato que envejece', () => {
  // Un dato guardado en el `ctx` de una corrida es la FOTO del día en que se abrió, y
  // los pasos siguientes salen 48 y 120 horas más tarde: un `{{cuota_dias}}` guardado
  // diría «1 día» sobre un atraso de cuatro. Es la misma familia que «un mensaje que
  // habla de un MOMENTO se re-pregunta al salir», aplicada a un dato.
  const [d] = disparosDeCobranza({ vencidas: [cuota({ dias: -1 })], porVencer: [] });
  assert.ok(d);
  assert.equal(d.datos[CLAVE_QUE_ENVEJECE], '1 día', 'el mensaje de entrada sí lo dice, y sale hoy');
  assert.ok(!(CLAVE_QUE_ENVEJECE in d.datosEstables), 'el dato que envejece viaja con la corrida');
  // Y los que viajan son todos los demás del catálogo de cuota.
  for (const k of CLAVES_DE_CUOTA) {
    if (k === CLAVE_QUE_ENVEJECE) continue;
    assert.ok(d.datosEstables[k], `${k} no viaja con la corrida: el mensaje de la semana que viene lo diría crudo`);
  }
});

test('⚠️ TODA variable de alcance `cuota` la llena el cron', () => {
  // La regla que esta familia ya pagó: escribir la salida no es ofrecerla. Una fila del
  // catálogo que el selector ofrece y nadie resuelve sale CRUDA al WhatsApp del cliente.
  const delCatalogo = VARIABLES_AVISO.filter((v) => v.alcance === 'cuota').map((v) => v.key);
  assert.deepEqual([...delCatalogo].sort(), [...CLAVES_DE_CUOTA].sort());
  const [d] = disparosDeCobranza({ vencidas: [cuota()], porVencer: [] });
  for (const k of delCatalogo) assert.ok(d!.datos[k], `${k} se ofrece y el cron no la llena`);
});

test('el plural se escribe bien: lo lee una persona', () => {
  assert.equal(enDias(-1), '1 día');
  assert.equal(enDias(-3), '3 días');
  assert.equal(enDias(1), '1 día');
});

// ── La cadencia es del CLIENTE, no del código ───────────────────────────────

test('⚠️ el cron NO cablea la cadencia: la corre desde el flujo editable', () => {
  // Es lo que Martín pidió con todas las letras («que cada usuario lo pueda editar»), y
  // es verificable: el código que dispara no puede tener un número de días ni un paso
  // de espera. Si alguien los mete acá, la pantalla pasa a mostrar una cadencia que no
  // es la que corre — que es la forma más caótica de romper esto, porque se ve bien.
  const src = leer('../app/api/cron/cobranza/route.ts');
  const sinComentarios = src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/tipo:\s*'esperar'/.test(sinComentarios), 'el cron cableó un paso de espera');
  assert.ok(!/horas:\s*\d/.test(sinComentarios), 'el cron cableó una cantidad de horas');
  assert.match(sinComentarios, /correrFlujoDe\(/, 'el cron dejó de correr el flujo: la cadencia editable no la corre nadie');
  // Y lo que corre es el flujo DE ESE aviso, con la cuota adentro del contexto: sin el
  // `cuotaId` no hay por dónde cortar la secuencia al cobrar.
  assert.match(sinComentarios, /cuotaId: d\.cuota\.pago_id/, 'la corrida no sabe de qué cuota habla');
});

// ⚠️ Desde el 11/10/2026 la cadencia NO vive en el catálogo (`flujoPorDefecto` de `cuota-vencida`): la cobranza es
// un evento de MaKo y la cadencia es la plantilla «Cobranza de cuotas vencidas» de la galería, que el negocio
// agrega (docs/diseno-mako-en-whatsapp-unificado.md). Las reglas de la cadencia de fábrica se fijan sobre ELLA.
test('⚠️ la cadencia de la plantilla de cobranza sale al GRUPO, no insiste de más y no usa el dato que envejece', () => {
  assert.equal(CATALOGO_AVISOS.find((c) => c.id === 'cuota-vencida')?.flujoPorDefecto, undefined,
    'volvió la cadencia al catálogo: correría ADEMÁS de la automatización del negocio');
  const p = plantillaPorId('mako-cobranza');
  assert.ok(p, 'no está la plantilla de cobranza en la galería: la cobranza no tiene cómo salir');
  const esperas = p.pasos.filter((x) => claseDe(x) === 'esperar');
  const mensajes = p.pasos.filter((x) => claseDe(x) !== 'esperar');
  assert.ok(esperas.length >= 1 && mensajes.length >= 1, 'la plantilla no tiene ni una espera y un mensaje');
  assert.ok(mensajes.length <= 3, 'insistir más de tres veces es lo que hace que alguien apague el aviso entero');
  for (const m of mensajes) {
    // Al GRUPO: todas son la tarjeta MaKo (`avisar_al_equipo`). La cobranza no le escribe al cliente (06/10/2026).
    assert.equal(m.accion?.operacion, 'avisar_al_equipo', `«${m.id}» no es un aviso al grupo: la cobranza no le escribe al cliente`);
  }
  // ⚠️ El dato que envejece no puede estar en una tarjeta que sale DESPUÉS de una espera.
  const primeraEspera = p.pasos.findIndex((x) => claseDe(x) === 'esperar');
  for (const m of p.pasos.slice(primeraEspera)) {
    assert.ok(!String(m.accion?.params?.mensaje ?? '').includes(`{{${CLAVE_QUE_ENVEJECE}}}`),
      `«${m.id}»: un recordatorio diría los días de atraso del día de la entrada`);
  }
});

test('⚠️ marcar el pago CORTA lo que está en vuelo, y lo hace `marcarPago`', () => {
  // «Al marcar el pago en la ficha la secuencia queda cortada sin que nadie la pause a
  // mano» es la mitad de la tarjeta que se puede olvidar sin que nada falle: la
  // secuencia sigue y le cobra a alguien que ya pagó. Va en `marcarPago` y no en la
  // pantalla porque el pago se marca desde la ficha, desde WhatsApp y desde la API.
  const pagos = leer('../lib/pagos.ts');
  const fn = pagos.slice(pagos.indexOf('export async function marcarPago'), pagos.indexOf('export async function sincronizarTotalCobrado'));
  assert.ok(fn.length > 200 && fn.length < 3000, `el recorte de marcarPago mide ${fn.length}: mira otra cosa`);
  assert.match(fn, /cerrarCorridasDeCuota\(ws, pagoId\)/, 'marcar el pago dejó de cortar los recordatorios');
  assert.match(fn, /if \(pagado\)/, 'desmarcar un pago también cortaría, o peor, reabriría la secuencia');
  // Y el corte filtra por la cuota, no por el lead: un cliente con dos cuotas en vuelo
  // no deja de deber la otra porque pagó una.
  const corridas = leer('../lib/flujo-corridas.ts');
  const corte = corridas.slice(corridas.indexOf('export async function cerrarCorridasDeCuota'));
  assert.match(corte, /ctx->>cuotaId/, 'el corte dejó de mirar la cuota');
  assert.match(corte, /\.eq\('estado', 'pendiente'\)/, 'el corte puede revivir una corrida ya cerrada');
});

test('⚠️ y el editor OFRECE los datos de la cuota en los mensajes de cobranza', () => {
  // La otra mitad de «lo que se ofrece es lo que se puede resolver»: si el selector no
  // los ofreciera, el dato existiría y nadie podría ponerlo en el texto.
  const cat = CATALOGO_AVISOS.find((c) => c.id === 'cuota-vencida');
  assert.deepEqual([...(cat?.aporta ?? [])].sort(), ['cuota', 'lead']);
  const conCuota = variablesOfrecidas({ conLead: true, conCuota: true }).flatMap((g) => g.items);
  for (const k of CLAVES_DE_CUOTA) {
    assert.ok(conCuota.some((v) => v.key === k), `${k} no se ofrece en un mensaje de cobranza`);
  }
  // Y en un mensaje que NO es de cobranza no se dibujan — ni apagadas. Era al revés hasta
  // el 05/10/2026: «si no está disponible… no lo muestres directamente, no que esté en
  // gris, eso confunde».
  const sinCuota = variablesOfrecidas({ conLead: true }).flatMap((g) => g.items);
  for (const k of CLAVES_DE_CUOTA) {
    assert.ok(!sinCuota.some((v) => v.key === k), `${k} se ofrece en un mensaje que no habla de ninguna cuota`);
  }
});

test('⚠️ la tarjeta de un recordatorio al GRUPO no dice «le escribe al lead»', () => {
  // Lo delató el navegador: los dos pasos de la cadencia salían dibujados «LE ESCRIBE AL
  // LEAD» con `canal: 'aviso_dueno'`, porque el rótulo no miraba el canal. Un diagrama
  // que dice a quién le escribe y se equivoca es peor que uno que no lo dice — y acá
  // decía justo lo contrario de lo que Martín pidió, que es que salga al grupo.
  const g = grafoDeAviso({
    disparador: 'cron', frecuenciaMin: 0, texto: 'x',
    canales: { wa: true, email: false }, insistir: null, evento: null,
    pasos: [
      { tipo: 'mensaje', canal: 'aviso_dueno', texto: 'al grupo' },
      { tipo: 'mensaje', canal: 'wa_lead', texto: 'al lead' },
    ],
  });
  const alGrupo = g.nodos.find((n) => n.id === 'paso-0');
  const alLead = g.nodos.find((n) => n.id === 'paso-1');
  // ⚠️ Desde la sexta tanda (09/10/2026) el mensaje al grupo es la tarjeta de MaKo (`tipo: 'mako'`,
  // «MAKO EN WHATSAPP»: lo que es) y no «Te lo recuerda»; y dice SU texto, que es lo que sale.
  // PROBADO ROMPIÉNDOLO: devolverle `tipo: 'recordatorio'` → 1 fallo de 13 (cae acá); devolverle el
  // detalle «Avisar al dueño» → 1 fallo de 13 (cae acá).
  assert.equal(alGrupo?.tipo, 'mako', 'un mensaje al grupo no se dibuja como la tarjeta de MaKo');
  assert.equal(alGrupo?.detalle, 'al grupo', 'la tarjeta del mensaje al grupo no dice qué manda');
  assert.ok(!/lead/i.test(alGrupo?.titulo ?? ''), `el título dice «${alGrupo?.titulo}» sobre un mensaje al grupo`);
  assert.equal(alLead?.tipo, 'mensaje-lead', 'y el que SÍ va al lead dejó de decirlo');
  assert.match(alLead?.titulo ?? '', /lead/i);
});

// ── Nada al cliente: las promesas que no tenían nada detrás ─────────────────
// Decisión de Martín, 06/10/2026: «C: nada al cliente» — la cobranza le avisa sólo al
// grupo del dueño, que es lo que ya funcionaba. Lo que había que sacar eran dos promesas
// muertas: el «¿Le escribo el recordatorio?» del aviso, que nadie escuchaba, y la pendiente
// `flujo_wa_lead` del paso «mensaje al lead», que al confirmarla se cerraba como «operación
// desconocida».
//
// ⚠️ PROBADOS ROMPIÉNDOLOS, 06/10/2026, con un arnés que restaura DE MEMORIA: devolverle a
// la rama la `crearPendiente` de `flujo_wa_lead` · sacarle el log a la rama · devolver el
// «¿Le escribo el recordatorio?» al ejemplo · devolverle `requiereRespuesta: true` a
// `cuota-por-vencer`. Las cuatro se cazan, 1 fallo y 12 pases cada una (13 tests).

const sinComentariosDe = (src: string): string => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

test('⛔ el paso «mensaje al lead» no deja una pendiente que nadie puede ejecutar', () => {
  const src = sinComentariosDe(leer('../lib/flujos.ts'));
  assert.ok(!/flujo_wa_lead/.test(src), 'volvió la pendiente `flujo_wa_lead`: el dueño contesta «sí» y no pasa nada');
  const ini = src.indexOf("if (paso.tipo === 'mensaje')");
  const rama = src.slice(ini, src.indexOf("if (paso.tipo === 'accion')", ini));
  assert.ok(ini > 0 && rama.length > 100 && rama.length < 1500, `el recorte de la rama del mensaje mide ${rama.length}: mira otra cosa`);
  assert.ok(!/crearPendiente\(/.test(rama), 'la rama del mensaje volvió a pedirle permiso al dueño para algo que no va a pasar');
  // Y lo DICE: un paso que no hace nada y no deja rastro se ve igual que uno que anduvo.
  assert.match(rama, /console\.(warn|error)\([^)]*no se manda/, 'el paso al lead dejó de decir que no se manda');
});

test('⛔ los avisos de cobranza no preguntan «¿Le escribo?»: no hay nada detrás', () => {
  // El ejemplo ES el texto que sale al grupo cuando el negocio no escribió el suyo.
  for (const id of ['cuota-vencida', 'cuota-por-vencer']) {
    const cat = CATALOGO_AVISOS.find((c) => c.id === id);
    assert.ok(cat, `no encuentro «${id}» en el catálogo`);
    assert.ok(!/¿\s*le escribo/i.test(cat.ejemplo), `«${id}» vuelve a ofrecer escribirle al cliente`);
    // Con `true`, la vista previa dibuja al dueño contestando «sí» y a MaKo «lo hago ahora».
    assert.equal(cat.requiereRespuesta, false, `la vista previa de «${id}» promete una respuesta que nadie atiende`);
  }
});
