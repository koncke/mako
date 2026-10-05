'use client';

// =============================================================================
// EtapasEntregaModal — el editor de la ENTREGA de un producto, con la cara del CRM
// =============================================================================
// «Fijate el diseño de ese editable en el CRM y copialo tal cual. El tamaño del
// contenedor, los botones, etc...» y «agregar fase debería estar arriba del todo, no
// abajo. Y tal como en el editable del CRM, debería poder cambiar el nombre del
// producto, y se debe cambiar en todos lados» (Martín, 05/10/2026).
//
// EL MOLDE ES app/crm/EtapasModal.tsx, PIEZA POR PIEZA, y lo que se copia son los
// NÚMEROS, no la idea: caja de 760 con alto FIJO `min(85vh, 620px)` y sin filetes; el
// título es un input de 21 px que renombra al salir; cada etapa es una `caja` (radio 10,
// fondo surface-2) con su `fila` transparente encima; el nombre es un botón que NO
// estira; las flechas son `MoverPartido` y la ✕ es `CerrarIcon` en un botón de 28 — los
// dos IMPORTADOS del CRM y no copiados, porque dos copias de un control divergen en el
// primer ajuste y acá se ven a un clic de distancia. El pie es sólo «Eliminar producto»
// en rojo, a la izquierda. Las filas se arrastran. Y el velo de hover es el del CRM
// (`.crm-hover`, app/_ui/ui.css): allá lo hereda el modal del `<main>` de la ruta, acá
// no hay nada arriba que lo ponga, así que lo pone el envoltorio.
//
// LO QUE ESTE EDITOR TIENE Y EL DEL CRM NO, Y SE CONSERVA: las FASES con su color, el
// selector de fase por fila, el conteo de clientes por columna, el aviso de secuencias
// pegado a la ✕, y que guarda solo (no hay botón de guardar: «no existe el botón de
// "No cambiar nada" o el de guardar… Se guarda automáticamente»).
//
// ⚠️ SIN TABS. El del CRM tiene «Etapas / Nutrición» porque allá la nutrición es una
// lista EDITABLE (agregar, quitar, de qué etapa sale). Acá lo único que hay de las
// secuencias es CUÁNTAS apuntan a cada etapa: una tab con eso sería una lista de
// números sin un solo control, y un control vacío se lee como roto. El número vive
// donde decide algo — en el aviso de la ✕ —, y las secuencias se editan en Chatbot.
//
// ⚠️ «AGREGAR FASE» VA ARRIBA DE TODO, en el lugar donde el CRM tiene sus tabs; «+
// Agregar etapa» queda donde lo tiene el CRM, al pie de la lista (uno por grupo).
//
// ─────────────────────────────────────────────────────────────────────────────
// LAS DECISIONES QUE NO SE VEN, cada una con lo que rompía
// ─────────────────────────────────────────────────────────────────────────────
//
// ⚠️ SE GUARDA LA LISTA ENTERA, con un respiro. Las etapas son un ORDEN: un merge por
// clave no puede expresar «esta columna va antes que aquélla» ni un borrado. El respiro
// existe porque renombrar es una tecla por letra.
//
// ⚠️ «¿HAY ALGO QUE GUARDAR?» SE CONTESTA COMPARANDO, NO CON UN «ES EL PRIMER RENDER».
// Abrir el editor no puede escribir: ese upsert marca el servicio como DECLARADO, y
// mirar la pantalla convertiría el default en una configuración que nadie escribió. La
// guarda de antes era `if (primera.current)`, y Next 16 corre el App Router en Strict
// Mode por default: en desarrollo cada efecto corre DOS veces al montar, la segunda ya
// con la bandera en false, así que abrir el editor en local programaba un guardado — y
// bootear local escribe en la base de producción. Comparar la FIRMA de lo que se
// mandaría contra la de lo último que se mandó no depende de cuántas veces corra el
// efecto, y de paso no escribe cuando alguien deshace a mano lo que acababa de hacer.
//
// ⚠️ CERRAR NO PIERDE LO ÚLTIMO. Con el respiro, renombrar una columna y cerrar en el
// mismo medio segundo limpiaba el timer en el desmonte y el nombre no se guardaba nunca,
// sin un error. El desmonte manda lo pendiente. Y los guardados van EN FILA: dos upserts
// del objeto entero que salen a la vez pueden llegar al revés, y el que gana es el viejo.
//
// ⚠️ LA CLAVE DE UNA ETAPA BORRADA NO VUELVE. `nuevaClaveEtapa` recibe TODAS las claves
// que esta sesión vio, las que están y las que se sacaron: si se reusara, los clientes
// que estaban en la etapa vieja reaparecerían dentro de la nueva, en una columna a la
// que nadie los movió. El «Deshacer» del toast sí devuelve la MISMA clave: es la misma
// etapa que vuelve, no una nueva con su nombre.
//
// ⚠️ LA PRIMERA ETAPA ES LA ENTRADA, y se trata como la del CRM: no se mueve, no se
// quita y nada va antes de ella. Acá no es un gusto: «un cliente SIN fila está en la
// PRIMERA etapa» es una regla DERIVADA (lib/servicio-etapas.ts), así que mover otra
// columna arriba pasaba EN SILENCIO a todos los clientes sin fila a esa columna, y
// sacarla los pasaba a la segunda — con el aviso de la ✕ diciendo «quedan sin columna»,
// que era falso para ellos. Con la entrada fija, el número del aviso es exacto: en
// cualquier otra columna sólo cuentan los que tienen fila ahí.
//
// ⚠️ MOVER ES DENTRO DEL GRUPO QUE SE VE. El orden del tablero es UNO, y las fases lo
// agrupan sólo en esta pantalla: una flecha que intercambiaba con el vecino de la lista
// GLOBAL no movía nada en un grupo cuando el vecino era de otra fase. Ahora las flechas y
// el arrastre permutan las etapas del grupo entre los lugares que el grupo ya ocupa, y
// una etapa nueva —o una que cambia de fase— cae al final de su grupo también en el
// tablero. Los grupos se dibujan en el orden en que aparecen en el tablero.
//
// ⚠️ EL ESCAPE ADENTRO DE UN CAMPO NO PUEDE LLEGAR AL MODAL. `Modal` escucha la tecla en
// `document` y en CAPTURA, o sea ANTES que cualquier `onKeyDown` de un input, y además
// frena la propagación: el Escape para cancelar un nombre cerraba el editor entero, y el
// `stopPropagation` que había en el input no podía evitarlo porque nunca le llegaba la
// tecla. Lo mismo con el «¿seguro?»: `Confirm` escucha en `document` también, así que un
// Escape cerraba la pregunta Y el editor. El único lugar que llega antes que `document`
// es `window` en captura: ahí se frena, y el campo vuelve a su valor.
//
// ─────────────────────────────────────────────────────────────────────────────
// LAS FASES
// ─────────────────────────────────────────────────────────────────────────────
// «Al crear columnas también se puedan crear FASES… dentro de una fase pueden haber varias
// etapas (columnas), y que se le ponga el color a esa fase y que sus columnas adopten eso»
// (Martín). Es el mismo modelo que el CRM ya tiene con Activo / Nutrición / Descartado.
//
// ⚠️ UNA ETAPA SIN FASE ES EL CASO NORMAL, no un hueco por llenar. Sin ninguna fase esta
// pantalla se ve exactamente como la del CRM: sin rótulos de grupo y sin selector.

