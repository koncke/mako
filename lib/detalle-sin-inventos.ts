// =============================================================================
// detalle-sin-inventos — lo que el detalle de una tarea AFIRMA tiene que haberse dicho
// =============================================================================
// Puro y sin `server-only`: lo usa la extracción de reuniones (lib/plan-fathom.ts, `coerceCandidatas`) y lo
// fijan los tests. Nació el 17/10/2026 midiendo la extracción de las dos llamadas del 16/10 contra sus
// transcripciones (docs/hallazgos-plan.md): 6 de 37 tarjetas traían un dato técnico que nadie dijo —«Claude
// 3.5 Sonnet de 200k», «Sendgrid / Resend o similar», «Baileys» (MaKo usa Evolution), «inicio de 2025» (la
// llamada no nombra un año), «suscripción Pro/Team», «el React Error Boundary»—. Un dato así lo toma por
// cierto el chat que trabaja la tarjeta: es peor que no tenerlo.
//
// El prompt ya lo pide («NO inventes nada que no se haya dicho») y no alcanzó: «Una regla en un prompt no es
// una regla» (AGENTS.md). Esto es el control en código: los DATOS de un detalle —nombres propios, marcas,
// siglas, números, años, versiones— se buscan en lo que se dijo (la transcripción, el resumen de Fathom, el
// glosario, los nombres de los proyectos y de la gente). La línea de «Detalles concretos» o la frase que
// afirma un dato que no aparece se SACA entera: un detalle corto y cierto vale más que uno largo con relleno.
//
// Lo que NO mira, a propósito:
//   · las citas («…», "…", '…'): son la voz de la reunión, con los errores de la transcripción adentro;
//   · los minutos ([00:55:05], 12:40): los pide el prompt y salen de la transcripción;
//   · la primera palabra de cada frase o renglón (en castellano va en mayúscula sin ser un nombre);
//   · las siglas comunes de software (API, CRM, PDF…) y el vocabulario propio de la app (`VOCABULARIO_MAKO`).
// Y una palabra que la transcripción escribió con UNA letra de diferencia cuenta como dicha: el robot escribe
// «Maco» por «MaKo» y «Claudio» por «Claude».
// =============================================================================

import { normNombre, fuenteDicha, conNombreReal, type FuenteDicha, type AliasDelDueno } from './tarea-dueno';

/**
 * Lo que se dijo, armado UNA vez por reunión: las palabras (`fuenteDicha`, lo mismo que mira el rótulo de una
 * persona) y los NÚMEROS tal como se escribieron («3.5», «2025», «20 mil» → 20000).
 */
export type FuenteDatos = { dicho: FuenteDicha; numeros: ReadonlySet<string>; palabras: ReadonlySet<string> };

export function fuenteDeDatos(texto: string): FuenteDatos {
  const numeros = new Set<string>();
  for (const m of texto.matchAll(/(\d+(?:[.,]\d+)*)(\s*mil\b)?/gi)) {
    const crudo = m[1].replace(/,/g, '.');
    numeros.add(crudo);
    numeros.add(crudo.replace(/[^0-9]/g, ''));
    if (m[2]) numeros.add(`${crudo.replace(/[^0-9]/g, '')}000`);
  }
  // Las palabras SIN la puntuación pegada: `fuenteDicha` corta en espacios y deja el punto («hmo.»), así que una palabra
  // que la transcripción dijo al final de una frase no contaba como dicha (medido: «HMO.», 17/10/2026).
  const palabras = new Set(norm(texto).split(' ').filter(Boolean));
  return { dicho: fuenteDicha(texto), numeros, palabras };
}

/** Siglas y palabras de software que no son un dato de nadie: escribirlas no afirma nada. */
const SIGLAS_COMUNES = new Set([
  'api', 'crm', 'pdf', 'qr', 'url', 'ia', 'ai', 'ui', 'ux', 'sms', 'csv', 'kpi', 'kpis', 'okr', 'okrs', 'roi', 'cpl', 'cpa',
  'cta', 'vsl', 'seo', 'id', 'ok', 'mvp', 'faq', 'html', 'css', 'json', 'link', 'links', 'mobile', 'desktop', 'email',
  'mail', 'chat', 'bot', 'login', 'app', 'web', 'online', 'feedback', 'template', 'templates', 'dashboard', 'dashboards',
  'lead', 'leads', 'checkout', 'onboarding', 'kanban', 'drag', 'drop', 'scroll', 'modal', 'toast', 'popup', 'banner',
  'prompt', 'prompts', 'token', 'tokens', 'backend', 'frontend', 'bug', 'bugs', 'deploy', 'push', 'tab', 'tabs',
  'usd', 'us', 'mxn', 'ars', 'eur', 'clp', 'cop',
]);

/**
 * Lo que es de MaKo y se escribe bien aunque la transcripción lo escriba mal: las tabs, las integraciones, los
 * proveedores con los que la app trabaja. Escribirlo no es un dato inventado: es el nombre de la cosa.
 */
