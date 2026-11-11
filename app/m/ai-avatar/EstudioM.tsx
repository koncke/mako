'use client';

// =============================================================================
// /m/ai-avatar — el estudio de Higgsfield en el teléfono
// =============================================================================
// La pantalla de escritorio (app/ai-avatar/Estudio.tsx) destilada, con la MISMA estructura (AGENTS.md: «el teléfono
// destila el escritorio, no lo rediseña»): los proyectos en una tira con «Nueva» primero; «Nueva» con «¿Qué vas a crear
// hoy?», las categorías y los presets; la barra abajo (personaje, preset, Modelo · Formato · Cantidad, el texto y
// Generar); y un proyecto con su look, sus videos y la barra del video. Referencia de app real: Higgsfield en el
// navegador del teléfono (la barra de prompt fija abajo y la galería en dos columnas), relevada el 29/10/2026.
// El chat de MaKo no va a la izquierda: en el teléfono es su pestaña de la barra de abajo.
//
// ⚠️ GASTAR CRÉDITOS DE FLOW DESDE EL TELÉFONO: sólo si la persona lo pide, con el botón que lo dice y la consecuencia
//    pegada arriba («Cada toma gasta créditos de tu cuenta de Flow»). Nada se filma solo, y el puente (la extensión de
//    MaKo en la computadora) tiene que estar vivo: si no, el botón está apagado con el motivo. Las tomas se filman
//    mientras esta pantalla esté abierta (el lazo corre en el navegador: app/ai-avatar/filmar.ts). El look es gratis.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Button, ButtonLink } from '@/app/_ui/Button';
import { Icon } from '@/app/_components/icons';
import type { InicioOut, LookCard } from '@/app/ai-avatar/actions';
import { crearLookAction, estadoLookAction, crearVideoAction, borrarLookAction } from '@/app/ai-avatar/actions';
import { filmarTomas, SONDEO_MS, type TomaAvatar } from '@/app/ai-avatar/filmar';
import { rutaEditarEnEditor } from '@/app/video-editor/desde/desde';
import { avisarPuente } from '@/app/video-generator/avisar-puente';
import { CATEGORIAS, filtrarPresets, plantillaPorId, type Categoria, type PlantillaAvatar } from '@/lib/ai-avatar/plantillas';
import { MAX_DETALLE } from '@/lib/ai-avatar/prompt-look';
import { haceCuanto, mezclarPorId, segundosDeGuion } from '@/lib/ai-avatar/proyectos';
import { CONSEJO_FOTO, MODELO, SIN_MOTOR, TONO_CATEGORIA, type PiezaSinMotor } from '@/lib/ai-avatar/estudio';
import { PieFijoM, SeccionM, SheetM, useConexion } from '@/app/m/_ui';
import { CREDITOS, requisitosAvatar, type PasoRequisito } from '@/lib/ai-avatar/requisitos';
import { CampoM, ErrorLineaM } from '../_creacion/escritor';
import { descargarComo } from '@/app/video-generator/descargar';
import { nombreDeArchivo } from '@/lib/ai-avatar/descarga';
import { ChipM, ChipsM } from './piezas';

type Inicio = Extract<InicioOut, { ok: true }>;
type Filtro = Categoria | 'Nuevos' | null;

function fondoDe(p: PlantillaAvatar | null): CSSProperties | undefined {
  if (!p) return undefined;
  const [a, b] = TONO_CATEGORIA[p.categoria];
  return { background: `linear-gradient(160deg, ${a}, ${b})` };
}

/** La query, como en escritorio: `?avatar=` un proyecto, `?plantilla=` el preset de «Nueva». Sólo se toca la query. */
function escribirQuery(proyectoId: string | null, presetId: string | null) {
  const url = new URL(window.location.href);
  url.searchParams.delete('avatar');
  url.searchParams.delete('plantilla');
  if (proyectoId) url.searchParams.set('avatar', proyectoId);
  else if (presetId) url.searchParams.set('plantilla', presetId);
  window.history.replaceState(window.history.state, '', url.toString());
}

