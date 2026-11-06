'use client';

// =============================================================================
// FranjaCarruseles — «Carruseles que funcionan», arriba de las plantillas de «¿Qué vas a crear hoy?» (Image, 4/11/2026)
// =============================================================================
// Los que mejor les funcionan esta semana a las cuentas que el negocio sigue en Competitors Spy (si esta semana hay menos
// de 3, los de mayor outlier), con «Ver todos» al explorador (`?ver=carruseles`). La portada abre sin esperarlos: se piden
// desde el navegador (./actions.ts, `resumenCarruselesAction`) con esqueletos mientras llegan.
//
// Sin cuentas seguidas, en vez de la fila va UNA línea con la acción y una «×» que la cierra y no vuelve (AGENTS.md: ningún
// wizard tapa una tab; la franja dice qué hace y se va). «No pude leer» es su propio estado, nunca una fila vacía.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import Link, { useWs } from '@/app/_ui/Link';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { contadorCorto, rotuloOutlier, type Carrusel } from '@/lib/carruseles/explorar';
import { explicarMultiplo, MULTIPLO_FUERTE } from '@/lib/multiplo-rendimiento';
import { resumenCarruselesAction } from './actions';
import s from './franja.module.css';

type Resumen = Awaited<ReturnType<typeof resumenCarruselesAction>>;

const clave = (ws: number | null) => `mk-franja-carruseles:${ws ?? 0}`;
function cerrada(ws: number | null): boolean {
  try { return window.localStorage.getItem(clave(ws)) === 'cerrada'; } catch { return false; }
}

export function FranjaCarruseles() {
  const ws = useWs();
  const [r, setR] = useState<Resumen | null>(null);
  const [oculta, setOculta] = useState(false);
  const pedir = useCallback(() => {
    setR(null);
    void resumenCarruselesAction().then(setR).catch(() => setR({ ok: false, error: 'No pude leer los carruseles de las cuentas que sigues.' }));
  }, []);
  useEffect(() => { setOculta(cerrada(ws)); pedir(); }, [ws, pedir]);

  if (r === null) {
    return (
      <section className={s.franja} aria-busy="true" aria-label="Cargando carruseles que funcionan">
        <div className={s.cabeza}><span className={s.esqueletoTitulo} /></div>
        <div className={s.fila}>{Array.from({ length: 6 }, (_, i) => <span key={i} className={s.esqueleto} style={{ animationDelay: `${i * 80}ms` }} />)}</div>
      </section>
    );
  }
  if (!r.ok) {
    return (
      <p className={s.error} role="alert">
        No pude leer los carruseles de las cuentas que sigues. <button type="button" onClick={pedir}>Reintentar</button><ReportarASoporte />
      </p>
    );
  }
  // Con la biblioteca de ejemplos hay carruseles aunque el negocio todavía no siga a nadie: la franja se ve igual.
  if (r.carruseles.length === 0) {
    if (oculta) return null;
    return (
      <div className={s.linea}>
        <span>{r.frase || 'Sigue a las cuentas de tu rubro en Competitors Spy: aquí ves sus carruseles que mejor funcionan.'}</span>
        {r.accion ? <Link href={r.accion.ruta}>{r.accion.texto}</Link> : null}
        <button type="button" className={s.cerrar} aria-label="Cerrar" title="Cerrar"
          onClick={() => { setOculta(true); try { window.localStorage.setItem(clave(ws), 'cerrada'); } catch { /* sin almacenamiento: vale hasta recargar */ } }}>×</button>
      </div>
    );
  }
  return (
    <section className={s.franja} aria-labelledby="franja-carruseles">
      <div className={s.cabeza}>
        <h2 id="franja-carruseles">{r.semana ? 'Carruseles que funcionan esta semana' : 'Carruseles que funcionan'}</h2>
        <Link href={`/image-editor?ver=carruseles${r.semana ? '&periodo=7' : ''}`} className={s.todos}>Ver todos ({r.total})</Link>
      </div>
      <ul className={s.fila}>
        {r.carruseles.map((c) => <Mini key={c.id} c={c} />)}
      </ul>
    </section>
  );
}

function Mini({ c }: { c: Carrusel }) {
  return (
    <li className={s.mini}>
      <Link href={`/image-editor?ver=carruseles&de=${c.competidorId}`} className={s.foto} title={c.gancho || c.texto || c.creador.nombre}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {c.miniatura ? <img src={c.miniatura} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className={s.sinFoto}>{(c.gancho || c.texto || '').slice(0, 90)}</span>}
        {c.outlier != null ? <span className={s.outlier} data-fuerte={c.outlier >= MULTIPLO_FUERTE ? 'si' : undefined} title={c.multiplo ? explicarMultiplo(c.multiplo) : undefined}>{rotuloOutlier(c.outlier)}</span> : null}
      </Link>
      <span className={s.quien}>{c.creador.usuario ? `@${c.creador.usuario}` : c.creador.nombre}</span>
      <span className={s.numeros}>♥ {contadorCorto(c.megusta)}</span>
    </li>
  );
}
