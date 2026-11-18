// =============================================================================
// cerebro-armado — la parte PURA del grafo del negocio: de las lecturas a los nodos y las aristas (18/11/2026)
// =============================================================================
// Hasta el 18/11/2026 todo esto vivía adentro de `construirCerebro` (lib/cerebro-grafo.ts), que lleva `server-only`, y
// por eso NINGÚN test podía mirar la topología del grafo que de verdad se dibuja (F109). Ahora lib/cerebro-grafo.ts LEE
// (todas las lecturas, en paralelo) y le pasa todo a `armarCerebro`, que ARMA. Sin `server-only` y sin Supabase: lo
// prueba tests/cerebro-topologia.test.ts con las métricas de scripts/medir-grafo.mjs (hub, hojas, densidad, clustering y
// una sola componente).
//
// Las reglas que gobiernan el grafo están en la cabecera de lib/cerebro-grafo.ts y siguen mandando acá.
//
// Los tipos de las lecturas son MÍNIMOS y propios a propósito (el molde de lib/cerebro-vivo.ts): este módulo no puede
// importar los de lib/productos.ts o lib/razones.ts, que llevan `server-only`. Lo que entra es lo que el grafo USA de
// cada fila, nada más; el compilador comprueba en lib/cerebro-grafo.ts que las lecturas de verdad entran.
// =============================================================================

import { FASES, CANALES, type Diagnostico } from './fase-diagnostico';
import { PERSONALIDAD_PREGUNTAS, type Personalidad } from './personalidad';
import { BIBLIOTECA_ANGULOS, CELDA_GUIONES_PROPIOS, usosPorFormato } from './angulos-data';
import { puentesARaiz } from './cerebro-union';
import { BAND_LABEL, TRIGGER, salidasDeEtapa, type FunnelTransition, type Stage } from './pipeline';
import { kitPorDefecto, resumenDeKit, sanearKits } from './marca/kits';
import { computeEffective } from './archivero-registro';
import { agregarLoVivo, type LecturasVivas } from './cerebro-vivo';
import { AREAS, NIVEL1, type AreaId, type Autoria, type NodoCerebro, type AristaCerebro, type Cerebro } from './cerebro-modelo';

// ── Las lecturas, ya hechas ──────────────────────────────────────────────────
// Lo que el grafo usa de cada fila. Los nombres son los de las lecturas de lib/cerebro-grafo.ts.

/** El esquema del brief (lib/onboarding.ts → `getSchema`): sus grupos y sus campos. */
export type GrupoBrief = { key: string; label?: string; fields: Array<{ key: string; label: string }> };
export type ArchivoDelGrafo = { id: string; nombre: string; campos: Record<string, string>; razonamiento: string | null; mime?: string | null; created_at?: string | null };
export type ProductoDelGrafo = {
  id: number; nombre: string; tipo: string; monto_usd: number | null; suscripcion_meses: number | null;
  promesa: string | null; incluye: string | null; garantia: string | null; activo?: boolean;
};
export type EntregableDelGrafo = { id: string; nombre: string; queEs: string; fomo: string; tipo?: string; enlace?: string };
export type AvatarDelGrafo = { id: string; nombre: string; segmento: string; dolor: string; situacion?: string; senalesMeta: string };
export type RazonDelGrafo = {
  id: string; avatarId: string; nombre: string; descripcion: string; copy: string; guiones?: unknown[];
  anguloImagen: string; anguloVideo: string;
};
export type PersonaDelGrafo = { descripcion: string; fotos: unknown[] };
export type FunnelDelGrafo = { pipeline: Stage[]; stages: Stage[]; transitions: FunnelTransition[] };
export type SecuenciaDelGrafo = { clave: string; nombre: string; etapa: string; pasos: unknown };
export type LandingDelGrafo = { url: string; titulo: string | null; score: number | null; veredicto: string | null; resumen: string | null; promesa: string | null; avatar: string | null };
export type AudioDelGrafo = { id: number; titulo: string; duracion_s: number | null; created_at?: string | null };
export type GlosarioDelGrafo = { titulo: string; activo: boolean; area: string; categoria: string | null; created_at?: string | null };

export type LecturasCerebro = {
  /** El esquema VIVO del brief (`getSchema`): de ahí salen las claves de los campos. */
  schema: GrupoBrief[];
  /** El de fábrica (DEFAULT_SCHEMA): lo que el vivo no tenga se recorre igual (`camposDelBrief`). */
  schemaPorDefecto: GrupoBrief[];
  diag: Pick<Diagnostico, 'fase' | 'canal'> | null;
  files: ArchivoDelGrafo[];
  manual: Record<string, string>;
  panorama: string;
  productos: ProductoDelGrafo[];
  entregables: EntregableDelGrafo[];
  avatares: AvatarDelGrafo[];
  razones: RazonDelGrafo[];
  persona: PersonaDelGrafo;
  personalidad: Personalidad;
  funnel: FunnelDelGrafo;
  secuencias: SecuenciaDelGrafo[];
  landings: LandingDelGrafo[];
  audios: AudioDelGrafo[];
  vozManual: Record<string, string> | null;
  /** La evidencia de la voz comercial (lib/chat-agent-voz.ts → `VozEvidencia`): cuántas conversaciones con venta leyó MaKo. */
  vozEvidencia: { convsConVenta?: number } | null;
  glosario: GlosarioDelGrafo[];
  vivo: LecturasVivas;
  /** El setting crudo de los kits de marca (`KEY_KITS`, lib/marca/kits.ts): lo sanea `sanearKits`. */
  kitsCrudo: unknown;
};

