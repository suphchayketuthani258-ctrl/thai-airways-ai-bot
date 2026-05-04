require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai");
const express = require("express");

// ----------------------
// เช็ค Environment Variables
// ----------------------
console.log("DISCORD_TOKEN Exists:", !!process.env.DISCORD_TOKEN);
console.log("GROQ_API_KEY Exists:", !!process.env.GROQ_API_KEY);

// ถ้าไม่มี key ให้หยุดทันที
if (!process.env.DISCORD_TOKEN) {
  throw new Error("DISCORD_TOKEN ไม่พบใน Environment Variables");
}

if (!process.env.GROQ_API_KEY) {
  throw new Error("GROQ_API_KEY ไม่พบใน Environment Variables");
}

// ----------------------
// Express Server (กัน host บางเจ้าปิด app)
// ----------------------
const app = express();

app.get("/", (req, res) => {
  res.send("Thai Airways AI Bot is running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

// ----------------------
// Discord Client
// ----------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ----------------------
// Groq AI
// ----------------------
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1"
});

// ----------------------
// Bot Ready
// ----------------------
client.once("clientReady", () => {
  console.log(`Bot online: ${client.user.tag}`);
});

// ----------------------
// Message Event
// ----------------------
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const text = message.content.toLowerCase();

  const keywords = [
    "สมัคร",
    "สมัครงาน",
    "นักบิน",
    "ลูกเรือ",
    "พนักงาน",
    "hr",
    "career",
    "apply"
  ];

  const shouldReply = keywords.some(word =>
    text.includes(word)
  );

  if (!shouldReply) return;

  try {
    await message.channel.sendTyping();

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `
คุณคือแอดมินของสายการบินไทยใน Roblox

ข้อมูลบริษัท:
- สมัครงาน: https://yourwebsite.com
- ฝึกลูกเรือทุกวันเสาร์
- ติดต่อ HR ผ่าน Discord
- รับนักบินอายุ 15+
- ต้องตอบสุภาพ เป็นกันเอง และเหมือนแอดมินจริง

ถ้าไม่รู้คำตอบ ให้แนะนำติดต่อ HR
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
      "ขออภัย ไม่สามารถตอบได้ในขณะนี้";

    await message.reply(reply);

  } catch (error) {
    console.error("AI Error:", error.message);
    await message.reply(
      "ขออภัย ระบบ AI มีปัญหาชั่วคราว กรุณาติดต่อ HR ครับ"
    );
  }
});

// ----------------------
// Login Discord
// ----------------------
client.login(process.env.DISCORD_TOKEN);