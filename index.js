// Gerekli ortam değişkeni dosyasını yükle (.env)
require('dotenv').config(); 

// Gerekli Discord modüllerini içeri aktar
const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionFlagsBits,
    Partials,
    EmbedBuilder,
    PermissionsBitField 
} = require('discord.js');

// Botu 7/24 aktif tutmak için Express modülleri
const express = require('express');
const app = express();
const port = 3000; 

// Botu uyandırma fonksiyonu (Uptime Robot için)
function keepAlive() {
    app.get('/', (req, res) => {
        res.send('Bot aktif ve çalışıyor!'); 
    });

    app.listen(port, () => {
        console.log(`Web sunucusu ${port} portunda çalışıyor.`);
    });
}

// Botu başlatmadan hemen önce bu fonksiyonu çağır
keepAlive();

// LOG KANALININ ID'sini buraya GİRİN!
// Bu ID'yi kendi log kanalınızın ID'siyle değiştirin.
const LOG_CHANNEL_ID = "1376137436391804938"; 

// Tokeni .env dosyasından güvenli bir şekilde çeker
const BOT_TOKEN = process.env.DISCORD_TOKEN; 

// 1. INTENTS VE PARTIALS
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
    ],
    partials: [Partials.Channel, Partials.GuildMember, Partials.Message, Partials.User],
    
    sweepers: {
        users: {
            filter: () => null,
            interval: 3600,
        },
    },
});

// 2. ON_READY OLAYI
client.once('clientReady', () => {
    console.log('-------------------------------');
    console.log(`Bot olarak giriş yapıldı: ${client.user.tag}`);
    console.log('-------------------------------');
});

// ILK KOMUTLAR VE ONLARIN ORTAK TANIMLARI (PREFİX)
const prefix = '!';

client.on('messageCreate', async message => { 
    if (message.author.bot || !message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    // --- Yardımcı fonksiyon: Loglama ---
    const sendLog = async (embed) => {
        const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
            try {
                await logChannel.send({ embeds: [embed] });
            } catch (error) {
                console.error("Log kanalı hatası:", error);
            }
        }
    };

    // DÜĞME (BUTTON) ETKİLEŞİMLERİNİ YAKALAMA
client.on('interactionCreate', async interaction => {
    // Sadece düğme etkileşimlerini dinle
    if (!interaction.isButton()) return;

    // Düğmenin ID'sine göre işlem yap
    if (interaction.customId === 'open_ticket') {
        // Ticket açma düğmesine basıldı

        // Kullanıcıya hemen cevap veriyoruz (bu cevap sadece kullanıcıya görünür)
        await interaction.deferReply({ ephemeral: true });

        // 1. Ticket Kanalının Adını Belirle
        const ticketChannelName = `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

        // Kullanıcının daha önce ticket açıp açmadığını kontrol edebiliriz
        // Basitlik için bu adımı atlayıp direkt oluşturuyoruz.

        // 2. Kanalı Oluştur
        const channel = await interaction.guild.channels.create({
            name: ticketChannelName,
            type: ChannelType.GuildText,
            parent: null, // İsteğe bağlı: Ticket kategorisi ID'sini buraya yazabilirsin. Şimdilik kategorisiz kalsın.
            permissionOverwrites: [
                {
                    // Herkesin izinlerini ayarla (kanalı görmesinler)
                    id: interaction.guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    // Ticket açan kullanıcının izinlerini ayarla (kanalı görsün)
                    id: interaction.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                },
                {
                    // Rol ID'si: Destek Ekibi/Moderatör Rolünün ID'sini buraya girin.
                    // Şimdilik sadece Yönetici (Administrator) iznine sahip olanlar görsün.
                    id: interaction.guild.roles.cache.find(r => r.permissions.has(PermissionFlagsBits.Administrator)).id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                },
            ],
        });

        // 3. Kullanıcıya Bildirim Gönder
        await interaction.editReply({
            content: `Destek talebin açıldı! Lütfen yeni kanalın olan ${channel} adresine git.`,
            ephemeral: true
        });

        // 4. Ticket Kanalına Hoş Geldiniz Mesajı ve Kapat Düğmesi Gönder

        // Kapat Düğmesini Oluştur
        const closeButtonRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket') // Kapatma Düğmesinin ID'si
                    .setLabel('❌ Ticket Kapat')
                    .setStyle(ButtonStyle.Danger), // Kırmızı renk
            );

        // Hoş Geldiniz Mesajı
        await channel.send({
            content: `Merhaba ${interaction.user}! Hoş geldin. Destek ekibimiz en kısa sürede seninle ilgilenecektir. \n\nTicket'ı kapatmak için aşağıdaki düğmeye tıkla.`,
            components: [closeButtonRow]
        });

    } 
    
    // Ticket Kapatma Düğmesine Basıldığında
    else if (interaction.customId === 'close_ticket') {
        // Sadece kanalın içindeki Kapat düğmesinden gelmelidir.
        if (!interaction.channel.name.startsWith('ticket-')) {
            return interaction.reply({ content: 'Bu bir ticket kanalı değil.', ephemeral: true });
        }

        // Kullanıcıya cevap ver
        await interaction.deferReply();

        // Ticket kanalını 5 saniye sonra sil
        await interaction.channel.send('Ticket 5 saniye içinde kapatılacak ve silinecektir.');
        
        // 5 saniye bekle
        setTimeout(() => {
            interaction.channel.delete();
        }, 5000); 

        await interaction.deleteReply();
    }
});

    // 1. KOMUT: !merhaba
    if (command === 'merhaba') {
        message.channel.send(`Merhaba, **${message.author.username}**! Ben med1wsg tarafından yapılmış メッド#4452 botu!`);
    }

    // 2. KOMUT: !kimim
    else if (command === 'kimim') {
        const joinDate = message.member.joinedAt.toLocaleDateString("tr-TR");

    message.channel.send(
        `**${message.author.username}** hakkında bilgiler:\n` +
        `> **Discord ID:** ${message.author.id}\n` +
        `> **Sunucuya Katılım Tarihi:** ${joinDate}`
    );
}

