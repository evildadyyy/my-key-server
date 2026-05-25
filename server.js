const express = require('express');
const { google } = require('googleapis');

const app = express();

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.use(express.json());

const SPREADSHEET_ID = '1przrWHUBu_wq5PiO6wAvCPx6dBzDV8a1hZWNiAzYaSw';
const SHEET_NAME = 'Лист1';

async function getAuth() {
    // Берём JSON из переменной окружения
    const credentialsJson = process.env.CREDENTIALS_JSON;
    if (!credentialsJson) {
        throw new Error('CREDENTIALS_JSON environment variable not set');
    }
    const credentials = JSON.parse(credentialsJson);
    const auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return auth;
}

async function checkAccessCode(code) {
    try {
        const auth = await getAuth();
        const sheets = google.sheets({ version: 'v4', auth });
        const range = `${SHEET_NAME}!A:C`;
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
        });
        const rows = response.data.values || [];
        for (let i = 1; i < rows.length; i++) {
            const key = String(rows[i][0]).trim();
            const used = String(rows[i][1]).trim();
            if (key === code) {
                if (used === 'YES') {
                    return { success: false, error: 'Ключ уже использован' };
                }
                const rowIndex = i + 1;
                const updateRange = `${SHEET_NAME}!B${rowIndex}:C${rowIndex}`;
                await sheets.spreadsheets.values.update({
                    spreadsheetId: SPREADSHEET_ID,
                    range: updateRange,
                    valueInputOption: 'RAW',
                    resource: { values: [['YES', new Date().toISOString()]] },
                });
                return { success: true };
            }
        }
        return { success: false, error: 'Неверный ключ' };
    } catch (error) {
        console.error('Ошибка сервера:', error);
        return { success: false, error: 'Ошибка сервера: ' + error.toString() };
    }
}

app.post('/check-key', async (req, res) => {
    const { code } = req.body;
    if (!code) {
        return res.status(400).json({ success: false, error: 'Введите ключ!' });
    }
    const result = await checkAccessCode(code);
    res.json(result);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});