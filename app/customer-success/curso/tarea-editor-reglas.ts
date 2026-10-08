// =============================================================================
// tarea-editor-reglas — lo que decide el EDITOR DE LA TAREA sin tocar el DOM (puro)
// =============================================================================
// Feedback del curso del 08/10/2026 (docs/feedback-curso-08oct.md, el audio de 26 minutos), los items de
// la tarea, textuales con su minuto:
//   ·  5 (21:00) «no sabía que el campo estaba asociado a esa tarea… para eso tengo que ponerlo todo
//      dentro de un contenedor, porque ahora están en tres contenedores separados». Y «el campo lo
//      pondría un poco más chico y lo pondría abajo del campo que ya puse».
//   ·  6 (12:30) «automáticamente cuando se crea la nueva tarea… abajo también ya se tienen que crear de
//      manera automática el nuevo campo, es decir, el primer campo».
//   ·  8 (13:40-14:00) «en lugar de salirte opciones multiple choice te sale un cuadro de texto gigante».
//   · 10 (17:30) «no entiendo el campo de lo hice».
//   · 12 (21:30) «sería bueno que se pueda agregar más de una tarea».
//
// Sin 'use client' ni 'server-only' a propósito: lo usa ./TareaEditor.tsx (navegador) y un test que lo
// EJECUTA (tests/curso-tarea-editor.test.ts). Acá no se guarda nada: el editor es CONTROLADO (contrato 3
// del 08/10/2026) y quien lo monta (LeccionEditable) lleva el borrador y el botón «Guardar».
//
// EL MODELO (contrato 2, lib/curso.ts): más de una tarea por clase = un `Campo` de tipo 'seccion' en la
// MISMA lista `campos`. Los campos que vienen después de una sección son de esa tarea, hasta la próxima;
// los de antes de la primera son de la tarea principal (cuya descripción es `tareaHtml`). Por eso todo lo
// de acá trabaja sobre la lista PLANA y la parte en grupos sólo para decidir: lo que se guarda es siempre
// la lista, y una tarea nueva no pide ni una columna ni una tabla.
//
// ⚠️ DESHACER DEVUELVE LA MISMA IDENTIDAD (AGENTS.md): las respuestas de los alumnos cuelgan del id de
//    cada campo, así que lo que vuelve es el MISMO objeto, nunca uno igual con otro id. Ver
//    `conBloqueDevuelto`, que además no duplica si ya volvió por otro lado.

import type { Campo, CampoTipo, Escala, EstiloEscala } from '@/lib/curso';
import { ESTILOS_ESCALA, MAX_TAREAS } from '@/lib/curso';
import { indiceEnLista, ordenAlSoltar } from '@/app/_cursos/orden';
import { TIPOS_CAMPO } from './reglas';

/** El borrador de la tarea que edita `TareaEditor` (contrato 3): lo que LeccionEditable guarda con «Guardar». */
export type BorradorTarea = { tareaHtml: string; campos: Campo[]; porArea: boolean };

/** Una tarea de la clase, para editarla: la principal (`seccion: null`) o una sección con sus campos. */
export type GrupoTarea = { seccion: Campo | null; campos: Campo[] };

/**
 * ¿Es el campo que abre otra tarea? Se compara como texto a propósito: el tipo 'seccion' lo agrega la
 * pista MODELO a `CampoTipo` (contrato 2), y esto tiene que leer bien una lista vieja que no lo trae.
 */
export const esSeccion = (c: Pick<Campo, 'tipo'> | null | undefined): boolean => (c?.tipo as string | undefined) === 'seccion';

/**
 * La lista plana partida en tareas. SIEMPRE trae la principal primero (aunque esté vacía): es la que tiene
 * `tareaHtml`, y una lista que arranca con una sección le deja a la principal sólo su descripción.
 */
