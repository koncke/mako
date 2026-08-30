'use client';

// =============================================================================
// WizardAnuncio — un paso por pantalla, y en cada uno UNA sola cosa
// =============================================================================
// Martín, con la pantalla anterior delante: «El problema no es únicamente que la
// tab esté mal diseñada, está mal PLANTEADA DESDE EL ORIGEN. Es contraintuitiva,
// no se deduce qué hay que hacer en menos de 1 segundo. Tiene MUCHOS textos. Ya
// muchas veces hablamos de hacer todo modular, que sea 1 SOLO PASO A LA VEZ.
// Hacer cosas GRANDES, ENORMES, en lugar de muchas cosas juntas, con mucho
// texto, chiquito.»
//
// ⚠️ Y el error que hubo que deshacer para llegar acá: la versión anterior
// COMPACTÓ la pantalla —dos listas en una, la mitad de alto, menos avisos— y
// siguió estando mal. Compactar una pantalla sobrecargada la deja sobrecargada y
// más chica. Lo que se pide es SACAR pasos de la pantalla, no acomodarlos mejor.
//
// ── Las cuatro reglas, y ninguna es negociable ─────────────────────────────
//   1. UNA decisión por pantalla. Tres decisiones son tres pantallas.
//   2. El objeto de la decisión ocupa el alto útil (`--wz-lienzo`).
//   3. Tope de 25 palabras de chrome —pregunta, botón, consecuencia, atrás—.
//      El guion y lo que escribió MaKo son CONTENIDO y no cuentan.
//   4. Un solo botón que avanza. Lo demás es «atrás» o se pliega.
//
// El test es literal: alguien mira la pantalla UN SEGUNDO y tiene que saber qué
// hacer. Un segundo no alcanza para leer un párrafo, así que la respuesta vive en
// el TAMAÑO y en que haya una sola cosa.
//
// ── La posición sale del DATO ──────────────────────────────────────────────
// No hay índice de paso ni memoria de clicks: `pasoDe()` mira el plan y contesta
// dónde está. Es el mismo patrón que ya usaba `escenaAbierta()`, extendido al
// flujo entero. Con eso, recargar cae en el mismo lugar y no existe el estado
// «la pantalla cree que voy en la 4 y el dato dice otra cosa».

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from '@/app/_ui/Link';
import { Button, Tag, Status, TextField, MONO } from '@/app/_ui';
import { WizardShell } from '../_components/WizardShell';
import { Icon } from '../_components/icons';
import type { PlanGuardado, EstadoContextoVideo } from './video-datos';
import type { Puesta } from '@/lib/puestas-data';
import { causaFlow, textoFlow, type CausaFlow } from '@/lib/flow-fallo-texto';
import {
  escribirEscenasAction, corregirEscenaAction, generarImagenAction, estadoImagenAction,
  elegirImagenAction, subirImagenEscenaAction, confirmarEscenaAction,
  generarTomaAction, estadoTomaAction, descartarTomaAction, marcarCaraVistaAction,
} from './video-action';
import { editarLineaPlanAction, reescribirTomaAction } from './actions';
import { EditarTexto } from '../components/SeccionCard';

/**
 * El alto de lo enorme.
 *
 * Contra el VIEWPORT y no contra el padre: en un `<main>` con `flex: 1` el alto
 * del padre es indefinido para el motor, y un porcentaje contra un alto
 * indefinido no resuelve — Chrome lo aguanta y Safari devuelve CERO, que es una
 * pantalla en blanco. Ya pasó en este repo y se reportó tres veces como «el plan
 * está vacío» desde una Mac.
 */
const LIENZO = 'min(62vh, 720px)';
const ANCHO_CUERPO = 880;

// ── Dónde está el anuncio ───────────────────────────────────────────────────

type Paso =
  | { id: 'guion-leer' }
  | { id: 'escenario'; n: number }
  | { id: 'cara' }
  | { id: 'toma'; n: number }
  | { id: 'listo' };

