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
// EXPRESS SERVER (กันบอทดับบน hosting)
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
// READY
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
    // JOB APPLICATION AUTO REPLY
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

You can apply through our official website:
https://recruitment.thai-airways.pattaramet.dev/

Application steps:
1. Submit application
2. HR review
3. Training/interview
4. Receive rank if accepted

For more info contact HR.
`);
        }

        return message.reply(`
สวัสดีครับ

สามารถสมัครงานผ่านเว็บไซต์ทางการได้ที่:
https://recruitment.thai-airways.pattaramet.dev/

ขั้นตอน:
1. ส่งใบสมัคร
2. HR ตรวจสอบ
3. ฝึกอบรม/สัมภาษณ์
4. รับยศหากผ่าน

สอบถามเพิ่มเติมติดต่อ HR ได้เลยครับ
`);
    }

    // =====================================
    // ROYAL SILK / ROYAL FIRST TICKET SYSTEM
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

For Royal Silk / Royal First verification please provide:

1. Purchase proof
2. Roblox username
3. Order details

Staff will assist you shortly.
`);
        }

        return message.reply(`
สวัสดีครับ

สำหรับการรับยศ Royal Silk / Royal First กรุณาส่ง:

1. หลักฐานการซื้อ
2. ชื่อ Roblox
3. รายละเอียดคำสั่งซื้อ

เจ้าหน้าที่จะดำเนินการให้ครับ
`);
    }

    // =====================================
    // AI CHAT ONLY SPECIFIC CHANNEL
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

        const completion = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
                {
                    role: "system",
                    content: `
You are the official Thai Airways Roblox AI Assistant.

Rules:
- Understand Thai and English
- Understand typos
- Reply in same language as user
- Be professional
- Help users clearly

COMPANY INFO:
- Recruitment website:
https://recruitment.thai-airways.pattaramet.dev/

- Pilot applications available
- Cabin crew training every Saturday
- HR support available
- Royal Silk available
- Royal First available

EXECUTIVE TEAM:

Fino / Fino251217
- President of Thai Airways Roblox
- Chief Human Resources Officer
- Co-founder
- Oversees the entire organization
- Known as a good leader

ฟิโน / Fino251217
- ประธานบริหาร
- ประธานฝ่ายทรัพยากรบุคคล
- ผู้ร่วมก่อตั้ง

--------------------------------

papangkor559
- Chief Financial Officer
- Chief Commercial Officer

ภาษาไทย:
- ประธานเจ้าหน้าที่สายการเงินการบัญชี
- ประธานเจ้าหน้าที่สายการพาณิชย์

--------------------------------

TH3JJ_TH
- Director of Digital Center

ภาษาไทย:
- ผู้อำนวยการศูนย์ดิจิตอลการบินไทย

--------------------------------

99KLSH
- Director of Inflight Operations
- Director of Ground Services

ภาษาไทย:
- ผู้อำนวยการฝ่ายปฏิบัติการบนเครื่องบิน
- ผู้อำนวยการฝ่ายบริการภาคพื้นดิน

If you don't know something:
Tell users to contact HR.
`
                },
                {
                    role: "user",
                    content: message.content
                }
            ],
            temperature: 0.7,
            max_tokens: 500
        });

        const reply =
            completion.choices[0]?.message?.content ||
            "ขออภัย ระบบไม่สามารถตอบได้ในขณะนี้";

        await message.reply(reply);

    } catch (error) {
        console.error(error);

        await message.reply(
            "ขออภัย ระบบ AI ขัดข้องชั่วคราว กรุณาติดต่อ HR"
        );
    }
});

// =============================
// LOGIN
// =============================
client.login(process.env.DISCORD_TOKEN);