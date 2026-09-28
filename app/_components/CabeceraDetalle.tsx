'use client';

// =============================================================================
// CabeceraDetalle — la cabecera de «el detalle de algo con nombre y cara»
// =============================================================================
// Portada a sangre, la marca cruzándole el borde de abajo, el cerrar como círculo
// oscuro sobre la imagen, las pastillas para cambiarla abajo a la derecha al hover,
// y una fila con el renglón chico arriba y el nombre grande al lado de la marca.
// Es la anatomía de una página de Notion y salió de tres pedidos del mismo día
// (27/09/2026): «que el emoji lo cruza, y el título acompaña», «que el botón de
// cerrar sea diferente a los otros, sino confunde» y «que los otros mejor estén
// abajo a la derecha de la portada».
//
// ⚠️ EXISTE PORQUE ESTABA ESCRITA TRES VECES. El detalle de un proyecto en el
// tablero (`pd-*` en BoardShell), la ficha de un cliente (`fc-*` en FichaCliente) y
// —desde hoy— el detalle de un cliente de la plataforma dibujan la MISMA cosa. El
// 28/09/2026 el dueño lo reportó mirando la tercera: «el detail está mal, te había
// dicho que idéntico al del plan». Tenía razón y no era un descuido de estilos: eran
// tres implementaciones, y tres implementaciones divergen a la tercera edición. Es la
// misma regla y el mismo camino que `TarjetaEntidad`, que ya unificó la TARJETA:
// «si dos cosas tienen que verse igual, tienen que ser el mismo componente».
//
// ⚠️ LA ESCALA ES UN PROP Y LA ANATOMÍA NO. Una ficha a 1560 px de ancho y un detalle
// a 900 no llevan la misma banda ni la misma marca; lo que no puede diferir es DÓNDE
// está cada cosa y cómo se ve. Por eso `alto`, `tam` y `cuadrado` entran por
// parámetro y las posiciones se CALCULAN de ellos — la del tablero estaba cableada en
// `top:97px` con la cuenta explicada en un comentario (124 − 54/2), que es exactamente
// el número que se queda viejo cuando alguien toca el alto de la banda.
//
// ⚠️ Y NO DECIDE NADA DE LO QUE MUESTRA. Qué dice el renglón chico, qué chips van al
// lado y qué botones van a la derecha son datos de cada pantalla y entran por slots:
// el pid y el chip de recurrente son del tablero, el plan y «Inspeccionar» son de la
// plataforma, y meterlos acá adentro obligaría a esta pieza a saber de las tres.

import type { ReactNode } from 'react';
import { geometriaCabecera } from './cabecera-detalle-geo';
import { Marca } from './Marca';
import { useReposicionar, BarraReposicion } from './Reposicionar';
import { fondoPortada, esFoto, urlPortada } from '@/lib/portadas';

