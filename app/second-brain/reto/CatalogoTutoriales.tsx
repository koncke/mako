'use client';
// =============================================================================
// «TUTORIALES DE MaKo»: EL CATÁLOGO DE TODOS LOS VIDEOS (20/11/2026, auditoría V1 y D1-07)
// =============================================================================
// Lo acordado (memoria onboarding-16-11-decisiones: «un botón de tutoriales, un ícono de videos: reemplaza el chat por un CATÁLOGO
// ordenado de todos los videos de MaKo»; la maqueta, cuerpo.html → catálogo): el ícono de videos en la cabecera del chat del reto
// cambia los mensajes por el catálogo, con «Volver al chat». Para empezar (la bienvenida, el WhatsApp y el recorrido), el reto (los
// coaches y los 7 días; los que no llegaron, «Se abre el día N») y una tarjeta por cada pestaña con video, con su nombre (Martín,
// 20/11: nunca más «Cómo funciona…»; tests/tutorial-sin-presentacion.test.ts). Cada
// tarjeta reproduce su video ahí mismo (VideoDelMomento, que sigue en la esquina si se navega). Sale de public/tutoriales/manifiesto.json:
// un video que no está, no se muestra (nunca un hueco).
// =============================================================================
import { useState } from 'react';
import { TUTORIALES, tutorialDe } from '@/lib/tutoriales';
import { FAMILIAS, itemsDe } from '@/app/_components/nav';
import { mostrarEnSuPestana } from './enSuPestana';
import { useManifiesto } from '@/app/_ui/tutorial/useVideoTutorial';
import { VideoDelMomento } from '@/app/_ui/tutorial/VideoDelMomento';
// Los videos del reto viven en lib/reto/dias.ts: el nombre de los coaches sólo se escribe ahí (tests/coaches-ops-center.test.ts, 14).
import { VIDEOS_PARA_EMPEZAR as PARA_EMPEZAR, VIDEOS_DEL_RETO as DEL_RETO } from '@/lib/reto/dias';

type Video = { key: string; pestana?: string; duracion_s?: number };
export type Tarjeta = { key: string; titulo: string; dur?: number; cerrado?: string;
  /** Una pestaña: al tocarla lleva a la pestaña de verdad y corre ahí su video, con sus marcas (la maqueta, tab-tour). */
  pestana?: true };
export type Grupo = { titulo: string; tarjetas: Tarjeta[] };


/** Los grupos del catálogo, con lo que hay en el manifiesto. Puro: lo prueba tests/reto-dias.test.ts. */
export function gruposDelCatalogo(videos: readonly Video[], diaAbierto: number): Grupo[] {
  const por = new Map(videos.map((v) => [v.key, v]));
  const usados = new Set<string>();
  const tarjeta = (key: string, titulo: string, cerrado?: string): Tarjeta | null => {
    const v = por.get(key); if (!v) return null;
    usados.add(key);
    return { key, titulo, ...(v.duracion_s ? { dur: v.duracion_s } : {}), ...(cerrado ? { cerrado } : {}) };
  };
  const empezar = PARA_EMPEZAR.map(([k, t]) => tarjeta(k, t)).filter((x): x is Tarjeta => !!x);
  const reto = DEL_RETO.map(([k, t]) => { const n = Number(/^reto-dia-(\d)$/.exec(k)?.[1] ?? 0); return tarjeta(k, t, n > diaAbierto ? `Se abre el día ${n}` : undefined); }).filter((x): x is Tarjeta => !!x);
  // Sin «AI Avatar»: la tab se cerró el 14/11 (el personaje está en Video). Las de adentro de Classroom, con su nombre: si no, hay
  // dos «Calendar».
  // LAS PESTAÑAS, POR FAMILIA (verificación del 20/11, V1; la maqueta: «Pestañas · {familia}» en el orden de la barra y, al final, «Tu
  // cuenta» con el Ops Center, la Ticketera y Settings). La familia sale de la barra (app/_components/nav.ts, FAMILIAS).
  const porGrupo = new Map<string, Tarjeta[]>();
  for (const t of TUTORIALES) {
    if (t.pestana === 'avatar' || usados.has(t.pestana)) continue;
    const x = tarjeta(t.pestana, t.pestana.startsWith('classroom-') ? `Classroom › ${t.nombre}` : t.nombre);
    if (!x) continue;
    const g = grupoDeLaRuta(t.ruta);
    porGrupo.set(g, [...(porGrupo.get(g) ?? []), { ...x, pestana: true }]);
  }
  const orden = [...FAMILIAS.map((fa) => `Pestañas · ${fa.label}`), MAS, TU_CUENTA];
  const pestanas = [...porGrupo.keys()].sort((a, b) => orden.indexOf(a) - orden.indexOf(b)).map((titulo) => ({ titulo, tarjetas: porGrupo.get(titulo)! }));
  return [{ titulo: 'Para empezar', tarjetas: empezar }, { titulo: 'Tu reto de 7 días', tarjetas: reto }, ...pestanas].filter((g) => g.tarjetas.length);
}