// Ticket Kurulum Komutu
else if (command === 'ticket-setup') {
    // Yöneticilerin (Administrator) bu komutu kullanabilmesi için izin kontrolü
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply("Bu komutu kullanmak için Yönetici (Administrator) iznine sahip olmalısın.");
    }

    // 1. Ticket Açma Düğmesini Hazırla
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('open_ticket') // Düğmenin benzersiz ID'si
                .setLabel('📩 Destek Talebi Aç') // Düğme üzerindeki yazı
                .setStyle(ButtonStyle.Primary), // Mavi renk
        );

    // 2. Mesajı Gönder
    await message.channel.send({
        content: 'Aşağıdaki düğmeye tıklayarak destek talebi (ticket) oluşturabilirsin. Yetkililer kısa süre içinde seninle ilgilenecektir.',
        components: [row], // Mesaja düğmeyi ekle
    });

    message.delete(); // Kurulum komutunu silebiliriz
}

// 3. KOMUT: !zar
else if (command === 'zar') {
    const zar = Math.floor(Math.random() * 6) + 1; 
    message.channel.send(`${message.author.username}, zarın **${zar}** geldi!`);
}

    // 4. KOMUT: !ping 
    else if (command === 'ping') {
        const latency = Math.round(client.ws.ping);

        const pingEmded = new EmbedBuilder()
            .setColor(0x371d5d)
            .setTitle('Pong!')
            .setDescription(`**Gecikme (Latency):** ${latency}ms\n\n*(Bu değer, botun Discord sunucularına yanıt verme hızını gösterir.)*`)
            .setTimestamp();

        message.channel.send({ embeds: [pingEmded] });
    }
    
    // 5. KOMUT: !sil [miktar] - LOG SİSTEMİ EKLENDİ
    else if (command === 'sil') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.channel.send('Bu komutu kullanmak için **Mesajları Yönet** yetkisine sahip olmalısın.');
        }

        const amount = parseInt(args[0]) + 1;

        if (isNaN(amount) || amount <= 1 || amount > 100) {
            return message.channel.send('Lütfen 1 ile 99 arasında bir sayı girin.');
        }

        try {
            const messages = await message.channel.bulkDelete(amount, true); 

            // --- LOG KAYDI OLUŞTURMA ---
            const logEmbed = new EmbedBuilder()
                .setColor(0x371d5d)
                .setTitle('🗑 TOPLU MESAJ SİLİNDİ')
                .addFields(
                    { name: 'Kanal', value: `#${message.channel.name}`, inline: true },
                    { name: 'Yetkili', value: `${message.author.tag}`, inline: true },
                    { name: 'Miktar', value: `${messages.size - 1} adet`, inline: true }
                )
                .setTimestamp();
            await sendLog(logEmbed);

            // --- İŞLEM KANALINA BİLDİRİM ---
            const deleteEmbed = new EmbedBuilder()
                .setColor(0x00A388)
                .setDescription(`🗑 **${messages.size - 1}** adet mesaj başarıyla silindi.`)
                .setFooter({ text: `Yetkili: ${message.author.tag}` });
                
            const sentMessage = await message.channel.send({ embeds: [deleteEmbed] });
            setTimeout(() => sentMessage.delete(), 5000);

        } catch (error) {
            console.error(error);
            message.channel.send(`Mesajları silerken bir hata oluştu: ${error.message}`);
        }
    }

    // 6. KOMUT: !mute @kullanıcı [süre] (TIMEOUT KULLANIR)
    else if (command === 'mute') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return message.channel.send('Bu komutu kullanmak için **Üyeleri Denetle** yetkisine sahip olmalısın.');
        }

        const targetUser = message.mentions.members.first();
        if (!targetUser) {
            return message.channel.send('Lütfen susturulacak bir kullanıcı etiketleyin.');
        }

        const durationArg = args[1];
        if (!durationArg) {
            return message.channel.send('Lütfen bir süre belirtin (Örn: 5m, 1h).');
        }

        // SÜRE HESAPLAMALARI
        const parseDuration = (dur) => {
            const time = parseInt(dur);
            if (dur.endsWith('s')) return time * 1000;
            if (dur.endsWith('m')) return time * 60 * 1000;
            if (dur.endsWith('h')) return time * 60 * 60 * 1000;
            if (dur.endsWith('d')) return time * 24 * 60 * 60 * 1000;
            return null;
        };

        const durationMs = parseDuration(durationArg);
        if (!durationMs || durationMs < 60000) {
            return message.channel.send('Geçerli bir süre girin (Örn: 1m, 30m, 2h). Süre 1 dakikadan az olamaz.');
        }

        try {
            await targetUser.timeout(durationMs, 'Moderatör tarafından susturuldu.'); 

            const durationFormatted = durationArg; 

            // 1. LOG KAYDI OLUŞTURMA
            const logEmbed = new EmbedBuilder()
                .setColor(0x371d5d)
                .setTitle('🔇 KULLANICI SUSTURULDU (MUTE/TIMEOUT)')
                .addFields(
                    { name: 'Kullanıcı', value: `${targetUser.user.tag} (${targetUser.id})`, inline: false },
                    { name: 'Yetkili', value: `${message.author.tag}`, inline: true },
                    { name: 'Süre', value: `${durationFormatted}`, inline: true }
                )
                .setTimestamp();
            await sendLog(logEmbed);

            // 2. İŞLEM KANALINA BİLDİRİM
            message.channel.send(`${targetUser.user.tag} kullanıcısı ${durationFormatted} süreyle susturuldu.`);

        } catch (error) {
            console.error("MUTE HATASI:", error);
            message.channel.send('Susturma işlemi sırasında bir hata oluştu: ' + error.message);
        }
    }

    // 7. KOMUT: !kick @kullanıcı [sebep]
    else if (command === 'kick') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
            return message.channel.send('Bu komutu kullanmak için **Üyeleri Atma** yetkisine sahip olmalısın.');
        }

        const targetUser = message.mentions.members.first();
        if (!targetUser) {
            return message.channel.send('Lütfen atılacak bir kullanıcı etiketleyin.');
        }

        const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi.';
        
        try {
            await targetUser.kick(reason);

            // 1. LOG KAYDI OLUŞTURMA
            const logEmbed = new EmbedBuilder()
                .setColor(0x371d5d)
                .setTitle('🚨 KULLANICI ATILDI (KICK)')
                .addFields(
                    { name: 'Kullanıcı', value: `${targetUser.user.tag} (${targetUser.id})`, inline: false },
                    { name: 'Yetkili', value: `${message.author.tag}`, inline: true },
                    { name: 'Sebep', value: reason, inline: true }
                )
                .setTimestamp();
            await sendLog(logEmbed);

            // 2. İŞLEM KANALINA BİLDİRİM
            message.channel.send(`${targetUser.user.tag} kullanıcısı sunucudan atıldı. Sebep: ${reason}`);

        } catch (error) {
            console.error("KICK HATASI:", error);
            message.channel.send('Atma işlemi sırasında bir hata oluştu: ' + error.message);
        }
    }

    // 8. KOMUT: !ban @kullanıcı [sebep]
    else if (command === 'ban') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return message.channel.send('Bu komutu kullanmak için **Üyeleri Yasakla** yetkisine sahip olmalısın.');
        }

        const targetUser = message.mentions.members.first();
        if (!targetUser) {
            return message.channel.send('Lütfen yasaklanacak bir kullanıcı etiketleyin.');
        }

        const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi.';
        
        try {
            await targetUser.ban({ reason: reason });

            // 1. LOG KAYDI OLUŞTURMA
            const logEmbed = new EmbedBuilder()
                .setColor(0x371d5d)
                .setTitle('🚫 KULLANICI YASAKLANDI (BAN)')
                .addFields(
                    { name: 'Kullanıcı', value: `${targetUser.user.tag} (${targetUser.id})`, inline: false },
                    { name: 'Yetkili', value: `${message.author.tag}`, inline: true },
                    { name: 'Sebep', value: reason, inline: true }
                )
                .setTimestamp();
            await sendLog(logEmbed);

            // 2. İŞLEM KANALINA BİLDİRİM
            message.channel.send(`${targetUser.user.tag} kullanıcısı sunucudan **KALICI OLARAK** yasaklandı. Sebep: ${reason}`);

        } catch (error) {
            console.error("BAN HATASI:", error);
            message.channel.send('Yasaklama işlemi sırasında bir hata oluştu: ' + error.message);
        }
    }

    // 9. KOMUT: !yardım (Tüm komutları gösterir)
    else if (command === 'yardim') {
        
        const helpEmbed = new EmbedBuilder()
            .setColor(0x371d5d) 
            .setTitle('メッド#4452 Bot Komutları')
            .setDescription('İşte bu sunucuda kullanabileceğin tüm komutlar ve yetkileri:')
            .setThumbnail(message.guild.iconURL())
            .addFields(
                // Temel Komutlar
                { name: '🌐 Temel Komutlar', value: '-------------------------------', inline: false },
                { name: '`!merhaba`', value: 'Botun size selam vermesini sağlar.', inline: true },
                { name: '`!kimim`', value: 'Kendiniz hakkındaki bilgileri gösterir.', inline: true },
                { name: '`!zar`', value: '1 ile 6 arasında rastgele zar atar.', inline: true },
                { name: '`!ping`', value: 'Botun gecikme süresini gösterir.', inline: true },
                
                // Moderasyon Komutları
                { name: '\n⚔ Moderasyon Komutları', value: '-------------------------------', inline: false },
                { name: '`!sil [miktar]`', value: 'Mesajları siler (**Mesajları Yönet** yetkisi gerekir).', inline: true },
                { name: '`!mute @kullanıcı [süre]`', value: 'Kullanıcıyı süreli susturur (**Üyeleri Denetle** yetkisi gerekir).', inline: true },
                { name: '`!kick @kullanıcı [sebep]`', value: 'Kullanıcıyı sunucudan atar (**Üyeleri At** yetkisi gerekir).', inline: true },
                { name: '`!ban @kullanıcı [sebep]`', value: 'Kullanıcıyı kalıcı yasaklar (**Üyeleri Yasakla** yetkisi gerekir).', inline: true },
                { name: '`!nick @kullanıcı [Yeni Ad]`', value: 'Kullanıcının takma adını değiştirir (**Takma Adları Yönet** yetkisi gerekir).', inline: true },
                { name: '`!yardim`', value: 'Bu yardım menüsünü gösterir.', inline: true },
            )
            .setTimestamp()
            .setFooter({ text: `Komut İsteyen: ${message.author.tag}` });

        message.channel.send({ embeds: [helpEmbed] });
    }
    
    // 10. KOMUT: !nick [@kullanıcı] [Yeni Ad]
    else if (command === 'nick') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageNicknames)) {
            return message.channel.send('Bu komutu kullanmak için **Takma Adları Yönet** yetkisine sahip olmalısın.');
        }
        
        const targetUser = message.mentions.members.first();
        if (!targetUser) {
            return message.channel.send('Lütfen takma adını değiştirmek istediğiniz bir kullanıcı etiketleyin.');
        }

        const newNickname = args.slice(1).join(' ');
        if (!newNickname) {
            return message.channel.send('Lütfen yeni bir takma ad girin.');
        }
        
        targetUser.setNickname(newNickname)
            .then(() => {
                message.channel.send(`${targetUser.user.tag} kullanıcısının yeni takma adı başarıyla **"${newNickname}"** olarak ayarlandı.`);
            })
            .catch(error => {
                console.error("Nick Değiştirme Hatası", error);
                message.channel.send('Takma ad değiştirme işlemi sırasında bir hata oluştu: ' + error.message);
            });
    }
});

// Botu Discord'a bağlamak için tokeni kullanır
client.login(BOT_TOKEN);