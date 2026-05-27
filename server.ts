import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  const TOKEN_FILE_PATH = path.join(process.cwd(), 'google-token.json');
  let currentAccessToken: string | null = null;
  let tokenSavedAt: string | null = null;

  function loadStoredToken() {
    try {
      if (fs.existsSync(TOKEN_FILE_PATH)) {
        const data = JSON.parse(fs.readFileSync(TOKEN_FILE_PATH, 'utf-8'));
        if (data && data.accessToken) {
          currentAccessToken = data.accessToken;
          tokenSavedAt = data.savedAt || new Date().toISOString();
          console.log('Successfully loaded stored Google Access Token from file.');
        }
      }
    } catch (error) {
      console.warn('Failed to load stored Google Access Token:', error);
    }
  }
  loadStoredToken();

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Token administration routes
  app.get('/api/sheets/token-status', (req, res) => {
    res.json({
      authenticated: !!currentAccessToken,
      savedAt: tokenSavedAt,
    });
  });

  app.post('/api/sheets/save-token', (req, res) => {
    const { accessToken } = req.body;
    if (!accessToken) {
      return res.status(400).json({ error: 'Missing accessToken in request body' });
    }
    currentAccessToken = accessToken;
    tokenSavedAt = new Date().toISOString();
    try {
      fs.writeFileSync(TOKEN_FILE_PATH, JSON.stringify({
        accessToken,
        savedAt: tokenSavedAt
      }, null, 2));
      console.log('Google Access Token saved to file.');
    } catch (error) {
      console.error('Failed to write Google Access Token to file:', error);
    }
    res.json({ status: 'ok', authenticated: true, savedAt: tokenSavedAt });
  });

  app.post('/api/sheets/append', async (req, res) => {
    const { spreadsheetId, range, values } = req.body;
    if (!spreadsheetId || !range || !values) {
      return res.status(400).json({ error: 'Missing spreadsheetId, range, or values' });
    }

    // Always persist logs to local state file as backup
    const localLogsPath = path.join(process.cwd(), 'local-logs.json');
    let localLogs: any[] = [];
    try {
      if (fs.existsSync(localLogsPath)) {
        localLogs = JSON.parse(fs.readFileSync(localLogsPath, 'utf-8'));
      }
    } catch (e) {
      console.warn('Could not read local logs:', e);
    }

    // Append to local storage
    if (Array.isArray(values)) {
      localLogs.push(...values);
    }
    try {
      fs.writeFileSync(localLogsPath, JSON.stringify(localLogs, null, 2));
      console.log('Saved log to local backup file.');
    } catch (e) {
      console.warn('Could not write local logs:', e);
    }

    // Try sending to the central Google Apps Script Webhook first
    let webhookSuccess = false;
    let webhookNotes = '';
    try {
      const webhookUrl = 'https://script.google.com/macros/s/AKfycbwjew3zDwnx2c3dzGalfXdl-0qpwVrweeUgmvPaCpK3c7sR5a07plKxS8hYHTZmsik/exec';
      const webhookPayload = {
        spreadsheetId,
        range,
        values,
        // Flat mapping in case the Apps Script expects flat properties
        timestamp: values[0]?.[0] || '',
        cso: values[0]?.[1] || '',
        csoName: values[0]?.[2] || '',
        mainLocation: values[0]?.[3] || '',
        subLocation: values[0]?.[4] || '',
        completedAmount: values[0]?.[5] || '',
        geoCodeCompliance: values[0]?.[6] || '',
        imageUrl: values[0]?.[7] || '',
        proofImage: values[0]?.[7] || ''
      };

      console.log('Posting log data to centralized Webhook:', webhookUrl);
      const webhookRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookPayload)
      });

      console.log('Webhook HTTP status:', webhookRes.status);
      const resText = await webhookRes.text();
      console.log('Webhook response body:', resText.substring(0, 300));

      if (webhookRes.ok) {
        webhookSuccess = true;
        webhookNotes = 'Saved successfully to sheet via central webhook link.';
      } else {
        webhookNotes = `Webhook returned HTTP ${webhookRes.status}: ${resText}`;
      }
    } catch (err: any) {
      console.error('Apps Script webhook call failed:', err);
      webhookNotes = `Webhook lookup/execution failed: ${err.message || String(err)}`;
    }

    if (webhookSuccess) {
      return res.json({ status: 'ok', notes: webhookNotes });
    }

    // Fallback: Try Sheets API with dynamic authentication token if present
    if (!currentAccessToken) {
      console.log('Server is not authenticated with Google. Local backup saved.');
      return res.json({ status: 'ok', notes: `Local backup saved. Webhook was offline: ${webhookNotes}` });
    }

    try {
      const gResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentAccessToken}`
          },
          body: JSON.stringify({ values })
        }
      );

      if (!gResponse.ok) {
        const errorText = await gResponse.text();
        console.error('Google Sheets API append failed. Local backup is active.', errorText);
        return res.json({ status: 'ok', notes: `Local backup saved. Sheets update skipped: ${errorText}` });
      }

      const resData = await gResponse.json();
      return res.json(resData);
    } catch (error: any) {
      console.error('Error appending to Google Sheets:', error);
      return res.json({ status: 'ok', notes: `Local backup saved. Sheets update deferred.` });
    }
  });

  app.get('/api/sheets/values', async (req, res) => {
    const { spreadsheetId, range } = req.query;
    if (!spreadsheetId || !range) {
      return res.status(400).json({ error: 'Missing spreadsheetId or range parameter' });
    }

    let sheetValues: any[][] = [];
    let success = false;

    // 1. Try Google Sheets API with Access Token if present
    if (currentAccessToken) {
      try {
        const gResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range as string)}`,
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
        console.warn('Google Sheets API direct fetching failed, trying CSV export fallback...', error);
      }
    }

    // 2. Fallback to public CSV export URL if sheet has link sharing enabled
    if (!success) {
      try {
        let gid = '0';
        const uRange = String(range).toUpperCase();
        if (uRange.includes('LOG')) {
          gid = '856885035';
        } else if (uRange.includes('CHECK') || uRange.includes('LOCATION')) {
          gid = '2097119519';
        }

        const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
        const csvResponse = await fetch(csvUrl);
        if (csvResponse.ok) {
          const csvText = await csvResponse.text();
          const rows: any[][] = [];
          const lines = csvText.split(/\r?\n/);
          for (const line of lines) {
            if (!line.trim()) continue;
            
            const parts: string[] = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                parts.push(parts.length === 7 ? current : current.trim());
                current = '';
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
      } catch (err: any) {
        console.warn('CSV export fallback failed:', err.message);
      }
    }

    // 3. Merge with local backup logs if we are querying the logs sheet
    const localLogsPath = path.join(process.cwd(), 'local-logs.json');
    let localLogs: any[] = [];
    try {
      if (fs.existsSync(localLogsPath)) {
        localLogs = JSON.parse(fs.readFileSync(localLogsPath, 'utf-8'));
      }
    } catch (e) {
      console.warn('Could not read local logs for merge:', e);
    }

    if (String(range).toUpperCase().includes('LOG')) {
      if (sheetValues.length === 0) {
        sheetValues = [['TIMESTAMP', 'CSO', 'CSO NAME', 'MAIN LOCATION', 'SUB LOCATION', 'COMPLETED AMOUNT', 'GEOCODE COMPLIANCE', 'PROOF IMAGE']];
      }

      const existingTimestamps = new Set(sheetValues.map(row => row[0]));
      for (const log of localLogs) {
        if (Array.isArray(log) && log.length >= 7) {
          if (!existingTimestamps.has(log[0])) {
            sheetValues.push(log);
          }
        }
      }
    }

    if (sheetValues.length === 0) {
      if (String(range).toUpperCase().includes('LOG')) {
        sheetValues = [['TIMESTAMP', 'CSO', 'CSO NAME', 'MAIN LOCATION', 'SUB LOCATION', 'COMPLETED AMOUNT', 'GEOCODE COMPLIANCE', 'PROOF IMAGE']];
      }
    }

    return res.json({ values: sheetValues });
  });

  app.post('/api/sheets/clear', (req, res) => {
    try {
      const localLogsPath = path.join(process.cwd(), 'local-logs.json');
      fs.writeFileSync(localLogsPath, JSON.stringify([], null, 2));
      console.log('Cleared all local logs on the server.');
      return res.json({ status: 'ok', message: 'Local logs cleared successfully' });
    } catch (error: any) {
      console.error('Failed to clear local logs:', error);
      return res.status(500).json({ error: error.message || 'Failed to clear local logs' });
    }
  });

  app.post('/api/sheets/resolve-title', async (req, res) => {
    const { spreadsheetId } = req.body;
    if (!spreadsheetId) {
      return res.status(400).json({ error: 'Missing spreadsheetId parameter' });
    }
    if (!currentAccessToken) {
      return res.json({ sheets: [{ properties: { sheetId: 856885035, title: 'LOGS' } }] });
    }

    try {
      const metaResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
        headers: {
          Authorization: `Bearer ${currentAccessToken}`
        }
      });
      if (!metaResponse.ok) {
        return res.json({ sheets: [{ properties: { sheetId: 856885035, title: 'LOGS' } }] });
      }
      const meta = await metaResponse.json();
      return res.json(meta);
    } catch (error: any) {
      return res.json({ sheets: [{ properties: { sheetId: 856885035, title: 'LOGS' } }] });
    }
  });

  app.post('/api/sheets/upload-file', async (req, res) => {
    const { name, mimeType, base64Data } = req.body;
    if (!name || !mimeType || !base64Data) {
      return res.status(400).json({ error: 'Missing file fields (name, mimeType, base64Data)' });
    }

    try {
      const safeName = name.replace(/[^a-zA-Z0-9_\.-]/g, '_');
      const filePath = path.join(process.cwd(), 'uploads', safeName);
      fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
      console.log(`Image saved locally: /uploads/${safeName}`);

      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const absoluteUrl = `${protocol}://${host}/uploads/${safeName}`;

      return res.json({
        id: absoluteUrl,
        fallback: false,
        url: absoluteUrl
      });
    } catch (err: any) {
      console.error('Failed to save image locally:', err);
      return res.status(500).json({ error: err.message || 'Failed to save image locally' });
    }
  });

  // Server-side CSV proxy
  app.get('/api/proxy-csv', async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).json({ error: "Missing 'url' query parameter" });
    }

    try {
      const response = await fetch(targetUrl);
      if (!response.ok) {
        return res.status(response.status).json({
          error: `Failed to fetch from target URL. Status: ${response.status}`,
        });
      }
      const contentType = response.headers.get('content-type') || 'text/csv';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      const text = await response.text();
      return res.send(text);
    } catch (error: any) {
      console.error('Error in CSV proxy handler:', error);
      return res.status(500).json({
        error: `Server failed to proxy the request: ${error.message}`,
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
