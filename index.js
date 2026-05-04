require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai");
const express = require("express");

// ----------------------
// ENV CHECK
// ----------------------
console.log("DISCORD_TOKEN Exists:", !!process.env.DISCORD_TOKEN);
console.log("GROQ_API_KEY Exists:", !!process.env.GROQ_API_KEY);

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
// COOLDOWN SYSTEM
// ----------------------
const cooldown = new Set();

// ----------------------
// READY
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

  // ==========================
  // TICKET SYSTEM
  // ==========================
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
Hello and thank you for contacting Thai Airways.

To verify your Royal Silk / Royal First rank, please provide:

1. Proof of purchase
2. Your Roblox username
3. Purchase details/order info

Our staff will assist you shortly.
`);
    }

    return message.reply(`
สวัสดีครับ ขอบคุณที่ติดต่อสายการบินไทย

สำหรับการรับยศ Royal Silk / Royal First กรุณาส่งข้อมูลดังนี้:

1. หลักฐานการซื้อ
2. ชื่อผู้ใช้ Roblox
3. รายละเอียดคำสั่งซื้อ

เจ้าหน้าที่จะดำเนินการให้โดยเร็วที่สุดครับ
`);
  }

  // ==========================
  // FAQ CHANNEL ONLY
  // ==========================


  // ==========================
  // COOLDOWN กัน spam
  // ==========================
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
You are an official Thai Airways Roblox assistant.

IMPORTANT:
- Understand typo
- Understand incomplete sentences
- Understand slang
- Understand Thai and English
- Reply in the same language as user

Company Info:
- Pilot applications available
- Cabin crew training every Saturday
- HR available in Discord
- Royal Silk available
- Royal First available
- Website: https://recruitment.thai-airways.pattaramet.dev/

If user asks unclear questions:
Politely ask for more details.

If user asks something outside company scope:
Tell them to contact HR.
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
    console.error(error.message);

    await message.reply(
      "ขออภัย ระบบ AI มีปัญหาชั่วคราว กรุณาติดต่อ HR"
    );
  }
});

// ----------------------
// LOGIN
// ----------------------
client.login(process.env.DISCORD_TOKEN);