/** El grafo armado, sin el dibujo: las posiciones y la huella las agrega lib/cerebro-grafo.ts. */
export type CerebroArmado = Omit<Cerebro, 'posiciones' | 'encuadre' | 'huella'>;

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
  // Se parte por ENCABEZADO, no buscando seis títulos literales. La versión anterior
  // hacía `indexOf` de los seis nombres exactos y, sobre el panorama YA GUARDADO del
  // workspace del dueño —que una versión anterior escribió con otro molde
  // («# DESCRIPCIÓN DEL NEGOCIO», «# AVATAR», «# DOLORES», «# NICHOMERCADO»)—
  // encontraba UNO SOLO: 1 nodo en vez de 6, y las aristas laterales de
  // PANORAMA_APUNTA_A tampoco se disparaban. En silencio, y solo en ese workspace.
  //
  // La lección: el comentario decía «el generador GARANTIZA que las seis están», y es
  // cierto para lo que se genere de ahora en más. No para lo que ya está en la base.
  const lineas = t.split('\n');
  const secciones: Array<{ titulo: string; cuerpo: string }> = [];
  let actual: { titulo: string; cuerpo: string[] } | null = null;
  for (const linea of lineas) {
    // Un encabezado es una línea corta que empieza con # o ** o que está entera en
    // mayúsculas, y que no es una oración.
    const crudo = linea.trim();
    const esEncabezado =
      crudo.length > 0 && crudo.length <= 60 &&
      (/^#{1,4}\s+\S/.test(crudo) || /^\*\*[^*]+\*\*:?$/.test(crudo) ||
        (crudo === crudo.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{3}/.test(crudo) && !/[.;]$/.test(crudo)));
    if (esEncabezado) {
      if (actual) secciones.push({ titulo: actual.titulo, cuerpo: actual.cuerpo.join('\n').trim() });
      actual = { titulo: crudo.replace(/^[#*\s]+|[#*:\s]+$/g, '').toUpperCase(), cuerpo: [] };
    } else if (actual) {
      actual.cuerpo.push(linea);
    }
  }
  if (actual) secciones.push({ titulo: actual.titulo, cuerpo: actual.cuerpo.join('\n').trim() });
  return secciones.filter((s) => s.titulo.length > 0 && s.cuerpo.length > 0);
}

/** Los sinónimos con los que distintas versiones del generador nombraron el mismo
 *  plano. Sirve para que las aristas laterales encuentren su destino igual. */
const PLANO_CANONICO: Array<{ canon: string; alias: RegExp }> = [
  { canon: 'IDENTIDAD Y POSICIONAMIENTO', alias: /IDENTIDAD|DESCRIPCI[OÓ]N DEL NEGOCIO|POSICIONAMIENTO/ },
  { canon: 'OFERTA Y PRECIOS', alias: /OFERTA|PRECIO/ },
  { canon: 'AVATAR Y CLIENTE IDEAL', alias: /AVATAR|CLIENTE IDEAL|DOLOR/ },
  { canon: 'NICHO Y MERCADO', alias: /NICHO|MERCADO/ },
  { canon: 'TONO Y VOZ DE MARCA', alias: /TONO|VOZ DE MARCA/ },
];

const canonPlano = (titulo: string): string =>
  PLANO_CANONICO.find((p) => p.alias.test(titulo))?.canon ?? titulo;

/** Título en versalitas humanas: «OFERTA Y PRECIOS» → «Oferta y precios». */
const capitalizar = (s: string): string => s.charAt(0) + s.slice(1).toLowerCase();

// ── Los campos del brief: del ESQUEMA VIVO, repartidos por grupo (F108, 18/11/2026) ──
// Hasta el 18/11/2026 eran cuatro listas fijas de claves (CAMPOS_NORTE, _OFERTA, _CLIENTE, _MARCA) y el esquema vivo
// sólo daba los rótulos: un campo nuevo creado con «+ Campo» en /onboarding no aparecía nunca en el grafo. Ahora las
// claves salen del esquema (`getSchema`), y el GRUPO decide el área. Un grupo nuevo («+ Grupo») cae en el Resumen del
// negocio, que es el área de lo que el negocio contó de sí.
// De los 18 campos de DEFAULT_SCHEMA se llegaron a usar 11; los 7 que faltaban no eran relleno: el objetivo a 90 días y
// qué te está frenando son lo que el Perro Guardián usa para priorizar, y los cinco de marca son la voz del negocio.
const AREA_DE_GRUPO: Readonly<Record<string, AreaId>> = { negocio: 'norte', oferta: 'oferta', avatar: 'cliente', marca: 'voz' };
const AREA_DE_UN_GRUPO_NUEVO: AreaId = 'panorama';
/** Lo que ya dibuja la RAÍZ: no es además un nodo de campo. */
const NO_ES_UN_CAMPO = new Set(['negocio_que_hace']);

/**
 * Los campos del brief que el grafo recorre, en orden, con su área: los del esquema VIVO y, detrás, los del esquema por
 * defecto que el vivo no tenga.
 *
 * ⚠️ LA SEGUNDA MITAD NO ES UNA COPIA DE LAS LISTAS VIEJAS: es lo que impide que este cambio BORRE nodos. El esquema se
 * guarda entero (`saveSchema`), así que el de un negocio que lo guardó antes de que DEFAULT_SCHEMA sumara un campo no lo
 * tiene, aunque sus documentos sí lo llenen; con las listas fijas ese campo se dibujaba y sin esta mitad dejaría de
 * dibujarse, sin un error. Una clave que está en el vivo manda ahí (si se mudó de grupo, va al área de su grupo nuevo).
 */
export function camposDelBrief(vivo: readonly GrupoBrief[], porDefecto: readonly GrupoBrief[]): Array<{ key: string; area: AreaId }> {
  const out: Array<{ key: string; area: AreaId }> = [];
  const vistas = new Set<string>();
  for (const g of [...vivo, ...porDefecto]) {
    const area = AREA_DE_GRUPO[g.key] ?? AREA_DE_UN_GRUPO_NUEVO;
    for (const f of g.fields ?? []) {
      const key = typeof f?.key === 'string' ? f.key.trim() : '';
      if (!key || NO_ES_UN_CAMPO.has(key) || vistas.has(key)) continue;
      vistas.add(key);
      out.push({ key, area });
    }
  }
  return out;
}

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
  negocio_objetivo: 'Tu objetivo a 90 días',
  negocio_freno: 'Lo que te frena',
  marca_nombre: 'Personaje de marca',
  marca_tono: 'Su tono',
  marca_valores: 'En qué cree',
  marca_no: 'Lo que nunca hace',
  marca_frase: 'Su muletilla',
};

/** Último recurso para un campo sin nombre propio: la pregunta sin signos, sin
 *  paréntesis aclaratorios y recortada. Feo a propósito — se ve que falta. */
const desdePregunta = (label: string): string =>
  corto(label.replace(/\([^)]*\)/g, '').replace(/[¿?¡!]/g, '').trim(), 22);

/**
 * Qué dice una arista del funnel. NO se usa `t.label` solo: son textos de BOTÓN
 * («Avanza», «Se perdió») que no explican nada fuera del Kanban. El dato que sí explica
 * está en el `trigger`, que ya viene en cada transición y no lo lee ninguna pantalla.
 *
 * Y `autoHoy: false` es oro puro: el catálogo TRIGGER sabe qué disparadores todavía NO
 * están cableados (Pago, Asistencia, Tiempo). Decirlo es información verdadera y
 * verificable que hoy no aparece en ningún lado del producto — la misma lógica de «un
 * vacío registrado y con nombre vale más que un vacío disimulado» que ya gobierna los
 * nodos `falta:`.
 */
