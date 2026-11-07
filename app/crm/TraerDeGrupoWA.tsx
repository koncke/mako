'use client';

// =============================================================================
// TraerDeGrupoWA — «Extraer de un grupo de WhatsApp»: sus contactos, al CRM (23/10/2026; «Extraer», 26/10/2026)
// =============================================================================
// Martín, en la llamada del 23/10 (min 37:27): «una automatización que te agrega de un grupo de WhatsApp, te pone todos los
// números y los contactos en tu CRM de manera automática... sí o sí lo tengo que tener para mañana». El molde es «Traer de
// otro funnel» (./TraerDeOtroProducto.tsx): reemplaza al alta con su «Atrás», la tabla con su cabecera pegada y el pie pegado
// abajo con el botón. Lo que hace, y sus cuidados (no manda nada, nunca duplica, sólo el admin), en ./grupo-wa-server.ts.
// ⚠️ DESDE EL 26/10/2026 ES «EXTRAER», Y HACE TODO DE UNA. Martín: «El botón azul debe ser "Extraer" no "Traer". Y al darle a
// "Extraer" automáticamente que comience la extensión, que se vea toda la animación... Quiero que al extraer de WhatsApp en
// el CRM, automáticamente ejecute esto. Que no me diga "Completar nombres". No quiero las opciones "Entran a", siempre en el
// CRM en el que estoy parado y en la primera etapa de lead entrante. Y tampoco quiero cambiar el nombre del grupo, que se
// llame exactamente igual. Falta un botón, sutil de "Ignorar Admins". Elimina los textos innecesarios... Y al agregarse al
// CRM siempre con una etiqueta con el nombre del grupo donde vinieron. Con las etiquetas que ya existen.» Entonces:
//   · entran al CRM que se mira (`destino`), a su primera etapa que no manda nada (`entrada` del server: «Lead entrante»),
//     con la etiqueta que se llama como el grupo (la que ya existe con ese nombre, o una nueva);
//   · «Extraer» arranca la extensión EN EL ACTO (a la vista: la pestaña de WhatsApp al frente, el desplegable con el avance)
//     mientras se crean los leads, y los nombres que encuentra se guardan solos: no hay «Completar nombres»;
//   · el avance y el final van a la extensión (`avisarExtraccion`) y a ./ExtraccionModal.tsx, encima de esto (30/10/2026: «sigue
//     abierto el modal del scraper previo a darle "extraer" eso hace pensar que nunca se extrajo nada»).
// Sirve para VARIOS grupos seguidos: al terminar bien, la lista queda para elegir el siguiente; si se cortó, el grupo se relee y
// se puede volver a tocar «Extraer». Nunca duplica, y el que ya está en el CRM no se vuelve a cargar: va abajo, en gris (24/10/2026).
// ⚠️ DE A TANDAS (`TANDA_GRUPO`): un grupo llega a 1.024 personas y cada lead son varias escrituras; una acción tiene 60 s.

import { Fragment, useEffect, useEffectEvent, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Dropdown, type DropdownOption } from '@/app/components/Dropdown';
import { TANDA_GRUPO, etiquetaDeGrupo, fichaLimpia, minutosDeLaPasada, type FichaWa, type GrupoWA, type ParticipanteWA } from '@/lib/grupo-wa-reglas';
import { guardarFichasEnTandas, type AvanceFichas } from './enriquecer-cliente';
import { VERSION_FICHAS, alPararExtraccion, avisarExtraccion, enfocarWhatsappWeb, motivoDeFichas, nuevoIdExtraccion, pedirFichasDeWhatsappWeb, perfilesEnTandas } from '@/lib/wa-fichas-cliente';
import { lineaDeVersion } from '@/lib/extension-tienda';
import { avanzarExtraccion, empezarExtraccion, resultadoDeExtraccion, terminarExtraccion } from '@/lib/extraccion-estado';
import { useExtensionFichas } from './usar-extension-fichas';
import { miles } from './traer-seleccion';
import { CAMPO_TRAER, MoldeTraer, type OpcionMas } from './MoldeTraer';
import { Confirm } from '@/app/_ui';
import {
  abrirTraerDeGrupoAction, completarFichasDeGrupoAction, gruposDeLineaAction,
  participantesDeGrupoAction, traerDeGrupoAction,
} from './grupo-wa-actions';
import type { LineaGrupos } from './grupo-wa-server';
import { ROTULO_PASAR_A_PRO } from '@/lib/plan-esencial-reglas';
import { CtaPasarAPro } from '@/app/_components/CtaPasarAPro';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";
const th: CSSProperties = { textAlign: 'left', fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 600, padding: '0 10px 7px', whiteSpace: 'nowrap' };
const td: CSSProperties = { padding: '9px 10px', fontFamily: SANS, fontSize: 13.5, color: 'var(--ink)', borderTop: '1px solid var(--border)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
/** El renglón que separa a los que ya están: chico, en mayúsculas, como la cabecera de la tabla. */
const grisRotulo: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 600, background: 'var(--surface-2)', padding: '8px 12px' };
const nota: CSSProperties = { fontFamily: SANS, fontSize: 13.5, color: 'var(--dim)', padding: '22px 14px', margin: 0 };
/** «admin», al lado del nombre: chico y gris. */
const marcaAdmin: CSSProperties = { marginLeft: 8, fontFamily: MONO, fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 600 };

