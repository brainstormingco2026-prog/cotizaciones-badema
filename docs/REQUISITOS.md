# CRM Badema – Requisitos y alcance

## Contexto

**Empresa:** Badema  
**Rubro:** Comercialización de equipos industriales (bombas de agua, motores eléctricos, etc.)  
**Sistema actual:** Contabilium (administrativo) – allí se generan y gestionan cotizaciones.

**Problema:** Contabilium es administrativo y poco práctico para el día a día comercial. Se necesita un CRM que complemente el proceso de cotización con seguimiento activo y alertas para los vendedores.

---

## Objetivos

1. **Seguimiento de cotizaciones** conectado por API a Contabilium.
2. **Alertas en celular** para que los vendedores reciban avisos y den seguimiento en tiempo útil.
3. **Aumentar el cierre de cotizaciones** (más ventas) mediante recordatorios y contacto planificado con el cliente.

---

## Fase 1 – Alcance inicial

### 1. Sincronización con Contabilium

- Conexión vía **API Contabilium** (REST, JSON).
- Documentación: [Contabilium API](https://ayuda.contabilium.com/hc/es/articles/360013444234-Documentaci%C3%B3n-de-la-API)  
- Endpoints: [Postman – API Contabilium](https://documenter.getpostman.com/view/17702437/2s93shz9yz)
- Sincronizar: **cotizaciones** y sus **estados** (y datos necesarios de clientes/productos según lo que exponga la API).

### 2. Seguimiento de cotizaciones

- Cada cotización en el CRM debe poder:
  - Reflejar el estado que viene de Contabilium.
  - Tener **frecuencia de seguimiento** elegida por el vendedor: **3, 7, 15 o 30 días**.
  - Incluir **datos del cliente** para contacto (teléfono, email, etc.).
- El sistema debe **enviar mensaje/alerta al vendedor** (vía app móvil o notificaciones) para que contacte al cliente según esa frecuencia.

### 3. Porcentaje de probabilidad de éxito

- Cada cotización debe tener un **porcentaje posible de éxito** (ej. 10–100 %) configurable/visible en el CRM.

### 4. Panel de control (dashboard)

- Vista general con:
  - Cotizaciones **activas**.
  - Cotizaciones **perdidas**.
  - Cotizaciones **ganadas** (cerradas).
  - Indicador de **posibilidad de cierre** (relacionado al % de éxito y/o estado).
- Todo **agrupado por vendedor** (y opcionalmente por período).

### 5. Roles y permisos

- **Admin:** ve toda la información (todos los vendedores, todas las cotizaciones, panel general).
- **Vendedor:** ve solo **su** información (sus cotizaciones, sus clientes, su resumen).

### 6. App / experiencia móvil

- Los vendedores deben recibir en el **celular**:
  - Alertas/recordatorios de seguimiento.
  - Acceso práctico a la cotización y datos del cliente para contactar.
- Objetivo: que sea fácil consultar y actuar desde el móvil (app nativa o PWA responsive).

---

## Fase 2 – Futuro

- **Geolocalización de clientes:** poder ver en un mapa o en “ruta” qué cotizaciones tiene cada vendedor cerca del recorrido que va a hacer (para planificar visitas y seguimientos).

---

## Resumen de funcionalidades por rol

| Funcionalidad                         | Admin | Vendedor |
|---------------------------------------|-------|----------|
| Ver todas las cotizaciones            | Sí    | No       |
| Ver solo mis cotizaciones             | Sí    | Sí       |
| Dashboard general (por vendedor)       | Sí    | No       |
| Mi dashboard / mis indicadores         | Sí    | Sí       |
| Definir frecuencia de seguimiento     | Sí    | Sí (propias) |
| Recibir alertas de seguimiento        | Opcional | Sí    |
| Porcentaje de éxito por cotización    | Sí    | Sí (propias) |
| Datos de cliente para contacto        | Sí    | Sí (asignados) |
| Geolocalización (fase 2)              | Sí    | Sí (propias rutas) |

---

## Integración Contabilium

- **Autenticación y credenciales:** según Contabilium (ej. Mi cuenta → Configuración → API → Credenciales).
- El CRM debe:
  - Leer cotizaciones y sus cambios de estado.
  - Mantener en base local una copia actualizada + datos propios del CRM (frecuencia de seguimiento, % éxito, asignación a vendedor, etc.).
- **Modo simulado:** sin credenciales (o con `USE_MOCK_CONTABILIUM=true`) el sistema usa datos mock para desarrollo: clientes y cotizaciones de ejemplo, mismos flujos (sync, dashboard, seguimiento). Cuando existan credenciales, se configura la API real.
- Consultar con Contabilium (api@contabilium.com) los endpoints exactos de **presupuestos/cotizaciones** y **clientes** si no están claros en la documentación pública.

---

## Stack técnico sugerido (escalable)

- **Backend:** API REST (Node.js + Express o Next.js API Routes) con autenticación JWT y roles.
- **Base de datos:** PostgreSQL (o SQLite en desarrollo) con ORM (Prisma).
- **Frontend web (dashboard):** React/Next.js para escritorio y uso admin.
- **Móvil:** PWA (Progressive Web App) con notificaciones push, o app nativa (React Native/Expo) en una segunda etapa.
- **Notificaciones:** servicio de push (Firebase FCM o similar) para alertas en celular.
- **Contabilium:** cliente HTTP + jobs/cron para sincronización periódica de cotizaciones y estados.

Este documento es la referencia de requisitos para el desarrollo del CRM Badema.
