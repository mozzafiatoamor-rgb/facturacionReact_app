// ============================================================
// AGREGA ESTO A TU doPost EXISTENTE
// Dentro del if/else o switch que maneja las acciones,
// agrega este case:
// ============================================================

// En tu función doPost(e), donde tienes algo como:
//   var body = JSON.parse(e.postData.contents);
//   var action = body.action;
//
// Agrega este bloque junto a los demás (batchAppend, updateStatus, etc.):

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
