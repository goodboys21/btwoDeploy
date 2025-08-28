const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
app.use(bodyParser.json());
app.use(cors());

// === CONFIG ===
const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4";
const CLOUDFLARE_ZONE_ID = "3618b748426c0ab404a74d3f44a1d79f"; 
const CLOUDFLARE_API_KEY = "h2Mv29fCFsGJSmXsZOGIVBNdAE0NKnjNNEkwBY8a"; // API Token

const JSONBLOB_URL = "https://jsonblob.com/api/jsonBlob/1410617869905092608"; 
const TELEGRAM_TOKEN = "7964560249:AAF78QqL2JveR3LvAqkS42c35WSMljAQqa4";
const OWNER_ID = "7081489041";

// === Helper Telegram ===
async function sendTelegram(message) {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: OWNER_ID,
      text: message,
      parse_mode: "Markdown"
    });
  } catch (err) {
    console.error("Gagal kirim telegram:", err.response?.data || err.message);
  }
}

// === Helper JSONBlob ===
async function getRecords() {
  try {
    let res = await axios.get(JSONBLOB_URL);
    return res.data || [];
  } catch {
    return [];
  }
}

async function saveRecords(data) {
  await axios.put(JSONBLOB_URL, data, {
    headers: { "Content-Type": "application/json" }
  });
}

// === CREATE RECORD ===
app.post("/create", async (req, res) => {
  let { subdomain, type, value } = req.body;
  if (!subdomain || !type || !value) {
    return res.status(400).json({ error: "subdomain, type, value wajib diisi" });
  }

  try {
    let result = await axios.post(
      `${CLOUDFLARE_API}/zones/${CLOUDFLARE_ZONE_ID}/dns_records`,
      {
        type,
        name: subdomain,
        content: value,
        ttl: 3600
      },
      {
        headers: {
          "Authorization": `Bearer ${CLOUDFLARE_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (!result.data.success) {
      return res.status(500).json({ error: "Gagal tambah record", detail: result.data });
    }

    let records = await getRecords();
    records.push({
      id: result.data.result.id,
      subdomain,
      type,
      value
    });
    await saveRecords(records);

    await sendTelegram(
      `✅ *Subdomain baru dibuat!*\n` +
      `Subdomain: ${subdomain}\n` +
      `Type: ${type}\n` +
      `Value: ${value}\n\n` +
      `Total Record Sekarang : ${records.length}`
    );

    res.json({ success: true, data: result.data.result });
  } catch (err) {
    console.error("Cloudflare Error:", err.response?.data || err.message);
    res.status(500).json({ error: "Error create record", detail: err.response?.data || err.message });
  }
});

// === DELETE RECORD ===
app.delete("/delete/:id", async (req, res) => {
  let { id } = req.params;
  try {
    let result = await axios.delete(
      `${CLOUDFLARE_API}/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${id}`,
      {
        headers: {
          "Authorization": `Bearer ${CLOUDFLARE_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (!result.data.success) {
      return res.status(500).json({ error: "Gagal hapus record", detail: result.data });
    }

    let records = await getRecords();
    let updated = records.filter(r => r.id !== id);
    await saveRecords(updated);

    await sendTelegram(
      `🗑️ *Record DNS dihapus!*\n` +
      `Record ID: ${id}\n\n` +
      `Total Record Sekarang : ${updated.length}`
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Cloudflare Error:", err.response?.data || err.message);
    res.status(500).json({ error: "Error delete record", detail: err.response?.data || err.message });
  }
});

// === LIST RECORD ===
app.get("/records", async (req, res) => {
  let records = await getRecords();
  res.json(records);
});

// === Export untuk Vercel ===
module.exports = app;
