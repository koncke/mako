'use client';

// =============================================================================
// Los archivos de un mensaje del chat con MaKo: la miniatura de una foto, la ficha de un PDF (16/10/2026)
// =============================================================================
// Etapa 2 de docs/diseno-mako-ai-native.md, tanda 4. Copiado de los adjuntos de Claude web: la foto en miniatura
// arriba de la burbuja, el PDF como una ficha con su nombre; un clic lo abre entero en otra pestaña. Debajo del PDF
// del admin, lo que pasó en El Archivero (como el chip del chat de Offer).
//
// ⚠️ UN `<img src>` NO PASA POR EL `fetch` DE LA CASA (app/_components/WsFetch.tsx): el `?ws=` va a mano, con `conWs`.
//    Sin él, el super admin mirando un cliente pediría el archivo en SU workspace y no lo encontraría.

import { useState } from 'react';
import { useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';
import { IconoChat } from '@/app/m/mako/iconos';
import { rutaDeArchivo, type ArchivoHilo } from '@/app/m/mako/chat-ui';
import './chat.css';

function notaDelArchivero(a: ArchivoHilo): string | null {
  if (a.archivero?.estado === 'guardado') return a.archivero.aviso ?? 'En El Archivero';
  if (a.archivero?.estado === 'fallo') return `No quedó en El Archivero: ${a.archivero.motivo}`;
  return null;
}

/** Una foto: la miniatura; si no carga (se borró, venció), su ficha. */
function Foto({ a, href }: { a: ArchivoHilo; href: string }) {
  const [fallo, setFallo] = useState(false);
  if (fallo) return <Ficha a={a} href={null} />;
  return (
    <a className="ch-archivo__foto" href={href} target="_blank" rel="noopener noreferrer" title={a.nombre}>
      {/* eslint-disable-next-line @next/next/no-img-element -- un archivo privado detrás de un link firmado */}
      <img src={href} alt={a.nombre} loading="lazy" onError={() => setFallo(true)} />
    </a>
  );
}

/** Un PDF (o una foto que no cargó): su nombre y, si es del admin, lo que pasó en El Archivero. */
function Ficha({ a, href }: { a: ArchivoHilo; href: string | null }) {
  const nota = notaDelArchivero(a);
  const cuerpo = (
    <>
      <IconoChat nombre={a.tipo === 'image' ? 'foto' : 'archivo'} size={20} />
      <span className="ch-archivo__texto">
        <span className="ch-archivo__nombre">{a.nombre}</span>
        {(nota || !href) && <span className="ch-archivo__nota">{href ? nota : 'No pude abrir el archivo.'}</span>}
      </span>
    </>
  );
  return href
    ? <a className="ch-archivo__ficha" href={href} target="_blank" rel="noopener noreferrer">{cuerpo}</a>
    : <span className="ch-archivo__ficha">{cuerpo}</span>;
}

export function ArchivosHilo({ archivos }: { archivos: readonly ArchivoHilo[] }) {
  const ws = useWs();
  if (!archivos.length) return null;
  return (
    <ul className="ch-archivos" aria-label="Archivos">
      {archivos.map((a, i) => {
        const href = a.local ?? (a.ref ? conWs(rutaDeArchivo(a.ref), ws) : null);
        return (
          <li key={`${a.ref ?? a.local ?? a.nombre}-${i}`} className="ch-archivo">
            {a.tipo === 'image' && href ? <Foto a={a} href={href} /> : <Ficha a={a} href={href} />}
          </li>
        );
      })}
    </ul>
  );
}
