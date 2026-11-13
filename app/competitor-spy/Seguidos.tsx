'use client';

// =============================================================================
// Seguidos: la vista de los competidores que el negocio SIGUE (13/11/2026, Martín para Marketing CoPilot)
// =============================================================================
// Tres bloques, de arriba abajo:
//   1. A quién sigues: todos los competidores, y al tocarlo lo sigues o lo dejas. Es la tarea «Selecciona a tus competidores»
//      de CoPilot (`RUTA_SEGUIDOS`).
//   2. El promedio de tus seguidos, por red: lo que suele hacer una cuenta que sigues. CoPilot lo usa para proponer con qué
//      número se publica un reel de prueba.
//   3. Las alertas: lo que les está funcionando (los outliers, con su ángulo y «¿Creamos uno parecido?») y lo nuevo.
// Las reglas: lib/spy-seguidos-reglas.ts. La misma vista en la computadora (SpyApp.tsx) y en el teléfono (app/m/competitor-spy).
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { pedirReplicar } from '@/app/copywriter/cliente';
import { caricaturaDeCompetidor, nombreDeTarjeta } from '@/lib/spy-caricatura';
import { caraDeTarjeta } from '@/lib/spy-caricatura-reglas';
import { proporcionDe } from '@/lib/spy-detalle';
import { iniciales } from '@/lib/unicode-seguro';
import { idParaReplicar, unidadDelNumero, type NumeroDeRed, type NumeroDeSeguidos } from '@/lib/spy-seguidos-reglas';
import { dibujarContador } from '@/lib/spy-reglas';
import type { Competidor } from '@/lib/spy';
import { seguidosAction, seguirAction, type AlertaVista, type SeguidosLeidos } from './actions';
import { GrillaPiezas } from './GrillaPiezas';
import { LogoRed } from './LogoRed';
import { TarjetaPieza } from './TarjetaPieza';
import s from './seguidos.module.css';

/** Lo que suma el pie de siempre de la tarjeta (GrillaPiezas, `PIE_TARJETA`). */
const PIE_TARJETA = 92;
/** Lo de más de una alerta: de quién es (28), el ángulo en dos renglones (40) y el botón (36), con sus huecos. */
const ALTO_EXTRA = { outlier: 8 + 28 + 6 + 40 + 6 + 36, nueva: 8 + 28 } as const;

/** Lo que dice un número que no hay, corto: la explicación entera va en el `title`. */
const SIN_NUMERO: Record<NonNullable<NumeroDeRed['motivo']>, string> = {
  'falta-enmienda': 'Falta un trámite con YouTube',
  pocas: 'Todavía sin datos',
  'sin-seguidos': 'Sigue a alguien',
};

const inicial = (nombre: string): string => iniciales(nombre, 1, '·');

function Cara({ c, lado }: { c: Competidor; lado: number }) {
  const cara = caraDeTarjeta(c, caricaturaDeCompetidor(c));
  return (
    <span className={s.cara} style={{ width: lado, height: lado }} aria-hidden>
      {cara
        // eslint-disable-next-line @next/next/no-img-element -- está en nuestro bucket o en /public, no pasa por el optimizador
        ? <img src={cara} alt="" loading="lazy" onError={(e) => { const img = e.currentTarget; if (c.avatar && img.getAttribute('src') !== c.avatar) img.src = c.avatar; else img.remove(); }} />
        : inicial(c.nombre)}
    </span>
  );
}

