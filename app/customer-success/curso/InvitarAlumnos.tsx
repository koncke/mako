'use client';

// =============================================================================
// InvitarAlumnos — invitar alumnos DESDE EL EDITOR del curso de un producto
// =============================================================================
// Pedido de Martín (07/10/2026, item 9): «También en la vista de editor de curso debería poder
// invitar a alguien. Ya sea seleccionándolo de la lista de clientes que aún no estén invitados o
// invitándolo de 0, en ese caso, me debe pedir más datos para también agregarlo como cliente al
// kanban».
//
// Un botón y un modal con DOS caminos (dos pestañas, una pregunta cada una):
//   · «Clientes sin invitar»: los del producto que todavía no recibieron su invitación A ESTE CURSO,
//     con un buscador; se eligen uno o varios y cada uno lleva su email (prellenado del CRM y editable).
//   · «Alguien nuevo»: nombre, email (obligatorio: es una invitación por mail), teléfono (opcional),
//     empresa y «Sin cobro». En UNA action se crea como cliente ganado, entra al kanban del producto en su
//     primera etapa y se lo invita (./invitar-actions.ts). Si se parece a alguien que ya existe, NO
//     falla: ofrece usar a ése.
//
// ⚠️ NO SE MONTA ACÁ: lo monta el editor del curso (CursoApp). Lo que necesita son las filas de Avance
// del producto (las mismas que ya arma la página del curso), con su email del CRM y su acceso CON la
// invitación (`accesosDeClientes`, lib/curso-admin.ts).
//
// ⚠️ LA LISTA SALE DE `clientesSinInvitar` (../curso-ficha-lectura.ts, con test): un cortado, un
// invitado o uno cuyo acceso no se pudo leer NO aparecen — invitarlo sería un segundo mail a ciegas.
// Y desde la mig 0232 se mira DESDE ESTE PRODUCTO (`accesoEnProducto`, lib/curso-invitar-reglas.ts): un
// alumno invitado a otro curso del negocio no está invitado a éste. Las filas de la página no traen qué
// cursos abre cada acceso, así que el modal lo lee al abrirse (`productosDeLosAccesosAction`); sin esa
// lectura, la fila vale como antes.
//
// ⚠️ EL MODAL VA POR PORTAL AL BODY, como el de ./InvitarAlCurso.tsx: el editor tiene barras
// pegadas (sticky) y un z-index ahí adentro se resolvería contra ellas (AGENTS.md).
//
// ⚠️ TEXTOS CORTOS Y EN TÚ: lo lee el equipo del negocio, y los rótulos son de 1-3 palabras.
//
// ── EL BORRADOR (punto 9 del audio del 08/10/2026 a la noche) ─────────────────────────────────────
// «Si hay alguien que está completando el formulario y no se terminó de enviar, que se vuelva borrador
// siempre». Lo escrito vivía en el estado de cada pestaña: pasar de «Alguien nuevo» a «Clientes sin
// invitar» desmontaba el formulario, y cerrar el modal (para ir a configurar el correo) lo tiraba. Ahora
// el estado es UNO, del modal (`borrador`), y se copia a `sessionStorage` por workspace y producto
// (`claveBorrador`). Se borra lo que se invitó. La regla y por qué `sessionStorage` y no `localStorage`,
// en lib/curso-invitar-reglas.ts. Toda lectura y escritura del almacenamiento va en try/catch: un
// navegador que lo bloquea pierde el borrador, nunca la pantalla.
//
// ── EL CORREO AHÍ MISMO (punto 10) ───────────────────────────────────────────────────────────────
// Si una invitación no sale por la configuración del correo, la respuesta dice de quién (`correo`:
// 'tuyo' | 'mako', ./invitar-actions.ts) y el modal monta el formulario de Integraciones para el correo
// (`ServicioConfigForm` con `servicioKey="email"`, el MISMO que usan /integraciones, el onboarding y
// ConectarIA): no hay una segunda forma de guardar una credencial. Va con `next/dynamic` y sólo cuando
// hace falta, para no sumarle su código al editor del curso.

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { Button, Checkbox, Field, Input, Modal, Spinner, Tabs, TextField } from '@/app/_ui';
import { useRouter, useWs } from '@/app/_ui/Link';
import { emailUtilizable } from '@/lib/agencia-altas';
import { TelefonoConPais } from '@/app/_components/TelefonoConPais';
import { splitTelefono, unirTelefono } from '@/lib/paises';
import { clientesSinInvitar, type AccesoDeFila, type ClienteSinInvitar } from '../curso-ficha-lectura';
import {
  buscarLeadsParaInvitarAction, invitarClientesAction, invitarLeadDeCualquierEtapaAction,
  invitarNuevoAlumnoAction, opcionesDeInvitarAction, productosDeLosAccesosAction,
} from './invitar-actions';