/** «Ignorar admins» se recuerda en este navegador (quien lo usa, lo usa grupo tras grupo). */
const CLAVE_SIN_ADMINS = 'mako.extraer.sinAdmins';
const leerSinAdmins = () => { try { return window.localStorage.getItem(CLAVE_SIN_ADMINS) === '1'; } catch { return false; } };

type Participante = ParticipanteWA & { enElCrm: boolean };
type Etapa = { key: string; label: string; manda: boolean };

export function TraerDeGrupoWA({ destino, onAtras, onTraidos, onCerrar }: {
  /** El funnel que se mira: ahí entran (`null` = el del negocio). Martín, 26/10: «siempre en el CRM en el que estoy parado». */
  destino: number | null;
  /** Volver al alta. No cierra el modal. */
  onAtras: () => void;
  /** Terminó UN grupo: el padre relee el tablero (el modal sigue abierto para el siguiente). */
  onTraidos: (resumen: string) => void;
  /** Cierra el modal entero: el «Ver en el CRM» del cartel de éxito (Leila, 26/10/2026). */
  onCerrar?: () => void;
}) {
  const funnel = destino;
  const [lineas, setLineas] = useState<LineaGrupos[] | null>(null);
  /** La etapa a la que entran: la primera del funnel que no manda nada (la de entrada, «Lead entrante»). */
  const [entrada, setEntrada] = useState<Etapa | null>(null);
  const [linea, setLinea] = useState<string | null>(null);
  const [grupos, setGrupos] = useState<GrupoWA[] | null>(null);
  const [jid, setJid] = useState('');
  const [gente, setGente] = useState<Participante[] | null>(null);
  const [sinNumero, setSinNumero] = useState(0);
  const [sel, setSel] = useState<ReadonlySet<string>>(new Set());
  const [q, setQ] = useState('');
  const [err, setErr] = useState<string | null>(null);
  /** El candado de Pro: a dónde lleva «Pasar a Pro» (null = no hay candado). */
  const [pasarAPro, setPasarAPro] = useState<string | null>(null);
  const [avance, setAvance] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  /** El último «Extraer» trajo algo: el cartel ofrece «Ver en el CRM». */
  const [verCrm, setVerCrm] = useState(false);
  /** Cuántos grupos tiene la línea, cuando ya llegó la lista COMPLETA (Leila, 26/10/2026: que «Cargando grupos…» avise). */
  const [todosGrupos, setTodosGrupos] = useState<number | null>(null);
  /** Cada vuelta relee el grupo (después de extraer, los traídos pasan a «Ya está»). */
  const [vuelta, setVuelta] = useState(0);
  /** «Datos de empresa»: de cuántos, en la pregunta antes de arrancar (null = sin pregunta abierta). */
  const [pideEmpresa, setPideEmpresa] = useState<number | null>(null);
  /** «Extraer» corriendo, y el pedido de parar (lo mira cada tanda; llega del pie o del «Parar» del desplegable). */
  const [extrayendo, setExtrayendo] = useState(false);
  const parar = useRef(false);
  /** SIN LA EXTENSIÓN (o vieja) «Extraer» NO ARRANCA (Martín, 26/10/2026: «si no tiene la extensión que no lo deje
   *  scrapear, que le salte el pop-up para instalar la extensión»): `pideExt` abre el pop-up; tocó «Instalar» → 'fue', y al
   *  aparecer la extensión en esta pestaña la extracción arranca sola. Antes traía los leads sin nombres y pedía la extensión
   *  después (a Leandro le pasó con una extensión vieja: «hizo todo el proceso... y no extrajo nada»). */
  const [esperaExt, setEsperaExt] = useState<'fue' | null>(null);
  const [pideExt, setPideExt] = useState(false);
  /** «Ignorar admins» (Martín, 26/10/2026): los admins del grupo no se tildan. */
  const [sinAdmins, setSinAdmins] = useState(false);
  const sinAdminsAhora = useRef(false);
  useEffect(() => { const v = leerSinAdmins(); setSinAdmins(v); sinAdminsAhora.current = v; }, []);
  const abierto = useRef(false);

  // Al abrir: las líneas del negocio y la etapa de entrada del funnel que se mira.
  useEffect(() => {
    if (abierto.current) return;
    abierto.current = true;
    let vivo = true;
    void abrirTraerDeGrupoAction(funnel).then((r) => {
      if (!vivo) return;
      if (!r.ok) { setErr(r.error); setPasarAPro(r.pasarAPro ?? null); setLineas([]); return; }
      setLineas(r.lineas);
      setEntrada(r.etapas.find((e) => e.key === r.entrada) ?? null);
      // La principal, salvo que esté sin conectar y haya otra conectada (24/10/2026: una segunda línea a medio conectar
      // quedaba en la base «conectando» y es una opción muerta).
      setLinea((r.lineas.find((l) => l.conectada) ?? r.lineas[0])?.linea ?? null);
    }).catch(() => { if (vivo) { setErr('No pude abrir esto. Prueba de nuevo.'); setLineas([]); } });
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
    setGrupos(null); setJid(''); setGente(null); setSel(new Set()); setErr(null); setBuscandoTodos(false); setTodosGrupos(null);
    void gruposDeLineaAction(linea).then((r) => {
      if (!vivo) return;
      if (!r.ok) { setErr(r.error); setGrupos([]); return; }
      setGrupos(r.grupos);
      if (!r.refrescar) { setTodosGrupos(r.grupos.length); return; }
      setBuscandoTodos(true);
      void gruposDeLineaAction(linea, true).then((c) => { if (vivo && c.ok) { setGrupos(c.grupos); setTodosGrupos(c.grupos.length); } })
        .catch(() => {}).finally(() => { if (vivo) setBuscandoTodos(false); });
    }).catch(() => { if (vivo) { setErr('WhatsApp no contestó.'); setGrupos([]); } });
    return () => { vivo = false; };
  }, [linea]);

  // Los participantes del grupo elegido: tildados SÓLO los que todavía no son leads (a eso se vino), y sin los admins si se
  // pidió ignorarlos. Los que ya están no se traen de nuevo (Martín, 24/10/2026: «si ya cargué un grupo o detecta que esos
  // números ya están, no me debe cargar nuevamente... Debería aparecer en gris abajo de todo»): van al final, sin casilla.
  useEffect(() => {
    if (!jid) return;
    let vivo = true;
    setGente(null); setErr(null);
    void participantesDeGrupoAction(linea, jid).then((r) => {
      if (!vivo) return;
      if (!r.ok) { setErr(r.error); setGente([]); return; }
      setGente(r.participantes);
      setSinNumero(r.sinNumero);
      setSel(new Set(r.participantes.filter((p) => !p.enElCrm && !(sinAdminsAhora.current && p.admin)).map((p) => p.telefono)));
    }).catch(() => { if (vivo) { setErr('No pude leer el grupo.'); setGente([]); } });
    return () => { vivo = false; };
  }, [jid, linea, vuelta]);

  const grupo = grupos?.find((g) => g.jid === jid) ?? null;
  const elegirGrupo = (v: string) => { setJid(v); setQ(''); setHecho(null); };
  // Los nuevos arriba (en el orden del grupo) y los que ya están, abajo: lo repetido no ocupa el lugar de lo nuevo. Él va a traer
  // grupo tras grupo y la mayoría se superpone.
  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    const dig = t.replace(/\D/g, '');
    const pasan = (gente ?? []).filter((p) => !t || (p.nombre ?? '').toLowerCase().includes(t) || (!!dig && p.telefono.includes(dig)));
    // Y entre los nuevos, PRIMERO LOS QUE TIENEN NOMBRE (Leila, 26/10/2026): son a los que se les puede hablar por su nombre.
    const nuevosAhora = pasan.filter((p) => !p.enElCrm);
    return [...nuevosAhora.filter((p) => !!p.nombre), ...nuevosAhora.filter((p) => !p.nombre), ...pasan.filter((p) => p.enElCrm)];
  }, [gente, q]);
  const nuevos = (gente ?? []).filter((p) => !p.enElCrm);
  const adminsNuevos = nuevos.filter((p) => p.admin).length;
  const todos = nuevos.length > 0 && nuevos.every((p) => sel.has(p.telefono));
  const trayendo = extrayendo;
  /** ¿La extensión de este navegador lee las fichas de WhatsApp Web? (el atributo lo pone extension/mako-puente.js). En vivo. */
  const extWa = useExtensionFichas();
  const yaEstan = (gente ?? []).filter((p) => p.enElCrm).length;
  // Con nadie nuevo tildado, «Extraer» igual sirve: busca los nombres de los que ya están.
  const listo = !!grupo && !!entrada && (sel.size > 0 || yaEstan > 0);

  const alternar = (p: Participante) => {
    if (p.enElCrm) return; // ya está: no se trae, no se tilda
    setSel((s) => { const n = new Set(s); if (n.has(p.telefono)) n.delete(p.telefono); else n.add(p.telefono); return n; });
  };
  const alternarAdmins = () => {
    const v = !sinAdmins;
    setSinAdmins(v); sinAdminsAhora.current = v;
    try { window.localStorage.setItem(CLAVE_SIN_ADMINS, v ? '1' : '0'); } catch { /* sin recordarlo */ }
    setSel((s) => { const n = new Set(s); for (const p of nuevos) if (p.admin) { if (v) n.delete(p.telefono); else n.add(p.telefono); } return n; });
  };

  /** Los leads nuevos, de a tandas; lo que una no llegó a traer (cortó por tiempo) vuelve a la cola, adelante. */
  const traerTandas = async (tels: readonly string[], id: string) => {
    let creados = 0, yaEstaban = 0, hechos = 0;
    const errores: string[] = [];
    let corte = '';
    let sinEtiqueta: string | null = null;
    const cola = [...tels];
    while (cola.length) {
      if (parar.current) { corte = 'La paraste.'; break; }
      const tanda = cola.splice(0, TANDA_GRUPO);
      const r = await traerDeGrupoAction({ linea, jid, nombreGrupo: grupo?.nombre ?? '', funnelId: funnel, etapa: entrada?.key ?? '', telefonos: tanda })
        .catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : 'error' }));
      if (!r.ok) { corte = r.error; break; }
      creados += r.creados; yaEstaban += r.yaEstaban; errores.push(...r.errores);
      avanzarExtraccion(id, { nuevos: creados });
      if (r.sinEtiqueta) sinEtiqueta = r.sinEtiqueta;
      hechos += tanda.length - r.pendientes.length;
      if (r.pendientes.length >= tanda.length) { corte = 'WhatsApp está tardando.'; break; }
      cola.unshift(...r.pendientes);
    }
    return { creados, yaEstaban, errores, corte, sinEtiqueta, quedan: tels.length - hechos };
  };

  /**
   * «EXTRAER». Arranca la extensión en el acto (a la vista, con el desplegable) mientras se crean los leads; al volver los
   * nombres, se guardan solos. `soloNombres`: los que ya están (la extensión recién instalada, o nadie nuevo tildado).
   */
  const extraer = async (soloNombres = false, o?: { todosLosPerfiles?: boolean }) => {
    if (!grupo || trayendo || !entrada) return;
    if (extWa !== 'si') { setPideExt(true); return; }
    setErr(null); setHecho(null); setVerCrm(false); setEsperaExt(null);
    const id = nuevoIdExtraccion();
    parar.current = false;
    const soltar = alPararExtraccion(id, () => { parar.current = true; });
    // Sólo los nuevos, aunque algo los haya tildado: un lead que ya está no se vuelve a cargar.
    const yaEnElCrm = new Set((gente ?? []).filter((p) => p.enElCrm).map((p) => p.telefono));
    const tels = soloNombres ? [] : [...sel].filter((t) => !yaEnElCrm.has(t));
    const vanAEstar = new Set(tels);
    // Los nombres se buscan para todos los que van a estar en el CRM al terminar: los nuevos y los que ya estaban.
    const pedidos = (gente ?? []).filter((p) => p.enElCrm || vanAEstar.has(p.telefono)).map((p) => ({ telefono: p.telefono, lid: p.lid ?? null }));
    const conExt = extWa === 'si' && pedidos.length > 0;
    setExtrayendo(true);
    empezarExtraccion({ id, grupo: grupo.nombre, funnel, total: tels.length, parar: () => { parar.current = true; setAvance('Parando…'); } });
    setAvance(conExt ? 'Extrayendo: míralo en la extensión de MaKo…' : `Extrayendo ${miles(tels.length)}…`);
    let t: Awaited<ReturnType<typeof traerTandas>> | null = null;
    let a: AvanceFichas | null = null;
    let fallaWa = '';
    // Si los perfiles se cortaron (WhatsApp Web ocupado, sin respuesta), se dice: antes quedaba en «0 nombres» sin más.
    let cortePerfiles = '';
    try {
      const fichasP = conExt ? pedirFichasDeWhatsappWeb(pedidos, { grupos: [grupo.nombre], visible: true, titulo: grupo.nombre, id, alAvanzar: (texto) => avanzarExtraccion(id, { texto }) }) : null;
      t = tels.length ? await traerTandas(tels, id) : null;
      if (fichasP) {
        const f = await fichasP;
        if (f.ok) {
          console.info('[wa-fichas]', f.diagnostico);
          avanzarExtraccion(id, { texto: 'Leyendo los perfiles…' });
          // Y el PERFIL de cada uno (0.73.2): de a tandas, antes de guardar, así se guarda todo junto.
          // «Datos de empresa» (`todosLosPerfiles`): TODOS, en una pasada; un «Extraer», los primeros `TOPE_PERFILES`.
          const pf = await perfilesEnTandas(pedidos, f.fichas.map(fichaLimpia).filter((x): x is FichaWa => !!x),
            { grupo: grupo.nombre, id, parar: () => parar.current, ...(o?.todosLosPerfiles ? { tope: pedidos.length } : {}) });
          const fichas = pf.fichas;
          if (pf.corte && pf.corte !== 'parado') cortePerfiles = motivoDeFichas(pf.corte);
          avanzarExtraccion(id, { texto: 'Guardando lo que encontré…' });
          avisarExtraccion(id, { fase: 'guardando', guardados: 0, total: fichas.length });
          a = await guardarFichasEnTandas(fichas, (tanda) => completarFichasDeGrupoAction({ linea, jid, fichas: tanda }), {
            parar: () => parar.current,
            alAvanzar: (guardadas, total) => avisarExtraccion(id, { fase: 'guardando', guardados: guardadas, total }),
          });
        } else if (f.motivo !== 'parado') {
          // Sin la sesión iniciada, la pestaña de WhatsApp va al frente: ahí está el código para escanear.
          if (f.motivo === 'sin_sesion') enfocarWhatsappWeb();
          fallaWa = motivoDeFichas(f.motivo);
          avisarExtraccion(id, { estado: 'error', texto: fallaWa });
        }
      }
    } finally {
      soltar();
      const nuevosHechos = t?.creados ?? 0;
      const nombres = a?.nombres ?? 0;
      // EL CARTEL DE ÉXITO (Leila, 26/10/2026): cuántos, a qué etapa y con qué etiqueta, y «Ver en el CRM».
      const titular = nuevosHechos
        ? `${miles(nuevosHechos)} ${nuevosHechos === 1 ? 'lead nuevo' : 'leads nuevos'} en «${entrada.label}»${t?.sinEtiqueta ? '' : ` con la etiqueta «${etiquetaDeGrupo(grupo.nombre)}»`}`
        : '';
      const partes = [
        a ? `${miles(nombres)} ${nombres === 1 ? 'nombre' : 'nombres'}` : '',
        a?.empresas ? `${miles(a.empresas)} ${a.empresas === 1 ? 'empresa' : 'empresas'}` : '',
        a?.perfiles ? `${miles(a.perfiles)} con datos de su perfil` : '',
        t?.errores.length ? `${miles(t.errores.length)} no se ${t.errores.length === 1 ? 'pudo' : 'pudieron'}` : '',
      ].filter(Boolean);
      const resumen = [titular, ...partes].filter(Boolean).join(' · ') || (t ? 'Nadie para extraer' : 'Sin nombres nuevos');
      // Los que no se pudieron, por su NOMBRE (la revisión de privacidad, 23/10/2026): un número sin nombre no se puede buscar.
      const errores = t?.errores ?? [];
      const fallidos = errores.length ? ` No se pudieron: ${errores.slice(0, 5).join(', ')}${errores.length > 5 ? '…' : ''}.` : '';
      const corte = t?.corte || a?.error || (a?.parado ? 'La paraste.' : '');
      const cola = [
        fallidos,
        t?.sinEtiqueta ? ` Sin la etiqueta: ${t.sinEtiqueta}.` : '',
        corte ? ` ${corte}${t && t.quedan > 0 ? ` Quedaron ${miles(t.quedan)}: vuelve a tocar «Extraer».` : ''}` : '',
        fallaWa ? ` Los nombres: ${fallaWa}` : '',
        cortePerfiles ? ` Los perfiles: ${cortePerfiles}` : '',
      ].join('');
      if (!fallaWa && conExt) {
        avisarExtraccion(id, {
          estado: parar.current ? 'parado' : 'listo', nombres, empresas: a?.empresas ?? 0, nuevos: nuevosHechos, perfiles: a?.perfiles ?? 0,
          texto: nuevosHechos ? `${miles(nuevosHechos)} ${nuevosHechos === 1 ? 'lead nuevo' : 'leads nuevos'} en «${entrada.label}», con la etiqueta del grupo.` : 'Ya estaban todos en tu CRM.',
        });
      }
      setHecho(titular ? `${resumen}.${cola}` : `«${grupo.nombre}»: ${resumen}.${cola}`);
      // LA CONFIRMACIÓN (30/10/2026), con los MISMOS números que el pie: cuántos, y cero como cero. Antes del `onTraidos`.
      const paro = parar.current;
      terminarExtraccion(id, resultadoDeExtraccion({
        grupo: grupo.nombre, etapa: entrada.label, etiqueta: t?.sinEtiqueta ? null : etiquetaDeGrupo(grupo.nombre), nuevos: nuevosHechos, nombres,
        empresas: a?.empresas ?? 0, perfiles: a?.perfiles ?? 0, fallidos: errores.length, parado: paro, soloDatos: soloNombres,
        motivos: paro ? [] : [corte ? `${corte}${t && t.quedan > 0 ? ` Quedaron ${miles(t.quedan)}: vuelve a tocar «Extraer».` : ''}` : '', fallaWa ? `Los nombres: ${fallaWa}` : '', cortePerfiles ? `Los perfiles: ${cortePerfiles}` : ''],
      }), nuevosHechos);
      setVerCrm(nuevosHechos > 0 || nombres > 0 || (a?.perfiles ?? 0) > 0);
      setExtrayendo(false); setAvance(null);
      if (nuevosHechos || nombres || (a?.perfiles ?? 0) > 0) onTraidos(resumen);
      // Terminó bien: la lista queda para el grupo siguiente, no igual a como estaba antes de «Extraer». Si se cortó, el mismo grupo.
      if (!corte && !fallaWa && !cortePerfiles && !paro) { setJid(''); setGente(null); setSel(new Set()); setQ(''); }
      else setVuelta((n) => n + 1);
    }
  };
  const arrancarAlInstalar = useEffectEvent(() => { setEsperaExt(null); void extraer(); });
  useEffect(() => { if (esperaExt && extWa === 'si') arrancarAlInstalar(); }, [esperaExt, extWa]);

  // «DATOS DE EMPRESA», POR LA EXTENSIÓN Y EN UNA PASADA (27/10/2026; el Cerebro, sobre la llamada con Leandro 874749710-07:
  // «el tope de 120 por día se mantiene mientras vaya por Evolution»). Antes consultaba el perfil de empresa por la línea
  // (Evolution), de a 120 por día para cuidarla de un bloqueo, y traía poco. La extensión abre el perfil de cada uno en SU
  // WhatsApp Web, como una persona, y lee la web, el correo, el Instagram y las redes: es la misma extracción a la vista,
  // sobre los que ya están, con TODOS los perfiles y sin tope por día. Sólo llena lo vacío. No le llega nada a nadie.
  const datosDeEmpresa = () => {
    if (!grupo || trayendo || !entrada) return;
    if (extWa !== 'si') { setPideExt(true); return; }
    setPideEmpresa(yaEstan);
  };

  const opcionesLinea: DropdownOption[] = (lineas ?? []).map((l) => ({ value: l.linea, label: l.conectada ? l.etiqueta : `${l.etiqueta} · sin conectar` }));
  const opcionesGrupo: DropdownOption[] = [
    { value: '', label: grupos === null ? 'Cargando grupos…' : grupos.length ? 'Elige un grupo' : 'Sin grupos' },
    ...(grupos ?? []).map((g) => ({ value: g.jid, label: g.tamano != null ? `${g.nombre} · ${miles(g.tamano)}` : g.nombre })),
  ];

  if (lineas !== null && !lineas.length) {
    return (
      <div>
        <p style={{ ...nota, padding: 0 }}>{err ?? 'Conecta una línea de WhatsApp para extraer los contactos de un grupo.'}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={onAtras} style={btnAtras}>← Atrás</button>
          {/* El candado de Pro (27/10/2026, ./grupo-wa-actions.ts): un Esencial lo ve con «Pasar a Pro», que lleva a «Tu plan».
              El cliente de una agencia, no (6/11/2026, #494): el cambio de plan se lo pide a su agencia, que ya se lo paga. */}
          {pasarAPro && <CtaPasarAPro><a href={pasarAPro} style={btnPro}>{ROTULO_PASAR_A_PRO}</a></CtaPasarAPro>}
        </div>
      </div>
    );
  }

  // ⚠️ EL MOLDE DE LOS TRES (24/10/2026, ./MoldeTraer.tsx, copiado del «Preview import» de Attio). Desde el 26/10/2026:
  //   · arriba, de dónde (línea, grupo, buscar) y, en el «⋯», «Datos de empresa» (no es el camino principal);
  //   · sin fila «Entran a» (siempre el CRM que se mira, en su primera etapa, con la etiqueta del grupo);
  //   · el resumen, sólo «N para extraer» y el botón sutil «Ignorar admins» (sin «ya están · sin número · no les manda nada»:
  //     Martín, «Elimina los textos innecesarios»). Que no les manda nada SIGUE siendo así (`quedaDondeLoPusieron`, 23/10);
  //   · abajo, sólo «Atrás» y «Extraer N»; a la izquierda, lo que está pasando, en una línea.
  // La lista sigue siendo lo único que scrollea (`VistaConPie`, 24/10: «los botones de abajo no pueden estar a la mitad»).
  const mas: OpcionMas[] = trayendo || !yaEstan ? [] : [
    { id: 'empresa', texto: 'Datos de empresa', icono: 'cliente', onElegir: datosDeEmpresa },
  ];
  // Lo que corre se para desde el pie (y «Extraer», también desde el desplegable de la extensión).
  const pararAccion = extrayendo ? { texto: 'Parar', onClick: () => { parar.current = true; setAvance('Parando…'); } } : undefined;
  const irAInstalar = () => {
    setPideExt(false); setEsperaExt('fue');
    // Una descomprimida vieja con la nueva en su carpeta se pone al día sola con esto (0.71.1+).
    window.dispatchEvent(new CustomEvent('MAKO_EXTENSION_REVISAR'));
    window.open('/extension/instalar', '_blank', 'noopener');
  };
  const estado = err ? { texto: err, tono: 'mal' as const }
    : avance ? { texto: avance, tono: 'neutro' as const, ...(pararAccion ? { accion: pararAccion } : {}) }
    : lineas && !entrada ? { texto: 'Ninguna etapa de este CRM se puede usar al extraer: todas mandan algo o cierran el trato.', tono: 'mal' as const }
    : esperaExt === 'fue' ? { texto: 'Cuando la extensión esté, la extracción empieza sola.', tono: 'neutro' as const, accion: { texto: 'Cancelar', onClick: () => setEsperaExt(null) } }
    : hecho ? { texto: hecho, tono: 'ok' as const, ...(verCrm && onCerrar ? { accion: { texto: 'Ver en el CRM', onClick: onCerrar } } : {}) }
    : buscandoTodos ? { texto: 'Buscando el resto de tus grupos…', tono: 'neutro' as const }
    : !jid && todosGrupos != null ? { texto: `Están todos tus grupos · ${miles(todosGrupos)}`, tono: 'ok' as const }
    : null;

  return (
    <MoldeTraer
      mas={mas}
      estado={estado}
      atras={{ onClick: onAtras, deshabilitado: trayendo }}
      accion={{ texto: extrayendo ? 'Extrayendo…' : sel.size ? `Extraer ${miles(sel.size)}` : 'Extraer', onClick: () => void extraer(), deshabilitado: trayendo || !listo }}
      resumen={gente?.length ? {
        texto: `${miles(sel.size)} para extraer`,
        extra: adminsNuevos > 0 ? (
          <button type="button" onClick={alternarAdmins} aria-pressed={sinAdmins} disabled={trayendo}
            title={sinAdmins ? `Los ${miles(adminsNuevos)} admins del grupo no se extraen` : `Destildar a los ${miles(adminsNuevos)} admins del grupo`}
            style={{ ...btnSutil, color: sinAdmins ? 'var(--primary)' : 'var(--dim)', borderColor: sinAdmins ? 'var(--primary)' : 'var(--border)' }}>
            {sinAdmins && <span aria-hidden style={{ fontSize: 11 }}>✓</span>}
            Ignorar admins
          </button>
        ) : undefined,
      } : undefined}
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
                // LOS QUE YA ESTÁN: en gris, sin casilla, sin clic. Encabezados por un renglón que dice cuántos.
                if (p.enElCrm) {
                  const primero = i === 0 || !visibles[i - 1].enElCrm;
                  return (
                    <Fragment key={p.telefono}>
                      {primero && (
                        <tr data-ya-estan>
                          <td colSpan={4} style={{ ...td, ...grisRotulo }}>
                            {`Ya están en tu CRM · ${miles(yaEstan)}`}
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
                      <input type="checkbox" checked={on} readOnly tabIndex={-1} aria-label={`Extraer a ${p.nombre ?? `+${p.telefono}`}`}
                        style={{ width: 16, height: 16, accentColor: 'var(--primary)', pointerEvents: 'none' }} />
                    </td>
                    <td style={{ ...td, fontWeight: 600 }}>{p.nombre ?? '—'}{p.admin && <span style={marcaAdmin}>admin</span>}</td>
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
        {jid && gente?.length === 0 && <p style={nota}>{sinNumero ? 'WhatsApp no deja ver los números de este grupo.' : 'Nadie para extraer.'}</p>}
      {pideExt && (
        <Confirm tone="primary" title={extWa === 'vieja' ? 'Actualiza la extensión de MaKo' : 'Instala la extensión de MaKo'}
          confirmLabel={extWa === 'vieja' ? 'Actualizar' : 'Instalar'}
          message={extWa === 'vieja'
            ? lineaDeVersion(VERSION_FICHAS, 'Tu extensión es de antes y no sabe extraer de un grupo. Actualízala y la extracción empieza sola.')
            : 'Para extraer de un grupo, MaKo entra a tu WhatsApp Web con su extensión. Instálala y la extracción empieza sola.'}
          onConfirm={irAInstalar} onCancel={() => setPideExt(false)} />
      )}
      {pideEmpresa != null && (
        <Confirm tone="primary" title="¿Leer los datos de empresa?" confirmLabel={`Leer ${miles(pideEmpresa)} perfiles`}
          message={`Tu extensión abre el perfil de los ${miles(pideEmpresa)} en tu WhatsApp Web: unos ${miles(minutosDeLaPasada(pideEmpresa))} min. No les llega nada.`}
          onConfirm={() => { setPideEmpresa(null); void extraer(true, { todosLosPerfiles: true }); }} onCancel={() => setPideEmpresa(null)} />
      )}
    </MoldeTraer>
  );
}

const btnAtras: CSSProperties = {
  flex: 'none', padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)',
  color: 'var(--ink)', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer',
};
/** «Ignorar admins»: chico, con borde fino; azul cuando está puesto. */
const btnPro: CSSProperties = {
  flex: 'none', padding: '10px 16px', borderRadius: 10, border: '1px solid var(--primary)', background: 'var(--primary)',
  color: 'var(--on-primary)', fontFamily: SANS, fontSize: 14, fontWeight: 600, textDecoration: 'none',
};
const btnSutil: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, padding: '0 10px', borderRadius: 999, border: '1px solid var(--border)',
  background: 'transparent', fontFamily: SANS, fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
};