export function gruposDeCampos(campos: readonly Campo[]): GrupoTarea[] {
  const out: GrupoTarea[] = [{ seccion: null, campos: [] }];
  for (const c of campos) {
    if (esSeccion(c)) out.push({ seccion: c, campos: [] });
    else out[out.length - 1].campos.push(c);
  }
  return out;
}

/** La inversa de `gruposDeCampos`: la lista plana que se guarda. */
export const camposDeGrupos = (gs: readonly GrupoTarea[]): Campo[] =>
  gs.flatMap((g) => (g.seccion ? [g.seccion, ...g.campos] : g.campos));

/** ¿La clase tiene tarea? Una descripción o al menos un campo. Sin ninguno, va el «Agregar tarea». */
export const hayTarea = (v: Pick<BorradorTarea, 'tareaHtml' | 'campos'>): boolean => v.tareaHtml.trim() !== '' || v.campos.length > 0;

// ── Crear (items 5, 6 y 12) ──────────────────────────────────────────────────

/** El campo con el que nace una tarea (item 6): una Respuesta de texto, con la pregunta vacía. */
export const campoNuevo = (id: string): Campo => ({ id, label: '', tipo: 'texto' });

/** La sección que abre otra tarea (item 12). El título es obligatorio: lo dice `erroresDeCampos`. */
export const seccionNueva = (id: string): Campo => ({ id, label: '', tipo: 'seccion' });

/**
 * `n` ids nuevos que no chocan con los de la lista NI ENTRE SÍ (la sección y su primer campo nacen
 * juntos). `nuevoId` es `nuevoIdCampo` (./reglas.ts): al azar, porque las respuestas cuelgan del id.
 */
export function idsNuevos(existentes: readonly { id: string }[], n: number, nuevoId: (e: readonly { id: string }[]) => string): string[] {
  const usados = [...existentes];
  const out: string[] = [];
  for (let k = 0; k < n; k++) {
    const id = nuevoId(usados);
    out.push(id);
    usados.push({ id });
  }
  return out;
}

/** «Agregar tarea» (item 6): la tarea principal nace con su primer campo puesto. */
export const conPrimeraTarea = (v: BorradorTarea, idCampo: string): BorradorTarea =>
  ({ ...v, campos: [campoNuevo(idCampo), ...v.campos] });

/** «+ Agregar otra tarea» (item 12): una sección al final, con su primer campo (item 6, igual que la primera). */
export const conOtraTarea = (campos: readonly Campo[], idSeccion: string, idCampo: string): Campo[] =>
  [...campos, seccionNueva(idSeccion), campoNuevo(idCampo)];

/**
 * ¿Entra otra tarea? El tope es el del modelo (`MAX_TAREAS`, la principal incluida): el server rechaza
 * una de más (`erroresDeCampos`), y un botón que crea algo que no se va a poder guardar no se ofrece.
 */
export const entraOtraTarea = (campos: readonly Campo[]): boolean =>
  campos.filter((c) => esSeccion(c)).length + 1 < MAX_TAREAS;

/**
 * «+ Nuevo campo» de la tarea `g`: el campo nace ABAJO DEL ÚLTIMO de esa tarea (item 5: «lo pondría abajo
 * del campo que ya puse»). Antes nacía arriba de todo (`campoNuevoArriba`, ya borrada), que es lo
 * que se pidió la mañana del 08/10 y la prueba de la tarde dio vuelta. Quien lo crea scrollea hasta él.
 */
export function conCampoAlFinal(campos: readonly Campo[], g: number, id: string): Campo[] {
  const gs = gruposDeCampos(campos);
  if (!gs[g]) return [...campos];
  gs[g] = { ...gs[g], campos: [...gs[g].campos, campoNuevo(id)] };
  return camposDeGrupos(gs);
}

/** La tarea `g` con otros campos (lo que devuelve el editor de UNA tarea). */
export function conCamposDeTarea(campos: readonly Campo[], g: number, lista: readonly Campo[]): Campo[] {
  const gs = gruposDeCampos(campos);
  if (!gs[g]) return [...campos];
  gs[g] = { ...gs[g], campos: [...lista] };
  return camposDeGrupos(gs);
}

