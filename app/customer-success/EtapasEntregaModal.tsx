'use client';

// =============================================================================
// EtapasEntregaModal — «o lo que sea que el usuario configure en su entrega»
// =============================================================================
// Las columnas del kanban de un servicio: agregar, renombrar, reordenar y sacar.
//
// ⚠️ SE REORDENA CON BOTONES Y NO ARRASTRANDO, a propósito. Un arrastre acá tendría
// que resolver las cuatro trampas que AGENTS.md documenta (la foto que dibuja el
// sistema operativo, el `setState` por `dragover`, el nodo origen, el auto-scroll) para
// mover cinco filas una posición. El arrastre está donde se usa todo el día —las
// tarjetas del tablero— y acá, que se abre cuando se define el servicio, dos flechas
// hacen el mismo trabajo sin un caso que falle.
//
// ⚠️ LA CLAVE DE UNA ETAPA BORRADA NO VUELVE. `nuevaClaveEtapa` recibe TODAS las claves
// que esta sesión vio, las que están y las que se sacaron: si se reusara, los clientes
// que estaban en la etapa vieja reaparecerían dentro de la nueva, en una columna a la
// que nadie los movió. Es la lección de ManyChat, que apunta a todo por nombre.
//
// ⚠️ Y BORRAR UNA COLUMNA CON GENTE ADENTRO LO DICE, CON EL NÚMERO. Esos clientes no se
// van de la entrega: quedan sin columna, y el tablero los lista aparte para que alguien
// los mueva. Un borrado que no dice eso se lee como que los clientes desaparecieron.

import { useMemo, useState } from 'react';
import { Modal, Button, Banner } from '@/app/_ui';
import {
  nuevaClaveEtapa, colorNuevaEtapa, normalizarEtapas, fraseSecuenciasHuerfanas,
  type EtapaEntrega,
} from '@/lib/servicio-etapas';

/** Un tablero de una sola columna no es un tablero. */
const MINIMO = 2;

