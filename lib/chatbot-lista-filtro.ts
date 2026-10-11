// =============================================================================
// chatbot-lista-filtro — el filtro de la lista de /automations (quinta tanda, punto 4)
// =============================================================================
// Pedido de Martín (09/10/2026), textual:
//   «El filtro al lado del buscador en la sidebar, debería ser más chico, con el ícono de filtro
//    como ya lo tenemos en otros lados, así la barra de busqueda tiene más espacio. […] Replica el
//    desplegable de Filtro que tenemos en el plan... Por ejemplo, "Quitar filtros" es un texto
//    sutil abajo del todo... Y hay secciones, quiero que haya una sección de "Emojis" y que ahí
//    aparezcan los emojis disponibles. Una sección de "Estado", y también quiero un filtro de
//    "Canal" para WhatsApp y Email, ese filtro, como otros deberían claro poder seleccionar
//    varios. Y dentro de la sección canal, luego de WhatsApp y Email, un divider y las opciones
//    "A clientes" y "Al WhatsApp de MaKo", para filtrar los que envian solo a clientes, solo al
//    whatsapp de MaKo o ambos...»
//
// Lo que vive acá son las decisiones que se pueden equivocar sin que nada se vea roto, como
// funciones PURAS con test que las EJECUTA (tests/chatbot-lista-filtro.test.ts):
//
//   · POR DÓNDE Y A QUIÉN escribe una fila (`enviosDePasos`, `enviosDeAviso`): se DERIVA de los
//     pasos, nunca se guarda. Un campo «canal» guardado al lado de los pasos se queda viejo en la
//     primera edición del lienzo (AGENTS.md, «Lo que está OCULTO se deriva de lo que se DIBUJA»).
//   · si una fila PASA el filtro (`pasaFiltroLista`);
//   · qué SECCIONES ofrece el desplegable y qué dice cada una en la raíz (`seccionesDelFiltro`).
//
// SIN 'use client' y sin `server-only`: lo importan la lista (app/automations/SimuladorWhatsApp.tsx)
// y los tests. El tipo de las secciones es el del Dropdown de la casa, y se trae con `import type`
// (se borra al compilar: no arrastra el componente).
// =============================================================================

import type { DropdownGroup, DropdownOption } from '@/app/components/Dropdown';
import { alternarValor } from '@/app/components/dropdown-varios';
import { claseDe, expandirPasoIA, type PasoGrafo } from './flujo-grafo';
import { OP_AVISAR } from './flujo-legado';
import type { PlantillaVista } from './plantillas';
import { emojiDeMensaje, mensajeActivo } from './chatbot-mensajes-mako';

/** Por dónde sale un mensaje. */
export type CanalEnvio = 'whatsapp' | 'email';
/**
 * A quién le escribe: al LEAD («A clientes»), al grupo del negocio con MaKo («Al WhatsApp de
 * MaKo»: la tarjeta MAKO, que es la ⚡ Acción `avisar_al_equipo`, y los Mensajes de MaKo por
 * WhatsApp) o al correo del NEGOCIO (un Mensaje de MaKo por email). El filtro ofrece los dos
 * primeros —son los que pidió Martín—; el tercero existe para no meter un email al dueño en
 * ninguno de los dos.
 */
export type DestinoEnvio = 'clientes' | 'mako' | 'negocio';
/** Un envío que la fila puede hacer: un canal Y un destino juntos (ver `pasaFiltroLista`). */
export type Envio = { canal: CanalEnvio; destino: DestinoEnvio };

/** Lo que el filtro necesita de cada fila de la lista: automatización, recordatorio o mensaje de MaKo. */
export type FilaFiltrable = {
  /** null = no se sabe todavía (el recordatorio antes de leer su interruptor): ningún «Estado» lo deja pasar. */
  activa: boolean | null;
  /** El emoji que se VE en la fila. */
  emoji: string;
  envios: readonly Envio[];
};