/** La sección `g` con un parche (su título o su descripción). */
export function conSeccion(campos: readonly Campo[], g: number, parche: Partial<Campo>): Campo[] {
  const gs = gruposDeCampos(campos);
  const s = gs[g]?.seccion;
  if (!s) return [...campos];
  gs[g] = { ...gs[g], seccion: { ...s, ...parche } };
  return camposDeGrupos(gs);
}

// ── Quitar una tarea (item 12) ───────────────────────────────────────────────

const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * La descripción con la que una SECCIÓN queda de tarea principal: su título arriba (un `h3`, que el saneo
 * deja pasar: lib/html-seguro.ts) y su descripción. La principal no tiene título propio, y tirar el que
 * escribió la persona sería perder algo sin que nadie lo pidiera.
 */
export function htmlDeSeccion(s: Pick<Campo, 'label'> & { descripcionHtml?: string }): string {
  const t = s.label.trim();
  return `${t ? `<h3>${escapar(t)}</h3>` : ''}${s.descripcionHtml ?? ''}`;
}

/**
 * «Quitar tarea» de la tarea `g`: se va con TODOS sus campos (es lo que se vio en el audio a las 20:00:
 * «si yo quito tarea se borra todo porque estás quitando la tarea, no estás quitando un campo»). Quitar la
 * PRINCIPAL con secciones detrás: la primera sección pasa a ser la principal (su título y su descripción
 * van a `tareaHtml`); sin secciones, la clase queda sin tarea y vuelve el «Agregar tarea».
 */
export function sinTarea(v: BorradorTarea, g: number): BorradorTarea {
  const gs = gruposDeCampos(v.campos);
  if (g < 0 || g >= gs.length) return v;
  if (g > 0) return { ...v, campos: camposDeGrupos(gs.filter((_, k) => k !== g)) };
  const [, siguiente, ...resto] = gs;
  if (!siguiente?.seccion) return { ...v, tareaHtml: '', campos: [] };
  return {
    ...v,
    tareaHtml: htmlDeSeccion(siguiente.seccion as Campo & { descripcionHtml?: string }),
    campos: camposDeGrupos([{ seccion: null, campos: siguiente.campos }, ...resto]),
  };
}

// ── Mover un campo, adentro de su tarea o a otra (item 12) ───────────────────

/**
 * ¿Soltar el campo `id` en el lugar `i` de la tarea `g` cambia algo? `grupos` son los ids de cada tarea
 * como se dibujan, y `i` se cuenta sobre la lista que TODAVÍA tiene al campo (el origen no se colapsa
 * mientras dura el gesto: AGENTS.md). En su propia tarea, al lado de sí mismo, no cambia nada: ahí no se
 * abre el hueco, o en el primer píxel la tarjeta saltaría debajo de la copia (lo midió el editor de etapas).
 */
export function cambiaAlSoltar(grupos: readonly (readonly string[])[], id: string, g: number, i: number): boolean {
  if (!grupos[g]) return false;
  const desde = grupos.findIndex((ids) => ids.includes(id));
  if (desde < 0) return false;
  return desde !== g || ordenAlSoltar(grupos[g], id, i) !== null;
}

/**
 * La lista con el campo `id` llevado al lugar `i` de la tarea `g` (`i` como en `cambiaAlSoltar`). `null` =
 * no cambia nada: no se escribe ni se ofrece «Deshacer».
 */
