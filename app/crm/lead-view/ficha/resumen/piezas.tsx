'use client';

// =============================================================================
// ficha/resumen/piezas — lo que comparten los bloques del Resumen: la tarjeta, la fila de propiedad, el dato y el
// guardado de los datos de contacto
// =============================================================================
// El molde (./estilo.ts): la tarjeta de HubSpot con su título, la fila de propiedad y el highlight de Attio, y la vista
// épica de General. Los CAMPOS no son nuevos: son los de la ficha (../../CampoEditable.tsx, `EditableInline`), que
// guardan en el lugar, dejan la línea en el historial y ofrecen «Deshacer», el mismo camino de siempre
// (app/crm/campo-inline.ts para los de `guardarCampoLeadAction`; `saveLeadMetaAction` para el contacto).
// =============================================================================

import { useState, useTransition, type ReactNode } from 'react';
import { deshacerContactoLeadAction, saveLeadMetaAction } from '@/app/crm/actions';
import type { CampoContacto } from '@/app/crm/campo-inline';
import { Toast, useToast } from '@/app/_ui/Toast';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { useRefrescarFicha } from '../../ficha-cambio';
import { CajaCampo } from '../../CampoEditable';
import { CSS_RESUMEN } from './estilo';

/** La hoja de los bloques, una vez (React 19 deduplica por `href`). */
export function EstiloResumen() {
  return <style href="fr-resumen" precedence="medium">{CSS_RESUMEN}</style>;
}

/**
 * LA TARJETA de un bloque (la de HubSpot): su título chico y, a la derecha, lo suyo (un link, un botón). Es un
 * <section> directo del cuerpo del bloque, así le llegan la densidad y el tema de la ficha (../ficha-css.ts).
 */
export function Bloque({ titulo, epico, derecha, marca, children, tono }: {
  titulo: string;
  epico: boolean;
  derecha?: ReactNode;
  /** El `data-recorrido` de «Solucionar» cuando el bloque entero es el campo. */
  marca?: string;
  /** Un bloque con su propio color (el «Va bien», un aviso): la densidad y el tema no lo pisan (`fb-propio`). */
  tono?: 'warn' | 'info' | 'good';
  children: ReactNode;
}) {
  return (
    <section className={['fr', epico && 'fr--epico', tono && 'fb-propio fr--tono'].filter(Boolean).join(' ')} data-tono={tono} data-recorrido={marca}>
      <EstiloResumen />
      <div className="fr-cab">
        <span className="fr-tit">{titulo}</span>
        {derecha != null && <span className="fr-cab-fin">{derecha}</span>}
      </div>
      {children}
    </section>
  );
}

/**
 * UNA FILA DE PROPIEDAD (los «Record details» de Attio): el rótulo, el valor y sus botones. Con `editable`, la fila
 * entera abre el campo de adentro (`CajaCampo`: el punto 7 del 12/10/2026, «si le doy click a la tarjeta debería ya
 * saltarme el cuadro de texto»). `marca` es lo que busca «Solucionar».
 */
export function Prop({ k, children, acciones, editable = false, marca }: {
  k: string; children: ReactNode; acciones?: ReactNode; editable?: boolean; marca?: string;
}) {
  const fila = (
    <div className="fr-prop">
      <span className="fr-k">{k}</span>
      <span className="fr-v">{children}</span>
      <span className="fr-acc">{acciones}</span>
    </div>
  );
  return editable ? <CajaCampo marca={marca}>{fila}</CajaCampo> : <div data-recorrido={marca}>{fila}</div>;
}

/** El valor vacío de una fila: «—», tenue. */
export const Vacio = ({ texto = '—' }: { texto?: string }) => <span className="fr-v--vacio">{texto}</span>;

/** Copiar al portapapeles con el «Copiado» de un segundo, en el botón. */
export function useCopiar() {
  const [copiado, setCopiado] = useState('');
  const copiar = (texto: string, clave: string) => {
    void navigator.clipboard?.writeText(texto).then(() => { setCopiado(clave); setTimeout(() => setCopiado(''), 1200); }).catch(() => {});
  };
  return { copiado, copiar };
}

/** Un botón cuadrado de una fila (copiar, abrir, escribir). */
export function BotonIco({ titulo, onClick, href, children, wa }: { titulo: string; onClick?: () => void; href?: string | null; children: ReactNode; wa?: boolean }) {
  const cls = wa ? 'fr-ico fr-ico--wa' : 'fr-ico';
  if (href) return <a className={cls} href={href} target="_blank" rel="noopener noreferrer" title={titulo} aria-label={titulo}>{children}</a>;
  return <button type="button" className={cls} onClick={onClick} title={titulo} aria-label={titulo}>{children}</button>;
}

export const IcoCopiar = () => <IconoMenu nombre="copiar" size={15} />;
export const IcoAbrir = () => <IconoMenu nombre="link" size={15} />;
export const IcoEmail = () => <IconoMenu nombre="email" size={15} />;

/** Los íconos de las redes (no están en el set de la casa: son marcas). Trazo fino, `currentColor`. */
export function IcoRed({ red, size = 15 }: { red: 'web' | 'instagram' | 'youtube' | 'linkedin'; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (red) {
    case 'instagram': return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" /></svg>;
    case 'youtube': return <svg {...p}><rect x="2.5" y="5.5" width="19" height="13" rx="4" /><path d="m10 9.5 5 2.5-5 2.5z" fill="currentColor" /></svg>;
    case 'linkedin': return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 10.5V16M8 7.8v.2M12 16v-3.2a2.3 2.3 0 0 1 4.6 0V16M12 10.5V16" /></svg>;
    default: return <IconoMenu nombre="web" size={size} />;
  }
}

/** Los datos de contacto que se guardan por `saveLeadMetaAction` (los mismos de la tarjeta de siempre). */
export type CampoMeta = CampoContacto;

/**
 * GUARDAR UN DATO DE CONTACTO EN EL LUGAR, con «Deshacer» que escribe en el SERVER (revertir sólo la pantalla sería
 * mentir hasta el próximo F5). Es el `guardar` de InfoPrincipalCard, el de siempre: `saveLeadMetaAction` deja la
 * línea en el historial (`logLeadChanges`) y el historial lo sabe revertir.
 * ⚠️ El Deshacer NO PISA A OTRO (16/10/2026): manda lo que se escribió y el server no deshace si el dato ya dice otra
 * cosa (`deshacerContactoLeadAction`, app/crm/actions.ts).
 */
export function useGuardarMeta(leadId: number) {
  const refrescar = useRefrescarFicha();
  const { toast, show, clear } = useToast();
  const [, start] = useTransition();
  const guardar = (campo: CampoMeta, antes: string | null) => (v: string) => {
    const nuevo = v.trim() || null;
    if (nuevo === (antes?.trim() || null)) return;
    start(async () => {
      try {
        await saveLeadMetaAction(leadId, { [campo]: nuevo });
        refrescar();
        show('Guardado', () => {
          start(async () => {
            try {
              const r = await deshacerContactoLeadAction(leadId, campo, antes, nuevo);
              refrescar();
              if (!r.ok) show(r.error, undefined, 'bad');
            } catch { show('No se pudo deshacer', undefined, 'bad'); }
          });
        });
      } catch (e) {
        show(e instanceof Error ? e.message : 'No se pudo guardar', undefined, 'bad');
      }
    });
  };
  return { guardar, aviso: <Toast state={toast} onClose={clear} /> };
}
