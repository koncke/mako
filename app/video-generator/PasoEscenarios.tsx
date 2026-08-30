'use client';

// =============================================================================
// PasoEscenarios — la BANDA del lugar, cabecera del grupo de tomas que cubre
// =============================================================================
// El proceso de producción va IMAGEN → VIDEO, y el generador lo tenía al revés.
// El primer clip que salió de punta a punta salió con el ángulo equivocado y sin
// parecerse a la persona: se animaba sobre la nada.
//
// ── Por qué una banda y no una tarjeta ─────────────────────────────────────
// El dueño, mirando la versión anterior: «una cantidad impresionante de textos,
// botones y pasos todos juntos». Eran DOS listas —escenarios arriba, tomas
// abajo— que había que cruzar mentalmente («el escenario 1 cubre las tomas 1 a
// 7»). Ahora hay UNA sola lista, la de tomas, y el escenario es la CABECERA del
// grupo que cubre. Una lista con filete, no una pila de cajas: la caja se gana, y
// una tarjeta adentro de una `Section` que ya es una tarjeta es padding sobre
// padding.
//
// ── Y una sola banda abierta a la vez ──────────────────────────────────────
// La primera sin confirmar. No es un acordeón que alguien administra: es estado
// DERIVADO del dato, sin índice de array y sin memoria de clicks. Con eso se
// cumple sola la regla de una acción primaria por vista.
//
// ── Por qué la confirmación es lado a lado ─────────────────────────────────
// El dueño: «muchas muchas veces la imagen de IA sale mal porque la IMAGEN que se
// le pasó era mala». Cuando algo no se parece hay DOS causas y desde el resultado
// se ven iguales. Poner las dos juntas convierte «esto está mal» en una pregunta
// que la persona sí puede contestar. Sin la comparación, la única salida es
// regenerar, y regenerar contra una foto mala da otra imagen mala.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Alert, Tag, Status, EmptyState, ErrorState, TextField, MONO } from '@/app/_ui';
import { Icon } from '../_components/icons';
import type { PlanGuardado } from './video-datos';
import type { Escena } from '@/lib/escenas-core';
import { causaFlow, textoFlow, type CausaFlow } from '@/lib/flow-fallo-texto';
import {
  escribirEscenasAction, corregirEscenaAction, generarImagenAction,
  estadoImagenAction, elegirImagenAction, subirImagenEscenaAction, confirmarEscenaAction,
} from './video-action';

/** El medio vertical grande. 176 px: a 150 no se contesta «¿es mi cara?». */
const ANCHO = 176;

function imagenDe(item: PlanGuardado | null, n: number) {
  return item?.imagenes?.[String(n)];
}

/**
 * Si el paso está cerrado: TODOS los escenarios confirmados por una persona.
 *
 * Vive acá, donde está el dato, para que no haya dos versiones de «está listo»
 * que puedan diferir. El server tiene la suya en `generarTomaAction` y mira el
 * mismo campo.
 *
 * ⚠️ `confirmada` Y `elegida`. Mirar sólo `elegida` daba el paso por cerrado en
 * cuanto Flow contestaba —la primera se preselecciona sola—, así que la
 * comparación lado a lado nunca era obligatoria y el gate que protege ~105
 * créditos se abría solo. Un paso de confirmación cuyo estado lo escribe el
 * server al llegar el dato no es un paso: es un rótulo.
 */
export function escenariosListos(item: PlanGuardado | null): boolean {
  const escenas = item?.escenas;
  if (!escenas?.length) return false;
  return escenas.every((e) => {
    const m = item?.imagenes?.[String(e.n)];
    return !!m?.elegida && !!m?.confirmada;
  });
}

/** El escenario donde se filma esta toma. */
export function escenaDeToma(item: PlanGuardado | null, n: number): Escena | null {
  return item?.escenas?.find((e) => n >= e.desde && n <= e.hasta) ?? null;
}