import {
  useCallback, useEffect, useRef, useState,
  type CSSProperties, type DragEvent as DragReact, type ReactNode,
} from 'react';
import { Modal, Confirm, Toast, useToast } from '@/app/_ui';
import { CerrarIcon } from '@/app/crm/iconos';
import { MoverPartido } from '@/app/crm/MoverPartido';
import {
  nuevaClaveEtapa, nuevaClaveFase, colorNuevaEtapa, normalizarEtapas, colorDeEtapa,
  type EtapaEntrega, type FaseEntrega,
} from '@/lib/servicio-etapas';

const SANS = "'Geist', sans-serif";
/** Un tablero de una sola columna no es un tablero. */
const MINIMO = 2;
/** Lo que se espera antes de escribir. Renombrar es una tecla por letra. */
const RESPIRO_MS = 600;
const MAX_LABEL = 40;
/** El mismo tope que el título del editor del CRM y que `renombrarServicioAction`. */
const MAX_NOMBRE = 60;

/** La línea de 2 px que dice dónde va a caer la etapa que se está arrastrando. */
const MARCA: CSSProperties = { boxShadow: 'inset 0 2px 0 0 var(--primary)' };
const MARCA_FIN: CSSProperties = { boxShadow: 'inset 0 -2px 0 0 var(--primary)' };
/** La caja de una etapa: el fondo y el radio viven acá, la fila va transparente encima. */
const CAJA: CSSProperties = { borderRadius: 10, background: 'var(--surface-2)', overflow: 'hidden' };
const FILA: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px 7px 11px' };
const PUNTO: CSSProperties = { width: 9, height: 9, flex: 'none', borderRadius: '50%' };
const INPUT: CSSProperties = {
  flex: 1, minWidth: 0, fontFamily: SANS, fontWeight: 600, fontSize: 14, color: 'var(--ink)',
  background: 'var(--surface)', border: '1px solid var(--primary)', borderRadius: 7,
  padding: '4px 8px', outline: 'none',
};
/** El rótulo de un grupo: chico y en versalitas, como las bandas del tablero. */
const ROTULO_FASE: CSSProperties = {
  fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: '.07em',
  textTransform: 'uppercase', color: 'var(--dim)',
};

/**
 * ⚠️ EL TÍTULO ESTIRA. `.mk-modal__tit` es una columna flex con `align-items: flex-start`,
 * así que el `<h2>` mide lo que mide su contenido — y un `<input>` no mide su texto: su
 * ancho natural sale del atributo `size` (20) contado en el dígito «0» de la fuente
 * activa. Medido en esta casa el 29/09: con eso un nombre de 20 y pico de letras se corta
 * según el motor y según si la webfont ya llegó. Estirado, el input ocupa la cabecera.
 *
 * Sin backticks adentro de esta cadena, ni en un comentario: la cierran a la mitad.
 */
const CSS = '.ee-modal .mk-modal__h{align-self:stretch}';

/** El botoncito de una acción por fila (el de app/crm/EtapasModal.tsx). Sin texto: el
 *  `aria-label` y el `title` llevan la frase. */
function AccionFila({ etiqueta, onClick, disabled, children }: {
  etiqueta: string; onClick: () => void; disabled?: boolean; children: ReactNode;
}) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} aria-label={etiqueta} title={etiqueta} data-nodrag
      style={{
        width: 28, height: 28, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 8, border: '1px solid transparent', background: 'transparent', fontFamily: SANS, fontSize: 13,
        color: disabled ? 'var(--faint)' : 'var(--dim)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1,
      }}
    >{children}</button>
  );
}

/** A qué grupo se dibuja una etapa. `''` = sin fase (o con una fase que ya no existe,
 *  que es la misma regla que `colorDeEtapa`: cae a lo suyo). */
function grupoDe(e: EtapaEntrega, fases: readonly FaseEntrega[]): string {
  return e.fase && fases.some((f) => f.key === e.fase) ? e.fase : '';
}

/** Los lugares de la lista GLOBAL que ocupa un grupo, en orden. */
function lugaresDe(lista: readonly EtapaEntrega[], grupo: string, fases: readonly FaseEntrega[]): number[] {
  const out: number[] = [];
  lista.forEach((e, i) => { if (grupoDe(e, fases) === grupo) out.push(i); });
  return out;
}

/** El mismo saneo que corre en el server, antes de mandar: así el error se ve acá y no
 *  vuelve como un «no se pudo guardar» que no dice qué arreglar. */
function limpiar(lista: readonly EtapaEntrega[]): EtapaEntrega[] | null {
  return normalizarEtapas(lista.map((e) => ({ ...e, label: e.label.trim() || e.key })));
}

/** Lo que identifica a un guardado. Dos firmas iguales = no hay nada que mandar. */
function firmaDe(etapas: readonly EtapaEntrega[], fases: readonly FaseEntrega[]): string {
  return JSON.stringify([etapas, fases]);
}

type Pendiente = { etapas: EtapaEntrega[]; fases: FaseEntrega[]; firma: string };
type Confirmar = {
  titulo: string; cuerpo: string; boton: string; cancelar: string;
  tono?: 'danger' | 'primary'; hacer: () => void;
};

