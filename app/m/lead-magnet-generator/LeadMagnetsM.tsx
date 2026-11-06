'use client';

// =============================================================================
// Lead Magnet en el teléfono: la lista, «Nuevo» con las plantillas y el detalle de un lead magnet (5/11/2026)
// =============================================================================
// Las mismas reglas que escritorio (app/lead-magnet-generator/reglas.ts) y la misma ruta (/api/lead-magnet-generator): lo
// único propio es el dibujo, con las piezas de app/m/_ui (el molde: app/m/copywriter/ListaGuionesM.tsx).
// =============================================================================

import { useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';
import { FilaDatoM, FilaM, ListaM, PieFijoM, SeccionM, SheetM, VacioM, useToastM } from '@/app/m/_ui';
import { PLANTILLAS_LEAD_MAGNET } from '@/lib/lead-magnets/plantillas';
import { rutaDePagina, rutaDePieza } from '@/lib/lead-magnets/pieza';
import { RUTA_TAB, estadoDe, rutaDeLeadMagnet, type LeadMagnetVista } from '@/app/lead-magnet-generator/reglas';
import { pedirLeadMagnet } from '@/app/lead-magnet-generator/cliente';

export function LeadMagnetsM({ lista, abierto }: { lista: LeadMagnetVista[]; abierto: LeadMagnetVista | null }) {
  const router = useRouter();
  const toast = useToastM();
  const [hoja, setHoja] = useState(false);
  const [haciendo, setHaciendo] = useState<string | null>(null);

  const armar = async (plantilla: string) => {
    if (haciendo) return;
    setHaciendo('armar');
    const r = await pedirLeadMagnet<{ ruta: string; aviso: string | null }>({ accion: 'armar', plantilla });
    setHaciendo(null);
    if (!r.ok) { toast(r.error); return; }
    if (r.aviso) toast(r.aviso);
    router.push(r.ruta);
  };

  const hacer = async (accion: string, confirmar?: string) => {
    if (!abierto || haciendo) return;
    if (confirmar && !window.confirm(confirmar)) return;
    setHaciendo(accion);
    const r = await pedirLeadMagnet<{ aviso?: string | null }>({ accion, id: abierto.id });
    setHaciendo(null);
    if (!r.ok) { toast(r.error); return; }
    if (r.aviso) toast(r.aviso);
    if (accion === 'quitar') { router.push(RUTA_TAB); return; }
    router.refresh();
  };

  if (abierto) {
    const e = estadoDe(abierto);
    const esWeb = abierto.pieza?.herramienta === 'web';
    const esPrimero = lista[0]?.id === abierto.id;
    return (
      <>
        <SeccionM titulo={abierto.nombre}>
          <ListaM>
            {abierto.pieza
              ? <FilaDatoM k="La pieza" v={`Abrir en ${e.herramienta}`} href={rutaDePieza(abierto.pieza)} azul />
              : <FilaDatoM k="La pieza" v="Sólo su descripción" />}
            {abierto.enlace
              ? <FilaDatoM k="Su link" v="Ver lo que recibe" href={abierto.enlace} azul />
              : esWeb
                ? abierto.piezaUrl
                  ? <FilaDatoM k="Su link" v={haciendo === 'compartir' ? 'Guardando…' : 'Usar su link'} onClick={() => void hacer('compartir')} azul />
                  : <FilaDatoM k="Su link" v="Publícala primero" />
                : e.puedeCompartir
                  ? <FilaDatoM k="Su link" v={haciendo === 'compartir' ? 'Creando…' : 'Crear link'} onClick={() => void hacer('compartir')} azul />
                  : <FilaDatoM k="Su link" v="Pégalo en la computadora" />}
            {e.puedeCaptar && (abierto.pagina
              ? <FilaDatoM k="Su página" v={abierto.paginaPublicada === false ? 'Sin publicar' : 'Abrir'} href={rutaDePagina(abierto.pagina)} azul />
              : abierto.enlace
                ? <FilaDatoM k="Su página" v={haciendo === 'captar' ? 'Creando…' : 'Crear su página'} onClick={() => void hacer('captar')} azul />
                : <FilaDatoM k="Su página" v="Primero su link" />)}
            {esPrimero && abierto.enlace
              ? <FilaDatoM k="Cómo le llega" v="Es el primero" />
              : e.puedePrimero
                ? <FilaDatoM k="Cómo le llega" v={haciendo === 'primero' ? 'Guardando…' : 'Ponerlo primero'} onClick={() => void hacer('primero')} azul />
                : <FilaDatoM k="Cómo le llega" v="Primero su link" />}
          </ListaM>
        </SeccionM>
        {e.falta ? <VacioM frase={e.falta} /> : null}
        <SeccionM titulo="Más">
          <ListaM>
            {(abierto.compartidos ?? 0) > 0 && (
              <FilaM icono="trash" titulo={haciendo === 'dejar' ? 'Dejando de compartir…' : 'Dejar de compartir'} onClick={() => void hacer('dejar', 'Su link deja de abrirse, también para quien ya lo recibió. ¿Seguro?')} deshabilitada={!!haciendo} />
            )}
            <FilaM icono="x" titulo={haciendo === 'quitar' ? 'Quitando…' : 'Quitar de la lista'}
              onClick={() => void hacer('quitar', `¿Quitar «${abierto.nombre}» de tus lead magnets? Su página sigue donde está, y su link público deja de abrirse.`)} deshabilitada={!!haciendo} />
          </ListaM>
        </SeccionM>
        <PieFijoM>
          <Button variant="secondary" size="lg" full onClick={() => router.push(RUTA_TAB)}>Ver todos</Button>
        </PieFijoM>
      </>
    );
  }

  return (
    <>
      {lista.length === 0
        ? <VacioM frase="Todavía no hay lead magnets." accion={{ rotulo: 'Nuevo', onClick: () => setHoja(true) }} />
        : (
          <SeccionM titulo="Tus lead magnets">
            <ListaM>
              {lista.map((lm) => (
                <FilaM key={lm.id} icono="leadmagnet" titulo={lm.nombre} segunda={estadoDe(lm).falta ?? 'Listo para captar'} href={rutaDeLeadMagnet(lm.id)} />
              ))}
            </ListaM>
          </SeccionM>
        )}
      <PieFijoM>
        <Button variant="primary" size="lg" full onClick={() => setHoja(true)} disabled={!!haciendo}>Nuevo</Button>
      </PieFijoM>
      <SheetM abierto={hoja} onCerrar={() => setHoja(false)} titulo="¿Qué vas a crear hoy?">
        <ListaM>
          {PLANTILLAS_LEAD_MAGNET.map((pl) => (
            <FilaM key={pl.id} icono="leadmagnet" titulo={`${pl.emoji} ${pl.nombre}`} segunda={pl.ayuda}
              onClick={() => { setHoja(false); void armar(pl.id); }} deshabilitada={!!haciendo} />
          ))}
        </ListaM>
      </SheetM>
    </>
  );
}