/** Una fila del buscador del embudo. La arma el server; acá no se vuelve a calcular nada. */
type FilaEmbudo = { id: number; nombre: string; segunda: string | null; email: string | null; yaInvitado: boolean };
import { ofreceWhatsapp, tieneTelefono, type CanalInvitacion } from '@/lib/curso-invitar-canales';
import { useCerrarEstable } from './dialogo-foco';
import {
  accesoEnProducto, claveBorrador, leerBorrador, borradorConAlgo, BORRADOR_VACIO,
  type BorradorInvitar, type CorreoQueFallo,
} from '@/lib/curso-invitar-reglas';

// ⚠️ `next/dynamic` con ssr:false, NO un import normal: sólo se baja cuando un correo no salió por
// configuración. Un import estático lo metería en el editor del curso entero.
const ServicioConfigForm = dynamic(() => import('@/app/integraciones/ServicioConfigForm'), {
  ssr: false,
  loading: () => <Spinner size={14} />,
});

// ── «TAMBIÉN POR WHATSAPP» (item 21 del audio del 08/10/2026, minuto 09:30) ───────────────────────
// «Puedes conectar tu email, puedes conectar tu WhatsApp y a la persona le puede llegar por ambos lados».
// Una casilla en las dos pestañas, APAGADA por default, que se DIBUJA sólo si el negocio tiene su línea
// de WhatsApp conectada, el envío de WhatsApp prendido y el cliente tiene teléfono (`ofreceWhatsapp`,
// lib/curso-invitar-canales.ts, con lo que contesta `opcionesDeInvitarAction` al abrir). Con la casilla
// prendida, además del correo le llega el mismo link por la línea de por default del negocio
// (lib/curso-invitar.ts). Si la lectura falla, no se ofrece: el correo sale igual.

/** Lo que el modal sabe del WhatsApp del negocio. `null` = todavía no contestó (o no se pudo leer). */
type OpcionesWhatsapp = { lineaConectada: boolean; envioPrendido: boolean; conTelefono: ReadonlySet<number> } | null;

const canalesCon = (whatsapp: boolean): CanalInvitacion[] => (whatsapp ? ['email', 'whatsapp'] : ['email']);

/** Una fila de Avance, en lo que esta pieza mira (es la forma de `FilaConAcceso`, ./AvanceCurso.tsx). */
export type FilaParaInvitar = { leadId: number; nombre: string; empresa: string | null; email?: string | null; acceso: AccesoDeFila };

type Duplicado = { leadId: number; nombre: string; texto: string; ganado: boolean };

const msg = (e: unknown, def: string) => (e instanceof Error ? e.message : def);

/** El borrador guardado de este producto, o `null`. Nunca tira. */
function borradorGuardado(clave: string): BorradorInvitar | null {
  try { return leerBorrador(window.sessionStorage.getItem(clave)); } catch { return null; }
}

/** Lo guarda (o borra la clave si no hay nada escrito). Nunca tira. */
function guardarBorrador(clave: string, b: BorradorInvitar): void {
  try {
    if (borradorConAlgo(b)) window.sessionStorage.setItem(clave, JSON.stringify(b));
    else window.sessionStorage.removeItem(clave);
  } catch { /* sin almacenamiento, el borrador vive mientras el modal esté abierto */ }
}

export function InvitarAlumnos({ productoId, producto, filas, onListo }: {
  productoId: number;
  /** El nombre del producto: va en el título del modal. */
  producto: string;
  /** Las filas de Avance del producto (sus clientes, con su acceso y su email del CRM). */
  filas: readonly FilaParaInvitar[];
  /** Cuando algo salió (alguien quedó invitado o creado). La página ya se relee sola. */
  onListo?: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setAbierto(true)} title={`Invitar alumnos a ${producto}`}>
        Invitar alumnos
      </Button>
      {abierto && <ModalInvitarAlumnos productoId={productoId} producto={producto} filas={filas} onListo={onListo} onCerrar={() => setAbierto(false)} />}
    </>
  );
}

/**
 * El modal SOLO, para quien lo abre desde más de un lugar: el editor del curso lo abre con su botón
 * de la barra de arriba y con «Invitar alumnos» del menú de la marca (./CursoApp.tsx), con un solo
 * estado para los dos.
 */
