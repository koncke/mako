'use client';

// =============================================================================
// FilaAvance — las celdas de UNA fila del Avance del curso (la tabla de la tab y la ficha)
// =============================================================================
// Pedido de Martín (06/10/2026): «El "Avence" del curso debería también verse en el detail de
// cada cliente». El Avance es la fila de la tabla de la tab Curso: su etapa con su color, las
// tareas enviadas sobre las que hay en CADA etapa (la suya resaltada), cuánto vio de los videos
// de su etapa y cuándo entró por última vez a su portal.
//
// ⚠️ LAS CELDAS VIVEN ACÁ Y LAS USAN LOS DOS: la tabla de la tab (./AvanceCurso.tsx, una fila
// por cliente) y la pestaña Curso de la ficha (../FichaCurso.tsx, la fila de ESE cliente). Con
// dos copias del dibujo, una de las dos se queda con el «listo» viejo — que es lo que pasaba:
// la tab pintaba verde «enviadas >= total» y la ficha decía «Completa» con otra regla.
//
// ⚠️ «LISTO» ES `CeldaEtapa.completa`, LA REGLA QUE MUEVE AL CLIENTE (todas sus obligatorias
// enviadas, `conteoDeEtapa` de lib/curso.ts), no «envió todas las tareas». En el ws1 hay UNA
// obligatoria por etapa entre 8 y 20 tareas: con la regla vieja, la ficha decía «Completa» con
// 1/9 mientras la tabla no lo pintaba.
//
// ⚠️ «SIN MEDIR» NO ES 0%. Drive y Loom se ven pero no avisan cuánto; un 0% ahí se lee como
// «no lo vio» y es mentira. Y «—» es que su etapa no tiene video.
//
// ⚠️ SIN `Pagina` NI CONTENEDOR PROPIO: son celdas (`<th>`/`<td>` sueltos) para que cada pantalla
// arme su tabla con lo suyo alrededor (la columna del cliente y la del acceso en la tab; nada
// más en la ficha). La hoja va en `EstiloAvance`, que monta quien arma la tabla.

import { Tooltip } from '@/app/_ui';
import { ROTULO_SIN_MEDIR } from '@/lib/curso';
import type { CeldaEtapa } from './reglas';

/** Una etapa de la entrega como columna: su clave, su nombre y su color en el kanban. */
export type EtapaVista = { key: string; label: string; color: string };

/** Lo que una fila dice de UN cliente en UN producto. Lo arma `avanceDeCliente` (./reglas.ts). */
export type DatosAvance = {
  etapa: string | null;
  /**
   * Su fila apunta a una etapa que el catálogo ya no tiene. Lo manda la ficha
   * (`armarProducto`), con `etapa: null`: la celda dice «Etapa borrada», lo mismo que la
   * cabecera, en vez de un «—» que se lee como «sin etapa». Ausente = no se sabe o no es el caso.
   */
  etapaBorrada?: boolean;
  porEtapa: Record<string, CeldaEtapa>;
  pctVisto: number | null;
  videosSinMedir: number;
  /** Para «Último ingreso». `null` = no se pudo leer (no «nunca entró»). */
  acceso: { ingresos: number; ultimoIngresoAt: string | null } | null;
};

/** Las cabeceras de las celdas de abajo, en el mismo orden. */
export function CabezaAvance({ etapas }: { etapas: readonly EtapaVista[] }) {
  return (
    <>
      <th>Etapa</th>
      {etapas.map((e) => (
        <th key={e.key} className="av-n" title={e.label}>
          <span className="av-dot" style={{ background: e.color }} aria-hidden />
          {corto(e.label)}
        </th>
      ))}
      <th className="av-n">Visto</th>
      <th>Último ingreso</th>
    </>
  );
}

