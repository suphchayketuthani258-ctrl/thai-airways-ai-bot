require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai");

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

client.once("clientReady", () => {
  console.log(`Bot online: ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const text = message.content.toLowerCase();

  const keywords = [
    "สมัคร",
    "สมัครงาน",
    "นักบิน",
    "ลูกเรือ",
    "พนักงาน",
    "hr"
  ];

  const shouldReply = keywords.some(word => text.includes(word));

  if (!shouldReply) return;

  try {
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

ตอบให้สุภาพ กระชับ และเหมือนแอดมินจริง
`
        },
        {
          role: "user",
          content: message.content
        }
      ]
    });

    const reply =
      completion.choices[0].message.content;

    message.reply(reply);

  } catch (error) {
    console.log(error);
    message.reply("ระบบ AI ขัดข้องชั่วคราว");
  }
});

client.login(process.env.DISCORD_TOKEN);