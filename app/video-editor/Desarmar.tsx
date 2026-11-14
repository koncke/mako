'use client';

// =============================================================================
// «Desarmar»: el video de un outlier, plano a plano, listo para replicarlo (ticket 97, 14/11/2026)
// =============================================================================
// Martín (ticket 97): «extraer al 100 % con ingeniería inversa cómo está construido ese video, cómo está la edición, para
// después replicarlo». Va en la caja de un reel de Video Editor › Outliers (./OutliersVideo.tsx → TarjetaReel) y en la de un
// video de Competitors Spy (app/competitor-spy/DetallePieza.tsx). El trabajo lo hace /api/desarmar con el Gemini
// del negocio; lo desarmado queda guardado y no se vuelve a pagar.
//
// Lo que se ve: los números MEDIDOS (planos, un corte cada cuánto, el más corto), de qué está hecho (grabado, IA, código), la
// estructura, el gancho, cada plano con lo que se ve, lo que se dice y sus textos, los subtítulos (y el estilo del editor que
// se le parece), la música, la edición y la grabación. «Abrir en el editor» arma la plantilla «toca para reemplazar».
//
// Si el video no se puede traer (la clave de Apify de Spy da 401, o no hay), se dice y se ofrece SUBIRLO: el navegador sube el
// mp4 directo al bucket con un PUT firmado (Vercel corta un POST de más de ~4,5 MB) y la ruta lo desarma igual.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from '@/app/_ui/Link';
import { subirConProgreso } from '@/app/customer-success/curso/subir-video';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { BotonIntegracion } from '@/app/_components/ConectarIntegracion';
import {
  NOMBRE_ORIGEN, claveDeDesarme, duracionCorta, mezclaDeOrigen, ritmoDe, seDiceEn,
  type DesarmeGuardado, type FuenteDesarme, type OrigenPlano,
} from '@/lib/video-desarmar';
import d from './desarmar.module.css';
import { rutaAbrirDesarme } from './vista';

type Vista =
  | { estado: 'nada' }
  | { estado: 'mirando'; desde: string }
  | { estado: 'listo'; guardado: DesarmeGuardado }
  | { estado: 'fallo'; motivo: string };
type Respuesta = { ok?: boolean; editor?: boolean; vista?: Vista; estilo?: { id: string; nombre: string } | null; error?: string; motivo?: string; subir?: boolean };

const RUTA = '/api/desarmar';
const ESPERA_MS = 6_000;
const PLANOS_A_LA_VISTA = 8;
const coma = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');
const mayuscula = (x: string) => (x ? x[0].toLocaleUpperCase('es') + x.slice(1) : x);

async function pedir(cuerpo: Record<string, unknown>): Promise<Respuesta> {
  const r = await fetch(RUTA, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
  return ((await r.json().catch(() => null)) as Respuesta | null) ?? { ok: false, error: `No pude desarmarlo (HTTP ${r.status}).` };
}

/**
 * El aviso de que otro lado de la pantalla está desarmando ESTE video (`detail`: `{ clave, fin }`): «Hacer uno así» de Spy lo
 * desarma antes de copiar (app/competitor-spy/DetallePieza.tsx), y la caja de al lado lo muestra en vez de ofrecer «Desarmar».
 */
export const EVENTO_DESARME = 'mako:desarme';
export function avisarDesarme(clave: string, fin: boolean) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENTO_DESARME, { detail: { clave, fin } }));
}