export const VOCABULARIO_MAKO = [
  'MaKo', 'Fathom', 'WhatsApp', 'Instagram', 'Meta', 'Facebook', 'Google', 'Calendar', 'Gmail', 'Drive', 'YouTube',
  'Stripe', 'Mercado Pago', 'Calendly', 'Zoom', 'Meet', 'Gemini', 'Claude', 'Anthropic', 'OpenAI', 'ChatGPT',
  'Evolution', 'Resend', 'Excel', 'Sheets', 'Looker', 'Canva', 'CapCut', 'Notion', 'Trello',
  'General', 'Foco', 'Plan', 'CRM', 'Chats', 'Automations', 'Dashboard', 'Offer', 'Second Brain', 'Ops Center',
  'Web Generator', 'Landing', 'Video Editor', 'Image Editor', 'Ads Manager', 'Marketing CoPilot', 'Ads Analyst', 'Ads Writer',
  'Closing Analyst', 'Customer Success', 'Integraciones', 'Configuraciones', 'Pagos', 'Cobros', 'Review', 'Perro',
];

const norm = (s: string): string => normNombre(s).replace(/[^a-z0-9ñ]+/g, ' ').trim();
const juntar = (s: string): string => normNombre(s).replace(/[^a-z0-9@.]+/g, '');
const soloDigitos = (s: string): string => s.replace(/[^0-9]/g, '');