const TU_CUENTA = 'Tu cuenta';
const MAS = 'Más';
// Una expresión, no una lista de rutas entre comillas: tests/integracion-sin-salir.test.ts toma un literal que arranca con la de
// Integraciones por un link nuevo, y esto sólo agrupa tutoriales.
const DE_TU_CUENTA = /^\/(perfil|integraciones|equipo|configuraciones|second-brain)(\/|$)/;
const empiezaCon = (p: string, base: string) => p === base || p.startsWith(`${base}/`);
/** El grupo de un tutorial por su ruta: «Tu cuenta» (Settings y el Ops Center), «Pestañas · {familia}» (la familia de la fila de la
 *  barra cuya ruta es el comienzo de la suya) o, lo que no está en la barra, «Más». */
export function grupoDeLaRuta(ruta: string): string {
  const p = ruta.split('?')[0];
  if (DE_TU_CUENTA.test(p)) return TU_CUENTA;
  for (const fa of FAMILIAS) if (itemsDe(fa).some((it) => !!it.href && it.href !== '/' && empiezaCon(p, it.href.split('?')[0]))) return `Pestañas · ${fa.label}`;
  return MAS;
}

const mmss = (s?: number) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '');

export function CatalogoTutoriales({ diaAbierto, onVolver, videos }: { diaAbierto: number; onVolver: () => void; videos?: Video[] }) {
  // `videos`: para dibujarlo sin el navegador (las capturas); en la app, el manifiesto.
  const leido = useManifiesto() as { videos?: Video[] } | null;
  const m = videos ? { videos } : leido;
  const [viendo, setViendo] = useState<string | null>(null);
  const grupos = gruposDelCatalogo(m?.videos ?? [], diaAbierto);
  return (
    <div className="rt-cat" data-recorrido="sb-reto-catalogo">
      <div className="rt-cat__cab">
        <div><p className="rt-cat__t">Tutoriales de MaKo</p><p className="rt-cat__sub">Todos los videos, en orden: para empezar, los del reto y el de cada pestaña.</p></div>
        <button type="button" className="co-chip" onClick={onVolver}>Volver al chat</button>
      </div>
      {!m ? <p className="co-vacio">Cargando los videos…</p> : grupos.map((g) => (
        <section key={g.titulo} className="rt-cat__grupo" aria-label={g.titulo}>
          <p className="rt-cat__g">{g.titulo}</p>
          <ul className="rt-cat__lista">
            {g.tarjetas.map((t) => (
              <li key={t.key} className="rt-cat__item" data-cerrado={t.cerrado ? '' : undefined}>
                {viendo === t.key ? <VideoDelMomento clave={t.key} titulo={t.titulo} revision={false} /> : (
                  <button type="button" className="rt-cat__btn" disabled={!!t.cerrado} onClick={() => {
                    // Una pestaña, en la pestaña de verdad (V1): la barra la marca y su video corre ahí. Si no está en la barra, aquí mismo.
                    const tu = t.pestana ? tutorialDe(t.key) : null;
                    if (tu && mostrarEnSuPestana(tu, { texto: 'Aquí está. Al entrar, te la muestro con su video.' })) { onVolver(); return; }
                    setViendo(t.key);
                  }}>
                    <span className="rt-menu__play" aria-hidden>▶</span>
                    <span><b>{t.titulo}</b><small>{t.cerrado ?? `Video${t.dur ? ` · ${mmss(t.dur)}` : ''}`}</small></span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** El ícono de videos de la cabecera (el mismo de los coaches: sin texto). */
export function BotonTutoriales({ activo, onClick }: { activo: boolean; onClick: () => void }) {
  return (
    <button type="button" className="rt-btn rt-btn--ico" aria-pressed={activo} aria-label="Tutoriales de MaKo" title="Tutoriales de MaKo" onClick={onClick} data-recorrido="sb-reto-tutoriales">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><rect x="3" y="5" width="18" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m10 9.5 4.5 2.5-4.5 2.5z" fill="currentColor" /></svg>
    </button>
  );
}

// ⚠️ SIN COMILLAS INVERTIDAS ADENTRO (es un template literal: AGENTS.md).
export const CSS_CATALOGO = `
.rt-btn--ico { width: 36px; padding: 0; justify-content: center; }
.rt-btn--ico[aria-pressed="true"] { background: var(--surface-2); }
.rt-acciones { margin-left: auto; flex: none; position: relative; display: flex; align-items: center; gap: 8px; }
.rt-cat { display: flex; flex-direction: column; gap: 18px; padding: 8px 0 24px; }
.rt-cat__cab { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.rt-cat__t { margin: 0; font-weight: 700; font-size: var(--fs-card, 15px); color: var(--ink); }
.rt-cat__sub { margin: 2px 0 0; font-size: 12px; line-height: 1.4; color: var(--muted, #6b7280); }
.rt-cat__g { margin: 0 0 8px; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--faint); }
.rt-cat__lista { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
.rt-cat__btn { width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); color: var(--ink); font: inherit; text-align: left; cursor: pointer; }
.rt-cat__btn:hover:not(:disabled) { border-color: var(--border-strong); }
.rt-cat__btn:disabled { cursor: default; opacity: .6; }
.rt-cat__btn b { display: block; font-size: 13px; }
.rt-cat__btn small { display: block; font-size: 11.5px; color: var(--dim); }
`;
