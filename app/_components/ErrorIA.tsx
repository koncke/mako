'use client';

// =============================================================================
// ErrorIA — un error de IA NUNCA se dibuja sin su salida al lado
// =============================================================================
// ⚠️ POR QUÉ ES UNA PIEZA Y NO TRES COPIAS. La salida (`ConectarIA`, que ofrece las
// cinco IA gratis con su estado real y deja sumar otra cuenta) ya existía y estaba
// enchufada en UNA sola pantalla: `MatrizView`. En el paso de la cara de marca y en el
// Archivero, el cliente veía el error crudo de Google y ningún botón — en pleno
// onboarding, que es justo cuando todavía no tiene una segunda IA cargada y menos idea
// tiene de que puede cargarla.
//
// Es la regla de la casa dos veces: «una cosa, un lugar» (mientras la salida sea algo
// que cada pantalla se acuerda de poner, alguna no la va a poner) y «si la única salida
// vive adentro de una pantalla condicional, no hay salida».
//
// Reportado en vivo por el dueño, con un cliente esperando: «no puede ser que se exceda
// la quota durante el onboarding, y en dicho caso debería ahí mismo saltar la opción de
// dejarle otra key, como ya tenemos configurado». Estaba configurado. En un solo lado.

import { useState } from 'react';
import ConectarIA from './ConectarIA';
import { esErrorDeIA } from '@/lib/ia-mensajes';

const MONO = "'Geist Mono', monospace";

export default function ErrorIA({ error, onConectada, children, soloSalida }: {
  /** El texto del error. null/'' → no se dibuja nada. */
  error: string | null | undefined;
  /** Se conectó una IA: el caller limpia el error y deja reintentar. */
  onConectada?: () => void;
  /** Contenido extra debajo del mensaje (ej. el detalle por archivo). */
  children?: React.ReactNode;
  /** La pantalla YA pinta el error (ej. una lista de avisos por archivo): dibuja solo
   *  la salida. Sigue recibiendo el texto porque es lo que decide si hay salida. */
  soloSalida?: boolean;
}) {
  const [verCrudo, setVerCrudo] = useState(false);
  if (!error) return null;
  const deIA = esErrorDeIA(error);
  if (soloSalida) {
    return deIA ? (
      <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 9 }}>
          Conecta otra IA gratis y vuelve a intentar
        </div>
        <ConectarIA onConectada={onConectada} />
      </div>
    ) : null;
  }

  // ⚠️ EL ERROR CRUDO DEL PROVEEDOR NO VA DE ENTRADA. Lo que le llegó al cliente fue
  // seis renglones con «generativelanguage.googleapis.com/generate_content_free_tier_
  // requests, limit: 20» y dos URLs de documentación de Google. Nada de eso le dice qué
  // hacer, y encima entierra el botón que sí lo resuelve. Se guarda detrás de «ver
  // detalle» —hace falta para diagnosticar, y ya se pagó no tenerlo— pero no manda.
  const largo = error.length > 200 || /googleapis\.com|https?:\/\//.test(error);
  const resumen = largo
    ? 'La IA no pudo con esto ahora mismo. Abajo tienes cómo destrabarlo.'
    : error;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--bad)', lineHeight: 1.55, textAlign: 'center' }}>
        {resumen}
      </div>
      {largo && (
        <div style={{ textAlign: 'center', marginTop: 6 }}>
          <button type="button" onClick={() => setVerCrudo((v) => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' }}>
            {verCrudo ? 'ocultar detalle' : 'ver detalle'}
          </button>
        </div>
      )}
      {largo && verCrudo && (
        <div style={{ marginTop: 8, fontFamily: MONO, fontSize: 11, color: 'var(--faint)', lineHeight: 1.5, wordBreak: 'break-word', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
          {error}
        </div>
      )}
      {children}
      {deIA && (
        <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-2)', padding: '13px 15px' }}>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 9 }}>
            Conecta otra IA gratis y vuelve a intentar
          </div>
          <ConectarIA onConectada={onConectada} />
        </div>
      )}
    </div>
  );
}
