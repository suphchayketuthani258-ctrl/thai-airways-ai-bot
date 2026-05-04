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
// SYSTEM (CUSTOMER SERVICE)
// =============================
const SYSTEM = `
You are Thai Airways Roblox Customer Service AI.

ROLE:
- You are NOT HR anymore
- You are CUSTOMER SERVICE agent
- Your job is to help passengers, users, and applicants

RULES:
- Be polite, helpful, friendly
- Do not invent flight data
- Use only provided database
- If unknown → suggest contact support
`;

// =============================
// READY
// =============================
client.once("ready", () => {
    console.log("🤖 Customer Service AI Online");
});

// =============================
// MESSAGE EVENT
// =============================
client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;

    // =============================
    // LOCK CHANNEL
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
    // FLIGHT DATA
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
    // 🎯 1. AUTO JOB / APPLY DETECTION
    // =============================
    const jobKeywords = [
        "สมัคร", "สมัครงาน", "อยากทำงาน", "อยากเป็นนักบิน",
        "อยากเป็นพนักงาน", "pilot", "crew", "job", "work"
    ];

    const isJob = jobKeywords.some(k => text.includes(k));

    if (isJob) {
        return msg.reply(`
✈️ สวัสดีครับ ยินดีต้อนรับสู่ระบบสมัครงาน Thai Airways Roblox

คุณสามารถสมัครงานได้ที่:
👉 https://recruitment.thai-airways.pattaramet.dev/

📌 ขั้นตอนการสมัคร:
1. กรอกใบสมัครออนไลน์
2. รอการตรวจสอบจากฝ่าย HR
3. เข้ารับการอบรม
4. ประกาศผลการคัดเลือก

หากมีคำถามเพิ่มเติมสามารถสอบถามได้เลยครับ 😊
        `);
    }

    // =============================
    // 🎫 2. TICKET AUTO SYSTEM
    // =============================
    const isTicket = msg.channel.name.startsWith("ticket");

    const ticketKeywords = [
        "royal silk",
        "royal first",
        "ยศ",
        "ซื้อ",
        "purchase",
        "payment",
        "รับยศ"
    ];

    const isTicketMsg = ticketKeywords.some(k => text.includes(k));

    if (isTicket && isTicketMsg) {
        return msg.reply(`
🙏 ขอบคุณสำหรับการติดต่อฝ่ายบริการลูกค้า Thai Airways Roblox

เพื่อให้เจ้าหน้าที่ดำเนินการได้เร็วที่สุด กรุณาส่งข้อมูลดังนี้:

1️⃣ หลักฐานการซื้อ (Screenshot / Receipt)
2️⃣ ชื่อผู้ใช้ Roblox

📌 หลังจากได้รับข้อมูลครบถ้วนแล้ว
เจ้าหน้าที่จะทำการตรวจสอบและดำเนินการให้โดยเร็วที่สุดครับ ✈️
        `);
    }

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