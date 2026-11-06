'use client';

// =============================================================================
// BloqueWeb — los bloques del Web Generator en el hilo con MaKo (Ops Center 1.12 y 1.13, 20/10/2026)
// =============================================================================
// Martín (20/10/2026): «quiero que en Ops Center se pueda hacer todo, editar videos, crear webs, etc...». Lo dibuja la
// pieza ÚNICA del hilo (app/_chat/BloqueHilo.tsx, del marco de Ops Center 3) cuando el bloque es del área
// (lib/editor-landing/bloques-web.ts), en la computadora, en el teléfono y en el MaKo Analyst de la ficha:
//   · `landing`: la miniatura (MiniaturaLanding, la MISMA del Panel), el título, el estado, el link si está en internet
//     y «Abrir en el editor»;
//   · `landings`: la lista (listar_landings_creadas), de a dos por fila; cada tarjeta abre su editor, y «Ver todas»
//     el Panel;
//   · `elegir`: tres opciones con su vista previa (la miniatura de un diseño, la muestra de un tema). Contesta como el
//     G1 del marco: lo elegido sale como un mensaje de la persona («Diseño: Clásico claro»);
//   · `publicada`: el link con Copiar y Abrir;
//   · `dominio`: la tabla DNS con el estado de cada registro, y «Verificar ahora» que vuelve a mirar el DNS y cambia el
//     MISMO bloque (la misma ruta que el diálogo Publicar: /api/landing-generator/dominio, `estado` con `verificar`).
//
// ⚠️ SIN IMPORTAR CSS: lo dibuja un test (tests/ops-center-landing-bloques.test.ts). Las clases del hilo (`ch-…`) son
//    las del marco (app/_chat/chat.css); lo propio va en <style> (React 19 las sube al <head> y las deduplica por
//    `href`): la hoja del contenido de las landings, la del Panel (`.gp`, sólo alrededor de la miniatura) y CSS_WEB.
// ⚠️ LOS LINKS DE LA APP VAN POR `Link` (le suma el ?ws=). La dirección pública de una landing es la única de afuera: se
//    abre en otra pestaña, con `noopener`.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import Link from '@/app/_ui/Link';
import type { BloqueDominio, BloqueElegir, BloqueLanding, BloqueLandings, BloquePublicada, BloqueWeb as Bloque } from '@/lib/editor-landing/bloques-web';
import { ELIGE_TU, SALTEAR, textoDeOpcion, textoEligeTu, textoSaltear } from '@/lib/editor-landing/bloques-web';
import { bloqueDominio } from '@/lib/editor-landing/bloques-chat';
import { CSS_CONTENIDO } from '@/lib/editor-landing/css';
import { FORMA_DE, formaFija, type ProporcionFija } from '@/lib/editor-landing/api-tipos';
import { temaPorId, urlFuentes, type Tema } from '@/lib/editor-landing/temas';
import { tarjetasDe, type JsonNodo } from '@/lib/editor-landing/doc';
import { RUTA_DOMINIO, type RespuestaDominio } from '@/lib/editor-landing/dominios-reglas';
import { CSS_GP, MiniaturaLanding, MuestraTema } from './MiniaturaLanding';
import { plantillasDe } from './crear/tipo';
import { PLAZO_DOCS_MS, postJson } from './cliente';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

const ESTADO: Record<BloqueLanding['estado'], string> = { borrador: 'Borrador', publicada: 'Publicada', pausada: 'Pausada' };

