// =============================================================================
// La galería de plantillas de Automations (lib/plantillas-automatizaciones.ts, lib/plantilla-crear.ts,
// app/automations/GaleriaPlantillas.tsx y la acción `crear_desde_plantilla` de la ruta)
// =============================================================================
// Pedido de Martín (10/10/2026): «Si, hagamos la galería de las más comunes...». Y el de la undécima tanda (11/10/2026,
// punto 10): «Revisa los templates, para complejizarlos con todo esto... Prefiero que los templates en lugar de crear
// muchos "pequeños flujos" creen uno que incluya todo la categoría... Si es "Un Lead Agendó Llamada", y así con los
// demás templates... Piensa en que se podría avisar por WhatsApp de MaKo, etc...». Con la regla que gobierna todo
// (pedida varias veces y con enojo): NUNCA una versión vieja ni nada inventado (docs/diseno-undecima-tanda.md §0).
//
// Lo que se fija, por capas (cada una con su test, para que un rojo diga cuál):
//   1. el catálogo: las 13, en orden de embudo, con su objetivo (una tabla escrita a mano); las 25 de antes apuntan a la
//      de su categoría; cada una se PUEDE PUBLICAR (`validarGrafo`, el freno del lienzo, los topes) y está armada con
//      las piezas de hoy (`problemasDeForma` y `problemasDeTokens` vacíos); un AI Step por plantilla donde corre, con
//      objetivo y escenarios del catálogo, y lo que hace cada escenario (una tabla escrita a mano); lo que habla de la
//      reunión vuelve a mirarla; los datos del equipo, sólo en «MaKo en WhatsApp»; nada de un cliente real;
//   2. lo que la pantalla pide (la etapa): las opciones salen del desplegable del CRON y lo elegido se guarda sólo si
//      es del kanban que la plantilla pide; también dicho en palabras (la API);
//   3. crear: apagada, los pasos por su puerta, el CRON por la suya, lo que falla no deja nada a medias, y un id de
//      antes contesta nombrando la nueva SIN tocar la base (se EJECUTA con una base de mentira);
//   4. la ruta: la acción existe detrás de la guarda de admin y enchufa las puertas de verdad;
//   5. la pantalla: la galería dibuja «Lienzo en blanco» primero y todas las plantillas.
//
// PROBADO ROMPIÉNDOLO: ver «ROTURAS» al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  PLANTILLAS, PLANTILLAS_PLATAFORMA, PLANTILLAS_REEMPLAZADAS, plantillaPorId, plantillaQueLaReemplaza, pasosDePlantilla, nombreLibre, seccionesParaCron,
  rotuloDeEleccion, disparadorDeEleccion, disparadoresDePlantilla, eleccionEnPalabras,
  TOPE_LINEA, TRIGGER_DE_PIDE, SIN_ETAPA, SIN_ETIQUETA, esPlantillaMako, canalesDe, filtrarPlantillas, filtroDeValores,
  alternarFiltroGaleria, gruposDelFiltroGaleria, seccionesDeEtiquetas, OBJETIVOS_PLANTILLA, CANALES_PLANTILLA,
  type PasoDePlantilla, type CanalPlantilla, type ObjetivoPlantilla, type PlantillaAutomatizacion,
} from '../lib/plantillas-automatizaciones';
import { crearDesdePlantilla, filaDePlantilla, motivoDePlantillaVieja, PlantillaInvalidaError, type DbPlantilla } from '../lib/plantilla-crear';
import {
  validarGrafo, validarParaGuardar, normalizar, claseDe, raizSalida, raicesSalida, padresDe, descendientes, nodoPorId,
  esPasoIA, expandirPasoIA, faltaEnCaso, antiguedadDeEntrada, contarParalelos, AVISO_OTRA_COSA, ID_INICIO,
  TOPE_NODOS, TOPE_HILOS, TOPE_PARALELOS, TOPE_ESCENARIOS_AI_STEP, type FilaCondicion,
} from '../lib/flujo-grafo';
import { camposDelFlujo } from '../lib/nutricion-grafo-motor';
import { frenoDelFlujo, emojiDeSecuencia, type ProductoParaDisparo } from '../lib/flujo-conversacion';
import {
  problemaDeDisparadores, sanearDisparadores, eventosDe, claseDeDisparador, TRIGGER_INSTAGRAM, TRIGGER_MESSENGER, TRIGGER_EMAIL_RECIBIDO,
  TRIGGER_AVISO_MAKO, EVENTOS_MAKO_OFRECIDOS,
} from '../lib/disparadores';
import { condicionPorId, problemaDeFila } from '../lib/condiciones-catalogo';
import { datoDe, tokensDe } from '../lib/variables-aviso';
import { marcasDeVoseo } from '../lib/puestas-data';
import { OP_AVISAR } from '../lib/flujo-legado';
import { LEAD_DEL_EVENTO, faltanEnPaso } from '../lib/api-mako/flujo-params';
import { porId } from '../lib/api-mako/registro';
import { esAccion } from '../lib/api-mako/tipos';
import { TOPE_NOMBRE_SECUENCIA } from '../lib/setting-estrategia';
import { GaleriaPlantillas, preguntaEtapa, BLANCO, TITULO_GALERIA } from '../app/automations/GaleriaPlantillas';
import { frenoDelEvento } from '../lib/aviso-evento';
import { problemasDeForma, miraLaReunion, datosDeReunionSinMirarla } from '../lib/flujo-forma';
import { problemasDeTokens, textosDeTarjeta } from '../lib/tokens-del-flujo';
import { esTarjetaTalCual, partesDeMako, textoDePartes } from '../lib/mako-tarjeta';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Con qué CRON corre una plantilla, para validar sus datos como lo hace Publicar con la fila (`problemasDeTokens`): el
 * fijo, o el `trigger_tipo` de lo que pide. Vivía en la lib sin nadie que la llamara (cierre de la ola 3): es del test.
 */
const cronDePlantilla = (p: Pick<PlantillaAutomatizacion, 'cron'>): { trigger_tipo: string; subtipo: string | null } => {
  const c = p.cron;
  if (c.fijo === TRIGGER_AVISO_MAKO) return { trigger_tipo: c.fijo, subtipo: c.evento };
  if (c.fijo) return { trigger_tipo: c.fijo, subtipo: null };
  return { trigger_tipo: TRIGGER_DE_PIDE[c.pide], subtipo: null };
};

/** Lo obligatorio que le falta a una acción, según el registro de la API (lo mismo que mira `setSecuenciaPasos`). */
const faltanEnAccion = (op: string, params: Record<string, unknown>): string[] => {
  const d = porId(op);
  return d ? faltanEnPaso(d.parametros, params, { leadId: 1 }) : [`«${op}» no está en el registro`];
};

/** Todos los textos de una plantilla (los de las tarjetas, los casos, los avisos, el nombre y la línea). */
function textos(x: unknown, out: string[] = []): string[] {
  if (typeof x === 'string') out.push(x);
  else if (Array.isArray(x)) for (const y of x) textos(y, out);
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) { if (k !== 'origen' && k !== 'id') textos(v, out); }
  return out;
}

/**
 * Gente, negocios y datos REALES de los clientes de los que salieron las plantillas (medidos en
 * producción el 10/10/2026). Caza LOS CONOCIDOS, que es lo automatizable: el link del video de
 * confirmación, la agenda de un cliente, sus nombres y su firma.
 */
const REALES = [
  'Mauricio', 'Bustos', 'Leila', 'Martín', 'Joan', 'Juan Francisco',
  'Código Inmobiliario', 'Negocio que Escala', 'MasteryHaus', 'Vértice', 'AvatarHype', 'Francisco Ramos', 'Dental Ramos',
  'lovable', 'cal.com', 'Bendiciones', 'auditoría', 'inmobiliari', 'captaciones', 'metodología',
];
const sinAcentos = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

// ── 1. El catálogo ───────────────────────────────────────────────────────────────

/**
 * LAS 13, EN ORDEN DE EMBUDO, con su objetivo (docs/diseno-undecima-tanda.md §2, punto 10). Escrita A MANO: deducida del
 * catálogo daría verde sobre una que se borró o se movió.
 */
