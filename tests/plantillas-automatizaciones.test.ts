// =============================================================================
// La galería de plantillas de Automations (lib/plantillas-automatizaciones.ts, lib/plantilla-crear.ts,
// app/automations/GaleriaPlantillas.tsx y la acción `crear_desde_plantilla` de la ruta)
// =============================================================================
// Pedido de Martín (10/10/2026): «Si, hagamos la galería de las más comunes... Pero entonces revisa las
// automatizaciones que hay en mi workspace, que estan viejas y no estan bien», y después «no estan
// todas las plantillas de Mauricio y siguen habiendo cosas de versiones anteriores que estan mal».
//
// Lo que se fija, por capas (cada una con su test, para que un rojo diga cuál):
//   1. el catálogo: cada plantilla se PUEDE PUBLICAR (`validarGrafo` y el freno de Publicar del lienzo,
//      con lo obligatorio de cada acción según el registro de la API), es del modelo de la sexta tanda
//      (sin «Ir a» ni campos de la lista de antes), no trae datos de un cliente real, y lo que prepara
//      una reunión vuelve a mirar, después de cada espera, que siga por delante (la guarda del motor
//      decide por el trigger de antes, y una plantilla arranca por una etapa);
//   2. lo que la pantalla pide (la etapa): las opciones salen del desplegable del CRON y lo elegido se
//      guarda sólo si es del kanban que la plantilla pide;
//   3. crear: apagada, los pasos por su puerta, el CRON por la suya, y lo que falla no deja nada a medias
//      (se EJECUTA con una base de mentira);
//   4. la ruta: la acción existe detrás de la guarda de admin y enchufa las puertas de verdad;
//   5. la pantalla: la galería dibuja las dos formas de empezar y todas las plantillas.
//
// Y desde la novena tanda (10/10/2026, Martín): «Todo lo que hiciste de una cantidad impresionante de flujos y
// tarjetas eso justamente debería estar en una nueva tarjeta que sea "AI Step". Configuralo allí» y «Las dos
// automatizaciones de agendó se podrían unificar ya que se tiene justamente la tarjeta de CONDITION». Se fija
// que ningún «Si responde» cuelgue tarjetas (todos son AI Step), que cada AI Step se publique y sobreviva al
// saneo de `setSecuenciaPasos`, que cada caso conserve su decisión de antes (una tabla escrita a mano,
// medida sobre lo que corre: la expansión) y que la post-agenda unificada elija el primer mensaje con
// «Ya le escribiste» y junte las dos ramas en la misma espera.
//
// PROBADO ROMPIÉNDOLO: ver «ROTURAS» al pie (todas en rojo).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  PLANTILLAS, plantillaPorId, pasosDePlantilla, nombreLibre, seccionesParaCron, rotuloDeEleccion, disparadorDeEleccion,
  TOPE_LINEA, TRIGGER_DE_PIDE, SIN_ETAPA, esPlantillaMako, type PasoDePlantilla,
} from '../lib/plantillas-automatizaciones';
import { crearDesdePlantilla, PlantillaInvalidaError, type DbPlantilla } from '../lib/plantilla-crear';
import {
  validarGrafo, validarParaGuardar, normalizar, claseDe, raizSalida, padresDe, descendientes, nodoPorId,
  esPasoIA, expandirPasoIA, faltaEnCaso, AVISO_OTRA_COSA, type FilaCondicion,
} from '../lib/flujo-grafo';
import { camposDelFlujo } from '../lib/nutricion-grafo-motor';
import { frenoDelFlujo, emojiDeSecuencia, type ProductoParaDisparo } from '../lib/flujo-conversacion';
import { problemaDeDisparadores } from '../lib/disparadores';
import { condicionPorId, problemaDeFila } from '../lib/condiciones-catalogo';
import { datoDe, valePara } from '../lib/variables-aviso';
import { marcasDeVoseo } from '../lib/puestas-data';
import { OP_AVISAR } from '../lib/flujo-legado';
import { LEAD_DEL_EVENTO, faltanEnPaso } from '../lib/api-mako/flujo-params';
import { porId } from '../lib/api-mako/registro';
import { esAccion } from '../lib/api-mako/tipos';
import { TOPE_NOMBRE_SECUENCIA } from '../lib/setting-estrategia';
import { GaleriaPlantillas, preguntaEtapa, yaLaTiene, EMPEZAR, TITULO_GALERIA, ROTULO_PLANTILLAS, YA_LA_TIENES } from '../app/automations/GaleriaPlantillas';
import { TRIGGER_RECORDATORIO, toquesDeLaAutomatizacion, frenoDelRecordatorio } from '../lib/recordatorio-automatizacion';
import { TRIGGER_AVISO_MAKO, EVENTOS_MAKO } from '../lib/disparadores';
import { datosDelEvento } from '../lib/aviso-evento';
import { TOQUES, TEXTO_DEFAULT, VARIABLES } from '../lib/recordatorio-lead';

/** La plantilla del recordatorio de la reunión: la única con el CRON fijo (decisión de Martín, 10/10/2026). */
const RECORDATORIO = 'recordatorio-reunion';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

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

