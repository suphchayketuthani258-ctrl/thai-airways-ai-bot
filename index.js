require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai");
const express = require("express");
const axios = require("axios");
const csv = require("csv-parser");
const { Readable } = require("stream");

// =========================
// ENV CHECK
// =========================
if (!process.env.DISCORD_TOKEN) {
    throw new Error("Missing DISCORD_TOKEN");
}

if (!process.env.GROQ_API_KEY) {
    throw new Error("Missing GROQ_API_KEY");
}

if (!process.env.GOOGLE_SHEET_URL) {
    console.log("No sheet URL - AI only mode");
}

// =========================
// EXPRESS SERVER
// =========================
const app = express();

app.get("/", (req, res) => {
    res.send("Roblox Thai Airways AI System Running");
});

app.listen(process.env.PORT || 3000, () => {
    console.log("Web server started");
});

// =========================
// DISCORD CLIENT
// =========================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// =========================
// AI (GROQ)
// =========================
const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1"
});

// =========================
// COOLDOWN
// =========================
const cooldown = new Set();

// =========================
// LOAD GOOGLE SHEET (ROBLOX DATABASE)
// =========================
async function loadSheetData() {
    try {
        if (!process.env.GOOGLE_SHEET_URL) return [];

        const response = await axios.get(process.env.GOOGLE_SHEET_URL);

        const rows = [];

        return new Promise((resolve, reject) => {
            Readable.from(response.data)
                .pipe(csv())
                .on("data", (data) => rows.push(data))
                .on("end", () => resolve(rows))
                .on("error", reject);
        });

    } catch (err) {
        console.log("Sheet error:", err.message);
        return [];
    }
}

// =========================
// SEARCH ROBLOX DATABASE ONLY
// =========================
async function searchDatabase(question) {
    const data = await loadSheetData();
    const q = question.toLowerCase();

    return data.filter(row => {
        if (!row.keyword || !row.info) return false;

        return q.includes(String(row.keyword).toLowerCase());
    }).slice(0, 10);
}

// =========================
// READY
// =========================
client.once("clientReady", () => {
    console.log(`Bot online: ${client.user.tag}`);
});

// =========================
// MESSAGE EVENT
// =========================
client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    const text = message.content.toLowerCase();
    const channel = message.channel.name;

    // =========================
    // ONLY AI CHANNEL
    // =========================
    const aiChannel = "⌊📝⌉-thai-airways-ai";

    if (channel !== aiChannel) return;

    // =========================
    // COOLDOWN
    // =========================
    if (cooldown.has(message.author.id)) {
        return message.reply("⏳ กรุณารอ 10 วินาที");
    }

    cooldown.add(message.author.id);
    setTimeout(() => cooldown.delete(message.author.id), 10000);

    try {
        await message.channel.sendTyping();

        // =========================
        // GET ROBLOX DATABASE
        // =========================
        const db = await searchDatabase(message.content);

        const context =
            db.length > 0
                ? db.map(r => `
[ROBLOX DATABASE]
Category: ${r.category || "Unknown"}
Keyword: ${r.keyword}
Info: ${r.info}
`).join("\n")
                : "No Roblox database info found";

        // =========================
        // AI PROMPT (ROBLOX ONLY RULE)
        // =========================
        const completion = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
                {
                    role: "system",
                    content: `
You are an AI assistant for a Roblox airline company only.

IMPORTANT RULES:
- This is a Roblox airline world only
- Do NOT mention real world airlines
- Do NOT mention real people or external companies
- Do NOT use outside knowledge
- Only use provided database below
- If no info found, say: "Please contact Roblox HR team"

DATABASE:
${context}

Company structure exists only inside Roblox:
- HR Team (Roblox)
- Operations Team (Roblox)
- Digital Center (Roblox)
- Flight Crew Training System (Roblox)

Tone:
- Professional
- Clear
- Friendly
`
                },
                {
                    role: "user",
                    content: message.content
                }
            ],
            temperature: 0.7,
            max_tokens: 500
        });

        const reply =
            completion.choices[0]?.message?.content ||
            "ไม่สามารถตอบได้ กรุณาติดต่อ Roblox HR";

        await message.reply(reply);

    } catch (err) {
        console.error(err);
        await message.reply("❌ ระบบ AI ขัดข้อง กรุณาลองใหม่");
    }
});

// =========================
// LOGIN
// =========================
client.login(process.env.DISCORD_TOKEN);