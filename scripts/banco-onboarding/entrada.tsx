// LA ENTRADA DEL BANCO DEL ONBOARDING (21/11/2026): monta los componentes REALES en un escenario (?p=…) y contesta las llamadas a /api
// con datos inventados (nunca una sesión ni un dato de un cliente). Lo toca scripts/banco-onboarding/probar.mjs.
//   ?p=videos   dos videos en el hilo, con el motor (un video a la vez; en la esquina, sólo el último)
//   ?p=whatsapp el chat del arranque en el código, con el WhatsApp simulado de la revisión (el modal)
//   ?p=barra    la barra del administrador (RESET, «Autocompletar», «Ir a un paso») con el chat del arranque en la revisión
//   ?p=brain    el Second Brain del recorrido sobre un marco de grafo
//   ?p=marca    el motor con un paso que pide clic (sin «Siguiente») y uno que explica (con «Siguiente»)
//   ?p=chat&etapa=nombre|telefono|origen|interes|contacto|listo   el chat del arranque en esa pregunta (la caja, las tarjetas)
//   ?p=llegada  la llegada al reto con su «dale play» (el motor y la marca que invita)
import { createRoot } from 'react-dom/client';
import { MotorTutorial } from '@/app/_ui/tutorial/MotorTutorial';
import { VideoDelMomento } from '@/app/_ui/tutorial/VideoDelMomento';
import { ChatArranqueV2 } from '@/app/onboarding/ChatArranqueV2';
import { ImpersonationBanner } from '@/app/_components/ImpersonationBanner';
import { BrainDelRecorrido } from '@/app/second-brain/BrainDelRecorrido';
import { LlegadaAlReto } from '@/app/second-brain/LlegadaAlReto';
import { ModoDelUsuario } from '@/app/_components/ModoDelUsuario';
import { cerrarTutorial, mostrarTutorial, senalAhora } from '@/app/_ui/tutorial/store';
import { TUTORIAL_RECORRIDO } from '@/lib/onboarding-v2/recorrido';
import { etapaDeArranqueV2, mensajesDeArranqueV2, type EstadoArranque, type HechosArranque } from '@/lib/onboarding-arranque';
import { vistaDelWhatsappSimulado } from '@/lib/onboarding-v2/whatsapp-simulado';
import { PASOS_DE_REVISION, estadoArranqueHasta } from '@/lib/onboarding-v2/saltar';
import type { VistaArranque } from '@/lib/onboarding-arranque-server';
import type { TutorialPestana } from '@/lib/tutoriales';

type W = Window & { __llamadas: Array<{ url: string; metodo: string; cuerpo: unknown }>; __bancoRuta?: string; __banco?: Record<string, unknown> };
const w = window as unknown as W;
const q = new URLSearchParams(window.location.search);
const p = q.get('p') ?? 'videos';
// El modo: el que eligió este navegador, como al arrancar la app (ModoDelUsuario, con ModoArranque antes de React); ?tema=oscuro lo fuerza.
if (q.get('tema') === 'oscuro') document.documentElement.setAttribute('data-tema', 'oscuro');

const HECHOS = { modo: 'oferta', v2: true, conTelefono: true, terminado: false, nombreCuenta: 'Valentina', nombreWorkspace: 'Nutri Vale' } as unknown as HechosArranque;
const vistaDe = (e: EstadoArranque, etapa: string | null, extra: Record<string, unknown> = {}, h: HechosArranque = HECHOS): VistaArranque => ({
  modo: 'oferta', v2: true, etapa: etapa ?? etapaDeArranqueV2(e, h), antes: mensajesDeArranqueV2(e, h), despues: [], sesion: null, tieneSesion: false, sesionCaida: false,
  funnelDefaultId: null, introVista: true, nombre: e.nombre ?? '', avisosQr: null, telefonoNumero: e.telefonoNumero ?? '', telefonoDelPago: '',
  whatsapp: null, crmTipo: null, crmPropuesta: null, canal: null, crmRecomendado: 'directa', interes: null, bloqueo: null, equipo: null, ...extra,
}) as unknown as VistaArranque;

// Las llamadas a /api: se anotan (las mira probar.mjs) y se contestan con datos inventados.
w.__llamadas = [];
const fetchReal = window.fetch.bind(window);
let vistaActual: VistaArranque | null = null;
function responder(ruta: string, metodo: string): unknown {
  if (ruta === '/api/auth/me') return { ok: true, impersonando: true, clienteNombre: 'Cliente de Prueba', modoAgencia: false, salida: '/admin', agencia: null };
  if (ruta === '/api/admin/negocio-de-prueba') return { ok: true, disponible: false };
  if (ruta === '/api/admin/saltar-onboarding') return metodo === 'GET' ? { ok: true, puede: true, pasos: PASOS_DE_REVISION } : { ok: true, destino: '/second-brain?reto=1', vistos: [], salto: null, avisos: [] };
  if (ruta === '/api/onboarding/arranque') return { ok: true, vista: vistaActual };
  if (ruta === '/api/plan-dictado') return { ok: true, texto: 'Valentina' };
  if (ruta === '/api/recorridos') return metodo === 'GET' ? { ok: true, guardado: true, vistos: [], quien: 'a1b2c3d4e5f60718' } : { ok: true };
  return { ok: true };
}
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const u = new URL(url, window.location.href);
  if (!u.pathname.startsWith('/api/')) return fetchReal(input, init);
  const metodo = (init?.method ?? 'GET').toUpperCase();
  let cuerpo: unknown = null;
  if (init?.body instanceof FormData) cuerpo = { formulario: [...init.body.keys()] };
  else { try { cuerpo = init?.body ? JSON.parse(String(init.body)) : null; } catch { cuerpo = String(init?.body ?? ''); } }
  w.__llamadas.push({ url: u.pathname + u.search, metodo, cuerpo });
  return new Response(JSON.stringify(responder(u.pathname, metodo)), { status: 200, headers: { 'content-type': 'application/json' } });
};

