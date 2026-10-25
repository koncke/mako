'use client';

// =============================================================================
// AI Avatar — las cuatro secciones de la tab
// =============================================================================
// La ESTRUCTURA se copia de HeyGen (docs/hallazgos-ai-avatar.md: se miró su
// documentación oficial y capturas de 2026, porque la app pide cuenta):
//   · Plantillas  ← su galería de Templates por tipo de anuncio.
//   · Avatares    ← «My Avatars» + «Looks»: el look es personaje + escena, y se
//                   crea eligiendo un tema (sus «Look Packs»).
//   · Voces       ← su Voice Library: filtros por acento y género, escuchar,
//                   sumar a tu cuenta.
//   · Crear video ← su flujo de avatar: elegir avatar → guion → generar.
// Los colores, tipos y componentes son los de la casa (`var(--token)`, app/_ui).
//
// Lo que genera NO se inventa acá: los looks y el video son los del Video
// Generator, por el puente a Flow, y la voz es la cuenta de ElevenLabs del cliente.
// El porqué de cada llamada está en ./actions.ts.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Button, ButtonLink, EmptyState, Banner, Spinner, Tag, Textarea } from '@/app/_ui';
import { useRouter } from '@/app/_ui/Link';
import { BotonIntegracion } from '@/app/_components/ConectarIntegracion';
import {
  inicioAvatarAction, crearLookAction, estadoLookAction, crearVideoAction, vocesCuentaAction, sumarVozAction,
  type InicioOut, type LookCard, type VozCuenta,
} from './actions';
import { generarTomaAction, estadoTomaAction } from '@/app/video-generator/video-action';
import { avisarPuente } from '@/app/video-generator/avisar-puente';
import { rutaEditarEnEditor } from '@/app/video-editor/desde/desde';
import { PLANTILLAS_AVATAR, CATEGORIAS, vozSugerida, plantillaPorId, type PlantillaAvatar } from '@/lib/ai-avatar/plantillas';
import { VOCES_GALERIA, ACENTOS_GALERIA, type VozGaleria } from '@/lib/ai-avatar/voces-galeria';
import { EmpezarPlanYa } from '@/app/_ui/EmpezarPlanYa';

type Inicio = Extract<InicioOut, { ok: true }>;

/** Cada cuánto se pregunta por un look o una toma: el sondeo del Video Generator. */
const SONDEO_MS = 6000;

// ── Piezas comunes ───────────────────────────────────────────────────────────