const LAS_13: ReadonlyArray<readonly [id: string, nombre: string, objetivo: ObjetivoPlantilla]> = [
  ['lead-entro', 'Un Lead Entró', 'agendar'],
  ['lead-agendo', 'Un Lead Agendó Llamada', 'reunion'],
  ['lead-no-asistio', 'Un Lead No Asistió', 'recuperar'],
  ['lead-tuvo-reunion', 'Un Lead Tuvo la Reunión', 'vender'],
  ['lead-confirmo-compra', 'Un Lead Confirmó la Compra', 'cobrar'],
  // El plazo de una etapa (12/10/2026: los plazos del CRM pasan a una plantilla).
  ['lead-no-avanzo', 'Un Lead No Avanzó', 'recuperar'],
  ['cliente-empezo', 'Un Cliente Empezó', 'clientes'],
  ['mako-cobranza', 'Una Cuota Venció', 'cobrar'],
  ['mako-pago', 'Entró un Pago', 'cobrar'],
  // El AI Analyst del Dashboard (13/10/2026: Automations consume el Dashboard).
  ['mako-analisis', 'El AI Analyst Terminó', 'medir'],
  ['mako-charla', 'Un Lead Te Escribió', 'vender'],
  ['instagram-te-escribieron', 'Te Escribieron por Instagram', 'captar'],
  ['messenger-te-escribieron', 'Te Escribieron por Messenger', 'captar'],
  ['email-recibido', 'Te Escribieron por Email', 'captar'],
  ['email-newsletter', 'Alguien Se Suscribió', 'captar'],
];

test('la galería son las 13, una por categoría, en orden de embudo, con su nombre y su objetivo', () => {
  // (16/10/2026: y las de SuperAdmin, con el MISMO tope. «Meta Frenó la Cuenta Publicitaria de un Negocio» medía 47 y la
  // fila nació cortada en producción, «…Publicitaria de un»: nadie medía las de la plataforma.)
  for (const p of PLANTILLAS_PLATAFORMA) {
    assert.ok(p.nombre.trim() && p.nombre.length <= TOPE_NOMBRE_SECUENCIA, `${p.id}: el nombre mide ${p.nombre.length}`);
    assert.ok(p.linea.trim() && p.linea.length <= TOPE_LINEA, `${p.id}: la línea mide ${p.linea.length}`);
  }
  assert.deepEqual(PLANTILLAS.map((p) => [p.id, p.nombre, p.objetivo]), LAS_13.map((x) => [...x]));
  assert.equal(new Set(PLANTILLAS.map((p) => p.nombre)).size, PLANTILLAS.length, 'nombres repetidos');
  for (const p of PLANTILLAS) {
    assert.ok(p.nombre.trim() && p.nombre.length <= TOPE_NOMBRE_SECUENCIA, `${p.id}: el nombre mide ${p.nombre.length}`);
    assert.ok(p.linea.trim() && p.linea.length <= TOPE_LINEA, `${p.id}: la línea mide ${p.linea.length}`);
    assert.equal(emojiDeSecuencia(p.emoji), p.emoji, `${p.id}: «${p.emoji}» no se guarda como emoji`);
    if (p.cron.fijo === TRIGGER_AVISO_MAKO) {
      // Un Evento de MaKo de los que se OFRECEN (los retirados —el nuevo agendado y la media hora antes— son tarjetas de
      // «Un Lead Agendó Llamada»).
      const evento = p.cron.evento;
      assert.ok(EVENTOS_MAKO_OFRECIDOS.some((e) => e.subtipo === evento), `${p.id}: evento «${evento}» no se ofrece`);
    } else if (p.cron.fijo) {
      // Los eventos de un CANAL: todos los de la categoría, ofrecidos por el CRON y ninguno apagado («Todavía no»): uno
      // apagado nacería con una automatización que no arranca nunca.
      const clase = claseDeDisparador({ trigger_tipo: p.cron.fijo, cron: null });
      assert.ok(p.cron.eventos.length > 0, `${p.id}: sin eventos`);
      for (const ev of p.cron.eventos) {
        const def = eventosDe(clase === 'otro' ? null : clase).find((e) => e.subtipo === ev);
        assert.ok(def, `${p.id}: el evento «${ev}» no es de ${p.cron.fijo}`);
        assert.equal(def!.apagado, undefined, `${p.id}: el evento «${ev}» está apagado`);
      }
    } else {
      assert.ok(p.cron.pide in TRIGGER_DE_PIDE, `${p.id}: pide «${p.cron.pide}»`);
      assert.ok(p.cron.ayuda.trim(), `${p.id}: sin ayuda para elegir la etapa`);
    }
    assert.equal(plantillaPorId(p.id), p);
  }
  // Los Eventos de MaKo que se ofrecen tienen su plantilla (y sólo ésos). El de una PERSONA (15/10/2026), en la lista de
  // SuperAdmin (`PLANTILLAS_PLATAFORMA`): no es de la galería de los negocios.
  assert.deepEqual([...PLANTILLAS, ...PLANTILLAS_PLATAFORMA].filter(esPlantillaMako).map((p) => (p.cron.fijo === TRIGGER_AVISO_MAKO ? p.cron.evento : null)).sort(),
    EVENTOS_MAKO_OFRECIDOS.map((e) => e.subtipo).sort());
  assert.ok(PLANTILLAS_PLATAFORMA.every((p) => p.soloPlataforma && plantillaPorId(p.id) === p), 'una de SuperAdmin sin su marca, o que no se encuentra');
  assert.equal(plantillaPorId('no-existe'), null);
  assert.equal(plantillaPorId(7), null);
});

/** LAS 25 DE ANTES → la de su categoría (§2, punto 10), A MANO. `null` = retirada. */
const DE_ANTES: Readonly<Record<string, string | null>> = {
  'bienvenida-sin-agenda': 'lead-entro', 'ultimo-intento': 'lead-entro',
  'recordatorio-reunion': 'lead-agendo', 'agendo-preparar': 'lead-agendo', 'agendo-confirmar': 'lead-agendo',
  'email-recordatorio-reunion': 'lead-agendo', 'mako-agendado': 'lead-agendo', 'mako-reunion': 'lead-agendo',
  'no-asistio': 'lead-no-asistio',
  'seguimiento-reunion': 'lead-tuvo-reunion', 'reactivar-sin-cierre': 'lead-tuvo-reunion',
  'pago-pendiente': 'lead-confirmo-compra',
  'cliente-bienvenida': 'cliente-empezo', 'pedir-testimonio': 'cliente-empezo',
  'ig-comentario-dm': 'instagram-te-escribieron', 'ig-historia-dm': 'instagram-te-escribieron', 'ig-bienvenida-dm': 'instagram-te-escribieron',
  'ig-ref-dm': 'instagram-te-escribieron', 'ig-en-vivo-dm': 'instagram-te-escribieron',
  'ms-bienvenida': 'messenger-te-escribieron', 'ms-qr': 'messenger-te-escribieron', 'ms-ref': 'messenger-te-escribieron', 'ms-comentario': 'messenger-te-escribieron',
  'email-respuesta-auto': 'email-recibido',
  'felicitacion-clase': null,
};

test('las 25 de antes apuntan a la de su categoría (que existe), y ninguna se puede pedir por su id viejo', () => {
  assert.equal(Object.keys(DE_ANTES).length, 25);
  assert.deepEqual(PLANTILLAS_REEMPLAZADAS, DE_ANTES);
  for (const [viejo, nuevo] of Object.entries(PLANTILLAS_REEMPLAZADAS)) {
    assert.equal(plantillaPorId(viejo), null, `${viejo} sigue vigente`);
    if (nuevo == null) { assert.deepEqual(plantillaQueLaReemplaza(viejo), { reemplazo: null }); continue; }
    const p = plantillaPorId(nuevo);
    assert.ok(p, `${viejo} apunta a «${nuevo}», que no existe`);
    assert.equal(plantillaQueLaReemplaza(viejo)?.reemplazo, p);
  }
  // Una vigente no es «de antes».
  assert.equal(plantillaQueLaReemplaza('lead-agendo'), null);
  assert.equal(motivoDePlantillaVieja('mako-agendado'), 'Esa plantilla ahora es «Un Lead Agendó Llamada».');
  assert.equal(motivoDePlantillaVieja('felicitacion-clase'), 'Esa plantilla se retiró.');
});

test('crear con un id de antes contesta 400 NOMBRANDO la nueva y no toca la base (nunca crea otra cosa en silencio)', async () => {
  for (const [viejo, nuevo] of Object.entries(PLANTILLAS_REEMPLAZADAS)) {
    const { db, llamadas } = baseDeMentira();
    await assert.rejects(
      crearDesdePlantilla(viejo, { db, setPasos: async () => {}, setDisparadores: async () => {} }),
      (e: unknown) => e instanceof PlantillaInvalidaError && (nuevo ? e.message.includes(`«${plantillaPorId(nuevo)!.nombre}»`) : /se retiró/.test(e.message)),
      `${viejo}: no nombra la que la reemplaza`,
    );
    assert.deepEqual(ops(llamadas), [], `${viejo}: tocó la base`);
  }
});

