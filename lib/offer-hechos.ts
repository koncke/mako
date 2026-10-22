// =============================================================================
// offer-hechos — MaKo no afirma una herramienta que el negocio no nombró
// =============================================================================
// Puro (sin base ni IA). Lo usa lib/offer-sesiones.ts al LEER una conversación (`aFila`): las piezas que anotó la
// IA, los diagnósticos y las propuestas pasan por acá antes de llegar a la pantalla, al PDF, a los prompts, a la
// API de MaKo y a «Guardar como mi oferta».
//
// Existe por la llamada con Mauricio del 22/10/2026 (Fathom 195129619, 01:43:55): su oferta decía «tres sesiones en
// vivo por Zoom» y nadie dijo Zoom («es por Meet o por otra plataforma»). La cadena, medida en su conversación (ws1,
// id 18): MaKo preguntó «¿es 100% en vivo por Zoom…?» con la opción «Tres sesiones 100% en vivo por Zoom»; Mauricio
// eligió OTRA («En vivo más acceso a grabaciones y plantillas»), y la IA igual anotó la pieza «formato» con «por Zoom».
// De ahí pasó al diagnóstico y a la propuesta. La IA confundió lo que ELLA sugirió con lo que el dueño dijo.
//
// ⚠️ La regla del prompt («no anotes lo que tú sugeriste») es la primera red, y no alcanza: los prompts se editan en
//    /configuraciones y el modelo varía. Esto es lo determinista, para la clase de hecho que se puede reconocer sin
//    entender la frase: una HERRAMIENTA con nombre (videollamada, mensajería, cursos, cobro, agenda).
// ⚠️ «Lo que dijo el negocio» es lo que escribió el dueño (sus mensajes, también las opciones que tocó, que viajan
//    como su mensaje), sus documentos y lo cargado en MaKo que entra como pieza 'negocio'. NO las piezas que anotó la
//    IA: ésas son justo lo que se revisa.
// ⚠️ Se SACA, no se reemplaza por otra: «por videollamada» sería otro hecho que nadie dijo.
// =============================================================================

import { normalizar } from './buscar-texto';
import type { PiezasSabidas } from './offer-marco';

/** Una herramienta y los nombres con que se la escribe (el primero es como se la reconoce en un test). */
type Herramienta = { nombres: readonly string[] };

/**
 * Las herramientas que un dueño nombra al contar cómo entrega, cobra o atiende. Las redes sociales no están a
 * propósito: son canales de marketing que el contexto del negocio casi siempre nombra, y sacarlas de un anuncio
 * («tu bio de Instagram») rompería el copy sin evitar un hecho falso.
 */
export const HERRAMIENTAS: readonly Herramienta[] = [
  { nombres: ['Zoom'] },
  { nombres: ['Google Meet', 'Meet'] },
  { nombres: ['Microsoft Teams', 'Teams'] },
  { nombres: ['Skype'] },
  { nombres: ['Webex'] },
  { nombres: ['StreamYard'] },
  { nombres: ['Jitsi'] },
  { nombres: ['WhatsApp'] },
  { nombres: ['Telegram'] },
  { nombres: ['Discord'] },
  { nombres: ['Slack'] },
  { nombres: ['Skool'] },
  { nombres: ['Hotmart'] },
  { nombres: ['Kajabi'] },
  { nombres: ['Teachable'] },
  { nombres: ['Thinkific'] },
  { nombres: ['Udemy'] },
  { nombres: ['Stripe'] },
  { nombres: ['PayPal'] },
  { nombres: ['Mercado Pago', 'MercadoPago'] },
  { nombres: ['Calendly'] },
];

const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** El nombre como palabra entera, sin distinguir mayúsculas ni el espacio interno («Mercado  Pago»). */
const patronNombre = (n: string): string => escapar(n).replace(/\s+/g, '\\s+');
const LETRA = 'A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9';

/**
 * Las herramientas que el negocio NOMBRÓ en sus textos. Una herramienta cuenta si aparece con cualquiera de sus
 * nombres («Meet» vale por «Google Meet»).
 */
export function herramientasDichas(fuentes: ReadonlyArray<string | null | undefined>): Set<number> {
  const texto = normalizar(fuentes.filter((x): x is string => typeof x === 'string').join('\n'));
  const out = new Set<number>();
  HERRAMIENTAS.forEach((h, i) => {
    if (h.nombres.some((n) => new RegExp(`(?:^|[^a-z0-9])${patronNombre(normalizar(n))}(?![a-z0-9])`).test(texto))) out.add(i);
  });
  return out;
}

/** Lo que lleva la herramienta pegada adelante y sale con ella: «por Zoom», «vía Zoom», «a través de Zoom». */
const ANTES = '(?:\\s*,)?\\s+(?:(?:por|v[ií]a|en|a\\s+trav[eé]s\\s+de|mediante|desde|usando|con|de)\\s+)?(?:(?:la\\s+)?plataforma\\s+(?:de\\s+)?)?';

