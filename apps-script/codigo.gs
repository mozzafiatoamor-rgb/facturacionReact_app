// ============================================================
// MOZZAFIATO FACTURAS — Apps Script v1.1
// Acciones: batchAppend, append, delete, updateStatus,
//           updateCliente, sendConfirmation, timbrarFactura
// ============================================================

var SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

// ── Logos por negocio — URLs públicas de Google Drive
var LOGOS = {
  mozzafiato: 'https://drive.google.com/uc?export=view&id=1sbXUzASbsXGZKHY3A_tzhlSxsNpACk3W',
  casaregina: 'https://drive.google.com/uc?export=view&id=1b-xYhNkhjhYqF8GsRqX4Yu7VC8FN4LNR',
};
// Helper para obtener logo por negocio (fallback a Mozzafiato)
function getLogoUrl_(negocio) {
  return LOGOS[negocio] || LOGOS.mozzafiato || '';
}
// Legacy — mantener compatibilidad con funciones que usan LOGO_URL
var LOGO_URL = LOGOS.mozzafiato;

// ── CORS helper
function setCorsHeaders(output) {
  return output; // Web Apps añaden CORS automáticamente con "Anyone" access
}

// ── doGet — health check + resolución de links cortos
function doGet(e) {
  // Si viene ?link=CODIGO, resolver el link corto (público, sin auth)
  var linkCode = e && e.parameter && e.parameter.link;
  if (linkCode) {
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName('🔗 Links');
      if (!sheet) throw new Error('No hay links');
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) throw new Error('Link no encontrado');
      var rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
      var found = null;
      for (var i = 0; i < rows.length; i++) {
        if (rows[i][0] === linkCode) { found = rows[i][1]; break; }
      }
      if (!found) throw new Error('Link no encontrado');
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, payload: JSON.parse(found) }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', version: '1.2-facturas', ts: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── doPost — entry point
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var result;

    // ── batchAppend: escribe múltiples filas en múltiples hojas en una sola llamada
    if (data.action === 'batchAppend') {
      var items = data.items || [];
      var totalRows = 0;
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var sheet = ss.getSheetByName(item.sheet);
        if (!sheet) continue;
        var rows = item.rows || [];
        if (rows.length === 0) continue;
        var lastRow = sheet.getLastRow();
        var numCols = rows[0].length;
        var normalized = rows.map(function(row) {
          var r = row.slice();
          while (r.length < numCols) r.push('');
          return r;
        });
        sheet.getRange(lastRow + 1, 1, normalized.length, numCols).setValues(normalized);
        totalRows += normalized.length;
      }
      result = { success: true, rowsAdded: totalRows };

    // ── append: escribe una sola fila en una hoja
    } else if (data.action === 'append') {
      var sheet = ss.getSheetByName(data.sheet);
      if (!sheet) throw new Error('Hoja no encontrada: ' + data.sheet);
      var values = data.values || [];
      sheet.appendRow(values);
      result = { success: true };

    // ── delete: elimina una fila por número de fila
    } else if (data.action === 'delete') {
      var sheet = ss.getSheetByName(data.sheet);
      if (!sheet) throw new Error('Hoja no encontrada: ' + data.sheet);
      sheet.deleteRow(parseInt(data.row));
      result = { success: true };

    // ── cleanupFailed: elimina solicitud fallida por ID + cliente nuevo por RFC
    } else if (data.action === 'cleanupFailed') {
      var solSheet = ss.getSheetByName('🧾 Solicitudes');
      var cliSheet = ss.getSheetByName('👥 Clientes');
      var deleted = { solicitud: false, cliente: false };
      // Eliminar solicitud por ID
      if (solSheet && data.solId) {
        var lastRow = solSheet.getLastRow();
        if (lastRow >= 2) {
          var ids = solSheet.getRange(2, 1, lastRow - 1, 1).getValues();
          for (var i = ids.length - 1; i >= 0; i--) {
            if (ids[i][0] === data.solId) {
              solSheet.deleteRow(i + 2);
              deleted.solicitud = true;
              break;
            }
          }
        }
      }
      // Eliminar cliente por RFC (solo si fue nuevo)
      if (cliSheet && data.rfc && data.isNewCliente) {
        var lastRow = cliSheet.getLastRow();
        if (lastRow >= 2) {
          var rfcs = cliSheet.getRange(2, 2, lastRow - 1, 1).getValues();
          for (var i = rfcs.length - 1; i >= 0; i--) {
            if (rfcs[i][0] === data.rfc) {
              cliSheet.deleteRow(i + 2);
              deleted.cliente = true;
              break;
            }
          }
        }
      }
      result = { success: true, deleted: deleted };

    // ── updateStatus: actualiza el status y notas de una solicitud por ID
    } else if (data.action === 'updateStatus') {
      var sheet = ss.getSheetByName('🧾 Solicitudes');
      if (!sheet) throw new Error('Hoja 🧾 Solicitudes no encontrada');
      var solId = data.solId;
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) { result = { success: true, found: false }; }
      else {
        var rows = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
        var found = false;
        for (var i = 0; i < rows.length; i++) {
          if (rows[i][0] === solId) {
            var rowNum = i + 2;
            sheet.getRange(rowNum, 12).setValue(data.status);       // Columna L = Status
            if (data.notas) sheet.getRange(rowNum, 14).setValue(data.notas); // Columna N = Notas
            // Email de factura ya se envía desde timbrarFactura_ con PDF/XML adjuntos
            found = true;
            break;
          }
        }
        result = { success: true, found: found };
      }

    // ── updateCliente: actualiza datos de un cliente existente por RFC
    } else if (data.action === 'updateCliente') {
      var sheet = ss.getSheetByName('👥 Clientes');
      if (!sheet) throw new Error('Hoja 👥 Clientes no encontrada');
      var rfc = data.rfc;
      var clienteData = data.data || {};
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) { result = { success: true, found: false }; }
      else {
        var rfcs = sheet.getRange(2, 2, lastRow - 1, 1).getValues(); // Columna B = RFC
        var found = false;
        for (var i = 0; i < rfcs.length; i++) {
          if (rfcs[i][0] === rfc) {
            var rowNum = i + 2;
            // Columnas: A=ID, B=RFC, C=RazonSocial, D=Regimen, E=UsoCFDI, F=Email, G=UltimaSol
            if (clienteData.razonSocial !== undefined) sheet.getRange(rowNum, 3).setValue(clienteData.razonSocial);
            if (clienteData.regimen !== undefined)     sheet.getRange(rowNum, 4).setValue(clienteData.regimen);
            if (clienteData.usoCfdi !== undefined)     sheet.getRange(rowNum, 5).setValue(clienteData.usoCfdi);
            if (clienteData.email !== undefined)       sheet.getRange(rowNum, 6).setValue(clienteData.email);
            if (clienteData.ultimaSol !== undefined)   sheet.getRange(rowNum, 7).setValue(clienteData.ultimaSol);
            if (clienteData.telefono !== undefined)    sheet.getRange(rowNum, 8).setValue(clienteData.telefono); // Columna H
            if (clienteData.codigoPostal !== undefined) sheet.getRange(rowNum, 9).setValue(clienteData.codigoPostal); // Columna I
            found = true;
            break;
          }
        }
        result = { success: true, found: found };
      }

    // ── sendConfirmation: envía email de confirmación al cliente
    } else if (data.action === 'sendConfirmation') {
      var solId = data.solId;
      var sheet = ss.getSheetByName('🧾 Solicitudes');
      if (!sheet) throw new Error('Hoja 🧾 Solicitudes no encontrada');
      var lastRow = sheet.getLastRow();
      var sent = false;
      if (lastRow >= 2) {
        var rows = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
        for (var i = 0; i < rows.length; i++) {
          if (rows[i][0] === solId) {
            var sol = {
              id:          rows[i][0],
              fecha:       rows[i][1],
              hora:        rows[i][2],
              mesa:        rows[i][3],
              monto:       rows[i][4],
              tipoPago:    rows[i][5],
              rfc:         rows[i][6],
              razonSocial: rows[i][7],
              regimen:     rows[i][8],
              usoCfdi:     rows[i][9],
              email:       rows[i][10],
              status:      rows[i][11],
              mesero:      rows[i][12]
            };
            if (sol.email) {
              enviarEmailConfirmacion(sol);
              sent = true;
            }
            break;
          }
        }
      }
      result = { success: true, sent: sent };

    // ── listInvoices: lista facturas de Facturapi con filtros de fecha
    } else if (data.action === 'listInvoices') {
      var invoices = listInvoices_({ dateFrom: data.dateFrom, dateTo: data.dateTo });
      result = { success: true, invoices: invoices };

    // ── timbrarFactura: timbra CFDI vía Facturapi
    } else if (data.action === 'timbrarFactura') {
      var timbradoResult = timbrarFactura_(data);
      result = {
        success: true,
        invoiceId: timbradoResult.invoiceId,
        uuid: timbradoResult.uuid,
        folioNumber: timbradoResult.folioNumber,
        pdfBase64: timbradoResult.pdfBase64,
        xmlBase64: timbradoResult.xmlBase64,
      };

    // ── sendPreFactura: envía email de pre-factura (sin timbrar) para revisión
    } else if (data.action === 'sendPreFactura') {
      sendPreFactura_(data);
      result = { success: true, sent: true };

    // ── createLink: guarda payload de link corto y retorna código
    } else if (data.action === 'createLink') {
      var sheet = ss.getSheetByName('🔗 Links');
      if (!sheet) {
        sheet = ss.insertSheet('🔗 Links');
        sheet.appendRow(['Código', 'Payload', 'Creado', 'Expira']);
      }
      // Generar código corto único (6 chars alfanuméricos)
      var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
      var code = '';
      for (var i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
      // Incluir config del servidor para que el cliente pueda operar
      var p = data.payload || {};
      p.sid = SPREADSHEET_ID;
      p.akey = PropertiesService.getScriptProperties().getProperty('SHEETS_API_KEY') || '';
      var payload = JSON.stringify(p);
      var now = new Date().toISOString();
      var expira = p.e ? new Date(p.e).toISOString() : '';
      sheet.appendRow([code, payload, now, expira]);
      result = { success: true, code: code };

    // ── getLink: lee payload de link corto por código
    } else if (data.action === 'getLink') {
      var sheet = ss.getSheetByName('🔗 Links');
      if (!sheet) throw new Error('No hay links guardados');
      var code = data.code;
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) throw new Error('Link no encontrado');
      var rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
      var found = null;
      for (var i = 0; i < rows.length; i++) {
        if (rows[i][0] === code) { found = rows[i][1]; break; }
      }
      if (!found) throw new Error('Link no encontrado: ' + code);
      result = { success: true, payload: JSON.parse(found) };

    } else {
      throw new Error('Acción desconocida: ' + data.action);
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Email de confirmación al cliente (legacy — ya no se usa activamente)
function enviarEmailConfirmacion(sol) {
  var negocio = sol.negocio || 'mozzafiato';
  var negocioName = negocio === 'casaregina' ? 'Casa Regina' : 'Mozzafiato';
  var logoUrl = getLogoUrl_(negocio);
  var headerBg = negocio === 'casaregina' ? '#0C1F2B' : '#1a120e';
  var headerText = negocio === 'casaregina' ? '#EDE8DA' : '#f5ede8';
  var accentColor = negocio === 'casaregina' ? '#C9A84C' : '#9a8680';
  var montoFmt = '$' + Number(sol.monto).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var subject = 'Solicitud de Factura — ' + negocioName + ' · ' + sol.id;
  var headerImg = logoUrl
    ? '<img src="' + logoUrl + '" alt="' + negocioName + '" style="max-height:100px;max-width:280px;width:auto;height:auto;object-fit:contain;display:block;margin:0 auto 10px;">'
    : '<div style="font-size:36px;margin-bottom:8px;">🧾</div>';
  var htmlBody = [
    '<div style="font-family:sans-serif;max-width:500px;margin:0 auto;background:#f9f9f9;border-radius:12px;overflow:hidden;">',
    '  <div style="background:' + headerBg + ';padding:24px;text-align:center;">',
    '    ' + headerImg,
    '    <div style="color:' + accentColor + ';font-size:13px;margin-top:8px;">Solicitud de Factura Recibida</div>',
    '  </div>',
    '  <div style="padding:24px;">',
    '    <p style="color:#333;font-size:15px;">Hola <strong>' + sol.razonSocial + '</strong>,</p>',
    '    <p style="color:#555;font-size:14px;">Hemos recibido tu solicitud de factura con los siguientes datos:</p>',
    '    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">',
    '      <tr style="background:#f0f0f0;"><td style="padding:8px 12px;font-weight:600;color:#555;width:40%;">Folio</td><td style="padding:8px 12px;color:#333;">' + sol.id + '</td></tr>',
    '      <tr><td style="padding:8px 12px;font-weight:600;color:#555;">Fecha</td><td style="padding:8px 12px;color:#333;">' + sol.fecha + ' ' + sol.hora + '</td></tr>',
    '      <tr style="background:#f0f0f0;"><td style="padding:8px 12px;font-weight:600;color:#555;">Mesa</td><td style="padding:8px 12px;color:#333;">' + sol.mesa + '</td></tr>',
    '      <tr><td style="padding:8px 12px;font-weight:600;color:#555;">Monto</td><td style="padding:8px 12px;color:#1a120e;font-weight:700;font-size:16px;">' + montoFmt + '</td></tr>',
    '      <tr style="background:#f0f0f0;"><td style="padding:8px 12px;font-weight:600;color:#555;">Tipo de Pago</td><td style="padding:8px 12px;color:#333;">' + (sol.tipoPago || '—') + '</td></tr>',
    '      <tr><td style="padding:8px 12px;font-weight:600;color:#555;">RFC</td><td style="padding:8px 12px;color:#333;font-family:monospace;">' + sol.rfc + '</td></tr>',
    '      <tr style="background:#f0f0f0;"><td style="padding:8px 12px;font-weight:600;color:#555;">Razón Social</td><td style="padding:8px 12px;color:#333;">' + sol.razonSocial + '</td></tr>',
    '      <tr><td style="padding:8px 12px;font-weight:600;color:#555;">Régimen Fiscal</td><td style="padding:8px 12px;color:#333;">' + sol.regimen + '</td></tr>',
    '      <tr style="background:#f0f0f0;"><td style="padding:8px 12px;font-weight:600;color:#555;">Uso de CFDI</td><td style="padding:8px 12px;color:#333;">' + sol.usoCfdi + '</td></tr>',
    '    </table>',
    '    <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:12px;margin:16px 0;font-size:13px;color:#856404;">',
    '      ⏳ Tu solicitud está siendo procesada. Recibirás la factura en un plazo máximo de <strong>72 horas hábiles</strong>.',
    '    </div>',
    '    <p style="color:#555;font-size:13px;">Si tienes alguna duda, contacta a nuestro equipo de administración.</p>',
    '  </div>',
    '  <div style="background:' + headerBg + ';padding:16px;text-align:center;">',
    '    <div style="color:' + accentColor + ';font-size:12px;">' + negocioName + ' · Solicitud ' + sol.id + ' · ' + sol.fecha + '</div>',
    '  </div>',
    '</div>'
  ].join('\n');

  MailApp.sendEmail({
    to: sol.email,
    subject: subject,
    htmlBody: htmlBody,
    name: negocioName + ' Facturas'
  });
}

// ── Email de aviso cuando la factura ha sido generada y enviada (legacy)
function enviarEmailFacturaEnviada(sol) {
  var negocio = sol.negocio || 'mozzafiato';
  var negocioName = negocio === 'casaregina' ? 'Casa Regina' : 'Mozzafiato';
  var logoUrl = getLogoUrl_(negocio);
  var headerBg = negocio === 'casaregina' ? '#0C1F2B' : '#1a120e';
  var headerText = negocio === 'casaregina' ? '#EDE8DA' : '#f5ede8';
  var accentColor = negocio === 'casaregina' ? '#C9A84C' : '#9a8680';
  var montoFmt = '$' + Number(sol.monto).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var subject = 'Tu factura está lista — ' + negocioName + ' · ' + sol.id;
  var headerImg = logoUrl
    ? '<img src="' + logoUrl + '" alt="' + negocioName + '" style="max-height:100px;max-width:280px;width:auto;height:auto;object-fit:contain;display:block;margin:0 auto 10px;">'
    : '<div style="font-size:36px;margin-bottom:8px;">✅</div>';
  var htmlBody = [
    '<div style="font-family:sans-serif;max-width:500px;margin:0 auto;background:#f9f9f9;border-radius:12px;overflow:hidden;">',
    '  <div style="background:' + headerBg + ';padding:24px;text-align:center;">',
    '    ' + headerImg,
    '    <div style="color:' + accentColor + ';font-size:13px;margin-top:8px;">Tu Factura Ha Sido Generada</div>',
    '  </div>',
    '  <div style="padding:24px;">',
    '    <p style="color:#333;font-size:15px;">Hola <strong>' + sol.razonSocial + '</strong>,</p>',
    '    <p style="color:#555;font-size:14px;">Tu factura ha sido generada y enviada a tu correo registrado. Aquí el resumen de tu solicitud:</p>',
    '    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">',
    '      <tr style="background:#f0f0f0;"><td style="padding:8px 12px;font-weight:600;color:#555;width:40%;">Folio</td><td style="padding:8px 12px;color:#333;">' + sol.id + '</td></tr>',
    '      <tr><td style="padding:8px 12px;font-weight:600;color:#555;">Fecha</td><td style="padding:8px 12px;color:#333;">' + sol.fecha + ' ' + sol.hora + '</td></tr>',
    '      <tr style="background:#f0f0f0;"><td style="padding:8px 12px;font-weight:600;color:#555;">Mesa</td><td style="padding:8px 12px;color:#333;">' + sol.mesa + '</td></tr>',
    '      <tr><td style="padding:8px 12px;font-weight:600;color:#555;">Monto</td><td style="padding:8px 12px;color:#1a120e;font-weight:700;font-size:16px;">' + montoFmt + '</td></tr>',
    '      <tr style="background:#f0f0f0;"><td style="padding:8px 12px;font-weight:600;color:#555;">RFC</td><td style="padding:8px 12px;color:#333;font-family:monospace;">' + sol.rfc + '</td></tr>',
    '      <tr><td style="padding:8px 12px;font-weight:600;color:#555;">Razón Social</td><td style="padding:8px 12px;color:#333;">' + sol.razonSocial + '</td></tr>',
    '    </table>',
    '    <div style="background:#d4edda;border:1px solid #28a745;border-radius:8px;padding:12px;margin:16px 0;font-size:14px;color:#155724;text-align:center;">',
    '      ✅ <strong>Factura generada y enviada exitosamente.</strong><br>',
    '      <span style="font-size:13px;">Revisa tu bandeja de entrada y carpeta de spam.</span>',
    '    </div>',
    '    <p style="color:#555;font-size:13px;">Si no recibes tu factura o tienes alguna duda, comunícate con nuestro equipo de administración indicando tu folio <strong>' + sol.id + '</strong>.</p>',
    '  </div>',
    '  <div style="background:' + headerBg + ';padding:16px;text-align:center;">',
    '    <div style="color:' + accentColor + ';font-size:12px;">' + negocioName + ' · Folio ' + sol.id + ' · ' + sol.fecha + '</div>',
    '  </div>',
    '</div>'
  ].join('\n');

  MailApp.sendEmail({
    to: sol.email,
    subject: subject,
    htmlBody: htmlBody,
    name: negocioName + ' Facturas'
  });
}

// ============================================================
// INSTRUCCIONES DE DEPLOYMENT
// ============================================================
// 1. Abre tu Google Sheet de Facturas
// 2. Extensiones → Apps Script
// 3. Pega este código (reemplaza todo)
// 4. Guardar → Implementar → Nueva implementación
// 5. Tipo: Aplicación web
//    Ejecutar como: Yo (tu cuenta)
//    Acceso: Cualquier persona
// 6. Copia la URL y pégala en la app bajo "URL del Apps Script"
//
// ESTRUCTURA DE HOJAS REQUERIDA:
// 👥 Clientes:   A=ID  B=RFC  C=RazonSocial  D=Regimen  E=UsoCFDI  F=Email  G=UltimaSol  H=Telefono  I=CodigoPostal
// 🧾 Solicitudes: A=ID  B=Fecha  C=Hora  D=Mesa  E=Monto  F=TipoPago
//                G=RFC  H=RazonSocial  I=Regimen  J=UsoCFDI  K=Email
//                L=Status  M=Mesero  N=Notas  O=CodigoPostal
// 👤 Usuarios:   A=ID  B=Nombre  C=PIN  D=Rol  E=Activo
// 📜 Bitácora:   A=Fecha  B=Hora  C=Usuario  D=Accion  E=Detalle  F=Tipo
// ============================================================