test('cada plantilla se PUEDE PUBLICAR y está armada con las piezas de HOY (forma y datos)', () => {
  for (const p of PLANTILLAS) {
    const pasos = normalizar(pasosDePlantilla(p));
    const c = cronDePlantilla(p);
    assert.deepEqual(validarParaGuardar(pasos), [], `${p.id}: no se guarda`);
    assert.deepEqual(validarGrafo(pasos), [], `${p.id}: no se publica`);
    assert.equal(frenoDelFlujo(pasos, faltanEnAccion), null, `${p.id}: el lienzo frena Publicar`);
    assert.ok(raizSalida(pasos), `${p.id}: el CRON no lleva a ninguna tarjeta`);
    assert.ok(pasos.length <= TOPE_NODOS && 1 + contarParalelos(pasos) <= TOPE_HILOS, `${p.id}: se pasa de los topes`);
    // NUNCA una versión vieja: ni dos CONDITION pegadas, ni CONDITION → DELAY → CONDITION, ni {{mensaje_mako}}, ni un
    // CRON de antes, ni dos AI Step, ni un dato del equipo al lead (la MISMA función que usa el script de prod).
    assert.deepEqual(problemasDeForma(pasos, disparadoresDePlantilla(p)), [], `${p.id}: fuera de lo de hoy`);
    // Cada dato se resuelve en SU tarjeta (la MISMA función que Publicar).
    assert.deepEqual(problemasDeTokens(pasos, c.trigger_tipo, c.subtipo), [], `${p.id}: un dato que no se resuelve`);
    // Un Evento de MaKo: además, lo que su emisor sabe correr.
    if (c.subtipo) assert.equal(frenoDelEvento(pasos, c.subtipo), null, `${p.id}: el emisor de «${c.subtipo}» no la sabe correr`);
  }
});

test('cada acción existe en el registro, es una acción y lleva lo obligatorio (lo que mira setSecuenciaPasos)', () => {
  for (const p of PLANTILLAS) {
    for (const x of p.pasos) {
      if (claseDe(x) !== 'accion') continue;
      const a = x.accion!;
      const d = porId(a.operacion);
      assert.ok(d && esAccion(d), `${p.id}/${x.id}: «${a.operacion}» no es una acción de MaKo`);
      assert.deepEqual(faltanEnAccion(a.operacion, a.params), [], `${p.id}/${x.id}: le falta un dato`);
    }
  }
});

test('es del modelo de hoy: sin «Ir a», sin campos de antes, «Sale sola» explícito y «MaKo en WhatsApp» con su lista', () => {
  const CLASES = new Set(['mensaje', 'accion', 'esperar', 'condicion', 'respuesta', 'inicio']);
  for (const p of PLANTILLAS) {
    for (const x of p.pasos as readonly PasoDePlantilla[]) {
      const c = claseDe(x);
      const donde = `${p.id}/${x.id}`;
      assert.ok(CLASES.has(c), `${donde}: una tarjeta «${c}»`);
      // El CRON con varios caminos es la tarjeta de inicio (la del ＋ del CRON), con su id de siempre.
      if (c === 'inicio') assert.equal(x.id, ID_INICIO, `${donde}: el inicio con otro id`);
      else assert.ok(typeof x.id === 'string' && /^[a-z]{2}_[a-z0-9_]+$/.test(x.id), `${donde}: sin id estable`);
      assert.ok(!x.delay_horas, `${donde}: espera en delay_horas (va una tarjeta de espera)`);
      for (const k of ['requiere', 'ancla', 'audio_id', 'media_id', 'variantes', 'partes', 'destino'] as const) {
        assert.equal((x as Record<string, unknown>)[k], undefined, `${donde}: trae «${k}»`);
      }
      assert.equal(x.template_wa ?? null, null, `${donde}: plantilla del oficial`);
      if (c === 'mensaje') {
        assert.ok(x.tipo === undefined || x.tipo === 'texto' || x.tipo === 'ia', `${donde}: tipo «${x.tipo}»`);
        assert.ok(['whatsapp', 'email', 'instagram', 'messenger'].includes(String(x.canal)), `${donde}: canal «${x.canal}»`);
        // Un DM de Instagram o Messenger sólo puede salir por el canal de su CRON (la ventana de 24 h es de esa charla).
        if (x.canal === 'instagram' || x.canal === 'messenger') assert.equal(p.cron.fijo, x.canal, `${donde}: un ${x.canal} con otro CRON`);
        if (x.tipo === 'ia') assert.equal(x.canal, 'whatsapp', `${donde}: «MaKo lo adapta» sólo sale por WhatsApp`);
        assert.equal(typeof x.revisar, 'boolean', `${donde}: «Sale sola» queda al default de la automatización`);
      }
      if (c === 'accion') {
        assert.equal(x.accion!.operacion, OP_AVISAR, `${donde}: una acción que no es el aviso al equipo`);
        assert.equal(x.accion!.params.leadId, LEAD_DEL_EVENTO, `${donde}: el aviso no es sobre el lead del evento`);
        // «MaKo en WhatsApp» con su LISTA: sale TAL CUAL (lo que se ve es lo que llega), y el espejo es su texto.
        assert.ok(esTarjetaTalCual(x.accion!.params), `${donde}: una tarjeta MaKo de ANTES (sin partes)`);
        assert.equal(x.accion!.params.mensaje, textoDePartes(partesDeMako(x.accion!.params)), `${donde}: el espejo no es el texto`);
      }
      if (c === 'esperar') assert.ok(Number(x.espera?.minutos) > 0, `${donde}: espera sin cuánto`);
    }
  }
});

test('lo que habla de la reunión vuelve a mirarla: detrás de una espera «antes de la reunión» o de «Próxima reunión en»', () => {
  for (const p of PLANTILLAS) assert.deepEqual(datosDeReunionSinMirarla(normalizar(pasosDePlantilla(p))), [], `${p.id}: un dato de la reunión sin mirarla`);
  // «Un Lead Agendó Llamada»: TODO lo que sale (fuera del AI Step) cuelga de una espera «antes de la reunión» o vuelve a
  // mirar la reunión. El motor ancla el carril en la próxima reunión (M3), pero el «¿me confirmas?» y los avisos no.
  const p = plantillaPorId('lead-agendo')!;
  const pasos = normalizar(pasosDePlantilla(p));
  const resp = pasos.find((x) => esPasoIA(x));
  const deRespuesta = resp ? descendientes(pasos, resp.id!) : new Set<string>();
  let vistos = 0;
  for (const x of pasos) {
    const c = claseDe(x);
    if ((c !== 'mensaje' && c !== 'accion') || deRespuesta.has(x.id!)) continue;
    vistos++;
    assert.ok(miraLaReunion(pasos, x.id!), `lead-agendo/${x.id}: sale sin mirar si la reunión sigue por delante`);
  }
  assert.ok(vistos >= 10, `sólo ${vistos} tarjetas que salen`);
  // El aviso «Nuevo agendado» (la_mk1) va DETRÁS de «Su reunión sigue en pie» (era «Próxima reunión en» hasta el 14/10/2026):
  // subido al CRON, le avisaría al grupo de todos los que ya estaban en la etapa al prender la automatización.
  const padres = padresDe(pasos, 'la_mk1');
  assert.equal(padres.length, 1);
  const cond = nodoPorId(pasos, padres[0].id)!;
  assert.equal(claseDe(cond), 'condicion');
  assert.ok(cond.ramas!.find((r) => r.id === padres[0].puerto)!.filas.some((f) => f.campo === 'reunion_en_pie'), 'la_mk1 no cuelga de «Su reunión sigue en pie»');
});

test('«Un Lead Agendó Llamada»: TRES caminos desde el CRON (recordatorios y equipo, confirmar, email)', () => {
  const pasos = normalizar(pasosDePlantilla(plantillaPorId('lead-agendo')!));
  assert.deepEqual(raicesSalida(pasos), ['la_r', 'la_p', 'la_m']);
  assert.ok(raicesSalida(pasos).length - 1 <= TOPE_PARALELOS);
  // Los recordatorios: 24 h, 1 h, 30 min (al equipo) y 15 min antes, cada uno detrás de su espera «antes de la reunión».
  const antes = pasos.filter((x) => x.espera?.modo === 'antes_reunion').map((x) => [x.id, x.espera!.minutos, nodoPorId(pasos, x.siguiente)?.id]);
  assert.deepEqual(antes, [['la_e24', 1440, 'la_w24'], ['la_e60', 60, 'la_w60'], ['la_e30', 30, 'la_mk2'], ['la_e15', 15, 'la_w15'], ['la_me24', 1440, 'la_m2']]);
  // Confirmar: UNA condición con dos ramas (a quien ya le escribiste no se le dice «te escribo por…»), y las dos llegan a
  // la MISMA espera.
  const la_p = nodoPorId(pasos, 'la_p')!;
  assert.equal(la_p.ramas!.length, 2);
  const [ya, nuevo] = la_p.ramas!.map((r) => nodoPorId(pasos, r.siguiente)!);
  assert.doesNotMatch(ya.cuerpo ?? '', /te escribo por/i);
  assert.match(nuevo.cuerpo ?? '', /te escribo por/i);
  assert.ok(ya.siguiente && ya.siguiente === nuevo.siguiente, 'las dos ramas no llegan a la misma espera');
});

