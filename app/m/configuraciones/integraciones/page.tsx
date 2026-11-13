// =============================================================================
// /m/configuraciones/integraciones — «Configuración del negocio» › Integraciones en el teléfono (17/10/2026)
// =============================================================================
// En la URL, /integraciones. Referencia: Ajustes › «Cuentas» de iOS y «Apps» de Slack en el celular. Es la grilla de la
// computadora (app/integraciones/IntegracionesBoard.tsx) destilada, con LAS MISMAS SECCIONES, en el mismo orden y con los
// mismos rótulos (24/10/2026, la estructura de Vercel Marketplace): «Tus cuentas de IA» arriba (su casa en el teléfono es
// /m/cuenta/ia), «Conectadas» (las que tienen un problema abierto primero, con él en su fila), «Sin conectar» (las opcionales
// al final) y, abajo, el «Historial de problemas». Antes: «Para resolver» arriba y una sección por categoría. Cada fila abre
// una hoja con qué hace, para qué sirve y cómo está.
//
// ⚠️ CONECTAR SE HACE EN LA COMPUTADORA, por ahora. El modal de conectar de /integraciones (`ServicioSuelto` y su
// `ServicioModal`) es un Modal de escritorio. Pegar una clave o seguir el OAuth de Meta en un sheet del teléfono es una
// pantalla que todavía no existe (docs/relevo/mako-mobile.md). La hoja lo dice y abre ESA integración en la versión de
// computadora (`?abrir=<key>`, el link que el modal ya entiende: lib/integracion-en-tab.ts).
// ⚠️ SÓLO LEE: la computadora además reconcilia los incidentes de Meta al abrirse (`reconciliarIncidentes`, que escribe)
// y le pregunta a Meta la salud de la cuenta. El teléfono lee los incidentes como quedaron (el cron horario los
// reconcilia igual) y no le pega a Meta al abrir una lista.
// =============================================================================

import '../configuraciones.css';
import { redirect } from 'next/navigation';
import { requireMovil } from '@/lib/movil-guard';
import { rutaConWs } from '@/lib/workspace';
import { ABRIR_IA } from '@/lib/ia-pc-reglas';
import { getIntegraciones, getIntegracion, type Integracion } from '@/lib/integraciones';
import { getIncidentes } from '@/lib/meta-health-history';
import { SIN_MODAL_SUELTO } from '@/lib/integracion-en-tab';
import { DEFS, ordenCategoria } from '@/lib/integraciones-catalogo';
import { ordenIA } from '@/lib/ia-labels';
import { esPasarela } from '@/lib/cobros-tipos';
import { POR_QUE_IA_DE_MAKO, POR_QUE_LA_CONFIGURA_MAKO } from '@/lib/ia-keys';
import { CabeceraM, PantallaM } from '@/app/m/_ui';
import { IntegracionesM, type IntegracionM, type ProblemaM } from './IntegracionesM';

export const dynamic = 'force-dynamic';

export default async function IntegracionesMovil({ searchParams }: { searchParams: Promise<{ abrir?: string; servicio?: string }> }) {
  await requireMovil({ navKey: 'integraciones' });
  // `?abrir=ia` («Conectar mi IA» de Copywriting y del Ops Center): en el teléfono la casa de la IA es /perfil/ia, que dice
  // qué hay y que se conecta en la computadora (13/11/2026, en producción: el link dejaba la lista sin nada abierto).
  if ((await searchParams).abrir?.trim().toLowerCase() === ABRIR_IA) redirect(await rutaConWs('/perfil/ia'));
  const [lista, incidentes, sp] = await Promise.all([getIntegraciones(), getIncidentes(30).catch(() => []), searchParams]);
  // Los incidentes abiertos de cada servicio: el problema de una conectada se lee en SU fila (como en la computadora).
  const abiertos = new Map(incidentes.filter((x) => x.resolvedAt == null).map((x) => [x.service, x]));
  // Al navegador va sólo lo que la pantalla dibuja.
  const aM = (i: Integracion): IntegracionM => {
    const inc = abiertos.get(i.key);
    return {
      key: i.key, nombre: i.nombre, categoria: i.categoria, descripcion: i.descripcion, estado: i.estado, detalle: i.detalle,
      paraQue: i.paraQue ?? null, soloServidor: i.soloServidor === true,
      // Una IA que configura el equipo de MaKo va con las conectadas (como en la computadora).
      conectada: i.estado === 'conectada' || i.detalle === POR_QUE_LA_CONFIGURA_MAKO,
      // La clave que pegó es la de MaKo: sin conectar, con algo que hacer (como en la tarjeta de la computadora).
      problema: inc ? { estado: inc.statusLabel, rojo: inc.severidad === 'rojo' } : i.detalle === POR_QUE_IA_DE_MAKO ? { estado: 'Revisa tu clave', rojo: false } : null,
      opcional: esPasarela(i.key),
      // El link de escritorio que abre SU modal (o la grilla, para las que no se abren sueltas).
      enComputadora: SIN_MODAL_SUELTO.includes(i.key) ? '/integraciones' : `/integraciones?abrir=${encodeURIComponent(i.key)}`,
    };
  };
  const integraciones = lista.map(aM);
  // El orden de la computadora: por categoría (lib/integraciones-catalogo.ts) y, en Inteligencia, primero las de pago.
  const enOrden = (a: IntegracionM, b: IntegracionM) => ordenCategoria(a.categoria) - ordenCategoria(b.categoria) || ordenIA(a.key) - ordenIA(b.key);
  const rango = (i: IntegracionM) => (i.problema ? (i.problema.rojo ? 0 : 1) : 2);
  const conectadas = integraciones.filter((i) => i.conectada).sort((a, b) => rango(a) - rango(b) || enOrden(a, b));
  const sinConectar = integraciones.filter((i) => !i.conectada).sort((a, b) => rango(a) - rango(b) || Number(a.opcional) - Number(b.opcional) || enOrden(a, b));
  const historial: ProblemaM[] = incidentes.map((x) => ({
    id: x.id, servicio: lista.find((i) => i.key === x.service)?.nombre ?? x.service, estado: x.statusLabel, detalle: x.detalle,
    rojo: x.severidad === 'rojo', confirmado: x.confirmado, enCurso: x.resolvedAt == null,
  }));
  const abrir = (sp.abrir ?? sp.servicio ?? '').trim().toLowerCase() || null;
  // ⚠️ EL LINK DE UNA SIN TARJETA ABRE SU HOJA (25/10/2026). MaKo manda `/integraciones?abrir=anthropic` (o openai, gemini,
  // groq, google) por WhatsApp, y en el teléfono cae acá (lib/movil-rutas.ts). Esas cinco son `oculto` y la lista de
  // arriba no las trae: el link dejaba a la persona en una lista sin la conexión que le falta y sin nada abierto. Se lee
  // SÓLO la pedida (`getIntegracion` no mira `oculto`, como el modal suelto de la computadora) y va aparte: abre su hoja,
  // con «Conectar en la computadora», y no se suma a la lista.
  const suelta = abrir && !lista.some((i) => i.key === abrir) && DEFS.some((d) => d.key === abrir && d.oculto)
    ? await getIntegracion(abrir).catch(() => null) : null;
  return (
    <PantallaM>
      <CabeceraM titulo="Integraciones" />
      <IntegracionesM conectadas={conectadas} sinConectar={sinConectar} historial={historial} abrir={abrir} suelta={suelta ? aM(suelta) : null} />
    </PantallaM>
  );
}
