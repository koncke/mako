'use client';

// =============================================================================
// Marketing CoPilot — el panel vivo: el funnel que se arma mientras se charla (9/11/2026)
// =============================================================================
// Martín, 9/11/2026: «Está bien el chat, pero siento que podría mejorarse bastante… El chat es primordial, porque hay que chatear con
// MaKo para descubrir qué funnel se necesita, pero me gustaría que tenga algo más». Dirección elegida: el chat a la izquierda y, a la
// derecha, el funnel dibujado (docs/relevo/marketing-copilot-pruebas.md → «Diseño»; referencias: el lienzo del Campaign agent de
// HubSpot, el árbol de Relume que se arma de a poco, las preguntas con opciones de Lovable y el «qué cambió» de ChatGPT Canvas).
//
// TODO lo que se ve sale del perfil guardado y de lib/media-buyer/copiloto.ts (puro, con tests): lo que MaKo sabe y lo que falta
// (`fichaDelNegocio`, la MISMA pieza que viaja en el system del agente), el recorrido (`recorridoDe`), la cuenta (`cuentaDe`), la
// comparación (`compararFunnels`) y la semana (`tareasDeLaSemana` / `propuestaDe`). Ninguna IA escribe acá: lo que el panel dice es
// cierto aunque el modelo se equivoque, y el agente y la pantalla no se contradicen.
// Lo que cambia se marca un momento («Nuevo»), como el «Show changes» de ChatGPT Canvas.
// =============================================================================

import Link from '@/app/_ui/Link';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  compararFunnels, cuentaDe, datosDeDecision, fichaDelNegocio, funnelElegido, medirDe, propuestaDe, recomendarFunnel, recorridoDe, tareasDeLaSemana,
  funnelPorId, type ClaveDato, type IdFunnel, type PerfilCopiloto,
} from '@/lib/media-buyer/copiloto';

export type VistaPanel = 'funnel' | 'semana' | 'medir';

type Props = {
  perfil: PerfilCopiloto;
  /** 'charla': se está armando (la primera entrada o «Cambiar mi estrategia»). 'listo': el funnel en marcha, con Esta semana y Qué medir. */
  modo: 'charla' | 'listo';
  /** Tocar un dato que falta: MaKo lo pregunta en el chat, con respuestas rápidas. */
  onPreguntar?: (k: ClaveDato) => void;
  /** Elegir otro funnel desde la comparación. */
  onFunnel?: (id: IdFunnel) => void;
  /** «Usar este funnel»: termina la charla (sólo en 'charla'). */
  onUsar?: () => void;
  puedeUsar?: boolean;
  ocupado?: boolean;
  /** Lo que va arriba a la derecha (los tramos de la charla). */
  arriba?: ReactNode;
  /** «Inspirado en X», sólo si eligió un referente que enseña este funnel (lib/asesores/catalogo.ts → `inspiradoEn`). */
  inspirado?: string | null;
};

/** Las claves del perfil que cambiaron (para marcarlas un momento). */
function cambios(antes: PerfilCopiloto | null, ahora: PerfilCopiloto): Set<string> {
  if (!antes) return new Set();
  const out = new Set<string>();
  for (const k of new Set([...Object.keys(antes), ...Object.keys(ahora)])) {
    if (JSON.stringify((antes as Record<string, unknown>)[k]) !== JSON.stringify((ahora as Record<string, unknown>)[k])) out.add(k);
  }
  return out;
}

