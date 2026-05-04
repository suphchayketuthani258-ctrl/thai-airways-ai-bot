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
// EXPRESS
// ----------------------
const app = express();

app.get("/", (req, res) => {
  res.send("Bot Running");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Web server running");
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
// GROQ
// ----------------------
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1"
});

// cooldown
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

  // สมัครงาน
  const jobKeywords = [
    "สมัคร",
    "สมัครงาน",
    "นักบิน",
    "ลูกเรือ",
    "พนักงาน",
    "apply",
    "pilot",
    "crew",
    "job"
  ];

  if (jobKeywords.some(word => text.includes(word))) {
    const isEnglish = /[a-z]/.test(text);

    if (isEnglish) {
      return message.reply(`
You can apply here:
https://recruitment.thai-airways.pattaramet.dev/

Please contact HR for more details.
`);
    }

    return message.reply(`
สามารถสมัครได้ที่:
https://recruitment.thai-airways.pattaramet.dev/

หากต้องการข้อมูลเพิ่มเติม กรุณาติดต่อ HR
`);
  }

  // ticket royal
  const isTicketChannel = channelName.includes("ticket");

  if (
    isTicketChannel &&
    (
      text.includes("royal silk") ||
      text.includes("royal first") ||
      text.includes("rank") ||
      text.includes("ยศ")
    )
  ) {
    return message.reply(`
กรุณาส่ง:

1. หลักฐานการซื้อ
2. Roblox Username
3. รายละเอียดคำสั่งซื้อ

เจ้าหน้าที่จะช่วยตรวจสอบให้ครับ
`);
  }

  // ต้อง mention bot ก่อนถาม AI
  const botMentioned = message.mentions.has(client.user);

  if (!botMentioned) return;

  if (cooldown.has(message.author.id)) return;

  cooldown.add(message.author.id);

  setTimeout(() => {
    cooldown.delete(message.author.id);
  }, 10000);

  try {
    const cleanMessage = message.content
      .replace(`<@${client.user.id}>`, "")
      .replace(`<@!${client.user.id}>`, "")
      .trim();

    const completion =
      await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: `
You are Thai Airways Roblox assistant.
Reply in same language as user.
Be helpful and professional.
`
          },
          {
            role: "user",
            content: cleanMessage
          }
        ]
      });

    const reply =
      completion.choices[0]?.message?.content ||
      "ไม่สามารถตอบได้ตอนนี้";

    await message.reply(reply);

  } catch (error) {
    console.log(error.message);
    await message.reply("ระบบ AI ขัดข้องชั่วคราว");
  }
});

// login
client.login(process.env.DISCORD_TOKEN);