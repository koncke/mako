// =============================================================================
// La portada tal como la ve quien NO ejecuta JavaScript
// =============================================================================
// Es el `fallback` del <Suspense> que envuelve a la landing en app/page.tsx, y
// existe por un motivo medido, no por prolijidad.
//
// EL CASO (08/10/2026). Meta rechazó DOS veces la verificación del negocio con «la
// razón social de la empresa debe aparecer en el sitio web», la segunda con el
// nombre ya puesto en el pie. El HTML de https://hola-mako.com/ lo traía, pero
// adentro de un `<div hidden id="S:0">`: el layout raíz envuelve TODA la app en un
// <Suspense fallback={null}> (app/layout.tsx, por el `useSearchParams` del
// WsProvider), y React SACA APARTE —oculto, hasta que un script lo inserta— todo
// bloque de Suspense que pase los 12.800 bytes, aunque ya esté listo. La landing
// pesa ~190 KB, así que quien lee el HTML sin ejecutar JavaScript (el verificador
// de Meta, las vistas previas de WhatsApp) veía una página VACÍA.
//
// Con la landing en su propio Suspense, el bloque del layout queda chico y se
// escribe visible, y lo que se ve sin JavaScript es ESTE fallback. Con JavaScript
// el script de React lo reemplaza por la landing en cuanto llega, que trae la misma
// razón social en su pie (`PieLegal`, app/vsl/Landing.tsx).
//
// ⚠️ DESDE EL 10/10/2026 EL LAYOUT YA NO TIENE ESE SUSPENSE (se sacó para que
// /privacidad se leyera sin JavaScript; ver app/layout.tsx). Lo de arriba es la
// historia: hoy el Suspense de app/page.tsx es el ÚNICO que esconde la landing, y
// este fallback sigue siendo lo que lee el verificador porque así lo aprobó Meta
// (el porqué de no tocarlo, en app/page.tsx).
//
// ⚠️ TIENE QUE QUEDAR CHICO igual: lo que lee quien no ejecuta JS es este bloque, y
// tests/razon-social-sitio.test.ts lo fija renderizando en streaming, como en
// producción.
//
// Con JavaScript puede verse un instante mientras baja la página, por eso lleva el
// fondo y la letra de la landing: se lee como su arranque, no como otra pantalla.
// =============================================================================

import { EMAIL_MAKO } from '@/lib/app-url';
import { RAZON_SOCIAL_MAKO } from '@/lib/titular-mako';

export function PortadaSinJs() {
  const link: React.CSSProperties = { color: '#6B7280', textDecoration: 'underline' };
  return (
    <section
      style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 18, padding: '48px 24px', textAlign: 'center',
        background: '#FFFFFF', color: '#171A21', fontFamily: "'Geist', system-ui, sans-serif",
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4 }}>MaKo</div>
      <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.15, fontWeight: 700, letterSpacing: -0.8, maxWidth: 720 }}>
        El mejor software para vender High Ticket con VSL Funnel
      </h1>
      <p style={{ margin: 0, fontSize: 17, color: '#4B5563' }}>Del primer clic en tu anuncio al cliente que paga.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', justifyContent: 'center', fontSize: 13.5, color: '#6B7280', marginTop: 12 }}>
        <a href="/privacidad" style={link}>Privacidad</a>
        <a href="/terminos" style={link}>Términos</a>
        <a href="/reembolsos" style={link}>Reembolsos</a>
        <a href={`mailto:${EMAIL_MAKO}`} style={link}>{EMAIL_MAKO}</a>
        <span>{`Razón social: ${RAZON_SOCIAL_MAKO}`}</span>
      </div>
    </section>
  );
}
