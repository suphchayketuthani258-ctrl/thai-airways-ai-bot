require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai");
const fs = require("fs");
const db = require("./database");

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent
]
});

const groq = new OpenAI({
apiKey: process.env.GROQ_API_KEY,
baseURL:"https://api.groq.com/openai/v1"
});

const memory = new Map();
const cooldown = new Set();

// ================= SYSTEM PROMPT =================
const SYSTEM = `
You are Thai Airways Roblox Airline AI.

RULES:
- HR system only
- Never guess
- If unknown → HR only
- Professional tone

You can use:
- flights database
- info database
- announcements
- Thailand time
`;

client.on("messageCreate", async(msg)=>{

if(msg.author.bot) return;

// cooldown
if(cooldown.has(msg.author.id))
return msg.reply("wait");

cooldown.add(msg.author.id);
setTimeout(()=>cooldown.delete(msg.author.id),10000);

// ================= DATA =================
const flights = db.getFlights()
.map(f=>`${f.id}: ${f.from} → ${f.to} ${f.time}`)
.join("\n");

const info = db.getInfo()
.map(i=>`${i.key}: ${i.value}`)
.join("\n");

const timeTH = new Date().toLocaleString("th-TH",{timeZone:"Asia/Bangkok"});

// ================= MEMORY =================
let history = memory.get(msg.author.id)||[];

history.push({role:"user",content:msg.content});
history = history.slice(-6);
memory.set(msg.author.id,history);

// ================= AI =================
const res = await groq.chat.completions.create({
model:"llama-3.1-8b-instant",
messages:[
{
role:"system",
content: SYSTEM + `

FLIGHTS:
${flights}

INFO:
${info}

TIME TH:
${timeTH}
`
},
...history
],
temperature:0.6,
max_tokens:500
});

const reply = res.choices[0].message.content;

history.push({role:"assistant",content:reply});
memory.set(msg.author.id,history);

msg.reply(reply);
});

client.login(process.env.DISCORD_TOKEN);