export function conCampoMovido(campos: readonly Campo[], id: string, g: number, i: number): Campo[] | null {
  const gs = gruposDeCampos(campos);
  if (!gs[g]) return null;
  const desde = gs.findIndex((x) => x.campos.some((c) => c.id === id));
  if (desde < 0) return null;
  if (desde === g) {
    const nueva = ordenAlSoltar(gs[g].campos.map((c) => c.id), id, i);
    if (!nueva) return null;
    const porId = new Map(gs[g].campos.map((c) => [c.id, c]));
    gs[g] = { ...gs[g], campos: nueva.map((x) => porId.get(x)!) };
    return camposDeGrupos(gs);
  }
  const campo = gs[desde].campos.find((c) => c.id === id)!;
  gs[desde] = { ...gs[desde], campos: gs[desde].campos.filter((c) => c.id !== id) };
  const dest = gs[g].campos;
  const k = Math.max(0, Math.min(i, dest.length));
  gs[g] = { ...gs[g], campos: [...dest.slice(0, k), campo, ...dest.slice(k)] };
  return camposDeGrupos(gs);
}

/** Una tarea MEDIDA durante un arrastre: su caja y los centros de sus campos, en coordenadas del contenido. */
export type TareaMedida = { y1: number; y2: number; medios: readonly number[] };

/**
 * Dónde cae un campo soltado a la altura `py`: la tarea que contiene el cursor, o si cae en el aire entre
 * dos (o un poco afuera de la primera o la última, `margen`), la más cercana; y adentro, antes del primer
 * centro que pasa. `null` = lejos de todas: ahí soltar no hace nada, y no hay hueco que prometa un lugar.
 *
 * ⚠️ POR LA ALTURA Y NO POR EL ELEMENTO BAJO EL CURSOR (la regla de `filaEnBarra`, app/_cursos/orden.ts):
 *    entre dos tarjetas el destino del evento es el contenedor, y decidir por él apagaba el hueco justo
 *    donde la persona estaba apuntando.
 */
export function dondeCae(tareas: readonly TareaMedida[], py: number, margen = 24): { g: number; i: number } | null {
  let g = -1;
  let dist = Infinity;
  tareas.forEach((t, k) => {
    const d = py < t.y1 ? t.y1 - py : py > t.y2 ? py - t.y2 : 0;
    if (d < dist) { dist = d; g = k; }
  });
  if (g < 0 || dist > margen) return null;
  return { g, i: indiceEnLista(tareas[g].medios, py) };
}

// ── «Deshacer» (por onChange: el editor no guarda nada) ──────────────────────

/**
 * Dónde estaba algo en la lista plana: el id del que le seguía y su tarea (su sección, o `null` = la
 * principal). Sin `seccion` (una tarea entera, que no vive adentro de otra) el respaldo es el final.
 */
export type Lugar = { ancla: string | null; seccion?: string | null };

/** El lugar del CAMPO `id`: para devolverlo ahí con `conBloqueDevuelto`. */
export function lugarDe(campos: readonly Campo[], id: string): Lugar {
  const k = campos.findIndex((c) => c.id === id);
  let seccion: string | null = null;
  for (let j = 0; j < k; j++) if (esSeccion(campos[j])) seccion = campos[j].id;
  return { ancla: k >= 0 && k < campos.length - 1 ? campos[k + 1].id : null, seccion };
}

/**
 * Vuelve a poner `bloque` (los MISMOS objetos) donde estaba: antes de su `ancla` si sigue en la lista; si
 * no, al final de su tarea (si sigue); y si no, al final. Si alguno ya está (volvió por otro lado), lo saca
 * antes: deshacer dos veces no duplica un campo.
 */
export function conBloqueDevuelto(campos: readonly Campo[], bloque: readonly Campo[], lugar: Lugar): Campo[] {
  const ids = new Set(bloque.map((c) => c.id));
  const sin = campos.filter((c) => !ids.has(c.id));
  let k = lugar.ancla == null ? -1 : sin.findIndex((c) => c.id === lugar.ancla);
  if (k < 0 && lugar.ancla != null && lugar.seccion !== undefined) {
    // El de al lado ya no está: al final de su tarea (antes de la sección que sigue).
    const desde = lugar.seccion == null ? 0 : sin.findIndex((c) => c.id === lugar.seccion) + 1;
    if (lugar.seccion == null || desde > 0) {
      const sig = sin.findIndex((c, j) => j >= desde && esSeccion(c));
      k = sig;
    }
  }
  return k < 0 ? [...sin, ...bloque] : [...sin.slice(0, k), ...bloque, ...sin.slice(k)];
}

