# 0007 · Importación de Excel con staging y confirmación

**Estado:** aceptada

## Decisión

- El navegador lee el `.xlsx` (ExcelJS) y sube las filas **crudas, como texto**, a `import_batch_rows`.
- La validación ocurre en la base (`validate_import_batch`): EAN con dígito verificador, recuperación
  de ceros iniciales, SKU/EAN duplicados (en el archivo y contra la base), colores/talles inexistentes,
  números en formato argentino, etc. Cada fila queda `ok`, `warning` o `error`.
- La aplicación (`apply_import_batch`) **re-valida con los datos vigentes** y escribe todo en una sola
  transacción. El stock importado es el stock final: se registra un movimiento solo por la diferencia.
- SKU y EAN se exportan e importan como **texto** (formato `@`) para conservar ceros iniciales.

## Consecuencias

- Nada se escribe hasta confirmar, y no quedan importaciones a medias.
- Una importación nunca pisa el stock: deja `import_adjustment` / `initial_load` trazables al lote.
