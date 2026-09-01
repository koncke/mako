'use client';

// =============================================================================
// El editor de cortes — una línea de tiempo sobre el plan del montaje
// =============================================================================
// MaKo monta el anuncio solo: le saca el aire muerto, mezcla y quema los
// subtítulos. Esta pantalla es para cuando eso no alcanza — un tropiezo en el
// medio de una toma, una pausa retórica que el detector se comió, un final que
// conviene más corto.
//
// ── Por qué esto puede existir ─────────────────────────────────────────────
// Porque el montaje devuelve SUS CORTES, no sólo el mp4:
//
//   { total: 38.65, segs: [ { toma: 1, ini: 0.42, fin: 3.18 }, … ] }
//
// Eso es exactamente lo que una línea de tiempo manipula. El editor no es un
// procesador de video: es una pantalla sobre ese objeto, y lo que produce vuelve
// al worker, que al encontrar el plan ya hecho NO recalcula.
//
// ⚠️ Y POR ESO LA PREVISIÓN NO ESPERA A NINGÚN RENDER. Reproduce las TOMAS
// ORIGINALES saltando de una a otra en los cortes, que es lo mismo que el
// montaje va a concatenar. Un editor que para mostrar un cambio necesita esperar
// dos minutos de cola no es un editor: es un formulario con un botón de vista
// previa. Lo que la previsión no tiene es lo que se agrega DESPUÉS de cortar —los
// subtítulos, la música y la nivelación—, y eso se dice en pantalla en vez de
// que parezca que se perdieron.
//
// ── La escala se fija UNA vez ──────────────────────────────────────────────
// Los píxeles por segundo salen del plan con el que se abrió el editor y no se
// recalculan al editar. Si se recalcularan, recortar un tramo estiraría a todos
// los demás para volver a llenar el ancho: la línea de tiempo se movería entera
// debajo del dedo que está arrastrando, y el recorte se vería como que no pasó
// nada. Con la escala fija, la tira se acorta — que es lo que uno hizo.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { Button, Modal, Alert } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';
import { moverBorde, quitarTramo, partirTramo, inicios, enSegundo } from './editor-cortes';
import type { Plan } from './plan-montaje';
import { PISTAS, hayMusica } from '@/lib/musica-catalogo';

