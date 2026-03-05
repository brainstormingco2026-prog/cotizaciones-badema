# Arquitectura CRM Badema

## Diagrama de alto nivel

```
┌─────────────────┐     API REST      ┌──────────────────┐
│  Contabilium    │ ◄──────────────► │  CRM Badema      │
│  (cotizaciones, │   sincronización  │  Backend         │
│   estados)      │                   │  (Node/Next)     │
└─────────────────┘                   └────────┬─────────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │                          │                          │
                    ▼                          ▼                          ▼
           ┌────────────────┐        ┌────────────────┐        ┌────────────────┐
           │  Dashboard Web │        │  App móvil /   │        │  Base de datos │
           │  (Admin /      │        │  PWA           │        │  (PostgreSQL)  │
           │   Vendedor)    │        │  (alertas)     │        │  + Prisma      │
           └────────────────┘        └────────────────┘        └────────────────┘
                    │                          │
                    └──────────────────────────┴──────────────────────────┘
                                               │
                                    Notificaciones push (FCM)
                                    para recordatorios de seguimiento
```

## Flujo de seguimiento de cotizaciones

1. En **Contabilium** se crea o actualiza una cotización (estado, ítems, cliente).
2. El **CRM** sincroniza vía API y guarda/actualiza la cotización en su base de datos.
3. El **vendedor** asigna la cotización a sí mismo (o el admin la asigna) y elige **frecuencia de seguimiento** (3/7/15/30 días).
4. Un **job/cron** calcula qué cotizaciones requieren seguimiento hoy y dispara **notificaciones** al vendedor (app móvil / PWA).
5. El vendedor abre la app, ve la cotización y datos del cliente, contacta y puede actualizar % de éxito o notas.
6. El **dashboard** muestra cotizaciones activas, ganadas, perdidas y posibilidad de cierre, agrupado por vendedor.

## Entidades principales

- **User:** email, nombre, rol (admin | vendedor), contraseña (hash).
- **Quotation (Cotización):** id externo Contabilium, estado, cliente (ref), vendedor asignado, frecuencia de seguimiento (días), próxima fecha de seguimiento, porcentaje de éxito, última sincronización.
- **Client:** datos de contacto (nombre, teléfono, email, dirección) – puede venir de Contabilium o completarse en el CRM.
- **FollowUp:** historial de seguimientos (fecha, notas, resultado) opcional para métricas.
- **SyncLog:** registro de sincronizaciones con Contabilium para auditoría.

## Seguridad

- Autenticación: JWT (o sesiones) con refresh.
- Autorización: middleware por ruta según rol (admin ve todo, vendedor solo sus recursos).
- Credenciales Contabilium en variables de entorno, nunca en código.
- HTTPS en producción.

## Escalabilidad

- Fase 1: monolito API + dashboard + PWA.
- Fase 2: geolocalización, rutas, posible app nativa.
- Sincronización Contabilium: cola de jobs (ej. Bull/Agenda) para no bloquear la API.
