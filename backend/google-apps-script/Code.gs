/*
  RenewFlo onboarding upload backend (Google Apps Script)
  Deploy as Web App:
  - Execute as: User deploying
  - Who has access: Anyone
*/

const APP_CONFIG = {
  rootFolderId: "1xqpORPh7hsWiOaaEZ27VWBrEhJuB6s1d",
  createSubmissionSubfolder: true,
  logToSheet: true,
  // Optional: set if you want to force logging into a specific spreadsheet.
  spreadsheetId: "",
  sheetName: "Onboarding Submissions",
  notificationEmail: "info@renewflo.co"
};

function getTimezone() {
  return Session.getScriptTimeZone() || "America/New_York";
}

function doPost(e) {
  try {
    const rootFolder = DriveApp.getFolderById(APP_CONFIG.rootFolderId);
    const requestData = parseSubmissionRequest(e);

    const submittedAtIso = requestData.submittedAt || new Date().toISOString();
    const submittedAt = new Date(submittedAtIso);
    const stamp = Utilities.formatDate(submittedAt, getTimezone(), "yyyyMMdd_HHmmss");

    const submitterName = requestData.submitterName || "Unknown";
    const submitterEmail = requestData.submitterEmail || "Unknown";

    const destinationFolder = APP_CONFIG.createSubmissionSubfolder
      ? rootFolder.createFolder("Submission_" + stamp)
      : rootFolder;

    const savedFiles = [];
    const propertyRows = [];

    requestData.properties.forEach(function (property, propertyIndex) {
      const propertyKey = property.key || ("property_" + (propertyIndex + 1));
      const displayName = firstValue(property.name) || propertyKey;
      const safePropertyName = sanitize(displayName) || propertyKey;

      const row = {
        submittedAt: submittedAtIso,
        submitterName: submitterName,
        submitterEmail: submitterEmail,
        propertyKey: propertyKey,
        propertyName: displayName,
        claims: firstValue(property.details && property.details.claims) || "",
        claimsDetail: firstValue(property.claimsDetail) || "",
        marketApproach: firstValue(property.details && property.details.marketApproach) || "",
        deliveryFormat: firstValue(property.details && property.details.deliveryFormat) || "",
        trustees: firstValue(property.trustees) || "",
        otherContext: firstValue(property.otherContext) || ""
      };

      const perPropertyFolder = destinationFolder.createFolder(safePropertyName);
      row.folderId = perPropertyFolder.getId();
      row.folderUrl = perPropertyFolder.getUrl();

      (property.documents || []).forEach(function (document) {
        const docTypeBase = sanitize(document.label || document.key) || "Document";
        const files = Array.isArray(document.files) ? document.files : [];

        files.forEach(function (filePayload, fileIndex) {
          const docType = files.length > 1 ? (docTypeBase + "_" + (fileIndex + 1)) : docTypeBase;
          const blob = uploadToBlob(filePayload);
          const ext = extensionFrom(firstValue(filePayload && filePayload.name) || blob.getName());
          const dated = Utilities.formatDate(new Date(), getTimezone(), "yyyy-MM-dd");
          const newName = safePropertyName + "_" + docType + "_" + dated + ext;
          blob.setName(newName);

          const file = perPropertyFolder.createFile(blob);
          savedFiles.push({
            propertyName: displayName,
            docType: docType,
            fileName: file.getName(),
            fileId: file.getId(),
            fileUrl: file.getUrl()
          });
        });
      });

      propertyRows.push(row);
    });

    if (APP_CONFIG.logToSheet) {
      appendRows(propertyRows, savedFiles);
    }

    sendNotificationEmail({
      submitterName: submitterName,
      submitterEmail: submitterEmail,
      submittedAtIso: submittedAtIso,
      destinationFolderUrl: destinationFolder.getUrl(),
      propertyRows: propertyRows,
      savedFiles: savedFiles
    });

    return jsonResponse({
      ok: true,
      message: "Upload completed",
      destinationFolderId: destinationFolder.getId(),
      destinationFolderUrl: destinationFolder.getUrl(),
      propertyCount: propertyRows.length,
      fileCount: savedFiles.length
    });
  } catch (error) {
    return jsonResponse({ ok: false, message: error.message, stack: String(error.stack || "") });
  }
}

function appendRows(propertyRows, savedFiles) {
  const ss = APP_CONFIG.spreadsheetId
    ? SpreadsheetApp.openById(APP_CONFIG.spreadsheetId)
    : (SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.create("Onboarding Submission Log"));
  const sheet = getOrCreateSheet(ss, APP_CONFIG.sheetName);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "SubmittedAt",
      "SubmitterName",
      "SubmitterEmail",
      "PropertyKey",
      "PropertyName",
      "Claims",
      "ClaimsDetail",
      "MarketApproach",
      "DeliveryFormat",
      "Trustees",
      "OtherContext",
      "PropertyFolderId",
      "PropertyFolderUrl",
      "UploadedFiles"
    ]);
  }

  propertyRows.forEach(function (row) {
    const fileSummary = savedFiles
      .filter(function (f) { return f.propertyName === row.propertyName; })
      .map(function (f) { return f.docType + ": " + f.fileName; })
      .join(" | ");

    sheet.appendRow([
      row.submittedAt,
      row.submitterName,
      row.submitterEmail,
      row.propertyKey,
      row.propertyName,
      row.claims,
      row.claimsDetail,
      row.marketApproach,
      row.deliveryFormat,
      row.trustees,
      row.otherContext,
      row.folderId,
      row.folderUrl,
      fileSummary
    ]);
  });
}

