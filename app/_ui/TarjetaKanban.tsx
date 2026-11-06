'use client';

// =============================================================================
// TarjetaKanban — UNA familia de tarjetas para CRM, Clients y Plan, en escritorio y teléfono (17/10/2026)
// =============================================================================
// Martín, 17/10/2026 22:40 (punto 8): «No me gustan las cards y cómo se ven... Quiero que tengan coherencia... si hacés
// esto del CRM también debe tener cierto sentido en diseño los otros kanban, como el PLAN y Clients». La fuente es el
// prototipo docs/prototipos/coherencia-1710.html (sus clases `.lc`, `.cc`, `.tc`, `.ptab`, `.feat`, `.sheet`): esto es
// su kit, una vez, para que el tablero del CRM, MaKo Mobile, Clients y el Plan dibujen LO MISMO. Lo puro (iniciales,
// color, insignia, plata) vive en lib/tarjeta-kanban.ts, con test.
//
//   · `TarjetaPersona` — un lead o un cliente: la cara (foto, o iniciales con la insignia del canal), el nombre, el
//     subtítulo y la píldora («Ver info»). Con `avance`, la barra de un cliente y su aviso en rojo.
//   · `TarjetaTarea` — una tarea del Plan: el CÍRCULO DE PRIORIDAD en el lugar de la foto (tocarlo la completa), el
//     proyecto y la fecha.
//   · `PestanasPildora`, `TarjetaDestacada` («Next up») y `FichaRapida` (lo que abre «Ver info», con «Mover a…»).
//
// ⚠️ LA RAÍZ RECIBE LAS PROPS DEL QUE LA USA (`draggable`, `onDragStart`, `data-*`, `onClick`…): el arrastre y el clic
//    derecho del tablero del CRM viven en la tarjeta, y se los pasa tal cual. La familia DIBUJA; no decide nada.
// ⚠️ LOS TOKENS DEL KIT VIVEN ACÁ (`--tk-*`), apoyados en los de la casa (`--card-bg`, `--primary`, `--good`…): la app no
//    tenía sombra de tarjeta ni los colores de sección del prototipo. En oscuro (`[data-tema="oscuro"]`) se redefinen.
// =============================================================================

