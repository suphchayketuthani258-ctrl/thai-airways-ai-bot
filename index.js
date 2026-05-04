require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai");
const express = require("express");
const fs = require("fs");
const stringSimilarity = require("string-similarity");

// =============================
// CHECK ENV
// =============================
if (!process.env.DISCORD_TOKEN) throw new Error("NO DISCORD_TOKEN");
if (!process.env.GROQ_API_KEY) throw new Error("NO GROQ_API_KEY");

// =============================
// EXPRESS
// =============================
const app = express();
app.get("/", (req, res) => res.send("Bot Running"));
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
// GROQ
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
// MEMORY SYSTEM
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
// INIT LOAD
// =============================
loadKB();
loadMemory();

setInterval(loadKB, 30000);

// =============================
// READY
// =============================
client.once("ready", () => {
    console.log(`Bot online: ${client.user.tag}`);
});

// =============================
// MESSAGE
// =============================
client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    const text = message.content.toLowerCase();
    const userId = message.author.id;

    // =============================
    // MEMORY (จำชื่อ)
    // =============================
    if (text.includes("ผมชื่อ") || text.includes("ฉันชื่อ")) {
        const name = message.content.split("ชื่อ")[1]?.trim();
        if (name) {
            remember(userId, "name", name);
            return message.reply(`รับทราบครับ คุณ ${name}`);
        }
    }

    // =============================
    // JOB AUTO REPLY
    // =============================
    const jobKeywords = ["สมัคร", "job", "pilot", "crew", "hr", "นักบิน", "ลูกเรือ"];
    if (jobKeywords.some(w => text.includes(w))) {
        return message.reply("สมัครที่ https://recruitment.thai-airways.pattaramet.dev");
    }

    // =============================
    // CHANNEL LIMIT
    // =============================
    if (message.channel.name !== "⌊📝⌉-thai-airways-ai") return;

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

        // =============================
        // SMART KB + MEMORY
        // =============================
        const kb = smartFind(text);
        const name = recall(userId, "name");

        const completion = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
                {
                    role: "system",
                    content: `
You are Thai Airways Roblox AI.

User name: ${name || "unknown"}

Knowledge:
${kb ? kb.answer : ""}

Be helpful and professional.
`
                },
                {
                    role: "user",
                    content: message.content
                }
            ]
        });

        await message.reply(
            completion.choices[0]?.message?.content ||
            "ไม่สามารถตอบได้"
        );

    } catch (err) {
        console.error(err);
        await message.reply("ระบบขัดข้อง");
    }
});

// =============================
// LOGIN
// =============================
client.login(process.env.DISCORD_TOKEN);