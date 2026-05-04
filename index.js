require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai");
const express = require("express");
const axios = require("axios");
const csv = require("csv-parser");
const { Readable } = require("stream");

// =========================
// ENV CHECK (soft safe)
// =========================
if (!process.env.DISCORD_TOKEN) {
    throw new Error("ไม่พบ DISCORD_TOKEN");
}

if (!process.env.GROQ_API_KEY) {
    throw new Error("ไม่พบ GROQ_API_KEY");
}

if (!process.env.GOOGLE_SHEET_URL) {
    console.log("⚠️ ไม่มี GOOGLE_SHEET_URL -> ใช้ AI อย่างเดียว");
}

// =========================
// EXPRESS SERVER
// =========================
const app = express();

app.get("/", (req, res) => {
    res.send("Thai Airways AI Bot Running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Web server running on port ${PORT}`);
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
// GROQ AI
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
// LOAD GOOGLE SHEET (SAFE)
// =========================
async function loadSheetData() {
    try {
        if (!process.env.GOOGLE_SHEET_URL) return [];

        const response = await axios.get(
            process.env.GOOGLE_SHEET_URL
        );

        const rows = [];

        return new Promise((resolve, reject) => {
            Readable.from(response.data)
                .pipe(csv())
                .on("data", (data) => rows.push(data))
                .on("end", () => resolve(rows))
                .on("error", reject);
        });

    } catch (err) {
        console.log("Sheet load error:", err.message);
        return [];
    }
}

// =========================
// FIND RELEVANT DATA (FIXED)
// =========================
async function findRelevantInfo(question) {
    const data = await loadSheetData();

    const lowerQuestion = question.toLowerCase();

    const matched = data.filter(row => {
        if (!row.keyword) return false;
        if (!row.info) return false;

        return lowerQuestion.includes(
            String(row.keyword).toLowerCase()
        );
    });

    return matched.slice(0, 10);
}

// =========================
// READY EVENT (FIXED)
// =========================
client.once("clientReady", () => {
    console.log(`✅ Bot online: ${client.user.tag}`);
});

// =========================
// MESSAGE EVENT
// =========================
client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    const text = message.content.toLowerCase();
    const channelName = message.channel.name.toLowerCase();

    // =========================
    // JOB SYSTEM
    // =========================
    const jobKeywords = [
        "สมัคร", "สมัครงาน", "งาน", "career", "job",
        "apply", "pilot", "crew", "hr", "นักบิน", "ลูกเรือ"
    ];

    if (jobKeywords.some(w => text.includes(w))) {
        return message.reply(`
📌 สมัครงานการบินไทย Roblox

https://recruitment.thai-airways.pattaramet.dev/

ขั้นตอน:
1. สมัคร
2. HR ตรวจสอบ
3. สัมภาษณ์
4. รับยศ
`);
    }

    // =========================
    // TICKET SYSTEM
    // =========================
    if (
        channelName.includes("ticket") &&
        (text.includes("royal") || text.includes("ยศ") || text.includes("ซื้อ"))
    ) {
        return message.reply(`
🎫 กรุณาส่งข้อมูล:

1. หลักฐานการซื้อ
2. Roblox username
3. รายละเอียดคำสั่งซื้อ

เจ้าหน้าที่จะตรวจสอบให้ครับ
`);
    }

    // =========================
    // AI CHANNEL ONLY
    // =========================
    const aiChannel = "⌊📝⌉-thai-airways-ai";

    if (message.channel.name !== aiChannel) return;

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

        const sheetData = await findRelevantInfo(message.content);

        const context =
            sheetData.length > 0
                ? sheetData.map(r => `
Category: ${r.category || "N/A"}
Keyword: ${r.keyword}
Info: ${r.info}
`).join("\n")
                : "No sheet data found";

        const completion = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
                {
                    role: "system",
                    content: `
You are Thai Airways Roblox AI assistant.

Use this database when relevant:

${context}

Executive info:
- Fino: CEO, CHRO, Co-founder
- papangkor559: CFO, CCO
- TH3JJ_TH: Director Digital
- 99KLSH: Director Operations

Rules:
- Reply naturally
- Use sheet if relevant
- If no info → answer normally or say contact HR
`
                },
                {
                    role: "user",
                    content: message.content
                }
            ],
            temperature: 0.7
        });

        const reply =
            completion.choices[0]?.message?.content ||
            "ขออภัย ระบบไม่สามารถตอบได้";

        await message.reply(reply);

    } catch (err) {
        console.error(err);
        await message.reply("❌ ระบบ AI ขัดข้องชั่วคราว");
    }
});

// =========================
// LOGIN
// =========================
client.login(process.env.DISCORD_TOKEN);