// ============================================================
// FACTURAPI.GS — Integración con Facturapi para timbrado CFDI
// Pega este código en tu proyecto de Google Apps Script
// ============================================================
//
// SETUP: Ve a Configuración del proyecto > Propiedades del script
// y agrega estas propiedades:
//   FACTURAPI_KEY = sk_test_xxxxx (tu API key de Facturapi)
//
// ============================================================

var FACTURAPI_BASE = 'https://www.facturapi.io/v2';

/**
 * Obtiene la API key de las propiedades del script.
 */
function getFacturapiKey_() {
  var key = PropertiesService.getScriptProperties().getProperty('FACTURAPI_KEY');
  if (!key) throw new Error('FACTURAPI_KEY no configurada en Script Properties');
  return key;
}

/**
 * Headers comunes para Facturapi.
 */
function facturApiHeaders_() {
  return {
    'Authorization': 'Bearer ' + getFacturapiKey_(),
    'Content-Type': 'application/json',
  };
}

/**
 * Mapea el tipo de pago de la app al código SAT.
 */
function mapPaymentForm_(tipoPago) {
  var map = {
    'Efectivo': '01',
    'Tarjeta Débito': '28',
    'Tarjeta Crédito': '04',
    'Transferencia': '03',
  };
  return map[tipoPago] || '99'; // 99 = Por definir
}

/**
 * Mapea el negocio al product_key del SAT.
 */
function mapProductKey_(negocio) {
  if (negocio === 'casaregina') {
    return '90111501'; // Servicios de hotelería
  }
  return '90101500'; // Servicios de restaurante y catering
}

/**
 * Mapea el negocio a la descripción del concepto.
 */
function mapProductDescription_(negocio) {
  if (negocio === 'casaregina') {
    return 'Servicio de hospedaje';
  }
  return 'Consumo de alimentos y bebidas';
}

/**
 * Crea o encuentra un cliente en Facturapi.
 * Si ya existe un cliente con ese RFC, Facturapi regresa el existente (200).
 * Si es nuevo, regresa 201.
 */