export function CabeceraDetalle({
  nombre, color,
  portada, portadaY, onPortada, onEncuadre,
  icono, emoji, foto, avatarY, cuadrado = false, onIcono,
  alto = 124, tam = 54, anillo = 3,
  antes, kicker, titulo, chips, acciones, onCerrar,
}: {
  nombre: string;
  /** El color derivado del nombre. Pinta el degradado sin portada y tiñe la fila. */
  color: string;

  /** La portada y su encuadre (migs 0173/0174/0179). `null` = el degradado del color. */
  portada?: string | null;
  portadaY?: number | null;
  /**
   * Abrir el selector de portada. Recibe el BOTÓN, no un booleano: el popover cuelga
   * de su ancla. Sin este callback no se dibuja la pastilla — un control que no puede
   * hacer nada se lee como que la app está rota.
   */
  onPortada?: (ancla: HTMLElement) => void;
  /** Guardar el encuadre. Sin esto no se ofrece «Reposicionar». */
  onEncuadre?: (y: number) => void;

  /** La marca: un ícono, un emoji, una foto puesta por el código, o las iniciales. */
  icono?: string | null;
  emoji?: string | null;
  foto?: string | null;
  avatarY?: number | null;
  /** Cuadrada (un proyecto, una cuenta) o redonda (una persona). */
  cuadrado?: boolean;
  /** Abrir el selector de marca. Sin esto la marca se dibuja y no es un botón. */
  onIcono?: (ancla: HTMLElement) => void;

  /** El alto de la banda. 124 en un detalle, 160 en una ficha a ancho completo. */
  alto?: number;
  /** El lado de la marca. De acá sale dónde cruza y cuánto sangra la fila de abajo. */
  tam?: number;
  /**
   * El anillo del color de la superficie que despega la marca de la portada. 3 en un
   * detalle, 4 en una ficha a ancho completo — con una marca de 88 px, 3 se pierde.
   */
  anillo?: number;

  /**
   * A la IZQUIERDA del título, antes que nada. Hoy lo usa un solo caso y por eso es
   * un slot y no un prop con forma: el «← Volver a la tarea» del detalle de un
   * proyecto abierto desde una tarea. Va acá y no en `acciones` porque volver es
   * navegación, y la navegación se busca del lado por el que se lee.
   */
  antes?: ReactNode;
  /** El renglón chico de arriba: el pid de un proyecto, el slug de un cliente. */
  kicker?: ReactNode;
  /** El nombre. Va como slot porque en el tablero es un input y acá un editable. */
  titulo: ReactNode;
  /** Al lado del nombre: el plan, «Dueño», «Se repite». */
  chips?: ReactNode;
  /** A la derecha de la fila: los botones de esta pantalla. */
  acciones?: ReactNode;
  /**
   * ⚠️ OPCIONAL, y de eso depende que esta pieza sirva en los dos contenedores. El
   * detalle del tablero y el de un cliente de la plataforma son su propio overlay y
   * no tienen otro cerrar, así que lo dibuja acá. La ficha de Customer Success vive
   * adentro de `Modal`, que YA pone el suyo y lo reposiciona por CSS sobre la
   * portada: pasarle uno acá serían dos cruces en la misma esquina.
   */
  onCerrar?: () => void;
}) {
  // ⚠️ EL HOOK VA ANTES DE CUALQUIER RETURN, siempre. Es la regla que el pre-push
  // vigila con `scripts/hooks-en-orden.sh`, y el modo de falla es React #300: la
  // pantalla ENTERA en blanco, con un error que no dice ni el archivo ni la línea.
  const repo = useReposicionar(portadaY ?? null, onEncuadre ?? (() => {}));

  // La marca cruza: mitad sobre la imagen, mitad sobre la fila. Y la fila le deja su
  // lugar a la izquierda. Las dos cuentas salen de `alto` y `tam`, no de un número —
  // y viven en un módulo aparte para que un test las pueda importar.
  const { cruce, sangria } = geometriaCabecera(alto, tam);
  const conPortada = esFoto(portada);

  return (
    <>
      <div className="cd-top" style={{ position: 'relative', flex: 'none' }}>
        {/* ⚠️ LA PORTADA VA SIEMPRE, no sólo si eligieron una. `null` NO significa «sin
            portada»: significa el degradado DERIVADO del nombre, que es el default del
            modelo desde la mig 0173. Dibujarla sólo cuando había una elegida hacía que
            la feature no se viera nunca — medido: de 71 proyectos, CERO tenían una. */}
        <div aria-hidden ref={repo.props.ref}
          onPointerDown={repo.props.onPointerDown} onPointerMove={repo.props.onPointerMove}
          onPointerUp={repo.props.onPointerUp} onPointerCancel={repo.props.onPointerCancel}
          style={{ height: alto, background: fondoPortada(portada ?? null, color, portadaY ?? null), ...repo.props.style }} />

        {repo.activo ? (
          <BarraReposicion onGuardar={repo.guardar} onCancelar={repo.cancelar} />
        ) : (onPortada || (conPortada && onEncuadre)) && (
          <span className="cd-acciones">
            {/* ⚠️ EL RÓTULO ES SIEMPRE «Portada», como en el tablero. «Poner portada»
                cuando no hay ninguna se lee mejor Y ES UNA DIFERENCIA: el pedido es que
                las tres pantallas digan lo mismo, así que la mejora va en las tres o en
                ninguna.
                (Y EL COMENTARIO VA ACÁ AFUERA. Adentro de un `{cond && ( … )}`, un
                bloque de comentario JSX no es un comentario: es un segundo hijo de la
                expresión, y no compila. Es la misma familia que el `//` entre etiquetas
                de AGENTS.md — lo que decide no es qué dice, es DÓNDE CAE.
                Y su cierre tampoco se puede nombrar acá adentro: la secuencia que
                termina un comentario de bloque lo termina también cuando está escrita
                como ejemplo, y el `}` que sigue queda suelto. Pasó escribiendo esto.) */}
            {onPortada && (
              <button type="button" className="cd-pill"
                onClick={(e) => onPortada(e.currentTarget)}>Portada</button>
            )}
            {/* ⚠️ SÓLO CON UNA FOTO. Un degradado no se puede acomodar —no hay imagen
                que mover— y un botón que no puede hacer nada se lee como que la app
                está rota. */}
            {conPortada && onEncuadre && (
              <button type="button" className="cd-pill" onClick={repo.empezar}>Reposicionar</button>
            )}
            {conPortada && (
              <a className="cd-pill cd-icono" href={urlPortada(portada) ?? '#'} download
                target="_blank" rel="noreferrer"
                title="Descargar la portada" aria-label="Descargar la portada">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 3v12" /><path d="m7 11 5 5 5-5" /><path d="M5 21h14" />
                </svg>
              </a>
            )}
          </span>
        )}

        {/* CERRAR, sobre la portada y DISTINTO de las acciones: círculo oscuro sólido
            arriba a la derecha. «Que el botón de cerrar sea diferente a los otros,
            sino confunde» (27/09/2026) — eran cuatro pastillas en fila y la última
            cerraba todo. La FORMA distingue mejor que el color: sobre una foto
            cualquiera, dos grises translúcidos se ven iguales. */}
        {onCerrar && (
          <button type="button" className="cd-cerrar" aria-label="Cerrar" onClick={onCerrar}>×</button>
        )}

        {/* ⚠️ ABSOLUTA Y NO UN MARGEN NEGATIVO EN LA FILA: con el margen sube TODO
            —marca, kicker y título— y el nombre queda escrito sobre la foto, que con
            un degradado claro se lee y con un bosque no. */}
        {onIcono ? (
          <button type="button" className="cd-marca"
            style={{ left: 20, top: cruce, borderRadius: cuadrado ? 14 : 999, boxShadow: `0 0 0 ${anillo}px var(--surface)` }}
            onClick={(e) => onIcono(e.currentTarget)}
            title="Cambiar la imagen" aria-label={`Cambiar la imagen de ${nombre}`}>
            <Marca icono={icono} emoji={emoji} foto={foto} nombre={nombre} tam={tam} y={avatarY} color={color} cuadrado={cuadrado} />
          </button>
        ) : (
          <span className="cd-marca cd-marca-fija"
            style={{ left: 20, top: cruce, borderRadius: cuadrado ? 14 : 999, boxShadow: `0 0 0 ${anillo}px var(--surface)` }}>
            <Marca icono={icono} emoji={emoji} foto={foto} nombre={nombre} tam={tam} y={avatarY} color={color} cuadrado={cuadrado} />
          </span>
        )}
      </div>

      {/* LA FILA. Teñida con el color: distingue el detalle de cada uno de un vistazo.
          Alinea por la BASE, así que el título queda a la altura de la marca sin
          ninguna cuenta. */}
      <div className="cd-fila" style={{ paddingLeft: sangria, borderBottom: `1px solid ${color}33`, background: `${color}12` }}>
        {antes}
        <span className="cd-txt">
          {kicker != null && <span className="cd-kicker">{kicker}</span>}
          {titulo}
        </span>
        {chips}
        <span style={{ flex: 1 }} />
        {acciones}
      </div>

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </>
  );
}

