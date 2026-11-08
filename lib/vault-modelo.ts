// =============================================================================
// vault — el segundo cerebro proyectado a carpetas y archivos markdown
// =============================================================================
// El pedido fue «trabajalo como lo hace Obsidian, que son carpetas y archivos».
// Esto es eso, con una decisión explícita de hasta dónde:
//
//   · el árbol es una PROYECCIÓN sobre las filas que ya existen (navegación),
//   · el ZIP es la MATERIALIZACIÓN de esa proyección (exportación),
//   · las filas SIGUEN SIENDO FILAS (no cambia el almacenamiento).
//
// ⚠️ POR QUÉ NO SE MUEVE TODO A MARKDOWN, con la cicatriz pagada en este repo:
// `seccionesPanorama` en lib/cerebro-grafo.ts documenta que el parser del panorama
// descartaba 5 de 6 secciones EN SILENCIO y solo en un workspace, porque buscaba
// títulos literales sobre un texto que una versión anterior había escrito con otro
// molde. El panorama es el ÚNICO dato del second brain que hoy se guarda como
// markdown, y es el único que perdió el 83% de su contenido sin que nada avisara.
// Mover `productos` —con el que el CRM cierra ventas— a .md repite ese experimento
// sobre las filas que sostienen el negocio: se pierden el JOIN, la suma, las RLS por
// workspace y la concurrencia de dos personas editando lo mismo.
//
// Y el punto que destraba «la info que pones es muy limitada»: **no es un problema de
// almacenamiento, es de COBERTURA.** `construirCerebro()` hace doce lecturas y el
// sistema tiene ~70 tablas por workspace. Cambiar el motor de guardado suma cero
// archivos; ensanchar el lector los suma todos. El árbol es lo que hace navegable esa
// data cuando entre.
//
// LA DISTINCIÓN QUE HACE POSIBLE TODO, y que antes no existía: el GRAFO dibuja
// identidad y se queda chico y legible; el ÁRBOL navega todo y puede tener miles de
// archivos; el ZIP se lleva el árbol entero. Eran la misma cosa y no lo son.
// =============================================================================

// ⚠️ ESTE MÓDULO NO LLEVA `server-only`, Y ES A PROPÓSITO. Todo lo de acá es una
// proyección PURA sobre el cerebro —nombres de archivo, carpetas, frontmatter, el
// README— y no toca ni la base ni el request. Con la marca puesta, ningún test lo podía
// importar, y eso no es teórico: el README que va ADENTRO del ZIP contaba mal desde
// siempre —«5 archivos» en una carpeta con 3— porque filtraba a mano en vez de usar
// `conteoPorArea`, y no había una sola prueba que lo pudiera mirar. Se descubrió
// abriendo el ZIP a mano. Es la misma regla que AGENTS.md fija para los guards
// destructivos y para el catálogo de modelos: lo que hay que poder testear no vive
// detrás de `server-only`.
//
// El que sí la lleva es `lib/vault.ts`, que reexporta todo esto: los importadores de
// siempre no cambian y la guarda de bundle se mantiene donde estaba.

import { AREAS, NIVEL1, AUTORIA_TEXTO, type AreaId, type Cerebro, type NodoCerebro } from './cerebro-modelo';

export type Archivo = { ruta: string; texto: string };

/** Nombre de archivo seguro y legible. Mismo criterio que el `slug` del export del
 *  plan, pero conservando mayúsculas: un vault se lee con los ojos. */
