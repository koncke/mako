// =============================================================================
// iconos-catalogo — el ícono de un proyecto o de un cliente, servido por Iconify
// =============================================================================
// «Te pido que agregues "íconos" y la opción de "Subir"» + «¿Puedes consumir
// alguna API de iconos?» (27/09/2026), con la captura del selector de Notion al
// lado: Emoji · Icons · Upload · Remove.
//
// ⚠️ LA PRIMERA VERSIÓN DE ESTE ARCHIVO ERAN 40 ÍCONOS ESCRITOS A MANO, y estaba
// mal por la razón de siempre: una lista a mano cubre lo que ya se nos ocurrió y
// nunca el ícono que la persona iba a buscar. Con Iconify son ~22.000 buscables
// por nombre, y el archivo pasa de ser un catálogo a ser el CONTRATO: qué sets se
// aceptan, cómo se guarda y cómo se arma la URL.
//
// LO QUE SE MIDIÓ ANTES DE ELEGIRLO (27/09/2026, con curl — en este repo un
// proveedor no es un dato hasta verificarlo):
//   · `GET /search?query=rocket&limit=8` → 200 y la lista. **Sin ninguna key.**
//     Es la misma propiedad por la que el repositorio de fotos es picsum: una
//     feature que necesita una env var nace apagada para todo el que no la cargó,
//     y se ve como un selector vacío.
//   · `access-control-allow-origin: *` → el navegador puede llamarla directo.
//   · `&prefixes=lucide,tabler,…` filtra de verdad (20 resultados contra 32).
//   · Una búsqueda sin resultados devuelve `{"icons":[],"total":0}` con **200** —
//     así que «no encontré nada» y «no pude leer» siguen siendo distinguibles por
//     el status, que es lo que la pantalla necesita para no mentir.
//   · `/lucide/rocket.svg?color=%23ff0000&width=48` → 200, y el `stroke` sale con
//     el color pedido.
//
// ⚠️ Y LA OTRA MITAD DEL DATO, QUE ES LA LICENCIA. Iconify sirve 238 sets con
// licencias distintas y **eso no se ve en la respuesta de búsqueda**. Medido sobre
// `/collections`: Solar (8.280 íconos, el más tentador) es **CC-BY-4.0**, o sea
// que mostrarlo obliga a atribuir. Un SaaS que arrastra una obligación de
// atribución porque alguien eligió un ícono bonito es exactamente el tipo de deuda
// que no se ve hasta que es tarde. Por eso `SETS_OK` es una lista en POSITIVO y
// sólo con MIT/ISC.
//
// ⚠️ SIN `server-only` A PROPÓSITO: lo importan el navegador (el selector, la
// tarjeta, la ficha) y el server (el saneo de lo que se guarda). Sólo sabe de
// forma y de texto; no toca la base y no sale a la red.

/**
 * LOS SETS QUE SE ACEPTAN, en positivo y sólo MIT/ISC.
 *
 * Medido el 27/09/2026 contra `https://api.iconify.design/collections`:
 *   lucide ISC 1.853 · tabler MIT 6.220 · ph MIT 9.072 · heroicons MIT 1.288
 *   iconoir MIT 1.671 · octicon MIT 765 · bi MIT 2.078        → ~22.900 íconos
 *
 * Quedan AFUERA a propósito: `solar` (CC-BY-4.0, pide atribución) y la familia
 * Apache-2.0 (`mdi`, `material-symbols`, `carbon`, `ri`, `mingcute`), que no pide
 * atribución pero sí conservar el NOTICE — con 22.900 disponibles, no vale la pena
 * discutirlo. Un guard en negativo («todos menos Solar») se queda viejo con el
 * próximo set que Iconify agregue; éste no.
 *
 * ⚠️ Lucide va PRIMERA a propósito: es la familia visual de los íconos que el repo
 * ya dibuja a mano (24×24, `stroke-width: 2`, puntas redondas — ver el lápiz de
 * `PrioridadAMano.tsx`). Un ícono de otra familia al lado de los nuestros se lee
 * como que se coló de otra app.
 */
export const SETS_OK = ['lucide', 'tabler', 'ph', 'heroicons', 'iconoir', 'octicon', 'bi'] as const;
export type SetIcono = (typeof SETS_OK)[number];

const SETS = new Set<string>(SETS_OK);

/** El host de Iconify. Vive acá y no repetido en cada `img`. */
export const ORIGEN_ICONOS = 'https://api.iconify.design';

const PREFIJO_ICONO = 'icon:';

/**
 * La forma de un nombre de Iconify: `<set>:<nombre>`.
 *
 * ⚠️ EL NOMBRE VIAJA EN EL PATH DE UNA URL, así que esto no es una validación de
 * prolijidad: es la que impide que un `../` o una barra armen una URL a otro lado.
 * Se aceptan sólo minúsculas, dígitos y guiones — que es lo que usan los seis sets
 * (`bar-chart-3`, `table-2`, `rocket-16` verificados contra la API).
 */
const FORMA_NOMBRE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * El nombre Iconify de un valor guardado, o `null` si no es un ícono válido.
 *
 * Es el ÚNICO lugar que decide si algo es un ícono: lo usan el saneo del server
 * (para no guardar basura), la pantalla (para saber si dibuja un `img` o un
 * carácter) y el selector (para marcar el elegido).
 */
