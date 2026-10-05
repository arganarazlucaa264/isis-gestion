# Decisiones de arquitectura (ADR)

Cada decisión importante se registra en un archivo corto numerado. Formato: contexto, decisión,
consecuencias. Una decisión no se edita: si cambia, se crea un ADR nuevo que la reemplaza.

| #                                        | Decisión                                               | Estado   |
| ---------------------------------------- | ------------------------------------------------------ | -------- |
| [0001](./0001-logica-en-postgres.md)     | La lógica de negocio crítica vive en PostgreSQL (RPC)  | Aceptada |
| [0002](./0002-ledgers-inmutables.md)     | Stock, caja y cuenta corriente como ledgers inmutables | Aceptada |
| [0003](./0003-costos-en-tabla-aparte.md) | Costos en tablas separadas por seguridad (RLS)         | Aceptada |
| [0004](./0004-stack-y-herramientas.md)   | Stack y herramientas del frontend                      | Aceptada |
| [0005](./0005-alcance-inicial.md)        | Alcance inicial: un local, ARS, sin facturación fiscal | Aceptada |