/** Cuál banda está abierta: la primera sin confirmar. Derivado, no recordado. */
export function escenaAbierta(item: PlanGuardado | null): number | null {
  const e = item?.escenas?.find((x) => !imagenDe(item, x.n)?.confirmada);
  return e ? e.n : null;
}

/** El alcance de un escenario, en palabras. */
function alcance(e: Escena, total: number): string {
  if (e.desde === 1 && e.hasta === total) return `Las ${total} tomas`;
  if (e.desde === e.hasta) return `Toma ${e.desde}`;
  return `Tomas ${e.desde} a ${e.hasta}`;
}

// ── Un marco de imagen ──────────────────────────────────────────────────────

function Marco({ src, alt, elegida, onClick }: {
  src: string; alt: string; elegida?: boolean; onClick?: () => void;
}) {
  const estilo: React.CSSProperties = {
    display: 'block', width: ANCHO, aspectRatio: '9 / 16', objectFit: 'cover',
    borderRadius: 13, background: 'var(--surface-2)',
    border: elegida ? '2px solid var(--primary)' : '1px solid var(--border)',
  };
  if (!onClick) return <img src={src} alt={alt} style={estilo} />;
  return (
    <button
      type="button"
      onClick={onClick}
      title={elegida ? 'Esta queda' : 'Usar esta'}
      style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', lineHeight: 0 }}
    >
      <img src={src} alt={alt} style={estilo} />
    </button>
  );
}

function Rotulo({ children }: { children: React.ReactNode }) {
  // 12 px es el piso tipográfico de la casa. El rótulo anterior estaba en 10.
  return (
    <div style={{ fontSize: 12, color: 'var(--faint)', marginBottom: 7, fontWeight: 600 }}>
      {children}
    </div>
  );
}

// ── La banda ────────────────────────────────────────────────────────────────

