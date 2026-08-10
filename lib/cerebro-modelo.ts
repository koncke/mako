// =============================================================================
// cerebro-modelo — la FORMA del grafo del negocio (tipos + las diez áreas)
// =============================================================================
// DATOS PUROS a propósito: **sin `server-only` y sin un solo import de otro
// módulo**. Lo consumen las dos puntas — el constructor server-side
// (lib/cerebro-grafo.ts) y el componente que lo dibuja en el browser
// (app/second-brain/Grafo.tsx) — y ese es exactamente el motivo de que exista
// separado, igual que `lib/capas.ts` y `lib/angulos-data.ts`.
//
// El día que esto viva en el mismo archivo que el constructor, el componente
// cliente arrastra al bundle del browser toda la cadena
// cerebro-grafo → productos → workspace → auth → next/headers, y la compilación
// se cae con «You're importing a module that depends on next/headers». No es
// hipotético: pasó al escribirlo, y el typecheck NO lo ve — `tsc --noEmit` da
// verde porque los tipos son correctos; lo que rompe es el grafo de imports.
// La única red que lo caza es levantar la página.
// =============================================================================

/** Las diez áreas del negocio. El orden ES el orden del reloj en el lienzo, y no
 *  es arbitrario: sigue el recorrido del onboarding, así que el mapa terminado se
 *  lee como la historia de cómo se construyó.
 *
 *  ⚠️ EL `nombre` DE UN ÁREA SE CAMBIA EN DOS ARCHIVOS: acá y en `CARPETA` de
 *  lib/vault.ts, que es como se llama la carpeta adentro del ZIP. Si se toca uno solo,
 *  la pantalla dice «Avatares» y el ZIP sigue trayendo «08 Segmentos» — y nadie lo ve
 *  hasta que un cliente abre el vault.
 *
 *  ⚠️ Los `que` son user-facing por partida DOBLE: son el subtítulo de cada opción en
 *  el modal de exportación y el renglón de cada carpeta en el README del ZIP. No son
 *  comentarios internos.
 *
 *  Y no llevan números adentro («los TRES segmentos», «sus SEIS planos»): un cliente
 *  con cuatro avatares leía un texto que le mentía. */
/**
 * LAS CINCO CARPETAS MADRE. Juntas forman una frase: «este NEGOCIO vende esta OFERTA a
 * este MERCADO diciéndole este MENSAJE por este FUNNEL».
 *
 * ⚠️ TRES DE LOS CINCO NOMBRES QUE SE PROPUSIERON NO ENTRARON, y el motivo es
 * verificable, no una opinión de estilo. «CRM» y «Closing» son PANTALLAS DEL PRODUCTO,
 * no cosas que MaKo entendió del negocio: `construirCerebro()` hace 21 lecturas y NINGUNA
 * es de closing, y lo único que roza al CRM es el catálogo de productos —cuya propia
 * fuente dice «del catálogo que arma el CRM», o sea el catálogo de la OFERTA que el CRM
 * consume—. Las dos carpetas saldrían VACÍAS en los cuatro workspaces vivos, y una
 * carpeta de nivel 1 vacía es lo primero que ve el cliente al abrir el ZIP. «Ads» tampoco:
 * lo que caería debajo no son anuncios sino su insumo (avatares, razones, formatos, voz),
 * y el mapa no tiene un solo nodo de un anuncio real.
 *
 * LA REGLA QUE QUEDA: el nombre de una carpeta del segundo cerebro tiene que sobrevivir a
 * un rediseño de MaKo. Si mañana la tab «CRM» se llama «Ventas», la carpeta del cliente
 * NO cambia de nombre — sus datos no cambiaron. El precedente ya está en el repo:
 * `AreasHub.tsx` documenta que la taxonomía se unificó a la del grafo justamente porque
 * «el mapa decía Lead Magnet y la tab decía otra cosa».
 */
export const NIVEL1 = [
  { id: 'negocio', n: 1, nombre: 'Negocio', que: 'En qué fase estás, qué te frena y de dónde salió todo.' },
  { id: 'oferta', n: 2, nombre: 'Oferta', que: 'Qué vendes, a cuánto y qué garantizas.' },
  { id: 'mercado', n: 3, nombre: 'Mercado', que: 'A quién le vendes.' },
  { id: 'mensaje', n: 4, nombre: 'Mensaje', que: 'Qué le dices y cómo suenas.' },
  { id: 'funnel', n: 5, nombre: 'Funnel', que: 'Por dónde pasa un lead hasta comprar.' },
] as const;

export type Nivel1Id = (typeof NIVEL1)[number]['id'];

