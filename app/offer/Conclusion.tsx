'use client';

// =============================================================================
// Conclusion — lo que MaKo concluyó: el diagnóstico y la oferta nueva
// =============================================================================
// Arriba, el bloque héroe (el molde «tesis» de app/experimentos/RetroReport.tsx,
// con tokens y no con sus hex): la frase de la oferta en grande y el puntaje en un
// anillo, con UN chip que dice si está lista o qué es lo que más la frena. Debajo,
// las tres acciones y un switcher de dos vistas.
//
// v2: el diagnóstico de FASE del negocio (las preguntas que MaKo hizo en el chat) NO se dibuja acá:
// va al PDF (pedido de Martín: «el resultado del diagnóstico no se debe ver al finalizar esas
// preguntas, pero sí ser parte del PDF final»). El «Diagnóstico» de esta vista es el de la OFERTA.
//
// Lo que se dibuja sale TAL CUAL de la conclusión (lib/offer-marco.ts →
// ConclusionOferta). El puntaje, el cuello y «lista» los calcula el CÓDIGO
// (CalculoDiagnostico), nunca el modelo: aquí sólo se pintan.
//
// ⚠️ Todo «[completar]» se pinta como pastilla ámbar: es un dato que el dueño no dio
// y que MaKo NO inventa (testimonios, cifras, cupos). Escrito como texto normal se
// leería como parte de la oferta, y alguien lo copiaría tal cual a su landing.
//
// ⚠️ La conclusión viene de un modelo (saneada por el motor, pero de un modelo): se
// lee a la defensiva. Un campo que falta no puede tirar la pantalla entera.

import { useId, useState, type ReactNode } from 'react';
import { Banner, Button, ButtonLink } from '@/app/_ui';
import { MONO, TONO } from '@/app/_ui/tokens';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { Icon } from '@/app/_components/icons';
import { MakoStar } from '@/app/_components/MakoBrand';
import {
  DIMENSIONES, dimensionLabel,
  type CalculoDiagnostico, type ConclusionOferta, type DiagnosticoOferta, type NotaDimension, type OfferSesionVista, type PropuestaOferta,
} from '@/lib/offer-marco';
import {
  anchoDeNota, controlFinalDe, esSeccionProvisional, guardadaVisible, partirCompletar, propuestoPorMakoDe, provisionalDe, textoDeEstado, tiene,
  tonoDeNota, VARIABLE_LABEL,
  type AvisoGuardado, type Provisional, type PuntoVisible,
} from './ayudas';
import { descargarPdf, mensajeDeError } from './offer-api';

const LECTURA = 880;

const lista = <X,>(x: X[] | null | undefined): X[] => (Array.isArray(x) ? x : []);
const txt = (x: unknown): string => (typeof x === 'string' ? x : '');

// ── Piezas chicas ────────────────────────────────────────────────────────────

/** Un texto con sus «[completar]» como pastillas. */
function T({ v }: { v: string }) {
  return (
    <>
      {partirCompletar(v).map((p, i) => (p.t === 'marca'
        ? <span key={i} className="of-completar">{p.v}</span>
        : <span key={i}>{p.v}</span>))}
    </>
  );
}