// Desde el 11/10/2026 la galería suma su sección «MaKo en WhatsApp» (`esPlantillaMako`): los TRES eventos de MaKo,
// aparte de las del Chatbot (docs/diseno-mako-en-whatsapp-unificado.md). El tope de 5 a 8 es de las del Chatbot.
test('la galería tiene entre 5 y 8 plantillas del Chatbot y las 3 de «MaKo en WhatsApp», con id, nombre, línea y emoji que se pueden guardar', () => {
  const delChatbot = PLANTILLAS.filter((p) => !esPlantillaMako(p));
  assert.ok(delChatbot.length >= 5 && delChatbot.length <= 8, `son ${delChatbot.length}`);
  assert.deepEqual(PLANTILLAS.map((p) => (p.cron.fijo === TRIGGER_AVISO_MAKO ? p.cron.evento : null)).filter(Boolean).sort(), EVENTOS_MAKO.map((e) => e.subtipo).sort(),
    'no hay UNA plantilla por evento de MaKo');
  assert.equal(new Set(PLANTILLAS.map((p) => p.id)).size, PLANTILLAS.length, 'ids repetidos');
  assert.equal(new Set(PLANTILLAS.map((p) => p.nombre)).size, PLANTILLAS.length, 'nombres repetidos');
  for (const p of PLANTILLAS) {
    assert.ok(p.nombre.trim() && p.nombre.length <= TOPE_NOMBRE_SECUENCIA, `${p.id}: el nombre mide ${p.nombre.length}`);
    assert.ok(p.linea.trim() && p.linea.length <= TOPE_LINEA, `${p.id}: la línea mide ${p.linea.length}`);
    assert.equal(emojiDeSecuencia(p.emoji), p.emoji, `${p.id}: «${p.emoji}» no se guarda como emoji`);
    if (p.cron.fijo === TRIGGER_AVISO_MAKO) {
      // Un evento de MaKo: su forma de Publicar es `frenoDelEvento` (tests/automations-mako-en-whatsapp.test.ts).
      const evento = p.cron.evento;
      assert.ok(EVENTOS_MAKO.some((e) => e.subtipo === evento), `${p.id}: evento «${evento}»`);
    } else if (p.cron.fijo) {
      // Fuera de los eventos de MaKo, el CRON fijo es SÓLO el del recordatorio: cualquier otro necesitaría su propia
      // forma de Publicar.
      assert.equal(p.cron.fijo, TRIGGER_RECORDATORIO, `${p.id}: CRON fijo «${p.cron.fijo}»`);
      assert.equal(p.id, RECORDATORIO);
    } else {
      assert.ok(p.cron.pide in TRIGGER_DE_PIDE, `${p.id}: pide «${p.cron.pide}»`);
      assert.ok(p.cron.ayuda.trim(), `${p.id}: sin ayuda para elegir la etapa`);
    }
    assert.equal(plantillaPorId(p.id), p);
  }
  assert.equal(plantillaPorId('no-existe'), null);
  assert.equal(plantillaPorId(7), null);
});

test('cada plantilla se PUEDE PUBLICAR: pasa lo que frena guardar, Publicar y el lienzo', () => {
  for (const p of PLANTILLAS) {
    const pasos = normalizar(pasosDePlantilla(p));
    assert.deepEqual(validarParaGuardar(pasos), [], `${p.id}: no se guarda`);
    assert.deepEqual(validarGrafo(pasos), [], `${p.id}: no se publica`);
    assert.equal(frenoDelFlujo(pasos, faltanEnAccion), null, `${p.id}: el lienzo frena Publicar`);
    assert.ok(raizSalida(pasos), `${p.id}: el CRON no lleva a ninguna tarjeta`);
    // Con el CRON del recordatorio, Publicar (el lienzo y `setSecuenciaPasos`) exige además lo que su emisor
    // sabe mandar.
    if (p.cron.fijo === TRIGGER_RECORDATORIO) assert.equal(frenoDelRecordatorio(pasos), null, `${p.id}: el emisor no la sabe mandar`);
  }
});