function sendNotificationEmail(payload) {
  if (!APP_CONFIG.notificationEmail) return;

  const subject = "New RenewFlo Onboarding Submission - " + payload.submitterName;
  const lines = [
    "A new onboarding submission was received.",
    "",
    "Submitter: " + payload.submitterName,
    "Submitter Email: " + payload.submitterEmail,
    "Submitted At: " + payload.submittedAtIso,
    "Property Count: " + payload.propertyRows.length,
    "File Count: " + payload.savedFiles.length,
    "Drive Folder: " + payload.destinationFolderUrl,
    "",
    "Properties:"
  ];

  payload.propertyRows.forEach(function (row, idx) {
    lines.push(
      (idx + 1) + ". " + row.propertyName +
      " | Claims: " + (row.claims || "Not answered") +
      " | Market: " + (row.marketApproach || "Not answered") +
      " | Delivery: " + (row.deliveryFormat || "Not answered")
    );
  });

  MailApp.sendEmail({
    to: APP_CONFIG.notificationEmail,
    subject: subject,
    body: lines.join("\n")
  });
}

function collectPropertyKeys(params, files) {
  const keys = {};

  Object.keys(params || {}).forEach(function (k) {
    const idx = k.indexOf("__");
    if (idx <= 0) return;
    keys[k.substring(0, idx)] = true;
  });

  Object.keys(files || {}).forEach(function (k) {
    const idx = k.indexOf("__");
    if (idx <= 0) return;
    keys[k.substring(0, idx)] = true;
  });

  return Object.keys(keys);
}

function parseSubmissionRequest(e) {
  const params = e && e.parameters ? e.parameters : {};
  const files = e && e.files ? e.files : {};
  const postData = e && e.postData ? e.postData : null;
  const contentType = String(postData && postData.type || "");

  if (postData && postData.contents && /application\/json/i.test(contentType)) {
    const payload = JSON.parse(postData.contents);
    return {
      submittedAt: firstValue(payload.submittedAt),
      submitterName: firstValue(payload.submitterName),
      submitterEmail: firstValue(payload.submitterEmail),
      properties: Array.isArray(payload.properties) ? payload.properties : []
    };
  }

  return parseLegacySubmissionRequest(params, files);
}

function parseLegacySubmissionRequest(params, files) {
  const propertyKeys = collectPropertyKeys(params, files);
  const properties = propertyKeys.map(function (propertyKey) {
    const documentsByKey = {};

    Object.keys(files || {}).forEach(function (fieldName) {
      if (!fieldName.startsWith(propertyKey + "__")) return;

      const rawDocKey = fieldName.substring((propertyKey + "__").length);
      const docKey = rawDocKey.replace(/_\d+$/, "");
      if (!documentsByKey[docKey]) {
        documentsByKey[docKey] = {
          key: docKey,
          label: docKey,
          files: []
        };
      }

      documentsByKey[docKey].files.push(files[fieldName]);
    });

    return {
      key: propertyKey,
      name: firstValue(params[propertyKey + "__name"]) || propertyKey,
      trustees: firstValue(params[propertyKey + "__trustees"]) || "",
      otherContext: firstValue(params[propertyKey + "__otherContext"]) || "",
      claimsDetail: firstValue(params[propertyKey + "__claimsDetail"]) || "",
      details: {
        claims: firstValue(params[propertyKey + "__claims"]) || "",
        marketApproach: firstValue(params[propertyKey + "__marketApproach"]) || "",
        deliveryFormat: firstValue(params[propertyKey + "__deliveryFormat"]) || ""
      },
      documents: Object.keys(documentsByKey).map(function (docKey) {
        return documentsByKey[docKey];
      })
    };
  });

  return {
    submittedAt: firstValue(params.submittedAt),
    submitterName: firstValue(params.submitterName),
    submitterEmail: firstValue(params.submitterEmail),
    properties: properties
  };
}

function uploadToBlob(filePayload) {
  if (!filePayload) {
    throw new Error("Missing file payload.");
  }

  if (typeof filePayload.getBlob === "function") {
    return filePayload.getBlob();
  }

  if (filePayload.data) {
    return Utilities.newBlob(
      Utilities.base64Decode(filePayload.data),
      filePayload.mimeType || "application/octet-stream",
      filePayload.name || "upload"
    );
  }

  throw new Error("Unsupported file payload received.");
}

function firstValue(v) {
  if (Array.isArray(v)) return v.length ? v[0] : "";
  return v || "";
}

function extensionFrom(filename) {
  const m = String(filename || "").match(/(\.[A-Za-z0-9]+)$/);
  return m ? m[1] : "";
}

function sanitize(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function getOrCreateSheet(ss, name) {
  const existing = ss.getSheetByName(name);
  if (existing) return existing;
  return ss.insertSheet(name);
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