export function EstudioM({ inicio, plantillaInicial, avatarInicial, ahora }: {
  inicio: Inicio; plantillaInicial?: string; avatarInicial?: string; ahora: number;
}) {
  const { enLinea } = useConexion();
  const [looks, setLooks] = useState<LookCard[]>(inicio.looks);
  // Al refrescar (tirar hacia abajo) llega un `inicio` nuevo: se suma sin perder lo recién creado.
  useEffect(() => { setLooks((ls) => mezclarPorId(ls, inicio.looks)); }, [inicio.looks]);
  const [fotos, setFotos] = useState(inicio.fotos);
  const inicial = avatarInicial ? inicio.looks.find((l) => l.id === avatarInicial || (l.mediaId && l.mediaId === avatarInicial)) : undefined;
  const [abiertoId, setAbiertoId] = useState<string | null>(inicial?.id ?? null);
  const [presetId, setPresetId] = useState<string | null>(plantillaPorId(plantillaInicial ?? '')?.id ?? null);
  const [fotoId, setFotoId] = useState(inicio.fotos[0]?.id ?? '');
  const [detalle, setDetalle] = useState('');
  const [hoja, setHoja] = useState<null | 'personaje'>(null);
  const [linea, setLinea] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { escribirQuery(abiertoId, presetId); }, [abiertoId, presetId]);
  // «No disponible todavía» se va solo: si se queda, tapa lo que FALTA para generar (como en la computadora, 10/11/2026).
  useEffect(() => {
    if (!(Object.values(SIN_MOTOR) as string[]).includes(linea)) return;
    const t = setTimeout(() => setLinea(''), 6000);
    return () => clearTimeout(t);
  }, [linea]);

  const generando = looks.filter((l) => l.estado === 'generando').map((l) => l.id).join(',');
  useEffect(() => {
    if (!generando) return;
    const ids = generando.split(',');
    const t = setInterval(() => {
      avisarPuente();
      for (const id of ids) void estadoLookAction(id).then((r) => { if (r.ok) setLooks((ls) => ls.map((l) => (l.id === id ? { ...r.look, videos: l.videos } : l))); });
    }, SONDEO_MS);
    return () => clearInterval(t);
  }, [generando]);

  const abierto = abiertoId ? looks.find((l) => l.id === abiertoId) ?? null : null;
  const reqAvatar = requisitosAvatar({ puente: inicio.puente, instalada: null, enTelefono: true, fotos: fotos.length, para: 'avatar' });
  const preset = presetId ? plantillaPorId(presetId) : null;
  const foto = fotos.find((f) => f.id === fotoId) ?? null;

  const generarLook = useCallback(async (p: { plantillaId: string; fotoId: string; detalle: string }) => {
    if (enviando) return;
    setEnviando(true); setError('');
    try {
      const r = await crearLookAction(p);
      if (!r.ok) { setError(r.error); return; }
      avisarPuente();
      setLooks((ls) => [r.look, ...ls]);
      setAbiertoId(r.look.id);
      setDetalle('');
    } catch {
      setError('No se pudo pedir el avatar. Revisa tu conexión y vuelve a intentar.');
    } finally {
      setEnviando(false);
    }
  }, [enviando]);

  return (
    <>
      {/* Los proyectos: «Nueva» primero, después cada look (la columna de escritorio, en una tira). */}
      <div className="m-ai-avatar-tira" role="list" aria-label="Tus proyectos" data-m-sin-pull>
        <button type="button" role="listitem" className="m-ai-avatar-tira__nueva" aria-current={!abierto ? 'page' : undefined} onClick={() => { setAbiertoId(null); setError(''); }}>
          <Icon name="plus" size={20} /><span>Nueva</span>
        </button>
        {looks.map((l) => (
          <button key={l.id} type="button" role="listitem" className="m-ai-avatar-tira__proyecto" aria-current={abiertoId === l.id ? 'page' : undefined}
            onClick={() => { setAbiertoId(l.id); setError(''); }} aria-label={l.nombre}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {l.url ? <img src={l.url} alt="" loading="lazy" /> : <span className={l.estado === 'generando' ? 'm-ai-avatar-brillo' : undefined} style={fondoDe(plantillaPorId(l.plantillaId))} />}
          </button>
        ))}
      </div>

      {abierto
        ? <ProyectoM key={abierto.id} p={abierto} inicio={inicio} ahora={ahora} enLinea={enLinea} enviando={enviando} error={error}
          onRecrear={() => void generarLook({ plantillaId: abierto.plantillaId, fotoId: abierto.fotoId, detalle: abierto.detalle })}
          onEliminar={async () => {
            const r = await borrarLookAction(abierto.id);
            if (!r.ok) { setError(r.error); return; }
            setLooks((ls) => ls.filter((l) => l.id !== abierto.id));
            setAbiertoId(null);
          }} />
        : (
          <>
            <NuevaM looks={looks} presetId={presetId} onPreset={setPresetId} />
            {/* Lo que es de la persona (la extensión, su Flow, su foto), paso a paso y ANTES de «Generar». */}
            {!reqAvatar.listo && <RequisitosM pasos={reqAvatar.pasos} />}
            {error && <ErrorLineaM>{error}</ErrorLineaM>}
            <PieFijoM consecuencia={linea || (!preset ? 'Elige un preset.' : reqAvatar.falta ? `Antes de generar: ${reqAvatar.falta.titulo}.` : !foto ? 'Pon tu foto en Personaje.' : 'Las imágenes no gastan créditos.')}>
              <div className="m-ai-avatar-barra">
                <div className="m-ai-avatar-barra__fila">
                  <button type="button" className="m-ai-avatar-ranura" onClick={() => setHoja('personaje')} aria-label="Personaje: tu foto">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {foto ? <img src={foto.url} alt="" /> : <Icon name="plus" size={18} />}
                    <span>Personaje</span>
                  </button>
                  <div className="m-ai-avatar-preset" style={preset?.ejemplo ? undefined : fondoDe(preset)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {preset?.ejemplo && <img src={preset.ejemplo.poster} alt="" />}
                    <span>{preset ? preset.nombre : 'Preset'}</span>
                  </div>
                  <textarea className="m-ai-avatar-barra__texto" rows={2} maxLength={MAX_DETALLE} value={detalle} onChange={(e) => setDetalle(e.target.value)}
                    placeholder="Describe la escena (opcional)" aria-label="Describe la escena" />
                </div>
                <div className="m-ai-avatar-barra__pastillas">
                  {([['modelo', MODELO.nombre], ['formato', '9:16'], ['cantidad', '1/4']] as const).map(([q, t]) => (
                    <button key={q} type="button" className="m-ai-avatar-pastilla" onClick={() => setLinea(q === 'modelo' ? SIN_MOTOR.modelo : SIN_MOTOR[q as PiezaSinMotor])}>{t}</button>
                  ))}
                </div>
                <Button variant="primary" size="lg" full loading={enviando}
                  disabled={!preset || !foto || !inicio.puente.puede || !enLinea}
                  onClick={() => preset && void generarLook({ plantillaId: preset.id, fotoId, detalle })}>
                  Generar
                </Button>
              </div>
            </PieFijoM>
          </>
        )}

      <SheetM abierto={hoja === 'personaje'} onCerrar={() => setHoja(null)} titulo="Tu cara">
        <PersonajeM fotos={fotos} fotoId={fotoId} onElegir={(id) => { setFotoId(id); setHoja(null); }}
          onFotos={(f) => { setFotos(f); if (f[0]) setFotoId(f[0].id); }} onLinea={setLinea} />
      </SheetM>
    </>
  );
}

