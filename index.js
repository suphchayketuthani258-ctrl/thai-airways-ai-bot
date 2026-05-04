require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai");
const db = require("./database");

// =============================
// CLIENT SETUP
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
// CHANNEL LOCK (AI ONLY)
// =============================
const AI_CHANNEL_NAME = "⌊📝⌉-thai-airways-ai";

// =============================
// SYSTEM (CUSTOMER SERVICE MODE)
// =============================
const SYSTEM = `
You are Thai Airways Roblox Customer Service AI.

ROLE:
- You are a customer support assistant (NOT HR)
- Help users with flights, tickets, and applications

RULES:
- Do NOT invent flights
- Use only database data
- If unknown → suggest recruitment link or support

BE PROFESSIONAL AND FRIENDLY
`;

// =============================
// READY EVENT
// =============================
client.once("ready", () => {
    console.log("🤖 Customer Service AI Online");
});

// =============================
// MESSAGE HANDLER
// =============================
client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;

    // =============================
    // LOCK CHANNEL (AI ONLY)
    // =============================
    if (msg.channel.name !== AI_CHANNEL_NAME) return;

    // =============================
    // COOLDOWN
    // =============================
    if (cooldown.has(msg.author.id)) {
        return msg.reply("⏳ กรุณารอ 10 วินาที");
    }

    cooldown.add(msg.author.id);
    setTimeout(() => cooldown.delete(msg.author.id), 10000);

    const text = msg.content.toLowerCase();

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
    // ✈ JOB / APPLICATION DETECTION
    // =============================
    const jobKeywords = [
        "สมัคร", "สมัครงาน", "อยากทำงาน",
        "อยากเป็นนักบิน", "pilot", "crew",
        "job", "work", "พนักงาน", "airline"
    ];

    const isJob = jobKeywords.some(k => text.includes(k));

    if (isJob) {
        return msg.reply(`
✈️ Thai Airways Roblox Recruitment

คุณสามารถสมัครงานได้ที่:
👉 https://recruitment.thai-airways.pattaramet.dev/

📌 ขั้นตอน:
1. กรอกใบสมัคร
2. HR ตรวจสอบ
3. เข้ารับการอบรม
4. ประกาศผล

หากมีคำถามเพิ่มเติมสามารถสอบถามได้ครับ 😊
        `);
    }

    // =============================
    // 🎫 TICKET SYSTEM (FIXED)
    // =============================
    const isTicketChannel = msg.channel.name
        .toLowerCase()
        .startsWith("ticket");

    const ticketKeywords = [
        "royal silk",
        "royal first",
        "ยศ",
        "ซื้อ",
        "รับยศ",
        "purchase",
        "payment",
        "rank",
        "claim",
        "verify",
        "ตรวจสอบ"
    ];

    const isTicketMessage = ticketKeywords.some(k =>
        text.includes(k)
    );

    if (isTicketChannel && isTicketMessage) {
        return msg.reply(`
🙏 ขอบคุณที่ติดต่อฝ่ายบริการลูกค้า Thai Airways Roblox

เพื่อให้เจ้าหน้าที่ดำเนินการได้เร็วที่สุด กรุณาส่งข้อมูลดังนี้:

1️⃣ หลักฐานการซื้อ (Screenshot / Receipt)
2️⃣ ชื่อผู้ใช้ Roblox

📌 หลังจากได้รับข้อมูลครบถ้วน
เจ้าหน้าที่จะตรวจสอบและดำเนินการให้เร็วที่สุดครับ ✈️
        `);
    }

    // =============================
    // TICKET FALLBACK (CATCH ALL)
    // =============================
    if (isTicketChannel) {
        if (
            text.includes("royal") ||
            text.includes("ยศ") ||
            text.includes("ซื้อ") ||
            text.includes("รับ")
        ) {
            return msg.reply(`
🙏 รับเรื่องเรียบร้อยครับ

กรุณาส่ง:
1️⃣ หลักฐานการซื้อ
2️⃣ Roblox username

เจ้าหน้าที่จะดำเนินการให้เร็วที่สุด ✈️
            `);
        }
    }

    // =============================
    // MEMORY SYSTEM
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
        msg.reply("❌ ระบบขัดข้อง กรุณาลองใหม่");
    }
});

// =============================
client.login(process.env.DISCORD_TOKEN);