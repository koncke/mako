'use client';

// =============================================================================
// AccionesLote — lo que se puede hacer con VARIAS tarjetas a la vez
// =============================================================================
// Nació en la vista de tabla (23/09/2026, «seleccionar varias tareas para realizar acciones
// múltiples») y al día siguiente hizo falta también en el Kanban: «que pueda seleccionar
// varias tarjetas también en la vista kanban». Vive acá y no en cada vista porque es la
// misma pregunta con la misma respuesta — y dos copias de una barra de acciones divergen a
// la primera acción nueva que se agregue en una sola.
//
// ⚠️ UNA ACCIÓN EN LOTE NECESITA UN SOLO DESHACER. Cada cambio individual ya ofrece el suyo
// (va en el choke point de `useBoard`), así que una acción sobre 12 tareas dispara 12 toasts
// y el que queda arriba deshace UNA. Acá se guarda el estado anterior de todas y se pisa con
// un toast que las revierte juntas — que es la unidad en la que la persona decidió.
//
// ⚠️ Y BORRAR PREGUNTA, Y NO PROMETE DESHACER. Restaurar N tareas es volver a crearlas en el
// server una por una, y a mitad de camino puede fallar dejando la mitad. Un botón que
// promete deshacer y a veces no puede es peor que uno que avisa antes.
//
// ⚠️ TODA LA BARRA ES ÍCONOS —salvo dos—, Y LA CUENTA ES LO QUE LO AUTORIZA (25/09/2026).
// Con texto pedía 899 px donde hay ~499 —el detalle de un proyecto; la cuenta NO se copia
// acá, vive en `ANCHO_TABLA_EN_PROYECTO` (piezas.tsx), que es donde se usa y donde ya dice
// por qué − 44 − 9 − 2, un número FIJO que no mejora con un monitor más grande—, se partía
// en dos renglones y valía 106 px de alto: tres filas de la tabla que la ronda anterior
// acababa de apretar columna por columna. La cuenta al día de hoy, con el ritmo adentro,
// está en `LA CUENTA` (abajo, pegada al contenedor). Sacarle el `wrap` sin que ENTRE habría
// devuelto la barra horizontal del `overflowX: auto` de `cajaStyle` (Tablas.tsx), que es
// justo lo que esa ronda mató.
//
// ── LA MISMA BARRA PARA DOS ENTIDADES (26/09/2026) ───────────────────────────────────
// «Proyecto también debería poder tener selección múltiple.» La anatomía es la misma —a la
// izquierda con qué estás trabajando, en el medio lo que CAMBIA, a la derecha lo que CIERRA—
// así que es UNA pieza (`BarraLote`) con DOS configuraciones (`AccionesLote` y
// `AccionesLoteProyectos`), nunca dos copias: es la regla de `.mk-fila` de AGENTS.md («si
// comparten esqueleto, es una pieza con dos configuraciones, y mantenerlas separadas
// garantiza que diverjan»).
//
// ⚠️ LO QUE UN PROYECTO **NO** PUEDE, Y POR QUÉ NO SE PINTA. Un control que no se puede
// cumplir no se dibuja; enumerar lo que queda afuera es la mitad del trabajo:
//   · **Completar.** El avance de un proyecto lo calcula `projProgress` a partir de sus
//     tareas: no hay ningún `progress` que tildar. Un check ahí sería un botón que no
//     escribe nada, o peor, uno que cierra N tareas que nadie miró.
//   · **Mover a un proyecto.** Un proyecto no vive adentro de otro: el tablero no tiene
//     jerarquía de proyectos y el `Dropdown` se llenaría con la propia selección.
//   · **Eliminar.** Borrar un proyecto NO es borrar una tarea: hay dos operaciones
//     distintas (`deleteLabel`, que deja las tareas huérfanas, y `deleteLabelYTareas`, que
//     se las lleva puestas) y `EliminarModal` existe justamente para hacer ESA pregunta por
//     proyecto, con la cuenta de lo que hay adentro. Una pregunta de dos botones sobre seis
//     proyectos no puede decir qué pasa con las 80 tareas de adentro, así que la barra no la
//     hace: se borra de a uno, desde el detalle, que es donde la pregunta cabe.
// Lo que SÍ puede —y es exactamente lo que el pedido necesitaba— es lo temporal: «Se
// repite», la repetición (con su diálogo «Personalizado…») y el deadline.
// =============================================================================

import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { BoardTask, Label } from './types';
import type { Board } from './useBoard';
import { IconoTacho, IconoRepite } from './piezas';
import { Dropdown } from '@/app/components/Dropdown';
// ⚠️ EL CAMPO ES UNO SOLO Y GUARDA UNA **RRULE DE RFC 5545** (mig 0167), que es lo que
// guarda Google Calendar por debajo: `FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR`. Del contrato
// sale TODO lo que esta barra necesita y no se escribe nada dos veces: `PRESETS` es la
// lista del desplegable, `DIAS` · `UNIDADES` · `ORDINALES` son las tres listas del diálogo
// personalizado —las mismas con las que el contrato arma la frase, así que el control y la
// tarjeta no pueden decir cosas distintas del mismo valor—, `DIA_MES_MAX` e `INTERVALO_MAX`
// son los topes contra los que `leerRRule` valida, `leerRRule`/`escribirRRule` son la ida y
// la vuelta entre el string y el modelo que el diálogo edita, `recurrenciaOk` es el saneo y
// `textoRepeticion` / `textoRepeticionCorto` son la frase entera y la de 3-4 palabras del
// toast.
// ⛔ YA NO SE IMPORTA NADA DE `frecuencia` NI DE `frecuencia_dia`: eran DOS campos nuestros
// que no podían expresar lo que Martín pidió (varios días, un intervalo, «el segundo
// martes»), y las columnas se van en la 0168. Dos modelos de lo mismo es el bug que la
// 0167 vino a cerrar, así que no queda ni un nombre suelto de los viejos.
import {
  ROTULO_RECURRENTE, esRecurrente,
  ROTULO_REPETICION, PRESETS, DIAS, UNIDADES, ORDINALES, DIA_MES_MAX, INTERVALO_MAX,
  leerRRule, escribirRRule, recurrenciaOk, textoRepeticion, textoRepeticionCorto,
  type Repeticion, type Freq, type Dia,
} from '@/lib/plan-recurrentes';
// El molde de diálogo de la casa, con su pila de modales, su Escape y su ciclo de Tab.
// `Confirm` pregunta · `Modal` MUESTRA el detalle de algo · `WizardShell` conduce un flujo:
// esto es lo segundo, así que no se escribe un cuarto molde.
import { Modal, Button } from '@/app/_ui';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

// ⛔ ACÁ VIVÍA `btn` — `padding: '6px 11px'`, `fontSize: 12.5`, y cinco rótulos adentro.
// Esa constante es lo que hacía que la barra pidiera 899. Sin texto no hace falta un molde
// de botón de texto: el de ícono ya existe y es `.mk-icon-btn` (globals.css:670).

/**
 * CÓMO SE DICE QUE TODAVÍA NADIE ELIGIÓ CADA CUÁNTO. **Una palabra**, y la misma en las
 * cuatro superficies que lo dicen (el desplegable del detalle, la tarjeta, la fila de tabla
 * y esta barra).
 *
 * ⚠️ NO es «Sin asignar» —lo que dice el selector de Quarter de al lado— por dos razones.
 * Una es el largo: en la tarjeta esto cae en el renglón del plazo, donde el techo es una
 * palabra y no una frase («no pongas texto innecesario nunca», 26/09/2026). La otra es que
 * los dos campos nunca conviven: el Quarter sólo existe si NO se repite y la repetición
 * sólo si se repite, así que no hay ninguna pantalla donde las dos palabras se puedan
 * contradecir.
 *
 * ⚠️ Y NO ES «No se repite», QUE ES LO QUE DICE GOOGLE EN ESA MISMA RANURA. Allá el
 * desplegable ES el interruptor; acá «¿se repite?» ya lo contestó la perilla de arriba, así
 * que la primera opción no puede volver a contestarla — serían dos controles para la misma
 * pregunta, con el desplegable pudiendo desmentir a la perilla que tiene al lado. Lo que
 * este valor dice es otra cosa: se repite, y nadie dijo cada cuánto.
 *
 * ⚠️ Y NO ES «—». El guion es `NoAplica`, que significa «esto no se mide así» (la columna
 * Prioridad de una recurrente). Acá sí aplica y sí se puede contestar: falta contestarlo.
 *
 * ⚠️ VIVE ACÁ Y NO EN `Tablas.tsx` NI EN `BoardShell.tsx`, Y LA RAZÓN ES EL GRAFO DE
 * IMPORTS: los dos MONTAN esta barra, así que importar de ellos sería un ciclo; ésta es la
 * única hoja de las tres y el único lugar del que los tres pueden leer. Tampoco está en
 * `lib/plan-recurrentes.ts` —donde vive todo lo demás de este campo— porque no es un dato
 * del modelo: es cómo esta pantalla dibuja el hueco, y el contrato no tiene por qué saber
 * que existe un desplegable.
 */
export const SIN_REPETICION = 'Indefinida';

/**
 * LA ÚLTIMA OPCIÓN DEL DESPLEGABLE, LA QUE ABRE EL DIÁLOGO.
 *
 * ⚠️ NO ES UNA RRULE Y NO SE GUARDA NUNCA: es un centinela, y por eso lleva una arroba
 * adelante. Una RRULE de RFC 5545 es una lista de CLAVE=valor separados por punto y coma,
 * así que no puede empezar con arroba ni hoy ni cuando el subconjunto soportado crezca — o
 * sea que este valor no puede colisionar con uno real. Un centinela que puede ser un valor
 * es cómo un desplegable termina guardando la palabra «Personalizado» adentro de la
 * columna. Y aunque se colara, `recurrenciaOk` lo devolvería como `null`: el saneo del
 * contrato es la segunda capa.
 */