// ── Nueva: «¿Qué vas a crear hoy?» ───────────────────────────────────────────

function NuevaM({ looks, presetId, onPreset }: { looks: LookCard[]; presetId: string | null; onPreset: (id: string) => void }) {
  const [filtro, setFiltro] = useState<Filtro>(null);
  const lista = useMemo(() => filtrarPresets(filtro, ''), [filtro]);
  return (
    <>
      <div className="m-ai-avatar-hero">
        <h2>¿Qué vas a crear hoy?</h2>
        <p>Elige un preset y pon tu foto.</p>
      </div>
      <ChipsM etiqueta="Categorías">
        <ChipM activo={filtro === null} onClick={() => setFiltro(null)}>Todos</ChipM>
        <ChipM activo={filtro === 'Nuevos'} onClick={() => setFiltro('Nuevos')}>Nuevos</ChipM>
        {CATEGORIAS.map((c) => <ChipM key={c} activo={filtro === c} onClick={() => setFiltro(c)}>{c}</ChipM>)}
      </ChipsM>
      <div className="m-ai-avatar-grilla">
        {lista.map((p) => {
          const img = looks.find((l) => l.plantillaId === p.id && l.url)?.url || p.ejemplo?.poster;
          return (
            <button key={p.id} type="button" className={p.nuevo ? 'm-ai-avatar-baldosa m-ai-avatar-baldosa--nuevo' : 'm-ai-avatar-baldosa'} aria-pressed={p.id === presetId} onClick={() => onPreset(p.id)} aria-label={`Usar el preset ${p.nombre}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {img ? <img src={img} alt="" loading="lazy" /> : <span className="m-ai-avatar-baldosa__fondo" style={fondoDe(p)}><small>{p.lugar}</small></span>}
              <span className="m-ai-avatar-baldosa__nombre">{p.nombre}</span>
              {p.nuevo && <span className="m-ai-avatar-baldosa__nuevo">Nuevo</span>}
            </button>
          );
        })}
      </div>
      <SeccionM titulo="Próximamente">
        <p className="m-ai-avatar-pronto"><b>Motion.</b> {SIN_MOTOR.movimiento}</p>
        <p className="m-ai-avatar-pronto"><b>Crear influencer.</b> {SIN_MOTOR.personaje}</p>
      </SeccionM>
    </>
  );
}

// ── Personaje: elegir o subir la foto ────────────────────────────────────────

function PersonajeM({ fotos, fotoId, onElegir, onFotos, onLinea }: {
  fotos: { id: string; url: string }[]; fotoId: string; onElegir: (id: string) => void;
  onFotos: (f: { id: string; url: string }[]) => void; onLinea: (t: string) => void;
}) {
  const campo = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  async function subir(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const j = await (await fetch('/api/onboarding/persona', { method: 'POST', body: fd })).json() as { ok: boolean; error?: string; fotos?: { id: string; url: string | null }[] };
      if (!j.ok) { onLinea(j.error || 'No se pudo subir la foto.'); return; }
      const lista = (j.fotos ?? []).filter((x): x is { id: string; url: string } => !!x.url);
      onFotos([...lista.slice(-1), ...lista.slice(0, -1)]);
      onLinea('Listo: tu foto quedó en Personaje.');
    } catch {
      onLinea('No se pudo subir la foto. Revisa tu conexión.');
    } finally {
      setSubiendo(false);
      if (campo.current) campo.current.value = '';
    }
  }
  return (
    <>
      <div className="m-ai-avatar-fotos">
        {fotos.map((f) => (
          <button key={f.id} type="button" className="m-ai-avatar-foto" aria-pressed={f.id === fotoId} onClick={() => onElegir(f.id)} aria-label="Usar esta foto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url} alt="" />
          </button>
        ))}
      </div>
      {fotos.length === 0 && <p className="m-ai-avatar-pronto">{CONSEJO_FOTO}</p>}
      <Button variant="secondary" size="lg" full loading={subiendo} onClick={() => campo.current?.click()}>Subir una foto</Button>
      <p className="m-ai-avatar-pronto">{SIN_MOTOR.personaje}</p>
      <input ref={campo} type="file" accept="image/*" hidden onChange={(e) => void subir(e.target.files)} />
    </>
  );
}

// ── Un proyecto: el look, sus videos y la barra del video ────────────────────

function ProyectoM({ p, inicio, ahora, enLinea, enviando, error, onRecrear, onEliminar }: {
  p: LookCard; inicio: Inicio; ahora: number; enLinea: boolean; enviando: boolean; error: string;
  onRecrear: () => void; onEliminar: () => void;
}) {
  const preset = plantillaPorId(p.plantillaId);
  const [guion, setGuion] = useState('');
  const [planId, setPlanId] = useState('');
  const [tomas, setTomas] = useState<TomaAvatar[]>([]);
  const [aviso, setAviso] = useState('');
  const [pidiendo, setPidiendo] = useState(false);
  const [borrar, setBorrar] = useState(false);
  const corriendo = useRef(false);

  const filmar = async (plan: string, lista: number[]) => {
    if (corriendo.current) return;
    corriendo.current = true;
    try {
      await filmarTomas(plan, lista, (t) => setTomas((xs) => xs.map((x) => (x.n === t.n ? t : x))));
    } finally {
      corriendo.current = false;
    }
  };

  const generar = async () => {
    if (pidiendo) return;
    setAviso(''); setPidiendo(true);
    try {
      const r = await crearVideoAction({ avatarId: p.mediaId, guion });
      if (!r.ok) { setAviso(r.error); return; }
      setPlanId(r.planId);
      setTomas(r.tomas.map((n) => ({ n, fase: 'esperando' })));
      avisarPuente();
      void filmar(r.planId, r.tomas);
    } catch {
      setAviso('No se pudo armar el video. Revisa tu conexión y vuelve a intentar.');
    } finally {
      setPidiendo(false);
    }
  };

  const listas = tomas.filter((t) => t.fase === 'listo').length;
  const parada = tomas.find((t) => t.fase === 'error');
  const filmando = tomas.some((t) => t.fase === 'filmando' || t.fase === 'a_ciegas');
  const seg = segundosDeGuion(guion);
  const reqVideo = requisitosAvatar({ puente: inicio.puente, instalada: null, enTelefono: true, fotos: inicio.fotos.length, para: 'video' });

  return (
    <>
      <div className="m-ai-avatar-lienzo" style={p.url ? undefined : fondoDe(preset)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.estado === 'listo' && p.url && <img src={p.url} alt={`Tu avatar: ${p.nombre}`} />}
        {p.estado === 'generando' && <div className="m-ai-avatar-lienzo__estado m-ai-avatar-brillo"><b>Generando en tu Google Flow…</b><small>Suele tardar menos de un minuto.</small></div>}
        {p.estado === 'error' && <div className="m-ai-avatar-lienzo__estado"><b>No salió.</b><small>{p.error}</small></div>}
      </div>
      <div className="m-ai-avatar-cab">
        <div>
          <p className="m-ai-avatar-cab__nombre">{p.nombre}</p>
          <p className="m-ai-avatar-cab__meta">{p.detalle ? `«${p.detalle}» · ` : ''}{haceCuanto(p.creadoEn, ahora)}</p>
        </div>
        <div className="m-ai-avatar-cab__acciones">
          <button type="button" className="m-ai-avatar-icono" onClick={onRecrear} disabled={enviando || !inicio.puente.puede || !enLinea} aria-label="Recrear"><Icon name="regenerar" size={20} /></button>
          {/* Baja el archivo de Flow tal cual (calidad original). Un `<a download>` a otro origen lo ABRE en vez de bajarlo. */}
          {p.url && <button type="button" className="m-ai-avatar-icono" aria-label="Descargar"
            onClick={() => { void descargarComo(p.url, nombreDeArchivo(p.nombre, 'imagen')).catch(() => window.open(p.url, '_blank', 'noopener,noreferrer')); }}>
            <Icon name="descargar" size={20} /></button>}
          <button type="button" className="m-ai-avatar-icono" onClick={() => setBorrar(true)} aria-label="Eliminar"><Icon name="trash" size={20} /></button>
        </div>
      </div>
      {error && <ErrorLineaM>{error}</ErrorLineaM>}

      <SeccionM titulo="Videos">
        {tomas.length > 0 && (
          <div className="m-ai-avatar-grilla">
            {tomas.map((t) => (
              <div key={t.n} className="m-ai-avatar-toma">
                {t.fase === 'listo' && t.url
                  ? <video src={t.url} controls playsInline preload="metadata" />
                  : <div className="m-ai-avatar-toma__vacia">{t.fase === 'filmando' || t.fase === 'a_ciegas' ? <span className="mk-spin" aria-label="Filmando" /> : <span>{t.fase === 'error' ? 'No salió' : 'En espera'}</span>}</div>}
                <span className="m-ai-avatar-toma__n">Toma {t.n}</span>
              </div>
            ))}
          </div>
        )}
        {parada && <ErrorLineaM>{`Toma ${parada.n}: ${parada.detalle ?? 'no salió'}`}</ErrorLineaM>}
        {p.videos.filter((v) => v.planId !== planId).map((v) => (
          <div key={v.planId} className="m-ai-avatar-video">
            {v.url ? <video src={v.url} controls playsInline preload="metadata" /> : <span className="m-ai-avatar-pronto">{v.listas}/{v.tomas} tomas filmadas</span>}
            <p>{v.guion}</p>
            <ButtonLink variant="secondary" size="sm" href={rutaEditarEnEditor(`anuncio:${v.planId}`)}>Editar y exportar</ButtonLink>
          </div>
        ))}
        {tomas.length === 0 && p.videos.length === 0 && <p className="m-ai-avatar-pronto">Todavía no hiciste videos con este avatar.</p>}
      </SeccionM>

      {p.estado === 'listo' && (
        <SeccionM titulo="¿Qué va a decir?">
          <CampoM valor={guion} onCambio={setGuion} etiqueta="Lo que dice tu avatar" placeholder={preset ? `Ejemplo: ${preset.guion}` : 'El guion, tal cual lo dirías'} filas={4} deshabilitado={pidiendo || filmando} />
          <div className="m-ai-avatar-barra__pastillas">
            {preset && !guion && <button type="button" className="m-ai-avatar-pastilla" onClick={() => setGuion(preset.guion)}>Usar el ejemplo</button>}
            <span className="m-ai-avatar-pastilla m-ai-avatar-pastilla--dato">Voz de Flow{inicio.acento ? ` · ${inicio.acento}` : ''}</span>
            <button type="button" className="m-ai-avatar-pastilla" onClick={() => setAviso(SIN_MOTOR.voz)}>Tu voz · Pronto</button>
            {seg > 0 && <span className="m-ai-avatar-pastilla m-ai-avatar-pastilla--dato">~{seg} s</span>}
          </div>
        </SeccionM>
      )}
      {p.estado === 'listo' && !reqVideo.listo && <RequisitosM pasos={reqVideo.pasos} />}
      {aviso && <ErrorLineaM>{aviso}</ErrorLineaM>}

      <PieFijoM consecuencia={filmando ? 'Deja esta pantalla abierta mientras se filma.' : 'Cada toma gasta créditos de tu cuenta de Flow.'}>
        {listas > 0 && listas === tomas.length && planId
          ? <ButtonLink variant="primary" size="lg" full href={rutaEditarEnEditor(`anuncio:${planId}`)}>Editar y exportar</ButtonLink>
          : parada && planId
            ? (
              <Button variant="secondary" size="lg" full disabled={!enLinea} onClick={() => {
                setTomas((xs) => xs.map((x) => (x.fase === 'error' ? { ...x, fase: 'esperando', detalle: undefined } : x)));
                void filmar(planId, tomas.filter((x) => x.fase !== 'listo').map((x) => x.n));
              }}>Volver a intentar</Button>
            )
            : (
              <Button variant="primary" size="lg" full loading={pidiendo}
                disabled={p.estado !== 'listo' || !guion.trim() || !inicio.puente.puede || !enLinea || filmando} onClick={() => void generar()}>
                Generar video
              </Button>
            )}
      </PieFijoM>

      <SheetM abierto={borrar} onCerrar={() => setBorrar(false)} titulo="¿Eliminar este proyecto?">
        <p className="m-ai-avatar-pronto">Sale de MaKo. La imagen sigue en tu Google Flow y sus videos en el Video Editor.</p>
        <Button variant="danger" size="lg" full onClick={() => { setBorrar(false); onEliminar(); }}>Eliminar</Button>
      </SheetM>
    </>
  );
}

/** «Antes de generar» en el teléfono: los mismos pasos de la computadora (lib/ai-avatar/requisitos.ts), que se hacen ALLÁ. */
function RequisitosM({ pasos }: { pasos: readonly PasoRequisito[] }) {
  return (
    <SeccionM titulo="Antes de generar">
      <ol className="m-ai-avatar-pasos">
        {pasos.map((x, i) => (
          <li key={x.id} className={x.hecho ? 'm-ai-avatar-paso m-ai-avatar-paso--hecho' : 'm-ai-avatar-paso'} aria-label={`${x.titulo}: ${x.hecho ? 'listo' : 'falta'}`}>
            <span className="m-ai-avatar-paso__marca" aria-hidden="true">{x.hecho ? <Icon name="check" size={12} /> : i + 1}</span>
            <span><b>{x.titulo}</b> <small>{x.ayuda}</small></span>
          </li>
        ))}
      </ol>
      <p className="m-ai-avatar-pronto">{CREDITOS}</p>
    </SeccionM>
  );
}