import { forwardRef, useEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/app/_components/icons';
import { colorDeNombre, fotoQueNoCargo, inicialesDe, NOMBRE_PRIORIDAD, type ColorTarjeta, type InsigniaCanal, type PrioridadTarea } from '@/lib/tarjeta-kanban';

// ⚠️ LAS VARIABLES VAN EN TODA PIEZA DEL KIT, no en unas raíces. Hasta el 18/10 vivían en `.tk-raiz, .tk, .tk-ptabs,
// .tk-feat, .tk-sheet`, y una pieza usada SUELTA no las veía: el círculo del Plan (dentro de la tarjeta del Plan, que no
// es `.tk`) tenía `--pc` vacío y salía con borde BLANCO sobre la tarjeta blanca —invisible, en la computadora y en el
// teléfono—, y la cara del teléfono (dentro de `.m-kb-tj`) dibujaba las iniciales sin su círculo de color. Ningún test
// lo veía: el CSS era válido y el clic andaba. `:where(...)` no suma especificidad, así que el modo oscuro de abajo
// sigue ganando. Lo fija tests/tarjetas-familia.test.ts («toda pieza del kit lleva sus variables»).
export const CSS_TARJETAS = `
.tk, :where([class^="tk-"], [class*=" tk-"]) {
  --tk-card: var(--card-bg, var(--surface));
  --tk-line: rgba(46, 52, 64, .06);
  --tk-sombra: 0 1px 2px rgba(46, 52, 64, .06), 0 6px 20px rgba(46, 52, 64, .07);
  --tk-sub: var(--dim);
  --tk-velo: var(--velo-hover, rgba(46, 52, 64, .06));
  --tk-c-blue: #0B5EE5; --tk-c-blue-bg: #DDE8FB; --tk-c-green: #50683B; --tk-c-green-bg: #E1EBD8;
  --tk-c-purple: #7A4C73; --tk-c-purple-bg: #EBDFE9; --tk-c-teal: #2F6F73; --tk-c-teal-bg: #D6EAEB;
  --tk-c-grey: #4C566A; --tk-c-grey-bg: #DCE2EC;
  --tk-p1: #BF616A; --tk-p2: #C79226; --tk-p3: #0B5EE5; --tk-p4: #8E9BB4;
  --tk-feat: linear-gradient(135deg, #0B5EE5 0%, #2F7BF2 100%); --tk-feat-pill-ink: #0A3F9E;
}
[data-tema="oscuro"] .tk, [data-tema="oscuro"] :where([class^="tk-"], [class*=" tk-"]) {
  --tk-line: rgba(255, 255, 255, .05);
  --tk-sombra: 0 1px 2px rgba(0, 0, 0, .25), 0 8px 22px rgba(0, 0, 0, .25);
  --tk-c-blue: #8AB4FA; --tk-c-blue-bg: #33405A; --tk-c-green: #A3BE8C; --tk-c-green-bg: #3E4A36;
  --tk-c-purple: #D7A9CF; --tk-c-purple-bg: #4A3E4A; --tk-c-teal: #8FBCBB; --tk-c-teal-bg: #34494C;
  --tk-c-grey: #ABB9CF; --tk-c-grey-bg: #434C5E;
  --tk-p1: #E699A6; --tk-p2: #EBCB8B; --tk-p3: #8AB4FA; --tk-p4: #8E9BB4;
  --tk-feat: linear-gradient(135deg, #2D4F8F 0%, #3A63AE 100%); --tk-feat-pill-ink: #1D3F7D;
}
.tk-c-blue { background: var(--tk-c-blue-bg); color: var(--tk-c-blue); } .tk-c-green { background: var(--tk-c-green-bg); color: var(--tk-c-green); }
.tk-c-purple { background: var(--tk-c-purple-bg); color: var(--tk-c-purple); } .tk-c-teal { background: var(--tk-c-teal-bg); color: var(--tk-c-teal); }
.tk-c-grey { background: var(--tk-c-grey-bg); color: var(--tk-c-grey); }

/* La tarjeta: grande, redonda, sombra suave sin borde marcado (22 px de radio, como el prototipo). */
.tk { position: relative; background: var(--tk-card); border-radius: 14px; padding: 12px 12px 10px; box-shadow: var(--tk-sombra); border: 1px solid var(--tk-line); display: grid; gap: 8px; min-width: 0; transition: box-shadow .15s, transform .15s, opacity .15s; }
.tk[draggable="true"] { cursor: grab; }
.tk.tk--clic { cursor: pointer; }
.tk.tk--clic:hover { box-shadow: 0 2px 4px rgba(46, 52, 64, .08), 0 10px 26px rgba(46, 52, 64, .10); }
.tk.tk--marcada { box-shadow: 0 0 0 2px var(--primary), var(--tk-sombra); }
.tk.tk--compacta { padding: 8px 10px; gap: 6px; border-radius: 14px; }
.tk--compacta .tk-fila { --tk-gap: 9px; }
.tk--compacta .tk-nom { font-size: 14px; }
.tk--compacta .tk-pill { height: 26px; padding: 0 10px; font-size: 12px; }
.tk.tk--alerta { box-shadow: inset 3px 0 0 var(--bad), var(--tk-sombra); }
.tk-fila { display: flex; align-items: center; --tk-gap: 12px; gap: var(--tk-gap); min-width: 0; }
.tk-tx { flex: 1; min-width: 0; }
.tk-nom { display: flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 700; letter-spacing: -.01em; color: var(--ink); line-height: 1.25; min-width: 0; }
/* El nombre baja a DOS renglones antes de cortarse (C2 del recorrido del 30/10/2026: en un lead sin nombre, el nombre es el
   teléfono, y con «Ver info» al lado no entraba ni a 1536 px). Lo entero va en el title. */
.tk-nom > span { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; min-width: 0; }
.tk-sub { display: block; font-size: 12.5px; color: var(--tk-sub); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
.tk-punto { width: 8px; height: 8px; border-radius: 50%; background: var(--primary); flex: none; }
.tk-chips { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; }
.tk-chips:empty { display: none; }

/* La cara: foto o iniciales en círculo, con la insignia del canal abajo a la derecha. */
.tk-cara { position: relative; display: inline-block; flex: none; }
.tk-cara > img, .tk-cara > .tk-ini { display: grid; place-items: center; width: 100%; height: 100%; border-radius: 50%; overflow: hidden; object-fit: cover; font-weight: 700; letter-spacing: -.01em; }
.tk-insignia { position: absolute; right: -3px; bottom: -3px; border-radius: 50%; border: 2px solid var(--tk-card); display: grid; place-items: center; }

/* Las píldoras: 99 de radio, la suave para «Ver info». */
.tk-pill { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 30px; padding: 0 12px; border-radius: 99px; font: inherit; font-size: 12.5px; font-weight: 650; white-space: nowrap; flex: none; border: 0; cursor: pointer; text-decoration: none; }
.tk-pill--grande { height: 36px; padding: 0 16px; font-size: 13px; }
.tk-pill--suave { background: var(--primary-bg); color: var(--primary-strong); }
.tk-pill--llena { background: var(--primary); color: var(--on-primary); }
.tk-pill--linea { background: transparent; border: 1.5px solid var(--border-strong); color: var(--ink); }
.tk-pill:hover { filter: brightness(.96); }

/* LAS FORMAS DE LAS PLANTILLAS (21/10/2026, lib/plantillas-tarjeta.ts): el dato GRANDE y la portada. */
.tk-dest { display: grid; gap: 1px; min-width: 0; }
.tk-dest-rot { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 650; color: var(--tk-sub); text-transform: uppercase; letter-spacing: .04em; }
.tk-dest-val { font-size: 21px; font-weight: 750; letter-spacing: -.02em; line-height: 1.15; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
.tk-dest--bien .tk-dest-val { color: var(--good); }
.tk.tk--portada { padding-top: 0; overflow: hidden; }
.tk-portada { height: 40px; margin: 0 -12px; }
.tk-portada-cara { margin-top: -30px; line-height: 0; }
.tk-portada-cara .tk-cara { border-radius: 50%; box-shadow: 0 0 0 3px var(--tk-card); }

/* La barra de avance de un cliente, y su aviso. */
.tk-medidor { display: flex; align-items: center; gap: 10px; font-size: 12px; color: var(--tk-sub); min-width: 0; }
.tk-barra { flex: 1; min-width: 40px; height: 7px; border-radius: 99px; background: var(--surface-2); overflow: hidden; }
.tk-barra > i { display: block; height: 100%; border-radius: 99px; background: var(--primary); }
.tk-medidor > span { white-space: nowrap; }
.tk-chip { display: inline-block; white-space: nowrap; font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 99px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.tk-chip--mal { background: var(--bad-bg); color: var(--bad); } .tk-chip--riesgo { background: var(--warn-bg); color: var(--warn); }
.tk-chip--bien { background: var(--good-bg); color: var(--good); } .tk-chip--gris { background: var(--surface-2); color: var(--dim); }
.tk-chip--mako { background: var(--mako-bg); color: var(--mako-ink); }

/* La tarea: el círculo de prioridad ocupa el lugar de la foto. */
.tk--tarea { display: flex; align-items: flex-start; gap: 11px; padding: 13px 13px 12px; }
.tk-pr { width: 24px; height: 24px; border-radius: 50%; border: 2.5px solid var(--pc); background: color-mix(in srgb, var(--pc) 14%, transparent); flex: none; display: grid; place-items: center; margin-top: 1px; color: #fff; cursor: pointer; padding: 0; }
.tk-pr:hover { background: color-mix(in srgb, var(--pc) 34%, transparent); }
.tk-pr--1 { --pc: var(--tk-p1); } .tk-pr--2 { --pc: var(--tk-p2); } .tk-pr--3 { --pc: var(--tk-p3); } .tk-pr--4 { --pc: var(--tk-p4); } .tk-pr--0 { --pc: var(--tk-p4); border-style: dashed; }
.tk--hecha .tk-pr { background: var(--good); border-color: var(--good); }
.tk-tit { display: block; font-size: 14.5px; line-height: 1.3; letter-spacing: -.005em; font-weight: 650; color: var(--ink); overflow-wrap: anywhere; }
.tk--hecha .tk-tit { text-decoration: line-through; color: var(--faint); font-weight: 560; }
.tk-meta { display: flex; align-items: center; gap: 6px 8px; flex-wrap: wrap; margin-top: 7px; }
.tk-proy { font-size: 11.5px; font-weight: 650; padding: 2px 9px; border-radius: 99px; background: var(--tk-c-grey-bg); color: var(--tk-c-grey); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tk-fecha { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--tk-sub); font-weight: 560; white-space: nowrap; }
.tk-fecha--hoy { color: var(--primary-strong); font-weight: 700; } .tk-fecha--vencida { color: var(--bad); font-weight: 700; }
.tk-porque { font-size: 11.5px; color: var(--tk-sub); font-style: italic; }

/* Las pestañas píldora (vistas, etapas con su contador). */
.tk-ptabs { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding: 3px 2px 5px; min-width: 0; }
.tk-ptabs::-webkit-scrollbar { display: none; }
.tk-ptab { display: inline-flex; align-items: center; gap: 7px; height: 36px; padding: 0 15px; border-radius: 99px; background: var(--tk-card); box-shadow: var(--tk-sombra); font: inherit; font-size: 13.5px; font-weight: 650; color: var(--dim); white-space: nowrap; flex: none; border: 0; cursor: pointer; }
.tk-ptab i { font-style: normal; font-size: 11.5px; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px; display: grid; place-items: center; background: var(--tk-velo); }
.tk-ptab[aria-selected="true"] { background: var(--primary); color: var(--on-primary); }
.tk-ptab[aria-selected="true"] i { background: rgba(255, 255, 255, .25); }
.tk-ptab:not([aria-selected="true"]):hover { color: var(--ink); }

/* La destacada: azul porque azul = «vos actuás». */
.tk-feat { background: var(--tk-feat); color: #fff; border-radius: 26px; padding: 18px; box-shadow: var(--tk-sombra); position: relative; overflow: hidden; display: grid; gap: 4px; }
.tk-feat-sobre { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; opacity: .85; }
.tk-feat-quien { display: flex; align-items: center; gap: 12px; min-width: 0; }
.tk-feat h3 { margin: 2px 0 0; font-size: 19px; letter-spacing: -.015em; font-weight: 700; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tk-feat-baj { font-size: 13px; opacity: .9; }
.tk-feat-prog { height: 8px; border-radius: 99px; background: rgba(255, 255, 255, .3); overflow: hidden; margin: 12px 0 4px; }
.tk-feat-prog > i { display: block; height: 100%; background: #fff; border-radius: 99px; }
.tk-feat-pl { font-size: 12px; opacity: .9; display: flex; justify-content: space-between; gap: 8px; }
.tk-feat-acc { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.tk-feat-acc .tk-pill { flex: 1; }
.tk-pill--blanca { background: #fff; color: var(--tk-feat-pill-ink); }
.tk-pill--borde { background: transparent; border: 1.5px solid rgba(255, 255, 255, .6); color: #fff; }
.tk-feat--ancha { display: flex; align-items: center; gap: 22px; padding: 16px 20px; }
.tk-feat--ancha .tk-feat-1 { flex: 1.2; min-width: 0; } .tk-feat--ancha .tk-feat-2 { flex: 1; min-width: 0; }
.tk-feat--ancha .tk-feat-acc { margin: 0; flex: none; }
.tk-feat--ancha .tk-feat-prog { margin: 8px 0 4px; }
@media (max-width: 900px) { .tk-feat--ancha { display: grid; gap: 10px; } .tk-feat--ancha .tk-feat-acc { margin-top: 4px; } }

/* La ficha rápida: hoja desde abajo en el teléfono, caja al centro en la computadora. */
.tk-velo { position: fixed; inset: 0; background: rgba(46, 52, 64, .45); z-index: 1200; display: flex; align-items: flex-end; justify-content: center; }
@media (min-width: 721px) { .tk-velo { align-items: center; } }
.tk-sheet { width: 100%; max-width: 460px; background: var(--tk-card); color: var(--ink); border-radius: 28px 28px 0 0; padding: 10px 18px calc(22px + env(safe-area-inset-bottom)); box-shadow: 0 18px 44px rgba(46, 52, 64, .22); max-height: 88dvh; overflow: auto; }
@media (min-width: 721px) { .tk-sheet { border-radius: 28px; padding: 22px; } }
.tk-agarre { width: 38px; height: 4px; border-radius: 2px; background: var(--border-strong); margin: 0 auto 12px; }
@media (min-width: 721px) { .tk-agarre { display: none; } }
.tk-scab { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; min-width: 0; }
.tk-scab h3 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -.015em; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tk-scab small { color: var(--tk-sub); font-size: 13px; display: block; }
.tk-x { margin-left: auto; width: 40px; height: 40px; border-radius: 50%; background: var(--tk-card); box-shadow: var(--tk-sombra); display: grid; place-items: center; color: var(--ink); flex: none; border: 0; cursor: pointer; }
.tk-dl { display: grid; background: var(--surface-2); border-radius: 18px; padding: 2px 14px; margin: 14px 0; }
.tk-dl > div { display: flex; justify-content: space-between; gap: 10px; padding: 10px 0; font-size: 13.5px; border-top: 1px solid var(--border); }
.tk-dl > div:first-child { border-top: 0; } .tk-dl span { color: var(--tk-sub); } .tk-dl b { font-weight: 600; text-align: right; overflow-wrap: anywhere; }
.tk-acts { display: flex; gap: 8px; flex-wrap: wrap; } .tk-acts .tk-pill { flex: 1; }
.tk-acts + .tk-acts { margin-top: 8px; }
.tk-lista { background: var(--tk-card); border-radius: 22px; box-shadow: var(--tk-sombra); border: 1px solid var(--tk-line); overflow: hidden; }
.tk-lista > button { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 52px; padding: 10px 14px; font: inherit; font-size: 15px; font-weight: 560; background: none; border: 0; cursor: pointer; color: var(--ink); text-align: left; }
.tk-lista > button + button { border-top: 1px solid var(--border); }
.tk-lista > button:hover { background: var(--tk-velo); }
.tk-lista > button[aria-current="true"] { color: var(--primary); }
.tk-lista > button > span:first-child { flex: 1; min-width: 0; }
.tk-tip { font-size: 13px; color: var(--dim); margin: 6px 2px 0; }
`;

/** El CSS de la familia, una vez por documento (React deduplica por `href`). */
/**
 * ⚠️ CADA COMPONENTE DEL KIT LO MONTA ÉL MISMO (18/10/2026). Hasta acá lo montaba el TABLERO que usaba el kit, y Clients
 * de la computadora no lo montó: en producción, para todos los negocios, la tarjeta salió sin estilos (la foto a todo el
 * ancho y el nombre, «Ver info» y «Acciones» como texto suelto). React deduplica un `<style href precedence>`, así que
 * cien tarjetas lo montan una vez. Lo fija tests/tarjetas-familia.test.ts.
 */
export function EstiloTarjetas() {
  return <style href="mk-tarjetas-kanban" precedence="medium">{CSS_TARJETAS}</style>;
}

// ── La cara ───────────────────────────────────────────────────────────────────

/**
 * Foto o iniciales en círculo, con la insignia del canal. La foto es la de perfil de WhatsApp o Instagram cuando
 * exista (decidido el 17/10); si no, las iniciales con el color estable del nombre. Una foto que no carga cae a las
 * iniciales: la URL del CDN de Meta vence.
 */
export function CaraTarjeta({ nombre, foto, insignia, tam = 46, color }: {
  nombre: string;
  foto?: string | null;
  insignia?: InsigniaCanal | null;
  tam?: number;
  /** El color de las iniciales; sin él, el del nombre. */
  color?: ColorTarjeta;
}) {
  const c = color ?? colorDeNombre(nombre);
  const ins = Math.max(17, Math.round(tam * 0.38));
  // La foto que no cargó, por estado y no tocando el DOM: así sobrevive a un re-render (C1 del recorrido del 30/10).
  // Se guarda CUÁL foto falló: si cambia la foto, se vuelve a intentar.
  const [fallo, setFallo] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  // Una foto que falló antes de hidratar ya no avisa: se pregunta al montar (`fotoQueNoCargo`, lib/tarjeta-kanban.ts).
  useEffect(() => { if (foto && fotoQueNoCargo(imgRef.current)) setFallo(foto); }, [foto]);
  const conFoto = !!foto && fallo !== foto;
  return (
    <span className="tk-cara" style={{ width: tam, height: tam }}>
      <EstiloTarjetas />
      {conFoto
        // eslint-disable-next-line @next/next/no-img-element
        ? <img ref={imgRef} src={foto} alt="" referrerPolicy="no-referrer" onError={() => setFallo(foto ?? null)} />
        : null}
      <span className={`tk-ini tk-c-${c}`} aria-hidden style={{ fontSize: Math.round(tam * 0.36), ...(conFoto ? { display: 'none' } : {}) }}>{inicialesDe(nombre)}</span>
      {insignia && (
        <span className={`tk-insignia tk-c-${insignia.color}`} title={insignia.nombre} style={{ width: ins, height: ins }}>
          <Icon name={insignia.icono} size={Math.max(9, Math.round(ins * 0.55))} />
        </span>
      )}
    </span>
  );
}

// ── La tarjeta de una persona (un lead, un cliente) ───────────────────────────

export type PildoraTarjeta = { texto: string; onClick: (e: MouseEvent<HTMLButtonElement>) => void; titulo?: string };
export type AvanceTarjeta = { pct: number; texto?: string; aviso?: { texto: string; tono: 'mal' | 'riesgo' } | null };

type PropsPersona = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  nombre: string;
  foto?: string | null;
  insignia?: InsigniaCanal | null;
  subtitulo?: string;
  /** Lo que va antes del nombre (la casilla de selección del tablero). */
  antes?: ReactNode;
  /** Necesita respuesta: el punto azul al lado del nombre. */
  sinLeer?: boolean;
  /** «Ver info». */
  pildora?: PildoraTarjeta | null;
  /** La barra de un cliente, con su aviso. */
  avance?: AvanceTarjeta | null;
  /** Chips debajo (vencida, datos pendientes, fuera del funnel). */
  chips?: ReactNode;
  /** Controles al final del renglón de chips (el menú «Acciones» de un cliente). */
  acciones?: ReactNode;
  marcada?: boolean;
  /** Un borde rojo a la izquierda (algo venció). */
  alerta?: boolean;
  draggable?: boolean;
  titulo?: string;
  /** Sin la foto ni las iniciales (quien personalizó la tarjeta del CRM y la sacó, 20/10/2026). */
  sinCara?: boolean;
  /** El diseño «Compacta» (20/10/2026): la cara chica y menos aire, para ver más tarjetas por columna. */
  compacta?: boolean;
  /**
   * Un dato GRANDE debajo del nombre (21/10/2026, las plantillas «Monto grande» y «Próxima reunión»): el rótulo chico
   * arriba y el valor en 21 px. `tono: 'bien'` lo pinta verde (lo vendido).
   */
  destacado?: { texto: string; rotulo: string; icono?: 'calendario' | 'sales'; tono?: 'bien' } | null;
  /** Una banda de color arriba con la cara montada (21/10/2026, la plantilla «Con portada», como la tarjeta de /admin). */
  portada?: ColorTarjeta | null;
};

