'use client';

// =============================================================================
// FichaCliente — el cliente y SU tablero, en un modal
// =============================================================================
// «No quiero que sea otra ruta, quiero que sea un pop-up, un modal» (26/09/2026).
//
// ⚠️ EL TABLERO ES EL DE VERDAD, no una copia de su diseño: se monta `PlanBoard` /
// `TodoBoard`, los mismos componentes que renderiza `/plan`, con las filas ya filtradas a
// este cliente. Tres tandas se fueron en dibujar algo «parecido» —una lista, después unas
// tarjetas— y las tres se rechazaron por lo mismo: parecido no es igual, y un segundo
// diseño de la misma cosa se mantiene sincronizado a mano hasta que alguien se olvida.
//
// ⚠️ Y NO HAY ESTADO DE CARGA, que es la otra mitad del pedido. Las filas llegan por prop
// desde el server (`filasDeTodos`, leído en la página): al abrir el modal ya están. Dos
// rondas de optimización no movieron el «Leyendo lo suyo» porque el problema nunca fue la
// velocidad — un modal que pide sus datos al abrirse tiene un estado de carga por más
// rápida que sea la consulta.
//
// ⚠️ DOS `useBoard` NO SE PISAN ACÁ. Es la razón por la que antes no monté el tablero, y
// era cierta a medias: dos instancias sobre las MISMAS filas serían dos escritores, pero
// esta ficha y `/plan` nunca están montadas a la vez (son dos pantallas). Lo que sí se
// acota es el ALTA: lo que se cree adentro nace con este cliente puesto, o desaparecería
// al recargar porque esta vista sólo lee lo suyo.
//
// ⚠️ NO HAY BOTÓN DE «ASIGNARLE TRABAJO», y se sacó a pedido: «si ya copiamos la tab de
// plan, ya hay otros botones para eso» (27/09/2026). Es cierto y es la consecuencia de
// montar el tablero de verdad: lo que se crea acá adentro nace suyo, y a lo que ya existe
// se le pone el cliente desde el campo «Cliente» de su propio detalle. Un tercer camino a
// la misma pregunta no suma una opción: parte la respuesta en tres.

import { useState, useRef } from 'react';
import Link from '@/app/_ui/Link';
import { Modal } from '@/app/_ui';
import { PortadaPicker } from '@/app/_components/PortadaPicker';
import { fondoPortada } from '@/lib/portadas';
import type { BoardUser } from '@/app/plan/board/types';
import type { ClienteRef } from '@/lib/plan-clientes';
import { PlanBoard } from '../plan/PlanBoard';
import { TodoBoard } from '../plan/TodoBoard';
import type { ClienteCruce } from './cruce';
import type { TrabajoDeCliente } from './trabajo';
import { Avatar, colorDe } from './ClienteCard';

