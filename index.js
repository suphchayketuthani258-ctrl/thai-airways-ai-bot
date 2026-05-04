require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai");
const express = require("express");
const fs = require("fs");
const stringSimilarity = require("string-similarity");

// =============================
// ENV CHECK
// =============================
if (!process.env.DISCORD_TOKEN) {
    throw new Error("ไม่พบ DISCORD_TOKEN");
}

if (!process.env.GROQ_API_KEY) {
    throw new Error("ไม่พบ GROQ_API_KEY");
}

// =============================
// EXPRESS SERVER
// =============================
const app = express();

app.get("/", (req, res) => {
    res.send("Thai Airways AI Bot Running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Web server running on port ${PORT}`);
});

// =============================
// DISCORD CLIENT
// =============================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// =============================
// GROQ AI
// =============================
const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1"
});

// =============================
// COOLDOWN
// =============================
const cooldown = new Set();

// =============================
// =============================
// KNOWLEDGE BASE
// =============================
let kbCache = [];

function loadKB() {
    try {
        kbCache = JSON.parse(fs.readFileSync("./knowledge.json", "utf8"));
    } catch {
        kbCache = [];
    }
}

function smartFind(text) {
    if (!kbCache.length) return null;

    const keys = kbCache.map(i => i.key);
    const match = stringSimilarity.findBestMatch(text.toLowerCase(), keys);

    if (match.bestMatch.rating < 0.4) return null;

    return kbCache.find(i => i.key === match.bestMatch.target);
}

// =============================
// USER MEMORY
// =============================
let memory = {};

function loadMemory() {
    try {
        memory = JSON.parse(fs.readFileSync("./memory.json", "utf8"));
    } catch {
        memory = {};
    }
}

function saveMemory() {
    fs.writeFileSync("./memory.json", JSON.stringify(memory, null, 2));
}

function remember(userId, key, value) {
    if (!memory[userId]) memory[userId] = {};
    memory[userId][key] = value;
    saveMemory();
}

function recall(userId, key) {
    return memory[userId]?.[key] || null;
}

// =============================
// SAFETY (FLIGHT GUARD)
// =============================
const STRICT_TOPICS = [
    "เที่ยวบิน",
    "flight",
    "flight number",
    "schedule",
    "departure",
    "arrival",
    "เวลา"
];

function isStrictQuery(text) {
    return STRICT_TOPICS.some(w => text.toLowerCase().includes(w));
}

// =============================
// INIT LOAD
// =============================
loadKB();
loadMemory();

setInterval(loadKB, 30000);

// =============================
// READY
// =============================
client.once("ready", () => {
    console.log(`✅ Bot online: ${client.user.tag}`);
});

// =============================
// MESSAGE EVENT
// =============================
client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    const text = message.content.toLowerCase();
    const userId = message.author.id;
    const channelName = message.channel.name.toLowerCase();

    // =============================
    // MEMORY (จำชื่อผู้ใช้)
    // =============================
    if (text.includes("ผมชื่อ") || text.includes("ฉันชื่อ")) {
        const name = message.content.split("ชื่อ")[1]?.trim();
        if (name) {
            remember(userId, "name", name);
            return message.reply(`รับทราบครับ คุณ ${name}`);
        }
    }

    // =============================
    // JOB AUTO REPLY (เดิม)
    // =============================
    const jobKeywords = [
        "สมัคร", "สมัครงาน", "งาน", "career", "job",
        "apply", "pilot", "crew", "hr", "นักบิน", "ลูกเรือ", "พนักงาน"
    ];

    if (jobKeywords.some(w => text.includes(w))) {
        const isEnglish = /[a-z]/.test(text);

        if (isEnglish) {
            return message.reply(`
Hello!

Apply here:
https://recruitment.thai-airways.pattaramet.dev/

Steps:
1. Apply
2. HR review
3. Training
4. Get rank
`);
        }

        return message.reply(`
สวัสดีครับ

สมัครได้ที่:
https://recruitment.thai-airways.pattaramet.dev/
`);
    }

    // =============================
    // TICKET SYSTEM (เดิม)
    // =============================
    const isTicketChannel = channelName.includes("ticket");

    const ticketKeywords = [
        "royal silk", "royal first", "rank", "ยศ", "ซื้อ", "purchase"
    ];

    if (isTicketChannel && ticketKeywords.some(w => text.includes(w))) {
        return message.reply(`
กรุณาส่ง:
1. หลักฐานการซื้อ
2. Roblox username
3. รายละเอียด
`);
    }

    // =============================
    // AI CHANNEL ONLY
    // =============================
    const aiChannelName = "⌊📝⌉-thai-airways-ai";
    if (message.channel.name !== aiChannelName) return;

    // =============================
    // COOLDOWN
    // =============================
    if (cooldown.has(userId)) {
        return message.reply("รอ 10 วินาที");
    }

    cooldown.add(userId);
    setTimeout(() => cooldown.delete(userId), 10000);

    try {
        await message.channel.sendTyping();

        const kb = smartFind(text);
        const name = recall(userId, "name");

        // =============================
        // SAFETY CHECK (FLIGHT GUARD)
        // =============================
        if (isStrictQuery(text) && !kb) {
            return message.reply(
                "ไม่มีข้อมูลเที่ยวบินในระบบ กรุณาติดต่อ HR เพื่อสอบถามข้อมูลที่ถูกต้อง"
            );
        }

        const completion = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            temperature: 0.3,
            max_tokens: 500,
            messages: [
                {
                    role: "system",
                    content: `
You are Thai Airways Roblox AI Assistant.

User name: ${name || "unknown"}

⚠️ STRICT RULES:
- NEVER invent flight numbers
- NEVER invent schedules or times
- ONLY use provided knowledge
- If no data → say "ไม่มีข้อมูล กรุณาติดต่อ HR"

Knowledge:
${kb ? kb.answer : "NO DATA"}
`
                },
                {
                    role: "user",
                    content: message.content
                }
            ]
        });

        const reply =
            completion.choices[0]?.message?.content ||
            "ไม่มีข้อมูล กรุณาติดต่อ HR";

        await message.reply(reply);

    } catch (err) {
        console.error(err);
        await message.reply("ระบบขัดข้อง");
    }
});

// =============================
// LOGIN
// =============================
client.login(process.env.DISCORD_TOKEN);