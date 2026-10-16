'use client';

// =============================================================================
// /m/offer — las tres hojas: el selector (funnel y oferta), «Tu oferta» (las piezas) y la oferta armada
// =============================================================================
// Lo que en escritorio son el desplegable de arriba, el riel de la derecha y las vistas Generando y
// Conclusión, en el teléfono son hojas (SheetM): una por vez, y «atrás» las cierra.
//   · SELECTOR («Funnel y oferta»): el árbol de escritorio aplanado (modelo.ts → seccionesDelSelector): una
//     sección por funnel; adentro cada oferta con sus conversaciones y «Analizar», y al final las de oferta
//     nueva con «Nueva oferta». Como el selector de proyectos de ChatGPT en el teléfono.
//   · «TU OFERTA»: el conteo, la barra y las piezas por tema (como el riel), y abajo «Armar mi oferta»
//     (dorado: se lo pides a MaKo) y «Ver mi oferta».
//   · LA OFERTA: mientras se arma, los dos pasos de Generando (Diagnóstico · Oferta nueva) con su
//     reintento desde el paso que falló; armada, la Conclusión destilada: el puntaje, la frase, el
//     segmentado Diagnóstico · Oferta nueva y, en el pie, «Descargar PDF» y «Guardar en este funnel». La ✕
//     es «Seguir afinando» (vuelve al chat).
// =============================================================================

import { useState, type ReactNode } from 'react';
import { Icon } from '@/app/_components/icons';
import { Button, ButtonLink } from '@/app/_ui/Button';
import type { ArbolOffer, ConclusionOferta, OfferSesionVista, PiezasSabidas } from '@/lib/offer-marco';
import { esSeccionProvisional, guardadaVisible, partirCompletar, propuestoPorMakoDe, provisionalDe, tonoDeNota, type AvisoGuardado } from '@/app/offer/ayudas';
import { descargarPdf, mensajeDeError } from '@/app/offer/offer-api';
import { FilaM, ListaM, PieM, PildoraM, SegmentadoM, SheetM, VacioM } from '@/app/m/_ui';
import {
  ESTADO_PIEZA, ROTULOS, arribaDeLaOferta, datosParaCompletar, estadoDePasos, filasDimensiones, heroeDe, hrefProbarlo, lecturaDelDiagnostico,
  piezasEnGrupos, progresoDePiezas, renglonesDelSelector, seccionesDeOferta, seccionesDelSelector,
  type Bloque, type EstadoPaso, type PasoGeneracion,
} from './modelo';

// ── Un texto con sus «[completar]» como pastillas ────────────────────────────

/** Un dato que el dueño no dio y que MaKo NO inventa: escrito como texto se copiaría tal cual a una landing. */
function T({ v }: { v: string }) {
  return (
    <>
      {partirCompletar(v).map((p, i) => (p.t === 'marca'
        ? <span key={i} className="m-offer-completar">{p.v}</span>
        : <span key={i}>{p.v}</span>))}
    </>
  );
}

// ── El selector ──────────────────────────────────────────────────────────────