export function ModalInvitarAlumnos({ productoId, producto, filas, onListo, onCerrar }: {
  productoId: number; producto: string; filas: readonly FilaParaInvitar[]; onListo?: () => void; onCerrar: () => void;
}) {
  // Qué cursos abre el acceso de cada uno (mig 0232), leído al abrir: las filas de la página no lo
  // traen. Sin la lectura (todavía, o falló) la lista es la de siempre: de menos, nunca un mail a ciegas.
  const [abren, setAbren] = useState<Record<number, number[] | null> | null>(null);
  const idsFilas = useMemo(() => filas.map((f) => f.leadId), [filas]);
  useEffect(() => {
    let vivo = true;
    productosDeLosAccesosAction(idsFilas)
      .then((r) => { if (vivo && r.ok) setAbren(r.productos); })
      .catch(() => { /* sin la lectura, la lista de siempre */ });
    return () => { vivo = false; };
  }, [idsFilas]);
  // Las filas vistas DESDE ESTE PRODUCTO: invitado a otro curso no es invitado a éste.
  const filasAca = useMemo(() => filas.map((f) => {
    const conLista = f.acceso && abren && Object.prototype.hasOwnProperty.call(abren, f.leadId) ? { ...f.acceso, productos: abren[f.leadId] } : f.acceso;
    return { ...f, acceso: accesoEnProducto(conLista, productoId) };
  }), [filas, abren, productoId]);
  const sinInvitar = useMemo(() => clientesSinInvitar(filasAca), [filasAca]);
  const ws = useWs();
  const clave = claveBorrador(ws, productoId);
  // El borrador de este producto, si había uno. Sin él, con nadie sin invitar arranca en «Alguien
  // nuevo»: abrir una lista vacía es un paso de más. (El modal se monta al abrirse, del lado del
  // navegador: leer el almacenamiento acá no choca con el HTML del server.)
  const [borrador, setBorrador] = useState<BorradorInvitar>(() => borradorGuardado(clave) ?? { ...BORRADOR_VACIO, pestana: sinInvitar.length ? 'clientes' : 'nuevo' });
  useEffect(() => { guardarBorrador(clave, borrador); }, [clave, borrador]);
  const pestana = borrador.pestana;
  const [ocupado, setOcupado] = useState(false);
  const ocupadoRef = useRef(false);
  const router = useRouter();
  /** `onCerrar` estable (ver el porqué en ./InvitarAlCurso.tsx: el `Modal` depende de su identidad). */
  const cerrar = useCerrarEstable(onCerrar, ocupado);
  const ocupar = (v: boolean) => { ocupadoRef.current = v; setOcupado(v); };
  /** Algo cambió en la base: se relee la página (la tabla Avance, la lista) y se avisa. */
  const hecho = () => { router.refresh(); onListo?.(); };

  // El WhatsApp del negocio y quién tiene teléfono, UNA vez al abrir (ver la cabecera de la casilla).
  const [wa, setWa] = useState<OpcionesWhatsapp>(null);
  const idsSinInvitar = useMemo(() => sinInvitar.map((c) => c.leadId), [sinInvitar]);
  useEffect(() => {
    let vivo = true;
    opcionesDeInvitarAction(idsSinInvitar)
      .then((r) => { if (vivo && r.ok) setWa({ lineaConectada: r.lineaConectada, envioPrendido: r.envioPrendido, conTelefono: new Set(r.conTelefono) }); })
      .catch(() => { /* sin la lectura no se ofrece la casilla: el correo sale igual */ });
    return () => { vivo = false; };
  }, [idsSinInvitar]);

  return createPortal(
    <Modal titulo={`Invitar a ${producto}`} encabezado="Alumnos" ancho={600} anidada onCerrar={cerrar}>
      <Tabs
        tabs={[
          { id: 'clientes', label: 'Clientes sin invitar', badge: sinInvitar.length },
          { id: 'embudo', label: 'Del embudo' },
          { id: 'nuevo', label: 'Alguien nuevo' },
        ]}
        activa={pestana}
        onCambio={(id) => { if (!ocupadoRef.current) setBorrador((b) => ({ ...b, pestana: id === 'nuevo' || id === 'embudo' ? id : 'clientes' })); }}
      />
      {pestana === 'embudo'
        ? <DelEmbudo productoId={productoId} ocupado={ocupado} ocupar={ocupar} hecho={hecho} onListo={onListo} />
        : pestana === 'clientes'
        ? <Clientes lista={sinInvitar} hayClientes={filas.length > 0} productoId={productoId} ocupado={ocupado} ocupar={ocupar} hecho={hecho} wa={wa}
          borrador={borrador.clientes} setBorrador={(f) => setBorrador((b) => ({ ...b, clientes: f(b.clientes) }))} />
        : <Nuevo productoId={productoId} ocupado={ocupado} ocupar={ocupar} hecho={hecho} wa={wa}
          borrador={borrador.nuevo} setBorrador={(f) => setBorrador((b) => ({ ...b, nuevo: f(b.nuevo) }))} />}
    </Modal>,
    document.body,
  );
}

// ── El correo, ahí mismo (punto 10) ───────────────────────────────────────────

/**
 * El formulario del correo de Integraciones, adentro del modal. `cual` dice DE QUIÉN fue: con su
 * correo conectado ('tuyo'), lo suyo; si salía por MaKo ('mako'), se dice que fue nuestro y se ofrece
 * conectar el suyo — que es lo que lo destrabó en el audio. El remitente se nombra: sin él, la key
 * sola no alcanza (la invitación sigue saliendo por MaKo).
 */
export function CorreoAhiMismo({ cual }: { cual: Exclude<CorreoQueFallo, null> }) {
  const [guardado, setGuardado] = useState(false);
  return (
    <div className="ina-correo">
      <p className="ina-correo-tit">{cual === 'tuyo' ? 'Revisa tu correo' : 'Falló el correo de MaKo'}</p>
      <p className="ina-sub">{cual === 'tuyo' ? 'La API key y el remitente.' : 'Reintenta, o conecta tu correo: API key y remitente.'}</p>
      <ServicioConfigForm servicioKey="email" onGuardado={() => setGuardado(true)} />
      {guardado && <p className="ina-ok">Guardado. Vuelve a invitar.</p>}
      <EstiloAlumnos />
    </div>
  );
}

