import { permanentRedirect } from 'next/navigation';

// =============================================================================
// /vsl/sitio — la portada nueva SE MUDÓ A LA RAÍZ (app/page.tsx), 14/11/2026
// =============================================================================
// Acá vivió como vista previa desde el 12/11 mientras Martín la revisaba. La aprobó el 14/11 y pidió
// que fuera la principal: «está mal la ruta de la landing nueva que hicimos… tendría que estar en la
// ruta principal». Queda este redirect permanente porque él tiene el link a mano y puede estar pegado
// en mensajes y material; el componente vive en app/vsl/_sitio/Portada.tsx y lo sirve la raíz.
// =============================================================================

export default function SitioPage() {
  permanentRedirect('/');
}
