// =============================================================================
// crear/tipo — QUÉ se crea (landing o presentación) y lo que eso cambia al crear
// =============================================================================
// Pedido de Martín (11/10/2026, tanda 2, punto 6), textual: «Al momento de crear nuevo tengo
// que elegir si crear landing, presentación... Sería bueno que ahí aparezcan los templates
// (deberías hacer más templates de presentaciones)... Y también quiero ahí mismo agregar la
// funcionalidad que tenemos en "nueva automatización", donde le escribo a la IA o le mando un
// audio, pero me gusta el formato que hiciste de "¿Qué vas a crear hoy?", solo falta agregar
// la funcionalidad de dictarle con audio, como lo tenemos en donde te mencioné.»
// Decisión T4 de docs/diseno-editor-landing.md.
//
// Lo PURO de elegir el tipo, en un módulo sin 'use client' para que tenga test
// (tests/editor-landing-crear.test.ts): la caja del Panel (CajaCrear.tsx) y el generador
// (crear/CrearConIA.tsx) lo llaman tal cual, así las dos puertas crean lo MISMO.
//
// ⚠️ UNA PRESENTACIÓN CREADA SIN `formato` NACE COMO PÁGINA: `sanearConfig` completa lo que
//    falta con 'pagina' y nada avisa. Por eso el `config` del alta sale SIEMPRE de
//    `configDeCreacion` / `pedidoDePlantilla`, nunca de un objeto armado en la pantalla.
// ⚠️ Y `params.formato` es lo único que le dice a la IA que escriba diapositivas (ia.ts lo lee
//    del pedido CRUDO: `normalizarParams` no lo conoce). Todo pedido de esquema y de secciones
//    pasa por `paramsDeTipo`; si uno se olvida, esa tanda sale con el copy largo de una landing.
// =============================================================================

import {
  terminoTarjeta, type ConfigLanding, type FormatoDoc, type ParamsGeneracion, type PedidoDocs, type Proporcion,
} from '@/lib/editor-landing/api-tipos';
import type { LandingContenido } from '@/lib/editor-landing/doc';
import { PLANTILLAS } from '@/lib/editor-landing/plantillas';
import { PLANTILLAS_PRESENTACION } from '@/lib/editor-landing/plantillas-presentaciones';
import { PLANTILLAS_CARRUSEL, PROPORCION_CARRUSEL } from '@/lib/editor-landing/plantillas-carrusel';
import { DISENOS_LANDING, landingDesde } from '@/lib/editor-landing/disenos-landing';

/**
 * «Carrusel» (6/11/2026): el pedido de Leila TRES veces (2.14 / 3.9 / 4.10 de la auditoría del
 * 5/11). No es un formato nuevo: es una PRESENTACIÓN de 4:5, lo que api-tipos.ts ya sabía desde
 * `cd0f4811e`. Lo que faltaba era ofrecerla acá, al crear, con las plantillas de carrusel de MaKo
 * (lib/editor-landing/plantillas-carrusel.ts, derivadas de lib/carruseles/tipos.ts): hasta hoy
 * había que crear una presentación 16:9 y cambiarle la relación de aspecto a mano.
 */
export const TIPOS_CREAR = ['landing', 'presentacion', 'carrusel'] as const;
export type TipoCrear = (typeof TIPOS_CREAR)[number];

/** El tipo de la query (`?tipo=presentacion`, `?tipo=carrusel`); cualquier otra cosa es una landing. */
export function tipoValido(v: string | null | undefined): TipoCrear {
  return v === 'presentacion' || v === 'carrusel' ? v : 'landing';
}

/** El formato del documento que crea cada tipo (api-tipos.ts, T3). Un carrusel es una presentación. */
export const formatoDeTipo = (t: TipoCrear): FormatoDoc => (t === 'landing' ? 'pagina' : 'presentacion');

/** La proporción con la que nace una presentación de la IA (la de Gamma por default). */
export const PROPORCION_IA: Proporcion = '16:9';

/**
 * La forma con la que NACE cada tipo. Un carrusel es 4:5 desde el alta: si naciera 16:9, la
 * persona tendría que ir a Configuración a cambiarla, que es exactamente lo que Leila pidió que
 * no hubiera que hacer.
 */
export const proporcionDeTipo = (t: TipoCrear): Proporcion => (t === 'carrusel' ? PROPORCION_CARRUSEL : PROPORCION_IA);

