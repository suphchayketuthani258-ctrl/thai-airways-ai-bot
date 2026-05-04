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

// =============================
// GROQ AI
// =============================
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
// SYSTEM PROMPT
// =============================
const SYSTEM = "You are Thai Airways Roblox Customer Service AI.";

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

  const channelName = msg.channel.name.toLowerCase();
  const text = msg.content.toLowerCase();

  // =============================
  // LOCK CHANNEL
  // =============================
  if (channelName !== "⌊📝⌉-thai-airways-ai") return;

  // =============================
  // COOLDOWN
  // =============================
  if (cooldown.has(msg.author.id)) {
    return msg.reply("⏳ รอ 10 วิ");
  }

  cooldown.add(msg.author.id);
  setTimeout(() => cooldown.delete(msg.author.id), 10000);

  // =============================
  // DATABASE (FLIGHTS)
  // =============================
  const flights = db.getFlights();

  const flightText = flights.length
    ? flights.map(f => `${f.id}: ${f.from} → ${f.to} ${f.time}`).join("\n")
    : "NO FLIGHTS";

  // =============================
  // 🎫 TICKET FIX
  // =============================
  const isTicketChannel = channelName.includes("ticket");

  const normalized = text
    .replace(/\s+/g, " ")
    .replace(/rotal/g, "royal");

  const matchTicket =
    normalized.includes("royal") ||
    normalized.includes("silk") ||
    normalized.includes("ยศ") ||
    normalized.includes("ซื้อ") ||
    normalized.includes("rank") ||
    normalized.includes("claim") ||
    normalized.includes("verify");

  if (isTicketChannel && matchTicket) {
    return msg.reply(
      `🙏 ขอบคุณที่ติดต่อฝ่ายบริการลูกค้า  
กรุณาส่ง:  
1️⃣ หลักฐานการซื้อ  
2️⃣ Roblox username  

✈️ เจ้าหน้าที่จะดำเนินการเร็วที่สุด`
    );
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

  // =============================
  // AI RESPONSE
  // =============================
  try {
    await msg.channel.sendTyping();

    const res = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `${SYSTEM}\n\nFLIGHTS:\n${flightText}`
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
    console.error(err);
    msg.reply("❌ error");
  }
});

// =============================
// LOGIN
// =============================
client.login(process.env.DISCORD_TOKEN);