test('el recordatorio es el de fábrica: los tres toques, con sus textos, y nace como lo armó la mudanza', () => {
  const r = toquesDeLaAutomatizacion(normalizar(pasosDePlantilla(plantillaPorId(RECORDATORIO)!)));
  assert.equal(r.problema, null);
  assert.deepEqual(r.toques.map((t) => t.min), [...TOQUES]);
  assert.deepEqual(r.toques.map((t) => t.texto), TOQUES.map((m) => TEXTO_DEFAULT[m]));
  assert.ok(r.toques.every((t) => t.linea === null), 'trae el número de un negocio');
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

test('es del modelo de la sexta tanda: sin «Ir a», sin campos de la lista de antes y con «Sale sola» explícito', () => {
  const CLASES = new Set(['mensaje', 'accion', 'esperar', 'condicion', 'respuesta']);
  for (const p of PLANTILLAS) {
    for (const x of p.pasos as readonly PasoDePlantilla[]) {
      const c = claseDe(x);
      const donde = `${p.id}/${x.id}`;
      assert.ok(CLASES.has(c), `${donde}: una tarjeta «${c}»`);
      assert.ok(typeof x.id === 'string' && /^[a-z]{2}_[a-z0-9_]+$/.test(x.id), `${donde}: sin id estable`);
      assert.ok(!x.delay_horas, `${donde}: espera en delay_horas (va una tarjeta de espera)`);
      for (const k of ['requiere', 'ancla', 'audio_id', 'media_id', 'variantes', 'partes', 'destino'] as const) {
        assert.equal((x as Record<string, unknown>)[k], undefined, `${donde}: trae «${k}»`);
      }
      assert.equal(x.template_wa ?? null, null, `${donde}: plantilla del oficial`);
      if (c === 'mensaje') {
        // `texto` es lo mismo que ausente (lo escribe la mudanza del recordatorio, `pasosDeLaConfig`).
        assert.ok(x.tipo === undefined || x.tipo === 'texto' || x.tipo === 'ia', `${donde}: tipo «${x.tipo}»`);
        assert.ok(x.canal === 'whatsapp' || x.canal === 'email', `${donde}: canal «${x.canal}»`);
        if (x.tipo === 'ia') assert.equal(x.canal, 'whatsapp', `${donde}: «MaKo lo adapta» sólo sale por WhatsApp`);
        assert.equal(typeof x.revisar, 'boolean', `${donde}: «Sale sola» queda al default de la automatización`);
      }
      if (c === 'accion') {
        assert.equal(x.accion!.operacion, OP_AVISAR, `${donde}: una acción que no es el aviso al equipo`);
        assert.equal(x.accion!.params.leadId, LEAD_DEL_EVENTO, `${donde}: el aviso no es sobre el lead del evento`);
      }
      if (c === 'esperar') assert.ok(Number(x.espera?.minutos) > 0, `${donde}: espera sin cuánto`);
    }
  }
});

/**
 * ¿Lo que sale en `id` vuelve a mirar, después de la última espera, que la reunión siga por delante? Sube
 * por TODOS los padres (una tarjeta puede tener varios): cada camino desde una espera «por tiempo» tiene
 * que cruzar una condición con «Próxima reunión en». Una espera «antes de la reunión» ya la mira el motor.
 */
function miraLaReunion(pasos: readonly PasoDePlantilla[], id: string, vistos = new Set<string>()): boolean {
  if (vistos.has(id)) return true;
  vistos.add(id);
  const padres = padresDe(pasos, id);
  if (!padres.length) return false;
  return padres.every((pa) => {
    const p = pasos.find((x) => x.id === pa.id)!;
    if (claseDe(p) === 'condicion' && (p.ramas ?? []).some((r) => r.id === pa.puerto && r.filas.some((f) => f.campo === 'reunion_en'))) return true;
    if (claseDe(p) === 'esperar') return p.espera?.modo === 'antes_reunion' ? true : false;
    return miraLaReunion(pasos, pa.id, vistos);
  });
}

test('lo que arranca en una etapa de reunión vuelve a mirar, después de cada espera, que la reunión siga por delante', () => {
  // `preparaUnaReunion` (el «la reunión ya pasó» del motor) decide por el trigger de antes, y una
  // plantilla arranca por una ETAPA: la guarda va en el flujo.
  // Las que PREPARAN una reunión (las post-agenda de #212 y #213, unificadas, y la de #221). Escritas a mano
  // y no deducidas: deducirlas de la condición que se quiere fijar daría verde sobre la que la perdió.
  const PREPARAN = ['agendo-preparar', 'agendo-confirmar'];
  const conReunion = PREPARAN.map((id) => plantillaPorId(id)!);
  assert.ok(conReunion.every(Boolean));
  for (const p of conReunion) {
    const resp = p.pasos.find((x) => claseDe(x) === 'respuesta')!;
    const deRespuesta = descendientes(p.pasos, resp.id!);
    for (const x of p.pasos) {
      const c = claseDe(x);
      if ((c !== 'mensaje' && c !== 'accion') || deRespuesta.has(x.id!)) continue;
      assert.ok(miraLaReunion(p.pasos, x.id!), `${p.id}/${x.id}: sale después de una espera sin mirar si la reunión sigue por delante`);
    }
  }
});

// ── El AI Step (novena tanda) ────────────────────────────────────────────────────

test('lo que contesta va en un AI Step: ningún «Si responde» de los de siempre, y de ninguno cuelga una tarjeta', () => {
  for (const p of PLANTILLAS) {
    const pasos = normalizar(pasosDePlantilla(p));
    for (const x of pasos) {
      if (claseDe(x) !== 'respuesta') continue;
      const donde = `${p.id}/${x.id}`;
      assert.ok(esPasoIA(x), `${donde}: un «Si responde» con tarjetas hijas (va un AI Step)`);
      assert.equal(x.si_no ?? null, null, `${donde}: «Otra cosa» lleva a una tarjeta`);
      for (const c of x.casos ?? []) assert.equal(c.siguiente ?? null, null, `${donde}/${c.id}: el caso lleva a una tarjeta`);
      assert.deepEqual([...descendientes(pasos, x.id!)], [], `${donde}: tiene tarjetas debajo`);
    }
  }
});

test('cada AI Step se puede publicar caso por caso y SOBREVIVE al guardado (la quinta puerta)', () => {
  let vistos = 0;
  for (const p of PLANTILLAS) {
    for (const x of normalizar(pasosDePlantilla(p)).filter((y) => esPasoIA(y))) {
      vistos++;
      const donde = `${p.id}/${x.id}`;
      // Sin casos se publicaría «configurado» y sólo avisaría (`nodoNuevo` nace con uno por eso).
      assert.ok(x.casos?.length, `${donde}: un AI Step sin casos`);
      // Lo que marca la tarjeta y frena Publicar es UNA función: nombre, «cuándo», y que conteste o avise.
      for (const c of x.casos!) assert.equal(faltaEnCaso(c), null, `${donde}/${c.id}: le falta algo`);
      // `setSecuenciaPasos` reconstruye cada paso con `camposDelFlujo`: lo que no conserve se BORRA en el
      // primer guardado, sin error. La plantilla nace por esa puerta (lib/plantilla-crear.ts).
      const guardado = camposDelFlujo(x);
      assert.equal(guardado.paso_ia, true, `${donde}: el guardado lo vuelve un «Si responde» de los de siempre`);
      assert.deepEqual(guardado.casos, x.casos, `${donde}: el guardado le cambia los casos`);
      assert.equal(guardado.si_no, null, `${donde}`);
    }
  }
  assert.ok(vistos > 0, 'ninguna plantilla tiene un AI Step');
});

/**
 * LO QUE HACE CADA CASO, escrito a mano desde las tarjetas que tenía cada plantilla ANTES del AI Step
 * (10/10/2026): «sola» = su «MaKo contesta» llevaba `revisar: false`; «revisar» = `revisar: true`; «no
 * contesta» = no había «MaKo contesta», sólo la tarjeta MaKo; avisa = había una tarjeta MaKo. A mano y no
 * deducido del catálogo: deducido, daría verde sobre el caso que perdió su decisión. Una plantilla que no está
 * acá no tiene AI Step; una nueva con AI Step falla hasta que alguien escriba sus decisiones.
 */
type Sale = 'sola' | 'revisar' | 'no contesta';
const DECISIONES: Readonly<Record<string, ReadonlyArray<readonly [titulo: string, sale: Sale, avisa: boolean]>>> = {
  'bienvenida-sin-agenda': [['Quiere agendar', 'sola', true], ['Pregunta el precio', 'revisar', false], ['No le interesa', 'revisar', false]],
  'agendo-preparar': [
    ['Confirma', 'sola', false], ['Pregunta el precio', 'revisar', false], ['Pregunta por la reunión', 'revisar', false], ['Quiere cambiar el día', 'sola', true],
  ],
  'agendo-confirmar': [
    ['Confirma', 'sola', false], ['Pregunta el precio', 'revisar', false], ['Pregunta por la reunión', 'revisar', false], ['Quiere cambiar el día', 'sola', true],
    ['Puede no calificar', 'no contesta', true],
  ],
  'no-asistio': [['Quiere reagendar', 'sola', true], ['No le interesa', 'revisar', false]],
  'reactivar-sin-cierre': [['Quiere retomarlo', 'revisar', true], ['Pregunta el precio', 'revisar', false], ['No le interesa', 'revisar', false]],
};

test('cada caso conserva su decisión de antes, medida sobre lo que CORRE (la expansión del motor y «Probar»)', () => {
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
      // La guarda de la plata: un caso que habla del precio nunca sale solo (además de `puedeContestarSolo`).
      if (/precio|cuesta|pago|descuento/i.test(`${c.titulo} ${c.cuando}`)) assert.notEqual(sale, 'sola', `${donde}: habla de plata y sale sola`);
    }
    assert.deepEqual(corre, (DECISIONES[p.id] ?? []).map((d) => [...d]), `${p.id}: lo que hace cada caso`);
    // «Otra cosa» sigue avisando, con el texto de las de origen (`AVISO_OTRA_COSA`).
    if (resp) {
      const otra = nodoPorId(exp, resp.si_no);
      assert.equal(otra && claseDe(otra), 'accion', `${p.id}: «Otra cosa» no avisa`);
      assert.equal(otra!.accion!.operacion, OP_AVISAR);
      assert.deepEqual(otra!.accion!.params, { leadId: LEAD_DEL_EVENTO, mensaje: AVISO_OTRA_COSA }, `${p.id}: el aviso de «Otra cosa»`);
    }
  }
});