// ⚠️ NINGÚN BACKTICK ACÁ ADENTRO, ni en un comentario: adentro de un template literal
// una sola cierra la hoja a la mitad, la ruta contesta 200 con el layout entero y sin
// cuerpo, y el typecheck lo dice al revés (como una propiedad que no existe en un tipo
// que es el pedazo de CSS que quedó afuera). AGENTS.md lo tiene medido y ya pasó dos
// veces esta semana.
const CSS = `
/* Abajo a la derecha y en CLARO: la otra mitad de distinguirlas del cerrar, que es un
   circulo oscuro solido arriba. Sobre una foto clara el vidrio blanco se sigue leyendo
   por el borde y la sombra. */
.cd-acciones{ position:absolute; right:14px; bottom:12px; z-index:3; display:flex; gap:6px;
  opacity:0; transition:opacity .12s; }
.cd-top:hover .cd-acciones, .cd-acciones:focus-within{ opacity:1; }
.cd-pill{ background:rgba(255,255,255,.90); border:0; border-radius:999px; padding:6px 13px;
  font:inherit; font-size:12.5px; font-weight:600; color:#16181d; cursor:pointer;
  text-decoration:none; white-space:nowrap; backdrop-filter:blur(6px);
  box-shadow:0 1px 4px rgba(18,21,27,.18); }
.cd-pill:hover{ background:#fff; color:#16181d; }
.cd-pill:focus-visible{ outline:2px solid var(--primary); outline-offset:2px; }
.cd-icono{ display:inline-flex; align-items:center; justify-content:center; width:30px; height:28px; padding:0; }

.cd-cerrar{ position:absolute; top:12px; right:12px; z-index:4;
  width:32px; height:32px; display:inline-flex; align-items:center; justify-content:center;
  background:rgba(18,21,27,.82); color:#fff; border:0; border-radius:999px; padding:0;
  cursor:pointer; font-size:19px; line-height:1;
  box-shadow:0 1px 6px rgba(18,21,27,.30); }
.cd-cerrar:hover{ background:#12151b; color:#fff; }

/* El anillo lo pone el JSX porque su grosor cambia con el tamano de la marca. */
.cd-marca{ position:absolute; z-index:2; padding:0; border:0; background:none;
  cursor:pointer; line-height:0; }
.cd-marca:hover{ filter:brightness(.94); }
.cd-marca-fija{ cursor:default; }
.cd-marca-fija:hover{ filter:none; }

/* ⚠️ nowrap Y QUIEN CEDE ES EL TEXTO. Con wrap, un nombre largo mas tres chips baja los
   botones a un segundo renglon pegado al borde izquierdo, que se lee como una pantalla
   rota y no como un layout apretado. La regla de la casa: declarar quien CEDE en vez de
   acertarle a la suma de anchos. */
.cd-fila{ display:flex; align-items:flex-end; gap:10px; flex-wrap:nowrap;
  padding-top:10px; padding-right:20px; padding-bottom:12px; flex:none; }
.cd-txt{ display:flex; flex-direction:column; gap:1px; min-width:0; flex:0 1 auto;
  overflow:hidden; }
.cd-kicker{ display:flex; align-items:center; gap:8px; min-width:0; }

/* ⚠️ ESTO SE PERDIO EN LA MUDANZA Y LO CAZO LA REFUTACION (28/09/2026). La hoja vieja
   del tablero lo tenia y la nueva salio sin el, con la transicion de opacidad intacta:
   para quien pide menos movimiento, las pastillas volvian a aparecer con fundido. No da
   error, no se ve en ninguna captura, y es exactamente el tipo de linea que se cae al
   mover una hoja de lugar. */
@media(prefers-reduced-motion:reduce){ .cd-acciones{ transition:none; } }
`;
