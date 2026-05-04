require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai");
const express = require("express");

// ----------------------
// ENV CHECK
// ----------------------
if (!process.env.DISCORD_TOKEN) {
  throw new Error("DISCORD_TOKEN ไม่พบ");
}

if (!process.env.GROQ_API_KEY) {
  throw new Error("GROQ_API_KEY ไม่พบ");
}

// ----------------------
// EXPRESS SERVER
// ----------------------
const app = express();

app.get("/", (req, res) => {
  res.send("Thai Airways AI Bot Running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

// ----------------------
// DISCORD CLIENT
// ----------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ----------------------
// GROQ AI
// ----------------------
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1"
});

// ----------------------
// COOLDOWN
// ----------------------
const cooldown = new Set();

// ----------------------
// BOT READY
// ----------------------
client.once("clientReady", () => {
  console.log(`Bot online: ${client.user.tag}`);
});

// ----------------------
// MESSAGE EVENT
// ----------------------
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const text = message.content.toLowerCase();
  const channelName = message.channel.name.toLowerCase();

  // =====================================
  // JOB APPLICATION AUTO REPLY (ทุกห้อง)
  // =====================================
  const jobKeywords = [
    "สมัคร",
    "สมัครงาน",
    "งาน",
    "นักบิน",
    "ลูกเรือ",
    "พนักงาน",
    "apply",
    "job",
    "pilot",
    "crew",
    "career",
    "hr"
  ];

  const askingJob = jobKeywords.some(word =>
    text.includes(word)
  );

  if (askingJob) {
    const isEnglish = /[a-z]/.test(text);

    if (isEnglish) {
      return message.reply(`
Hello!

You can apply through our official website:
https://recruitment.thai-airways.pattaramet.dev/

Application process:
1. Submit application
2. HR review
3. Training/interview
4. Receive rank if accepted

For more help, please contact HR.
`);
    }

    return message.reply(`
สวัสดีครับ

สามารถสมัครงานผ่านเว็บไซต์ทางการได้ที่:
https://recruitment.thai-airways.pattaramet.dev/

ขั้นตอนสมัคร:
1. ส่งใบสมัคร
2. รอ HR ตรวจสอบ
3. เข้าฝึก/สัมภาษณ์
4. รับยศหากผ่าน

หากต้องการข้อมูลเพิ่มเติมสามารถติดต่อ HR ได้เลยครับ
`);
  }

  // =====================================
  // TICKET SYSTEM
  // =====================================
  const isTicketChannel =
    channelName.includes("ticket");

  if (
    isTicketChannel &&
    (
      text.includes("royal silk") ||
      text.includes("royal first") ||
      text.includes("rank") ||
      text.includes("ยศ") ||
      text.includes("ซื้อ") ||
      text.includes("purchase")
    )
  ) {
    const isEnglish = /[a-z]/.test(text);

    if (isEnglish) {
      return message.reply(`
Hello!

To verify your Royal Silk / Royal First rank, please provide:

1. Proof of purchase
2. Your Roblox username
3. Order details

Our staff will assist you shortly.
`);
    }

    return message.reply(`
สวัสดีครับ

สำหรับการรับยศ Royal Silk / Royal First กรุณาส่งข้อมูลดังนี้:

1. หลักฐานการซื้อ
2. ชื่อผู้ใช้ Roblox
3. รายละเอียดคำสั่งซื้อ

เจ้าหน้าที่จะดำเนินการให้ครับ
`);
  }

  // =====================================
  // AI CHAT ONLY IN SPECIFIC CHANNEL
  // =====================================
  const aiChannelName = "⌊📝⌉-thai-airways-ai";

  if (message.channel.name !== aiChannelName) {
    return;
  }

  // =====================================
  // COOLDOWN
  // =====================================
  if (cooldown.has(message.author.id)) {
    return;
  }

  cooldown.add(message.author.id);

  setTimeout(() => {
    cooldown.delete(message.author.id);
  }, 10000);

  try {
    await message.channel.sendTyping();

    const completion =
      await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: `
You are an official Thai Airways Roblox AI assistant.

Rules:
- Understand Thai and English
- Understand typo
- Understand incomplete sentences
- Reply in same language as user
- Be professional
- Answer airline related questions clearly

Company info:
- Recruitment website:
https://recruitment.thai-airways.pattaramet.dev/

- Pilot applications available
- Cabin crew training every Saturday
- HR support available
- Royal Silk available
- Royal First available

If you don't know answer:
Tell user to contact HR.
`
          },
          {
            role: "user",
            content: message.content
          }
        ],
        temperature: 0.7
      });

    const reply =
      completion.choices[0]?.message?.content ||
      "ขออภัย ระบบไม่สามารถตอบได้ในขณะนี้";

    await message.reply(reply);

  } catch (error) {
    console.error(error);

    await message.reply(
      "ขออภัย ระบบ AI มีปัญหาชั่วคราว กรุณาติดต่อ HR"
    );
  }
});

// ----------------------
// LOGIN
// ----------------------
client.login(process.env.DISCORD_TOKEN);