/**
 * El texto sin las herramientas que el negocio no nombró. `dichas` sale de `herramientasDichas`. Devuelve el mismo
 * string si no había nada que sacar.
 */
export function sinHerramientasAjenas(texto: string, dichas: ReadonlySet<number>): string {
  if (!texto) return texto;
  let out = texto;
  HERRAMIENTAS.forEach((h, i) => {
    if (dichas.has(i)) return;
    // El nombre más largo primero: «Google Meet» antes que «Meet».
    for (const n of [...h.nombres].sort((a, b) => b.length - a.length)) {
      const nombre = `(?<![${LETRA}])${patronNombre(n)}(?![${LETRA}])`;
      out = out.replace(new RegExp(`${ANTES}${nombre}`, 'gi'), '');
      out = out.replace(new RegExp(`${nombre}\\s*`, 'gi'), '');
    }
  });
  if (out === texto) return texto;
  const limpio = out
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:!?)])/g, '$1')
    .replace(/,\s*,/g, ',')
    .replace(/\(\s*\)/g, '')
    .replace(/^\s*[,;:]\s*/, '')
    .trim();
  // Si se fue la primera palabra («Zoom, grabaciones y plantillas»), la mayúscula pasa a la que queda.
  return /^[A-ZÁÉÍÓÚÑ]/.test(texto.trim()) ? limpio.charAt(0).toUpperCase() + limpio.slice(1) : limpio;
}

/**
 * Lo mismo, a fondo, sobre todo string de un objeto (un diagnóstico, una propuesta): devuelve una copia, o el mismo
 * objeto si no había nada que sacar.
 */
export function objetoSinHerramientasAjenas<T>(v: T, dichas: ReadonlySet<number>): T {
  const ir = (x: unknown): unknown => {
    if (typeof x === 'string') return sinHerramientasAjenas(x, dichas);
    if (Array.isArray(x)) {
      const ys = x.map(ir);
      return ys.some((y, i) => y !== x[i]) ? ys : x;
    }
    if (x && typeof x === 'object') {
      let cambio = false;
      const o: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(x as Record<string, unknown>)) {
        const nv = ir(val);
        if (nv !== val) cambio = true;
        o[k] = nv;
      }
      return cambio ? o : x;
    }
    return x;
  };
  return ir(v) as T;
}

/**
 * Una conversación como se LEE: las piezas que anotó la IA (las de fuente 'chat' o 'doc'), los diagnósticos y las
 * propuestas sin las herramientas que el negocio no nombró. Lo que dijo el negocio sale de sus mensajes, sus
 * documentos y las piezas que vinieron de lo cargado en MaKo ('negocio'). Los mensajes de MaKo no se tocan: son lo
 * que MaKo preguntó. No reescribe la fila; la próxima escritura de las piezas ya va limpia.
 */
export function conversacionSinHerramientasAjenas<F extends {
  mensajes: ReadonlyArray<{ de: string; texto: string }>;
  documentos: ReadonlyArray<{ texto: string }>;
  piezas: PiezasSabidas;
  conclusiones: ReadonlyArray<{ diagnostico: unknown; propuesta: unknown }>;
  borrador: { diagnostico: unknown } | null;
}>(f: F): F {
  const dichas = herramientasDichas([
    ...f.mensajes.filter((m) => m.de === 'yo').map((m) => m.texto),
    ...f.documentos.map((d) => d.texto),
    ...Object.values(f.piezas).filter((p) => p?.fuente === 'negocio').map((p) => p?.valor),
  ]);
  if (dichas.size === HERRAMIENTAS.length) return f;
  let cambio = false;
  const piezas: PiezasSabidas = {};
  for (const [k, p] of Object.entries(f.piezas) as Array<[keyof PiezasSabidas, PiezasSabidas[keyof PiezasSabidas]]>) {
    if (!p) continue;
    const valor = p.fuente === 'negocio' ? p.valor : sinHerramientasAjenas(p.valor, dichas);
    if (valor !== p.valor) cambio = true;
    if (valor.trim()) piezas[k] = valor === p.valor ? p : { ...p, valor };
  }
  const conclusiones = f.conclusiones.map((c) => {
    const diagnostico = objetoSinHerramientasAjenas(c.diagnostico, dichas);
    const propuesta = objetoSinHerramientasAjenas(c.propuesta, dichas);
    if (diagnostico === c.diagnostico && propuesta === c.propuesta) return c;
    cambio = true;
    return { ...c, diagnostico, propuesta };
  });
  const diagBorrador = f.borrador ? objetoSinHerramientasAjenas(f.borrador.diagnostico, dichas) : null;
  const borrador = f.borrador && diagBorrador !== f.borrador.diagnostico ? { ...f.borrador, diagnostico: diagBorrador } : f.borrador;
  if (borrador !== f.borrador) cambio = true;
  return cambio ? { ...f, piezas, conclusiones, borrador } : f;
}