/**
 * Las áreas del negocio: el NIVEL 2 del árbol. `padre` dice de qué carpeta madre cuelga y
 * `n` las ordena adentro de ella — el orden es narrativo, no alfabético, y sin el número
 * el explorador de archivos lo destruye.
 *
 * ⚠️ EL `nombre` SE CAMBIA EN UN SOLO LUGAR: acá. Las carpetas del ZIP se DERIVAN de
 * `padre` + `n` + `nombre` (ver lib/vault-modelo.ts). Antes había una segunda tabla con
 * los nombres escritos a mano y se quedaba vieja sin que nada avisara.
 *
 * ⚠️ El `id` de un padre y el de un área pueden coincidir (`oferta`, `funnel`). Los ids de
 * NODO no pueden: el nivel 1 usa el prefijo `n1:` y el nivel 2 `area:`. Este repo ya pagó
 * una vez «dos nodos con el mismo id» y el síntoma fue silencioso.
 */
// ⚠️ LOS NOMBRES SON LOS QUE EL CLIENTE YA CONOCE DE LA APP, no unos inventados acá.
// «Norte» y «Panorama» eran vocabulario interno: en la pantalla el cliente ve
// «Diagnóstico» y «Resumen». Un mapa que dice «todo lo que MaKo sabe de tu negocio» no
// puede estrenar palabras — si el nombre no coincide con el de la tab que abre, el mapa
// deja de ser un mapa de lo suyo y pasa a ser un segundo índice que hay que aprender.
export const AREAS = [
  { id: 'norte', n: 1, padre: 'negocio', nombre: 'Diagnóstico de negocio', color: 'var(--grafo-norte)', que: 'En qué fase está tu negocio y qué lo frena.' },
  { id: 'panorama', n: 2, padre: 'negocio', nombre: 'Resumen del negocio', color: 'var(--grafo-panorama)', que: 'Lo que MaKo entendió de tu negocio, sección por sección.' },
  { id: 'documentos', n: 3, padre: 'negocio', nombre: 'Documentos', color: 'var(--grafo-documentos)', que: 'Lo que soltaste en el Archivero y MaKo leyó.' },
  { id: 'oferta', n: 1, padre: 'oferta', nombre: 'La oferta', color: 'var(--grafo-oferta)', que: 'Tu oferta principal: qué prometes, a cuánto y qué garantizas.' },
  { id: 'productos', n: 2, padre: 'oferta', nombre: 'Productos', color: 'var(--grafo-productos)', que: 'El catálogo que usa el CRM para cargar cada venta, con su precio.' },
  { id: 'entregables', n: 3, padre: 'oferta', nombre: 'Lead Magnet', color: 'var(--grafo-entregables)', que: 'El elemento tangible que hace deseable la oferta.' },
  { id: 'cliente', n: 1, padre: 'mercado', nombre: 'Cliente ideal', color: 'var(--grafo-cliente)', que: 'Tu cliente ideal: qué le duele, qué quiere y qué objeta.' },
  { id: 'avatares', n: 2, padre: 'mercado', nombre: 'Avatares', color: 'var(--grafo-avatares)', que: 'Los públicos distintos a los que le vendes, separados para segmentarlos en Meta.' },
  { id: 'razones', n: 1, padre: 'mensaje', nombre: 'Razones', color: 'var(--grafo-razones)', que: 'Por qué te compra cada avatar. Cada razón es un anuncio distinto.' },
  { id: 'voz', n: 2, padre: 'mensaje', nombre: 'Voz y cara', color: 'var(--grafo-voz)', que: 'Cómo suena tu marca y qué cara le pones a tus anuncios.' },
  // El funnel deja de vivir adentro de «Norte» y se hace área propia. No es cosmético:
  // medido, con las 11-13 etapas ahí adentro el color del Norte era el DOMINANTE del mapa
  // (19% en un workspace, 26% en dos, 58% en el más chico), y en el ZIP la carpeta «01
  // Norte» tenía 13 de 15 archivos bajo una descripción que dice «en qué fase estás».
  { id: 'funnel', n: 1, padre: 'funnel', nombre: 'El funnel', color: 'var(--grafo-funnel)', que: 'Las etapas por las que pasa un lead hasta comprar.' },
] as const;

/**
 * Cómo se dice en castellano de dónde salió un dato. Lo dicen los dos: el panel del
 * grafo y el frontmatter de cada archivo del ZIP.
 *
 * ⚠️ VIVE ACÁ Y NO EN `lib/vault.ts`, que sería su casa natural, por una razón que el
 * typecheck NO ve: `vault.ts` lleva `server-only`, y `Grafo.tsx` es un componente de
 * cliente. Importarlo desde ahí compila perfecto y revienta en el navegador con un 500
 * («You're importing a module that depends on server-only»). Este módulo es puro a
 * propósito —no importa nada— justamente para poder ser el lugar común de las dos
 * orillas. Ya pasó una vez; no hace falta que pase otra.
 */
export const AUTORIA_TEXTO: Record<NodoCerebro['autoria'], string> = {
  mako: 'lo dedujo MaKo',
  usuario: 'lo escribiste tú',
  pendiente: 'todavía no existe',
};