const sinRepetir = (es: Envio[]): Envio[] => {
  const vistos = new Set<string>();
  return es.filter((e) => { const k = `${e.canal}:${e.destino}`; if (vistos.has(k)) return false; vistos.add(k); return true; });
};

/**
 * Los envíos de una automatización, DERIVADOS de sus pasos.
 *
 * · Un MENSAJE (la clase la decide `claseDe`, la misma que leen el motor y el lienzo) le escribe
 *   al lead por su `canal`.
 * · La tarjeta MAKO (⚡ Acción `avisar_al_equipo`, `OP_AVISAR`) le escribe al grupo del negocio
 *   por WhatsApp.
 * · Lo demás (esperas, condiciones, «Si responde», «Ir a», las otras acciones, el CRON) no manda
 *   nada: «Si responde» bifurca y los mensajes que siguen son tarjetas propias, que ya cuentan.
 *
 * ⚠️ UN AI STEP SE CUENTA EXPANDIDO (`expandirPasoIA`, novena tanda): lo que manda —el «MaKo contesta» de
 * cada caso, por el WhatsApp no oficial, y el aviso al equipo de los casos que avisan y de «Otra cosa»—
 * vive ADENTRO de la tarjeta, no en tarjetas propias. Leído compacto, una automatización cuyo único
 * mensaje al lead es su AI Step no pasaba «WhatsApp» ni «A clientes». Es lo mismo que recorren el motor
 * y «Probar».
 */
export function enviosDePasos(pasos: readonly PasoGrafo[]): Envio[] {
  const out: Envio[] = [];
  for (const p of expandirPasoIA(pasos)) {
    if (!p || typeof p !== 'object') continue;
    const c = claseDe(p);
    if (c === 'mensaje') {
      if (p.canal === 'whatsapp' || p.canal === 'email') out.push({ canal: p.canal, destino: 'clientes' });
    } else if (c === 'accion') {
      const op = (p.accion as { operacion?: unknown } | null | undefined)?.operacion;
      if (op === OP_AVISAR) out.push({ canal: 'whatsapp', destino: 'mako' });
    }
  }
  return sinRepetir(out);
}

/**
 * Los envíos de un Mensaje de MaKo (los flujos de «Notificaciones», punto 5): le escribe al
 * NEGOCIO, nunca al lead. Por WhatsApp va al grupo de MaKo («Al WhatsApp de MaKo»); por email,
 * al correo del negocio — que no es ninguno de los dos destinos del filtro, así que un mensaje
 * que sólo sale por email pasa «Email» y no pasa «Al WhatsApp de MaKo». Literal a propósito: el
 * filtro dice A QUIÉN le llega, y un email no le llega al WhatsApp de nadie.
 */
export function enviosDeAviso(canales: { wa: boolean; email: boolean } | null | undefined): Envio[] {
  const out: Envio[] = [];
  if (canales?.wa) out.push({ canal: 'whatsapp', destino: 'mako' });
  if (canales?.email) out.push({ canal: 'email', destino: 'negocio' });
  return out;
}

/** La fila del filtro de un Mensaje de MaKo: su emoji, si está prendido y por dónde le llega al negocio. */
export const filaDeMensaje = (p: Pick<PlantillaVista, 'categoria' | 'enabled' | 'fijo' | 'canales'>): FilaFiltrable => ({
  activa: mensajeActivo(p), emoji: emojiDeMensaje(p), envios: enviosDeAviso(p.canales),
});

// ── El filtro ────────────────────────────────────────────────────────────────────

/** Los valores del desplegable (`varios` del Dropdown): una sección y su opción, en un string. */
export const VALOR = {
  activas: 'estado:activas', pausadas: 'estado:pausadas',
  whatsapp: 'canal:whatsapp', email: 'canal:email',
  clientes: 'destino:clientes', mako: 'destino:mako',
  emoji: (e: string) => `emoji:${e}`,
} as const;

