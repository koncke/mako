// Las áreas de /admin/dev, consolidadas.
// t: proyectos del tablero que le pertenecen (para contar tareas abiertas)
// e: estado base cuando no hay tareas abiertas · a: es agente · n: NUEVA (la encontró el barrido)
export const FAMILIAS = [
  {
    fam: 'Operate', sub: 'El día a día del cliente',
    grupos: [
      { g: 'General', areas: [
        { n: 'General', ruta: '/general', t: ['Feature: General'], e: 'listo' },
        { n: 'Foco / Hoy', ruta: '/focus', t: ['Feature: Foco'], e: 'por-construir' },
        { n: 'Mindset', t: ['Feature: Mindset'], e: 'por-construir' },
      ]},
      { g: 'Plan', areas: [
        { n: 'Plan', ruta: '/plan', t: ['Feature: Plan'], e: 'listo' },
        { n: 'Perro Guardián', a: 1, t: ['Agente: Perro Guardián'], e: 'listo' },
        { n: 'Meeting Reader', a: 1, t: ['Agente: Lector de reuniones'], e: 'listo' },
        { n: 'Auto-Close', a: 1, t: ['Agente: Cierre automático'], e: 'parcial' },
        { n: 'Startup Plan Seed', a: 1, e: 'listo' },
      ]},
      { g: 'CRM', areas: [
        { n: 'CRM', ruta: '/crm', t: ['Feature: CRM'], e: 'listo' },
        { n: 'Lead Insights', a: 1, e: 'listo' },
        { n: 'CRM Automation', a: 1, t: ['Agente: CRM automático'], e: 'parcial' },
        { n: 'Funnel Editor', ruta: '/funnel', e: 'listo', nuevo: 1, por: 'Fuente de verdad de las etapas. Pantalla real SIN entrada en el nav.' },
        { n: 'Products & Offers', e: 'parcial', nuevo: 1, por: 'Catálogo de productos por workspace (#374).' },
        { n: 'Contracts & Receipts', e: 'parcial', nuevo: 1, por: 'lib/pagos.ts + 5 rutas extract-*: lee contratos y comprobantes del cliente.' },
      ]},
      { g: 'Ads Manager', areas: [
        { n: 'Ads Manager', ruta: '/ads-manager', t: ['Feature: Ads Manager'], e: 'listo' },
        { n: 'Ads Optimizer Bot', a: 1, t: ['Agente: Ads Optimizer Bot'], e: 'por-construir' },
        { n: 'Meta Platform', e: 'parcial', nuevo: 1, por: 'La app de Meta: BM, App Review, OAuth, multi-cuenta. Distinto de la ingesta.' },
      ]},
      { g: 'Comunicación', areas: [
        { n: 'WhatsApp', ruta: '/whatsapp', t: ['Feature: WhatsApp'], e: 'listo' },
        { n: 'WhatsApp Advisor', a: 1, e: 'listo' },
        { n: 'Nutrition Writer', a: 1, e: 'listo' },
        { n: 'WhatsApp Labels ↔ Etapas', e: 'parcial', nuevo: 1, por: 'CONSTRUIDO Y DESENCHUFADO: el panel existe, ninguna página lo monta.' },
        { n: 'Workspace Phone Numbers', e: 'parcial', nuevo: 1, por: 'CONSTRUIDO Y DESENCHUFADO: tiene migración propia (0065) y nadie lo monta.' },
        { n: 'Email', ruta: '/email', t: ['Feature: Email'], e: 'listo' },
        { n: 'Email Writer', a: 1, e: 'listo' },
        { n: 'Email Delivery & Bajas', e: 'parcial', nuevo: 1, por: 'Rebotes, bajas y supresión de Resend. Sin pantalla.' },
        { n: 'Instagram', ruta: '/instagram', t: ['Feature: Instagram'], e: 'por-construir' },
      ]},
      { g: 'Onboarding', areas: [
        { n: 'Onboarding Wizard', ruta: '/onboarding', t: ['Feature: Onboarding'], e: 'listo', nuevo: 1, por: 'El shell bloqueante. Es el proyecto con MÁS tareas abiertas del tablero.' },
        { n: 'El Archivero', e: 'listo', nuevo: 1, por: 'Los documentos del negocio: de ahí sale casi todo el contexto de MaKo.' },
        { n: 'Fase y Norte', e: 'listo', nuevo: 1, por: 'El diagnóstico que gobierna qué le sugiere MaKo a cada cliente.' },
      ]},
      { g: 'Agenda y flujos', areas: [
        { n: 'Calendar & Scheduling', e: 'parcial', nuevo: 1, por: 'Calendly + Google Calendar: de dónde entra una reunión y cómo se mueve.' },
        { n: 'Flow Editor', e: 'parcial', por: 'Editor y motor se rompen juntos: lib/flujos.ts entra al mismo área.' },
      ]},
    ],
  },
  {
    fam: 'Analyze', sub: 'Mirar y entender',
    grupos: [
      { g: '', areas: [
        { n: 'Dashboard', ruta: '/dashboard', t: ['Feature: Dashboard'], e: 'listo' },
        { n: 'Second Brain', ruta: '/second-brain', t: ['Feature: Second Brain'], e: 'listo' },
        { n: 'Competitor Spy', ruta: '/competitor-spy', t: ['Feature: Competitor Spy'], e: 'por-construir' },
        { n: 'Experiments', ruta: '/experimentos', t: ['Feature: Experiments'], e: 'listo' },
        { n: 'Retro', a: 1, t: ['Agente: Retro'], e: 'listo' },
      ]},
      { g: 'Analysts', areas: [
        { n: 'Ads Analyst', ruta: '/ads-analyst', t: ['Feature: Ads Analyst'], e: 'listo' },
        { n: 'Landing Analyst', ruta: '/landing-analyst', t: ['Feature: Landing Analyst'], e: 'listo' },
        { n: 'Closing Analyst', ruta: '/closing', t: ['Feature: Closing Analyst'], e: 'listo' },
        { n: 'Offer Analyst', ruta: '/offer-analyst', t: ['Feature: Offer Analyst'], e: 'por-construir' },
        { n: 'VSL Analyst', ruta: '/vsl-analyst', t: ['Feature: VSL Analyst'], e: 'por-construir' },
        { n: 'Chat Analyst', ruta: '/chat-analyst', t: ['Feature: Chat Analyst'], e: 'por-construir' },
        { n: 'CS Analyst', ruta: '/cs-analyst', t: ['Feature: CS Analyst'], e: 'por-construir' },
        { n: 'YouTube Analyst', t: ['Feature: YouTube Analyst'], e: 'por-construir' },
      ]},
      { g: 'Ingesta de datos', areas: [
        { n: 'Meta Ads Ingest', e: 'parcial', nuevo: 1, por: 'La tubería que trae el gasto y las métricas de Meta. Sin área, nadie la audita.' },
        { n: 'Video Metrics Ingest', e: 'parcial', nuevo: 1, por: 'YouTube + Panda, dos crons propios.' },
        { n: 'VSL Tracking', e: 'parcial', nuevo: 1, por: 'El beacon y el vigilante. Ya costó 3 semanas de curva muerta.' },
        { n: 'Data Freshness', e: 'por-construir', nuevo: 1, por: 'Distinguir «la fuente dice cero» de «la fuente no existe». Hoy no se distingue.' },
      ]},
    ],
  },
  {
    fam: 'Sales Machine', sub: 'Convertir',
    grupos: [
      { g: '', areas: [
        { n: 'Chatbot', ruta: '/chatbot', t: ['Agente: Chatbot'], a: 1, e: 'listo' },
        { n: 'Landing Generator', ruta: '/landing-generator', t: ['Feature: Landing Generator'], e: 'listo' },
        { n: 'VSL Generator', ruta: '/vsl-generator', t: ['Feature: VSL Generator'], e: 'por-construir' },
        { n: 'Lead Magnet Generator', ruta: '/lead-magnet-generator', t: ['Feature: Lead Magnet Generator'], e: 'por-construir' },
        { n: 'Sales Email', ruta: '/sales-email', t: ['Feature: Sales Email'], e: 'por-construir' },
        { n: 'Newsletters', ruta: '/newsletters', e: 'por-construir' },
        { n: 'Closing Script', ruta: '/closing-script', t: ['Feature: Closing Script'], e: 'por-construir' },
        { n: 'Sales Roleplay', ruta: '/sales-roleplay', t: ['Feature: Sales Roleplay'], e: 'por-construir' },
        { n: 'Post-Call Follow-up', a: 1, e: 'parcial', nuevo: 1, por: 'Webhook de Fathom → borrador. Falta el go-live.' },
      ]},
    ],
  },
  {
    fam: 'Content Machine', sub: 'Producir',
    grupos: [
      { g: '', areas: [
        { n: 'Ideas', ruta: '/ideas', t: ['Feature: Ideas'], e: 'por-construir' },
        { n: 'Transcription Pipeline', e: 'listo', nuevo: 1, por: 'Audio→texto: lo usan WhatsApp, reuniones y los analysts. Compartido y sin dueño.' },
      ]},
      { g: 'Ads', areas: [
        { n: 'Ads Writer', ruta: '/ads-writer', t: ['Feature: Ads Writer'], e: 'listo' },
        { n: 'Creative Factory', t: ['Feature: Fábrica de creativos'], e: 'listo' },
        { n: 'Image Generator', ruta: '/image-generator', t: ['Feature: Image Generator'], e: 'por-construir' },
        { n: 'Video Generator', ruta: '/video-generator', t: ['Feature: Video Generator'], e: 'por-construir' },
      ]},
      { g: 'Instagram', areas: [
        { n: 'Reels', ruta: '/reels', t: ['Feature: Reels'], e: 'por-construir' },
        { n: 'Carousels', ruta: '/carousels', t: ['Feature: Carousels'], e: 'por-construir' },
        { n: 'Stories', ruta: '/stories', t: ['Feature: Stories'], e: 'por-construir' },
      ]},
      { g: 'YouTube', areas: [
        { n: 'YouTube Writer', ruta: '/youtube-writer', t: ['Feature: YouTube Writer'], e: 'por-construir' },
        { n: 'Thumbnails', ruta: '/thumbnails', t: ['Feature: Thumbnails'], e: 'por-construir' },
      ]},
    ],
  },
  {
    fam: 'MaKo', sub: 'La IA, de punta a punta',
    grupos: [
      { g: '', areas: [
        { n: 'Preguntale a MaKo', ruta: '/mako', a: 1, t: ['Feature: Preguntale a MaKo'], e: 'listo' },
        { n: 'MaKo Doer', a: 1, t: ['Agente: MaKo Doer'], e: 'parcial' },
        { n: 'WhatsApp de MaKo', ruta: '/agencia', t: ['Feature: WhatsApp de MaKo'], e: 'listo' },
        { n: 'Contexto de MaKo', ruta: '/contexto', t: ['Feature: Contexto de MaKo'], e: 'listo' },
        { n: 'Modelos IA', ruta: '/modelos-ia', t: ['Feature: Modelos IA'], e: 'listo' },
        { n: 'Motor de avisos', t: ['Avisos y reportes'], e: 'listo' },
        { n: 'AI Runtime & Cascada', e: 'listo', nuevo: 1, por: 'EL AGUJERO MÁS CARO: 916 líneas que ejecutan CADA llamada de IA del producto, cero piezas.' },
        { n: 'AI Spend & Cuotas', e: 'parcial', nuevo: 1, por: 'Medir el gasto de IA por cliente y cortarlo. Créditos y margen unitario cuelgan de acá.' },
      ]},
    ],
  },
  {
    fam: 'Business', sub: 'El negocio de MaKo — la familia que faltaba entera',
    nueva: 1,
    grupos: [
      { g: 'Cobros y planes', areas: [
        { n: 'Plans & Entitlements', t: ['Feature: Cobros y planes'], e: 'parcial', nuevo: 1, por: 'Free / Pro / Growth. La maquinaria YA corre con 3 capas hardcodeadas en lib/capas.ts y sin noción de plan.' },
        { n: 'Payment Gateway', e: 'por-construir', nuevo: 1, por: 'Stripe (#388). Grep de «stripe» en todo el repo: cero.' },
        { n: 'Subscriptions & Billing', e: 'por-construir', nuevo: 1, por: 'Ciclo de vida: alta, trial, upgrade, dunning, baja.' },
        { n: 'SaaS Metrics', e: 'por-construir', nuevo: 1, por: 'MRR, churn, LTV del propio MaKo.' },
      ]},
      { g: 'Legal', areas: [
        { n: 'Legal & Compliance', t: ['Legal y fiscal'], e: 'por-construir', nuevo: 1, por: 'Términos, privacidad, encargado de datos, LLC y fiscal.' },
        { n: 'Account Offboarding', e: 'por-construir', nuevo: 1, por: 'Bajarse los datos y borrar la cuenta. Obligación legal, no una feature.' },
      ]},
      { g: 'Go-to-Market', areas: [
        { n: 'Public Site', t: ['Vender MaKo: Landing y VSL'], e: 'listo', nuevo: 1, por: 'La landing + las 25 páginas de detalle. Lo único que ve un prospecto antes de pagar.' },
        { n: 'GTM: Ads', t: ['Vender MaKo: Ads'], e: 'parcial', nuevo: 1 },
        { n: 'GTM: Instagram', t: ['Vender MaKo: Orgánico Instagram'], e: 'parcial', nuevo: 1 },
        { n: 'GTM: YouTube', t: ['Vender MaKo: Orgánico YouTube'], e: 'parcial', nuevo: 1 },
        { n: 'GTM: Prospección', t: ['Vender MaKo: Prospección'], e: 'parcial', nuevo: 1 },
        { n: 'GTM: Oferta y precios', t: ['Vender MaKo: Oferta y precios'], e: 'parcial', nuevo: 1 },
        { n: 'Referrals', t: ['Vender MaKo: Referidos'], e: 'por-construir', nuevo: 1, por: '«Gana dinero con MaKo»: la cara del cliente, no solo la nuestra.' },
      ]},
    ],
  },
  {
    fam: 'Platform', sub: 'Administrar la plataforma',
    grupos: [
      { g: '', areas: [
        { n: 'Clientes', ruta: '/admin', t: ['Feature: Admin y clientes'], e: 'listo' },
        { n: 'Integraciones', ruta: '/integraciones', t: ['Feature: Integraciones'], e: 'listo' },
        { n: 'Conocimientos', ruta: '/conocimientos', t: ['Feature: Conocimientos'], e: 'listo' },
        { n: 'Perfil', ruta: '/perfil', e: 'listo' },
        { n: 'Configuraciones', ruta: '/configuraciones', t: ['Feature: Configuraciones y equipo'], e: 'listo' },
        { n: 'Reportar problema', ruta: '/tickets', t: ['Feature: Feedback y errores'], e: 'por-construir' },
        { n: 'Branding MaKo', e: 'listo', nuevo: 1, por: '93 MB de material que a propósito NO viven en el repo. Bucket privado, links firmados.' },
        { n: 'Shared Links', e: 'listo', nuevo: 1, por: 'La ÚNICA superficie que sirve datos sin sesión. Tocar auth sin saber que existe la abre.' },
        { n: 'Workspace Lifecycle', e: 'listo', nuevo: 1, por: 'Reset, clonar y sembrar un workspace. El guard que casi borra clientes reales vive acá.' },
        { n: 'Design System', t: ['Diseño de la app'], e: 'parcial', nuevo: 1, por: 'El programa de adopción: 2 de 9 partes, 7.680 estilos inline sueltos.' },
      ]},
      { g: 'Dev', areas: [
        { n: 'Documentación', ruta: '/admin/docs', e: 'listo' },
        { n: 'MaKo UX/UI', ruta: '/admin/ui', e: 'listo' },
        { n: 'Grafo', e: 'listo' },
        { n: 'Agent Gateway', e: 'listo', nuevo: 1, por: 'La puerta por la que entra el Claude Code del cliente. Token y skill propios.' },
        { n: 'Self-Healing Dev Agent', a: 1, e: 'por-construir', nuevo: 1, por: 'JUSTAMENTE el agente que esta sección viene a alimentar. Todavía no existe.' },
      ]},
    ],
  },
  {
    fam: 'Infra', sub: 'Lo que sostiene la app',
    grupos: [
      { g: 'Seguridad', areas: [
        { n: 'Auth & Session', e: 'listo', nuevo: 1, por: 'Login con Google, token firmado, roles. El inventario tenía la pantalla, no el mecanismo.' },
        { n: 'Access Gate', e: 'parcial', nuevo: 1, por: 'proxy.ts + tab-access: quién ve qué. Un error acá es un IDOR.' },
        { n: 'Multi-Tenant Isolation', t: ['Seguridad y multi-inquilino'], e: 'parcial', nuevo: 1, por: 'workspace.ts, RLS, TENANT_TABLES. Ya hubo 15 tablas abiertas al rol anon.' },
        { n: 'Credentials Vault (BYOK)', e: 'parcial', nuevo: 1, por: 'Cifrado e hidratación de las llaves del cliente. Migración v2 a medio camino.' },
        { n: 'Rate Limiting', e: 'parcial', nuevo: 1 },
      ]},
      { g: 'Datos', areas: [
        { n: 'Database & Migrations', e: 'listo', nuevo: 1, por: '131 migraciones sin un lugar donde leer por qué existe cada una.' },
        { n: 'File Storage', e: 'listo', nuevo: 1, por: 'Buckets privados y URLs firmadas.' },
        { n: 'Caching & Revalidation', e: 'parcial', nuevo: 1 },
      ]},
      { g: 'Runtime', areas: [
        { n: 'Cron Scheduler', e: 'parcial', nuevo: 1, por: '18 trabajos corren solos en producción y ninguna pantalla dice si fallan.' },
        { n: 'Webhook Gateway', e: 'parcial', nuevo: 1, por: 'Fathom, Chatwoot, Meta, Evolution, Resend, Calendly: 6 puertas, un router.' },
        { n: 'Transactional Email', e: 'listo', nuevo: 1 },
      ]},
      { g: 'Entrega', areas: [
        { n: 'Build & Deploy', t: ['Infraestructura y versionado'], e: 'listo', nuevo: 1, por: 'El typecheck fuera del build costó 109 horas de CPU en una semana.' },
        { n: 'App Versioning', e: 'por-construir', nuevo: 1, por: 'Avisarle al cliente que hay versión nueva. Hoy se queda con la vieja abierta.' },
        { n: 'Observability & Errors', e: 'por-construir', nuevo: 1, por: 'Cero Sentry, cero error.tsx, cero tabla de errores. Un error en prod no deja rastro.' },
        { n: 'Tests & QA', e: 'listo', nuevo: 1, por: '415 tests y un hook de pre-push que no los corre.' },
        { n: 'Local Dev Environment', e: 'listo', nuevo: 1 },
        { n: 'Orphaned UI & Dead Routes', e: 'por-construir', nuevo: 1, por: '7 componentes construidos que ninguna página monta, y redirects que apuntan a pantallas muertas.' },
      ]},
    ],
  },
];