/** El color de grupo de un área. Los tokens `--grafo-*` viven en app/globals.css y
 *  solo se usan adentro del lienzo del grafo: los semánticos de la app no sirven ahí
 *  porque quedan por debajo del gris base en contraste. */
export const colorArea = (id: AreaId): string =>
  AREAS.find((a) => a.id === id)?.color ?? 'var(--sidebar-text)';

export type AreaId = (typeof AREAS)[number]['id'];

/** Quién puso este nodo. Es la única dimensión de color permanente del lienzo:
 *  un borde, nunca un relleno — «un filo de 3 px alcanza; fondos de color
 *  distinto son una bolsa de caramelos» (la regla ya escrita en ui.css). */
export type Autoria = 'mako' | 'usuario' | 'pendiente';

export type NodoCerebro = {
  id: string;
  area: AreaId;
  /** Lo que se dibuja al lado del punto. Corto: es una etiqueta, no una frase. */
  etiqueta: string;
  /** El hover: qué es esto, en las palabras del propio dato cuando se puede. */
  detalle: string;
  /** De dónde salió. Vacío solo si de verdad no se sabe. */
  fuente: string;
  autoria: Autoria;
  /** El Norte: el único nodo dorado permanente del mapa. */
  destacado?: boolean;
  /** El cuello de botella: naranja de warning, porque es lo que hay que mover. */
  alerta?: boolean;
  /**
   * Los DATOS del nodo, como pares nombre/valor.
   *
   * ⚠️ EXISTE PORQUE `detalle` ERA UN STRING PLANO, y esa era la causa raíz de que los
   * textos del panel fueran pobres: todos los productores armaban el detalle con
   * `.join(' · ')`, así que cada uno tenía que elegir entre TIRAR campos o escribir un
   * renglón corrido ilegible — y eligieron tirar. Contado sobre las lecturas, se
   * descartaban campos reales en 11 de los 17 tipos de nodo, y el peor caso —la fase—
   * usaba UNO de sus quince.
   *
   * Un par se muestra solo si tiene valor: nada se dibuja vacío.
   */
  datos?: Array<{ k: string; v: string }>;
  /** Prosa larga: se muestra plegada y con «Leer todo». Es para lo que no entra en un
   *  par nombre/valor — un plano del panorama, el razonamiento de un documento. */
  cuerpo?: string;
  /** Solo en los nodos de documento. El panel lo necesita para elegir el visor: un PDF
   *  se muestra en un iframe, una imagen como imagen, y lo demás no se previsualiza.
   *  Sin esto el panel tendría que adivinar por la extensión — y la etiqueta viene
   *  recortada, así que ni extensión hay. */
  mime?: string | null;
};

/** Una arista se dibuja solo si SIGNIFICA algo verificable. `motivo` es lo que se
 *  lee al pasar por encima; si no se puede escribir, la arista no va. */
export type AristaCerebro = { de: string; a: string; motivo: string };

/**
 * El radio del nodo, en unidades de mundo. Es la fórmula de Obsidian tal cual:
 * `max(8, min(3·√(grado+1), 30))`.
 *
 * Vive acá y no en el layout porque la consumen las DOS puntas —la colisión del
 * servidor y el dibujo del cliente— y cuando estaba escrita dos veces, cada archivo
 * llevaba un comentario avisando que si divergían los nodos se pisaban. Eso es la
 * definición de «una cosa, un lugar».
 *
 * El piso de 8 domina hasta grado 6, así que el mapa queda casi uniforme en tamaño:
 * una hoja mide 8,0 y un hub de grado 14 mide 11,6. Eso es a propósito y es lo que
 * hace que un grafo de Obsidian se vea como se ve — la jerarquía la dan la POSICIÓN
 * y el color, no el diámetro. La versión anterior daba un rango de 3,4× (con el
 * `pendiente` en 3,5) y producía un mapa de burbujas de tamaños dispares.
 */
export function radioNodo(grado: number): number {
  return Math.max(8, Math.min(3 * Math.sqrt(grado + 1), 30));
}

export type Punto = { x: number; y: number };
/** El cuadrado del mundo que hay que mirar. Sale del bbox de las posiciones ya
 *  asentadas, no es fijo: un negocio con 12 nodos y otro con 300 se ven igual de bien. */
export type Encuadre = { x: number; y: number; lado: number };

export type Cerebro = {
  negocio: string;
  nodos: NodoCerebro[];
  aristas: AristaCerebro[];
  cuenta: { total: number; mako: number; usuario: number; pendientes: number };
  /** Las áreas que todavía no tienen un solo nodo real. */
  vacias: AreaId[];
  /**
   * Dónde va cada nodo. Se calcula EN EL SERVIDOR con d3-force (lib/cerebro-layout.ts)
   * y viaja como números: así el motor de física nunca entra al bundle del browser.
   */
  posiciones: Record<string, Punto>;
  encuadre: Encuadre;
};
