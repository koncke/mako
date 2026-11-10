'use client';

// =============================================================================
// El carrusel abierto (6/11/2026): copiado de `carrusel-abierto.jpg` de Top Carousels (docs/carruseles/referencia-top-carousels/).
// Un modal en dos partes. Izquierda, las láminas grandes (o la portada si es lo único que hay) con flechas y contador. Derecha:
// el @creador, el tipo y la fecha, el título, el múltiplo con «lo usual de este creador» (sólo si hay dato), «Editar» como acción
// principal, guardar, ver el original, parecidos y creadores parecidos. En un celular, a pantalla completa.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Modal } from '@/app/_ui/Modal';
import {
  contadorCorto, imagenesDe, nivelDeMultiplo, rotuloCta, rotuloFormato, rotuloOutlier, type Carrusel,
} from '@/lib/carruseles/explorar';
import { rotuloAire } from '@/lib/carruseles/anuncios';
import { explicarMultiplo } from '@/lib/multiplo-rendimiento';
import { useImagenesVivas } from './imagenes-vivas';
import s from './explorar.module.css';

const fechaLarga = (iso: string | null): string => {
  const t = Date.parse(iso ?? '');
  if (!Number.isFinite(t)) return '';
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(t)).replace('.', '');
};

type CreadorParecido = { id: number; nombre: string; usuario: string | null; foto: string | null; n: number };