test('las dos post-agenda son UNA: «Ya le escribiste» elige el primer mensaje y las dos ramas llegan a la MISMA espera', () => {
  // Los ids de antes ya no existen (nadie los creó: 0 filas con clave `plantilla-%` al 10/10/2026).
  assert.equal(plantillaPorId('agendo-con-bienvenida'), null);
  assert.equal(plantillaPorId('agendo-sin-hablar'), null);
  const p = plantillaPorId('agendo-preparar');
  assert.ok(p, 'falta la post-agenda unificada');
  assert.notEqual(p.nombre, plantillaPorId('agendo-confirmar')!.nombre);
  const pasos = normalizar(pasosDePlantilla(p));
  const conds = pasos.filter((x) => claseDe(x) === 'condicion' && (x.ramas ?? []).some((r) => r.filas.some((f) => f.campo === 'ya_contactado')));
  assert.equal(conds.length, 1, 'no hay UNA condición «Ya le escribiste»');
  const [c] = conds;
  // Una rama que decide SÓLO eso, sin negar: «Si se cumple» = ya le escribiste; «Si no» = nunca.
  assert.equal(c.ramas!.length, 1);
  assert.deepEqual(c.ramas![0].filas, [{ campo: 'ya_contactado' }], 'la rama mira otra cosa o está negada');
  const ya = nodoPorId(pasos, c.ramas![0].siguiente);
  const nuevo = nodoPorId(pasos, c.si_no);
  assert.ok(ya && nuevo, 'una de las ramas no lleva a nada');
  for (const m of [ya, nuevo]) assert.ok(claseDe(m) === 'mensaje' && m.canal === 'whatsapp', `${m.id}: no es un WhatsApp`);
  // Las aperturas de #212 y #213: a quien ya le escribiste no se le dice «te escribo por…».
  assert.doesNotMatch(ya.cuerpo ?? '', /te escribo por/i, 'a quien ya le escribiste se le presenta');
  assert.match(nuevo.cuerpo ?? '', /te escribo por/i, 'a quien nunca le escribiste no se le presenta');
  // Las dos ramas se juntan en la MISMA espera, que tiene a las dos de padres (sexta tanda: varios padres).
  assert.ok(ya.siguiente && ya.siguiente === nuevo.siguiente, 'las dos ramas no llegan a la misma tarjeta');
  const junta = nodoPorId(pasos, ya.siguiente)!;
  assert.equal(claseDe(junta), 'esperar');
  assert.deepEqual(padresDe(pasos, junta.id!).map((x) => x.id).sort(), [ya.id, nuevo.id].sort());
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
          assert.ok(!(def as { valor: { ref?: unknown } }).valor.ref, `${donde} necesita elegir un curso`);
        }
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

test('los datos del «{ }» son de los que se le mandan a un LEAD y el motor resuelve', () => {
  for (const p of PLANTILLAS) {
    for (const t of textos(p.pasos)) {
      for (const m of t.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)) {
        // El recordatorio NO lo manda el motor: sus datos son los que resuelve su emisor (`VARIABLES`), y uno
        // del motor saldría crudo (Publicar lo rechaza: `problemaDelTexto`).
        if (p.cron.fijo === TRIGGER_RECORDATORIO) {
          assert.ok((VARIABLES as readonly string[]).includes(m[1]), `${p.id}: «{{${m[1]}}}» no lo resuelve el emisor del recordatorio`);
          continue;
        }
        // Un evento de MaKo le escribe al EQUIPO (su grupo) y resuelve lo que ESE evento trae (`datosDelEvento`): el
        // lead, la cuota de la cobranza, «Lo que arma MaKo». Los ocultos se resuelven igual (`lead_nombre`).
        if (p.cron.fijo === TRIGGER_AVISO_MAKO) {
          const v = datoDe(m[1]);
          const ctx = datosDelEvento(p.cron.evento);
          assert.ok(v, `${p.id}: «{{${m[1]}}}» no está en el catálogo del «{ }»`);
          assert.ok(valePara(v!, 'equipo'), `${p.id}: «{{${m[1]}}}» no se le manda al equipo`);
          const trae = v!.alcance === 'siempre' || (v!.alcance === 'lead' ? ctx.conLead : v!.alcance === 'cuota' ? ctx.conCuota === true : ctx.conMensaje === true);
          assert.ok(trae, `${p.id}: «{{${m[1]}}}» (${v!.alcance}) no lo trae el evento «${p.cron.evento}»: saldría crudo`);
          continue;
        }
        const v = datoDe(m[1]);
        assert.ok(v, `${p.id}: «{{${m[1]}}}» no está en el catálogo del «{ }»`);
        assert.ok(valePara(v!, 'lead') && !v!.oculta, `${p.id}: «{{${m[1]}}}» no se ofrece para un lead`);
      }
      assert.doesNotMatch(t, /\{(?!\{)[a-z_]+\}(?!\})/i, `${p.id}: una variable con una llave «${t.slice(0, 60)}»`);
    }
  }
});