export function Seguidos({ competidores, telefono = false, onAbrir, rutaGuion = (id: string) => `/copywriter/${id}`, inicial = null }: {
  /** Todos los competidores del negocio (la lista de Spy), para elegir a quién seguir. */
  competidores: Competidor[];
  telefono?: boolean;
  /** Abre la ficha de un competidor. */
  onAbrir: (id: number) => void;
  /** A dónde lleva «¿Creamos uno parecido?» con la página nueva de Copywriting. */
  rutaGuion?: (id: string) => string;
  /** Lo ya leído en el servidor (`?ver=seguidos` en la URL): dibuja sin otra vuelta al abrir. */
  inicial?: SeguidosLeidos | null;
}) {
  const router = useRouter();
  const [ids, setIds] = useState<number[] | null>(inicial?.ids ?? null);
  const [numero, setNumero] = useState<NumeroDeSeguidos | null>(inicial?.numero ?? null);
  const [alertas, setAlertas] = useState<AlertaVista[]>(inicial?.alertas ?? []);
  const yaLeido = useRef(!!inicial);
  // Los seguidos van primero, en el orden de la PRIMERA lectura: si se reordenaran con cada toque, el chip se iría de abajo del dedo.
  const primeros = useRef<ReadonlySet<number> | null>(inicial ? new Set(inicial.ids) : null);
  const [error, setError] = useState<string | null>(null);
  const [cambiando, setCambiando] = useState<number | null>(null);
  const [replicando, setReplicando] = useState<number | null>(null);

  const leer = useCallback(async () => {
    const r = await seguidosAction();
    if (!r.ok) { setError(r.error); return; }
    setError(null);
    primeros.current ??= new Set(r.ids);
    setIds(r.ids);
    setNumero(r.numero);
    setAlertas(r.alertas);
  }, []);
  useEffect(() => { if (!yaLeido.current) void leer(); }, [leer]);

  const seguidos = useMemo(() => new Set(ids ?? []), [ids]);
  const porId = useMemo(() => new Map(competidores.map((c) => [c.id, c])), [competidores]);
  const cargado = ids != null;
  const enOrden = useMemo(() => {
    const p = primeros.current;
    return p ? [...competidores.filter((c) => p.has(c.id)), ...competidores.filter((c) => !p.has(c.id))] : competidores;
    // `cargado`: la primera lectura llega por acá, y recién ahí se sabe el orden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competidores, cargado]);

  const cambiar = async (c: Competidor) => {
    if (cambiando != null || ids == null) return;
    const seguir = !seguidos.has(c.id);
    setCambiando(c.id);
    // Se ve en el acto; el número y las alertas llegan después, con la lectura nueva.
    setIds(seguir ? [...ids, c.id] : ids.filter((i) => i !== c.id));
    const r = await seguirAction(c.id, seguir);
    if (!r.ok) { setError(r.error); setIds(ids); setCambiando(null); return; }
    setIds(r.ids);
    await leer();
    setCambiando(null);
  };

  const replicar = async (a: AlertaVista) => {
    if (replicando != null) return;
    setReplicando(a.pieza.id);
    setError(null);
    const r = await pedirReplicar(idParaReplicar(a.pieza.id));
    if (!r.ok) { setReplicando(null); setError(`No se pudo crear: ${r.error}`); return; }
    router.push(rutaGuion(r.pagina.id));
  };

  const outliers = alertas.filter((a) => a.tipo === 'outlier').map((a) => ({ ...a, id: a.pieza.id }));
  const nuevas = alertas.filter((a) => a.tipo === 'nueva').map((a) => ({ ...a, id: a.pieza.id }));
  const proporcion = (a: AlertaVista) => { const { ancho, alto } = proporcionDe(a.pieza); return ancho / alto; };
  const abrirOriginal = (a: AlertaVista) => { if (a.pieza.url) window.open(a.pieza.url, '_blank', 'noopener,noreferrer'); };

  const quien = (a: AlertaVista) => {
    const c = porId.get(a.pieza.competidor_id);
    if (!c) return null;
    return (
      <button type="button" className={s.quien} onClick={(e) => { e.stopPropagation(); onAbrir(c.id); }}>
        <Cara c={c} lado={22} /><span>{nombreDeTarjeta(c)}</span>
      </button>
    );
  };

  const tarjeta = (a: AlertaVista & { id: number }) => (
    <TarjetaPieza
      p={a.pieza} multiplo={a.multiplo} onAbrir={a.pieza.url ? () => abrirOriginal(a) : undefined}
      extra={a.tipo === 'outlier' ? (
        <>
          {quien(a)}
          <span className={s.angulo} title={a.pieza.analisis?.angulo ?? undefined}>
            {a.pieza.analisis?.angulo ? <><b>Ángulo:</b> {a.pieza.analisis.angulo}</> : 'Todavía sin analizar'}
          </span>
          <button type="button" className={s.parecido} disabled={replicando != null}
            onClick={(e) => { e.stopPropagation(); void replicar(a); }}>
            {replicando === a.pieza.id ? 'Creando…' : '¿Creamos uno parecido?'}
          </button>
        </>
      ) : quien(a)}
    />
  );

  return (
    <section className={s.seguidos} data-telefono={telefono || undefined}>
      <header className={s.cabeza}>
        <h1>Seguidos</h1>
        {ids != null && <p>{ids.length} de {competidores.length}</p>}
      </header>
      {error && <p className={s.error} role="alert">{error}<ReportarASoporte error={error} accion="Seguidos de Competitors Spy" /></p>}

      {/* ── 1. A quién sigues: tocar es seguir o dejar de seguir ── */}
      <div className={s.elegir} aria-busy={ids == null || undefined}>
        {enOrden.map((c) => {
          const sigue = seguidos.has(c.id);
          return (
            <button key={c.id} type="button" className={s.chip} data-sigue={sigue || undefined} aria-pressed={sigue}
              disabled={ids == null || cambiando != null} onClick={() => void cambiar(c)}>
              <Cara c={c} lado={26} />
              <span>{nombreDeTarjeta(c)}</span>
              <i aria-hidden>{sigue ? '✓' : '+'}</i>
            </button>
          );
        })}
      </div>

      {ids != null && !ids.length && (
        <p className={s.vacio}>Elige a quién seguir: te muestro lo nuevo que publican y lo que les está funcionando.</p>
      )}

      {/* ── 2. El promedio de tus seguidos, por red ── */}
      {numero && ids != null && ids.length > 0 && (
        <div className={s.bloque}>
          <h2>El promedio de tus seguidos</h2>
          <div className={s.numeros}>
            {numero.redes.map((n) => (
              <div key={n.red} className={s.numero} title={n.explicacion}>
                <span className={s.red}><LogoRed red={n.red === 'reel' || n.red === 'publicacion' ? 'instagram' : 'youtube'} box={20} />{n.nombre}</span>
                {/* El número grande y lo que cuenta debajo: «3.3 mil me gusta y comentarios» en una línea partía la tarjeta en tres. */}
                {n.promedio != null
                  ? <span className={s.cifra}><b>{dibujarContador(n.promedio)}</b><span>{unidadDelNumero(n.metrica)}</span></span>
                  : <span className={s.sin}>{n.motivo ? SIN_NUMERO[n.motivo] : ''}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 3. Lo que les está funcionando: los outliers, con su ángulo y «¿Creamos uno parecido?» ── */}
      {outliers.length > 0 && (
        <div className={s.bloque}>
          <GrillaPiezas
            piezas={outliers} reinicio={`outliers-${ids?.join(',')}`} tarjeta={tarjeta}
            cabecera={<h2>Les está funcionando</h2>}
            columnas={telefono ? 1 : undefined}
            proporcion={proporcion} pie={PIE_TARJETA + ALTO_EXTRA.outlier}
          />
        </div>
      )}

      {/* ── Lo nuevo de las últimas dos semanas ── */}
      {ids != null && ids.length > 0 && (
        <div className={s.bloque}>
          {nuevas.length > 0 ? (
            <GrillaPiezas
              piezas={nuevas} reinicio={`nuevas-${ids.join(',')}`} tarjeta={tarjeta}
              cabecera={<h2>Lo nuevo</h2>}
              columnas={telefono ? 1 : undefined}
              proporcion={proporcion} pie={PIE_TARJETA + ALTO_EXTRA.nueva}
            />
          ) : (
            <>
              <h2>Lo nuevo</h2>
              <p className={s.vacio}>Nada nuevo en las últimas dos semanas.</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
