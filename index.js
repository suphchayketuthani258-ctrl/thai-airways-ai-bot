require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai");
const express = require("express");
const fs = require("fs");
const path = require("path");
const stringSimilarity = require("string-similarity");

// =============================
// EXPRESS
// =============================
const app = express();
app.get("/", (_, res) => res.send("AI System Running"));
app.listen(process.env.PORT || 3000);

// =============================
// DISCORD
// =============================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// =============================
// AI
// =============================
const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1"
});

// =============================
// AUTO CREATE FILE SYSTEM (FIX MAIN ERROR)
// =============================
function ensureFile(filePath, fallback) {
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
    }
}

// CREATE ALL FILES SAFE
ensureFile("./data/knowledge.json", []);
ensureFile("./data/flights.json", []);
ensureFile("./data/benefits.json", []);
ensureFile("./data/memory.json", {});

// =============================
// DB
// =============================
const DB = {
    kb: [],
    flights: [],
    benefits: [],
    memory: {}
};

// =============================
// SAFE READ
// =============================
function safeRead(file, fallback) {
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
        return fallback;
    }
}

// =============================
// LOAD DB
// =============================
function loadDB() {
    DB.kb = safeRead("./data/knowledge.json", []);
    DB.flights = safeRead("./data/flights.json", []);
    DB.benefits = safeRead("./data/benefits.json", []);
    DB.memory = safeRead("./data/memory.json", {});
}

function saveMemory() {
    fs.writeFileSync("./data/memory.json", JSON.stringify(DB.memory, null, 2));
}

loadDB();
setInterval(loadDB, 30000);

// =============================
// MEMORY
// =============================
function remember(userId, key, value) {
    if (!DB.memory[userId]) DB.memory[userId] = {};
    DB.memory[userId][key] = value;
    saveMemory();
}

function recall(userId, key) {
    return DB.memory[userId]?.[key];
}

// =============================
// TIME
// =============================
function getTime() {
    const now = new Date();

    return {
        thailand: new Intl.DateTimeFormat("th-TH", {
            timeZone: "Asia/Bangkok",
            dateStyle: "full",
            timeStyle: "medium"
        }).format(now)
    };
}

// =============================
// INTENT DETECTION
// =============================
function detectIntent(text) {
    const t = text.toLowerCase();

    const map = {
        job: ["สมัคร", "งาน", "pilot", "crew", "แอร์", "นักบิน", "hr"],
        flight: ["เที่ยวบิน", "flight", "บิน", "tg", "วันนี้", "พรุ่งนี้"],
        benefit: ["royal", "สิทธิ", "benefit", "สวัสดิการ"],
        time: ["เวลา", "กี่โมง", "date"]
    };

    for (const k in map) {
        if (map[k].some(w => t.includes(w))) return k;
    }

    return "ai";
}

// =============================
// KB SEARCH
// =============================
function findKB(text) {
    if (!DB.kb.length) return null;

    const keys = DB.kb.map(i => i.key);
    const match = stringSimilarity.findBestMatch(text.toLowerCase(), keys);

    if (match.bestMatch.rating < 0.4) return null;

    return DB.kb.find(i => i.key === match.bestMatch.target);
}

// =============================
// FLIGHT SEARCH (SAFE)
// =============================
function findFlights(text) {
    const today = new Date().toISOString().split("T")[0];

    if (text.includes("วันนี้")) {
        return DB.flights.filter(f => f.date === today);
    }

    if (text.includes("พรุ่งนี้")) {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        const tmr = d.toISOString().split("T")[0];
        return DB.flights.filter(f => f.date === tmr);
    }

    return DB.flights.filter(f =>
        text.includes(f.code?.toLowerCase()) ||
        text.includes(f.route?.toLowerCase()) ||
        text.includes(f.date)
    );
}

// =============================
// CHANNEL LOCK
// =============================
const AI_CHANNEL = "⌊📝⌉-thai-airways-ai";

// =============================
// READY
// =============================
client.once("ready", () => {
    console.log("AI READY:", client.user.tag);
});

// =============================
// MESSAGE
// =============================
client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;

    const text = msg.content;
    const t = text.toLowerCase();
    const userId = msg.author.id;

    // =============================
    // NAME MEMORY
    // =============================
    if (t.includes("ผมชื่อ") || t.includes("ฉันชื่อ")) {
        const name = text.split("ชื่อ")[1]?.trim();
        if (name) {
            remember(userId, "name", name);
            return msg.reply(`รับทราบครับคุณ ${name}`);
        }
    }

    // =============================
    // JOB AUTO (ALL CHANNELS)
    // =============================
    if (["สมัคร", "งาน", "pilot", "crew", "นักบิน", "แอร์"].some(w => t.includes(w))) {
        return msg.reply(`
✈️ สมัครงาน Thai Airways Roblox

https://recruitment.thai-airways.pattaramet.dev/

1. สมัคร
2. HR ตรวจสอบ
3. สัมภาษณ์
4. ฝึกงาน
`);
    }

    // =============================
    // CHANNEL LOCK
    // =============================
    if (msg.channel.name !== AI_CHANNEL) return;

    const intent = detectIntent(t);
    const name = recall(userId, "name") || "unknown";
    const time = getTime();

    let data = null;

    if (intent === "flight") data = findFlights(t);
    if (intent === "benefit") data = DB.benefits.find(b => t.includes(b.key));
    if (intent === "time") {
        return msg.reply(`🇹🇭 เวลาไทย: ${time.thailand}`);
    }

    const kb = findKB(t);

    // =============================
    // AI RESPONSE
    // =============================
    await msg.channel.sendTyping();

    const res = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        temperature: 0.2,
        messages: [
            {
                role: "system",
                content: `
You are Roblox Airline AI.

RULES:
- ONLY internal data
- NEVER use real-world airline data
- If no data → "ไม่มีข้อมูลในระบบ"

USER: ${name}

KB:
${kb ? kb.answer : "NONE"}

FLIGHTS:
${data ? JSON.stringify(data) : "NONE"}
`
            },
            {
                role: "user",
                content: text
            }
        ]
    });

    msg.reply(res.choices[0]?.message?.content || "ไม่มีข้อมูล");
});

// =============================
// LOGIN
// =============================
client.login(process.env.DISCORD_TOKEN);