'use client';

// =============================================================================
// EtapasEntregaModal — las columnas del tablero, y las FASES que las agrupan
// =============================================================================
// «Copia el diseño del CRM que te adjunto… no existe el botón de "No cambiar nada" o el
// de guardar… Se guarda automáticamente» (Martín, 05/10/2026), y «no pongas el texto "Son
// las columnas del tablero de este servicio" y tampoco pongas divisores». Es el molde de
// app/crm/EtapasModal.tsx: una fila por etapa sobre su caja, el nombre que se edita
// haciendo click EN EL TEXTO, y un «+ Agregar etapa» punteado al pie que pide el nombre
// ahí mismo.
//
// ⚠️ SIN BOTÓN DE GUARDAR, EL AVISO SE MUEVE AL CLICK. Mientras había un pie, sacar una
// columna con gente adentro se avisaba en un banner arriba y la decisión la tomaba el
// botón de guardar. Guardando solo no hay dónde frenar después, así que la consecuencia va
// PEGADA a la ✕ y ANTES: un Confirm que dice cuántos clientes y cuántas secuencias se
// lleva puestos. Es la regla de siempre —la consecuencia de lo irreversible va antes del
// click— aplicada a una pantalla que perdió su único punto de control.
//
// ⚠️ Y SE GUARDA LA LISTA ENTERA, con un respiro. Las etapas son un ORDEN: un merge por
// clave no puede expresar «esta columna va antes que aquélla» ni un borrado. El respiro
// existe porque renombrar es una tecla por letra, y sin él son veinte escrituras por
// nombre.
//
// ⚠️ LA CLAVE DE UNA ETAPA BORRADA NO VUELVE. `nuevaClaveEtapa` recibe TODAS las claves
// que esta sesión vio, las que están y las que se sacaron: si se reusara, los clientes que
// estaban en la etapa vieja reaparecerían dentro de la nueva, en una columna a la que
// nadie los movió.
//
// ─────────────────────────────────────────────────────────────────────────────
// LAS FASES
// ─────────────────────────────────────────────────────────────────────────────
// «Al crear columnas también se puedan crear FASES… dentro de una fase pueden haber varias
// etapas (columnas), y que se le ponga el color a esa fase y que sus columnas adopten eso»
// (Martín). Es el mismo modelo que el CRM ya tiene con Activo / Nutrición / Descartado.
//
// ⚠️ UNA ETAPA SIN FASE ES EL CASO NORMAL, no un hueco por llenar. Un servicio de cinco
// columnas sin tramos no gana nada agrupándolas, así que sin ninguna fase esta pantalla se
// ve exactamente como antes: el selector de fase no se dibuja y las etapas van sueltas.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, useConfirm } from '@/app/_ui';
import {
  nuevaClaveEtapa, nuevaClaveFase, colorNuevaEtapa, normalizarEtapas, colorDeEtapa,
  type EtapaEntrega, type FaseEntrega,
} from '@/lib/servicio-etapas';

/** Un tablero de una sola columna no es un tablero. */
const MINIMO = 2;
/** Lo que se espera antes de escribir. Renombrar es una tecla por letra. */
const RESPIRO_MS = 600;
const MAX_LABEL = 40;

