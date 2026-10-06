// =============================================================================
// Login — Google SSO, y nada más
// =============================================================================
// Overlay full-screen (cubre el layout/sidebar). El botón vive en LoginForm
// (client, lee ?next= y ?error= con useSearchParams) y va envuelto en Suspense:
// sin el boundary el build falla.
// El fallback es la misma tarjeta sin el botón, así no parpadea el layout.
//
// Con la sesión YA abierta no se muestra el formulario: eso le decía "Entrá al
// dashboard" a alguien que estaba adentro, y parecía que se había deslogueado.
// Se le avisa quién es y se lo lleva a /inicio, el repartidor por rol.
//
// Por eso la página dejó de ser estática: leer la cookie de sesión exige render
// dinámico. Es una pantalla de baja frecuencia, así que el costo es despreciable.
// =============================================================================

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from './LoginForm';
import { YaLogueado } from './YaLogueado';
import { getUsuarioActual } from '@/lib/auth';
import { hayAlumnoVigente } from '@/lib/alumno-acceso';
import { RUTA_ALUMNO } from '@/lib/rutas-publicas';
import { previewDeDestino } from '@/lib/preview-links';
import { APP_BASE_URL } from '@/lib/app-url';

export const dynamic = 'force-dynamic';

/**
 * LA TARJETA DE WHATSAPP SE DECIDE ACÁ, y no es un lugar raro: es donde el
 * crawler ATERRIZA. Sin sesión, `proxy.ts` corta cualquier ruta interna con un
 * 307 a `/login?next=<destino>`, así que la preview que se veía nunca fue la de
 * la pantalla — era el metadata raíz, idéntico para todo. Medido en producción:
 * un borrador, un resumen de lead, una integración y el plan devolvían los mismos
 * tres tags.
 *
 * El destino viaja en `next=`, que ya es público (está en el link que la persona
 * recibió), así que esto no le abre nada a nadie. Ver lib/preview-links.ts.
 */
export async function generateMetadata(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> },
): Promise<Metadata> {
  const sp = await searchParams;
  const next = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  const p = previewDeDestino(next);
  const imagen = `${APP_BASE_URL}/api/og?tipo=${encodeURIComponent(p.tipo)}`;
  return {
    title: p.titulo,
    description: p.descripcion,
    openGraph: {
      type: 'website', siteName: 'MaKo',
      title: p.titulo, description: p.descripcion,
      images: [{ url: imagen, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title: p.titulo, description: p.descripcion, images: [imagen] },
  };
}

export default async function LoginPage() {
  const sesion = await getUsuarioActual();
  // El alumno de un curso (cookie `mako_alumno`, lib/alumno-sesion.ts) no tiene sesión de MaKo:
  // cualquier ruta interna lo rebota acá. En vez de mandarlo a un Google que no le abre nada
  // nuevo, se le ofrece volver a SU programa. La sesión de MaKo gana: si hay las dos, manda
  // YaLogueado.
  //
  // ⚠️ «Entrar con otra cuenta» NO es decorativo: sin él, quien tenga la cookie de alumno en un
  // navegador que también usa para MaKo (Martín o Mauricio probando una invitación) se queda en
  // esta pantalla sin forma de loguearse, porque el botón de Google no se dibuja. Va directo al
  // OAuth (GET), sin borrar la cookie: entrar como usuario no la necesita borrada.
  const alumno = sesion ? false : await hayAlumnoVigente();
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#14161B', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '380px', background: '#F5F7FA', borderRadius: '18px', border: '1px solid rgba(0,0,0,.08)', padding: '34px 30px', boxShadow: '0 12px 40px rgba(0,0,0,.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: '#facc15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#14161B', fontSize: '18px' }}>✦</div>
          <div style={{ fontWeight: 700, fontSize: '22px', color: '#14161B', letterSpacing: '-0.02em' }}>MaKo</div>
        </div>
        {sesion ? (
          <YaLogueado nombre={sesion.nombre} email={sesion.email} />
        ) : alumno ? (
          <>
            <a
              href={RUTA_ALUMNO}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: '14px', padding: '12px', borderRadius: '11px', background: '#2F6FED', color: '#fff', fontSize: '15px', fontWeight: 600, textDecoration: 'none', boxSizing: 'border-box' }}
            >
              Ir a tu programa
            </a>
            <a href="/api/auth/google?next=%2Finicio" style={{ display: 'block', marginTop: '14px', textAlign: 'center', fontSize: '13px', color: '#5B6472' }}>
              Entrar con otra cuenta
            </a>
          </>
        ) : (
          <>
            <div style={{ fontSize: '14px', color: '#5B6472', marginBottom: '22px' }}>Entra al dashboard.</div>
            <Suspense fallback={<div style={{ height: '46px', borderRadius: '11px', background: 'rgba(0,0,0,.05)' }} />}>
              <LoginForm />
            </Suspense>
          </>
        )}
      </div>
    </div>
  );
}