/** Rótulo de la pastilla y nombre del documento en las frases de la pantalla. */
export const NOMBRE_TIPO: Record<TipoCrear, string> = { landing: 'Landing', presentacion: 'Presentación', carrusel: 'Carrusel' };
// `capas` es el carrusel: láminas apiladas que se deslizan. No hay ícono «carrusel» en el
// catálogo (lib/editor-landing/iconos.ts) y `svgIcono` con un nombre que no existe devuelve un
// hueco SIN avisar: el test exige que los tres estén en `NOMBRES_ICONO`.
export const ICONO_TIPO: Record<TipoCrear, string> = { landing: 'paginas', presentacion: 'presentar', carrusel: 'capas' };

/** «landing» / «presentación» / «carrusel», en minúscula, para el medio de una frase. */
export const docDe = (t: TipoCrear): string => (t === 'presentacion' ? 'presentación' : t);

/**
 * ⚠️ «Carrusel» es la primera palabra MASCULINA de la pantalla: hasta el 6/11/2026 las dos eran
 * femeninas y las frases tenían «la» y «generada» escritos a mano («La landing no se creó»,
 * «Presentación generada»). Con un tipo masculino eso sale «La carrusel no se creó». De acá
 * salen el artículo y el participio: si mañana entra «video» o «post», concuerdan solos.
 */
const GENERO_TIPO: Readonly<Record<TipoCrear, 'f' | 'm'>> = { landing: 'f', presentacion: 'f', carrusel: 'm' };

/** «la landing» · «el carrusel» (con `Mayuscula` para arrancar una frase). */
export function elDocDe(t: TipoCrear, op: { mayuscula?: boolean } = {}): string {
  const art = GENERO_TIPO[t] === 'm' ? 'el' : 'la';
  return `${op.mayuscula ? art[0].toUpperCase() + art.slice(1) : art} ${docDe(t)}`;
}

/** «esta landing» · «este carrusel». */
export const esteDocDe = (t: TipoCrear): string => `${GENERO_TIPO[t] === 'm' ? 'este' : 'esta'} ${docDe(t)}`;

/** La raíz de un participio concordada: `participio('carrusel', 'generad')` → «generado». */
export const participio = (t: TipoCrear, raiz: string): string => `${raiz}${GENERO_TIPO[t] === 'm' ? 'o' : 'a'}`;

/** «Landing» · «Presentación» · «Carrusel» para arrancar una frase. */
export const DocDe = (t: TipoCrear): string => NOMBRE_TIPO[t];

/**
 * «sección», «diapositiva» o «lámina» (con `plural` y `mayuscula`): es `terminoTarjeta` de
 * api-tipos, la MISMA palabra que dice el editor, así crear y editar no llaman distinto a lo
 * mismo. La proporción va porque de ella sale «lámina» (un carrusel es una presentación de 4:5).
 */
export function termino(t: TipoCrear, op: { plural?: boolean; mayuscula?: boolean } = {}): string {
  return terminoTarjeta({ formato: formatoDeTipo(t), proporcion: proporcionDeTipo(t) }, op);
}

/** «8 secciones» / «1 diapositiva». */
export function cuantas(n: number, t: TipoCrear): string {
  return `${n} ${termino(t, { plural: n !== 1 })}`;
}

/**
 * Los parámetros que viajan a la IA. Con una presentación, `formato` pide diapositivas, y la
 * landing de base («Sobre cuál») se suelta: el diagnóstico de una PÁGINA no es contexto de una
 * presentación, y se lo mandaría al prompt sin que la pantalla lo muestre. Con una landing,
 * `formato: 'pagina'` explícito: si la persona volvió de Presentación, no queda pegado.
 */
export function paramsDeTipo(p: ParamsGeneracion, t: TipoCrear): ParamsGeneracion {
  // La proporción se SACA primero: es lo único que distingue un carrusel (4:5, láminas cortas) de
  // una presentación (16:9) para la IA (ia.ts lee las dos del pedido crudo), y en una landing no
  // existe. Si la persona volvió de Carrusel, no puede quedar pegada.
  const { proporcion: _fuera, ...resto } = p;
  return t === 'landing'
    ? { ...resto, formato: 'pagina', basadoEnUrl: p.basadoEnUrl }
    : { ...resto, formato: 'presentacion', proporcion: proporcionDeTipo(t), basadoEnUrl: null };
}

/** El `config` con el que nace un documento de la IA: el tema, el origen, su formato y su forma. */
export function configDeCreacion(t: TipoCrear, tema: string, origen: NonNullable<ConfigLanding['origen']>): Partial<ConfigLanding> {
  return t === 'landing'
    ? { tema, origen, formato: 'pagina' }
    : { tema, origen, formato: 'presentacion', proporcion: proporcionDeTipo(t) };
}

