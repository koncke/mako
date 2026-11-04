'use client';

// =============================================================================
// OtrasRedes — sus otras redes, encontradas solas: lo que se sumó y lo que se pregunta (4/11/2026)
// =============================================================================
// Vivía adentro de SpyApp.tsx; salió para poder dibujarse en un test (tests/spy-canal-sumado.test.ts): la pastilla dice cosas
// que se prometen (que se sumó, que se está trayendo) y eso se mira dibujado, no leyendo el fuente.
// ⚠️ Los logos de marca se dibujan con los <symbol> de <BrandDefs>: la pantalla que monta esto lo monta una vez (SpyApp).
// =============================================================================

import type { ReactNode } from 'react';
import type { RedOtra } from '@/lib/spy-otras-redes-reglas';
import type { CandidatoVerificado } from '@/lib/spy-otras-redes';
import { LogoRed } from './LogoRed';

export const NOMBRE_RED: Record<RedOtra, string> = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram' };
export type BusquedaDeRedes = { buscando: boolean; sumadas: CandidatoVerificado[]; candidatos: CandidatoVerificado[] };

/** Lo que se trae de cada red recién sumada, para «Trayendo sus videos…». */
const LO_QUE_TRAE: Record<RedOtra, string> = { youtube: 'sus videos', instagram: 'sus publicaciones', tiktok: '' };

/** La cara de una red encontrada: su foto si la leímos. Sin foto, nada: el logo de su red ya dice qué es. */
function CaraDeRed({ k }: { k: CandidatoVerificado }) {
  return k.foto
    // eslint-disable-next-line @next/next/no-img-element -- la sirve el CDN de la red, sin pasar por el optimizador
    ? <img className="spy-redes-cara" src={k.foto} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.remove(); }} />
    : null;
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
  // ⚠️ SIN TEXTO MIENTRAS BUSCA NI CUANDO NO PUDO (Martín, 4/11/2026: «Elimina textos innecesarios como "No pude buscar sus
  // otras redes ahora. Prueba en un rato."»). Se busca en segundo plano; lo que aparece, aparece. Lo que no terminó se vuelve a
  // pedir solo (`pendiente`, lib/spy-google-corrida.ts).
  if (!b || b.buscando) return null;
  if (!b.sumadas.length && !b.candidatos.length) return null;
  // ⚠️ CON EL LOGO DE SU RED (4/11/2026; Martín: «"Encontré a Leila en YouTube" eso debería aparecer con el diseño de YouTube o
  // con el logo, para que se entienda»). Una pastilla por canal: el logo, «Su YouTube» o «¿Es su YouTube?», su nombre como link
  // (abre el canal en otra pestaña, nada más) y sus botones. Mientras se traen sus piezas lo dice, y «Deshacer» espera: deshacer
  // a mitad de la lectura dejaría piezas de un canal que ya no es suyo.
  const fila = (k: CandidatoVerificado, pregunta: boolean, porque: string | null, botones: ReactNode) => (
    <div key={`${k.red}|${k.ref}`} className="spy-redes-fila" data-red={k.red} data-pregunta={pregunta || undefined} title={k.porque || undefined}>
      <span className="spy-redes-logo"><LogoRed red={k.red} box={22} /></span>
      <CaraDeRed k={k} />
      <span className="spy-redes-texto">
        <b>{pregunta ? `¿Es su ${NOMBRE_RED[k.red]}?` : `Su ${NOMBRE_RED[k.red]}`}</b>
        <a href={k.url} target="_blank" rel="noreferrer noopener" aria-label={`Abrir ${k.titulo || k.ref} en ${NOMBRE_RED[k.red]}`}>
          <span>{k.titulo || k.ref}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M7 17 17 7M9 7h8v8" /></svg>
        </a>
        {porque && <small>{porque}</small>}
      </span>
      {botones}
    </div>
  );
  const trae = (k: CandidatoVerificado) => !!trayendo?.includes(k.red) && !!LO_QUE_TRAE[k.red];
  return (
    <section className="spy-redes" aria-label="Sus otras redes">
      {b.sumadas.map((k) => fila(k, false, null, trae(k)
        ? <span className="spy-redes-trae" role="status"><i aria-hidden />Trayendo {LO_QUE_TRAE[k.red]}…</span>
        : <button type="button" className="spy-boton" disabled={ocupado} onClick={() => onDeshacer(k)}>Deshacer</button>))}
      {b.candidatos.map((k) => fila(k, true, k.porque || null, (
        <>
          <button type="button" className="spy-boton spy-boton-primario" disabled={ocupado} onClick={() => onSi(k)}>Es</button>
          <button type="button" className="spy-boton" disabled={ocupado} onClick={() => onNo(k)}>No es</button>
        </>
      )))}
    </section>
  );
}