test('el texto que le llega al lead (y al equipo) va con tuteo neutro, sin voseo', () => {
  for (const p of PLANTILLAS) {
    for (const t of textos(p)) assert.deepEqual(marcasDeVoseo(t), [], `${p.id}: voseo en «${t.slice(0, 80)}»`);
  }
});

test('pasosDePlantilla da una COPIA con el orden de lectura: crear no toca el catálogo', () => {
  // Una que ARRANCA con una condición, para poder tocarle las filas (la primera de la galería es el recordatorio).
  const p = plantillaPorId('bienvenida-sin-agenda')!;
  assert.ok(p.pasos[0].ramas?.length, 'la de la prueba ya no arranca con una condición');
  const a = pasosDePlantilla(p);
  assert.deepEqual(a.map((x) => x.orden), a.map((_, i) => i + 1));
  a[0].cuerpo = 'cambiado';
  (a[0].ramas ?? [])[0]?.filas.push({ campo: 'pago' });
  assert.notEqual(p.pasos[0].cuerpo, 'cambiado');
  assert.equal(pasosDePlantilla(p)[0].ramas?.[0]?.filas.length, p.pasos[0].ramas?.[0]?.filas.length);
});

test('nombreLibre: el de la plantilla, y con un número si ya hay una con ese nombre', () => {
  assert.equal(nombreLibre('No asistió: reagendar', []), 'No asistió: reagendar');
  assert.equal(nombreLibre('No asistió: reagendar', ['no asistió:  reagendar']), 'No asistió: reagendar 2');
  assert.equal(nombreLibre('No asistió: reagendar', ['No asistió: reagendar', 'No asistió: reagendar 2']), 'No asistió: reagendar 3');
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
  // Con varios productos, un paso por producto; el que no tiene ese kanban no está.
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
  // Otro kanban, una etiqueta, basura: no.
  assert.equal(disparadorDeEleccion('etapa_venta', 'entrega:9:clase1'), null);
  assert.equal(disparadorDeEleccion('etapa_entrega', 'venta:5:agendado'), null);
  assert.equal(disparadorDeEleccion('etapa_venta', 'etiqueta:3'), null);
  assert.equal(disparadorDeEleccion('etapa_venta', 'venta:5:'), null);
  assert.equal(disparadorDeEleccion('etapa_venta', 42), null);
});

// ── 3. Crear ─────────────────────────────────────────────────────────────────────

