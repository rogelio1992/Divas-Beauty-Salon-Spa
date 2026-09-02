# Roadmap — Divas Beauty Spa

Este documento es la guía de evolución del sistema. Cada mejora terminada se marca aquí antes de pasar a la siguiente fase.

## Estado actual

- [x] Agenda visual responsive.
- [x] Crear citas durante la sesión.
- [x] Servicios alineados con Divas Beauty Spa.
- [x] Acceso a reservas por WhatsApp.
- [x] Despliegue de prueba en Vercel.
- [x] Secciones disponibles: Agenda, Clientes, Servicios y Equipo.
- [x] Navegación diaria de la agenda y eliminación de citas de demostración.
- [x] Citas persistentes en Supabase.
- [x] Inicio de sesión básico para acceder a la agenda.
- [x] Reserva pública sin cuenta para clientas.
- [x] Horarios disponibles y prevención de cruces en reservas públicas.
- [x] Estados operativos para citas y liberación automática al cancelar.
- [x] Horarios disponibles y prevención de cruces en la agenda interna.

## Fase 1 — Agenda operativa

Objetivo: usar la agenda diariamente sin perder la información.

- [x] Conectar Supabase para guardar los datos.
- [x] Crear y eliminar citas reales.
- [ ] Editar citas.
- [x] Navegar por días en la agenda.
- [ ] Mostrar calendario semanal.
- [x] Estados: confirmada, completada, cancelada y no asistió.
- [x] Evitar cruces de horario para cada profesional.

## Fase 2 — Equipo y servicios

Objetivo: organizar el trabajo real del salón.

- [ ] Inicio de sesión para administradora y trabajadoras.
- [ ] Permisos: cada trabajadora ve sus citas; administración ve todo.
- [ ] Configurar horarios y días de trabajo por profesional.
- [ ] Administrar catálogo de servicios, precios y duración.
- [ ] Ficha e historial de cada clienta.

## Fase 3 — Reservas de clientas

Objetivo: facilitar que las clientas reserven y confirmen su hora.

- [x] Página pública de reservas.
- [x] Mostrar solo horas disponibles.
- [ ] Confirmación de cita por WhatsApp.
- [ ] Recordatorios automáticos antes de la cita.

## Fase 4 — Administración del negocio

Objetivo: apoyar las decisiones del salón.

- [ ] Registrar pagos y métodos de pago.
- [ ] Calcular comisiones por profesional.
- [ ] Reportes de ventas, servicios y asistencia.
- [ ] Indicadores de clientas frecuentes y cancelaciones.

## Ideas futuras

- [ ] Lista de espera cuando no haya cupos.
- [ ] Paquetes, promociones y tarjetas de regalo.
- [ ] Galería de trabajos por profesional.
- [ ] Integración con Google Calendar.

---

**Próxima prioridad:** Fase 1 — editar citas y añadir calendario semanal.
