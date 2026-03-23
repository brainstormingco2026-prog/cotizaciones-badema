# CRM Badema — Documento de UAT (User Acceptance Testing)

**Versión:** 1.0
**Fecha:** Marzo 2026
**Entorno:** UAT / Pre-producción

---

## Acceso a la aplicación

**URL:** https://cotizaciones-badema.vercel.app

---

## Credenciales de prueba

| Rol | Email | Contraseña |
|-----|-------|------------|
| Administrador | admin@badema.com | admin123 |
| Vendedor | vendedor19531@badema.com | vendedor19531 |

> Los datos cargados son **simulados** (no provienen aún de la cuenta real de Contabilium). Ver sección "Próximos pasos".

---

## Funcionalidades a probar

### 1. Login
- Ingresar a la URL y autenticarse con las credenciales de cada rol.
- Verificar que un usuario con rol **Vendedor** no puede ver cotizaciones de otros vendedores.
- Verificar que un usuario con rol **Admin** puede ver todas las cotizaciones.

---

### 2. Dashboard
- Al ingresar se muestra el panel principal con:
  - **Contadores por estado:** Borrador, Pendiente, Enviada, Aprobada, Rechazada.
  - **Calendario de seguimientos:** próximos 10 días hábiles con cotizaciones que tienen seguimiento programado.
  - **Alerta del día:** si hay cotizaciones con seguimiento vencido hoy, aparece una notificación en pantalla.

**Verificar:**
- [ ] Los contadores reflejan correctamente las cotizaciones asignadas al usuario logueado.
- [ ] El calendario muestra las fechas de próximo seguimiento.
- [ ] Las alertas aparecen cuando hay seguimientos pendientes para hoy.

---

### 3. Listado de cotizaciones

Ruta: `/dashboard/cotizaciones`

- Se muestra la tabla con todas las cotizaciones (filtrada por rol).
- Tabs para filtrar por estado: Todas / Borrador / Pendiente / Enviada / Aprobada / Rechazada.
- Columnas: Cliente, N° Cotización, Fecha, Importe, Estado, % Cierre, Frecuencia de seguimiento, Próximo seguimiento.

**Verificar:**
- [ ] Los filtros por estado funcionan correctamente.
- [ ] Se puede editar el **% de cierre** directamente en la tabla.
- [ ] Se puede editar la **frecuencia de seguimiento** (Sin seguimiento / 3 / 7 / 15 / 30 días).
- [ ] Al guardar la frecuencia, se calcula y muestra la **fecha del próximo seguimiento**.
- [ ] El botón **Sincronizar** (solo visible para Admin) carga/actualiza cotizaciones.

---

### 4. Detalle de cotización

Al hacer clic en una cotización se abre la vista de detalle con:
- Datos del cliente (nombre, email, teléfono, dirección).
- Datos de la cotización (número, fecha, importe, estado, observaciones).
- Campos editables: % de cierre y frecuencia de seguimiento.
- Botones de contacto:
  - **WhatsApp:** abre chat con mensaje pre-cargado.
  - **Email:** abre cliente de correo con asunto y cuerpo pre-cargado.

**Verificar:**
- [ ] Los datos del cliente y la cotización se muestran correctamente.
- [ ] Los cambios en % de cierre y frecuencia se guardan correctamente.
- [ ] El botón de WhatsApp abre el chat con el mensaje correcto.
- [ ] El botón de Email abre el cliente de correo con los datos correctos.

---

### 5. Sincronización (solo Admin)

El botón **Sincronizar** en la lista de cotizaciones llama a la API de Contabilium y actualiza los datos.

> **En esta etapa de UAT los datos son simulados.** La integración con la cuenta real de Contabilium se realizará en la siguiente fase (ver "Próximos pasos").

**Verificar:**
- [ ] El botón Sincronizar está visible solo para el Admin.
- [ ] Al sincronizar, se actualizan las cotizaciones en pantalla.
- [ ] Un Vendedor no puede ejecutar la sincronización.

---

### 6. Cierre de sesión

- El botón de logout se encuentra en la barra superior del dashboard.

**Verificar:**
- [ ] Al cerrar sesión se redirige al login.
- [ ] No es posible acceder al dashboard sin estar autenticado.

---

## Diferencias entre roles