export function EtapasEntregaModal({
  servicio, etapas, fases, conteo, secuencias, onGuardar, onRenombrar, onEliminar, onCerrar,
}: {
  /** El nombre actual del producto: es el título, y se edita ahí. */
  servicio: string;
  etapas: EtapaEntrega[];
  fases: FaseEntrega[];
  /** Cuántos clientes hay en cada etapa. Es lo que hace que sacar una sea una decisión. */
  conteo: Record<string, number>;
  /**
   * Cuántas SECUENCIAS cuelgan de cada etapa. Los clientes eran sólo la mitad de lo que
   * apunta a una columna: la otra mitad son los mensajes automáticos, y ésos no «quedan
   * sin columna» cuando la etapa desaparece — dejan de dispararse, en silencio.
   *
   * ⚠️ `null` = NO SE PUDO LEER, que no es lo mismo que ninguna: decirlo sobre una
   * consulta caída es exactamente la afirmación que hace apretar el botón.
   */
  secuencias: Record<string, number> | null;
  onGuardar: (etapas: EtapaEntrega[], fases: FaseEntrega[]) => Promise<string | null>;
  /**
   * Renombra el PRODUCTO. `null` = listo; un texto = el error, que se muestra tal cual.
   * El server escribe el mismo campo que lee el CRM, así que el nombre cambia en los dos
   * lados sin sincronizar nada.
   */
  onRenombrar: (nombre: string) => Promise<string | null>;
  /**
   * Archiva el producto, como el «Eliminar» del CRM. Si no viene, el botón NO se dibuja:
   * un «Eliminar» que contesta «no se puede» se lee como que la app está rota. Con
   * `null` el editor se cierra; con un texto, lo muestra y se queda abierto.
   */
  onEliminar?: () => Promise<string | null>;
  onCerrar: () => void;
}) {
  const [lista, setLista] = useState<EtapaEntrega[]>(() => etapas.map((e) => ({ ...e })));
  const [tramos, setTramos] = useState<FaseEntrega[]>(() => fases.map((f) => ({ ...f })));
  /**
   * TODAS las claves que esta sesión vio — etapas y fases, incluidas las que se sacaron.
   *
   * ⚠️ NO SE DERIVA DE LA LISTA: justamente las borradas son las que ya no están ahí, y
   * son las que no se pueden reusar. Van las dos familias juntas porque una fase y una
   * etapa pueden llamarse igual, y el prefijo `f_` es lo único que las separa.
   */
  const [vistas, setVistas] = useState<string[]>(
    () => [...etapas.map((e) => e.key), ...fases.map((f) => f.key)],
  );
  /** Error al guardar las etapas. */
  const [mal, setMal] = useState('');
  /** Error al renombrar o eliminar el producto. Va aparte: son dos escrituras distintas. */
  const [malProducto, setMalProducto] = useState('');
  /** Qué nombre está abierto para editar: `e:<clave>` una etapa, `f:<clave>` una fase. */
  const [renombrando, setRenombrando] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<Confirmar | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const { toast, show, clear } = useToast();
  const listaRef = useRef<HTMLDivElement | null>(null);

  // ── El guardado automático ───────────────────────────────────────────────────
  const guardarRef = useRef(onGuardar);
  useEffect(() => { guardarRef.current = onGuardar; }, [onGuardar]);
  /** La firma de lo que vino del server: abrir y cerrar sin tocar nada no escribe. */
  const [firmaInicial] = useState(() => firmaDe(limpiar(etapas) ?? etapas, fases));
  /** Lo último que se le PIDIÓ al server, y lo último que CONFIRMÓ. */
  const enviada = useRef(firmaInicial);
  const confirmada = useRef(firmaInicial);
  const pendiente = useRef<Pendiente | null>(null);
  /** Los guardados salen de a uno: ver el encabezado. */
  const cola = useRef<Promise<void>>(Promise.resolve());

  const enviar = useCallback((): void => {
    const p = pendiente.current;
    if (!p) return;
    pendiente.current = null;
    enviada.current = p.firma;
    cola.current = cola.current.then(async () => {
      try {
        const err = await guardarRef.current(p.etapas, p.fases);
        if (err) { enviada.current = confirmada.current; setMal(err); return; }
        confirmada.current = p.firma;
        setMal('');
      } catch {
        enviada.current = confirmada.current;
        setMal('No se pudo guardar.');
      }
    });
  }, []);

  useEffect(() => {
    if (lista.length < MINIMO) { setMal(`Hacen falta al menos ${MINIMO} etapas.`); return; }
    const limpias = limpiar(lista);
    if (!limpias) { setMal('Esas etapas no se pueden guardar.'); return; }
    const firma = firmaDe(limpias, tramos);
    // Sin cambios respecto de lo último que se mandó, no hay nada que escribir: cubre el
    // montaje (las dos corridas de Strict Mode incluidas) y el deshacer a mano.
    if (firma === enviada.current) { pendiente.current = null; return; }
    pendiente.current = { etapas: limpias, fases: tramos, firma };
    const t = setTimeout(enviar, RESPIRO_MS);
    return () => clearTimeout(t);
  }, [lista, tramos, enviar]);

  // Al cerrar, lo que quedó esperando el respiro sale igual.
  useEffect(() => () => enviar(), [enviar]);

  // ── El nombre del producto (el título) ──────────────────────────────────────
  // El nombre que el server ya tiene. Se resiembra si el padre trae otro (otra pantalla
  // lo renombró), sin desmontar el editor.
  const [nombreOk, setNombreOk] = useState(servicio);
  const [nombreVisto, setNombreVisto] = useState(servicio);
  if (servicio !== nombreVisto) { setNombreVisto(servicio); setNombreOk(servicio); }
  const tituloRef = useRef<HTMLInputElement | null>(null);

  const guardarNombre = async (valor: string) => {
    const limpio = valor.trim().replace(/\s+/g, ' ');
    // Vacío no es un nombre, y uno igual no se manda: en los dos casos vuelve el que está.
    if (!limpio || limpio === nombreOk) {
      if (tituloRef.current) tituloRef.current.value = nombreOk;
      return;
    }
    let err: string | null;
    try { err = await onRenombrar(limpio); } catch { err = 'No se pudo renombrar.'; }
    // Con error, el campo se queda con lo escrito para poder corregirlo; Escape lo devuelve.
    if (err) { setMalProducto(err); return; }
    setMalProducto('');
    setNombreOk(limpio);
  };

  // ── Eliminar el producto ────────────────────────────────────────────────────
  const borrar = async () => {
    if (!onEliminar) return;
    // Lo que esperaba el respiro no se escribe sobre un producto que se va. Si eliminar
    // falla, vuelve a la fila y sale.
    const enEspera = pendiente.current;
    pendiente.current = null;
    setOcupado(true);
    let err: string | null;
    try { err = await onEliminar(); } catch { err = 'No se pudo eliminar.'; }
    setOcupado(false);
    if (err) {
      setMalProducto(err);
      if (enEspera && !pendiente.current) { pendiente.current = enEspera; enviar(); }
      return;
    }
    onCerrar();
  };

  /**
   * ⚠️ SIEMPRE PREGUNTA, al revés que el CRM con un embudo sin leads. Allá lo que lo
   * permite es el «Deshacer» del toast, que vuelve a activar el embudo; acá no hay con
   * qué deshacerlo desde esta pantalla, y sin deshacer la fricción es la red.
   *
   * El texto dice sólo lo que vale en los dos caminos de `eliminarServicioAction`: un
   * producto con embudo se archiva y otro sin embudo se da de baja, y sólo el primero
   * aparece en «Productos eliminados». Prometer de dónde vuelve sería cierto a medias.
   */
  const eliminar = () => {
    if (!onEliminar) return;
    setConfirmar({
      titulo: `Eliminar «${nombreOk}»`,
      cuerpo: 'Deja de verse aquí y en el CRM. No se borra ningún cliente ni su historial.',
      boton: 'Eliminar el producto',
      cancelar: 'No, dejarlo',
      hacer: () => { void borrar(); },
    });
  };

  // ── Las etapas ──────────────────────────────────────────────────────────────
  /** La entrada: la primera columna del tablero, donde cae todo cliente sin fila. */
  const entrada = lista[0]?.key ?? null;
  const esEntrada = (e: EtapaEntrega) => e.key === entrada;

  /** Una etapa nueva cae al FINAL DE SU GRUPO, también en el tablero. */
  const agregarEtapa = (label: string, fase?: string) => {
    const key = nuevaClaveEtapa(label, vistas);
    setLista((v) => {
      const nueva: EtapaEntrega = { key, label, ...colorNuevaEtapa(v.length), ...(fase ? { fase } : {}) };
      const lugares = lugaresDe(v, fase ?? '', tramos);
      const ult = lugares[lugares.length - 1];
      return ult === undefined ? [...v, nueva] : [...v.slice(0, ult + 1), nueva, ...v.slice(ult + 1)];
    });
    setVistas((v) => [...v, key]);
  };

  const guardarNombreEtapa = (e: EtapaEntrega, valor: string) => {
    const limpio = valor.trim().replace(/\s+/g, ' ');
    setRenombrando(null);
    // Sin cambio no se toca: el blur también llega con Escape, ya con el valor devuelto.
    if (!limpio || limpio === e.label) return;
    setLista((v) => v.map((x) => (x.key === e.key ? { ...x, label: limpio } : x)));
  };

  /** La saca y ofrece devolverla — la MISMA, con su clave, en su lugar. */
  const quitarEtapa = (e: EtapaEntrega) => {
    const i = lista.findIndex((x) => x.key === e.key);
    setLista((v) => v.filter((x) => x.key !== e.key));
    show(`Quitada «${e.label}»`, () => setLista((v) => (
      v.some((x) => x.key === e.key) ? v : [...v.slice(0, i), e, ...v.slice(i)]
    )));
  };

  /**
   * Sacar una etapa, diciendo ANTES lo que se lleva puesto.
   *
   * ⚠️ SIN BOTÓN DE GUARDAR, EL AVISO VA PEGADO A LA ✕. Guardando solo no hay dónde frenar
   * después, así que la consecuencia va antes del click. Y sin nada que perder no hay
   * fricción: sale y queda el «Deshacer», igual que en el CRM.
   *
   * ⚠️ LAS DOS CONSECUENCIAS VAN SEPARADAS PORQUE SON DISTINTAS: un cliente sin columna se
   * puede volver a mover y mientras tanto el tablero lo muestra aparte; una secuencia sin
   * etapa deja de dispararse y no se ve en ningún lado.
   */
  const sacar = (e: EtapaEntrega) => {
    if (lista.length <= MINIMO || esEntrada(e)) return;
    const n = conteo[e.key] ?? 0;
    const q = secuencias?.[e.key] ?? 0;
    const partes: string[] = [];
    if (n > 0) partes.push(n + (n === 1 ? ' cliente queda' : ' clientes quedan') + ' sin columna');
    if (q > 0) partes.push(q + (q === 1 ? ' secuencia deja' : ' secuencias dejan') + ' de dispararse');
    // «No pude revisar» no es «no hay»: con la lectura caída se avisa igual.
    if (secuencias === null) partes.push('no pude revisar si hay secuencias apuntando aquí');
    const hacer = () => quitarEtapa(e);
    if (!partes.length) { hacer(); return; }
    const frase = partes.join(' y ');
    setConfirmar({
      titulo: 'Sacar «' + e.label + '»',
      cuerpo: frase.charAt(0).toUpperCase() + frase.slice(1) + '.',
      boton: 'Sacar la columna',
      cancelar: 'No, dejarla',
      hacer,
    });
  };

  /** Mover una etapa DENTRO de su grupo, entre los lugares que el grupo ya ocupa. */
  const mover = (key: string, d: -1 | 1) => setLista((v) => {
    const e = v.find((x) => x.key === key);
    if (!e) return v;
    const lugares = lugaresDe(v, grupoDe(e, tramos), tramos);
    const p = lugares.findIndex((j) => v[j].key === key);
    const q = p + d;
    if (p < 0 || q < 0 || q >= lugares.length) return v;
    // Ni se mueve la entrada ni se le pasa por encima.
    if (lugares[p] === 0 || lugares[q] === 0) return v;
    const out = [...v];
    [out[lugares[p]], out[lugares[q]]] = [out[lugares[q]], out[lugares[p]]];
    return out;
  });

  /** Soltar una etapa arrastrada en el lugar `destino` de su grupo. */
  const soltarEn = (key: string, grupo: string, destino: number) => setLista((v) => {
    if (v[0]?.key === key) return v;
    const lugares = lugaresDe(v, grupo, tramos);
    const miembros = lugares.map((j) => v[j]);
    const i = miembros.findIndex((x) => x.key === key);
    if (i < 0) return v;
    const piso = lugares[0] === 0 ? 1 : 0;
    // El índice se corre uno cuando la etapa venía de más arriba, o soltar hacia abajo
    // cae un lugar antes. Y nunca por encima de la entrada.
    const pos = Math.max(piso, i < destino ? destino - 1 : destino);
    if (pos === i) return v;
    const resto = miembros.filter((x) => x.key !== key);
    const nuevo = [...resto.slice(0, pos), miembros[i], ...resto.slice(pos)];
    const out = [...v];
    lugares.forEach((j, k) => { out[j] = nuevo[k]; });
    return out;
  });

  /**
   * Cambiar la fase de una etapa: cae al final del grupo nuevo, también en el tablero.
   * La entrada cambia de color pero NO de lugar: es donde cae todo cliente sin fila.
   */
  const aFase = (key: string, fase: string | undefined) => setLista((v) => {
    const i = v.findIndex((e) => e.key === key);
    if (i < 0) return v;
    const movida: EtapaEntrega = { ...v[i], fase };
    if (i === 0) return v.map((e, j) => (j === 0 ? movida : e));
    const resto = v.filter((_, j) => j !== i);
    const lugares = lugaresDe(resto, fase && tramos.some((f) => f.key === fase) ? fase : '', tramos);
    const ult = lugares[lugares.length - 1];
    if (ult === undefined) return v.map((e, j) => (j === i ? movida : e));
    return [...resto.slice(0, ult + 1), movida, ...resto.slice(ult + 1)];
  });

  // ── Las fases ───────────────────────────────────────────────────────────────
  /** La fase recién creada, para traerla a la vista: nace al final, lejos del botón. */
  const faseNueva = useRef<string | null>(null);

  /* El `+ 3` corre la paleta para que la primera fase no nazca del color de la primera
     etapa: con los dos puntos iguales, agrupar no se ve. */
  const agregarFase = (label: string) => {
    const key = nuevaClaveFase(label, vistas);
    faseNueva.current = key;
    setTramos((v) => [...v, { key, label, ...colorNuevaEtapa(v.length + 3) }]);
    setVistas((v) => [...v, key]);
  };

  useEffect(() => {
    const key = faseNueva.current;
    if (!key) return;
    faseNueva.current = null;
    // ⚠️ A MANO Y SOBRE EL CUERPO DEL MODAL, no con `scrollIntoView`: ése scrollea TODOS
    // los ancestros, incluidos los que tienen `overflow: hidden`, y ahí lo que se ve y
    // dónde cae el clic dejan de coincidir.
    const sc = listaRef.current?.closest<HTMLElement>('.mk-modal__cuerpo');
    const el = listaRef.current?.querySelector<HTMLElement>(`[data-grupo-fase="${key}"]`);
    if (!sc || !el) return;
    const r = el.getBoundingClientRect();
    const rs = sc.getBoundingClientRect();
    if (r.bottom > rs.bottom) sc.scrollTop += r.bottom - rs.bottom + 8;
  }, [tramos]);

  const guardarNombreFase = (f: FaseEntrega, valor: string) => {
    const limpio = valor.trim().replace(/\s+/g, ' ');
    setRenombrando(null);
    if (!limpio || limpio === f.label) return;
    setTramos((v) => v.map((x) => (x.key === f.key ? { ...x, label: limpio } : x)));
  };

  /** Sacar una fase NO borra sus etapas: quedan sueltas, con su color propio. */
  const sacarFase = (f: FaseEntrega) => {
    const miembros = lista.filter((e) => e.fase === f.key).map((e) => e.key);
    const i = tramos.findIndex((x) => x.key === f.key);
    const hacer = () => {
      setTramos((v) => v.filter((x) => x.key !== f.key));
      setLista((v) => v.map((e) => (e.fase === f.key ? { ...e, fase: undefined } : e)));
      show(`Quitada «${f.label}»`, () => {
        setTramos((v) => (v.some((x) => x.key === f.key) ? v : [...v.slice(0, i), f, ...v.slice(i)]));
        setLista((v) => v.map((e) => (miembros.includes(e.key) && !e.fase ? { ...e, fase: f.key } : e)));
      });
    };
    const n = miembros.length;
    if (!n) { hacer(); return; }
    setConfirmar({
      titulo: 'Sacar la fase «' + f.label + '»',
      cuerpo: n + (n === 1 ? ' columna queda suelta' : ' columnas quedan sueltas') + ', con su color propio. No se borra ninguna.',
      boton: 'Sacar la fase',
      cancelar: 'No, dejarla',
      tono: 'primary',
      hacer,
    });
  };

  // ── El Escape, antes que el modal (ver el encabezado) ───────────────────────
  const hayPregunta = confirmar !== null;
  useEffect(() => {
    const alTeclear = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      // Con el «¿seguro?» abierto, el Escape cierra SÓLO la pregunta.
      if (hayPregunta) { ev.stopPropagation(); setConfirmar(null); return; }
      // En un campo de este editor, devuelve el valor y suelta el foco: el `onBlur` de
      // cada campo ya sabe que un valor sin cambios no se guarda.
      const el = ev.target;
      if (!(el instanceof HTMLInputElement) || el.dataset.eeEsc === undefined) return;
      ev.stopPropagation();
      el.value = el.dataset.eeEsc;
      el.blur();
    };
    window.addEventListener('keydown', alTeclear, true);
    return () => window.removeEventListener('keydown', alTeclear, true);
  }, [hayPregunta]);

  // ── El arrastre, con el molde del CRM (y el de las filas del plan) ───────────
  // La foto que sigue al cursor la dibuja el SISTEMA OPERATIVO y ninguna regla CSS la
  // gobierna: se le pasa una VACÍA y la copia la dibujamos nosotros, movida con
  // `transform` sobre un ref. Se arrastra DENTRO del grupo: cambiar de fase es el
  // selector de la fila, y un mismo gesto para dos cosas es una sorpresa.
  const agarrada = useRef<{ key: string; grupo: string } | null>(null);
  const copia = useRef<HTMLElement | null>(null);
  const medios = useRef<number[]>([]);
  /** Dónde arrancó el gesto: desde un control no se arrastra la fila. */
  const origen = useRef<EventTarget | null>(null);
  const [ins, setIns] = useState<number | null>(null);
  const [arrastrando, setArrastrando] = useState<{ key: string; grupo: string } | null>(null);

  const scroller = () => listaRef.current?.closest<HTMLElement>('.mk-modal__cuerpo') ?? null;

  const limpiarDrag = () => {
    setIns(null);
    setArrastrando(null);
    medios.current = [];
    agarrada.current = null;
    copia.current?.remove();
    copia.current = null;
  };

  const agarrar = (e: DragReact<HTMLDivElement>, key: string, grupo: string) => {
    const desde = origen.current instanceof Element ? origen.current : null;
    if (desde?.closest('[data-nodrag]')) { e.preventDefault(); return; }
    const fila = e.currentTarget;
    e.dataTransfer.setData('text/plain', key);
    e.dataTransfer.effectAllowed = 'move';
    try {
      const vacio = document.createElement('canvas');
      vacio.width = 1; vacio.height = 1;
      e.dataTransfer.setDragImage(vacio, 0, 0);
    } catch { /* si no deja, queda la del navegador */ }

    // ⚠️ EN COORDENADAS DEL CONTENIDO del cuerpo del modal (`+ scrollTop`): si el cuerpo se
    // corre durante el gesto, los puntos medios medidos al agarrar siguen valiendo.
    const sc = scroller();
    const base = sc?.scrollTop ?? 0;
    medios.current = [...(listaRef.current?.querySelectorAll<HTMLElement>(`[data-etapa][data-grupo="${grupo}"]`) ?? [])]
      .map((f) => { const r = f.getBoundingClientRect(); return r.top + r.height / 2 + base; });

    const r = fila.getBoundingClientRect();
    const clon = fila.cloneNode(true) as HTMLElement;
    Object.assign(clon.style, {
      position: 'fixed', top: '0', left: '0', width: `${r.width}px`, margin: '0',
      background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: '10px',
      boxShadow: '0 18px 40px rgba(18,21,27,.34)', pointerEvents: 'none', zIndex: '3000',
      transform: `translate3d(${r.left}px, ${r.top}px, 0)`, transition: 'none', opacity: '1',
    });
    document.body.appendChild(clon);
    copia.current = clon;

    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    const seguir = (ev: globalThis.DragEvent) => {
      if (!copia.current) { document.removeEventListener('dragover', seguir, true); return; }
      copia.current.style.transform = `translate3d(${ev.clientX - dx}px, ${ev.clientY - dy}px, 0)`;
    };
    document.addEventListener('dragover', seguir, true);
    const fin = () => {
      document.removeEventListener('dragover', seguir, true);
      document.removeEventListener('dragend', fin, true);
      document.removeEventListener('drop', fin, true);
      copia.current?.remove();
      copia.current = null;
    };
    document.addEventListener('dragend', fin, true);
    document.addEventListener('drop', fin, true);
    agarrada.current = { key, grupo };
    // Al nodo ORIGEN no se le toca el tamaño: se marca. Y en el tick siguiente, porque el
    // navegador saca la foto del arrastre al terminar este handler.
    setTimeout(() => setArrastrando({ key, grupo }), 0);
  };

  // ── Los grupos, en el orden en que aparecen en el tablero ───────────────────
  const hayFases = tramos.length > 0;
  const orden: string[] = [];
  for (const e of lista) { const g = grupoDe(e, tramos); if (!orden.includes(g)) orden.push(g); }
  // Las fases todavía vacías no tienen lugar en el tablero: van al final, en su orden.
  for (const f of tramos) if (!orden.includes(f.key)) orden.push(f.key);
  const grupos = orden.map((g) => ({
    clave: g,
    fase: g ? tramos.find((f) => f.key === g) ?? null : null,
    etapas: lista.filter((e) => grupoDe(e, tramos) === g),
  }));

  return (
    <div className="crm-hover ee-modal" style={{ display: 'contents' }}>
      <Modal
        titulo={
          // El título es un CAMPO, como en el CRM: renombra el producto al salir.
          <input
            ref={tituloRef}
            key={nombreOk}
            defaultValue={nombreOk}
            maxLength={MAX_NOMBRE}
            aria-label="Nombre del producto"
            data-ee-esc={nombreOk}
            onBlur={(e) => { void guardarNombre(e.target.value); }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            style={{
              width: '100%', fontFamily: SANS, fontWeight: 600, fontSize: 21, letterSpacing: '-0.01em',
              color: 'var(--ink)', background: 'transparent', border: '1px solid transparent',
              borderRadius: 8, padding: '2px 8px', margin: '0 0 0 -8px', outline: 'none',
            }}
            onFocus={(e) => { e.target.style.background = 'var(--surface-2)'; e.target.style.borderColor = 'var(--primary)'; }}
            onBlurCapture={(e) => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'transparent'; }}
          />
        }
        ancho={760}
        // El alto es un NÚMERO y no un tope: agregar o sacar una fila no puede achicar la
        // caja («JAMÁS achiques el tamaño de un detail según lo que contenga dentro»).
        alto="min(85vh, 620px)"
        sinFiletes
        etiqueta={`Editar el producto ${nombreOk}`}
        onCerrar={onCerrar}
        pie={
          // ⚠️ UN SOLO BOTÓN DE CERRAR (la ✕ de arriba). Acá abajo va sólo eliminar, a la
          // izquierda y como TEXTO rojo — no como botón.
          onEliminar ? (
            <div style={{ flex: 1, display: 'flex' }}>
              <button type="button" onClick={eliminar} disabled={ocupado}
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--bad)', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: ocupado ? 'default' : 'pointer' }}>
                Eliminar producto
              </button>
            </div>
          ) : undefined
        }
      >
        {/* «Agregar fase debería estar arriba del todo»: en el lugar de las tabs del CRM. */}
        <NuevoRenglon tipo="fase" onCrear={agregarFase} />

        <div ref={listaRef} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          onDragOver={(e) => {
            const a = agarrada.current;
            if (!a) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            // El empuje del cuerpo va ACÁ: durante un arrastre nativo el navegador congela
            // los timers y `requestAnimationFrame`, y sólo sigue entregando `dragover`.
            const sc = scroller();
            if (sc) {
              const rs = sc.getBoundingClientRect();
              if (e.clientY < rs.top + 36) sc.scrollTop -= 10;
              else if (e.clientY > rs.bottom - 36) sc.scrollTop += 10;
            }
            const y = e.clientY + (sc?.scrollTop ?? 0);
            const m = medios.current;
            let idx = m.length;
            for (let i = 0; i < m.length; i++) { if (y < m[i]) { idx = i; break; } }
            // La marca nunca se dibuja por encima de la entrada: prometer un destino que
            // el drop va a corregir es peor que no dibujarla.
            const piso = entrada && grupoDe(lista[0], tramos) === a.grupo ? 1 : 0;
            if (idx < piso) idx = piso;
            // Sólo se repinta cuando el destino CAMBIA.
            setIns((p) => (p === idx ? p : idx));
          }}
          onDrop={(e) => {
            const a = agarrada.current;
            if (!a) return;
            e.preventDefault();
            const destino = ins ?? medios.current.length;
            limpiarDrag();
            soltarEn(a.key, a.grupo, destino);
          }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIns(null); }}
        >
          {grupos.map((g) => {
            const piso = g.etapas[0] && esEntrada(g.etapas[0]) ? 1 : 0;
            return (
              <div key={g.clave || '__sueltas'} data-grupo-fase={g.clave}
                style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {/* El rótulo del grupo existe sólo si hay fases: sin ninguna, la lista es
                    la del CRM. «Sin fase» también se rotula, o sus etapas se leerían como
                    parte del grupo de arriba. */}
                {hayFases && (g.fase ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px 2px 2px' }}>
                    <span style={{ ...PUNTO, background: g.fase.dot }} aria-hidden />
                    {renombrando === 'f:' + g.fase.key ? (
                      <input
                        autoFocus defaultValue={g.fase.label} maxLength={MAX_LABEL} data-ee-esc={g.fase.label}
                        aria-label={'Nombre de la fase ' + g.fase.label}
                        onBlur={(ev) => guardarNombreFase(g.fase!, ev.target.value)}
                        onKeyDown={(ev) => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur(); }}
                        style={{ ...INPUT, fontSize: 13 }}
                      />
                    ) : (
                      <>
                        <button type="button" onClick={() => setRenombrando('f:' + g.fase!.key)}
                          title={'Cambiar el nombre de ' + g.fase.label}
                          style={{ ...ROTULO_FASE, flex: '0 1 auto', minWidth: 0, maxWidth: '70%', textAlign: 'left', background: 'none', border: 'none', padding: '4px 0', cursor: 'text', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        >{g.fase.label}</button>
                        <span style={{ flex: 1 }} />
                      </>
                    )}
                    <AccionFila etiqueta={'Sacar la fase ' + g.fase.label}
                      onClick={() => sacarFase(g.fase!)}><CerrarIcon /></AccionFila>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px 2px 2px', minHeight: 30 }}>
                    <span style={{ ...PUNTO, boxShadow: 'inset 0 0 0 1.5px var(--border-strong)' }} aria-hidden />
                    <span style={ROTULO_FASE}>Sin fase</span>
                  </div>
                ))}

                {g.etapas.map((e, k) => {
                  const entra = esEntrada(e);
                  const editando = renombrando === 'e:' + e.key;
                  const marca = arrastrando?.grupo === g.clave && ins !== null
                    ? (ins === k ? MARCA : ins === k + 1 && k === g.etapas.length - 1 ? MARCA_FIN : null)
                    : null;
                  // ⚠️ EL RADIO, EL FONDO, LA MARCA DEL ARRASTRE Y EL BORDE DEL NODO AGARRADO
                  // VIVEN EN LA CAJA, no en la fila. Y `data-etapa` va en la fila: de ahí
                  // salen los puntos medios del drop.
                  return (
                      <div key={e.key} style={{
                        ...CAJA,
                        // Al nodo ORIGEN no se le toca el tamaño: se marca con un borde.
                        outline: arrastrando?.key === e.key ? '1px solid var(--border-strong)' : 'none',
                        ...marca,
                      }}>
                        <div data-etapa data-grupo={g.clave}
                          draggable={!entra && !editando}
                          onPointerDown={(ev) => { origen.current = ev.target; }}
                          onDragStart={(ev) => agarrar(ev, e.key, g.clave)}
                          onDragEnd={limpiarDrag}
                          title={entra ? 'Aquí empieza todo cliente nuevo' : undefined}
                          style={{ ...FILA, cursor: entra ? 'default' : 'grab' }}>
                          <span style={{ ...PUNTO, background: colorDeEtapa(e, tramos) }} aria-hidden />
                          {editando ? (
                            <input
                              autoFocus defaultValue={e.label} maxLength={MAX_LABEL} data-nodrag data-ee-esc={e.label}
                              aria-label={'Nombre de ' + e.label}
                              onBlur={(ev) => guardarNombreEtapa(e, ev.target.value)}
                              onKeyDown={(ev) => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur(); }}
                              style={INPUT}
                            />
                          ) : (
                            // ⚠️ EL INPUT ABRE SÓLO DESDE EL TEXTO: «solo si clickeo en el texto
                            // del título de esa etapa debería abrirme el input, no en toda la
                            // fila». El botón NO estira; el hueco lo llena el span.
                            <>
                              <button type="button" data-nodrag onClick={() => setRenombrando('e:' + e.key)}
                                title={`Cambiar el nombre de ${e.label}`}
                                style={{ flex: '0 1 auto', minWidth: 0, maxWidth: '70%', textAlign: 'left', fontFamily: SANS, fontWeight: 600, fontSize: 14, color: 'var(--ink)', background: 'none', border: 'none', padding: '4px 0', cursor: 'text', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                              >{e.label}</button>
                              <span style={{ flex: 1 }} />
                            </>
                          )}
                          <span title="Clientes en esta columna"
                            style={{ flex: 'none', minWidth: 22, textAlign: 'center', fontFamily: SANS, fontSize: 11.5, fontWeight: 700, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>
                            {conteo[e.key] ?? 0}
                          </span>
                          {/* El selector de fase existe sólo si hay fases: con ninguna, es un
                              control con una sola opción. */}
                          {hayFases && (
                            <select value={e.fase && tramos.some((f) => f.key === e.fase) ? e.fase : ''}
                              aria-label={'Fase de ' + e.label} data-nodrag
                              onChange={(ev) => aFase(e.key, ev.target.value || undefined)}
                              style={{ flex: 'none', maxWidth: 116, fontFamily: SANS, fontSize: 12, color: 'var(--dim)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '3px 6px', cursor: 'pointer' }}>
                              <option value="">Sin fase</option>
                              {tramos.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                            </select>
                          )}
                          {/* ⚠️ LA ENTRADA NO LLEVA FLECHAS NI ✕ (ver el encabezado). Tres
                              controles apagados se leen como que la app está rota.

                              ⚠️ PERO SU LUGAR SE GUARDA. Lo que el CRM no tiene es una columna
                              de NÚMEROS a la izquierda de los controles: sin el hueco, el
                              conteo y la fase de la entrada —o de una etapa sola en su grupo,
                              que tampoco tiene a dónde moverse— quedaban corridos 92 px a la
                              derecha de los de las otras filas. Medido en el navegador. */}
                          {!entra && (k > piso || k < g.etapas.length - 1) ? (
                            <MoverPartido label={e.label}
                              puedeAntes={k > piso} puedeDespues={k < g.etapas.length - 1}
                              onAntes={() => mover(e.key, -1)} onDespues={() => mover(e.key, 1)} />
                          ) : <span style={{ width: 56, flex: 'none' }} aria-hidden />}
                          {/* ⚠️ Con el mínimo justo la ✕ se APAGA y lo dice en el title: un
                              botón que no hace nada y no explica por qué se lee como roto. */}
                          {!entra ? (
                            <AccionFila
                              etiqueta={lista.length <= MINIMO ? `Hacen falta al menos ${MINIMO} etapas` : 'Sacar ' + e.label}
                              disabled={lista.length <= MINIMO}
                              onClick={() => sacar(e)}><CerrarIcon /></AccionFila>
                          ) : <span style={{ width: 28, flex: 'none' }} aria-hidden />}
                        </div>
                      </div>
                  );
                })}

                {/* «Agregar etapa si le paso el cursor debería reaccionar y al apretarle
                    como mínimo que me pida el nombre de la nueva etapa». */}
                <NuevoRenglon tipo="etapa" onCrear={(v) => agregarEtapa(v, g.clave || undefined)} />
              </div>
            );
          })}
        </div>

        {malProducto && <p style={ERROR}>{malProducto}</p>}
        {mal && <p style={ERROR}>{mal}</p>}
      </Modal>

      {/* Cuando SÍ hay algo que perder, se pregunta con un DIÁLOGO, pegado al click. */}
      {confirmar && (
        <Confirm
          title={confirmar.titulo}
          message={confirmar.cuerpo}
          confirmLabel={confirmar.boton}
          cancelLabel={confirmar.cancelar}
          tone={confirmar.tono ?? 'danger'}
          onCancel={() => setConfirmar(null)}
          onConfirm={() => { const f = confirmar.hacer; setConfirmar(null); f(); }}
        />
      )}
      <Toast state={toast} onClose={clear} />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  );
}

/** El recuadro de error del CRM: al pie, en rojo, en negrita. */
const ERROR: CSSProperties = {
  margin: '12px 0 0', borderRadius: 10, padding: '10px 14px', fontFamily: SANS, fontSize: 13.5,
  fontWeight: 600, lineHeight: 1.45, background: 'var(--bad-bg)', color: 'var(--bad)',
};

/**
 * El renglón punteado que pide el nombre ahí mismo: el `NuevaEtapa` del CRM.
 *
 * Antes se creaba una «Nueva etapa» sin preguntar y había que renombrarla después — dos
 * pasos para lo que es uno, y mientras tanto una columna con un nombre que no significa
 * nada.
 *
 * ⚠️ EL INPUT ES NO CONTROLADO, a propósito: el Escape lo resuelve el editor desde
 * `window` escribiéndole el valor vacío y soltando el foco. Con un input controlado ese
 * valor no llegaría al estado de React y el blur crearía igual lo que se quiso cancelar.
 *
 * `fase` va arriba de todo y mide lo que dice; `etapa` ocupa el ancho de la lista.
 */
function NuevoRenglon({ tipo, onCrear }: { tipo: 'etapa' | 'fase'; onCrear: (v: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [hover, setHover] = useState(false);
  const fase = tipo === 'fase';
  const cerrar = (guardar: boolean, v: string) => {
    setAbierto(false);
    setHover(false);
    const t = v.trim().replace(/\s+/g, ' ');
    if (guardar && t) onCrear(t);
  };
  if (abierto) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px 7px 11px', borderRadius: 10,
        background: 'var(--surface-2)', ...(fase ? { marginBottom: 18 } : null),
      }}>
        <span style={{ ...PUNTO, background: '#5B6472' }} aria-hidden />
        <input
          autoFocus maxLength={MAX_LABEL} data-ee-esc=""
          placeholder={fase ? '¿Cómo se llama la fase?' : '¿Cómo se llama?'}
          aria-label={fase ? 'Nombre de la fase nueva' : 'Nombre de la etapa nueva'}
          onBlur={(e) => cerrar(true, e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          style={INPUT}
        />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setAbierto(true)}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        ...(fase ? { display: 'flex', width: 'fit-content', marginBottom: 18, padding: '8px 14px' } : { marginTop: 2, padding: '10px 12px' }),
        borderRadius: 10,
        border: '1px dashed ' + (hover ? 'var(--primary)' : 'var(--border-strong)'),
        background: hover ? 'var(--primary-weak)' : 'none',
        color: hover ? 'var(--primary)' : 'var(--dim)',
        fontFamily: SANS, fontSize: 13.5, fontWeight: 600,
        cursor: 'pointer', textAlign: 'left',
        transition: 'background .12s, border-color .12s, color .12s',
      }}
    >
      {fase ? '+ Agregar fase' : '+ Agregar etapa'}
    </button>
  );
}
