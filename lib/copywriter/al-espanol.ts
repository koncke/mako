// =============================================================================
// copywriter/al-espanol — las palabras sueltas en inglés, a su equivalente en español (PURO; 13/11/2026)
// =============================================================================
// El Cerebro, con un guion real del 13/11 (el anuncio de Hormozi replicado): «Gastan en creativos, en segmentación, en more
// budget». El voseo lo pasa solo `alTuteo` (lib/al-tuteo.ts); el inglés sólo se avisaba y se pedía corregir en la segunda pasada
// (./ia-reglas.ts, `palabrasEnIngles`). Ahora se pasa solo, con el mismo criterio que `alTuteo`: una lista corta y segura.
//   · Sólo palabras de CONTENIDO con una traducción sin vueltas (budget → presupuesto, tips → consejos, free → gratis) y unas
//     frases (step by step → paso a paso). Las palabras chicas (the, and, with) no: sólo aparecen en una frase entera en inglés, y
//     esa no se traduce palabra por palabra (queda para la segunda pasada).
//   · Sólo en frases que están en español (./tema.ts, `idiomaDe`): una cita o una frase en inglés queda como está.
//   · Nunca: la jerga del rubro (leads, funnel, CTA, Reels), una marca o un nombre propio (una palabra con mayúscula pegada a otra
//     con mayúscula: «Meta Business Suite»), lo citado entre «…», un @, un # o un link, ni lo que el negocio llama así (`permitido`:
//     el nombre de su oferta, «Free Money Club»).
//   · Y un dígito COLADO entre letras se saca («capac0idad» → «capacidad», 14/11/2026: Gemini en la réplica del short de Hormozi).
//     En español no hay palabras así; «B2B», «MP3» o «web3» no son minúscula-dígito-minúscula y quedan.
// =============================================================================

import { idiomaDe } from './tema';

/** Las frases de dos o tres palabras (van antes que las sueltas). */
const FRASES: Readonly<Record<string, string>> = {
  'step by step': 'paso a paso',
  'more budget': 'más presupuesto',
  'free workshop': 'taller gratis',
  'best practices': 'buenas prácticas',
  'call to action': 'llamado a la acción',
  'follow up': 'seguimiento',
};

/** Las sueltas: una traducción que sirve en cualquier frase (las dudosas, como «big» → «grande/gran», no están). */
const PALABRAS: Readonly<Record<string, string>> = {
  budget: 'presupuesto', more: 'más', less: 'menos', title: 'título', free: 'gratis', best: 'mejor', people: 'gente',
  business: 'negocio', money: 'dinero', growth: 'crecimiento', scale: 'escalar', workshop: 'taller', learn: 'aprende',
  join: 'súmate', now: 'ahora', today: 'hoy', every: 'cada', easy: 'fácil', fast: 'rápido', step: 'paso', steps: 'pasos',
  results: 'resultados', tips: 'consejos', here: 'aquí', goal: 'meta', goals: 'metas', customer: 'cliente', customers: 'clientes',
  revenue: 'ingresos', profit: 'ganancia', challenge: 'reto', skills: 'habilidades', tool: 'herramienta', tools: 'herramientas',
  price: 'precio', value: 'valor', offer: 'oferta', strategy: 'estrategia', content: 'contenido', audience: 'audiencia',
  mistakes: 'errores', secret: 'secreto', hook: 'gancho', hooks: 'ganchos', launch: 'lanzamiento',
  // 14/11/2026, la réplica de Hormozi: «La herramienta sin lectura es solo un dashboard bonito».
  dashboard: 'tablero', dashboards: 'tableros',
};