/** El campo con el mismo id vuelve a ser `campo` (el de antes de cambiarle el tipo o quitarle una pregunta). */
export const conCampoDevuelto = (campos: readonly Campo[], campo: Campo): Campo[] =>
  campos.map((c) => (c.id === campo.id ? campo : c));

/**
 * Qué cambió entre la lista de UNA tarea antes y después de un gesto del editor de campos, para ofrecer su
 * «Deshacer»: el campo borrado, el que cambió (tipo o pregunta, por REFERENCIA: los demás son los mismos
 * objetos) o el primero que quedó en otro lugar (con las flechas, devolver ése devuelve el orden).
 */
export function campoDelGesto(antes: readonly Campo[], despues: readonly Campo[], motivo: string): Campo | null {
  if (motivo === 'borrado') return antes.find((c) => !despues.some((d) => d.id === c.id)) ?? null;
  if (motivo === 'tipo' || motivo === 'pregunta') return antes.find((c) => { const d = despues.find((x) => x.id === c.id); return d != null && d !== c; }) ?? null;
  if (motivo === 'movido') {
    const k = despues.findIndex((c, j) => antes[j]?.id !== c.id);
    return k >= 0 ? despues[k] : null;
  }
  return null;
}

// ── Las opciones como opciones (item 8) ──────────────────────────────────────
// «Cuando vos ponés un formato multiple choice, en lugar de salirte opciones multiple choice te sale un
// cuadro de texto gigante» (14:00). Un renglón por opción, como Google Forms. La lista se guarda CRUDA
// mientras se escribe (con renglones vacíos): el server la sanea al guardar (`sanearCampos`).

/** Los renglones que se dibujan: la lista, o uno vacío para escribir la primera. */
export const filasDe = (lista: readonly string[] | undefined): string[] => (lista?.length ? [...lista] : ['']);

/** El renglón `i` con otro texto. */
export const conFila = (lista: readonly string[] | undefined, i: number, texto: string): string[] =>
  filasDe(lista).map((x, k) => (k === i ? texto : x));

/** Un renglón nuevo después del `i` (Enter), con un tope. `null` = ya no entra otro. */
export function conFilaNueva(lista: readonly string[] | undefined, i: number, tope: number, texto = ''): string[] | null {
  const f = filasDe(lista);
  if (f.length >= tope) return null;
  return [...f.slice(0, i + 1), texto, ...f.slice(i + 1)];
}

/** Sin el renglón `i`. El último no se quita: queda vacío, para escribir. */
export const sinFila = (lista: readonly string[] | undefined, i: number): string[] => {
  const f = filasDe(lista).filter((_, k) => k !== i);
  return f.length ? f : [''];
};

/**
 * Pegar varias líneas en el renglón `i` (una lista copiada de otro lado): cada línea es una opción. El
 * texto del renglón se parte donde estaba el cursor. Devuelve la lista y qué renglón queda con el foco.
 */
export function conPegado(lista: readonly string[] | undefined, i: number, antes: string, despues: string, pegado: string, tope: number): { lista: string[]; foco: number } | null {
  const lineas = pegado.replace(/\r\n?/g, '\n').split('\n').map((s) => s.trim());
  if (lineas.length < 2) return null;
  lineas[0] = antes + lineas[0];
  lineas[lineas.length - 1] += despues;
  const f = filasDe(lista);
  const nueva = [...f.slice(0, i), ...lineas.filter((s, k) => s || k === 0), ...f.slice(i + 1)].slice(0, tope);
  return { lista: nueva, foco: Math.min(nueva.length - 1, i + lineas.length - 1) };
}

/**
 * Las correctas de una pregunta de quiz después de RENOMBRAR el renglón `i`: la marca sigue a la opción.
 * (La correcta se guarda por su TEXTO, lib/curso.ts; con un cuadro de texto, renombrar la desmarcaba.) Si
 * otro renglón tiene el mismo texto viejo, la marca se queda con ése.
 */