export const TarjetaPersona = forwardRef<HTMLElement, PropsPersona>(function TarjetaPersona(
  { nombre, foto, insignia, subtitulo, antes, sinLeer, pildora, avance, chips, acciones, marcada, alerta, className, titulo, onClick, sinCara, compacta, destacado, portada, ...resto }, ref,
) {
  const clases = ['tk', compacta ? 'tk--compacta' : '', portada ? 'tk--portada' : '', onClick ? 'tk--clic' : '', marcada ? 'tk--marcada' : '', alerta ? 'tk--alerta' : '', className ?? ''].filter(Boolean).join(' ');
  const pct = avance ? Math.max(0, Math.min(100, Math.round(avance.pct))) : 0;
  // Con portada, la cara va montada sobre la banda, en su propio renglón; el nombre, debajo.
  const cara = sinCara ? null : <CaraTarjeta nombre={nombre} foto={foto} insignia={insignia} tam={compacta ? 34 : portada ? 50 : undefined} />;
  return (
    <article ref={ref} className={clases} onClick={onClick} title={titulo} {...resto}>
      <EstiloTarjetas />
      {portada ? <div className={`tk-portada tk-c-${portada}`} aria-hidden /> : null}
      {portada && cara ? <div className="tk-portada-cara">{cara}</div> : null}
      <div className="tk-fila">
        {antes}
        {portada ? null : cara}
        <div className="tk-tx">
          <div className="tk-nom"><span title={nombre || undefined}>{nombre || 'Sin nombre'}</span>{sinLeer && <i className="tk-punto" title="Espera respuesta" />}</div>
          {subtitulo ? <span className="tk-sub" title={subtitulo}>{subtitulo}</span> : null}
        </div>
        {pildora && (
          <button type="button" className="tk-pill tk-pill--suave" title={pildora.titulo}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); pildora.onClick(e); }}>{pildora.texto}</button>
        )}
      </div>
      {destacado && (
        <div className={`tk-dest${destacado.tono ? ` tk-dest--${destacado.tono}` : ''}`}>
          <span className="tk-dest-rot">{destacado.icono ? <Icon name={destacado.icono} size={12} /> : null}{destacado.rotulo}</span>
          <span className="tk-dest-val" title={destacado.texto}>{destacado.texto}</span>
        </div>
      )}
      {avance && (
        <div className="tk-medidor">
          <div className="tk-barra" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
          {avance.aviso
            ? <span className={`tk-chip tk-chip--${avance.aviso.tono}`}>{avance.aviso.texto}</span>
            : avance.texto ? <span>{avance.texto}</span> : null}
        </div>
      )}
      {chips || acciones ? <div className="tk-chips">{chips}{acciones ? <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}>{acciones}</span> : null}</div> : null}
    </article>
  );
});

