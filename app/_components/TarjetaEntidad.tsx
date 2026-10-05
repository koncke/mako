'use client';

// =============================================================================
// TarjetaEntidad — la tarjeta de «algo con nombre y cara», y su grilla
// =============================================================================
// El molde salió de una referencia que pasó el dueño el 26/09/2026: banda arriba,
// la marca montada sobre ella, el nombre con su bajada, y una fila de números al
// pie separada por filetes. Nació en Customer Success para un CLIENTE y vive acá
// desde el 27/09, cuando el dueño pidió que la vista de /admin fuera «exactamente
// igual que la vista de clientes que construimos».
//
// ⚠️ ES UN COMPONENTE COMPARTIDO Y NO UN CSS COMPARTIDO, y la diferencia importa:
// «exactamente igual» dura lo que dura la primera edición. Con dos composiciones
// sobre una misma hoja, el día que alguien mueva la bajada en una pantalla, la
// otra se queda vieja sin que nada avise. Lo que cambia entre las dos son sus
// DATOS —un cliente tiene tres números del tablero, un workspace tiene su plan y
// su equipo—, y eso entra por slots.
//
// ⚠️ Y LA HOJA VIAJA CON LA GRILLA, no aparte. `CSS_CLIENTE` se definía en
// ClienteCard y lo inyectaba ClientesApp: montar la tarjeta en otra pantalla sin
// acordarse de concatenar esa constante la dibujaba SIN UN SOLO ESTILO —sin caja,
// sin banda, sin la fila de números—. Ahora el `<style>` lo pone `GrillaTarjetas`,
// que es lo que se monta, así que no hay nada que recordar. Es el mismo modo de
// falla que el avatar ya había pagado una vez (ver el comentario de `Marca`).

import type { ReactNode } from 'react';
import { Marca } from './Marca';
import { fondoPortada } from '@/lib/portadas';

/** Nombre → color estable. El mismo nombre da siempre el mismo color, en cualquier
 *  pantalla y en cualquier orden de la lista: un color que baila es ruido. */
export function colorDe(nombre: string): string {
  let h = 0;
  for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) % 360;
  return `hsl(${h} 52% 46%)`;
}

export function TarjetaEntidad({
  nombre, bajada, portada, portadaY, icono, avatarY, color, foto,
  chips, pie, acciones, onAbrir, etiqueta,
}: {
  nombre: string;
  /** El renglón chico debajo del nombre. */
  bajada?: ReactNode;
  /** Su portada (mig 0173) y su encuadre (0174). Sin portada va el degradado del color. */
  portada?: string | null;
  portadaY?: number | null;
  /** Su marca: una foto, un `icon:<set>:<nombre>` o nada → las iniciales. */
  icono?: string | null;
  avatarY?: number | null;
  color: string;
  /** Una foto que pone el CODIGO (la de Google de su admin, o su Gravatar). Gana
   *  sobre `icono` y cae a las iniciales si no carga — ver `Marca`. */
  foto?: string | null;
  /** Al lado del nombre: el plan, «Dueño», «Agencia». */
  chips?: ReactNode;
  /** El remate: los números con filete, o lo que esa pantalla tenga para contar. */
  pie?: ReactNode;
  /** Botones REALES sobre la tarjeta. Ver el porqué del overlay, acá abajo. */
  acciones?: ReactNode;
  onAbrir: () => void;
  /** Para el lector de pantalla: qué abre esta tarjeta. */
  etiqueta: string;
}) {
  return (
    <div className="cl-card">
      {/* ⚠️ EL BOTÓN ES UNA CAPA QUE CUBRE LA TARJETA, y no la tarjeta entera como
          antes. La tarjeta era un <button> —y el archivo explicaba por qué: «la
          tarjeta ENTERA es el botón», y uno adentro de otro es HTML inválido—, pero
          /admin necesita botones de verdad encima («Entrar como», el menú). Con el
          botón de fondo se conservan las dos cosas: sigue siendo clicable en toda
          su superficie Y los controles de arriba reciben su propio click.
          El `pointer-events` es lo que lo hace funcionar: el contenido no los
          intercepta, y sólo `.cl-acc` vuelve a aceptarlos. */}
      <button type="button" className="cl-abrir" onClick={onAbrir} aria-label={etiqueta} />

      <span className="cl-banda" aria-hidden style={{ background: fondoPortada(portada, color, portadaY) }} />
      <span className="cl-avwrap"><Marca icono={icono} foto={foto} nombre={nombre} tam={44} y={avatarY} color={color} /></span>

      <span className="cl-n">
        {nombre}
        {chips && <span className="cl-chips">{chips}</span>}
      </span>
      {bajada != null && <span className="cl-e">{bajada}</span>}

      <span className="cl-sp" />

      {pie}
      {acciones && <span className="cl-acc">{acciones}</span>}
    </div>
  );
}

/** Los números al pie, en columnas con filete. Es el remate de la referencia y lo
 *  usan las dos pantallas — con números distintos, que es justo lo que cambia. */
