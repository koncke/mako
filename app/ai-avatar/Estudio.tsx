'use client';

// =============================================================================
// AI Avatar — el estudio de Higgsfield, con el motor de MaKo
// =============================================================================
// 29/10/2026, Martín: «Lo mismo para AI Avatar... En ese caso replica a higgsfield tal cual, busca un repo o algo y
// replícalo». «Lo mismo» es el diseño único de CREATE: el chat de MaKo SIEMPRE abierto a la izquierda, los proyectos al
// costado con la flecha y «Nueva», «Nueva» con los templates bajo «¿Qué vas a crear hoy?», sin tabs internas y sin
// onboarding (memoria «create-un-solo-diseno»). Reemplaza a las cuatro secciones copiadas de HeyGen el 17/10 (Create
// video · Avatars · Voices · Templates): sus rutas redirigen acá.
//
// LO QUE SE COPIA DE HIGGSFIELD (relevado en higgsfield.ai el 29/10/2026, docs/hallazgos-ai-avatar.md):
//   · la pantalla de crear vacía: el título al centro con las fotos en abanico, y la BARRA DE PROMPT abajo, flotando:
//     «+», el texto («Describe the scene you imagine»), Modelo, Formato, Cantidad «1/4», la ranura CHARACTER, la
//     tarjeta del PRESET con «Change» y GENERATE;
//   · el selector de presets: categorías a la izquierda (All presets · New · …), «Search presets» arriba, baldosas con
//     el nombre arriba a la izquierda y «Use preset» al pasar el cursor;
//   · el «History»: cada generación es una tarjeta que se abre; acá, los PROYECTOS de la columna (lib/ai-avatar/proyectos.ts);
//   · el estudio de AI Influencer: la pestaña «Motion» y el constructor de personaje se ven en su lugar y dicen que no
//     tienen motor (lib/ai-avatar/estudio.ts, SIN_MOTOR).
// LO QUE NO: la marca, el negro y el verde lima (son los colores de MaKo: `var(--token)` adentro de `.hf`, claro y
// oscuro), los créditos de Higgsfield, «Community» y los modelos que MaKo no tiene.
// El repo abierto que más se le parece, Anil-matcha/Open-Generative-AI (MIT), se estudió y no se copió: su estudio es
// un selector de modelos por API paga, sin presets ni personaje (docs/hallazgos-ai-avatar.md).
//
// EL MOTOR es el de siempre (./actions.ts): el look sale de Flow con la cara de la foto (gratis) y el video es el plan
// del Video Generator con el look en todas las tomas, filmado toma por toma en serie y sin reintento (./filmar.ts:
// cada toma se paga). Nada se genera solo: siempre con el botón.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon } from '@/app/_components/icons';
import { MakoEnLaTab } from '@/app/_chat/MakoEnLaTab';
import { ButtonLink } from '@/app/_ui';
import { EmpezarPlanYa } from '@/app/_ui/EmpezarPlanYa';
import { rutaEditarEnEditor } from '@/app/video-editor/desde/desde';
import { avisarPuente } from '@/app/video-generator/avisar-puente';
import { crearLookAction, estadoLookAction, crearVideoAction, borrarLookAction, type InicioOut, type LookCard } from './actions';
import { filmarTomas, SONDEO_MS, type TomaAvatar } from './filmar';
import { CATEGORIAS, PLANTILLAS_AVATAR, filtrarPresets, plantillaPorId, type Categoria, type PlantillaAvatar } from '@/lib/ai-avatar/plantillas';
import { MAX_DETALLE } from '@/lib/ai-avatar/prompt-look';
import { haceCuanto, segundosDeGuion } from '@/lib/ai-avatar/proyectos';
import { MODELO, SIN_MOTOR, TONO_CATEGORIA, pantallaDelEstudio, type PiezaSinMotor } from '@/lib/ai-avatar/estudio';

type Inicio = Extract<InicioOut, { ok: true }>;
type Vista = { tipo: 'nueva' } | { tipo: 'proyecto'; id: string } | { tipo: 'todos' };
type Filtro = Categoria | 'Nuevos' | null;
type Pop = null | 'modelo' | 'formato' | 'cantidad' | 'personaje';

// ── La URL: lo que se ve viaja en la query (`?plantilla=` en Nueva, `?avatar=` en un proyecto) ─────────────────────

function escribirQuery(v: Vista, presetId: string | null) {
  const url = new URL(window.location.href);
  url.searchParams.delete('avatar');
  url.searchParams.delete('plantilla');
  if (v.tipo === 'proyecto') url.searchParams.set('avatar', v.id);
  else if (v.tipo === 'nueva' && presetId) url.searchParams.set('plantilla', presetId);
  window.history.replaceState(window.history.state, '', url.toString());
}

// ═════════════════════════════════════════════════════════════════════════════
// El estudio
// ═════════════════════════════════════════════════════════════════════════════

