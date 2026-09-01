# Instrucciones: Configurar Facturapi en Apps Script

## Paso 1 — Abrir tu proyecto de Apps Script

1. Abre tu Google Sheet de facturación
2. Menú **Extensiones → Apps Script**
3. Se abre el editor de Apps Script

## Paso 2 — Agregar el archivo facturapi.gs

1. En el editor, haz clic en **+** (al lado de "Archivos") → **Script**
2. Nombra el archivo `facturapi` (se guardará como `facturapi.gs`)
3. Borra el contenido por defecto
4. Copia y pega **todo** el contenido del archivo `facturapi.gs` de esta carpeta
5. Guarda con Ctrl+S

## Paso 3 — Agregar el handler en doPost

1. Abre tu archivo principal donde tienes la función `doPost(e)`
2. Busca la sección donde manejas las acciones (donde están `batchAppend`, `updateStatus`, etc.)
3. **Antes** del último `else` o al final de la cadena de `if`, agrega el bloque que está en `doPost-patch.gs`:

```javascript
if (action === 'timbrarFactura') {
  try {
    var result = timbrarFactura_(body);
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      invoiceId: result.invoiceId,
      uuid: result.uuid,
      folioNumber: result.folioNumber,
      pdfBase64: result.pdfBase64,
      xmlBase64: result.xmlBase64,
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.message || 'Error al timbrar factura',
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

4. Guarda con Ctrl+S

## Paso 4 — Guardar la API Key de Facturapi

1. En el editor de Apps Script, ve al icono de **engrane** (⚙️) en la barra lateral → **Configuración del proyecto**
2. Baja hasta **Propiedades del script**
3. Clic en **Agregar propiedad del script**
4. Propiedad: `FACTURAPI_KEY`
5. Valor: `sk_test_PYFjT2GNae9sjX7qUNQqiUqib5eVgxpzg5r8n4TbJc` (tu key de prueba)
6. Clic en **Guardar propiedades del script**

> Cuando actives tu suscripción en Facturapi, reemplaza esta key por la key **live** (`sk_live_...`).

## Paso 5 — Redesplegar

1. En el editor, clic en **Implementar → Administrar implementaciones**
2. Clic en el **lápiz** (editar) de tu implementación activa
3. En "Versión", selecciona **Nueva versión**
4. Clic en **Implementar**
5. Si te pide autorizar permisos nuevos (acceso a URLs externas), acepta

## Paso 6 — Probar

1. Abre la app en tu teléfono
2. Genera un link para llevar como normalmente
3. Llena los datos fiscales con datos de prueba:
   - RFC: `XAXX010101000` (RFC genérico para pruebas)
   - Razón Social: `Público en General`
   - Régimen: `616 - Sin obligaciones fiscales`
   - Uso CFDI: `S01 - Sin efectos fiscales`
   - Email: tu email real (para recibir la factura de prueba)
   - C.P.: `06600`
4. Envía la solicitud
5. Deberías ver los botones de **Descargar PDF** y **Descargar XML**
6. También recibirás la factura por email

> Las facturas en modo test tienen marca de agua "FACTURA DE PRUEBA" — es normal.

## Notas importantes

- La API key NUNCA se expone al frontend. Vive solo en Script Properties.
- Si el timbrado falla, la solicitud se guarda igual en tu Sheet y el despacho puede procesarla manualmente.
- Facturapi cobra $0.60 MXN por timbre en modo live.
- Para pasar a producción: activa tu suscripción en facturapi.io, obtén tu key live (`sk_live_...`), y reemplázala en Script Properties.
