client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const text = message.content.toLowerCase();
  const channelName = message.channel.name.toLowerCase();

  // ==========================
  // JOB APPLICATION AUTO REPLY
  // ตอบทุกห้อง
  // ==========================
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
  // AI ตอบเฉพาะตอน mention bot
  // ==========================
  const botMentioned = message.mentions.has(client.user);

  if (!botMentioned) {
    return;
  }

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
You are an official Thai Airways Roblox assistant.

IMPORTANT:
- Understand typo
- Understand incomplete sentences
- Understand slang
- Understand Thai and English
- Reply in same language as user

Company Info:
- Recruitment website:
https://recruitment.thai-airways.pattaramet.dev/
- Pilot applications available
- Cabin crew training every Saturday
- HR support available
- Royal Silk available
- Royal First available

If question is unclear:
Ask for more details politely.

If outside company scope:
Tell user to contact HR.
`
          },
          {
            role: "user",
            content: cleanMessage
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