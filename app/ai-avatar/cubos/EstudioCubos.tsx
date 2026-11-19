'use client';

// =============================================================================
// AI Avatar › Personaje en cubos — el estudio (19/11/2026)
// =============================================================================
// Martín, 19/11: el video animado por código, «súper, súper simple», para los usuarios de MaKo. El diseño:
// docs/editor-video/ai-avatar-por-codigo.md. Lo ve sólo la revisión (lib/ai-avatar/cubos-interruptor.ts).
//
// LA PANTALLA COPIA EL ESTUDIO «AI INFLUENCER» DE HIGGSFIELD (capturas-ai-avatar-2910/01-higgsfield-ai-influencer.jpg, en
// las notas del Cerebro), que es la referencia de todo AI Avatar: el constructor a la izquierda (el título en mayúsculas, dos
// pestañas —su «Create Influencer | Motion» es acá «Tu personaje | Video»—, la foto arriba, las partes en secciones con su
// grilla y «Generate» abajo con su costo) y, a la derecha, lo que se crea. Los colores son los de MaKo (`var(--token)`).
//
// Qué hace cada cosa y qué gasta:
//   · el personaje se ve EN VIVO en la plantilla del formato (sin gastar): cada cambio vuelve a dibujarla;
//   · «Leer mi foto» y «Que lo escriba MaKo» usan la IA (pocos MaKo Tokens, ./actions.ts);
//   · «Crear video» genera la voz con sus tiempos (MaKo Tokens con una voz de MaKo; su clon lo paga su cuenta);
//   · «Descargar MP4» lo arma ESTE navegador (./mp4.ts): no toca el servidor.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { inicioCubosAction, guionCubosAction, personajeDesdeFotoAction, crearVideoCubosAction, cambiarCubosAction, borrarCubosAction, type InicioCubos, type ProyectoConVoz } from './actions';
import { armarMp4, esperarPlantilla, prepararVoz } from './mp4';
import { FORMATOS_CUBOS, formatoCubos, frasesDeTexto, normalizarGuion, datosDeMarcas, textoConMarcas, MAX_PALABRAS, type IdFormato } from '@/lib/ai-avatar/cubos-formatos';
import { PARTES_PERSONAJE, PERSONAJE_MARTIN, PIELES, PELOS, ROPAS, OJOS, resolverPersonaje, type Personaje } from '@/lib/ai-avatar/cubos-personaje';
import { apretar, palabrasDelGuion, textoParaVoz, type Tiempos } from '@/lib/ai-avatar/cubos-tiempos';
import { mtDeVoz } from '@/lib/mako-tokens-reglas';
import { Icon } from '@/app/_components/icons';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import './cubos.css';

type Voz = { tipo: 'mako'; id: string } | { tipo: 'clon' } | { tipo: 'audio' };
type Lista = { tiempos: Tiempos; wav: string; buffer: AudioBuffer };
type W = Window & { __CUBOS?: Record<string, unknown> };

/** Los colores de cada muestra (las partes con color; el peinado va en texto). */
const COLOR_DE: Record<string, Record<string, string>> = {
  piel: Object.fromEntries(PIELES.map((x) => [x.clave, x.skin])),
  pelo: Object.fromEntries(PELOS.map((x) => [x.clave, x.hair])),
  ropa: Object.fromEntries(ROPAS.map((x) => [x.clave, x.tee])),
  ojos: Object.fromEntries(OJOS.map((x) => [x.clave, x.iris])),
};

let serie = 0;
/** Deja los datos para la plantilla en `window.__CUBOS` (public/avatar-cubos/kit/datos.js los lee de su página madre). */
function dejarDatos(d: Record<string, unknown>): string {
  const w = window as W;
  w.__CUBOS = w.__CUBOS || {};
  const clave = `c${Date.now().toString(36)}${(serie++).toString(36)}`;
  w.__CUBOS[clave] = d;
  return clave;
}

