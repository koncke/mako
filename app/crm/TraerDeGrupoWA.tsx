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
import { TANDA_FICHAS, TANDA_GRUPO, TOPE_PERFILES_DIA, etapaPorDefecto, minutosDePerfiles, fichaLimpia, funnelPorDefecto, nombreDeFicha, type FichaWa, type GrupoWA, type ParticipanteWA } from '@/lib/grupo-wa-reglas';
import { extensionLeeFichas, motivoDeFichas, pedirFichasDeWhatsappWeb } from '@/lib/wa-fichas-cliente';
import { miles } from './traer-seleccion';
import { VistaConPie } from '@/app/_ui/VistaConPie';
import { Confirm } from '@/app/_ui';
import {
  abrirTraerDeGrupoAction, completarFichasDeGrupoAction, completarNombresDeGrupoAction, completarPerfilesDeGrupoAction, etapasDeFunnelAction, gruposDeLineaAction,
  participantesDeGrupoAction, traerDeGrupoAction,
} from './grupo-wa-actions';
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
  const [completando, setCompletando] = useState(false);
  /** «Datos de empresa»: la cuenta que se muestra en la pregunta antes de consultar (null = sin pregunta abierta), y si corre. */
  const [cuentaPerfiles, setCuentaPerfiles] = useState<{ pendientes: number; total: number; quedanHoy: number; estaCorrida: number } | null>(null);
  const [perfilando, setPerfilando] = useState(false);
  const pararPerfiles = useRef(false);
  /** «Completar desde mi WhatsApp» corriendo, y el pedido de parar (lo mira el bucle entre tandas). */
  const [leyendoWa, setLeyendoWa] = useState(false);
  const pararWa = useRef(false);
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
        // La principal, salvo que esté sin conectar y haya otra conectada (24/10/2026: una segunda línea a medio conectar
        // quedaba en la base «conectando» y es una opción muerta).
        setLinea((r.lineas.find((l) => l.conectada) ?? r.lineas[0])?.linea ?? null);
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
  const trayendo = avance != null || completando;
  /** ¿La extensión de este navegador lee las fichas de WhatsApp Web? (el atributo lo pone extension/mako-puente.js). */
  const extWa = extensionLeeFichas();
  const yaEstan = (gente ?? []).filter((p) => p.enElCrm).length;
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

  // «COMPLETAR NOMBRES» (24/10/2026, el Cerebro: traer ahora no puede impedir completar después). El listado del grupo no trae
  // nombres: los traídos nacen con su número. Esto les pone el que WhatsApp conozca hoy, sólo donde tienen el número; se puede
  // volver a tocar más adelante (quien escriba deja su nombre). No crea, no mueve, no le manda nada a nadie.
  const completar = async () => {
    if (!grupo || trayendo) return;
    setErr(null); setHecho(null); setCompletando(true);
    let completados = 0, sinNombre = 0;
    try {
      for (let vuelta = 0; vuelta < 10; vuelta++) {
        const r = await completarNombresDeGrupoAction({ linea, jid })
          .catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : 'error' }));
        if (!r.ok) { setErr(r.error); break; }
        completados += r.completados;
        sinNombre = r.sinNombre;
        if (!r.quedan) break;
      }
    } finally { setCompletando(false); }
    const cuantos = `${miles(completados)} ${completados === 1 ? 'nombre completado' : 'nombres completados'}`;
    const sin = sinNombre ? ` · ${miles(sinNombre)} todavía sin nombre en WhatsApp` : '';
    setHecho(`«${grupo.nombre}»: ${completados ? cuantos : 'ningún nombre nuevo'}${sin}.`);
    if (completados) { onTraidos(cuantos); setVuelta((n) => n + 1); }
  };

  // «COMPLETAR DESDE MI WHATSAPP» (24/10/2026, Martín: «con la extensión de MaKo... que se extraiga los nombres y la información
  // pública»). La extensión lee lo que SU WhatsApp Web ya guardó (sin clics, sin red, sin marcar nada como leído) sobre los que ya
  // están, y esto lo guarda de a tandas por el camino de completar. Lo dispara él, con avance y un «Parar».
  const leerDeWhatsappWeb = async () => {
    if (leyendoWa) { pararWa.current = true; return; }
    if (!grupo || trayendo) return;
    const tels = (gente ?? []).filter((p) => p.enElCrm).map((p) => p.telefono);
    if (!tels.length) return;
    setErr(null); setHecho(null); setLeyendoWa(true); pararWa.current = false;
    setAvance('Leyendo tu WhatsApp Web…');
    try {
      const r = await pedirFichasDeWhatsappWeb(tels);
      if (!r.ok) { setErr(motivoDeFichas(r.motivo)); return; }
      // Qué hay en su WhatsApp Web (nombres de tablas y cantidades, nunca datos de nadie): si WhatsApp cambia cómo guarda, esto
      // es lo que dice por qué no volvió nada.
      console.info('[wa-fichas]', r.diagnostico);
      if (r.diagnostico && !r.diagnostico.contactos) { setErr('No encontré contactos guardados en tu WhatsApp Web. Recarga esa pestaña, espera a que carguen tus chats y vuelve a tocar.'); return; }
      const fichas = r.fichas.map(fichaLimpia).filter((x): x is FichaWa => !!x);
      let nombres = 0, empresas = 0, guardadas = 0;
      // La cola, de a TANDA_FICHAS: lo que el server no llegó a guardar (`pendientes`, cortó por tiempo) vuelve al frente.
      let cola = fichas;
      while (cola.length && !pararWa.current) {
        const tanda = cola.slice(0, TANDA_FICHAS);
        setAvance(`Guardando ${miles(guardadas)} de ${miles(fichas.length)}…`);
        const g = await completarFichasDeGrupoAction({ linea, jid, fichas: tanda })
          .catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : 'error' }));
        if (!g.ok) { setErr(g.error); break; }
        nombres += g.nombres; empresas += g.empresas;
        const quedan = new Set(g.pendientes);
        const vuelven = tanda.filter((x) => quedan.has(x.telefono));
        // Sin avance (no guardó ninguna), se corta acá y se dice: nunca un bucle que no termina.
        if (vuelven.length === tanda.length) { setErr(`Se cortó guardando: quedaron ${miles(cola.length)} sin guardar. Vuelve a tocar para seguir.`); break; }
        guardadas += tanda.length - vuelven.length;
        cola = [...vuelven, ...cola.slice(tanda.length)];
      }
      // LA COBERTURA de lo gratis, sobre los que ya están: lo que su WhatsApp tiene de cada uno.
      const conNombre = fichas.filter((x) => !!nombreDeFicha(x)).length;
      const deEmpresa = fichas.filter((x) => x.esEmpresa).length;
      const enVarios = fichas.filter((x) => x.grupos.length >= 2).length;
      const parado = pararWa.current ? ' Paraste antes de terminar.' : '';
      setHecho(`«${grupo.nombre}»: de ${miles(tels.length)} que ya están, tu WhatsApp tiene el nombre de ${miles(conNombre)}, ${miles(deEmpresa)} son cuenta de empresa y ${miles(enVarios)} están en 2 o más grupos tuyos · ${miles(nombres)} nombres completados${empresas ? `, ${miles(empresas)} empresas` : ''}.${parado}`);
      if (nombres || empresas) { onTraidos(`${miles(nombres)} nombres desde tu WhatsApp`); setVuelta((n) => n + 1); }
    } finally { setLeyendoWa(false); setAvance(null); }
  };

  // «DATOS DE EMPRESA» (24/10/2026, Martín: «muchos no sólo tienen nombre, sino que incluso links»). Lo que dice el perfil de
  // empresa de WhatsApp de cada uno que ya está (web, Instagram, correo, dirección), sólo en lo vacío. No le llega nada a nadie.
  // Cada consulta es tráfico en la red de su línea: primero la CUENTA (cuántos faltan, cuántos hace esta vez y en cuánto, cuántos
  // quedan hoy), después la pregunta, y recién ahí consulta. Con tope por corrida y por día (lib/grupo-wa-reglas.ts).
  const contarPerfiles = async () => {
    // Para entre una llamada y la siguiente (cada una, hasta ~40 s): se dice, para que no parezca que no oyó.
    if (perfilando) { pararPerfiles.current = true; setAvance('Parando al terminar esta tanda…'); return; }
    if (!grupo || trayendo) return;
    setErr(null); setHecho(null); setCompletando(true); setAvance('Contando…');
    try {
      const c = await completarPerfilesDeGrupoAction({ linea, jid, soloContar: true })
        .catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : 'error' }));
      if (!c.ok) { setErr(c.error); return; }
      if (!c.pendientes) { setHecho(`«${grupo.nombre}»: ya se consultaron los ${miles(c.total)} que están.`); return; }
      if (!c.estaCorrida) { setErr(`Por hoy ya se hicieron las ${miles(TOPE_PERFILES_DIA)} consultas de esta línea. Mañana sigue con los ${miles(c.pendientes)} que faltan.`); return; }
      setCuentaPerfiles({ pendientes: c.pendientes, total: c.total, quedanHoy: c.quedanHoy, estaCorrida: c.estaCorrida });
    } finally { setCompletando(false); setAvance(null); }
  };

  const traerPerfiles = async () => {
    const cuenta = cuentaPerfiles;
    setCuentaPerfiles(null);
    if (!grupo || trayendo || !cuenta) return;
    setErr(null); setHecho(null); setCompletando(true); setPerfilando(true); pararPerfiles.current = false;
    let hechas = 0, empresas = 0, completados = 0, campos = 0, pendientes = cuenta.pendientes;
    let corte: 'dia' | 'corrida' | null = null;
    const saltear: string[] = [];
    try {
      // Cada vuelta es una llamada de ~40 s; el tope de la corrida lo pone `hechas`, así que esto termina solo.
      for (let vuelta = 0; vuelta < 20 && !pararPerfiles.current; vuelta++) {
        setAvance(`Revisando perfiles: ${miles(hechas)} de ${miles(cuenta.estaCorrida)}…`);
        const r = await completarPerfilesDeGrupoAction({ linea, jid, hechas, saltear })
          .catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : 'error' }));
        if (!r.ok) { setErr(r.error); break; }
        hechas += r.revisados; empresas += r.empresas; completados += r.completados; campos += r.campos;
        saltear.push(...r.sinRespuesta);
        pendientes = r.pendientes - (r.revisados - r.sinRespuesta.length);
        corte = r.corte;
        if (!r.sigue || r.revisados === 0) break;
      }
    } finally { setCompletando(false); setPerfilando(false); setAvance(null); }
    const datos = completados ? ` · ${miles(completados)} con datos nuevos (${miles(campos)} entre web, Instagram, correo y dirección)` : ' · ningún dato nuevo';
    const resto = pendientes <= 0 ? '' : corte === 'dia' ? ` Por hoy se terminaron las consultas de esta línea: mañana sigue con los ${miles(pendientes)} que faltan.`
      : ` Faltan ${miles(pendientes)}: vuelve a tocar «Datos de empresa» para seguir.`;
    const parado = pararPerfiles.current ? ' Paraste antes de terminar.' : '';
    setHecho(`«${grupo.nombre}»: ${miles(empresas)} de ${miles(hechas)} tienen cuenta de empresa${datos}.${resto}${parado}`);
    if (completados) { onTraidos(`${miles(completados)} con datos de empresa`); setVuelta((n) => n + 1); }
  };

  const opcionesLinea: DropdownOption[] = (lineas ?? []).map((l) => ({ value: l.linea, label: l.conectada ? l.etiqueta : `${l.etiqueta} · sin conectar` }));
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

  // El pie (el último renglón de `VistaConPie`): a dónde van, con qué etiqueta, y los botones.
  const pie = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
          {/* A los que YA están y nacieron con su número por nombre: el que WhatsApp conozca hoy (`completar`). */}
          {/* El camino por defecto (24/10/2026): las fichas de SU WhatsApp Web, por la extensión. Mientras corre, el mismo botón para. */}
          {yaEstan > 0 && extWa !== 'no' && (
            <button type="button" onClick={() => void leerDeWhatsappWeb()} disabled={(trayendo && !leyendoWa) || extWa === 'vieja'}
              title={extWa === 'vieja' ? 'Actualiza la extensión de MaKo para leer tu WhatsApp Web' : 'Nombre, empresa y grupos en común, de lo que ya ves en tu WhatsApp Web'}
              style={{ ...btnAtras, opacity: (trayendo && !leyendoWa) || extWa === 'vieja' ? 0.55 : 1 }}>
              {leyendoWa ? 'Parar' : extWa === 'vieja' ? 'Actualiza la extensión' : 'Completar desde mi WhatsApp'}
            </button>
          )}
          {yaEstan > 0 && extWa === 'no' && (
            <button type="button" onClick={() => void completar()} disabled={trayendo} style={{ ...btnAtras, opacity: trayendo ? 0.55 : 1 }}>
              {completando ? 'Completando…' : 'Completar nombres'}
            </button>
          )}
          {yaEstan > 0 && (
            <button type="button" onClick={() => void contarPerfiles()} disabled={trayendo && !perfilando} style={{ ...btnAtras, opacity: trayendo && !perfilando ? 0.55 : 1 }}>
              {perfilando ? 'Parar' : 'Datos de empresa'}
            </button>
          )}
          <span style={{ flex: 1 }} />
          {err && <span style={{ fontFamily: SANS, fontSize: 13, color: 'var(--bad)' }}>{err}</span>}
          {avance && <span style={{ fontFamily: SANS, fontSize: 13, color: 'var(--dim)' }}>{avance}</span>}
          <button type="button" disabled={trayendo || !listo} onClick={() => void traer()}
            style={{ padding: '11px 22px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14, fontWeight: 700, cursor: trayendo || !listo ? 'default' : 'pointer', opacity: trayendo || !listo ? 0.45 : 1 }}>
            {avance != null ? 'Trayendo…' : sel.size ? `Traer ${miles(sel.size)}` : 'Traer'}
          </button>
        </div>
    </div>
  );

  // ⚠️ LA LISTA SCROLLEA, EL PIE NO (24/10/2026, Martín: «los botones de abajo no pueden estar a la mitad y que abajo se
  // sigan viendo leads»): `VistaConPie`, la misma pieza que «Traer de otro funnel» (ver app/_ui/VistaConPie.tsx).
  return (
    <VistaConPie
      lista={{ border: '1px solid var(--border)', borderRadius: 12 }}
      cabecera={(
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {lineas && lineas.length > 1 && (
          <Dropdown value={linea ?? ''} options={opcionesLinea} onChange={(v) => setLinea(v)} ariaLabel="De qué línea" width={200} />
        )}
        <Dropdown value={jid} options={opcionesGrupo} onChange={elegirGrupo} ariaLabel="De qué grupo" width={300} />
        {!!gente?.length && (
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o teléfono" style={{ ...campo, flex: '1 1 200px', minWidth: 160 }} />
        )}
      </div>
      )}
      pie={pie}
    >
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
      {cuentaPerfiles && (
        <Confirm tone="primary" title="¿Traer los datos de empresa?" confirmLabel={`Consultar ${miles(cuentaPerfiles.estaCorrida)}`}
          message={`Faltan ${miles(cuentaPerfiles.pendientes)} de los ${miles(cuentaPerfiles.total)} que ya están. Ahora se consultan ${miles(cuentaPerfiles.estaCorrida)}, de a uno: unos ${minutosDePerfiles(cuentaPerfiles.estaCorrida)} min.${cuentaPerfiles.estaCorrida < cuentaPerfiles.pendientes ? ` Los otros ${miles(cuentaPerfiles.pendientes - cuentaPerfiles.estaCorrida)}, en otra vuelta.` : ''} Hoy quedan ${miles(cuentaPerfiles.quedanHoy)} de ${miles(TOPE_PERFILES_DIA)} consultas en esta línea. Sólo se completa lo vacío, y no les llega nada.`}
          onConfirm={() => void traerPerfiles()} onCancel={() => setCuentaPerfiles(null)} />
      )}
    </VistaConPie>
  );
}

const btnAtras: CSSProperties = {
  flex: 'none', padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)',
  color: 'var(--ink)', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer',
};
