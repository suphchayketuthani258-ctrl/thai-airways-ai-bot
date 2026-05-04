require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai");
const db = require("./database");

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

const memory = new Map();
const cooldown = new Set();

// =============================
// SYSTEM PROMPT (STRICT)
// =============================
const SYSTEM = `
You are Thai Airways Roblox Airline AI.

⚠️ STRICT RULES:
- Use ONLY FLIGHTS data provided
- NEVER create flight numbers or times
- If not found → say "No flight available"
- No guessing allowed
- If you hallucinate → it is a failure

FLIGHT ANSWER RULE:
- Always match from database exactly
- Do not modify or invent data
`;

// =============================
client.once("ready", () => {
    console.log("Bot online");
});

// =============================
client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;

    if (cooldown.has(msg.author.id)) {
        return msg.reply("⏳ wait 10s");
    }

    cooldown.add(msg.author.id);
    setTimeout(() => cooldown.delete(msg.author.id), 10000);

    const flights = db.getFlights();

    const flightText = flights.length
        ? flights.map(f => `${f.id}: ${f.from} → ${f.to} เวลา ${f.time}`).join("\n")
        : "NO FLIGHT DATA";

    let history = memory.get(msg.author.id) || [];

    history.push({
        role: "user",
        content: msg.content
    });

    history = history.slice(-6);
    memory.set(msg.author.id, history);

    try {
        await msg.channel.sendTyping();

        const res = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
                {
                    role: "system",
                    content: SYSTEM + `

FLIGHTS (REAL ONLY):
${flightText}
`
                },
                ...history
            ],
            temperature: 0.3, // ลดมั่ว
            max_tokens: 500
        });

        let reply = res.choices[0].message.content;

        // =============================
        // ANTI-HALLUCINATION FILTER
        // =============================
        const fakePattern = /TG\s?\d{2,4}/i;

        const validFlight = flights.some(f =>
            reply.includes(f.id)
        );

        if (fakePattern.test(reply) && !validFlight) {
            return msg.reply("❌ AI พยายามสร้างข้อมูลเที่ยวบินเอง (ไม่อนุญาต)");
        }

        history.push({
            role: "assistant",
            content: reply
        });

        memory.set(msg.author.id, history);

        msg.reply(reply);

    } catch (err) {
        console.log(err);
        msg.reply("❌ system error");
    }
});

client.login(process.env.DISCORD_TOKEN);