export function Desarmar({ fuente, duracionS, editor }: {
  fuente: FuenteDesarme;
  duracionS: number | null;
  /** ¿Quien mira tiene el editor? (En el teléfono, o en Spy sin el Video Editor, no se ofrece abrirlo.) */
  editor: boolean;
}) {
  const clave = claveDeDesarme(fuente.red, fuente.id);
  const [vista, setVista] = useState<Vista | null>(null);
  const [estilo, setEstilo] = useState<{ id: string; nombre: string } | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  // `falla`: algo se rompió (va con «Reportar a Soporte»). Sin la clave o sin el video NO es una falla: se dice qué hacer.
  const [error, setError] = useState<{ texto: string; subir: boolean; sinGemini: boolean; falla: boolean } | null>(null);
  const [subida, setSubida] = useState<number | null>(null);
  // Lo dice la ruta: quien mira desde Spy sin el Video Editor no tiene a dónde abrirlo.
  const [tieneEditor, setTieneEditor] = useState(false);
  const montado = useRef(true);
  useEffect(() => () => { montado.current = false; }, []);

  const tomar = useCallback((j: Respuesta) => {
    if (!montado.current) return;
    if (j.vista) setVista(j.vista);
    if (j.editor !== undefined) setTieneEditor(!!j.editor);
    if (j.estilo !== undefined) setEstilo(j.estilo ?? null);
  }, []);

  // Lo que ya hay (sin pedir nada) al abrir la caja. Si la ruta no lo deja (quien mira no es administrador de Spy ni del
  // editor), el bloque no se dibuja: un título sin botón no dice nada.
  const [oculto, setOculto] = useState(false);
  useEffect(() => {
    if (!clave) return;
    let vivo = true;
    void pedir({ accion: 'ver', clave }).then((j) => { if (!vivo) return; if (j.ok) tomar(j); else setOculto(true); }).catch(() => { if (vivo) setVista({ estado: 'nada' }); });
    return () => { vivo = false; };
  }, [clave, tomar]);

  // Lo desarma «Hacer uno así» (el aviso de arriba): mientras, «Mirándolo…»; al terminar, lo que quedó.
  useEffect(() => {
    if (!clave) return;
    const alAviso = (e: Event) => {
      const d = (e as CustomEvent<{ clave?: string; fin?: boolean }>).detail;
      if (d?.clave !== clave) return;
      if (!d.fin) setVista((v) => (v?.estado === 'listo' ? v : { estado: 'mirando', desde: new Date().toISOString() }));
      else void pedir({ accion: 'ver', clave }).then(tomar).catch(() => null);
    };
    window.addEventListener(EVENTO_DESARME, alAviso);
    return () => window.removeEventListener(EVENTO_DESARME, alAviso);
  }, [clave, tomar]);

  // Mirándolo desde otra pestaña (o desde antes de cerrar la caja): se vuelve a mirar cada pocos segundos.
  useEffect(() => {
    if (!clave || vista?.estado !== 'mirando' || trabajando) return;
    const t = setTimeout(() => { void pedir({ accion: 'ver', clave }).then(tomar).catch(() => null); }, ESPERA_MS);
    return () => clearTimeout(t);
  }, [clave, vista, trabajando, tomar]);

  const desarmar = useCallback(async (subido?: string) => {
    setTrabajando(true);
    setError(null);
    try {
      const j = await pedir({ accion: 'desarmar', fuente, duracionS, ...(subido ? { subido } : {}) });
      if (!montado.current) return;
      if (j.ok) { tomar(j); return; }
      if (j.motivo === 'ocupado') { setVista({ estado: 'mirando', desde: new Date().toISOString() }); return; }
      setError({ texto: j.error ?? 'No pude desarmarlo.', subir: !!j.subir, sinGemini: j.motivo === 'sin-gemini', falla: j.motivo !== 'sin-gemini' && j.motivo !== 'sin-video' && j.motivo !== 'saturado' });
    } catch {
      if (montado.current) setError({ texto: 'Se cortó la conexión. Si cierras la caja, sigo mirándolo: vuelve en un par de minutos.', subir: false, sinGemini: false, falla: false });
    } finally {
      if (montado.current) setTrabajando(false);
    }
  }, [fuente, duracionS, tomar]);

  const subir = useCallback(async (archivo: File) => {
    setError(null);
    const tipo = archivo.type || (/\.mov$/i.test(archivo.name) ? 'video/quicktime' : 'video/mp4');
    const f = await pedir({ accion: 'subir-url', tamano: archivo.size, mime: tipo }) as Respuesta & { path?: string; signedUrl?: string; apikey?: string | null };
    if (!f.ok || !f.path || !f.signedUrl) { setError({ texto: f.error ?? 'No pude preparar la subida.', subir: true, sinGemini: false, falla: true }); return; }
    setSubida(0);
    try {
      await subirConProgreso(f.signedUrl, new File([archivo], archivo.name, { type: tipo }), f.apikey ?? null, (p) => setSubida(p), 'MP4, MOV o WEBM', { trabadaMs: 60_000 }).promesa;
    } catch (e) {
      setSubida(null);
      setError({ texto: e instanceof Error ? e.message : 'No pude subirlo.', subir: true, sinGemini: false, falla: false });
      return;
    }
    setSubida(null);
    await desarmar(f.path);
  }, [desarmar]);

  if (!clave || oculto) return null;
  const g = vista?.estado === 'listo' ? vista.guardado : null;
  const mirando = trabajando || vista?.estado === 'mirando';

  return (
    <section className={d.caja} aria-label="Desarmar el video">
      <div className={d.cabeza}>
        <h3>{g ? 'Desarmado, plano a plano' : 'Desarmar este video'}</h3>
        {!g && !mirando && vista && !error ? (
          <button type="button" className={d.boton} onClick={() => void desarmar()}>Desarmar</button>
        ) : null}
      </div>
      {!g && !mirando && !error ? <p>Tu Gemini lo mira entero: cortes, lo que se dice, textos, subtítulos y cómo se hizo cada plano.</p> : null}
      {mirando ? (
        <p className={d.vivo} role="status" aria-live="polite"><i aria-hidden />{subida != null ? `Subiendo el video… ${subida} %` : 'Mirándolo plano a plano: tarda uno o dos minutos.'}</p>
      ) : subida != null ? (
        <p className={d.vivo} role="status" aria-live="polite"><i aria-hidden />Subiendo el video… {subida} %</p>
      ) : null}
      {error ? (() => {
        const contenido = (
          <>
            <p>{error.texto}</p>
            <div className={d.acciones}>
              {/* Se conecta AHÍ, con el modal de la casa (tests/integracion-sin-salir): sin salir de la caja, y al pegarla, desarma. */}
              {error.sinGemini ? <BotonIntegracion servicio="gemini" className={d.secundario} onConectado={() => void desarmar()}>Pegar la clave de Gemini</BotonIntegracion> : null}
              {error.subir ? (
                <label className={d.boton}>
                  Subir el video
                  <input type="file" accept="video/mp4,video/quicktime,video/webm" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void subir(f); }} />
                </label>
              ) : null}
              {!error.sinGemini ? <button type="button" className={d.secundario} onClick={() => void desarmar()}>Intentar de nuevo</button> : null}
            </div>
          </>
        );
        // Una falla va con «Reportar a Soporte»; sin la clave o sin el video no es una falla: se dice qué hacer (`status`).
        return error.falla
          ? <div className={d.error} role="alert">{contenido}<ReportarASoporte /></div>
          : <div className={d.error} role="status">{contenido}</div>;
      })() : null}
      {vista?.estado === 'fallo' && !error && !mirando ? <p className={d.nota}>La última vez no pude: {vista.motivo}</p> : null}
      {g ? <Resultado g={g} clave={clave} estilo={estilo} editor={editor && tieneEditor} /> : null}
    </section>
  );
}