export function HojaSelector({ abierto, onCerrar, arbol, abiertaId, onAbrir, onNueva }: {
  abierto: boolean;
  onCerrar: () => void;
  arbol: ArbolOffer;
  abiertaId: number | null;
  onAbrir: (id: number) => void;
  onNueva: (funnelId: number, ofertaBaseId: number | null) => void;
}) {
  // Siempre, no sólo abierta: la hoja sigue en pantalla los 220 ms de la salida y no puede quedar en blanco.
  // (La fecha de cada renglón depende de la zona del teléfono, y no llega al HTML del server: SheetM no
  // monta nada cerrado.)
  const secciones = seccionesDelSelector(arbol, abiertaId);
  const alta = renglonesDelSelector(secciones) > 6;
  return (
    <SheetM abierto={abierto} onCerrar={onCerrar} titulo={ROTULOS.selector} id="funnel" snap={alta ? 'alto' : 'medio'}>
      {secciones.length === 0 ? <VacioM frase={ROTULOS.sinFunnels} /> : (
        <div className="m-offer-arbol">
          {secciones.map((s) => (
            <section key={s.id ?? 'sueltas'} className="m-offer-arbol__funnel" aria-label={s.titulo}>
              <h3 className="m-offer-arbol__titulo"><Icon name={s.id == null ? 'chats' : 'funnel'} size={18} />{s.titulo}</h3>
              {s.ofertas.map((o) => (
                <div key={o.id} className="m-offer-arbol__oferta">
                  <p className="m-offer-arbol__sub">
                    <span>{o.titulo}</span>
                    {o.principal && <span className="m-offer-arbol__principal">{ROTULOS.principal}</span>}
                  </p>
                  <ListaM etiqueta={o.titulo}>
                    {o.conversaciones.map((c) => (
                      <FilaM key={c.id} navegacion chevron={false} titulo={c.titulo} segunda={c.segunda || undefined}
                        etiqueta={c.abierta ? `${c.titulo}, abierta` : undefined}
                        riel={c.abierta ? <span className="m-offer-check"><Icon name="check" size={18} /></span> : undefined}
                        onClick={() => onAbrir(c.id)} />
                    ))}
                    {s.id != null && (
                      <FilaM navegacion chevron={false} titulo={<span className="m-offer-crear">{ROTULOS.analizar}</span>}
                        etiqueta={`${ROTULOS.analizar} ${o.titulo}`}
                        leading={<span className="m-offer-crear__ico"><Icon name="plus" size={16} /></span>}
                        onClick={() => onNueva(s.id as number, o.id)} />
                    )}
                  </ListaM>
                </div>
              ))}
              {(s.nuevas.length > 0 || s.id != null) && (
                <div className="m-offer-arbol__oferta">
                  {s.ofertas.length > 0 && s.nuevas.length > 0 && <p className="m-offer-arbol__sub"><span>{ROTULOS.nuevaOferta}</span></p>}
                  <ListaM etiqueta={s.id == null ? s.titulo : `${s.titulo}: ${ROTULOS.nuevaOferta}`}>
                    {s.nuevas.map((c) => (
                      <FilaM key={c.id} navegacion chevron={false} titulo={c.titulo} segunda={c.segunda || undefined}
                        etiqueta={c.abierta ? `${c.titulo}, abierta` : undefined}
                        riel={c.abierta ? <span className="m-offer-check"><Icon name="check" size={18} /></span> : undefined}
                        onClick={() => onAbrir(c.id)} />
                    ))}
                    {s.id != null && (
                      <FilaM navegacion chevron={false} titulo={<span className="m-offer-crear">{ROTULOS.nuevaOferta}</span>}
                        etiqueta={`${ROTULOS.nuevaOferta} en ${s.titulo}`}
                        leading={<span className="m-offer-crear__ico"><Icon name="plus" size={16} /></span>}
                        onClick={() => onNueva(s.id as number, null)} />
                    )}
                  </ListaM>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </SheetM>
  );
}

// ── «Tu oferta»: las piezas ──────────────────────────────────────────────────

export type AccionesPiezasM = {
  puedeConcluir: boolean;
  hayConclusion: boolean;
  /** «Armar mi oferta», o «Actualizar el PDF» si ya hay una versión (ayudas.ts → etiquetaArmar). */
  etiquetaArmar: string;
  /** MaKo contesta o se lee un archivo: armar ahora dejaría afuera lo último. */
  ocupado: boolean;
  onArmar: () => void;
  onVer: () => void;
};

function MarcaPieza({ estado }: { estado: 'vacia' | 'negocio' | 'confirmada' }) {
  return (
    <span className="m-offer-pieza" data-estado={estado} aria-hidden>
      {estado === 'confirmada' && <Icon name="check" size={13} />}
    </span>
  );
}

export function HojaPiezas({ abierto, onCerrar, piezas, acciones }: {
  abierto: boolean;
  onCerrar: () => void;
  piezas: PiezasSabidas;
  acciones: AccionesPiezasM;
}) {
  const p = progresoDePiezas(piezas);
  const pie = acciones.puedeConcluir || acciones.hayConclusion ? (
    <PieM>
      {acciones.puedeConcluir && (
        <Button variant="mako" size="lg" full disabled={acciones.ocupado} onClick={acciones.onArmar} icon={<Icon name="mako" size={18} />}>
          {acciones.etiquetaArmar}
        </Button>
      )}
      {acciones.hayConclusion && <Button variant="secondary" size="lg" full onClick={acciones.onVer}>{ROTULOS.verMiOferta}</Button>}
    </PieM>
  ) : undefined;
  return (
    <SheetM abierto={abierto} onCerrar={onCerrar} titulo={ROTULOS.tuOferta} id="piezas" snap="alto" pie={pie}>
      <div className="m-offer-conteo">
        <span className="m-offer-conteo__n">{p.sabidas}<span>/{p.total}</span></span>
        <span className="m-offer-avance" aria-hidden><i style={{ width: `${p.pct}%` }} /></span>
      </div>
      {piezasEnGrupos(piezas).map((g) => (
        <div key={g.titulo} className="m-offer-grupo">
          <p className="m-offer-arbol__sub"><span>{g.titulo}</span></p>
          <ul className="m-offer-piezas" aria-label={g.titulo}>
            {g.piezas.map((x) => (
              <li key={x.key} className="m-offer-piezas__fila" data-estado={x.estado} aria-label={`${x.label}: ${ESTADO_PIEZA[x.estado]}`}>
                <MarcaPieza estado={x.estado} />
                <span>{x.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </SheetM>
  );
}

// ── La oferta: Generando y la Conclusión ─────────────────────────────────────

export type GenM = { paso: PasoGeneracion; corriendo: boolean; error: string | null };

function MarcaPaso({ estado }: { estado: EstadoPaso }) {
  return (
    <span className="m-offer-paso__marca" data-estado={estado} aria-hidden>
      {estado === 'activo' ? <span className="mk-spin" /> : estado === 'hecho' ? <Icon name="check" size={15} /> : estado === 'fallo' ? <Icon name="x" size={14} /> : null}
    </span>
  );
}

export function HojaOferta({ abierto, onCerrar, vista, gen, sesion, conclusion, onReintentar, onGuardar }: {
  abierto: boolean;
  /** La ✕ y «atrás»: «Seguir afinando» (vuelve al chat; lo que se está armando sigue). */
  onCerrar: () => void;
  vista: 'generando' | 'conclusion';
  gen: GenM;
  sesion: OfferSesionVista | null;
  conclusion: ConclusionOferta | null;
  /** Reintenta DESDE el paso que falló (un diagnóstico que ya salió no se vuelve a pagar). */
  onReintentar: () => void;
  onGuardar: () => Promise<AvisoGuardado | null>;
}) {
  // Armada = hay una conclusión y no se está armando otra (al actualizar el PDF se ve el progreso, no la vieja).
  const armada = vista === 'conclusion' ? conclusion : null;
  return (
    <SheetM abierto={abierto} onCerrar={onCerrar} titulo={ROTULOS.tuOferta} id="oferta" snap="alto"
      rotuloCerrar={armada ? ROTULOS.seguirAfinando : ROTULOS.volverAlChat}
      pie={!armada
        ? (gen.error && !gen.corriendo ? (
          <PieM>
            <Button variant="primary" size="lg" full onClick={onReintentar}>
              {gen.paso === 'oferta' ? ROTULOS.reintentarOferta : ROTULOS.reintentarDiagnostico}
            </Button>
            <Button variant="tertiary" size="lg" full onClick={onCerrar}>{ROTULOS.volverAlChat}</Button>
          </PieM>
        ) : undefined)
        : sesion && <PieConclusion key={`${sesion.id}-${armada.version}`} sesion={sesion} onGuardar={onGuardar} />}>
      {armada ? <ConclusionM key={`${sesion?.id}-${armada.version}`} conclusion={armada} /> : <GenerandoM gen={gen} />}
    </SheetM>
  );
}

/** Los dos pasos del armado (Generando de escritorio). Exportado para el test que lo dibuja. */
export function GenerandoM({ gen }: { gen: GenM }) {
  const e = estadoDePasos(gen.paso, gen.corriendo, gen.error);
  const fallo = !!gen.error && !gen.corriendo;
  return (
    <div className="m-offer-generando" role="status" aria-live="polite">
      <ol className="m-offer-pasos">
        <li className="m-offer-paso" data-estado={e.diagnostico}><MarcaPaso estado={e.diagnostico} /><span>{ROTULOS.diagnostico}</span></li>
        <li className="m-offer-paso" data-estado={e.oferta}><MarcaPaso estado={e.oferta} /><span>{ROTULOS.ofertaNueva}</span></li>
      </ol>
      {fallo
        ? <p className="m-offer-linea m-offer-linea--bad" role="alert">{gen.error}</p>
        : <p className="m-offer-generando__nota">{ROTULOS.puedeTardar}</p>}
    </div>
  );
}

/** El pie de la conclusión: el PDF de la versión vigente y guardarla en el funnel (BarraAcciones de escritorio). */
function PieConclusion({ sesion, onGuardar }: { sesion: OfferSesionVista; onGuardar: () => Promise<AvisoGuardado | null> }) {
  const [bajando, setBajando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<AvisoGuardado | null>(null);
  // Sale del DATO (`ligada`), no sólo del aviso de este momento (ayudas.ts → guardadaVisible).
  const guardada = guardadaVisible(sesion.ofertaId, sesion.ligada, aviso);

  const pdf = async () => {
    if (bajando) return;
    setBajando(true);
    setError(null);
    try { await descargarPdf(sesion.id); } catch (e) { setError(mensajeDeError(e)); } finally { setBajando(false); }
  };
  const guardar = async () => {
    if (guardada || guardando) return;
    setGuardando(true);
    setError(null);
    // El aviso anterior se reemplaza recién con la respuesta (si no, «Guardada» aparecería antes de ligar nada).
    try { setAviso(await onGuardar()); } catch (e) { setError(mensajeDeError(e)); } finally { setGuardando(false); }
  };

  return (
    <PieM>
      {error && <p className="m-offer-linea m-offer-linea--bad" role="alert">{error}</p>}
      {aviso?.texto.trim() && <p className="m-offer-linea m-offer-linea--warn" role="status">{aviso.texto}</p>}
      <Button variant="primary" size="lg" full loading={bajando} onClick={() => void pdf()} icon={<Icon name="descargar" size={18} />}>
        {ROTULOS.descargarPdf}
      </Button>
      {guardada
        // No es un botón apagado (se leería como roto): es el estado.
        ? <p className="m-offer-guardada" role="status"><Icon name="check" size={18} />{ROTULOS.guardada}</p>
        : (
          <Button variant="secondary" size="lg" full loading={guardando} onClick={() => void guardar()}>
            {sesion.funnelId != null ? ROTULOS.guardarEnFunnel : ROTULOS.guardarComoMia}
          </Button>
        )}
    </PieM>
  );
}

type Pestana = 'diagnostico' | 'oferta';

/** La conclusión destilada. Exportada para el test que la dibuja con lo que manda un modelo (a la defensiva). */
export function ConclusionM({ conclusion }: { conclusion: ConclusionOferta }) {
  const [pestana, setPestana] = useState<Pestana>('diagnostico');
  const h = heroeDe(conclusion);
  return (
    <div className="m-offer-conclusion">
      <section className="m-offer-heroe">
        <div className="m-offer-heroe__txt">
          {h.nombre && <p className="m-offer-heroe__nombre"><T v={h.nombre} /></p>}
          {h.frase && <p className="m-offer-heroe__frase"><T v={h.frase} /></p>}
        </div>
        <div className="m-offer-heroe__nota">
          <Anillo total={h.total} />
          <PildoraM tono={h.lista ? 'good' : 'warn'}>{h.estado}</PildoraM>
        </div>
      </section>
      <SegmentadoM<Pestana> etiqueta="Qué ver" valor={pestana} onCambio={setPestana}
        opciones={[{ id: 'diagnostico', label: ROTULOS.diagnostico }, { id: 'oferta', label: ROTULOS.ofertaNueva }]} />
      {pestana === 'diagnostico' ? <Diagnostico conclusion={conclusion} /> : <OfertaNueva conclusion={conclusion} />}
    </div>
  );
}

function Anillo({ total }: { total: number }) {
  // La misma partición que la rúbrica (y que el anillo de escritorio): el total, dividido por diez.
  const tono = tonoDeNota(total / 10);
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="m-offer-anillo" data-tono={tono} role="img" aria-label={`Puntaje: ${total} de 100`}>
      <svg width={84} height={84} viewBox="0 0 100 100" aria-hidden>
        <circle cx={50} cy={50} r={r} fill="none" className="m-offer-anillo__fondo" strokeWidth={9} />
        {total > 0 && <circle cx={50} cy={50} r={r} fill="none" className="m-offer-anillo__arco" strokeWidth={9} strokeLinecap="round"
          strokeDasharray={`${(total / 100) * c} ${c}`} transform="rotate(-90 50 50)" />}
      </svg>
      <span className="m-offer-anillo__n">{total}</span>
    </div>
  );
}

function Diagnostico({ conclusion }: { conclusion: ConclusionOferta }) {
  const l = lecturaDelDiagnostico(conclusion.diagnostico, conclusion.calculo);
  return (
    <div className="m-offer-pestana">
      {l.tesis && <p className="m-offer-tesis"><T v={l.tesis} /></p>}
      {l.faltan.length > 0 && (
        <Caja tono="warn" titulo={ROTULOS.queFalta}>
          <ul className="m-offer-puntos">
            {l.faltan.map((x) => (
              <li key={x.punto}><strong>{x.label}</strong>{x.porque && <span> · <T v={x.porque} /></span>}</li>
            ))}
          </ul>
        </Caja>
      )}
      {/* Las nueve notas a la vista; el porqué y «Para subirla», al tocar la fila (escritorio: el renglón que se abre). */}
      <ListaM etiqueta="Las nueve dimensiones">
        {filasDimensiones(conclusion.diagnostico).map((d) => {
          const fila = (
            <>
              <span className="m-offer-dim__label">{d.label}</span>
              <span className="m-offer-dim__nota" data-tono={d.tono ?? undefined}>{d.nota ?? '—'}</span>
            </>
          );
          return d.porque || d.mejora ? (
            <details key={d.id} className="m-offer-dim">
              <summary className="m-offer-dim__fila">{fila}<Icon name="chevron" size={16} /></summary>
              <div className="m-offer-dim__detalle">
                {d.porque && <p className="m-offer-parrafo"><T v={d.porque} /></p>}
                {d.mejora && <p className="m-offer-parrafo"><strong>{ROTULOS.paraSubirla}</strong><T v={d.mejora} /></p>}
              </div>
            </details>
          ) : <div key={d.id} className="m-offer-dim"><div className="m-offer-dim__fila">{fila}</div></div>;
        })}
      </ListaM>
      {l.fuerte && <Caja tono="good" titulo={ROTULOS.masFuerte}><p className="m-offer-parrafo"><T v={l.fuerte} /></p></Caja>}
      {l.alertas.map((a, i) => <p key={i} className="m-offer-linea m-offer-linea--warn">{a}</p>)}
      {l.cambios.length > 0 && (
        <section className="m-offer-bloque">
          <h3 className="m-offer-bloque__titulo">{ROTULOS.primeroCambiaria}</h3>
          <ol className="m-offer-cambios">
            {l.cambios.map((c, i) => (
              <li key={i}>
                <span className="m-offer-cambios__n" aria-hidden>{i + 1}</span>
                <span className="m-offer-cambios__txt">
                  <strong><T v={c.titulo} /></strong>
                  {c.porque && <span><T v={c.porque} /></span>}
                  {/* Un cambio es una HIPÓTESIS: se prueba en Experiments, que abre el alta con ella escrita. */}
                  {c.hipotesis && (
                    <span className="m-offer-cambios__accion">
                      <ButtonLink href={hrefProbarlo(c.hipotesis)} variant="secondary" size="md">{ROTULOS.probarlo}</ButtonLink>
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function OfertaNueva({ conclusion }: { conclusion: ConclusionOferta }) {
  const p = conclusion.propuesta;
  const arriba = arribaDeLaOferta(p);
  const prov = provisionalDe(conclusion);
  const propuesto = propuestoPorMakoDe(p);
  return (
    <div className="m-offer-pestana">
      {arriba.avisos.map((a, i) => <p key={i} className="m-offer-linea m-offer-linea--warn">{a}</p>)}
      {arriba.completar.length > 0 && (
        <details className="m-offer-plegable m-offer-plegable--warn">
          <summary>{datosParaCompletar(arriba.completar.length)}<Icon name="chevron" size={18} /></summary>
          <ul className="m-offer-plegable__lista">{arriba.completar.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </details>
      )}
      {arriba.supuestos.length > 0 && (
        <details className="m-offer-plegable">
          <summary>{ROTULOS.supuestos}<Icon name="chevron" size={18} /></summary>
          <ul className="m-offer-plegable__lista">{arriba.supuestos.map((x, i) => <li key={i}><T v={x} /></li>)}</ul>
        </details>
      )}
      {/* La primera abierta: es lo que se lee de entrada (escritorio abre tres; acá se lee de a una). */}
      {seccionesDeOferta(p).map((s, i) => {
        const marcada = esSeccionProvisional(s.key, prov);
        return (
          <details key={s.key} className="m-offer-plegable" data-provisional={marcada ? '' : undefined} open={i === 0}>
            <summary>
              <span className="m-offer-plegable__titulo">{s.titulo}{marcada && <PildoraM tono="warn">{ROTULOS.provisional}</PildoraM>}</span>
              <Icon name="chevron" size={18} />
            </summary>
            <div className="m-offer-plegable__cuerpo">
              {marcada && prov?.motivo && <p className="m-offer-linea m-offer-linea--warn">{prov.motivo}</p>}
              {s.bloques.map((b, j) => <BloqueM key={j} b={b} />)}
            </div>
          </details>
        );
      })}
      {propuesto.length > 0 && (
        <Caja tono="mako" titulo={ROTULOS.propusoMako}>
          <ul className="m-offer-puntos">
            {propuesto.map((x, i) => <li key={i}>{x.seccion && <strong>{x.seccion}: </strong>}<T v={x.que} /></li>)}
          </ul>
        </Caja>
      )}
    </div>
  );
}

function BloqueM({ b }: { b: Bloque }) {
  if (b.t === 'campo') {
    return (
      <div className="m-offer-campo-oferta">
        {b.etiqueta && <span className="m-offer-etiqueta">{b.etiqueta}</span>}
        <p className="m-offer-parrafo"><T v={b.texto} /></p>
      </div>
    );
  }
  if (b.t === 'chips') {
    return (
      <div className="m-offer-campo-oferta">
        <span className="m-offer-etiqueta">{b.etiqueta}</span>
        <span className="m-offer-chips">{b.items.map((x, i) => <span key={i} className="m-offer-chip"><T v={x} /></span>)}</span>
      </div>
    );
  }
  if (b.t === 'lista') {
    const Tag = b.numerada ? 'ol' : 'ul';
    return (
      <div className="m-offer-campo-oferta">
        {b.etiqueta && <span className="m-offer-etiqueta">{b.etiqueta}</span>}
        <Tag className="m-offer-lista">{b.items.map((x, i) => <li key={i}><T v={x} /></li>)}</Tag>
      </div>
    );
  }
  const Tag = b.numerada ? 'ol' : 'ul';
  return (
    <Tag className="m-offer-items" data-numerada={b.numerada ? '' : undefined}>
      {b.items.map((x, i) => (
        <li key={i}>
          {b.numerada && <span className="m-offer-cambios__n" aria-hidden>{i + 1}</span>}
          <span className="m-offer-items__txt">
            {x.titulo && <strong><T v={x.titulo} /></strong>}
            {x.lineas.map((l, j) => <span key={j}><T v={l} /></span>)}
          </span>
        </li>
      ))}
    </Tag>
  );
}

function Caja({ tono, titulo, children }: { tono: 'warn' | 'good' | 'mako'; titulo: string; children: ReactNode }) {
  return (
    <section className="m-offer-caja" data-tono={tono} aria-label={titulo}>
      <h3 className="m-offer-caja__titulo">{tono === 'mako' && <Icon name="mako" size={16} />}{titulo}</h3>
      {children}
    </section>
  );
}
