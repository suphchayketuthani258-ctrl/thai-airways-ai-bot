require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai");
const db = require("./database");

// =============================
// CLIENT
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
// CHANNEL LOCK
// =============================
const AI_CHANNEL_NAME = "⌊📝⌉-thai-airways-ai";

// =============================
// SYSTEM PROMPT (เดิมคงไว้)
// =============================
const SYSTEM = `
You are Thai Airways Roblox Customer Service AI.

ROLE:
- Customer service assistant (NOT HR)
- Help with flights, tickets, applications

RULES:
- Do NOT invent flights
- Use only database data
- Be polite and professional
`;

// =============================
// READY
// =============================
client.once("ready", () => {
    console.log("🤖 AI ONLINE");
});

// =============================
// MESSAGE EVENT
// =============================
client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;

    // =============================
    // LOCK CHANNEL (เดิม)
    // =============================
    if (msg.channel.name !== AI_CHANNEL_NAME) return;

    const text = msg.content.toLowerCase();

    // =============================
    // COOLDOWN (เดิม)
    // =============================
    if (cooldown.has(msg.author.id)) {
        return msg.reply("⏳ กรุณารอ 10 วินาที");
    }

    cooldown.add(msg.author.id);
    setTimeout(() => cooldown.delete(msg.author.id), 10000);

    // =============================
    // DATABASE (เดิม)
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
        : "NO INFO";

    // =============================
    // ✈ JOB SYSTEM (เดิม)
    // =============================
    const jobKeywords = [
        "สมัคร", "สมัครงาน", "อยากทำงาน",
        "อยากเป็นนักบิน", "pilot", "crew",
        "job", "work", "พนักงาน"
    ];

    if (jobKeywords.some(k => text.includes(k))) {
        return msg.reply(`
✈️ สมัครงาน Thai Airways Roblox

👉 https://recruitment.thai-airways.pattaramet.dev/

1. สมัครออนไลน์
2. ตรวจสอบ
3. อบรม
4. ประกาศผล
        `);
    }

    // =============================
    // 🎫 FIXED TICKET SYSTEM (สำคัญ)
    // =============================
    const isTicketChannel = msg.channel.name
        .toLowerCase()
        .includes("ticket");

    // 🔧 normalize กันพิมพ์ผิด
    const normalized = text
        .replace(/\s+/g, " ")
        .replace(/rotal/g, "royal");

    // =============================
    // STRICT INTENT (แก้ false positive)
    // =============================
    const strongTicketIntent = [
        "royal silk",
        "royal first",
        "ซื้อยศ",
        "รับยศ",
        "claim rank",
        "verify purchase",
        "rank upgrade"
    ];

    const weakWords = [
        "ซื้อ",
        "ยศ",
        "royal",
        "silk",
        "first"
    ];

    const isStrong = strongTicketIntent.some(k =>
        normalized.includes(k)
    );

    const hasWeak = weakWords.some(k =>
        normalized.includes(k)
    );

    // =============================
    // ❌ กันคำมั่ว trigger (สำคัญ)
    // =============================
    const exclude = [
        "ตรวจสอบให้หน่อย",
        "รับทราบ",
        "ซื้อของ",
        "verify account",
        "check flight",
        "ticket flight"
    ];

    const isExcluded = exclude.some(k =>
        normalized.includes(k)
    );

    // =============================
    // 🎫 MAIN TICKET RESPONSE
    // =============================
    if (isTicketChannel && isStrong && !isExcluded) {
        return msg.reply(`
🙏 ขอบคุณที่ติดต่อฝ่ายบริการลูกค้า Thai Airways Roblox

กรุณาส่ง:

1️⃣ หลักฐานการซื้อ (Screenshot / Receipt)
2️⃣ Roblox username

📌 เจ้าหน้าที่จะดำเนินการให้เร็วที่สุด ✈️
        `);
    }

    // =============================
    // 🎫 FALLBACK (เฉพาะ intent เบา)
    // =============================
    if (isTicketChannel && hasWeak && !isExcluded) {
        return msg.reply(`
📩 รับเรื่องแล้วครับ

กรุณาส่ง:
1️⃣ หลักฐานการซื้อ
2️⃣ Roblox username
        `);
    }

    // =============================
    // MEMORY (เดิม)
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
        // AI CALL (เดิม)
        // =============================
        const res = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
                {
                    role: "system",
                    content: SYSTEM + `

FLIGHTS:
${flightText}

INFO:
${infoText}
`
                },
                ...history
            ],
            temperature: 0.4,
            max_tokens: 500
        });

        const reply = res.choices[0].message.content;

        history.push({
            role: "assistant",
            content: reply
        });

        memory.set(msg.author.id, history);

        msg.reply(reply);

    } catch (err) {
        console.log(err);
        msg.reply("❌ ระบบขัดข้อง");
    }
});

// =============================
client.login(process.env.DISCORD_TOKEN);