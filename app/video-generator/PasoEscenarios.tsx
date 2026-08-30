'use client';

// =============================================================================
// PasoEscenarios — dónde se filma, antes de filmar
// =============================================================================
// El proceso de producción va IMAGEN → VIDEO, y el generador lo tenía al revés.
// El primer clip que salió de punta a punta salió en un ángulo que nadie pidió y
// con una cara que no se parecía: se estaba animando sobre la nada.
//
// ── Por qué la confirmación es lado a lado ─────────────────────────────────
// El dueño: «muchas muchas veces la imagen de IA sale mal porque la IMAGEN que
// se le pasó era mala». Cuando una imagen no se parece hay DOS causas posibles
// —la generación salió mal, o la foto de entrada estaba mal— y desde el
// resultado se ven idénticas.
//
// Poner las dos juntas convierte «esto está mal» en una pregunta que la persona
// SÍ puede contestar. Sin la comparación, la única salida disponible es
// regenerar, y regenerar contra una foto mala da otra imagen mala: la vuelta
// entera para llegar al mismo lugar, sin haber aprendido nada.
//
// Por eso las tres correcciones son tres y no una, y una de ellas no genera nada
// (subir una foto propia del lugar): cuando el escenario existe de verdad, una
// foto real le gana a cualquier prompt.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Section, Button, Alert, Tag, MONO } from '@/app/_ui';
import { Icon } from '../_components/icons';
import type { PlanGuardado } from './video-datos';
import type { Escena } from '@/lib/escenas-core';
import {
  escribirEscenasAction, corregirEscenaAction, generarImagenAction,
  estadoImagenAction, elegirImagenAction, subirImagenEscenaAction,
} from './video-action';

const ANCHO = 150;

/** Lo generado de un escenario, si hay algo. */
function imagenDe(item: PlanGuardado | null, n: number) {
  return item?.imagenes?.[String(n)];
}

/**
 * Si el paso está cerrado: TODOS los escenarios con su imagen elegida.
 *
 * Se exporta porque quien la necesita es la pantalla de arriba, para decidir si
 * ya se puede filmar. La condición vive acá —donde está el dato— y no allá, para
 * que no haya dos versiones de «está listo» que puedan diferir.
 */
export function escenariosListos(item: PlanGuardado | null): boolean {
  const escenas = item?.escenas;
  if (!escenas?.length) return false;
  return escenas.every((e) => !!item?.imagenes?.[String(e.n)]?.elegida);
}

/** El escenario donde se filma esta toma. */
export function escenaDeToma(item: PlanGuardado | null, n: number): Escena | null {
  return item?.escenas?.find((e) => n >= e.desde && n <= e.hasta) ?? null;
}

// ── Una imagen: la que se generó, o el lugar donde va a ir ──────────────────

function Marco({ src, alt, elegida, onClick }: {
  src: string; alt: string; elegida?: boolean; onClick?: () => void;
}) {
  const borde = elegida ? '2px solid var(--primary)' : '1px solid var(--border)';
  const estilo: React.CSSProperties = {
    display: 'block', width: ANCHO, aspectRatio: '9 / 16', objectFit: 'cover',
    borderRadius: 13, border: borde, background: 'var(--surface-2)',
  };
  if (!onClick) return <img src={src} alt={alt} style={estilo} />;
  return (
    <button
      type="button"
      onClick={onClick}
      title={elegida ? 'Esta es la que queda' : 'Usar esta'}
      style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', lineHeight: 0 }}
    >
      <img src={src} alt={alt} style={estilo} />
    </button>
  );
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase',
      color: 'var(--faint)', marginBottom: 7,
    }}>
      {children}
    </div>
  );
}

// ── El escenario ────────────────────────────────────────────────────────────