// ── Clientes sin invitar ──────────────────────────────────────────────────────

function Clientes({ lista, hayClientes, productoId, ocupado, ocupar, hecho, wa, borrador, setBorrador }: {
  lista: readonly ClienteSinInvitar[];
  /** ¿El producto tiene clientes? (Sin ninguno, la lista vacía dice otra cosa.) */
  hayClientes: boolean;
  productoId: number; ocupado: boolean; ocupar: (v: boolean) => void; hecho: () => void; wa: OpcionesWhatsapp;
  borrador: BorradorInvitar['clientes'];
  setBorrador: (f: (c: BorradorInvitar['clientes']) => BorradorInvitar['clientes']) => void;
}) {
  const [q, setQ] = useState('');
  /** «También por WhatsApp»: apagada por default (item 21). No viaja en el borrador (ver lib/curso-invitar-reglas.ts). */
  const [porWhatsapp, setPorWhatsapp] = useState(false);
  /** Los elegidos que siguen en la lista (uno invitado en otra pestaña ya no está). */
  const elegidos = useMemo(() => new Set(borrador.elegidos.filter((id) => lista.some((c) => c.leadId === id))), [borrador.elegidos, lista]);
  /** El email de cada uno: el que se editó (borrador), si no el del CRM. */
  const emailDe = (c: ClienteSinInvitar) => borrador.emails[String(c.leadId)] ?? c.email;
  /** El resultado de cada uno después de mandar: una frase por fila. */
  const [resultados, setResultados] = useState<Record<number, { enviado: boolean; texto: string }>>({});
  const [error, setError] = useState('');
  /** Si el correo no salió por configuración, de quién fue (y el formulario aparece). */
  const [correo, setCorreo] = useState<CorreoQueFallo>(null);

  const t = q.trim().toLowerCase();
  const visibles = t ? lista.filter((c) => `${c.nombre} ${c.empresa ?? ''} ${emailDe(c)}`.toLowerCase().includes(t)) : lista;
  /** Los elegidos que todavía no salieron (uno que ya quedó invitado no se vuelve a mandar). */
  const aMandar = [...elegidos].filter((id) => !resultados[id]?.enviado);
  const emailPorId = (id: number) => { const c = lista.find((x) => x.leadId === id); return c ? emailDe(c) : ''; };
  const malos = aMandar.filter((id) => !emailUtilizable(emailPorId(id).trim()));
  // La casilla se dibuja si ALGUNO de los elegidos puede recibirlo; al que no tiene teléfono le llega
  // sólo el correo, y su fila lo dice («WhatsApp: sin teléfono.»).
  const ofreceWa = !!wa && aMandar.some((id) => ofreceWhatsapp({
    lineaConectada: wa.lineaConectada, envioPrendido: wa.envioPrendido, conTelefono: wa.conTelefono.has(id),
  }));

  const alternar = (id: number) => setBorrador((b) => ({ ...b, elegidos: b.elegidos.includes(id) ? b.elegidos.filter((x) => x !== id) : [...b.elegidos, id] }));

  async function mandar() {
    if (!aMandar.length || malos.length || ocupado) return;
    ocupar(true);
    setError('');
    try {
      const r = await invitarClientesAction(
        aMandar.map((leadId) => ({ leadId, email: emailPorId(leadId).trim() })),
        { canales: canalesCon(ofreceWa && porWhatsapp), productoId },
      );
      if (!r.ok) { setError(r.error); return; }
      setResultados((m) => ({ ...m, ...Object.fromEntries(r.resultados.map((x) => [x.leadId, { enviado: x.enviado, texto: x.texto }])) }));
      setCorreo(r.correo);
      // Lo que salió deja de ser borrador: ni elegido, ni su email editado.
      const salieron = new Set(r.resultados.filter((x) => x.enviado).map((x) => x.leadId));
      if (salieron.size) {
        setBorrador((b) => ({
          elegidos: b.elegidos.filter((id) => !salieron.has(id)),
          emails: Object.fromEntries(Object.entries(b.emails).filter(([k]) => !salieron.has(Number(k)))),
        }));
        hecho();
      }
    } catch (e) {
      setError(msg(e, 'No se pudo invitar.'));
    } finally {
      ocupar(false);
    }
  }

  // Punto 12 del audio: «no me apareció el que acabo de agendar». Es lo esperado (sólo los ganados),
  // pero no se entendía: se dice, corto, donde se nota la ausencia.
  const soloGanados = <p className="ina-nada ina-pista">Sólo aparecen los clientes ganados.</p>;
  if (!lista.length) {
    return (
      <div className="ina-col">
        <p className="ina-nada">{hayClientes ? 'Todos sus clientes ya están invitados.' : 'Todavía no tiene clientes.'}</p>
        {soloGanados}
        <EstiloAlumnos />
      </div>
    );
  }
  return (
    <div className="ina-col">
      <Input value={q} placeholder="Buscar" aria-label="Buscar clientes" onChange={(e) => setQ(e.target.value)} />
      <ul className="ina-lista">
        {visibles.map((c) => {
          const res = resultados[c.leadId];
          const email = emailDe(c);
          const sirve = emailUtilizable(email.trim());
          return (
            <li key={c.leadId} className="ina-fila">
              <Checkbox checked={elegidos.has(c.leadId)} disabled={ocupado || res?.enviado === true}
                label={<span className="ina-nom" title={c.nombre}>{c.nombre || 'Sin nombre'}{c.empresa ? <span className="ina-sub"> · {c.empresa}</span> : null}</span>}
                onChange={() => alternar(c.leadId)} />
              <Input type="email" value={email} placeholder="Email" aria-label={`Email de ${c.nombre || 'este cliente'}`}
                error={elegidos.has(c.leadId) && !sirve} disabled={ocupado || res?.enviado === true}
                onChange={(e) => { const v = e.target.value; setBorrador((b) => ({ ...b, emails: { ...b.emails, [String(c.leadId)]: v } })); }} />
              {res && <span className={res.enviado ? 'ina-ok' : 'ina-mal'} title={res.texto}>{res.texto}</span>}
            </li>
          );
        })}
        {!visibles.length && <li className="ina-nada">Nadie coincide.</li>}
      </ul>
      {soloGanados}
      {malos.length > 0 && <p className="ina-mal">Falta un email válido.</p>}
      {ofreceWa && (
        <Checkbox checked={porWhatsapp} onChange={setPorWhatsapp} disabled={ocupado}
          label="También por WhatsApp" hint="Por tu línea, a quien tiene teléfono." />
      )}
      {error && <p className="ina-mal">{error}</p>}
      {correo && <CorreoAhiMismo cual={correo} />}
      <div className="ina-pie">
        {/* El botón dice LO QUE PASA y a cuántos: se le escribe a gente, y eso no se deshace. */}
        <Button variant="primary" loading={ocupado} disabled={!aMandar.length || malos.length > 0} onClick={() => void mandar()}>
          {aMandar.length > 1 ? `Invitar a ${aMandar.length}` : 'Invitar'}
        </Button>
      </div>
      <EstiloAlumnos />
    </div>
  );
}