export function EtapasEntregaModal({ servicio, etapas, conteo, secuencias, onGuardar, onCerrar }: {
  servicio: string;
  etapas: EtapaEntrega[];
  /** Cuántos clientes hay en cada etapa. Es lo que hace que borrar sea una decisión
   *  informada y no una sorpresa. */
  conteo: Record<string, number>;
  /**
   * Cuántas SECUENCIAS cuelgan de cada etapa. Los clientes eran sólo la mitad de la
   * gente que apunta a una columna: la otra mitad son los mensajes automáticos, y ésos
   * no se «listan aparte» cuando la etapa desaparece — dejan de dispararse, en silencio.
   *
   * ⚠️ `null` = NO SE PUDO LEER. No es lo mismo que un mapa vacío, y por eso no se
   * normaliza a `{}` al entrar: decir «ninguna secuencia» sobre una consulta caída es
   * exactamente la afirmación que hace apretar el botón. Las etapas sin secuencias
   * vienen AUSENTES del mapa; el universo de etapas lo pone esta pantalla.
   */
  secuencias: Record<string, number> | null;
  onGuardar: (etapas: EtapaEntrega[]) => Promise<string | null>;
  onCerrar: () => void;
}) {
  const [lista, setLista] = useState<EtapaEntrega[]>(() => etapas.map((e) => ({ ...e })));
  /**
   * TODAS las claves que esta sesión vio, incluidas las que se sacaron.
   *
   * ⚠️ NO SE DERIVA DE `lista`: justamente las borradas son las que ya no están ahí, y
   * son las que no se pueden reusar. Arranca con las que llegaron.
   */
  const [vistas, setVistas] = useState<string[]>(() => etapas.map((e) => e.key));
  const [nuevo, setNuevo] = useState('');
  const [mal, setMal] = useState('');
  const [guardando, setGuardando] = useState(false);

  /** Las que se sacaron en esta sesión, con o sin nadie adentro. */
  const sacadas = useMemo(
    () => etapas.filter((e) => !lista.some((l) => l.key === e.key)),
    [etapas, lista],
  );
  /** Las que se sacaron y tenían CLIENTES adentro. */
  const sacadasConGente = useMemo(
    () => sacadas.filter((e) => (conteo[e.key] ?? 0) > 0),
    [sacadas, conteo],
  );
  /**
   * Las que se sacaron y tenían SECUENCIAS colgando.
   *
   * ⚠️ UNA ETAPA CON 0 CLIENTES Y 2 SECUENCIAS TAMBIÉN AVISA. Antes el aviso colgaba
   * sólo del conteo de clientes, así que borrar una columna vacía —el caso que se
   * siente más inofensivo— rompía dos automatismos sin decir una palabra.
   */
  const fraseSecuencias = useMemo(
    () => (secuencias ? fraseSecuenciasHuerfanas(sacadas.map((e) => ({ label: e.label, n: secuencias[e.key] ?? 0 }))) : ''),
    [sacadas, secuencias],
  );

  const agregar = () => {
    const label = nuevo.trim();
    if (!label) return;
    const key = nuevaClaveEtapa(label, vistas);
    setLista((v) => [...v, { key, label, ...colorNuevaEtapa(v.length) }]);
    setVistas((v) => [...v, key]);
    setNuevo('');
    setMal('');
  };

  const renombrar = (key: string, label: string) =>
    setLista((v) => v.map((e) => (e.key === key ? { ...e, label } : e)));

  const sacar = (key: string) => {
    setLista((v) => v.filter((e) => e.key !== key));
    setMal('');
  };

  const mover = (i: number, d: -1 | 1) => setLista((v) => {
    const j = i + d;
    if (j < 0 || j >= v.length) return v;
    const out = [...v];
    [out[i], out[j]] = [out[j], out[i]];
    return out;
  });

  const guardar = async () => {
    setMal('');
    if (lista.length < MINIMO) { setMal(`Hacen falta al menos ${MINIMO} etapas.`); return; }
    const sinNombre = lista.find((e) => !e.label.trim());
    if (sinNombre) { setMal('Hay una etapa sin nombre.'); return; }
    // El mismo saneo que corre en el server, antes de mandar: así el error se ve acá y
    // no vuelve como un «no se pudo guardar» que no dice qué arreglar.
    const limpias = normalizarEtapas(lista.map((e) => ({ ...e, label: e.label.trim() })));
    if (!limpias) { setMal('Esas etapas no se pueden guardar. Revisa que ninguna quede sin nombre.'); return; }
    setGuardando(true);
    const err = await onGuardar(limpias);
    setGuardando(false);
    if (err) { setMal(err); return; }
    onCerrar();
  };

  return (
    <Modal
      titulo={`Etapas de ${servicio}`}
      onCerrar={onCerrar}
      ancho={560}
      pie={
        <>
          <Button variant="tertiary" onClick={onCerrar}>No cambiar nada</Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar las etapas'}
          </Button>
        </>
      }
    >
      <p className="ee-sub">Son las columnas del tablero de este servicio. El cliente entra por la primera.</p>

      {mal && <Banner tono="bad">{mal}</Banner>}

      {/* ⚠️ LA CONSECUENCIA VA PEGADA AL BOTÓN Y ANTES DEL CLICK, no en un cartel arriba
          en gris. Y dice el NÚMERO: «quedan sin columna» sin cuántos no es una decisión.

          ⚠️ Y VAN SEPARADAS PORQUE SON DOS CONSECUENCIAS DISTINTAS. Un cliente sin
          columna se puede volver a mover y mientras tanto el tablero lo muestra; una
          secuencia sin etapa deja de dispararse y no se ve en ningún lado. Juntarlas en
          una frase obliga a elegir un verbo para las dos, y el que sobreviva miente
          sobre la otra. */}
      {sacadasConGente.length > 0 && (
        <Banner tono="warn">
          {sacadasConGente.map((e) => `${conteo[e.key]} en ${e.label}`).join(' · ')}: al guardar quedan
          sin columna y el tablero los lista aparte hasta que los muevas. No salen de la entrega.
        </Banner>
      )}

      {fraseSecuencias && <Banner tono="bad">{fraseSecuencias}</Banner>}

      {/* ⚠️ «NO PUDE REVISAR» NO ES «NO HAY». Sin este renglón, una consulta caída deja
          el editor exactamente igual que si no hubiera ninguna secuencia — y alguien
          borra una columna creyendo que no rompe nada. */}
      {secuencias === null && sacadas.length > 0 && (
        <Banner tono="warn">
          No pude revisar si hay secuencias apuntando a {sacadas.length === 1 ? 'esa etapa' : 'esas etapas'}.
        </Banner>
      )}

      <ul className="ee-lista">
        {lista.map((e, i) => (
          <li key={e.key}>
            <span className="ee-dot" style={{ background: e.dot }} aria-hidden />
            <input value={e.label} onChange={(ev) => renombrar(e.key, ev.target.value)}
              aria-label={`Nombre de la etapa ${e.label}`} maxLength={40} />
            <span className="ee-n" title="Clientes en esta etapa">{conteo[e.key] ?? 0}</span>
            <button type="button" onClick={() => mover(i, -1)} disabled={i === 0}
              title="Subir" aria-label={`Mover ${e.label} antes`}>↑</button>
            <button type="button" onClick={() => mover(i, 1)} disabled={i === lista.length - 1}
              title="Bajar" aria-label={`Mover ${e.label} después`}>↓</button>
            <button type="button" className="ee-x" onClick={() => sacar(e.key)}
              disabled={lista.length <= MINIMO}
              title={lista.length <= MINIMO ? `Hacen falta al menos ${MINIMO} etapas` : `Sacar ${e.label}`}
              aria-label={`Sacar la etapa ${e.label}`}>✕</button>
          </li>
        ))}
      </ul>

      <div className="ee-nueva">
        <input value={nuevo} onChange={(ev) => setNuevo(ev.target.value)}
          onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); agregar(); } }}
          placeholder="Hito 3, Revisión, Cierre…" aria-label="Nombre de la etapa nueva" maxLength={40} />
        <Button variant="secondary" onClick={agregar} disabled={!nuevo.trim()}>Agregar</Button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </Modal>
  );
}