| Funcionalidad | Admin | Vendedor |
|--------------|-------|----------|
| Ver todas las cotizaciones | ✅ | ❌ (solo las propias) |
| Sincronizar desde Contabilium | ✅ | ❌ |
| Dashboard global | ✅ | ❌ (solo sus métricas) |
| Editar % cierre y seguimiento | ✅ | ✅ |
| Contactar cliente (WhatsApp / Email) | ✅ | ✅ |
| Recibir alertas de seguimiento | ✅ | ✅ |

---

## Aspectos a validar durante el UAT

1. **Datos:** ¿La información de cotizaciones y clientes se corresponde con lo que manejan en Contabilium?
2. **Flujo de seguimiento:** ¿Las frecuencias de seguimiento (3/7/15/30 días) son suficientes o hacen falta otras?
3. **Contacto:** ¿El mensaje pre-cargado en WhatsApp y Email es adecuado?
4. **Roles:** ¿La separación Admin/Vendedor refleja correctamente cómo trabaja el equipo?
5. **Dashboard:** ¿Los indicadores del panel son los que necesitan ver a diario?

---

## Cómo reportar errores o sugerencias

Por cada issue encontrado, indicar:
- Pantalla / funcionalidad afectada.
- Pasos para reproducirlo.
- Qué se esperaba vs. qué ocurrió.
- Captura de pantalla si es posible.

---

## Próximos pasos (post-UAT)

### 1. Integración con la API real de Contabilium

Actualmente el sistema funciona con **datos simulados**. Para conectarlo con la cuenta real de Badema se necesita:

- **Credenciales de API de Contabilium:**
  - `Client ID` y `Client Secret` de la cuenta de Badema.
  - Se obtienen desde el panel de Contabilium o contactando a api@contabilium.com.

- **Configuración en el servidor (Vercel):**
  - Agregar las variables de entorno `CONTABILIUM_CLIENT_ID` y `CONTABILIUM_CLIENT_SECRET`.
  - Cambiar `USE_MOCK_CONTABILIUM` a `false`.

- **Resultado:** Al presionar Sincronizar, el sistema traerá las cotizaciones reales de Badema, con los clientes, importes y estados actuales.

- **Vendedores:** Para que cada vendedor vea sus propias cotizaciones, se debe configurar su `ID de Contabilium` en el sistema (un número que identifica al vendedor dentro de Contabilium).

---

### 2. Aplicación mobile

El sistema está preparado para ser usado desde el celular. Hay dos caminos:

#### Opción A — PWA (Progressive Web App) · Recomendada como primer paso

La app ya es una PWA. Esto significa que desde el navegador del celular se puede **instalar en la pantalla de inicio** sin pasar por el App Store ni Google Play.

**Cómo instalarla:**
1. Abrir https://cotizaciones-badema.vercel.app en Chrome (Android) o Safari (iPhone).
2. Tocar el menú del navegador → "Agregar a pantalla de inicio" (Android) o "Compartir → Añadir a pantalla de inicio" (iPhone).
3. La app queda instalada como si fuera nativa.

**Para habilitarla completamente se necesita:**
- Configurar las **notificaciones push** para que los vendedores reciban alertas en el celular cuando tienen seguimientos pendientes (ya está desarrollado el backend, falta activarlo en producción).
- Configurar un **cron job** (tarea automática diaria) que envíe las alertas cada mañana.

#### Opción B — App nativa (iOS / Google Play)

Si se requiere presencia en las tiendas de apps, se puede desarrollar una app nativa con **React Native / Expo**, reutilizando la lógica y la API ya construida.

Implica un desarrollo adicional estimado y proceso de publicación en App Store y Google Play.

---

### Resumen de lo que se necesita para avanzar

| Acción | Quién lo provee | Descripción |
|--------|----------------|-------------|
| Credenciales API Contabilium | Badema | Client ID + Secret de la cuenta |
| IDs de vendedores en Contabilium | Badema | El número de cada vendedor en Contabilium |
| Confirmación de flujos UAT | Badema | Aprobación o cambios tras las pruebas |
| Decisión sobre app mobile | Badema | PWA (gratis, inmediato) vs. app nativa (desarrollo adicional) |

---

*Documento preparado para el proceso de UAT del CRM Badema.*