export function EtapasEntregaModal({ servicio, etapas, fases, conteo, secuencias, onGuardar, onCerrar }: {
  servicio: string;
  etapas: EtapaEntrega[];
  fases: FaseEntrega[];
  /** Cuántos clientes hay en cada etapa. Es lo que hace que sacar una sea una decisión. */
  conteo: Record<string, number>;
  /**
   * Cuántas SECUENCIAS cuelgan de cada etapa. Los clientes eran sólo la mitad de lo que
   * apunta a una columna: la otra mitad son los mensajes automáticos, y ésos no «quedan
   * sin columna» cuando la etapa desaparece — dejan de dispararse, en silencio.
   *
   * ⚠️ `null` = NO SE PUDO LEER, que no es lo mismo que ninguna: decirlo sobre una
   * consulta caída es exactamente la afirmación que hace apretar el botón.
   */
  secuencias: Record<string, number> | null;
  onGuardar: (etapas: EtapaEntrega[], fases: FaseEntrega[]) => Promise<string | null>;
  onCerrar: () => void;
}) {
  const [lista, setLista] = useState<EtapaEntrega[]>(() => etapas.map((e) => ({ ...e })));
  const [tramos, setTramos] = useState<FaseEntrega[]>(() => fases.map((f) => ({ ...f })));
  /**
   * TODAS las claves que esta sesión vio — etapas y fases, incluidas las que se sacaron.
   *
   * ⚠️ NO SE DERIVA DE LA LISTA: justamente las borradas son las que ya no están ahí, y
   * son las que no se pueden reusar. Van las dos familias juntas porque una fase y una
   * etapa pueden llamarse igual, y el prefijo `f_` es lo único que las separa.
   */
  const [vistas, setVistas] = useState<string[]>(
    () => [...etapas.map((e) => e.key), ...fases.map((f) => f.key)],
  );
  const [mal, setMal] = useState('');
  const { confirm, confirmNode } = useConfirm();

  // ── El guardado automático ─────────────────────────────────────────────────
  const primera = useRef(true);
  const guardarRef = useRef(onGuardar);
  guardarRef.current = onGuardar;
  useEffect(() => {
    // Al montar no se guarda: sin esto, abrir el editor y cerrarlo escribe una vez —y ese
    // upsert marca el servicio como DECLARADO, o sea que mirar la pantalla convertiría el
    // default en una configuración que nadie escribió.
    if (primera.current) { primera.current = false; return; }
    if (lista.length < MINIMO) { setMal('Hacen falta al menos ' + MINIMO + ' etapas.'); return; }
    // El mismo saneo que corre en el server, antes de mandar: así el error se ve acá y no
    // vuelve como un «no se pudo guardar» que no dice qué arreglar.
    const limpias = normalizarEtapas(lista.map((e) => ({ ...e, label: e.label.trim() || e.key })));
    if (!limpias) { setMal('Esas etapas no se pueden guardar.'); return; }
    const t = setTimeout(async () => {
      const err = await guardarRef.current(limpias, tramos);
      setMal(err ?? '');
    }, RESPIRO_MS);
    return () => clearTimeout(t);
  }, [lista, tramos]);

  const claves = useCallback(() => vistas, [vistas]);

  const agregarEtapa = (label: string, fase?: string) => {
    const key = nuevaClaveEtapa(label, claves());
    setLista((v) => [...v, { key, label, ...colorNuevaEtapa(v.length), ...(fase ? { fase } : {}) }]);
    setVistas((v) => [...v, key]);
  };

  /* El `+ 3` corre la paleta para que la primera fase no nazca del color de la primera
     etapa: con los dos puntos iguales, agrupar no se ve. */
  const agregarFase = (label: string) => {
    const key = nuevaClaveFase(label, claves());
    setTramos((v) => [...v, { key, label, ...colorNuevaEtapa(v.length + 3) }]);
    setVistas((v) => [...v, key]);
  };

  const renombrar = (key: string, label: string) =>
    setLista((v) => v.map((e) => (e.key === key ? { ...e, label } : e)));
  const renombrarFase = (key: string, label: string) =>
    setTramos((v) => v.map((f) => (f.key === key ? { ...f, label } : f)));

  /**
   * Sacar una etapa, diciendo ANTES lo que se lleva puesto.
   *
   * ⚠️ LAS DOS CONSECUENCIAS VAN SEPARADAS PORQUE SON DISTINTAS: un cliente sin columna se
   * puede volver a mover y mientras tanto el tablero lo muestra aparte; una secuencia sin
   * etapa deja de dispararse y no se ve en ningún lado. Juntarlas en una frase obliga a
   * elegir un verbo para las dos, y el que sobreviva miente sobre la otra.
   */
  const sacar = async (e: EtapaEntrega) => {
    if (lista.length <= MINIMO) return;
    const n = conteo[e.key] ?? 0;
    const q = secuencias?.[e.key] ?? 0;
    const partes: string[] = [];
    if (n > 0) partes.push(n + (n === 1 ? ' cliente queda' : ' clientes quedan') + ' sin columna');
    if (q > 0) partes.push(q + (q === 1 ? ' secuencia deja' : ' secuencias dejan') + ' de dispararse');
    // «No pude revisar» no es «no hay»: con la lectura caída se avisa igual.
    if (secuencias === null) partes.push('no pude revisar si hay secuencias apuntando aquí');
    if (partes.length) {
      const ok = await confirm(partes.join(' y ') + '.', {
        title: 'Sacar «' + e.label + '»',
        confirmLabel: 'Sacar la columna',
      });
      if (!ok) return;
    }
    setLista((v) => v.filter((x) => x.key !== e.key));
  };

  /** Sacar una fase NO borra sus etapas: quedan sueltas, con su color propio. */
  const sacarFase = async (f: FaseEntrega) => {
    const n = lista.filter((e) => e.fase === f.key).length;
    if (n > 0) {
      const ok = await confirm(
        n + (n === 1 ? ' columna queda suelta' : ' columnas quedan sueltas') + ', con su color propio. No se borra ninguna.',
        { title: 'Sacar la fase «' + f.label + '»', confirmLabel: 'Sacar la fase', danger: false },
      );
      if (!ok) return;
    }
    setTramos((v) => v.filter((x) => x.key !== f.key));
    setLista((v) => v.map((e) => (e.fase === f.key ? { ...e, fase: undefined } : e)));
  };

  /** Mover una etapa dentro de TODA la lista: el orden del tablero es uno solo. */
  const mover = (key: string, d: -1 | 1) => setLista((v) => {
    const i = v.findIndex((e) => e.key === key);
    const j = i + d;
    if (i < 0 || j < 0 || j >= v.length) return v;
    const out = [...v];
    [out[i], out[j]] = [out[j], out[i]];
    return out;
  });

  const aFase = (key: string, fase: string | undefined) =>
    setLista((v) => v.map((e) => (e.key === key ? { ...e, fase } : e)));

  /**
   * Los grupos: cada fase con sus etapas y, al final, las sueltas.
   *
   * Una etapa que apunta a una fase que ya no existe cae entre las sueltas, igual que la
   * que nunca tuvo — es la misma regla que `colorDeEtapa`, que le devuelve su color propio.
   */
  const grupos: { fase: FaseEntrega | null; etapas: EtapaEntrega[] }[] = [
    ...tramos.map((f) => ({ fase: f, etapas: lista.filter((e) => e.fase === f.key) })),
    { fase: null, etapas: lista.filter((e) => !e.fase || !tramos.some((f) => f.key === e.fase)) },
  ].filter((g) => g.fase !== null || g.etapas.length > 0);

  return (
    <Modal titulo={servicio} onCerrar={onCerrar} ancho={560}>
      {mal && <p className="ee-mal">{mal}</p>}

      <div className="ee-todo">
        {grupos.map((g) => (
          <div key={g.fase ? g.fase.key : '__sueltas'} className="ee-grupo">
            {g.fase && (
              <div className="ee-fase">
                <span className="ee-dot" style={{ background: g.fase.dot }} aria-hidden />
                <NombreEditable valor={g.fase.label} chico
                  onGuardar={(v) => renombrarFase(g.fase!.key, v)} />
                <span className="ee-sp" />
                <Accion etiqueta={'Sacar la fase ' + g.fase.label}
                  onClick={() => void sacarFase(g.fase!)}>&#10005;</Accion>
              </div>
            )}

            {g.etapas.map((e) => (
              <div key={e.key} className="ee-caja">
                <div className="ee-fila">
                  <span className="ee-dot" style={{ background: colorDeEtapa(e, tramos) }} aria-hidden />
                  <NombreEditable valor={e.label} onGuardar={(v) => renombrar(e.key, v)} />
                  <span className="ee-sp" />
                  <span className="ee-n" title="Clientes en esta columna">{conteo[e.key] ?? 0}</span>
                  {/* El selector de fase existe sólo si hay fases: con ninguna, es un
                      control con una sola opción. */}
                  {tramos.length > 0 && (
                    <select className="ee-sel" value={e.fase ?? ''} aria-label={'Fase de ' + e.label}
                      onChange={(ev) => aFase(e.key, ev.target.value || undefined)}>
                      <option value="">Sin fase</option>
                      {tramos.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                  )}
                  <Accion etiqueta={'Mover ' + e.label + ' antes'} onClick={() => mover(e.key, -1)}
                    disabled={lista[0]?.key === e.key}>&#8593;</Accion>
                  <Accion etiqueta={'Mover ' + e.label + ' después'} onClick={() => mover(e.key, 1)}
                    disabled={lista[lista.length - 1]?.key === e.key}>&#8595;</Accion>
                  {/* ⚠️ Con el mínimo justo el ✕ se APAGA y lo dice en el title: un botón
                      que no hace nada y no explica por qué se lee como que está roto. */}
                  <Accion etiqueta={lista.length <= MINIMO
                    ? 'Hacen falta al menos ' + MINIMO + ' etapas'
                    : 'Sacar ' + e.label}
                    onClick={() => void sacar(e)} disabled={lista.length <= MINIMO}>&#10005;</Accion>
                </div>
              </div>
            ))}

            <NuevoRenglon label="+ Agregar etapa"
              onCrear={(v) => agregarEtapa(v, g.fase ? g.fase.key : undefined)} />
          </div>
        ))}

        <NuevoRenglon label="+ Agregar fase" onCrear={agregarFase} fase />
      </div>

      {confirmNode}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </Modal>
  );
}

/**
 * El nombre, que se edita haciendo click EN EL TEXTO.
 *
 * ⚠️ EL BOTÓN NO ESTIRA, igual que en el CRM: «solo si clickeo en el texto del título de
 * esa etapa debería abrirme el input, no en toda la fila». El hueco lo llena el `ee-sp`.
 */
function NombreEditable({ valor, chico, onGuardar }: {
  valor: string; chico?: boolean; onGuardar: (v: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  if (editando) {
    return (
      <input className="ee-input" autoFocus defaultValue={valor} maxLength={MAX_LABEL}
        onBlur={(e) => { onGuardar(e.target.value.trim() || valor); setEditando(false); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          // El Escape se frena acá: sin esto cierra el modal entero y se pierde el gesto.
          if (e.key === 'Escape') { e.stopPropagation(); setEditando(false); }
        }} />
    );
  }
  return (
    <button type="button" className={chico ? 'ee-nombre ee-nombre-fase' : 'ee-nombre'}
      onClick={() => setEditando(true)}
      title={'Cambiar el nombre de ' + valor}>{valor}</button>
  );
}

/**
 * El renglón punteado que pide el nombre ahí mismo.
 *
 * Es el `NuevaEtapa` del CRM, y por el mismo motivo: antes se creaba una «Nueva etapa» sin
 * preguntar y había que renombrarla después — dos pasos para lo que es uno, y mientras
 * tanto una columna con un nombre que no significa nada.
 */
function NuevoRenglon({ label, onCrear, fase = false }: {
  label: string; onCrear: (v: string) => void; fase?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const cerrar = (guardar: boolean, v: string) => {
    setAbierto(false);
    const t = v.trim();
    if (guardar && t) onCrear(t);
  };
  if (abierto) {
    return (
      <div className={fase ? 'ee-fase' : 'ee-caja ee-fila'}>
        <span className="ee-dot ee-dot-nueva" aria-hidden />
        <input className="ee-input" autoFocus maxLength={MAX_LABEL} placeholder="¿Cómo se llama?"
          onBlur={(e) => cerrar(true, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') { e.stopPropagation(); cerrar(false, ''); }
          }} />
      </div>
    );
  }
  return (
    <button type="button" className={fase ? 'ee-mas ee-mas-fase' : 'ee-mas'}
      onClick={() => setAbierto(true)}>{label}</button>
  );
}

/** Un botoncito por fila. Sin texto: la frase va en el `aria-label` y el `title`. */
function Accion({ etiqueta, onClick, disabled, children }: {
  etiqueta: string; onClick: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button type="button" className="ee-acc" onClick={onClick} disabled={disabled}
      aria-label={etiqueta} title={etiqueta}>{children}</button>
  );
}

/* ⚠️ NINGÚN BACKTICK NI `${` ADENTRO DE ESTA CADENA, ni siquiera en un comentario: un
   backtick la cierra a la mitad y la pantalla contesta 200 con el layout entero y sin una
   sola fila — que se lee como un componente que renderiza vacío. Ya pasó dos veces. */
const CSS = `
.ee-todo{ display:flex; flex-direction:column; gap:14px; }
.ee-grupo{ display:flex; flex-direction:column; gap:4px; }
.ee-mal{ margin:0 0 10px; font-size:13px; color:var(--bad); }

/* La fila va TRANSPARENTE: el fondo lo pone la caja, o habria dos. */
.ee-caja{ border-radius:10px; background:var(--surface-2); overflow:hidden; }
.ee-fila{ display:flex; align-items:center; gap:8px; padding:7px 8px 7px 11px; }
/* El renglon de la fase NO lleva caja: es el rotulo del grupo, no una fila mas. */
.ee-fase{ display:flex; align-items:center; gap:8px; padding:4px 8px 2px 2px; }

.ee-dot{ width:9px; height:9px; flex:none; border-radius:50%; }
.ee-dot-nueva{ background:#5B6472; }
.ee-sp{ flex:1; }
.ee-nombre{ flex:none; max-width:60%; text-align:left; font:inherit; font-weight:600; font-size:14px;
  color:var(--ink); background:none; border:none; padding:4px 0; cursor:text;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ee-nombre-fase{ font-size:11px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:var(--dim); }
.ee-input{ flex:1; min-width:0; font:inherit; font-weight:600; font-size:14px; color:var(--ink);
  background:var(--surface); border:1px solid var(--primary); border-radius:7px; padding:4px 8px; outline:none; }
.ee-n{ flex:none; min-width:22px; text-align:center; font-size:11.5px; font-weight:700; color:var(--dim); }
.ee-sel{ flex:none; max-width:116px; font:inherit; font-size:12px; color:var(--dim);
  background:var(--surface); border:1px solid var(--border); border-radius:7px; padding:3px 6px; cursor:pointer; }

.ee-acc{ width:28px; height:28px; flex:none; display:inline-flex; align-items:center; justify-content:center;
  border-radius:8px; border:1px solid transparent; background:transparent; font:inherit; font-size:13px;
  color:var(--dim); cursor:pointer; }
.ee-acc:hover:not(:disabled){ color:var(--ink); border-color:var(--border); }
.ee-acc:disabled{ color:var(--faint); cursor:default; opacity:.45; }

.ee-mas{ margin-top:2px; padding:10px 12px; border-radius:10px; border:1px dashed var(--border-strong);
  background:none; color:var(--dim); font:inherit; font-size:13.5px; font-weight:600; cursor:pointer;
  text-align:left; transition:background .12s, border-color .12s, color .12s; }
.ee-mas:hover{ border-color:var(--primary); background:var(--primary-weak); color:var(--primary); }
.ee-mas-fase{ margin-top:4px; font-size:12.5px; }
`;