export function PieNumeros({ datos }: { datos: { v: number | string; k: string }[] }) {
  return (
    <span className="cl-nums" style={{ gridTemplateColumns: `repeat(${datos.length},1fr)` }}>
      {datos.map((d) => (
        <span className="cl-num" key={d.k}>
          {/* Un cero no grita: es el estado normal de algo a lo que todavía no se le
              asignó nada. */}
          <span className={`v${d.v === 0 ? ' cero' : ''}`}>{d.v}</span>
          <span className="k">{d.k}</span>
        </span>
      ))}
    </span>
  );
}

/** Un renglón de texto al pie, para cuando no hay números que dar. */
export function PieTexto({ children, mal = false }: { children: ReactNode; mal?: boolean }) {
  return <span className={mal ? 'cl-pie cl-pie-mal' : 'cl-pie'}>{children}</span>;
}

/** La grilla. Trae la hoja adentro: montarla es todo lo que hace falta. */
export function GrillaTarjetas({ children, sinEstirar = false }: {
  children: ReactNode;
  /**
   * NO ESTIRAR la última fila: las tarjetas conservan su ancho y sobra espacio a la
   * derecha.
   *
   * ⚠️ ES `auto-fill` CONTRA `auto-fit`, Y LA DIFERENCIA SÓLO SE VE CON POCAS. Con
   * `auto-fit` las columnas vacías se COLAPSAN y la que queda se come todo el ancho:
   * una grilla de UN cliente adentro de un modal de 1560 dibuja una tarjeta de 1500,
   * que se lee como una fila de tabla y no como una tarjeta. Con `auto-fill` las
   * columnas vacías se quedan y la tarjeta mide lo que mide.
   *
   * El default es `auto-fit` porque en la GRILLA de la pantalla es lo correcto: ahí
   * siempre hay varias y llenar la fila es lo que se quiere.
   */
  sinEstirar?: boolean;
}) {
  return (
    <>
      <ul className={sinEstirar ? 'cl-grid cl-grid-fija' : 'cl-grid'}>{children}</ul>
      <EstilosTarjeta />
    </>
  );
}

/**
 * La hoja de la tarjeta, suelta.
 *
 * ⚠️ VIVE ACÁ Y NO ADENTRO DE `GrillaTarjetas` PORQUE LA HOJA ES DE LA TARJETA, NO DE
 * LA GRILLA. Mientras el único lugar donde había tarjetas era una grilla las dos cosas
 * se podían confundir; el día que una `TarjetaEntidad` se dibuja en otro lado —una
 * columna de kanban— sin la grilla no viaja el `<style>`, y lo que sale no es un error
 * ni una pantalla rota: son los mismos spans sin banda, sin bordes y sin pie, que se
 * leen como una tarjeta mal hecha.
 *
 * Montarla dos veces no duplica nada visible (son las mismas reglas), pero no hace
 * falta: cada pantalla la monta UNA vez al lado de donde dibuja sus tarjetas.
 */
export function EstilosTarjeta() {
  return <style dangerouslySetInnerHTML={{ __html: CSS_TARJETA }} />;
}

/** La tarjeta de CREAR: el mismo hueco que una de verdad, punteada y sin peso. */
export function TarjetaNueva({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="cl-nueva" onClick={onClick}>
      <span className="cl-nueva-mas" aria-hidden>＋</span>
      <span>{label}</span>
    </button>
  );
}