function BandaEscenario({ escena, item, total, fotoUrl, abierta, onCambio, onAbrir }: {
  escena: Escena;
  item: PlanGuardado;
  total: number;
  fotoUrl: string | null;
  abierta: boolean;
  onCambio: (item: PlanGuardado) => void;
  onAbrir: () => void;
}) {
  const marca = imagenDe(item, escena.n);
  const [ocupado, setOcupado] = useState('');
  const [error, setError] = useState('');
  const [pidiendo, setPidiendo] = useState(false);
  const [ajuste, setAjuste] = useState('');
  const [desde] = useState(() => Date.now());
  const [ahora, setAhora] = useState(desde);
  const archivo = useRef<HTMLInputElement>(null);

  const generando = ocupado === 'generar'
    || (!!marca?.trabajoId && !marca?.opciones?.length && !marca?.error);

  // El cronómetro. Arranca cuando arranca la espera, no cuando montó el
  // componente: si no, volver a la pestaña mostraría 0:00 sobre algo que lleva
  // dos minutos. Se muestra TIEMPO y no porcentaje, porque el porcentaje no lo
  // sabemos y un número inventado que avanza solo no se perdona.
  useEffect(() => {
    if (!generando) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [generando]);
  const seg = Math.max(0, Math.round((ahora - desde) / 1000));
  const reloj = `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;

  // El sondeo. Cada llamada avanza UN paso y no espera adentro. Se apaga solo
  // cuando hay imágenes o hay error: uno que no sabe terminar es tráfico contra
  // la base para siempre.
  useEffect(() => {
    if (!generando) return;
    let vivo = true;
    const t = setInterval(async () => {
      const r = await estadoImagenAction(item.id, escena.n).catch(() => null);
      if (!vivo || !r?.ok) return;
      onCambio(r.item);
      if (r.estado.fase === 'listo' || r.estado.fase === 'error') setOcupado('');
    }, 4000);
    return () => { vivo = false; clearInterval(t); };
  }, [generando, item.id, escena.n, onCambio]);

  const correr = useCallback(async (
    etiqueta: string,
    fn: () => Promise<{ ok: boolean; item?: PlanGuardado; error?: string }>,
  ) => {
    setOcupado(etiqueta);
    setError('');
    const r = await fn().catch(() => ({ ok: false as const, error: 'No se pudo. Vuelve a intentarlo.' }));
    if (r.ok && r.item) onCambio(r.item);
    else setError(r.error || 'No se pudo.');
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

  const opciones = marca?.opciones ?? [];

  // ── Plegada ──────────────────────────────────────────────────────────────
  if (!abierta) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 13, flexWrap: 'wrap',
        padding: '12px', background: 'var(--surface-2)',
        borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
      }}>
        {marca?.elegida && (
          <img
            src={marca.elegida}
            alt={escena.lugar}
            style={{ width: 44, aspectRatio: '9 / 16', objectFit: 'cover', borderRadius: 8, display: 'block' }}
          />
        )}
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--ink)', fontWeight: 650, lineHeight: 1.4 }}>
            {escena.lugar}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 5 }}>
            <Status tono="good">El lugar ya está</Status>
            <Tag>{alcance(escena, total)}</Tag>
          </div>
        </div>
        <Button size="sm" variant="tertiary" onClick={onAbrir}>
          Cambiar el escenario {escena.n}
        </Button>
      </div>
    );
  }

  // ── Abierta ──────────────────────────────────────────────────────────────
  const causa: CausaFlow | undefined = marca?.error
    ? ((marca.errorCausa as CausaFlow) ?? causaFlow(marca.errorCrudo ?? marca.error))
    : undefined;
  const txt = causa ? textoFlow(causa, `la imagen del escenario ${escena.n}`, marca?.errorAt) : null;

  return (
    <div style={{
      padding: '15px 12px', background: 'var(--surface-2)',
      borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
    }}>
      {/* Una sola línea de identidad. Sin kicker en monospace: el número del
          escenario no se muestra porque nadie dice «el escenario 2». */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 'var(--fs-md)', color: 'var(--ink)', lineHeight: 1.4 }}>
          {escena.lugar}
        </strong>
        <Tag>{alcance(escena, total)}</Tag>
        {marca?.propia && <Tag>Foto tuya</Tag>}
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 13 }}>
        <div>
          <Rotulo>Tu foto</Rotulo>
          {fotoUrl ? (
            <Marco src={fotoUrl} alt="La foto real que subiste" />
          ) : (
            <div style={{
              width: ANCHO, aspectRatio: '9 / 16', borderRadius: 13,
              border: '1.5px dashed var(--border-strong)', display: 'grid',
              placeItems: 'center', padding: '0 12px', textAlign: 'center',
              fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.45,
            }}>
              Todavía no subiste una foto tuya.
            </div>
          )}
        </div>

        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <Rotulo>{opciones.length > 1 ? 'Lo que salió — elige cuál queda' : 'Lo que salió'}</Rotulo>

          {/* ⚠️ EL ERROR REEMPLAZA EL LADO DERECHO, NO LA BANDA. La izquierda —tu
              foto— se queda: el error de un lado no borra el dato del otro. */}
          {txt ? (
            <ErrorState
              inline
              titulo={txt.titulo}
              detalle={txt.detalle}
              detalleTecnico={marca?.errorCrudo || undefined}
              accion={txt.arreglaEn
                ? { label: txt.accion, href: txt.arreglaEn }
                : { label: txt.accion, onClick: () => void correr('generar', () => generarImagenAction(item.id, escena.n)) }}
              secundaria={txt.secundaria
                ? { label: txt.secundaria, onClick: () => archivo.current?.click() }
                : undefined}
            />
          ) : opciones.length > 0 ? (
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              {opciones.map((u) => (
                <div key={u}>
                  <Marco
                    src={u}
                    alt={`El escenario ${escena.n} generado`}
                    elegida={u === marca?.elegida}
                    onClick={opciones.length > 1
                      ? () => void correr('elegir', () => elegirImagenAction(item.id, escena.n, u))
                      : undefined}
                  />
                  {/* El borde no alcanza: el color nunca es el único portador. */}
                  {u === marca?.elegida && opciones.length > 1 && (
                    <div style={{ marginTop: 6 }}><Status tono="good">Esta queda</Status></div>
                  )}
                </div>
              ))}
            </div>
          ) : generando ? (
            <div>
              <div
                className="mk-lienzo"
                style={{ width: ANCHO, aspectRatio: '9 / 16' }}
                role="status"
                aria-label={`Generando la imagen del escenario ${escena.n}`}
              >
                <div style={{
                  position: 'absolute', inset: '10px 11px auto 11px', display: 'flex',
                  alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ color: 'rgba(255,255,255,.72)', lineHeight: 0 }}>
                    <Icon name="tvad" size={15} />
                  </span>
                  <span style={{
                    fontFamily: MONO, fontSize: 11, color: 'rgba(255,255,255,.72)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {reloj}
                  </span>
                </div>
              </div>
              <p style={{ margin: '9px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--dim)', maxWidth: 280, lineHeight: 1.5 }}>
                MaKo está armando la imagen del lugar. Suele tardar menos de un minuto.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void correr('generar', () => generarImagenAction(item.id, escena.n))}
              style={{
                width: ANCHO, aspectRatio: '9 / 16', cursor: 'pointer', borderRadius: 13,
                background: 'var(--surface)', fontFamily: 'inherit', padding: '0 14px',
                border: '1.5px dashed var(--border-strong)', display: 'grid', placeItems: 'center',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                {/* El preflight de Tailwind hace `svg { display: block }`, así que
                    un ícono NO se centra con el `textAlign` del padre. */}
                <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--faint)', marginBottom: 7 }}>
                  <Icon name="imagegen" size={20} />
                </div>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 650, color: 'var(--ink)' }}>
                  Generar la imagen del escenario {escena.n}
                </div>
                {/* Se dice acá y no en un aviso general: el miedo a gastar aparece
                    con el dedo sobre ESTE botón. */}
                <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)', marginTop: 5 }}>
                  No gasta créditos
                </div>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* La línea de las dos causas: sólo con imagen y sin confirmar. */}
      {opciones.length > 0 && !marca?.confirmada && !txt && (
        <p style={{ margin: '13px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55, maxWidth: 620 }}>
          Si la cara no se parece, casi siempre el problema está en la foto de entrada, no en lo que
          generó MaKo.
        </p>
      )}

      {/* LA decisión. Una sola primaria por vista, y vive acá porque acá se toma. */}
      {opciones.length > 0 && !marca?.confirmada && !txt && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 11 }}>
          <Button
            variant="primary"
            icon={<Icon name="check" size={15} />}
            loading={ocupado === 'confirmar'}
            disabled={!!ocupado}
            onClick={() => void correr('confirmar', () => confirmarEscenaAction(item.id, escena.n))}
          >
            Confirmar el escenario {escena.n}
          </Button>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink)', lineHeight: 1.45 }}>
            Con esto se habilita filmar, que sí gasta créditos.
          </span>
        </div>
      )}

      <details style={{ marginTop: 13 }}>
        <summary style={{ cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>
          Ver lo que se le pidió a MaKo
        </summary>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.6, margin: '8px 0 0' }}>
          {escena.prompt}
        </p>
      </details>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 13 }}>
        {opciones.length > 0 && (
          <Button
            size="sm"
            variant="mako"
            loading={ocupado === 'generar'}
            disabled={!!ocupado || generando}
            onClick={() => void correr('generar', () => generarImagenAction(item.id, escena.n))}
          >
            Generar la imagen otra vez
          </Button>
        )}
        <Button size="sm" variant="tertiary" disabled={!!ocupado} onClick={() => setPidiendo((v) => !v)}>
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
        <div style={{ marginTop: 12, display: 'flex', gap: 9, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px', minWidth: 0 }}>
            <TextField
              label="Qué cambiarle"
              value={ajuste}
              onChange={(e) => setAjuste(e.target.value)}
              placeholder="La luz, el lugar, el encuadre…"
            />
          </div>
          <Button
            variant="mako"
            icon={<Icon name="ia" size={15} />}
            loading={ocupado === 'corregir'}
            disabled={!ajuste.trim() || !!ocupado}
            onClick={async () => {
              setOcupado('corregir');
              setError('');
              const r = await corregirEscenaAction(item.id, escena.n, ajuste).catch(() => null);
              if (r?.ok) {
                onCambio(r.item);
                setAjuste('');
                setPidiendo(false);
              } else {
                // ⚠️ Lo escrito NO se borra cuando falla. Antes se limpiaba pasara
                // lo que pasara, así que un error se llevaba puesto lo que la
                // persona acababa de redactar y la obligaba a escribirlo de nuevo.
                setError(r?.error || 'No se pudo aplicar ese cambio.');
              }
              setOcupado('');
            }}
          >
            Pedirle el cambio a MaKo
          </Button>
        </div>
      )}

      {error && <div style={{ marginTop: 11 }}><Alert tono="warn">{error}</Alert></div>}
    </div>
  );
}

// ── La lista de bandas ──────────────────────────────────────────────────────

export function Escenarios({ item, fotoUrl, tieneFotos, escenarios, onCambio }: {
  item: PlanGuardado;
  fotoUrl: string | null;
  tieneFotos: boolean;
  escenarios: number;
  onCambio: (item: PlanGuardado) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [forzada, setForzada] = useState<number | null>(null);
  const escenas = item.escenas ?? [];
  const total = item.plan.clips.length;

  const escribir = useCallback(async () => {
    setOcupado(true);
    setError('');
    const r = await escribirEscenasAction(item.id).catch(() => null);
    if (r?.ok) { onCambio(r.item); setForzada(null); }
    else setError(r?.error || 'MaKo no pudo escribir los escenarios.');
    setOcupado(false);
  }, [item.id, onCambio]);

  if (escenas.length === 0) {
    return (
      <div style={{ marginBottom: 18 }}>
        <EmptyState
          titulo="Todavía no está dicho dónde se filma"
          detalle={`Este formato se rueda en ${escenarios} ${escenarios === 1 ? 'escenario' : 'escenarios'}. MaKo escribe el lugar y genera una imagen de prueba, que después se anima. Las imágenes no gastan créditos.`}
          accion={{
            label: escenarios === 1 ? 'Escribir el escenario' : `Escribir los ${escenarios} escenarios`,
            onClick: () => void escribir(),
          }}
        />
        {!tieneFotos && (
          <div style={{ marginTop: 12 }}>
            <Alert tono="warn">
              Sin una foto tuya, cada toma sale con la cara de otra persona.{' '}
              <a href="/onboarding" style={{ color: 'inherit', fontWeight: 650 }}>Subir mi foto</a>
            </Alert>
          </div>
        )}
        {ocupado && (
          <div style={{ marginTop: 12 }}>
            <Alert tono="info">MaKo está escribiendo los escenarios…</Alert>
          </div>
        )}
        {error && <div style={{ marginTop: 12 }}><Alert tono="warn">{error}</Alert></div>}
      </div>
    );
  }

  const abierta = forzada ?? escenaAbierta(item);

  return (
    <div>
      {escenas.map((e) => (
        <BandaEscenario
          key={e.n}
          escena={e}
          item={item}
          total={total}
          fotoUrl={fotoUrl}
          abierta={abierta === e.n}
          onCambio={(it) => { setForzada(null); onCambio(it); }}
          onAbrir={() => setForzada(e.n)}
        />
      ))}
      {error && <div style={{ marginTop: 11 }}><Alert tono="warn">{error}</Alert></div>}
    </div>
  );
}
