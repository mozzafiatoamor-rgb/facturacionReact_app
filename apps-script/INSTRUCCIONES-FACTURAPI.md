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

## Paso 3 — Agregar los handlers en doPost

1. Abre tu archivo principal donde tienes la función `doPost(e)`
2. Busca la sección donde manejas las acciones (donde están `batchAppend`, `updateStatus`, etc.)
3. **Antes** del último `else` o al final de la cadena de `if`, agrega estos bloques:

```javascript
// Timbrar factura con Facturapi
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

// Enviar pre-factura por email (sin timbrar)
if (action === 'sendPreFactura') {
  try {
    sendPreFactura_(body);
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.message || 'Error al enviar pre-factura',
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
5. Valor: tu API key de Facturapi (test o live)
6. Clic en **Guardar propiedades del script**

> Cuando actives tu suscripción en Facturapi, reemplaza la key test (`sk_test_...`) por la key **live** (`sk_live_...`).

## Paso 5 — Autorizar permisos

La primera vez, Apps Script necesita permiso para hacer llamadas HTTP externas (UrlFetchApp):

1. En el editor, crea una función temporal de prueba:
```javascript
function testPermisos() {
  var r = UrlFetchApp.fetch('https://httpbin.org/get');
  Logger.log(r.getContentText());
}
```
2. Selecciona `testPermisos` en el selector de funciones y dale clic a **Ejecutar**
3. Acepta los permisos cuando te lo pida
4. Ya puedes borrar la función de prueba

## Paso 6 — Redesplegar

1. En el editor, clic en **Implementar → Administrar implementaciones**
2. Clic en el **lápiz** (editar) de tu implementación activa
3. En "Versión", selecciona **Nueva versión**
4. Clic en **Implementar**

## Cómo funciona

1. El cliente abre el link, llena sus datos fiscales y genera su factura
2. La app timbra automáticamente con Facturapi (CFDI 4.0)
3. El cliente puede descargar PDF y XML al instante
4. Facturapi envía la factura por email al cliente automáticamente
5. La solicitud queda registrada en tu Sheet como "Procesada"

Si el timbrado falla por alguna razón, la solicitud se guarda como "Pendiente" y el despacho puede procesarla manualmente desde la pantalla de despacho.

## Pantalla de Despacho

Desde la pantalla de despacho (`?despacho=`), el equipo contable puede:

- **Timbrar** manualmente solicitudes pendientes
- **Enviar pre-factura** al cliente para que revise los datos antes de timbrar
- Ver el estatus de todas las solicitudes

## Cambiar nombre de la organización en Facturapi

Si necesitas corregir el nombre de tu empresa (por ejemplo, si pusiste el RFC en vez del nombre):

1. Entra a [dashboard.facturapi.io](https://dashboard.facturapi.io)
2. Ve a **Configuración** o **Mi Organización**
3. Edita el **Nombre Legal** con el nombre correcto de tu empresa
4. Guarda los cambios

> En modo **test**, también puedes actualizarlo por API:
> ```
> PUT https://www.facturapi.io/v2/organizations/{ORG_ID}
> Body: { "legal_name": "Nombre Correcto de la Empresa" }
> ```

## Notas importantes

- La API key NUNCA se expone al frontend. Vive solo en Script Properties.
- Facturapi cobra ~$0.60 MXN por timbre en modo live.
- Las facturas en modo test tienen marca de agua "FACTURA DE PRUEBA" — es normal.
- Para pasar a producción: activa tu suscripción en facturapi.io, obtén tu key live, y reemplázala en Script Properties.