test('«Un Lead Entró»: la antigüedad en las DOS ramas de la entrada, así el motor filtra a los viejos al inscribir (72 h)', () => {
  const pasos = normalizar(pasosDePlantilla(plantillaPorId('lead-entro')!));
  assert.equal(antiguedadDeEntrada(pasos), 72);
  assert.equal(raicesSalida(pasos).length, 1, 'un solo camino de entrada');
});

// ── El AI Step: uno por plantilla donde corre ────────────────────────────────────

/** Las que llevan AI Step y su objetivo, A MANO (§2 punto 10). Las de Evento de MaKo, Instagram, Messenger y email, no. */
const OBJETIVOS: Readonly<Record<string, string>> = {
  'lead-entro': 'Que agende una llamada',
  'lead-agendo': 'Que llegue a la reunión',
  'lead-no-asistio': 'Que vuelva a agendar',
  'lead-tuvo-reunion': 'Que decida avanzar',
  'lead-confirmo-compra': 'Que complete el pago',
  'cliente-empezo': 'Que avance en el programa',
};

test('UN AI Step por plantilla donde corre, con su objetivo y 2 o más escenarios, sin tarjetas debajo, y SOBREVIVE al guardado', () => {
  for (const p of PLANTILLAS) {
    const pasos = normalizar(pasosDePlantilla(p));
    const ias = pasos.filter((y) => esPasoIA(y));
    assert.equal(ias.length, OBJETIVOS[p.id] ? 1 : 0, `${p.id}: ${ias.length} AI Step`);
    // Ningún «Si responde» de los de siempre.
    assert.equal(pasos.filter((y) => claseDe(y) === 'respuesta').length, ias.length, `${p.id}: un «Si responde» de los de siempre`);
    for (const x of ias) {
      const donde = `${p.id}/${x.id}`;
      assert.equal(x.objetivo, OBJETIVOS[p.id], `${donde}: el objetivo`);
      assert.ok(x.casos!.length >= 2 && x.casos!.length <= TOPE_ESCENARIOS_AI_STEP, `${donde}: ${x.casos!.length} escenarios`);
      assert.ok(x.casos!.every((c) => c.objetivo === undefined && c.avisar === undefined && c.hasta === undefined), `${donde}: un caso con lo de antes`);
      for (const c of x.casos!) assert.equal(faltaEnCaso(c), null, `${donde}/${c.id}: le falta algo`);
      assert.equal(x.si_no ?? null, null, `${donde}: «Otra cosa» lleva a una tarjeta`);
      for (const c of x.casos ?? []) assert.equal(c.siguiente ?? null, null, `${donde}/${c.id}: el caso lleva a una tarjeta`);
      assert.deepEqual([...descendientes(pasos, x.id!)], [], `${donde}: tiene tarjetas debajo`);
      // `setSecuenciaPasos` reconstruye cada paso con `camposDelFlujo`: lo que no conserve se BORRA en el primer guardado.
      const guardado = camposDelFlujo(x);
      assert.equal(guardado.paso_ia, true, `${donde}: el guardado lo vuelve un «Si responde» de los de siempre`);
      assert.deepEqual(guardado.casos, x.casos, `${donde}: el guardado le cambia los casos`);
      assert.equal(guardado.objetivo, x.objetivo, `${donde}: el guardado le borra el objetivo`);
    }
  }
});

/**
 * LO QUE HACE CADA ESCENARIO, escrito A MANO desde la tabla del diseño (§2 punto 10) y las equivalencias de la libertad
 * (§7: «Para aprobar» contesta para revisar y avisa; «Sola» contesta sola y no avisa; «Sólo te avisa» no contesta y
 * avisa). Medido sobre lo que CORRE (la expansión del motor y «Probar»). Deducido del catálogo, daría verde sobre el
 * escenario que perdió su decisión.
 *
 * ⚠️ «Tiene una duda» (lead-tuvo-reunion y cliente-empezo en el diseño) NO está: no es un escenario del catálogo
 * (lib/ai-step-escenarios.ts, de otro paquete) y la galería no inventa uno. Pedido al cierre.
 */
type Sale = 'sola' | 'revisar' | 'no contesta';
const DECISIONES: Readonly<Record<string, ReadonlyArray<readonly [titulo: string, sale: Sale, avisa: boolean]>>> = {
  'lead-entro': [['Quiere agendar', 'revisar', true], ['Pregunta el precio', 'revisar', true], ['No le interesa', 'revisar', true]],
  'lead-agendo': [
    ['Confirma', 'sola', false], ['Quiere cambiar el día', 'revisar', true], ['Pregunta por la reunión', 'revisar', true],
    ['Pregunta el precio', 'revisar', true], ['Puede no calificar', 'no contesta', true],
  ],
  'lead-no-asistio': [['Quiere reagendar', 'revisar', true], ['No le interesa', 'revisar', true]],
  'lead-tuvo-reunion': [['Pregunta el precio', 'revisar', true], ['Quiere retomarlo', 'revisar', true], ['No le interesa', 'revisar', true]],
  'lead-confirmo-compra': [['Dice que ya pagó', 'revisar', true], ['Tiene un problema para pagar', 'revisar', true], ['Ya no quiere comprar', 'no contesta', true]],
  'cliente-empezo': [['Tiene una queja', 'no contesta', true], ['Acepta dejar el testimonio', 'revisar', true], ['No puede ahora', 'sola', false]],
};

test('cada escenario hace lo que dice la tabla, medido sobre lo que CORRE (la expansión del motor y «Probar»)', () => {
  for (const p of PLANTILLAS) {
    const exp = expandirPasoIA(normalizar(pasosDePlantilla(p)));
    const resp = exp.find((x) => claseDe(x) === 'respuesta');
    const corre: Array<[string, Sale, boolean]> = [];
    for (const c of resp?.casos ?? []) {
      const donde = `${p.id}/${c.id}`;
      let n = nodoPorId(exp, c.siguiente);
      let sale: Sale = 'no contesta';
      if (n && claseDe(n) === 'mensaje') {
        assert.ok(n.tipo === 'ia' && n.canal === 'whatsapp', `${donde}: la respuesta no la escribe MaKo por WhatsApp`);
        sale = n.revisar === false ? 'sola' : 'revisar';
        n = nodoPorId(exp, n.siguiente);
      }
      if (n) {
        assert.equal(claseDe(n), 'accion', `${donde}: después de la respuesta hay otra cosa que un aviso`);
        assert.equal(n.accion!.operacion, OP_AVISAR, `${donde}: el aviso no es al equipo`);
        assert.deepEqual(faltanEnAccion(n.accion!.operacion, n.accion!.params), [], `${donde}: al aviso le falta un dato`);
      }
      corre.push([c.titulo, sale, !!n]);
      // La guarda de la plata: un escenario que habla del precio nunca sale solo.
      if (/precio|cuesta|pago|descuento/i.test(`${c.titulo} ${c.cuando}`)) assert.notEqual(sale, 'sola', `${donde}: habla de plata y sale sola`);
    }
    assert.deepEqual(corre, (DECISIONES[p.id] ?? []).map((d) => [...d]), `${p.id}: lo que hace cada escenario`);
    if (resp) {
      const otra = nodoPorId(exp, resp.si_no);
      assert.equal(otra && claseDe(otra), 'accion', `${p.id}: «Lo demás» no avisa`);
      assert.deepEqual(otra!.accion!.params, { leadId: LEAD_DEL_EVENTO, mensaje: AVISO_OTRA_COSA }, `${p.id}: el aviso de «Lo demás»`);
    }
  }
});

test('ninguna condición necesita un dato del negocio (una etiqueta, una etapa, un curso) ni es de las retiradas', () => {
  for (const p of PLANTILLAS) {
    for (const x of p.pasos) {
      if (claseDe(x) !== 'condicion') continue;
      for (const r of x.ramas ?? []) {
        for (const f of r.filas as FilaCondicion[]) {
          const def = condicionPorId(f.campo);
          const donde = `${p.id}/${x.id}: «${String(f.campo)}»`;
          assert.ok(def, `${donde} no está en el catálogo`);
          assert.ok(!def!.retirada, `${donde} está retirada`);
          assert.equal(problemaDeFila(f), null, `${donde} está incompleta`);
          assert.notEqual(def!.valor.t, 'lista', `${donde} se elige de una lista del negocio`);
          assert.ok(f.campo !== 'etiqueta' && f.campo !== 'etapa', `${donde} nombra algo del negocio`);
        }
      }
    }
  }
});