export function PanelDelFunnel({ perfil, modo, onPreguntar, onFunnel, onUsar, puedeUsar = false, ocupado = false, arriba, inspirado = null }: Props) {
  const f = funnelElegido(perfil);
  const ficha = useMemo(() => fichaDelNegocio(perfil), [perfil]);
  const recorrido = useMemo(() => recorridoDe(perfil), [perfil]);
  const cuenta = useMemo(() => cuentaDe(perfil), [perfil]);
  const d = datosDeDecision(perfil);
  const recomendado = d ? recomendarFunnel(d) : null;
  const [comparar, setComparar] = useState(false);
  const [vista, setVista] = useState<VistaPanel>('funnel');

  // Lo que cambió desde la última vez, marcado 4 segundos.
  const previo = useRef<PerfilCopiloto | null>(null);
  const [nuevos, setNuevos] = useState<Set<string>>(new Set());
  const clave = JSON.stringify(perfil);
  useEffect(() => {
    const c = cambios(previo.current, perfil);
    previo.current = perfil;
    if (!c.size) return;
    setNuevos(c);
    const t = window.setTimeout(() => setNuevos(new Set()), 4000);
    return () => window.clearTimeout(t);
  }, [clave]); // eslint-disable-line react-hooks/exhaustive-deps

  const semana = useMemo(() => {
    const t = tareasDeLaSemana(perfil);
    if (t.length) return t.map((x) => ({ texto: x.titulo, detalle: x.detalle, href: x.href, accion: x.accion }));
    return (propuestaDe(perfil)?.pasos ?? []).map((x) => ({ texto: x.texto, detalle: '', href: x.href, accion: x.href ? 'Ir' : '' }));
  }, [perfil]);
  const faltan = ficha.falta.slice(0, 3);
  const masFaltan = ficha.falta.length - faltan.length;
  const funnelNuevo = nuevos.has('funnel') || nuevos.has('referente');
  const otro = recomendado && f && recomendado.funnel !== f.id ? funnelPorId(recomendado.funnel) : null;

  return (
    <section className="cp-panel" aria-label="Tu funnel">
      <header className="cp-cab">
        <div className="cp-cab-tit">
          <h2>{f ? f.nombre : 'Tu funnel'}</h2>
          <span className="cp-estado" data-modo={modo}>{modo === 'charla' ? (f ? 'Borrador · lo armamos charlando' : 'Se arma mientras charlan') : 'En marcha'}</span>
          {inspirado ? <p className="aa-insp cp-insp">{inspirado}</p> : null}
        </div>
        {arriba ? <div className="cp-cab-der">{arriba}</div> : null}
        {modo === 'listo' && (
          <div role="tablist" className="cp-vistas" aria-label="Qué ver">
            {(['funnel', 'semana', 'medir'] as const).map((v) => (
              <button key={v} type="button" role="tab" aria-selected={vista === v} onClick={() => setVista(v)}>{v === 'funnel' ? 'Tu funnel' : v === 'semana' ? 'Esta semana' : 'Qué medir'}</button>
            ))}
          </div>
        )}
      </header>

      <div className="cp-cuerpo">
        {(modo === 'charla' || vista === 'funnel') && (
          <>
            <div className="cp-bloque">
              <p className="cp-eti">Lo que MaKo sabe de tu negocio</p>
              <ul className="cp-datos">
                {ficha.sabe.map((x) => (
                  <li key={x.clave} className="cp-dato" data-nuevo={nuevos.has(x.clave) ? '1' : undefined}><span>{x.etiqueta}</span><b>{x.valor}</b></li>
                ))}
                {faltan.map((x) => (
                  <li key={x.clave}>
                    <button type="button" className="cp-dato cp-falta" disabled={!onPreguntar || ocupado} onClick={() => onPreguntar?.(x.clave)}
                      title={onPreguntar ? 'MaKo te lo pregunta en el chat' : undefined}>
                      <span>{x.imprescindible ? 'Falta' : 'Sumaría'}</span><b>{x.pregunta}</b>
                    </button>
                  </li>
                ))}
                {masFaltan > 0 && <li className="cp-dato cp-mas"><span>Y</span><b>{masFaltan} más</b></li>}
                {!ficha.sabe.length && !faltan.length && <li className="cp-vacio">Cuéntale a MaKo qué vendes.</li>}
              </ul>
            </div>

            <div className="cp-bloque">
              <div className="cp-bloque-cab">
                <p className="cp-eti">{comparar ? 'Los funnels para tu negocio' : 'El recorrido de tu cliente'}</p>
                <button type="button" className="cp-link" onClick={() => setComparar((c) => !c)} aria-pressed={comparar}>{comparar ? 'Volver al recorrido' : 'Comparar funnels'}</button>
              </div>
              {comparar ? (
                <ul className="cp-comparar">
                  {compararFunnels(perfil).map((c) => (
                    <li key={c.funnel.id} data-elegido={c.funnel.id === f?.id ? '1' : undefined} data-sirve={c.sirve == null ? undefined : c.sirve ? '1' : '0'}>
                      <div className="cp-comparar-nombre">
                        <b>{c.funnel.nombre}</b>
                        {recomendado?.funnel === c.funnel.id && <em>MaKo lo recomienda</em>}
                      </div>
                      <span className="cp-comparar-sirve">{c.sirve == null ? 'Faltan tus números' : c.sirve ? 'Te sirve' : c.motivo}</span>
                      <span className="cp-comparar-dato">Pide {c.pide}</span>
                      <span className="cp-comparar-dato">Tarda {c.tarda}</span>
                      {c.funnel.id === f?.id ? <span className="cp-comparar-ok">El tuyo</span>
                        : onFunnel ? <button type="button" className="cp-boton-sec" disabled={ocupado} onClick={() => { onFunnel(c.funnel.id); setComparar(false); }}>Elegir</button> : null}
                    </li>
                  ))}
                </ul>
              ) : recorrido.length ? (
                <ol className="cp-recorrido">
                  {recorrido.map((e, i) => (
                    <li key={e.id} className="cp-etapa" data-nuevo={funnelNuevo ? '1' : undefined}>
                      <span className="cp-etapa-n" aria-hidden>{i + 1}</span>
                      <h3>{e.titulo}</h3>
                      <p>{e.que}</p>
                      {e.accion ? <Link href={e.accion.href} className="cp-etapa-ir">{e.accion.texto}</Link> : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <ol className="cp-recorrido cp-recorrido--vacio" aria-label="Todavía sin funnel">
                  {['Atraer', 'Captar', 'Convencer', 'Cerrar'].map((t, i) => (
                    <li key={t} className="cp-etapa"><span className="cp-etapa-n" aria-hidden>{i + 1}</span><h3>{t}</h3><p>{i === 0 ? 'Cuando elijan el funnel, aquí aparece por dónde llega tu cliente.' : ' '}</p></li>
                  ))}
                </ol>
              )}
              {!comparar && otro && <p className="cp-aviso">Con tus números, MaKo recomendaría <b>{otro.nombre}</b>. <button type="button" className="cp-link" onClick={() => setComparar(true)}>Ver por qué</button></p>}
            </div>

            <div className="cp-dos">
              <div className="cp-bloque cp-caja">
                <p className="cp-eti">La cuenta</p>
                {cuenta ? (
                  <>
                    <dl className="cp-cuenta">{cuenta.lineas.map((l) => <div key={l.etiqueta} data-ojo={l.etiqueta === 'Ojo' ? '1' : undefined}><dt>{l.etiqueta}</dt><dd>{l.valor}</dd></div>)}</dl>
                    <p className="cp-nota">{cuenta.nota}</p>
                  </>
                ) : <p className="cp-nota">Con tu meta y lo que te deja una venta, aquí sale cuánto entra y cuánto puede costar cada cliente.</p>}
              </div>
              <div className="cp-bloque cp-caja">
                <p className="cp-eti">Esta semana</p>
                {semana.length ? (
                  <ul className="cp-semana">
                    {semana.slice(0, 4).map((t) => (
                      <li key={t.texto}><span>{t.texto}</span>{t.href ? <Link href={t.href} className="cp-boton-sec">{t.accion || 'Ir'}</Link> : null}</li>
                    ))}
                  </ul>
                ) : <p className="cp-nota">Cuando elijan el funnel, aquí quedan los primeros pasos y la pantalla de MaKo donde se hace cada uno.</p>}
              </div>
            </div>
          </>
        )}

        {modo === 'listo' && vista === 'semana' && (
          <ul className="cp-semana cp-semana--grande">
            {semana.map((t) => (
              <li key={t.texto} className="cp-caja"><div><b>{t.texto}</b>{t.detalle ? <p>{t.detalle}</p> : null}</div>{t.href ? <Link href={t.href} className="cp-boton">{t.accion || 'Ir'}</Link> : null}</li>
            ))}
          </ul>
        )}
        {modo === 'listo' && vista === 'medir' && (() => {
          const m = medirDe(f?.id, perfil);
          return (
            <div className="cp-caja cp-medir">
              <p className="cp-eti">El número que manda</p>
              <p className="cp-grande">{m.manda}</p>
              <ul>{m.medidas.map((x) => <li key={x.nombre}><b>{x.nombre}</b>: {x.que}{x.contexto ? <small> ({x.contexto})</small> : null}</li>)}</ul>
              <p className="cp-nota">Los leads y las llamadas de cada fuente están en el <Link href="/crm" className="cp-link">CRM</Link>.</p>
            </div>
          );
        })()}
      </div>

      <footer className="cp-pie">
        {modo === 'charla' ? (
          <>
            <p>Lo que decidan en la charla se ve aquí. Nada gasta plata hasta que lo apruebes.</p>
            <button type="button" className="cp-boton" disabled={!puedeUsar || ocupado || !onUsar} onClick={onUsar}>{f ? 'Usar este funnel' : 'Elige un funnel'}</button>
          </>
        ) : (
          <>
            <p>¿Cambió algo? Díselo a MaKo en el chat o vuelve a armarlo.</p>
            <Link href="/ads-manager?estrategia=1" className="cp-boton-sec">Cambiar mi estrategia</Link>
          </>
        )}
      </footer>
    </section>
  );
}