export const VALOR_PERSONALIZADO = '@personalizado';

/**
 * LA RRULE CANÓNICA **PARA UN CONTROL**: lo mismo que `recurrenciaOk`, con `''` donde aquél
 * devuelve `null`.
 *
 * ⚠️ NO ES UN SEGUNDO SANEO —el saneo es uno solo y está en el contrato—: es que el `value`
 * de un `<select>` y el de un `Dropdown` son strings, y `null` ahí no selecciona nada. La
 * cadena vacía es el valor con el que el desplegable dice «Indefinida», así que `null` y
 * «esto no se entiende» se contestan igual: la pantalla no puede ofrecer un tercer estado
 * que nadie sabe escribir.
 *
 * ⚠️ Y CANONIZAR ANTES DE COMPARAR NO ES OPCIONAL, por el `<select>` cuyo `value` no está
 * entre sus `<option>` que este tablero ya pagó dos veces (los trimestres y el día del
 * mes): no muestra nada, y el primer click escribe la primera opción, o sea BORRA el dato
 * sin que nadie lo pidiera. `FREQ=WEEKLY` y `FREQ=WEEKLY;INTERVAL=1` son la MISMA
 * repetición escrita de dos formas, y comparar los strings crudos deja al valor guardado
 * fuera de su propia lista. Todo lo que se compara —el valor del control, cada opción, el
 * destino de un arrastre— pasa por acá primero.
 */
export const canonRRule = (s: unknown): string => recurrenciaOk(s) ?? '';

/**
 * LAS OPCIONES DEL DESPLEGABLE, Y ES **UNA SOLA LISTA** PARA LAS TRES SUPERFICIES que lo
 * dibujan: el detalle de una tarea, el de un proyecto y esta barra de lote. Dos listas es
 * cómo se agrega un preset en una y no en la otra.
 *
 * El orden es el de Google: la salida que borra, los presets del contrato, y
 * «Personalizado…» al final.
 *
 * ⚠️ EL VALOR GUARDADO SIEMPRE ESTÁ EN LA LISTA, y no por suerte: si la repetición que la
 * tarjeta tiene no coincide con ningún preset —«cada 3 semanas», «el segundo martes»— entra
 * como una opción más, con la frase de `textoRepeticion` de rótulo. Sin eso, elegir «cada 3
 * semanas» y volver a abrir el detalle mostraría OTRA cosa: el control diría «Cada semana»
 * sobre una tarjeta que se repite cada tres, y el primer click en cualquier lado lo
 * escribiría.
 *
 * ⚠️ LA SALIDA QUE BORRA ES NUESTRA Y `PRESETS` NO LA TRAE, a propósito de los dos lados:
 * una RRULE vacía no es una RRULE, así que el contrato no puede tener una entrada para
 * ella. Sin esta opción, una repetición puesta de más sólo se sacaría destildando «Se
 * repite» — que además borra el campo entero en vez de dejarlo indefinido.
 */
export function opcionesRepeticion(valor?: string | null): Array<{ value: string; label: string }> {
  const ops: Array<{ value: string; label: string }> = [{ value: '', label: SIN_REPETICION }];
  for (const p of PRESETS) ops.push({ value: canonRRule(p.rrule), label: p.label });
  const v = canonRRule(valor);
  if (v && !ops.some((o) => o.value === v)) ops.push({ value: v, label: textoRepeticion(v) ?? v });
  ops.push({ value: VALOR_PERSONALIZADO, label: 'Personalizado…' });
  return ops;
}

/** El día de la semana de HOY, en clave RFC. `getDay()` cuenta desde el domingo y `DIAS`
 *  desde el lunes, de ahí el `+6`. */
const diaDeHoy = (): Dia => DIAS[(new Date().getDay() + 6) % 7].id;

/**
 * CON QUÉ NACE EL DIÁLOGO, y por qué acá SÍ se tilda el día de hoy cuando el contrato dice
 * que no.
 *
 * `PRESETS` deja «Cada semana» sin ancla a propósito, y su comentario lo explica:
 * inventarle el día de hoy sería un dato plausible que nadie dijo. Eso es cierto **de un
 * valor que se produce sin que nadie mire**, que es lo que un preset es: se elige del
 * desplegable y se guarda en el mismo click.
 *
 * Un diálogo es lo contrario. Google abre el suyo con el día del EVENTO ya tildado; acá no
 * hay evento —una recurrente no tiene fecha, se la saca la 0163— así que el equivalente es
 * hoy, y la persona lo VE tildado antes de apretar Guardar. La regla que prohíbe esto
 * («una detección automática mide TU máquina») es cara justamente cuando nadie llega a
 * mirar el valor; acá no se escribe nada hasta que alguien aprieta el botón.
 *
 * La alternativa era abrir sin ningún día, y eso deja el único estado que el diálogo NO
 * puede guardar —una semanal sin días, que el pedido prohíbe: «varios a la vez, y al menos
 * uno»— como su estado INICIAL: un botón de guardar apagado apenas se abre, que se lee como
 * que la pantalla está rota.
 */
const porDefecto = (): Repeticion => ({ freq: 'WEEKLY', interval: 1, byday: [diaDeHoy()], bymonthday: null, bysetpos: null });

/**
 * LO QUE EL DIÁLOGO EDITA, LEÍDO DE LO QUE HAYA GUARDADO — y completado si le falta el ancla.
 *
 * `FREQ=WEEKLY` a secas es una repetición legítima («cada semana») y es justo lo que guarda
 * el preset; adentro del diálogo, en cambio, la semana pide **al menos un día**. Así que al
 * abrirlo desde ese valor se tilda el de hoy, por lo mismo que `porDefecto`. Igual el mes
 * sin ancla: se abre en «el día N» con el de hoy.
 */
const semilla = (valor: string | null | undefined): Repeticion => {
  const r = leerRRule(valor ?? '');
  if (!r) return porDefecto();
  if (r.freq === 'WEEKLY' && !r.byday.length) return { ...r, byday: [diaDeHoy()] };
  if (r.freq === 'MONTHLY' && r.bymonthday == null && r.bysetpos == null) return { ...r, bymonthday: new Date().getDate() };
  return r;
};

/** Los días que el modelo tiene, en el orden de la semana. `escribirRRule` los normaliza
 *  igual —de ahí que «los viernes y lunes» se guarde siempre «MO,FR»—, pero el que los
 *  dibuja es este array: sin ordenar acá, la frase del desplegable y el orden de los
 *  botones dirían lo mismo en dos órdenes distintos. */
const ordenarDias = (cods: Dia[]): Dia[] => DIAS.filter((d) => cods.includes(d.id)).map((d) => d.id);