// ── Alguien nuevo ─────────────────────────────────────────────────────────────

function Nuevo({ productoId, ocupado, ocupar, hecho, wa, borrador, setBorrador }: {
  productoId: number; ocupado: boolean; ocupar: (v: boolean) => void; hecho: () => void; wa: OpcionesWhatsapp;
  borrador: BorradorInvitar['nuevo'];
  setBorrador: (f: (n: BorradorInvitar['nuevo']) => BorradorInvitar['nuevo']) => void;
}) {
  const idNombre = useId();
  const { nombre, email, telefono, empresa, sinCobro } = borrador;
  const poner = (campo: 'nombre' | 'email' | 'telefono' | 'empresa', v: string) => setBorrador((n) => ({ ...n, [campo]: v }));
  // ⚠️ EL TELÉFONO CON EL PAÍS PRIMERO (punto 5 del 12/10/2026: «en todos lados que pida telefono,
  // primero tiene que ir la numeración que ya tenemos con las banderas»). La lada y el número viven
  // acá mientras se escribe (derivarlos del borrador en cada render tiraría la lada elegida con el
  // número vacío); al borrador y al server va `unirTelefono`: los dígitos con su código de país,
  // como el alta de un lead del CRM. Sin lada, el WhatsApp de la invitación no tenía a dónde ir.
  const [tel, setTel] = useState(() => { const p = splitTelefono(telefono); return { lada: p.lada, numero: p.resto }; });
  // Al invitar el borrador se vacía: el número escrito se va con él.
  useEffect(() => { if (!telefono) setTel((t) => (t.numero ? { ...t, numero: '' } : t)); }, [telefono]);
  const cambiarTel = (t: { lada: string; numero: string }) => {
    setTel(t);
    poner('telefono', t.numero.replace(/\D/g, '') ? unirTelefono(t.lada, t.numero) : '');
    setDuplicados(null);
  };
  /** «También por WhatsApp»: apagada por default (item 21); se ofrece con un teléfono escrito. */
  const [porWhatsapp, setPorWhatsapp] = useState(false);
  const ofreceWa = !!wa && ofreceWhatsapp({ lineaConectada: wa.lineaConectada, envioPrendido: wa.envioPrendido, conTelefono: tieneTelefono(telefono) });
  const [error, setError] = useState('');
  /** Con quién choca, si choca: la pantalla ofrece usarlo en vez de fallar. */
  const [duplicados, setDuplicados] = useState<Duplicado[] | null>(null);
  /**
   * Lo que pasó después de crear: el cliente YA existe, así que el formulario no se vuelve a mandar.
   * `leadId` y `email`: para reintentar la invitación sola (sin volver a crearlo) si el correo falló.
   * `conWhatsapp`: lo que se pidió AL CREAR. ⚠️ No se recalcula al reintentar: al crear, el borrador
   * se vacía, el teléfono queda en '' y `ofreceWa` pasa a false — «Volver a invitar» mandaba sólo el
   * correo con la casilla marcada (revisión del 09/10/2026).
   */
  const [listo, setListo] = useState<{ enviado: boolean; texto: string; leadId: number; email: string; correo: CorreoQueFallo; conWhatsapp: boolean } | null>(null);
  const puede = nombre.trim().length > 1 && emailUtilizable(email.trim());

  // ⚠️ EL FOCO VA DESPUÉS DEL DEL MODAL, que enfoca su caja al montarse. Este componente es HIJO del
  // modal, así que su efecto corre ANTES que el del modal (los hijos primero): sin el `setTimeout`, el
  // modal le saca el foco al campo en el mismo commit.
  useEffect(() => {
    const t = window.setTimeout(() => (document.getElementById(idNombre) as HTMLInputElement | null)?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [idNombre]);

  async function crear(extra: { usarLeadId?: number; crearIgual?: boolean } = {}) {
    if (ocupado || (!puede && !extra.usarLeadId)) return;
    ocupar(true);
    setError('');
    try {
      const r = await invitarNuevoAlumnoAction({
        productoId, nombre, email, telefono, empresa, sinCobro, canales: canalesCon(ofreceWa && porWhatsapp), ...extra,
      });
      if (!r.ok) {
        if (r.duplicados?.length) { setDuplicados(r.duplicados); return; }
        setError(r.error);
        return;
      }
      setDuplicados(null);
      setListo({ enviado: r.enviado, texto: r.texto, leadId: r.leadId, email: email.trim(), correo: r.correo, conWhatsapp: ofreceWa && porWhatsapp });
      // El cliente YA existe: el borrador se va (volver a mandarlo chocaría con su propio duplicado).
      setBorrador(() => ({ ...BORRADOR_VACIO.nuevo }));
      hecho();
    } catch (e) {
      setError(msg(e, 'No se pudo invitar.'));
    } finally {
      ocupar(false);
    }
  }

  /** El correo falló y el cliente ya está creado: se reintenta SÓLO la invitación, a este curso. */
  async function reintentar() {
    if (!listo || ocupado) return;
    ocupar(true);
    try {
      const r = await invitarClientesAction([{ leadId: listo.leadId, email: listo.email }], { canales: canalesCon(listo.conWhatsapp), productoId });
      if (!r.ok) { setListo({ ...listo, texto: r.error }); return; }
      const x = r.resultados[0];
      setListo({ ...listo, enviado: x?.enviado === true, texto: x?.texto ?? listo.texto, correo: r.correo });
      if (x?.enviado) hecho();
    } catch (e) {
      setListo({ ...listo, texto: msg(e, 'No se pudo invitar.') });
    } finally {
      ocupar(false);
    }
  }

  if (listo) {
    return (
      <div className="ina-col">
        {/* Con WhatsApp pedido, la frase del server dice además si salió por ahí (`fraseWhatsapp`). */}
        <p className={listo.enviado ? 'ina-ok' : 'ina-mal'}>{listo.enviado ? (porWhatsapp ? listo.texto : 'Cliente creado e invitado.') : listo.texto}</p>
        {!listo.enviado && listo.correo && <CorreoAhiMismo cual={listo.correo} />}
        <div className="ina-pie">
          {!listo.enviado && listo.correo && (
            <Button variant="primary" loading={ocupado} onClick={() => void reintentar()}>Volver a invitar</Button>
          )}
          <Button variant="secondary" disabled={ocupado} onClick={() => { setListo(null); setPorWhatsapp(false); }}>
            Invitar a otro
          </Button>
        </div>
        <EstiloAlumnos />
      </div>
    );
  }

  return (
    <div className="ina-col">
      {/* `Field` + `Input` y no `TextField`: el foco va a ESTE campo por id (ver el efecto de arriba),
          y `TextField` arma su propio id — pasarle otro desconectaría su rótulo. */}
      <Field label="Nombre" required htmlFor={idNombre}>
        <Input id={idNombre} value={nombre} placeholder="Nombre y apellido" disabled={ocupado}
          onChange={(e) => { poner('nombre', e.target.value); setDuplicados(null); }} />
      </Field>
      <TextField label="Email" required type="email" value={email} placeholder="persona@empresa.com" disabled={ocupado}
        hint="Le llega un correo con su acceso."
        onChange={(e) => { poner('email', e.target.value); setDuplicados(null); }} />
      {/* Punto 11 del audio: el teléfono NO es obligatorio (el mail es lo que invita). Sin él se pierde
          el WhatsApp: la casilla de abajo no aparece y después no le llega nada por ahí. */}
      <Field label="Teléfono" hint="Opcional. Sin él, sólo por correo.">
        <div aria-disabled={ocupado || undefined} style={ocupado ? { pointerEvents: 'none', opacity: 0.6 } : undefined}>
          <TelefonoConPais lada={tel.lada} numero={tel.numero} anchoLada={112}
            onLada={(v) => cambiarTel({ ...tel, lada: v })} onNumero={(v) => cambiarTel({ ...tel, numero: v })}
            inputStyle={{ width: '100%', minHeight: 'var(--touch)', padding: '10px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        </div>
      </Field>
      <TextField label="Empresa" value={empresa} disabled={ocupado} onChange={(e) => poner('empresa', e.target.value)} />
      <Checkbox checked={sinCobro} onChange={(v) => setBorrador((n) => ({ ...n, sinCobro: v }))} label="Sin cobro" hint="Becado o bonificado." disabled={ocupado} />
      {ofreceWa && (
        <Checkbox checked={porWhatsapp} onChange={setPorWhatsapp} disabled={ocupado}
          label="También por WhatsApp" hint="Le llega el mismo link por tu línea." />
      )}

      {/* EL DUPLICADO TIENE SALIDA: usar al que ya existe (el botón dice si además pasa a ser cliente)
          o crear otro igual. Un «ya existe» sin salida obliga a ir al CRM a buscarlo. */}
      {duplicados && (
        <div className="ina-dup">
          {duplicados.map((d) => (
            <div key={d.leadId} className="ina-dup-fila">
              <span className="ina-sub" title={d.texto}>{d.texto}</span>
              <Button size="sm" variant="primary" loading={ocupado} onClick={() => void crear({ usarLeadId: d.leadId })}>
                {d.ganado ? `Invitar a ${d.nombre}` : `Hacer cliente a ${d.nombre}`}
              </Button>
            </div>
          ))}
          <Button size="sm" variant="tertiary" disabled={ocupado || !puede} onClick={() => void crear({ crearIgual: true })}>Crear otro igual</Button>
        </div>
      )}
      {error && <p className="ina-mal">{error}</p>}
      {!duplicados && (
        <div className="ina-pie">
          {/* Lo que pasa, en el botón: se crea en el CRM, entra al kanban y le llega el mail. */}
          <Button variant="primary" loading={ocupado} disabled={!puede} onClick={() => void crear()}>Crear e invitar</Button>
        </div>
      )}
      <EstiloAlumnos />
    </div>
  );
}

function EstiloAlumnos() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}

// ⚠️ NINGÚN BACKTICK ACÁ ADENTRO, ni en un comentario: cierra la cadena a la mitad (AGENTS.md).
const CSS = `
.ina-col{ display:flex; flex-direction:column; gap:12px; min-width:0; }
.ina-lista{ list-style:none; margin:0; padding:0; max-height:340px; overflow-y:auto; display:flex; flex-direction:column; }
.ina-fila{ display:grid; grid-template-columns:minmax(0,1fr) minmax(0,220px); gap:6px 12px; align-items:center; padding:8px 2px; border-top:1px solid var(--border); }
.ina-fila:first-child{ border-top:0; }
.ina-fila > .ina-ok, .ina-fila > .ina-mal{ grid-column:1 / -1; margin:0; }
.ina-nom{ display:inline-block; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; vertical-align:bottom; }
.ina-sub{ font-size:var(--fs-meta); color:var(--dim); overflow-wrap:anywhere; }
.ina-ok{ margin:0; font-size:12.5px; color:var(--good); }
.ina-mal{ margin:0; font-size:12.5px; color:var(--bad); }
.ina-nada{ margin:8px 2px; font-size:13.5px; color:var(--faint); }
.ina-pista{ margin:0 2px; font-size:var(--fs-meta); }
.ina-pie{ display:flex; justify-content:flex-end; gap:8px; }
.ina-dup{ display:flex; flex-direction:column; gap:8px; padding:10px 12px; border-radius:10px; background:var(--warn-bg); }
.ina-dup-fila{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
.ina-dup > button{ align-self:flex-start; }
.ina-correo{ display:flex; flex-direction:column; gap:6px; padding:12px; border-radius:10px; border:1px solid var(--border); background:var(--surface); }
.ina-correo-tit{ margin:0; font-size:13.5px; font-weight:600; color:var(--ink); }
.ina-correo > .ina-sub{ margin:0 0 4px; }
`;

// ── «Del embudo»: invitar a alguien que todavía NO compró ─────────────────────────────────────────
//
// Pedido de Martín (13/10/2026), textual: «Incluir un buscador de leads en la ventana de invitación a
// cursos que permita seleccionar contactos en cualquier etapa del embudo y no solo los ganados»
// (Fathom 858545195 @91:40).
//
// Es una TERCERA pestaña y no un cambio de las otras dos, porque son tres preguntas distintas:
// «Clientes sin invitar» es la lista de los que ya compraron, «Alguien nuevo» da de alta a quien no
// existe, y ésta busca en la cartera a alguien que SÍ existe y todavía no compró. Meterla en la
// primera habría mezclado una lista con un buscador — y la lista de clientes es corta y se lee entera.
//
// ⚠️ LA CARTERA NO VIAJA AL NAVEGADOR: se busca en el server y vuelven ~20 filas
//    (`buscarLeadsParaInvitarAction`, con el MISMO criterio que el tablero y el CRM del teléfono).
// ⚠️ NO LO HACE CLIENTE NI LO MUEVE EN EL KANBAN: sólo le abre el curso. Mover de etapa a alguien por
//    haberle dado acceso es cambiarle la venta, y eso lo decide el CRM.

function DelEmbudo({ productoId, ocupado, ocupar, hecho, onListo }: {
  productoId: number;
  ocupado: boolean;
  ocupar: (v: boolean) => void;
  hecho: () => void;
  onListo?: () => void;
}) {
  const [q, setQ] = useState('');
  const [filas, setFilas] = useState<FilaEmbudo[] | null>(null);
  const [hayMas, setHayMas] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState('');
  const [emails, setEmails] = useState<Record<number, string>>({});
  const [resultados, setResultados] = useState<Record<number, { enviado: boolean; texto: string }>>({});
  const [correo, setCorreo] = useState<CorreoQueFallo>(null);
  const idQ = useId();

  // ⚠️ SE BUSCA CON UN RESPIRO Y LA ÚLTIMA GANA. Sin el contador, una respuesta lenta de «mar» pisa a
  //    la de «martín» y la lista muestra lo que NO se escribió — el bug clásico de todo buscador, y el
  //    más difícil de ver porque sólo aparece con la red lenta.
  const pedido = useRef(0);
  useEffect(() => {
    const texto = q.trim();
    if (texto.length < 2) { setFilas(null); setHayMas(false); setBuscando(false); return; }
    const mio = ++pedido.current;
    setBuscando(true);
    const t = setTimeout(() => {
      void buscarLeadsParaInvitarAction(texto, productoId)
        .then((r) => {
          if (mio !== pedido.current) return;        // llegó tarde: la gana la última
          if (!r.ok) { setError(r.error); setFilas([]); return; }
          setError(''); setFilas(r.filas); setHayMas(r.hayMas);
        })
        .catch(() => { if (mio === pedido.current) { setError('No se pudo buscar.'); setFilas([]); } })
        .finally(() => { if (mio === pedido.current) setBuscando(false); });
    }, 250);
    return () => clearTimeout(t);
  }, [q, productoId]);

  async function invitar(f: FilaEmbudo) {
    const correoDe = (emails[f.id] ?? f.email ?? '').trim();
    if (!correoDe) { setError('Falta su email.'); return; }
    setError('');
    if (ocupado) return;
    // `ocupar` es el interruptor del modal (como en Clientes y Nuevo): se prende antes y se apaga siempre.
    ocupar(true);
    let r: Awaited<ReturnType<typeof invitarLeadDeCualquierEtapaAction>>;
    try { r = await invitarLeadDeCualquierEtapaAction(f.id, productoId, correoDe); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo invitar.'); return; }
    finally { ocupar(false); }
    if (!r.ok) { setResultados((x) => ({ ...x, [f.id]: { enviado: false, texto: r.error } })); return; }
    setCorreo(r.correo);
    setResultados((x) => ({ ...x, [f.id]: { enviado: r.enviado, texto: r.aviso.texto } }));
    hecho();
    onListo?.();
  }

  return (
    <>
      {/* Qué se busca y dónde: una frase, porque la pestaña sola no dice que acá entra CUALQUIERA. */}
      <Field label="Buscar en el embudo" htmlFor={idQ} hint="Cualquier etapa, no sólo los ganados." error={error || undefined}>
        <Input id={idQ} type="search" value={q} autoFocus placeholder="Nombre, email, teléfono o #id"
          onChange={(e) => setQ(e.target.value)} />
      </Field>

      {buscando && <div style={{ padding: '10px 2px' }}><Spinner size={14} /></div>}

      {/* Los tres estados se dicen distinto: todavía no escribiste, no hay nadie así, y acá están. */}
      {!buscando && filas === null && (
        <p className="cu-vacio">Escribe al menos dos letras.</p>
      )}
      {!buscando && filas?.length === 0 && (
        <p className="cu-vacio">Nadie con ese nombre en el embudo.</p>
      )}

      {!!filas?.length && (
        <div className="cu-embudo-lista">
          {filas.map((f) => {
            const r = resultados[f.id];
            const mail = emails[f.id] ?? f.email ?? '';
            return (
              <div key={f.id} className="cu-embudo-fila">
                <div className="cu-embudo-quien">
                  <span className="cu-embudo-nombre">{f.nombre}</span>
                  {/* Lo que lo distingue de un homónimo, que es para lo que se busca. */}
                  {f.segunda && <span className="cu-embudo-segunda">{f.segunda}</span>}
                </div>
                {r
                  ? <span className={r.enviado ? 'cu-embudo-ok' : 'cu-embudo-mal'}>{r.texto}</span>
                  : f.yaInvitado
                    ? <span className="cu-embudo-ya">Ya invitado</span>
                    : (
                      <>
                        <Input type="email" value={mail} placeholder="persona@empresa.com"
                          onChange={(e) => setEmails((x) => ({ ...x, [f.id]: e.target.value }))} />
                        <Button variant="secondary" disabled={ocupado || !mail.trim()} onClick={() => void invitar(f)}>
                          Invitar
                        </Button>
                      </>
                    )}
              </div>
            );
          })}
          {/* No se trunca en silencio: si hay más, se dice y se dice cómo verlos. */}
          {hayMas && <p className="cu-vacio">Hay más. Afiná la búsqueda.</p>}
        </div>
      )}

      {correo && <CorreoAhiMismo cual={correo} />}
    </>
  );
}
