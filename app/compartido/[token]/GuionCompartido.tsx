'use client';

// =============================================================================
// GuionCompartido — un guion del Copywriter abierto con un link para EDITAR, sin cuenta (docs/diseno-copywriter.md, D9)
// =============================================================================
// «Tu cliente entra y edita lo que le presentás» (Martín a Teo, 28/10/2026). Es el MISMO editor de la tab
// (app/copywriter/editor/EditorGuion.tsx) en modo `compartido`: sin el árbol, sin MaKo, sin la Papelera y con las
// propiedades a la vista pero sin cambiar. Lo carga ./GuionCompartidoPerezoso.tsx en su propio chunk.
//
// ⚠️ CADA GUARDADO VA A /api/compartido/guion CON EL TOKEN DEL LINK, nunca a /api/copywriter: quien abre el link puede
//    tener SU sesión de MaKo abierta, y un guardado con esa sesión escribiría en SU negocio (es la razón de `soloLectura`
//    en ./InformeCompartido.tsx). El guardar se le PASA al editor; el de la tab no se usa acá.
//
// La marca de quién editó: con un link personal de invitado, su nombre; con el link abierto, el que la persona escriba
// arriba (se recuerda en este navegador). Sin nombre se guarda igual, como «alguien con el link».

import '@/app/copywriter/notion.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Toast, useToast } from '@/app/_ui';
import { EditorGuion } from '@/app/copywriter/editor/EditorGuion';
import { pedirGuardarCompartido, pedirTituloCompartido, type CambioGuion } from '@/app/copywriter/cliente';
import { TOPE_NOMBRE_VISITA } from '@/lib/copywriter/editado';
import type { GuionAbierto } from '@/lib/copywriter/tipos';
import type { CatalogosCopy } from '@/lib/copywriter/catalogos';

/** El nombre de quien entra con el link, recordado en este navegador (un `localStorage` que puede no estar). */
const CLAVE_NOMBRE = 'mako.compartido.nombre';
const ANGOSTO = '(max-width: 760px)';

export default function GuionCompartido({ token, guion, catalogos, invitado }: {
  token: string;
  guion: GuionAbierto;
  catalogos: CatalogosCopy;
  /** El nombre (o el email) del invitado, si entró con su link personal; null con el link abierto. */
  invitado: string | null;
}) {
  const { toast, show, clear } = useToast();
  const [nombre, setNombre] = useState('');
  const nombreRef = useRef('');
  nombreRef.current = nombre;
  const [movil, setMovil] = useState(false);

  useEffect(() => {
    try { setNombre(localStorage.getItem(CLAVE_NOMBRE) ?? ''); } catch { /* sin almacenamiento: se pide de nuevo */ }
    const mq = window.matchMedia(ANGOSTO);
    const cambio = () => setMovil(mq.matches);
    cambio();
    mq.addEventListener('change', cambio);
    return () => mq.removeEventListener('change', cambio);
  }, []);

  const cambiarNombre = (v: string) => {
    setNombre(v);
    try { localStorage.setItem(CLAVE_NOMBRE, v); } catch { /* ídem */ }
  };

  const guardar = useCallback(
    (c: CambioGuion, keepalive: boolean) => pedirGuardarCompartido(token, nombreRef.current, c, keepalive),
    [token],
  );
  const alTitulo = useCallback(async (t: string) => {
    const r = await pedirTituloCompartido(token, nombreRef.current, t);
    if (!r.ok) show(`No se pudo guardar el título: ${r.error}`, undefined, 'bad');
  }, [token, show]);
  const nada = useCallback(() => {}, []);

  return (
    <div className="nt nt-compartido" data-movil={movil ? '' : undefined}>
      <header className="nt-compartido-barra">
        <span className="nt-compartido-que">Guion compartido: puedes editarlo</span>
        {invitado ? (
          <span className="nt-compartido-quien">Editas como {invitado}</span>
        ) : (
          <label className="nt-compartido-nombre">
            <span>Tu nombre</span>
            <input value={nombre} onChange={(e) => cambiarNombre(e.target.value)} maxLength={TOPE_NOMBRE_VISITA}
              placeholder="Para que sepan quién editó" autoComplete="name" />
          </label>
        )}
      </header>
      <EditorGuion
        guion={guion}
        paginas={[guion.pagina]}
        catalogos={catalogos}
        movil={movil}
        compartido={{ guardar }}
        onPaginaEnVivo={nada}
        onTitulo={(t) => void alTitulo(t)}
        onEmoji={nada}
        onAbrir={nada}
        onPapelera={nada}
        onMako={nada}
        avisar={(t) => show(t)}
      />
      <Toast state={toast} onClose={clear} />
    </div>
  );
}