// ── La tarjeta de una tarea ───────────────────────────────────────────────────

type PropsTarea = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  titulo: string;
  prioridad: PrioridadTarea;
  hecha?: boolean;
  /** Tocar el círculo la completa (o la reabre si estaba hecha). Sin esto, el círculo es sólo la prioridad. */
  onCompletar?: () => void;
  proyecto?: string | null;
  fecha?: string | null;
  fechaTono?: 'hoy' | 'vencida' | null;
  /** La creó MaKo: la etiqueta naranja. */
  mako?: boolean;
  porque?: string | null;
  /** A quién le toca, chico a la derecha. */
  persona?: { nombre: string; foto?: string | null } | null;
  /** Lo que va al final de la línea de abajo (chips del tablero). */
  extra?: ReactNode;
  marcada?: boolean;
  draggable?: boolean;
};

export const TarjetaTarea = forwardRef<HTMLElement, PropsTarea>(function TarjetaTarea(
  { titulo, prioridad, hecha, onCompletar, proyecto, fecha, fechaTono, mako, porque, persona, extra, marcada, className, onClick, ...resto }, ref,
) {
  const nombrePr = NOMBRE_PRIORIDAD[prioridad] ?? 'Sin prioridad';
  const clases = ['tk', 'tk--tarea', hecha ? 'tk--hecha' : '', onClick ? 'tk--clic' : '', marcada ? 'tk--marcada' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <article ref={ref} className={clases} onClick={onClick} {...resto}>
      <EstiloTarjetas />
      <button type="button" className={`tk-pr tk-pr--${prioridad}`}
        aria-label={hecha ? `${nombrePr} · hecha — reabrir` : `${nombrePr} — marcar hecha`}
        title={onCompletar ? (hecha ? `${nombrePr} · tócalo para reabrirla` : `${nombrePr} · tócalo para completarla`) : nombrePr}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onCompletar?.(); }}
        disabled={!onCompletar}
        style={onCompletar ? undefined : { cursor: 'default' }}>
        {hecha ? <Icon name="check" size={13} /> : null}
      </button>
      <div className="tk-tx">
        <span className="tk-tit">{titulo}</span>
        <div className="tk-meta">
          {proyecto ? <span className="tk-proy" title={proyecto}>{proyecto}</span> : null}
          {fecha ? <span className={`tk-fecha${fechaTono ? ` tk-fecha--${fechaTono}` : ''}`}><Icon name="calendario" size={12} />{fecha}</span> : null}
          {mako ? <span className="tk-chip tk-chip--mako">MaKo</span> : null}
          {porque ? <span className="tk-porque">{porque}</span> : null}
          {extra}
        </div>
      </div>
      {persona ? <CaraTarjeta nombre={persona.nombre} foto={persona.foto} tam={28} /> : null}
    </article>
  );
});

