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
    throw new Error("ไม่พบ DISCORD_TOKEN");
}

if (!process.env.GROQ_API_KEY) {
    throw new Error("ไม่พบ GROQ_API_KEY");
}

if (!process.env.GOOGLE_SHEET_URL) {
    throw new Error("ไม่พบ GOOGLE_SHEET_URL");
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
// LOAD GOOGLE SHEET
// =========================
async function loadSheetData() {
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
}

// =========================
// FIND RELEVANT INFO
// =========================
async function findRelevantInfo(question) {
    const data = await loadSheetData();

    const lowerQuestion = question.toLowerCase();

    const matched = data.filter(row =>
        lowerQuestion.includes(
            row.keyword.toLowerCase()
        )
    );

    return matched.slice(0, 10);
}

// =========================
// READY
// =========================
client.once("ready", () => {
    console.log(`✅ Bot online: ${client.user.tag}`);
});

// =========================
// MESSAGE EVENT
// =========================
client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    const text = message.content.toLowerCase();
    const channelName = message.channel.name.toLowerCase();

    // =====================================
    // JOB APPLICATION AUTO REPLY
    // =====================================
    const jobKeywords = [
        "สมัคร",
        "สมัครงาน",
        "งาน",
        "career",
        "job",
        "apply",
        "pilot",
        "crew",
        "hr",
        "นักบิน",
        "ลูกเรือ",
        "พนักงาน"
    ];

    const askingJob = jobKeywords.some(word =>
        text.includes(word)
    );

    if (askingJob) {
        const isEnglish = /[a-z]/.test(text);

        if (isEnglish) {
            return message.reply(`
Hello!

Apply here:
https://recruitment.thai-airways.pattaramet.dev/

Steps:
1. Submit application
2. HR review
3. Training/interview
4. Rank assignment
`);
        }

        return message.reply(`
สวัสดีครับ

สมัครงานได้ที่:
https://recruitment.thai-airways.pattaramet.dev/

ขั้นตอน:
1. ส่งใบสมัคร
2. HR ตรวจสอบ
3. ฝึก/สัมภาษณ์
4. รับยศ
`);
    }

    // =====================================
    // TICKET SYSTEM
    // =====================================
    const isTicketChannel =
        channelName.includes("ticket");

    const ticketKeywords = [
        "royal silk",
        "royal first",
        "rank",
        "ยศ",
        "ซื้อ",
        "purchase"
    ];

    const askingTicket =
        ticketKeywords.some(word =>
            text.includes(word)
        );

    if (isTicketChannel && askingTicket) {
        return message.reply(`
กรุณาส่ง:

1. หลักฐานการซื้อ
2. ชื่อ Roblox
3. รายละเอียดคำสั่งซื้อ

เจ้าหน้าที่จะช่วยคุณครับ
`);
    }

    // =====================================
    // AI CHANNEL ONLY
    // =====================================
    const aiChannel =
        "⌊📝⌉-thai-airways-ai";

    if (message.channel.name !== aiChannel) {
        return;
    }

    // =====================================
    // COOLDOWN
    // =====================================
    if (cooldown.has(message.author.id)) {
        return message.reply(
            "กรุณารอ 10 วินาทีก่อนใช้งานอีกครั้ง"
        );
    }

    cooldown.add(message.author.id);

    setTimeout(() => {
        cooldown.delete(message.author.id);
    }, 10000);

    try {
        await message.channel.sendTyping();

        // ดึงข้อมูลจาก Google Sheet
        const relevantData =
            await findRelevantInfo(
                message.content
            );

        const sheetContext =
            relevantData.length > 0
                ? relevantData.map(row => `
Category: ${row.category}
Keyword: ${row.keyword}
Info: ${row.info}
`).join("\n")
                : "No sheet data found";

        const completion =
            await groq.chat.completions.create({
                model: "llama-3.1-8b-instant",
                messages: [
                    {
                        role: "system",
                        content: `
You are official Thai Airways Roblox AI assistant.

Use Google Sheet data below when relevant:

${sheetContext}

Permanent company info:

Fino / Fino251217
- President
- CHRO
- Co-founder

papangkor559
- CFO
- Chief Commercial Officer

TH3JJ_TH
- Director Digital Center

99KLSH
- Director Operations

Rules:
- Reply same language
- Be professional
- Use sheet data when available
- If no info exists tell user contact HR
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
            completion.choices[0]
            ?.message?.content ||
            "ขออภัย ระบบไม่สามารถตอบได้";

        await message.reply(reply);

    } catch (error) {
        console.error(error);

        await message.reply(
            "ระบบ AI มีปัญหาชั่วคราว"
        );
    }
});

// =========================
// LOGIN
// =========================
client.login(
    process.env.DISCORD_TOKEN
);