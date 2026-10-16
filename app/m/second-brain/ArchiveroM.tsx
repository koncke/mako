'use client';

// =============================================================================
// ArchiveroM — subirle algo al Archivero desde el teléfono (un archivo, una foto o una web)
// =============================================================================
// La captura de Notion y de Obsidian en el teléfono (el «+» de arriba): se elige, se toca un botón y
// MaKo lo lee. Es El Archivero de escritorio (app/onboarding/Archivero.tsx: «Elegir archivos», el link
// de la web y «✦ Analizar 1 documento») por las MISMAS rutas (lib/archivero-subida.ts). En el teléfono
// el selector de archivos ya ofrece la cámara y las fotos (`image/*`).
//
// Lo que se queda en la computadora: las preguntas de lo que falta, borrar un documento y la carga a mano.
//
// ⚠️ Leer tarda (el server baja, extrae con IA y rearma el resumen; maxDuration 300): la hoja va
//    `ocupado` y no se cierra por un roce. Lo que no se pudo leer QUEDA en la hoja con su aviso; lo
//    que sí, ya está en el mapa.
// ⚠️ El refresco va DESPUÉS de cerrar (400 ms): cerrar por código hace `replaceState`, y un refresh
//    pedido en el mismo tick puede quedar descartado (hallazgos-mobile, SheetM y Tu cuenta).
// =============================================================================

import { useRef, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';
import { Icon } from '@/app/_components/icons';
import {
  ACEPTA_ARCHIVERO, leerWebEnArchivero, leido, normalizarUrlArchivero, rotuloAnalizar, subirAlArchivero,
} from '@/lib/archivero-subida';
import { FilaM, ListaM, PieM, SheetM, useToastM } from '@/app/m/_ui';
import { R, pesoArchivo } from './modelo';

const clave = (f: File) => `${f.name}:${f.size}`;
const dominio = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

export function ArchiveroM({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const router = useRouter();
  const toast = useToastM();
  const input = useRef<HTMLInputElement>(null);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [web, setWeb] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [avisos, setAvisos] = useState<string[]>([]);

  const url = web.trim() ? normalizarUrlArchivero(web) : null;
  const webs = url ? 1 : 0;
  const hay = archivos.length + webs > 0;

  const sumar = (fl: FileList | null) => {
    const nuevos = fl ? Array.from(fl) : [];
    if (!nuevos.length) return;
    setArchivos((prev) => {
      const m = new Map(prev.map((f) => [clave(f), f]));
      for (const f of nuevos) m.set(clave(f), f);
      return [...m.values()];
    });
    setAvisos([]);
  };
  const quitar = (k: string) => setArchivos((prev) => prev.filter((f) => clave(f) !== k));

  const analizar = async () => {
    if (enviando) return;
    if (web.trim() && !url) { setAvisos(['Ese link no parece válido. Revísalo (ej: tunegocio.com).']); return; }
    if (!hay) return;
    setEnviando(true);
    setAvisos([]);
    const fallaron: File[] = [];
    const avs: string[] = [];
    let alguno = false;
    let webFallo = false;
    try {
      for (let i = 0; i < archivos.length; i++) {
        const f = archivos[i];
        // `finalizar` en el último de la tanda, como en escritorio.
        const finalizar = !url && i === archivos.length - 1;
        try {
          const j = await subirAlArchivero(f, finalizar);
          if (Array.isArray(j.warnings)) avs.push(...j.warnings);
          if (leido(j)) alguno = true;
          else { fallaron.push(f); if (j.error) avs.push(j.error); }
        } catch (e) {
          fallaron.push(f);
          avs.push(e instanceof Error ? e.message : String(e));
        }
      }
      if (url) {
        const j = await leerWebEnArchivero(url, true).catch(() => null);
        if (j && Array.isArray(j.warnings)) avs.push(...j.warnings);
        if (leido(j)) alguno = true;
        else { webFallo = true; avs.push(j?.error || `No pude leer la web "${dominio(url)}".`); }
      }
    } finally {
      setEnviando(false);
    }

    if (!fallaron.length && !webFallo) {
      setArchivos([]);
      setWeb('');
      onCerrar();
      toast('Sumado a tu mapa');
      window.setTimeout(() => router.refresh(), 400);
      return;
    }
    // Lo que no se pudo leer queda en la hoja, con su aviso; lo que sí, ya está en el mapa.
    setArchivos(fallaron);
    if (!webFallo) setWeb('');
    setAvisos([...new Set(avs)]);
    if (alguno) router.refresh();
  };

  const objeto = hay ? rotuloAnalizar(archivos.length, webs) : 'un documento';

  return (
    <SheetM
      id="archivero"
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="El Archivero"
      snap="alto"
      ocupado={enviando}
      rotuloCerrar="Cerrar El Archivero"
      pie={(
        <PieM consecuencia={enviando ? 'Leyendo. Puede tardar un minuto.' : hay ? 'MaKo lo lee y lo suma a tu mapa.' : undefined}>
          <Button variant="mako" size="lg" full loading={enviando} disabled={!hay || enviando} onClick={() => void analizar()}>
            {`${R.analizar} ${objeto}`}
          </Button>
        </PieM>
      )}
    >
      <input
        ref={input}
        type="file"
        multiple
        accept={ACEPTA_ARCHIVERO}
        hidden
        onChange={(e) => { sumar(e.target.files); e.target.value = ''; }}
      />
      <ListaM etiqueta="Qué subes">
        <FilaM
          icono="notepencil"
          titulo={R.elegirArchivos}
          navegacion
          chevron={false}
          deshabilitada={enviando}
          onClick={() => input.current?.click()}
        />
        {archivos.map((f) => (
          <FilaM
            key={clave(f)}
            icono="contexto"
            titulo={f.name}
            segunda={pesoArchivo(f.size)}
            control={(
              <button type="button" className="m-second-brain-quitar" aria-label={`Quitar ${f.name}`} disabled={enviando} onClick={() => quitar(clave(f))}>
                <Icon name="x" size={18} />
              </button>
            )}
          />
        ))}
      </ListaM>

      <label className="m-second-brain-web">
        <span className="m-second-brain-web__ico" aria-hidden><Icon name="web" size={18} /></span>
        <input
          type="url"
          inputMode="url"
          autoComplete="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={web}
          disabled={enviando}
          onChange={(e) => { setWeb(e.target.value); setAvisos([]); }}
          placeholder="O pega el link de tu web"
          aria-label="El link de tu web, landing o Instagram"
        />
      </label>

      {avisos.length > 0 && (
        <ul className="m-second-brain-avisos" role="alert">
          {avisos.map((a) => <li key={a}>{a}</li>)}
        </ul>
      )}
    </SheetM>
  );
}
