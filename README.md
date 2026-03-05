# CRM Badema

Sistema de seguimiento de cotizaciones para Badema, conectado por API a **Contabilium**. Permite a los vendedores recibir alertas de seguimiento (3/7/15/30 días), ver panel por cotizaciones activas/ganadas/perdidas y porcentaje de posibilidad de cierre, con roles **Admin** y **Vendedor**.

## Requisitos y arquitectura

- [Requisitos (Fase 1 y 2)](docs/REQUISITOS.md)
- [Arquitectura](docs/ARQUITECTURA.md)

## Stack

- **Next.js 14** (App Router) – API y futuro dashboard web
- **Prisma** + **PostgreSQL**
- **Contabilium** – integración vía API REST (documentación: [Ayuda Contabilium](https://ayuda.contabilium.com/hc/es/articles/360013444234-Documentaci%C3%B3n-de-la-API), [Postman](https://documenter.getpostman.com/view/17702437/2s93shz9yz))

## Instalación

```bash
cp .env.example .env
# Editar .env: DATABASE_URL, JWT_SECRET, CONTABILIUM_*
npm install
npm run db:generate
npm run db:push
npm run db:seed   # Crea admin por defecto (admin@badema.com / admin123)
npm run dev
```

- **Dashboard:** http://localhost:3000  
- **API:** http://localhost:3000/api/...

## Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Login (email, password) → JWT y datos de usuario |
| GET | `/api/quotations` | Lista cotizaciones (filtro `state`, `mine`) |
| GET | `/api/quotations/[id]` | Detalle cotización + cliente |
| PATCH | `/api/quotations/[id]` | Actualizar asignación, % éxito, frecuencia de seguimiento (3/7/15/30 días) |
| GET | `/api/dashboard` | Panel: activas, ganadas, perdidas, por posibilidad de cierre (por vendedor) |
| POST | `/api/sync` | Sincronizar cotizaciones desde Contabilium (solo admin) |
| GET | `/api/notifications/follow-up-alerts` | Cotizaciones con seguimiento due hoy (para cron → push/email) |

## Sincronización Contabilium (y modo simulado)

**Sin credenciales** (o con `USE_MOCK_CONTABILIUM=true` en `.env`), la sincronización usa **datos simulados**: clientes y cotizaciones de ejemplo (bombas, motores, estados activa/ganada/perdida) para desarrollar y probar el CRM. Al ejecutar `POST /api/sync` o `npm run sync:contabilium` se cargan ~24 cotizaciones mock.

Cuando tengas **credenciales** de Contabilium, configurá `CONTABILIUM_CLIENT_ID` y `CONTABILIUM_CLIENT_SECRET` y quitá o poné `USE_MOCK_CONTABILIUM=false` para usar la API real. Los endpoints exactos de presupuestos pueden variar; ajustar en `lib/contabilium/sync-quotations.ts` según la [documentación Postman](https://documenter.getpostman.com/view/17702437/2s93shz9yz) o consultando a **api@contabilium.com**.

- Ejecutar manualmente: `npm run sync:contabilium`
- Desde el panel (admin): `POST /api/sync` con JWT de admin. La respuesta incluye `mock: true/false` según el origen de los datos.

## Alertas para vendedores (celular)

Un **cron** puede llamar a `GET /api/notifications/follow-up-alerts` (opcionalmente con header `x-cron-secret`) para obtener la lista de cotizaciones con seguimiento due hoy. Con esa lista se puede:

- Enviar **notificaciones push** (PWA o app nativa con FCM).
- Enviar **email** o **SMS** al vendedor con el cliente y datos de contacto.

En una siguiente fase se puede implementar la suscripción push en el front y el envío vía Firebase (o similar).

## Roles

- **Admin:** ve todas las cotizaciones, todos los vendedores, ejecuta sync y panel global.
- **Vendedor:** ve solo sus cotizaciones asignadas y su propio panel.

## Fase 2 (futuro)

- Geolocalización de clientes y cotizaciones en ruta.
- App móvil nativa o PWA con notificaciones push integradas.

---

Desarrollado para **Badema** – equipos industriales (bombas, motores, etc.).
