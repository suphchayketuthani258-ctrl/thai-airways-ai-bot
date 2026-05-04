require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai");
const express = require("express");
const fs = require("fs");
const stringSimilarity = require("string-similarity");

// =============================
// SERVER
// =============================
const app = express();
app.get("/", (_, res) => res.send("Roblox Airline AI Online"));
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
// DATABASE
// =============================
const DB = {
    kb: [],
    flights: [],
    benefits: [],
    memory: {}
};

function loadDB() {
    DB.kb = JSON.parse(fs.readFileSync("./data/knowledge.json", "utf8") || "[]");
    DB.flights = JSON.parse(fs.readFileSync("./data/flights.json", "utf8") || "[]");
    DB.benefits = JSON.parse(fs.readFileSync("./data/benefits.json", "utf8") || "[]");

    try {
        DB.memory = JSON.parse(fs.readFileSync("./data/memory.json", "utf8"));
    } catch {
        DB.memory = {};
    }
}

function saveMemory() {
    fs.writeFileSync("./data/memory.json", JSON.stringify(DB.memory, null, 2));
}

loadDB();
setInterval(loadDB, 30000);

// =============================
// MEMORY SYSTEM
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
// TIME SYSTEM (TH + GLOBAL)
// =============================
function getTime() {
    const now = new Date();

    return {
        thailand: new Intl.DateTimeFormat("th-TH", {
            timeZone: "Asia/Bangkok",
            dateStyle: "full",
            timeStyle: "medium"
        }).format(now),
        japan: new Intl.DateTimeFormat("ja-JP", {
            timeZone: "Asia/Tokyo",
            dateStyle: "full",
            timeStyle: "medium"
        }).format(now),
        utc: now.toUTCString()
    };
}

// =============================
// INTENT DETECTION (SMART FUZZY)
// =============================
function detectIntent(text) {
    const t = text.toLowerCase();

    const map = {
        job: ["สมัคร", "งาน", "pilot", "crew", "แอร์", "นักบิน", "hr", "career"],
        flight: ["เที่ยวบิน", "flight", "บิน", "tg", "schedule", "วัน", "เวลา"],
        benefit: ["royal", "สิทธิ", "benefit", "สวัสดิการ"],
        time: ["เวลา", "time", "กี่โมง", "ประเทศ"]
    };

    for (const key in map) {
        if (map[key].some(w => t.includes(w))) return key;
    }

    return "ai";
}

// =============================
// KB SEARCH (FUZZY)
// =============================
function findKB(text) {
    if (!DB.kb.length) return null;

    const keys = DB.kb.map(i => i.key);
    const match = stringSimilarity.findBestMatch(text.toLowerCase(), keys);

    if (match.bestMatch.rating < 0.4) return null;

    return DB.kb.find(i => i.key === match.bestMatch.target);
}

// =============================
// FLIGHT SYSTEM (FULL LOGIC)
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
// GLOBAL JOB DETECTOR (ALL CHANNELS)
// =============================
function isJob(text) {
    const t = text.toLowerCase();
    return [
        "สมัคร", "งาน", "pilot", "นักบิน",
        "แอร์", "crew", "hr", "career"
    ].some(w => t.includes(w));
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
// MESSAGE EVENT
// =============================
client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;

    const text = msg.content;
    const t = text.toLowerCase();
    const userId = msg.author.id;

    // =============================
    // MEMORY NAME
    // =============================
    if (t.includes("ผมชื่อ") || t.includes("ฉันชื่อ")) {
        const name = text.split("ชื่อ")[1]?.trim();
        if (name) {
            remember(userId, "name", name);
            return msg.reply(`รับทราบครับคุณ ${name}`);
        }
    }

    // =============================
    // JOB SYSTEM (GLOBAL)
    // =============================
    if (isJob(t)) {
        return msg.reply(`
✈️ สมัครงาน Thai Airways Roblox

🔗 https://recruitment.thai-airways.pattaramet.dev/

ขั้นตอน:
1. สมัคร
2. HR ตรวจสอบ
3. สัมภาษณ์
4. ฝึกงาน
5. เข้าทำงาน
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
        return msg.reply(`
🇹🇭 ไทย: ${time.thailand}
🇯🇵 ญี่ปุ่น: ${time.japan}
🌍 UTC: ${time.utc}
`);
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
You are Roblox Airline AI System.

RULES:
- ONLY use internal database
- NEVER use real-world airline data
- NEVER mention Thai Airways real-world info
- If no data → "ไม่มีข้อมูลในระบบ"
- Keep responses short

USER: ${name}

KB:
${kb ? kb.answer : "NONE"}

FLIGHT:
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