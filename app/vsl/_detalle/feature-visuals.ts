// =============================================================================
// Specs de graficos por feature (hero + uno por capacidad) para /vsl/<slug>.
// =============================================================================
// Generado desde el contenido real de cada landing (textos acotados para SVG).
// Biblioteca de tipos + params: ./Visual.tsx.

import type { VisualSpec } from './Visual';

export type FeatureVisuals = { hero: VisualSpec; groups: VisualSpec[] };

export const FEATURE_VISUALS: Record<string, FeatureVisuals> = {
  "funnel": {
    "hero": {
      "type": "funnel",
      "title": "Del primer clic al contrato firmado",
      "stages": [
        {
          "label": "Meta / Anuncio",
          "w": 1,
          "trg": "auto"
        },
        {
          "label": "VSL",
          "w": 0.62,
          "trg": "auto"
        },
        {
          "label": "Agenda R1",
          "w": 0.4,
          "trg": "auto"
        },
        {
          "label": "Grupo WhatsApp",
          "w": 0.28,
          "trg": "mako"
        },
        {
          "label": "Pago",
          "w": 0.16,
          "trg": "manual"
        },
        {
          "label": "Cierre",
          "w": 0.1,
          "trg": "manual"
        }
      ]
    },
    "groups": [
      {
        "type": "pyramid",
        "title": "Editás una banda, derivás las otras dos",
        "tiers": [
          {
            "label": "Activo — lo editás…",
            "tone": "green"
          },
          {
            "label": "Nutrición negativa…",
            "tone": "amber"
          },
          {
            "label": "Descartado — fija p…",
            "tone": "red"
          }
        ]
      },
      {
        "type": "signalFlow",
        "title": "Quién dispara cada paso",
        "nodes": [
          {
            "label": "Formulario",
            "sub": "Meta instant forms",
            "tone": "green"
          },
          {
            "label": "Agenda",
            "sub": "Calendly",
            "tone": "green"
          },
          {
            "label": "Pago / Asistencia",
            "sub": "por marcado",
            "tone": "amber"
          }
        ],
        "badges": [
          "⚡ automático",
          "◐ automatizable…",
          "✋ requiere marca…"
        ]
      },
      {
        "type": "diffCard",
        "rows": [
          {
            "field": "Pipeline",
            "before": "Hoja en blanco",
            "after": "VSL+Webinar"
          },
          {
            "field": "Grupo WhatsApp",
            "before": "—",
            "after": "Etapa tipo grupo"
          },
          {
            "field": "Plantillas",
            "before": "Ninguna",
            "after": "High-Ticket · Simple…"
          }
        ]
      },
      {
        "type": "kanban",
        "cols": [
          {
            "label": "Entrada",
            "cards": 24,
            "tone": "blue"
          },
          {
            "label": "Reunión R1",
            "cards": 8,
            "tone": "amber"
          },
          {
            "label": "Cierre",
            "cards": 3,
            "tone": "green"
          }
        ]
      }
    ]
  },
  "onboarding": {
    "hero": {
      "type": "splitLoad",
      "loading": [
        "Métricas de 365 días",
        "Leads de formularios",
        "Transcripciones de tus…",
        "Análisis de guiones",
        "Llamadas de Fathom",
        "Métricas del VSL"
      ]
    },
    "groups": [
      {
        "type": "statTiles",
        "title": "Conteos reales entrando en background",
        "tiles": [
          {
            "label": "Métricas",
            "value": "365 días",
            "tone": "blue"
          },
          {
            "label": "Leads",
            "value": "1.240",
            "tone": "green"
          },
          {
            "label": "Transcripts",
            "value": "86",
            "tone": "violet"
          }
        ],
        "rows": [
          {
            "name": "Guiones analizados",
            "amount": "42",
            "tone": "amber"
          },
          {
            "name": "Llamadas de Fathom",
            "amount": "57",
            "tone": "blue"
          },
          {
            "name": "Filas de VSL",
            "amount": "310",
            "tone": "green"
          }
        ]
      },
      {
        "type": "roleMatrix",
        "roles": [
          "Project Man…",
          "Completo"
        ],
        "tools": [
          {
            "tool": "Brief (3 pregunta…",
            "on": [
              true,
              true
            ]
          },
          {
            "tool": "Conectar Meta",
            "on": [
              false,
              true
            ]
          },
          {
            "tool": "Conectar WhatsApp",
            "on": [
              false,
              true
            ]
          },
          {
            "tool": "Diagnóstico Norte",
            "on": [
              true,
              true
            ]
          },
          {
            "tool": "Elegir funnel",
            "on": [
              false,
              true
            ]
          }
        ]
      },
      {
        "type": "phaseLadder",
        "title": "Tu Norte: en qué fase estás",
        "phases": [
          "Validación",
          "Tracción",
          "Escala",
          "Optimización",
          "Sistema"
        ],
        "current": 1
      },
      {
        "type": "thesisCard",
        "tabs": [
          "Métricas",
          "Leads",
          "Guiones",
          "Llamadas",
          "VSL",
          "Funnel"
        ],
        "thesis": "Tu cuello está en la conversión de R1, no en…",
        "leak": "$9.400"
      },
      {
        "type": "semaphore",
        "lit": "green",
        "verdict": "Fail-closed: si tu token de Meta cae a mitad, MaKo co…"
      }
    ]
  },
  "graphics": {
    "hero": {
      "type": "dashboardMock",
      "title": "Salud del Funnel + ✨ MaKo",
      "points": [
        0.35,
        0.5,
        0.42,
        0.66,
        0.58,
        0.78,
        0.7,
        0.88
      ]
    },
    "groups": [
      {
        "type": "makoAnswer",
        "q": "¿Apago este anuncio o lo escalo?",
        "a": "Escalalo",
        "detail": "MaKo razona sobre tus números exactos —impresiones, clicks, CTR, CPC, spend— no sobre la imagen, y con tu Norte y funnel_config real."
      },
      {
        "type": "funnel",
        "title": "Salud del Funnel (Meta)",
        "stages": [
          {
            "label": "Impresión",
            "w": 1,
            "trg": "auto"
          },
          {
            "label": "Click",
            "w": 0.6,
            "trg": "auto"
          },
          {
            "label": "Landing",
            "w": 0.34,
            "trg": "auto"
          },
          {
            "label": "VSL",
            "w": 0.18,
            "trg": "auto"
          }
        ]
      },
      {
        "type": "statTiles",
        "title": "Revenue: de agendar a cobrar",
        "tiles": [
          {
            "label": "Sold",
            "value": "$48k",
            "tone": "blue"
          },
          {
            "label": "Cash",
            "value": "$31k",
            "tone": "green"
          },
          {
            "label": "Outstanding",
            "value": "$17k",
            "tone": "amber"
          }
        ],
        "rows": [
          {
            "name": "SCL · ciclo agenda→pago",
            "amount": "22 días",
            "tone": "amber"
          }
        ]
      },
      {
        "type": "semaphore",
        "lit": "amber",
        "verdict": "Hay gasto pero la cohorte no cerró: ROAS y CAC dicen…"
      },
      {
        "type": "barChart",
        "title": "Audiencia por edad (México)",
        "bars": [
          {
            "label": "25-34",
            "v": 0.9,
            "tone": "blue"
          },
          {
            "label": "35-44",
            "v": 0.62
          },
          {
            "label": "18-24",
            "v": 0.4
          },
          {
            "label": "45-54",
            "v": 0.25
          }
        ]
      }
    ]
  },
  "crm": {
    "hero": {
      "type": "kanban",
      "cols": [
        {
          "label": "No Show R1/R2",
          "cards": 8,
          "tone": "red"
        },
        {
          "label": "Nutrición",
          "cards": 14,
          "tone": "amber"
        },
        {
          "label": "Reactivación",
          "cards": 6,
          "tone": "blue"
        }
      ]
    },
    "groups": [
      {
        "type": "funnel",
        "title": "Cuatro reglas, cero tarjetas arrastradas",
        "stages": [
          {
            "label": "Agenda Calendly",
            "w": 1,
            "trg": "auto"
          },
          {
            "label": "Asistió / No Show R…",
            "w": 0.78,
            "trg": "auto"
          },
          {
            "label": "Nutrición - No Agen…",
            "w": 0.52,
            "trg": "mako"
          },
          {
            "label": "Reactivación · 7-30…",
            "w": 0.3,
            "trg": "mako"
          }
        ]
      },
      {
        "type": "diffCard",
        "rows": [
          {
            "field": "Estado del lead",
            "before": "Agendó",
            "after": "No Show R1"
          },
          {
            "field": "Etapa pipeline",
            "before": "R1 agendada",
            "after": "No Show"
          },
          {
            "field": "Motivo de pérdida",
            "before": "—",
            "after": "No asistió"
          },
          {
            "field": "Link Fathom",
            "before": "—",
            "after": "fathom.video/call/…"
          }
        ]
      },
      {
        "type": "makoAnswer",
        "q": "¿Te vuelvo a proponer el No Show que…",
        "a": "No.",
        "detail": "Cada acción tiene clave única (T1:j1, T3, T6…). Precargo todas tus confirmaciones en una query y respeto tu criterio. Tope de 25 llamadas por corrida; el guard anti-carrera nunca reabre un Ganado o Perdido."
      },
      {
        "type": "signalFlow",
        "title": "Un botón: Claude cruza 7 fuentes → próxima acción",
        "nodes": [
          {
            "label": "7 fuentes",
            "sub": "ficha, Calendly, Cl…",
            "tone": "blue"
          },
          {
            "label": "Claude",
            "sub": "terceros delimitado…",
            "tone": "violet"
          },
          {
            "label": "Próxima acción",
            "sub": "dolor · objeciones…",
            "tone": "green"
          }
        ],
        "badges": [
          "Ficha CRM",
          "Calendly R1/R2",
          "Closing Analyst",
          "WhatsApp",
          "Anuncio Meta",
          "Tracking VSL",
          "Cobranza"
        ]
      },
      {
        "type": "roleMatrix",
        "roles": [
          "R1",
          "R2",
          "Ganado"
        ],
        "tools": [
          {
            "tool": "R1 marcada",
            "on": [
              true,
              false,
              true
            ]
          },
          {
            "tool": "Calificado",
            "on": [
              true,
              false,
              true
            ]
          },
          {
            "tool": "Fathom adjunto",
            "on": [
              true,
              false,
              true
            ]
          },
          {
            "tool": "R2 marcada",
            "on": [
              false,
              true,
              true
            ]
          },
          {
            "tool": "Monto + Deal Deta…",
            "on": [
              false,
              false,
              true
            ]
          }
        ]
      }
    ]
  },
  "api": {
    "hero": {
      "type": "signalFlow",
      "title": "MaKo le devuelve a Meta la conversión real",
      "nodes": [
        {
          "label": "CRM",
          "sub": "calificado=true",
          "tone": "blue"
        },
        {
          "label": "SHA-256",
          "sub": "email + teléfono",
          "tone": "violet"
        },
        {
          "label": "Meta CAPI",
          "sub": "conversión real",
          "tone": "green"
        }
      ],
      "badges": [
        "server-side",
        "event_id determi…",
        "action_source=we…"
      ]
    },
    "groups": [
      {
        "type": "funnel",
        "title": "El evento se dispara desde el CRM, no desde el form…",
        "stages": [
          {
            "label": "Formulario lleno",
            "w": 1,
            "trg": "auto"
          },
          {
            "label": "Lead · calificado=t…",
            "w": 0.55,
            "trg": "mako"
          },
          {
            "label": "QualifiedLead · asi…",
            "w": 0.32,
            "trg": "mako"
          },
          {
            "label": "Schedule · reserva…",
            "w": 0.18,
            "trg": "manual"
          }
        ]
      },
      {
        "type": "diffCard",
        "rows": [
          {
            "field": "Email",
            "before": "mauricio@elevate.…",
            "after": "9f2a…c71 · SHA-256"
          },
          {
            "field": "Teléfono",
            "before": "+52 55 1234 5678",
            "after": "3b8e…a02 · SHA-256"
          },
          {
            "field": "Pixel bloqueado",
            "before": "señal perdida",
            "after": "llega server-side"
          }
        ]
      },
      {
        "type": "semaphore",
        "lit": "green",
        "verdict": "Meta puede estar caído: sendMetaCAPIEvent nunca lanza…"
      },
      {
        "type": "retentionCurve",
        "title": "En qué segundo se cae el espectador de tu VSL, crea…",
        "points": [
          1,
          0.78,
          0.6,
          0.42,
          0.28,
          0.15
        ],
        "dropIndex": 3,
        "beats": [
          "Video 3s",
          "ThruPlay",
          "p25",
          "p50",
          "p75",
          "p100"
        ]
      },
      {
        "type": "signalFlow",
        "title": "Lead Ads con doble red",
        "nodes": [
          {
            "label": "Webhook",
            "sub": "HMAC-SHA256",
            "tone": "blue"
          },
          {
            "label": "Cron polling",
            "sub": "últimos 90 días",
            "tone": "amber"
          },
          {
            "label": "MaKo + Chatwoot",
            "sub": "avisos + alta WA",
            "tone": "green"
          }
        ],
        "badges": [
          "timingSafeEqual",
          "dedup meta_lead_…",
          "backfill ?dias=90"
        ]
      },
      {
        "type": "byokKey",
        "account": "Meta Ads · Elevate MX (BYOK…"
      }
    ]
  },
  "ads": {
    "hero": {
      "type": "adRow",
      "rows": [
        {
          "name": "003. Ventas / Dolor - J…",
          "cash": "$182k",
          "roas": "5.1x",
          "tone": "green"
        },
        {
          "name": "007. Ventas / Prueba so…",
          "cash": "$94k",
          "roas": "3.8x",
          "tone": "blue"
        },
        {
          "name": "012. Ventas / Urgencia…",
          "cash": "$21k",
          "roas": "1.4x",
          "tone": "amber"
        },
        {
          "name": "015. Ventas / Aspiracio…",
          "cash": "$0",
          "roas": "0.0x",
          "tone": "red"
        }
      ]
    },
    "groups": [
      {
        "type": "statTiles",
        "title": "Estado + rendimiento + CRM en una fila",
        "tiles": [
          {
            "label": "Gasto",
            "value": "$34k",
            "tone": "blue"
          },
          {
            "label": "CPL",
            "value": "$180",
            "tone": "amber"
          },
          {
            "label": "Agendas",
            "value": "47",
            "tone": "green"
          }
        ],
        "rows": [
          {
            "name": "Anuncio 003 · ganado",
            "amount": "$182k",
            "tone": "green"
          },
          {
            "name": "Anuncio 007 · ganado",
            "amount": "$94k",
            "tone": "green"
          }
        ]
      },
      {
        "type": "diffCard",
        "rows": [
          {
            "field": "Nombre",
            "before": "Copia de anuncio 3",
            "after": "003. Ventas / Dolor -…"
          },
          {
            "field": "Presupuesto",
            "before": "$500/día",
            "after": "$800/día"
          },
          {
            "field": "Estado",
            "before": "Activo",
            "after": "Pausado"
          }
        ]
      },
      {
        "type": "splitLoad",
        "loading": [
          "Campaña creada · PAUSED",
          "Conjunto · CBO",
          "Creativo subido",
          "Anuncio · en revisión"
        ]
      },
      {
        "type": "barChart",
        "title": "3 a 5 variantes, un ángulo psicológico cada una",
        "bars": [
          {
            "label": "Dolor",
            "v": 0.9,
            "tone": "red"
          },
          {
            "label": "Prueba social",
            "v": 0.75,
            "tone": "blue"
          },
          {
            "label": "Urgencia",
            "v": 0.6,
            "tone": "amber"
          },
          {
            "label": "Aspiracional",
            "v": 0.7,
            "tone": "violet"
          },
          {
            "label": "Contraintuitivo",
            "v": 0.8,
            "tone": "green"
          }
        ]
      },
      {
        "type": "signalFlow",
        "title": "El UTM empalma el clic con el lead",
        "nodes": [
          {
            "label": "Clic en el ad",
            "sub": "UTMs inyectados",
            "tone": "blue"
          },
          {
            "label": "{{ad.name}}",
            "sub": "source/medium/conte…",
            "tone": "violet"
          },
          {
            "label": "Funnel",
            "sub": "empalma con el lead",
            "tone": "green"
          }
        ],
        "badges": [
          "Retargeting sin…",
          "Segmentación no…",
          "Repara rechazados"
        ]
      },
      {
        "type": "ragIndex",
        "title": "mp4 → Whisper → embeddings"
      }
    ]
  },
  "script": {
    "hero": {
      "type": "retentionCurve",
      "title": "Tu guion, con la retención real de Meta encima",
      "points": [
        1,
        0.92,
        0.74,
        0.58,
        0.38,
        0.3,
        0.22
      ],
      "dropIndex": 4,
      "beats": [
        "Gancho",
        "Contexto",
        "Problema",
        "Mecanismo",
        "Prueba",
        "Objeción",
        "CTA"
      ]
    },
    "groups": [
      {
        "type": "barChart",
        "title": "Retención interpolada bloque por bloque",
        "bars": [
          {
            "label": "Gancho",
            "v": 0.95,
            "tone": "green"
          },
          {
            "label": "Contexto",
            "v": 0.78
          },
          {
            "label": "Problema",
            "v": 0.62
          },
          {
            "label": "Mecanismo",
            "v": 0.4,
            "tone": "red"
          },
          {
            "label": "Prueba",
            "v": 0.34
          },
          {
            "label": "CTA",
            "v": 0.28
          }
        ]
      },
      {
        "type": "signalFlow",
        "title": "Cada guion, por su histórico completo",
        "nodes": [
          {
            "label": "Guion",
            "sub": "3–7 beats tipados",
            "tone": "blue"
          },
          {
            "label": "Meta",
            "sub": "spend · hook · cuar…",
            "tone": "violet"
          },
          {
            "label": "CRM",
            "sub": "leads ganados",
            "tone": "green"
          }
        ],
        "badges": [
          "Todo el acumulad…",
          "Se recalcula en…",
          "Solo aparece si…"
        ]
      },
      {
        "type": "adRow",
        "rows": [
          {
            "name": "Escalá esto: frena, ret…",
            "cash": "$18k",
            "roas": "4.2x",
            "tone": "green"
          },
          {
            "name": "Gancho sin cuerpo: fren…",
            "cash": "$6k",
            "roas": "1.3x",
            "tone": "amber"
          },
          {
            "name": "Plata quemada: 0 agenda…",
            "cash": "$0",
            "roas": "0x",
            "tone": "red"
          }
        ]
      },
      {
        "type": "makoAnswer",
        "q": "Pegué un guion que todavía no corrió.…",
        "a": "Mejorar-gancho antes de escalar",
        "detail": "Se parece a tu ángulo saturado pero con hook rate estimado alto. Plan: presupuesto + días mínimos + ~8.000 impresiones y un guion de control. Es una hipótesis, no un hecho."
      },
      {
        "type": "diffCard",
        "rows": [
          {
            "field": "Ángulo",
            "before": "IA: Autoridad",
            "after": "Tuyo: Dolor / urgencia"
          },
          {
            "field": "Avatar",
            "before": "vacío",
            "after": "Dueño PyME 35-50"
          },
          {
            "field": "Re-sync diario",
            "before": "El re-análisis te…",
            "after": "Tu override se guarda…"
          }
        ]
      }
    ]
  },
  "closing": {
    "hero": {
      "type": "scoreCard",
      "title": "Score de cierre · 7 dimensiones",
      "items": [
        {
          "label": "Situación",
          "v": 0.8
        },
        {
          "label": "Problema",
          "v": 0.7
        },
        {
          "label": "Implicación",
          "v": 0.5
        },
        {
          "label": "Necesidad",
          "v": 0.6
        },
        {
          "label": "Propuesta",
          "v": 0.75
        },
        {
          "label": "Objeciones",
          "v": 0.4
        },
        {
          "label": "CTA",
          "v": 0.55
        }
      ]
    },
    "groups": [
      {
        "type": "signalFlow",
        "title": "Venta vs entrega de servicio, sola",
        "nodes": [
          {
            "label": "Fathom",
            "sub": "cientos de llamadas",
            "tone": "blue"
          },
          {
            "label": "Triage barato",
            "sub": "descarta tests, <4…",
            "tone": "amber"
          },
          {
            "label": "Claude árbitro",
            "sub": "lead ya ganado = co…",
            "tone": "green"
          }
        ],
        "badges": [
          "match por email…",
          "o share_url guar…",
          "sin taggear a ma…"
        ]
      },
      {
        "type": "chatThread",
        "title": "Evidencia citada con timestamp",
        "msgs": [
          {
            "from": "in",
            "text": "[123s · 2:03] \"No sé si es el momento para…"
          },
          {
            "from": "out",
            "text": "Objeción de precio — marcada como manejada"
          },
          {
            "from": "in",
            "text": "[318s · 5:18] \"Dale, mándame el contrato.\""
          },
          {
            "from": "out",
            "text": "CTA 8/10 · cita textual del transcript"
          }
        ]
      },
      {
        "type": "barChart",
        "title": "Gap ganadas vs perdidas: Objeciones decide tus cier…",
        "bars": [
          {
            "label": "Objeciones",
            "v": 0.9,
            "tone": "red"
          },
          {
            "label": "CTA",
            "v": 0.65,
            "tone": "amber"
          },
          {
            "label": "Implicación",
            "v": 0.5
          },
          {
            "label": "Propuesta",
            "v": 0.35
          },
          {
            "label": "Situación",
            "v": 0.15
          }
        ]
      },
      {
        "type": "diffCard",
        "rows": [
          {
            "field": "Objeciones",
            "before": "6",
            "after": "8"
          },
          {
            "field": "Outcome",
            "before": "Perdida",
            "after": "Ganada"
          },
          {
            "field": "Score global",
            "before": "5.4",
            "after": "6.9"
          }
        ]
      },
      {
        "type": "statTiles",
        "title": "Se llena sola, todos los días",
        "tiles": [
          {
            "label": "Cron diario",
            "value": "14:30",
            "tone": "blue"
          },
          {
            "label": "Llamadas por corrida",
            "value": "6",
            "tone": "green"
          },
          {
            "label": "Presupuesto",
            "value": "150s",
            "tone": "amber"
          }
        ]
      }
    ]
  },
  "seguimiento": {
    "hero": {
      "type": "emailSequence",
      "title": "El seguimiento correcto para cada momento — corre s…",
      "steps": [
        {
          "day": "Sin agend…",
          "subject": "No agendó — secuencia de 3 toques"
        },
        {
          "day": "No-show R1",
          "subject": "Faltó a la llamada — reencuadre"
        },
        {
          "day": "No-show R2",
          "subject": "Faltó a R2 — recuperación"
        },
        {
          "day": "Confirmado",
          "subject": "No paga aún — cierre"
        },
        {
          "day": "30-90 días",
          "subject": "Reactivación de fríos"
        }
      ]
    },
    "groups": [
      {
        "type": "funnel",
        "title": "13 disparadores sobre el estado real del lead",
        "stages": [
          {
            "label": "Dejó el form sin ag…",
            "w": 1,
            "trg": "auto"
          },
          {
            "label": "Vio VSL 50%+ sin ag…",
            "w": 0.72,
            "trg": "auto"
          },
          {
            "label": "Agendado sin confir…",
            "w": 0.55,
            "trg": "mako"
          },
          {
            "label": "No-show R1",
            "w": 0.4,
            "trg": "auto"
          },
          {
            "label": "Calificado sin R2",
            "w": 0.28,
            "trg": "mako"
          },
          {
            "label": "Confirmado sin pagar",
            "w": 0.16,
            "trg": "manual"
          }
        ]
      },
      {
        "type": "ragIndex",
        "title": "Transcripciones de tus ads + perfil de marca → guía…"
      },
      {
        "type": "chatThread",
        "title": "Responde el lead → la nutrición se corta sola",
        "msgs": [
          {
            "from": "out",
            "text": "Quedó tu lugar sin confirmar, ¿seguís inter…"
          },
          {
            "from": "out",
            "text": "Te dejo el link para agendar tu llamada 👇"
          },
          {
            "from": "in",
            "text": "Sí! perdón, ahí agendo ahora"
          }
        ]
      },
      {
        "type": "signalFlow",
        "title": "El WhatsApp oficial no envía hasta que Meta aprueba",
        "nodes": [
          {
            "label": "Copy de MaKo",
            "sub": "texto del paso",
            "tone": "blue"
          },
          {
            "label": "Plantilla Meta-safe",
            "sub": "sin links, variable…",
            "tone": "amber"
          },
          {
            "label": "Meta approved",
            "sub": "recién ahí envía",
            "tone": "green"
          }
        ],
        "badges": [
          "Falla cerrado",
          "Sin phantom-sends",
          "Idempotente"
        ]
      },
      {
        "type": "phaseLadder",
        "title": "Máquina de estados: cada inscripción avanza sola, c…",
        "phases": [
          "Inscrito",
          "Toque 1 enviado",
          "Toque 2 enviado",
          "Toque 3 enviado",
          "Cerrado / opt-…"
        ],
        "current": 2
      }
    ]
  },
  "cobranza": {
    "hero": {
      "type": "statTiles",
      "title": "Vendido y cobrado, nunca el mismo número",
      "tiles": [
        {
          "label": "Sold Revenue",
          "value": "$48k",
          "tone": "blue"
        },
        {
          "label": "Cash Collected",
          "value": "$31k",
          "tone": "green"
        },
        {
          "label": "Outstanding",
          "value": "$17k",
          "tone": "amber"
        }
      ]
    },
    "groups": [
      {
        "type": "barChart",
        "title": "Salen de la misma tabla — siempre cierran entre sí",
        "bars": [
          {
            "label": "Sold Revenue $48k",
            "v": 1,
            "tone": "blue"
          },
          {
            "label": "Cash Collected $31k",
            "v": 0.65,
            "tone": "green"
          },
          {
            "label": "Outstanding $17k",
            "v": 0.35,
            "tone": "amber"
          }
        ]
      },
      {
        "type": "statTiles",
        "title": "A quién cobrarle hoy — ordenado por vencimiento",
        "tiles": [
          {
            "label": "Outstanding total",
            "value": "$17k",
            "tone": "amber"
          }
        ],
        "rows": [
          {
            "name": "Bruno M. · URGENTE venc…",
            "amount": "$2.5k",
            "tone": "red"
          },
          {
            "name": "Carla D. · vence en 3 d…",
            "amount": "$1.8k",
            "tone": "amber"
          },
          {
            "name": "Diego R. · vence en 12…",
            "amount": "$3.0k",
            "tone": "blue"
          }
        ]
      },
      {
        "type": "emailSequence",
        "title": "Plan uniforme: inicial + hasta 6 cuotas por tu día…",
        "steps": [
          {
            "day": "Cierre",
            "subject": "Inicial · $2.000"
          },
          {
            "day": "Día 10",
            "subject": "Cuota 1 · $1.500"
          },
          {
            "day": "Día 10 +1…",
            "subject": "Cuota 2 · $1.500 (pagada, intacta)"
          },
          {
            "day": "Día 10 +2…",
            "subject": "Cuota 3 · $1.500 (pendiente)"
          }
        ]
      },
      {
        "type": "docExtract",
        "fields": [
          {
            "k": "Monto",
            "v": "$1.500"
          },
          {
            "k": "Fecha de pago",
            "v": "14/07/2026"
          },
          {
            "k": "Hora del ingreso",
            "v": "09:42"
          },
          {
            "k": "Comprobante",
            "v": "transferencia.pdf → bucket del workspace"
          }
        ]
      },
      {
        "type": "dashboardMock",
        "title": "Sold vs Cash Collected vs gasto en Meta · 18 meses",
        "points": [
          0.3,
          0.4,
          0.35,
          0.5,
          0.55,
          0.5,
          0.62,
          0.7,
          0.65,
          0.72,
          0.8,
          0.78,
          0.85,
          0.9,
          0.82,
          0.88,
          0.95,
          0.9
        ]
      }
    ]
  },
  "contrato": {
    "hero": {
      "type": "docExtract",
      "fields": [
        {
          "k": "Razón social",
          "v": "Elevate MX SA de CV"
        },
        {
          "k": "ID fiscal",
          "v": "RFC EMX2401197QA"
        },
        {
          "k": "Domicilio",
          "v": "Av. Reforma 222, CDMX"
        },
        {
          "k": "Servicio",
          "v": "Consultoría · 12 sesiones"
        },
        {
          "k": "Promesa",
          "v": "3 clientes en 90 días"
        },
        {
          "k": "Plan de cuotas",
          "v": "3 × $4,000 USD"
        }
      ]
    },
    "groups": [
      {
        "type": "statTiles",
        "title": "Deal Details, extraído de un pase",
        "tiles": [
          {
            "label": "Total contrato",
            "value": "$12k",
            "tone": "green"
          },
          {
            "label": "Cuotas",
            "value": "3",
            "tone": "blue"
          },
          {
            "label": "Obligaciones",
            "value": "5",
            "tone": "violet"
          }
        ],
        "rows": [
          {
            "name": "Cuota 1",
            "amount": "$4k",
            "tone": "green"
          },
          {
            "name": "Cuota 2",
            "amount": "$4k",
            "tone": "amber"
          },
          {
            "name": "Cuota 3",
            "amount": "$4k",
            "tone": "amber"
          }
        ]
      },
      {
        "type": "makoAnswer",
        "q": "¿Subiste un PDF o una foto?",
        "a": "Detecté una captura → la mando como visió…",
        "detail": "Vos no elegís nada. Si es PDF va como documento; si es foto, como visión. Y 'Completar con IA' relee el contrato ya guardado sin volver a subir nada."
      },
      {
        "type": "diffCard",
        "rows": [
          {
            "field": "Modalidad",
            "before": "—",
            "after": "Online (default)"
          },
          {
            "field": "Frecuencia",
            "before": "—",
            "after": "1 vez por semana"
          },
          {
            "field": "Domicilio (a mano)",
            "before": "Av. Reforma 222",
            "after": "Av. Reforma 222"
          }
        ]
      },
      {
        "type": "signalFlow",
        "title": "De la cuota extraída al cash del dashboard",
        "nodes": [
          {
            "label": "Cuotas",
            "sub": "monto por monto",
            "tone": "blue"
          },
          {
            "label": "Motor de cobranza",
            "sub": "marca ganado y cerr…",
            "tone": "violet"
          },
          {
            "label": "Cash collected",
            "sub": "Comercial + General",
            "tone": "green"
          }
        ],
        "badges": [
          "Conserva las pag…",
          "Bucket privado p…",
          "URLs firmadas de…"
        ]
      }
    ]
  },
  "customer": {
    "hero": {
      "type": "gauge",
      "value": 0.68,
      "big": "68",
      "label": "Health Score del cl…",
      "tone": "amber"
    },
    "groups": [
      {
        "type": "kanban",
        "cols": [
          {
            "label": "Venta",
            "cards": 12,
            "tone": "blue"
          },
          {
            "label": "Entrega de servicio",
            "cards": 8,
            "tone": "green"
          },
          {
            "label": "Interna / Otro",
            "cards": 3,
            "tone": "violet"
          }
        ]
      },
      {
        "type": "scoreCard",
        "title": "Health Score = lo dicho en sesión × cobranza",
        "items": [
          {
            "label": "Sentimiento en la s…",
            "v": 0.8
          },
          {
            "label": "Compromisos cumplid…",
            "v": 0.55
          },
          {
            "label": "Próximos pasos clar…",
            "v": 0.7
          },
          {
            "label": "Cobranza al día",
            "v": 0.9
          }
        ]
      },
      {
        "type": "signalFlow",
        "title": "La baja se caza cuando coinciden las dos señales",
        "nodes": [
          {
            "label": "Señal negativa",
            "sub": "en la llamada de co…",
            "tone": "red"
          },
          {
            "label": "Cuota impaga",
            "sub": "cobranza vencida",
            "tone": "amber"
          },
          {
            "label": "MaKo te avisa",
            "sub": "a tiempo para rever…",
            "tone": "green"
          }
        ],
        "badges": [
          "Churn detectable",
          "Reversible"
        ]
      },
      {
        "type": "makoAnswer",
        "q": "¿A quién le ofrezco renovación o upse…",
        "a": "Upsell + renovación",
        "detail": "El cliente lo pidió con sus propias palabras durante el servicio — ahí queda el LTV, no en tu intuición."
      }
    ]
  },
  "semaforo": {
    "hero": {
      "type": "semaphore",
      "lit": "red",
      "verdict": "Hay algo urgente que atender"
    },
    "groups": [
      {
        "type": "pyramid",
        "title": "Focos ordenados por urgencia",
        "tiers": [
          {
            "label": "Urgente",
            "tone": "red"
          },
          {
            "label": "Vigilar",
            "tone": "amber"
          },
          {
            "label": "En orden",
            "tone": "green"
          }
        ]
      },
      {
        "type": "statTiles",
        "title": "Cuatro modos de falla del funnel VSL",
        "tiles": [
          {
            "label": "Cuenta Meta",
            "value": "ACTIVE",
            "tone": "red"
          },
          {
            "label": "Frecuencia 7d",
            "value": ">3.5",
            "tone": "amber"
          },
          {
            "label": "Deals R1→R2",
            "value": "se enfrí…",
            "tone": "amber"
          }
        ],
        "rows": [
          {
            "name": "Cobranza vencida — cobr…",
            "amount": "rojo",
            "tone": "red"
          },
          {
            "name": "CPL 7d vs CPL 28d",
            "amount": "1.5×",
            "tone": "amber"
          }
        ]
      },
      {
        "type": "scoreCard",
        "title": "Tasa de cierre en cohortes maduras",
        "items": [
          {
            "label": "≥30% · sistema de v…",
            "v": 0.32
          },
          {
            "label": "<20% · califican pe…",
            "v": 0.18
          },
          {
            "label": "Mínimo 3 cohortes l…",
            "v": 0.6
          }
        ]
      },
      {
        "type": "signalFlow",
        "title": "El asesino silencioso de tu cuenta",
        "nodes": [
          {
            "label": "Ads Manager",
            "sub": "campañas 'ACTIVE'",
            "tone": "green"
          },
          {
            "label": "account_status",
            "sub": "live · disable_reas…",
            "tone": "amber"
          },
          {
            "label": "Alerta roja",
            "sub": "entrega frenada",
            "tone": "red"
          }
        ],
        "badges": [
          "1 GET liviano",
          "WhatsApp en 1h"
        ]
      },
      {
        "type": "emailSequence",
        "title": "El mismo semáforo, en tu WhatsApp",
        "steps": [
          {
            "day": "Diario ~7…",
            "subject": "Digest matutino"
          },
          {
            "day": "Horario",
            "subject": "Solo si hay algo urgente"
          },
          {
            "day": "Lunes",
            "subject": "Reporte semanal"
          }
        ]
      },
      {
        "type": "kanban",
        "cols": [
          {
            "label": "Abierto",
            "cards": 2,
            "tone": "red"
          },
          {
            "label": "Persiste",
            "cards": 1,
            "tone": "amber"
          },
          {
            "label": "Cerrado (inicio→fin)",
            "cards": 5,
            "tone": "green"
          }
        ]
      }
    ]
  },
  "experimentos": {
    "hero": {
      "type": "stamp",
      "title": "Hipótesis → veredicto",
      "result": "validated",
      "before": "Si filtro más el…",
      "after": "cp_form: $14 → $9 en…"
    },
    "groups": [
      {
        "type": "makoAnswer",
        "q": "Si filtro más el formulario, baja el…",
        "a": "Métrica: cp_form · dirección: bajar · ven…",
        "detail": "MaKo (Claude, effort:high) elige del catálogo de 18 métricas ancladas al funnel y explica el racional. No crea nada hasta que confirmás título, cambio a medir, ventana y objetivo en el modal."
      },
      {
        "type": "statTiles",
        "title": "cp_form · día 3 de 14 · medido en vivo, cero cache",
        "tiles": [
          {
            "label": "Baseline (3 días pr…",
            "value": "$14.2",
            "tone": "blue"
          },
          {
            "label": "Actual",
            "value": "$11.8",
            "tone": "green"
          },
          {
            "label": "Delta",
            "value": "-17%",
            "tone": "green"
          }
        ]
      },
      {
        "type": "semaphore",
        "lit": "green",
        "verdict": "Validada: el cp_form bajó de $14 a $9. Juicio sobre e…"
      },
      {
        "type": "chatThread",
        "title": "MaKo en cualquier tab del panel",
        "msgs": [
          {
            "from": "out",
            "text": "¿Conviene filtrar más el formulario?"
          },
          {
            "from": "in",
            "text": "Ya lo probaste: filtrar bajó tu cp_form de…"
          },
          {
            "from": "out",
            "text": "¿Y subir el precio del VSL?"
          },
          {
            "from": "in",
            "text": "Eso todavía no lo probaste. No lo afirmo: t…"
          }
        ]
      },
      {
        "type": "signalFlow",
        "title": "La Retro dispara el ciclo, aislado por workspace",
        "nodes": [
          {
            "label": "Retro",
            "sub": "hallazgo",
            "tone": "violet"
          },
          {
            "label": "Experimento",
            "sub": "auto-creado",
            "tone": "blue"
          },
          {
            "label": "1-3 tareas",
            "sub": "to-do linkeadas",
            "tone": "green"
          }
        ],
        "badges": [
          "propuesto",
          "activo",
          "cerrado",
          "descartado"
        ]
      }
    ]
  },
  "prioridades": {
    "hero": {
      "type": "pyramid",
      "title": "Tu plan, ordenado por criterio",
      "tiers": [
        {
          "label": "Alta — hacé esto hoy",
          "tone": "red"
        },
        {
          "label": "Media — después",
          "tone": "amber"
        },
        {
          "label": "Baja / A futuro",
          "tone": "green"
        }
      ]
    },
    "groups": [
      {
        "type": "scoreCard",
        "title": "Score = impacto ÷ esfuerzo",
        "items": [
          {
            "label": "Cerrar 3 R2 pendien…",
            "v": 0.94
          },
          {
            "label": "Subir la oferta al…",
            "v": 0.71
          },
          {
            "label": "Pulir la animación…",
            "v": 0.18
          }
        ]
      },
      {
        "type": "makoAnswer",
        "q": "'Rediseñar el logo me parece importan…",
        "a": "Rechaza",
        "detail": "Eso suena a que te encariñaste con la tarea. Sin números que muevan plata, no sube: la carga de la prueba es tuya."
      },
      {
        "type": "barChart",
        "title": "Pirámide sana, curvada por banda",
        "bars": [
          {
            "label": "Alta ~15%",
            "v": 0.15,
            "tone": "red"
          },
          {
            "label": "Media ~25%",
            "v": 0.25,
            "tone": "amber"
          },
          {
            "label": "Baja ~30%",
            "v": 0.3,
            "tone": "blue"
          },
          {
            "label": "A futuro ~30%",
            "v": 0.3,
            "tone": "violet"
          }
        ]
      },
      {
        "type": "diffCard",
        "rows": [
          {
            "field": "Candidata de Fath…",
            "before": "Duplica la tarjeta",
            "after": "Enriquece la que ya e…"
          },
          {
            "field": "Tarjeta 'Llamar a…",
            "before": "Llamar a Ana",
            "after": "Llamar a Ana + mandar…"
          },
          {
            "field": "Borrar 'lo hago d…",
            "before": "Elimina para siem…",
            "after": "Conserva y baja prior…"
          }
        ]
      },
      {
        "type": "chatThread",
        "title": "Nudge en background, sin quemar tokens",
        "msgs": [
          {
            "from": "out",
            "text": "Tenés 'Grabar nuevo VSL' con score 62 y sin…",
            "voice": true
          },
          {
            "from": "in",
            "text": "Uf, no, ahora que lo veo… mejor después"
          },
          {
            "from": "out",
            "text": "Urgente no es lo mismo que importante. Si d…",
            "voice": true
          }
        ]
      }
    ]
  },
  "retro": {
    "hero": {
      "type": "thesisCard",
      "tabs": [
        "Adquisición",
        "Nutrición",
        "Conversión",
        "Creativos",
        "Revenue",
        "Experiment…"
      ],
      "thesis": "El frente compra barato pero el embudo pierde…",
      "leak": "$18k"
    },
    "groups": [
      {
        "type": "signalFlow",
        "title": "El cruce que ninguna tab revela sola",
        "nodes": [
          {
            "label": "Diagnóstico por área",
            "sub": "6 áreas en paralelo…",
            "tone": "blue"
          },
          {
            "label": "Ronda de cruces",
            "sub": "entre áreas · effor…",
            "tone": "violet"
          },
          {
            "label": "Insight cruzado",
            "sub": "nutridos cierran 2.…",
            "tone": "green"
          }
        ],
        "badges": [
          "8 fases de pipel…",
          "~9 llamadas a Op…"
        ]
      },
      {
        "type": "statTiles",
        "title": "La fuga en plata, no en porcentajes",
        "tiles": [
          {
            "label": "Te fugás por período",
            "value": "~$18k",
            "tone": "red"
          }
        ],
        "rows": [
          {
            "name": "Adquisición",
            "amount": "sano",
            "tone": "green"
          },
          {
            "name": "Nutrición",
            "amount": "alerta",
            "tone": "amber"
          },
          {
            "name": "Conversión",
            "amount": "sangra",
            "tone": "red"
          },
          {
            "name": "VSL sin trackear",
            "amount": "sin dato",
            "tone": "blue"
          }
        ]
      },
      {
        "type": "stamp",
        "title": "Tu lectura entra como hipótesis, no como verdad",
        "result": "refuted",
        "before": "Tu lectura: 'el p…",
        "after": "Dato duro: la fuga se…"
      },
      {
        "type": "pyramid",
        "title": "Aceptar arranca a medir — y el Perro Guardián prior…",
        "tiers": [
          {
            "label": "Alta ~15%",
            "tone": "red"
          },
          {
            "label": "Media",
            "tone": "amber"
          },
          {
            "label": "Baja",
            "tone": "green"
          }
        ]
      },
      {
        "type": "barChart",
        "title": "Aceptar no es hacer: la próxima Retro lee el estado…",
        "bars": [
          {
            "label": "Hecha",
            "v": 0.4,
            "tone": "green"
          },
          {
            "label": "Empezada",
            "v": 0.25,
            "tone": "amber"
          },
          {
            "label": "Aceptada y sin tocar",
            "v": 0.2,
            "tone": "red"
          },
          {
            "label": "Se perdió",
            "v": 0.15,
            "tone": "red"
          }
        ]
      }
    ]
  },
  "fase-norte": {
    "hero": {
      "type": "phaseLadder",
      "title": "En qué fase estás de verdad",
      "phases": [
        "F0 Visibilidad",
        "F1 Conversión",
        "F2 Sistemas",
        "F3 Delegación",
        "F4 Foco"
      ],
      "current": 1
    },
    "groups": [
      {
        "type": "funnel",
        "title": "5 fases, un cuello cada una",
        "stages": [
          {
            "label": "F0 Visibilidad",
            "w": 1,
            "trg": "auto"
          },
          {
            "label": "F1 Conversión",
            "w": 0.78,
            "trg": "auto"
          },
          {
            "label": "F2 Sistemas",
            "w": 0.56,
            "trg": "auto"
          },
          {
            "label": "F3 Delegación",
            "w": 0.4,
            "trg": "auto"
          },
          {
            "label": "F4 Foco",
            "w": 0.27,
            "trg": "auto"
          }
        ]
      },
      {
        "type": "barChart",
        "title": "[0,1,1,2,2,2] → te deja en Fase 1, no Fase 2",
        "bars": [
          {
            "label": "F0",
            "v": 0.33,
            "tone": "blue"
          },
          {
            "label": "F1",
            "v": 0.66,
            "tone": "green"
          },
          {
            "label": "F2",
            "v": 1,
            "tone": "amber"
          }
        ]
      },
      {
        "type": "makoAnswer",
        "q": "¿Subo el presupuesto de pauta?",
        "a": "No todavía — estás en Fase 1 (Conversión)",
        "detail": "Tu R1 aún no muestra parejo. Subir la pauta antes de convertir es tirar plata a un embudo pinchado: MaKo prioriza según tu etapa real, no de manual."
      },
      {
        "type": "scoreCard",
        "title": "6 preguntas, 6 dimensiones → tu fase",
        "items": [
          {
            "label": "Ingresos",
            "v": 0
          },
          {
            "label": "Leads/mes",
            "v": 0.25
          },
          {
            "label": "Funnel",
            "v": 0.25
          },
          {
            "label": "Ventas",
            "v": 0.5
          },
          {
            "label": "Cuello",
            "v": 0.5
          },
          {
            "label": "Equipo",
            "v": 0.5
          }
        ]
      }
    ]
  },
  "whatsapp": {
    "hero": {
      "type": "chatThread",
      "title": "MaKo te sugiere en vivo qué responder",
      "msgs": [
        {
          "from": "in",
          "text": "La verdad lo pensé y no sé si es para mí ah…"
        },
        {
          "from": "out",
          "text": "Te entiendo. ¿Qué te frena más hoy: el tiem…"
        },
        {
          "from": "in",
          "text": "Más que nada si voy a tener tiempo de aplic…"
        },
        {
          "from": "out",
          "text": "Nota de voz (38s): «Justo por eso el sistem…",
          "voice": true
        }
      ]
    },
    "groups": [
      {
        "type": "waInbox",
        "rows": [
          {
            "name": "Laura Méndez",
            "stage": "R2",
            "win": 3
          },
          {
            "name": "Diego Torres",
            "stage": "por-cobrar",
            "win": 19
          },
          {
            "name": "Sofía Ruiz",
            "stage": "no-show",
            "win": 1
          },
          {
            "name": "Andrés Gil",
            "stage": "cliente",
            "win": 22
          }
        ]
      },
      {
        "type": "gauge",
        "value": 0.03,
        "big": "0:47",
        "label": "Ventana de 24h · qu…",
        "tone": "red"
      },
      {
        "type": "makoAnswer",
        "q": "¿Qué le escribo a este lead que no re…",
        "a": "Reactivación por curiosidad — como planti…",
        "detail": "Etapa detectada: no-show R1. Ángulo: curiosidad + prueba social, tono cálido. Incluye guion de nota de voz de 40s. Metodología Levanta Muertos."
      },
      {
        "type": "semaphore",
        "lit": "amber",
        "verdict": "Riesgo MEDIO: la variable {{1}} no es nombrada — Meta…"
      },
      {
        "type": "kanban",
        "cols": [
          {
            "label": "Borrador (setter ma…",
            "cards": 7,
            "tone": "amber"
          },
          {
            "label": "Reclamado (CLAIM at…",
            "cards": 2,
            "tone": "blue"
          },
          {
            "label": "Enviado por Evoluti…",
            "cards": 14,
            "tone": "green"
          }
        ]
      }
    ]
  },
  "email": {
    "hero": {
      "type": "emailSequence",
      "title": "Secuencias que se disparan solas por estado del lead",
      "steps": [
        {
          "day": "Al instan…",
          "subject": "Vio el VSL sin agendar"
        },
        {
          "day": "No Show R1",
          "subject": "No se presentó a la reunión"
        },
        {
          "day": "Post pago",
          "subject": "Confirmó sin pagar"
        },
        {
          "day": "+2 días",
          "subject": "Reactivación de frío"
        }
      ]
    },
    "groups": [
      {
        "type": "funnel",
        "title": "14 triggers del funnel disparan la secuencia",
        "stages": [
          {
            "label": "Vio el VSL sin agen…",
            "w": 1,
            "trg": "auto"
          },
          {
            "label": "No agendaron",
            "w": 0.68,
            "trg": "auto"
          },
          {
            "label": "Confirmó sin pagar",
            "w": 0.44,
            "trg": "auto"
          },
          {
            "label": "No Show R1/R2",
            "w": 0.28,
            "trg": "auto"
          },
          {
            "label": "Ganados",
            "w": 0.14,
            "trg": "mako"
          }
        ]
      },
      {
        "type": "makoAnswer",
        "q": "Escribime el email para el que confir…",
        "a": "Asunto + preheader + cuerpo, en la voz de…",
        "detail": "Asunto de ~6 palabras · 2 a 5 párrafos · un solo CTA con tu Calendly adentro · reporta tokens y costo"
      },
      {
        "type": "docExtract",
        "fields": [
          {
            "k": "De:",
            "v": "ventas@tudominio.com"
          },
          {
            "k": "DKIM",
            "v": "resend._domainkey → TXT"
          },
          {
            "k": "SPF",
            "v": "v=spf1 include:resend"
          },
          {
            "k": "Estado del dominio",
            "v": "verified (en vivo)"
          }
        ]
      },
      {
        "type": "statTiles",
        "title": "Entregabilidad y respeto por la bandeja",
        "tiles": [
          {
            "label": "Guard anti-spam",
            "value": "20h",
            "tone": "green"
          },
          {
            "label": "Envío en chunks",
            "value": "100",
            "tone": "blue"
          },
          {
            "label": "Tope por broadcast",
            "value": "2000",
            "tone": "amber"
          }
        ]
      }
    ]
  },
  "conocimiento": {
    "hero": {
      "type": "ragIndex",
      "title": "Tu curso → transcribe → embeddings"
    },
    "groups": [
      {
        "type": "signalFlow",
        "title": "Tres formas de cargar el método",
        "nodes": [
          {
            "label": "Texto / Video / Aud…",
            "sub": "pegás o subís hasta…",
            "tone": "blue"
          },
          {
            "label": "Whisper-1 transcribe",
            "sub": "revisás y editás an…",
            "tone": "amber"
          },
          {
            "label": "Indexado",
            "sub": "badge de estado en…",
            "tone": "green"
          }
        ],
        "badges": [
          "indexado",
          "pendiente",
          "error"
        ]
      },
      {
        "type": "roleMatrix",
        "roles": [
          "WhatsApp",
          "Campañas Me…",
          "Chat MaKo",
          "Swipe copy"
        ],
        "tools": [
          {
            "tool": "mensajes",
            "on": [
              true,
              false,
              false,
              false
            ]
          },
          {
            "tool": "ads",
            "on": [
              false,
              true,
              false,
              false
            ]
          },
          {
            "tool": "general",
            "on": [
              false,
              false,
              true,
              false
            ]
          },
          {
            "tool": "ejemplos",
            "on": [
              false,
              false,
              false,
              true
            ]
          }
        ]
      },
      {
        "type": "scoreCard",
        "title": "Búsqueda semántica top-k por coseno",
        "items": [
          {
            "label": "Objeción de precio",
            "v": 0.82
          },
          {
            "label": "Reactivar lead muer…",
            "v": 0.71
          },
          {
            "label": "Secuencia 7/14/21 d…",
            "v": 0.44
          },
          {
            "label": "Corte de relevancia…",
            "v": 0.15
          }
        ]
      },
      {
        "type": "makoAnswer",
        "q": "¿Qué es Artemisa?",
        "a": "El Fathom de Mauricio.",
        "detail": "El glosario del negocio va montado sobre la misma tabla: MaKo entiende tu jerga y corrige transcripciones sin volver a preguntar. La base de la agencia viaja read-only a todos los clientes; cada uno suma lo suyo, aislado por workspace."
      }
    ]
  },
  "mako": {
    "hero": {
      "type": "makoAnswer",
      "q": "MaKo, ¿qué muevo esta semana?",
      "a": "Frená la campaña de arriba: trae leads pe…",
      "detail": "Cruzó tu funnel real, las respuestas de R1 y el estado de Experimentos, con el criterio de Martín Koncke. Es una hipótesis, no una verdad: validala antes de escalar."
    },
    "groups": [
      {
        "type": "funnel",
        "title": "Tu funnel real, no un embudo genérico",
        "stages": [
          {
            "label": "Leads",
            "w": 1,
            "trg": "auto"
          },
          {
            "label": "R1 agendada",
            "w": 0.55,
            "trg": "mako"
          },
          {
            "label": "R2",
            "w": 0.3,
            "trg": "mako"
          },
          {
            "label": "Venta",
            "w": 0.14,
            "trg": "manual"
          }
        ]
      },
      {
        "type": "statTiles",
        "title": "El Doer consulta los hechos antes de opinar",
        "tiles": [
          {
            "label": "Herramientas de lec…",
            "value": "9",
            "tone": "blue"
          },
          {
            "label": "Pasos de tool-use p…",
            "value": "8",
            "tone": "violet"
          },
          {
            "label": "Solo lectura, tu wo…",
            "value": "0 invent…",
            "tone": "green"
          }
        ]
      },
      {
        "type": "chatThread",
        "title": "Hola MaKo, desde tu propio grupo",
        "msgs": [
          {
            "from": "out",
            "text": "MaKo, te mando un audio",
            "voice": true
          },
          {
            "from": "in",
            "text": "Escuchando… transcribí tu nota: querés subi…"
          },
          {
            "from": "out",
            "text": "(captura del dashboard)"
          },
          {
            "from": "in",
            "text": "Leí la imagen: el ROAS cayó a 2.1x, no lo s…"
          }
        ]
      },
      {
        "type": "diffCard",
        "rows": [
          {
            "field": "Etapa del lead",
            "before": "R1 agendada",
            "after": "R2 agendada"
          },
          {
            "field": "Nutrición",
            "before": "Pausada",
            "after": "Activa"
          },
          {
            "field": "Campaña Meta",
            "before": "$50/día",
            "after": "$80/día"
          }
        ]
      },
      {
        "type": "kanban",
        "cols": [
          {
            "label": "Adquisición",
            "cards": 3,
            "tone": "blue"
          },
          {
            "label": "Nutrición",
            "cards": 2,
            "tone": "amber"
          },
          {
            "label": "Cierre",
            "cards": 1,
            "tone": "green"
          }
        ]
      },
      {
        "type": "pyramid",
        "title": "Perro guardián: prioridad sin empates",
        "tiers": [
          {
            "label": "Alta: arreglar el s…",
            "tone": "red"
          },
          {
            "label": "Media: reescribir e…",
            "tone": "amber"
          },
          {
            "label": "Baja: renombrar cam…",
            "tone": "green"
          }
        ]
      },
      {
        "type": "ragIndex",
        "title": "Método curado + tu conocimiento, embebido"
      }
    ]
  },
  "integraciones": {
    "hero": {
      "type": "byokKey",
      "account": "Meta Ads · Elevate MX"
    },
    "groups": [
      {
        "type": "signalFlow",
        "title": "Pegás, probás, reconocés que es LA tuya",
        "nodes": [
          {
            "label": "Pegás credencial",
            "sub": "token + ad account",
            "tone": "blue"
          },
          {
            "label": "Probás conexión",
            "sub": "request real · time…",
            "tone": "amber"
          },
          {
            "label": "Cuenta reconocida",
            "sub": "nombre + última lla…",
            "tone": "green"
          }
        ],
        "badges": [
          "Meta Ads",
          "WhatsApp",
          "Resend",
          "Fathom",
          "Calendly",
          "Panda Video",
          "YouTube",
          "Google Calendar",
          "Landing/VSL"
        ]
      },
      {
        "type": "alertCard",
        "text": "Otro workspace intentó reclamar tu identificador de webhook. MaKo lo frenó (409) y lo auditó como intento de secuestro. Sin esto, te robaba los webhooks entrantes."
      },
      {
        "type": "statTiles",
        "title": "Saldo de IA — al centavo",
        "tiles": [
          {
            "label": "Gasto del mes",
            "value": "$312",
            "tone": "amber"
          },
          {
            "label": "Tokens hoy",
            "value": "1.2M",
            "tone": "blue"
          },
          {
            "label": "Saldo restante",
            "value": "$188",
            "tone": "green"
          }
        ],
        "rows": [
          {
            "name": "Opus · análisis fino",
            "amount": "$142",
            "tone": "violet"
          },
          {
            "name": "Sonnet · voz de marca",
            "amount": "$88",
            "tone": "blue"
          },
          {
            "name": "Groq OSS · tareas simpl…",
            "amount": "$0",
            "tone": "green"
          },
          {
            "name": "STT · por segundos de a…",
            "amount": "$34",
            "tone": "amber"
          }
        ]
      },
      {
        "type": "semaphore",
        "lit": "green",
        "verdict": "Landing/VSL se marca conectada solo cuando el pixel Y…"
      }
    ]
  },
  "equipo": {
    "hero": {
      "type": "roleMatrix",
      "roles": [
        "Setter",
        "Closer",
        "Admin"
      ],
      "tools": [
        {
          "tool": "CRM",
          "on": [
            true,
            true,
            true
          ]
        },
        {
          "tool": "WhatsApp",
          "on": [
            true,
            true,
            true
          ]
        },
        {
          "tool": "Email",
          "on": [
            true,
            false,
            true
          ]
        },
        {
          "tool": "Closing Analyst",
          "on": [
            false,
            true,
            true
          ]
        },
        {
          "tool": "Integraciones",
          "on": [
            false,
            false,
            true
          ]
        },
        {
          "tool": "Equipo",
          "on": [
            false,
            false,
            true
          ]
        }
      ]
    },
    "groups": [
      {
        "type": "roleMatrix",
        "roles": [
          "Setter",
          "Closer",
          "Admin"
        ],
        "tools": [
          {
            "tool": "CRM",
            "on": [
              true,
              true,
              true
            ]
          },
          {
            "tool": "WhatsApp",
            "on": [
              true,
              true,
              true
            ]
          },
          {
            "tool": "Email",
            "on": [
              true,
              false,
              true
            ]
          },
          {
            "tool": "Closing Analyst",
            "on": [
              false,
              true,
              true
            ]
          },
          {
            "tool": "Analytics + Ads",
            "on": [
              false,
              false,
              true
            ]
          },
          {
            "tool": "Integraciones",
            "on": [
              false,
              false,
              true
            ]
          },
          {
            "tool": "Equipo",
            "on": [
              false,
              false,
              true
            ]
          }
        ]
      },
      {
        "type": "semaphore",
        "lit": "red",
        "verdict": "403: tecleás la URL a mano y tampoco entrás. requireR…"
      },
      {
        "type": "diffCard",
        "rows": [
          {
            "field": "Rol",
            "before": "Closer",
            "after": "— sin acceso"
          },
          {
            "field": "Aplica",
            "after": "al instante",
            "before": "al vencer la sesi…"
          },
          {
            "field": "Rol en la cookie",
            "before": "pegado",
            "after": "se resuelve fresco"
          }
        ]
      },
      {
        "type": "phaseLadder",
        "title": "De invitado a activo, sin crear contraseña",
        "phases": [
          "Invitás por em…",
          "Invitado",
          "Entra con Goog…",
          "Se activa sola",
          "Activo"
        ],
        "current": 3
      },
      {
        "type": "makoAnswer",
        "q": "Acción sobre alguien de otro workspace",
        "a": "404",
        "detail": "Ese miembro no pertenece a tu equipo. El ROL decide qué ve la persona; la CAPA decide qué compró el cliente."
      }
    ]
  },
  "perfil-reportes": {
    "hero": {
      "type": "alertCard",
      "text": "Meta te frenó la entrega hace 40 min. Adset 'Retargeting VSL' fatigado quemando $1.2k/día. Resolvé ahora."
    },
    "groups": [
      {
        "type": "semaphore",
        "lit": "red",
        "verdict": "Entrega frenada en Meta. Te interrumpo solo cuando cu…"
      },
      {
        "type": "statTiles",
        "title": "Digest diario · 8:00 Tijuana",
        "tiles": [
          {
            "label": "Gastado ayer (MXN)",
            "value": "$14.2k",
            "tone": "blue"
          },
          {
            "label": "Leads · CPL",
            "value": "23 · $618",
            "tone": "green"
          },
          {
            "label": "Cash del mes",
            "value": "$48k",
            "tone": "violet"
          }
        ],
        "rows": [
          {
            "name": "Cuota vencida · Acme",
            "amount": "$2.5k",
            "tone": "red"
          },
          {
            "name": "Cuota vencida · Nova",
            "amount": "$1.8k",
            "tone": "amber"
          }
        ]
      },
      {
        "type": "chatThread",
        "title": "Ventana de servicio 24h",
        "msgs": [
          {
            "from": "out",
            "text": "reporte_mako · [ Recibir reporte ]"
          },
          {
            "from": "in",
            "text": "Recibir reporte"
          },
          {
            "from": "out",
            "text": "Diario · Meta 🟢 saldo $320 USD · ayer $14.…"
          }
        ]
      },
      {
        "type": "roleMatrix",
        "roles": [
          "Horario",
          "Diario",
          "Semanal"
        ],
        "tools": [
          {
            "tool": "WhatsApp",
            "on": [
              true,
              false,
              true
            ]
          },
          {
            "tool": "Email",
            "on": [
              false,
              true,
              true
            ]
          }
        ]
      },
      {
        "type": "docExtract",
        "fields": [
          {
            "k": "Perfil (por-usuario)",
            "v": "Nombre · Cargo · Empresa · Bio"
          },
          {
            "k": "Zona horaria",
            "v": "Tijuana (GMT-7)"
          },
          {
            "k": "Email de login",
            "v": "solo-lectura"
          },
          {
            "k": "Contacto de reportes",
            "v": "nivel workspace · +52 664 000 0000"
          }
        ]
      }
    ]
  }
};