// ── Pestañas píldora ──────────────────────────────────────────────────────────

export type PestanaPildora = { id: string; label: string; n?: number | null; titulo?: string };

export function PestanasPildora({ items, activo, onCambiar, ariaLabel, style }: {
  items: readonly PestanaPildora[];
  activo: string;
  onCambiar: (id: string) => void;
  ariaLabel: string;
  style?: CSSProperties;
}) {
  return (
    <div className="tk-ptabs" role="tablist" aria-label={ariaLabel} style={style}>
      <EstiloTarjetas />
      {items.map((t) => (
        <button key={t.id} type="button" role="tab" className="tk-ptab" aria-selected={t.id === activo} title={t.titulo}
          onClick={() => onCambiar(t.id)}>
          {t.label}{t.n != null ? <i>{t.n}</i> : null}
        </button>
      ))}
    </div>
  );
}

// ── La destacada («Next up») ──────────────────────────────────────────────────

export type AccionDestacada = { texto: string; onClick?: () => void; href?: string; primaria?: boolean; externo?: boolean };

export function TarjetaDestacada({ sobre, titulo, bajada, cara, avance, acciones, ancha }: {
  sobre: string;
  titulo: string;
  bajada?: string;
  cara?: { nombre: string; foto?: string | null } | null;
  avance?: { pct: number; izq: string; der?: string } | null;
  acciones?: readonly AccionDestacada[];
  /** Escritorio: en una sola fila. */
  ancha?: boolean;
}) {
  const quien = (
    <>
      <div className="tk-feat-sobre">{sobre}</div>
      <div className="tk-feat-quien" style={{ marginTop: 4 }}>
        {cara ? <CaraTarjeta nombre={cara.nombre} foto={cara.foto} tam={44} /> : null}
        <div style={{ minWidth: 0 }}>
          <h3>{titulo}</h3>
          {bajada ? <div className="tk-feat-baj">{bajada}</div> : null}
        </div>
      </div>
    </>
  );
  const prog = avance ? (
    <>
      <div className="tk-feat-prog"><i style={{ width: `${Math.max(0, Math.min(100, avance.pct))}%` }} /></div>
      <div className="tk-feat-pl"><span>{avance.izq}</span>{avance.der ? <span>{avance.der}</span> : null}</div>
    </>
  ) : null;
  const botones = acciones?.length ? (
    <div className="tk-feat-acc">
      {acciones.map((a) => {
        const cls = `tk-pill tk-pill--grande ${a.primaria ? 'tk-pill--blanca' : 'tk-pill--borde'}`;
        return a.href
          ? <a key={a.texto} className={cls} href={a.href} {...(a.externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{a.texto}</a>
          : <button key={a.texto} type="button" className={cls} onClick={a.onClick}>{a.texto}</button>;
      })}
    </div>
  ) : null;
  if (ancha) {
    return (
      <section className="tk-feat tk-feat--ancha" aria-label={sobre}>
        <EstiloTarjetas />
        <div className="tk-feat-1">{quien}</div>
        {prog ? <div className="tk-feat-2">{prog}</div> : null}
        {botones}
      </section>
    );
  }
  return <section className="tk-feat" aria-label={sobre}><EstiloTarjetas />{quien}{prog}{botones}</section>;
}

// ── La ficha rápida («Ver info») ──────────────────────────────────────────────

export type FilaFicha = { k: string; v: ReactNode };
export type DestinoMover = { id: string; label: string; aqui?: boolean };

/**
 * El CUERPO de la ficha rápida: la cara, el nombre, el avance, unos datos y las acciones, con el botón «Mover a…».
 * Sin caja: en la computadora lo envuelve `FichaRapida` (por portal) y en el teléfono el `SheetM` de siempre (con su
 * historial y sus gestos), así las dos dicen lo mismo.
 */
export function CuerpoFichaRapida({ nombre, foto, insignia, subtitulo, avance, filas, acciones, onMoverA, cerrar }: {
  nombre: string;
  foto?: string | null;
  insignia?: InsigniaCanal | null;
  subtitulo?: string;
  avance?: { pct: number; texto: string } | null;
  filas?: readonly FilaFicha[];
  acciones?: readonly AccionDestacada[];
  /** «Mover a…»: sin esto, el botón no aparece. */
  onMoverA?: (() => void) | null;
  /** La cruz (la computadora); el teléfono cierra con su sheet. */
  cerrar?: ReactNode;
}) {
  return (
    <>
      <EstiloTarjetas />
      <div className="tk-scab">
        <CaraTarjeta nombre={nombre} foto={foto} insignia={insignia} tam={60} />
        <div style={{ minWidth: 0 }}><h3>{nombre || 'Sin nombre'}</h3>{subtitulo ? <small>{subtitulo}</small> : null}</div>
        {cerrar}
      </div>
      {avance ? (
        <>
          <div className="tk-barra" style={{ flex: 'none' }}><i style={{ width: `${Math.max(0, Math.min(100, avance.pct))}%` }} /></div>
          <p className="tk-tip">{avance.texto}</p>
        </>
      ) : null}
      {filas?.length ? <div className="tk-dl">{filas.map((f) => <div key={f.k}><span>{f.k}</span><b>{f.v}</b></div>)}</div> : null}
      {acciones?.length ? (
        <div className="tk-acts">
          {acciones.map((a) => {
            const cls = `tk-pill tk-pill--grande ${a.primaria ? 'tk-pill--llena' : 'tk-pill--linea'}`;
            return a.href
              ? <a key={a.texto} className={cls} href={a.href} {...(a.externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{a.texto}</a>
              : <button key={a.texto} type="button" className={cls} onClick={a.onClick}>{a.texto}</button>;
          })}
        </div>
      ) : null}
      {onMoverA ? (
        <div className="tk-acts"><button type="button" className="tk-pill tk-pill--grande tk-pill--suave" onClick={onMoverA}>Mover a…</button></div>
      ) : null}
    </>
  );
}

/**
 * Lo que abre «Ver info» en la computadora: el cuerpo de arriba en una caja al centro, y «Mover a…» con la lista de
 * etapas. Va por PORTAL al body (desde una tarjeta, un modal adentro de un contexto de apilamiento queda atrapado).
 * Escape y el velo la cierran. La ficha COMPLETA no cambia: «Abrir ficha» lleva a ella.
 */
export function FichaRapida({ nombre, foto, insignia, subtitulo, avance, filas, acciones, mover, onMover, onCerrar, moviendo, onMoviendo }: {
  nombre: string;
  foto?: string | null;
  insignia?: InsigniaCanal | null;
  subtitulo?: string;
  avance?: { pct: number; texto: string } | null;
  filas?: readonly FilaFicha[];
  acciones?: readonly AccionDestacada[];
  /** Los destinos de «Mover a…» (las etapas). Sin ellos, el botón no aparece. */
  mover?: readonly DestinoMover[];
  onMover?: (id: string) => void;
  onCerrar: () => void;
  /** «Mover a…» abierto: lo maneja quien la monta (así un movimiento que abre el wizard puede cerrar esto). */
  moviendo: boolean;
  onMoviendo: (v: boolean) => void;
}) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onCerrar(); } };
    window.addEventListener('keydown', tecla, true);
    return () => window.removeEventListener('keydown', tecla, true);
  }, [onCerrar]);
  if (typeof document === 'undefined') return null;
  const x = (
    <button type="button" className="tk-x" onClick={onCerrar} aria-label="Cerrar"><Icon name="x" size={18} /></button>
  );
  const cuerpo = moviendo && mover ? (
    <>
      <div className="tk-scab"><div style={{ minWidth: 0 }}><h3>Mover a…</h3><small>{nombre}</small></div>{x}</div>
      <div className="tk-lista">
        {mover.map((d) => (
          <button key={d.id} type="button" aria-current={d.aqui ? 'true' : undefined} disabled={d.aqui}
            onClick={() => onMover?.(d.id)}>
            <span>{d.label}</span>{d.aqui ? <span style={{ fontSize: 13, fontWeight: 650 }}>Aquí</span> : null}
          </button>
        ))}
      </div>
      <p className="tk-tip"><button type="button" className="tk-pill tk-pill--linea" onClick={() => onMoviendo(false)}>Volver</button></p>
    </>
  ) : (
    <CuerpoFichaRapida nombre={nombre} foto={foto} insignia={insignia} subtitulo={subtitulo} avance={avance} filas={filas}
      acciones={acciones} onMoverA={mover?.length ? () => onMoviendo(true) : null} cerrar={x} />
  );
  return createPortal(
    <div className="tk-velo" onClick={onCerrar} role="presentation">
      <EstiloTarjetas />
      <div className="tk-sheet" role="dialog" aria-modal="true" aria-label={moviendo ? `Mover a ${nombre}` : nombre} onClick={(e) => e.stopPropagation()}>
        <div className="tk-agarre" />
        {cuerpo}
      </div>
    </div>,
    document.body,
  );
}
