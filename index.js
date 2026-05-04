require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai");
const express = require("express");

// =============================
// ENV CHECK
// =============================
if (!process.env.DISCORD_TOKEN) {
    throw new Error("ไม่พบ DISCORD_TOKEN");
}

if (!process.env.GROQ_API_KEY) {
    throw new Error("ไม่พบ GROQ_API_KEY");
}

// =============================
// EXPRESS SERVER
// =============================
const app = express();

app.get("/", (req, res) => {
    res.send("Thai Airways AI Bot Running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Web server running on port ${PORT}`);
});

// =============================
// DISCORD CLIENT
// =============================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// =============================
// GROQ AI
// =============================
const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1"
});

// =============================
// COOLDOWN SYSTEM
// =============================
const cooldown = new Set();

// =============================
// MEMORY SYSTEM (NEW)
// =============================
const memory = new Map();

// =============================
// SYSTEM PROMPT (UPGRADED)
// =============================
const SYSTEM_PROMPT = `
You are an official AI Assistant for "Thai Airways Roblox Airline System".

⚠️ RULES:
- Professional airline HR + support assistant
- NEVER invent information
- If unsure → say "Please contact HR for confirmation"
- This is ONLY Roblox airline roleplay system

🧠 THINKING:
1. Understand intent (job / ticket / support / general)
2. Use company info if available
3. If unknown → HR only
4. Be clear and structured

🌐 LANGUAGE:
- Reply in same language as user
- Be polite and professional

🏢 COMPANY INFO:

Recruitment:
- Website: https://recruitment.thai-airways.pattaramet.dev/
- Jobs: Pilot, Cabin Crew, Ground Staff
- Process: Apply → HR Review → Training → Approval

Ticket System:
- Royal Silk = Premium class
- Royal First = Highest class
- Requires proof + Roblox username

EXECUTIVE TEAM:
- Fino251217: President / HR Chief / Founder
- papangkor559: CFO / CCO
- TH3JJ_TH: Digital Director
- 99KLSH: Operations Director

🚨 IMPORTANT:
If not in system → ALWAYS say contact HR
`;

// =============================
// READY EVENT
// =============================
client.once("ready", () => {
    console.log(`✅ Bot online: ${client.user.tag}`);
});

// =============================
// MESSAGE EVENT
// =============================
client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    const text = message.content.toLowerCase();
    const channelName = message.channel.name.toLowerCase();

    // =====================================
    // JOB SYSTEM
    // =====================================
    const jobKeywords = [
        "สมัคร",
        "สมัครงาน",
        "งาน",
        "career",
        "job",
        "apply",
        "pilot",
        "crew",
        "hr",
        "นักบิน",
        "ลูกเรือ",
        "พนักงาน"
    ];

    const askingJob = jobKeywords.some(word => text.includes(word));

    if (askingJob) {
        const isEnglish = /[a-z]/.test(text);

        if (isEnglish) {
            return message.reply(`
Hello!

Apply here:
https://recruitment.thai-airways.pattaramet.dev/

Steps:
1. Apply
2. HR Review
3. Training
4. Approval
`);
        }

        return message.reply(`
สวัสดีครับ

สมัครงาน:
https://recruitment.thai-airways.pattaramet.dev/

ขั้นตอน:
1. สมัคร
2. HR ตรวจสอบ
3. ฝึกอบรม
4. อนุมัติ
`);
    }

    // =====================================
    // TICKET SYSTEM
    // =====================================
    const isTicketChannel = channelName.includes("ticket");

    const ticketKeywords = [
        "royal silk",
        "royal first",
        "rank",
        "ยศ",
        "ซื้อ",
        "purchase"
    ];

    const askingTicket = ticketKeywords.some(word =>
        text.includes(word)
    );

    if (isTicketChannel && askingTicket) {
        const isEnglish = /[a-z]/.test(text);

        if (isEnglish) {
            return message.reply(`
Hello!

Please provide:
1. Purchase proof
2. Roblox username
3. Order details
`);
        }

        return message.reply(`
สวัสดีครับ

กรุณาส่ง:
1. หลักฐานซื้อ
2. Roblox username
3. รายละเอียด
`);
    }

    // =====================================
    // AI CHANNEL ONLY
    // =====================================
    const aiChannelName = "⌊📝⌉-thai-airways-ai";

    if (message.channel.name !== aiChannelName) {
        return;
    }

    // =====================================
    // COOLDOWN
    // =====================================
    if (cooldown.has(message.author.id)) {
        return message.reply("กรุณารอ 10 วินาทีก่อนใช้งาน AI อีกครั้ง");
    }

    cooldown.add(message.author.id);

    setTimeout(() => {
        cooldown.delete(message.author.id);
    }, 10000);

    try {
        await message.channel.sendTyping();

        // =============================
        // MEMORY UPDATE
        // =============================
        let history = memory.get(message.author.id) || [];

        history.push({
            role: "user",
            content: message.content
        });

        history = history.slice(-6);

        memory.set(message.author.id, history);

        // =============================
        // AI REQUEST
        // =============================
        const completion = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
                {
                    role: "system",
                    content: SYSTEM_PROMPT
                },
                ...history
            ],
            temperature: 0.6,
            max_tokens: 500
        });

        const reply =
            completion.choices[0]?.message?.content ||
            "ขออภัย ระบบไม่สามารถตอบได้ในขณะนี้";

        // add bot response to memory
        history.push({
            role: "assistant",
            content: reply
        });

        memory.set(message.author.id, history);

        await message.reply(reply);

    } catch (error) {
        console.error(error);

        await message.reply("ขออภัย ระบบ AI ขัดข้อง กรุณาติดต่อ HR");
    }
});

// =============================
// LOGIN
// =============================
client.login(process.env.DISCORD_TOKEN);