export function EstudioAvatar({ inicio, plantillaInicial, avatarInicial, ahora }: {
  inicio: Inicio;
  plantillaInicial?: string;
  /** El id del proyecto o el `mediaId` de su imagen (el `?avatar=` de antes era el mediaId). */
  avatarInicial?: string;
  /** Date.now() del server: el primer render del navegador usa el mismo (hidratación). */
  ahora: number;
}) {
  const [looks, setLooks] = useState<LookCard[]>(inicio.looks);
  const [fotos, setFotos] = useState(inicio.fotos);
  const inicial = avatarInicial ? inicio.looks.find((l) => l.id === avatarInicial || (l.mediaId && l.mediaId === avatarInicial)) : undefined;
  const [vista, setVista] = useState<Vista>(inicial ? { tipo: 'proyecto', id: inicial.id } : { tipo: 'nueva' });
  const [presetId, setPresetId] = useState<string | null>(plantillaPorId(plantillaInicial ?? '')?.id ?? null);
  const [fotoId, setFotoId] = useState<string>(inicio.fotos[0]?.id ?? '');
  const [detalle, setDetalle] = useState('');
  const [plegada, setPlegada] = useState(false);
  const [selector, setSelector] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [reloj, setReloj] = useState(ahora);

  useEffect(() => { escribirQuery(vista, presetId); }, [vista, presetId]);
  useEffect(() => { const t = setInterval(() => setReloj(Date.now()), 60_000); return () => clearInterval(t); }, []);

  // Los looks que Flow todavía está haciendo: se pregunta cada SONDEO_MS, un paso por llamada (como antes en Avatars).
  const generando = looks.filter((l) => l.estado === 'generando').map((l) => l.id).join(',');
  useEffect(() => {
    if (!generando) return;
    const ids = generando.split(',');
    const t = setInterval(() => {
      avisarPuente();
      for (const id of ids) {
        void estadoLookAction(id).then((r) => {
          if (r.ok) setLooks((ls) => ls.map((l) => (l.id === id ? { ...r.look, videos: l.videos } : l)));
        });
      }
    }, SONDEO_MS);
    return () => clearInterval(t);
  }, [generando]);

  const preset = presetId ? plantillaPorId(presetId) : null;
  const proyecto = vista.tipo === 'proyecto' ? looks.find((l) => l.id === vista.id) ?? null : null;
  // Un proyecto que se eliminó (o un `?avatar=` viejo) vuelve a «Nueva».
  useEffect(() => { if (vista.tipo === 'proyecto' && !proyecto) setVista({ tipo: 'nueva' }); }, [vista, proyecto]);

  /** Generar el look: el preset con la foto y lo escrito. Abre el proyecto nuevo, que muestra cómo va. */
  const generar = useCallback(async (p: { plantillaId: string; fotoId: string; detalle: string }) => {
    setEnviando(true);
    setError('');
    const r = await crearLookAction(p);
    setEnviando(false);
    if (!r.ok) { setError(r.error); return; }
    avisarPuente();
    setLooks((ls) => [r.look, ...ls]);
    setVista({ tipo: 'proyecto', id: r.look.id });
    setDetalle('');
  }, []);

  const eliminar = useCallback(async (id: string) => {
    const r = await borrarLookAction(id);
    if (!r.ok) { setError(r.error); return; }
    setLooks((ls) => ls.filter((l) => l.id !== id));
    setVista((v) => (v.tipo === 'proyecto' && v.id === id ? { tipo: 'nueva' } : v));
  }, []);

  const pantalla = pantallaDelEstudio({
    vista: vista.tipo,
    preset: preset?.nombre ?? null,
    proyecto: proyecto ? { nombre: proyecto.nombre, estado: proyecto.estado, videos: proyecto.videos.length } : null,
    proyectos: looks.length,
  });

  return (
    <div className="hf">
      <MakoEnLaTab tab="AI Avatar" fijo pantalla={pantalla} />

      <Proyectos looks={looks} vista={vista} plegada={plegada} reloj={reloj}
        onPlegar={() => setPlegada((x) => !x)} onNueva={() => { setVista({ tipo: 'nueva' }); setError(''); }}
        onAbrir={(id) => { setVista({ tipo: 'proyecto', id }); setError(''); }} onTodos={() => setVista({ tipo: 'todos' })} />

      <section className="hf-main" aria-label="AI Avatar">
        {vista.tipo === 'nueva' && (
          <Nueva looks={looks} presetId={presetId} onPreset={(id) => setPresetId(id)} />
        )}
        {vista.tipo === 'todos' && (
          <Todos looks={looks} reloj={reloj} onAbrir={(id) => setVista({ tipo: 'proyecto', id })} />
        )}
        {proyecto && (
          <Proyecto key={proyecto.id} p={proyecto} inicio={inicio} reloj={reloj}
            onRecrear={() => void generar({ plantillaId: proyecto.plantillaId, fotoId: proyecto.fotoId, detalle: proyecto.detalle })}
            onEliminar={() => void eliminar(proyecto.id)} enviando={enviando} error={error} />
        )}

        {vista.tipo !== 'proyecto' && (
          <BarraImagen preset={preset} fotos={fotos} fotoId={fotoId} detalle={detalle} puente={inicio.puente}
            enviando={enviando} error={error}
            onFoto={setFotoId} onFotosNuevas={(f) => { setFotos(f); if (f[0]) setFotoId(f[0].id); }}
            onDetalle={setDetalle} onCambiarPreset={() => setSelector(true)}
            onGenerar={() => preset && void generar({ plantillaId: preset.id, fotoId, detalle })} />
        )}
      </section>

      {selector && (
        <SelectorPresets looks={looks} actual={presetId}
          onCerrar={() => setSelector(false)}
          onUsar={(id) => { setPresetId(id); setSelector(false); setVista({ tipo: 'nueva' }); }} />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// La columna de proyectos: «Nueva» arriba, los proyectos, y la flecha
// ═════════════════════════════════════════════════════════════════════════════

function Proyectos({ looks, vista, plegada, reloj, onPlegar, onNueva, onAbrir, onTodos }: {
  looks: LookCard[]; vista: Vista; plegada: boolean; reloj: number;
  onPlegar: () => void; onNueva: () => void; onAbrir: (id: string) => void; onTodos: () => void;
}) {
  return (
    <aside className={plegada ? 'hf-proyectos hf-proyectos--plegada' : 'hf-proyectos'} aria-label="Tus proyectos">
      <div className="hf-proyectos-cab">
        {!plegada && <span className="hf-proyectos-titulo">AI Avatar</span>}
        <button type="button" className="hf-icono" onClick={onPlegar} aria-label={plegada ? 'Mostrar los proyectos' : 'Plegar los proyectos'}
          title={plegada ? 'Mostrar los proyectos' : 'Plegar los proyectos'}>
          <span className={plegada ? 'hf-flecha hf-flecha--der' : 'hf-flecha'}><Icon name="chevron" size={16} /></span>
        </button>
      </div>
      <button type="button" className="hf-nueva" aria-current={vista.tipo === 'nueva' ? 'page' : undefined} onClick={onNueva} title="Nueva">
        <span className="hf-nueva-mas"><Icon name="plus" size={14} /></span>
        {!plegada && <span>Nueva</span>}
      </button>
      <ul className="hf-lista">
        {looks.map((l) => (
          <li key={l.id}>
            <button type="button" className="hf-fila" aria-current={vista.tipo === 'proyecto' && vista.id === l.id ? 'page' : undefined}
              onClick={() => onAbrir(l.id)} title={l.nombre}>
              <Miniatura l={l} />
              {!plegada && (
                <span className="hf-fila-texto">
                  <span className="hf-fila-nombre">{l.nombre}</span>
                  <span className="hf-fila-meta">
                    {l.estado === 'generando' ? 'Generando…' : l.estado === 'error' ? 'No salió' : haceCuanto(l.creadoEn, reloj)}
                    {l.videos.length > 0 && ` · ${l.videos.length} video${l.videos.length === 1 ? '' : 's'}`}
                  </span>
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {!plegada && looks.length > 0 && (
        <button type="button" className="hf-todos" aria-current={vista.tipo === 'todos' ? 'page' : undefined} onClick={onTodos}>
          Ver todos <span className="hf-flecha hf-flecha--der"><Icon name="chevron" size={14} /></span>
        </button>
      )}
    </aside>
  );
}

function Miniatura({ l }: { l: LookCard }) {
  const p = plantillaPorId(l.plantillaId);
  if (l.url) return <img className="hf-mini" src={l.url} alt="" loading="lazy" />;
  return <span className={l.estado === 'generando' ? 'hf-mini hf-brillo' : 'hf-mini'} style={p ? fondoDe(p) : undefined} aria-hidden="true" />;
}

// ═════════════════════════════════════════════════════════════════════════════
// Nueva: «¿Qué vas a crear hoy?» con los presets
// ═════════════════════════════════════════════════════════════════════════════

function Nueva({ looks, presetId, onPreset }: { looks: LookCard[]; presetId: string | null; onPreset: (id: string) => void }) {
  const [filtro, setFiltro] = useState<Filtro>(null);
  const [busca, setBusca] = useState('');
  const lista = filtrarPresets(filtro, busca);
  // El abanico de arriba (las fotos de Higgsfield): lo hecho por la persona primero; si no hay, los ejemplos.
  const abanico = useMemo(() => {
    const propias = looks.filter((l) => l.url).slice(0, 4).map((l) => ({ id: l.id, src: l.url }));
    const ejemplos = PLANTILLAS_AVATAR.filter((p) => p.ejemplo).map((p) => ({ id: p.id, src: p.ejemplo!.poster }));
    return [...propias, ...ejemplos].slice(0, 4);
  }, [looks]);
  return (
    <div className="hf-nueva-vista">
      <header className="hf-hero">
        <div className="hf-abanico" aria-hidden="true">
          {abanico.map((a, i) => <img key={a.id} src={a.src} alt="" className={`hf-abanico-${i}`} />)}
          {abanico.length < 3 && PLANTILLAS_AVATAR.slice(0, 3 - abanico.length).map((p, i) => (
            <span key={p.id} className={`hf-abanico-${abanico.length + i}`} style={fondoDe(p)} />
          ))}
        </div>
        <h1 className="hf-hero-titulo">¿Qué vas a crear hoy?</h1>
        <p className="hf-hero-sub">Elige un preset, pon tu foto y MaKo arma tu avatar con tu cara.</p>
      </header>

      <div className="hf-filtros">
        <div className="hf-chips" role="group" aria-label="Categorías">
          <Chip activo={filtro === null} onClick={() => setFiltro(null)}>Todos</Chip>
          <Chip activo={filtro === 'Nuevos'} onClick={() => setFiltro('Nuevos')}>Nuevos</Chip>
          {CATEGORIAS.map((c) => <Chip key={c} activo={filtro === c} onClick={() => setFiltro(c)}>{c}</Chip>)}
        </div>
        <label className="hf-buscar">
          <Icon name="search" size={14} />
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar presets" aria-label="Buscar presets" />
        </label>
      </div>

      {lista.length === 0
        ? <p className="hf-vacio">Ningún preset con «{busca}».</p>
        : (
          <div className="hf-grilla">
            {lista.map((p) => <Baldosa key={p.id} p={p} propio={looks.find((l) => l.plantillaId === p.id && l.url)?.url} elegido={p.id === presetId} onUsar={() => onPreset(p.id)} />)}
          </div>
        )}

      <MotionYPersonaje />
    </div>
  );
}

/** Lo de Higgsfield que se ve y todavía no tiene motor en MaKo: el «Motion» y el constructor de personaje. */
function MotionYPersonaje() {
  return (
    <section className="hf-pronto" aria-label="Próximamente">
      <div className="hf-pronto-tarjeta">
        <span className="hf-pronto-nombre">Motion</span>
        <span className="hf-pronto-linea">{SIN_MOTOR.movimiento}</span>
      </div>
      <div className="hf-pronto-tarjeta">
        <span className="hf-pronto-nombre">Crear influencer</span>
        <span className="hf-pronto-linea">{SIN_MOTOR.personaje}</span>
      </div>
    </section>
  );
}

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" className="hf-chip" aria-pressed={activo} onClick={onClick}>{children}</button>;
}

/** El fondo de una baldosa sin imagen: el degradado de su categoría (lib/ai-avatar/estudio.ts). */
function fondoDe(p: PlantillaAvatar): CSSProperties {
  const [a, b] = TONO_CATEGORIA[p.categoria];
  return { background: `linear-gradient(160deg, ${a}, ${b})` };
}

/** Una baldosa del preset, como las de Higgsfield: la imagen, el nombre arriba a la izquierda, «Usar preset» al pasar. */
function Baldosa({ p, propio, elegido, onUsar }: { p: PlantillaAvatar; propio?: string; elegido: boolean; onUsar: () => void }) {
  const img = propio || p.ejemplo?.poster;
  return (
    <div className={`hf-baldosa${elegido ? ' hf-baldosa--elegida' : ''}${p.nuevo ? ' hf-baldosa--nuevo' : ''}`}>
      <button type="button" className="hf-baldosa-boton" onClick={onUsar} aria-label={`Usar el preset ${p.nombre}`} aria-pressed={elegido}>
        {img ? <img src={img} alt="" loading="lazy" /> : <span className="hf-baldosa-fondo" style={fondoDe(p)}><span>{p.lugar}</span></span>}
        <span className="hf-baldosa-nombre">{p.nombre}</span>
        {p.nuevo && <span className="hf-baldosa-nuevo">Nuevo</span>}
        <span className="hf-baldosa-usar">{elegido ? 'Elegido' : 'Usar preset'}</span>
      </button>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// La barra de prompt (imagen): + · texto · Modelo · Formato · Cantidad · Personaje · Preset · Generar
// ═════════════════════════════════════════════════════════════════════════════

function BarraImagen({ preset, fotos, fotoId, detalle, puente, enviando, error, onFoto, onFotosNuevas, onDetalle, onCambiarPreset, onGenerar }: {
  preset: PlantillaAvatar | null;
  fotos: { id: string; url: string }[]; fotoId: string; detalle: string;
  puente: Inicio['puente']; enviando: boolean; error: string;
  onFoto: (id: string) => void; onFotosNuevas: (f: { id: string; url: string }[]) => void;
  onDetalle: (t: string) => void; onCambiarPreset: () => void; onGenerar: () => void;
}) {
  const [pop, setPop] = useState<Pop>(null);
  const [linea, setLinea] = useState('');
  const subir = useSubirFoto(onFotosNuevas, setLinea);
  const foto = fotos.find((f) => f.id === fotoId) ?? null;
  const falta = !preset ? 'Elige un preset.' : !foto ? 'Pon tu foto en Personaje.' : !puente.puede ? puente.motivo : '';
  const sinMotor = (q: PiezaSinMotor) => { setLinea(SIN_MOTOR[q]); setPop(null); };

  return (
    <div className="hf-barra-lugar">
      <div className="hf-barra" role="group" aria-label="Crear avatar">
        <div className="hf-barra-izq">
          <textarea className="hf-barra-texto" rows={2} maxLength={MAX_DETALLE} value={detalle} onChange={(e) => onDetalle(e.target.value)}
            placeholder={preset ? `Describe la escena que imaginas (opcional): ropa, luz, momento del día` : 'Elige un preset y describe la escena que imaginas'}
            aria-label="Describe la escena" />
          <div className="hf-barra-fila">
            <button type="button" className="hf-icono hf-icono--borde" onClick={subir.abrir} aria-label="Subir una foto" title="Subir una foto">
              <Icon name="plus" size={16} />
            </button>
            <Pastilla abierta={pop === 'modelo'} onClick={() => setPop(pop === 'modelo' ? null : 'modelo')} etiqueta="Modelo">
              <Icon name="rayo" size={14} /> {MODELO.nombre} <span className="hf-flecha hf-flecha--der"><Icon name="chevron" size={12} /></span>
            </Pastilla>
            <Pastilla abierta={pop === 'formato'} onClick={() => setPop(pop === 'formato' ? null : 'formato')} etiqueta="Formato">
              <span className="hf-formato" aria-hidden="true" /> 9:16
            </Pastilla>
            <Pastilla abierta={pop === 'cantidad'} onClick={() => setPop(pop === 'cantidad' ? null : 'cantidad')} etiqueta="Cantidad">
              1/4
            </Pastilla>
            <Pastilla abierta={false} onClick={() => sinMotor('calidad')} etiqueta="Calidad">HD</Pastilla>
          </div>
          {pop === 'modelo' && (
            <Menu onCerrar={() => setPop(null)}>
              <OpcionMenu elegida>{MODELO.nombre} <small>{MODELO.de}</small></OpcionMenu>
              <OpcionMenu onClick={() => sinMotor('modelo')} apagada>Otros modelos <small>No disponible todavía</small></OpcionMenu>
            </Menu>
          )}
          {pop === 'formato' && (
            <Menu onCerrar={() => setPop(null)}>
              <OpcionMenu elegida>9:16 <small>Vertical</small></OpcionMenu>
              <OpcionMenu onClick={() => sinMotor('formato')} apagada>3:4 <small>No disponible todavía</small></OpcionMenu>
              <OpcionMenu onClick={() => sinMotor('formato')} apagada>16:9 <small>No disponible todavía</small></OpcionMenu>
            </Menu>
          )}
          {pop === 'cantidad' && (
            <Menu onCerrar={() => setPop(null)}>
              <OpcionMenu elegida>1 imagen</OpcionMenu>
              <OpcionMenu onClick={() => sinMotor('cantidad')} apagada>2 a 4 <small>No disponible todavía</small></OpcionMenu>
            </Menu>
          )}
        </div>

        <div className="hf-barra-der">
          <div className="hf-ranura-lugar">
            <button type="button" className="hf-ranura" onMouseDown={(e) => e.stopPropagation()} onClick={() => setPop(pop === 'personaje' ? null : 'personaje')} aria-label="Personaje: tu foto" aria-expanded={pop === 'personaje'}>
              {foto ? <img src={foto.url} alt="" /> : <Icon name="plus" size={16} />}
              <span className="hf-ranura-rotulo">Personaje</span>
            </button>
            {pop === 'personaje' && (
              <Menu onCerrar={() => setPop(null)} ancho>
                <p className="hf-menu-titulo">Tu cara</p>
                <div className="hf-fotos">
                  {fotos.map((f) => (
                    <button key={f.id} type="button" className="hf-foto" aria-pressed={f.id === fotoId} onClick={() => { onFoto(f.id); setPop(null); }}>
                      <img src={f.url} alt="" />
                    </button>
                  ))}
                  <button type="button" className="hf-foto hf-foto--subir" onClick={subir.abrir} disabled={subir.subiendo} aria-label="Subir una foto">
                    {subir.subiendo ? '…' : <Icon name="plus" size={18} />}
                  </button>
                </div>
                <OpcionMenu onClick={() => sinMotor('personaje')} apagada>Diseñar un personaje <small>No disponible todavía</small></OpcionMenu>
              </Menu>
            )}
          </div>
          <button type="button" className="hf-preset" onClick={onCambiarPreset} aria-label={preset ? `Preset ${preset.nombre}: cambiar` : 'Elegir un preset'}>
            {preset ? (preset.ejemplo ? <img src={preset.ejemplo.poster} alt="" /> : <span className="hf-preset-fondo" style={fondoDe(preset)} />) : <span className="hf-preset-fondo" />}
            <span className="hf-preset-nombre">{preset ? preset.nombre : 'Preset'}</span>
            <span className="hf-preset-cambiar"><Icon name="pen" size={12} /> {preset ? 'Cambiar' : 'Elegir'}</span>
          </button>
          <button type="button" className="hf-generar" disabled={!!falta || enviando} onClick={onGenerar}>
            <span>{enviando ? 'Pidiendo…' : 'Generar'}</span>
            <small>Gratis</small>
          </button>
        </div>
        <input ref={subir.campo} type="file" accept="image/*" hidden onChange={(e) => void subir.alElegir(e.target.files)} />
      </div>
      <p className={error ? 'hf-barra-linea hf-barra-linea--mal' : 'hf-barra-linea'} role={error ? 'alert' : undefined}>
        {error || linea || falta || 'Cada avatar sale de tu Google Flow con tu cara. Las imágenes no gastan créditos.'}
      </p>
      {/* Si el error es el tope de la prueba gratis, el botón para empezar el plan (lib/topes-plan.ts). */}
      <div className="hf-barra-plan"><EmpezarPlanYa texto={error || null} /></div>
    </div>
  );
}

function Pastilla({ abierta, onClick, etiqueta, children }: { abierta: boolean; onClick: () => void; etiqueta: string; children: ReactNode }) {
  // `onMouseDown` no sube: si no, el «tocar afuera» del menú lo cerraba y el clic lo volvía a abrir.
  return <button type="button" className="hf-pastilla" aria-label={etiqueta} aria-expanded={abierta} title={etiqueta} onMouseDown={(e) => e.stopPropagation()} onClick={onClick}>{children}</button>;
}

/** Un menú que flota arriba de la barra (se abre hacia ARRIBA, como en Higgsfield) y se cierra al tocar afuera. */
function Menu({ children, onCerrar, ancho }: { children: ReactNode; onCerrar: () => void; ancho?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fuera = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onCerrar(); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    const t = setTimeout(() => document.addEventListener('mousedown', fuera), 0);
    document.addEventListener('keydown', tecla);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla); };
  }, [onCerrar]);
  return <div ref={ref} className={ancho ? 'hf-menu hf-menu--ancho' : 'hf-menu'} role="menu">{children}</div>;
}

function OpcionMenu({ children, onClick, elegida, apagada }: { children: ReactNode; onClick?: () => void; elegida?: boolean; apagada?: boolean }) {
  return (
    <button type="button" role="menuitem" className={apagada ? 'hf-opcion hf-opcion--apagada' : 'hf-opcion'} onClick={onClick} aria-checked={elegida}>
      <span className="hf-opcion-texto">{children}</span>
      {elegida && <Icon name="check" size={14} />}
    </button>
  );
}

/** El «+» de Higgsfield: sube una foto de la persona (la misma de la cara de marca, /api/onboarding/persona). */
function useSubirFoto(onFotos: (f: { id: string; url: string }[]) => void, onLinea: (t: string) => void) {
  const campo = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const abrir = useCallback(() => campo.current?.click(), []);
  const alElegir = useCallback(async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setSubiendo(true);
    onLinea('Subiendo tu foto…');
    try {
      const fd = new FormData();
      fd.append('file', f);
      const j = await (await fetch('/api/onboarding/persona', { method: 'POST', body: fd })).json() as { ok: boolean; error?: string; warnings?: string[]; fotos?: { id: string; url: string | null }[] };
      if (!j.ok) { onLinea(j.error || 'No se pudo subir la foto.'); return; }
      const lista = (j.fotos ?? []).filter((x): x is { id: string; url: string } => !!x.url);
      // La recién subida es la última: se pone primera, para que quede elegida.
      onFotos([...lista.slice(-1), ...lista.slice(0, -1)]);
      onLinea(j.warnings?.[0] ?? 'Listo: tu foto quedó en Personaje.');
    } catch {
      onLinea('No se pudo subir la foto. Revisa tu conexión y vuelve a intentar.');
    } finally {
      setSubiendo(false);
      if (campo.current) campo.current.value = '';
    }
  }, [onFotos, onLinea]);
  return { campo, abrir, alElegir, subiendo };
}

// ═════════════════════════════════════════════════════════════════════════════
// El selector de presets (el modal de Higgsfield)
// ═════════════════════════════════════════════════════════════════════════════

function SelectorPresets({ looks, actual, onCerrar, onUsar }: { looks: LookCard[]; actual: string | null; onCerrar: () => void; onUsar: (id: string) => void }) {
  const [filtro, setFiltro] = useState<Filtro>(null);
  const [busca, setBusca] = useState('');
  const lista = filtrarPresets(filtro, busca);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [onCerrar]);
  const items: { f: Filtro; t: string }[] = [{ f: null, t: 'Todos los presets' }, { f: 'Nuevos', t: 'Nuevos' }, ...CATEGORIAS.map((c) => ({ f: c as Filtro, t: c }))];
  return (
    <div className="hf-velo" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="hf-selector" role="dialog" aria-modal="true" aria-label="Presets">
        <nav className="hf-selector-cats" aria-label="Categorías">
          <span className="hf-selector-modelo">AI Avatar</span>
          {items.map((it) => (
            <button key={it.t} type="button" className="hf-selector-cat" aria-current={filtro === it.f ? 'true' : undefined} onClick={() => setFiltro(it.f)}>{it.t}</button>
          ))}
        </nav>
        <div className="hf-selector-cuerpo">
          <div className="hf-selector-cab">
            <label className="hf-buscar hf-buscar--ancho">
              <Icon name="search" size={14} />
              <input autoFocus type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar presets" aria-label="Buscar presets" />
            </label>
            <button type="button" className="hf-icono" onClick={onCerrar} aria-label="Cerrar"><Icon name="x" size={16} /></button>
          </div>
          <div className="hf-grilla hf-grilla--selector">
            {lista.map((p) => <Baldosa key={p.id} p={p} propio={looks.find((l) => l.plantillaId === p.id && l.url)?.url} elegido={p.id === actual} onUsar={() => onUsar(p.id)} />)}
            {lista.length === 0 && <p className="hf-vacio">Ningún preset con «{busca}».</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Ver todos (el «History» de Higgsfield)
// ═════════════════════════════════════════════════════════════════════════════

function Todos({ looks, reloj, onAbrir }: { looks: LookCard[]; reloj: number; onAbrir: (id: string) => void }) {
  return (
    <div className="hf-nueva-vista">
      <h1 className="hf-titulo">Tus proyectos</h1>
      <div className="hf-grilla">
        {looks.map((l) => (
          <div key={l.id} className="hf-baldosa">
            <button type="button" className="hf-baldosa-boton" onClick={() => onAbrir(l.id)} aria-label={`Abrir ${l.nombre}`}>
              {l.url ? <img src={l.url} alt="" loading="lazy" /> : <span className={l.estado === 'generando' ? 'hf-baldosa-fondo hf-brillo' : 'hf-baldosa-fondo'} style={plantillaPorId(l.plantillaId) ? fondoDe(plantillaPorId(l.plantillaId)!) : undefined}><span>{l.estado === 'error' ? 'No salió' : 'Generando…'}</span></span>}
              <span className="hf-baldosa-nombre">{l.nombre}</span>
              <span className="hf-baldosa-pie">{haceCuanto(l.creadoEn, reloj)}{l.videos.length > 0 ? ` · ${l.videos.length} video${l.videos.length === 1 ? '' : 's'}` : ''}</span>
              <span className="hf-baldosa-usar">Abrir</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Un proyecto: el look, sus videos y la barra para animarlo
// ═════════════════════════════════════════════════════════════════════════════

function Proyecto({ p, inicio, reloj, onRecrear, onEliminar, enviando, error }: {
  p: LookCard; inicio: Inicio; reloj: number; onRecrear: () => void; onEliminar: () => void; enviando: boolean; error: string;
}) {
  const preset = plantillaPorId(p.plantillaId);
  const [guion, setGuion] = useState('');
  const [planId, setPlanId] = useState<string | null>(null);
  const [tomas, setTomas] = useState<TomaAvatar[]>([]);
  const [pidiendo, setPidiendo] = useState(false);
  const [linea, setLinea] = useState('');
  const [errorVideo, setErrorVideo] = useState('');
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);

  const cambiar = useCallback((t: TomaAvatar) => setTomas((ts) => ts.map((x) => (x.n === t.n ? { ...x, ...t } : x))), []);
  const filmar = useCallback(async (plan: string, lista: number[]) => { await filmarTomas(plan, lista, cambiar); }, [cambiar]);

  async function generarVideo() {
    setPidiendo(true);
    setErrorVideo('');
    const r = await crearVideoAction({ avatarId: p.mediaId, guion });
    setPidiendo(false);
    if (!r.ok) { setErrorVideo(r.error); return; }
    setPlanId(r.planId);
    setTomas(r.tomas.map((n) => ({ n, fase: 'esperando' })));
    void filmar(r.planId, r.tomas);
  }

  const filmando = tomas.some((t) => t.fase === 'filmando' || t.fase === 'a_ciegas');
  const parada = !filmando && tomas.some((t) => t.fase === 'error');
  const listas = tomas.filter((t) => t.fase === 'listo').length;
  const seg = segundosDeGuion(guion);
  const faltaVideo = p.estado !== 'listo' ? 'Espera a que tu avatar esté listo.' : !guion.trim() ? 'Escribe lo que va a decir tu avatar.' : !inicio.puente.puede ? inicio.puente.motivo : '';

  return (
    <div className="hf-proyecto">
      <header className="hf-proyecto-cab">
        <div>
          <h1 className="hf-titulo">{p.nombre}</h1>
          <p className="hf-proyecto-meta">{p.lugar}{p.detalle ? ` · «${p.detalle}»` : ''} · {haceCuanto(p.creadoEn, reloj)}</p>
        </div>
        <div className="hf-proyecto-acciones">
          <button type="button" className="hf-boton" onClick={onRecrear} disabled={enviando || !inicio.puente.puede} title={inicio.puente.puede ? 'Otra versión con el mismo preset y la misma foto' : inicio.puente.motivo}>
            <Icon name="regenerar" size={14} /> Recrear
          </button>
          {p.url && <a className="hf-boton" href={p.url} download target="_blank" rel="noreferrer"><Icon name="descargar" size={14} /> Descargar</a>}
          {confirmarBorrar
            ? <span className="hf-confirmar">¿Eliminar este proyecto? <button type="button" className="hf-boton hf-boton--peligro" onClick={onEliminar}>Eliminar</button> <button type="button" className="hf-boton" onClick={() => setConfirmarBorrar(false)}>No</button></span>
            : <button type="button" className="hf-icono" onClick={() => setConfirmarBorrar(true)} aria-label="Eliminar el proyecto" title="Eliminar"><Icon name="trash" size={16} /></button>}
        </div>
      </header>
      {error && <p className="hf-barra-linea hf-barra-linea--mal" role="alert">{error}</p>}

      <div className="hf-proyecto-cuerpo">
        <figure className="hf-lienzo">
          {p.estado === 'listo' && p.url && <img src={p.url} alt={`Tu avatar: ${p.nombre}`} />}
          {p.estado === 'generando' && (
            <div className="hf-lienzo-generando hf-brillo" style={preset ? fondoDe(preset) : undefined}>
              <span>Generando en tu Google Flow…</span>
              <small>Suele tardar menos de un minuto.</small>
            </div>
          )}
          {p.estado === 'error' && (
            <div className="hf-lienzo-generando" role="alert">
              <span>No salió.</span>
              <small>{p.error}</small>
              <button type="button" className="hf-boton" onClick={onRecrear} disabled={enviando || !inicio.puente.puede}>Volver a intentar</button>
            </div>
          )}
        </figure>

        <section className="hf-videos" aria-label="Videos de este avatar">
          <h2 className="hf-subtitulo">Videos</h2>
          {tomas.length > 0 && (
            <div className="hf-video hf-video--nuevo">
              <p className="hf-video-guion">{guion}</p>
              <ol className="hf-tomas">
                {tomas.map((t) => (
                  <li key={t.n} className={`hf-toma hf-toma--${t.fase}`}>
                    {t.fase === 'listo' && t.url
                      ? <video src={t.url} controls playsInline />
                      : <span>Toma {t.n}: {t.fase === 'esperando' ? 'en espera' : t.fase === 'filmando' ? 'filmando…' : t.fase === 'a_ciegas' ? 'casi lista…' : 'no salió'}</span>}
                    {t.detalle && t.fase !== 'listo' && <small>{t.detalle}</small>}
                  </li>
                ))}
              </ol>
              <div className="hf-video-acciones">
                {listas === tomas.length && planId && <ButtonLink href={rutaEditarEnEditor(`anuncio:${planId}`)}>Editar y exportar</ButtonLink>}
                {parada && planId && (
                  <button type="button" className="hf-boton" onClick={() => {
                    setTomas((t) => t.map((x) => (x.fase === 'error' ? { ...x, fase: 'esperando', detalle: undefined } : x)));
                    void filmar(planId, tomas.filter((x) => x.fase !== 'listo').map((x) => x.n));
                  }}>Volver a intentar</button>
                )}
              </div>
            </div>
          )}
          {p.videos.filter((v) => v.planId !== planId).map((v) => (
            <div key={v.planId} className="hf-video">
              {v.url ? <video src={v.url} controls playsInline preload="metadata" /> : <span className="hf-video-sin">{v.listas}/{v.tomas} tomas filmadas</span>}
              <p className="hf-video-guion">{v.guion}</p>
              <ButtonLink variant="secondary" size="sm" href={rutaEditarEnEditor(`anuncio:${v.planId}`)}>Editar y exportar</ButtonLink>
            </div>
          ))}
          {tomas.length === 0 && p.videos.length === 0 && <p className="hf-vacio">Todavía no hiciste videos con este avatar.</p>}
        </section>
      </div>

      {/* La barra de video: lo que dice el avatar, la voz y el movimiento (los dos que no tienen motor lo dicen). */}
      <div className="hf-barra-lugar">
        <div className="hf-barra" role="group" aria-label="Crear video">
          <div className="hf-barra-izq">
            <textarea className="hf-barra-texto" rows={2} value={guion} onChange={(e) => setGuion(e.target.value)} disabled={filmando}
              placeholder={preset ? `Lo que dice tu avatar. Ejemplo: ${preset.guion}` : 'Lo que dice tu avatar'} aria-label="Lo que dice tu avatar" />
            <div className="hf-barra-fila">
              {preset && !guion && <button type="button" className="hf-pastilla" onClick={() => setGuion(preset.guion)}>Usar el ejemplo</button>}
              <span className="hf-pastilla hf-pastilla--dato"><Icon name="mic" size={14} /> Voz de Flow{inicio.acento ? ` · ${inicio.acento}` : ''}</span>
              <button type="button" className="hf-pastilla" onClick={() => setLinea(SIN_MOTOR.voz)}>Tu voz <small>Pronto</small></button>
              <button type="button" className="hf-pastilla" onClick={() => setLinea(SIN_MOTOR.movimiento)}>Motion <small>Pronto</small></button>
              {seg > 0 && <span className="hf-pastilla hf-pastilla--dato"><Icon name="reloj" size={14} /> ~{seg} s</span>}
            </div>
          </div>
          <div className="hf-barra-der">
            <button type="button" className="hf-generar" disabled={!!faltaVideo || pidiendo || filmando} onClick={() => void generarVideo()}>
              <span>{pidiendo ? 'Armando…' : filmando ? 'Filmando…' : 'Generar video'}</span>
              <small>Usa créditos de Flow</small>
            </button>
          </div>
        </div>
        <p className={errorVideo ? 'hf-barra-linea hf-barra-linea--mal' : 'hf-barra-linea'} role={errorVideo ? 'alert' : undefined}>
          {errorVideo || linea || faltaVideo || 'Cada toma gasta créditos de tu cuenta de Flow. Se filma toma por toma y nada se repite solo.'}
        </p>
        <div className="hf-barra-plan"><EmpezarPlanYa texto={errorVideo || null} /></div>
      </div>
    </div>
  );
}