export function correctasTrasRenombrar(correctas: readonly string[] | undefined, opciones: readonly string[], i: number, nuevo: string): string[] {
  const viejo = (opciones[i] ?? '').trim();
  const c = [...(correctas ?? [])];
  if (!viejo || !c.includes(viejo) || opciones.some((o, k) => k !== i && o.trim() === viejo)) return c;
  const n = nuevo.trim();
  return n ? c.map((x) => (x === viejo ? n : x)) : c.filter((x) => x !== viejo);
}

/** Las correctas después de QUITAR el renglón `i`. */
export function correctasTrasQuitar(correctas: readonly string[] | undefined, opciones: readonly string[], i: number): string[] {
  const viejo = (opciones[i] ?? '').trim();
  const c = [...(correctas ?? [])];
  if (!viejo || opciones.some((o, k) => k !== i && o.trim() === viejo)) return c;
  return c.filter((x) => x !== viejo);
}

/** Marcar o desmarcar la correcta `texto` (tocando su círculo). Una pregunta de UNA respuesta tiene UNA. */
export function correctasAlMarcar(correctas: readonly string[] | undefined, texto: string, multiple: boolean): string[] {
  const t = texto.trim();
  const c = [...(correctas ?? [])];
  if (!t) return c;
  if (!multiple) return c.includes(t) ? [] : [t];
  return c.includes(t) ? c.filter((x) => x !== t) : [...c, t];
}

// ── La escala: «Mostrar como» (item 9) ───────────────────────────────────────
// «La escala lineal podría ser… una barra deslizable, no simplemente números seleccionables. O si no,
// de última, la típica de estrellas» (14:50). El estilo es `Escala.estilo` (contrato 2); ausente =
// números, que es lo de siempre, así una escala vieja no cambia de forma ni de lo que guarda.

/** Cómo se nombra cada estilo en «Mostrar como» (la lista de estilos es la del modelo: `ESTILOS_ESCALA`). */
const ROTULO_ESTILO: Record<EstiloEscala, string> = { numeros: 'Números', deslizador: 'Deslizador', estrellas: 'Estrellas' };
export const OPCIONES_ESTILO_ESCALA: ReadonlyArray<{ value: EstiloEscala; label: string }> =
  ESTILOS_ESCALA.map((value) => ({ value, label: ROTULO_ESTILO[value] }));

/** El estilo con el que se dibuja una escala (ausente o desconocido = números). */
export const estiloDe = (e: (Partial<Omit<Escala, 'estilo'>> & { estilo?: string }) | null | undefined): EstiloEscala =>
  e?.estilo === 'deslizador' || e?.estilo === 'estrellas' ? e.estilo : 'numeros';

/**
 * La escala con otro estilo. «Números» no se escribe: es el default, y así la escala queda como antes.
 * Con estrellas el mínimo es 1 (lo fuerza también `sanearCampos`): «cero estrellas» no se puede marcar y
 * se lee igual que «no contestó»; si no se cambia acá, el editor mostraría un rango que no se guarda.
 */
export function conEstilo(e: Escala, estilo: EstiloEscala): Escala {
  const { estilo: _fuera, ...resto } = e;
  if (estilo === 'numeros') return resto;
  return { ...resto, ...(estilo === 'estrellas' && resto.min === 0 ? { min: 1 as const } : {}), estilo };
}

/** Los rangos que se ofrecen con cada estilo: con estrellas no hay 0 (ver `conEstilo`). */
export function rangosDeEscala(estilo: EstiloEscala): Array<{ value: string; label: string }> {
  const todos = [
    { value: '1-10', label: '1 a 10' },
    { value: '0-10', label: '0 a 10 (NPS)' },
    { value: '1-5', label: '1 a 5' },
  ];
  return estilo === 'estrellas' ? todos.filter((r) => !r.value.startsWith('0')) : todos;
}