export function EstudioCubos({ alVolver }: { alVolver: () => void }) {
  const [inicio, setInicio] = useState<InicioCubos | null>(null);
  const [errorInicio, setErrorInicio] = useState('');
  const [pestana, setPestana] = useState<'personaje' | 'video'>('personaje');
  const [personaje, setPersonaje] = useState<Personaje>(PERSONAJE_MARTIN);
  const [fotoId, setFotoId] = useState('');
  const [formato, setFormato] = useState<IdFormato>('punch-captions');
  const [texto, setTexto] = useState('');
  const [idea, setIdea] = useState('');
  const [voz, setVoz] = useState<Voz>({ tipo: 'mako', id: 'mako-david' });
  const [audio, setAudio] = useState<File | null>(null);
  const [proyectos, setProyectos] = useState<ProyectoConVoz[]>([]);
  const [actual, setActual] = useState<ProyectoConVoz | null>(null);
  const [lista, setLista] = useState<Lista | null>(null);
  const [ocupado, setOcupado] = useState<'' | 'foto' | 'guion' | 'crear' | 'voz'>('');
  const [error, setError] = useState('');
  const [avance, setAvance] = useState<{ hechos: number; total: number } | null>(null);
  const cancelar = useRef(false);

  useEffect(() => {
    void inicioCubosAction().then((r) => {
      if (!r.ok) { setErrorInicio(r.error); return; }
      setInicio(r); setProyectos(r.proyectos); setFotoId(r.fotos[0]?.id ?? '');
      if (r.voces[0]) setVoz({ tipo: 'mako', id: r.voces[0].id }); else if (r.clon) setVoz({ tipo: 'clon' });
      if (r.proyectos[0]) setPersonaje(r.proyectos[0].personaje);
    });
  }, []);

  // ── la voz del video abierto: sin silencios largos, a -14 LUFS, y sus tiempos corridos igual (como la galería) ──
  useEffect(() => {
    setLista(null);
    if (!actual?.url) return;
    let vivo = true;
    setOcupado('voz');
    const { tiempos, cortes } = apretar(actual.tiempos);
    prepararVoz(actual.url, cortes)
      .then((v) => { if (vivo) setLista({ tiempos, wav: URL.createObjectURL(v.wav), buffer: v.buffer }); })
      .catch(() => { if (vivo) setError('No pude bajar la voz de este video.'); })
      .finally(() => { if (vivo) setOcupado(''); });
    return () => { vivo = false; };
  }, [actual?.id, actual?.url]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── lo que dibuja la plantilla: el video abierto, o el ejemplo del formato con SU personaje ──
  const fmt = formatoCubos(actual?.formato ?? formato) ?? FORMATOS_CUBOS[0];
  const datosVista = useMemo(() => {
    const p = resolverPersonaje(personaje);
    if (actual && lista) return { tiempos: lista.tiempos, datos: actual.datos, personaje: p, voz: lista.wav };
    return { personaje: p };   // el ejemplo de la galería: sus tiempos, su voz y sus datos
  }, [personaje, actual, lista]);
  const clave = useMemo(() => dejarDatos(datosVista), [datosVista]);

  // ── el personaje y el formato de un video ya creado se guardan solos (no gastan) ──
  const guardarCambio = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cambiar = useCallback((c: { personaje?: Personaje; formato?: IdFormato }) => {
    if (!actual) return;
    if (c.formato) setActual((a) => (a ? { ...a, formato: c.formato! } : a));
    if (guardarCambio.current) clearTimeout(guardarCambio.current);
    guardarCambio.current = setTimeout(() => {
      void cambiarCubosAction({ id: actual.id, ...c }).then((r) => {
        if (!r.ok) { setError(r.error); return; }
        setActual((a) => (a && a.id === r.proyecto.id ? { ...r.proyecto, url: a.url } : a));
        setProyectos((ps) => ps.map((x) => (x.id === r.proyecto.id ? { ...r.proyecto, url: x.url } : x)));
      });
    }, c.formato ? 0 : 700);
  }, [actual]);
  const elegirParte = (clave: keyof Personaje, valor: string | boolean) => {
    const p = { ...personaje, [clave]: valor } as Personaje;
    setPersonaje(p); cambiar({ personaje: p });
  };
  const elegirFormato = (f: IdFormato) => { setFormato(f); if (actual) cambiar({ formato: f }); };

  // ── las acciones con IA y la voz ──
  const leerFoto = async () => {
    if (!fotoId) return;
    setOcupado('foto'); setError('');
    const r = await personajeDesdeFotoAction(fotoId);
    setOcupado('');
    if (!r.ok) { setError(r.error); return; }
    setPersonaje(r.personaje); cambiar({ personaje: r.personaje });
  };
  const escribirGuion = async () => {
    setOcupado('guion'); setError('');
    const r = await guionCubosAction({ formato, idea });
    setOcupado('');
    if (!r.ok) { setError(r.error); return; }
    setTexto(textoConMarcas(formato, r.frases, r.datos));   // lo que eligió la IA queda a la vista, como *marcas*
  };
  const frases = frasesDeTexto(texto);
  const guion = normalizarGuion(frases);
  const palabras = guion.ok ? palabrasDelGuion(guion.escenas) : 0;
  // las palabras entre *asteriscos*: las que resalta la persona (sin marcas, MaKo elige solo las fuertes)
  const marcadas = datosDeMarcas(formato, texto, inicio?.marca ?? 'MaKo');
  const costoVoz = guion.ok && voz.tipo === 'mako' ? mtDeVoz(textoParaVoz(guion.escenas).length) : 0;
  const crear = async () => {
    if (!guion.ok) { setError(guion.error); setPestana('video'); return; }
    setOcupado('crear'); setError('');
    let r: { ok: true; proyecto: ProyectoConVoz } | { ok: false; error: string };
    if (voz.tipo === 'audio') {
      if (!audio) { setOcupado(''); setError('Sube tu audio.'); return; }
      const fd = new FormData();
      fd.append('file', audio); fd.append('frases', JSON.stringify(frases)); fd.append('formato', formato);
      fd.append('personaje', JSON.stringify(personaje)); if (marcadas) fd.append('datos', JSON.stringify(marcadas));
      fd.append('segundos', String(await duracionDe(audio).catch(() => 0)));
      r = await fetch('/api/ai-avatar/cubos/alinear', { method: 'POST', body: fd }).then((x) => x.json()).catch(() => ({ ok: false as const, error: 'No pude subir tu audio.' }));
    } else {
      r = await crearVideoCubosAction({ formato, frases, datos: marcadas ?? undefined, personaje, voz });
    }
    setOcupado('');
    if (!r.ok) { setError(r.error); return; }
    const nuevo = r.proyecto;
    setProyectos((ps) => [nuevo, ...ps.filter((x) => x.id !== nuevo.id)]);
    setActual(nuevo);
  };
  const abrir = (p: ProyectoConVoz) => {
    setActual(p); setPersonaje(p.personaje); setFormato(p.formato); setTexto(textoConMarcas(p.formato, p.escenas.map((e) => e.texto), p.datos)); setError('');
  };
  const borrar = async (p: ProyectoConVoz) => {
    if (!window.confirm('¿Borrar este video? Su voz no se recupera.')) return;
    const r = await borrarCubosAction(p.id);
    if (!r.ok) { setError(r.error); return; }
    setProyectos((ps) => ps.filter((x) => x.id !== p.id));
    if (actual?.id === p.id) setActual(null);
  };

  // ── el MP4: una plantilla escondida en modo captura, cuadro por cuadro, en este navegador ──
  const descargar = async () => {
    if (!actual || !lista) return;
    setError(''); cancelar.current = false; setAvance({ hechos: 0, total: 1 });
    const ifr = document.createElement('iframe');
    ifr.className = 'cb-captura'; ifr.setAttribute('aria-hidden', 'true'); ifr.tabIndex = -1;
    ifr.src = `${fmt.pagina}?cap#${clave}`;
    document.body.appendChild(ifr);
    try {
      const ventana = await esperarPlantilla(ifr);
      const blob = await armarMp4({ ventana, dur: lista.tiempos.anchors.end, voz: lista.buffer, alAvanzar: (hechos, total) => setAvance({ hechos, total }), cancelado: () => cancelar.current });
      if (blob) {
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `personaje-en-cubos-${fmt.id}.mp4`;
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
      }
    } catch (e) {
      setError(e instanceof Error ? `No se pudo armar el MP4: ${e.message}` : 'No se pudo armar el MP4.');
    } finally {
      ifr.remove(); setAvance(null);
    }
  };

  if (errorInicio) return <div className="cb-vacio">{errorInicio}</div>;
  if (!inicio) return <div className="cb-vacio">Cargando…</div>;

  const vozElegida = voz.tipo === 'mako' ? inicio.voces.find((v) => v.id === voz.id)?.nombre : voz.tipo === 'clon' ? inicio.clon : 'tu audio';
  const pieCrear = voz.tipo === 'mako' ? (costoVoz ? `${costoVoz} MaKo Tokens` : 'Escribe el guion') : voz.tipo === 'clon' ? 'Con tu cuenta de ElevenLabs' : 'Tu audio · 1 MaKo Token';

  return (
    <div className="cb">
      <aside className="cb-panel" aria-label="Crear tu personaje">
        <button type="button" className="cb-volver" onClick={alVolver}>← AI Avatar</button>
        <p className="cb-sobre">Tu personaje animado, con tu voz</p>
        <h2 className="cb-titulo">PERSONAJE EN CUBOS</h2>
        <div className="cb-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={pestana === 'personaje'} onClick={() => setPestana('personaje')}>Tu personaje</button>
          <button type="button" role="tab" aria-selected={pestana === 'video'} onClick={() => setPestana('video')}>Video</button>
        </div>

        {pestana === 'personaje' ? (
          <div className="cb-secciones">
            <Seccion titulo="Tu foto">
              {inicio.fotos.length ? (
                <>
                  <div className="cb-fotos">
                    {inicio.fotos.slice(0, 6).map((f) => (
                      <button key={f.id} type="button" className="cb-foto" aria-pressed={f.id === fotoId} onClick={() => setFotoId(f.id)}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f.url} alt="" />
                      </button>
                    ))}
                  </div>
                  <button type="button" className="cb-boton" disabled={!fotoId || ocupado !== ''} onClick={() => void leerFoto()}>
                    {ocupado === 'foto' ? 'Mirando tu foto…' : 'Armar con mi foto'}
                  </button>
                  <p className="cb-nota">Usa unos {inicio.costos.foto} MaKo Tokens.</p>
                </>
              ) : <p className="cb-nota">No hay fotos tuyas todavía: elige las partes abajo.</p>}
            </Seccion>
            {PARTES_PERSONAJE.map((parte) => (
              <Seccion key={parte.clave} titulo={parte.nombre}>
                <div className="cb-muestras">
                  {parte.opciones.map((o) => {
                    const color = COLOR_DE[parte.clave]?.[o.clave];
                    return (
                      <button key={o.clave} type="button" className={color ? 'cb-color' : 'cb-chip'} aria-pressed={personaje[parte.clave as keyof Personaje] === o.clave}
                        title={o.nombre} aria-label={color ? o.nombre : undefined} style={color ? { background: color } : undefined}
                        onClick={() => elegirParte(parte.clave as keyof Personaje, o.clave)}>{color ? null : o.nombre}</button>
                    );
                  })}
                </div>
              </Seccion>
            ))}
            <Seccion titulo="Detalles">
              <div className="cb-muestras">
                <button type="button" className="cb-chip" aria-pressed={personaje.anteojos} onClick={() => elegirParte('anteojos', !personaje.anteojos)}>Lentes</button>
                <button type="button" className="cb-chip" aria-pressed={personaje.barba} onClick={() => elegirParte('barba', !personaje.barba)}>Barba</button>
              </div>
            </Seccion>
          </div>
        ) : (
          <div className="cb-secciones">
            <Seccion titulo="Formato">
              <div className="cb-formatos">
                {FORMATOS_CUBOS.map((f) => (
                  <button key={f.id} type="button" className="cb-formato" aria-pressed={(actual?.formato ?? formato) === f.id} onClick={() => elegirFormato(f.id)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.poster} alt="" />
                    <span className="cb-formato-texto"><strong>{f.nombre}</strong><span>{f.linea}</span></span>
                  </button>
                ))}
              </div>
            </Seccion>
            <Seccion titulo="Guion">
              <div className="cb-idea">
                <input value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Idea del video en una línea" maxLength={300} />
                <button type="button" className="cb-boton" disabled={idea.trim().length < 4 || ocupado !== ''} onClick={() => void escribirGuion()}>
                  {ocupado === 'guion' ? 'Escribiendo…' : 'Que lo escriba MaKo'}
                </button>
                <span className="cb-nota">Usa unos {inicio.costos.guion} MaKo Tokens.</span>
              </div>
              <textarea className="cb-guion" value={texto} rows={7} onChange={(e) => setTexto(e.target.value)}
                placeholder={'Una frase por renglón.\nEjemplo: Hay una sola *cosa* que separa a quien vende de quien no.'} />
              <p className="cb-nota">Las palabras entre *asteriscos* van resaltadas.</p>
              <p className={palabras > MAX_PALABRAS ? 'cb-nota cb-nota--mal' : 'cb-nota'}>{palabras} de {MAX_PALABRAS} palabras · unos {Math.round(palabras / 2.6)} s</p>
            </Seccion>
            <Seccion titulo="Voz">
              <div className="cb-muestras">
                {inicio.voces.map((v) => (
                  <button key={v.id} type="button" className="cb-chip" aria-pressed={voz.tipo === 'mako' && voz.id === v.id} onClick={() => setVoz({ tipo: 'mako', id: v.id })}>{v.nombre}</button>
                ))}
                {inicio.clon ? <button type="button" className="cb-chip" aria-pressed={voz.tipo === 'clon'} onClick={() => setVoz({ tipo: 'clon' })}>Tu voz</button> : null}
                <button type="button" className="cb-chip" aria-pressed={voz.tipo === 'audio'} onClick={() => setVoz({ tipo: 'audio' })}>Subir audio</button>
              </div>
              {voz.tipo === 'audio' ? (
                <label className="cb-subir">
                  <input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav" onChange={(e) => setAudio(e.target.files?.[0] ?? null)} />
                  <span>{audio ? audio.name : 'Tu audio dice el guion tal cual (MP3, hasta 4 MB)'}</span>
                </label>
              ) : null}
            </Seccion>
          </div>
        )}

        <div className="cb-generar">
          {error ? <p className="cb-error" role="alert">{error}<ReportarASoporte /></p> : null}
          <button type="button" className="cb-crear" disabled={ocupado !== '' || !guion.ok || palabras > MAX_PALABRAS} onClick={() => void crear()}>
            {ocupado === 'crear' ? 'Creando la voz…' : 'Crear video'}
          </button>
          <span className="cb-pie">{guion.ok ? `${pieCrear}${vozElegida ? ` · voz: ${vozElegida}` : ''}` : 'Escribe el guion en Video'}</span>
        </div>
      </aside>

      <section className="cb-escena" aria-label="Tu video">
        <div className="cb-marco">
          <iframe key={`${fmt.id}-${clave}`} title={fmt.nombre} src={`${fmt.pagina}#${clave}`} className="cb-plantilla" />
        </div>
        <div className="cb-acciones">
          {actual ? (
            avance ? (
              <>
                <div className="cb-barra" role="progressbar" aria-valuenow={Math.round((avance.hechos / avance.total) * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <i style={{ width: `${(avance.hechos / avance.total) * 100}%` }} />
                </div>
                <span className="cb-pie">Armando tu MP4… {Math.round((avance.hechos / avance.total) * 100)} %</span>
                <button type="button" className="cb-chip" onClick={() => { cancelar.current = true; }}>Cancelar</button>
              </>
            ) : (
              <>
                <button type="button" className="cb-crear" disabled={!lista} onClick={() => void descargar()}>{lista ? 'Descargar MP4' : 'Preparando la voz…'}</button>
                <span className="cb-pie">Se arma en tu computadora: deja esta pestaña abierta.</span>
              </>
            )
          ) : <span className="cb-pie">Así se ve tu personaje. Escribe el guion y crea tu video.</span>}
        </div>
        {proyectos.length ? (
          <div className="cb-historial">
            <h3>Tus videos</h3>
            <ul>
              {proyectos.map((p) => (
                <li key={p.id} className={actual?.id === p.id ? 'is-actual' : undefined}>
                  <button type="button" className="cb-video" onClick={() => abrir(p)}>
                    <strong>{p.escenas[0]?.texto ?? 'Video'}</strong>
                    <span>{formatoCubos(p.formato)?.nombre} · {p.voz.nombre}</span>
                  </button>
                  <button type="button" className="cb-borrar" aria-label="Borrar este video" title="Borrar" onClick={() => void borrar(p)}><Icon name="trash" size={16} /></button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="cb-seccion">
      <h3>{titulo}</h3>
      {children}
    </section>
  );
}

/** Lo que dura un audio, medido en el navegador (para cobrar la alineación por segundo). */
function duracionDe(f: File): Promise<number> {
  return new Promise((ok, mal) => {
    const a = document.createElement('audio'); const u = URL.createObjectURL(f);
    a.preload = 'metadata'; a.src = u;
    a.onloadedmetadata = () => { URL.revokeObjectURL(u); ok(Number.isFinite(a.duration) ? a.duration : 0); };
    a.onerror = () => { URL.revokeObjectURL(u); mal(new Error('audio')); };
  });
}