export function FichaCliente({ c, n, trabajo, user, clientes, onImagen, onCerrar }: {
  c: ClienteCruce;
  /** Su número de cliente. NO es el id del lead. */
  n: number;
  /** SU trabajo, leído y MAPEADO por el server. `null` = no se pudo leer. */
  trabajo: TrabajoDeCliente | null;
  user: BoardUser;
  clientes: ClienteRef[];
  /** Cambió su foto o su portada. Lo persiste el padre, que es el que tiene la lista. */
  onImagen: (cambio: { avatarUrl?: string | null; portada?: string | null }) => void;
  onCerrar: () => void;
}) {
  const [eligiendoPortada, setEligiendoPortada] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [mal, setMal] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const nombre = c.nombre.trim() || 'Sin nombre';
  const color = colorDe(nombre);
  const clienteFijo = { leadId: c.leadId, nombre };

  /** La foto sube por el mismo route multipart que las portadas y se aplica sola: una
   *  imagen subida que después hay que elegir es un paso de más. */
  async function subirFoto(f: File) {
    setSubiendoFoto(true);
    setMal('');
    try {
      const fd = new FormData();
      fd.append('file', f);
      const r = await fetch('/api/portadas', { method: 'POST', body: fd });
      const j: { ok: boolean; url?: string; error?: string } = await r.json();
      if (!j.ok || !j.url) { setMal(j.error || 'No pude subir la foto.'); return; }
      onImagen({ avatarUrl: j.url });
    } catch (e) {
      setMal(e instanceof Error ? e.message : String(e));
    } finally {
      setSubiendoFoto(false);
    }
  }

  return (
    <Modal
      titulo={
        <span className="fc-cab">
          {/* LA PORTADA. `fondoPortada` decide si es una foto, un degradado del catálogo o
              —el default— el color derivado del nombre. La misma función pinta la tarjeta
              de la grilla, así que las dos no se pueden separar. */}
          <span className="fc-banda" aria-hidden style={{ background: fondoPortada(c.portada, color) }} />
          {/* Los botones van ARRIBA, a la altura del botón de cerrar («"Ver en el CRM"
              debería estar alineado al botón de cerrar», 26/09/2026). Píldoras oscuras
              translúcidas y no del color de la casa: acá abajo puede haber una foto
              cualquiera, y un botón claro sobre una foto clara desaparece. */}
          <span className="fc-acciones">
            <button type="button" className="fc-pill" onClick={() => setEligiendoPortada(true)}>Cambiar portada</button>
            <Link href={`/crm/${c.leadId}`} className="fc-pill">Ver en el CRM →</Link>
          </span>
          <span className="fc-fila">
            <button type="button" className="fc-av" onClick={() => fileRef.current?.click()}
              title="Cambiar la foto" aria-label={`Cambiar la foto de ${nombre}`}>
              <Avatar nombre={nombre} tam={62} foto={c.avatarUrl} />
              <span className="fc-avcap">{subiendoFoto ? '…' : 'Foto'}</span>
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void subirFoto(f); e.target.value = ''; }} />
            <span className="fc-txt">
              <span className="nom">{nombre}</span>
              <span className="sub">
                {c.empresa?.trim() || `Cliente ${n}`}
                {c.empresa?.trim() ? <span className="id"> · Cliente {n}</span> : null}
              </span>
            </span>
            {/* Quitar la foto sólo existe cuando hay una: un botón que no hace nada se lee
                como que la app está rota. */}
            {c.avatarUrl && (
              <button type="button" className="fc-quitar" onClick={() => onImagen({ avatarUrl: null })}>Quitar la foto</button>
            )}
          </span>
        </span>
      }
      etiqueta={nombre}
      ancho={ANCHO}
      onCerrar={onCerrar}
    >
      {mal && <p className="fc-mal">{mal}</p>}

      {!trabajo ? (
        // «No pude leer» no se pinta como «no tiene trabajo»: son dos pantallas, y la
        // segunda sobre la primera es la mentira que nadie audita.
        <p className="fc-mal">No pude leer su tablero. Vuelve a entrar a Clientes.</p>
      ) : trabajo.dueno ? (
        <PlanBoard user={user} tareas={trabajo.tareas} proyectos={trabajo.proyectos}
          vacio={false} clientes={clientes} clienteFijo={clienteFijo} />
      ) : (
        <TodoBoard tareas={trabajo.tareas} categorias={trabajo.categorias} demo={false}
          user={user} clientes={clientes} clienteFijo={clienteFijo} />
      )}

      {/* El selector va ENCIMA de la ficha, y se puede: `anidada` le dice a la pila que no
          apague al de abajo (app/_components/pila-modales.ts). Sin eso, abrirlo haría
          desaparecer la ficha entera. */}
      {eligiendoPortada && (
        <PortadaPicker
          valor={c.portada}
          colorBase={color}
          titulo={`Portada de ${nombre}`}
          onElegir={(v) => { setEligiendoPortada(false); onImagen({ portada: v }); }}
          onCerrar={() => setEligiendoPortada(false)}
        />
      )}

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </Modal>
  );
}

/**
 * ⚠️ CASI TODA LA PANTALLA, y no los 600 de la casa. El Kanban tiene cuatro columnas: la
 * regla del ancho de `Modal` es para TEXTO —la medida de lectura— y acá adentro va el
 * tablero. `Modal` topea en el viewport, así que en una pantalla chica no desborda.
 */
const ANCHO = 1560;

