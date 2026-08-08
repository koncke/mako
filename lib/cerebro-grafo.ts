// =============================================================================
// cerebro-grafo — el grafo del NEGOCIO del cliente (lo que MaKo entendió)
// =============================================================================
// ⚠️ NO confundir con /api/admin/graph: ése es el grafo del CÓDIGO FUENTE de MaKo
// (graphify, 4,1 MB, 4.440 nodos que son archivos .ts, gateado a super-admin). Es
// una herramienta de desarrollo y jamás se le muestra a un cliente: enseñarle la
// ingeniería interna en el momento en que esperaba ver su negocio es el opuesto
// exacto del efecto buscado. Ver docs/hallazgos-onboarding.md.
//
// Acá se arma el otro: un nodo por cada COSA QUE MAKO ENTENDIÓ del negocio, con
// de dónde la sacó. La regla que gobierna todo el módulo:
//
//   UN NODO ES UNA COSA QUE ALGUIEN PUEDE SEÑALAR Y DECIR «ESO ES MÍO».
//
// De ahí salen las tres decisiones que más importan, y las tres son de RESTA:
//  · Un atributo NO es un nodo. El copy de una razón, los 10 rasgos de voz y los
//    9 guiones son campos de otra cosa: van al hover, no al lienzo. Convertir
//    cada atributo en nodo triplica el conteo y divide el significado.
//  · El catálogo de MaKo NO es del cliente. Los 14 formatos de la biblioteca son
//    iguales para todos: solo entran los que ESTE negocio usa.
//  · Una razón y una celda de la matriz son la MISMA fila (RazonCelda). Pintarlas
//    como dos tipos de nodo son 9 nodos inventados.
//
// Y una exclusión que es una deuda, no un criterio: las 17 etapas del funnel
// quedan afuera hasta que se arregle app/api/onboarding/route.ts:252, que aplica
// FUNNEL_TEMPLATES[0] hardcodeada sin mirar el canal que el cliente declaró.
// Mostrarle dos etapas de «Reunión» a alguien que eligió «carrito», en la única
// pantalla cuyo argumento entero es «esto es tuyo», es peor que no mostrar nada.
//
// El aislamiento por workspace NO se resuelve acá: todos los getters que se usan
// pasan por getSetting/getTenantDb, que scopean con wsActual(). Este módulo no
// toca Supabase directo a propósito — si algún día lo hiciera, tendría que
// filtrar por workspace_id a mano, que es justo el error que la casa persigue.
// =============================================================================

import 'server-only';
import { getSchema } from './onboarding';
import { getDiagnosticoFase } from './fase-store';
import { listFiles, getManual, getPanorama, computeEffective } from './archivero';
import { listProductos } from './productos';
import { getEntregables } from './entregable';
import { getAvatares } from './avatares';
import { getRazones } from './razones';
import { getPersona } from './persona';
import { getPersonalidad } from './personalidad-store';
import { getRecomendaciones } from './angulos-formatos';
import { FASES, CANALES } from './fase-diagnostico';
import { PERSONALIDAD_PREGUNTAS } from './personalidad';
import { BIBLIOTECA_ANGULOS } from './angulos-data';
import { layoutCerebro } from './cerebro-layout';

// ── El modelo ────────────────────────────────────────────────────────────────
// Vive en `cerebro-modelo.ts`, SIN `server-only`, porque el componente que dibuja
// el grafo corre en el browser y necesita los tipos y las áreas. Si se trae acá,
// el bundle del cliente se lleva puesta la cadena productos → workspace → auth →
// next/headers y la compilación se cae. Ver la cabecera de ese archivo.
export { AREAS } from './cerebro-modelo';
export type { AreaId, Autoria, NodoCerebro, AristaCerebro, Cerebro } from './cerebro-modelo';

import { AREAS, type AreaId, type Autoria, type NodoCerebro, type AristaCerebro, type Cerebro } from './cerebro-modelo';

// ── Helpers ──────────────────────────────────────────────────────────────────

const limpio = (s: unknown): string => (typeof s === 'string' ? s.trim() : '');

/** Recorta para la etiqueta sin cortar una palabra por la mitad. */
function corto(s: string, max = 34): string {
  const t = limpio(s).replace(/\s+/g, ' ');
  if (t.length <= max) return t;
  const cortado = t.slice(0, max);
  const esp = cortado.lastIndexOf(' ');
  return `${(esp > max * 0.6 ? cortado.slice(0, esp) : cortado).trimEnd()}…`;
}