function TarjetaEscena({ escena, item, fotoUrl, onCambio }: {
  escena: Escena;
  item: PlanGuardado;
  /** La foto real de la persona. Es la mitad izquierda de la comparación. */
  fotoUrl: string | null;
  onCambio: (item: PlanGuardado) => void;
}) {
  const marca = imagenDe(item, escena.n);
  const [ocupado, setOcupado] = useState('');
  const [error, setError] = useState('');
  const [pidiendo, setPidiendo] = useState(false);
  const [ajuste, setAjuste] = useState('');
  const archivo = useRef<HTMLInputElement>(null);

  const generando = ocupado === 'generar' || (!!marca?.trabajoId && !marca?.opciones?.length && !marca?.error);

  // ── El sondeo ────────────────────────────────────────────────────────────
  // Cada llamada avanza UN paso y no espera adentro, igual que el de las tomas.
  // Se apaga solo cuando ya hay imágenes o hay error: un sondeo que no sabe
  // terminar es tráfico contra la base para siempre.
  useEffect(() => {
    if (!generando) return;
    let vivo = true;
    const t = setInterval(async () => {
      const r = await estadoImagenAction(item.id, escena.n).catch(() => null);
      if (!vivo || !r?.ok) return;
      onCambio(r.item);
      if (r.estado.fase === 'listo' || r.estado.fase === 'error') {
        setOcupado('');
        if (r.estado.fase === 'error') setError(r.estado.error);
      }
    }, 4000);
    return () => { vivo = false; clearInterval(t); };
  }, [generando, item.id, escena.n, onCambio]);

  const correr = useCallback(async (etiqueta: string, fn: () => Promise<{ ok: boolean; item?: PlanGuardado; error?: string }>) => {
    setOcupado(etiqueta);
    setError('');
    const r = await fn().catch(() => ({ ok: false as const, error: 'No se pudo. Vuelve a intentarlo.' }));
    if (r.ok && r.item) onCambio(r.item);
    else setError(r.error || 'No se pudo.');
    // El de generar NO se apaga acá: lo apaga el sondeo cuando la imagen vuelve.
    if (etiqueta !== 'generar' || !r.ok) setOcupado('');
  }, [onCambio]);

  const subir = useCallback((f: File | null) => {
    if (!f) return;
    const lector = new FileReader();
    lector.onload = () => {
      void correr('subir', () => subirImagenEscenaAction(item.id, escena.n, String(lector.result || '')));
    };
    lector.readAsDataURL(f);
  }, [correr, item.id, escena.n]);

  const tomas = escena.desde === escena.hasta
    ? `Toma ${escena.desde}`
    : `Tomas ${escena.desde} a ${escena.hasta}`;
  const opciones = marca?.opciones ?? [];

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 14, padding: '15px 17px',
      marginBottom: 12, background: 'var(--surface)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{
          fontFamily: MONO, fontSize: 11, color: 'var(--faint)', letterSpacing: '.06em',
        }}>
          ESCENARIO {escena.n}
        </span>
        <strong style={{ fontSize: 'var(--fs-md)', color: 'var(--ink)' }}>{escena.lugar}</strong>
        <Tag>{tomas}</Tag>
        {marca?.propia && <Tag>Tu foto</Tag>}
      </div>

      {/* ── La comparación ────────────────────────────────────────────────
          Izquierda lo que la persona puso, derecha lo que salió. El orden no es
          estético: es el orden de la pregunta que hay que contestar. */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 12 }}>
        <div>
          <Rotulo>Tu foto</Rotulo>
          {fotoUrl ? (
            <Marco src={fotoUrl} alt="La foto real que subiste" />
          ) : (
            <div style={{
              width: ANCHO, aspectRatio: '9 / 16', borderRadius: 13,
              border: '1.5px dashed var(--border-strong)', display: 'grid',
              placeItems: 'center', padding: '0 12px', textAlign: 'center',
              fontSize: 'var(--fs-meta)', color: 'var(--dim)', lineHeight: 1.45,
            }}>
              Todavía no cargaste una foto tuya en tu perfil.
            </div>
          )}
        </div>

        <div>
          <Rotulo>{opciones.length > 1 ? 'Lo que salió — elige una' : 'Lo que salió'}</Rotulo>
          {opciones.length > 0 ? (
            <div style={{ display: 'flex', gap: 9 }}>
              {opciones.map((u) => (
                <Marco
                  key={u}
                  src={u}
                  alt={`El escenario ${escena.n} generado`}
                  elegida={u === marca?.elegida}
                  onClick={
                    opciones.length > 1
                      ? () => void correr('elegir', () => elegirImagenAction(item.id, escena.n, u))
                      : undefined
                  }
                />
              ))}
            </div>
          ) : generando ? (
            <div
              className="mk-lienzo"
              style={{ width: ANCHO, aspectRatio: '9 / 16' }}
              role="status"
              aria-label={`Generando el escenario ${escena.n}`}
            />
          ) : (
            <button
              type="button"
              onClick={() => void correr('generar', () => generarImagenAction(item.id, escena.n))}
              style={{
                width: ANCHO, aspectRatio: '9 / 16', cursor: 'pointer', borderRadius: 13,
                background: 'var(--surface-2)', fontFamily: 'inherit', padding: '0 14px',
                border: `1.5px dashed ${marca?.error ? 'var(--bad)' : 'var(--border-strong)'}`,
                display: 'grid', placeItems: 'center',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--faint)', marginBottom: 7 }}><Icon name="ia" size={20} /></div>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 650, color: 'var(--ink)' }}>
                  {marca?.error ? 'Volver a intentar' : 'Generar la imagen'}
                </div>
                {/* Se dice acá y no en un aviso general: el miedo a gastar
                    aparece con el dedo sobre ESTE botón. */}
                <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)', marginTop: 5 }}>
                  No gasta créditos
                </div>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* El prompt: se puede leer, y leerlo es lo que permite corregirlo. */}
      <details style={{ marginTop: 13 }}>
        <summary style={{
          cursor: 'pointer', fontSize: 'var(--fs-meta)', color: 'var(--dim)',
          fontFamily: MONO, letterSpacing: '.05em', textTransform: 'uppercase',
        }}>
          Cómo se lo pedí
        </summary>
        <p style={{
          fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.6,
          marginTop: 8, marginBottom: 0,
        }}>
          {escena.prompt}
        </p>
      </details>

      {/* ── Las tres correcciones ───────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 13 }}>
        {opciones.length > 0 && (
          <Button
            size="sm"
            variant="tertiary"
            loading={ocupado === 'generar'}
            disabled={!!ocupado || generando}
            onClick={() => void correr('generar', () => generarImagenAction(item.id, escena.n))}
          >
            Generarla otra vez
          </Button>
        )}
        <Button
          size="sm"
          variant="tertiary"
          disabled={!!ocupado}
          onClick={() => setPidiendo((v) => !v)}
        >
          Decir qué cambiar
        </Button>
        <Button
          size="sm"
          variant="tertiary"
          loading={ocupado === 'subir'}
          disabled={!!ocupado}
          onClick={() => archivo.current?.click()}
        >
          Subir mi foto del lugar
        </Button>
        <input
          ref={archivo}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: 'none' }}
          onChange={(e) => { subir(e.target.files?.[0] ?? null); e.target.value = ''; }}
        />
      </div>

      {pidiendo && (
        <div style={{ marginTop: 11, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={ajuste}
            onChange={(e) => setAjuste(e.target.value)}
            placeholder="Qué cambiarle: la luz, el lugar, el encuadre…"
            style={{
              flex: 1, minWidth: 240, padding: '9px 12px', borderRadius: 10,
              border: '1px solid var(--border)', background: 'var(--surface-2)',
              color: 'var(--ink)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
            }}
          />
          <Button
            size="sm"
            variant="mako"
            loading={ocupado === 'corregir'}
            disabled={!ajuste.trim() || !!ocupado}
            onClick={async () => {
              // Se marca acá y no en onMouseDown: con teclado no hay mouse down, y
              // un botón que no muestra su progreso al activarse con Enter parece
              // roto justo para quien no usa el mouse.
              setOcupado('corregir');
              setError('');
              const antes = ajuste;
              const r = await corregirEscenaAction(item.id, escena.n, antes).catch(() => null);
              if (r?.ok) {
                onCambio(r.item);
                setAjuste('');
                setPidiendo(false);
                setError('');
              } else {
                // ⚠️ Lo escrito NO se borra cuando falla. Antes se limpiaba el campo
                // y se cerraba el panel pasara lo que pasara, así que un fallo se
                // llevaba puesto lo que la persona acababa de redactar y la obligaba
                // a escribirlo de nuevo para reintentar. Un error no puede costar
                // además el trabajo de quien lo recibió.
                setError(r?.error || 'No se pudo aplicar ese cambio.');
              }
              setOcupado('');
            }}
          >
            Corregir
          </Button>
        </div>
      )}

      {(error || marca?.error) && (
        <div style={{ marginTop: 11 }}>
          <Alert tono="warn">{error || marca?.error}</Alert>
        </div>
      )}
    </div>
  );
}

// ── El paso entero ──────────────────────────────────────────────────────────

export function PasoEscenarios({ item, fotoUrl, escenarios, onCambio }: {
  item: PlanGuardado;
  fotoUrl: string | null;
  /** Cuántos pide el formato. Sale del catálogo, no del modelo. */
  escenarios: number;
  onCambio: (item: PlanGuardado) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const escenas = item.escenas ?? [];
  const listas = escenas.filter((e) => !!imagenDe(item, e.n)?.elegida).length;

  const escribir = useCallback(async () => {
    setOcupado(true);
    setError('');
    const r = await escribirEscenasAction(item.id).catch(() => null);
    if (r?.ok) onCambio(r.item);
    else setError(r?.error || 'MaKo no pudo escribir los escenarios.');
    setOcupado(false);
  }, [item.id, onCambio]);

  return (
    <Section
      titulo="Dónde se filma"
      accion={
        escenas.length > 0 ? (
          <Button
            size="sm"
            variant="tertiary"
            loading={ocupado}
            onClick={() => void escribir()}
            title="Vuelve a repartir los escenarios. Las imágenes que ya elegiste se descartan."
          >
            Rehacer el reparto
          </Button>
        ) : undefined
      }
    >
      {escenas.length === 0 ? (
        <div style={{
          border: '1px solid var(--border)', borderRadius: 14, padding: '19px 21px',
          background: 'var(--surface)',
        }}>
          <p style={{ fontSize: 'var(--fs-md)', color: 'var(--ink)', lineHeight: 1.6, marginTop: 0 }}>
            Antes de filmar hay que fijar el lugar. Este formato se rueda en{' '}
            <strong>{escenarios} {escenarios === 1 ? 'escenario' : 'escenarios'}</strong>, y de
            cada uno sale una imagen que después se anima.
          </p>
          {/* Se dice el porqué, no solo el qué: el paso agrega una pantalla más y
              alguien con prisa la va a querer saltar. */}
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.6, marginBottom: 16 }}>
            Animar sin haber fijado la imagen es lo que produce clips en el ángulo
            equivocado y con una cara que no se parece. Las imágenes no gastan
            créditos: lo que se paga es el video.
          </p>
          <Button variant="mako" icon={<Icon name="ia" size={16} />} loading={ocupado} onClick={() => void escribir()}>
            Escribir los escenarios
          </Button>
          {error && <div style={{ marginTop: 13 }}><Alert tono="warn">{error}</Alert></div>}
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 13 }}>
            <Alert tono={listas === escenas.length ? 'good' : 'info'}>
              {listas === escenas.length ? (
                <>Los <strong>{escenas.length}</strong> escenarios están confirmados. Ya se puede filmar.</>
              ) : (
                <>
                  <strong>{listas} de {escenas.length}</strong> escenarios confirmados. Mira cada
                  imagen al lado de tu foto: si no se parecen, casi siempre el problema está en la
                  foto de entrada —mala luz, o una imagen que ya era de IA— y no en la generación.
                </>
              )}
            </Alert>
          </div>
          {escenas.map((e) => (
            <TarjetaEscena key={e.n} escena={e} item={item} fotoUrl={fotoUrl} onCambio={onCambio} />
          ))}
          {error && <Alert tono="warn">{error}</Alert>}
        </>
      )}
    </Section>
  );
}