test('cada camino pregunta su canal en la entrada: un email o un WhatsApp a quien no lo tiene cancela la inscripción entera', () => {
  // Las de un CRON de etapa que mandan por los dos canales: la condición de entrada tiene una rama por canal.
  for (const id of ['lead-entro', 'lead-no-asistio', 'cliente-empezo']) {
    const pasos = normalizar(pasosDePlantilla(plantillaPorId(id)!));
    const entrada = nodoPorId(pasos, raizSalida(pasos))!;
    const canales = entrada.ramas!.map((r) => r.filas.filter((f) => f.campo === 'tiene_telefono' || f.campo === 'tiene_email').map((f) => f.campo));
    assert.deepEqual(canales, [['tiene_telefono'], ['tiene_email']], `${id}: la entrada no pregunta el canal de cada camino`);
    for (const r of entrada.ramas!) {
      const primero = nodoPorId(pasos, r.siguiente)!;
      assert.equal(primero.canal, r.filas.some((f) => f.campo === 'tiene_email') ? 'email' : 'whatsapp', `${id}: la rama manda por otro canal`);
    }
  }
});

test('los datos del EQUIPO van sólo en «MaKo en WhatsApp», y cada aviso nuevo lleva a la vista quién es y el link', () => {
  for (const p of PLANTILLAS) {
    for (const x of normalizar(pasosDePlantilla(p))) {
      const claves = textosDeTarjeta(x).flatMap((t) => tokensDe(t).map((k) => k.key));
      const delEquipo = claves.filter((k) => datoDe(k)?.soloPara === 'equipo');
      if (claseDe(x) === 'mensaje') assert.deepEqual(delEquipo, [], `${p.id}/${x.id}: un dato del equipo en un mensaje al lead`);
      // Una tarjeta con su lista sale TAL CUAL: no agrega sola ni el nombre ni el link (la cobranza es la de antes, LITERAL).
      // El AI Analyst (13/10/2026) no habla de un lead: el análisis es del negocio. Lleva SU link (al análisis).
      if (claseDe(x) === 'accion' && p.id === 'mako-analisis') assert.ok(claves.includes('analisis_link'), `${p.id}/${x.id}: el aviso sin el link al análisis`);
      if (claseDe(x) === 'accion' && p.id !== 'mako-cobranza' && p.id !== 'mako-analisis') {
        assert.ok(claves.includes('link_lead'), `${p.id}/${x.id}: el aviso sin el link a la ficha`);
        assert.ok(claves.includes('nombre_completo'), `${p.id}/${x.id}: el aviso sin el nombre del lead`);
      }
    }
  }
});

test('no trae datos de un cliente real: ni nombres, ni links, ni números, ni su firma', () => {
  for (const p of PLANTILLAS) {
    for (const t of textos(p)) {
      assert.doesNotMatch(t, /https?:\/\/|www\./i, `${p.id}: un link «${t.slice(0, 60)}»`);
      assert.doesNotMatch(t, /\d{5,}/, `${p.id}: un número largo «${t.slice(0, 60)}»`);
      for (const real of REALES) assert.ok(!sinAcentos(t).includes(sinAcentos(real)), `${p.id}: «${real}» en «${t.slice(0, 60)}»`);
    }
  }
});

test('el texto que le llega al lead (y al equipo) va con tuteo neutro, sin voseo', () => {
  for (const p of PLANTILLAS) {
    for (const t of textos(p)) assert.deepEqual(marcasDeVoseo(t), [], `${p.id}: voseo en «${t.slice(0, 80)}»`);
  }
});

test('pasosDePlantilla da una COPIA con el orden de lectura: crear no toca el catálogo', () => {
  const p = plantillaPorId('lead-entro')!;
  assert.ok(p.pasos[0].ramas?.length, 'la de la prueba ya no arranca con una condición');
  const a = pasosDePlantilla(p);
  assert.deepEqual(a.map((x) => x.orden), a.map((_, i) => i + 1));
  a[0].cuerpo = 'cambiado';
  (a[0].ramas ?? [])[0]?.filas.push({ campo: 'pago' });
  assert.notEqual(p.pasos[0].cuerpo, 'cambiado');
  assert.equal(pasosDePlantilla(p)[0].ramas?.[0]?.filas.length, p.pasos[0].ramas?.[0]?.filas.length);
});

test('nombreLibre: el de la plantilla, y con un número si ya hay una con ese nombre', () => {
  assert.equal(nombreLibre('Un Lead No Asistió', []), 'Un Lead No Asistió');
  assert.equal(nombreLibre('Un Lead No Asistió', ['un lead no  asistió']), 'Un Lead No Asistió 2');
  assert.equal(nombreLibre('Un Lead No Asistió', ['Un Lead No Asistió', 'Un Lead No Asistió 2']), 'Un Lead No Asistió 3');
  const largo = 'Bienvenida — dejó sus datos y no agendó';
  const r = nombreLibre(largo, [largo]);
  assert.ok(r.length <= TOPE_NOMBRE_SECUENCIA && r.endsWith(' 2'), r);
});

// ── 2. La etapa que pide la pantalla ─────────────────────────────────────────────

const UN_PRODUCTO: ProductoParaDisparo[] = [{
  funnelId: 5, productoId: 9, nombre: 'Mentoría',
  etapas: [{ value: 'nuevo', label: 'Nuevo' }, { value: 'agendado', label: 'Agendado' }],
  etapasEntrega: [{ value: 'clase1', label: 'Clase 1' }],
}];
const DOS_PRODUCTOS: ProductoParaDisparo[] = [
  ...UN_PRODUCTO,
  { funnelId: null, productoId: 11, nombre: 'Taller', etapas: [], etapasEntrega: [{ value: 'modulo1', label: 'Módulo 1' }] },
];

test('las etapas que se ofrecen son las del CRON, sólo del kanban que la plantilla pide y sin etiquetas', () => {
  assert.deepEqual(seccionesParaCron('etapa_venta', UN_PRODUCTO).map((s) => s.options.map((o) => o.value)), [['venta:5:nuevo', 'venta:5:agendado']]);
  assert.deepEqual(seccionesParaCron('etapa_entrega', UN_PRODUCTO).map((s) => s.options.map((o) => o.value)), [['entrega:9:clase1']]);
  assert.deepEqual(seccionesParaCron('etapa_venta', DOS_PRODUCTOS).map((s) => s.title), ['Mentoría']);
  assert.deepEqual(seccionesParaCron('etapa_entrega', DOS_PRODUCTOS).map((s) => [s.title, s.options.map((o) => o.value)]), [['Mentoría', ['entrega:9:clase1']], ['Taller', ['entrega:11:modulo1']]]);
  assert.deepEqual(seccionesParaCron('etapa_venta', []), []);
});

test('el botón dice la etapa elegida como el editor del CRON', () => {
  const s1 = seccionesParaCron('etapa_venta', UN_PRODUCTO);
  assert.equal(rotuloDeEleccion('etapa_venta', s1, ''), SIN_ETAPA);
  assert.equal(rotuloDeEleccion('etapa_venta', s1, 'venta:5:agendado'), 'Llega a «Agendado»');
  const s2 = seccionesParaCron('etapa_entrega', DOS_PRODUCTOS);
  assert.equal(rotuloDeEleccion('etapa_entrega', s2, 'entrega:11:modulo1'), 'Taller · Llega a «Módulo 1»');
});

test('lo elegido se guarda sólo si es del kanban que la plantilla pide, y como un CRON completo', () => {
  const v = disparadorDeEleccion('etapa_venta', 'venta:5:agendado');
  assert.deepEqual(v, { id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'agendado', etapas: null, funnel_id: 5 });
  assert.equal(problemaDeDisparadores([v!]), null);
  const e = disparadorDeEleccion('etapa_entrega', 'entrega:9:clase1');
  assert.deepEqual(e, { id: 'd1', trigger_tipo: 'entrega_actual', etapa: 'clase1', etapas: null, producto_id: 9 });
  assert.equal(problemaDeDisparadores([e!]), null);
  assert.equal(disparadorDeEleccion('etapa_venta', 'entrega:9:clase1'), null);
  assert.equal(disparadorDeEleccion('etapa_entrega', 'venta:5:agendado'), null);
  assert.equal(disparadorDeEleccion('etapa_venta', 'etiqueta:3'), null);
  assert.equal(disparadorDeEleccion('etapa_venta', 'venta:5:'), null);
  assert.equal(disparadorDeEleccion('etapa_venta', 42), null);
});