type FiltroLeido = { emojis: Set<string>; estados: Set<string>; canales: Set<string>; destinos: Set<string> };

function leerFiltro(valores: readonly string[]): FiltroLeido {
  const f: FiltroLeido = { emojis: new Set(), estados: new Set(), canales: new Set(), destinos: new Set() };
  for (const v of valores) {
    const i = v.indexOf(':');
    if (i < 0) continue;
    const k = v.slice(0, i); const x = v.slice(i + 1);
    if (k === 'emoji') f.emojis.add(x);
    else if (k === 'estado') f.estados.add(x);
    else if (k === 'canal') f.canales.add(x);
    else if (k === 'destino') f.destinos.add(x);
  }
  return f;
}

/**
 * ¿La fila pasa el filtro?
 *
 * · ENTRE secciones, «y»: un emoji Y un estado Y un canal.
 * · ADENTRO de una sección, «o»: dos emojis marcados muestran las filas de cualquiera de los dos.
 * · «Canal» tiene DOS preguntas separadas por la línea —por dónde (WhatsApp, Email) y a quién (A
 *   clientes, Al WhatsApp de MaKo)— y se contestan sobre el MISMO envío: «WhatsApp» + «A clientes»
 *   es «le manda un WhatsApp al lead», no «tiene algún WhatsApp y además algo para el lead». Con
 *   las dos preguntas sueltas, una automatización con la tarjeta MAKO (WhatsApp al grupo) y un
 *   email al lead pasaba «WhatsApp + A clientes» sin mandarle un solo WhatsApp a nadie de afuera.
 *   Una fila que hace las dos cosas (le escribe al lead Y al grupo) pasa los dos destinos.
 */
export function pasaFiltroLista(fila: FilaFiltrable, valores: readonly string[]): boolean {
  if (!valores.length) return true;
  const f = leerFiltro(valores);
  if (f.emojis.size && !f.emojis.has(fila.emoji)) return false;
  if (f.estados.size) {
    if (fila.activa == null) return false;
    if (!f.estados.has(fila.activa ? 'activas' : 'pausadas')) return false;
  }
  if (f.canales.size || f.destinos.size) {
    const alguno = fila.envios.some((e) => (!f.canales.size || f.canales.has(e.canal)) && (!f.destinos.size || f.destinos.has(e.destino)));
    if (!alguno) return false;
  }
  return true;
}

/** El conjunto después de tocar un renglón: lo prende o lo apaga (la MISMA regla que el Dropdown). */
export const alternarFiltro = (valores: readonly string[], v: string): string[] => alternarValor([...valores], v);

/** Cuántos renglones están marcados: es el número del botón. */
export const contarFiltros = (valores: readonly string[]): number => valores.length;

/** Los títulos de las secciones, en el orden del pedido. */
export const SECCION = { emojis: 'Emojis', estado: 'Estado', canal: 'Canal' } as const;

/**
 * Las secciones del desplegable (el patrón del filtro del Plan: la raíz lista las secciones con lo
 * que tiene puesto cada una, y adentro se marcan varias).
 *
 * · «Emojis»: los que se VEN en la lista ahora, en el orden en que aparecen, con cuántas filas
 *   tiene cada uno. Uno marcado que ya no está en ninguna fila se sigue ofreciendo (con 0): si el
 *   menú escondiera lo que está filtrando, la pantalla mentiría sobre por qué la lista está vacía.
 * · «Estado»: Activas y Pausadas.
 * · «Canal»: WhatsApp y Email, una línea, A clientes y Al WhatsApp de MaKo.
 *
 * Los conteos van sobre TODAS las filas (no sobre las que deja el buscador): dicen cuántas hay de
 * cada una, que es lo que ayuda a decidir si vale la pena marcarla.
 */