/** `70.04` → `1:10`. */
function reloj(seg: number): string {
  const s = Math.max(0, Math.round(seg));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * El color de cada toma. Se repiten cada seis y no importa: lo que tiene que
 * leerse de un vistazo es DÓNDE cambia de toma, no cuál es cuál — para eso está
 * el número escrito adentro del bloque.
 */
const COLORES = ['#4C7DF0', '#F2B01E', '#3FB27F', '#C86BE0', '#E86A5C', '#3FA9C9'];
const colorDe = (toma: number) => COLORES[(toma - 1) % COLORES.length];

type Arrastre = {
  i: number;
  borde: 'ini' | 'fin';
  /** Dónde empezó el dedo y qué valor tenía el borde. Se acumula contra esto y
   *  no de a pasos: sumar incrementos deriva y el borde se va quedando atrás. */
  x0: number;
  v0: number;
};

export function EditorAnuncio({
  clips, segundosPorToma, plan: planInicial, musica: musicaInicial,
  onAplicar, onCerrar,
}: {
  /** Las urls de las tomas originales, en orden. La toma 1 es `clips[0]`. */
  clips: string[];
  segundosPorToma: number[];
  plan: Plan;
  musica: string | null;
  onAplicar: (plan: Plan, musica: string | null) => void;
  onCerrar: () => void;
}) {
  const [plan, setPlan] = useState<Plan>(planInicial);
  const [sel, setSel] = useState<number | null>(null);
  const [t, setT] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [musica, setMusica] = useState<string | null>(musicaInicial);
  const [ancho, setAncho] = useState(0);
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);

  /** La caja que scrollea: de acá sale la escala. */
  const pistaRef = useRef<HTMLDivElement>(null);
  /** La tira de bloques, que puede ser más ancha que la caja. */
  const tiraRef = useRef<HTMLDivElement>(null);
  const videosRef = useRef<Array<HTMLVideoElement | null>>([]);
  // El plan y el reloj también viven en refs porque el bucle de reproducción
  // corre fuera de React y leería valores congelados del cierre.
  const planRef = useRef(plan);
  planRef.current = plan;

  const durClip = segundosPorToma[0] ?? 10;

  // ── La escala, fija desde el plan de apertura ───────────────────────────
  useEffect(() => {
    const el = pistaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAncho(el.clientWidth));
    ro.observe(el);
    setAncho(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const escala = useMemo(
    () => (ancho > 0 && planInicial.total > 0 ? ancho / planInicial.total : 0),
    [ancho, planInicial.total],
  );

  // ⚠️ EL RELOJ VIVE EN UN REF **Y** EN ESTADO. El bucle de reproducción corre
  // fuera de React, así que leería un valor congelado del cierre; la pantalla
  // necesita el estado para repintar. Los dos se escriben juntos en `ponerT`.
  const tRef = useRef(t);
  tRef.current = t;
  const ponerT = useCallback((n: number) => { tRef.current = n; setT(n); }, []);

  const arranques = useMemo(() => inicios(plan), [plan]);
  const arranquesRef = useRef(arranques);
  arranquesRef.current = arranques;
  /** En qué tramo iba el bucle. Es lo que detecta el salto de un corte. */
  const tramoRef = useRef(-1);
  const foco = useMemo(() => enSegundo(plan, t), [plan, t]);
  const tomaViva = foco?.toma ?? 1;

  // ── La previsión: la toma que toca, en el segundo que toca ──────────────
  // Sólo se empuja el `currentTime` cuando NO se está reproduciendo: durante la
  // reproducción el que manda es el video, y escribirle el tiempo en cada cuadro
  // lo haría tartamudear.
  useEffect(() => {
    if (reproduciendo || !foco) return;
    const v = videosRef.current[foco.toma - 1];
    if (v && Math.abs(v.currentTime - foco.dentro) > 0.05) v.currentTime = foco.dentro;
  }, [foco, reproduciendo]);

  // ── El bucle de reproducción ────────────────────────────────────────────
  useEffect(() => {
    if (!reproduciendo) {
      videosRef.current.forEach((v) => v?.pause());
      tramoRef.current = -1;
      return;
    }
    let vivo = true;
    let raf = 0;

    const paso = () => {
      if (!vivo) return;
      const p = planRef.current;
      const marca = enSegundo(p, tRef.current);
      if (!marca) { setReproduciendo(false); return; }
      const v = videosRef.current[marca.toma - 1];
      if (!v) { setReproduciendo(false); return; }

      // Las demás calladas y quietas: sin esto se escuchan dos tomas a la vez.
      videosRef.current.forEach((o, k) => { if (o && k !== marca.toma - 1) o.pause(); });

      // ⚠️ SE BUSCA AL CAMBIAR DE TRAMO, NO SÓLO AL CAMBIAR DE TOMA. Dos tramos
      // seguidos de la MISMA toma es el caso central del editor —partir una toma
      // y sacarle un bache del medio—, y ahí el video ya viene reproduciendo: si
      // sólo se busca cuando el elemento está pausado, sigue de largo y la
      // previsión REPRODUCE JUSTO EL PEDAZO QUE SE ACABA DE SACAR. El editor
      // mostraría lo contrario de lo que hizo.
      if (v.paused) {
        v.currentTime = marca.dentro;
        void v.play().catch(() => setReproduciendo(false));
      } else if (tramoRef.current !== marca.i) {
        v.currentTime = p.segs[marca.i].ini;
      }
      tramoRef.current = marca.i;

      const seg = p.segs[marca.i];
      if (v.currentTime >= seg.fin - 0.03) {
        // Se acabó el tramo: al siguiente. Si era el último, el anuncio terminó.
        const prox = arranquesRef.current[marca.i + 1];
        if (prox == null) { setReproduciendo(false); ponerT(p.total); return; }
        ponerT(prox + 0.001);
      } else {
        ponerT(arranquesRef.current[marca.i] + (v.currentTime - seg.ini));
      }
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => { vivo = false; cancelAnimationFrame(raf); videosRef.current.forEach((v) => v?.pause()); };
  }, [reproduciendo, ponerT]);

  // ── Arrastrar un borde ──────────────────────────────────────────────────
  useEffect(() => {
    if (!arrastre || !escala) return;
    const mover = (e: PointerEvent) => {
      const d = (e.clientX - arrastre.x0) / escala;
      setPlan((p) => moverBorde(p, arrastre.i, arrastre.borde, arrastre.v0 + d, durClip));
    };
    const soltar = () => setArrastre(null);
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', soltar);
    return () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      window.removeEventListener('pointercancel', soltar);
    };
  }, [arrastre, escala, durClip]);

  // Mientras se arrastra, el cabezal se pega al borde que se está moviendo: es
  // lo que hace que recortar sea mirar el cuadro y no calcular segundos.
  useEffect(() => {
    if (!arrastre) return;
    const s = plan.segs[arrastre.i];
    if (!s) return;
    const en = arrastre.borde === 'ini' ? arranques[arrastre.i] : arranques[arrastre.i] + (s.fin - s.ini) - 0.01;
    ponerT(Math.max(0, en));
  }, [arrastre, plan, arranques, ponerT]);

  const editar = (f: (p: Plan) => Plan) => {
    setReproduciendo(false);
    setPlan((p) => f(p));
  };

  const partirAqui = () => {
    if (!foco) return;
    editar((p) => partirTramo(p, foco.i, foco.dentro));
    setSel(null);
  };

  const quitar = (i: number) => {
    editar((p) => quitarTramo(p, i));
    setSel(null);
    ponerT(Math.min(tRef.current, plan.total));
  };

  const seekEn = (e: ReactPointerEvent<HTMLDivElement>) => {
    const caja = tiraRef.current?.getBoundingClientRect();
    if (!caja || !escala) return;
    setReproduciendo(false);
    ponerT(Math.max(0, Math.min((e.clientX - caja.left) / escala, plan.total - 0.05)));
  };

  const cambio = Math.round((plan.total - planInicial.total) * 10) / 10;
  // ⚠️ SE COMPARA EL PLAN, NO LA DURACION. Decía `Math.abs(cambio) < 0.05`, o sea
  // que un cambio que NO mueve el total dejaba el botón apagado: correr un tramo
  // medio segundo hacia adelante, o recortarle a uno lo que se le agrega a otro.
  // Son ediciones perfectamente normales — de hecho son las que uno hace cuando
  // el largo ya está bien y lo que quiere arreglar es DÓNDE cortan— y no se
  // podían aplicar. La duración es una consecuencia de los cortes, no su
  // identidad.
  const mismosCortes = plan.segs.length === planInicial.segs.length
    && plan.segs.every((s, i) => {
      const o = planInicial.segs[i];
      return o && o.toma === s.toma
        && Math.abs(o.ini - s.ini) < 0.005 && Math.abs(o.fin - s.fin) < 0.005;
    });
  const sinCambios = mismosCortes && musica === musicaInicial;

  return (
    <Modal
      titulo="Ajusta los cortes"
      // Más ancho que los 720 de una lista larga a propósito: lo que se mira acá
      // es una línea de tiempo, y una línea de tiempo angosta obliga a hacer con
      // el zoom lo que se tenía que hacer con el ojo.
      ancho={920}
      onCerrar={onCerrar}
      pie={
        <>
          <Button variant="tertiary" onClick={onCerrar}>Dejar como está</Button>
          <Button
            variant="mako"
            disabled={sinCambios}
            icon={<Icon name="ia" size={17} />}
            onClick={() => onAplicar(plan, musica)}
          >
            Montar con estos cortes
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        {/* ── La previsión ───────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
          <div style={{
            position: 'relative', height: '38vh', aspectRatio: '9 / 16',
            background: '#000', borderRadius: 'var(--r-md)', overflow: 'hidden',
          }}>
            {clips.map((url, k) => (
              <video
                key={url}
                ref={(el) => { videosRef.current[k] = el; }}
                src={url}
                preload="auto"
                playsInline
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%',
                  objectFit: 'cover',
                  // Todas cargadas y sólo una visible: cambiar el `src` de un
                  // único elemento recarga el archivo en cada corte, y eso deja
                  // un parpadeo negro justo donde hay que mirar.
                  opacity: tomaViva === k + 1 ? 1 : 0,
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button
              variant="secondary"
              size="lg"
              icon={<Icon name={reproduciendo ? 'pausa' : 'play'} size={17} />}
              onClick={() => setReproduciendo((v) => !v)}
            >
              {reproduciendo ? 'Pausar' : 'Ver'}
            </Button>
            <div style={{
              fontSize: 'var(--fs-md)', color: 'var(--dim)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {reloj(t)} / <strong style={{ color: 'var(--ink)' }}>{reloj(plan.total)}</strong>
            </div>
          </div>
        </div>

        {/* ── La línea de tiempo ─────────────────────────────────────────── */}
        <div style={{
          background: 'var(--sidebar)', borderRadius: 'var(--r-md)', padding: '14px 14px 10px',
        }}>
          {/* ⚠️ LA TIRA PUEDE CRECER, y estirar un borde es una operación normal.
              Con la escala fija, un anuncio que se alarga no entra en el ancho —
              y sin esto la tira desborda el modal en silencio. El scroll lateral
              de CONTENIDO sí está permitido; lo que la regla de la casa prohíbe
              es esconder NAVEGACIÓN detrás de un gesto. Va con `.mk-scroll-oscuro`
              para que la barra se vea sobre el fondo oscuro: `scrollbar-width:
              none` sería esconder la evidencia. */}
          <div
            ref={pistaRef}
            className="mk-scroll-oscuro"
            style={{ overflowX: 'auto', overflowY: 'visible', paddingBottom: 4 }}
          >
          <div
            ref={tiraRef}
            onPointerDown={seekEn}
            style={{
              position: 'relative', display: 'flex', height: 66,
              // El contenido nunca es más angosto que la caja: si el anuncio se
              // acortó, la tira sigue empezando a la izquierda en vez de
              // estirarse para llenar —que es el efecto que la escala fija viene
              // a evitar—.
              minWidth: '100%', width: Math.max(plan.total * escala, 0),
              cursor: escala ? 'text' : 'default', touchAction: 'none',
            }}
          >
            {plan.segs.map((s, i) => {
              const w = (s.fin - s.ini) * escala;
              const activo = sel === i;
              return (
                <div
                  key={i}
                  onPointerDown={(e) => { e.stopPropagation(); setSel(i); }}
                  style={{
                    position: 'relative', width: w, flex: '0 0 auto',
                    background: colorDe(s.toma),
                    opacity: activo ? 1 : 0.82,
                    borderRadius: 6,
                    // ⚠️ EL SEPARADOR VA ADENTRO DEL BLOQUE, NO COMO `margin`.
                    // Con `marginRight: 2` cada corte corre 2 px a la derecha
                    // todo lo que viene después, y el cabezal —que se posiciona
                    // con segundos puros— queda 2 px desfasado POR CORTE: con
                    // siete tomas son 14 px de mentira acumulada justo en lo
                    // único que este control tiene que decir con precisión.
                    // `box-sizing: border-box` es global en el repo, así que el
                    // borde se come 2 px del ancho en vez de agregarlos.
                    borderRight: '2px solid var(--sidebar)',
                    outline: activo ? '2px solid var(--surface)' : 'none',
                    outlineOffset: 1,
                    display: 'grid', placeItems: 'center', overflow: 'hidden',
                    color: '#0C0E12', fontSize: 'var(--fs-meta)', fontWeight: 700,
                  }}
                >
                  {/* El número de la toma. Sólo si entra: un bloque de medio
                      segundo con un número apretado adentro es ruido. */}
                  {w > 26 && s.toma}
                  {[['ini', 0] as const, ['fin', 1] as const].map(([borde, lado]) => (
                    <div
                      key={borde}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setReproduciendo(false);
                        setSel(i);
                        setArrastre({ i, borde, x0: e.clientX, v0: borde === 'ini' ? s.ini : s.fin });
                      }}
                      title={borde === 'ini' ? 'Recortar el principio' : 'Recortar el final'}
                      style={{
                        position: 'absolute', top: 0, bottom: 0,
                        left: lado ? undefined : 0, right: lado ? 0 : undefined,
                        // 11 px de agarre: más angosto que esto y en una pantalla
                        // táctil el borde no se puede tomar.
                        width: 11, cursor: 'ew-resize',
                        background: 'rgba(0,0,0,.28)',
                        borderRadius: lado ? '0 6px 6px 0' : '6px 0 0 6px',
                      }}
                    />
                  ))}
                </div>
              );
            })}
            {/* El cabezal */}
            <div style={{
              position: 'absolute', top: -4, bottom: -4, left: t * escala,
              width: 2, background: '#FFF', pointerEvents: 'none',
              boxShadow: '0 0 0 1px rgba(0,0,0,.45)',
            }} />
          </div>
          </div>

          {/* ── Lo que se puede hacer con lo que está seleccionado ───────── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, minHeight: 34,
          }}>
            <button
              type="button"
              onClick={partirAqui}
              style={botonPista}
            >
              <Icon name="tijera" size={15} />Partir aquí
            </button>
            {sel != null && plan.segs.length > 1 && (
              <button
                type="button"
                onClick={() => quitar(sel)}
                style={botonPista}
              >
                <Icon name="trash" size={15} />Quitar este tramo
              </button>
            )}
            <div style={{
              marginLeft: 'auto', fontSize: 'var(--fs-meta)',
              color: 'var(--sidebar-text)', fontVariantNumeric: 'tabular-nums',
            }}>
              {plan.segs.length} tramos
              {Math.abs(cambio) >= 0.05 && (
                <> · <span style={{ color: cambio < 0 ? '#7DD3A8' : '#F2B01E' }}>
                  {cambio < 0 ? '−' : '+'}{Math.abs(cambio).toFixed(1)} s
                </span></>
              )}
            </div>
          </div>
        </div>

        {/* ── La música ──────────────────────────────────────────────────── */}
        {/* ⚠️ El control existe SÓLO si hay pistas. Un selector con una única
            opción que dice «Sin música» ocupa el mismo lugar que el que funciona
            y enseña que tocarlo no hace nada. El porqué de que hoy esté vacío
            vive en `lib/musica-catalogo.ts`: falta la licencia, no el código. */}
        {hayMusica() && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {[{ id: '', nombre: 'Sin música' }, ...PISTAS].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setMusica(p.id || null)}
                style={{
                  ...botonPista,
                  background: (musica ?? '') === p.id ? 'var(--mako-bg)' : 'var(--surface-2)',
                  borderColor: (musica ?? '') === p.id ? 'var(--mako-border)' : 'var(--border)',
                  color: 'var(--ink)',
                }}
              >
                {p.nombre}
              </button>
            ))}
          </div>
        )}

        {/* ⚠️ LO QUE LA PREVISIÓN NO MUESTRA, DICHO. Los subtítulos, la
            nivelación y la música se agregan DESPUÉS de cortar, así que acá no
            están. Sin esta línea, quien mira concluye que se perdieron. */}
        <Alert tono="info">
          Aquí ves los cortes. Los subtítulos y el sonido nivelado se agregan al montar.
        </Alert>

        {plan.total < 5 && (
          <Alert tono="bad">
            Con estos cortes el anuncio dura {plan.total.toFixed(1)} s. Es demasiado corto para publicarlo.
          </Alert>
        )}
      </div>
    </Modal>
  );
}

const botonPista: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 11px', borderRadius: 8,
  border: '1px solid var(--sidebar-line)', background: 'var(--sidebar-2)',
  color: 'var(--sidebar-text)', fontSize: 'var(--fs-meta)', cursor: 'pointer',
};