const CSS = `
/* ⚠️ LA CABECERA DEL MODAL SE CONVIERTE EN LA PORTADA, y por eso se le saca el padding,
   el gap y el filete. Con el padding puesto, fc-cab sólo podía reclamar los 24 px de los
   costados con un margen negativo — y quedaban afuera el gap de 16 y los 32 del botón de
   cerrar, o sea los 48 px de la derecha que se reportaron como «el banner se corta a la
   derecha» (26/09/2026). Acertarle con un margen negativo mayor sería adivinar una suma
   que cambia el día que alguien toque ui.css; sacar el padding no tiene casos.
   (Y sin comillas invertidas acá adentro: esto vive en un template literal y una sola
   cerraría la hoja a la mitad — AGENTS.md lo tiene medido, deja la pantalla en blanco.) */
.mk-modal__cab:has(.fc-cab){ position:relative; padding:0; gap:0; border-bottom:0; align-items:stretch; }
.mk-modal__cab:has(.fc-cab) .mk-modal__tit{ gap:0; }
.mk-modal__h:has(.fc-cab){ align-self:stretch; }
/* El botón de cerrar sale del flujo y flota sobre la portada, que es lo que deja que la
   banda llegue a los dos bordes. Fondo propio: abajo puede haber una foto clara. */
.mk-modal__cab:has(.fc-cab) .mk-modal__x{ position:absolute; top:12px; right:12px; z-index:3;
  background:rgba(20,22,26,.42); color:#fff; border-radius:999px; }
.mk-modal__cab:has(.fc-cab) .mk-modal__x:hover{ background:rgba(20,22,26,.62); color:#fff; }

.fc-cab{ display:block; position:relative; }
/* Bien estirada («está muy angosto, debería ser más estirado»): 140 px sobre 1560 de
   ancho. Una foto de portada se lee como una banda, no como una tarjeta. */
.fc-banda{ display:block; height:140px; width:100%; }

.fc-acciones{ position:absolute; top:12px; right:52px; z-index:2; display:flex; gap:8px; }
.fc-pill{ background:rgba(20,22,26,.42); border:0; border-radius:999px; padding:6px 13px;
  font:inherit; font-size:12.5px; font-weight:500; color:#fff; cursor:pointer;
  text-decoration:none; white-space:nowrap; backdrop-filter:blur(3px); }
.fc-pill:hover{ background:rgba(20,22,26,.62); color:#fff; }

/* ⚠️ EL AVATAR MONTA SOBRE LA BANDA; EL NOMBRE, NO. Con un margin-top negativo en la
   fila entera sube TODO —avatar y texto—, y el nombre queda escrito sobre la foto: con un
   degradado claro se leía, con una foto de un bosque no. Va absoluto porque la cuenta es
   exacta (140 de banda − 31 de monte = 62/2) y no depende del alto del texto, que cambia
   con el nombre. El padding izquierdo de la fila le deja su lugar. */
.fc-fila{ display:flex; align-items:flex-end; gap:14px; padding:10px 24px 14px 100px; min-height:40px; }
.fc-av{ position:absolute; left:24px; top:109px; display:block; padding:0; border:0; background:none; cursor:pointer; line-height:0; }
.fc-avcap{ position:absolute; inset:auto 3px 3px 3px; border-radius:999px; background:rgba(20,22,26,.55);
  color:#fff; font-size:9.5px; line-height:1.6; text-align:center; opacity:0; transition:opacity .12s; }
.fc-av:hover .fc-avcap{ opacity:1; }
.fc-txt{ display:flex; flex-direction:column; gap:1px; min-width:0; flex:1; padding-bottom:4px; }
.fc-txt .nom{ font-size:20px; font-weight:670; letter-spacing:-.02em; line-height:1.2;
  color:var(--ink); overflow-wrap:anywhere; }
.fc-txt .sub{ font-size:12.5px; font-weight:400; color:var(--dim); overflow:hidden;
  text-overflow:ellipsis; white-space:nowrap; }
.fc-txt .id{ color:var(--faint); }
.fc-quitar{ flex:none; margin-bottom:5px; background:none; border:0; font:inherit; font-size:12px;
  color:var(--faint); cursor:pointer; }
.fc-quitar:hover{ color:var(--bad); }

.fc-mal{ margin:16px 2px; font-size:13.5px; color:var(--bad); }

@media(prefers-reduced-motion:reduce){ .fc-avcap{ transition:none; } }
`;
