'use client';

// =============================================================================
// TraerDeGrupoWA — los contactos de un grupo de WhatsApp, al CRM (23/10/2026)
// =============================================================================
// Martín, en la llamada del 23/10 (min 37:27): «una automatización que te agrega de un grupo de WhatsApp, te pone todos los
// números y los contactos en tu CRM de manera automática... sí o sí lo tengo que tener para mañana». El molde es «Traer de
// otro funnel» (./TraerDeOtroProducto.tsx): reemplaza al alta con su «Atrás», la tabla con su cabecera pegada y el pie pegado
// abajo con el botón. Lo que hace, y sus cuidados (no manda nada, nunca duplica, sólo el admin), en ./grupo-wa-server.ts.
// Para cargar una base de venta (el Cerebro, 23/10/2026, para Martín en su ws9):
//   · se elige el funnel y la etapa (por defecto «Prospección › Tibio», si existen) y la ETIQUETA DE ORIGEN («Formación de Jan»),
//     que viene con el nombre del grupo y se edita;
//   · sirve para VARIOS grupos seguidos: al terminar no se cierra, el grupo se vuelve a leer (los traídos pasan a «Ya está») y se
//     elige el siguiente. Nunca duplica, y quien está en dos grupos queda con las dos etiquetas.
// ⚠️ DE A TANDAS (`TANDA_GRUPO`): un grupo llega a 1.024 personas y cada lead son varias escrituras; una acción tiene 60 s.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Dropdown, type DropdownOption } from '@/app/components/Dropdown';
import { TANDA_GRUPO, etapaPorDefecto, funnelPorDefecto, type GrupoWA, type ParticipanteWA } from '@/lib/grupo-wa-reglas';
import { miles } from './traer-seleccion';
import { abrirTraerDeGrupoAction, etapasDeFunnelAction, gruposDeLineaAction, participantesDeGrupoAction, traerDeGrupoAction } from './grupo-wa-actions';
import type { LineaGrupos } from './grupo-wa-server';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";
const th: CSSProperties = { textAlign: 'left', fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 600, padding: '0 10px 7px', whiteSpace: 'nowrap' };
const td: CSSProperties = { padding: '9px 10px', fontFamily: SANS, fontSize: 13.5, color: 'var(--ink)', borderTop: '1px solid var(--border)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const nota: CSSProperties = { fontFamily: SANS, fontSize: 13.5, color: 'var(--dim)', padding: '22px 14px', margin: 0 };
const campo: CSSProperties = { padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' };

type Participante = ParticipanteWA & { enElCrm: boolean };
type Etapa = { key: string; label: string; manda: boolean };

export function TraerDeGrupoWA({ productos, destino, onAtras, onTraidos }: {
  /** Los funnels del negocio (para elegir a cuál van). */
  productos: Array<{ id: number; nombre: string; esDefault: boolean }>;
  /** El funnel que se mira. `null` = el del negocio. */
  destino: number | null;
  /** Volver al alta. No cierra el modal. */
  onAtras: () => void;
  /** Terminó UN grupo: el resumen para el aviso del padre (el modal sigue abierto para el siguiente). */
  onTraidos: (resumen: string) => void;
}) {
  const [funnel, setFunnel] = useState<number | null>(() => funnelPorDefecto(productos, destino ?? productos.find((p) => p.esDefault)?.id ?? null));
  const [lineas, setLineas] = useState<LineaGrupos[] | null>(null);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [linea, setLinea] = useState<string | null>(null);
  const [grupos, setGrupos] = useState<GrupoWA[] | null>(null);
  const [jid, setJid] = useState('');
  const [gente, setGente] = useState<Participante[] | null>(null);
  const [sinNumero, setSinNumero] = useState(0);
  const [sel, setSel] = useState<ReadonlySet<string>>(new Set());
  const [etapa, setEtapa] = useState('');
  const [etiqueta, setEtiqueta] = useState('');
  const [q, setQ] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [avance, setAvance] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  /** Cada vuelta relee el grupo (después de traerlo, los traídos pasan a «Ya está»). */
  const [vuelta, setVuelta] = useState(0);
  const abierto = useRef(false);

  // Al abrir: las líneas del negocio y las etapas del funnel. Al cambiar de funnel, sólo sus etapas.
  useEffect(() => {
    let vivo = true;
    const ponerEtapas = (r: { etapas: Etapa[]; entrada: string | null }) => { setEtapas(r.etapas); setEtapa(etapaPorDefecto(r.etapas, r.entrada)); };
    if (!abierto.current) {
      abierto.current = true;
      void abrirTraerDeGrupoAction(funnel).then((r) => {
        if (!vivo) return;
        if (!r.ok) { setErr(r.error); setLineas([]); return; }
        setLineas(r.lineas);
        ponerEtapas(r);
        setLinea(r.lineas[0]?.linea ?? null);
      }).catch(() => { if (vivo) { setErr('No pude abrir esto. Prueba de nuevo.'); setLineas([]); } });
    } else {
      void etapasDeFunnelAction(funnel).then((r) => { if (vivo) { if (r.ok) ponerEtapas(r); else setErr(r.error); } }).catch(() => {});
    }
    return () => { vivo = false; };
  }, [funnel]);

  // Los grupos de la línea elegida. Cambiar de línea limpia todo lo de abajo.
  useEffect(() => {
    if (!linea) return;
    let vivo = true;
    setGrupos(null); setJid(''); setGente(null); setSel(new Set()); setErr(null);
    void gruposDeLineaAction(linea).then((r) => {
      if (!vivo) return;
      if (!r.ok) { setErr(r.error); setGrupos([]); return; }
      setGrupos(r.grupos);
    }).catch(() => { if (vivo) { setErr('WhatsApp no contestó.'); setGrupos([]); } });
    return () => { vivo = false; };
  }, [linea]);

  // Los participantes del grupo elegido: tildados los que todavía no son leads (a eso se vino).
  useEffect(() => {
    if (!jid) return;
    let vivo = true;
    setGente(null); setErr(null);
    void participantesDeGrupoAction(linea, jid).then((r) => {
      if (!vivo) return;
      if (!r.ok) { setErr(r.error); setGente([]); return; }
      setGente(r.participantes);
      setSinNumero(r.sinNumero);
      setSel(new Set(r.participantes.map((p) => p.telefono)));
    }).catch(() => { if (vivo) { setErr('No pude leer el grupo.'); setGente([]); } });
    return () => { vivo = false; };
  }, [jid, linea, vuelta]);

  const grupo = grupos?.find((g) => g.jid === jid) ?? null;
  const elegirGrupo = (v: string) => {
    setJid(v); setQ(''); setHecho(null);
    setEtiqueta(grupos?.find((g) => g.jid === v)?.nombre.slice(0, 40) ?? '');
  };
  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    const dig = t.replace(/\D/g, '');
    return (gente ?? []).filter((p) => !t || (p.nombre ?? '').toLowerCase().includes(t) || (!!dig && p.telefono.includes(dig)));
  }, [gente, q]);
  const todos = !!gente?.length && gente.every((p) => sel.has(p.telefono));
  const enElCrm = (gente ?? []).filter((p) => p.enElCrm && sel.has(p.telefono)).length;
  const sinOfrecer = etapas.filter((e) => e.manda).length;
  const usables = etapas.filter((e) => !e.manda);
  const trayendo = avance != null;
  const listo = !!grupo && !!etapa && sel.size > 0 && !!etiqueta.trim() && funnel != null;

  const alternar = (t: string) => setSel((s) => { const n = new Set(s); if (n.has(t)) n.delete(t); else n.add(t); return n; });
  const traer = async () => {
    if (!grupo || !listo) return;
    setErr(null); setHecho(null);
    const tels = [...sel];
    let creados = 0, sumados = 0, yaEstaban = 0, salteados = 0, hechos = 0;
    const errores: string[] = [];
    // De a tandas; lo que una no llegó a traer (cortó por tiempo) vuelve a la cola, adelante.
    const cola = [...tels];
    while (cola.length) {
      const tanda = cola.splice(0, TANDA_GRUPO);
      setAvance(`Trayendo ${miles(Math.min(hechos + tanda.length, tels.length))} de ${miles(tels.length)}…`);
      const r = await traerDeGrupoAction({ linea, jid, nombreGrupo: grupo.nombre, funnelId: funnel, etapa, etiqueta: etiqueta.trim(), telefonos: tanda })
        .catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : 'error' }));
      if (!r.ok) { setErr(r.error); if (!creados && !sumados && !yaEstaban) { setAvance(null); return; } break; }
      creados += r.creados; sumados += r.sumados; yaEstaban += r.yaEstaban; salteados += r.salteados; errores.push(...r.errores);
      hechos += tanda.length - r.pendientes.length;
      if (r.pendientes.length >= tanda.length) { setErr('WhatsApp está tardando: prueba de nuevo en un rato.'); break; }
      cola.unshift(...r.pendientes);
    }
    setAvance(null);
    const resumen = [
      creados ? `${miles(creados)} ${creados === 1 ? 'lead nuevo' : 'leads nuevos'}` : '',
      sumados ? `${miles(sumados)} ${sumados === 1 ? 'sumado' : 'sumados'} al funnel` : '',
      yaEstaban ? `${miles(yaEstaban)} ya ${yaEstaban === 1 ? 'estaba' : 'estaban'}` : '',
      errores.length ? `${miles(errores.length)} no se ${errores.length === 1 ? 'pudo' : 'pudieron'}` : '',
      salteados ? `${miles(salteados)} con un número de dos leads` : '',
    ].filter(Boolean).join(' · ') || 'Nadie para traer';
    // Los que no se pudieron, por su NOMBRE (la revisión de privacidad, 23/10/2026): un número sin nombre no se puede buscar.
    const fallidos = errores.length ? ` No se pudieron: ${errores.slice(0, 5).join(', ')}${errores.length > 5 ? '…' : ''}.` : '';
    setHecho(`«${grupo.nombre}»: ${resumen}.${fallidos} Elige otro grupo para seguir.`);
    onTraidos(resumen);
    setVuelta((n) => n + 1);
  };

  const opcionesLinea: DropdownOption[] = (lineas ?? []).map((l) => ({ value: l.linea, label: l.etiqueta }));
  const opcionesGrupo: DropdownOption[] = [
    { value: '', label: grupos === null ? 'Cargando grupos…' : grupos.length ? 'Elige un grupo' : 'Sin grupos' },
    ...(grupos ?? []).map((g) => ({ value: g.jid, label: g.tamano != null ? `${g.nombre} · ${miles(g.tamano)}` : g.nombre })),
  ];
  const opcionesFunnel: DropdownOption[] = productos.map((p) => ({ value: String(p.id), label: p.nombre }));
  const opcionesEtapa: DropdownOption[] = usables.map((e) => ({ value: e.key, label: e.label }));

  if (lineas !== null && !lineas.length) {
    return (
      <div>
        <p style={{ ...nota, padding: 0 }}>{err ?? 'Conecta una línea de WhatsApp para traer los contactos de un grupo.'}</p>
        <button type="button" onClick={onAtras} style={btnAtras}>← Atrás</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {lineas && lineas.length > 1 && (
          <Dropdown value={linea ?? ''} options={opcionesLinea} onChange={(v) => setLinea(v)} ariaLabel="De qué línea" width={200} />
        )}
        <Dropdown value={jid} options={opcionesGrupo} onChange={elegirGrupo} ariaLabel="De qué grupo" width={300} />
        {!!gente?.length && (
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o teléfono" style={{ ...campo, flex: '1 1 200px', minWidth: 160 }} />
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
        {!!gente?.length && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
              <tr>
                <th style={{ ...th, width: 34, padding: '10px 0 7px 12px' }}>
                  <input type="checkbox" checked={todos} onChange={() => setSel(todos ? new Set() : new Set(gente.map((p) => p.telefono)))}
                    aria-label={`Tildar a los ${miles(gente.length)}`} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)' }} />
                </th>
                <th style={th}>Nombre</th>
                <th style={th}>Teléfono</th>
                <th style={th}>En el CRM</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => {
                const on = sel.has(p.telefono);
                return (
                  <tr key={p.telefono} onClick={() => alternar(p.telefono)} style={{ cursor: 'pointer', background: on ? 'var(--primary-weak)' : 'transparent' }}>
                    <td style={{ ...td, padding: '9px 0 9px 12px' }}>
                      <input type="checkbox" checked={on} readOnly tabIndex={-1} aria-label={`Traer a ${p.nombre ?? `+${p.telefono}`}`}
                        style={{ width: 16, height: 16, accentColor: 'var(--primary)', pointerEvents: 'none' }} />
                    </td>
                    <td style={{ ...td, fontWeight: 600 }}>{p.nombre ?? '—'}</td>
                    <td style={{ ...td, color: 'var(--dim)', fontFamily: MONO, fontSize: 12.5 }}>+{p.telefono}</td>
                    <td style={{ ...td, color: 'var(--dim)' }}>{p.enElCrm ? 'Ya está' : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!jid && grupos !== null && <p style={nota}>{grupos.length ? 'Elige el grupo de arriba.' : 'Esta línea no está en ningún grupo.'}</p>}
        {(grupos === null || (jid && gente === null)) && <p style={{ ...nota, color: 'var(--faint)' }}>Cargando…</p>}
        {jid && gente?.length === 0 && <p style={nota}>{sinNumero ? 'WhatsApp no deja ver los números de este grupo.' : 'Nadie para traer.'}</p>}
      </div>

      {/* El pie, pegado abajo (el molde de «Traer de otro funnel»): a dónde van, con qué etiqueta, y el botón. */}
      <div style={{ position: 'sticky', bottom: 0, zIndex: 2, background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '10px 0 2px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {hecho && <span role="status" style={{ fontFamily: SANS, fontSize: 13, color: 'var(--good)' }}>{hecho}</span>}
        {/* «No les manda nada» siempre (el Cerebro, 23/10/2026): ni al traerlos, ni después por su cuenta (`quedaDondeLoPusieron`). */}
        {!!gente?.length && (
          <span style={{ fontFamily: SANS, fontSize: 12.5, color: 'var(--dim)' }}>
            {[
              'No les manda nada.',
              enElCrm ? `${miles(enElCrm)} ya ${enElCrm === 1 ? 'es un lead: no se duplica' : 'son leads: no se duplican'}.` : '',
              sinNumero ? `${miles(sinNumero)} sin número visible.` : '',
              sinOfrecer ? 'Las etapas que mandan algo o cierran el trato no se ofrecen.' : '',
            ].filter(Boolean).join(' ')}
          </span>
        )}
        {!!gente?.length && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {productos.length > 1 && <Dropdown value={String(funnel ?? '')} options={opcionesFunnel} onChange={(v) => setFunnel(Number(v))} ariaLabel="A qué funnel" width={200} />}
            {opcionesEtapa.length
              ? <Dropdown value={etapa} options={opcionesEtapa} onChange={setEtapa} ariaLabel="A qué etapa" width={180} />
              : <span style={{ fontFamily: SANS, fontSize: 13, color: 'var(--bad)' }}>Ninguna etapa de este funnel se puede usar al traer.</span>}
            <input value={etiqueta} onChange={(e) => setEtiqueta(e.target.value.slice(0, 40))} placeholder="Etiqueta de origen"
              aria-label="Etiqueta de origen" style={{ ...campo, flex: '1 1 180px', minWidth: 150 }} />
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" onClick={onAtras} disabled={trayendo} style={btnAtras}>← Atrás</button>
          <span style={{ flex: 1 }} />
          {err && <span style={{ fontFamily: SANS, fontSize: 13, color: 'var(--bad)' }}>{err}</span>}
          {avance && <span style={{ fontFamily: SANS, fontSize: 13, color: 'var(--dim)' }}>{avance}</span>}
          <button type="button" disabled={trayendo || !listo} onClick={() => void traer()}
            style={{ padding: '11px 22px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14, fontWeight: 700, cursor: trayendo || !listo ? 'default' : 'pointer', opacity: trayendo || !listo ? 0.45 : 1 }}>
            {trayendo ? 'Trayendo…' : sel.size ? `Traer ${miles(sel.size)}` : 'Traer'}
          </button>
        </div>
      </div>
    </div>
  );
}

const btnAtras: CSSProperties = {
  flex: 'none', padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)',
  color: 'var(--ink)', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer',
};
