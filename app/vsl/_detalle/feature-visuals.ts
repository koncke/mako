// =============================================================================
// Specs de graficos por feature (hero + uno por capacidad) para /vsl/<slug>.
// =============================================================================
// rc* = charts reales (Recharts, VisualCharts.tsx); cx* = canvas (VisualCanvas.tsx);
// el resto = mockups SVG (Visual.tsx). Generado del contenido real.

import type { VisualSpec } from './Visual';

export type FeatureVisuals = { hero: VisualSpec; groups: VisualSpec[] };

export const FEATURE_VISUALS: Record<string, FeatureVisuals> = {
  "funnel": {
    "hero": {
      "type": "cxConnect"
    },
    "groups": [
      {
        "type": "phaseLadder",
        "title": "Fila Activo",
        "phases": [
          "Entrada",
          "Reunión",
          "Grupo",
          "Pago",
          "Cierre"
        ],
        "current": 2
      },
      {
        "type": "signalFlow",
        "title": "Disparador por paso",
        "nodes": [
          {
            "label": "Formulario",
            "sub": "Meta",
            "tone": "green"
          },
          {
            "label": "Agenda",
            "sub": "Calendly",
            "tone": "blue"
          },
          {
            "label": "Pago",
            "sub": "por marcar",
            "tone": "amber"
          }
        ]
      },
      {
        "type": "kanban",
        "cols": [
          {
            "label": "R1 agendada",
            "cards": 6,
            "tone": "amber"
          },
          {
            "label": "Grupo WA",
            "cards": 4,
            "tone": "green"
          },
          {
            "label": "Cierre",
            "cards": 2,
            "tone": "green"
          }
        ]
      },
      {
        "type": "diffCard",
        "title": "Movés una etapa",
        "rows": [
          {
            "field": "Etapa",
            "before": "Agendó",
            "after": "Grupo WA"
          },
          {
            "field": "Tablero CRM",
            "before": "Sin mover",
            "after": "Actualizado"
          }
        ]
      }
    ]
  },
  "onboarding": {
    "hero": {
      "type": "rcArea",
      "title": "Histórico · 365 días",
      "tone": "blue",
      "data": [
        {
          "label": "d0",
          "v": 4
        },
        {
          "label": "d90",
          "v": 28
        },
        {
          "label": "d180",
          "v": 55
        },
        {
          "label": "d270",
          "v": 81
        },
        {
          "label": "d365",
          "v": 100
        }
      ]
    },
    "groups": [
      {
        "type": "splitLoad",
        "left": "Meta",
        "right": "MaKo",
        "loading": [
          "Métricas 365d",
          "Leads",
          "Transcripts",
          "Guiones",
          "Llamadas",
          "VSL"
        ]
      },
      {
        "type": "roleMatrix",
        "roles": [
          "PM",
          "Completo"
        ],
        "tools": [
          {
            "tool": "Brief",
            "on": [
              true,
              true
            ]
          },
          {
            "tool": "Meta",
            "on": [
              false,
              true
            ]
          },
          {
            "tool": "WhatsApp",
            "on": [
              false,
              true
            ]
          },
          {
            "tool": "Norte",
            "on": [
              true,
              true
            ]
          }
        ]
      },
      {
        "type": "phaseLadder",
        "title": "Tu Norte",
        "phases": [
          "Validar",
          "Tracción",
          "Escala",
          "Optimizar",
          "Sistema"
        ],
        "current": 1
      },
      {
        "type": "chatThread",
        "title": "MaKo <> tu marca",
        "msgs": [
          {
            "from": "in",
            "text": "Bienvenido, ya leí tu histórico"
          },
          {
            "from": "out",
            "text": "Dale, arranquemos"
          },
          {
            "from": "in",
            "text": "Idea creada en tu plan"
          }
        ]
      },
      {
        "type": "semaphore",
        "lit": "red",
        "verdict": "Corta, no usa agencia"
      }
    ]
  },
  "graphics": {
    "hero": {
      "type": "rcRetention",
      "title": "Retención del VSL",
      "dropLabel": "2min",
      "data": [
        {
          "label": "0s",
          "v": 100
        },
        {
          "label": "30s",
          "v": 72
        },
        {
          "label": "1min",
          "v": 54
        },
        {
          "label": "2min",
          "v": 38
        },
        {
          "label": "4min",
          "v": 26
        },
        {
          "label": "Oferta",
          "v": 18
        }
      ]
    },
    "groups": [
      {
        "type": "makoAnswer",
        "q": "¿Apago este anuncio o lo escalo?",
        "a": "Escalá, aguanta ROAS",
        "detail": "CPA por debajo del target y VSL reteniendo. Subí 20% el presupuesto y mirá 48h."
      },
      {
        "type": "funnel",
        "title": "Salud del funnel",
        "stages": [
          {
            "label": "Impresiones",
            "w": 1
          },
          {
            "label": "Click",
            "w": 0.42
          },
          {
            "label": "Landing",
            "w": 0.31
          },
          {
            "label": "VSL",
            "w": 0.19
          },
          {
            "label": "Cierre",
            "w": 0.1
          }
        ]
      },
      {
        "type": "rcRevenue"
      },
      {
        "type": "alertCard",
        "text": "Hay gasto pero la cohorte no cerró: ROAS dice 'aún sin datos', no 0.00x."
      },
      {
        "type": "rcBar",
        "title": "Audiencia por edad",
        "bars": [
          {
            "label": "18-24",
            "v": 22
          },
          {
            "label": "25-34",
            "v": 90,
            "tone": "green"
          },
          {
            "label": "35-44",
            "v": 64
          },
          {
            "label": "45-54",
            "v": 31
          },
          {
            "label": "55+",
            "v": 14
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
          "label": "No Show",
          "cards": 3,
          "tone": "red"
        },
        {
          "label": "Nutrición",
          "cards": 5,
          "tone": "amber"
        },
        {
          "label": "Ganado",
          "cards": 2,
          "tone": "green"
        }
      ]
    },
    "groups": [
      {
        "type": "emailSequence",
        "title": "Reactivación por umbral",
        "steps": [
          {
            "day": "Día 2",
            "subject": "→ Nutrición No Agenda"
          },
          {
            "day": "Día 7",
            "subject": "→ Reactivación"
          },
          {
            "day": "Día 30",
            "subject": "→ Reactivación fríos"
          }
        ]
      },
      {
        "type": "diffCard",
        "title": "MaKo movió un lead",
        "rows": [
          {
            "field": "Estado",
            "before": "Agendó",
            "after": "No Show"
          },
          {
            "field": "Etapa",
            "before": "R1",
            "after": "No Show R1"
          },
          {
            "field": "Fathom",
            "before": "—",
            "after": "Link"
          }
        ]
      },
      {
        "type": "statTiles",
        "title": "Por corrida",
        "tiles": [
          {
            "label": "Tope llamadas",
            "value": "25",
            "tone": "blue"
          },
          {
            "label": "Duplicados",
            "value": "0",
            "tone": "green"
          },
          {
            "label": "Reintentos",
            "value": "Auto",
            "tone": "amber"
          }
        ]
      },
      {
        "type": "makoAnswer",
        "q": "¿Próxima acción?",
        "a": "Reforzá el precio",
        "detail": "Miró 80% del VSL, objeción de precio sin resolver en R1. Mandale el caso de ROI antes de R2."
      },
      {
        "type": "funnel",
        "title": "Requisitos por etapa",
        "stages": [
          {
            "label": "Nuevo",
            "w": 1
          },
          {
            "label": "R1",
            "w": 0.48
          },
          {
            "label": "R2",
            "w": 0.22
          },
          {
            "label": "Ganado",
            "w": 0.11
          }
        ]
      }
    ]
  },
  "api": {
    "hero": {
      "type": "funnel",
      "title": "Señal real a Meta",
      "stages": [
        {
          "label": "Impresiones",
          "w": 1
        },
        {
          "label": "Clics",
          "w": 0.42
        },
        {
          "label": "Leads",
          "w": 0.18
        },
        {
          "label": "Calificados",
          "w": 0.1
        },
        {
          "label": "Agenda",
          "w": 0.1
        },
        {
          "label": "Cierre",
          "w": 0.1
        }
      ]
    },
    "groups": [
      {
        "type": "signalFlow",
        "title": "CRM → Meta",
        "nodes": [
          {
            "label": "CRM",
            "sub": "calificado=true",
            "tone": "blue"
          },
          {
            "label": "CAPI",
            "sub": "server-side",
            "tone": "amber"
          },
          {
            "label": "Meta",
            "sub": "optimiza agenda",
            "tone": "green"
          }
        ]
      },
      {
        "type": "diffCard",
        "title": "Identidad hasheada",
        "rows": [
          {
            "field": "Email",
            "before": "ana@mail.com",
            "after": "a1b2c3…"
          },
          {
            "field": "Teléfono",
            "before": "5544332211",
            "after": "9f8e7d…"
          }
        ]
      },
      {
        "type": "semaphore",
        "lit": "green",
        "verdict": "Venta sigue en pie"
      },
      {
        "type": "rcRetention",
        "title": "Retención VSL",
        "dropLabel": "p50",
        "data": [
          {
            "label": "0s",
            "v": 100
          },
          {
            "label": "3s",
            "v": 88
          },
          {
            "label": "p25",
            "v": 64
          },
          {
            "label": "p50",
            "v": 41
          },
          {
            "label": "p75",
            "v": 27
          },
          {
            "label": "p100",
            "v": 19
          }
        ]
      },
      {
        "type": "waInbox",
        "rows": [
          {
            "name": "Ana",
            "stage": "R1",
            "win": 22
          },
          {
            "name": "Bruno",
            "stage": "Agendó",
            "win": 15
          },
          {
            "name": "Caro",
            "stage": "Nuevo",
            "win": 8
          }
        ]
      },
      {
        "type": "byokKey",
        "account": "Ads · Elevate MX"
      }
    ]
  },
  "ads": {
    "hero": {
      "type": "rcRevenue"
    },
    "groups": [
      {
        "type": "adRow",
        "rows": [
          {
            "name": "VSL Dolor",
            "cash": "$18k",
            "roas": "4.2x",
            "tone": "green"
          },
          {
            "name": "Testimonio",
            "cash": "$9k",
            "roas": "2.4x",
            "tone": "amber"
          },
          {
            "name": "Aspiracional",
            "cash": "$2k",
            "roas": "0.8x",
            "tone": "red"
          }
        ]
      },
      {
        "type": "diffCard",
        "title": "MaKo renombró en lote",
        "rows": [
          {
            "field": "Nombre",
            "before": "Ad final v2",
            "after": "003 · Dolor · Jul"
          },
          {
            "field": "Presupuesto",
            "before": "$500/día",
            "after": "$800/día"
          }
        ]
      },
      {
        "type": "signalFlow",
        "nodes": [
          {
            "label": "Creativo",
            "sub": "subís",
            "tone": "blue"
          },
          {
            "label": "MaKo",
            "sub": "arma árbol",
            "tone": "green"
          },
          {
            "label": "En pausa",
            "sub": "un clic",
            "tone": "amber"
          }
        ]
      },
      {
        "type": "chatThread",
        "title": "Ads Writer",
        "msgs": [
          {
            "from": "out",
            "text": "Gancho nuevo, ángulo dolor"
          },
          {
            "from": "in",
            "text": "4 variantes listas"
          },
          {
            "from": "out",
            "text": "Más corto y directo"
          },
          {
            "from": "in",
            "text": "Regenerado en tu voz"
          }
        ]
      },
      {
        "type": "kanban",
        "cols": [
          {
            "label": "Rechazado",
            "cards": 2,
            "tone": "red"
          },
          {
            "label": "En revisión",
            "cards": 1,
            "tone": "amber"
          },
          {
            "label": "Aprobado",
            "cards": 4,
            "tone": "green"
          }
        ]
      },
      {
        "type": "rcArea",
        "title": "Presupuesto diario",
        "tone": "green",
        "data": [
          {
            "label": "Lun",
            "v": 40
          },
          {
            "label": "Mar",
            "v": 45
          },
          {
            "label": "Mié",
            "v": 55
          },
          {
            "label": "Jue",
            "v": 50
          },
          {
            "label": "Vie",
            "v": 70
          },
          {
            "label": "Sáb",
            "v": 65
          },
          {
            "label": "Dom",
            "v": 82
          }
        ]
      }
    ]
  },
  "script": {
    "hero": {
      "type": "funnel",
      "title": "Del play al cierre",
      "stages": [
        {
          "label": "Impresiones",
          "w": 1
        },
        {
          "label": "Hook 3s",
          "w": 0.58
        },
        {
          "label": "Mitad VSL",
          "w": 0.31
        },
        {
          "label": "Agendas",
          "w": 0.11
        },
        {
          "label": "Cierre",
          "w": 0.1
        }
      ]
    },
    "groups": [
      {
        "type": "rcRetention",
        "title": "Retención del VSL por bloque",
        "dropLabel": "30s",
        "data": [
          {
            "label": "Gancho",
            "v": 100
          },
          {
            "label": "Contexto",
            "v": 71
          },
          {
            "label": "Problema",
            "v": 54
          },
          {
            "label": "Mecanismo",
            "v": 38
          },
          {
            "label": "Prueba",
            "v": 26
          },
          {
            "label": "CTA",
            "v": 14
          }
        ]
      },
      {
        "type": "adRow",
        "rows": [
          {
            "name": "VSL Dolor",
            "cash": "$22k",
            "roas": "4.6x",
            "tone": "green"
          },
          {
            "name": "Testimonio",
            "cash": "$9k",
            "roas": "2.1x",
            "tone": "amber"
          },
          {
            "name": "Mecanismo",
            "cash": "$3k",
            "roas": "0.8x",
            "tone": "red"
          }
        ]
      },
      {
        "type": "pyramid",
        "title": "Qué hacer con cada guion",
        "tiers": [
          {
            "label": "Plata quemada · pausá",
            "tone": "red"
          },
          {
            "label": "Gancho sin cuerpo",
            "tone": "amber"
          },
          {
            "label": "Escalá · 4 listos",
            "tone": "green"
          }
        ]
      },
      {
        "type": "makoAnswer",
        "q": "¿Produzco este guion?",
        "a": "Mejorá el gancho",
        "detail": "Se parece a tus ejemplares medios. Validá barato con $300, 8k impresiones y 3 días."
      },
      {
        "type": "diffCard",
        "title": "Corregiste el ángulo",
        "rows": [
          {
            "field": "Ángulo",
            "before": "Estatus",
            "after": "Miedo"
          },
          {
            "field": "Avatar",
            "before": "—",
            "after": "Dueño PyME"
          }
        ]
      }
    ]
  },
  "closing": {
    "hero": {
      "type": "rcGauge",
      "value": 28,
      "big": "28%",
      "label": "Cierre",
      "tone": "amber"
    },
    "groups": [
      {
        "type": "kanban",
        "cols": [
          {
            "label": "Venta",
            "cards": 14,
            "tone": "green"
          },
          {
            "label": "Servicio",
            "cards": 9,
            "tone": "amber"
          },
          {
            "label": "Descarte",
            "cards": 22,
            "tone": "red"
          }
        ]
      },
      {
        "type": "scoreCard",
        "chrome": "Closing",
        "items": [
          {
            "label": "Situación",
            "v": 0.9
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
            "v": 0.8
          },
          {
            "label": "Propuesta",
            "v": 0.6
          },
          {
            "label": "Objeciones",
            "v": 0.4
          },
          {
            "label": "CTA",
            "v": 0.7
          }
        ]
      },
      {
        "type": "funnel",
        "title": "Tu embudo",
        "stages": [
          {
            "label": "R1",
            "w": 1
          },
          {
            "label": "R2",
            "w": 0.52
          },
          {
            "label": "Ganada",
            "w": 0.23
          }
        ]
      },
      {
        "type": "diffCard",
        "title": "MaKo re-analizó",
        "rows": [
          {
            "field": "Score",
            "before": "6.2",
            "after": "7.8"
          },
          {
            "field": "Objeciones",
            "before": "No manejada",
            "after": "Manejada"
          },
          {
            "field": "Outcome",
            "before": "Perdida",
            "after": "Ganada"
          }
        ]
      },
      {
        "type": "splitLoad",
        "loading": [
          "Fathom 90d",
          "Leads",
          "Transcripts"
        ]
      }
    ]
  },
  "seguimiento": {
    "hero": {
      "type": "waInbox",
      "rows": [
        {
          "name": "Ana",
          "stage": "No Show R1",
          "win": 2
        },
        {
          "name": "Bruno",
          "stage": "VSL 50%",
          "win": 1
        },
        {
          "name": "Caro",
          "stage": "Sin confirmar",
          "win": 3
        },
        {
          "name": "Diego",
          "stage": "No paga",
          "win": 5
        },
        {
          "name": "Emi",
          "stage": "Frío 60d",
          "win": 7
        }
      ]
    },
    "groups": [
      {
        "type": "funnel",
        "title": "Dónde se traba",
        "stages": [
          {
            "label": "Dejó form",
            "w": 1
          },
          {
            "label": "Vio VSL",
            "w": 0.64
          },
          {
            "label": "Agendó",
            "w": 0.38
          },
          {
            "label": "Asistió R1",
            "w": 0.24
          },
          {
            "label": "Calificó",
            "w": 0.15
          },
          {
            "label": "Cierre",
            "w": 0.1
          }
        ]
      },
      {
        "type": "chatThread",
        "title": "No agendaste aún",
        "msgs": [
          {
            "from": "out",
            "text": "Vi que no agendaste 👀"
          },
          {
            "from": "in",
            "text": "Ando corto de tiempo"
          },
          {
            "from": "out",
            "text": "Te dejo horario flexible"
          },
          {
            "from": "in",
            "text": "Dale, mañana"
          }
        ]
      },
      {
        "type": "diffCard",
        "title": "MaKo pausó la nutrición",
        "rows": [
          {
            "field": "Estado",
            "before": "Nutriendo",
            "after": "Respondió"
          },
          {
            "field": "Próximo envío",
            "before": "Mañana 10:00",
            "after": "Cancelado"
          },
          {
            "field": "Etiqueta",
            "before": "Frío",
            "after": "Manual"
          }
        ]
      },
      {
        "type": "semaphore",
        "lit": "green",
        "verdict": "Plantilla Meta aprobada"
      },
      {
        "type": "rcBar",
        "title": "Enviados por secuencia",
        "bars": [
          {
            "label": "No agendó",
            "v": 88,
            "tone": "green"
          },
          {
            "label": "No Show R1",
            "v": 64
          },
          {
            "label": "No paga",
            "v": 47,
            "tone": "amber"
          },
          {
            "label": "Reactivación",
            "v": 31
          }
        ]
      }
    ]
  },
  "cobranza": {
    "hero": {
      "type": "rcRevenue"
    },
    "groups": [
      {
        "type": "statTiles",
        "title": "Este mes",
        "tiles": [
          {
            "label": "Vendido",
            "value": "$62k",
            "tone": "blue"
          },
          {
            "label": "Cobrado",
            "value": "$38k",
            "tone": "green"
          },
          {
            "label": "Pendiente",
            "value": "$24k",
            "tone": "amber"
          }
        ]
      },
      {
        "type": "pyramid",
        "title": "A quién cobrarle",
        "tiers": [
          {
            "label": "Vencidas · 4",
            "tone": "red"
          },
          {
            "label": "≤5 días · 6",
            "tone": "amber"
          },
          {
            "label": "Al día · 21",
            "tone": "green"
          }
        ]
      },
      {
        "type": "emailSequence",
        "title": "Plan de cuotas",
        "steps": [
          {
            "day": "Cierre",
            "subject": "Inicial $4k"
          },
          {
            "day": "Mes 1",
            "subject": "Cuota $2k"
          },
          {
            "day": "Mes 2",
            "subject": "Cuota $2k"
          },
          {
            "day": "Mes 3",
            "subject": "Cuota $2k"
          }
        ]
      },
      {
        "type": "docExtract",
        "doc": "comprobante.pdf",
        "fields": [
          {
            "k": "Monto",
            "v": "$2,000"
          },
          {
            "k": "Fecha",
            "v": "14 jul"
          },
          {
            "k": "Hora",
            "v": "09:41"
          }
        ]
      },
      {
        "type": "alertCard",
        "text": "4 cuotas vencidas y 6 vencen esta semana — MaKo te avisa en la Vista General."
      }
    ]
  },
  "contrato": {
    "hero": {
      "type": "signalFlow",
      "title": "Del PDF al deal cargado",
      "nodes": [
        {
          "label": "Contrato",
          "sub": "PDF firmado",
          "tone": "blue"
        },
        {
          "label": "MaKo",
          "sub": "lee y extrae",
          "tone": "amber"
        },
        {
          "label": "Deal",
          "sub": "cash cargado",
          "tone": "green"
        }
      ]
    },
    "groups": [
      {
        "type": "docExtract",
        "doc": "contrato.pdf",
        "fields": [
          {
            "k": "Total",
            "v": "$12k USD"
          },
          {
            "k": "Cuotas",
            "v": "3 × $4k"
          },
          {
            "k": "Razón social",
            "v": "Elevate MX"
          },
          {
            "k": "Servicio",
            "v": "Coaching · 12s"
          },
          {
            "k": "Promesa",
            "v": "Garantía 30d"
          },
          {
            "k": "Obligaciones",
            "v": "4 items"
          }
        ]
      },
      {
        "type": "splitLoad",
        "left": "PDF · documento",
        "right": "Foto · visión",
        "loading": [
          "Detectando archivo",
          "Extrayendo campos"
        ]
      },
      {
        "type": "diffCard",
        "title": "MaKo rellenó solo lo vacío",
        "rows": [
          {
            "field": "Servicio",
            "before": "—",
            "after": "Coaching"
          },
          {
            "field": "Modalidad",
            "before": "—",
            "after": "Online"
          },
          {
            "field": "Datos fiscales",
            "before": "Elevate MX",
            "after": "Elevate MX"
          }
        ]
      },
      {
        "type": "rcRevenue"
      }
    ]
  },
  "customer": {
    "hero": {
      "type": "rcRevenue"
    },
    "groups": [
      {
        "type": "kanban",
        "cols": [
          {
            "label": "Venta",
            "cards": 8,
            "tone": "blue"
          },
          {
            "label": "Servicio",
            "cards": 5,
            "tone": "green"
          },
          {
            "label": "Interna",
            "cards": 3,
            "tone": "amber"
          }
        ]
      },
      {
        "type": "rcGauge",
        "value": 72,
        "big": "72",
        "label": "Salud",
        "tone": "green"
      },
      {
        "type": "semaphore",
        "lit": "red",
        "verdict": "Cliente por soltarte"
      },
      {
        "type": "statTiles",
        "title": "LTV por cliente",
        "tiles": [
          {
            "label": "Cierre",
            "value": "$12k",
            "tone": "blue"
          },
          {
            "label": "Renovación",
            "value": "$9k",
            "tone": "green"
          },
          {
            "label": "Upsell",
            "value": "$6k",
            "tone": "amber"
          }
        ]
      }
    ]
  },
  "semaforo": {
    "hero": {
      "type": "semaphore",
      "lit": "red",
      "verdict": "Hay algo urgente hoy"
    },
    "groups": [
      {
        "type": "pyramid",
        "title": "Focos por urgencia",
        "tiers": [
          {
            "label": "Alta · 2 urgentes",
            "tone": "red"
          },
          {
            "label": "Media · 1 vigilar",
            "tone": "amber"
          },
          {
            "label": "En orden",
            "tone": "green"
          }
        ]
      },
      {
        "type": "rcBar",
        "title": "Creativo fatigado",
        "bars": [
          {
            "label": "Frecuencia",
            "v": 88,
            "tone": "red"
          },
          {
            "label": "CPL 7d",
            "v": 92,
            "tone": "red"
          },
          {
            "label": "CPL 28d",
            "v": 58
          }
        ]
      },
      {
        "type": "rcGauge",
        "value": 28,
        "big": "28%",
        "label": "Cierre",
        "tone": "amber"
      },
      {
        "type": "alertCard",
        "text": "Campañas en ACTIVE, pero la cuenta Meta no entrega. Los leads caen a cero y nadie lo ve."
      },
      {
        "type": "chatThread",
        "title": "MaKo · 7:00",
        "msgs": [
          {
            "from": "in",
            "text": "Semáforo: rojo"
          },
          {
            "from": "in",
            "text": "Cuenta Meta frenada"
          },
          {
            "from": "out",
            "text": "Voy a revisar"
          }
        ]
      },
      {
        "type": "statTiles",
        "title": "Incidentes",
        "tiles": [
          {
            "label": "Abiertos",
            "value": "1",
            "tone": "red"
          },
          {
            "label": "Resueltos",
            "value": "3",
            "tone": "green"
          },
          {
            "label": "Caída total",
            "value": "2h 14m",
            "tone": "amber"
          }
        ],
        "rows": [
          {
            "name": "Meta · entrega",
            "amount": "2h 14m",
            "tone": "red"
          },
          {
            "name": "Cobranza",
            "amount": "41m",
            "tone": "amber"
          }
        ]
      }
    ]
  },
  "experimentos": {
    "hero": {
      "type": "stamp",
      "title": "Costo por agenda",
      "result": "validated",
      "before": "$52",
      "after": "$31"
    },
    "groups": [
      {
        "type": "makoAnswer",
        "q": "¿Filtro más el formulario?",
        "a": "Experimento listo",
        "detail": "Métrica cp_form, dirección baja, ventana 14 días, objetivo -20%. Confirmás antes de arrancar."
      },
      {
        "type": "rcArea",
        "title": "cp_form · en vivo",
        "tone": "green",
        "data": [
          {
            "label": "D1",
            "v": 52
          },
          {
            "label": "D4",
            "v": 48
          },
          {
            "label": "D7",
            "v": 42
          },
          {
            "label": "D10",
            "v": 37
          },
          {
            "label": "D14",
            "v": 31
          }
        ]
      },
      {
        "type": "semaphore",
        "lit": "green",
        "verdict": "Hipótesis validada"
      },
      {
        "type": "signalFlow",
        "title": "Verdad validada",
        "nodes": [
          {
            "label": "Experimento",
            "sub": "validado",
            "tone": "green"
          },
          {
            "label": "MaKo",
            "sub": "cita el dato",
            "tone": "blue"
          },
          {
            "label": "Panel",
            "sub": "toda la app",
            "tone": "amber"
          }
        ]
      },
      {
        "type": "kanban",
        "cols": [
          {
            "label": "Propuesto",
            "cards": 2,
            "tone": "amber"
          },
          {
            "label": "Activo",
            "cards": 3,
            "tone": "green"
          },
          {
            "label": "Cerrado",
            "cards": 5,
            "tone": "blue"
          }
        ]
      }
    ]
  },
  "prioridades": {
    "hero": {
      "type": "pyramid",
      "title": "Pirámide del plan",
      "tiers": [
        {
          "label": "Alta · 3 hoy",
          "tone": "red"
        },
        {
          "label": "Media · 5",
          "tone": "amber"
        },
        {
          "label": "Baja · 6",
          "tone": "green"
        },
        {
          "label": "A futuro · 6",
          "tone": "green"
        }
      ]
    },
    "groups": [
      {
        "type": "rcBar",
        "title": "Score por tarea",
        "bars": [
          {
            "label": "Llamar leads",
            "v": 92,
            "tone": "green"
          },
          {
            "label": "CAPI",
            "v": 74
          },
          {
            "label": "Pulir VSL",
            "v": 33
          },
          {
            "label": "Rediseño",
            "v": 21
          }
        ]
      },
      {
        "type": "makoAnswer",
        "q": "¿Subo 'pulir VSL' a Alta?",
        "a": "Rechazo",
        "detail": "Eso suena a que te encariñaste con la tarea. Sin números que muevan plata, se queda abajo."
      },
      {
        "type": "statTiles",
        "title": "Objetivo Principal",
        "tiles": [
          {
            "label": "Objetivo",
            "value": "Cerrar R2",
            "tone": "blue"
          }
        ],
        "rows": [
          {
            "name": "1 · Llamar 5 leads",
            "amount": "92",
            "tone": "green"
          },
          {
            "name": "2 · Cerrar seguimiento",
            "amount": "80",
            "tone": "amber"
          },
          {
            "name": "3 · Confirmar juntas",
            "amount": "71",
            "tone": "amber"
          }
        ]
      },
      {
        "type": "kanban",
        "cols": [
          {
            "label": "Nueva",
            "cards": 2,
            "tone": "green"
          },
          {
            "label": "Enriquece",
            "cards": 3,
            "tone": "amber"
          },
          {
            "label": "Borrar?",
            "cards": 1,
            "tone": "red"
          }
        ]
      },
      {
        "type": "rcArea",
        "title": "Score estable",
        "tone": "blue",
        "data": [
          {
            "label": "C1",
            "v": 70
          },
          {
            "label": "C2",
            "v": 71
          },
          {
            "label": "C3",
            "v": 70
          },
          {
            "label": "C4",
            "v": 72
          },
          {
            "label": "C5",
            "v": 71
          }
        ]
      }
    ]
  },
  "retro": {
    "hero": {
      "type": "thesisCard",
      "tabs": [
        "Ads",
        "CRM",
        "Closing",
        "Revenue"
      ],
      "thesis": "Frente barato, embudo que fuga",
      "leak": "$18k",
      "plan": "2 exp · 3 tareas"
    },
    "groups": [
      {
        "type": "signalFlow",
        "title": "Cruces entre áreas",
        "nodes": [
          {
            "label": "Nutrición",
            "sub": "cierra 2.4x",
            "tone": "blue"
          },
          {
            "label": "Creativos",
            "sub": "explica CPL",
            "tone": "green"
          },
          {
            "label": "CRM",
            "sub": "no-show 1 ad",
            "tone": "amber"
          }
        ]
      },
      {
        "type": "funnel",
        "title": "Fuga del embudo",
        "stages": [
          {
            "label": "Impresiones",
            "w": 1
          },
          {
            "label": "Leads",
            "w": 0.42
          },
          {
            "label": "Agendó",
            "w": 0.24
          },
          {
            "label": "R1",
            "w": 0.15
          },
          {
            "label": "Cierre",
            "w": 0.11
          }
        ]
      },
      {
        "type": "diffCard",
        "title": "MaKo editó el hallazgo",
        "rows": [
          {
            "field": "Título",
            "before": "CPL alto",
            "after": "Tu guion explica el CPL"
          },
          {
            "field": "Insight",
            "before": "Conversión baja",
            "after": "No-show en un anuncio"
          },
          {
            "field": "Evidencia",
            "before": "$8.40 CPL",
            "after": "$8.40 CPL"
          }
        ]
      },
      {
        "type": "pyramid",
        "title": "Perro Guardián",
        "tiers": [
          {
            "label": "Alta · 15%",
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
        "type": "kanban",
        "cols": [
          {
            "label": "Hecha",
            "cards": 5,
            "tone": "green"
          },
          {
            "label": "Empezada",
            "cards": 2,
            "tone": "amber"
          },
          {
            "label": "Se perdió",
            "cards": 3,
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
        "Visibilidad",
        "Conversión",
        "Sistemas",
        "Delegación",
        "Foco"
      ],
      "current": 1
    },
    "groups": [
      {
        "type": "funnel",
        "title": "Cuello por fase",
        "stages": [
          {
            "label": "Visibilidad",
            "w": 1
          },
          {
            "label": "Conversión",
            "w": 0.64
          },
          {
            "label": "Sistemas",
            "w": 0.38
          },
          {
            "label": "Delegación",
            "w": 0.19
          },
          {
            "label": "Foco",
            "w": 0.1
          }
        ]
      },
      {
        "type": "rcBar",
        "title": "Tus 6 votos",
        "bars": [
          {
            "label": "F0",
            "v": 30
          },
          {
            "label": "F1",
            "v": 60,
            "tone": "green"
          },
          {
            "label": "F2",
            "v": 90
          },
          {
            "label": "F3",
            "v": 0
          },
          {
            "label": "F4",
            "v": 0
          }
        ]
      },
      {
        "type": "makoAnswer",
        "q": "¿Subo el presupuesto?",
        "a": "No todavía",
        "detail": "Tu VSL retiene 22%. Primero arreglá la conversión; en Fase 1 escalar pauta es tirar plata."
      },
      {
        "type": "scoreCard",
        "chrome": "Diagnóstico",
        "title": "6 dimensiones",
        "items": [
          {
            "label": "Ingresos",
            "v": 0.2
          },
          {
            "label": "Leads/mes",
            "v": 0.4
          },
          {
            "label": "Funnel",
            "v": 0.2
          },
          {
            "label": "Ventas",
            "v": 0.4
          },
          {
            "label": "Cuello",
            "v": 0.2
          },
          {
            "label": "Equipo",
            "v": 0.6
          }
        ]
      }
    ]
  },
  "whatsapp": {
    "hero": {
      "type": "chatThread",
      "title": "Hilo del lead",
      "msgs": [
        {
          "from": "in",
          "text": "Lo estoy pensando todavía"
        },
        {
          "from": "out",
          "text": "¿Qué te frena hoy?"
        },
        {
          "from": "in",
          "text": "El precio, sincero"
        },
        {
          "from": "out",
          "text": "Te muestro el ROI",
          "voice": true
        }
      ]
    },
    "groups": [
      {
        "type": "waInbox",
        "rows": [
          {
            "name": "Ana",
            "stage": "R2",
            "win": 18
          },
          {
            "name": "Bruno",
            "stage": "No Show",
            "win": 4
          },
          {
            "name": "Caro",
            "stage": "Por cobrar",
            "win": 22
          },
          {
            "name": "Diego",
            "stage": "Cliente",
            "win": 9
          }
        ]
      },
      {
        "type": "rcGauge",
        "value": 13,
        "big": "3h 12m",
        "label": "Ventana 24h",
        "tone": "amber"
      },
      {
        "type": "makoAnswer",
        "q": "¿Qué le respondo?",
        "a": "Reactivá con prueba social",
        "detail": "Está en No Show hace tres días. Mandá un caso parecido al suyo y proponé nuevo horario."
      },
      {
        "type": "semaphore",
        "lit": "amber",
        "verdict": "Riesgo medio: revisá categoría"
      },
      {
        "type": "kanban",
        "cols": [
          {
            "label": "Pendiente",
            "cards": 5,
            "tone": "amber"
          },
          {
            "label": "Enviado",
            "cards": 12,
            "tone": "green"
          },
          {
            "label": "Bloqueado",
            "cards": 2,
            "tone": "red"
          }
        ]
      }
    ]
  },
  "email": {
    "hero": {
      "type": "funnel",
      "title": "Del email a la venta",
      "stages": [
        {
          "label": "Enviados",
          "w": 1
        },
        {
          "label": "Abiertos",
          "w": 0.42
        },
        {
          "label": "Clics",
          "w": 0.14
        },
        {
          "label": "Agendó",
          "w": 0.1
        },
        {
          "label": "Cierre",
          "w": 0.1
        }
      ]
    },
    "groups": [
      {
        "type": "emailSequence",
        "title": "Triggers del funnel",
        "steps": [
          {
            "day": "Día 0",
            "subject": "No agendaste tu R1"
          },
          {
            "day": "Día 1",
            "subject": "Viste el VSL"
          },
          {
            "day": "Día 3",
            "subject": "Confirmaste sin pagar"
          },
          {
            "day": "Día 7",
            "subject": "Reactivación de frío"
          }
        ]
      },
      {
        "type": "makoAnswer",
        "q": "¿Redacto este email?",
        "a": "Asunto + cuerpo listos",
        "detail": "En la voz de Mauricio: asunto de 6 palabras, un solo CTA y tu link de Calendly ya puesto."
      },
      {
        "type": "docExtract",
        "doc": "tudominio.mx",
        "fields": [
          {
            "k": "DKIM",
            "v": "Verified"
          },
          {
            "k": "SPF",
            "v": "Verified"
          },
          {
            "k": "DMARC",
            "v": "Pass"
          }
        ]
      },
      {
        "type": "rcGauge",
        "value": 98,
        "big": "98%",
        "label": "Entregabilidad",
        "tone": "green"
      }
    ]
  },
  "conocimiento": {
    "hero": {
      "type": "ragIndex",
      "title": "Tu método, indexado",
      "source": "tu clase"
    },
    "groups": [
      {
        "type": "splitLoad",
        "left": "Video / audio",
        "right": "Texto listo",
        "loading": [
          "Transcribiendo con Whisper",
          "Indexando al toque"
        ]
      },
      {
        "type": "roleMatrix",
        "roles": [
          "Mensajes",
          "Ads",
          "General"
        ],
        "tools": [
          {
            "tool": "Asesor WA",
            "on": [
              true,
              false,
              false
            ]
          },
          {
            "tool": "Nutrición",
            "on": [
              true,
              false,
              false
            ]
          },
          {
            "tool": "Campañas Meta",
            "on": [
              false,
              true,
              false
            ]
          },
          {
            "tool": "Chat MaKo",
            "on": [
              false,
              false,
              true
            ]
          }
        ]
      },
      {
        "type": "rcBar",
        "title": "Match semántico top-k",
        "bars": [
          {
            "label": "Objeción precio",
            "v": 92,
            "tone": "green"
          },
          {
            "label": "Reactivar lead",
            "v": 78,
            "tone": "green"
          },
          {
            "label": "Secuencia 7d",
            "v": 61
          },
          {
            "label": "Genérico",
            "v": 12
          }
        ]
      },
      {
        "type": "signalFlow",
        "title": "El método bueno viaja solo",
        "nodes": [
          {
            "label": "Agencia",
            "sub": "read-only",
            "tone": "blue"
          },
          {
            "label": "Tu workspace",
            "sub": "tu jerga",
            "tone": "green"
          },
          {
            "label": "MaKo",
            "sub": "responde",
            "tone": "amber"
          }
        ]
      }
    ]
  },
  "mako": {
    "hero": {
      "type": "makoAnswer",
      "q": "¿Apago la campaña VSL Dolor?",
      "a": "No. Escalá presupuesto",
      "detail": "Trae ROAS 4.2x y 6 cierres esta semana. Subí 20% y validalo como experimento antes de tocar el resto."
    },
    "groups": [
      {
        "type": "signalFlow",
        "title": "Contexto en vivo",
        "nodes": [
          {
            "label": "Perfil",
            "sub": "cliente",
            "tone": "blue"
          },
          {
            "label": "Funnel",
            "sub": "tus etapas",
            "tone": "green"
          },
          {
            "label": "MaKo",
            "sub": "decide",
            "tone": "amber"
          }
        ]
      },
      {
        "type": "splitLoad",
        "left": "9 tools",
        "right": "solo lectura",
        "loading": [
          "Leads 90d",
          "Fichas R1/R2",
          "Fathom",
          "Funnel"
        ]
      },
      {
        "type": "chatThread",
        "title": "Hola MaKo",
        "msgs": [
          {
            "from": "in",
            "text": "¿Cómo viene la semana?"
          },
          {
            "from": "out",
            "text": "3 cierres, 2 no-show"
          },
          {
            "from": "in",
            "text": "Audio: ¿qué priorizo?",
            "voice": true
          },
          {
            "from": "out",
            "text": "Recuperá los 2 no-show"
          }
        ]
      },
      {
        "type": "diffCard",
        "title": "MaKo propone mover un lead",
        "rows": [
          {
            "field": "Estado",
            "before": "Agendó R2",
            "after": "No Show"
          },
          {
            "field": "Nutrición",
            "before": "Pausada",
            "after": "Activa"
          }
        ]
      },
      {
        "type": "kanban",
        "cols": [
          {
            "label": "Captura",
            "cards": 6,
            "tone": "blue"
          },
          {
            "label": "Nutrición",
            "cards": 3,
            "tone": "green"
          },
          {
            "label": "Nuevo",
            "cards": 2,
            "tone": "amber"
          }
        ]
      },
      {
        "type": "pyramid",
        "title": "Prioridad forzada",
        "tiers": [
          {
            "label": "Alta · 2 hoy",
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
        "type": "ragIndex",
        "title": "Conocimiento curado",
        "source": "tu método"
      }
    ]
  },
  "integraciones": {
    "hero": {
      "type": "signalFlow",
      "title": "Tus llaves, tu embudo",
      "nodes": [
        {
          "label": "Meta Ads",
          "sub": "tu token",
          "tone": "blue"
        },
        {
          "label": "MaKo",
          "sub": "cifra + rutea",
          "tone": "green"
        },
        {
          "label": "WhatsApp",
          "sub": "tu token",
          "tone": "amber"
        }
      ]
    },
    "groups": [
      {
        "type": "byokKey",
        "account": "Meta Ads · Elevate MX"
      },
      {
        "type": "alertCard",
        "text": "Reventar la key de un cliente no abre las de los demás. Cada credencial cifrada y aislada."
      },
      {
        "type": "rcBar",
        "title": "Gasto por modelo",
        "bars": [
          {
            "label": "Opus",
            "v": 88
          },
          {
            "label": "Sonnet",
            "v": 54
          },
          {
            "label": "Haiku",
            "v": 22
          },
          {
            "label": "Groq",
            "v": 8,
            "tone": "green"
          },
          {
            "label": "GPT-4o",
            "v": 16
          }
        ]
      },
      {
        "type": "semaphore",
        "lit": "green",
        "verdict": "Landing conectada · llegan eventos"
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
          "tool": "Closing",
          "on": [
            false,
            true,
            true
          ]
        },
        {
          "tool": "Ad Spend",
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
        }
      ]
    },
    "groups": [
      {
        "type": "statTiles",
        "title": "Set fijo por rol",
        "tiles": [
          {
            "label": "Setter",
            "value": "3 tools",
            "tone": "green"
          },
          {
            "label": "Closer",
            "value": "3 tools",
            "tone": "blue"
          },
          {
            "label": "Admin",
            "value": "Todo",
            "tone": "amber"
          }
        ]
      },
      {
        "type": "semaphore",
        "lit": "red",
        "verdict": "403 acceso denegado"
      },
      {
        "type": "diffCard",
        "title": "MaKo revocó el rol",
        "rows": [
          {
            "field": "Rol",
            "before": "Closer",
            "after": "Sin acceso"
          },
          {
            "field": "Acceso",
            "before": "Activo",
            "after": "Bloqueado"
          }
        ]
      },
      {
        "type": "signalFlow",
        "title": "Alta sin contraseña",
        "nodes": [
          {
            "label": "Invitás",
            "sub": "email",
            "tone": "blue"
          },
          {
            "label": "Google",
            "sub": "login",
            "tone": "amber"
          },
          {
            "label": "Activo",
            "sub": "sin clave",
            "tone": "green"
          }
        ]
      },
      {
        "type": "alertCard",
        "text": "Rol decide qué ve; Capa decide qué compró. Otro workspace devuelve 404: no es tu equipo."
      }
    ]
  },
  "perfil-reportes": {
    "hero": {
      "type": "semaphore",
      "lit": "red",
      "verdict": "Entrega frenada"
    },
    "groups": [
      {
        "type": "alertCard",
        "text": "Meta en rojo, cuota vencida $12k, adset fatigado: MaKo te escribe. Solo cuando duele."
      },
      {
        "type": "statTiles",
        "title": "Diario 7:00",
        "tiles": [
          {
            "label": "Vendido",
            "value": "$48k",
            "tone": "blue"
          },
          {
            "label": "Gasto",
            "value": "$9k",
            "tone": "amber"
          },
          {
            "label": "Leads",
            "value": "62",
            "tone": "green"
          }
        ],
        "rows": [
          {
            "name": "Cuota vencida",
            "amount": "$12k",
            "tone": "red"
          },
          {
            "name": "CPL ayer",
            "amount": "$145",
            "tone": "amber"
          }
        ]
      },
      {
        "type": "chatThread",
        "title": "reporte_mako",
        "msgs": [
          {
            "from": "out",
            "text": "Tu reporte diario está listo"
          },
          {
            "from": "in",
            "text": "Recibir reporte"
          },
          {
            "from": "out",
            "text": "Semáforo verde · Gasto $9k"
          },
          {
            "from": "out",
            "text": "Wins 4 · Meta 60%"
          }
        ]
      },
      {
        "type": "roleMatrix",
        "roles": [
          "WhatsApp",
          "Email"
        ],
        "tools": [
          {
            "tool": "Horario",
            "on": [
              true,
              false
            ]
          },
          {
            "tool": "Diario",
            "on": [
              false,
              true
            ]
          },
          {
            "tool": "Semanal",
            "on": [
              true,
              true
            ]
          }
        ]
      },
      {
        "type": "signalFlow",
        "title": "Dónde vive cada cosa",
        "nodes": [
          {
            "label": "Perfil",
            "sub": "por usuario",
            "tone": "blue"
          },
          {
            "label": "Contacto",
            "sub": "del workspace",
            "tone": "green"
          },
          {
            "label": "Cron 7:00",
            "sub": "sin sesión",
            "tone": "amber"
          }
        ]
      }
    ]
  }
};