const PALABRA = /([\p{L}\p{N}][\p{L}\p{N}'’-]*)/u;
const esMayuscula = (w: string) => w.length > 1 && w === w.toUpperCase() && w !== w.toLowerCase();
const empiezaConMayuscula = (w: string) => w[0] !== w[0].toLowerCase();

/** La traducción con la forma del original: TODO EN MAYÚSCULA, Con Mayúscula o en minúscula. */
function conSuForma(original: string, traduccion: string): string {
  if (esMayuscula(original)) return traduccion.toUpperCase();
  return empiezaConMayuscula(original) ? `${traduccion.charAt(0).toUpperCase()}${traduccion.slice(1)}` : traduccion;
}

/** Un pedazo de una frase en español, fuera de una cita: cambia lo que corresponde. */
function enUnPedazo(pedazo: string, permitidas: ReadonlySet<string>, alPrincipio: boolean): string {
  // Partido en [no-palabra, palabra, no-palabra, palabra, …]: las palabras van en los lugares impares.
  const t = pedazo.split(PALABRA);
  const palabra = (i: number) => (i % 2 === 1 ? t[i] : '');
  const primera = alPrincipio ? t.findIndex((x, i) => i % 2 === 1 && !!x) : -1;
  // Una palabra que no se toca: pegada a un @, # o link; del nombre del negocio; o un nombre propio (con mayúscula y al lado de otra).
  const intocable = (i: number) => {
    const w = t[i];
    const antes = t[i - 1] ?? '';
    const despues = t[i + 1] ?? '';
    // ⚠️ El separador viene SOLO («.») y la palabra de después en el siguiente pedazo: «free.com» es «free», «.», «com» (14/11/2026:
    // sin mirar el siguiente, «entra a free.com» quedaba «gratis.com»).
    if (/[@#/.]$/.test(antes) || /^[.@/]\p{L}/u.test(despues) || (/^[.@/]$/.test(despues) && /^\p{L}/u.test(t[i + 2] ?? ''))) return true;
    if (permitidas.has(w.toLowerCase())) return true;
    if (esMayuscula(w) || !empiezaConMayuscula(w)) return false;
    const vecina = (j: number) => { const v = palabra(j); return !!v && empiezaConMayuscula(v) && !esMayuscula(v) && /^\s+$/.test(t[Math.min(i, j) + 1] ?? ''); };
    return (i !== primera && vecina(i - 2)) || vecina(i + 2);
  };
  for (let i = 1; i < t.length; i += 2) {
    if (!t[i] || intocable(i)) continue;
    // Un dígito colado entre minúsculas («capac0idad»): fuera.
    const colado = t[i].match(/^(\p{Ll}{2,})\d(\p{Ll}{2,})$/u);
    if (colado) { t[i] = `${colado[1]}${colado[2]}`; continue; }
    // Primero las frases (dos o tres palabras separadas por un espacio).
    let hecho = false;
    for (const n of [3, 2]) {
      const fin = i + (n - 1) * 2;
      if (fin >= t.length) continue;
      const sep = Array.from({ length: n - 1 }, (_, k) => t[i + 1 + k * 2]);
      if (!sep.every((x) => x === ' ')) continue;
      const ws = Array.from({ length: n }, (_, k) => t[i + k * 2]);
      const clave = ws.join(' ').toLowerCase();
      if (FRASES[clave] && !ws.some((w, k) => k > 0 && (permitidas.has(w.toLowerCase())))) {
        t[i] = conSuForma(ws[0], FRASES[clave]);
        for (let k = 1; k < n; k++) { t[i + k * 2] = ''; t[i + k * 2 - 1] = ''; }
        i = fin;
        hecho = true;
        break;
      }
    }
    if (hecho) continue;
    const tr = PALABRAS[t[i].toLowerCase()];
    if (tr) t[i] = conSuForma(t[i], tr);
  }
  return t.join('');
}

/**
 * El texto con las palabras sueltas en inglés pasadas al español. `permitido`: lo que el negocio llama así (el nombre del negocio, de
 * la oferta, el pedido): sus palabras no se tocan. `citas`: también lo que va entre «…» (en un GUION lo citado es lo que se dice en
 * cámara y lo escribió MaKo, como en `alTuteo`; en la respuesta a la persona, «…» suele ser el original y queda como está).
 */
export function alEspanol(texto: string, permitido = '', opts: { citas?: boolean } = {}): string {
  if (!texto) return texto;
  const permitidas = new Set((permitido.toLowerCase().match(/\p{L}+/gu) ?? []));
  // Por frase (un punto seguido de un espacio o del final; un salto de línea): «hola@free.com» no corta.
  const partes = texto.split(/([.!?…]+(?=\s|$)|\n+)/);
  return partes.map((frase, k) => {
    if (k % 2 === 1 || !frase.trim() || idiomaDe(frase) === 'en') return frase;
    // Lo citado entre «…» queda como está.
    const trozos = frase.split(/(«[^»]*»)/);
    let alPrincipio = true;
    return trozos.map((tr) => {
      if (tr.startsWith('«') && !opts.citas) { alPrincipio = false; return tr; }
      const r = enUnPedazo(tr, permitidas, alPrincipio && !/\p{L}/u.test(trozos.slice(0, trozos.indexOf(tr)).join('')));
      if (/\p{L}/u.test(tr)) alPrincipio = false;
      return r;
    }).join('');
  }).join('');
}
