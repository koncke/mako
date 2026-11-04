'use client';

// =============================================================================
// OtrasRedes — sus otras redes, encontradas solas: lo que se sumó y lo que se pregunta (4/11/2026)
// =============================================================================
// Vivía adentro de SpyApp.tsx; salió para poder dibujarse en un test (tests/spy-canal-sumado.test.ts): la pastilla dice cosas
// que se prometen (que se sumó, que se está trayendo) y eso se mira dibujado, no leyendo el fuente.
// ⚠️ Los logos de marca se dibujan con los <symbol> de <BrandDefs>: la pantalla que monta esto lo monta una vez (SpyApp).
// =============================================================================

import { useState, type ReactNode } from 'react';
import type { CandidatoVerificado } from '@/lib/spy-otras-redes';
import { dibujarContador } from '@/lib/spy-reglas';
import { preguntaDeAhora, type RedOtra } from '@/lib/spy-otras-redes-reglas';
import { LogoRed } from './LogoRed';

export const NOMBRE_RED: Record<RedOtra, string> = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram' };
export type BusquedaDeRedes = { buscando: boolean; sumadas: CandidatoVerificado[]; candidatos: CandidatoVerificado[] };

/** Lo que se trae de cada red recién sumada, para «Trayendo sus videos…». */
const LO_QUE_TRAE: Record<RedOtra, string> = { youtube: 'sus videos', instagram: 'sus publicaciones', tiktok: '' };

/**
 * La cara de una red encontrada con el logo de su red: su foto con el logo chico en la esquina (como un avatar con insignia), o el
 * logo solo si no hay foto. Si la foto no carga, queda el logo.
 */
function CaraDeRed({ k }: { k: CandidatoVerificado }) {
  return (
    <span className="spy-redes-cara" data-con-foto={k.foto ? 'si' : 'no'}>
      {k.foto && (
        // eslint-disable-next-line @next/next/no-img-element -- la sirve el CDN de la red, sin pasar por el optimizador
        <img src={k.foto} alt="" referrerPolicy="no-referrer"
          onError={(e) => { e.currentTarget.parentElement?.setAttribute('data-con-foto', 'no'); e.currentTarget.remove(); }} />
      )}
      <span className="spy-redes-logo"><LogoRed red={k.red} box={k.foto ? 15 : 24} /></span>
    </span>
  );
}

/**
 * Sus otras redes, SOLAS (Martín, 4/11: «debe ser automático, no un botón, de última que te muestre opciones y te
 * pregunte si es ese o no»). Lo seguro ya se sumó y se puede deshacer; lo dudoso se pregunta, con su foto y el porqué.
 * Si no encontró nada, no dice nada: no hay nada que hacer.
 */
export function OtrasRedes({ b, ocupado, trayendo, onSi, onNo, onDeshacer }: {
  b: BusquedaDeRedes | undefined; ocupado: boolean;
  /** Los canales recién sumados que se están leyendo (`traerLoNuevo`). */
  trayendo: readonly string[] | null;
  onSi: (k: CandidatoVerificado) => void; onNo: (k: CandidatoVerificado) => void; onDeshacer: (k: CandidatoVerificado) => void;
}) {
  // Cuántas veces se tocó «Ver otro» (`preguntaDeAhora`). Antes de cualquier return: es un hook.
  const [vuelta, setVuelta] = useState(0);
  // ⚠️ SIN TEXTO MIENTRAS BUSCA NI CUANDO NO PUDO (Martín, 4/11/2026: «Elimina textos innecesarios como "No pude buscar sus
  // otras redes ahora. Prueba en un rato."»). Se busca en segundo plano; lo que aparece, aparece. Lo que no terminó se vuelve a
  // pedir solo (`pendiente`, lib/spy-google-corrida.ts).
  if (!b || b.buscando) return null;
  if (!b.sumadas.length && !b.candidatos.length) return null;
  // ⚠️ CON EL LOGO DE SU RED (4/11/2026; Martín: «"Encontré a Leila en YouTube" eso debería aparecer con el diseño de YouTube o
  // con el logo, para que se entienda»). Una pastilla por canal: el logo, «Su YouTube» o «¿Es su YouTube?», su nombre como link
  // (abre el canal en otra pestaña, nada más) y sus botones. Mientras se traen sus piezas lo dice, y «Deshacer» espera: deshacer
  // a mitad de la lectura dejaría piezas de un canal que ya no es suyo.
  // Lo que distingue a dos con el mismo nombre (Martín, con Federico Cristofari): sus suscriptores o seguidores, y el porqué.
  const detalle = (k: CandidatoVerificado, porque: string | null) =>
    [k.seguidores != null ? `${dibujarContador(k.seguidores)} ${k.red === 'youtube' ? 'suscriptores' : 'seguidores'}` : '', porque ?? '']
      .filter(Boolean).join(' · ') || null;
  const fila = (k: CandidatoVerificado, pregunta: boolean, porque: string | null, botones: ReactNode) => (
    <div key={`${k.red}|${k.ref}`} className="spy-redes-fila" data-red={k.red} data-pregunta={pregunta || undefined} title={k.porque || undefined}>
      <CaraDeRed k={k} />
      <span className="spy-redes-texto">
        <b>{pregunta ? `¿Es su ${NOMBRE_RED[k.red]}?` : `Su ${NOMBRE_RED[k.red]}`}</b>
        <a href={k.url} target="_blank" rel="noreferrer noopener" aria-label={`Abrir ${k.titulo || k.ref} en ${NOMBRE_RED[k.red]}`}>
          <span>{k.titulo || k.ref}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M7 17 17 7M9 7h8v8" /></svg>
        </a>
        {detalle(k, porque) && <small>{detalle(k, porque)}</small>}
      </span>
      {botones}
    </div>
  );
  const pregunta = preguntaDeAhora(b.candidatos, vuelta);
  const trae = (k: CandidatoVerificado) => !!trayendo?.includes(k.red) && !!LO_QUE_TRAE[k.red];
  return (
    <section className="spy-redes" aria-label="Sus otras redes">
      {b.sumadas.map((k) => fila(k, false, null, trae(k)
        ? <span className="spy-redes-trae" role="status"><i aria-hidden />Trayendo {LO_QUE_TRAE[k.red]}…</span>
        : <button type="button" className="spy-boton" disabled={ocupado} onClick={() => onDeshacer(k)}>Deshacer</button>))}
      {/* UNA pregunta a la vez, la más probable; las demás con «Ver otro» (`preguntaDeAhora`). Con dos, la fila se partía. */}
      {pregunta && fila(pregunta.k, true, pregunta.k.porque || null, (
        <>
          <button type="button" className="spy-boton spy-boton-primario" disabled={ocupado} onClick={() => onSi(pregunta.k)}>Es</button>
          <button type="button" className="spy-boton" disabled={ocupado} onClick={() => onNo(pregunta.k)}>No es</button>
          {pregunta.otros > 0 && (
            <button type="button" className="spy-boton spy-redes-otro" disabled={ocupado} onClick={() => setVuelta((v) => v + 1)}>Ver otro</button>
          )}
        </>
      ))}
    </section>
  );
}
