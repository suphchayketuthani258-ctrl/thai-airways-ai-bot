require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai");
const db = require("./database");

// =============================
// CONFIG
// =============================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1"
});

// =============================
// MEMORY + COOLDOWN
// =============================
const memory = new Map();
const cooldown = new Set();

// =============================
// LOCK CHANNEL (NEW)
// =============================
const AI_CHANNEL_NAME = "⌊📝⌉-thai-airways-ai";

// =============================
// SYSTEM PROMPT (ANTI-MUT)
// =============================
const SYSTEM = `
You are Thai Airways Roblox Airline AI.

⚠️ STRICT RULES:
- ONLY use flight data provided
- NEVER invent flights
- NEVER guess
- If not found → say "No flight available"
- No hallucination allowed

You are HR + Airline assistant only.
`;

// =============================
// BOT READY
// =============================
client.once("ready", () => {
    console.log("🤖 Bot online:", client.user.tag);
});

// =============================
// MESSAGE EVENT
// =============================
client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;

    // =============================
    // LOCK CHANNEL (IMPORTANT)
    // =============================
    if (msg.channel.name !== AI_CHANNEL_NAME) {
        return; // เงียบทุกช่องอื่น
    }

    // =============================
    // COOLDOWN
    // =============================
    if (cooldown.has(msg.author.id)) {
        return msg.reply("⏳ กรุณารอ 10 วินาที");
    }

    cooldown.add(msg.author.id);
    setTimeout(() => cooldown.delete(msg.author.id), 10000);

    // =============================
    // LOAD DATABASE
    // =============================
    const flights = db.getFlights();
    const info = db.getInfo();

    const flightText = flights.length
        ? flights.map(f =>
            `${f.id}: ${f.from} → ${f.to} เวลา ${f.time}`
        ).join("\n")
        : "NO FLIGHT DATA";

    const infoText = info.length
        ? info.map(i => `${i.key}: ${i.value}`).join("\n")
        : "NO INFO DATA";

    // =============================
    // MEMORY
    // =============================
    let history = memory.get(msg.author.id) || [];

    history.push({
        role: "user",
        content: msg.content
    });

    history = history.slice(-6);
    memory.set(msg.author.id, history);

    try {
        await msg.channel.sendTyping();

        // =============================
        // AI REQUEST
        // =============================
        const res = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
                {
                    role: "system",
                    content: SYSTEM + `

FLIGHTS (REAL ONLY):
${flightText}

INFO:
${infoText}
`
                },
                ...history
            ],
            temperature: 0.3,
            max_tokens: 500
        });

        let reply = res.choices[0].message.content;

        // =============================
        // ANTI HALLUCINATION FILTER
        // =============================
        const fakeFlightPattern = /TG\s?\d{2,4}/i;

        const validFlight = flights.some(f =>
            reply.includes(f.id)
        );

        if (fakeFlightPattern.test(reply) && !validFlight) {
            return msg.reply("❌ AI พยายามสร้างข้อมูลเที่ยวบินเอง (ไม่อนุญาต)");
        }

        // =============================
        // SAVE MEMORY
        // =============================
        history.push({
            role: "assistant",
            content: reply
        });

        memory.set(msg.author.id, history);

        // =============================
        // SEND REPLY
        // =============================
        msg.reply(reply);

    } catch (err) {
        console.log(err);
        msg.reply("❌ ระบบ AI ขัดข้อง");
    }
});

// =============================
// LOGIN
// =============================
client.login(process.env.DISCORD_TOKEN);