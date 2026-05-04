require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai");
const db = require("./database");

// =============================
// 🌐 WEB SERVER
// =============================
const express = require("express");
const app = express();

app.use(express.json());
app.use(express.static("public"));

let trainingData = [];

// API: GET flights
app.get("/flights", (req, res) => {
    res.json(db.getFlights());
});

// API: ADD flight
app.post("/add-flight", (req, res) => {
    const { from, to, time } = req.body;
    db.addFlight(from, to, time);
    res.sendStatus(200);
});

// API: TRAIN AI
app.post("/train", (req, res) => {
    trainingData.push(req.body.text);
    res.sendStatus(200);
});

// API: GET TRAIN DATA
app.get("/train", (req, res) => {
    res.json(trainingData);
});

app.listen(3000, () => {
    console.log("🌐 Web running on http://localhost:3000");
});

// =============================
// 🤖 DISCORD BOT
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
// 🧠 MEMORY + COOLDOWN
// =============================
const memory = new Map();
const cooldown = new Set();

// =============================
// 🔒 SYSTEM (ANTI REAL-WORLD)
// =============================
const SYSTEM = `
You are Thai Airways Roblox Customer Service AI (FICTIONAL SYSTEM).

STRICT RULES:
- You MUST NOT reference real-world airlines or Thai Airways.
- You MUST NOT provide real flight schedules or real data.
- You MUST NOT mention real websites.
- Everything is fictional and stored in this system only.
- If user asks about real-world info → say not available.

Behavior:
- Speak Thai politely
- Keep answer short
- Help about Roblox airline system only
`;

// =============================
// 🛡 SANITIZE AI OUTPUT
// =============================
function sanitizeAI(text) {
    const banned = [
        "http", "www.", "thai airways", "การบินไทย",
        "suvarnabhumi", "don mueang"
    ];

    const lower = text.toLowerCase();

    if (banned.some(w => lower.includes(w))) {
        return "⚠️ ระบบนี้เป็นระบบจำลอง ไม่สามารถให้ข้อมูลจริงได้";
    }

    return text;
}

// =============================
// 🚀 READY
// =============================
client.once("ready", () => {
    console.log("🤖 AI ONLINE");
});

// =============================
// 💬 MESSAGE HANDLER
// =============================
client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;

    const channelName = msg.channel.name.toLowerCase();
    const text = msg.content.toLowerCase();

    // =============================
    // LOCK CHANNEL (ยืดหยุ่นขึ้น)
    // =============================
    if (!channelName.includes("thai-airways-ai")) return;

    // =============================
    // COOLDOWN
    // =============================
    if (cooldown.has(msg.author.id)) {
        return msg.reply("⏳ รอ 5 วินาที");
    }

    cooldown.add(msg.author.id);
    setTimeout(() => cooldown.delete(msg.author.id), 5000);

    // =============================
    // DATABASE
    // =============================
    const flights = db.getFlights();

    const flightText = flights.length
        ? flights.slice(0, 10).map(f =>
            `${f.id}: ${f.from} → ${f.to} ${f.time}`
        ).join("\n")
        : "NO FLIGHTS";

    // =============================
    // 🎫 TICKET SYSTEM (เดิม)
    // =============================
    const isTicketChannel = channelName.includes("ticket");

    const normalized = text
        .replace(/\s+/g, " ")
        .replace(/rotal/g, "royal");

    const matchTicket =
        /royal|silk|rank|claim|verify|ซื้อ|ยศ/.test(normalized);

    if (isTicketChannel && matchTicket) {
        return msg.reply(`
🙏 ขอบคุณที่ติดต่อฝ่ายบริการลูกค้า

กรุณาส่ง:
1️⃣ หลักฐานการซื้อ
2️⃣ Roblox username

✈️ เจ้าหน้าที่จะดำเนินการเร็วที่สุด
        `);
    }

    // =============================
    // 🧠 MEMORY
    // =============================
    let history = memory.get(msg.author.id) || [];

    history.push({ role: "user", content: msg.content });
    history = history.slice(-10);
    memory.set(msg.author.id, history);

    try {
        await msg.channel.sendTyping();

        const res = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
                {
                    role: "system",
                    content:
                        SYSTEM +
                        `

TRAINING DATA:
${trainingData.join("\n")}

FLIGHTS:
${flightText}
`
                },
                ...history
            ],
            temperature: 0.4,
            max_tokens: 500
        });

        let reply = res.choices[0].message.content;

        // 🛡 sanitize
        reply = sanitizeAI(reply);

        history.push({ role: "assistant", content: reply });
        memory.set(msg.author.id, history);

        msg.reply(reply);

    } catch (err) {
        console.error(err);
        msg.reply("❌ ระบบขัดข้อง กรุณาลองใหม่");
    }
});

// =============================
// 🔑 LOGIN
// =============================
client.login(process.env.DISCORD_TOKEN);