const COLOR_ORIGEN: Record<OrigenPlano, string> = { grabado: 'grabado', ia: 'ia', codigo: 'codigo' };

function Resultado({ g, clave, estilo, editor }: { g: DesarmeGuardado; clave: string; estilo: { id: string; nombre: string } | null; editor: boolean }) {
  const [todos, setTodos] = useState(false);
  const x = g.desarme;
  const r = ritmoDe(x);
  const mezcla = mezclaDeOrigen(x);
  const origenes = (Object.keys(mezcla) as OrigenPlano[]).filter((o) => mezcla[o].planos > 0);
  const planos = todos ? x.planos : x.planos.slice(0, PLANOS_A_LA_VISTA);
  const s = x.subtitulos;
  return (
    <>
      <div className={d.numeros}>
        <div><b>{r.planos}</b><span>{r.planos === 1 ? 'plano' : 'planos'} en {duracionCorta(x.duracionS)}</span></div>
        <div><b>{coma(r.planoMedioS)} s</b><span>un corte cada</span></div>
        <div><b>{coma(r.masCortoS)} s</b><span>el plano más corto</span></div>
      </div>
      <div className={d.mezcla} role="img" aria-label={origenes.map((o) => `${NOMBRE_ORIGEN[o]}: ${mezcla[o].planos} planos`).join(', ')}>
        {origenes.map((o) => (
          <span key={o} data-origen={COLOR_ORIGEN[o]} style={{ flexGrow: mezcla[o].segundos, flexBasis: 0 }}>{NOMBRE_ORIGEN[o]} · {mezcla[o].planos}</span>
        ))}
      </div>
      {/* Lo que se hace con esto, arriba: la lista de planos puede ser larga (mirado a 1440 el 14/11/2026). */}
      <div className={d.acciones}>
        {editor ? <Link href={rutaAbrirDesarme(clave)} className={d.boton}>Abrir en el editor</Link> : null}
        <a href={`${RUTA}?clave=${encodeURIComponent(clave)}&bajar=videomd`} className={d.secundario} download title={`Lo miró ${g.miro.modelo} a ${g.miro.fps} cuadros por segundo. Formato abierto VIDEO.md.`}>Bajar VIDEO.md</a>
      </div>

      <div className={d.bloque}>
        <h4>Estructura</h4>
        <div className={d.estructura}>
          {x.estructura.map((b) => (
            <span key={`${b.nombre}-${b.desde}`} style={{ flexGrow: Math.max(0.5, b.hasta - b.desde), flexBasis: 0 }} title={b.que}>
              <b>{mayuscula(b.nombre)}</b><small>{coma(b.desde)}–{coma(b.hasta)} s</small>
            </span>
          ))}
        </div>
      </div>

      {x.gancho.texto || x.gancho.porQueFunciona ? (
        <div className={d.bloque}>
          <h4>El gancho (0–{coma(x.gancho.hastaS)} s)</h4>
          {x.gancho.texto ? <p className={d.cita}>«{x.gancho.texto}»</p> : null}
          {x.gancho.porQueFunciona ? <p>{x.gancho.porQueFunciona}</p> : null}
        </div>
      ) : null}

      <div className={d.bloque}>
        <h4>Plano a plano</h4>
        <ol className={d.planos}>
          {planos.map((p) => {
            const dice = seDiceEn(p, x.frases);
            const textos = x.textos.filter((t) => t.desde < p.hasta && t.hasta > p.desde);
            return (
              <li key={p.n}>
                <div className={d.planoCabeza}>
                  <b>{p.n}</b>
                  <span className={d.tiempo}>{coma(p.desde)}–{coma(p.hasta)} s</span>
                  <span className={d.origen} data-origen={COLOR_ORIGEN[p.origen]} title={p.porQueOrigen}>{NOMBRE_ORIGEN[p.origen]}</span>
                  {p.broll ? <span className={d.marca}>B-roll</span> : null}
                  {p.zoom !== 'ninguno' ? <span className={d.marca}>Zoom {p.zoom}</span> : null}
                </div>
                {p.seVe ? <p>{p.seVe}</p> : null}
                {dice ? <p className={d.dice}>«{dice}»</p> : null}
                {textos.map((t) => <p key={`${t.desde}-${t.texto}`} className={d.textoPantalla}>{t.texto}</p>)}
              </li>
            );
          })}
        </ol>
        {x.planos.length > PLANOS_A_LA_VISTA ? (
          <button type="button" className={d.mas} onClick={() => setTodos((v) => !v)}>{todos ? 'Ver menos' : 'Ver más'}</button>
        ) : null}
      </div>

      <div className={d.bloque}>
        <h4>Subtítulos</h4>
        <p>{s.hay ? (s.descripcion || 'Lleva subtítulos.') : 'No lleva subtítulos.'}</p>
        {s.hay && estilo ? <p>En el editor: el estilo <b>{estilo.nombre}</b>.</p> : null}
      </div>

      <div className={d.bloque}>
        <h4>Música y ritmo</h4>
        <p>{x.musica.hay ? x.musica.descripcion || 'Lleva música.' : 'Sin música.'}{x.ritmo.descripcion ? ` ${x.ritmo.descripcion}` : ''}</p>
      </div>

      {x.edicion.length ? (
        <div className={d.bloque}>
          <h4>La edición, en el editor de MaKo</h4>
          <ol className={d.pasos}>{x.edicion.map((p) => <li key={p}>{p}</li>)}</ol>
        </div>
      ) : null}
      {x.grabarConAvatar.length ? (
        <div className={d.bloque}>
          <h4>Grabarlo con tu avatar de IA</h4>
          <ol className={d.pasos}>{x.grabarConAvatar.map((p) => <li key={p}>{p}</li>)}</ol>
        </div>
      ) : null}
      {x.grabarConPersona.length ? (
        <div className={d.bloque}>
          <h4>Si lo graba otra persona</h4>
          <ol className={d.pasos}>{x.grabarConPersona.map((p) => <li key={p}>{p}</li>)}</ol>
        </div>
      ) : null}
      {x.dudas.length ? (
        <div className={d.bloque}>
          <h4>Lo que no pude ver</h4>
          <ul className={d.pasos}>{x.dudas.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      ) : null}

    </>
  );
}