function motivoDeTransicion(t: FunnelTransition): string {
  const tr = t.trigger ? TRIGGER[t.trigger] : undefined;
  if (!tr) return t.label;
  if (!tr.auto) return `Lo marca una persona: ${t.label}`;
  if (!tr.autoHoy) return `${t.label}: se dispara con ${tr.label}, que todavía no está conectado`;
  return `${t.label}, sola: la dispara ${tr.label}`;
}

// ── El armado ────────────────────────────────────────────────────────────────

/**
 * De las lecturas al grafo: los nodos, las aristas, la cuenta y las áreas vacías. Lo llama `construirCerebro`
 * (lib/cerebro-grafo.ts) con todo ya leído; el dibujo (las posiciones de d3) y la huella los agrega él.
 */
export function armarCerebro(l: LecturasCerebro): CerebroArmado {
  const {
    schema, schemaPorDefecto, diag, files, manual, panorama, productos, entregables, avatares, razones, persona, personalidad,
    funnel, secuencias, landings, audios, vozManual, vozEvidencia, glosario, vivo, kitsCrudo,
  } = l;
  const { answers, fuente } = computeEffective(files, manual);
  const nodos: NodoCerebro[] = [];
  const aristas: AristaCerebro[] = [];
  const push = (n: NodoCerebro) => { nodos.push(n); return n.id; };
  const unir = (de: string, a: string, motivo: string) => { aristas.push({ de, a, motivo }); };

  // La etiqueta de un campo sale del esquema vivo, no de una copia (y, si el vivo no lo tiene, del de fábrica).
  const labelDe = new Map<string, string>();
  for (const g of [...schemaPorDefecto, ...schema]) for (const f of g.fields ?? []) labelDe.set(f.key, f.label);

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
      // ⚠️ ESTE ERA EL PEOR CASO DE TODO EL MAPA: `FaseDef` tiene quince campos y el
      // nodo mostraba UNO. Lo que MaKo dedujo de las seis preguntas —qué NO conviene
      // hacer todavía, cómo repartir la inversión, qué funnel corresponde— estaba
      // escrito, viajaba al browser y no lo leía nadie. Y es justo lo que hace que el
      // Norte sea el Norte.
      datos: [
        { k: 'Qué funnel te toca', v: f.funnelSugerido?.nombre ?? '' },
        { k: 'Cómo repartir', v: f.estrategia
          ? `${f.estrategia.prospeccion}% a tráfico frío · ${f.estrategia.nutricion}% a nutrición · ${f.estrategia.escala}% a escalar`
          : '' },
        { k: 'Cuánto invertir', v: f.estrategia?.inversion ?? '' },
        { k: 'Todavía no conviene', v: (f.noHacer ?? []).slice(0, 3).join(' · ') },
      ],
      cuerpo: [f.estrategia?.nota, f.funnelSugerido?.comoFunciona].filter(Boolean).join('\n\n'),
      fuente: 'de tus 6 respuestas del diagnóstico',
      autoria: 'mako',
      destacado: true,
    });
    unir(RAIZ, idFase, 'El Norte del negocio');

    const idCuello = push({
      id: 'cuello',
      area: 'norte',
      etiqueta: f.cuelloLabel,
      detalle: 'Es donde se rompe la cadena hoy. Mientras esto no se mueva, mejorar el resto no cambia el resultado.',
      datos: [
        { k: 'El hito para pasar de fase', v: f.hito },
        // `hitoCriterios` son las preguntas que dicen CUÁNDO se salió de la fase, y se
        // estaban tirando enteras: sin ellas el hito es una intención sin forma de saber
        // si se cumplió.
        { k: 'Cómo sabes que lo lograste', v: (f.hitoCriterios ?? []).join(' · ') },
      ],
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
      detalle: limpio(f.razonamiento) || 'Lo leí, pero no pude sacar campos concretos de aquí.',
      fuente: aporto === 1 ? 'aportó 1 dato' : `aportó ${aporto} datos`,
      autoria: 'mako',
      // El mime viaja para que el panel pueda PREVISUALIZARLO. La etiqueta va recortada
      // a 30 caracteres, así que ni siquiera la extensión sobrevive para adivinarlo.
      mime: (f as { mime?: string | null }).mime ?? null,
      nace: f.created_at ?? null,
    });
    unir(RAIZ, id, 'Un documento que soltaste en el Archivero');
  }

  // ── Panorama ───────────────────────────────────────────────────────────────
  // Los seis planos se cuelgan de la raíz Y, cuando existe, del dato del que hablan
  // (ver PANORAMA_APUNTA_A). Esa segunda arista es LATERAL: cruza de un área a otra
  // y es parte de lo que convierte el grafo en una red en vez de un árbol.
  const panoramaIds: string[] = [];
  // ⚠️ `canonPlano` mapea SINÓNIMOS al mismo nombre, y dos secciones distintas del
  // mismo panorama pueden caer en el mismo canónico («NICHO O MERCADO ESPECÍFICO» y
  // «NICHO Y MERCADO» → los dos a «NICHO Y MERCADO»). Sin esta guarda quedan DOS
  // nodos con el MISMO id, y eso no rompe el parser: rompe todo lo que indexa por id
  // —las claves de React, el mapa de posiciones del layout, el destino de las
  // aristas— y encima en silencio. Se detectó porque el export escribía dos archivos
  // en la misma ruta y el segundo pisaba al primero.
  const idsPanorama = new Set<string>();
  for (const s of seccionesPanorama(panorama)) {
    let idPan = `pan:${canonPlano(s.titulo)}`;
    if (idsPanorama.has(idPan)) idPan = `pan:${s.titulo}`;   // el crudo desempata
    if (idsPanorama.has(idPan)) continue;                     // dos veces el mismo título: es la misma sección
    idsPanorama.add(idPan);
    const id = push({
      // El id usa el nombre CANÓNICO del plano, no el que trajo el texto: así las
      // aristas laterales encuentran su destino aunque el panorama guardado use un
      // molde viejo («# DESCRIPCIÓN DEL NEGOCIO» en vez de «IDENTIDAD…»).
      id: idPan,
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
  // Las claves y su área salen del esquema vivo (`camposDelBrief`, F108): un campo nuevo del brief entra solo.
  const campoANodo = new Map<string, string>();
  for (const { key, area } of camposDelBrief(schema, schemaPorDefecto)) {
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

  // ── Productos ──────────────────────────────────────────────────────────────
  const nodoOferta = campoANodo.get('oferta_nombre');
  // Los que una oferta de Offer incluye se cuelgan de ESA oferta (lib/cerebro-vivo.ts): la arista vieja al campo del
  // brief sería un radio de más sin información.
  const ofertasActivas = new Set(vivo.ofertas.filter((o) => o.activa).map((o) => o.id));
  const conOferta = new Set(vivo.ligasProducto.filter((lp) => ofertasActivas.has(lp.oferta_id)).map((lp) => lp.producto_id));
  for (const p of productos) {
    const precio = p.monto_usd == null ? 'sin precio cargado'
      : p.tipo === 'suscripcion'
        ? `USD ${p.monto_usd}/mes${p.suscripcion_meses ? ` · ${p.suscripcion_meses} meses` : ' · indefinida'}`
        : `USD ${p.monto_usd} · pago único`;
    const id = push({
      id: `prod:${p.id}`,
      area: 'productos',
      etiqueta: corto(p.nombre, 30),
      detalle: limpio(p.promesa),
      datos: [
        { k: 'Precio', v: precio },
        { k: 'Incluye', v: limpio(p.incluye) },
        { k: 'Garantía', v: limpio(p.garantia) },
        // Un producto dado de baja se DIBUJABA como si estuviera vigente, en una pantalla
        // cuyo argumento entero es «esto es tuyo y está al día». Eso es información
        // falsa, no una omisión: si está de baja, lo dice.
        { k: 'Estado', v: (p as { activo?: boolean }).activo === false ? 'Dado de baja' : '' },
      ],
      fuente: 'del catálogo que arma el CRM',
      autoria: 'mako',
      nace: vivo.fechas.productos?.[String(p.id)] ?? null,
    });
    if (!conOferta.has(Number(p.id))) unir(nodoOferta ?? RAIZ, id, nodoOferta ? 'MaKo lo dedujo de tu oferta' : 'Un producto del catálogo');
  }

  // ── Gancho (lead magnets) ──────────────────────────────────────────────────
  for (const e of entregables) {
    const id = push({
      id: `ent:${e.id}`,
      area: 'entregables',
      etiqueta: corto(e.nombre, 30),
      detalle: limpio(e.queEs),
      datos: [
        { k: 'Línea para el anuncio', v: limpio(e.fomo) },
        { k: 'Tipo', v: limpio((e as { tipo?: string }).tipo ?? '') },
        { k: 'Enlace', v: limpio((e as { enlace?: string }).enlace ?? '') },
      ],
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
      detalle: limpio(a.segmento),
      datos: [
        { k: 'Le duele', v: limpio(a.dolor) },
        { k: 'Su situación', v: limpio((a as { situacion?: string }).situacion ?? '') },
        { k: 'Cómo encontrarlo en Meta', v: limpio(a.senalesMeta) },
      ],
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
      detalle: limpio(r.descripcion),
      datos: [
        { k: 'Gancho', v: limpio(r.copy) && `«${limpio(r.copy)}»` },
        // Los guiones se CUENTAN y se NOMBRAN con su estado: antes decía «2 guiones
        // escritos» y el estado estaba a mano en la misma fila, sin usarse.
        { k: 'Guiones', v: r.guiones?.length ? `${r.guiones.length} ${r.guiones.length === 1 ? 'escrito' : 'escritos'}` : '' },
      ],
      fuente: 'una motivación de compra de ese segmento',
      autoria: 'mako',
    });
    const padre = avatarANodo.get(r.avatarId);
    if (padre) unir(padre, id, 'Este segmento compra por esta razón');
    else unir(RAIZ, id, 'Una razón de compra');
    // La celda de los guiones propios no es un anuncio planteado: no se cuenta ni usa un formato.
    if (r.id !== CELDA_GUIONES_PROPIOS) for (const f of usados) razonAFormatos.push({ razon: id, formato: f });
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

  // La marca (5/11/2026): un nodo con los kits, cuál va por defecto y qué trae. Sin kits, no se dibuja (un área sin datos no
  // dibuja un «falta»: MaKo la pide en los chats que la usan).
  const kitsMarca = sanearKits(kitsCrudo);
  const kitMarca = kitPorDefecto(kitsMarca);
  if (kitMarca) {
    const id = push({
      id: 'marca',
      area: 'voz',
      etiqueta: 'Tu marca',
      detalle: [
        `«${kitMarca.nombre}»${kitsMarca.kits.length > 1 ? ` (por defecto, de ${kitsMarca.kits.length} kits)` : ''}: ${resumenDeKit(kitMarca) || 'sin datos'}.`,
        kitMarca.colores.length ? `Colores: ${kitMarca.colores.map((c) => c.hex).join(', ')}` : '',
        kitMarca.fuentes.titulos || kitMarca.fuentes.texto ? `Fuentes: ${[kitMarca.fuentes.titulos, kitMarca.fuentes.texto].filter(Boolean).join(' y ')}` : '',
      ].filter(Boolean).join('\n'),
      fuente: kitMarca.origen ? `de «${kitMarca.origen}»` : 'cargada a mano',
      autoria: 'usuario',
    });
    unir(RAIZ, id, 'Cómo se ven tus diseños, videos y páginas');
  }

  // ── Formatos: solo los que ESTE negocio usa ────────────────────────────────
  // La biblioteca son 14 y es catálogo de MaKo, igual para todos. Entran sólo los que
  // alguna celda de la matriz eligió (anguloImagen/anguloVideo), como nodo del área de
  // razones porque es donde se usan; su padre es la razón que lo usa (la arista 1, abajo).
  // ⚠️ Hasta el 23/10/2026 entraban también los RECOMENDADOS a nivel negocio, colgados de la
  // raíz. La recomendación se sacó (0 negocios la tenían): docs/hallazgos-second-brain.md.
  // El conteo es la MISMA función que la vista Ángulos y la API (usosPorFormato), SIN cortar por avatares: el grafo
  // dibuja también las razones de un avatar borrado (colgadas de la raíz), y la cuenta tiene que ser la de sus aristas.
  const usos = usosPorFormato(razones);
  const usadosPorCelda = new Set(razonAFormatos.map((x) => x.formato));
  for (const formatoId of usadosPorCelda) {
    const nombre = formatoNombre.get(formatoId);
    if (!nombre) continue;
    const n = usos[formatoId] ?? 0;
    push({
      id: `fmt:${formatoId}`,
      area: 'razones',
      etiqueta: corto(nombre, 26),
      detalle: n > 1 ? `Lo usan ${n} de tus anuncios.` : 'Lo usa uno de tus anuncios.',
      fuente: 'en uso en tu matriz',
      autoria: 'mako',
    });
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

  // ── El FUNNEL: la única cadena que tiene el negocio ───────────────────────
  // Todo el resto del cerebro es hub y hojas — un dato cuelga de su área y ahí termina.
  // El funnel es lo único con CADENA propia (etapa → etapa, con vueltas), que es
  // exactamente lo que un grafo dibuja bien y lo que a este mapa le faltaba.
  //
  // ⚠️ NO ENTRAN LAS 17 ETAPAS que genera `generateFunnel`. Entran las que dicen algo de
  // ESTE negocio:
  //   · FUERA las tres salidas fijas (Perdido / Descalificado / No responde). Son
  //     catálogo de MaKo: bit a bit iguales en las cuatro plantillas y en todos los
  //     workspaces. Es la misma regla que ya excluye los 14 formatos de la biblioteca.
  //   · FUERA «Nutrición - Manual». Es el catch-all del worklist y `generateFunnel` no
  //     emite NI UNA transición hacia ella ni desde ella: sería el único nodo huérfano
  //     del mapa. Colgarla del área sería peor — parecería conectada sin significar nada.
  // Quedan 13 nodos en high-ticket y en vsl, 7 en simple y en directa. Y no son los
  // mismos entre plantillas: `directa` genera «No pagó» y no genera «No Show R1», que es
  // justamente lo que hace que el funnel valga como dato del negocio.
  if (funnel.pipeline.length) {
    const FIJAS = new Set(['perdido', 'descal', 'noresp', 'manual']);
    const delFunnel = funnel.stages.filter((e) => !FIJAS.has(e.key));
    const idEtapa = (k: string) => `etapa:${k}`;
    const enElMapa = new Set(delFunnel.map((e) => e.key));

    for (const e of delFunnel) {
      const esActivo = e.band === 'pipeline';
      const salidas = salidasDeEtapa(funnel.stages, funnel.transitions, e.key)
        .map((x) => x.label)
        .filter(Boolean);
      push({
        id: idEtapa(e.key),
        area: 'funnel',
        etiqueta: e.label,
        // Del `Stage` se usa lo que es del NEGOCIO. `dot`, `tone` y `col` son layout del
        // Kanban y no entran: el grafo tiene su propia paleta.
        detalle: [
          BAND_LABEL[e.band ?? 'pipeline'],
          salidas.length ? `Desde aquí: ${salidas.join(' · ')}.` : '',
        ].filter(Boolean).join(' — '),
        // La fila «Activo» es la que el cliente edita en /funnel; las de nutrición las
        // deriva `generateFunnel` sola. Eso es literalmente cierto hoy, y es lo único
        // que se puede afirmar: `funnels` no guarda de dónde salió el pipeline.
        fuente: esActivo ? 'de tu funnel' : 'derivada de tu funnel',
        autoria: esActivo ? 'usuario' : 'mako',
      });
    }

    // ⚠️ LAS TRANSICIONES VIENEN DUPLICADAS POR PAR. `generateFunnel` emite ida Y vuelta
    // entre los mismos dos nodos (agenda → No Show R1 y No Show R1 → agenda), y `unir()`
    // no deduplica. Dos aristas sobre el mismo par meten DOS resortes en forceLink —ese
    // par queda al doble de tensión y se pega en el dibujo—, se dibujan una encima de la
    // otra, inflan la densidad que mide `scripts/medir-grafo.mjs` y hacen que el panel
    // cuente dos veces al mismo vecino. Se funden por par NO ORDENADO, juntando los dos
    // motivos en una frase.
    const porPar = new Map<string, string[]>();
    for (const t of funnel.transitions) {
      if (!enElMapa.has(t.from) || !enElMapa.has(t.to)) continue;
      const par = [t.from, t.to].sort().join('|');
      porPar.set(par, [...(porPar.get(par) ?? []), motivoDeTransicion(t)]);
    }
    for (const [par, motivos] of porPar) {
      const [a, b] = par.split('|');
      unir(idEtapa(a), idEtapa(b), [...new Set(motivos)].join('. Y '));
    }

    // La arista que une las dos mitades: el canal que el cliente declaró explica por qué
    // su funnel arranca así. ⚠️ Esta arista era MENTIRA hasta que se arregló el sembrado
    // —el funnel se elegía sin mirar el canal—, y por eso el funnel no estaba en el mapa.
    const primera = funnel.pipeline[0];
    if (primera && nodos.some((n) => n.id === 'canal') && enElMapa.has(primera.key)) {
      unir('canal', idEtapa(primera.key), 'Por eso tu funnel arranca así');
    }
  }

  // ── LO QUE MAKO APRENDIÓ EN EL RESTO DEL PRODUCTO ─────────────────────────
  // El criterio, en una frase: una fuente entra cuando trae AL MENOS UNA ARISTA LATERAL
  // por nodo que suma; si no puede, entra AGREGADA en un solo nodo; y si ni siquiera se
  // le puede escribir el `motivo`, no entra.
  //
  // ⚠️ Lo que se dejó AFUERA importa tanto como lo que entró, y el motivo casi nunca es
  // el volumen:
  //   · VOLUMEN puro (13.217 mensajes de WhatsApp en un solo workspace, 6.151 eventos de
  //     VSL, 1.187 leads): ni agregados aportan un nodo — cuántos leads hay parados en
  //     una etapa es un DATO de esa etapa, no un nodo aparte.
  //   · CATÁLOGO DE MAKO DISFRAZADO DE DATO DEL CLIENTE, que es el que engaña: medido,
  //     las once secuencias de nutrición de tres workspaces distintos son la MISMA
  //     semilla bit a bit, y las categorías del tablero son literalmente el catálogo. Por
  //     eso de las secuencias entran solo las ACTIVAS: la semilla dormida es catálogo.
  //   · ACTIVIDAD, no conocimiento: lo que el negocio está probando (experimentos
  //     abiertos, tareas) es la salida de otra pantalla, no lo que MaKo entendió de él.
  // Se recalcula: entre el bloque de las aristas laterales y este entraron el funnel y
  // sus etapas, y las fuentes de acá abajo enganchan justamente con esas.
  const enElMapa = new Set(nodos.map((n) => n.id));
  const primeraEtapa = funnel.pipeline[0] ? `etapa:${funnel.pipeline[0].key}` : null;

  // A1 · SECUENCIAS DE NUTRICIÓN ACTIVAS. El mejor enganche del inventario: cada una
  // apunta a una etapa REAL del funnel, así que caen sobre la única cadena del mapa.
  // ⚠️ El id sale de la CLAVE y no del `id` de la fila: el id es un bigint autoincremental
  // que cambia entre workspaces y entre reseeds, y el id de un nodo entra en `huellaDe()`
  // — un id inestable le rearma el mapa al cliente sin que nada haya cambiado.
  const clavesSec = new Set<string>();
  for (const sec of secuencias) {
    const destino = `etapa:${sec.etapa}`;
    // Sin arista no hay nodo: si la etapa no está en el mapa (apunta a una salida fija o
    // a «manual», que se excluyen a propósito), la secuencia no entra.
    if (!enElMapa.has(destino) || clavesSec.has(sec.clave)) continue;
    clavesSec.add(sec.clave);
    const pasos = Array.isArray(sec.pasos) ? sec.pasos.length : 0;
    const idSec = push({
      id: `sec:${sec.clave}`,
      area: 'norte',
      etiqueta: sec.nombre,
      detalle: `Nutrición de ${pasos} ${pasos === 1 ? 'mensaje' : 'mensajes'}, activa.`,
      fuente: 'la escribiste en tu nutrición',
      autoria: 'usuario',
    });
    unir(idSec, destino, 'Los leads que caen en esta etapa reciben esta secuencia');
  }

  // A2 · LA LANDING ANALIZADA. Tres aristas laterales por nodo — el mejor ratio de todo
  // el inventario — y las tres contrastan lo que la PÁGINA dice con lo que el negocio
  // declaró de sí mismo, que es información que hoy no aparece en ninguna pantalla.
  const urlsLanding = new Set<string>();
  for (const l of landings) {
    if (urlsLanding.has(l.url)) continue;
    urlsLanding.add(l.url);
    const idLand = push({
      id: `land:${l.url}`,
      area: 'oferta',
      etiqueta: l.titulo || l.url.replace(/^https?:\/\//, ''),
      detalle: [l.veredicto, l.score != null ? `Puntaje ${l.score} de 10` : '', l.resumen]
        .filter(Boolean).join('\n\n'),
      fuente: 'MaKo analizó tu página',
      autoria: 'mako',
    });
    if (l.promesa && enElMapa.has('campo:oferta_promesa')) {
      unir(idLand, 'campo:oferta_promesa', 'Lo que tu página promete, al lado de la promesa que declaraste');
    }
    if (l.avatar && enElMapa.has('campo:avatar_quien')) {
      unir(idLand, 'campo:avatar_quien', 'A quién le habla la página, según su propio texto');
    }
    // ⚠️ NUNCA 'etapa:lead' literal: `lead` es la clave del catálogo por defecto y un
    // funnel armado a mano puede no tenerla. La primera etapa del pipeline SIEMPRE existe.
    if (primeraEtapa && enElMapa.has(primeraEtapa)) {
      unir(idLand, primeraEtapa, 'Aquí caen los leads que entran por esta página');
    }
  }

  // B1 · LOS AUDIOS DEL DUEÑO. El área «Voz y cara» tenía dos nodos para una de las cosas
  // más personales del producto.
  for (const a of audios) {
    const idAudio = push({
      id: `audio:${a.id}`,
      area: 'voz',
      etiqueta: a.titulo,
      detalle: a.duracion_s ? `Audio de ${Math.round(a.duracion_s)} segundos.` : 'Un audio grabado por ti.',
      fuente: 'lo grabaste tú',
      autoria: 'usuario',
      nace: a.created_at ?? null,
    });
    if (enElMapa.has('voz')) unir(idAudio, 'voz', 'Es tu voz grabada, la que suena en la nutrición');
  }

  // B2 · LA VOZ COMERCIAL MEDIDA: cómo dijiste que hablas contra cómo hablas de verdad.
  const rasgosVoz = Object.keys(vozManual ?? {}).length;
  // ⚠️ Hasta el 18/11/2026 se leía `conversaciones?.length`, un campo que `VozEvidencia` NO tiene (lo destapó tipar las
  // lecturas al mudar el armado): daba 0 siempre, y el nodo decía «Lo que anotaste» sobre una voz que MaKo sí había leído.
  const convsVoz = Number.isFinite(vozEvidencia?.convsConVenta) ? Math.max(0, Math.round(vozEvidencia!.convsConVenta!)) : 0;
  if (rasgosVoz > 0 || convsVoz > 0) {
    const idVozCom = push({
      id: 'vozcom',
      area: 'voz',
      etiqueta: 'Cómo hablas vendiendo',
      detalle: convsVoz
        ? `MaKo leyó ${convsVoz} ${convsVoz === 1 ? 'conversación tuya' : 'conversaciones tuyas'} de venta para sacar tu forma de escribir.`
        : 'Lo que anotaste sobre tu forma de escribir vendiendo.',
      fuente: convsVoz ? 'MaKo lo sacó de tus conversaciones' : 'lo escribiste tú',
      autoria: convsVoz ? 'mako' : 'usuario',
    });
    if (enElMapa.has('voz')) unir(idVozCom, 'voz', 'Cómo dijiste que hablas, y cómo hablas de verdad en tus chats');
  }

  // D1 · EL OBJETIVO EN NÚMEROS: desde el 18/11/2026 (F82) sale SÓLO de `objectives`, la misma tabla que la pantalla y los
  // reportes (lib/objectives.ts → `metasDelQuarter`). Son los nodos `okr:` que arma lo vivo (lib/cerebro-vivo.ts), y el que
  // mide CIERRES se engancha con la etapa donde se cierra (`etapaCierre`, abajo).
  // ⚠️ Hasta ese día había además un nodo `objetivo` armado con los settings VIEJOS (`objetivo_cierres`, `objetivo_cash_usd`):
  // «12 cierres en 90 días · Y USD 30.000 de facturación». Eran dos fuentes de la meta en el mismo mapa: el negocio cambiaba
  // su meta en General y el grafo —y con él los chats, que leen este grafo— seguía diciendo la vieja, al lado del `okr:`
  // con la nueva. NO vuelve como respaldo para un negocio sin objetivos: caer al origen viejo es volver a tener dos
  // fuentes (lib/objetivos-reporte.ts lo explica), y lo que falta se dice en la raíz («Todavía sin info»).
  const cierre = funnel.pipeline.find((e) => e.kind === 'cierre') ?? funnel.pipeline[funnel.pipeline.length - 1];
  const etapaCierre = cierre && enElMapa.has(`etapa:${cierre.key}`) ? `etapa:${cierre.key}` : null;

  // E1 · EL VOCABULARIO PROPIO, AGREGADO EN UN NODO. Y el motivo es duro, no estético:
  // los términos del glosario del workspace más poblado son 22 hojas de grado 1 de un
  // saque, que sobre ~106 nodos serían el 21% del mapa colgando de un solo lugar — el
  // umbral de hojas es 30% y hoy vamos por 7%. Un nodo que los NOMBRA en su detalle dice
  // lo mismo sin deformar la topología.
  const propios = glosario.filter((g) => g.activo && (g.area === 'glosario' || g.categoria === 'glosario'));
  if (propios.length > 0) {
    const idGlos = push({
      id: 'glosario',
      area: 'voz',
      etiqueta: `Tu vocabulario (${propios.length})`,
      detalle: propios.slice(0, 12).map((g) => g.titulo).join(' · '),
      fuente: 'lo cargaste en Conocimiento',
      autoria: 'usuario',
      nace: propios.map((g) => g.created_at).filter(Boolean).sort().at(-1) ?? null,
    });
    if (enElMapa.has('voz')) unir(idGlos, 'voz', 'Las palabras con las que MaKo te escribe');
  }

  // ── LO VIVO DEL NEGOCIO (punto 13, 17/10/2026): ofertas, lead magnets, funnels, leads, OKR/KPI y chats ────────
  // Va ANTES de los nodos de área para que sus miembros entren al racimo de su área como cualquier otro dato.
  agregarLoVivo({ nodos, aristas }, vivo, {
    raiz: RAIZ,
    primeraEtapa: funnel.pipeline[0] ? `etapa:${funnel.pipeline[0].key}` : null,
    etapasEnMapa: new Set(nodos.filter((n) => n.id.startsWith('etapa:')).map((n) => n.id)),
    etapaCierre,
  });

  // ── Las ÁREAS como nodos ───────────────────────────────────────────────────
  // Es el mecanismo con el que Quartz fabrica racimos sin inventar ninguna fuerza:
  // el tag entra como nodo y las notas se juntan solas alrededor. Acá reemplaza a DOS
  // cosas que se van juntas — los rótulos flotantes del dibujo y las fuerzas de ancla
  // por sector del layout. El racimo lo hace forceLink, gratis, y como emerge de la
  // topología no deja cuñas ni anillos.
  //
  // ⚠️ DEROGA, a propósito, la regla de la cabecera de este archivo («un nodo es una
  // cosa que alguien puede señalar y decir "eso es mío"»). El criterio: el área ya se
  // le mostraba al cliente —el panel y los rótulos la nombraban—, así que no es
  // información nueva: es la MISMA etiqueta movida de texto flotante a nodo, que es
  // donde puede hacer trabajo topológico. Sin esta nota, la próxima sesión los saca.
  //
  // Efecto medido: hojas 47,6% → 1,9% · densidad 1,21 → 1,77 · ciclos por nodo
  // 0,24 → 0,79. NO se unen a la raíz: eso le sumaría diez radios al hub, que es
  // justo lo que se está desinflando.
  //
  // ⚠️ Y UNA EXCEPCIÓN, medida: las etapas de NUTRICIÓN del funnel NO se cuelgan de su
  // área. Colgar las 13 etapas del funnel de `area:norte` le lleva el grado de 5 a 22 y
  // la convierte en el nodo más conectado del mapa, por encima de la raíz: el hub pasa a
  // 5,5x contra el umbral de 4,5x de scripts/medir-grafo.mjs. Y el racimo del funnel no
  // lo necesita — ya lo hace su propia cadena, que es para lo único que existe el nodo de
  // área. Colgando solo la fila «Activo» las seis métricas pasan en las cuatro
  // plantillas. Sin esta nota, la próxima sesión lo lee como un olvido y lo «arregla».
  // ⚠️ LA EXCEPCIÓN SE CONSERVA, SOLO CAMBIÓ DE ÁREA. Las etapas de nutrición no se
  // cuelgan de su nodo de área — antes era `area:norte`, ahora `area:funnel`. El motivo
  // original no desapareció con la mudanza: en el workspace más chico 13 de sus 24 nodos
  // son etapas, y colgarlas todas del nodo de área le lleva el grado a 14 y el hub a
  // 6,1x contra un umbral de 4,5x. El racimo del funnel ya lo hace su propia cadena de
  // transiciones, que es para lo único que existe el nodo de área.
  const nutricionDelFunnel = new Set(
    funnel.stages.filter((e) => e.band !== 'pipeline').map((e) => `etapa:${e.key}`),
  );
  const realesPorArea = new Map<AreaId, string[]>();
  for (const n of nodos) {
    // Los clientes y las reuniones de venta (18/10/2026) tienen su propio racimo (cliente → «N clientes» → leads): colgarlos
    // también del área del funnel le llevaría el grado al de la raíz, y el hub pasa el tope de scripts/medir-grafo.mjs.
    if (n.id === RAIZ || n.autoria === 'pendiente' || nutricionDelFunnel.has(n.id) || /^(cliente|reunion):/.test(n.id)) continue;
    realesPorArea.set(n.area, [...(realesPorArea.get(n.area) ?? []), n.id]);
  }
  for (const a of AREAS) {
    const miembros = realesPorArea.get(a.id) ?? [];
    if (miembros.length < 2) continue;   // con un solo miembro el nodo de área es un salto mudo
    const idArea = push({
      id: `area:${a.id}`,
      area: a.id,
      etiqueta: a.nombre,
      detalle: a.que,
      // Cuántos de sus datos siguen sin completar. Es el aviso que pidió el dueño, y
      // sale de algo que ya se calculaba: los nodos con autoría `pendiente` de esa área.
      // No lleva color propio — solo hay DOS tonos de estado en el lienzo (el Norte y el
      // cuello) y bajo deuteranopía ya colisionan entre sí, así que un tercero sería
      // ilegible para ~6% de los hombres. Lo dice con palabras, que además es preciso.
      datos: (() => {
        const faltan = nodos.filter((n) => n.area === a.id && n.autoria === 'pendiente').length;
        return faltan ? [{ k: 'Falta completar', v: `${faltan} ${faltan === 1 ? 'dato' : 'datos'}` }] : [];
      })(),
      fuente: `${miembros.length} cosas de tu negocio`,
      autoria: 'mako',
    });
    for (const m of miembros) unir(m, idArea, `Esto es parte de ${a.nombre}`);
  }


  // ── EL NIVEL 1: las cinco carpetas madre ──────────────────────────────────
  // Juntas forman una frase: «este NEGOCIO vende esta OFERTA a este MERCADO diciéndole
  // este MENSAJE por este FUNNEL». Son el mismo mecanismo que los nodos de área, un
  // escalón más arriba — y por eso no es un cambio de paradigma: el grafo YA tenía un
  // nivel de la jerarquía dibujado desde que se sacaron las fuerzas de ancla.
  //
  // 🚨 EL MAPA NO VUELVE A SER UN ÁRBOL, y esto va acá para que la próxima sesión no lo
  // intente. Se midió: el árbol puro de tres niveles rompe CUATRO de las seis métricas en
  // los cuatro workspaces (densidad 0,79-0,83 contra ≥1,5 · hojas 63-67% contra ≤30% ·
  // hub 7,0-7,8× contra ≤4,5× · clustering 0,00 contra ≥0,15) y parte el grafo en 12-14
  // islas. La jerarquía gobierna el ZOOM, el EXPORT y la grilla; el dibujo conserva sus
  // aristas laterales.
  //
  // 🚨 Y LOS PADRES NUNCA SE CUELGAN DE LA RAÍZ. Medido: hub 4,8× y 5,1× contra 4,5×. Es
  // el mismo mecanismo del puente área→raíz que ya se probó y se revirtió en este archivo.
  // El padre se cuelga de sus HIJOS, nunca del centro.
  {
    const hayArea = new Set(nodos.filter((n) => n.id.startsWith('area:')).map((n) => n.id.slice(5)));
    for (const p of NIVEL1) {
      const areasDelPadre = AREAS.filter((a) => a.padre === p.id);
      const conNodo = areasDelPadre.filter((a) => hayArea.has(a.id));
      // Un padre con menos de dos hijos NO se dibuja: sería un nodo de grado 1, o sea una
      // hoja nueva — justo el número que esta jerarquía viene a bajar. En el ZIP la
      // carpeta sí existe aunque tenga un solo archivo: una carpeta con un archivo es
      // normal en un explorador, una hoja en un force layout rompe una métrica. Las dos
      // asimetrías son a propósito.
      //
      // Y el padre ADOPTA a los huérfanos: si un área de su grupo no llegó a tener nodo
      // propio (porque tiene un solo miembro), sus miembros se cuelgan directo del padre.
      // Así ningún tipo de dato queda fuera del árbol y no se estrena ninguna hoja.
      const sueltos = areasDelPadre
        .filter((a) => !hayArea.has(a.id))
        .flatMap((a) => nodos.filter((n) => n.area === a.id && n.id !== RAIZ && n.autoria !== 'pendiente' && !n.id.startsWith('area:')).map((n) => n.id));
      if (conNodo.length + sueltos.length < 2) continue;
      const idPadre = push({
        id: `n1:${p.id}`,
        // El área del padre es la de su PRIMERA hija: hereda su color, así el racimo
        // entero se lee de un tono. No se inventa un color número once — el catálogo de
        // `--grafo-*` tiene tope de diez por un motivo medido.
        area: areasDelPadre[0].id,
        etiqueta: p.nombre,
        detalle: p.que,
        fuente: `${conNodo.length + sueltos.length} partes de tu negocio`,
        autoria: 'mako',
      });
      for (const a of conNodo) unir(`area:${a.id}`, idPadre, `${a.nombre} es parte de ${p.nombre}`);
      for (const m of sueltos) unir(m, idPadre, `Esto es parte de ${p.nombre}`);
    }
  }

  // 🚨 DESDE EL 20/10/2026 UN ÁREA SUELTA SÍ ES UN BUG (Martín: «En ningún caso jamás los cerebros se deben dividir en
  //    2»). Lo de abajo es lo que se pensaba hasta ese día y queda como registro: el umbral del hub (4,5×) es una receta
  //    de dibujo y la regla de Martín le gana. Cada racimo suelto se engancha a la raíz por su nodo más estructural
  //    (`puentesARaiz`, lib/cerebro-union.ts), justo antes del layout.
  // ⚠️ UN ÁREA SUELTA DEL RESTO DEL MAPA NO ES UN BUG, Y SE INTENTÓ «ARREGLAR».
  // Un área se engancha al resto solo por las aristas laterales de sus miembros; si
  // ninguno tiene una —pasa en un workspace que nunca contestó el quiz de personalidad:
  // sin el nodo `voz`, los audios y el vocabulario quedan colgando solo de su área— el
  // racimo queda flotando al lado. Se probó tender un puente del nodo de área a la raíz.
  // NO va, por dos razones medidas:
  //   · `scripts/medir-grafo.mjs` NO marca `componentes` como falla, y su propio
  //     comentario dice que «las islas son parte del look de Obsidian». No había nada
  //     que arreglar.
  //   · El puente le suma radios a la raíz: con él, el hub de un workspace real pasó de
  //     4,3× a 4,6× contra un umbral de 4,5×. O sea que el arreglo de un no-problema
  //     rompió un umbral que sí existe.
  // Y además la isla DICE algo cierto: esa parte del negocio todavía no se conecta con
  // el resto.

  // ── Lo que MaKo todavía no sabe, DICHO y no dibujado (18/10/2026) ───────────────
  // Martín (18/10/2026): los nodos del «Negocio» «se deben siempre ajustar a lo que MaKo sepa... No tengas miedo en quitarle
  // nodos, o agregarles. Si les falta info ya la irán completando». Hasta hoy cada sección sin un dato dibujaba un nodo
  // `falta:<área>` colgado de la raíz: once casillas de una estructura fija, iguales para todos los negocios, que llenaban
  // el mapa de lo que NO hay. Ahora un área sin datos no tiene nodo: se dice en la raíz («Todavía sin info», en su hover) y
  // en la barra lateral, donde cada sección sigue con su «falta» y su «Editar». Un dato nuevo aparece solo, donde corresponde.
  const conNodos = new Set(nodos.filter((n) => n.id !== RAIZ && n.autoria !== 'pendiente').map((n) => n.area));
  const vacias: AreaId[] = AREAS.filter((a) => !conNodos.has(a.id)).map((a) => a.id);
  if (vacias.length) {
    const raiz = nodos.find((n) => n.id === RAIZ);
    if (raiz) {
      raiz.datos = [...(raiz.datos ?? []), {
        k: 'Todavía sin info',
        v: AREAS.filter((a) => vacias.includes(a.id)).map((a) => a.nombre).join(' · '),
      }];
    }
  }

  // Los nodos de ÁREA no cuentan: el panel dice «MaKo entendió N cosas de tu negocio»
  // y un área no es una cosa entendida, es la caja donde viven varias.
  const esArea = (n: NodoCerebro) => n.id.startsWith('area:');
  const reales = nodos.filter((n) => n.autoria !== 'pendiente' && !esArea(n));
  // UN cerebro, nunca dos: todo lo que quedó suelto cuelga de la raíz (ver arriba, 20/10/2026).
  aristas.push(...puentesARaiz(nodos, aristas, RAIZ));
  return {
    negocio: negocio || 'Tu negocio',
    nodos,
    aristas,
    cuenta: {
      total: reales.length,
      mako: reales.filter((n) => n.autoria === 'mako').length,
      usuario: reales.filter((n) => n.autoria === 'usuario').length,
      pendientes: nodos.filter((n) => n.autoria === 'pendiente').length,
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