const ETIQUETA = { fontSize: 'var(--fs-meta)', fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.07em' } as const;

function Campo({ etiqueta, v }: { etiqueta?: string; v: unknown }) {
  const s = txt(v);
  if (!tiene(s)) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {etiqueta && <span style={ETIQUETA}>{etiqueta}</span>}
      <span style={{ fontSize: 'var(--fs-md)', lineHeight: 1.55, color: 'var(--ink)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}><T v={s} /></span>
    </div>
  );
}

function Lista({ etiqueta, items, numerada = false }: { etiqueta?: string; items: unknown[]; numerada?: boolean }) {
  const xs = items.map(txt).filter(tiene);
  if (!xs.length) return null;
  const Tag = numerada ? 'ol' : 'ul';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {etiqueta && <span style={ETIQUETA}>{etiqueta}</span>}
      <Tag style={{ margin: 0, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'var(--fs-md)', lineHeight: 1.5, color: 'var(--ink)' }}>
        {xs.map((x, i) => <li key={i}><T v={x} /></li>)}
      </Tag>
    </div>
  );
}

/**
 * Una tarjeta desplegable de la oferta nueva. Con `provisional` (el motivo, puede venir vacío) la sección
 * lleva la marca en el título —se ve aunque esté plegada— y el motivo en una línea arriba del contenido.
 */
function Plegable({ titulo, inicial, provisional, children }: { titulo: string; inicial: boolean; provisional?: string | null; children: ReactNode }) {
  const [abierto, setAbierto] = useState(inicial);
  const id = useId();
  const marcada = provisional != null;
  return (
    <section style={{ background: 'var(--surface)', border: `1px solid ${marcada ? 'var(--warn-fill)' : 'var(--border)'}`, borderRadius: 16 }}>
      <button type="button" className="of-plegable" aria-expanded={abierto} aria-controls={id} onClick={() => setAbierto((v) => !v)}>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--fs-card)', fontWeight: 700 }}>{titulo}</span>
          {marcada && <span className="of-provisional">Provisional</span>}
        </span>
        <span className="of-plegable__flecha" aria-hidden><Icon name="chevron" size={18} /></span>
      </button>
      {abierto && (
        <div id={id} style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {marcada && tiene(provisional) && (
            <p style={{ margin: 0, fontSize: 'var(--fs-sm)', lineHeight: 1.45, color: 'var(--warn)' }}>{provisional}</p>
          )}
          {children}
        </div>
      )}
    </section>
  );
}

// ── El héroe ─────────────────────────────────────────────────────────────────

function Anillo({ total }: { total: number }) {
  const n = Number.isFinite(total) ? Math.max(0, Math.min(100, Math.round(total))) : 0;
  const t = TONO[tonoDeNota(n / 10)];
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div role="img" aria-label={`Puntaje: ${n} de 100`} style={{ position: 'relative', width: 116, height: 116, flex: 'none' }}>
      <svg width={116} height={116} viewBox="0 0 100 100" aria-hidden style={{ display: 'block' }}>
        <circle cx={50} cy={50} r={r} fill="none" stroke="var(--border)" strokeWidth={9} />
        {n > 0 && (
          <circle cx={50} cy={50} r={r} fill="none" stroke={t.fill} strokeWidth={9} strokeLinecap="round"
            strokeDasharray={`${(n / 100) * c} ${c}`} transform="rotate(-90 50 50)" />
        )}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 32, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>{n}</span>
        <span style={{ marginTop: 3, fontSize: 'var(--fs-meta)', fontWeight: 600, color: 'var(--faint)' }}>/100</span>
      </div>
    </div>
  );
}

function ChipEstado({ calculo }: { calculo: CalculoDiagnostico }) {
  const t = TONO[calculo.lista ? 'good' : 'warn'];
  // Sin lista, el chip dice CUÁNTO falta (el control final del motor) y el detalle va en el Diagnóstico.
  const faltan = controlFinalDe(calculo).filter((x) => !x.ok).length;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, maxWidth: 260,
      background: t.bg, color: t.ink, border: `1px solid ${t.border}`, fontSize: 'var(--fs-sm)', fontWeight: 600, lineHeight: 1.3, textAlign: 'center',
    }}>
      {calculo.lista && <IconoMenu nombre="check" size={14} />}
      {textoDeEstado({ lista: !!calculo.lista, faltan, cuello: dimensionLabel(calculo.cuello) })}
    </span>
  );
}

/**
 * «Qué falta para venderla»: los puntos del control final que NO pasan, con su porqué. Sólo cuando la oferta
 * no está lista; arriba del diagnóstico, porque es lo que hay que hacer antes de salir a vender.
 */