export function CeldasAvance({ etapas, fila }: { etapas: readonly EtapaVista[]; fila: DatosAvance }) {
  const etapa = etapas.find((e) => e.key === fila.etapa);
  return (
    <>
      <td>{etapa ? <span className="av-etapa"><span className="av-dot" style={{ background: etapa.color }} aria-hidden />{etapa.label}</span>
        : fila.etapaBorrada ? <span className="av-mal">Etapa borrada</span> : '—'}</td>
      {etapas.map((e) => {
        const c = fila.porEtapa[e.key];
        const suya = e.key === fila.etapa;
        if (!c || c.total === 0) return <td key={e.key} className={`av-n${suya ? ' is-suya' : ''}`}><span className="av-vacio">·</span></td>;
        return (
          <td key={e.key} className={`av-n${suya ? ' is-suya' : ''}${c.completa ? ' is-listo' : ''}`}
            title={c.completa ? 'Etapa completa' : undefined}>
            {c.enviadas}/{c.total}
          </td>
        );
      })}
      <td className="av-n">
        {fila.pctVisto != null ? `${fila.pctVisto}%`
          : fila.videosSinMedir > 0 ? <Tooltip text="Drive o Loom no avisan cuánto se vio."><span className="av-sub">{ROTULO_SIN_MEDIR}</span></Tooltip>
          : <span className="av-vacio">—</span>}
      </td>
      <td><Ingreso acceso={fila.acceso} /></td>
    </>
  );
}

/**
 * Cuándo entró por última vez a su portal. El estado del ACCESO (cortado, sin invitar) no va
 * acá: tiene su columna en la tab y su caja en la ficha (./InvitarAlCurso.tsx).
 */
function Ingreso({ acceso }: { acceso: DatosAvance['acceso'] }) {
  if (!acceso) return <span className="av-vacio">—</span>;
  if (!acceso.ultimoIngresoAt) return <span className="av-sub">Nunca</span>;
  // ⚠️ La fecha se formatea en el NAVEGADOR (su zona horaria): el server corre en UTC y la
  // misma fila diría otro día según quién la dibujó. Por eso `suppressHydrationWarning`.
  return (
    <span suppressHydrationWarning title={`${acceso.ingresos} ${acceso.ingresos === 1 ? 'ingreso' : 'ingresos'}`}>
      {new Date(acceso.ultimoIngresoAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
    </span>
  );
}

/** El rótulo de una columna de etapa: corto, para que nueve entren sin romper la tabla. */
const corto = (s: string) => (s.length > 12 ? `${s.slice(0, 11)}…` : s);

/** La hoja de la tabla. La monta quien arma la tabla, una vez. */
export function EstiloAvance() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}

// ⚠️ NINGÚN BACKTICK ACÁ ADENTRO, ni en un comentario: cierra la cadena a la mitad y la
// pantalla contesta 200 sin estilos (AGENTS.md).
const CSS = `
.av{ width:100%; border-collapse:collapse; font-size:var(--fs-sm); }
.av th{ text-align:left; font-weight:600; color:var(--dim); font-size:var(--fs-meta); padding:8px 10px; border-bottom:1px solid var(--border); white-space:nowrap; }
.av td{ padding:9px 10px; border-bottom:1px solid var(--border); vertical-align:middle; white-space:nowrap; color:var(--ink); }
.av tr:hover td{ background:var(--surface-2); }
.av-cli{ min-width:180px; position:sticky; left:0; background:var(--surface); z-index:1; }
.av tr:hover .av-cli{ background:var(--surface-2); }
.av-nombre{ font-weight:600; }
.av-sub{ font-size:var(--fs-meta); color:var(--dim); }
.av-n{ text-align:center !important; font-variant-numeric:tabular-nums; }
.av-n.is-suya{ background:var(--primary-bg); font-weight:600; }
.av-n.is-listo{ color:var(--good); }
.av-vacio{ color:var(--faint); }
.av-mal{ color:var(--bad); font-size:var(--fs-meta); }
.av-dot{ display:inline-block; width:8px; height:8px; border-radius:999px; margin-right:6px; vertical-align:middle; }
.av-etapa{ display:inline-flex; align-items:center; }
`;