export function CarruselAbierto({ c, guardado, nParecidos, creadoresParecidos, onGuardar, onEditar, onParecidos, onCreador, onCerrar, telefono }: {
  c: Carrusel;
  guardado: boolean;
  /** Cuántos carruseles parecidos hay en pantalla (0 = el botón no se ofrece). */
  nParecidos: number;
  creadoresParecidos: CreadorParecido[];
  onGuardar: () => void;
  onEditar: () => void;
  onParecidos: () => void;
  onCreador: (id: number) => void;
  onCerrar: () => void;
  telefono: boolean;
}) {
  // Una que no carga (un 403 de Instagram) se saca: sin ninguna, el respaldo de «sin portada», nunca el ícono roto.
  const { vivas: imagenes, alFallar } = useImagenesVivas(imagenesDe(c));
  const total = imagenes.length;
  const [elegida, setI] = useState(0);
  const i = Math.max(0, Math.min(elegida, total - 1));
  // En un celular «Editar» va en el pie fijo de la caja (siempre a la vista); en la computadora, en el panel.
  const [celular, setCelular] = useState(telefono);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const poner = () => setCelular(telefono || mq.matches);
    poner();
    mq.addEventListener('change', poner);
    return () => mq.removeEventListener('change', poner);
  }, [telefono]);
  const ir = useCallback((k: number) => setI(Math.max(0, Math.min(total - 1, k))), [total]);
  // Las flechas del teclado pasan las láminas (el Modal ya maneja Escape y Tab).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((x) => Math.min(total - 1, x + 1));
      else if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [total]);

  const anuncio = c.clase === 'anuncio';
  const titulo = (c.gancho || c.texto || '').trim();
  const nivel = nivelDeMultiplo(c.outlier);
  const m = c.multiplo && c.multiplo.veces != null ? c.multiplo : null;
  const usual = m ? `${contadorCorto(Math.round(m.mediana))} ${m.metrica === 'vistas' ? 'vistas' : m.metrica === 'dias' ? 'días al aire' : 'me gusta y comentarios'}` : null;
  const aire = anuncio ? rotuloAire(c) : null;
  const usuario = c.creador.usuario ? `@${c.creador.usuario}` : c.creador.nombre;
  const meta = [c.formato && c.formato !== 'otro' ? rotuloFormato(c.formato) : null, c.publicada ? `Publicado ${fechaLarga(c.publicada)}` : null].filter(Boolean).join(' · ');

  return (
    <Modal titulo={usuario} onCerrar={onCerrar} ancho={1040} alto="min(90vh, 780px)" completaEnCelular
      pie={celular ? <button type="button" className={s.editarPie} onClick={onEditar}>Editar</button> : undefined}>
      <div className={s.abierto}>
        <div className={s.visor}>
          <div className={s.visorMarco} data-anuncio={anuncio ? 'si' : undefined}>
            {total ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagenes[i]} alt={i === 0 && titulo ? `Portada: ${titulo.slice(0, 80)}` : `Lámina ${i + 1}`} referrerPolicy="no-referrer" draggable={false} onError={() => alFallar(imagenes[i])} />
            ) : <span className={s.sinFoto}>{titulo.slice(0, 200) || 'Sin portada'}</span>}
          </div>
          {total > 1 && (
            <div className={s.visorPie}>
              <button type="button" className={s.flechaGrande} onClick={() => ir(i - 1)} disabled={i === 0} aria-label="Lámina anterior">‹</button>
              <span className={s.visorCuenta} aria-live="polite">{i + 1} / {total}</span>
              <button type="button" className={s.flechaGrande} onClick={() => ir(i + 1)} disabled={i === total - 1} aria-label="Lámina siguiente">›</button>
            </div>
          )}
          {!total && (c.laminas ?? 0) > 1 ? <p className={s.nota}>Tiene {c.laminas} láminas; todavía sólo está guardada la portada.</p> : null}
          {total === 1 && (c.laminas ?? 0) > 1 ? <p className={s.nota}>Tiene {c.laminas} láminas; todavía sólo está guardada la portada.</p> : null}
        </div>

        <div className={s.panel}>
          <div>
            {meta ? <p className={s.meta}>{meta}</p> : null}
            {titulo ? <h3 className={s.tituloAbierto}>{titulo.length > 140 ? `${titulo.slice(0, 137)}…` : titulo}</h3> : null}
          </div>

          {c.outlier != null && nivel ? (
            <div className={s.multBloque}>
              <span className={s.mult} data-nivel={nivel} data-grande="si" title={m ? explicarMultiplo(m) : undefined}>{rotuloOutlier(c.outlier)}</span>
              <div>
                <strong>Múltiplo</strong>
                <p>{usual ? `Lo usual de este creador: ${usual}.` : 'Veces lo que suele rendir su cuenta.'}</p>
              </div>
            </div>
          ) : aire ? (
            <div className={s.multBloque}><span className={s.aireGrande} data-activo={c.activo === false ? undefined : 'si'}>{aire}</span><div><strong>Días al aire</strong><p>Un anuncio que no vende no se sostiene semanas.</p></div></div>
          ) : null}

          {!anuncio && (c.megusta != null || c.comentarios != null || c.cta) ? (
            <div className={s.datos}>
              <span title="Me gusta">♥ {contadorCorto(c.megusta)}</span>
              <span title="Comentarios">💬 {contadorCorto(c.comentarios)}</span>
              {c.cta ? <span className={s.cta} title="Pide comentar una palabra">{rotuloCta(c.cta)}</span> : null}
            </div>
          ) : null}

          {celular ? null : (
            <button type="button" className={s.editarGrande} onClick={onEditar}>
              <strong>Editar</strong>
              <span>Tu versión, escrita con tu IA y tu negocio</span>
            </button>
          )}

          <div className={s.filaBotones}>
            <button type="button" className={s.secundario} aria-pressed={guardado} onClick={onGuardar}>{guardado ? 'Guardado' : 'Guardar'}</button>
            {c.url ? (
              <a href={c.url} target={telefono ? undefined : '_blank'} rel="noopener noreferrer" className={s.secundario}>{anuncio ? 'Ver el anuncio' : 'Ver original'} ↗</a>
            ) : null}
          </div>

          {nParecidos > 0 || creadoresParecidos.length > 0 ? (
            <div className={s.parecidos}>
              {nParecidos > 0 ? <button type="button" className={s.chip} onClick={onParecidos}>Parecidos · {nParecidos}</button> : null}
              {creadoresParecidos.length > 0 ? (
                <div className={s.creadoresParecidos}>
                  <span className={s.etiqueta}>Creadores parecidos</span>
                  {creadoresParecidos.map((x) => (
                    <button key={x.id} type="button" className={s.chip} onClick={() => onCreador(x.id)} title={`Ver sus ${x.n} carruseles`}>{x.usuario ? `@${x.usuario}` : x.nombre}</button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