const raiz = createRoot(document.getElementById('raiz')!);

if (p === 'videos') {
  w.__bancoRuta = '/second-brain';
  raiz.render(<>
    <MotorTutorial revision={false} />
    <div style={{ padding: 16 }}>
      <div data-banco="arriba" style={{ width: 360 }}><VideoDelMomento clave="banco-arriba" titulo="El de arriba" revision={false} /></div>
      <div style={{ height: 1600 }} />
      <div data-banco="abajo" style={{ width: 360 }}><VideoDelMomento clave="banco-abajo" titulo="El de abajo" revision={false} /></div>
      <div style={{ height: 600 }} />
    </div>
  </>);
} else if (p === 'whatsapp') {
  const e: EstadoArranque = { introVista: true, nombre: 'Valentina', telefono: 'codigo', telefonoNumero: '+5491155550101', telefonoVisto: '+54 9 11 5555 0101', telefonoEntrante: true, simulacion: { codigo: '482913' } };
  vistaActual = vistaDe(e, 'codigo', { whatsapp: vistaDelWhatsappSimulado(e) });
  raiz.render(<div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}><ChatArranqueV2 inicial={vistaActual} persona={{ nombre: 'Valentina', email: 'valentina@ejemplo.test' }} /></div>);
} else if (p === 'barra') {
  const e: EstadoArranque = { introVista: true };
  vistaActual = vistaDe(e, 'nombre');
  raiz.render(<>
    <ImpersonationBanner />
    <div style={{ height: '100vh', paddingTop: 52, boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}><ChatArranqueV2 inicial={vistaActual} ejemplos persona={{ nombre: '', email: 'prueba@ejemplo.test' }} /></div>
  </>);
} else if (p === 'brain') {
  w.__banco = { recorrido: () => mostrarTutorial(TUTORIAL_RECORRIDO), cerrar: () => cerrarTutorial(), senal: () => senalAhora()?.tipo ?? null };
  raiz.render(<>
    <div className="cbg-marco" data-recorrido="sb-grafo" style={{ position: 'relative', width: 900, height: 600, margin: 20, background: '#1b1b1b', borderRadius: 12, overflow: 'hidden' }}>
      <div className="cbg-barra" style={{ position: 'absolute', top: 10, left: 10, right: 10, zIndex: 3, height: 40, background: '#444', borderRadius: 10 }}>
        <button type="button" className="cbg-atras" data-recorrido="sb-brain-volver">←</button>
      </div>
      <p data-banco="grafo-real" style={{ color: '#fff', padding: 80 }}>El grafo real del negocio</p>
    </div>
    <BrainDelRecorrido sabe={{ nombre: 'Valentina', negocio: 'Nutri Vale', whatsapp: true, origen: 'Instagram', intereses: ['Armar mi landing'] }} />
  </>);
} else if (p === 'chat') {
  const etapa = q.get('etapa') ?? 'nombre';
  const tel = { telefonoNumero: '5491155550101' };
  const estados: Record<string, EstadoArranque> = {
    nombre: { introVista: true }, telefono: { introVista: true, nombre: 'Valentina' },
    origen: estadoArranqueHasta('origen', tel), interes: estadoArranqueHasta('interes', tel), contacto: estadoArranqueHasta('agendado', tel), listo: estadoArranqueHasta('cierre', tel),
  };
  const h = etapa === 'listo' ? ({ ...HECHOS, terminado: true } as HechosArranque) : HECHOS;
  vistaActual = vistaDe(estados[etapa] ?? estados.nombre, null, {}, h);
  raiz.render(<div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}><ModoDelUsuario /><ChatArranqueV2 inicial={vistaActual} persona={{ nombre: 'Valentina', email: 'valentina@ejemplo.test' }} /></div>);
} else if (p === 'llegada') {
  w.__bancoRuta = '/second-brain';
  raiz.render(<>
    <MotorTutorial revision={false} />
    <div className="co-hilo" style={{ height: '100vh', overflow: 'auto', padding: 24, boxSizing: 'border-box' }}><LlegadaAlReto nombre="Valentina" listo /></div>
  </>);
} else if (p === 'marca') {
  w.__bancoRuta = '/banco';
  const t: TutorialPestana = {
    pestana: 'banco', nombre: 'Banco', ruta: '/banco',
    pasos: [
      { sel: '#objetivo', titulo: 'Toca aquí', texto: 'Este paso pide un clic.', clic: true, haz: 'Haz clic en el botón' },
      { sel: '#otro', titulo: 'Mira aquí', texto: 'Este paso sólo explica.' },
    ],
  } as unknown as TutorialPestana;
  w.__banco = { tutorial: () => mostrarTutorial(t) };
  raiz.render(<>
    <MotorTutorial revision={false} />
    <div style={{ padding: 120, display: 'flex', gap: 40 }}>
      <button type="button" id="objetivo" style={{ padding: '10px 18px' }}>El botón</button>
      <span id="otro" style={{ padding: 10, border: '1px solid #999' }}>Otra cosa</span>
    </div>
  </>);
}
