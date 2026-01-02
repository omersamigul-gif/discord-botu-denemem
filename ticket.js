const fs = require('fs');

// komutları yönetmek için bu fonksiyonu kullanıcaz
module.exports = async (client, message) => {
    if (message.author.bot) return;

    // ayarları dosyadan oku
    let ayarlar = JSON.parse(fs.readFileSync("./ayarlar.json", "utf8"));

    // 1. sunucu sayısı komudu
    if (message.content === '!sunucu-sayisi') {
        const sunucular = client.guilds.cache.map(g => `isim: ${g.name} | id: ${g.id}`).join('\n');
        const toplam = client.guilds.cache.size;
        return message.channel.send(`**toplam ${toplam} sunucudayım!**\n\n${sunucular}`);
    }

    // 2. ticket rol ayarlama (kalıcı)
    if (message.content.startsWith('!ticket-rol')) {
        const rol = message.mentions.roles.first();
        if (!rol) return message.reply('bi rol etiketlemelisin dostum! 🙄');
        
        ayarlar.ticketRolID = rol.id;
        fs.writeFileSync("./ayarlar.json", JSON.stringify(ayarlar, null, 2)); // dosyaya kaydet
        return message.reply(`yetkili rolü başarıyla ayarlandı ve kaydedildi: **${rol.name}** ✅`);
    }

    // 3. ticket kategori ayarlama (kalıcı)
    if (message.content.startsWith('!ticket-kategori')) {
        const args = message.content.split(' ');
        if (!args[1]) return message.reply('kategori id\'sini girmelisin! 🧐');
        
        ayarlar.ticketKategoriID = args[1];
        fs.writeFileSync("./ayarlar.json", JSON.stringify(ayarlar, null, 2)); // dosyaya kaydet
        return message.reply(`ticket kategorisi kaydedildi! ✅`);
    }

    // 4. ticket açma komudu
    if (message.content === '!ticket') {
        const rolID = ayarlar.ticketRolID;
        const katID = ayarlar.ticketKategoriID;

        if (!rolID || !katID) {
            return message.reply('önce rol ve kategori ayarlarını yapmalısın! ❌');
        }

        const kanal = await message.guild.channels.create({
            name: `ticket-${message.author.username}`,
            type: 0, 
            parent: katID,
            permissionOverwrites: [
                {
                    id: message.guild.id, // @everyone
                    deny: ['ViewChannel'],
                },
                {
                    id: message.author.id, // açan kişi
                    allow: ['ViewChannel', 'SendMessages'],
                },
                {
                    id: rolID, // yetkili rol
                    allow: ['ViewChannel', 'SendMessages'],
                },
            ],
        });

        message.reply(`ticket kanalın açıldı, yetkililer yolda! 🎫 -> ${kanal}`);
    }
};