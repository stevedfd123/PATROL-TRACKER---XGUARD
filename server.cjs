var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_vite = require("vite");
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json({ limit: "15mb" }));
  const uploadsDir = import_path.default.join(process.cwd(), "uploads");
  if (!import_fs.default.existsSync(uploadsDir)) {
    import_fs.default.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use("/uploads", import_express.default.static(uploadsDir));
  const TOKEN_FILE_PATH = import_path.default.join(process.cwd(), "google-token.json");
  let currentAccessToken = null;
  let tokenSavedAt = null;
  function loadStoredToken() {
    try {
      if (import_fs.default.existsSync(TOKEN_FILE_PATH)) {
        const data = JSON.parse(import_fs.default.readFileSync(TOKEN_FILE_PATH, "utf-8"));
        if (data && data.accessToken) {
          currentAccessToken = data.accessToken;
          tokenSavedAt = data.savedAt || (/* @__PURE__ */ new Date()).toISOString();
          console.log("Successfully loaded stored Google Access Token from file.");
        }
      }
    } catch (error) {
      console.warn("Failed to load stored Google Access Token:", error);
    }
  }
  loadStoredToken();
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });
  app.get("/api/sheets/token-status", (req, res) => {
    res.json({
      authenticated: !!currentAccessToken,
      savedAt: tokenSavedAt
    });
  });
  app.post("/api/sheets/save-token", (req, res) => {
    const { accessToken } = req.body;
    if (!accessToken) {
      return res.status(400).json({ error: "Missing accessToken in request body" });
    }
    currentAccessToken = accessToken;
    tokenSavedAt = (/* @__PURE__ */ new Date()).toISOString();
    try {
      import_fs.default.writeFileSync(TOKEN_FILE_PATH, JSON.stringify({
        accessToken,
        savedAt: tokenSavedAt
      }, null, 2));
      console.log("Google Access Token saved to file.");
    } catch (error) {
      console.error("Failed to write Google Access Token to file:", error);
    }
    res.json({ status: "ok", authenticated: true, savedAt: tokenSavedAt });
  });
  app.post("/api/sheets/append", async (req, res) => {
    const { spreadsheetId, range, values } = req.body;
    if (!spreadsheetId || !range || !values) {
      return res.status(400).json({ error: "Missing spreadsheetId, range, or values" });
    }
    const localLogsPath = import_path.default.join(process.cwd(), "local-logs.json");
    let localLogs = [];
    try {
      if (import_fs.default.existsSync(localLogsPath)) {
        localLogs = JSON.parse(import_fs.default.readFileSync(localLogsPath, "utf-8"));
      }
    } catch (e) {
      console.warn("Could not read local logs:", e);
    }
    if (Array.isArray(values)) {
      localLogs.push(...values);
    }
    try {
      import_fs.default.writeFileSync(localLogsPath, JSON.stringify(localLogs, null, 2));
      console.log("Saved log to local backup file.");
    } catch (e) {
      console.warn("Could not write local logs:", e);
    }
    let webhookSuccess = false;
    let webhookNotes = "";
    try {
      const webhookUrl = "https://script.google.com/macros/s/AKfycbwjew3zDwnx2c3dzGalfXdl-0qpwVrweeUgmvPaCpK3c7sR5a07plKxS8hYHTZmsik/exec";
      const webhookPayload = {
        spreadsheetId,
        range,
        values,
        // Flat mapping in case the Apps Script expects flat properties
        timestamp: values[0]?.[0] || "",
        cso: values[0]?.[1] || "",
        csoName: values[0]?.[2] || "",
        mainLocation: values[0]?.[3] || "",
        subLocation: values[0]?.[4] || "",
        completedAmount: values[0]?.[5] || "",
        geoCodeCompliance: values[0]?.[6] || "",
        imageUrl: values[0]?.[7] || "",
        proofImage: values[0]?.[7] || ""
      };
      console.log("Posting log data to centralized Webhook:", webhookUrl);
      const webhookRes = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(webhookPayload)
      });
      console.log("Webhook HTTP status:", webhookRes.status);
      const resText = await webhookRes.text();
      console.log("Webhook response body:", resText.substring(0, 300));
      if (webhookRes.ok) {
        webhookSuccess = true;
        webhookNotes = "Saved successfully to sheet via central webhook link.";
      } else {
        webhookNotes = `Webhook returned HTTP ${webhookRes.status}: ${resText}`;
      }
    } catch (err) {
      console.error("Apps Script webhook call failed:", err);
      webhookNotes = `Webhook lookup/execution failed: ${err.message || String(err)}`;
    }
    if (webhookSuccess) {
      return res.json({ status: "ok", notes: webhookNotes });
    }
    if (!currentAccessToken) {
      console.log("Server is not authenticated with Google. Local backup saved.");
      return res.json({ status: "ok", notes: `Local backup saved. Webhook was offline: ${webhookNotes}` });
    }
    try {
      const gResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentAccessToken}`
          },
          body: JSON.stringify({ values })
        }
      );
      if (!gResponse.ok) {
        const errorText = await gResponse.text();
        console.error("Google Sheets API append failed. Local backup is active.", errorText);
        return res.json({ status: "ok", notes: `Local backup saved. Sheets update skipped: ${errorText}` });
      }
      const resData = await gResponse.json();
      return res.json(resData);
    } catch (error) {
      console.error("Error appending to Google Sheets:", error);
      return res.json({ status: "ok", notes: `Local backup saved. Sheets update deferred.` });
    }
  });
  app.get("/api/sheets/values", async (req, res) => {
    const { spreadsheetId, range } = req.query;
    if (!spreadsheetId || !range) {
      return res.status(400).json({ error: "Missing spreadsheetId or range parameter" });
    }
    let sheetValues = [];
    let success = false;
    if (currentAccessToken) {
      try {
        const gResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
          {
            headers: {
              Authorization: `Bearer ${currentAccessToken}`
            }
          }
        );
        if (gResponse.ok) {
          const resData = await gResponse.json();
          if (resData.values && Array.isArray(resData.values)) {
            sheetValues = resData.values;
            success = true;
          }
        }
      } catch (error) {
        console.warn("Google Sheets API direct fetching failed, trying CSV export fallback...", error);
      }
    }
    if (!success) {
      try {
        let gid = "0";
        const uRange = String(range).toUpperCase();
        if (uRange.includes("LOG")) {
          gid = "856885035";
        } else if (uRange.includes("CHECK") || uRange.includes("LOCATION")) {
          gid = "2097119519";
        }
        const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
        const csvResponse = await fetch(csvUrl);
        if (csvResponse.ok) {
          const csvText = await csvResponse.text();
          const rows = [];
          const lines = csvText.split(/\r?\n/);
          for (const line of lines) {
            if (!line.trim()) continue;
            const parts = [];
            let current = "";
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === "," && !inQuotes) {
                parts.push(parts.length === 7 ? current : current.trim());
                current = "";
              } else {
                current += char;
              }
            }
            parts.push(current.trim());
            rows.push(parts);
          }
          if (rows.length > 0) {
            sheetValues = rows;
            success = true;
            console.log(`Successfully fetched range ${range} via CSV export fallback.`);
          }
        }
      } catch (err) {
        console.warn("CSV export fallback failed:", err.message);
      }
    }
    const localLogsPath = import_path.default.join(process.cwd(), "local-logs.json");
    let localLogs = [];
    try {
      if (import_fs.default.existsSync(localLogsPath)) {
        localLogs = JSON.parse(import_fs.default.readFileSync(localLogsPath, "utf-8"));
      }
    } catch (e) {
      console.warn("Could not read local logs for merge:", e);
    }
    if (String(range).toUpperCase().includes("LOG")) {
      if (sheetValues.length === 0) {
        sheetValues = [["TIMESTAMP", "CSO", "CSO NAME", "MAIN LOCATION", "SUB LOCATION", "COMPLETED AMOUNT", "GEOCODE COMPLIANCE", "PROOF IMAGE"]];
      }
      const existingTimestamps = new Set(sheetValues.map((row) => row[0]));
      for (const log of localLogs) {
        if (Array.isArray(log) && log.length >= 7) {
          if (!existingTimestamps.has(log[0])) {
            sheetValues.push(log);
          }
        }
      }
    }
    if (sheetValues.length === 0) {
      if (String(range).toUpperCase().includes("LOG")) {
        sheetValues = [["TIMESTAMP", "CSO", "CSO NAME", "MAIN LOCATION", "SUB LOCATION", "COMPLETED AMOUNT", "GEOCODE COMPLIANCE", "PROOF IMAGE"]];
      }
    }
    return res.json({ values: sheetValues });
  });
  app.post("/api/sheets/clear", (req, res) => {
    try {
      const localLogsPath = import_path.default.join(process.cwd(), "local-logs.json");
      import_fs.default.writeFileSync(localLogsPath, JSON.stringify([], null, 2));
      console.log("Cleared all local logs on the server.");
      return res.json({ status: "ok", message: "Local logs cleared successfully" });
    } catch (error) {
      console.error("Failed to clear local logs:", error);
      return res.status(500).json({ error: error.message || "Failed to clear local logs" });
    }
  });
  app.post("/api/sheets/resolve-title", async (req, res) => {
    const { spreadsheetId } = req.body;
    if (!spreadsheetId) {
      return res.status(400).json({ error: "Missing spreadsheetId parameter" });
    }
    if (!currentAccessToken) {
      return res.json({ sheets: [{ properties: { sheetId: 856885035, title: "LOGS" } }] });
    }
    try {
      const metaResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
        headers: {
          Authorization: `Bearer ${currentAccessToken}`
        }
      });
      if (!metaResponse.ok) {
        return res.json({ sheets: [{ properties: { sheetId: 856885035, title: "LOGS" } }] });
      }
      const meta = await metaResponse.json();
      return res.json(meta);
    } catch (error) {
      return res.json({ sheets: [{ properties: { sheetId: 856885035, title: "LOGS" } }] });
    }
  });
  app.post("/api/sheets/upload-file", async (req, res) => {
    const { name, mimeType, base64Data } = req.body;
    if (!name || !mimeType || !base64Data) {
      return res.status(400).json({ error: "Missing file fields (name, mimeType, base64Data)" });
    }
    try {
      const safeName = name.replace(/[^a-zA-Z0-9_\.-]/g, "_");
      const filePath = import_path.default.join(process.cwd(), "uploads", safeName);
      import_fs.default.writeFileSync(filePath, Buffer.from(base64Data, "base64"));
      console.log(`Image saved locally: /uploads/${safeName}`);
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.headers["x-forwarded-host"] || req.get("host");
      const absoluteUrl = `${protocol}://${host}/uploads/${safeName}`;
      return res.json({
        id: absoluteUrl,
        fallback: false,
        url: absoluteUrl
      });
    } catch (err) {
      console.error("Failed to save image locally:", err);
      return res.status(500).json({ error: err.message || "Failed to save image locally" });
    }
  });
  app.get("/api/proxy-csv", async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) {
      return res.status(400).json({ error: "Missing 'url' query parameter" });
    }
    try {
      const response = await fetch(targetUrl);
      if (!response.ok) {
        return res.status(response.status).json({
          error: `Failed to fetch from target URL. Status: ${response.status}`
        });
      }
      const contentType = response.headers.get("content-type") || "text/csv";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Access-Control-Allow-Origin", "*");
      const text = await response.text();
      return res.send(text);
    } catch (error) {
      console.error("Error in CSV proxy handler:", error);
      return res.status(500).json({
        error: `Server failed to proxy the request: ${error.message}`
      });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