export function nombreDeIcono(v: string | null | undefined): string | null {
  if (typeof v !== 'string' || !v.startsWith(PREFIJO_ICONO)) return null;
  const resto = v.slice(PREFIJO_ICONO.length);
  const corte = resto.indexOf(':');
  if (corte <= 0) return null;
  const set = resto.slice(0, corte);
  const nombre = resto.slice(corte + 1);
  if (!SETS.has(set) || !FORMA_NOMBRE.test(nombre)) return null;
  return `${set}:${nombre}`;
}

/** ¿Este valor es un ícono del catálogo? */
export const esIcono = (v: string | null | undefined): boolean => nombreDeIcono(v) !== null;

/**
 * El valor que se GUARDA para el nombre Iconify `set:nombre`, o `null` si no sirve.
 *
 * Devuelve `null` en vez de tirar porque lo que entra viene de una API de un
 * tercero: un set nuevo que Iconify agregue y que no esté en `SETS_OK` no puede
 * romper la pantalla, tiene que no ofrecerse.
 */
export function valorIcono(nombreIconify: string): string | null {
  const limpio = nombreDeIcono(`${PREFIJO_ICONO}${nombreIconify}`);
  return limpio ? `${PREFIJO_ICONO}${limpio}` : null;
}

/**
 * La URL del SVG, lista para un `<img src>`.
 *
 * ⚠️ Devuelve `null` para un valor que no valida, y quien la llama TIENE que
 * contemplarlo: un `src=""` o un `src="undefined"` pide la página actual como
 * imagen y deja un ícono roto que no dice por qué.
 *
 * El color va por query porque estos SVG son monocromos y se sirven con el
 * `stroke`/`fill` cableado: sin `?color=`, un ícono negro sobre una portada oscura
 * no se ve. No hay `currentColor` posible — es un `img`, no un SVG inline.
 */
export function urlIcono(v: string | null | undefined, opts?: { color?: string; tam?: number }): string | null {
  const nombre = nombreDeIcono(v);
  if (!nombre) return null;
  const [set, id] = nombre.split(':');
  const q = new URLSearchParams();
  if (opts?.color) q.set('color', opts.color);
  if (opts?.tam) { q.set('width', String(opts.tam)); q.set('height', String(opts.tam)); }
  const cola = q.toString();
  return `${ORIGEN_ICONOS}/${set}/${id}.svg${cola ? `?${cola}` : ''}`;
}

/**
 * La URL de búsqueda, con los sets permitidos ya puestos.
 *
 * ⚠️ EL FILTRO DE SETS VA ACÁ Y TAMBIÉN EN `nombreDeIcono`, y no es redundancia:
 * esto decide qué se OFRECE (si Iconify ignorara el parámetro, igual no se podría
 * guardar) y aquello decide qué se GUARDA. Es la regla de las dos capas de
 * AGENTS.md aplicada a un tercero — lo que un proveedor nos conteste no puede ser
 * lo único que nos proteja.
 */
export function urlBusquedaIconos(consulta: string, limite = 96): string {
  const q = new URLSearchParams({
    query: consulta.trim().slice(0, 60),
    limit: String(Math.max(1, Math.min(999, limite))),
    prefixes: SETS_OK.join(','),
  });
  return `${ORIGEN_ICONOS}/search?${q}`;
}

/**
 * LO QUE SE VE ANTES DE BUSCAR. Una pestaña con un buscador vacío no se lee como
 * «escribí algo»: se lee como que no cargó.
 *
 * Los 51 son de Lucide y **están verificados contra la API** (27/09/2026,
 * `GET /lucide.json?icons=…` → 51 existen, 0 en `not_found`). Un nombre inventado
 * acá no da error: da una imagen rota en la grilla del selector.
 */
export const ICONOS_SUGERIDOS: readonly string[] = [
  // trabajo
  'lucide:rocket', 'lucide:target', 'lucide:folder', 'lucide:briefcase', 'lucide:list-checks',
  'lucide:code', 'lucide:file-text', 'lucide:presentation', 'lucide:wrench', 'lucide:plug',
  // gente
  'lucide:users', 'lucide:user', 'lucide:handshake', 'lucide:message-circle', 'lucide:mail',
  'lucide:megaphone', 'lucide:heart', 'lucide:phone', 'lucide:video',
  // datos
  'lucide:bar-chart-3', 'lucide:trending-up', 'lucide:pie-chart', 'lucide:table-2', 'lucide:database',
  'lucide:search', 'lucide:filter', 'lucide:gauge',
  // plata
  'lucide:banknote', 'lucide:coins', 'lucide:shopping-cart', 'lucide:tag', 'lucide:landmark',
  // tiempo
  'lucide:clock', 'lucide:calendar', 'lucide:hourglass', 'lucide:zap', 'lucide:repeat',
  // señales
  'lucide:star', 'lucide:flag', 'lucide:triangle-alert', 'lucide:shield', 'lucide:lock',
  'lucide:lightbulb', 'lucide:flame', 'lucide:anchor', 'lucide:compass', 'lucide:sparkles',
  // lugares y cosas
  'lucide:globe', 'lucide:map-pin', 'lucide:image', 'lucide:bot',
];