const filaDialogo: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontFamily: SANS, fontSize: 14, color: 'var(--ink)' };
const numDialogo: CSSProperties = { width: 64, height: 34, boxSizing: 'border-box', padding: '4px 8px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, fontFamily: SANS };
const btnDialogo: CSSProperties = { height: 34, padding: '0 10px', borderRadius: 9, gap: 6, fontSize: 13.5 };
/** El mismo rótulo mono de todos los campos del tablero: es un nombre, no una glosa. */
const rotuloDialogo: CSSProperties = { display: 'block', marginBottom: 8, fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 700 };

/**
 * ── EL DIÁLOGO «PERSONALIZADO», COMO EL DE GOOGLE CALENDAR ──────────────────────────
 *
 * «El tema de la frecuencia, copialo tal cual como lo hace Google Calendar… porque puede
 * ser personalizado, varios días de la semana, etc. Pero más simple, investiga y copialo
 * tal cual» (26/09/2026).
 *
 * Los TRES bloques que Google tiene, y ninguno más:
 *   1. «Repetir cada [N] [día | semana | mes | año]»
 *   2. si la unidad es SEMANA: los siete días como botones, VARIOS a la vez
 *   3. si es MES: «el día 15» o «el segundo martes»
 *
 * ⛔ EL CUARTO BLOQUE DE GOOGLE —«Termina: nunca / el [fecha] / después de [N]»— **NO SE
 * COPIA**, y está decidido. Nada en este producto calcula la próxima ocurrencia: el día es
 * una ETIQUETA, no dispara el reparto diario, ni un aviso, ni un recordatorio. «Después de
 * 12 repeticiones» sería un dato que nadie lee nunca y un control que no hace nada, que es
 * exactamente lo que la casa prohíbe. Por eso tampoco están `UNTIL` ni `COUNT` en el
 * subconjunto de la 0167: el modelo no puede expresarlos, así que no hay forma de que el
 * control vuelva por la puerta de atrás. Vuelve el día que la recurrencia genere algo.
 *
 * ⛔ Y NO HAY RENGLÓN DE RESUMEN («Se repite cada 2 semanas el lunes y miércoles»), que
 * Google sí tiene. Los tres bloques SON la frase, leídos en orden; un cuarto renglón que la
 * repite es texto que narra lo que la pantalla ya hace. La frase existe, y en el único
 * lugar donde agrega algo: el desplegable que queda detrás, apenas se guarda.
 *
 * ⚠️ NINGÚN ESTADO DE ESTE DIÁLOGO ES IMPOSIBLE DE GUARDAR, y por eso el botón nunca está
 * apagado. La semana con cero días —el único inválido— no se puede alcanzar: el último día
 * tildado no se destilda. Un `disabled` que la persona no sabe cómo arreglar es una pantalla
 * sin salida, y acá la salida sería «cerrar y perder lo que escribiste».
 *
 * ⚠️ Y NO ESCRIBE NADA: devuelve la RRULE y quien lo monta decide a quién se la aplica. Por
 * eso el MISMO componente sirve para el detalle de una tarjeta y para un lote de doce.
 *
 * ⚠️ VA EN UN **PORTAL A `document.body`**, Y SIN ESO LA PANTALLA SE PONE EN BLANCO. Los dos
 * lugares desde donde se abre —el detalle de una tarjeta y la barra de lote— viven ADENTRO
 * de otro modal, y la regla de la pila es que al abrir uno nuevo el de abajo se esconde con
 * `display: none` (app/_components/pila-modales.ts). Montado ahí adentro, esconder al padre
 * esconde también a este diálogo: se apagan los dos y no queda nada en pantalla. Por eso
 * TODOS los diálogos de este tablero se montan en la raíz de `BoardShell` y no donde se
 * abren; acá el portal consigue lo mismo sin obligar a los dos call sites a izar el estado
 * —que además sería la prop que nace huérfana en uno de los dos—.
 *
 * Esconder al de abajo es lo correcto y es lo que la casa hace: mientras se edita la
 * repetición, el detalle desaparece y vuelve intacto al cerrar.
 */
export function RepeticionModal({ valor, onGuardar, onCerrar }: {
  /** la repetición que hay hoy, para abrir el diálogo donde la persona la dejó. */
  valor: string | null;
  onGuardar: (rrule: string) => void;
  onCerrar: () => void;
}) {
  const [r, setR] = useState<Repeticion>(() => semilla(valor));
  const unidad = UNIDADES.find((u) => u.id === r.freq) ?? UNIDADES[1];
  /** El modo del bloque del mes SE DERIVA del modelo, no es un estado aparte: con dos
   *  fuentes, la que la pantalla muestra y la que se guarda se separan en el primer cambio
   *  de unidad. `bysetpos` puesto ES «el segundo martes». */
  const porOrdinal = r.bysetpos != null;

  /** Cambiar de unidad LIMPIA lo que esa unidad no puede tener y pone lo que sí necesita.
   *  Es la misma decisión que el modelo viejo ya había tomado para el día suelto: un `MO`
   *  guardado cuando el ritmo era semanal, leído como día del mes, no es ningún día — y
   *  ninguna de las dos lecturas es la que alguien eligió. Se borra, y se borra acá, que es
   *  el único lugar por donde pasa el cambio de unidad. */
  const cambiarFreq = (freq: Freq) => setR((p) => ({
    ...p,
    freq,
    byday: freq === 'WEEKLY' ? (p.byday.length ? p.byday : [diaDeHoy()]) : [],
    bymonthday: freq === 'MONTHLY' ? (p.bymonthday ?? new Date().getDate()) : null,
    bysetpos: null,
  }));

  /** ⚠️ EL ÚLTIMO DÍA NO SE DESTILDA. Una semanal sin días es el único estado que el pedido
   *  prohíbe, así que el control no lo ofrece — en vez de ofrecerlo y después rechazarlo con
   *  un botón apagado. Es lo mismo que hace Google. */
  const alternarDia = (id: Dia) => setR((p) => {
    const tildado = p.byday.includes(id);
    if (tildado && p.byday.length === 1) return p;
    return { ...p, byday: ordenarDias(tildado ? p.byday.filter((d) => d !== id) : [...p.byday, id]) };
  });

  const guardar = () => {
    const s = escribirRRule(r);
    if (s) onGuardar(s);
    onCerrar();
  };

  // El portal necesita el DOM. El diálogo sólo se monta después de un click, así que en el
  // server esto no corre nunca; la guarda es para que no pueda empezar a correr.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <Modal titulo={ROTULO_REPETICION} ancho={440} onCerrar={onCerrar}
      pie={<>
        {/* Ningún botón se llama «Aceptar» ni «Cancelar» a secas: cada uno nombra su acción
            y su objeto, y el par dice qué pasa con cada salida. */}
        <Button variant="secondary" onClick={onCerrar}>Dejar la de antes</Button>
        <Button variant="primary" onClick={guardar}>Guardar la repetición</Button>
      </>}>

      <div style={filaDialogo}>
        <span>Repetir cada</span>
        {/* ⚠️ EL NÚMERO SE VALIDA AL ESCRIBIR Y LO QUE NO PASA **NO SE ESCRIBE**: el campo se
            queda con el valor anterior. Con un `Number(v) || 1` el campo salta a 1 apenas se
            borra el contenido para tipear otro número, que es un control que pelea con quien
            lo usa. El tope sale de `INTERVALO_MAX` —el mismo contra el que `leerRRule`
            valida— y no de un 99 escrito acá: dos topes es cómo un control ofrece un valor
            que el saneo después tira. */}
        <input type="number" min={1} max={INTERVALO_MAX} value={r.interval}
          aria-label={`Repetir cada cuántos ${unidad.plural}`}
          onChange={(e) => {
            const n = Math.floor(Number(e.target.value));
            if (Number.isFinite(n) && n >= 1 && n <= INTERVALO_MAX) setR((p) => ({ ...p, interval: n }));
          }}
          style={numDialogo} />
        {/* El `Dropdown` de la casa y no un `<select>` nativo: la regla está escrita con
            todas las letras en app/_ui/Select.tsx:10-12. El singular o el plural sale del
            número de al lado, que es la única concordancia que esta fila tiene, y las dos
            formas salen de `UNIDADES` —la misma lista con la que el contrato arma la frase—
            para que el control y la tarjeta no digan «2 meses» y «2 mes». */}
        <Dropdown
          value={r.freq}
          ariaLabel="Cada qué se repite"
          buttonStyle={btnDialogo}
          options={UNIDADES.map((u) => ({ value: u.id, label: r.interval === 1 ? u.singular : u.plural }))}
          onChange={(v) => cambiarFreq(v as Freq)} />
      </div>

      {r.freq === 'WEEKLY' && (
        <div>
          {/* El rótulo es el NOMBRE de lo que se elige. La regla «al menos uno» no se
              escribe en ningún cartel: se cumple sola, porque el último tildado no se puede
              destildar. */}
          <label style={rotuloDialogo}>Días</label>
          <div role="group" aria-label="Días en que se repite" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {/* ⚠️ `inicial` NO IDENTIFICA NADA: hay dos «M» (martes y miércoles) y dos «S»
                (sábado y domingo), exactamente como en el diálogo de Google (S M T W T F S).
                Es la cara del botón y nada más; quién es quién lo dicen el `title` y el
                `aria-label`, que llevan el nombre entero — un botón cuyo único contenido es
                una letra ambigua se anuncia «M», a secas. */}
            {DIAS.map((d) => {
              const on = r.byday.includes(d.id);
              return (
                <button key={d.id} type="button" onClick={() => alternarDia(d.id)}
                  title={d.label} aria-label={d.label} aria-pressed={on}
                  style={{
                    width: 34, height: 34, flex: 'none', borderRadius: '50%', cursor: 'pointer',
                    border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`,
                    background: on ? 'var(--primary)' : 'var(--surface)',
                    color: on ? '#fff' : 'var(--dim)',
                    fontFamily: SANS, fontSize: 13, fontWeight: 700,
                    transition: 'background .12s, border-color .12s, color .12s',
                  }}>
                  {d.inicial}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {r.freq === 'MONTHLY' && (
        <div>
          <label style={rotuloDialogo}>Cada mes</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Dos radios de verdad y no dos botones: son dos lecturas EXCLUYENTES del mismo
                campo, y eso es lo que un grupo de radios significa para el teclado y para un
                lector de pantalla. */}
            <label style={filaDialogo}>
              <input type="radio" name="ancla-mes" checked={!porOrdinal}
                onChange={() => setR((p) => ({ ...p, bymonthday: p.bymonthday ?? new Date().getDate(), byday: [], bysetpos: null }))}
                style={{ accentColor: 'var(--primary)', cursor: 'pointer' }} />
              <span>el día</span>
              {/* `DIA_MES_MAX` y no un 31 escrito acá: es el mismo tope contra el que valida
                  el contrato. Y son 31 siempre, no los días del mes en curso: una repetición
                  mensual no vive en un mes, así que ofrecer 28 en febrero dejaría un valor
                  válido fuera de su propia lista once meses al año — el `<select>` cuyo
                  `value` no está entre sus `<option>`, otra vez. Qué hace febrero con «el
                  31» es una pregunta del calendario, y acá todavía no hay calendario. */}
              <Dropdown
                value={String(r.bymonthday ?? new Date().getDate())}
                disabled={porOrdinal}
                ariaLabel="Día del mes"
                buttonStyle={btnDialogo}
                options={Array.from({ length: DIA_MES_MAX }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
                onChange={(v) => setR((p) => ({ ...p, bymonthday: Number(v), byday: [], bysetpos: null }))} />
            </label>
            <label style={filaDialogo}>
              <input type="radio" name="ancla-mes" checked={porOrdinal}
                onChange={() => setR((p) => ({ ...p, bymonthday: null, byday: [p.byday[0] ?? diaDeHoy()], bysetpos: p.bysetpos ?? 1 }))}
                style={{ accentColor: 'var(--primary)', cursor: 'pointer' }} />
              <span>el</span>
              <Dropdown
                value={String(r.bysetpos ?? 1)}
                disabled={!porOrdinal}
                ariaLabel="Qué semana del mes"
                buttonStyle={btnDialogo}
                options={ORDINALES.map((o) => ({ value: String(o.id), label: o.label }))}
                onChange={(v) => setR((p) => ({ ...p, bysetpos: Number(v), bymonthday: null, byday: [p.byday[0] ?? diaDeHoy()] }))} />
              <Dropdown
                value={r.byday[0] ?? diaDeHoy()}
                disabled={!porOrdinal}
                ariaLabel="Qué día de la semana"
                buttonStyle={btnDialogo}
                options={DIAS.map((d) => ({ value: d.id, label: d.label }))}
                onChange={(v) => setR((p) => ({ ...p, byday: [v as Dia], bymonthday: null, bysetpos: p.bysetpos ?? 1 }))} />
            </label>
          </div>
        </div>
      )}
    </Modal>,
    document.body,
  );
}

// ── LOS ÍCONOS ───────────────────────────────────────────────────────────────────────
// ⚠️ EL TACHO Y EL BUCLE SE IMPORTAN; EL TILDE Y EL LÁPIZ SON COPIAS DECLARADAS. Los dos
// originales viven en archivos que esta barra NO puede importar sin ciclo: `BoardShell` y
// `Tablas` son los que la MONTAN. Es la misma razón por la que `IconoTacho` vive en
// `piezas.tsx` y no en BoardShell — la lápida de la copia anterior está en
// BoardShell.tsx:1480-1487. La cura de verdad son dos renglones: mudar el path del tilde
// (`CheckHecho`, BoardShell.tsx:1472) y el SVG de `LapizPrioridad` (PrioridadAMano.tsx:48)
// a `piezas.tsx` e importarlos desde los dos lados. Van marcadas con su origen para que el
// día que alguien toque una se acuerde de la otra.

/** Copia del path de `CheckHecho` (BoardShell.tsx:1472). El GROSOR —y no sólo el color—
 *  separa los dos estados: el color nunca puede ser el único portador. */
function TildeLote({ hecho }: { hecho: boolean }) {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      // ⚠️ 1.5/1.9 y no 1.8/2.4 como en la tarjeta: acá el tilde vive en un renglón de
      //    CINCO íconos y el peso se compara con el de al lado. El trazo efectivo es
      //    `strokeWidth × (tamaño / viewBox)`, y a 1.8 este tilde salía 46% más grueso
      //    que la cruz — que es el mismo defecto que el comentario de la cruz cita para
      //    justificar haber cambiado el carácter «✕» por un SVG. En la tarjeta va solo
      //    y ahí el 1.8 está bien: lo que cambia no es el ícono, es el vecindario.
      strokeWidth={hecho ? 1.9 : 1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8.6 6.3 11.9 13 4.4" />
    </svg>
  );
}

/** Copia del SVG de `LapizPrioridad` (PrioridadAMano.tsx:48). El lápiz YA significa «cambiar
 *  de proyecto» en el detalle (BoardShell.tsx:3511): es el único símbolo que este tablero
 *  tiene para esto, así que es ESE. No se importa el componente porque es un BOTÓN entero
 *  con su propio molde fantasma, y acá hace falta el dibujo suelto para meterlo adentro del
 *  `Dropdown`. */
function LapizLote() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      // 2.4 sobre viewBox 24 dibujado a 15px = 1.5 de trazo efectivo, el mismo que el
      // tacho y el calendario. A 2 salía 1.25 y el lápiz se veía más fino que todos.
      strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

/** ⚠️ EL ÚNICO DIBUJO NUEVO DE LA BARRA: no hay ningún calendario en todo `app/` (buscado
 *  por nombre y por path: cero de las 77 claves de `_components/icons.tsx`). Hasta hoy la
 *  fecha la dibujaba Chrome adentro del `<input type="date">`. Va en la familia de
 *  `IconoTacho` —viewBox 16, `strokeWidth 1.5`, `currentColor`, `aria-hidden`— porque su
 *  vecino de fila y de tamaño es el tacho, no el registro de 24. En cuanto tenga un SEGUNDO
 *  call site se muda a `piezas.tsx`, al lado del tacho: dos copias de un dibujo divergen a
 *  la primera. */
function CalendarioLote() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.1" y="3.5" width="11.8" height="10.4" rx="1.6" />
      <path d="M2.1 6.6h11.8" />
      <path d="M5.4 2.1v2.6M10.6 2.1v2.6" />
    </svg>
  );
}

/** El botón de ícono de la CASA: `.mk-icon-btn` (globals.css:670) con su `data-tone`.
 *  34×34 `flex: none`, radio 9, borde `--border-strong`, fondo `--surface`.
 *
 *  ⚠️ NADA DE COLOR NI DE FONDO INLINE. La clase los pone para que la variante oscura los
 *  pueda repintar (globals.css:773-776 y las reglas de `.mk-key-row--code`), y un inline le
 *  gana a cualquier clase — el comentario de globals.css dice que esa misma familia de barra
 *  ya pagó ese error con el color de los íconos. Lo único inline es `cursor`, que no se
 *  tematiza y que la clase no trae.
 *
 *  ⚠️ `title` Y `aria-label` con el MISMO string, siempre: un botón cuyo único contenido es
 *  un SVG se anuncia «botón», a secas. */
function BtnIcono({ rotulo, texto, tono = 'dim', pressed, onClick, children }: {
  rotulo: string;
  /** La palabra al lado del ícono. Sin esto el botón es el cuadrado de 34 de siempre.
   *  ⚠️ Lo ÚNICO que se pisa de la clase es la GEOMETRÍA (ancho auto y padding): el color y
   *  el fondo siguen saliendo de `.mk-icon-btn` + `data-tone`, porque un inline le gana a
   *  cualquier clase y esta misma familia de barra ya pagó ese error con el color. */
  texto?: string;
  tono?: 'dim' | 'bad' | 'good' | 'primary';
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className="mk-icon-btn" data-tone={tono}
      title={rotulo} aria-label={rotulo} aria-pressed={pressed}
      onClick={onClick}
      style={texto
        ? { cursor: 'pointer', width: 'auto', padding: '0 11px', gap: 6, fontFamily: SANS, fontSize: 12.5, fontWeight: 600 }
        : { cursor: 'pointer' }}>
      {children}
      {texto}
    </button>
  );
}

/**
 * LO ÚNICO QUE CAMBIA ENTRE LA BARRA DE TAREAS Y LA DE PROYECTOS.
 *
 * Todo lo que es `null` es una acción que esa entidad NO puede cumplir, y no se dibuja: es
 * el mismo criterio que `onEliminar` en la fila de la tabla o que `onAgarrar` en la tarjeta
 * —la prop ES la capacidad— y el mismo que impide que el tablero del CLIENTE muestre un
 * control que sólo sabe contestar «solo admin».
 */
type CfgLote<T> = {
  /** «1 tarea» · «4 proyectos». En un proyecto sale de `repo.labelPlural`, nunca cableado:
   *  en el tablero del cliente estos se llaman «Categorías». */
  nombre: (n: number) => string;
  /** el género de esa palabra, para «seleccionadas» / «seleccionados». */
  fem: boolean;
  /** el deshacer: devolver la copia al board. `replaceTask` para una tarea, `patchLabel`
   *  con la copia entera para un proyecto. */
  restaurar: (snap: T) => void;
  setRecurrente: (t: T, v: boolean) => void;
  /** LA REPETICIÓN, EN UN SOLO CAMPO: una RRULE de RFC 5545, o `null` para «se repite y
   *  nadie dijo cada cuánto». Eran DOS (`setFrecuencia` y `setFrecuenciaDia`) y eso obligaba
   *  a escribir en dos renders; con la 0167 el valor viaja entero y es una escritura. */
  setRecurrencia: (t: T, v: string | null) => void;
  setDeadline: (t: T, iso: string) => void;
  /** completar / reabrir. `null` = esta entidad no se completa (ver la cabecera). */
  estado: { hecha: (t: T) => boolean; toggle: (t: T) => void } | null;
  /** mover a un proyecto. `null` = esta entidad no vive adentro de un proyecto. */
  mover: ((t: T, labelId: string) => void) | null;
  /** eliminar en lote. `null` = la pregunta no cabe en una barra (ver la cabecera). */
  borrar: ((t: T) => void) | null;
};

/**
 * LA BARRA DE TAREAS. Es la configuración de siempre: se completan, se mueven de proyecto y
 * se borran, y desde hoy también se marcan como recurrentes y llevan ritmo.
 */
export function AccionesLote({ elegidas, board, ask, onLimpiar, estilo }: {
  elegidas: BoardTask[];
  board: Board;
  /** confirmar lo irreversible (lo trae el board) */
  ask: (msg: string, onOk: () => void) => void;
  onLimpiar: () => void;
  estilo?: CSSProperties;
}) {
  return (
    <BarraLote<BoardTask> elegidas={elegidas} board={board} ask={ask} onLimpiar={onLimpiar} estilo={estilo}
      cfg={{
        nombre: (n) => (n === 1 ? '1 tarea' : `${n} tareas`),
        fem: true,
        restaurar: (snap) => board.replaceTask(snap),
        setRecurrente: (t, v) => board.setRecurrente(t.id, v),
        setRecurrencia: (t, v) => board.setRecurrencia(t.id, v),
        setDeadline: (t, iso) => board.setDeadline(t.id, iso, t.deadline),
        estado: { hecha: (t) => t.progress >= 100, toggle: (t) => board.toggleDone(t.id) },
        mover: (t, labelId) => board.setTaskLabels(t.id, [labelId], `Movida a «${board.labelById(labelId)?.name ?? ''}»`),
        borrar: (t) => board.removeSilent(t.id),
      }} />
  );
}

/**
 * LA BARRA DE PROYECTOS (26/09/2026, «proyecto también debería poder tener selección
 * múltiple»). MISMA pieza, tres capacidades apagadas: completar, mover y eliminar. El porqué
 * de cada una está enumerado en la cabecera del archivo, que es donde se busca.
 *
 * ⚠️ EL DESHACER RESTAURA CON `patchLabel(id, snap)` Y NO CON UN `replaceLabel`, que no
 * existe: `patchLabel` fusiona el objeto entero encima del actual y GUARDA, así que pasarle
 * la copia completa —historial incluido— devuelve el proyecto exactamente como estaba. Es lo
 * mismo que hace `replaceTask` del otro lado, con la única API que un Label tiene.
 */
export function AccionesLoteProyectos({ elegidos, board, onLimpiar, estilo }: {
  elegidos: Label[];
  board: Board;
  onLimpiar: () => void;
  estilo?: CSSProperties;
}) {
  // ⚠️ NO RECIBE `ask`, Y NO ES UN OLVIDO: `ask` existe para la ÚNICA acción irreversible de
  // la barra —el tacho— y esta configuración no la tiene. Pedirlo igual obligaría a las dos
  // vistas de proyectos a cablear una pregunta que nunca se hace, y eso es exactamente cómo
  // nace un botón que después alguien enchufa «porque el prop ya estaba».
  // «Categoría» en el tablero del cliente, «Proyecto» en el del dueño: la palabra sale del
  // repo y la concordancia de «seleccionados/as» se deriva de ella. Un rótulo cableado sería
  // la única frase de esta barra hablando de otra cosa.
  const plural = board.repo.labelPlural.toLowerCase();
  const singular = board.repo.labelSingular.toLowerCase();
  return (
    <BarraLote<Label> elegidas={elegidos} board={board} onLimpiar={onLimpiar} estilo={estilo}
      cfg={{
        nombre: (n) => `${n} ${n === 1 ? singular : plural}`,
        fem: /a$/.test(singular),
        restaurar: (snap) => board.patchLabel(snap.id, snap),
        setRecurrente: (l, v) => board.setLabelRecurrente(l.id, v),
        setRecurrencia: (l, v) => board.setLabelRecurrencia(l.id, v),
        setDeadline: (l, iso) => board.setLabelDeadline(l.id, iso),
        estado: null,
        mover: null,
        borrar: null,
      }} />
  );
}

function BarraLote<T extends { id: string; recurrente?: boolean; recurrencia?: string | null }>({ elegidas, board, ask, onLimpiar, estilo, cfg }: {
  elegidas: T[];
  board: Board;
  /** confirmar lo irreversible (lo trae el board). Opcional porque va PEGADO a `cfg.borrar`:
   *  la configuración que no borra no tiene nada que confirmar, y sin las dos el tacho no se
   *  dibuja. */
  ask?: (msg: string, onOk: () => void) => void;
  onLimpiar: () => void;
  estilo?: CSSProperties;
  cfg: CfgLote<T>;
}) {
  // ⚠️ LOS HOOKS VAN ARRIBA DEL `return null`, NO ABAJO. El call site de la tabla
  // (Tablas.tsx) dibuja esta barra SIEMPRE —el del Kanban la envuelve en
  // `elegidas.length > 0 &&`, así que ahí sí desmonta—, o sea que el return de abajo corre
  // en casi todos los renders. Un hook detrás de él es el «Minified React error #300»: la
  // pantalla entera en blanco, sin archivo ni línea. Lo bloquea el pre-push
  // (scripts/hooks-en-orden.sh) y es la razón por la que este archivo no tenía un solo hook
  // hasta el 25/09.
  const [editandoFecha, setEditandoFecha] = useState(false);
  /**
   * ¿ESTÁ ABIERTO EL DIÁLOGO «PERSONALIZADO»? (mig 0167)
   *
   * «El tema de la frecuencia, copialo tal cual como lo hace Google Calendar… porque puede
   * ser personalizado, varios días de la semana, etc.» (26/09/2026).
   *
   * ⛔ ACÁ VIVÍA `ritmoPend`, EL SEGUNDO PASO DEL MODELO VIEJO: se elegía el ritmo, y si ese
   * ritmo pedía un ancla la misma ranura pasaba a preguntar «¿qué día?». Eran DOS escrituras
   * obligadas —`setFrecuenciaDia` saneaba el día contra la frecuencia que la tarjeta tenía
   * EN ESE render, así que las dos juntas dejaban a la segunda leyendo la vieja y saliendo
   * sin escribir—, y aun así sólo sabía contestar UN día. Con una RRULE el valor es uno
   * solo: se escribe entero, en una sola escritura, y lo que aquel paso no podía decir
   * —varios días, un intervalo, «el segundo martes»— lo dice el diálogo.
   *
   * ⚠️ ABRIRLO NO LIMPIA LA SELECCIÓN, por la misma razón por la que aquel paso 1 tampoco lo
   * hacía: el diálogo necesita a quién escribirle. El que limpia es el guardado.
   *
   * ⚠️ Y ABANDONARLO NO ROMPE NADA: no se escribió todavía nada, así que cerrar deja la
   * selección exactamente como estaba.
   */
  const [custom, setCustom] = useState(false);
  const pickerAbierto = useRef(false);

  if (!elegidas.length) return null;

  // ⚠️ Y en la tabla `return null` NO DESMONTA: la instancia queda viva con su estado. Por
  // eso los dos editores de dos pasos —la fecha y el ritmo— se cierran ACÁ, en el único
  // lugar por donde pasan todas las acciones; si no, la próxima selección nace con el input
  // abierto en vez del ícono.
  const enLote = (texto: string, aplicar: (t: T) => void, mantenerSeleccion = false) => {
    const snaps = elegidas.map((t) => ({ ...t }));
    elegidas.forEach(aplicar);
    cerrarEditores();
    if (!mantenerSeleccion) onLimpiar();
    board.showUndo(texto, () => snaps.forEach((snap) => cfg.restaurar(snap)));
  };
  const cerrarEditores = () => { setEditandoFecha(false); setCustom(false); };

  // ⚠️ UN SOLO BOTÓN PARA LAS DOS DIRECCIONES. «Elimina el "Reabrir", sería lo mismo que
  // "completar" solo que si lo aprieto a la inversa se descompleta, pero no debe haber 2
  // botones» (24/09/2026). Con dos, uno de los dos siempre está de más: sobre una selección
  // de tareas abiertas, «Reabrir» no hace nada y viceversa — un botón que no puede hacer
  // nada se lee como que la app está rota. El sentido lo decide la selección: si TODAS están
  // hechas, descompleta; si no, completa. Sin texto, lo que dice en qué dirección va es el
  // `title` (el verbo), y lo que dice en qué estado está es el grosor del trazo +
  // `aria-pressed`.
  const todasHechas = !!cfg.estado && elegidas.every(cfg.estado.hecha);
  const n = elegidas.length;
  const plural = n === 1 ? '' : 's';
  // Sin texto en pantalla, el `title` es el ÚNICO lugar donde se dice sobre QUÉ actúa cada
  // botón: «Eliminar» a secas no nombra su objeto.
  const cosas = cfg.nombre(n);
  const rotCuenta = `${cosas} seleccionad${cfg.fem ? 'a' : 'o'}${plural}`;
  // «Reabrir», no «Descompletar»: es lo que ya dicen la fila de la tabla (Tablas.tsx:475) y
  // el toast de deshacer («3 reabiertas»). Era la única de las tres superficies que decía
  // otra cosa. Y el `↺` se va sin que se extrañe: no tiene glifo en Geist, lo dibujaba la
  // fuente del sistema.
  const rotEstado = `${todasHechas ? 'Reabrir' : 'Completar'} ${cosas}`;
  const rotMover = `Mover ${cosas} a un proyecto`;
  /**
   * ⚠️ EL DEADLINE SE DECIDE POR LA SELECCIÓN, NO POR LA PANTALLA. Una recurrente no lleva
   * fecha —`taskToRow` y `editarTarea` se la borran en el server—, así que ofrecer el
   * control sobre una selección de puras recurrentes es prometer una escritura que no va a
   * ocurrir: la barra diría «Deadline 2026-10-03 en 4» sobre cuatro tarjetas que siguen sin
   * fecha. Es un éxito falso, que es el modo de falla más caro de todos.
   *
   * ⚠️ Y SE MIRA LA SELECCIÓN Y NO UN PROP. La tabla ya tiene `sinRanking` y podría pasarlo,
   * pero eso sólo cubriría la vista «Recurrentes»: en el Kanban y en la tabla completa se
   * pueden tildar recurrentes igual, y ahí el prop no llega. La pregunta correcta es sobre
   * lo que se tildó, no sobre dónde está dibujada la barra.
   *
   * Con una selección MIXTA el control se queda: la fecha se le pone a las que pueden
   * tenerla y el mensaje del deshacer dice ese número, no el total.
   */
  const conFecha = elegidas.filter((t) => !esRecurrente(t));
  const puedeFechar = conFecha.length > 0;
  const rotFecha = conFecha.length === n
    ? `Ponerle${plural} deadline a ${cosas}`
    : `Ponerle deadline a ${conFecha.length} de ${cosas} (las que se repiten no llevan fecha)`;
  const rotBorrar = `Eliminar ${cosas} — no se puede deshacer`;
  /**
   * ── «SE REPITE» EN LOTE, Y EL RITMO EN EL LUGAR DEL DEADLINE ───────────────────────
   *
   * «Ponle la frecuencia AL LOTE también, que se pueda poner recurrente o dejar a tareas en
   * lote» (26/09/2026).
   *
   * ⚠️ EL INTERRUPTOR VA EN LAS DOS DIRECCIONES, como el tilde, y por el mismo motivo: dos
   * botones dejarían siempre uno que no puede hacer nada. Lo decide la selección — si TODAS
   * se repiten, desmarca; si no, marca.
   *
   * ⚠️ Y EL RITMO **REEMPLAZA** AL DEADLINE, no se suma. Son la misma pregunta —«¿cuándo?»—
   * con dos respuestas que no pueden convivir: algo que se repite no lleva fecha de fin, así
   * que `!puedeFechar` (toda la selección se repite) es exactamente el caso en que el
   * deadline no se dibuja y su ranura queda libre. Es lo mismo que ya hacen el detalle
   * (`llevaDeadline ? deadline+quarter : frecuencia`) y la columna temporal de las dos
   * tablas, y es lo único que la barra aguanta de ancho (ver `LA CUENTA`).
   *
   * ⚠️ POR ESO EL RITMO NO NECESITA DECIR «EN N»: sólo existe cuando la selección entera se
   * repite, o sea que se aplica al 100% de lo tildado. El «en N» está donde una acción puede
   * tocar un SUBCONJUNTO —el deadline y este interruptor—, que es donde una barra puede
   * mentir.
   */
  const todasRepiten = elegidas.every((t) => esRecurrente(t));
  const cambianRepite = todasRepiten ? n : elegidas.filter((t) => !esRecurrente(t)).length;
  // El `title` dice a CUÁNTAS se aplica, y sólo cuando no son todas: «en 4 de 4» es ruido.
  // Mismo criterio que `rotFecha`, que es el otro control que puede tocar un subconjunto.
  const rotRepite = todasRepiten
    ? `Quitar «${ROTULO_RECURRENTE}» a ${cosas}`
    : cambianRepite === n
      ? `Marcar «${ROTULO_RECURRENTE}» en ${cosas}`
      : `Marcar «${ROTULO_RECURRENTE}» en ${cambianRepite} de ${cosas} (el resto ya se repite)`;
  /**
   * LA REPETICIÓN QUE COMPARTE LA SELECCIÓN, para abrir el diálogo donde la persona la
   * dejó. Si no comparten una, no hay ninguna que mostrar: se abre en blanco.
   */
  const rComun = canonRRule(elegidas[0]?.recurrencia);
  const todasIgual = elegidas.every((t) => canonRRule(t.recurrencia) === rComun);
  /**
   * LO QUE HACE EL DESPLEGABLE. Dos salidas y nada más: o es el centinela y se abre el
   * diálogo, o es una RRULE y se escribe.
   *
   * ⚠️ ABRIR EL DIÁLOGO **NO LIMPIA LA SELECCIÓN** y no pasa por `enLote`: si limpiara, el
   * diálogo se quedaría sin a quién escribirle. El que limpia es el guardado.
   */
  const elegirRepeticion = (v: string) => {
    if (v === VALOR_PERSONALIZADO) { setCustom(true); return; }
    ponerRepeticion(v);
  };
  /**
   * ESCRIBIR LA REPETICIÓN EN TODA LA SELECCIÓN, en UNA escritura por tarjeta.
   *
   * ⚠️ ES UNA SOLA Y NO DOS, Y ESO ES LO QUE LA 0167 VINO A ARREGLAR. Con el modelo viejo
   * el ritmo y su día eran dos columnas y había que escribirlas en DOS renders —la segunda
   * saneaba el día contra la frecuencia que la tarjeta todavía tenía, así que juntas la
   * segunda leía la vieja, `next === prev`, y salía sin escribir—. Con una RRULE el valor
   * es uno, viaja entero, y no hay ningún orden que respetar.
   *
   * ⚠️ SI NADIE CAMBIA, NO SE ESCRIBE NI SE OFRECE DESHACER. Un toast de 5 segundos sobre
   * un cambio que no ocurrió —y que además pisa el deshacer de la acción anterior— es la
   * barra mintiendo.
   *
   * ⚠️ EL TOAST DICE `textoRepeticionCorto` Y NO LA FRASE ENTERA, y para eso existe esa
   * función: «Cada 2 semanas, los lunes y miércoles» son siete palabras y el techo de un
   * deshacer son 3-4. Lo que se recorta es el ancla, que es lo que la persona acaba de
   * elegir en el control y lo que la tarjeta ya muestra atrás; el ritmo es lo que cambió.
   * Con el conjunto ABIERTO —una RRULE personalizada puede nombrar los siete días— usar la
   * frase entera acá sería un toast que tapa la pantalla que se está mirando.
   */
  const ponerRepeticion = (rrule: string) => {
    const r = canonRRule(rrule);
    if (elegidas.some((t) => canonRRule(t.recurrencia) !== r)) enLote(textoRepeticionCorto(r) ?? SIN_REPETICION, (t) => cfg.setRecurrencia(t, r || null));
    else { cerrarEditores(); onLimpiar(); }
  };

  return (
    // ⚠️ LA BARRA OCUPA EL ANCHO Y REPARTE: `width: '100%'` + `space-between`. «Que no se
    // agrupe todo a la izquierda, que sea proporcional» (25/09/2026).
    //
    // Estuvo en `fit-content` unas horas del mismo día, y el razonamiento parecía correcto:
    // la caja azul vacía de la captura era el hueco de una banda al 100 % con todo apretado
    // contra un borde, así que encogerla al contenido lo hacía desaparecer. Y desapareció —
    // junto con la mitad de la barra: los controles quedaron en una pastilla pegada a la
    // izquierda de una columna de 499, o sea el hueco seguía ahí, sólo que AFUERA de la barra
    // en vez de adentro y encima sin fondo.
    //
    // ⚠️ Y `space-between` sobre los controles SUELTOS tampoco era: con la barra al ancho del
    // Kanban (~1.900 px) los repartió uno por esquina, cada uno a 300 px del siguiente. «No
    // tiene sentido esta distribución» (25/09/2026). Lo que se reparte son TRES GRUPOS, no
    // seis piezas — y cada grupo se mantiene junto por dentro.
    //
    // El hueco no se saca achicando la caja: se saca repartiendo lo que hay adentro.
    //
    // ⚠️ POR ESO NO HAY NINGÚN `<span style={{ flex: 1 }} />`. Un espaciador empuja a los de
    // un lado contra un borde y deja TODO el aire en un solo lugar, que es exactamente el
    // apilamiento que este pedido saca. El aire lo dividen en partes iguales los DOS grupos
    // de los costados, que son `flex: 1` (uno alineado al principio y el otro al final) con
    // el del medio en `flex: none`: así el medio queda en el medio de verdad y sigue ahí con
    // cualquier ancho — la misma barra se dibuja en una columna de 499 y en el Kanban, que
    // mide el tablero entero. El `space-between` del contenedor queda como respaldo para el
    // caso en que los costados no puedan crecer; no es lo que centra.
    //
    // ⚠️ Y EL GRUPO DE LA DERECHA PUEDE QUEDAR VACÍO —la barra de PROYECTOS no completa ni
    // borra— y sigue siendo necesario: es el `flex: 1` que equilibra al de la izquierda y
    // deja el medio en el medio. Sacarlo cuando no tiene hijos correría los controles hacia
    // la derecha, que es el mismo hueco mal repartido de arriba con el signo cambiado.
    //
    // ⚠️ EL `flexWrap: 'wrap'` NO ES EL DE ANTES, aunque sea la misma línea. Antes era el
    // CAMINO —la barra pedía 899 px donde hay 499, así que se partía en dos renglones
    // siempre, que es lo que Martín reportó—; ahora es la RED. Ahí el `wrap` es lo correcto y
    // el `nowrap` es lo peligroso: sin él, lo que no entra no baja de renglón sino que
    // DESBORDA, y el Kanban no tiene ningún ancestro con `overflow`, así que la barra
    // horizontal se la come la PÁGINA entera. Es la regla de la casa para una barra que no
    // entra —baja de renglón, nunca scrollea de costado— y es gratis: en las tres pantallas
    // donde Martín la mira, nunca se dispara.
    //
    // ⚠️ Y EL QUE CEDE ES EL GRUPO DEL MEDIO, que ahora sí puede: desde que la fecha y el
    // proyecto llevan su palabra hay algo que RECORTAR. Mientras fueron íconos pelados, el
    // `flex: 0 1 auto` era una red decorativa —un ícono no se elipsa, y el botón tocaba
    // fondo en ~54 px—, que es justo lo que la regla de la casa quiere decir con «declará
    // quién cede»: ceder en el tipo no es ceder en píxeles. Los grupos de los costados van
    // `flex: none` porque son los que no se pueden perder: con qué se está trabajando, y
    // las dos acciones que cierran.
    //
    // ── LA CUENTA, contra los ~499 del lugar más angosto (el detalle de un proyecto) ────
    // Medida ANTES de escribir, que es lo que el pedido pide, y en los DOS estados que la
    // ranura temporal puede tener. Los anchos de los botones con palabra salen de los
    // medidos el 25/09 («Deadline» 96 · «Proyecto» 108) y el del desplegable se estima con
    // la misma regla: `Dropdown` con ícono + caret ≈ 54 + el ancho del texto a 12.5 px, o
    // sea «Repetición» (10 caracteres, ~70) ≈ 124 — el MISMO ancho que medía «Frecuencia»,
    // que es lo que hace que esta cuenta no cambie con la 0167.
    //
    //   izquierda  16 casilla + 8 + 24 número                                =  48
    //   medio A    34 «Se repite» + 14 + 96 Deadline + 14 + 108 Proyecto     = 266
    //              (con el calendario abierto el Deadline mide 118)          = 288
    //   medio B    34 «Se repite» + 14 + 124 Repetición + 14 + 108 Proyecto  = 294
    //              (y ahora B no tiene segundo estado: el paso del día se fue
    //               con el modelo viejo, así que la ranura mide siempre 124)
    //   derecha    34 tilde + 6 + 34 tacho                                   =  74
    //   los dos huecos entre grupos, como mínimo                             =  20
    //   padding 24 + borde 2                                                 =  26
    //   ─────────────────────────────────────────────────────────────────────────────
    //   A 434 · A con el calendario abierto 456 · **B 462, que es el peor**
    //   Contra 499: 37 px de aire en el peor estado. Entra, y por eso el ritmo REEMPLAZA al
    //   deadline en vez de sumarse: los dos juntos pedirían 558 y la barra se partiría en
    //   dos renglones, que es exactamente el reporte que la ronda del 25/09 vino a cerrar.
    //
    // La barra de PROYECTOS es más angosta todavía (sin «Proyecto», sin tilde y sin tacho):
    // 48 + 172 + 0 + 20 + 26 = 266 en su peor estado, y vive en vistas de 860 y 1180 px.
    //
    // El tilde y el tacho se quedan SIN palabra a propósito y no es por ahorrar: significan
    // lo mismo en la fila, en la tarjeta y al pie del detalle, así que ahí el ícono ya es el
    // nombre. Lo mismo vale para el bucle de «Se repite», que es la marca de lo que se
    // repite en TODO el tablero (el chip de la tarjeta, la vista, la columna de la tabla).
    // La fecha y el ritmo no tienen esa suerte — un calendario suelto no dice QUÉ fecha.
    <div role="group" aria-label={`Acciones sobre ${cosas}`}
      style={{
        display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
        gap: 10, flexWrap: 'wrap', padding: '7px 12px', borderRadius: 11,
        border: '1px solid var(--primary-weak)', background: 'var(--primary-bg)',
        fontFamily: SANS, ...estilo,
      }}>


      {/* ── IZQUIERDA: la casilla, marcada, y el número. ───────────────────────────────
          «El botón de quitar selección no debe existir, solamente el check en el mismo
          lugar, a la izquierda del todo, marcado, como seleccionado, y al lado el número de
          cantidad de items que agarró. Y si lo vuelvo a marcar se deselecciona» (25/09/2026).

          La ✕ que había acá era un segundo control para lo mismo: en la tabla, lo que
          selecciona ES una casilla —la de cada fila y la de «todas» del encabezado—, así que
          destildar la casilla ya significaba «ninguna». Un botón aparte para eso es partir la
          respuesta en dos, y encima con otra forma.

          ⚠️ Por eso es un `<input type="checkbox">` de verdad y no un botón dibujado como
          casilla: es el MISMO control que las filas, se anuncia como casilla marcada y el
          teclado la conoce. `checked` es siempre true —la barra sólo existe con algo
          seleccionado— y destildarla limpia.

          El número va al lado y NO es clicable: el `role="status"` lo canta a medida que se
          tildan tarjetas, que es lo único que le queda a quien no ve la barra. */}
      {/* ⚠️ `flex: 1` EN LOS DOS COSTADOS, y no `flex: none`. Con `space-between` a secas el
          grupo del medio no queda centrado: queda donde sobra, o sea corrido hacia el lado
          del grupo más angosto —la izquierda mide ~48 px y la derecha ~74, así que el medio
          salía 13 px a la izquierda del centro real—. Dos costados elásticos, uno alineado al
          principio y el otro al final, dejan el medio exactamente en el medio, y siguen ahí
          con cualquier ancho: es el molde de tres ranuras de toda barra de herramientas. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
        <input type="checkbox" checked readOnly
          onClick={() => { cerrarEditores(); onLimpiar(); }}
          title="Quitar la selección" aria-label={`${rotCuenta}. Quitar la selección`}
          style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)', flex: 'none' }} />
        <span role="status" title={rotCuenta} aria-label={rotCuenta}
          style={{ flex: 'none', minWidth: 24, fontFamily: MONO, fontSize: 13, fontWeight: 700, color: 'var(--primary)', lineHeight: 1 }}>
          {n}
        </span>
      </div>


      {/* ── MEDIO: lo que CAMBIA la tarjeta, y acá sí con su palabra donde hace falta. ──
          «En el medio la fecha y el proyecto, que sería bueno que no sean solo íconos, pero
          cuida que entre bien todo» (25/09/2026). Son los dos únicos controles de la barra
          que no se adivinan por su forma: un tilde y un tacho significan lo mismo en toda la
          app, y un calendario y un lápiz sueltos no dicen QUÉ fecha ni qué se edita. */}
      {/* ⚠️ `gap: 14` Y NO 6. «No los pongas tan juntos a los del medio» (25/09/2026): son
          los controles de la barra que tienen borde Y palabra, y a 6 px sus cajas se tocan y
          se leen como un solo bloque partido por una raya. Los de los costados pueden ir
          apretados porque son íconos sueltos sin caja —ahí el aire lo pone el propio
          botón—; dos pastillas necesitan el doble. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 'none', justifyContent: 'center' }}>

        {/* EL INTERRUPTOR «Se repite», PRIMERO DEL GRUPO Y SIN PALABRA.
            ⚠️ VA PRIMERO PORQUE ES EL QUE DECIDE QUÉ ES LO DE AL LADO: leído en orden dice
            «esto se repite → por eso lo temporal es un ritmo y no una fecha», que es el
            MISMO orden que el detalle (el interruptor arriba, el ritmo abajo). Puesto
            después, la ranura temporal cambia de forma sin que nada la explique.
            ⚠️ Y SIN PALABRA: el bucle ES el nombre de esto en todo el tablero (el chip de la
            tarjeta, la vista Recurrentes, la columna de la tabla, el ícono del detalle). La
            palabra la dice el `title`, que no ocupa lugar — y la cuenta de arriba dice que
            un tercer control con texto no entra. */}
        <BtnIcono rotulo={rotRepite} tono={todasRepiten ? 'primary' : 'dim'} pressed={todasRepiten}
          onClick={() => enLote(
            // ⚠️ El verbo concuerda con el NÚMERO QUE SE MUESTRA, no con la selección: la
            // barra se dibuja desde una sola tildada, así que «1 se repiten» sale en el caso
            // más común de todos. Y el número del que marca es `cambianRepite` —las que de
            // verdad cambian— mientras que el del que desmarca es `n`: por eso son dos.
            todasRepiten
              ? `${n} ya no se ${n === 1 ? 'repite' : 'repiten'}`
              : `${cambianRepite} se ${cambianRepite === 1 ? 'repite' : 'repiten'}`,
            (t) => { if (esRecurrente(t) === todasRepiten) cfg.setRecurrente(t, !todasRepiten); },
          )}>
          <IconoRepite size={15} />
        </BtnIcono>

        {/* ⚠️ EL CALENDARIO ABIERTO MIDE 118 EN VEZ DE 34, y con `space-between` eso ya no
            corre a nadie de lugar: lo que se achica es el AIRE repartido, no la posición de los
            vecinos. (Con la barra encogida a su contenido sí los corría, y por eso estaba
            puesto último del grupo; el orden se queda igual porque agrupa por significado —
            primero lo que cambia la tarea, al final lo que la saca de encima.)
            Cómo un ícono abre un calendario: el botón monta el `<input type=date>` de verdad y
            el ref le llama `showPicker()`. Es el mecanismo de `CeldaFecha` (Tablas.tsx:425-461)
            —las dos únicas líneas de todo el repo que llaman a `showPicker`— con sus dos
            gotchas intactos:
            · `pickerAbierto` es un `useRef` y NO estado: el ref callback corre en cada render y
              sin el flag `showPicker()` se volvería a llamar. Se resetea en el `onClick` del
              BOTÓN, no en un efecto.
            · `showPicker?.()` va dentro de un `try` con el catch vacío a propósito: no existe
              en Safari viejo y tira si la llamada no cuelga de un gesto. Sin picker nativo
              queda el input, que igual se edita — por eso el input es real y visible, y no uno
              escondido detrás del ícono: escondido, ese respaldo no existiría.
            El `height: 34` (border-box, globals.css) es lo que hace que abrirlo NO cambie el
            ALTO de la barra, que es lo que esta ronda vino a cuidar. Y los 118 son los mismos
            de `fechaInput` (Tablas.tsx:119): por debajo de ~110 Chrome recorta «aaaa».
            No va en un flotante absoluto porque `cajaStyle` computa `overflow` en los DOS ejes
            (`overflow-x: auto` + `overflow-y: visible` → el Y pasa a auto) y lo recortaría, o
            devolvería la barra de scroll que la ronda anterior mató. */}
        {/* ⚠️ UNA SOLA RANURA PARA «¿CUÁNDO?», Y TRES FORMAS QUE NUNCA CONVIVEN: el deadline
            (si algo de la selección puede tener fecha), el ritmo (si TODO se repite) y, como
            segundo paso del ritmo, el día. Es un `? :` y no tres condiciones sueltas por lo
            mismo que en el detalle: escrito suelto, el día que alguien toque una condición
            quedan las tres a la vez —y ahí la barra no entra— o ninguna, y el grupo del
            medio se queda con un solo control. */}
        {puedeFechar ? (
          editandoFecha ? (
            <input type="date" autoFocus
              ref={(el) => {
                if (!el || pickerAbierto.current) return;
                pickerAbierto.current = true;
                try { el.showPicker?.(); } catch { /* sin picker nativo queda el input, que igual se edita */ }
              }}
              onChange={(e) => {
                const v = e.target.value;
                setEditandoFecha(false);
                if (v) enLote(`Deadline ${v} en ${conFecha.length}`, (t) => { if (!esRecurrente(t)) cfg.setDeadline(t, v); });
              }}
              onBlur={() => setEditandoFecha(false)}
              // El Escape se queda acá: con el picker abierto se lo come el navegador, y con el
              // picker cerrado tiene que cerrar el editor y NO el modal del proyecto que lo
              // contiene. Gana lo más de adentro.
              onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setEditandoFecha(false); } }}
              title={rotFecha} aria-label={rotFecha}
              style={{
                flex: 'none', boxSizing: 'border-box', width: 118, height: 34, padding: '4px 7px',
                borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)',
                color: 'var(--ink)', fontSize: 12.5, fontFamily: SANS, cursor: 'pointer',
              }} />
          ) : (
            <BtnIcono rotulo={rotFecha} texto="Deadline"
              onClick={() => { pickerAbierto.current = false; setEditandoFecha(true); }}>
              <CalendarioLote />
            </BtnIcono>
          )
        ) : (
          /* LA REPETICIÓN, EN LA RANURA QUE DEJÓ EL DEADLINE. La lista sale de
             `opcionesRepeticion` —la MISMA que pinta el desplegable de los dos detalles—,
             así que un preset nuevo aparece acá sin que nadie se acuerde de esta barra.
             ⚠️ ACÁ NO SE LE PASA UN VALOR, y es a propósito: son N tarjetas y no hay UNA
             repetición que mostrar, así que el desplegable es de ACCIÓN (`value=""` +
             `resetAfterSelect`) y lo que se lee en el botón es el NOMBRE del campo. Es
             exactamente lo que hace el de «Proyecto» de al lado, y por eso tampoco entra
             acá la opción del valor suelto: sin valor, no hay nada suelto que mostrar.
             ⚠️ Y «Indefinida» ES EL DESTINO QUE BORRA: sin él, una repetición puesta de más
             sólo se saca abriendo cada detalle de a uno.
             ⛔ ACÁ VIVÍA EL SEGUNDO PASO —«¿qué día?»— Y YA NO EXISTE: era el ancla del
             modelo viejo (una frecuencia + UN día), y una RRULE dice las dos cosas en un
             solo valor. Lo que aquel paso contestaba a medias —un día por vez— ahora lo
             contesta entero «Personalizado…», que es el pedido («varios días de la
             semana»). Con eso la ranura vuelve a tener UN estado y no dos, que además es lo
             que le devuelve a la barra los 78 px que el paso del día le comía. */
          <span title={`Cada cuánto se repiten ${cosas}`} style={{ flex: '0 1 auto', minWidth: 0, display: 'inline-flex' }}>
            <Dropdown
              value=""
              resetAfterSelect
              placeholder={ROTULO_REPETICION}
              align="right"
              ariaLabel={`Cada cuánto se repiten ${cosas}`}
              icono={<span style={{ display: 'flex', color: 'var(--dim)' }}><IconoRepite size={14} /></span>}
              buttonStyle={{ height: 34, padding: '0 8px', borderRadius: 9, gap: 4, fontSize: 12.5 }}
              options={opcionesRepeticion()}
              onChange={elegirRepeticion} />
          </span>
        )}

        {/* ⚠️ ACÁ HABÍA UN `<select>` NATIVO, y la casa lo prohíbe con todas las letras
            (app/_ui/Select.tsx:10-12). Además su `maxWidth: 190` no sólo lo techaba: por
            Flexbox §4.5 el max-width clampea el tamaño mínimo automático, así que costaba 190
            px CLAVADOS —no podía encogerse ni crecer— mientras su opción más larga pedía 267.
            El `Dropdown` de la casa cuesta ~52 y trae lo que una lista plana de 70 proyectos
            necesita: buscador (sale solo pasadas las 8 opciones, con el foco entrando solo en
            el campo), el punto de color de cada proyecto, y el menú en un PORTAL
            `position: fixed` con z-index 1000 — lo único que lo salva del `overflow` de
            `cajaStyle` y del modal. `resetAfterSelect` está documentado textualmente para
            esto: «Para selects-acción (ej. "Mover a…")».
            ⚠️ SIN `width`: el ancho va AUTO. Forzarlo no entra — el botón del Dropdown es
            `space-between` con un `gap: 8` hardcodeado en su span interno, así que por debajo
            de ~54 el caret se come al ícono.
            ⚠️ El `title` va en el `<span>` de afuera porque el `Dropdown` NO tiene prop `title`
            y un control se anuncia con los dos. El arreglo de verdad es agregarle `title` AL
            Dropdown, que es lo que manda su propia regla; queda como pendiente.
            El ícono se envuelve en un span que le pisa el `--faint` que el componente le pone
            por dentro, para que el lápiz tenga el mismo `--dim` que los otros cuatro.
            ⚠️ Y NO SE DIBUJA EN LA BARRA DE PROYECTOS: un proyecto no vive adentro de otro
            proyecto, así que el desplegable se llenaría con la propia selección. La prop en
            `null` ES la capacidad ausente. */}
        {cfg.mover && (
          <span title={rotMover} style={{ flex: '0 1 auto', minWidth: 0, display: 'inline-flex' }}>
            <Dropdown
              value=""
              resetAfterSelect
              placeholder="Proyecto"
              align="right"
              ariaLabel={rotMover}
              icono={<span style={{ display: 'flex', color: 'var(--dim)' }}><LapizLote /></span>}
              buttonStyle={{ height: 34, padding: '0 8px', borderRadius: 9, gap: 4, fontSize: 12.5 }}
              options={board.labels.map((l) => ({ value: l.id, label: `${l.emoji} ${l.name}`, color: l.color }))}
              onChange={(id) => {
                if (!id) return;
                const l = board.labelById(id);
                const aplicar = cfg.mover;
                if (!aplicar) return;
                enLote(`${n} a «${l?.name ?? ''}»`, (t) => aplicar(t, id));
              }} />
          </span>
        )}
      </div>

      {/* ── DERECHA: las dos que CIERRAN la tarjeta, juntas y al final. ────────────────
          «El completar tarea y eliminar al final del todo, juntos» (25/09/2026) — y es el
          mismo par, en el mismo orden, que el pie del detalle, la fila de la tabla y la
          tarjeta del Kanban: un control significa lo mismo en todos lados. Van lejos de la
          casilla de la izquierda a propósito: dos controles parecidos pegados es cómo se
          volvieron a confundir seleccionar y completar.
          ⚠️ EN LA BARRA DE PROYECTOS ESTE GRUPO VA VACÍO, y el `div` se queda igual: es el
          `flex: 1` que equilibra a la izquierda y deja el medio centrado. El porqué de las
          dos ausencias está enumerado en la cabecera del archivo. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>

        {cfg.estado && (
          <BtnIcono rotulo={rotEstado} tono={todasHechas ? 'good' : 'dim'} pressed={todasHechas}
            onClick={() => {
              const est = cfg.estado;
              if (!est) return;
              enLote(
                todasHechas ? `${n} reabierta${plural}` : `${n} completada${plural}`,
                (t) => { if (est.hecha(t) === todasHechas) est.toggle(t); },
              );
            }}>
            <TildeLote hecho={todasHechas} />
          </BtnIcono>
        )}
        {/* El tacho se IMPORTA de `piezas`: es el mismo dibujo que la fila de la tabla
            (Tablas.tsx:845), la tarjeta y el detalle. `piezas.tsx` sólo importa TIPOS, así que
            no hay ciclo. La consecuencia va pegada al botón y ANTES del click, que es lo que un
            `title` puede hacer donde ya no hay texto; el `ask()` no cambia una coma. */}
        {cfg.borrar && ask && (
          <BtnIcono rotulo={rotBorrar} tono="bad"
            onClick={() => {
              const borrar = cfg.borrar;
              if (!borrar || !ask) return;
              ask(
                `¿Eliminar ${cosas}? Esto no se puede deshacer en lote.`,
                () => { elegidas.forEach(borrar); cerrarEditores(); onLimpiar(); },
              );
            }}>
            <IconoTacho size={16} />
          </BtnIcono>
        )}
      </div>

      {/* EL DIÁLOGO «PERSONALIZADO», SOBRE LA SELECCIÓN ENTERA. Es el MISMO componente que
          abre el detalle de una tarjeta: la pieza no sabe a quién se le aplica lo que
          devuelve, y por eso sirve para uno y para N.
          ⚠️ SE ABRE CON LA REPETICIÓN QUE TODAS COMPARTEN, y con nada si no comparten una:
          sembrarlo con la de la primera sería mostrarle a la persona el valor de una
          tarjeta cualquiera de la selección como si fuera el de todas.
          ⚠️ Y ELEGIR «Personalizado…» **NO LIMPIA LA SELECCIÓN** —no pasa por `enLote`—,
          porque si limpiara el diálogo se quedaría sin a quién escribirle. Limpia el
          guardado, o el cierre no escribe nada: abandonarlo no rompe nada. */}
      {custom && (
        <RepeticionModal
          valor={todasIgual ? rComun : null}
          onGuardar={ponerRepeticion}
          onCerrar={() => setCustom(false)} />
      )}
    </div>
  );
}
