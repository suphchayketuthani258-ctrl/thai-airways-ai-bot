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
// SYSTEM
// =============================
const SYSTEM = `
You are Thai Airways Roblox Customer Service AI.

- Help users politely
- Do not invent flights
- Use only database
`;

// =============================
client.once("ready", () => {
    console.log("🤖 AI ONLINE");
});

// =============================
client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;

    const channelName = msg.channel.name.toLowerCase();
    const text = msg.content.toLowerCase();

    // =============================
    // 🎫 FIXED TICKET DETECTION (IMPORTANT)
    // =============================
    const isTicketChannel = channelName.includes("ticket");

    // ❗ DEBUG (ถ้าจะเช็ค)
    // console.log("CHANNEL:", channelName);

    if (isTicketChannel) {

        const normalized = text
            .replace(/\s+/g, " ")
            .replace(/rotal/g, "royal");

        const ticketKeywords = [
            "royal",
            "silk",
            "first",
            "ยศ",
            "ซื้อ",
            "รับ",
            "purchase",
            "rank",
            "verify"
        ];

        const match = ticketKeywords.some(k =>
            normalized.includes(k)
        );

        if (match) {
            return msg.reply(`
🙏 ขอบคุณที่ติดต่อฝ่ายบริการลูกค้า Thai Airways Roblox

กรุณาส่งข้อมูล:

1️⃣ หลักฐานการซื้อ
2️⃣ Roblox username

เจ้าหน้าที่จะดำเนินการให้เร็วที่สุด ✈️
            `);
        }

        // fallback กัน “พูดแล้วไม่ตอบ”
        if (
            text.includes("royal") ||
            text.includes("ยศ") ||
            text.includes("ซื้อ") ||
            text.includes("silk")
        ) {
            return msg.reply(`
📩 รับเรื่องแล้วครับ

กรุณาส่ง:
1️⃣ หลักฐานการซื้อ
2️⃣ Roblox username
            `);
        }
    }

    // =============================
    // COOLDOWN
    // =============================
    if (cooldown.has(msg.author.id)) {
        return msg.reply("⏳ รอ 10 วิ");
    }

    cooldown.add(msg.author.id);
    setTimeout(() => cooldown.delete(msg.author.id), 10000);

    // =============================
    // DATABASE
    // =============================
    const flights = db.getFlights();

    const flightText = flights.length
        ? flights.map(f =>
            `${f.id}: ${f.from} → ${f.to} เวลา ${f.time}`
        ).join("\n")
        : "NO FLIGHT DATA";

    // =============================
    // MEMORY
    // =============================
    let history = memory.get(msg.author.id) || [];

    history.push({ role: "user", content: msg.content });
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

FLIGHTS:
${flightText}
`
                },
                ...history
            ],
            temperature: 0.4,
            max_tokens: 500
        });

        const reply = res.choices[0].message.content;

        history.push({ role: "assistant", content: reply });
        memory.set(msg.author.id, history);

        msg.reply(reply);

    } catch (err) {
        console.log(err);
        msg.reply("❌ error");
    }
});

client.login(process.env.DISCORD_TOKEN);