export function seccionesDelFiltro(filas: readonly FilaFiltrable[], valores: readonly string[]): DropdownGroup[] {
  const f = leerFiltro(valores);
  const cuantas = (p: (x: FilaFiltrable) => boolean) => filas.filter(p).length;
  const conCanal = (c: CanalEnvio) => (x: FilaFiltrable) => x.envios.some((e) => e.canal === c);
  const conDestino = (d: DestinoEnvio) => (x: FilaFiltrable) => x.envios.some((e) => e.destino === d);

  const emojis: string[] = [];
  for (const x of filas) if (x.emoji && !emojis.includes(x.emoji)) emojis.push(x.emoji);
  for (const e of f.emojis) if (!emojis.includes(e)) emojis.push(e);

  // ÍCONOS EN CADA OPCIÓN (sexta tanda, general 10: «pon íconos en todos los desplegable, en todas las
  // opciones»), por NOMBRE del set de la casa (app/_ui/iconos-menu.tsx). Un emoji no lleva ícono: el
  // renglón ES el emoji.
  const opEmojis: DropdownOption[] = emojis.map((e) => ({ value: VALOR.emoji(e), label: `${e} · ${cuantas((x) => x.emoji === e)}` }));
  const opEstado: DropdownOption[] = [
    { value: VALOR.activas, label: `Activas · ${cuantas((x) => x.activa === true)}`, icono: 'activar' },
    { value: VALOR.pausadas, label: `Pausadas · ${cuantas((x) => x.activa === false)}`, icono: 'pausar' },
  ];
  const opCanal: DropdownOption[] = [
    { value: VALOR.whatsapp, label: `WhatsApp · ${cuantas(conCanal('whatsapp'))}`, icono: 'whatsapp' },
    { value: VALOR.email, label: `Email · ${cuantas(conCanal('email'))}`, icono: 'email' },
    // La línea va ARRIBA de «A clientes»: separa «por dónde» de «a quién».
    { value: VALOR.clientes, label: `A clientes · ${cuantas(conDestino('clientes'))}`, lineaArriba: true, icono: 'cliente' },
    { value: VALOR.mako, label: `Al WhatsApp de MaKo · ${cuantas(conDestino('mako'))}`, icono: 'mako' },
  ];

  const ROTULO: Record<string, string> = {
    [VALOR.activas]: 'Activas', [VALOR.pausadas]: 'Pausadas',
    [VALOR.whatsapp]: 'WhatsApp', [VALOR.email]: 'Email', [VALOR.clientes]: 'A clientes', [VALOR.mako]: 'Al WhatsApp de MaKo',
  };
  /** Lo que dice la sección en la raíz: «Todos», lo marcado, o cuántos. Como el filtro del Plan. */
  const resumen = (ops: DropdownOption[], todos: string, emoji = false): string => {
    const marcados = ops.filter((o) => valores.includes(o.value)).map((o) => o.value);
    if (!marcados.length) return todos;
    // Los emojis se dicen a sí mismos: «📅 🎯» se lee de un vistazo, «2 elegidos» obliga a entrar.
    if (emoji) return marcados.map((v) => v.slice(v.indexOf(':') + 1)).join(' ');
    if (marcados.length === 1) return ROTULO[marcados[0]] ?? '1 elegido';
    return `${marcados.length} elegidos`;
  };
  const activo = (ops: DropdownOption[]) => ops.some((o) => valores.includes(o.value));

  return [
    { title: SECCION.emojis, icono: 'emoji', options: opEmojis, resumen: resumen(opEmojis, 'Todos', true), activo: activo(opEmojis) },
    { title: SECCION.estado, icono: 'activar', options: opEstado, resumen: resumen(opEstado, 'Todas'), activo: activo(opEstado) },
    { title: SECCION.canal, icono: 'enviar', options: opCanal, resumen: resumen(opCanal, 'Todos'), activo: activo(opCanal) },
  ];
}
