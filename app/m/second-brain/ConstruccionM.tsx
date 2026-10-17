'use client';

// =============================================================================
// ConstruccionM — la construcción de MaKo en el teléfono (sólo el super admin, 17/10/2026)
// =============================================================================
// La segunda capa del Second Brain (lib/cerebro-construccion.ts), destilada como el resto del teléfono: el mapa chico va
// en la isla oscura de SecondBrainM (como el del negocio), y acá «Lo último» (los hitos más recientes) y las familias con sus áreas. Tocar un área, un hito o un chat
// abre UNA hoja con lo mismo que la barra lateral de la computadora (el tipo, quién, los datos, las conexiones agrupadas
// por familia) y «Abrir en su bitácora». Navega adentro: una conexión abre la suya.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { ButtonLink } from '@/app/_ui/Button';
import type { Cerebro, NodoCerebro } from '@/lib/cerebro-modelo';
import { AUTORIA_TEXTO, TAXONOMIA_NEGOCIO } from '@/lib/cerebro-modelo';
import { AUTORIA_CORTA, agruparConexiones, fechaCortaNodo, rellenoNodo, tipoDeNodo, ultimosDelCerebro } from '@/lib/cerebro-areas';
import { FilaDatoM, FilaM, ListaM, PieM, SeccionM, SheetM, VacioM } from '@/app/m/_ui';
import { conexionesDe } from './modelo';
import { Punto } from './SecondBrainM';

type Nodo = NodoCerebro<string>;

export function ConstruccionM({ cerebro }: { cerebro: Cerebro<string> }) {
  const tax = cerebro.taxonomia ?? TAXONOMIA_NEGOCIO;
  const [abierto, setAbierto] = useState<string | null>(null);
  const porId = useMemo(() => new Map(cerebro.nodos.map((n) => [n.id, n])), [cerebro.nodos]);
  const ultimos = useMemo(() => ultimosDelCerebro(cerebro.nodos.filter((n) => n.id.startsWith('hito:')), 6), [cerebro.nodos]);
  const areaDe = (id: string) => tax.areas.find((a) => a.id === id);

  // La hoja guarda su última vista mientras se cierra (la misma regla de SecondBrainM).
  const ultimo = useRef<string | null>(null);
  if (abierto) ultimo.current = abierto;
  const nodo = (abierto ?? ultimo.current) ? porId.get((abierto ?? ultimo.current)!) ?? null : null;
  const cuerpo = useRef<HTMLDivElement>(null);
  useEffect(() => { cuerpo.current?.closest('.m-sheet__cuerpo')?.scrollTo({ top: 0 }); }, [abierto]);

  const fila = (n: Nodo, segunda?: string) => (
    <FilaM key={n.id} leading={<Punto color={rellenoNodo(n, tax)} />} titulo={n.etiqueta}
      segunda={segunda ?? tipoDeNodo(n)} onClick={() => setAbierto(n.id)} />
  );

  return (
    <>
      {ultimos.length > 0 && (
        <SeccionM titulo="Lo último">
          <ListaM etiqueta="Lo último">{ultimos.map((n) => fila(n, `${fechaCortaNodo(n.nace) ?? ''} · ${areaDe(n.area)?.nombre ?? ''}`))}</ListaM>
        </SeccionM>
      )}

      {tax.areas.map((a) => {
        const suyas = cerebro.nodos.filter((n) => n.area === a.id && n.id.startsWith('dev:'));
        if (!suyas.length) return null;
        return (
          <SeccionM key={a.id} titulo={a.nombre}>
            <ListaM etiqueta={a.nombre}>{suyas.map((n) => fila(n, (n.datos ?? []).find((d) => d.k === 'Estado')?.v))}</ListaM>
          </SeccionM>
        );
      })}

      <SheetM id="construccion" abierto={abierto != null} onCerrar={() => setAbierto(null)} titulo={nodo?.etiqueta ?? ''} snap="alto"
        pie={nodo?.href ? <PieM><ButtonLink href={nodo.href} variant="primary" size="lg" full>{`Abrir en ${nodo.abrirEn ?? 'su pantalla'}`}</ButtonLink></PieM> : undefined}>
        <div ref={cuerpo}>
          {nodo ? <HojaNodo cerebro={cerebro} nodo={nodo} onNodo={setAbierto} /> : <VacioM frase="Esto ya no está en el grafo." />}
        </div>
      </SheetM>
    </>
  );
}

/** Un nodo de la construcción: lo mismo que la barra lateral de la computadora, en filas. */
function HojaNodo({ cerebro, nodo: n, onNodo }: { cerebro: Cerebro<string>; nodo: Nodo; onNodo: (id: string) => void }) {
  const tax = cerebro.taxonomia ?? TAXONOMIA_NEGOCIO;
  const [entero, setEntero] = useState(false);
  const conexiones = useMemo(() => conexionesDe(cerebro, n.id), [cerebro, n.id]);
  const grupos = useMemo(() => agruparConexiones(conexiones, null, tax), [conexiones, tax]);
  const datos = (n.datos ?? []).filter((d) => d.v && d.v.trim());
  const nace = fechaCortaNodo(n.nace);
  return (
    <>
      <p className="m-second-brain-tipo">{tipoDeNodo(n)}</p>
      <div className="m-second-brain-pastillas">
        <span className="m-second-brain-pastilla" data-autoria={n.autoria} title={AUTORIA_TEXTO[n.autoria]}>{AUTORIA_CORTA[n.autoria]}</span>
        {nace && <span className="m-second-brain-pastilla">{nace}</span>}
      </div>
      {n.detalle && <p className="m-second-brain-detalle">{n.detalle}</p>}
      {datos.length > 0 && <ListaM etiqueta="Datos">{datos.map((d, i) => <FilaDatoM key={`${d.k}-${i}`} k={d.k} v={d.v} />)}</ListaM>}
      {n.cuerpo && (entero
        ? <p className="m-second-brain-cuerpo">{n.cuerpo}</p>
        : <button type="button" className="m-second-brain-leer" onClick={() => setEntero(true)}><span>Leer todo</span></button>)}
      {grupos.map((g) => (
        <div key={g.area} className="m-second-brain-grupo">
          <p className="m-second-brain-grupo__nombre">{tax.areas.find((a) => a.id === g.area)?.nombre ?? g.area}</p>
          <ListaM etiqueta={tax.areas.find((a) => a.id === g.area)?.nombre ?? g.area}>
            {g.items.map((c) => (
              <FilaM key={c.nodo.id} leading={<Punto color={rellenoNodo(c.nodo, tax)} />} titulo={c.nodo.etiqueta}
                segunda={c.motivo || undefined} onClick={() => onNodo(c.nodo.id)} />
            ))}
          </ListaM>
        </div>
      ))}
    </>
  );
}
