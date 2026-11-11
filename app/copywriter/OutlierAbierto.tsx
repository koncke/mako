'use client';

// =============================================================================
// El original abierto (11/11/2026, D18): COPIADO del carrusel abierto de Image (app/image-editor/carruseles/CarruselAbierto.tsx,
// que copia a Top Carousels). Un modal en dos partes. Izquierda: donde Image pone las láminas, el TEXTO del original (lo que se
// replica de un copy), entero, con qué es (su guion, su pie, su descripción, su copy). Derecha: el tipo y la fecha, el gancho, el
// múltiplo con «lo usual de este creador» (o los días al aire de un anuncio), los números, «Replicar» como acción principal y
// «Ver original». En un celular, a pantalla completa y con «Replicar» en el pie.
// =============================================================================

import { useEffect, useState } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { contadorCorto, nivelDeMultiplo, rotuloOutlier } from '@/lib/carruseles/explorar';
import { explicarMultiplo } from '@/lib/multiplo-rendimiento';
import { ROTULO_TEXTO, rotuloDeFormato, rotuloDiasAlAire, type OutlierCopy } from '@/lib/copywriter/outliers';
import s from '@/app/image-editor/carruseles/explorar.module.css';
import t from './outliers.module.css';

const fechaLarga = (iso: string | null): string => {
  const x = Date.parse(iso ?? '');
  if (!Number.isFinite(x)) return '';
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(x)).replace('.', '');
};

export function OutlierAbierto({ o, telefono, replicando, onReplicar, onCerrar }: {
  o: OutlierCopy; telefono: boolean; replicando: boolean; onReplicar: () => void; onCerrar: () => void;
}) {
  // En un celular «Replicar» va en el pie fijo de la caja (siempre a la vista); en la computadora, en el panel.
  const [celular, setCelular] = useState(telefono);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const poner = () => setCelular(telefono || mq.matches);
    poner();
    mq.addEventListener('change', poner);
    return () => mq.removeEventListener('change', poner);
  }, [telefono]);

  const anuncio = o.formato === 'anuncio';
  const veces = o.multiplo?.veces ?? null;
  const nivel = nivelDeMultiplo(veces);
  const m = o.multiplo && o.multiplo.veces != null ? o.multiplo : null;
  const usual = m ? `${contadorCorto(Math.round(m.mediana))} ${m.metrica === 'vistas' ? 'vistas' : m.metrica === 'dias' ? 'días al aire' : 'me gusta y comentarios'}` : null;
  const aire = anuncio ? rotuloDiasAlAire(o.diasAlAire) : null;
  const usuario = o.creador.usuario ? `@${o.creador.usuario}` : o.creador.nombre;
  const meta = [rotuloDeFormato(o), o.publicada ? `Publicado ${fechaLarga(o.publicada)}` : null].filter(Boolean).join(' · ');
  const boton = replicando ? 'Armando…' : 'Replicar';

  return (
    <Modal titulo={usuario} onCerrar={onCerrar} ancho={1040} alto="min(90vh, 780px)" completaEnCelular
      pie={celular ? <button type="button" className={s.editarPie} onClick={onReplicar} disabled={replicando}>{boton}</button> : undefined}>
      <div className={s.abierto}>
        <div className={s.visor}>
          <div className={s.visorMarco}>
            <div className={t.textoOriginal}>
              <span className={t.deDonde}>{ROTULO_TEXTO[o.deDonde]}</span>
              {o.texto}
            </div>
          </div>
        </div>

        <div className={s.panel}>
          <div>
            {meta ? <p className={s.meta}>{meta}</p> : null}
            <h3 className={s.tituloAbierto}>{o.gancho.length > 140 ? `${o.gancho.slice(0, 137)}…` : o.gancho}</h3>
          </div>

          {veces != null && nivel ? (
            <div className={s.multBloque}>
              <span className={s.mult} data-nivel={nivel} data-grande="si" title={m ? explicarMultiplo(m) : undefined}>{rotuloOutlier(veces)}</span>
              <div>
                <strong>Múltiplo</strong>
                <p>{usual ? `Lo usual de este creador: ${usual}.` : 'Veces lo que suele rendir su cuenta.'}</p>
              </div>
            </div>
          ) : aire ? (
            <div className={s.multBloque}><span className={s.aireGrande} data-activo="si">{aire}</span><div><strong>Días al aire</strong><p>Un anuncio que no vende no se sostiene semanas.</p></div></div>
          ) : null}

          {!anuncio ? (
            <div className={s.datos}>
              {o.formato === 'reel' || o.formato === 'youtube' ? <span title="Vistas">▶ {contadorCorto(o.vistas)}</span> : null}
              <span title="Me gusta">♥ {contadorCorto(o.megusta)}</span>
              <span title="Comentarios">💬 {contadorCorto(o.comentarios)}</span>
            </div>
          ) : null}

          {celular ? null : (
            <button type="button" className={s.editarGrande} onClick={onReplicar} disabled={replicando}>
              <strong>{boton}</strong>
              <span>Tu versión, con su estructura y tu oferta</span>
            </button>
          )}

          <div className={s.filaBotones}>
            <a href={o.url} target={telefono ? undefined : '_blank'} rel="noopener noreferrer" className={s.secundario}>{anuncio ? 'Ver el anuncio' : 'Ver original'} ↗</a>
          </div>
        </div>
      </div>
    </Modal>
  );
}
