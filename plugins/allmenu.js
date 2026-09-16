const { cmd, commands } = require("../arslan");
const moment = require("moment-timezone");
const { fakevCard } = require('../lib/fakevCard');

cmd({
    pattern: "menu",
    alias: ["commandlist", "allmenu", "help"],
    desc: "Afficher toutes les commandes disponibles",
    category: "system",
    filename: __filename,
}, async (conn, mek, m, { reply, config }) => {
    try {
        let totalCommands = 0;
        let grouped = {};

        // Regrouper les commandes par catégorie
        for (const cmd of commands) {
            if (!cmd.pattern || !cmd.category) continue;

            totalCommands++;

            if (!grouped[cmd.category]) {
                grouped[cmd.category] = [];
            }

            grouped[cmd.category].push(cmd.pattern);
        }

        // Noms des catégories affichées
        const categoryNames = {
            main: "MAIN",
            owner: "OWNER",
            groupe: "GROUPE",
            group: "GROUPE",
            settings: "SETTINGS",
            download: "DOWNLOAD",
            system: "SYSTEM",
            admin: "ADMIN",
            tools: "TOOLS",
            fun: "FUN",
            search: "SEARCH",
            ai: "AI",
            media: "MEDIA"
        };

        // Emojis des catégories
        const categoryIcons = {
            MAIN: "🚨",
            OWNER: "🛰️",
            GROUPE: "🗃️",
            SETTINGS: "⚙️",
            DOWNLOAD: "⏳",
            SYSTEM: "🛠️",
            ADMIN: "👑",
            TOOLS: "🧰",
            FUN: "🎭",
            SEARCH: "🔎",
            AI: "🤖",
            MEDIA: "🎬"
        };

        // Générer les catégories
        let menuText = "";

        for (const cat in grouped) {
            const category =
                categoryNames[cat.toLowerCase()] || cat.toUpperCase();

            const icon = categoryIcons[category] || "📂";

            menuText += `\n╭━━━  ${category} ${icon}  ━━━┈⊷\n`;

            menuText += grouped[cat]
                .map(command => `┃ › ${command}`)
                .join("\n");

            menuText += `\n╰━━━━━━━━━━━━━━━━━┈⊷\n`;
        }

        // Heure et date
        const time = moment()
            .tz("Africa/Kampala")
            .format("HH:mm:ss");

        const date = moment()
            .tz("Africa/Kampala")
            .format("DD/MM/YYYY");

        const botName = config?.BOT_NAME;
        const botPP = config?.BOT_PP || config?.IMAGE_PATH;

        const caption = `
╭━━━  𝐀𝐍𝐎𝐒_𝐕𝐎𝐋𝐃𝐈𝐆𝐎𝐀𝐃_𝐌𝐈𝐍𝐈_𝐌𝐃  ━━━┈⊷
┃ ✦╭─────────────┈⊷
┃ ✦│▸ Total des commandes : ${totalCommands}
┃ ✦│▸ Heure              : ${time}
┃ ✦│▸ Date               : ${date}
┃ ✦│▸ Préfixe            : ${config?.PREFIX || '.'}
┃ ✦╰─────────────┈⊷
╰━━━━━━━━━━━━┈⊷
${menuText}
`.trim();

        const contextInfo = {
            forwardingScore: 999,
            isForwarded: true,
            mentionedJid: [m.sender],
            forwardedNewsletterMessageInfo: {
                newsletterJid: config?.NEWSLETTER_JID,
                newsletterName: botName,
                serverMessageId: 2,
            },
        };

        try {
            await conn.sendMessage(
                m.chat,
                {
                    image: { url: botPP },
                    caption,
                    contextInfo,
                },
                { quoted: fakevCard }
            );

        } catch (imgErr) {
            console.error(
                "AllMenu image send failed, falling back to text:",
                imgErr.message
            );

            await conn.sendMessage(
                m.chat,
                {
                    text: caption,
                    contextInfo,
                },
                { quoted: fakevCard }
            );
        }

    } catch (err) {
        console.error("AllMenu Error:", err);
        reply("❌ Erreur lors de la génération du menu.");
    }
});