// La API (`crear_automatizacion_desde_plantilla`) dice la etapa en PALABRAS: se resuelve contra las MISMAS opciones.
test('la etapa dicha en palabras: sin acentos, con dos que calzan decide el producto, y si no, contesta las opciones', () => {
  const VARIOS: ProductoParaDisparo[] = [
    ...UN_PRODUCTO,
    { funnelId: 7, productoId: 12, nombre: 'Curso', etapas: [{ value: 'agendado', label: 'Agendado' }], etapasEntrega: [] },
  ];
  assert.deepEqual(eleccionEnPalabras('etapa_venta', { productos: UN_PRODUCTO }, 'agendado'), { ok: true, valor: 'venta:5:agendado', rotulo: 'Agendado' });
  assert.deepEqual(eleccionEnPalabras('etapa_entrega', { productos: UN_PRODUCTO }, 'CLASE 1'), { ok: true, valor: 'entrega:9:clase1', rotulo: 'Clase 1' });
  const dos = eleccionEnPalabras('etapa_venta', { productos: VARIOS }, 'Agendado');
  assert.equal(dos.ok, false, 'eligió una al azar entre dos productos');
  assert.deepEqual(!dos.ok && dos.opciones, ['Agendado (Mentoría)', 'Agendado (Curso)']);
  assert.deepEqual(eleccionEnPalabras('etapa_venta', { productos: VARIOS }, 'Agendado', 'curso'), { ok: true, valor: 'venta:7:agendado', rotulo: 'Agendado (Curso)' });
  const nada = eleccionEnPalabras('etapa_venta', { productos: UN_PRODUCTO }, 'Ganado');
  assert.ok(!nada.ok && nada.opciones.includes('Nuevo'));
  // Una etiqueta (la del newsletter): por su nombre, nunca una archivada.
  const ETIQUETAS = [{ id: 3, nombre: 'Suscriptor' }, { id: 4, nombre: 'Vieja', archivada_at: '2026-01-01' }];
  assert.deepEqual(eleccionEnPalabras('etiqueta', { productos: [], etiquetas: ETIQUETAS }, 'suscriptor'), { ok: true, valor: 'etiqueta:3', rotulo: 'Suscriptor' });
  assert.equal(eleccionEnPalabras('etiqueta', { productos: [], etiquetas: ETIQUETAS }, 'Vieja').ok, false);
  // Lo elegido es un valor que la galería guarda.
  assert.ok(disparadorDeEleccion('etapa_venta', 'venta:7:agendado'));
});

// ── 3. Crear ─────────────────────────────────────────────────────────────────────

type Llamada = { op: string; args: unknown[] };
function baseDeMentira(o: { vivas?: string[]; errIns?: string } = {}) {
  const llamadas: Llamada[] = [];
  const db: DbPlantilla = {
    from: () => ({
      select: (cols) => ({
        is: async (c, v) => {
          llamadas.push({ op: 'select', args: [cols, c, v] });
          return { data: (o.vivas ?? []).map((nombre) => ({ nombre, trigger_tipo: 'etapa_actual' })), error: null };
        },
      }),
      insert: (fila) => ({
        select: () => ({
          single: async () => {
            llamadas.push({ op: 'insert', args: [fila] });
            return o.errIns ? { data: null, error: { message: o.errIns } } : { data: { id: 700 }, error: null };
          },
        }),
      }),
      delete: () => ({ eq: async (c, v) => { llamadas.push({ op: 'delete', args: [c, v] }); return { data: null, error: null }; } }),
    }),
  };
  return { db, llamadas };
}
const ops = (ll: Llamada[]) => ll.map((l) => l.op);

test('crear: nace APAGADA, con el CRON a elegir, los pasos por su puerta y sin tocar el CRON si no se eligió', async () => {
  const { db, llamadas } = baseDeMentira();
  const pasos: Array<[number, unknown]> = [];
  const crones: unknown[] = [];
  const r = await crearDesdePlantilla('lead-agendo', {
    db, clave: () => 'plantilla-x',
    setPasos: async (id, ps) => { pasos.push([id, ps]); },
    setDisparadores: async (id, l) => { crones.push([id, l]); },
  });
  assert.deepEqual(r, { id: 700, nombre: 'Un Lead Agendó Llamada', pide: 'etapa_venta', aviso: null });
  assert.deepEqual(ops(llamadas), ['select', 'insert']);
  assert.deepEqual(llamadas[1].args[0], {
    clave: 'plantilla-x', nombre: 'Un Lead Agendó Llamada', etapa: 'manual', trigger_tipo: 'manual', activa: false, pasos: [], emoji: '📅',
  });
  assert.equal(pasos.length, 1);
  assert.equal(pasos[0][0], 700);
  assert.deepEqual(pasos[0][1], pasosDePlantilla(plantillaPorId('lead-agendo')!));
  assert.equal(crones.length, 0, 'sin etapa elegida no se escribe ningún CRON');
});

test('crear con la etapa elegida: el CRON va por guardarDisparadores y ya no pide nada', async () => {
  const { db } = baseDeMentira();
  const crones: Array<[number, unknown]> = [];
  const r = await crearDesdePlantilla('lead-no-asistio', {
    db, setPasos: async () => {}, setDisparadores: async (id, l) => { crones.push([id, l]); },
  }, { disparador: 'venta:5:noshow' });
  assert.equal(r.pide, null);
  assert.deepEqual(crones, [[700, [{ id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'noshow', etapas: null, funnel_id: 5 }]]]);
});

test('crear: una plantilla que no existe o una etapa de otro kanban no crean NADA', async () => {
  for (const [id, disparador] of [['no-existe', null], ['cliente-empezo', 'venta:5:agendado'], ['lead-no-asistio', 'etiqueta:2'], ['mako-cobranza', 'venta:5:agendado']] as const) {
    const { db, llamadas } = baseDeMentira();
    await assert.rejects(
      crearDesdePlantilla(id, { db, setPasos: async () => {}, setDisparadores: async () => {} }, { disparador }),
      (e: unknown) => e instanceof PlantillaInvalidaError,
    );
    assert.deepEqual(ops(llamadas), [], `${id}: tocó la base`);
  }
});

test('crear: si los pasos no se guardan, la automatización a medias se BORRA y el motivo sube', async () => {
  const { db, llamadas } = baseDeMentira();
  const crones: unknown[] = [];
  await assert.rejects(
    crearDesdePlantilla('lead-entro', {
      db, setPasos: async () => { throw new Error('No se guardó: algo'); }, setDisparadores: async (_, l) => { crones.push(l); },
    }, { disparador: 'venta:5:nuevo' }),
    /No se guardó: algo/,
  );
  assert.deepEqual(ops(llamadas), ['select', 'insert', 'delete']);
  assert.deepEqual(llamadas[2].args, ['id', 700]);
  assert.equal(crones.length, 0);
});

test('crear: una etapa que el negocio no tiene NO tumba la automatización (aviso); un error de la base, sí', async () => {
  class Motivo extends Error {}
  const deps = (err: Error) => {
    const b = baseDeMentira();
    return { b, deps: { db: b.db, setPasos: async () => {}, setDisparadores: async () => { throw err; }, motivoDeCron: (e: unknown) => (e instanceof Motivo ? e.message : null) } };
  };
  const a = deps(new Motivo('«x» no es una etapa de Mentoría.'));
  const r = await crearDesdePlantilla('lead-agendo', a.deps, { disparador: 'venta:5:x' });
  assert.equal(r.pide, 'etapa_venta');
  assert.match(r.aviso ?? '', /no es una etapa de Mentoría/);
  assert.deepEqual(ops(a.b.llamadas), ['select', 'insert']);

  const b = deps(new Error('se cayó la base'));
  await assert.rejects(crearDesdePlantilla('lead-agendo', b.deps, { disparador: 'venta:5:x' }), /se cayó la base/);
  assert.deepEqual(ops(b.b.llamadas), ['select', 'insert', 'delete']);
});

test('crear: si ya hay una automatización con ese nombre, nace con un número', async () => {
  const { db, llamadas } = baseDeMentira({ vivas: ['Un Lead No Asistió', 'Otra'] });
  const r = await crearDesdePlantilla('lead-no-asistio', { db, setPasos: async () => {}, setDisparadores: async () => {} });
  assert.equal(r.nombre, 'Un Lead No Asistió 2');
  assert.equal((llamadas[1].args[0] as { nombre: string }).nombre, 'Un Lead No Asistió 2');
  assert.deepEqual(llamadas[0].args, ['nombre, trigger_tipo', 'archivada_at', null], 'los nombres se miran sólo entre las vigentes');
});

// ── 4. La ruta ───────────────────────────────────────────────────────────────────

