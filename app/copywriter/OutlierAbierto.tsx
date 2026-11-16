'use client';

// =============================================================================
// El original abierto (11/11/2026, D18): COPIADO del carrusel abierto de Image (app/image-editor/carruseles/CarruselAbierto.tsx,
// que copia a Top Carousels). Un modal en dos partes. Izquierda: donde Image pone las láminas, el TEXTO del original (lo que se
// replica de un copy), entero, con qué es (su guion, su pie, su descripción, su copy). Derecha: el tipo y la fecha, el gancho, el
// múltiplo con «lo usual de este creador» (o los días al aire de un anuncio), los números, «Replicar» como acción principal y
// «Ver original». En un celular, a pantalla completa y con «Replicar» en el pie.
// ⚠️ EL CANDADO VA ADENTRO (14/11/2026): replicar el guion de otro es de MaKo Pro, y a un Essential le va el candado EN EL LUGAR
// de «Replicar», como en el resto de la app (app/video-editor/_opencut/clips/components/clips-view.tsx y broll-view.tsx ponen
// `CandadoSoloPro` donde iría el botón). Dejarlo afuera no sirve: el cartel se dibujaba DETRÁS del modal y el Essential tocaba
// «Replicar» y no pasaba nada —ni candado, ni error, ni «Armando…»—. El original se sigue leyendo entero: lo de Pro es replicarlo.
// =============================================================================

import { useEffect, useState } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { CandadoSoloPro } from '@/app/_components/CandadoSoloPro';
import { contadorCorto, nivelDeMultiplo, rotuloOutlier } from '@/lib/carruseles/explorar';
import { explicarMultiplo } from '@/lib/multiplo-rendimiento';
import { ROTULO_TEXTO, rotuloDeFormato, rotuloDiasAlAire, type OutlierCopy } from '@/lib/copywriter/outliers';
import { pedirOriginal } from './cliente';
import s from '@/app/image-editor/carruseles/explorar.module.css';
import t from './outliers.module.css';

const fechaLarga = (iso: string | null): string => {
  const x = Date.parse(iso ?? '');
  if (!Number.isFinite(x)) return '';
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(x)).replace('.', '');
};

export function OutlierAbierto({ o, telefono, replicando, soloPro, onReplicar, onCerrar }: {
  o: OutlierCopy; telefono: boolean; replicando: boolean;
  /** Quien mira paga Essential: en vez de «Replicar», el candado (lo decide `useSoloPro('replicar-guion')` en la portada). */
  soloPro?: boolean;
  onReplicar: () => void; onCerrar: () => void;
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

  // La tarjeta trae hasta TEXTO_EN_TARJETA letras (la portada pesaba 7,5 MB): al abrir, el texto ENTERO, del server.
  const [completo, setCompleto] = useState<string | null>(null);
  useEffect(() => {
    setCompleto(null);
    let vivo = true;
    void pedirOriginal(o.id).then((r) => { if (vivo && r.ok) setCompleto(r.outlier.texto); });
    return () => { vivo = false; };
  }, [o.id]);
  const texto = completo ?? o.texto;

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
      pie={celular ? (soloPro
        ? <CandadoSoloPro funcion="replicar-guion" style={{ padding: '2px 0' }} />
        : <button type="button" className={s.editarPie} onClick={onReplicar} disabled={replicando}>{boton}</button>) : undefined}>
      <div className={s.abierto}>
        <div className={s.visor}>
          {/* Con imagen, arriba la pieza (como las láminas de Image) y abajo su texto. 11/11/2026, en producción: con un pie de
              dos renglones, el visor era una caja blanca enorme casi vacía. */}
          <div className={s.visorMarco}>
            {o.miniatura ? (
              <div className={t.conImagen}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={t.imagenOriginal} src={o.miniatura} alt="" referrerPolicy="no-referrer" />
                <div className={`${t.textoOriginal} ${t.textoBajo}`}>
                  <span className={t.deDonde}>{ROTULO_TEXTO[o.deDonde]}</span>
                  {texto}
                </div>
              </div>
            ) : (
              <div className={t.textoOriginal}>
                <span className={t.deDonde}>{ROTULO_TEXTO[o.deDonde]}</span>
                {texto}
              </div>
            )}
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

          {celular ? null : soloPro ? (
            /* El candado donde iba «Replicar», no detrás del modal (14/11/2026): el texto y «Pasar a Pro». */
            <CandadoSoloPro funcion="replicar-guion" />
          ) : (
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
