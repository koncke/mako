'use client';

// =============================================================================
// comun — lo que comparten los bloques de General: la cabecera, el placeholder y el estilo
// =============================================================================
// Martín, 14/10/2026: «Diseña nuevamente todos los "Bloque general", la mayoría son solamente texto... Si no hay datos
// aún, se debería ver el placeholder siempre». El placeholder es EL MISMO BLOQUE dibujado con datos de ejemplo
// (./muestras.ts), apagado, con una frase y la acción que lo llena encima: quien lo ve entiende qué va a aparecer ahí y
// cómo conseguirlo. Un texto suelto («Todavía no hay objetivos») no dice ninguna de las dos cosas.
//
// La tercera vuelta (14/10/2026, Martín: «Veo que muchos bloques los copiaste de otros lados, como el de Prioridades,
// pero no están interactuando con el diseño de la página, revisalo»). Un bloque de General es una TARJETA DE LA HOJA,
// igual que un gráfico: el marco (fondo, borde, radio, sombra y aire) es el del tema de la hoja (`.lk-comp--general`,
// app/dashboard/editor-css.ts), el título usa las variables del título de un gráfico (`--dash-titulo-*`) y la letra la
// de la hoja (`--dash-letra`). Adentro NO va una tarjeta dentro de la tarjeta: lo que se agrupa (un OKR, una llamada,
// una métrica del mes) es una LOSA (`gb-losa`: un tinte del color del texto sobre el fondo de la tarjeta, sin borde),
// que se da vuelta sola con el fondo oscuro. Y las tarjetas que vienen del Plan heredan los colores de la hoja
// (`gb-plan`: su `--surface` pasa a ser la losa sobre el fondo de la hoja, y sin borde).
//
// La quinta vuelta, bloque por bloque y con capturas (14/10/2026, Martín: «Rediseña bloque por bloque, sacale una captura
// o algo y date feedback a vos mismo... el bloque del semáforo tiene un espacio en blanco grande e innecesario»):
//   · UNA LISTA MUESTRA SÓLO FILAS ENTERAS (`gb-cabe`): en una tarjeta de alto fijo, la fila que no entra no se dibuja
//     cortada a la mitad (se leía como un bloque roto). Es una columna flex que envuelve: lo que no entra pasa a una
//     segunda columna, que queda afuera. En la pila del celular el bloque mide lo que dibuja y se ve la lista entera.
//   · LO QUE NO LLENA EL ALTO VA CENTRADO (`gb-centro`), no pegado arriba con un hueco abajo.
//   · LO QUE SE REPITE EN LA FILA LLENA EL ANCHO (`auto-fit`, no `auto-fill`): con `auto-fill` tres OKRs en una hoja
//     entera dejaban un tercio vacío a la derecha.
// La séptima vuelta, ÉPICA (14/10/2026, Martín: «Lo mismo que hicimos en mobile, que sea EPICO la vista General...
// pocas cosas, textos gigantes, bloques grandes»). La escala es la del teléfono que aprobó (docs/prototipos/
// mako-mobile-tableros.html), escrita para que ESCRITORIO crezca y el teléfono quede igual — el teléfono dibuja ESTOS
// bloques (app/m/hoy/GeneralM.tsx), así que cada tamaño va contra la tarjeta (cqi, `.gen-pieza` es el contenedor):
//   · UN PROTAGONISTA por bloque (`gb-p`): 40 px en el teléfono (~326 px de contenido), ~80 en media hoja, 128 a lo
//     ancho. Es una recta (22cqi − 32px) y no un % fijo: con 12cqi el teléfono daba 40 pero media hoja sólo 61.
//   · LO SECUNDARIO que también es un número (`gb-s`: las baldosas del mes, un monto): ~2/3 del protagonista.
//   · UNA FRASE que manda (`gb-frase`: la acción del día) y el TEXTO de una fila (`gb-t`).
//   · EL RÓTULO de un bloque es el único texto chico: 13 px, en mayúsculas, del tema «General»
//     (lib/graficos-temas.ts). Nada en el medio: un 17 px al lado de un 80 se lee como un error, no como jerarquía.
//   · SIN METADATA: lo que el teléfono sacó («Actualizado», la segunda línea de cada fila, el «mismo período del mes
//     anterior: $1,650», los chips de estado) tampoco va acá. Lo que sigue haciendo falta va en su pantalla.
// ⚠️ «No pude leer» NO es un placeholder: es un fallo nuestro y se dice (`Fallo`). El placeholder es «todavía no hay».
// ⚠️ LO QUE DEPENDE DE LA HORA SE DIBUJA DESPUÉS DE MONTAR (`useAhora`, y la muestra de un placeholder): el bloque se
//    dibuja también en el server, y una hora o una fecha de ejemplo que cambie entre los dos rompe la hidratación.
// ⚠️ Las clases llevan el prefijo `gb-` y la hoja se monta UNA vez (`CSS_BLOQUES`, la pone ./ProveedorGeneral.tsx).
// ⚠️ El título propio del bloque (el que se escribe en el panel) lo pone el editor por contexto (`useTituloPropio`) y lo
//    leen `Cabeza` y `TituloBloque`: un bloque que dibuje su propio <h2> no se entera.
// =============================================================================