/** ¿Se escribió casi igual? (una letra de más, de menos o cambiada). Sólo de 4 letras para arriba. */
function casiIgual(a: string, b: string): boolean {
  if (a.length < 4 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0; let j = 0; let dif = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++dif > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return dif + (a.length - i) + (b.length - j) <= 1;
}

/** Lo que se puede citar sin haberlo dicho la reunión: el vocabulario de la app, los proyectos, la gente. */
export type Permitidos = { palabras: ReadonlySet<string>; juntos: readonly string[] };

export function permitidosDe(nombres: ReadonlyArray<string>): Permitidos {
  const todos = [...VOCABULARIO_MAKO, ...nombres].map((x) => x.replace(/^(feature|vender mako|agente|cliente)\s*:\s*/i, ''));
  const palabras = new Set<string>(SIGLAS_COMUNES);
  for (const n of todos) for (const w of norm(n).split(' ')) if (w) palabras.add(w);
  return { palabras, juntos: todos.map(juntar).filter((x) => x.length >= 4) };
}

/** Saca del texto lo que NO se revisa: citas, minutos y los títulos en negrita del molde. */
function sinCitas(s: string): string {
  return s
    .replace(/«[^»]*»/g, ' ')
    .replace(/"[^"]*"/g, ' ')
    .replace(/“[^”]*”/g, ' ')
    .replace(/(^|[\s(])'[^']*'(?=[\s).,;:]|$)/g, '$1 ')
    .replace(/\[\d{1,2}:\d{2}(:\d{2})?\]/g, ' ')
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, ' ')
    .replace(/\*\*[^*]+\*\*/g, ' ');
}

/**
 * Los DATOS que afirma un pedazo de texto: palabras con mayúscula que no abren una frase (nombres, marcas,
 * siglas), palabras con mayúscula adentro («GetReAll»), y números de dos cifras o más (con su unidad pegada:
 * «200k», «3.5»). Devuelve cada uno tal como está escrito.
 */
export function datosDe(texto: string): string[] {
  const out: string[] = [];
  const limpio = sinCitas(texto);
  // Frases: lo que va después de un punto, dos puntos, raya o un renglón nuevo abre frase.
  for (const frase of limpio.split(/(?<=[.!?:;—–])\s+|\n+|^\s*[-*]\s+/m)) {
    const palabras = frase.trim().replace(/^[-*•]\s*/, '').split(/\s+/).filter(Boolean);
    palabras.forEach((crudo, i) => {
      const w = crudo.replace(/^[(¿¡[]+|[)\].,;:!?…]+$/g, '');
      if (!w) return;
      if (/\d/.test(w)) {
        // Sólo los números que son un DATO TÉCNICO: con letras pegadas («200k», «gpt4»), una versión («3.5») o
        // un año. Los montos y las cantidades no: la transcripción dice «20 mil» o «nueve mil» y el detalle
        // escribe «20.000», y sacarlos borraría lo que sí se dijo.
        const conLetras = /[a-záéíóúñ]/i.test(w.replace(/^us\$|\$/i, ''));
        const version = /^\d+\.\d{1,2}$/.test(w);
        const anio = /^(19|20)\d{2}$/.test(w);
        if (conLetras || version || anio) out.push(w);
        return;
      }
      for (const parte of w.split('/')) {
        if (parte.length < 2) continue;
        const mayusAdentro = /[a-záéíóúñ][A-ZÁÉÍÓÚÑ]/.test(parte);
        const empiezaMayus = /^[A-ZÁÉÍÓÚÑ]/.test(parte);
        if (mayusAdentro || (empiezaMayus && i > 0) || (empiezaMayus && parte !== w)) out.push(parte);
      }
    });
  }
  return out;
}

/** ¿Este dato se dijo (o es del vocabulario permitido)? */
export function seDijo(dato: string, datos: FuenteDatos, permitidos?: Permitidos): boolean {
  const fuente = datos.dicho;
  if (/\d/.test(dato)) {
    const crudo = dato.replace(/,/g, '.').toLowerCase();
    const k = /^(\d+(?:\.\d+)?)k$/.exec(crudo);
    // «200k» se dijo si se dijo 200.000 o «200 mil»; no alcanza con un «200» suelto (eran 200 dólares).
    if (k) return datos.numeros.has(String(Math.round(Number(k[1]) * 1000)));
    // Una versión o un año, tal cual: «3.5» no es un «35» de otra parte de la charla.
    if (/^\d+\.\d{1,2}$/.test(crudo) || /^(19|20)\d{2}$/.test(crudo)) return datos.numeros.has(crudo);
    return datos.numeros.has(crudo) || datos.numeros.has(soloDigitos(crudo)) || fuente.junto.includes(juntar(dato));
  }
  const n = norm(dato);
  if (!n) return true;
  if (datos.palabras.has(n) || fuente.palabras.has(n) || permitidos?.palabras.has(n)) return true;
  const j = juntar(dato);
  if (j.length >= 5 && (fuente.junto.includes(j) || permitidos?.juntos.some((x) => x.includes(j)))) return true;
  if (n.length >= 4) {
    for (const w of datos.palabras) if (w[0] === n[0] && casiIgual(n, w)) return true;
  }
  return false;
}

/**
 * Saca del detalle cada renglón de lista y cada frase que afirma un dato que no se dijo. Los títulos del molde
 * quedan, y una sección nunca se queda vacía por esto: si el dato está en la ÚNICA frase de una sección, esa
 * frase se queda (el que lee tiene el título igual). Devuelve el detalle limpio y los datos que lo hicieron
 * recortar, para el log y para medir.
 */
export function sacarLoNoDicho(detalle: string, fuente: FuenteDatos, permitidos?: Permitidos): { detalle: string; sacado: string[] } {
  const sacado: string[] = [];
  const noDichos = (s: string) => datosDe(s).filter((d) => !seDijo(d, fuente, permitidos));
  const secciones = detalle.split(/(?=^\*\*[^*\n]+\*\*)/m);
  const nuevas = secciones.map((sec) => {
    const lineas = sec.split('\n');
    const titulo = /^\*\*[^*\n]+\*\*/.test(lineas[0] ?? '') ? lineas[0] : null;
    const cuerpo = titulo ? lineas.slice(1) : lineas;
    // Cuántas «unidades» tiene la sección (renglones de lista + frases): la última no se saca.
    const unidades = cuerpo.flatMap((l) => (/^\s*[-*•]\s+/.test(l) ? [l] : l.split(/(?<=[.!?])\s+/))).filter((u) => u.trim()).length;
    let quedan = unidades;
    const salida: string[] = [];
    for (const l of cuerpo) {
      if (/^\s*[-*•]\s+/.test(l)) {
        const malos = noDichos(l);
        if (malos.length && quedan > 1) { sacado.push(...malos); quedan--; continue; }
        salida.push(l);
        continue;
      }
      const frases = l.split(/(?<=[.!?])\s+/);
      const buenas = frases.filter((f) => {
        if (!f.trim()) return true;
        const malos = noDichos(f);
        if (malos.length && quedan > 1) { sacado.push(...malos); quedan--; return false; }
        return true;
      });
      salida.push(buenas.join(' '));
    }
    return [...(titulo ? [titulo] : []), ...salida].join('\n');
  });
  return { detalle: nuevas.join('').replace(/\n{3,}/g, '\n\n').trim(), sacado };
}

// ── Lo que hace la extracción con cada tarea que devuelve el modelo ─────────────────────────────────────────────────

/** Lo que un detalle puede afirmar y el nombre real de quien mira el tablero. Se arma UNA vez por reunión. */
export type ControlDeLoDicho = { datos: FuenteDatos; permitidos: Permitidos; alias?: AliasDelDueno | null };

/**
 * Una tarea del modelo, con el nombre real en lugar del de la cuenta de Fathom (`conNombreReal`) y sin lo que nadie
 * dijo en el detalle (`sacarLoNoDicho`). El TÍTULO no se recorta: sacarle una palabra lo deja sin sentido, y el dato
 * que importa vive en el detalle. Lo usa `coerceCandidatas` (lib/plan-fathom.ts).
 */
export function limpiarLoDicho(o: { titulo: string; detalle: string; dueno: string; dichoPor: string }, control?: ControlDeLoDicho | null): { titulo: string; detalle: string; dueno: string; dichoPor: string; sacado: string[] } {
  const real = (x: string) => (control?.alias ? conNombreReal(x, control.alias) : x);
  const crudo = real(o.detalle.trim());
  const limpio = control ? sacarLoNoDicho(crudo, control.datos, control.permitidos) : { detalle: crudo, sacado: [] as string[] };
  return { titulo: real(o.titulo.trim()), detalle: limpio.detalle, dueno: real(o.dueno), dichoPor: real(o.dichoPor), sacado: limpio.sacado };
}