export function nombreSeguro(s: string, max = 60): string {
  return (s || 'sin-nombre')
    // El «…» del recorte de la etiqueta se va antes que nada: las etiquetas del grafo
    // vienen truncadas a 26-34 caracteres y ese carácter en un nombre de archivo es
    // feo, y se comporta distinto según el sistema de archivos.
    .replace(/…/g, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[<>:"/\\|?*\u0000-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max) || 'sin-nombre';
}

/** El frontmatter de Obsidian. Los valores van tal cual salvo los que llevan dos
 *  puntos o saltos, que van entre comillas: sin eso el YAML se rompe y Obsidian
 *  muestra la nota sin propiedades, en silencio. */
function frontmatter(props: Record<string, string | number | undefined>): string {
  const lineas = Object.entries(props)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => {
      const s = String(v);
      const necesitaComillas = /[:#\n"']/.test(s);
      return `${k}: ${necesitaComillas ? JSON.stringify(s.replace(/\n/g, ' ')) : s}`;
    });
  return lineas.length ? `---\n${lineas.join('\n')}\n---\n\n` : '';
}

/**
 * LA RUTA DE UN ÁREA, DERIVADA DEL ÁRBOL. Antes acá había una tabla con los diez nombres
 * escritos a mano, y era la segunda copia de algo que ya vivía en `AREAS`: renombrar un
 * área tocaba dos archivos y el que se olvidaba del segundo dejaba la pantalla diciendo
 * «Avatares» y el ZIP trayendo «08 Segmentos». Ahora sale de `padre` + `n` + `nombre`.
 *
 * Dos niveles de carpeta: «2 Oferta/1 La oferta/». El número ordena en el explorador —
 * sin él, el alfabético destruye el orden narrativo que eligió el catálogo.
 */
export const carpetaDe = (a: AreaId): string => {
  const area = AREAS.find((x) => x.id === a);
  if (!area) return '9 Otros';
  const padre = NIVEL1.find((p) => p.id === area.padre);
  if (!padre) return `9 Otros/${area.n} ${area.nombre}`;
  return `${padre.n} ${padre.nombre}/${area.n} ${area.nombre}`;
};

/** Solo la carpeta madre, para el índice del README. */
export const carpetaPadreDe = (a: AreaId): string => carpetaDe(a).split('/')[0];

/**
 * Un nodo → un archivo. El frontmatter lleva la PROCEDENCIA, que es lo que un vault
 * de Obsidian no tiene y acá sí: de dónde salió el dato y quién lo puso. Sin eso, al
 * abrir el archivo dentro de tres meses no hay forma de saber si lo escribió una
 * persona o lo dedujo un modelo.
 */
export function archivoDeNodo(n: NodoCerebro, cerebro: Cerebro, nombres?: Map<string, string>): Archivo {
  const area = AREAS.find((a) => a.id === n.area);
  // Los enlaces [[wiki]] son lo que hace que esto sea un vault y no una carpeta con
  // textos: al abrirlo en Obsidian, el grafo se rearma solo desde estos enlaces.
  const vecinos = cerebro.aristas
    .filter((e) => e.de === n.id || e.a === n.id)
    .map((e) => cerebro.nodos.find((x) => x.id === (e.de === n.id ? e.a : e.de)))
    .filter((x): x is NodoCerebro => !!x)
    // Solo los vecinos que SON un archivo. La raíz es el README y los nodos de área
    // son la carpeta, así que enlazarlos deja un `[[wiki]]` que no resuelve: en
    // Obsidian eso se pinta como un nodo fantasma y ensucia el grafo con cosas que no
    // existen — el opuesto exacto de lo que este export viene a mostrar.
    .filter((v) => (nombres ? nombres.has(v.id) : v.id !== 'raiz' && v.autoria !== 'pendiente' && !v.id.startsWith('area:')));

  // Los `datos` van como lista de definición: es markdown legible en cualquier editor y
  // Obsidian lo muestra igual. Sin esto el archivo diría MENOS que la pantalla, que es
  // lo peor que le puede pasar a un export cuyo argumento es «llevátelo».
  const pares = (n.datos ?? []).filter((d) => d.v && d.v.trim());

  const cuerpo = [
    `# ${n.etiqueta}`,
    '',
    n.detalle || '_Sin detalle._',
    '',
    ...(pares.length ? pares.map((d) => `- **${d.k}:** ${d.v}`).concat('') : []),
    ...(n.cuerpo ? [n.cuerpo, ''] : []),
    vecinos.length ? '## Conectado con' : '',
    // El nombre YA DESAMBIGUADO, no el crudo. Dos nodos pueden llamarse igual —hoy
    // ya pasa con «Oferta», que existe como campo y como plano del panorama— y sin
    // esto los dos enlaces apuntan al primero: un link que resuelve a un archivo
    // REAL pero equivocado, que es la peor forma de estar roto porque no se nota.
    ...vecinos.map((v) => `- [[${nombres?.get(v.id) ?? nombreSeguro(v.etiqueta)}]]`),
  ].filter((x) => x !== '').join('\n');

  return {
    ruta: `${carpetaDe(n.area)}/${nombreSeguro(n.etiqueta)}.md`,
    texto: frontmatter({
      area: area?.nombre ?? n.area,
      origen: AUTORIA_TEXTO[n.autoria],
      fuente: n.fuente || undefined,
      // Dónde se edita, cuando no es en el propio cerebro. Mismo hueco que tenía la búsqueda de
      // MaKo (lib/api-mako/areas/negocio.run.ts): el dato estaba y no salía por ningún lado.
      se_edita_en: n.abrirEn || (n.href ? n.href : undefined),
      conexiones: vecinos.length,
    }) + cuerpo + '\n',
  };
}

/** El README que explica el ZIP. Sin esto, alguien abre una carpeta con cincuenta
 *  .md sueltos y no sabe qué está mirando ni que se puede abrir con Obsidian. */
export function readme(cerebro: Cerebro, areas: AreaId[], ids?: Set<string>): Archivo {
  const incluidas = AREAS.filter((a) => areas.includes(a.id));
  return {
    ruta: 'README.md',
    texto: [
      `# ${cerebro.negocio}`,
      '',
      'Esto es tu segundo cerebro: todo lo que MaKo entendió de tu negocio, en archivos de texto.',
      '',
      'Cada archivo dice arriba de dónde salió el dato — si lo dedujo MaKo de un documento tuyo o si lo escribiste tú — y con qué otras cosas está conectado.',
      '',
      '## Cómo leerlo',
      '',
      'Los archivos son markdown: se abren con cualquier editor de texto. Si abres esta carpeta con [Obsidian](https://obsidian.md) vas a ver el mismo mapa que en MaKo, porque los enlaces entre archivos son los mismos.',
      '',
      '## Qué hay adentro',
      '',
      // Si se exportó un recorte, el README lo DICE. Sin esta línea, dentro de un mes
      // el que abra la carpeta no tiene forma de saber si le falta algo o si su negocio
      // era eso: un export parcial es indistinguible de un negocio incompleto.
      ...(ids ? ['> Este export es un recorte: solo lo que estabas viendo en el Second Brain cuando lo bajaste.', ''] : []),
      // ⚠️ El conteo sale de `conteoPorArea`, que aplica EXACTAMENTE el mismo filtro
      // que `construirVault`. Antes se filtraba acá a mano —solo por `autoria !==
      // 'pendiente'`— y se colaban los nodos de ÁREA y la RAÍZ, que no son archivos:
      // el README decía «5 archivos» en una carpeta con 3, y en la del Norte se iba de
      // dos porque ahí vive además la raíz. Un índice que cuenta distinto que la
      // carpeta que describe es peor que no tener índice.
      ...(() => { const c = conteoPorArea(cerebro, ids); return incluidas.map((a) => {
        const n = c[a.id] ?? 0;
        return `- **${carpetaDe(a.id)}** — ${a.que} (${n} ${n === 1 ? 'archivo' : 'archivos'})`;
      }); })(),
      '',
      `_Exportado el ${new Date().toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' })}._`,
      '',
    ].join('\n'),
  };
}

/**
 * El vault entero, filtrado por las áreas elegidas. Devuelve archivos en memoria: el
 * que arma el ZIP decide qué hacer con ellos.
 */
export function construirVault(cerebro: Cerebro, areas: AreaId[], ids?: Set<string>): Archivo[] {
  const elegidas = new Set(areas);
  // La raíz no es un archivo (es el README), lo «pendiente» tampoco (un archivo que
  // dice que está vacío es ruido), y los nodos de ÁREA son andamiaje del grafo: en el
  // árbol su papel lo cumple la carpeta.
  const entran = cerebro.nodos.filter((n) => esArchivo(n, ids) && elegidas.has(n.area));

  // PRIMERA PASADA: resolver los nombres. Dos nodos pueden llamarse igual —«Oferta»
  // existe hoy como campo y como plano del panorama— y hay que saber el nombre FINAL
  // de todos antes de escribir un solo enlace.
  const nombres = new Map<string, string>();
  const usados = new Set<string>();
  for (const n of entran) {
    const base = nombreSeguro(n.etiqueta);
    let nombre = base;
    let i = 2;
    while (usados.has(`${carpetaDe(n.area)}/${nombre}`.toLowerCase())) {
      nombre = `${base} ${i}`;
      i += 1;
    }
    usados.add(`${carpetaDe(n.area)}/${nombre}`.toLowerCase());
    nombres.set(n.id, nombre);
  }

  // SEGUNDA PASADA: los cuerpos, ya con los enlaces apuntando a donde corresponde.
  const archivos: Archivo[] = [readme(cerebro, areas, ids)];
  for (const n of entran) {
    const a = archivoDeNodo(n, cerebro, nombres);
    archivos.push({ ...a, ruta: `${carpetaDe(n.area)}/${nombres.get(n.id)}.md` });
  }

  return archivos;
}

/** ¿Este nodo es un ARCHIVO del vault? La raíz no lo es (es el README), lo pendiente
 *  tampoco (un archivo que dice que está vacío es ruido), y los nodos de ÁREA y de
 *  CARPETA son andamiaje del grafo: en el árbol su papel lo cumple la carpeta.
 *
 *  ⚠️ ESTA FUNCIÓN ES LA ÚNICA QUE LO DECIDE, y no es un refactor cosmético: el
 *  conteo del README y el armado de las carpetas ya divergieron una vez —el README
 *  decía «5 archivos» en una carpeta con 3— justo porque cada uno tenía su propia
 *  copia de esta condición. */
export const esArchivo = (n: NodoCerebro, ids?: Set<string>): boolean =>
  n.id !== 'raiz'
  && n.autoria !== 'pendiente'
  && !n.id.startsWith('area:')
  && !n.id.startsWith('n1:')
  && (!ids || ids.has(n.id));

/** Cuántos archivos aporta cada área. Lo usa el formulario para decir «5 archivos»
 *  al lado de cada opción sin tener que armar el vault entero.
 *
 *  `ids` acota a un subconjunto de nodos — es lo que hace que «exportar lo que estoy
 *  viendo» cuente igual que lo que después va a haber en las carpetas. */
export function conteoPorArea(cerebro: Cerebro, ids?: Set<string>): Record<string, number> {
  const c: Record<string, number> = {};
  for (const a of AREAS) c[a.id] = 0;
  for (const n of cerebro.nodos) {
    if (!esArchivo(n, ids)) continue;
    c[n.area] = (c[n.area] ?? 0) + 1;
  }
  return c;
}