/** La dirección sin `https://` ni la barra del final: lo que se lee. */
export const direccionLegible = (url: string): string => url.replace(/^https:\/\//, '').replace(/\/$/, '');

export function BloqueWeb({ b, onResponder, respondida, ocupado }: {
  b: Bloque;
  /** Devuelve false si no salió (MaKo estaba trabajando), como en el G1 del marco. */
  onResponder?: (texto: string) => boolean | void;
  /** Lo que ya se eligió (al recargar, o escribiendo después): se ve contestado y no se toca, como el G1 del marco. */
  respondida?: string;
  /** MaKo está trabajando: las opciones esperan (lo tocado no saldría). */
  ocupado?: boolean;
}) {
  if (b.t === 'landing') return <Landing b={b} />;
  if (b.t === 'landings') return <Landings b={b} />;
  if (b.t === 'elegir') return <Elegir b={b} onResponder={onResponder} respondida={respondida} ocupado={ocupado} />;
  if (b.t === 'publicada') return <Publicada b={b} />;
  return <Dominio b={b} />;
}

/** Las hojas: el contenido de las landings y el Panel (para la miniatura), las fuentes de los temas y la de acá. */
function Estilos({ temas }: { temas: readonly Tema[] }) {
  const fuentes = useMemo(() => { try { return urlFuentes([...temas]); } catch { return ''; } }, [temas]);
  return (
    <>
      <style href="gm-contenido" precedence="medium">{CSS_CONTENIDO}</style>
      <style href="gp-panel" precedence="medium">{CSS_GP}</style>
      {fuentes ? <link rel="stylesheet" href={fuentes} precedence="medium" /> : null}
      <style href="ch-bloque-web" precedence="medium">{CSS_WEB}</style>
    </>
  );
}

/** La miniatura de una sección, en el marco del hilo (16:10 una página; 16:9, 4:3 o 4:5 una presentación). */
function Mini({ tarjeta, tema, presentacion = false, proporcion = null }: { tarjeta: JsonNodo | null; tema: Tema; presentacion?: boolean; proporcion?: ProporcionFija | null }) {
  const forma = presentacion ? FORMA_DE[formaFija(proporcion)] : [16, 10];
  return (
    <div className="ch-creado__mini ch-web__mini" style={{ aspectRatio: `${forma[0]} / ${forma[1]}`, ['--r' as string]: forma[0] / forma[1] }}>
      <div className="gma gp ch-web__lienzo">
        <MiniaturaLanding tarjeta={tarjeta} tema={tema} formato={presentacion ? 'presentacion' : 'pagina'} proporcion={proporcion ?? '16:9'} aspecto={`${forma[0]} / ${forma[1]}`} />
      </div>
    </div>
  );
}

function Landing({ b }: { b: BloqueLanding }) {
  const tema = useMemo(() => temaPorId(b.miniatura.tema), [b.miniatura.tema]);
  const temas = useMemo(() => [tema], [tema]);
  return (
    <div className="ch-bloque ch-creado" data-bloque="landing">
      <Estilos temas={temas} />
      <Mini tarjeta={b.miniatura.tarjeta} tema={tema} presentacion={b.formato === 'presentacion'} proporcion={b.miniatura.proporcion} />
      <div className="ch-creado__pie">
        <div className="ch-creado__texto">
          <p className="ch-creado__titulo">{b.titulo}</p>
          {b.url
            ? <p className="ch-creado__nota"><a className="ch-web__url" href={b.url} target="_blank" rel="noopener noreferrer">{direccionLegible(b.url)}</a></p>
            : <p className="ch-creado__nota">Sin publicar</p>}
        </div>
        <span className="ch-pildora" data-estado={b.estado}>{b.nota ?? ESTADO[b.estado]}</span>
      </div>
      <div className="ch-tarjeta__botones"><Link className="ch-abrir" href={b.abrir.href}>{b.abrir.titulo}</Link></div>
    </div>
  );
}

/** La lista: cada tarjeta (la miniatura, el título y el estado) abre su editor; «Ver todas» lleva al Panel. */
function Landings({ b }: { b: BloqueLandings }) {
  const temas = useMemo(() => b.landings.map((l) => temaPorId(l.miniatura.tema)), [b]);
  const mas = b.total > b.landings.length;
  return (
    <div className="ch-bloque" data-bloque="landings">
      <Estilos temas={temas} />
      <p className="ch-bloque__titulo">{b.titulo}</p>
      <ul className="ch-web__lista">
        {b.landings.map((l, i) => (
          <li key={l.id}>
            <Link className="ch-web__tarjeta" href={l.abrir.href} aria-label={`${l.titulo}: ${l.abrir.titulo}`}>
              <Mini tarjeta={l.miniatura.tarjeta} tema={temas[i]} presentacion={l.formato === 'presentacion'} proporcion={l.miniatura.proporcion} />
              <span className="ch-web__item-pie">
                <span className="ch-web__item-titulo">{l.titulo}</span>
                <span className="ch-pildora" data-estado={l.estado}>{ESTADO[l.estado]}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="ch-tarjeta__botones">
        <Link className="ch-abrir" href={b.abrir.href}>{mas ? `${b.abrir.titulo} (${b.total})` : b.abrir.titulo}</Link>
      </div>
    </div>
  );
}

/** G2: tres opciones con su vista previa, la recomendada marcada. Tocar una contesta (como el G1 del marco). */
function Elegir({ b, onResponder, respondida, ocupado }: {
  b: BloqueElegir; onResponder?: (texto: string) => boolean | void; respondida?: string; ocupado?: boolean;
}) {
  const [enviada, setEnviada] = useState<string | null>(null);
  const [noSalio, setNoSalio] = useState(false);
  // Contestada al recargar, o escribiendo después (`conRespuestas`): vale lo que dijo la persona, en CADA render.
  const dicha = respondida ?? enviada;
  const quieta = !onResponder || dicha != null || !!ocupado;
  // ⚠️ «Respondiste» SÓLO SI SALIÓ, como el G1 (revisión del 21/10/2026): tocar mientras MaKo trabajaba marcaba la
  //    opción y no mandaba nada, sin aviso.
  const responder = (t: string) => {
    if (quieta) return;
    if (onResponder?.(t) === false) { setNoSalio(true); return; }
    setNoSalio(false);
    setEnviada(t);
  };
  // La vista previa de un DISEÑO es su primera sección, armada con el catálogo del navegador. `contenido()` pone ids
  // NUEVOS en cada llamada: se arma después de montar (si no, el HTML del server y el del navegador no coinciden).
  const [muestras, setMuestras] = useState<Record<string, { tarjeta: JsonNodo | null; tema: Tema }>>({});
  useEffect(() => {
    if (b.que !== 'diseno') return;
    const m: Record<string, { tarjeta: JsonNodo | null; tema: Tema }> = {};
    for (const o of b.opciones) {
      const p = plantillasDe('landing').find((x) => x.id === o.id);
      const pagina = p?.contenido().paginas[0];
      m[o.id] = { tarjeta: pagina ? tarjetasDe(pagina)[0] ?? null : null, tema: temaPorId(p?.tema) };
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMuestras(m);
  }, [b]);
  const temas = useMemo(() => (b.que === 'tema' ? b.opciones.map((o) => temaPorId(o.id)) : Object.values(muestras).map((x) => x.tema)), [b, muestras]);
  return (
    <div className="ch-bloque" data-bloque="elegir">
      <Estilos temas={temas} />
      <p className="ch-bloque__titulo">{b.pregunta}</p>
      <div className="ch-opciones ch-web__opciones" role="group" aria-label={b.pregunta}>
        {b.opciones.map((o) => {
          // Lo que dice el mensaje de la persona al elegir: QUÉ eligió («Diseño: Minimal»), para que MaKo no lo adivine.
          const texto = textoDeOpcion(b, o);
          return (
            <button key={o.id} type="button" className="ch-opcion ch-web__opcion" disabled={quieta} aria-pressed={dicha === texto}
              data-recomendada={o.id === b.recomendada || undefined} onClick={() => responder(texto)}>
              {b.que === 'diseno' && <Mini tarjeta={muestras[o.id]?.tarjeta ?? null} tema={muestras[o.id]?.tema ?? temaPorId(null)} />}
              {b.que === 'tema' && <span className="gma gp ch-web__muestra"><MuestraTema tema={temaPorId(o.id)} /></span>}
              <span className="ch-opcion__titulo">
                {o.titulo}{o.id === b.recomendada && <span className="ch-pildora">Recomendada</span>}
              </span>
              {o.cuando && <span className="ch-opcion__detalle">{o.cuando}</span>}
            </button>
          );
        })}
      </div>
      {noSalio && dicha == null && <p className="ch-tarjeta__nota" role="alert">No salió: espera a que MaKo termine y vuelve a tocar.<ReportarASoporte /></p>}
      {dicha == null ? (
        <div className="ch-tarjeta__botones">
          <button type="button" className="ch-enlace" disabled={quieta} onClick={() => responder(textoEligeTu(b))}>{ELIGE_TU}</button>
          <button type="button" className="ch-enlace" disabled={quieta} onClick={() => responder(textoSaltear(b))}>{SALTEAR}</button>
        </div>
      ) : <p className="ch-tarjeta__nota">{`Respondiste: ${dicha}`}</p>}
    </div>
  );
}

/** Copiar al portapapeles. Sin permiso (o en un navegador sin `clipboard`) no tira: el link queda a la vista. */
async function copiar(t: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(t); return true; } catch { return false; }
}

function Publicada({ b }: { b: BloquePublicada }) {
  const [copiado, setCopiado] = useState<boolean | null>(null);
  return (
    <div className="ch-bloque" data-bloque="publicada">
      <style href="ch-bloque-web" precedence="medium">{CSS_WEB}</style>
      <p className="ch-bloque__titulo">{`«${b.titulo}» está en internet`}</p>
      <p className="ch-web__link"><a className="ch-web__url" href={b.url} target="_blank" rel="noopener noreferrer">{direccionLegible(b.url)}</a></p>
      <div className="ch-tarjeta__botones">
        <button type="button" className="ch-abrir" onClick={() => void copiar(b.url).then(setCopiado)}>{copiado ? 'Copiado' : 'Copiar'}</button>
        <a className="ch-abrir" href={b.url} target="_blank" rel="noopener noreferrer">Abrir</a>
        <Link className="ch-enlace" href={b.editor.href}>{b.editor.titulo}</Link>
      </div>
      {copiado === false && <p className="ch-tarjeta__nota">No pude copiarlo: selecciónalo y cópialo a mano.</p>}
    </div>
  );
}

const ESTADO_FILA = (listo: boolean | null) => (listo === true ? 'Listo' : listo === false ? 'Falta' : 'No se pudo leer');

function Dominio({ b }: { b: BloqueDominio }) {
  const [d, setD] = useState(b);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verificar = async () => {
    setOcupado(true);
    setError(null);
    const r = await postJson<RespuestaDominio>(RUTA_DOMINIO, { accion: 'estado', id: d.id, verificar: true }, PLAZO_DOCS_MS);
    setOcupado(false);
    if (!r.ok) { setError(r.error); return; }
    if (r.dominio) setD(bloqueDominio(d.id, r.dominio));
  };
  const verificado = d.estado === 'verificado';
  return (
    <div className="ch-bloque" data-bloque="dominio" role="status" aria-live="polite">
      <style href="ch-bloque-web" precedence="medium">{CSS_WEB}</style>
      <div className="ch-creado__pie">
        <p className="ch-bloque__titulo">{d.dominio}</p>
        <span className="ch-pildora" data-estado={d.estado}>{verificado ? 'Verificado' : d.faltan ? `Falta${d.faltan === 1 ? '' : 'n'} ${d.faltan}` : 'Pendiente'}</span>
      </div>
      {!verificado && d.falta && <p className="ch-tarjeta__nota">{d.falta}</p>}
      {d.registros.length > 0 && (
        <table className="ch-web__dns">
          <thead><tr><th>Tipo</th><th>Nombre</th><th>Valor</th><th><span className="ch-oculto">Estado</span></th></tr></thead>
          <tbody>
            {d.registros.map((r, i) => (
              <tr key={`${r.tipo}:${r.nombre}:${i}`} data-listo={r.listo === null ? 'nulo' : String(r.listo)} data-para={r.para}>
                <td>{r.tipo}</td>
                <td><code>{r.nombre}</code></td>
                <td><button type="button" className="ch-web__valor" title="Copiar" onClick={() => void copiar(r.valor)}><code>{r.valor}</code></button></td>
                <td className="ch-web__estado">{r.para === 'www' && r.listo === false ? 'Opcional' : ESTADO_FILA(r.listo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {error && <p className="ch-tarjeta__nota" role="alert">{error}<ReportarASoporte /></p>}
      {!verificado && (
        <div className="ch-tarjeta__botones">
          <button type="button" className="ch-abrir" disabled={ocupado} onClick={() => void verificar()}>{ocupado ? 'Mirando el DNS…' : 'Verificar ahora'}</button>
        </div>
      )}
    </div>
  );
}

/**
 * Lo que las clases del marco no traen: la miniatura de una landing adentro de su marco (el `.gp` del Panel sólo
 * alrededor de ella), las opciones con vista previa, el link publicado y la tabla DNS. Con los tokens del hilo.
 */
const CSS_WEB = `
.ch-web__mini { width: 100%; max-width: 100%; display: block; }
.ch-web__lienzo { position: absolute; inset: 0; background: transparent; min-height: 0; }
.ch-web__lienzo .gp-mini { height: 100%; border-radius: 0; }
.ch-web__lista { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.ch-web__tarjeta { display: flex; flex-direction: column; gap: 6px; min-width: 0; color: inherit; text-decoration: none; border-radius: 10px; }
.ch-web__tarjeta:hover .ch-creado__mini { border-color: var(--primary); }
.ch-web__tarjeta:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.ch-web__item-pie { display: flex; align-items: center; justify-content: space-between; gap: 6px; min-width: 0; }
.ch-web__item-titulo { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--fs-sm); font-weight: 600; color: var(--ink); }
.ch-web__opciones { flex-direction: row; flex-wrap: wrap; }
.ch-web__opcion { flex: 1 1 140px; min-width: 0; gap: 6px; }
.ch-web__opcion .ch-creado__mini { width: 100%; }
.ch-web__muestra { display: block; width: 100%; background: transparent; min-height: 0; }
.ch-web__link { margin: 0; overflow-wrap: anywhere; }
.ch-web__url { color: var(--primary); font-weight: 600; text-decoration: none; overflow-wrap: anywhere; }
.ch-web__url:hover { text-decoration: underline; }
.ch-pildora[data-estado="borrador"], .ch-pildora[data-estado="pendiente"] { background: var(--surface-2, var(--border)); color: var(--dim); }
.ch-pildora[data-estado="pausada"] { background: var(--warn-bg, var(--surface-2)); color: var(--warn, var(--dim)); }
.ch-web__dns { width: 100%; border-collapse: collapse; font-size: var(--fs-sm); table-layout: fixed; }
.ch-web__dns th { text-align: left; font-weight: 600; color: var(--dim); padding: 4px 6px; border-bottom: 1px solid var(--border); }
.ch-web__dns th:nth-child(1) { width: 56px; } .ch-web__dns th:nth-child(4) { width: 88px; }
.ch-web__dns td { padding: 6px; border-bottom: 1px solid var(--border); vertical-align: top; overflow-wrap: anywhere; }
.ch-web__dns code { font-size: 12px; }
.ch-web__valor { padding: 0; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: copy; overflow-wrap: anywhere; }
.ch-web__estado { font-weight: 600; color: var(--dim); }
.ch-web__dns tr[data-listo="true"] .ch-web__estado { color: var(--good); }
.ch-web__dns tr[data-listo="false"]:not([data-para="www"]) .ch-web__estado { color: var(--bad, var(--ink)); }
@media (max-width: 560px) { .ch-web__dns th:nth-child(1) { width: 44px; } .ch-web__dns th:nth-child(4) { width: 70px; } }
`;
