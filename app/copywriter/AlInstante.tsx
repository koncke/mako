'use client';

// =============================================================================
// AlInstante — en Copywriting, todo lo que se toca cambia la pantalla en el MISMO clic (14/11/2026)
// =============================================================================
// Martín, 14/11/2026: «Debería abrirme automáticamente y de última ponerle el loader de MaKo, pero no que yo le clique y que
// no haga nada». Lo que esperaba al server antes de cambiar de pantalla (medido en producción, ws 9):
//   · abrir un guion: 1,06 s con la pantalla quieta (la ruta no tiene loading.tsx: el shell de Create mide la <Pagina>, y
//     un loading.tsx con la puerta adentro es el ticket #7);
//   · «Replicar» y una plantilla: primero CREAN la página (~1,2 s) y recién después navegan; lo único que cambiaba era el
//     rótulo del botón («Armando…»), chico y debajo del mouse.
// Ahora el clic pone la capa con EL loader de la casa (la criatura y la barra, app/_ui/CargandoMako.tsx) encima de la pantalla
// y el trabajo sigue detrás. La capa se va sola cuando llega otra pantalla (otra ruta o query); si lo de detrás falla, la
// quita quien la puso (`soltar`) y dice el error con «Reportar a Soporte».
//
// Dos maneras de ponerla:
//   · `empezar(que)` en el clic, ANTES del primer `await` (Replicar, una plantilla, crear, abrir desde una miga);
//   · `links: true`: un clic en un <a> que lleva a otra pantalla de Copywriting (la lista de páginas, «Mis guiones», el
//     «‹ Guiones» del teléfono). Se escucha en la fase de captura del documento: el Link de Next no avisa que empezó.
//     UNA pantalla por ruta lo pide (Copywriter en escritorio; en el teléfono, la portada, la lista o el guion).
// tests/copywriter-abre-al-instante.test.ts cae si un clic vuelve a esperar al server antes de mostrarla.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { CargandoMako } from '@/app/_ui/CargandoMako';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { abreOtraPantallaDeCopy, MS_TARDA } from './al-instante';

export type AlInstante = {
  /** Qué se está abriendo («la página nueva»), para el lector de pantalla; `null` sin capa. */
  abriendo: string | null;
  /** La capa, ya. Va en el clic, antes de esperar nada. */
  empezar: (que: string) => void;
  /** Lo de detrás falló: la capa se va y queda la pantalla de antes (con su aviso). */
  soltar: () => void;
};

export function useAlInstante({ links = false, alEmpezar }: {
  /** Vigilar los <a> que llevan a otra pantalla de Copywriting (una sola pantalla por ruta). */
  links?: boolean;
  /** Lo que conviene adelantar mientras el server trabaja (Copywriter: el código del editor). */
  alEmpezar?: () => void;
} = {}): AlInstante {
  // Dónde se puso la capa: en cuanto la ruta o la query cambian, ya llegó otra pantalla y la capa no se dibuja más.
  const aqui = `${usePathname() ?? ''}?${useSearchParams()?.toString() ?? ''}`;
  const [capa, setCapa] = useState<{ que: string; donde: string } | null>(null);

  const empezar = useCallback((que: string) => {
    setCapa({ que, donde: aqui });
    alEmpezar?.();
  }, [aqui, alEmpezar]);
  const soltar = useCallback(() => setCapa(null), []);

  useEffect(() => {
    if (!links) return;
    const alClic = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      if (abreOtraPantallaDeCopy(a.href, window.location.href)) empezar('la página');
    };
    document.addEventListener('click', alClic, true);
    return () => document.removeEventListener('click', alClic, true);
  }, [links, empezar]);

  return { abriendo: capa && capa.donde === aqui ? capa.que : null, empezar, soltar };
}

/**
 * La capa: tapa en el acto (el fondo) y a los 150 ms aparecen la criatura y la barra (una carga más corta no parpadea).
 * `fija`: en el teléfono la pantalla scrollea el documento, así que tapa la ventana; en escritorio tapa el centro de Create
 * (`.cr-centro`, que es su caja), con la lista o el chat a la vista.
 */
export function CapaAbriendo({ que, fija = false, onSoltar }: { que: string | null; fija?: boolean; onSoltar: () => void }) {
  return que ? <Capa key={que} que={que} fija={fija} onSoltar={onSoltar} /> : null;
}

function Capa({ que, fija, onSoltar }: { que: string; fija: boolean; onSoltar: () => void }) {
  const [tarda, setTarda] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTarda(true), MS_TARDA);
    return () => clearTimeout(t);
  }, []);
  return (
    <div data-abriendo="" style={{
      position: fija ? 'fixed' : 'absolute', inset: 0, zIndex: fija ? 60 : 20, background: 'var(--bg, var(--surface))',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16,
    }}>
      <CargandoMako que={que} alto="auto" style={{ flex: 'none' }} />
      {tarda && (
        <p role="alert" style={{ margin: 0, maxWidth: 420, textAlign: 'center', fontSize: 14, color: 'var(--dim)' }}>
          Está tardando más de lo normal.{' '}
          <button type="button" onClick={onSoltar} style={{ border: 0, background: 'none', padding: 0, color: 'var(--accent)', font: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}>Volver</button>
          <ReportarASoporte />
        </p>
      )}
    </div>
  );
}
