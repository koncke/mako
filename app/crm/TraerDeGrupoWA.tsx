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
//     elige el siguiente. Nunca duplica, y el que ya está en el CRM no se vuelve a cargar: va abajo, en gris (24/10/2026).
// ⚠️ DE A TANDAS (`TANDA_GRUPO`): un grupo llega a 1.024 personas y cada lead son varias escrituras; una acción tiene 60 s.

import { Fragment, useEffect, useEffectEvent, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Dropdown, type DropdownOption } from '@/app/components/Dropdown';
import { TANDA_GRUPO, TOPE_PERFILES_DIA, etapaPorDefecto, minutosDePerfiles, fichaLimpia, funnelPorDefecto, type FichaWa, type GrupoWA, type ParticipanteWA } from '@/lib/grupo-wa-reglas';
import { correrPerfiles, guardarFichasEnTandas, preguntaDePerfiles, resumenDeFichas, resumenDePerfiles, type AvancePerfiles } from './enriquecer-cliente';
import { motivoDeFichas, pedirFichasDeWhatsappWeb } from '@/lib/wa-fichas-cliente';
import { useExtensionFichas } from './usar-extension-fichas';
import { miles } from './traer-seleccion';
import { CAMPO_TRAER, MoldeTraer, type OpcionMas } from './MoldeTraer';
import { Confirm } from '@/app/_ui';
import {
  abrirTraerDeGrupoAction, completarFichasDeGrupoAction, completarPerfilesDeGrupoAction, etapasDeFunnelAction, gruposDeLineaAction,
  participantesDeGrupoAction, traerDeGrupoAction,
} from './grupo-wa-actions';
import type { LineaGrupos } from './grupo-wa-server';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";
const th: CSSProperties = { textAlign: 'left', fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 600, padding: '0 10px 7px', whiteSpace: 'nowrap' };
const td: CSSProperties = { padding: '9px 10px', fontFamily: SANS, fontSize: 13.5, color: 'var(--ink)', borderTop: '1px solid var(--border)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
/** El renglón que separa a los que ya están: chico, en mayúsculas, como la cabecera de la tabla. */
const grisRotulo: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 600, background: 'var(--surface-2)', padding: '8px 12px' };
const nota: CSSProperties = { fontFamily: SANS, fontSize: 13.5, color: 'var(--dim)', padding: '22px 14px', margin: 0 };

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
  /** «Completar nombres» sin la extensión: 'pide' = el pie dice «Instala la extensión»; 'fue' = tocó «Instalar». Al aparecer
   *  la extensión en esta pestaña, arranca sola. */
  const [esperaExt, setEsperaExt] = useState<'pide' | 'fue' | null>(null);
  /** Recién trajo: el pie ofrece completar (f11, Leandro no encontró «Completar» en el «⋯»). */
  const [trasTraer, setTrasTraer] = useState(false);
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
  // ⚠️ EN DOS TIEMPOS (25/10/2026, «el cargar los grupos, tarda muchísimo»; medido: la lista completa de WhatsApp, 33 s con 285
  // grupos): primero lo guardado de la última vez (o los de la base, al instante) y, si hace falta, la completa por detrás. Al
  // llegar reemplaza la lista sin tocar el grupo elegido.
  const [buscandoTodos, setBuscandoTodos] = useState(false);
  useEffect(() => {
    if (!linea) return;
    let vivo = true;
    setGrupos(null); setJid(''); setGente(null); setSel(new Set()); setErr(null); setBuscandoTodos(false);
    void gruposDeLineaAction(linea).then((r) => {
      if (!vivo) return;
      if (!r.ok) { setErr(r.error); setGrupos([]); return; }
      setGrupos(r.grupos);
      if (!r.refrescar) return;
      setBuscandoTodos(true);
      void gruposDeLineaAction(linea, true).then((c) => { if (vivo && c.ok) setGrupos(c.grupos); })
        .catch(() => {}).finally(() => { if (vivo) setBuscandoTodos(false); });
    }).catch(() => { if (vivo) { setErr('WhatsApp no contestó.'); setGrupos([]); } });
    return () => { vivo = false; };
  }, [linea]);

  // Los participantes del grupo elegido: tildados SÓLO los que todavía no son leads (a eso se vino). Los que ya están no se
  // traen de nuevo (Martín, 24/10/2026: «si ya cargué un grupo o detecta que esos números ya están, no me debe cargar
  // nuevamente... Debería aparecer en gris abajo de todo»): van al final, en gris y sin casilla.
  useEffect(() => {
    if (!jid) return;
    let vivo = true;
    setGente(null); setErr(null);
    void participantesDeGrupoAction(linea, jid).then((r) => {
      if (!vivo) return;
      if (!r.ok) { setErr(r.error); setGente([]); return; }
      setGente(r.participantes);
      setSinNumero(r.sinNumero);
      setSel(new Set(r.participantes.filter((p) => !p.enElCrm).map((p) => p.telefono)));
    }).catch(() => { if (vivo) { setErr('No pude leer el grupo.'); setGente([]); } });
    return () => { vivo = false; };
  }, [jid, linea, vuelta]);

  const grupo = grupos?.find((g) => g.jid === jid) ?? null;
  const elegirGrupo = (v: string) => {
    setJid(v); setQ(''); setHecho(null);
    setEtiqueta(grupos?.find((g) => g.jid === v)?.nombre.slice(0, 40) ?? '');
  };
  // Los nuevos arriba (en el orden del grupo) y los que ya están, abajo: lo repetido no ocupa el lugar de lo nuevo. Él va a traer
  // grupo tras grupo y la mayoría se superpone.
  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    const dig = t.replace(/\D/g, '');
    const pasan = (gente ?? []).filter((p) => !t || (p.nombre ?? '').toLowerCase().includes(t) || (!!dig && p.telefono.includes(dig)));
    return [...pasan.filter((p) => !p.enElCrm), ...pasan.filter((p) => p.enElCrm)];
  }, [gente, q]);
  const nuevos = (gente ?? []).filter((p) => !p.enElCrm);
  const todos = nuevos.length > 0 && nuevos.every((p) => sel.has(p.telefono));
  const sinOfrecer = etapas.filter((e) => e.manda).length;
  const usables = etapas.filter((e) => !e.manda);
  const trayendo = avance != null || completando;
  /** ¿La extensión de este navegador lee las fichas de WhatsApp Web? (el atributo lo pone extension/mako-puente.js). En vivo. */
  const extWa = useExtensionFichas();
  const yaEstan = (gente ?? []).filter((p) => p.enElCrm).length;
  const listo = !!grupo && !!etapa && sel.size > 0 && !!etiqueta.trim() && funnel != null;

  const alternar = (p: Participante) => {
    if (p.enElCrm) return; // ya está: no se trae, no se tilda
    setSel((s) => { const n = new Set(s); if (n.has(p.telefono)) n.delete(p.telefono); else n.add(p.telefono); return n; });
  };
  const traer = async () => {
    if (!grupo || !listo) return;
    setErr(null); setHecho(null); setTrasTraer(false); setEsperaExt(null);
    // Sólo los nuevos, aunque algo los haya tildado: un lead que ya está no se vuelve a cargar.
    const yaEnElCrm = new Set((gente ?? []).filter((p) => p.enElCrm).map((p) => p.telefono));
    const tels = [...sel].filter((t) => !yaEnElCrm.has(t));
    let creados = 0, sumados = 0, yaEstaban = 0, salteados = 0, hechos = 0;
    const errores: string[] = [];
    // Por qué se cortó. Va al resumen y no a `err`: el grupo se relee al terminar y eso limpia `err` en el acto, o sea que el
    // corte se borraba sin que nadie lo viera (la revisión del 24/10/2026).
    let corte = '';
    // De a tandas; lo que una no llegó a traer (cortó por tiempo) vuelve a la cola, adelante.
    const cola = [...tels];
    while (cola.length) {
      const tanda = cola.splice(0, TANDA_GRUPO);
      setAvance(`Trayendo ${miles(Math.min(hechos + tanda.length, tels.length))} de ${miles(tels.length)}…`);
      const r = await traerDeGrupoAction({ linea, jid, nombreGrupo: grupo.nombre, funnelId: funnel, etapa, etiqueta: etiqueta.trim(), telefonos: tanda })
        .catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : 'error' }));
      if (!r.ok) { if (!creados && !sumados && !yaEstaban) { setErr(r.error); setAvance(null); return; } corte = r.error; break; }
      creados += r.creados; sumados += r.sumados; yaEstaban += r.yaEstaban; salteados += r.salteados; errores.push(...r.errores);
      hechos += tanda.length - r.pendientes.length;
      if (r.pendientes.length >= tanda.length) { corte = 'WhatsApp está tardando.'; break; }
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
    const cola2 = corte ? ` Se cortó: ${corte} Quedaron ${miles(tels.length - hechos)} sin traer: vuelve a tocar «Traer» para seguir.` : ' Elige otro grupo para seguir.';
    setHecho(`«${grupo.nombre}»: ${resumen}.${fallidos}${cola2}`);
    setTrasTraer(true);
    onTraidos(resumen);
    setVuelta((n) => n + 1);
  };

  // «COMPLETAR DESDE MI WHATSAPP» (24/10/2026, Martín: «con la extensión de MaKo... que se extraiga los nombres y la información
  // pública»). La extensión lee lo que SU WhatsApp Web ya guardó (sin clics, sin red, sin marcar nada como leído) sobre los que ya
  // están, y esto lo guarda de a tandas por el camino de completar. Lo dispara él, con avance y un «Parar».
  const leerDeWhatsappWeb = async () => {
    if (leyendoWa) { pararWa.current = true; return; }
    if (!grupo || trayendo) return;
    const tels = (gente ?? []).filter((p) => p.enElCrm).map((p) => p.telefono);
    if (!tels.length) return;
    setErr(null); setHecho(null); setTrasTraer(false); setLeyendoWa(true); pararWa.current = false;
    setAvance('Leyendo tu WhatsApp Web…');
    try {
      const r = await pedirFichasDeWhatsappWeb(tels);
      if (!r.ok) { setErr(motivoDeFichas(r.motivo)); return; }
      // Qué hay en su WhatsApp Web (nombres de tablas y cantidades, nunca datos de nadie): si WhatsApp cambia cómo guarda, esto
      // es lo que dice por qué no volvió nada.
      console.info('[wa-fichas]', r.diagnostico);
      if (r.diagnostico && !r.diagnostico.contactos) { setErr('No encontré contactos guardados en tu WhatsApp Web. Recarga esa pestaña, espera a que carguen tus chats y vuelve a tocar.'); return; }
      const fichas = r.fichas.map(fichaLimpia).filter((x): x is FichaWa => !!x);
      // La misma máquina que la barra de lote del tablero (./enriquecer-cliente.ts): tandas, pendientes al frente, «Parar».
      const a = await guardarFichasEnTandas(fichas, (tanda) => completarFichasDeGrupoAction({ linea, jid, fichas: tanda }), {
        parar: () => pararWa.current,
        alAvanzar: (guardadas, total) => setAvance(`Guardando ${miles(guardadas)} de ${miles(total)}…`),
      });
      // El corte va adentro del resumen: releer el grupo (`setVuelta`) limpia `err`, y ahí se perdía.
      setHecho(`«${grupo.nombre}»: ${resumenDeFichas(tels.length, fichas, a)}`);
      if (a.nombres || a.empresas) { onTraidos(`${miles(a.nombres)} nombres desde tu WhatsApp`); setVuelta((n) => n + 1); }
    } finally { setLeyendoWa(false); setAvance(null); }
  };

  // «COMPLETAR NOMBRES» VA POR LA EXTENSIÓN (25/10/2026). Martín en la llamada con Leandro (24/10, f12): «En completar nombres,
  // si no tenés instalada la extensión de Maco (...) eso es un bug (...) ese botón te debería decir instala la extensión de
  // Maco y que ahí directamente comience». Sin ella, el server le pedía a WhatsApp el nombre que conociera y completaba
  // «algunos o ninguno» sin decir por qué (`completarNombresDelGrupo` sigue, para la API de MaKo). Ahora: con la extensión,
  // lo de SU WhatsApp Web; sin ella (o vieja), el pie lo dice con «Instalar», y arranca SOLA cuando la extensión aparece en
  // esta pestaña.
  const completarNombres = () => {
    if (!grupo || trayendo) return;
    setTrasTraer(false);
    if (extWa === 'si') { setEsperaExt(null); void leerDeWhatsappWeb(); return; }
    setErr(null); setHecho(null); setEsperaExt('pide');
  };
  const arrancarAlInstalar = useEffectEvent(() => { setEsperaExt(null); void leerDeWhatsappWeb(); });
  useEffect(() => { if (esperaExt && extWa === 'si') arrancarAlInstalar(); }, [esperaExt, extWa]);

  // «DATOS DE EMPRESA» (24/10/2026, Martín: «muchos no sólo tienen nombre, sino que incluso links»). Lo que dice el perfil de
  // empresa de WhatsApp de cada uno que ya está (web, Instagram, correo, dirección), sólo en lo vacío. No le llega nada a nadie.
  // Cada consulta es tráfico en la red de su línea: primero la CUENTA (cuántos faltan, cuántos hace esta vez y en cuánto, cuántos
  // quedan hoy), después la pregunta, y recién ahí consulta. Con tope por corrida y por día (lib/grupo-wa-reglas.ts).
  const contarPerfiles = async () => {
    // Para entre una llamada y la siguiente (cada una, hasta ~40 s): se dice, para que no parezca que no oyó.
    if (perfilando) { pararPerfiles.current = true; setAvance('Parando al terminar esta tanda…'); return; }
    if (!grupo || trayendo) return;
    setErr(null); setHecho(null); setTrasTraer(false); setCompletando(true); setAvance('Contando…');
    try {
      const c = await completarPerfilesDeGrupoAction({ linea, jid, soloContar: true })
        .catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : 'error' }));
      if (!c.ok) { setErr(c.error); return; }
      if (!c.pendientes) { setHecho(`«${grupo.nombre}»: ya se consultaron los ${miles(c.total)} que están.`); return; }
      if (!c.estaCorrida) { setErr(`Hoy ya se hicieron las ${miles(TOPE_PERFILES_DIA)} consultas de esta línea (cuidan tu WhatsApp de un bloqueo). Faltan ${miles(c.pendientes)}: tócalo mañana.`); return; }
      setCuentaPerfiles({ pendientes: c.pendientes, total: c.total, quedanHoy: c.quedanHoy, estaCorrida: c.estaCorrida });
    } finally { setCompletando(false); setAvance(null); }
  };

  const traerPerfiles = async () => {
    const cuenta = cuentaPerfiles;
    setCuentaPerfiles(null);
    if (!grupo || trayendo || !cuenta) return;
    setErr(null); setHecho(null); setCompletando(true); setPerfilando(true); pararPerfiles.current = false;
    let a: AvancePerfiles;
    try {
      // La misma máquina que la barra de lote del tablero (./enriquecer-cliente.ts): suma `hechas`, saltea a los que no
      // contestaron, para con «Parar» y dice por qué no siguió.
      a = await correrPerfiles(cuenta, (hechas, saltear) => completarPerfilesDeGrupoAction({ linea, jid, hechas, saltear }), {
        parar: () => pararPerfiles.current,
        alAvanzar: (hechas, meta) => setAvance(`Revisando perfiles: ${miles(hechas)} de ${miles(meta)}…`),
      });
    } finally { setCompletando(false); setPerfilando(false); setAvance(null); }
    setHecho(`«${grupo.nombre}»: ${resumenDePerfiles(a)}`);
    if (a.completados) { onTraidos(`${miles(a.completados)} con datos de empresa`); setVuelta((n) => n + 1); }
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

  // ⚠️ EL MOLDE DE LOS TRES (24/10/2026, ./MoldeTraer.tsx, copiado del «Preview import» de Attio). Martín, sobre ESTE pie:
  // «mira la captura la cantidad de botones que tienen, no se entiende nada» (PROSPECCIÓN / Círculo TIBIO / el grupo /
  // ← Atrás / Completar desde mi WhatsApp / Datos de empresa / Traer 131). Ahora:
  //   · de dónde (línea, grupo, buscar) arriba, y lo que trabaja sobre los que YA están —completar desde WhatsApp, los
  //     nombres, los datos de empresa— en el «⋯» de esa fila: no es el camino principal;
  //   · a dónde («Entran a»: funnel, etapa y etiqueta) en la fila de abajo;
  //   · lo que va a pasar, en números, en la línea de resumen (el Cerebro, 24/10: «que diga "traigo 86; 135 ya estaban"»), y
  //     «No les manda nada» siempre (23/10: ni al traerlos, ni después por su cuenta, `quedaDondeLoPusieron`);
  //   · abajo, sólo «Atrás» y «Traer N»; a la izquierda, lo que está pasando, con su «Parar» si es algo que corre.
  // La lista sigue siendo lo único que scrollea (`VistaConPie`, 24/10: «los botones de abajo no pueden estar a la mitad»).
  const mas: OpcionMas[] = trayendo || !yaEstan ? [] : [
    // El camino por defecto (24/10/2026): las fichas de SU WhatsApp Web, por la extensión. Con una extensión vieja no se ofrece.
    ...(extWa === 'si' ? [{ id: 'wa', texto: 'Completar desde mi WhatsApp', icono: 'whatsapp' as const, onElegir: () => void leerDeWhatsappWeb() }] : []),
    // Sin la extensión (o vieja): el mismo camino, que primero pide instalarla y después arranca solo (f12, 25/10/2026).
    ...(extWa !== 'si' ? [{ id: 'nombres', texto: 'Completar nombres', icono: 'persona' as const, onElegir: completarNombres }] : []),
    { id: 'empresa', texto: 'Datos de empresa', icono: 'cliente', onElegir: () => void contarPerfiles() },
  ];
  // Lo que corre se para desde el pie: el mismo llamado que lo arrancó (cada uno se para si ya corre).
  const parar = leyendoWa ? { texto: 'Parar', onClick: () => void leerDeWhatsappWeb() }
    : perfilando ? { texto: 'Parar', onClick: () => void contarPerfiles() } : undefined;
  // «Completar» se ve sin abrir el «⋯» (Leandro, f11: «Ah, no lo vi eso»): en el pie, después de traer y cuando hay gente
  // que ya está y nada más que decir.
  const completarAca = { texto: 'Completar nombres', onClick: completarNombres };
  const instalar = { texto: extWa === 'vieja' ? 'Actualizar' : 'Instalar', onClick: () => { setEsperaExt('fue'); window.open('/extension/instalar', '_blank', 'noopener'); } };
  const ofrecer = !trayendo && yaEstan > 0;
  const estado = err ? { texto: err, tono: 'mal' as const }
    : avance ? { texto: avance, tono: 'neutro' as const, ...(parar ? { accion: parar } : {}) }
    : esperaExt === 'pide' ? { texto: `${extWa === 'vieja' ? 'Actualiza' : 'Instala'} la extensión de MaKo para completar los nombres.`, tono: 'neutro' as const, accion: instalar }
    : esperaExt === 'fue' ? { texto: 'Cuando la extensión esté, empieza sola. Si no arranca, recarga esta pestaña.', tono: 'neutro' as const }
    : hecho ? { texto: hecho, tono: 'ok' as const, ...(trasTraer && ofrecer ? { accion: completarAca } : {}) }
    : buscandoTodos ? { texto: 'Buscando el resto de tus grupos…', tono: 'neutro' as const }
    : ofrecer ? { texto: `${miles(yaEstan)} ya ${yaEstan === 1 ? 'está' : 'están'} en tu CRM.`, tono: 'neutro' as const, accion: completarAca }
    : null;

  return (
    <MoldeTraer
      mas={mas}
      estado={estado}
      atras={{ onClick: onAtras, deshabilitado: trayendo }}
      accion={{ texto: avance != null && !leyendoWa && !perfilando ? 'Trayendo…' : sel.size ? `Traer ${miles(sel.size)}` : 'Traer', onClick: () => void traer(), deshabilitado: trayendo || !listo }}
      resumen={gente?.length ? {
        texto: `${miles(sel.size)} para traer`,
        chips: [
          ...(yaEstan ? [{ texto: `${miles(yaEstan)} ya ${yaEstan === 1 ? 'está' : 'están'}`, tono: 'gris' as const }] : []),
          ...(sinNumero ? [{ texto: `${miles(sinNumero)} sin número`, tono: 'gris' as const }] : []),
          { texto: 'No les manda nada', tono: 'gris' as const },
        ],
      } : undefined}
      destino={gente?.length ? (
        <>
          {productos.length > 1 && <Dropdown value={String(funnel ?? '')} options={opcionesFunnel} onChange={(v) => setFunnel(Number(v))} ariaLabel="A qué funnel" width={200} />}
          {opcionesEtapa.length
            ? <Dropdown value={etapa} options={opcionesEtapa} onChange={setEtapa} ariaLabel="A qué etapa" width={180} />
            : <span style={{ fontFamily: SANS, fontSize: 13, color: 'var(--bad)' }}>Ninguna etapa de este funnel se puede usar al traer.</span>}
          <input value={etiqueta} onChange={(e) => setEtiqueta(e.target.value.slice(0, 40))} placeholder="Etiqueta de origen"
            aria-label="Etiqueta de origen" style={{ ...CAMPO_TRAER, flex: '1 1 180px', minWidth: 150 }} />
          {/* Las que mandan algo o cierran el trato no se ofrecen: dicho UNA vez, corto, donde se elige. */}
          {sinOfrecer > 0 && <span style={{ fontFamily: SANS, fontSize: 12, color: 'var(--faint)' }}>Sin las etapas que mandan algo</span>}
        </>
      ) : undefined}
      fuente={(
      <>
        {lineas && lineas.length > 1 && (
          <Dropdown value={linea ?? ''} options={opcionesLinea} onChange={(v) => setLinea(v)} ariaLabel="De qué línea" width={200} />
        )}
        <Dropdown value={jid} options={opcionesGrupo} onChange={elegirGrupo} ariaLabel="De qué grupo" width={300} />
        {!!gente?.length && (
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o teléfono" aria-label="Buscar" style={{ ...CAMPO_TRAER, flex: '1 1 200px', minWidth: 160 }} />
        )}
      </>
      )}
    >
        {!!gente?.length && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
              <tr>
                <th style={{ ...th, width: 34, padding: '10px 0 7px 12px' }}>
                  {nuevos.length > 0 && (
                    <input type="checkbox" checked={todos} onChange={() => setSel(todos ? new Set() : new Set(nuevos.map((p) => p.telefono)))}
                      aria-label={`Tildar a los ${miles(nuevos.length)} nuevos`} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)' }} />
                  )}
                </th>
                <th style={th}>Nombre</th>
                <th style={th}>Teléfono</th>
                <th style={th}>En el CRM</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((p, i) => {
                // LOS QUE YA ESTÁN: en gris, sin casilla, sin clic. Encabezados por un renglón que dice cuántos y que no se traen.
                if (p.enElCrm) {
                  const primero = i === 0 || !visibles[i - 1].enElCrm;
                  return (
                    <Fragment key={p.telefono}>
                      {primero && (
                        <tr data-ya-estan>
                          <td colSpan={4} style={{ ...td, ...grisRotulo }}>
                            {`Ya están en tu CRM · ${miles(yaEstan)} · no se traen`}
                          </td>
                        </tr>
                      )}
                      <tr data-ya-esta style={{ cursor: 'default' }}>
                        <td style={{ ...td, padding: '9px 0 9px 12px' }} />
                        <td style={{ ...td, color: 'var(--faint)' }}>{p.nombre ?? '—'}</td>
                        <td style={{ ...td, color: 'var(--faint)', fontFamily: MONO, fontSize: 12.5 }}>+{p.telefono}</td>
                        <td style={{ ...td, color: 'var(--faint)' }}>Ya está</td>
                      </tr>
                    </Fragment>
                  );
                }
                const on = sel.has(p.telefono);
                return (
                  <tr key={p.telefono} onClick={() => alternar(p)} style={{ cursor: 'pointer', background: on ? 'var(--primary-weak)' : 'transparent' }}>
                    <td style={{ ...td, padding: '9px 0 9px 12px' }}>
                      <input type="checkbox" checked={on} readOnly tabIndex={-1} aria-label={`Traer a ${p.nombre ?? `+${p.telefono}`}`}
                        style={{ width: 16, height: 16, accentColor: 'var(--primary)', pointerEvents: 'none' }} />
                    </td>
                    <td style={{ ...td, fontWeight: 600 }}>{p.nombre ?? '—'}</td>
                    <td style={{ ...td, color: 'var(--dim)', fontFamily: MONO, fontSize: 12.5 }}>+{p.telefono}</td>
                    <td style={td} />
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
          message={preguntaDePerfiles(cuentaPerfiles, minutosDePerfiles(cuentaPerfiles.estaCorrida))}
          onConfirm={() => void traerPerfiles()} onCancel={() => setCuentaPerfiles(null)} />
      )}
    </MoldeTraer>
  );
}

const btnAtras: CSSProperties = {
  flex: 'none', padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)',
  color: 'var(--ink)', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer',
};