type Llamada = { op: string; args: unknown[] };
function baseDeMentira(o: { vivas?: string[]; errIns?: string; triggers?: Record<string, string> } = {}) {
  const llamadas: Llamada[] = [];
  const db: DbPlantilla = {
    from: () => ({
      select: (cols) => ({
        is: async (c, v) => {
          llamadas.push({ op: 'select', args: [cols, c, v] });
          return { data: (o.vivas ?? []).map((nombre) => ({ nombre, trigger_tipo: o.triggers?.[nombre] ?? 'etapa_actual' })), error: null };
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
  const r = await crearDesdePlantilla('agendo-confirmar', {
    db, clave: () => 'plantilla-x',
    setPasos: async (id, ps) => { pasos.push([id, ps]); },
    setDisparadores: async (id, l) => { crones.push([id, l]); },
  });
  assert.deepEqual(r, { id: 700, nombre: 'Agendó: confirmar y preparar', pide: 'etapa_venta', aviso: null });
  assert.deepEqual(ops(llamadas), ['select', 'insert']);
  assert.deepEqual(llamadas[1].args[0], {
    clave: 'plantilla-x', nombre: 'Agendó: confirmar y preparar', etapa: 'manual', trigger_tipo: 'manual', activa: false, pasos: [], emoji: '📅',
  });
  assert.equal(pasos.length, 1);
  assert.equal(pasos[0][0], 700);
  assert.deepEqual(pasos[0][1], pasosDePlantilla(plantillaPorId('agendo-confirmar')!));
  assert.equal(crones.length, 0, 'sin etapa elegida no se escribe ningún CRON');
});

test('crear con la etapa elegida: el CRON va por guardarDisparadores y ya no pide nada', async () => {
  const { db } = baseDeMentira();
  const crones: Array<[number, unknown]> = [];
  const r = await crearDesdePlantilla('no-asistio', {
    db, setPasos: async () => {}, setDisparadores: async (id, l) => { crones.push([id, l]); },
  }, { disparador: 'venta:5:noshow' });
  assert.equal(r.pide, null);
  assert.deepEqual(crones, [[700, [{ id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'noshow', etapas: null, funnel_id: 5 }]]]);
});

test('crear: una plantilla que no existe o una etapa de otro kanban no crean NADA', async () => {
  for (const [id, disparador] of [['no-existe', null], ['felicitacion-clase', 'venta:5:agendado'], ['no-asistio', 'etiqueta:2']] as const) {
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
    crearDesdePlantilla('bienvenida-sin-agenda', {
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
  const r = await crearDesdePlantilla('agendo-preparar', a.deps, { disparador: 'venta:5:x' });
  assert.equal(r.pide, 'etapa_venta');
  assert.match(r.aviso ?? '', /no es una etapa de Mentoría/);
  assert.deepEqual(ops(a.b.llamadas), ['select', 'insert']);

  const b = deps(new Error('se cayó la base'));
  await assert.rejects(crearDesdePlantilla('agendo-preparar', b.deps, { disparador: 'venta:5:x' }), /se cayó la base/);
  assert.deepEqual(ops(b.b.llamadas), ['select', 'insert', 'delete']);
});

test('crear: si ya hay una automatización con ese nombre, nace con un número', async () => {
  const { db, llamadas } = baseDeMentira({ vivas: ['No asistió: reagendar', 'Otra'] });
  const r = await crearDesdePlantilla('no-asistio', { db, setPasos: async () => {}, setDisparadores: async () => {} });
  assert.equal(r.nombre, 'No asistió: reagendar 2');
  assert.equal((llamadas[1].args[0] as { nombre: string }).nombre, 'No asistió: reagendar 2');
  assert.deepEqual(llamadas[0].args, ['nombre, trigger_tipo', 'archivada_at', null], 'los nombres se miran sólo entre las vigentes');
});

test('crear el recordatorio: nace APAGADO con SU CRON en la fila (antes de los pasos) y sin tocar la lista de CRON', async () => {
  const { db, llamadas } = baseDeMentira({ vivas: ['Bienvenida'] });
  const pasos: unknown[] = [];
  const crones: unknown[] = [];
  const r = await crearDesdePlantilla(RECORDATORIO, {
    db, clave: () => 'plantilla-r',
    setPasos: async (_, ps) => { pasos.push(ps); },
    setDisparadores: async (_, l) => { crones.push(l); },
  });
  assert.deepEqual(r, { id: 700, nombre: 'Recordatorio de la reunión', pide: null, aviso: null });
  // `setSecuenciaPasos` lee el trigger_tipo de la FILA para exigir la forma del recordatorio: tiene que estar al insertar.
  assert.deepEqual(llamadas[1].args[0], {
    clave: 'plantilla-r', nombre: 'Recordatorio de la reunión', etapa: 'manual', trigger_tipo: TRIGGER_RECORDATORIO, activa: false, pasos: [], emoji: '⏰',
  });
  assert.deepEqual(pasos, [pasosDePlantilla(plantillaPorId(RECORDATORIO)!)]);
  assert.equal(crones.length, 0, 'el CRON del recordatorio no va por la lista de CRON');
});

test('crear el recordatorio: si el negocio YA tiene uno (sin archivar), o si piden una etapa, no se crea NADA', async () => {
  const yaEsta = baseDeMentira({ vivas: ['Mi recordatorio'], triggers: { 'Mi recordatorio': TRIGGER_RECORDATORIO } });
  await assert.rejects(
    crearDesdePlantilla(RECORDATORIO, { db: yaEsta.db, setPasos: async () => {}, setDisparadores: async () => {} }),
    (e: unknown) => e instanceof PlantillaInvalidaError && /Ya la tienes/.test(e.message),
  );
  assert.deepEqual(ops(yaEsta.llamadas), ['select'], 'insertó un segundo recordatorio');

  const conEtapa = baseDeMentira();
  await assert.rejects(
    crearDesdePlantilla(RECORDATORIO, { db: conEtapa.db, setPasos: async () => {}, setDisparadores: async () => {} }, { disparador: 'venta:5:agendado' }),
    (e: unknown) => e instanceof PlantillaInvalidaError,
  );
  assert.deepEqual(ops(conEtapa.llamadas), []);

  // Con otro recordatorio ARCHIVADO (no viene en las vigentes) sí se crea: la lista no lo muestra.
  const otra = baseDeMentira({ vivas: ['Otra'] });
  const r = await crearDesdePlantilla(RECORDATORIO, { db: otra.db, setPasos: async () => {}, setDisparadores: async () => {} });
  assert.equal(r.id, 700);
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

const dibujar = (productos: ProductoParaDisparo[] = [], triggersVivos?: string[]) => renderToStaticMarkup(createElement(GaleriaPlantillas, {
  productos, triggersVivos, onCerrar: () => {}, onEmpezar: () => {}, onCreada: () => {},
}));

test('la galería dibuja las dos formas de empezar y TODAS las plantillas, con su emoji, nombre y línea', () => {
  const html = dibujar(UN_PRODUCTO);
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  assert.ok(html.includes(TITULO_GALERIA) && html.includes(ROTULO_PLANTILLAS));
  for (const e of EMPEZAR) assert.ok(html.includes(`data-empezar="${e.que}"`) && html.includes(esc(e.nombre)), e.nombre);
  for (const p of PLANTILLAS) {
    assert.ok(html.includes(`data-plantilla="${p.id}"`), p.id);
    for (const t of [p.emoji, p.nombre, p.linea]) assert.ok(html.includes(esc(t)), `${p.id}: falta «${t}»`);
  }
  assert.ok(!html.includes('data-galeria-paso="etapa"'), 'arranca preguntando la etapa');
});

test('la etapa se pregunta sólo si hay etapas de ese kanban para ofrecer', () => {
  const venta = plantillaPorId('agendo-confirmar')!;
  const entrega = plantillaPorId('felicitacion-clase')!;
  assert.equal(preguntaEtapa(venta, UN_PRODUCTO), true);
  assert.equal(preguntaEtapa(entrega, UN_PRODUCTO), true);
  assert.equal(preguntaEtapa(venta, []), false);
  assert.equal(preguntaEtapa(entrega, [{ ...UN_PRODUCTO[0], etapasEntrega: [] }]), false);
  // El recordatorio trae su CRON: no pregunta nada aunque haya etapas.
  assert.equal(preguntaEtapa(plantillaPorId(RECORDATORIO)!, UN_PRODUCTO), false);
});

test('el recordatorio que el negocio ya tiene se dibuja APAGADO y lo dice; los demás, no', () => {
  const rec = plantillaPorId(RECORDATORIO)!;
  assert.equal(yaLaTiene(rec, [TRIGGER_RECORDATORIO]), true);
  assert.equal(yaLaTiene(rec, ['etapa_actual']), false);
  // Una de etapa nunca se apaga: de ésas se pueden tener varias.
  assert.equal(yaLaTiene(plantillaPorId('no-asistio')!, ['etapa_actual', TRIGGER_RECORDATORIO]), false);

  const html = dibujar(UN_PRODUCTO, ['etapa_actual', TRIGGER_RECORDATORIO]);
  const tarjeta = (id: string) => html.match(new RegExp(`<button[^>]*data-plantilla="${id}"[^>]*>[\\s\\S]*?</button>`))?.[0] ?? '';
  assert.match(tarjeta(RECORDATORIO), /disabled=""/, 'el recordatorio que ya tiene se puede elegir');
  assert.ok(tarjeta(RECORDATORIO).includes(YA_LA_TIENES), 'no dice que ya la tiene');
  assert.ok(!tarjeta('no-asistio').includes('disabled'), 'apagó una plantilla de etapa');
  assert.ok(!dibujar(UN_PRODUCTO, ['etapa_actual']).match(new RegExp(`data-plantilla="${RECORDATORIO}"[^>]*disabled`)), 'apagado sin tenerlo');
});

// ROTURAS, medidas el 10/10/2026 contra la base en verde (0 fallos, 23 pases), cada una aplicada y
// restaurada DE MEMORIA por un arnés (nunca con `git checkout`), y el archivo vuelto a 0 fallos al final:
//
//   R1  un mensaje con `delay_horas: 2`                         → 1 fallo  (modelo de la sexta tanda)
//   R2  una condición que sigue en una tarjeta que no existe    → 1 fallo  (se puede publicar)
//   R3  una tarjeta suelta (se le saca la flecha que le llega)  → 1 fallo  (se puede publicar)
//   R4  la tarjeta MaKo sin mensaje                             → 2 fallos (publicar + lo obligatorio de la acción)
//   R5  el link del video de confirmación de un cliente         → 1 fallo  (datos de un cliente)
//   R6  «soy Mauricio» en el mensaje de reactivación            → 1 fallo  (datos de un cliente)
//   R7  `{{link_crm}}` (sólo para el equipo) en un mensaje      → 1 fallo  (el «{ }» de un lead)
//   R8  «¿Querés…?»                                             → 1 fallo  (voseo)
//   R9  una condición «Tiene la etiqueta» con un id del negocio → 1 fallo  (condiciones sin datos del negocio)
//   R10 un «Ir a» a otra automatización (validarGrafo lo acepta) → 1 fallo (modelo de la sexta tanda)
//   R11 un email sin `revisar`                                  → 1 fallo  (modelo: «Sale sola» explícito)
//   R12 la condición retirada «R1 agendada a futuro»            → 2 fallos (condiciones retiradas + la reunión por delante)
//   R13 `pasosDePlantilla` devuelve el catálogo mismo           → 1 fallo  (la copia)
//   R14 `nombreLibre` devuelve siempre el de la plantilla       → 2 fallos (nombreLibre + crear con un nombre usado)
//   R15 las etapas sin filtrar por kanban                       → 2 fallos (las etapas + cuándo se pregunta)
//   R16 lo elegido sin mirar el kanban                          → 2 fallos (lo elegido + crear con otro kanban)
//   R17 la fila nace con `activa: true`                         → 1 fallo  (nace apagada)
//   R18 los pasos que fallan no borran la a medias              → 1 fallo  (se borra)
//   R19 cualquier error del CRON pasa a aviso                   → 1 fallo  (la etapa que no está / la base)
//   R20 una etapa de otro kanban no frena antes de crear        → 1 fallo  (no crean NADA)
//   R21 la ruta pasa un `setPasos` de mentira                   → 1 fallo  (la ruta)
//   R22 la ruta toma cualquier error como motivo del CRON       → 1 fallo  (la ruta)
//   R23 la galería deja una plantilla afuera                    → 1 fallo  (la galería)
//   R24 la galería no ofrece «Con MaKo»                         → 1 fallo  (la galería)
//   R25 la etapa se pregunta aunque no haya ninguna             → 1 fallo  (cuándo se pregunta)
//   R26 la post-agenda manda el «¿me confirmas?» sin volver a mirar la reunión → 1 fallo (la reunión por delante)
//   R27 la confirmación mira la reunión ANTES de la primera espera            → 1 fallo (la reunión por delante)
//
// Y las del RECORDATORIO como plantilla (10/10/2026 a la noche, base en verde: 0 fallos, 27 pases; mismo arnés):
//
//   R28 la fila del recordatorio nace con trigger «manual»       → 1 fallo  (crear el recordatorio)
//   R29 crear no mira si el negocio ya tiene un recordatorio     → 1 fallo  (ya tiene uno)
//   R30 la galería nunca apaga la que ya tiene                   → 1 fallo  (la galería)
//   R31 el toque de 1 h con `{{lead_nombre}}` (un dato del motor) → 3 fallos (Publicar, la de fábrica, el «{ }»)
//   R32 el recordatorio sin el toque de 1 h                      → 1 fallo  (la de fábrica)
//   R33 el CRON fijo se guarda por la lista de CRON              → 2 fallos (crear el recordatorio + pedir una etapa)
//   R34 la galería pregunta la etapa del recordatorio            → 1 fallo  (cuándo se pregunta)
//
// ⚠️ Desde la novena tanda R26 y R27 rompían la función `postAgenda`, que ya no existe: las dos post-agenda
// son UNA (`agendo-preparar`), y lo que esas dos roturas fijaban lo sigue fijando el mismo test sobre ella (R44).
//
// Y las del AI STEP y la post-agenda UNIFICADA (10/10/2026 a la noche, base en verde: 0 fallos, 31 pases;
// arnés `galeria-roturas.mjs` del scratchpad, que restaura de memoria y comprobó el archivo byte a byte igual):
//
//   R35 el AI Step sin la marca `paso_ia`                        → 3 fallos (va en un AI Step, se publica y
//                                                                   sobrevive al guardado, la decisión de cada caso)
//   R36 «Otra cosa» de «Agendó: confirmar» lleva a una tarjeta   → 3 fallos (se puede publicar, va en un AI Step,
//                                                                   sobrevive al guardado)
//   R37 el precio sale solo en la unificada                      → 1 fallo  (la decisión de cada caso)
//   R38 «Quiere cambiar el día» deja de avisar                   → 1 fallo  (la decisión de cada caso)
//   R39 «Puede no calificar» pasa a contestar                    → 1 fallo  (la decisión de cada caso)
//   R40 la guía de cada caso con un espacio al final             → 1 fallo  (sobrevive al guardado: el saneo recorta)
//   R41 la condición de la unificada negada                      → 1 fallo  (las dos post-agenda son UNA)
//   R42 las aperturas de la unificada cruzadas                   → 1 fallo  (las dos post-agenda son UNA)
//   R43 una rama de la unificada saltea la espera común          → 1 fallo  (las dos post-agenda son UNA)
//   R44 la unificada no mira la reunión antes de la apertura     → 1 fallo  (la reunión por delante)
//   R45 vuelve el id viejo `agendo-sin-hablar`                   → 4 fallos (la reunión por delante, la decisión de
//                                                                   cada caso, las dos son UNA, crear con un aviso)
//   R46 un caso del AI Step sin «cuándo»                         → 2 fallos (se puede publicar + caso por caso)
//   R47 «Otra cosa» con otro aviso que el de las de origen       → 1 fallo  (la decisión de cada caso)
//
// ⚠️ Lo que R35 midió de paso: con la marca quitada, «se puede publicar» siguió en VERDE. Un «Si responde» de los
// de siempre con casos que no llevan a ninguna tarjeta PASA `validarGrafo` (sólo el AI Step mira `faltaEnCaso`):
// por eso este archivo pregunta por el AI Step en su propio test y no confía en el de Publicar.
// La parte del test de decisiones que mira que el aviso EXPANDIDO esté completo (`faltanEnAccion`) no se puede
// romper desde la galería: lo arma `expandirPasoIA`, y su rotura vive en tests/automations-paso-ia.test.ts.