import { useEffect, useState, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import { useTituloPropio } from '../../dashboard/ElementoGeneral';

export const CSS_BLOQUES = `
.gb{--gb-losa:color-mix(in srgb,var(--ink) 4.5%,transparent);--gb-losa-2:color-mix(in srgb,var(--ink) 8%,transparent);
  display:flex;flex-direction:column;min-width:0;min-height:0;flex:1;font-family:inherit;color:var(--ink)}
.gb-cab{display:flex;align-items:baseline;gap:10px;margin-bottom:12px;min-width:0}
.gb-tit{margin:0;min-width:0;flex:0 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-size:var(--dash-titulo-tam,19px);font-weight:var(--dash-titulo-peso,600);text-transform:var(--dash-titulo-mayus,none);
  letter-spacing:var(--dash-titulo-espacio,-0.015em);line-height:1.25;color:var(--ink)}
.gb-cab-extra{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;color:var(--dim)}
.gb-cab-link{margin-left:auto;flex:none;font-size:13px;font-weight:600;color:var(--primary);text-decoration:none;white-space:nowrap;
  background:none;border:none;padding:0;font-family:inherit;cursor:pointer}
.gb-cab-link:hover{text-decoration:underline}
.gb-fallo{font-size:14px;color:var(--dim)}
.gb-losa{background:var(--gb-losa);border-radius:12px}
a.gb-losa,button.gb-losa,.gb-losa[role=button]{transition:background .12s}
a.gb-losa:hover,button.gb-losa:hover,.gb-losa[role=button]:hover{background:var(--gb-losa-2)}
.gb-fila{display:flex;align-items:center;gap:12px;min-width:0;padding:10px 0;border-top:1px solid var(--border);text-decoration:none;color:inherit}
.gb-fila:first-child{border-top:none;padding-top:2px}
.gb-cabe{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;flex-wrap:wrap;align-content:flex-start;overflow:hidden}
.gb-cabe>*{flex:none;width:100%;box-sizing:border-box}
.gb-centro{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;justify-content:center}
.gb-ph{position:relative;flex:1;min-height:110px;display:flex;flex-direction:column}
.gb-ph-fondo{flex:1;opacity:.5;filter:saturate(.6);pointer-events:none;user-select:none;overflow:hidden;
  -webkit-mask-image:linear-gradient(180deg,#000 50%,transparent 96%);mask-image:linear-gradient(180deg,#000 50%,transparent 96%)}
.gb-ph-encima{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:12px}
.gb-ph-caja{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;max-width:300px;padding:14px 18px;
  background:var(--surface);border:1px solid var(--border);border-radius:14px;box-shadow:0 8px 24px rgba(18,21,27,.10)}
.gb-ph-txt{font-size:14px;font-weight:600;color:var(--ink);line-height:1.35}
.gb-boton{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 14px;border-radius:10px;border:1px solid var(--primary);
  background:var(--primary);color:var(--on-primary,#fff);font-family:inherit;font-size:13.5px;font-weight:600;cursor:pointer;text-decoration:none;white-space:nowrap}
.gb-boton:hover{filter:brightness(1.06)}
.gb-boton--grande{height:clamp(40px,calc(3cqi + 30px),52px);padding:0 clamp(16px,3cqi,24px);border-radius:12px;font-size:clamp(14.5px,calc(1.2cqi + 11px),17px)}
.gb-boton--sec{background:transparent;color:var(--ink);border-color:var(--border-strong)}
.gb-boton--sec:hover{background:var(--gb-losa);filter:none}
.gb-chip{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 8px;border-radius:999px;font-size:11.5px;font-weight:600;
  white-space:nowrap;background:var(--gb-losa-2);color:var(--dim)}
.gb-num{font-variant-numeric:tabular-nums}
.gb-p{font-size:clamp(40px,calc(22cqi - 32px),128px);font-weight:800;letter-spacing:-.04em;line-height:.95;font-variant-numeric:tabular-nums;color:var(--ink)}
.gb-s{font-size:clamp(26px,calc(13cqi - 16px),64px);font-weight:800;letter-spacing:-.035em;line-height:1;font-variant-numeric:tabular-nums;color:var(--ink)}
.gb-frase{margin:0;font-size:clamp(23px,calc(11cqi - 12px),60px);font-weight:700;letter-spacing:-.025em;line-height:1.1;text-wrap:balance;color:var(--ink)}
.gb-t{font-size:clamp(15px,calc(4cqi + 2px),24px);font-weight:600;letter-spacing:-.01em;line-height:1.25;color:var(--ink)}
.gb-d{font-size:clamp(14px,calc(2.4cqi + 6px),19px);color:var(--dim);line-height:1.35}
.gb-delta{font-size:clamp(13.5px,calc(2.2cqi + 6px),18px);font-weight:700;font-variant-numeric:tabular-nums}
.gb-delta[data-sube]{color:var(--good)}.gb-delta[data-baja]{color:var(--bad)}.gb-delta[data-igual]{color:var(--faint)}
.gb-plan{--surface:color-mix(in srgb,var(--ink) 4.5%,var(--gb-fondo,var(--surface)));--border:transparent}
`;

/** El título de un bloque: el propio (si se escribió en el panel) o el del bloque. */
export function TituloBloque({ children }: { children: string }) {
  const propio = useTituloPropio();
  return <h2 className="gb-tit">{propio || children}</h2>;
}

/** La cabecera de un bloque: el título, lo que dice al lado y su link (o un botón). */
export function Cabeza({ titulo, extra, href, link, accion }: {
  titulo: string; extra?: ReactNode; href?: string; link?: string;
  /** Un control a la derecha en vez del link (el «+ agregar» de los KPIs, el disparador de un modal). */
  accion?: ReactNode;
}) {
  return (
    <div className="gb-cab">
      <TituloBloque>{titulo}</TituloBloque>
      {extra != null && extra !== '' && <span className="gb-cab-extra">{extra}</span>}
      {accion ?? (href && link ? <Link href={href} className="gb-cab-link">{link} →</Link> : null)}
    </div>
  );
}

/** Una lectura caída: lo dice (es nuestro, no «todavía no hay»). */
export function Fallo({ titulo, error }: { titulo: string; error: string }) {
  return (
    <div className="gb">
      <Cabeza titulo={titulo} />
      <span className="gb-fallo">{error}</span>
    </div>
  );
}

/** El instante de ahora, SÓLO en el navegador (null en el server y en el primer dibujo: los dos iguales). */
export function useAhora(): string | null {
  const [ahora, setAhora] = useState<string | null>(null);
  useEffect(() => {
    setAhora(new Date().toISOString());
    const t = setInterval(() => setAhora(new Date().toISOString()), 60_000);
    return () => clearInterval(t);
  }, []);
  return ahora;
}

/**
 * El bloque vacío: el mismo bloque con datos de ejemplo, apagado, y encima la frase y la acción. `accion` es un link
 * (`href`) o un botón (un nodo ya armado, como el disparador de un modal).
 */
export function Placeholder({ muestra, texto, accion }: {
  muestra: ReactNode;
  texto: string;
  accion?: { href: string; rotulo: string } | ReactNode;
}) {
  // La muestra se dibuja recién montado: sus fechas salen de hoy y de la zona del navegador.
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  const esLink = !!accion && typeof accion === 'object' && 'href' in (accion as object) && 'rotulo' in (accion as object);
  return (
    <div className="gb-ph" data-placeholder="">
      <div className="gb-ph-fondo" aria-hidden>{montado ? muestra : null}</div>
      <div className="gb-ph-encima">
        <div className="gb-ph-caja">
          <span className="gb-ph-txt">{texto}</span>
          {esLink
            ? <Link href={(accion as { href: string }).href} className="gb-boton">{(accion as { rotulo: string }).rotulo}</Link>
            : (accion as ReactNode) ?? null}
        </div>
      </div>
    </div>
  );
}

/** «Hoy», «Mañana» o «jue 16». */
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export function diaCorto(fecha: string, hoy: string, manana: string): string {
  if (fecha === hoy) return 'Hoy';
  if (fecha === manana) return 'Mañana';
  const [y, m, d] = fecha.split('-').map(Number);
  return `${DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}`;
}
export function diaDeSemana(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number);
  return DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** Las iniciales de un nombre (el avatar de una fila). */
export const iniciales = (n: string): string => n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '·';