test('la ruta: «crear_desde_plantilla» va detrás de la guarda de admin y enchufa las puertas de siempre', () => {
  const src = sinComentarios(leer('app/api/chat-agent/secuencias/route.ts'));
  const post = src.indexOf('export async function POST');
  const guarda = src.indexOf("rol !== 'admin'", post);
  const accion = src.indexOf("body.action === 'crear_desde_plantilla'", post);
  assert.ok(post > 0 && guarda > post && accion > guarda, 'la acción no está detrás de la guarda de admin del POST');
  const bloque = src.slice(accion, src.indexOf("body.action === 'crear'", accion));
  assert.ok(bloque.length > 100 && bloque.length < 1500, `el bloque mide ${bloque.length}`);
  assert.match(bloque, /crearDesdePlantilla\(body\.plantilla/);
  assert.match(bloque, /db:\s*\(await getTenantDb\(\)\)/);
  assert.match(bloque, /setPasos:\s*setSecuenciaPasos\b/);
  assert.match(bloque, /setDisparadores:\s*guardarDisparadores\b/);
  assert.match(bloque, /e instanceof TriggerInvalidoError \? e\.message : null/);
  assert.match(bloque, /PlantillaInvalidaError[\s\S]*status:\s*400/);
});

// ── 5. La pantalla ───────────────────────────────────────────────────────────────

// Decimotercera tanda (punto 2): «Pídeselo a MaKo» se dibuja con quien recibe el pedido (`onPedirAMako`).
const dibujar = (productos: ProductoParaDisparo[] = []) => renderToStaticMarkup(createElement(GaleriaPlantillas, {
  productos, onCerrar: () => {}, onBlanco: () => {}, onCreada: () => {}, onPedirAMako: () => {},
}));

test('la galería dibuja «Pídeselo a MaKo», el buscador, «Lienzo en blanco» PRIMERA y TODAS las plantillas, con su emoji, nombre y línea', () => {
  const html = dibujar(UN_PRODUCTO);
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  assert.ok(html.includes(TITULO_GALERIA));
  const iIA = html.indexOf('data-galeria-ia');
  // Decimocuarta (puntos 1 y 2): la caja del Landing Generator, sin cabecera («Pídeselo a MaKo», «Nace pausada»), con
  // el micrófono de la casa (dicta en el campo) y su «+».
  assert.ok(iIA > 0 && !html.includes('Nace pausada'), 'volvió «Nace pausada»');
  assert.ok(html.indexOf('data-crear-ia-caja="galeria"', iIA) > iIA, 'la caja no es la de la galería');
  assert.ok(html.indexOf('data-caja-pedido', iIA) > iIA, 'la caja no es la del Landing Generator');
  assert.ok(html.includes('aria-label="Dictar el pedido"'), 'sin el micrófono');
  assert.ok(html.includes('aria-label="Agregar"'), 'sin el «+»');
  const iBuscar = html.indexOf('data-galeria-busqueda');
  assert.ok(iBuscar > iIA, 'el buscador no va debajo de «Pídeselo a MaKo»');
  const iGrilla = html.indexOf('data-galeria-grilla');
  assert.ok(iGrilla > iBuscar);
  const iBlanco = html.indexOf('data-empezar="blanco"');
  assert.ok(iBlanco > iGrilla && iBlanco < html.indexOf('data-plantilla='), '«Lienzo en blanco» no es la primera');
  assert.ok(html.includes(esc(BLANCO.nombre)));
  for (const p of PLANTILLAS) {
    assert.ok(html.includes(`data-plantilla="${p.id}"`), p.id);
    for (const t of [p.emoji, p.nombre, p.linea]) assert.ok(html.includes(esc(t)), `${p.id}: falta «${t}»`);
  }
  // Ninguna se dibuja apagada: «Ya la tienes» era del recordatorio, que ya no es una plantilla.
  assert.doesNotMatch(html, /data-ya-la-tiene|Ya la tienes/);
  assert.ok(!html.includes('data-galeria-paso="etapa"'), 'arranca preguntando la etapa');
  assert.doesNotMatch(html, /¿Qué la dispara\?|O empieza así|Desde una plantilla|data-galeria-cron|data-galeria-mako/);
});

test('«Lienzo en blanco» no pasa por el filtro, y la galería ya no abre con una sección', () => {
  const gal = sinComentarios(leer('app/automations/GaleriaPlantillas.tsx'));
  assert.match(gal, /<div className="gal-grilla" data-galeria-grilla>\n\s*<button type="button" className="gal-tarjeta mk-nuevo" data-empezar="blanco"/);
  // (15/10/2026: la lista es la de ESTE workspace: las de SuperAdmin, sólo en la plataforma, `plantillasPara`.)
  assert.match(gal, /const visibles = useMemo\(\(\) => filtrarPlantillas\(plantillasPara\(\{ plataforma \}\), \{ texto, canal: filtro\.canal, objetivo: filtro\.objetivo \}\)/);
  assert.match(gal, /\{!visibles\.length && <div data-galeria-vacia style=\{LINEA\}>\{SIN_RESULTADOS\}<\/div>\}/);
  assert.match(gal, /onClick=\{\(\) => props\.current\.onBlanco\(\)\}/);
  // Undécima tanda: sin `seccion`, sin `triggersVivos` y sin «Ya la tienes».
  assert.doesNotMatch(gal, /\bseccion\b|triggersVivos|yaLaTiene|YA_LA_TIENES|filtroDeSeccion|TRIGGER_RECORDATORIO/);
  assert.doesNotMatch(sinComentarios(leer('app/automations/ChatAgentApp.tsx')), /triggersVivos/);
});

test('la etapa se pregunta sólo si hay etapas de ese kanban para ofrecer; una de CRON fijo no pregunta nada', () => {
  const venta = plantillaPorId('lead-agendo')!;
  const entrega = plantillaPorId('cliente-empezo')!;
  assert.equal(preguntaEtapa(venta, UN_PRODUCTO), true);
  assert.equal(preguntaEtapa(entrega, UN_PRODUCTO), true);
  assert.equal(preguntaEtapa(venta, []), false);
  assert.equal(preguntaEtapa(entrega, [{ ...UN_PRODUCTO[0], etapasEntrega: [] }]), false);
  for (const id of ['mako-cobranza', 'instagram-te-escribieron', 'email-recibido']) assert.equal(preguntaEtapa(plantillaPorId(id)!, UN_PRODUCTO), false, id);
});

// ── 6. El filtro de la galería ───────────────────────────────────────────────────

/** POR DÓNDE SALE CADA UNA, A MANO leyendo sus tarjetas (deducido de `canalesDe` daría verde sobre la función rota). */
const CANALES: Readonly<Record<string, readonly CanalPlantilla[]>> = {
  'lead-entro': ['whatsapp', 'email', 'mako'], 'lead-agendo': ['whatsapp', 'email', 'mako'], 'lead-no-asistio': ['whatsapp', 'email', 'mako'],
  'lead-tuvo-reunion': ['whatsapp', 'mako'], 'lead-confirmo-compra': ['whatsapp', 'mako'], 'lead-no-avanzo': ['mako'], 'cliente-empezo': ['whatsapp', 'email'],
  'mako-cobranza': ['mako'], 'mako-pago': ['mako'], 'mako-analisis': ['mako'], 'mako-charla': ['mako'],
  'instagram-te-escribieron': ['instagram', 'mako'], 'messenger-te-escribieron': ['messenger', 'mako'], 'email-recibido': ['email', 'mako'],
  'email-newsletter': ['email'],
};

test('canalesDe: por dónde sale cada plantilla, contra la tabla escrita a mano (y cada canal tiene alguna)', () => {
  for (const p of PLANTILLAS) assert.deepEqual(canalesDe(p), CANALES[p.id] ?? ['(falta en la tabla)'], `${p.id}: sus canales`);
  for (const c of CANALES_PLANTILLA) assert.ok(PLANTILLAS.some((p) => canalesDe(p).includes(c.id)), `ninguna plantilla de «${c.label}»`);
  for (const o of OBJETIVOS_PLANTILLA) assert.ok(PLANTILLAS.some((p) => p.objetivo === o.id), `ninguna plantilla para «${o.label}»`);
  // El relleno de una tarjeta de control dice `canal: 'whatsapp'` y no sale por ningún lado: no cuenta.
  assert.deepEqual(canalesDe({ cron: { pide: 'etapa_venta', ayuda: 'x' }, pasos: [{ ...pasosDePlantilla(plantillaPorId('email-newsletter')!)[1] }] }), []);
});

test('filtrarPlantillas: cada palabra, sin acentos ni mayúsculas; canal y objetivo se SUMAN; nada es nada', () => {
  const ids = (f: Parameters<typeof filtrarPlantillas>[1]) => filtrarPlantillas(PLANTILLAS, f).map((p) => p.id);
  assert.equal(ids({}).length, PLANTILLAS.length);
  assert.deepEqual(ids({ texto: 'AGENDO llamada' }), ['lead-agendo'], 'sin acentos, sin mayúsculas, cada palabra');
  assert.deepEqual(ids({ texto: '  agendó   LLAMADA ' }), ['lead-agendo'], 'los espacios de más');
  assert.ok(ids({ texto: 'historia' }).includes('instagram-te-escribieron'), 'busca también en la línea');
  assert.deepEqual(ids({ canal: 'instagram', objetivo: 'cobrar' }), [], 'las dos a la vez');
  assert.deepEqual(ids({ canal: 'whatsapp', objetivo: 'cobrar' }), ['lead-confirmo-compra']);
  assert.deepEqual(ids({ objetivo: 'cobrar' }), ['lead-confirmo-compra', 'mako-cobranza', 'mako-pago']);
  assert.deepEqual(ids({ texto: 'no existe nada asi' }), []);
});

test('el filtro: dos grupos con todas las opciones y UNO de cada grupo', () => {
  const g = gruposDelFiltroGaleria();
  assert.deepEqual(g.map((x) => x.title), ['Canal', 'Objetivo']);
  assert.deepEqual(g[0].options.map((o) => o.value), CANALES_PLANTILLA.map((c) => `canal:${c.id}`));
  assert.deepEqual(g[1].options.map((o) => o.value), OBJETIVOS_PLANTILLA.map((o) => `objetivo:${o.id}`));
  let v: string[] = [];
  v = alternarFiltroGaleria(v, 'canal:email');
  v = alternarFiltroGaleria(v, 'objetivo:captar');
  assert.deepEqual(filtroDeValores(v), { canal: 'email', objetivo: 'captar' });
  v = alternarFiltroGaleria(v, 'canal:instagram');
  assert.deepEqual(v, ['objetivo:captar', 'canal:instagram'], 'prender otro canal saca el de antes');
  v = alternarFiltroGaleria(v, 'canal:instagram');
  assert.deepEqual(filtroDeValores(v), { canal: null, objetivo: 'captar' }, 'tocar el prendido lo apaga');
  assert.deepEqual(alternarFiltroGaleria(['canal:email'], 'basura'), ['canal:email']);
  assert.deepEqual(filtroDeValores(['canal:otro']), { canal: null, objetivo: null });
});

test('crear una de un CANAL: nace con TODOS los eventos de su categoría en la fila (uno por disparador), sin la lista de CRON', async () => {
  const ESPERADO: ReadonlyArray<readonly [string, string, readonly string[]]> = [
    ['instagram-te-escribieron', TRIGGER_INSTAGRAM, ['comentario', 'historia', 'dm', 'ref', 'en_vivo']],
    ['messenger-te-escribieron', TRIGGER_MESSENGER, ['dm', 'qr', 'ref', 'comentario']],
    ['email-recibido', TRIGGER_EMAIL_RECIBIDO, ['recibido']],
  ];
  for (const [id, trigger, eventos] of ESPERADO) {
    const p = plantillaPorId(id)!;
    const fila = filaDePlantilla(p, 'k', p.nombre);
    assert.equal(fila.trigger_tipo, trigger, id);
    assert.deepEqual(fila.disparadores, eventos.map((e, i) => ({ id: `d${i + 1}`, trigger_tipo: trigger, subtipo: e })), id);
    // Lo que nace en la fila es una lista que el saneo conserva entera y que Publicar acepta.
    assert.equal(sanearDisparadores(fila.disparadores).length, eventos.length, `${id}: el saneo se come un evento`);
    assert.equal(problemaDeDisparadores(sanearDisparadores(fila.disparadores)), null, `${id}: el CRON no se publica`);
    assert.equal(preguntaEtapa(p, UN_PRODUCTO), false, `${id}: pregunta una etapa`);
    const { db, llamadas } = baseDeMentira();
    const crones: unknown[] = [];
    const r = await crearDesdePlantilla(id, { db, setPasos: async () => {}, setDisparadores: async (_, l) => { crones.push(l); } });
    assert.equal(r.pide, null, id);
    assert.equal((llamadas[1].args[0] as { activa: boolean }).activa, false, `${id}: nace prendida`);
    assert.equal(crones.length, 0, `${id}: el CRON del canal fue por la lista de CRON`);
  }
  // Un Evento de MaKo: UNO, con su evento.
  assert.deepEqual(filaDePlantilla(plantillaPorId('mako-pago')!, 'k', 'x').disparadores, [{ id: 'd1', trigger_tipo: TRIGGER_AVISO_MAKO, subtipo: 'pago_recibido' }]);
  // Una de etapa no trae lista: la elige la persona.
  assert.equal(filaDePlantilla(plantillaPorId('lead-agendo')!, 'k', 'x').disparadores, undefined);
});

test('crear la del newsletter: pide UNA ETIQUETA del negocio, con las mismas opciones que el CRON', async () => {
  const p = plantillaPorId('email-newsletter')!;
  assert.equal(p.cron.pide, 'etiqueta');
  const ETIQUETAS = [{ id: 3, nombre: 'Suscriptor' }, { id: 4, nombre: 'Vieja', archivada_at: '2026-01-01' }];
  const s = seccionesDeEtiquetas(ETIQUETAS);
  assert.deepEqual(s.flatMap((x) => x.options.map((o) => o.value)), ['etiqueta:3'], 'ofrece una archivada');
  assert.equal(rotuloDeEleccion('etiqueta', s, ''), SIN_ETIQUETA);
  assert.equal(rotuloDeEleccion('etiqueta', s, 'etiqueta:3'), 'Se le puso «Suscriptor»');
  assert.equal(preguntaEtapa(p, UN_PRODUCTO, ETIQUETAS), true);
  assert.equal(preguntaEtapa(p, UN_PRODUCTO, []), false, 'sin etiquetas pregunta igual');
  assert.deepEqual(seccionesParaCron('etiqueta', UN_PRODUCTO), [], 'una etiqueta no es una etapa');
  const d = disparadorDeEleccion('etiqueta', 'etiqueta:3');
  assert.deepEqual(d, { id: 'd1', trigger_tipo: 'etiqueta_puesta', etiqueta_id: 3 });
  assert.equal(problemaDeDisparadores([d!]), null);
  assert.equal(disparadorDeEleccion('etiqueta', 'venta:5:agendado'), null, 'una etapa no es una etiqueta');
  assert.equal(disparadorDeEleccion('etapa_venta', 'etiqueta:3'), null);
  const { db } = baseDeMentira();
  const crones: unknown[] = [];
  const r = await crearDesdePlantilla('email-newsletter', { db, setPasos: async () => {}, setDisparadores: async (_, l) => { crones.push(l); } }, { disparador: 'etiqueta:3' });
  assert.equal(r.pide, null);
  assert.deepEqual(crones, [[{ id: 'd1', trigger_tipo: 'etiqueta_puesta', etiqueta_id: 3 }]]);
});

// ROTURAS (undécima tanda, w3-plantillas, 11/10/2026): las obligatorias del encargo, una por vez, con el arnés
// wf-undecima/w3-plantillas/roturas.cjs del scratchpad (rompe, corre ESTE archivo y restaura DE MEMORIA comprobando el
// archivo con sha1 byte a byte igual; nunca con git). Base: 37 pass / 0 fail. Restaurado: 37 / 0.
//   R1 borrar una plantilla de la lista (lead-no-asistio)            → 30 / 7 (las 13, las 25 de antes, crear con un id
//                                                                       viejo, la entrada por canal, canalesDe…)
//   R2 un id viejo apunta a una que no existe                       → 35 / 2 (las 25 de antes + crear con un id viejo)
//   R3 dos CONDITION pegadas en la_p (su 2ª rama va a la_c)          → 34 / 3 (se puede publicar y es de hoy, la reunión,
//                                                                       los tres caminos)
//   R4 {{mensaje_mako}} en la charla                                 → 36 / 1 (las piezas de hoy); y en
//                                                                       tests/automations-mako-en-whatsapp 16 / 1
//   R5 partir el AI Step de lead-agendo en dos                       → 35 / 2 (las piezas de hoy + UN AI Step)
//   R6 subir la_mk1 al CRON (sin «Próxima reunión» delante)          → 35 / 2 (la reunión + los tres caminos)
//   R7 {{link_lead}} en un WhatsApp al lead (la_w15)                 → 35 / 2 (las piezas de hoy + los datos del equipo)
//   R8 crear con un id viejo crea la nueva en silencio (plantilla-crear) → 36 / 1 (crear con un id de antes)