/**
 * El paso en el que está el anuncio, DERIVADO del plan.
 *
 * El orden de las preguntas es el orden de la producción: se lee el guion, se
 * fija cada lugar, se mira la cara una vez, se filma toma por toma.
 */
export function pasoDe(item: PlanGuardado, forzado: Paso | null): Paso {
  if (forzado) return forzado;
  const escenas = item.escenas ?? [];
  if (!escenas.length) return { id: 'guion-leer' };

  const sinConfirmar = escenas.find((e) => !item.imagenes?.[String(e.n)]?.confirmada);
  if (sinConfirmar) return { id: 'escenario', n: sinConfirmar.n };

  const tomas = item.plan.clips;
  const uno = item.video?.['1'];
  // La cara se mira UNA vez, y justo cuando existe la evidencia para mirarla: con
  // la toma 1 lista y ninguna otra. Antes no hay qué comparar; después ya se
  // heredó en seis clips pagados.
  if (uno?.url && !item.caraVista) return { id: 'cara' };

  const falta = tomas.find((c) => !item.video?.[String(c.n)]?.url);
  if (falta) return { id: 'toma', n: falta.n };
  return { id: 'listo' };
}

/** El mapa que ve el indicador de progreso. Sale del dato, como la posición. */
function mapaDe(item: PlanGuardado): string[] {
  const escenas = item.escenas ?? [];
  return [
    'guion-leer',
    ...(escenas.length ? escenas.map((e) => `escenario-${e.n}`) : ['escenario-1']),
    'toma-1', 'cara',
    ...item.plan.clips.slice(1).map((c) => `toma-${c.n}`),
    'listo',
  ];
}

function clave(p: Paso): string {
  return p.id === 'escenario' || p.id === 'toma' ? `${p.id}-${p.n}` : p.id;
}

// ── Piezas ──────────────────────────────────────────────────────────────────

/** Un 9:16 a tamaño de decisión. Es lo enorme de casi todas las pantallas. */
function Vertical({ children, fondo }: { children: React.ReactNode; fondo?: string }) {
  return (
    <div style={{
      height: LIENZO, aspectRatio: '9 / 16', borderRadius: 16, overflow: 'hidden',
      background: fondo ?? 'var(--surface-2)', position: 'relative', flex: 'none',
      display: 'grid', placeItems: 'center',
    }}>
      {children}
    </div>
  );
}

const MEDIO: React.CSSProperties = {
  display: 'block', width: '100%', height: '100%', objectFit: 'cover',
};

/** La niebla de Flow, a tamaño real. Con el reloj, que es lo único cierto. */
function Niebla({ etiqueta, desde }: { etiqueta: string; desde: number }) {
  const [ahora, setAhora] = useState(desde);
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const seg = Math.max(0, Math.round((ahora - desde) / 1000));
  return (
    <div
      className="mk-lienzo"
      style={{ width: '100%', height: '100%', borderRadius: 0 }}
      role="status"
      aria-label={etiqueta}
    >
      {/* Como en Flow: el ícono arriba a la izquierda y el contador a la derecha.
          Lo de Flow es un PORCENTAJE porque su servidor se lo dice; el nuestro no
          lo sabe, así que va el tiempo, que es cierto. Un número inventado que
          avanza solo es la clase de mentira que después nadie perdona. */}
      <div style={{
        position: 'absolute', inset: '16px 18px auto 18px', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ color: 'rgba(255,255,255,.75)', lineHeight: 0 }}>
          <Icon name="tvad" size={19} />
        </span>
        <span style={{
          fontFamily: MONO, fontSize: 14, color: 'rgba(255,255,255,.75)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {`${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`}
        </span>
      </div>
    </div>
  );
}

/** Un video que se reproduce solo, y un play si el navegador no deja. */
function Clip({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [trabado, setTrabado] = useState(false);
  useEffect(() => {
    // ⚠️ El autoplay se RECHAZA cuando se entra por `?plan=` sin ningún gesto
    // previo, que es el caso normal al volver a un anuncio. Sin este fallback, un
    // clip que el navegador no deja arrancar se ve igual que uno que salió mudo.
    ref.current?.play().catch(() => setTrabado(true));
  }, [src]);
  return (
    <>
      <video ref={ref} key={src} src={src} controls loop playsInline style={MEDIO} />
      {trabado && (
        <button
          type="button"
          onClick={() => { void ref.current?.play(); setTrabado(false); }}
          aria-label="Reproducir"
          style={{
            position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
            background: 'rgba(0,0,0,.25)', border: 'none', cursor: 'pointer', color: '#fff',
          }}
        >
          <Icon name="play" size={64} />
        </button>
      )}
    </>
  );
}

/** El rótulo de un panel de comparación. Dos palabras, abajo, sin adornos. */
function Pie({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      textAlign: 'center', marginTop: 10, fontSize: 'var(--fs-sm)',
      color: 'var(--dim)', fontWeight: 600,
    }}>
      {children}
    </div>
  );
}

/** Las salidas del «no». Plegadas: en un segundo no se ve lo que hay adentro. */
function Salidas({ resumen, children }: { resumen: string; children: React.ReactNode }) {
  return (
    <details style={{ marginTop: 4 }}>
      <summary style={{
        cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--dim)',
        textAlign: 'center', listStyle: 'none',
      }}>
        {resumen}
      </summary>
      <div style={{
        display: 'flex', gap: 9, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12,
      }}>
        {children}
      </div>
    </details>
  );
}