const CSS = `
.ee-sub { margin: 0 0 12px; font-size: 13px; color: var(--dim); }
.ee-lista { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.ee-lista li { display: flex; align-items: center; gap: 7px; }
.ee-dot { width: 9px; height: 9px; border-radius: 999px; flex: none; }
.ee-lista input {
  flex: 1 1 auto; min-width: 0; padding: 7px 10px; border: 1px solid var(--border);
  border-radius: 9px; font: inherit; font-size: 13.5px; background: var(--surface); color: var(--ink);
}
.ee-n { flex: none; min-width: 26px; text-align: center; font-size: 11.5px; font-weight: 700; color: var(--dim); }
.ee-lista button, .ee-nueva button {
  flex: none; width: 28px; height: 28px; border-radius: 8px; border: 1px solid var(--border);
  background: var(--surface); color: var(--dim); cursor: pointer; font-size: 12px; line-height: 1;
}
.ee-lista button:hover:not(:disabled) { color: var(--ink); border-color: var(--border-strong); }
.ee-lista button:disabled { opacity: .35; cursor: default; }
.ee-x:hover:not(:disabled) { color: var(--bad) !important; }
.ee-nueva { display: flex; gap: 7px; margin-top: 14px; align-items: center; }
.ee-nueva input {
  flex: 1 1 auto; min-width: 0; padding: 8px 11px; border: 1px dashed var(--border-strong);
  border-radius: 9px; font: inherit; font-size: 13.5px; background: none; color: var(--ink);
}
.ee-nueva button { width: auto; height: auto; }
`;