function QueFalta({ puntos }: { puntos: PuntoVisible[] }) {
  return (
    <section aria-label="Qué falta para venderla" style={{ padding: '14px 18px 16px', borderRadius: 14, background: 'var(--warn-bg)', border: '1px solid var(--warn-fill)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ ...ETIQUETA, color: 'var(--warn)' }}>Qué falta para venderla</div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {puntos.map((x, i) => (
          <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span aria-hidden style={{ flex: 'none', marginTop: 2, display: 'flex', color: 'var(--warn)' }}><IconoMenu nombre="avisar" size={16} /></span>
            <span style={{ minWidth: 0, fontSize: 'var(--fs-md)', lineHeight: 1.5, color: 'var(--ink)' }}>
              <strong>{x.label}</strong>
              {x.porque && <span style={{ color: 'var(--dim)' }}> — <T v={x.porque} /></span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Heroe({ conclusion }: { conclusion: ConclusionOferta }) {
  const p = conclusion.propuesta;
  const nombre = txt(p?.nombre);
  const frase = txt(p?.frase) || nombre;
  return (
    <section style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20,
      padding: 'clamp(22px, 4vw, 34px) clamp(20px, 4vw, 38px)', display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap',
    }}>
      <div style={{ flex: '1 1 340px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 'none', display: 'flex' }}><MakoStar size={18} animate={false} /></span>
          <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--faint)' }}>Tu oferta</span>
        </div>
        {tiene(nombre) && frase !== nombre && (
          <div style={{ marginTop: 12, fontSize: 'var(--fs-card)', fontWeight: 600, color: 'var(--dim)' }}><T v={nombre} /></div>
        )}
        {tiene(frase) && (
          <p className="of-heroe-frase" style={{ margin: '8px 0 0', fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.28, color: 'var(--ink)', textWrap: 'pretty', overflowWrap: 'anywhere' }}>
            <T v={frase} />
          </p>
        )}
      </div>
      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginInline: 'auto' }}>
        <Anillo total={conclusion.calculo.total} />
        <ChipEstado calculo={conclusion.calculo} />
      </div>
    </section>
  );
}

// ── Las acciones ─────────────────────────────────────────────────────────────

function BarraAcciones({ sesion, onSeguir, onGuardar }: { sesion: OfferSesionVista; onSeguir: () => void; onGuardar: () => Promise<AvisoGuardado | null> }) {
  const [bajando, setBajando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Lo que el motor avisa al guardar (se guardó, pero algo quedó a medias): una línea, en ámbar. */
  const [aviso, setAviso] = useState<AvisoGuardado | null>(null);
  // Guardada = la versión vigente tiene su fila en `ofertas` y está ligada al funnel. Sale del DATO
  // (`ligada`, que el servidor calcula), no sólo del aviso de este momento: abrirla otro día también
  // tiene que ofrecer «Guardar en este funnel» si la liga quedó faltando. ⚠️ Con un aviso que se arregla
  // reintentando, el botón se queda: el aviso pide volver a tocarlo, y con «Guardada» en su lugar la
  // oferta quedaba suelta para siempre (revisión del 11/10). Con uno que NO (el funnel se borró o se
  // archivó), «Guardada» y el aviso al lado (ayudas.ts → guardadaVisible).
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
    // El aviso anterior se reemplaza recién con la respuesta: borrarlo antes haría que, mientras se
    // reintenta, el botón (con su giro) se cambie por «Guardada» sin que nada se haya ligado todavía.
    try { setAviso(await onGuardar()); } catch (e) { setError(mensajeDeError(e)); } finally { setGuardando(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button variant="primary" size="lg" loading={bajando} onClick={() => void pdf()} icon={<Icon name="descargar" size={18} />}>
          Descargar PDF
        </Button>
        <Button variant="secondary" size="lg" onClick={onSeguir}>Seguir afinando</Button>
        {guardada
          ? (
            // No es un botón apagado: un botón que no hace nada se lee como roto. Es el estado.
            <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 12px', minHeight: 'var(--touch)', color: 'var(--good)', fontWeight: 600, fontSize: 'var(--fs-md)' }}>
              <IconoMenu nombre="check" size={17} />Guardada
            </span>
          )
          // v2: la conversación es de un FUNNEL, y guardar liga la oferta a ese funnel (el contrato con el
          // motor). Una de la v1 (sin funnel) la guarda como oferta del negocio, como antes.
          : (
            <Button variant="tertiary" size="lg" loading={guardando} onClick={() => void guardar()}>
              {sesion.funnelId != null ? 'Guardar en este funnel' : 'Guardar como mi oferta'}
            </Button>
          )}
      </div>
      {error && <p role="alert" style={{ margin: '8px 2px 0', fontSize: 'var(--fs-sm)', lineHeight: 1.4, color: 'var(--bad)' }}>{error}</p>}
      {aviso?.texto.trim() && <p role="status" style={{ margin: '8px 2px 0', fontSize: 'var(--fs-sm)', lineHeight: 1.4, color: 'var(--warn)' }}>{aviso.texto}</p>}
    </div>
  );
}

// ── El diagnóstico ───────────────────────────────────────────────────────────

function FilaDimension({ label, nota, abierta, onAlternar }: { label: string; nota: NotaDimension | undefined; abierta: boolean; onAlternar: () => void }) {
  const id = useId();
  const valor = nota && Number.isFinite(nota.nota) ? Math.round(nota.nota) : null;
  const t = valor != null ? TONO[tonoDeNota(valor)] : null;
  const hayDetalle = !!nota && (tiene(txt(nota.porque)) || tiene(txt(nota.mejora)));
  return (
    <div>
      <button type="button" className="of-fila" aria-expanded={hayDetalle ? abierta : undefined} aria-controls={hayDetalle ? id : undefined}
        disabled={!hayDetalle} onClick={onAlternar}>
        <span className="of-fila__label">{label}</span>
        {/* La barra se RECORTA al 100 % (anchoDeNota) y el carril tiene overflow
            hidden: una nota fuera de escala no puede ensanchar la página. */}
        <span className="of-fila__barra" style={{ display: 'block', height: 10, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
          {valor != null && t && <span style={{ display: 'block', height: 10, width: `${anchoDeNota(valor)}%`, background: t.fill, borderRadius: 999 }} />}
        </span>
        <span className="of-fila__nota" style={{ fontSize: 'var(--fs-card)', color: t?.ink ?? 'var(--faint)' }}>{valor ?? '—'}</span>
        <span className="of-fila__flecha" aria-hidden style={{ visibility: hayDetalle ? 'visible' : 'hidden' }}><Icon name="chevron" size={16} /></span>
      </button>
      {abierta && hayDetalle && nota && (
        <div id={id} style={{ padding: '0 14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tiene(txt(nota.porque)) && (
            <p style={{ margin: 0, fontSize: 'var(--fs-md)', lineHeight: 1.55, color: 'var(--ink)' }}><T v={nota.porque} /></p>
          )}
          {tiene(txt(nota.mejora)) && (
            <p style={{ margin: 0, fontSize: 'var(--fs-md)', lineHeight: 1.55, color: 'var(--dim)' }}>
              <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Para subirla: </span><T v={nota.mejora} />
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function VistaDiagnostico({ d, calculo }: { d: DiagnosticoOferta; calculo: CalculoDiagnostico }) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const notas = lista(d?.dimensiones);
  const cambios = lista(d?.cambios).filter((c) => c && tiene(txt(c.titulo)));
  const alertas = lista(calculo?.alertas).map(txt).filter(tiene);
  const faltan = calculo?.lista ? [] : controlFinalDe(calculo).filter((x) => !x.ok);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {tiene(txt(d?.tesis)) && (
        <p style={{ margin: 0, fontSize: 'var(--fs-sect)', fontWeight: 600, lineHeight: 1.35, letterSpacing: '-0.01em', color: 'var(--ink)', textWrap: 'pretty' }}>
          <T v={d.tesis} />
        </p>
      )}

      {faltan.length > 0 && <QueFalta puntos={faltan} />}

      {/* Las 9 dimensiones en el ORDEN del marco (DIMENSIONES), no en el que las
          devolvió el modelo: así dos diagnósticos se comparan renglón por renglón. */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 6 }}>
        {DIMENSIONES.map((dim) => (
          <FilaDimension key={dim.id} label={dim.label} nota={notas.find((n) => n?.id === dim.id)}
            abierta={abierta === dim.id} onAlternar={() => setAbierta((a) => (a === dim.id ? null : dim.id))} />
        ))}
      </div>

      {tiene(txt(d?.fuerte)) && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 18px', borderRadius: 14, background: 'var(--good-bg)', border: '1px solid var(--good)' }}>
          <span aria-hidden style={{ color: 'var(--good)', display: 'flex', marginTop: 1 }}><IconoMenu nombre="check" size={18} /></span>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...ETIQUETA, color: 'var(--good)' }}>Lo más fuerte</div>
            <div style={{ marginTop: 3, fontSize: 'var(--fs-md)', lineHeight: 1.5, color: 'var(--ink)' }}><T v={d.fuerte} /></div>
          </div>
        </div>
      )}

      {alertas.map((a, i) => <Banner key={i} tono="warn" alcance="local">{a}</Banner>)}

      {cambios.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3 style={{ margin: '6px 0 2px', fontSize: 'var(--fs-sect)', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink)' }}>Lo primero que cambiaría</h3>
          {cambios.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', padding: '18px 20px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <span aria-hidden style={{ flex: 'none', width: 28, height: 28, borderRadius: 999, background: 'var(--primary-bg)', color: 'var(--primary)', fontWeight: 700, fontSize: 'var(--fs-sm)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                {i + 1}
              </span>
              <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-card)', fontWeight: 700, lineHeight: 1.35, color: 'var(--ink)' }}><T v={c.titulo} /></div>
                {tiene(txt(c.porque)) && <div style={{ marginTop: 4, fontSize: 'var(--fs-md)', lineHeight: 1.5, color: 'var(--dim)' }}><T v={c.porque} /></div>}
              </div>
              {/* Un cambio es una HIPÓTESIS (regla 10 del marco): se prueba en
                  Experiments, que abre el alta con la hipótesis ya escrita. */}
              {tiene(txt(c.hipotesis)) && (
                <ButtonLink href={`/experimentos?tab=experiments&hipotesis=${encodeURIComponent(c.hipotesis)}`} variant="secondary" size="sm">
                  Probarlo
                </ButtonLink>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

// ── La oferta nueva ──────────────────────────────────────────────────────────

function CajaCompletar({ items }: { items: string[] }) {
  const [abierta, setAbierta] = useState(false);
  const id = useId();
  return (
    <div style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-fill)', borderRadius: 16 }}>
      <button type="button" className="of-plegable of-plegable--aviso" aria-expanded={abierta} aria-controls={id} onClick={() => setAbierta((v) => !v)}
        style={{ color: 'var(--warn)' }}>
        <span aria-hidden style={{ display: 'flex' }}><IconoMenu nombre="avisar" size={18} /></span>
        <span style={{ flex: 1, fontSize: 'var(--fs-card)', fontWeight: 700 }}>
          {items.length} {items.length === 1 ? 'dato para completar' : 'datos para completar'}
        </span>
        <span className="of-plegable__flecha" aria-hidden style={{ color: 'var(--warn)' }}><Icon name="chevron" size={18} /></span>
      </button>
      {abierta && (
        <ul id={id} style={{ margin: 0, padding: '0 20px 18px 50px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'var(--fs-md)', lineHeight: 1.5, color: 'var(--ink)' }}>
          {items.map((x, i) => <li key={i}>{x}</li>)}
        </ul>
      )}
    </div>
  );
}

type Seccion = { key: string; titulo: string; contenido: ReactNode };

const algo = (...vals: unknown[]): boolean => vals.some((v) => (Array.isArray(v) ? v.some((x) => algo(x)) : v && typeof v === 'object' ? algo(...Object.values(v)) : tiene(txt(v))));

/**
 * Las secciones de la oferta nueva, en el orden de la plantilla del marco. Una
 * sección sin nada adentro NO se dibuja: una tarjeta vacía que se despliega a la
 * nada se lee como algo roto.
 */
function seccionesDe(p: PropuestaOferta): Seccion[] {
  const s: Array<Seccion & { hay: boolean }> = [
    {
      key: 'mensajes', titulo: 'Mensajes', hay: algo(p.mensajes),
      contenido: <><Campo etiqueta="Corto" v={p.mensajes?.corto} /><Campo etiqueta="Largo" v={p.mensajes?.largo} /><Campo etiqueta="Entrada" v={p.mensajes?.entrada} /></>,
    },
    {
      key: 'para-quien', titulo: 'Para quién es', hay: algo(p.paraQuien),
      contenido: <><Campo etiqueta="Perfil" v={p.paraQuien?.perfil} /><Campo etiqueta="Mínimo para entrar" v={p.paraQuien?.minimo} /><Campo etiqueta="No es para" v={p.paraQuien?.noEs} /></>,
    },
    {
      key: 'problema', titulo: 'Problema y destino', hay: algo(p.problema),
      contenido: (
        <>
          <Campo etiqueta="Hoy" v={p.problema?.hoy} />
          <Campo etiqueta="Después" v={p.problema?.despues} />
          <Lista etiqueta="Lo que lo frena" items={lista(p.problema?.obstaculos)} />
          <Campo etiqueta="Ya probó" v={p.problema?.yaProbo} />
        </>
      ),
    },
    {
      key: 'metodo', titulo: 'Método', hay: algo(p.mecanismo),
      contenido: (
        <>
          {lista(p.mecanismo?.nombres).map(txt).filter(tiene).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={ETIQUETA}>Nombres propuestos</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {lista(p.mecanismo?.nombres).map(txt).filter(tiene).map((n, i) => (
                  <span key={i} style={{ padding: '6px 14px', borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border-strong)', fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--ink)' }}>
                    <T v={n} />
                  </span>
                ))}
              </div>
            </div>
          )}
          <Lista etiqueta="Pasos" items={lista(p.mecanismo?.pasos)} numerada />
          <Campo etiqueta="Por qué es distinto" v={p.mecanismo?.distinto} />
        </>
      ),
    },
    {
      key: 'ruta', titulo: 'Ruta', hay: algo(p.ruta),
      contenido: (
        <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lista(p.ruta).filter((f) => algo(f)).map((f, i) => (
            <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span aria-hidden style={{ flex: 'none', width: 26, height: 26, borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border-strong)', fontSize: 'var(--fs-meta)', fontWeight: 700, color: 'var(--dim)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {tiene(txt(f.fase)) && <span style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--ink)' }}><T v={f.fase} /></span>}
                {tiene(txt(f.objetivo)) && <span style={{ fontSize: 'var(--fs-md)', lineHeight: 1.5, color: 'var(--ink)' }}><T v={f.objetivo} /></span>}
                {tiene(txt(f.hito)) && <span style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.45, color: 'var(--dim)' }}>Hito: <T v={f.hito} /></span>}
              </div>
            </li>
          ))}
        </ol>
      ),
    },
    {
      key: 'incluye', titulo: 'Qué incluye', hay: algo(p.incluye),
      contenido: (
        <ul style={{ margin: 0, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 'var(--fs-md)', lineHeight: 1.5, color: 'var(--ink)' }}>
          {lista(p.incluye).filter((e) => algo(e)).map((e, i) => (
            <li key={i}>
              {tiene(txt(e.nombre)) && <strong><T v={e.nombre} /></strong>}
              {tiene(txt(e.nombre)) && tiene(txt(e.beneficio)) && ' — '}
              {tiene(txt(e.beneficio)) && <span style={{ color: 'var(--dim)' }}><T v={e.beneficio} /></span>}
            </li>
          ))}
        </ul>
      ),
    },
    { key: 'formato', titulo: 'Formato', hay: algo(p.formato), contenido: <Campo v={p.formato} /> },
    { key: 'prueba', titulo: 'Prueba', hay: algo(p.prueba), contenido: <Campo v={p.prueba} /> },
    {
      key: 'garantia', titulo: 'Garantía', hay: algo(p.garantia),
      contenido: (
        <>
          <Campo etiqueta="Nombre" v={p.garantia?.nombre} />
          <Campo etiqueta="Condiciones" v={p.garantia?.condiciones} />
          <Campo etiqueta="Plazo" v={p.garantia?.plazo} />
          <Campo etiqueta="Si no cumple" v={p.garantia?.siNoCumple} />
        </>
      ),
    },
    {
      key: 'bonos', titulo: 'Bonos', hay: algo(p.bonos),
      contenido: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lista(p.bonos).filter((b) => algo(b)).map((b, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 12, borderLeft: '3px solid var(--border-strong)' }}>
              {tiene(txt(b.nombre)) && <span style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--ink)' }}><T v={b.nombre} /></span>}
              {tiene(txt(b.objecion)) && <span style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.45, color: 'var(--dim)' }}>Ataca: <T v={b.objecion} /></span>}
              {tiene(txt(b.valor)) && <span style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.45, color: 'var(--dim)' }}>Valor: <T v={b.valor} /></span>}
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'inversion', titulo: 'Inversión', hay: algo(p.inversion),
      contenido: (
        <>
          <Campo etiqueta="Valor total" v={p.inversion?.valorTotal} />
          <Campo etiqueta="Precio" v={p.inversion?.precio} />
          <Campo etiqueta="De contado" v={p.inversion?.contado} />
          <Campo etiqueta="En cuotas" v={p.inversion?.plan} />
          <Campo etiqueta="Cómo decirlo" v={p.inversion?.comoDecirlo} />
        </>
      ),
    },
    { key: 'urgencia', titulo: 'Urgencia', hay: algo(p.urgencia), contenido: <Campo v={p.urgencia} /> },
    {
      key: 'escenarios', titulo: 'Mejor y peor escenario', hay: algo(p.escenarios),
      contenido: <><Campo etiqueta="Mejor" v={p.escenarios?.mejor} /><Campo etiqueta="Peor" v={p.escenarios?.peor} /></>,
    },
    {
      key: 'ecuacion', titulo: 'Ecuación de valor', hay: algo(p.ecuacion),
      contenido: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lista(p.ecuacion).filter((f) => algo(f.antes, f.despues)).map((f, i) => (
            <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', alignItems: 'baseline', padding: '10px 14px', borderRadius: 12, background: 'var(--surface-2)' }}>
              <span style={{ ...ETIQUETA, flex: '0 0 110px' }}>{VARIABLE_LABEL[f.variable] ?? txt(f.variable)}</span>
              <span style={{ flex: '1 1 220px', minWidth: 0, fontSize: 'var(--fs-md)', lineHeight: 1.5, color: 'var(--ink)' }}>
                <span style={{ color: 'var(--dim)' }}><T v={txt(f.antes)} /></span>
                <span aria-label="pasa a" style={{ margin: '0 8px', color: 'var(--faint)' }}>→</span>
                <span style={{ fontWeight: 600 }}><T v={txt(f.despues)} /></span>
              </span>
            </div>
          ))}
        </div>
      ),
    },
    { key: 'numeros', titulo: 'Números', hay: algo(p.numeros), contenido: <Lista items={lista(p.numeros)} /> },
    { key: 'validar', titulo: 'Cómo validarla', hay: algo(p.validar), contenido: <Lista items={lista(p.validar)} numerada /> },
    { key: 'siguiente', titulo: 'Siguiente escalón', hay: algo(p.siguiente), contenido: <Campo v={p.siguiente} /> },
  ];
  return s.filter((x) => x.hay).map(({ key, titulo, contenido }) => ({ key, titulo, contenido }));
}

/**
 * «Lo que propuso MaKo»: lo que MaKo puso de su cosecha y el dueño no dijo. Va al final y APARTE de los
 * datos a completar: lo uno es una propuesta para revisar, lo otro un hueco que sólo el dueño llena.
 */
function PropuestoPorMako({ items }: { items: Array<{ seccion: string; que: string }> }) {
  return (
    <section aria-label="Lo que propuso MaKo" style={{ marginTop: 8, padding: '16px 20px 18px', borderRadius: 16, background: 'var(--mako-bg)', border: '1px solid var(--mako-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span aria-hidden style={{ display: 'flex' }}><MakoStar size={16} animate={false} /></span>
        <h3 style={{ margin: 0, fontSize: 'var(--fs-card)', fontWeight: 700, color: 'var(--ink)' }}>Lo que propuso MaKo</h3>
      </div>
      <ul style={{ margin: 0, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'var(--fs-md)', lineHeight: 1.5, color: 'var(--ink)' }}>
        {items.map((x, i) => (
          <li key={i}>
            {x.seccion && <strong>{x.seccion}: </strong>}
            <T v={x.que} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function VistaOferta({ p, provisional }: { p: PropuestaOferta; provisional: Provisional | null }) {
  const completar = lista(p?.completar).map(txt).filter(tiene);
  const secciones = p ? seccionesDe(p) : [];
  const propuesto = propuestoPorMakoDe(p);
  // Lo que arma el CÓDIGO del motor (12/10/2026): las reglas del marco que la propuesta no cumple (`avisos`,
  // el PDF las pone antes de la oferta) y lo que el dueño dijo que no sabe (`supuestos`, a la vista).
  const avisos = lista(p?.avisos).map(txt).filter(tiene);
  const supuestos = lista(p?.supuestos).map(txt).filter(tiene);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {avisos.map((a, i) => <Banner key={i} tono="warn" alcance="local">{a}</Banner>)}
      {completar.length > 0 && <CajaCompletar items={completar} />}
      {supuestos.length > 0 && <Plegable titulo="Supuestos" inicial={false}><Lista items={supuestos} /></Plegable>}
      {/* Las tres primeras abiertas: es lo que se lee de entrada. El resto, a un clic. El precio y los
          bonos van marcados PROVISIONALES cuando el motor lo dice (Cliente ideal o Promesa en 3 o menos). */}
      {secciones.map((s, i) => (
        <Plegable key={s.key} titulo={s.titulo} inicial={i < 3}
          provisional={esSeccionProvisional(s.key, provisional) ? provisional?.motivo ?? '' : null}>
          {s.contenido}
        </Plegable>
      ))}
      {propuesto.length > 0 && <PropuestoPorMako items={propuesto} />}
    </div>
  );
}

// ── La vista ─────────────────────────────────────────────────────────────────

type Pestana = 'diagnostico' | 'oferta';
const PESTANAS: ReadonlyArray<{ id: Pestana; label: string }> = [
  { id: 'diagnostico', label: 'Diagnóstico' },
  { id: 'oferta', label: 'Oferta nueva' },
];

export function Conclusion({ sesion, conclusion, onSeguir, onGuardar }: {
  sesion: OfferSesionVista;
  conclusion: ConclusionOferta;
  /** Vuelve al chat (la conclusión sigue a un clic, con «Ver mi oferta»). */
  onSeguir: () => void;
  /** Guarda la oferta nueva (v2: ligada al funnel de la conversación). Tira si falla; devuelve el aviso del motor, si hay. */
  onGuardar: () => Promise<AvisoGuardado | null>;
}) {
  const [pestana, setPestana] = useState<Pestana>('diagnostico');
  const id = useId();
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <div style={{ maxWidth: LECTURA, marginInline: 'auto', padding: '2px 2px 40px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Heroe conclusion={conclusion} />
        <BarraAcciones sesion={sesion} onSeguir={onSeguir} onGuardar={onGuardar} />
        <div role="tablist" aria-label="Qué ver" className="of-seg" style={{ alignSelf: 'flex-start', marginTop: 4 }}>
          {PESTANAS.map((p) => (
            <button key={p.id} type="button" role="tab" id={`${id}-tab-${p.id}`} aria-controls={`${id}-panel`}
              aria-selected={pestana === p.id} tabIndex={pestana === p.id ? 0 : -1} className="of-seg__op"
              onClick={() => setPestana(p.id)}
              onKeyDown={(e) => {
                // Flechas entre las dos pestañas, como en cualquier tablist.
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                e.preventDefault();
                const otra = PESTANAS.find((x) => x.id !== p.id);
                if (!otra) return;
                setPestana(otra.id);
                document.getElementById(`${id}-tab-${otra.id}`)?.focus();
              }}>
              {p.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${pestana}`}>
          {pestana === 'diagnostico'
            ? <VistaDiagnostico d={conclusion.diagnostico} calculo={conclusion.calculo} />
            : <VistaOferta p={conclusion.propuesta} provisional={provisionalDe(conclusion)} />}
        </div>
      </div>
    </div>
  );
}