/**
 * Parte el panorama en sus seis secciones. El generador GARANTIZA que las seis
 * están (panoramaCompleto() rechaza la salida y prueba el próximo proveedor si
 * falta alguna), así que acá no hace falta tolerar formatos raros — pero sí que
 * una sección vacía no produzca un nodo mudo.
 */
function seccionesPanorama(texto: string): Array<{ titulo: string; cuerpo: string }> {
  const t = limpio(texto);
  if (!t) return [];
  const titulos = ['IDENTIDAD Y POSICIONAMIENTO', 'OFERTA Y PRECIOS', 'AVATAR Y CLIENTE IDEAL', 'NICHO Y MERCADO', 'TONO Y VOZ DE MARCA', 'OTROS DATOS RELEVANTES'];
  const arriba = t.toUpperCase();
  const marcas = titulos
    .map((titulo) => ({ titulo, i: arriba.indexOf(titulo) }))
    .filter((m) => m.i >= 0)
    .sort((a, b) => a.i - b.i);
  return marcas
    .map((m, k) => {
      const desde = m.i + m.titulo.length;
      const hasta = k + 1 < marcas.length ? marcas[k + 1].i : t.length;
      // Se come el resto del renglón del título (los ':' y '**' que pone el modelo).
      const cuerpo = t.slice(desde, hasta).replace(/^[\s:*#·—-]+/, '').trim();
      return { titulo: m.titulo, cuerpo };
    })
    .filter((s) => s.cuerpo.length > 0);
}

/** Título en versalitas humanas: «OFERTA Y PRECIOS» → «Oferta y precios». */
const capitalizar = (s: string): string => s.charAt(0) + s.slice(1).toLowerCase();

// Los campos del brief, repartidos en las dos áreas que les corresponden. Las
// claves salen de DEFAULT_SCHEMA (lib/onboarding.ts); el label se lee del esquema
// vivo para que renombrar un campo allá no deje el grafo hablando en viejo.
const CAMPOS_OFERTA = ['oferta_nombre', 'oferta_ticket', 'oferta_promesa', 'oferta_incluye', 'oferta_garantia'];
const CAMPOS_CLIENTE = ['avatar_quien', 'avatar_dolor', 'avatar_deseo', 'avatar_objecion', 'avatar_nicho'];

/**
 * El nombre del nodo NO es el label del esquema. Los labels de `DEFAULT_SCHEMA`
 * son PREGUNTAS de formulario —«¿Tenés garantía? ¿Cuál?»— y un nodo de un mapa no
 * pregunta nada: nombra una cosa. Reusarlos llenaba el lienzo de signos de
 * interrogación y, de paso, metía voseo en una UI que va en español neutro.
 * Si aparece un campo nuevo sin entrada acá, el fallback recorta la pregunta a
 * algo legible en vez de dibujarla entera.
 */
const NOMBRE_CAMPO: Record<string, string> = {
  oferta_nombre: 'Oferta',
  oferta_ticket: 'Precio',
  oferta_promesa: 'Promesa',
  oferta_incluye: 'Qué incluye',
  oferta_garantia: 'Garantía',
  avatar_quien: 'Cliente ideal',
  avatar_dolor: 'Su dolor',
  avatar_deseo: 'Lo que quiere',
  avatar_objecion: 'Su objeción',
  avatar_nicho: 'Nicho',
};

/** Último recurso para un campo sin nombre propio: la pregunta sin signos, sin
 *  paréntesis aclaratorios y recortada. Feo a propósito — se ve que falta. */
const desdePregunta = (label: string): string =>
  corto(label.replace(/\([^)]*\)/g, '').replace(/[¿?¡!]/g, '').trim(), 22);

// ── El constructor ───────────────────────────────────────────────────────────

/**
 * Arma el grafo completo del negocio del workspace actual. Todo en paralelo: son
 * once lecturas independientes y ninguna depende del resultado de otra.
 */
export async function construirCerebro(): Promise<Cerebro> {
  const [schema, diag, files, manual, panorama, productos, entregables, avatares, razones, persona, personalidad, recomendaciones] = await Promise.all([
    getSchema(),
    getDiagnosticoFase(),
    listFiles(),
    getManual(),
    getPanorama(),
    listProductos(),
    getEntregables(),
    getAvatares(),
    getRazones(),
    getPersona(),
    getPersonalidad(),
    getRecomendaciones(),
  ]);

  const { answers, fuente } = computeEffective(files, manual);
  const nodos: NodoCerebro[] = [];
  const aristas: AristaCerebro[] = [];
  const push = (n: NodoCerebro) => { nodos.push(n); return n.id; };
  const unir = (de: string, a: string, motivo: string) => { aristas.push({ de, a, motivo }); };

  // La etiqueta de un campo sale del esquema vivo, no de una copia.
  const labelDe = new Map<string, string>();
  for (const g of schema) for (const f of g.fields) labelDe.set(f.key, f.label);

  // ── Raíz ───────────────────────────────────────────────────────────────────
  const negocio = limpio(answers['negocio_que_hace']);
  const RAIZ = 'raiz';
  nodos.push({
    id: RAIZ,
    area: 'norte',
    etiqueta: negocio ? corto(negocio, 40) : 'Tu negocio',
    detalle: negocio || 'Todavía no sé a qué se dedica tu negocio. Sale del Archivero, en cuanto sueltes un documento.',
    fuente: negocio ? fuenteDe(fuente['negocio_que_hace']) : '',
    autoria: negocio ? autoriaDe(fuente['negocio_que_hace']) : 'pendiente',
  });

  // ── Norte: fase, cuello y canal ────────────────────────────────────────────
  // `diag.fase` es un índice 0-4 sobre FASES. Si viniera fuera de rango NO se cae a
  // FASES[0]: eso pintaría «Fase 1 · Validación» con cara de dato cierto, que es
  // exactamente la trampa que ya mordió en el historial del board (ver la regla de
  // stageMetaOpt). Sin fase legible, el área queda con su hueco etiquetado.
  const f = diag ? FASES[diag.fase] : undefined;
  if (diag && f) {
    const idFase = push({
      id: 'fase',
      area: 'norte',
      etiqueta: `Fase ${f.id} · ${f.nombre}`,
      detalle: f.objetivo,
      fuente: 'de tus 6 respuestas del diagnóstico',
      autoria: 'mako',
      destacado: true,
    });
    unir(RAIZ, idFase, 'El Norte del negocio');

    const idCuello = push({
      id: 'cuello',
      area: 'norte',
      etiqueta: f.cuelloLabel,
      detalle: `Es donde se rompe la cadena hoy. Mientras esto no se mueva, mejorar el resto no cambia el resultado. El hito para pasar de fase: ${f.hito}`,
      fuente: 'se deriva de tu fase, no se pregunta suelto',
      autoria: 'mako',
      alerta: true,
    });
    unir(idFase, idCuello, 'La fase determina dónde está el cuello');

    const canal = CANALES.find((c) => c.id === diag.canal);
    if (canal) {
      const idCanal = push({
        id: 'canal',
        area: 'norte',
        etiqueta: canal.label,
        detalle: canal.desc,
        fuente: 'lo elegiste en el diagnóstico',
        autoria: 'usuario',
      });
      unir(idFase, idCanal, 'Cómo vende el negocio en esta fase');
    }
  }

  // ── Documentos del Archivero ───────────────────────────────────────────────
  // Es la mejor pieza del grafo: la única entidad con tabla propia, fecha real y
  // procedencia. El `razonamiento` ya viene escrito en español neutro y es
  // literalmente «qué entendí de este documento»: el hover no hay que inventarlo.
  for (const f of files) {
    const aporto = Object.keys(f.campos || {}).length;
    const id = push({
      id: `doc:${f.id}`,
      area: 'documentos',
      etiqueta: corto(f.nombre, 30),
      detalle: limpio(f.razonamiento) || 'Lo leí, pero no pude sacar campos concretos de acá.',
      fuente: aporto === 1 ? 'aportó 1 dato' : `aportó ${aporto} datos`,
      autoria: 'mako',
    });
    unir(RAIZ, id, 'Un documento que soltaste en el Archivero');
  }

  // ── Panorama ───────────────────────────────────────────────────────────────
  // Los seis planos se cuelgan de la raíz Y, cuando existe, del dato del que hablan
  // (ver PANORAMA_APUNTA_A). Esa segunda arista es LATERAL: cruza de un área a otra
  // y es parte de lo que convierte el grafo en una red en vez de un árbol.
  const panoramaIds: string[] = [];
  for (const s of seccionesPanorama(panorama)) {
    const id = push({
      id: `pan:${s.titulo}`,
      area: 'panorama',
      etiqueta: capitalizar(s.titulo),
      detalle: s.cuerpo,
      fuente: files.length === 1 ? 'de tu documento' : `de tus ${files.length} documentos`,
      autoria: 'mako',
    });
    panoramaIds.push(id);
    unir(RAIZ, id, 'Un plano del panorama que MaKo escribió');
  }

  // ── Oferta y Cliente (los campos del brief) ────────────────────────────────
  // La procedencia es REAL: computeEffective devuelve, campo por campo, si vino de
  // un documento (y de cuál) o si lo escribió el usuario encima. Eso es lo que
  // hace honesta la regla del borde, y no hay que inferir nada.
  const campoANodo = new Map<string, string>();
  for (const [area, claves] of [['oferta', CAMPOS_OFERTA], ['cliente', CAMPOS_CLIENTE]] as const) {
    for (const key of claves) {
      const valor = limpio(answers[key]);
      if (!valor) continue;
      const id = push({
        id: `campo:${key}`,
        area,
        etiqueta: NOMBRE_CAMPO[key] ?? desdePregunta(labelDe.get(key) ?? key),
        detalle: valor,
        fuente: fuenteDe(fuente[key]),
        autoria: autoriaDe(fuente[key]),
      });
      campoANodo.set(key, id);
      const src = fuente[key];
      if (src?.tipo === 'archivo' && src.id) unir(`doc:${src.id}`, id, `Este dato salió de ${src.nombre ?? 'ese documento'}`);
      else unir(RAIZ, id, 'Un dato del negocio');
    }
  }

  // ── Productos ──────────────────────────────────────────────────────────────
  const nodoOferta = campoANodo.get('oferta_nombre');
  for (const p of productos) {
    const precio = p.monto_usd == null ? 'sin precio cargado'
      : p.tipo === 'suscripcion'
        ? `USD ${p.monto_usd}/mes${p.suscripcion_meses ? ` · ${p.suscripcion_meses} meses` : ' · indefinida'}`
        : `USD ${p.monto_usd} · pago único`;
    const id = push({
      id: `prod:${p.id}`,
      area: 'productos',
      etiqueta: corto(p.nombre, 30),
      detalle: [precio, limpio(p.promesa), limpio(p.incluye) && `Incluye: ${limpio(p.incluye)}`, limpio(p.garantia) && `Garantía: ${limpio(p.garantia)}`].filter(Boolean).join(' · '),
      fuente: 'del catálogo que arma el CRM',
      autoria: 'mako',
    });
    unir(nodoOferta ?? RAIZ, id, nodoOferta ? 'MaKo lo dedujo de tu oferta' : 'Un producto del catálogo');
  }

  // ── Gancho (lead magnets) ──────────────────────────────────────────────────
  for (const e of entregables) {
    const id = push({
      id: `ent:${e.id}`,
      area: 'entregables',
      etiqueta: corto(e.nombre, 30),
      detalle: [limpio(e.queEs), limpio(e.fomo) && `Línea para el anuncio: «${limpio(e.fomo)}»`].filter(Boolean).join(' · '),
      fuente: e.tipo ? `tipo: ${e.tipo}` : '',
      autoria: 'mako',
    });
    unir(nodoOferta ?? RAIZ, id, 'El elemento tangible que hace entendible la oferta');
  }

  // ── Segmentos (avatares) ───────────────────────────────────────────────────
  const avatarANodo = new Map<string, string>();
  for (const a of avatares) {
    const id = push({
      id: `av:${a.id}`,
      area: 'avatares',
      etiqueta: corto(a.nombre, 28),
      detalle: [limpio(a.segmento), limpio(a.dolor) && `Le duele: ${limpio(a.dolor)}`, limpio(a.senalesMeta) && `En Meta: ${limpio(a.senalesMeta)}`].filter(Boolean).join(' · '),
      fuente: 'MaKo los propuso desde tu panorama',
      autoria: 'mako',
    });
    avatarANodo.set(a.id, id);
    unir(campoANodo.get('avatar_quien') ?? RAIZ, id, 'Un segmento que se puede targetear en Meta');
  }

  // ── Razones (= las celdas de la matriz; NO son dos entidades) ──────────────
  // La única relación del modelo con integridad referencial de verdad:
  // RazonCelda.avatarId apunta a un Avatar. Es la arista más honesta del grafo.
  const formatoNombre = new Map(BIBLIOTECA_ANGULOS.map((f) => [f.id, f.nombre]));
  const razonAFormatos: Array<{ razon: string; formato: string }> = [];
  for (const r of razones) {
    const usados = [r.anguloImagen, r.anguloVideo].filter(Boolean);
    const id = push({
      id: `raz:${r.id}`,
      area: 'razones',
      etiqueta: corto(r.nombre, 28),
      detalle: [limpio(r.descripcion), limpio(r.copy) && `Hook: «${limpio(r.copy)}»`, r.guiones?.length ? `${r.guiones.length} ${r.guiones.length === 1 ? 'guion escrito' : 'guiones escritos'}` : ''].filter(Boolean).join(' · '),
      fuente: 'una motivación de compra de ese segmento',
      autoria: 'mako',
    });
    const padre = avatarANodo.get(r.avatarId);
    if (padre) unir(padre, id, 'Este segmento compra por esta razón');
    else unir(RAIZ, id, 'Una razón de compra');
    for (const f of usados) razonAFormatos.push({ razon: id, formato: f });
  }

  // ── Voz y cara ─────────────────────────────────────────────────────────────
  // UN nodo para la voz, no diez. Los 10 rasgos son el hover: cada uno solo es un
  // dato de configuración, y diez puntos idénticos alrededor del mismo concepto
  // abaratan el mapa exactamente donde tiene que valer más.
  const rasgos = PERSONALIDAD_PREGUNTAS
    .map((q) => ({ dim: q.dimension, r: personalidad.respuestas[q.key] }))
    .filter((x) => limpio(x.r?.rasgo));
  if (rasgos.length) {
    const ejemplo = rasgos.map((x) => limpio(x.r?.texto)).find(Boolean);
    const id = push({
      id: 'voz',
      area: 'voz',
      etiqueta: 'Tu voz',
      detalle: [
        `${rasgos.length} de ${PERSONALIDAD_PREGUNTAS.length} rasgos definidos: ${rasgos.map((x) => `${x.dim} ${x.r!.rasgo}`).join(' · ')}`,
        limpio(personalidad.muletillas) && `Muletillas: ${limpio(personalidad.muletillas)}`,
        ejemplo && `Así suena: «${ejemplo}»`,
      ].filter(Boolean).join('\n'),
      fuente: 'del quiz de personalidad',
      autoria: 'usuario',
    });
    unir(RAIZ, id, 'Cómo suena tu marca en los guiones y el copy');
  }

  if (persona.fotos.length || limpio(persona.descripcion)) {
    const id = push({
      id: 'persona',
      area: 'voz',
      etiqueta: 'Tu cara de marca',
      detalle: limpio(persona.descripcion) || `${persona.fotos.length} ${persona.fotos.length === 1 ? 'foto cargada' : 'fotos cargadas'}. Todavía falta la descripción que usan los creativos.`,
      fuente: persona.fotos.length ? `${persona.fotos.length} ${persona.fotos.length === 1 ? 'foto' : 'fotos'}` : '',
      autoria: limpio(persona.descripcion) ? 'mako' : 'usuario',
    });
    unir(RAIZ, id, 'Quién aparece en los creativos');
  }

  // ── Formatos: solo los que ESTE negocio usa ────────────────────────────────
  // La biblioteca son 14 y es catálogo de MaKo, igual para todos. Entran los
  // RECOMENDADOS más los que alguna celda eligió de verdad, y como nodo del área de
  // razones porque es donde se usan.
  const porRec = new Map(recomendaciones.map((r) => [r.formatoId, r]));
  const usadosPorCelda = new Set(razonAFormatos.map((x) => x.formato));
  for (const formatoId of new Set([...porRec.keys(), ...usadosPorCelda])) {
    const nombre = formatoNombre.get(formatoId);
    if (!nombre) continue;
    const rec = porRec.get(formatoId);
    const id = push({
      id: `fmt:${formatoId}`,
      area: 'razones',
      etiqueta: corto(nombre, 26),
      detalle: rec
        ? [limpio(rec.para) && `Para: ${limpio(rec.para)}`, limpio(rec.porque)].filter(Boolean).join(' · ')
        : 'Lo elegiste para uno de tus anuncios.',
      fuente: rec ? 'MaKo lo eligió de la biblioteca para tu negocio' : 'en uso en tu matriz',
      autoria: 'mako',
    });
    unir(RAIZ, id, 'Un formato de creativo de este negocio');
  }

  // ── LAS ARISTAS LATERALES ──────────────────────────────────────────────────
  // Todo lo de arriba produce UNA arista entrante por nodo: eso es un ÁRBOL, y un
  // árbol con un hub grande no se dibuja como una red — se dibuja como un diente de
  // león. Estas son las relaciones que YA estaban en los datos y no se estaban
  // usando; ninguna es decorativa y cada una se puede explicar en una frase.
  const existe = new Set(nodos.map((n) => n.id));

  // 1. Una celda de la matriz USA un formato concreto. Es la arista que cruza de un
  //    segmento a otro (dos avatares distintos pueden elegir el mismo formato) y la
  //    que más hace por sacar al grafo de la forma de estrella.
  for (const { razon, formato } of razonAFormatos) {
    if (existe.has(`fmt:${formato}`)) unir(razon, `fmt:${formato}`, 'Este anuncio se hace con este formato');
  }

  // 2. Cada plano del panorama HABLA de un dato concreto. Cuando ese dato existe como
  //    nodo, se conectan: el plano deja de ser una hoja colgada de la raíz.
  const PANORAMA_APUNTA_A: Record<string, string[]> = {
    'OFERTA Y PRECIOS': ['campo:oferta_nombre', 'campo:oferta_ticket'],
    'AVATAR Y CLIENTE IDEAL': ['campo:avatar_quien', 'campo:avatar_dolor'],
    'NICHO Y MERCADO': ['campo:avatar_nicho'],
    'TONO Y VOZ DE MARCA': ['voz'],
  };
  for (const idPan of panoramaIds) {
    const titulo = idPan.slice('pan:'.length);
    for (const destino of PANORAMA_APUNTA_A[titulo] ?? []) {
      if (existe.has(destino)) unir(idPan, destino, 'Este plano del panorama habla de este dato');
    }
  }

  // ── Los huecos, etiquetados ────────────────────────────────────────────────
  // Un vacío REGISTRADO y con nombre vale más que un vacío disimulado: dice qué
  // falta y qué se desbloquea al llenarlo. Es la misma lógica del estado honesto
  // aplicada a un área entera, y convierte el mapa en una razón para volver.
  const conNodos = new Set(nodos.filter((n) => n.id !== RAIZ && n.autoria !== 'pendiente').map((n) => n.area));
  const vacias: AreaId[] = [];
  for (const a of AREAS) {
    if (conNodos.has(a.id)) continue;
    vacias.push(a.id);
    const id = push({
      id: `falta:${a.id}`,
      area: a.id,
      etiqueta: a.nombre,
      detalle: `Todavía no sé nada de esto. ${a.que}`,
      fuente: '',
      autoria: 'pendiente',
    });
    unir(RAIZ, id, 'Todavía sin construir');
  }

  const reales = nodos.filter((n) => n.autoria !== 'pendiente');
  const { posiciones, encuadre } = layoutCerebro(nodos, aristas);
  return {
    negocio: negocio || 'Tu negocio',
    nodos,
    aristas,
    posiciones,
    encuadre,
    cuenta: {
      total: reales.length,
      mako: reales.filter((n) => n.autoria === 'mako').length,
      usuario: reales.filter((n) => n.autoria === 'usuario').length,
      pendientes: nodos.length - reales.length,
    },
    vacias,
  };
}

// ── Procedencia ──────────────────────────────────────────────────────────────
// El dato sale tal cual de computeEffective, que ya distingue «vino de un archivo»
// de «lo escribió el usuario encima». No se infiere nada: si no hay fuente, se
// dice que no se sabe en vez de atribuírsela a MaKo.

function autoriaDe(f: { tipo: 'archivo' | 'manual' } | undefined): Autoria {
  if (f?.tipo === 'archivo') return 'mako';
  if (f?.tipo === 'manual') return 'usuario';
  return 'usuario';
}

function fuenteDe(f: { tipo: 'archivo' | 'manual'; nombre?: string } | undefined): string {
  if (f?.tipo === 'archivo') return `de ${f.nombre ?? 'un documento tuyo'}`;
  if (f?.tipo === 'manual') return 'lo escribiste tú';
  return '';
}