const grilla = (min: number): CSSProperties => ({
  display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`, gap: 16,
});

function Titulo({ children, nota }: { children: ReactNode; nota?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '28px 0 12px' }}>
      <h2 style={{ fontSize: 'var(--fs-sect)', fontWeight: 650, margin: 0, color: 'var(--text)' }}>{children}</h2>
      {nota && <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)' }}>{nota}</span>}
    </div>
  );
}

/** Un chip de filtro, como los de la biblioteca de HeyGen. */
function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      style={{
        padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 'var(--fs-sm)', fontWeight: activo ? 600 : 500,
        border: `1px solid ${activo ? 'var(--primary)' : 'var(--border)'}`,
        background: activo ? 'var(--primary-bg)' : 'var(--surface)',
        color: activo ? 'var(--primary)' : 'var(--text)',
      }}
    >
      {children}
    </button>
  );
}

/** Un solo audio sonando en toda la tab: apretar otra muestra corta la anterior. */
function useReproductor() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [sonando, setSonando] = useState<string | null>(null);
  const tocar = useCallback((clave: string, url: string) => {
    if (!audio.current) {
      audio.current = new Audio();
      audio.current.onended = () => setSonando(null);
    }
    if (sonando === clave) { audio.current.pause(); setSonando(null); return; }
    audio.current.src = url;
    void audio.current.play().then(() => setSonando(clave), () => setSonando(null));
  }, [sonando]);
  useEffect(() => () => { audio.current?.pause(); }, []);
  return { sonando, tocar };
}

function BotonEscuchar({ activo, onClick, etiqueta = 'Escuchar' }: { activo: boolean; onClick: () => void; etiqueta?: string }) {
  return (
    <Button size="sm" variant="secondary" onClick={onClick} aria-label={activo ? 'Pausar' : etiqueta}>
      {activo ? 'Pausar' : etiqueta}
    </Button>
  );
}

/** Lo que la tab necesita del server, con su estado de carga. */
function useInicio() {
  const [inicio, setInicio] = useState<Inicio | null>(null);
  const [error, setError] = useState('');
  const recargar = useCallback(async () => {
    const r = await inicioAvatarAction();
    if (r.ok) { setInicio(r); setError(''); } else setError(r.error);
  }, []);
  useEffect(() => { void recargar(); }, [recargar]);
  return { inicio, error, recargar, setInicio };
}

function Cargando() {
  return <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}><Spinner /></div>;
}

/** La portada de una plantilla: su video real si lo hay; si no, el lugar escrito. */
function Portada({ p, alto }: { p: PlantillaAvatar; alto?: number }) {
  const base: CSSProperties = { width: '100%', aspectRatio: '9 / 16', borderRadius: 'var(--r-md)', overflow: 'hidden', display: 'block', ...(alto ? { height: alto, aspectRatio: 'auto' } : {}) };
  if (p.ejemplo) {
    return (
      // Muted + playsInline: sin las dos, el navegador no deja autoplay.
      <video src={p.ejemplo.video} poster={p.ejemplo.poster} autoPlay loop muted playsInline style={{ ...base, objectFit: 'cover', background: 'var(--surface-2)' }} />
    );
  }
  return (
    <div style={{ ...base, background: 'var(--surface-2)', display: 'flex', alignItems: 'flex-end', padding: 14, boxSizing: 'border-box' }}>
      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-dim)', lineHeight: 1.35 }}>{p.lugar}</span>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PLANTILLAS — la galería de temas
// ═════════════════════════════════════════════════════════════════════════════

export function Plantillas() {
  const [cat, setCat] = useState<string>('Todas');
  const { sonando, tocar } = useReproductor();
  const lista = cat === 'Todas' ? PLANTILLAS_AVATAR : PLANTILLAS_AVATAR.filter((p) => p.categoria === cat);
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {['Todas', ...CATEGORIAS].map((c) => <Chip key={c} activo={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}
      </div>
      <div style={{ ...grilla(200), marginTop: 20 }}>
        {lista.map((p) => {
          const voz = vozSugerida(p.voz);
          return (
            <article key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ position: 'relative' }}>
                <Portada p={p} />
                <div style={{ position: 'absolute', top: 10, left: 10 }}><Tag>{p.categoria}</Tag></div>
              </div>
              <div style={{ fontSize: 'var(--fs-card)', fontWeight: 650, color: 'var(--text)' }}>{p.nombre}</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-dim)', lineHeight: 1.4 }}>{p.resumen}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto' }}>
                <ButtonLink size="sm" href={`/ai-avatar/avatares?plantilla=${p.id}`}>Usar</ButtonLink>
                {voz && <BotonEscuchar activo={sonando === p.id} onClick={() => tocar(p.id, voz.muestra)} etiqueta="Escuchar voz" />}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// AVATARES — tus avatares y crear un look
// ═════════════════════════════════════════════════════════════════════════════

export function Avatares({ plantillaInicial }: { plantillaInicial?: string }) {
  const { inicio, error, recargar, setInicio } = useInicio();
  const [fotoId, setFotoId] = useState('');
  const [plantillaId, setPlantillaId] = useState(plantillaPorId(plantillaInicial ?? '') ? String(plantillaInicial) : '');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');
  const crearRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (plantillaInicial) crearRef.current?.scrollIntoView({ block: 'start' }); }, [plantillaInicial]);
  useEffect(() => { if (inicio && !fotoId && inicio.fotos[0]) setFotoId(inicio.fotos[0].id); }, [inicio, fotoId]);

  // Los looks en camino se preguntan solos, y se le avisa al puente que hay trabajo.
  const generando = (inicio?.looks ?? []).filter((l) => l.estado === 'generando').map((l) => l.id);
  const clave = generando.join(',');
  useEffect(() => {
    if (!clave) return;
    const t = setInterval(async () => {
      avisarPuente();
      let cambio = false;
      for (const id of clave.split(',')) {
        const r = await estadoLookAction(id);
        if (r.ok && r.look.estado !== 'generando') cambio = true;
      }
      if (cambio) void recargar();
    }, SONDEO_MS);
    return () => clearInterval(t);
  }, [clave, recargar]);

  if (error) return <Banner tono="bad">{error}</Banner>;
  if (!inicio) return <Cargando />;

  async function crear() {
    setAviso('');
    setEnviando(true);
    const r = await crearLookAction({ plantillaId, fotoId });
    setEnviando(false);
    if (!r.ok) { setAviso(r.error); return; }
    avisarPuente();
    setInicio((v) => (v ? { ...v, looks: [r.look, ...v.looks] } : v));
  }

  const enCurso = inicio.looks.filter((l) => l.estado !== 'listo');
  return (
    <div>
      <Titulo nota={inicio.avatares.length ? `${inicio.avatares.length} listos para hablar` : undefined}>Tus avatares</Titulo>
      {inicio.avatares.length === 0 && enCurso.length === 0 ? (
        <EmptyState titulo="Todavía no tienes avatares" detalle="Crea tu primer look abajo: tu foto en una escena de la galería." inline />
      ) : (
        <div style={grilla(150)}>
          {enCurso.map((l) => <LookEnCurso key={l.id} l={l} />)}
          {inicio.avatares.map((a) => (
            <figure key={a.id} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.lugar} style={{ width: '100%', aspectRatio: '9 / 16', objectFit: 'cover', borderRadius: 'var(--r-md)', background: 'var(--surface-2)' }} />
              <figcaption style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)' }}>{a.lugar || (a.origen === 'anuncio' ? 'De un anuncio' : 'Look')}</figcaption>
              <ButtonLink size="sm" variant="secondary" href={`/ai-avatar?avatar=${encodeURIComponent(a.id)}`}>Crear video</ButtonLink>
            </figure>
          ))}
        </div>
      )}

      <div ref={crearRef} />
      <Titulo nota="Las imágenes no gastan créditos de Flow">Crear un look</Titulo>
      {!inicio.puente.puede && <div style={{ marginBottom: 12 }}><Banner tono="warn">{inicio.puente.motivo}</Banner></div>}

      <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, margin: '4px 0 8px', color: 'var(--text)' }}>Tu foto</div>
      {inicio.fotos.length === 0 ? (
        <EmptyState titulo="Falta tu foto" detalle="Súbela en el Video Generator: es la cara de tus avatares." accion={{ label: 'Subir mi foto', href: '/video-generator' }} inline />
      ) : (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {inicio.fotos.map((f) => (
            <button key={f.id} type="button" onClick={() => setFotoId(f.id)} aria-pressed={fotoId === f.id}
              style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 'var(--r-md)', outline: fotoId === f.id ? '2px solid var(--primary)' : '1px solid var(--border)', outlineOffset: fotoId === f.id ? 2 : 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt="Tu foto" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 'var(--r-md)', display: 'block' }} />
            </button>
          ))}
        </div>
      )}

      <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, margin: '18px 0 8px', color: 'var(--text)' }}>El tema</div>
      <div style={grilla(130)}>
        {PLANTILLAS_AVATAR.map((p) => (
          <button key={p.id} type="button" onClick={() => setPlantillaId(p.id)} aria-pressed={plantillaId === p.id}
            style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ borderRadius: 'var(--r-md)', outline: plantillaId === p.id ? '2px solid var(--primary)' : '1px solid var(--border)', outlineOffset: plantillaId === p.id ? 2 : 0 }}>
              <Portada p={p} />
            </div>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text)' }}>{p.nombre}</span>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
        <Button onClick={crear} loading={enviando} disabled={!inicio.puente.puede || !fotoId || !plantillaId}>Crear look</Button>
        {aviso && <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--bad)' }}>{aviso}</span>}
        <EmpezarPlanYa texto={aviso || null} />
      </div>
    </div>
  );
}

function LookEnCurso({ l }: { l: LookCard }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ width: '100%', aspectRatio: '9 / 16', borderRadius: 'var(--r-md)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, boxSizing: 'border-box', textAlign: 'center' }}>
        {l.estado === 'generando'
          ? <Spinner />
          : <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--bad)', lineHeight: 1.4 }}>{l.error}</span>}
      </div>
      <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)' }}>{l.estado === 'generando' ? `Creando «${l.nombre}»` : l.nombre}</span>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// VOCES — la galería y las de tu cuenta
// ═════════════════════════════════════════════════════════════════════════════

export function Voces() {
  const { sonando, tocar } = useReproductor();
  const [acento, setAcento] = useState<string>('Todos');
  const [genero, setGenero] = useState<string>('Todas');
  const [cuenta, setCuenta] = useState<{ voces: VozCuenta[] } | { sinKey: boolean; error: string } | null>(null);
  const [sumando, setSumando] = useState('');
  const [sumadas, setSumadas] = useState<Record<string, string>>({});

  const cargarCuenta = useCallback(async () => {
    const r = await vocesCuentaAction();
    setCuenta(r.ok ? { voces: r.voces } : { sinKey: r.sinKey, error: r.error });
  }, []);
  useEffect(() => { void cargarCuenta(); }, [cargarCuenta]);

  const lista = useMemo(() => VOCES_GALERIA.filter((v) =>
    (acento === 'Todos' || v.acento === acento) && (genero === 'Todas' || v.genero === (genero === 'Mujer' ? 'mujer' : 'hombre'))), [acento, genero]);

  async function sumar(v: VozGaleria) {
    setSumando(v.id);
    const r = await sumarVozAction(v.id);
    setSumando('');
    setSumadas((s) => ({ ...s, [v.id]: r.ok ? 'ok' : r.error }));
    if (r.ok) void cargarCuenta();
  }

  const sinKey = cuenta && 'sinKey' in cuenta && cuenta.sinKey;
  return (
    <div>
      <Titulo nota="Escuchar no gasta nada">Galería de voces</Titulo>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {['Todos', ...ACENTOS_GALERIA].map((a) => <Chip key={a} activo={acento === a} onClick={() => setAcento(a)}>{a}</Chip>)}
        <span style={{ width: 12 }} />
        {['Todas', 'Mujer', 'Hombre'].map((g) => <Chip key={g} activo={genero === g} onClick={() => setGenero(g)}>{g}</Chip>)}
      </div>
      <div style={{ ...grilla(260), marginTop: 16 }}>
        {lista.map((v) => (
          <div key={v.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 14, background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 'var(--fs-card)', fontWeight: 650, color: 'var(--text)' }}>{v.nombre}</span>
              <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)' }}>{v.acento}</span>
            </div>
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-dim)' }}>{v.tono} · {v.genero === 'mujer' ? 'Mujer' : 'Hombre'} {v.edad.toLowerCase()} · {v.uso}</span>
            <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
              <BotonEscuchar activo={sonando === v.id} onClick={() => tocar(v.id, v.muestra)} />
              {!sinKey && (sumadas[v.id] === 'ok'
                ? <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--good)' }}>En tu cuenta</span>
                : <Button size="sm" variant="tertiary" loading={sumando === v.id} onClick={() => sumar(v)}>Agregar a mi cuenta</Button>)}
            </div>
            {sumadas[v.id] && sumadas[v.id] !== 'ok' && <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--bad)' }}>{sumadas[v.id]}</span>}
          </div>
        ))}
      </div>

      <Titulo nota="De tu cuenta de ElevenLabs">Tus voces</Titulo>
      {!cuenta ? <Cargando /> : 'voces' in cuenta ? (
        cuenta.voces.length === 0
          ? <EmptyState titulo="No tienes voces todavía" detalle="Agrega una de la galería o clona la tuya en el Video Generator." inline />
          : (
            <div style={grilla(240)}>
              {cuenta.voces.map((v) => (
                <div key={v.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 12, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.nombre}</div>
                    <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)' }}>{v.categoria === 'cloned' ? 'Clonada' : v.categoria === 'premade' ? 'De ElevenLabs' : 'Agregada'}</div>
                  </div>
                  {v.muestra && <BotonEscuchar activo={sonando === `c-${v.id}`} onClick={() => tocar(`c-${v.id}`, v.muestra!)} />}
                </div>
              ))}
            </div>
          )
      ) : cuenta.sinKey ? (
        <Banner tono="info">
          Conecta tu cuenta de ElevenLabs para usar estas voces.{' '}
          <BotonIntegracion servicio="elevenlabs" onConectado={() => void cargarCuenta()} style={{ fontWeight: 600, textDecoration: 'underline' }}>Conectar ElevenLabs</BotonIntegracion>
        </Banner>
      ) : <Banner tono="bad">{cuenta.error}</Banner>}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CREAR VIDEO — avatar → guion → generar
// ═════════════════════════════════════════════════════════════════════════════

type Toma = { n: number; fase: 'esperando' | 'filmando' | 'listo' | 'a_ciegas' | 'error'; url?: string; detalle?: string };

export function CrearVideo({ avatarInicial, plantillaInicial }: { avatarInicial?: string; plantillaInicial?: string }) {
  const { inicio, error } = useInicio();
  const router = useRouter();
  const [avatarId, setAvatarId] = useState(avatarInicial ?? '');
  const [guion, setGuion] = useState(plantillaPorId(plantillaInicial ?? '')?.guion ?? '');
  const [paso, setPaso] = useState<'avatar' | 'guion' | 'generando'>(avatarInicial ? 'guion' : 'avatar');
  const [planId, setPlanId] = useState('');
  const [tomas, setTomas] = useState<Toma[]>([]);
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const corriendo = useRef(false);

  const filmar = useCallback(async (plan: string, lista: number[]) => {
    if (corriendo.current) return;
    corriendo.current = true;
    // ⚠️ EN SERIE Y SIN REINTENTO, por plata: cada toma es un clip que se paga.
    // Si una falla, la cadena para ahí y la persona decide si vuelve a apretar.
    for (const n of lista) {
      setTomas((t) => t.map((x) => (x.n === n ? { ...x, fase: 'filmando' } : x)));
      const g = await generarTomaAction(plan, n);
      if (!g.ok) {
        setTomas((t) => t.map((x) => (x.n === n ? { ...x, fase: 'error', detalle: g.error } : x)));
        break;
      }
      avisarPuente();
      let fin: Toma | null = null;
      while (!fin) {
        await new Promise((r) => setTimeout(r, SONDEO_MS));
        avisarPuente();
        const e = await estadoTomaAction(plan, n);
        if (!e.ok) { fin = { n, fase: 'error', detalle: e.error }; break; }
        const s = e.estado;
        if (s.fase === 'listo') fin = { n, fase: 'listo', url: s.url };
        else if (s.fase === 'error') fin = { n, fase: 'error', detalle: s.error };
        else if (s.fase === 'a_ciegas') setTomas((t) => t.map((x) => (x.n === n ? { ...x, fase: 'a_ciegas', detalle: s.error } : x)));
      }
      const hecho = fin;
      setTomas((t) => t.map((x) => (x.n === n ? hecho : x)));
      if (hecho.fase !== 'listo') break;
    }
    corriendo.current = false;
  }, []);

  if (error) return <Banner tono="bad">{error}</Banner>;
  if (!inicio) return <Cargando />;

  const avatar = inicio.avatares.find((a) => a.id === avatarId) ?? null;

  async function generar() {
    setAviso('');
    setEnviando(true);
    const r = await crearVideoAction({ avatarId, guion });
    setEnviando(false);
    if (!r.ok) { setAviso(r.error); return; }
    setPlanId(r.planId);
    setTomas(r.tomas.map((n) => ({ n, fase: 'esperando' })));
    setPaso('generando');
    void filmar(r.planId, r.tomas);
  }

  if (paso === 'avatar') {
    if (inicio.avatares.length === 0) {
      return <EmptyState titulo="Primero crea tu avatar" detalle="Tu foto en una escena de la galería. Las imágenes no gastan créditos." accion={{ label: 'Crear un look', href: '/ai-avatar/avatares' }} />;
    }
    return (
      <div>
        <Titulo>Elige tu avatar</Titulo>
        <div style={grilla(150)}>
          {inicio.avatares.map((a) => (
            <button key={a.id} type="button" onClick={() => setAvatarId(a.id)} aria-pressed={avatarId === a.id}
              style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.lugar} style={{ width: '100%', aspectRatio: '9 / 16', objectFit: 'cover', borderRadius: 'var(--r-md)', outline: avatarId === a.id ? '2px solid var(--primary)' : '1px solid var(--border)', outlineOffset: avatarId === a.id ? 2 : 0, background: 'var(--surface-2)' }} />
              <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)' }}>{a.lugar}</span>
            </button>
          ))}
        </div>
        <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
          <Button disabled={!avatar} onClick={() => setPaso('guion')}>Siguiente</Button>
          <ButtonLink variant="tertiary" href="/ai-avatar/avatares">Crear otro look</ButtonLink>
        </div>
      </div>
    );
  }

  if (paso === 'guion') {
    const palabras = guion.trim() ? guion.trim().split(/\s+/).length : 0;
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 200px) minmax(0, 1fr)', gap: 24, alignItems: 'start', marginTop: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {avatar && <img src={avatar.url} alt={avatar.lugar} style={{ width: '100%', aspectRatio: '9 / 16', objectFit: 'cover', borderRadius: 'var(--r-md)', background: 'var(--surface-2)' }} />}
          <Button size="sm" variant="tertiary" onClick={() => setPaso('avatar')}>Cambiar avatar</Button>
        </div>
        <div>
          <h2 style={{ fontSize: 'var(--fs-sect)', fontWeight: 650, margin: '0 0 10px', color: 'var(--text)' }}>¿Qué va a decir?</h2>
          <Textarea value={guion} onChange={(e) => setGuion(e.target.value)} rows={7} placeholder="Escribe el guion, tal cual lo dirías." />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {PLANTILLAS_AVATAR.slice(0, 4).map((p) => <Chip key={p.id} activo={false} onClick={() => setGuion(p.guion)}>{p.nombre}</Chip>)}
          </div>
          <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)', marginTop: 10 }}>
            {palabras} palabras · Voz: la de Flow, {inicio.acento ? `con acento ${inicio.acento}` : 'con tu acento'}
          </div>
          {!inicio.puente.puede && <div style={{ marginTop: 12 }}><Banner tono="warn">{inicio.puente.motivo}</Banner></div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
            <Button onClick={generar} loading={enviando} disabled={!guion.trim() || !avatar || !inicio.puente.puede}>Generar video</Button>
            {aviso && <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--bad)' }}>{aviso}</span>}
            <EmpezarPlanYa texto={aviso || null} />
          </div>
          <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)', marginTop: 8 }}>Cada toma gasta créditos de tu cuenta de Flow.</div>
        </div>
      </div>
    );
  }

  const listas = tomas.filter((t) => t.fase === 'listo').length;
  const parada = tomas.find((t) => t.fase === 'error');
  return (
    <div>
      <Titulo nota={`${listas} de ${tomas.length} tomas`}>{listas === tomas.length ? 'Tu video está listo' : 'Generando tu video'}</Titulo>
      {parada && <div style={{ marginBottom: 12 }}><Banner tono="bad">{`Toma ${parada.n}: ${parada.detalle ?? 'no salió'}`}</Banner></div>}
      <div style={grilla(180)}>
        {tomas.map((t) => (
          <div key={t.n} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {t.fase === 'listo' && t.url
              ? <video src={t.url} controls playsInline style={{ width: '100%', aspectRatio: '9 / 16', borderRadius: 'var(--r-md)', background: '#000' }} />
              : (
                <div style={{ width: '100%', aspectRatio: '9 / 16', borderRadius: 'var(--r-md)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, boxSizing: 'border-box', textAlign: 'center' }}>
                  {t.fase === 'filmando' || t.fase === 'a_ciegas' ? <Spinner /> : <span style={{ fontSize: 'var(--fs-meta)', color: t.fase === 'error' ? 'var(--bad)' : 'var(--text-dim)' }}>{t.fase === 'error' ? 'No salió' : 'En espera'}</span>}
                </div>
              )}
            <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)' }}>Toma {t.n}{t.fase === 'a_ciegas' && t.detalle ? ` · ${t.detalle}` : ''}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
        {listas === tomas.length && planId && <ButtonLink href={rutaEditarEnEditor(`anuncio:${planId}`)}>Editar y exportar</ButtonLink>}
        {parada && planId && <Button variant="secondary" onClick={() => { setTomas((t) => t.map((x) => (x.fase === 'error' ? { ...x, fase: 'esperando', detalle: undefined } : x))); void filmar(planId, tomas.filter((x) => x.fase !== 'listo').map((x) => x.n)); }}>Volver a intentar</Button>}
        <Button variant="tertiary" onClick={() => { setPaso('avatar'); setTomas([]); setPlanId(''); router.refresh(); }}>Crear otro</Button>
      </div>
    </div>
  );
}
