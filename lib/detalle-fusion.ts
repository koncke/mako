// =============================================================================
// detalle-fusion — sumar contexto a una descripción sin pisar lo que ya decía
// =============================================================================
// El Perro (checklist-coach) reescribe el `detalle` de una tarjeta para que deje de
// ser un renglón y pase a explicarse sola. El prompt le pide ampliar y NUNCA acortar,
// pero un prompt no es una garantía: el código escribía `patch.detalle = enr.detalle`
// y con eso una pasada del Perro podía tirar a la basura lo que había escrito una
// persona, o el contenido literal de una reunión.
//
// Función pura, sin dependencias: la usan los dos tableros (el del dueño y el del
// cliente) para que la regla sea UNA sola y no dos copias que se desincronizan.
// =============================================================================

const norm = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Mete los pasos como VIÑETAS dentro de la descripción.
 *
 * Las checklists se sacaron del producto el 22/09/2026 —«que no existan checklists, quitan
 * mucho tiempo, son incómodas e imprácticas. De última un bullet point»—, y con ellas el %
 * por tarea: «una tarea se completa o no se completa». Lo que el Perro sí sabía hacer —los
 * pasos— no se tira: baja un renglón, al `detalle`, que además es lo que un agente lee para
 * EJECUTAR la tarea (así la usa Leandro: «ejecutá todas las tareas del proyecto X»).
 *
 * ⚠️ La conversión vive en el CÓDIGO y no en el prompt. Los prompts se pueden sobreescribir
 * desde /configuraciones, así que pedirle al modelo que ya no devuelva `items` deja el
 * cambio colgando de una fila de `app_settings` que nadie va a mirar.
 */
export function pasosComoBullets(detalle: string, pasos: string[]): string {
  const d = (detalle ?? '').replace(/\s+$/, '');
  const limpios = (pasos ?? []).map((p) => String(p).trim().replace(/^[-*·•]\s*/, '')).filter(Boolean);
  if (!limpios.length) return d.trim();
  // Lo que ya está escrito no se repite, con o sin viñeta y sin importar acentos.
  const yaEsta = new Set(d.split('\n').map((l) => norm(l.replace(/^\s*[-*·•]\s*/, ''))).filter(Boolean));
  // Y tampoco se repite lo que la prosa YA DICE. La mitad de las checklists del tablero
  // eran un resumen de la descripción («Dar acceso a la cuenta publicitaria» debajo de
  // «Dar acceso a la cuenta publicitaria para que MaKo lea campañas…»): pegarlas abajo
  // convierte una descripción buena en una descripción que se repite a sí misma.
  // ⚠️ El piso de 12 caracteres NO es cosmético: sin él, «Probar» o «Avisar» matchean
  // adentro de cualquier párrafo y el paso desaparece por casualidad.
  const prosa = norm(d);
  const nuevos: string[] = [];
  for (const p of limpios) {
    const k = norm(p.replace(/^✓\s*/, ''));
    if (!k || yaEsta.has(k)) continue;
    if (k.length >= 12 && prosa.includes(k)) continue;
    yaEsta.add(k);
    nuevos.push(`- ${p}`);
  }
  if (!nuevos.length) return d.trim();
  const bullets = nuevos.join('\n');
  if (!d.trim()) return bullets;
  // Si el detalle trae el contrato de cuatro partes, los pasos son «Detalles concretos»
  // y van adentro de ESA sección, no colgados al final debajo de «Listo cuando».
  const lineas = d.split('\n');
  const iSec = lineas.findIndex((l) => /^\s*(\*\*)?\s*Detalles concretos/i.test(l));
  if (iSec >= 0) {
    let fin = lineas.length;
    for (let i = iSec + 1; i < lineas.length; i++) {
      if (/^\s*\*\*/.test(lineas[i])) { fin = i; break; }
    }
    const antes = lineas.slice(0, fin);
    const despues = lineas.slice(fin);
    while (antes.length && !antes[antes.length - 1].trim()) antes.pop();
    return [...antes, bullets, '', ...despues].join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  return `${d.trim()}\n\n${bullets}`;
}

/**
 * Devuelve la descripción que hay que guardar.
 * · Si el texto nuevo YA CONTIENE el arranque del viejo, es una ampliación de verdad
 *   → gana el nuevo (si no, quedaría el mismo párrafo dos veces).
 * · Si no, se conservan los dos: primero lo que ya estaba, después lo que sumó MaKo.
 * · Si el nuevo viene vacío, no se toca nada.
 */
export function fusionarDetalle(original: string, delPerro: string): string {
  const o = (original ?? '').trim();
  const p = (delPerro ?? '').trim();
  if (!p) return o;
  if (!o) return p;
  const cabeza = norm(o).slice(0, 60);
  if (cabeza.length >= 20 && norm(p).includes(cabeza)) return p;
  return `${o}\n\n${p}`;
}