// ⚠️ NINGÚN BACKTICK ACÁ ADENTRO, ni en un comentario: cierra la cadena a la mitad
// y la ruta contesta 200 con el layout entero y sin cuerpo.
export const CSS_TARJETA = `
/* La grilla se acomoda sola: entran las que entren con un minimo de 320, y un tope
   de 1180 centrado. El tope impide el efecto contrario: sin el, en un monitor ancho
   las tarjetas se estiran hasta deformar la foto.
   ⚠️ EL 1180 ESTA TAMBIEN EN LA BARRA Y EN LA TABLA (BarraClientes, TablaClientes):
   si cambia aca, cambia alla, o las tres cajas de la pantalla dejan de alinearse y
   eso no se ve en el diff, se ve como una pantalla torcida. */
/* ⚠️ EL TOPE ES UNA VARIABLE Y NO UN NUMERO. Estaba escrito CUATRO veces en TRES
   archivos (aca, la barra y la tabla), asi que cambiarlo en uno desalineaba las tres
   cajas de la pantalla — y eso no se ve en el diff, se ve como una pantalla torcida.
   El propio codigo ya lo avisaba. Ahora se define una vez y quien quiera otro ancho
   redefine --cartera-max en su contenedor, como hace el panel de la plataforma. */
:root{ --cartera-max:1180px; }
.cl-grid{ list-style:none; margin:0 auto; padding:0; display:grid; gap:18px;
  grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); width:100%; max-width:var(--cartera-max); }
.cl-grid > li{ display:flex; }
/* Ver sinEstirar: auto-FILL deja las columnas vacías en su lugar, así que con una sola
   tarjeta la tarjeta mide una tarjeta. Y se topea el ancho por si el contenedor no
   tiene tope propio: adentro de un modal, --cartera-max puede venir en none. */
.cl-grid-fija{ grid-template-columns:repeat(auto-fill, minmax(320px, 400px)); }

.cl-card{ position:relative; display:flex; flex-direction:column; width:100%;
  background:var(--surface); border:1px solid var(--border); border-radius:18px;
  overflow:hidden; text-align:left; font:inherit; color:inherit; min-height:230px;
  transition:border-color .12s, box-shadow .12s; }
.cl-card:hover{ border-color:var(--border-strong); box-shadow:0 6px 18px rgba(18,21,27,.06); }
/* El foco se dibuja en la TARJETA aunque lo reciba el boton de adentro: el que se ve
   es el rectangulo, no la capa invisible. */
.cl-card:has(.cl-abrir:focus-visible){ box-shadow:var(--focus-ring); }

/* La capa que hace clicable toda la tarjeta. Invisible, debajo del contenido. */
.cl-abrir{ position:absolute; inset:0; z-index:0; width:100%; height:100%;
  border:0; background:none; padding:0; cursor:pointer; }
.cl-abrir:focus-visible{ outline:none; }
/* El contenido va ARRIBA de la capa pero no le roba los clicks... */
.cl-card > *:not(.cl-abrir){ position:relative; z-index:1; pointer-events:none; }
/* ...salvo los controles de verdad, que son lo unico que los vuelve a aceptar. */
.cl-card .cl-acc{ pointer-events:auto; }

.cl-banda{ display:block; height:74px; width:100%; }
/* La marca MONTADA sobre la banda: medio adentro y medio afuera. El margen negativo
   es la mitad de su alto, y el anillo la despega del degradado. El anillo es del
   HUECO y no de la marca, para que Marca siga siendo la misma en todas partes. */
.cl-avwrap{ display:block; width:fit-content; margin:-22px 0 0 16px;
  border-radius:999px; box-shadow:0 0 0 3px var(--surface); }

.cl-n{ display:flex; align-items:center; flex-wrap:wrap; gap:7px; margin:10px 16px 0;
  font-size:15.5px; font-weight:640; letter-spacing:-.01em; line-height:1.25;
  color:var(--ink); overflow-wrap:anywhere; }
.cl-chips{ display:inline-flex; align-items:center; gap:6px; }
/* El chip del PLAN. /admin lo pinta con el chip() de sus estilos y acá va por clase
   porque la tarjeta del cliente no importa ese modulo — mismos colores, mismo tamano. */
.cl-plan{ font-size:11px; font-weight:600; padding:2px 8px; border-radius:999px;
  background:var(--primary-bg); color:var(--primary); white-space:nowrap; }
.cl-e{ display:block; margin:2px 16px 0; font-size:12.5px; color:var(--faint);
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cl-sp{ flex:1; min-height:12px; }

/* Los numeros al pie, en columnas con filete - el remate de la referencia. */
.cl-nums{ display:grid; border-top:1px solid var(--border); }
.cl-num{ display:flex; flex-direction:column; align-items:center; gap:1px; padding:9px 4px 10px;
  border-left:1px solid var(--border); }
.cl-num:first-child{ border-left:0; }
.cl-num .v{ font-size:16px; font-weight:680; letter-spacing:-.02em; color:var(--ink);
  font-variant-numeric:tabular-nums; line-height:1.1; }
.cl-num .v.cero{ color:var(--faint); font-weight:560; }
.cl-num .k{ font-size:10.5px; color:var(--faint); }

.cl-pie{ display:block; padding:10px 16px 12px; border-top:1px solid var(--border);
  font-size:11.5px; color:var(--dim); }
.cl-pie-mal{ color:var(--bad); }

/* Los botones de verdad, al pie y separados por el mismo filete. */
.cl-acc{ display:flex; align-items:center; gap:8px; padding:9px 12px 10px;
  border-top:1px solid var(--border); background:var(--surface-2); }

/* La tarjeta de CREAR: la misma pieza que «Crear nuevo proyecto» en el tablero, a
   proposito - si la misma accion se ve distinta en dos pantallas, se aprende dos
   veces. Mismo alto y mismo radio que una de verdad: con 230 contra 214 estiraba
   la primera fila 16px de mas. */
.cl-nueva{ display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px;
  width:100%; min-height:230px; border:1.5px dashed var(--border-strong); border-radius:18px;
  background:transparent; color:var(--dim); font:inherit; font-size:14px; font-weight:600;
  cursor:pointer; transition:border-color .12s, color .12s, background .12s; }
.cl-nueva:hover{ border-color:var(--primary); color:var(--primary); background:var(--primary-bg); }
.cl-nueva-mas{ font-size:26px; line-height:1; font-weight:400; }

.cl-nada{ margin:18px 2px; font-size:13.5px; color:var(--dim); text-align:center; }

@media(prefers-reduced-motion:reduce){ .cl-card, .cl-nueva{ transition:none; } }
`;