function findOrCreateCustomer_(data) {
  var payload = {
    legal_name: data.razonSocial,
    tax_id: data.rfc,
    tax_system: data.regimen.split(' - ')[0].trim(), // solo el código: "626"
    email: data.email,
    address: {
      zip: data.codigoPostal || '00000',
    },
  };

  if (data.telefono) {
    payload.phone = data.telefono;
  }

  var response = UrlFetchApp.fetch(FACTURAPI_BASE + '/customers', {
    method: 'post',
    headers: facturApiHeaders_(),
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  var code = response.getResponseCode();
  var body = JSON.parse(response.getContentText());

  if (code === 200 || code === 201) {
    return body.id;
  }

  throw new Error('Error creando cliente en Facturapi: ' + (body.message || JSON.stringify(body)));
}

/**
 * Crea y timbra una factura CFDI en Facturapi.
 */
function isPersonaMoral_(rfc) {
  // Persona moral: 12 caracteres. Persona física: 13 caracteres.
  return rfc && rfc.replace(/\s/g, '').length === 12;
}

function createInvoice_(customerId, data) {
  var monto = parseFloat(data.monto);
  var negocio = data.negocio || 'mozzafiato';
  var usoCfdi = data.usoCfdi.split(' - ')[0].trim(); // solo el código: "G03"
  var esHotel = (negocio === 'casaregina');
  var esMoral = isPersonaMoral_(data.rfc);

  // Impuestos federales
  var taxes = [{ type: 'IVA', rate: 0.16 }];

  // Retención ISR 1.25% solo para persona moral en hospedaje
  if (esHotel && esMoral) {
    taxes.push({ type: 'ISR', rate: 0.0125, factor: 'Tasa', withholding: true });
  }

  // Impuestos locales (ISH 5% Quintana Roo — solo hospedaje)
  var localTaxes = [];
  if (esHotel) {
    localTaxes.push({ type: 'ISH', rate: 0.05, withholding: false });
  }

  // ── Calcular precio base sin impuestos (evita redondeo de 1 centavo) ──
  // Facturapi trunca el Importe con tax_included:true, causando diferencias.
  // Usamos tax_included:false con precio de 2 decimales para evitarlo.
  var divisor = 1;
  for (var i = 0; i < taxes.length; i++) {
    divisor += taxes[i].withholding ? -taxes[i].rate : taxes[i].rate;
  }
  for (var i = 0; i < localTaxes.length; i++) {
    divisor += localTaxes[i].withholding ? -localTaxes[i].rate : localTaxes[i].rate;
  }
  var precioBase = Math.round(monto / divisor * 100) / 100;

  // Verificar que el total recalculado sea >= monto (preferible 1¢ arriba que abajo)
  var totalCheck = precioBase;
  for (var i = 0; i < taxes.length; i++) {
    var imp = Math.round(precioBase * taxes[i].rate * 100) / 100;
    totalCheck += taxes[i].withholding ? -imp : imp;
  }
  for (var i = 0; i < localTaxes.length; i++) {
    var imp = Math.round(precioBase * localTaxes[i].rate * 100) / 100;
    totalCheck += localTaxes[i].withholding ? -imp : imp;
  }
  totalCheck = Math.round(totalCheck * 100) / 100;
  if (totalCheck < monto) {
    precioBase = Math.round((precioBase + 0.01) * 100) / 100;
  }

  var descripcion = mapProductDescription_(negocio);
  if (data.comentarios) {
    descripcion += ' — ' + data.comentarios;
  }

  var item = {
    quantity: 1,
    product: {
      description: descripcion,
      product_key: mapProductKey_(negocio),
      price: precioBase,
      tax_included: false,
      taxes: taxes,
    },
  };

  if (localTaxes.length > 0) {
    item.product.local_taxes = localTaxes;
  }

  var payload = {
    type: 'I', // Ingreso
    customer: customerId,
    payment_form: mapPaymentForm_(data.tipoPago),
    payment_method: 'PUE', // Pago en una sola exhibición
    use: usoCfdi,
    items: [item],
  };

  // Si hay folio/serie, agregarlo
  if (data.folioPrefix) {
    payload.series = data.folioPrefix;
  }


  var response = UrlFetchApp.fetch(FACTURAPI_BASE + '/invoices', {
    method: 'post',
    headers: facturApiHeaders_(),
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  var code = response.getResponseCode();
  var body = JSON.parse(response.getContentText());

  if (code === 200 || code === 201) {
    return body;
  }

  throw new Error('Error creando factura en Facturapi: ' + (body.message || JSON.stringify(body)));
}

/**
 * Descarga un archivo de Facturapi (PDF o XML) y lo regresa en base64.
 */
function downloadInvoiceFile_(invoiceId, format) {
  var response = UrlFetchApp.fetch(
    FACTURAPI_BASE + '/invoices/' + invoiceId + '/' + format,
    {
      method: 'get',
      headers: { 'Authorization': 'Bearer ' + getFacturapiKey_() },
      muteHttpExceptions: true,
    }
  );

  if (response.getResponseCode() !== 200) {
    throw new Error('Error descargando ' + format + ': ' + response.getContentText());
  }

  return Utilities.base64Encode(response.getContent());
}

/**
 * Envía la factura por correo electrónico al cliente con PDF/XML adjuntos.
 * CC a mozzafiatoamor@gmail.com para control interno.
 */
function sendInvoiceEmailCustom_(invoiceId, data, pdfBase64, xmlBase64) {
  try {
    var negocioName = data.negocio === 'casaregina' ? 'Casa Regina' : 'Mozzafiato';
    var montoFmt = '$' + Number(data.monto).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    var headerBg = data.negocio === 'casaregina' ? '#0C1F2B' : '#1a120e';
    var accentColor = data.negocio === 'casaregina' ? '#C9A84C' : '#C45C2C';
    var headerText = data.negocio === 'casaregina' ? '#EDE8DA' : '#f5ede8';

    var htmlBody = [
      '<div style="font-family:sans-serif;max-width:500px;margin:0 auto;background:#f9f9f9;border-radius:12px;overflow:hidden;">',
      '  <div style="background:' + headerBg + ';padding:24px;text-align:center;">',
      getLogoUrl_(data.negocio) ? '    <img src="' + getLogoUrl_(data.negocio) + '" alt="' + negocioName + '" style="max-height:100px;max-width:280px;width:auto;height:auto;object-fit:contain;display:block;margin:0 auto;">' : '',
      '    <div style="color:' + accentColor + ';font-size:13px;margin-top:8px;">Factura Electrónica</div>',
      '  </div>',
      '  <div style="padding:24px;">',
      '    <p style="color:#333;font-size:15px;">Hola <strong>' + data.razonSocial + '</strong>,</p>',
      '    <p style="color:#555;font-size:14px;">Tu factura ha sido generada exitosamente. Encontrarás los archivos PDF y XML adjuntos a este correo.</p>',
      '    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">',
      '      <tr style="background:#f0f0f0;"><td style="padding:8px 12px;font-weight:600;color:#555;width:40%;">RFC</td><td style="padding:8px 12px;color:#333;font-family:monospace;">' + data.rfc + '</td></tr>',
      '      <tr><td style="padding:8px 12px;font-weight:600;color:#555;">Razón Social</td><td style="padding:8px 12px;color:#333;">' + data.razonSocial + '</td></tr>',
      '      <tr style="background:#f0f0f0;"><td style="padding:8px 12px;font-weight:600;color:#555;">Monto</td><td style="padding:8px 12px;color:#1a120e;font-weight:700;font-size:16px;">' + montoFmt + '</td></tr>',
      '    </table>',
      '    <div style="background:#d4edda;border:1px solid #28a745;border-radius:8px;padding:12px;margin:16px 0;font-size:14px;color:#155724;text-align:center;">',
      '      ✅ <strong>Factura timbrada exitosamente</strong>',
      '    </div>',
      '    <p style="color:#888;font-size:12px;">Este es un correo automático. Si tienes dudas, contacta a ' + negocioName + '.</p>',
      '  </div>',
      '  <div style="background:' + headerBg + ';padding:16px;text-align:center;">',
      '    <div style="color:' + accentColor + ';font-size:12px;">' + negocioName + ' · Facturación Electrónica</div>',
      '  </div>',
      '</div>'
    ].join('\n');

    var pdfBlob = Utilities.newBlob(Utilities.base64Decode(pdfBase64), 'application/pdf', 'Factura_' + data.rfc + '.pdf');
    var xmlBlob = Utilities.newBlob(Utilities.base64Decode(xmlBase64), 'application/xml', 'Factura_' + data.rfc + '.xml');

    MailApp.sendEmail({
      to: data.email,
      cc: 'mozzafiatoamor@gmail.com',
      subject: 'Tu factura electrónica — ' + negocioName,
      htmlBody: htmlBody,
      attachments: [pdfBlob, xmlBlob],
      name: negocioName + ' Facturas',
    });
  } catch (e) {
    Logger.log('Error enviando email de factura: ' + e.message);
  }
}

/**
 * Función principal: timbra una factura completa.
 * Llamada desde el frontend con action: 'timbrarFactura'.
 *
 * Recibe: { rfc, razonSocial, regimen, usoCfdi, email, codigoPostal,
 *           telefono, monto, tipoPago, negocio, folioPrefix, mesa, mesero }
 * Regresa: { success, invoiceId, uuid, pdfBase64, xmlBase64 }
 */
function timbrarFactura_(data) {
  // 1. Crear/encontrar cliente
  var customerId = findOrCreateCustomer_(data);

  // 2. Crear y timbrar factura
  var invoice = createInvoice_(customerId, data);

  // 3. Descargar PDF y XML
  var pdfBase64 = downloadInvoiceFile_(invoice.id, 'pdf');
  var xmlBase64 = downloadInvoiceFile_(invoice.id, 'xml');

  // 4. Enviar por email con PDF/XML adjuntos + CC a mozzafiatoamor
  sendInvoiceEmailCustom_(invoice.id, data, pdfBase64, xmlBase64);

  return {
    invoiceId: invoice.id,
    uuid: invoice.uuid || '',
    folioNumber: invoice.folio_number || '',
    pdfBase64: pdfBase64,
    xmlBase64: xmlBase64,
  };
}

/**
 * Envía un email de pre-factura (sin timbrar) al cliente para que revise los datos.
 */
function sendPreFactura_(data) {
  var negocioName = data.negocioName || 'Mozzafiato';
  var montoNum = parseFloat(data.monto) || 0;
  var montoFmt = '$' + montoNum.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  var subject = 'Pre-factura para revisión — ' + negocioName + ' · ' + (data.solId || '');
  var logoUrl = getLogoUrl_(data.negocio);
  var headerImg = logoUrl
    ? '<img src="' + logoUrl + '" alt="' + negocioName + '" style="max-height:100px;max-width:280px;width:auto;height:auto;object-fit:contain;display:block;margin:0 auto 10px;">'
    : '<div style="font-size:36px;margin-bottom:8px;">📄</div>';

  var htmlBody = [
    '<div style="font-family:sans-serif;max-width:500px;margin:0 auto;background:#f9f9f9;border-radius:12px;overflow:hidden;">',
    '  <div style="background:#1a120e;padding:24px;text-align:center;">',
    '    ' + headerImg,
    '    <div style="color:#9a8680;font-size:13px;margin-top:8px;">Pre-Factura — Revisión de Datos</div>',
    '  </div>',
    '  <div style="padding:24px;">',
    '    <p style="color:#333;font-size:15px;">Hola <strong>' + (data.razonSocial || '') + '</strong>,</p>',
    '    <p style="color:#555;font-size:14px;">Antes de timbrar tu factura, te enviamos los datos para que los revises. Si todo está correcto, responde este correo confirmando. Si hay algún error, indícanos qué corregir.</p>',
    '    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">',
    '      <tr style="background:#f0f0f0;"><td style="padding:8px 12px;font-weight:600;color:#555;width:40%;">Folio</td><td style="padding:8px 12px;color:#333;">' + (data.solId || '—') + '</td></tr>',
    '      <tr><td style="padding:8px 12px;font-weight:600;color:#555;">Fecha</td><td style="padding:8px 12px;color:#333;">' + (data.fecha || '') + ' ' + (data.hora || '') + '</td></tr>',
    '      <tr style="background:#f0f0f0;"><td style="padding:8px 12px;font-weight:600;color:#555;">Monto</td><td style="padding:8px 12px;color:#1a120e;font-weight:700;font-size:16px;">' + montoFmt + '</td></tr>',
    '      <tr><td style="padding:8px 12px;font-weight:600;color:#555;">Tipo de Pago</td><td style="padding:8px 12px;color:#333;">' + (data.tipoPago || '—') + '</td></tr>',
    '      <tr style="background:#f0f0f0;"><td style="padding:8px 12px;font-weight:600;color:#555;">RFC</td><td style="padding:8px 12px;color:#333;font-family:monospace;">' + (data.rfc || '') + '</td></tr>',
    '      <tr><td style="padding:8px 12px;font-weight:600;color:#555;">Razón Social</td><td style="padding:8px 12px;color:#333;">' + (data.razonSocial || '') + '</td></tr>',
    '      <tr style="background:#f0f0f0;"><td style="padding:8px 12px;font-weight:600;color:#555;">Régimen Fiscal</td><td style="padding:8px 12px;color:#333;">' + (data.regimen || '') + '</td></tr>',
    '      <tr><td style="padding:8px 12px;font-weight:600;color:#555;">Uso de CFDI</td><td style="padding:8px 12px;color:#333;">' + (data.usoCfdi || '') + '</td></tr>',
    '      <tr style="background:#f0f0f0;"><td style="padding:8px 12px;font-weight:600;color:#555;">Código Postal</td><td style="padding:8px 12px;color:#333;">' + (data.codigoPostal || '—') + '</td></tr>',
    '    </table>',
    '    <div style="background:#e3f2fd;border:1px solid #42a5f5;border-radius:8px;padding:12px;margin:16px 0;font-size:13px;color:#1565c0;">',
    '      📄 <strong>Esta NO es una factura timbrada.</strong> Es una pre-factura para que revises que los datos estén correctos antes de generar el CFDI.',
    '    </div>',
    '    <p style="color:#555;font-size:13px;">Responde a este correo con tu confirmación o correcciones.</p>',
    '  </div>',
    '  <div style="background:#1a120e;padding:16px;text-align:center;">',
    '    <div style="color:#9a8680;font-size:12px;">' + negocioName + ' · Pre-factura ' + (data.solId || '') + ' · ' + (data.fecha || '') + '</div>',
    '  </div>',
    '</div>'
  ].join('\n');

  MailApp.sendEmail({
    to: data.email,
    subject: subject,
    htmlBody: htmlBody,
    name: negocioName + ' Facturas'
  });
}