// ── El wizard ───────────────────────────────────────────────────────────────

export function WizardAnuncio({ item, contexto, puesta, costoTexto, onCambio, onSalir }: {
  item: PlanGuardado;
  contexto: EstadoContextoVideo | null;
  puesta: Puesta | undefined;
  /** Lo que cuesta una toma, ya redactado por quien sabe el saldo. */
  costoTexto: string;
  onCambio: (item: PlanGuardado) => void;
  onSalir: () => void;
}) {
  const [forzado, setForzado] = useState<Paso | null>(null);
  const [ocupado, setOcupado] = useState('');
  const [error, setError] = useState('');
  const [ajuste, setAjuste] = useState('');
  const [pidiendo, setPidiendo] = useState(false);
  const [desde, setDesde] = useState(() => Date.now());
  const archivo = useRef<HTMLInputElement>(null);

  const paso = pasoDe(item, forzado);
  const mapa = useMemo(() => mapaDe(item), [item]);
  const total = item.plan.clips.length;

  const correr = useCallback(async (
    etiqueta: string,
    fn: () => Promise<{ ok: boolean; item?: PlanGuardado; error?: string }>,
    avanzar = true,
  ) => {
    setOcupado(etiqueta);
    setError('');
    setDesde(Date.now());
    const r = await fn().catch(() => ({ ok: false as const, error: 'No se pudo. Vuelve a intentarlo.' }));
    if (r.ok && r.item) {
      onCambio(r.item);
      // Al avanzar se suelta el paso forzado: la posición vuelve a salir del dato.
      if (avanzar) setForzado(null);
    } else {
      setError(r.error || 'No se pudo.');
    }
    setOcupado('');
  }, [onCambio]);

  // ── El sondeo, uno solo y para las dos esperas ──────────────────────────
  // La imagen del escenario y el clip de la toma esperan igual y se apagan igual.
  const escenaEnCurso = (item.escenas ?? []).find((e) => {
    const m = item.imagenes?.[String(e.n)];
    return !!m?.trabajoId && !m?.opciones?.length && !m?.error;
  });
  const tomaEnCurso = item.plan.clips.find((c) => {
    const v = item.video?.[String(c.n)];
    return !!v && !v.url && !v.error;
  });

  useEffect(() => {
    if (!escenaEnCurso && !tomaEnCurso) return;
    let vivo = true;
    const t = setInterval(async () => {
      const r = escenaEnCurso
        ? await estadoImagenAction(item.id, escenaEnCurso.n).catch(() => null)
        : await estadoTomaAction(item.id, tomaEnCurso!.n).catch(() => null);
      if (vivo && r?.ok) onCambio(r.item);
    }, escenaEnCurso ? 4000 : 6000);
    return () => { vivo = false; clearInterval(t); };
  }, [escenaEnCurso, tomaEnCurso, item.id, onCambio]);

  const subir = useCallback((n: number, f: File | null) => {
    if (!f) return;
    const lector = new FileReader();
    lector.onload = () => {
      void correr('subir', () => subirImagenEscenaAction(item.id, n, String(lector.result || '')), false);
    };
    lector.readAsDataURL(f);
  }, [correr, item.id]);

  // ── Las siete pantallas ────────────────────────────────────────────────
  const p = pantalla();

  function pantalla(): {
    pregunta: string; titulo?: string; sub?: string; cuerpo: React.ReactNode;
    boton?: string; consecuencia?: string; onSiguiente?: () => void;
    atras?: string; onAtras?: () => void; cargandoBoton?: boolean;
  } {
    // ── 1. El guion ───────────────────────────────────────────────────────
    if (paso.id === 'guion-leer') {
      return {
        pregunta: '¿Dice lo que quieres decir?',
        cuerpo: (
          <div style={{ height: LIENZO, overflowY: 'auto', minHeight: 0, width: '100%' }}>
            {item.plan.clips.map((c) => (
              <div
                key={c.n}
                style={{
                  display: 'flex', gap: 16, padding: '15px 0',
                  borderTop: c.n === 1 ? 'none' : '1px solid var(--border)',
                }}
              >
                <div style={{
                  flex: 'none', width: 30, textAlign: 'right', fontFamily: MONO,
                  fontSize: 14, color: 'var(--faint)', paddingTop: 5,
                }}>
                  {c.n}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Tamaño de LECTURA, fuera de la escala de la interfaz y a
                      propósito: esto no es texto de una pantalla, es lo que una
                      persona va a decir a cámara. */}
                  <EditarTexto
                    valor={c.voz}
                    multiline
                    enfasis
                    disabled={ocupado === 'linea'}
                    onSave={(v) => void correr('linea', () => editarLineaPlanAction(item.id, c.n, v), false)}
                    style={{
                      fontSize: 'clamp(18px, 1.5vw, 23px)', lineHeight: 1.45,
                      color: c.habla ? 'var(--ink)' : 'var(--dim)',
                      fontStyle: c.habla ? 'normal' : 'italic',
                    }}
                  />
                  {(c.palabras ?? 0) > (c.tope ?? 0) && (
                    <div style={{ marginTop: 5 }}>
                      <Status tono="warn">Muy largo para {c.segundos} segundos</Status>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ),
        boton: 'Escribir dónde se filma',
        consecuencia: 'No gasta créditos. MaKo tarda unos segundos.',
        cargandoBoton: ocupado === 'escenas',
        onSiguiente: () => void correr('escenas', () => escribirEscenasAction(item.id)),
        atras: 'Volver al catálogo',
        onAtras: onSalir,
      };
    }

    // ── 2. El lugar ───────────────────────────────────────────────────────
    if (paso.id === 'escenario') {
      const escena = (item.escenas ?? []).find((e) => e.n === paso.n);
      const marca = item.imagenes?.[String(paso.n)];
      const opciones = marca?.opciones ?? [];
      const generando = !!marca?.trabajoId && !opciones.length && !marca?.error;
      const causa: CausaFlow | undefined = marca?.error
        ? ((marca.errorCausa as CausaFlow) ?? causaFlow(marca.errorCrudo ?? marca.error))
        : undefined;
      const txt = causa ? textoFlow(causa, `la imagen del escenario ${paso.n}`, marca?.errorAt) : null;

      const derecha = txt ? (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 650, color: 'var(--ink)' }}>{txt.titulo}</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginTop: 9, lineHeight: 1.5 }}>
            {txt.detalle}
          </div>
        </div>
      ) : generando ? (
        <Niebla etiqueta={`Generando la imagen del escenario ${paso.n}`} desde={desde} />
      ) : marca?.elegida ? (
        <img src={marca.elegida} alt={escena?.lugar ?? ''} style={MEDIO} />
      ) : (
        <div style={{ color: 'var(--faint)' }}><Icon name="imagegen" size={44} /></div>
      );

      return {
        pregunta: opciones.length ? '¿Sirve esta imagen?' : '¿Dónde se filma?',
        titulo: escena?.lugar,
        cuerpo: (
          <div>
            <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
              <div>
                <Vertical>
                  {contexto?.fotoUrl
                    ? <img src={contexto.fotoUrl} alt="Tu foto" style={MEDIO} />
                    : <div style={{ color: 'var(--faint)' }}><Icon name="perfil" size={44} /></div>}
                </Vertical>
                <Pie>Tu foto</Pie>
              </div>
              <div>
                <Vertical fondo={txt ? 'var(--surface-2)' : undefined}>{derecha}</Vertical>
                <Pie>{opciones.length > 1 ? 'Lo que salió' : 'Lo que salió'}</Pie>
              </div>
            </div>

            {/* Las variantes: cambian lo que muestra el panel, no son otra
                decisión ni otra pantalla. */}
            {opciones.length > 1 && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                {opciones.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => void correr('elegir', () => elegirImagenAction(item.id, paso.n, u), false)}
                    title="Usar esta"
                    style={{
                      width: 40, aspectRatio: '9 / 16', borderRadius: 7, overflow: 'hidden',
                      padding: 0, cursor: 'pointer', lineHeight: 0,
                      border: u === marca?.elegida ? '2px solid var(--primary)' : '1px solid var(--border)',
                    }}
                  >
                    <img src={u} alt="" style={MEDIO} />
                  </button>
                ))}
              </div>
            )}

            {opciones.length > 0 && (
              <Salidas resumen="No sirve">
                <Button
                  size="sm"
                  variant="mako"
                  loading={ocupado === 'imagen'}
                  onClick={() => void correr('imagen', () => generarImagenAction(item.id, paso.n), false)}
                >
                  Generar la imagen otra vez
                </Button>
                <Button size="sm" variant="tertiary" onClick={() => setPidiendo((v) => !v)}>
                  Decir qué cambiar
                </Button>
                <Button size="sm" variant="tertiary" onClick={() => archivo.current?.click()}>
                  Subir mi foto del lugar
                </Button>
                {/* Nueva: hoy el link a cambiar la foto propia desaparece justo
                    cuando ya cargaste una, que es cuando hace falta. */}
                <Link href="/onboarding" style={{ fontSize: 'var(--fs-sm)', alignSelf: 'center' }}>
                  Cambiar mi foto de entrada
                </Link>
              </Salidas>
            )}

            {pidiendo && (
              <div style={{ display: 'flex', gap: 9, alignItems: 'flex-end', marginTop: 12 }}>
                <div style={{ flex: 1 }}>
                  <TextField label="Qué cambiarle" value={ajuste} onChange={(e) => setAjuste(e.target.value)} />
                </div>
                <Button
                  variant="mako"
                  loading={ocupado === 'corregir'}
                  disabled={!ajuste.trim()}
                  onClick={async () => {
                    await correr('corregir', () => corregirEscenaAction(item.id, paso.n, ajuste), false);
                    setAjuste('');
                    setPidiendo(false);
                  }}
                >
                  Pedirle el cambio a MaKo
                </Button>
              </div>
            )}

            <input
              ref={archivo}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={(e) => { subir(paso.n, e.target.files?.[0] ?? null); e.target.value = ''; }}
            />
          </div>
        ),
        boton: txt
          ? txt.accion
          : opciones.length
            ? `Confirmar el escenario ${paso.n}`
            : `Generar la imagen del escenario ${paso.n}`,
        consecuencia: opciones.length ? 'No gasta créditos. Filmar sí gasta.' : 'No gasta créditos.',
        cargandoBoton: ocupado === 'imagen' || ocupado === 'confirmar' || generando,
        onSiguiente: opciones.length
          ? () => void correr('confirmar', () => confirmarEscenaAction(item.id, paso.n))
          : () => void correr('imagen', () => generarImagenAction(item.id, paso.n), false),
        atras: 'Volver al guion',
        onAtras: () => setForzado({ id: 'guion-leer' }),
      };
    }

    // ── 3. La cara ────────────────────────────────────────────────────────
    if (paso.id === 'cara') {
      const uno = item.video?.['1'];
      return {
        pregunta: '¿Seguimos con esta cara?',
        cuerpo: (
          <div>
            <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
              <div>
                <Vertical>
                  {contexto?.fotoUrl
                    ? <img src={contexto.fotoUrl} alt="Tu foto" style={MEDIO} />
                    : <div style={{ color: 'var(--faint)' }}><Icon name="perfil" size={44} /></div>}
                </Vertical>
                <Pie>Tu foto</Pie>
              </div>
              <div>
                <Vertical fondo="#000">{uno?.url ? <Clip src={uno.url} /> : null}</Vertical>
                <Pie>La toma 1</Pie>
              </div>
            </div>
            <Salidas resumen={`No se parece · ~15 créditos`}>
              <Button
                size="sm"
                variant="mako"
                loading={ocupado === 'rehacer'}
                onClick={() => void correr('rehacer', async () => {
                  const d = await descartarTomaAction(item.id, 1);
                  if (!d.ok) return d;
                  return generarTomaAction(item.id, 1);
                }, false)}
              >
                Rehacer la toma 1
              </Button>
              <Link href="/onboarding" style={{ fontSize: 'var(--fs-sm)', alignSelf: 'center' }}>
                Cambiar mi foto en Onboarding
              </Link>
            </Salidas>
          </div>
        ),
        boton: `Seguir y filmar la toma 2`,
        consecuencia: costoTexto,
        cargandoBoton: ocupado === 'cara',
        onSiguiente: () => void correr('cara', async () => {
          const m = await marcarCaraVistaAction(item.id);
          if (!m.ok) return m;
          return generarTomaAction(item.id, 2);
        }),
      };
    }

    // ── 4. Filmar ─────────────────────────────────────────────────────────
    if (paso.id === 'toma') {
      const n = paso.n;
      const anterior = item.plan.clips.slice(0, n - 1).reverse().find((c) => item.video?.[String(c.n)]?.url);
      const vAnterior = anterior ? item.video?.[String(anterior.n)] : undefined;
      const enCurso = item.video?.[String(n)] && !item.video[String(n)]?.url && !item.video[String(n)]?.error;
      const fallo = item.video?.[String(n)]?.error;
      const escena = (item.escenas ?? []).find((e) => n >= e.desde && n <= e.hasta);
      const imagen = escena ? item.imagenes?.[String(escena.n)]?.elegida : '';

      const causa: CausaFlow | undefined = fallo
        ? ((item.video?.[String(n)]?.errorCausa as CausaFlow) ?? causaFlow(fallo))
        : undefined;
      const txt = causa ? textoFlow(causa, `la toma ${n}`, item.video?.[String(n)]?.errorAt) : null;

      // Lo enorme NUNCA está vacío: si no hay clip que mirar, se muestra la
      // imagen confirmada del escenario, que es literalmente el primer cuadro
      // que se va a animar.
      const dentro = enCurso
        ? <Niebla etiqueta={`Filmando la toma ${n}`} desde={desde} />
        : vAnterior?.url
          ? <Clip src={vAnterior.url} />
          : imagen
            ? <img src={imagen} alt={`El escenario de la toma ${n}`} style={MEDIO} />
            : null;

      return {
        pregunta: enCurso
          ? `Filmando la toma ${n}`
          : txt
            ? `La toma ${n} no salió`
            : anterior
              ? `Así salió la toma ${anterior.n}`
              : 'Todo listo para filmar',
        cuerpo: (
          <div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Vertical fondo="#000">{dentro}</Vertical>
            </div>
            {enCurso && (
              <div style={{ textAlign: 'center', marginTop: 12, fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>
                Suele tardar entre 1 y 3 minutos.
              </div>
            )}
            {txt && (
              <div style={{ textAlign: 'center', marginTop: 12, fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>
                {txt.detalle}
              </div>
            )}
            {/* El pliegue DESAPARECE mientras se filma: ofrecer rehacer la
                anterior con la siguiente ya pagada encima deja el anuncio
                incoherente, y cuenta dos cosas a la vez. */}
            {!enCurso && anterior && !txt && (
              <Salidas resumen={`Rehacer la toma ${anterior.n} · ~15 créditos`}>
                <Button
                  size="sm"
                  variant="mako"
                  loading={ocupado === 'rehacer'}
                  onClick={() => void correr('rehacer', async () => {
                    const d = await descartarTomaAction(item.id, anterior.n);
                    if (!d.ok) return d;
                    return generarTomaAction(item.id, anterior.n);
                  }, false)}
                >
                  Rehacer la toma {anterior.n}
                </Button>
              </Salidas>
            )}
          </div>
        ),
        boton: enCurso ? undefined : txt ? txt.accion : `Filmar la toma ${n}`,
        consecuencia: enCurso ? undefined : costoTexto,
        cargandoBoton: ocupado === 'filmar',
        onSiguiente: enCurso ? undefined : () => void correr('filmar', () => generarTomaAction(item.id, n), false),
        atras: 'Atrás',
        onAtras: () => setForzado({ id: 'escenario', n: (item.escenas ?? []).slice(-1)[0]?.n ?? 1 }),
      };
    }

    // ── 5. Listo ──────────────────────────────────────────────────────────
    const clips = item.plan.clips.map((c) => item.video?.[String(c.n)]?.url).filter(Boolean) as string[];
    return {
      pregunta: 'Tu anuncio, entero',
      cuerpo: <Encadenado clips={clips} />,
      atras: 'Atrás',
      onAtras: () => setForzado({ id: 'toma', n: total }),
    };
  }

  return (
    <WizardShell
      fullscreen
      embebido
      anchoCuerpo={ANCHO_CUERPO}
      pasos={mapa}
      pasoActual={clave(paso)}
      titulo={p.titulo ?? ''}
      pregunta={p.pregunta}
      sub={p.sub}
      error={error || null}
      puedeAvanzar={!!p.onSiguiente && !ocupado}
      enUltimo={false}
      confirmLabel=""
      pending={!!p.cargandoBoton}
      hideSiguiente={!p.boton}
      siguienteLabel={p.boton ?? ''}
      atrasLabel={p.atras ?? 'Atrás'}
      hideAtras={!p.onAtras}
      onAtras={() => p.onAtras?.()}
      onSiguiente={() => p.onSiguiente?.()}
      onConfirmar={() => p.onSiguiente?.()}
      onClose={onSalir}
      extraFooter={p.consecuencia ? (
        // La consecuencia PEGADA al botón y en tinta normal, antes del click.
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink)' }}>{p.consecuencia}</span>
      ) : undefined}
    >
      {p.cuerpo}
    </WizardShell>
  );
}

/** El anuncio de corrido: las tomas encadenadas, sin tocar nada. */
function Encadenado({ clips }: { clips: string[] }) {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { ref.current?.play().catch(() => {}); }, [i]);
  if (!clips.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Vertical fondo="#000">
        <video
          ref={ref}
          key={clips[i]}
          src={clips[i]}
          controls
          playsInline
          onEnded={() => setI((k) => (k + 1 < clips.length ? k + 1 : k))}
          style={MEDIO}
        />
      </Vertical>
      {/* La cinta: cuesta cero palabras y sin ella nadie sabe qué toma suena.
          No es clicable — 3 px no es un target y elegir entre siete sería una
          segunda decisión en una pantalla que tiene una. */}
      <div style={{ display: 'flex', gap: 3, marginTop: 10, width: '60%' }}>
        {clips.map((u, k) => (
          <div
            key={u}
            style={{
              flex: 1, height: 3, borderRadius: 2,
              background: k === i ? 'var(--primary)' : 'var(--border-strong)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