/** Lo común de las plantillas de landing y de presentación (la misma forma, T3). */
export type PlantillaCrear = {
  id: string;
  nombre: string;
  descripcion: string;
  tema: string;
  contenido: () => LandingContenido;
  /** Sólo las de presentación: viene en la plantilla y viaja al `config`. */
  formato?: FormatoDoc;
  proporcion?: Proporcion;
  /** Un DISEÑO de landing: al tocarlo se pregunta «¿De qué quieres crearla?» (el objetivo = el copy). */
  pideObjetivo?: boolean;
};

/** Las plantillas que se ofrecen debajo de la caja, según el tipo elegido. */
export function plantillasDe(t: TipoCrear): readonly PlantillaCrear[] {
  // Las de carrusel son las de MaKo (lib/carruseles/tipos.ts) traducidas a este editor: la MISMA
  // estructura que en Imagen, no una copia (plantillas-carrusel.ts).
  if (t === 'carrusel') return PLANTILLAS_CARRUSEL;
  // En una landing se ofrecen DISEÑOS, no copys (feedback de Martín, 12/10: «confundiste la plantilla
  // de DISEÑO, con el COPY»). La miniatura se dibuja con el copy de «Agenda una llamada».
  return t === 'presentacion' ? PLANTILLAS_PRESENTACION : DISENOS_LANDING.map((d) => ({
    id: d.id, nombre: d.nombre, descripcion: d.descripcion, tema: d.tema, pideObjetivo: true,
    contenido: () => landingDesde(d, 'agenda-llamada') ?? PLANTILLAS[0].contenido(),
  }));
}

/** El alta de un DISEÑO con el objetivo elegido: el copy del objetivo vestido con el diseño. */
export function pedidoDeDiseno(p: PlantillaCrear, objetivo: string): Extract<PedidoDocs, { accion: 'crear' }> | null {
  const d = DISENOS_LANDING.find((x) => x.id === p.id);
  const contenido = d ? landingDesde(d, objetivo) : null;
  const obj = PLANTILLAS.find((x) => x.id === objetivo);
  if (!d || !contenido || !obj) return null;
  const config: Partial<ConfigLanding> = { tema: d.tema, formato: 'pagina', origen: { modo: 'plantilla', plantilla: `${d.id}:${objetivo}` } };
  return { accion: 'crear', titulo: obj.nombre, contenido, config };
}

/**
 * El alta de una plantilla. El formato y la proporción salen de la PLANTILLA (las de
 * presentación los traen): una presentación sin ellos nacería como página.
 */
export function pedidoDePlantilla(p: PlantillaCrear): Extract<PedidoDocs, { accion: 'crear' }> {
  const origen = { modo: 'plantilla' as const, plantilla: p.id };
  const config: Partial<ConfigLanding> = p.formato === 'presentacion'
    ? { tema: p.tema, origen, formato: 'presentacion', proporcion: p.proporcion ?? PROPORCION_IA }
    : { tema: p.tema, origen, formato: 'pagina' };
  return { accion: 'crear', titulo: p.nombre, contenido: p.contenido(), config };
}

// Tanda 6 (14/10/2026): se fueron `rutaCaja` y `rutaPaso`. Martín: «La sección de "Importar con IA" no
// debería ser otra ruta, todo siempre en la misma ruta». La caja ya no navega a /web-generator/crear:
// «Crear con IA» se abre a la derecha del Panel con el pedido EN MEMORIA (`ArranqueIA`, ../panel-reglas.ts),
// y /web-generator/crear redirige al Panel con su query (`destinoCrear`).

/**
 * Los ejemplos que se escriben solos en la caja (`useEjemploQueSeEscribe`). GENÉRICOS a
 * propósito: un nombre de negocio o de persona real en la pantalla de otro cliente se lee como
 * un dato (AGENTS.md, «un ejemplo de UI es ficticio por regla»).
 */
export const EJEMPLOS_CAJA: Record<TipoCrear, readonly string[]> = {
  landing: [
    'Una landing para agendar una llamada de diagnóstico',
    'El registro a un webinar en vivo sobre finanzas personales',
    'La venta de un curso online con precio y garantía',
    'Una guía gratis a cambio del correo',
    'La lista de espera para el lanzamiento de una app',
  ],
  presentacion: [
    'El pitch de mi negocio para inversionistas',
    'Una propuesta comercial para un cliente nuevo',
    'El informe mensual de resultados de marketing',
    'Una clase de un curso sobre ventas por WhatsApp',
    'El onboarding para un cliente que empieza',
  ],
  carrusel: [
    '5 errores que cometen al cobrar sus servicios',
    'Paso a paso para agendar más llamadas esta semana',
    'El mito de que hay que publicar todos los días',
    'Antes y después de ordenar el seguimiento',
    'Las 3 preguntas que me hacen antes de comprar',
  ],
};