// ── El selector de tipo (item 10) ────────────────────────────────────────────
// «No entiendo el campo de lo hice» (17:30): el nombre de un tipo no alcanza para saber qué le pide al
// alumno. Cada tipo lleva un ícono, su nombre y UNA línea que dice qué hace el alumno. El nombre sale de
// `TIPOS_CAMPO` (./reglas.ts), la única lista de nombres: acá se le suma lo que se dibuja al lado.

/** Los tipos que el alumno contesta: todos menos la sección, que no es un campo sino otra tarea. */
export type TipoConRespuesta = Exclude<CampoTipo, 'seccion'>;

/**
 * Lo que dice cada tipo en el selector. ⚠️ Es un `Record` del tipo, así un tipo nuevo de `CampoTipo` no
 * compila hasta que alguien escriba su línea (el selector no puede ofrecer uno mudo). Líneas cortas y en
 * voz neutra: se dibujan (AGENTS.md).
 */
export const QUE_HACE_EL_ALUMNO: Record<TipoConRespuesta, { icono: string; linea: string }> = {
  texto: { icono: '¶', linea: 'Escribe una respuesta larga.' },
  linea: { icono: '—', linea: 'Escribe una respuesta corta.' },
  numero: { icono: '#', linea: 'Escribe un número.' },
  eleccion: { icono: '◉', linea: 'Elige una de las opciones.' },
  checks: { icono: '☑', linea: 'Marca todas las que correspondan.' },
  tabla: { icono: '▦', linea: 'Completa filas y columnas.' },
  archivo: { icono: '⇪', linea: 'Sube un archivo: PDF, Excel, imagen.' },
  audio: { icono: '♪', linea: 'Graba o sube un audio.' },
  video: { icono: '▶', linea: 'Graba o sube un video.' },
  link: { icono: '↗', linea: 'Pega un link a lo que hizo.' },
  escala: { icono: '★', linea: 'Puntúa en una escala o con estrellas.' },
  quiz: { icono: '?', linea: 'Contesta preguntas con nota.' },
  checklist: { icono: '☰', linea: 'Tilda cada acción al hacerla.' },
  agenda: { icono: '◷', linea: 'Agenda una llamada en tu calendario.' },
  // Un BOTÓN, no una casilla: es lo que ve el alumno desde el 08/10/2026 (TareaAlumno, «Marcar como hecho»).
  confirmacion: { icono: '✓', linea: 'Botón: confirma que lo hizo.' },
  publicar: { icono: '✎', linea: 'Publica un post en la comunidad.' },
  comentar: { icono: '❝', linea: 'Comenta un post de la comunidad.' },
};

/** Las opciones del selector de tipo (el `Select` de la casa, que dibuja `sub` debajo del nombre). */
export const opcionesDeTipo = (): Array<{ value: string; label: string; sub: string }> =>
  TIPOS_CAMPO.filter((t) => !esSeccion({ tipo: t.value })).map((t) => {
    const q = QUE_HACE_EL_ALUMNO[t.value as TipoConRespuesta];
    return { value: t.value, label: `${q?.icono ?? '·'}  ${t.label}`, sub: q?.linea ?? '' };
  });

// ── El rojo de lo que falta (item 2) ─────────────────────────────────────────

/**
 * El motivo que se DIBUJA para un campo (o una sección): el de `errores` (lo que calcula `erroresDeCampos`,
 * lib/curso.ts, y lo que contesta el server al rechazar), salvo que el campo esté recién creado y todavía
 * nadie haya salido de su pregunta: un campo que nace en rojo mientras alguien escribe su primera letra se
 * lee como un error de la pantalla. Al salir de la pregunta (o al tocar «Guardar», que saca el foco) se ve.
 */
export const motivoVisible = (errores: Readonly<Record<string, string>>, id: string, silenciados: ReadonlySet<string>): string | null =>
  (!silenciados.has(id) && errores[id]) || null;
