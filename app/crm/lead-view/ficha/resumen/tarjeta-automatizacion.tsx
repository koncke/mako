'use client';

// =============================================================================
// ficha/resumen/tarjeta-automatizacion — LAS PIEZAS de la tarjeta «Automatizaciones» (24/10/2026, el rediseño)
// =============================================================================
// Puras: reciben la inscripción (`InscripcionVista`), lo que saben de la pantalla (`EntornoTarjeta`) y qué hacer al tocar.
// El bloque que las arma, lee y frena es ./automatizaciones.tsx; lo que dicen sale de app/crm/automatizacion-lead.ts (puro,
// con test). Aparte de las lecturas y las acciones del servidor a propósito: así se dibujan solas, con datos de ejemplo,
// para mirarlas (y sacarles la foto) sin levantar la app.
// =============================================================================

import type { ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { Icon } from '@/app/_components/icons';
import {
  diaCorto, estaViva, estadoDeTarjeta, fechaCorta, rielDeTarjeta,
  type EstadoTarjeta, type FormaSello, type InscripcionVista, type NodoRiel, type NoEntroVista,
} from '@/app/crm/automatizacion-lead';
import { ciudadDeZona } from '@/lib/por-que-no-sale';

/** Lo de adentro del sello: un glifo de la casa, o nada (el disco, el aro y el cuadro son la forma misma). */
export function Sello({ forma }: { forma: FormaSello }) {
  const glifo: ReactNode = forma === 'tilde' || forma === 'tilde-suave' ? <IconoMenu nombre="check" size={14} />
    : forma === 'persona' ? <IconoMenu nombre="persona" size={14} />
    : forma === 'pausa' ? <IconoMenu nombre="pausar" size={14} />
    : forma === 'reloj' ? <IconoMenu nombre="reloj" size={14} />
    : forma === 'alerta' || forma === 'alerta-llena' ? <span className="fr-aut-glifo">!</span>
    : null;
  return <span className="fr-aut-sello" data-forma={forma} aria-hidden>{glifo}</span>;
}

/** Lo que una tarjeta sabe de la pantalla: la zona del negocio, la hora, la zona de quien mira y lo que no entró. */
export type EntornoTarjeta = { tz: string; ahora: number; tzLocal: string | null; noEntro: readonly NoEntroVista[] };

/** Las horas de una tarjeta: corta en la zona del negocio, con la zona al pasar, y si quien mira está en otra. */
function horasDe(en: EntornoTarjeta) {
  const fecha = (iso: string) => fechaCorta(iso, en.tz, en.ahora);
  const conZona = (iso: string) => `${fecha(iso)} · hora de ${ciudadDeZona(en.tz)}`;
  const otraZona = (iso: string) => en.tzLocal != null && fechaCorta(iso, en.tzLocal, en.ahora) !== fecha(iso);
  const delEstado = (e: EstadoTarjeta) => (e.at ? (e.soloDia ? diaCorto(e.at, en.tz, en.ahora) : fecha(e.at)) : null);
  return { fecha, conZona, otraZona, delEstado };
}

/** Un renglón del riel: su marca, qué fue y cuándo (a la derecha), y la cita o el porqué. */
function NodoDelRiel({ n, en }: { n: NodoRiel; en: EntornoTarjeta }) {
  const { fecha, conZona, otraZona } = horasDe(en);
  return (
    <li className="fr-aut-nodo" data-tipo={n.tipo} data-apagado={n.apagado || undefined}>
      <span className="fr-aut-marca" aria-hidden />
      <div className="fr-aut-nodo-cab">
        <span className="fr-aut-nodo-tit">{n.titulo}</span>
        {n.at && (
          <time className="fr-aut-cuando" dateTime={n.at} title={conZona(n.at)}>
            {fecha(n.at)}{n.tipo === 'proximo' && otraZona(n.at) && <span className="fr-aut-zona"> · {ciudadDeZona(en.tz)}</span>}
          </time>
        )}
      </div>
      {n.cita && <p className="fr-aut-cita">{n.cita}</p>}
      {n.detalle && <p className="fr-aut-detalle">{n.detalle}</p>}
    </li>
  );
}

/**
 * UNA AUTOMATIZACIÓN, ABIERTA: el sello y el estado, el riel y el pie. Pura: lo que pasa al tocar lo decide la pantalla.
 * Exportada también para dibujarla sin servidor y sacarle la foto (la vista previa del rediseño, docs/hallazgos-crm.md).
 */
export function TarjetaAutomatizacion({ a, en, todo, verMenos, error, onAntes, onFrenar, onEmpezar, onPlegar }: {
  a: InscripcionVista; en: EntornoTarjeta;
  /** El riel entero (épico, «Línea de tiempo», o después de «Ver N antes»). */
  todo: boolean;
  /** «Ver menos» al final: se abrió con «Ver N antes». */
  verMenos: boolean;
  /** Lo que no salió al frenar o empezar de nuevo, en el pie de ESTA tarjeta. */
  error: string | null;
  onAntes: () => void; onFrenar: () => void; onEmpezar: () => void;
  /** Una terminada abierta se pliega desde su cabecera. */
  onPlegar?: () => void;
}) {
  const { conZona, delEstado } = horasDe(en);
  const e = estadoDeTarjeta(a);
  const riel = rielDeTarjeta(a, en.noEntro, { todo, ahoraMs: en.ahora });
  const frena = estaViva(a) && a.puede.frenar;
  const empieza = a.puede.empezarDeNuevo;
  const cuando = delEstado(e);
  return (
    <article className="fr-aut" data-tono={e.tono} data-automatizacion={a.secuenciaId}>
      <header className="fr-aut-cab">
        <Sello forma={e.forma} />
        <div className="fr-aut-titulos">
          <Link href={a.link} className="fr-aut-nombre">{a.nombre}</Link>
          <span className="fr-aut-estado" title={e.porque ?? undefined}>
            {e.texto}{cuando && <> · <time className="fr-aut-estado-cuando" dateTime={e.at!} title={conZona(e.at!)}>{cuando}</time></>}
          </span>
        </div>
        {onPlegar && (
          <button type="button" className="fr-aut-plegar" aria-label={`Plegar ${a.nombre}`} aria-expanded onClick={onPlegar}>
            <span className="fr-aut-chev" data-abierto><Icon name="chevron" size={16} /></span>
          </button>
        )}
      </header>
      {(riel.nodos.length > 0 || riel.antes > 0) && (
        <ol className="fr-aut-riel">
          {riel.antes > 0 && (
            <li className="fr-aut-nodo" data-tipo="antes">
              <span className="fr-aut-marca" aria-hidden />
              <button type="button" className="fr-aut-antes" onClick={onAntes}>Ver {riel.antes} antes</button>
            </li>
          )}
          {riel.nodos.map((n, k) => <NodoDelRiel key={`${n.tipo}-${n.at ?? 'sin'}-${k}`} n={n} en={en} />)}
          {verMenos && (
            <li className="fr-aut-nodo" data-tipo="antes">
              <span className="fr-aut-marca" aria-hidden />
              <button type="button" className="fr-aut-antes" onClick={onAntes}>Ver menos</button>
            </li>
          )}
        </ol>
      )}
      {riel.vacio && <p className="fr-aut-vacio">Todavía no le salió nada.</p>}
      {(frena || empieza || error) && (
        <footer className="fr-aut-pie">
          {frena && (
            <button type="button" className="fr-aut-frenar" onClick={onFrenar}>Frenar</button>
          )}
          {empieza && (
            <span className="fr-aut-pie-fin">
              <Button variant="secondary" size="sm" icon={<IconoMenu nombre="restaurar" size={15} />} onClick={onEmpezar}>Empezar de nuevo</Button>
            </span>
          )}
          {error && <p className="fr-aut-error" role="status">{error}</p>}
        </footer>
      )}
    </article>
  );
}

/** UNA TERMINADA, PLEGADA: una fila con su sello, el nombre y cómo terminó; un toque la abre en el lugar. */
export function FilaAutomatizacion({ a, en, onAbrir }: { a: InscripcionVista; en: EntornoTarjeta; onAbrir: () => void }) {
  const e = estadoDeTarjeta(a);
  const cuando = horasDe(en).delEstado(e);
  return (
    <button type="button" className="fr-aut-fila" data-tono={e.tono} aria-expanded={false} onClick={onAbrir}>
      <Sello forma={e.forma} />
      <span className="fr-aut-fila-nombre">{a.nombre}</span>
      <span className="fr-aut-fila-estado">{e.texto}{cuando ? ` · ${cuando}` : ''}</span>
      <span className="fr-aut-chev"><Icon name="chevron" size={16} /></span>
    </button>
  );
}
