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

const gifEngellemeDurumu = new Map();


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
const GUILD_LOG_CHANNELS = {
    '1370070679105306695': '1376137436391804938',
    '1259887540865990738': '1274334627686781020',
    // Gerekirse daha fazla sunucu ve log kanalı ekle
};


// Tokeni .env dosyasından güvenli bir şekilde çeker
const BOT_TOKEN = process.env.DISCORD_TOKEN; 

// 1. INTENTS VE PARTIALS
const queue = new Map(); 

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
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
    client.user.setPresence({
    activities: [
      { name: '!yardim | v1.2', type: 0 } // Oynuyor
    ],
    status: 'online'
  });
});


// ILK KOMUTLAR VE ONLARIN ORTAK TANIMLARI (PREFİX)
const prefix = '!';

client.on('messageCreate', async message => {
                           
    if (message.author.bot || !message.guild) return;

    const channelId = message.channel.id; // Mesajın geldiği kanalın ID'sini al

    // Artık channelId'yi kontrol ediyoruz
    if (gifEngellemeDurumu.get(channelId)) { 
        
        // GÜÇLENDİRİLMİŞ GIF KONTROLÜ (Aynı kalacak)
        const content = message.content.toLowerCase();
        
        const isGif = 
            content.includes('.gif') ||
            content.includes('tenor.com/view/') || 
            content.includes('giphy.com/media/') || 
            message.attachments.some(a => a.name && a.name.toLowerCase().endsWith('.gif'));

        if (isGif) {
            // Mesajı silme yetkisi kontrolü
            if (message.guild.members.me.permissions.has('ManageMessages')) {
                message.delete()
                    .then(() => {
                        message.channel.send(`🚫 **${message.author.tag}**, bu kanalda GIF gönderimi engellendi!`)
                                       .then(m => setTimeout(() => m.delete().catch(() => {}), 5000)); 
                    })
                    .catch(e => console.error('GIF silme hatası:', e));
                return; 
            }
        }
    }

    if (message.author.bot || !message.content.startsWith(prefix)) return;

    if (!message.guild) return;

    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    // --- Yardımcı fonksiyon: Loglama ---
const sendLog = async (embed) => {
    // Mesajın geldiği sunucunun (Guild) ID'sini kullanarak Log Kanalı ID'sini haritadan çek.
    const logChannelId = GUILD_LOG_CHANNELS[message.guild.id]; 
    
    // Eğer o sunucu için bir log kanalı tanımlanmamışsa, loglama yapma.
    if (!logChannelId) {
        console.error(`Hata: Sunucu ID ${message.guild.id} için Log Kanalı ID'si tanımlanmamış.`);
        return; 
    }
    
    // Log Kanalı ID'sini kullanarak kanalı bul.
    const logChannel = message.guild.channels.cache.get(logChannelId);
    
    if (logChannel) {
        try {
            await logChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error("Log kanalı hatası:", error);
        }
    }
};

// 1. KOMUT: !merhaba
if (command === 'merhaba') {
        message.channel.send(`Merhaba, **${message.author.username}**! Ben med1wsg tarafından yapılmış メッド#4452 botu!`);
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

        if (isNaN(amount) || amount <= 1 || amount > 200) {
            return message.channel.send('Lütfen 1 ile 99 arasında bir sayı girin.');
        }

        try {
            await message.delete();
            const messages = await message.channel.bulkDelete(amount - 1, true);

            // --- LOG KAYDI OLUŞTURMA ---
            const logEmbed = new EmbedBuilder()
                .setColor(0x371d5d)
                .setTitle('🗑 TOPLU MESAJ SİLİNDİ')
                .addFields(
                    { name: 'Kanal', value: `#${message.channel.name}`, inline: true },
                    { name: 'Yetkili', value: `${message.author.tag}`, inline: true },
                    { name: 'Miktar', value: `${messages.size} adet`, inline: true }
                )
                .setTimestamp();
            await sendLog(logEmbed);

            // --- İŞLEM KANALINA BİLDİRİM ---
            const deleteEmbed = new EmbedBuilder()
                .setColor(0x371d5d) // Mor
                .setDescription(`🗑 **${messages.size}** adet mesaj başarıyla silindi.`)
                .setFooter({ text: `Yetkili: ${message.author.tag}` });
                
            const sentMessage = await message.channel.send({ embeds: [deleteEmbed] });
            setTimeout(async () => {
                const fetchedMessage = await message.channel.messages.fetch(sentMessage.id).catch(() => null);
                if (fetchedMessage) {
                    await sentMessage.delete();
                }
            }, 5000);

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
        // Süre ve kullanıcı etiketinden sonraki tüm argümanları sebep olarak topla
        const reason = args.slice(2).join(' ') || 'Sebep belirtilmedi.';

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
                    { name: 'Süre', value: `${durationFormatted}`, inline: true },
                    { name: 'Sebep', value: reason, inline: true }
                )
                .setTimestamp();
            await sendLog(logEmbed);

            // 2. İŞLEM KANALINA BİLDİRİM
            message.channel.send(`${targetUser.user.tag} kullanıcısı ${durationFormatted} süreyle susturuldu. Sebep: ${reason}`);

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
            message.channel.send(`${targetUser.user.tag} kullanıcısı sunucudan **kalıcı olarak** yasaklandı. Sebep: ${reason}`);

        } catch (error) {
            console.error("BAN HATASI:", error);
            message.channel.send('Yasaklama işlemi sırasında bir hata oluştu: ' + error.message);
        }
    }

    // 9. KOMUT: !yardım (Tüm komutları gösterir)
    else if (command === 'yardim'|| command === 'help' || command === 'h' || command === 'y') {
        
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
                { name: '`!sunucu`', value: 'Sunucu hakkında temel bilgileri gösterir.', inline: true },

                // Moderasyon Komutları
                { name: '\n⚔ Moderasyon Komutları', value: '-------------------------------', inline: false },
                { name: '`!sil [miktar]`', value: 'Mesajları siler (**Mesajları Yönet** yetkisi gerekir).', inline: true },
                { name: '`!mute @kullanıcı [süre]`', value: 'Kullanıcıyı süreli susturur (**Üyeleri Denetle** yetkisi gerekir).', inline: true },
                { name: '`!kick @kullanıcı [sebep]`', value: 'Kullanıcıyı sunucudan atar (**Üyeleri At** yetkisi gerekir).', inline: true },
                { name: '`!unmute @kullanıcı`', value: 'Kullanıcının susturmasını kaldırır (**Üyeleri Denetle** yetkisi gerekir).', inline: true },
                { name: '`!ban @kullanıcı [sebep]`', value: 'Kullanıcıyı kalıcı yasaklar (**Üyeleri Yasakla** yetkisi gerekir).', inline: true },
                { name: '`!nick @kullanıcı [Yeni Ad]`', value: 'Kullanıcının takma adını değiştirir (**Takma Adları Yönet** yetkisi gerekir).', inline: true },
                { name: '`!rol @kullanıcı [Rol Adı]`', value: 'Kullanıcıya belirtilen rolü verir (**Rolleri Yönet** yetkisi gerekir).', inline: true },
                { name: '`!yardim`', value: 'Bu yardım menüsünü gösterir.', inline: true },
                { name: '`!ticket-setup`', value: 'Destek talebi (ticket) sistemini kurar (**Yönetici** yetkisi gerekir).', inline: true },
                { name: '`!kullanıcı @kullanıcı`', value: 'Kullanıcı hakkında detaylı bilgi verir.', inline: true },
                { name: '`!gif-engelleme #[kanal]`', value: 'Seçilen kanalda (özellik aktif edildikten sonra) GIF mesajlarını siler', inline: true}
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

    // 11. KOMUT: !rol @kullanıcı [Rol Adı]
    else if (command === 'rol') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return message.channel.send('Bu komutu kullanmak için **Rolleri Yönet** yetkisine sahip olmalısın.');
        }
        // Argüman kontrolü
        const targetMember = message.mentions.members.first();
        const targetRole = message.mentions.roles.first();

        if (!targetMember || !targetRole) {
        return message.reply({
            content: `Kullanım: \`!rol @[kullanıcı adı] @[rol ismi]\``
        });
    }   
        // 2. Botun İzin/Hiyerarşi Kontrolü
        const botMember = message.guild.members.cache.get(client.user.id);
        if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return message.reply('Bu komutu kullanabilmen için **Rolleri Yönet** iznine sahip olmam gerekiyor.');
        }
        // Botun rolünün, verilecek rolden daha yüksek olup olmadığını kontrol et
        if (targetRole.position >= botMember.roles.highest.position) {
            return message.reply('Bu rolü veremiyorum çünkü benim en yüksek rolüm bu rolden daha düşük veya aynı seviyede.');
        }
        // 3. Rolü Ver
        try {
            await targetMember.roles.add(targetRole.id);
            
        // 5. Başarı Mesajı ve Loglama
        const embed = new EmbedBuilder()
            .setColor(0x371d5d)
             .setDescription(`✅ **${targetMember.user.tag}** kullanıcısına **${targetRole.name}** rolü verildi.`)
            .setTimestamp();

        message.channel.send({ embeds: [embed] });

        // Loglama
        const logEmbed = new EmbedBuilder()
            .setTitle("✨ ROL VERİLDİ")
            .setColor(0x371d5d)
            .addFields(
                { name: 'Kullanıcı', value: `${targetMember.user.tag} (${targetMember.id})`, inline: true },
                { name: 'Rol', value: `${targetRole.name} (${targetRole.id})`, inline: true },
                { name: 'Yetkili', value: `${message.author.tag} (${message.author.id})`, inline: false }
            )
            .setTimestamp();
            await sendLog(logEmbed);
        } catch (error) {
            console.error("Rol Verme Hatası:", error);
            message.channel.send('Rol verme işlemi sırasında bir hata oluştu: ' + error.message);
        }
        return;
    }

// 12. KOMUT: !unmute @kullanıcı (TIMEOUT SIFIRLAR)
else if (command === 'unmute') {
    // 1. İzin Kontrolü
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        return message.channel.send('Bu komutu kullanmak için **Üyeleri Denetle** yetkisine sahip olmalısın.');
    }

    // 2. Argüman Kontrolü
    const targetMember = message.mentions.members.first();
    if (!targetMember) {
        return message.channel.send('Lütfen susturması kaldırılacak bir kullanıcı etiketleyin.');
    }

    // 3. Susturmayı Kaldırma
    if (targetMember.communicationDisabledUntilTimestamp) {
        try {
            // Susturmayı kaldırır (Timeout: null)
            await targetMember.timeout(null, 'Moderatör tarafından susturma kaldırıldı.'); 

            // 4. Başarı Mesajı ve Loglama
            const embed = new EmbedBuilder()
                .setColor(0x371d5d)
                .setDescription(`🔊 **${targetMember.user.tag}** kullanıcısının susturması kaldırıldı.`)
                .setTimestamp();
            
            message.channel.send({ embeds: [embed] });

            const logEmbed = new EmbedBuilder()
                .setTitle("🔊 SUSTURMA KALDIRILDI")
                .setColor(0x371d5d)
                .addFields(
                    { name: 'Kullanıcı', value: `${targetMember.user.tag} (${targetMember.id})`, inline: true },
                    { name: 'Yetkili', value: `${message.author.tag} (${message.author.id})`, inline: true }
                )
                .setTimestamp();
            
            await sendLog(logEmbed);

        } catch (error) {
            console.error("UNMUTE HATASI:", error);
            message.channel.send('Susturmayı kaldırma sırasında bir hata oluştu: ' + error.message);
        }
    } else {
        message.channel.send(`${targetMember.user.tag} zaten susturulmamış.`);
    }
}
// 13. KOMUT: !sunucu (Temel Sunucu Bilgileri)
if (command === 'sunucu') {
        
        // Sunucu nesnesini güvenle al (Çünkü yukarıda kontrol ettik)
        const guild = message.guild;
        // Sadece görünen kanallar
     const visibleChannels = guild.channels.cache.filter(c => 
        c.type === ChannelType.GuildText || 
        c.type === ChannelType.GuildVoice
    );

        // EmbedBuilder import edildiğinden emin olun!
        const serverEmbed = new EmbedBuilder()
            .setColor(0x371d5d)
            .setTitle(`${guild.name} Sunucu Bilgileri`) 
            .setThumbnail(guild.iconURL({ dynamic: true })) 
            .addFields(
                { name: 'Kurucu', value: `<@${guild.ownerId}>`, inline: true }, 
                { name: 'Üye Sayısı', value: `${guild.memberCount}`, inline: true }, 
                { name: 'Kanal Sayısı', value: `${visibleChannels.size}`, inline: true }, 
                { name: 'Oluşturulma Tarihi', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:f>`, inline: false }, 
                { name: 'Sunucu ID', value: `${guild.id}`, inline: false } 
            )
            .setTimestamp() 
            .setFooter({ text: `${guild.name} sunucusunda istendi` });

        // Mesajı Gönderme
        message.channel.send({ embeds: [serverEmbed] });
    }

    // 14. KOMUT: !kullanıcı @kullanıcı
    else if (command === 'kullanıcı' || command === 'kimim' ) {
        // Eğer bir kullanıcı etiketlenmişse onu alır, yoksa mesajı yazan kişiyi hedefler.
        const member = message.mentions.members.first() || message.member;
        const user = member.user;
        // Embed oluşturma
        const userEmbed = new EmbedBuilder()
            .setColor(0x371d5d)
            .setTitle(`Kullanıcı Bilgileri: ${user.tag}`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true })) // Kullanıcının avatarını alır
            .addFields(
                // --Kullanıcı Bilgileri--
            { name: 'Discord ID', value: user.id, inline: true },
            { name: 'Hesap Oluşturulma Tarihi',
                value: `<t:${Math.floor(user.createdTimestamp / 1000)}:f>`,
                inline: true
            },
            // --Sunucudaki Bilgileri-
            { name: 'Sunucuya Katılma', 
              value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:f>`, 
              inline: true }, // Sunucuya ne zaman katıldı
            { name: 'Roller', 
              value: member.roles.cache.size > 1 ? member.roles.cache.filter(r => r.name !== '@everyone').map(r => r.name).join(', ') : 'Yok', 
              inline: false } // @everyone rolünü hariç tutar

            )
            .setTimestamp()
            .setFooter({ text: `${message.guild.name} sunucusunda istendi` });
        // Embed mesajını gönderme
        message.channel.send({ embeds: [userEmbed] });
    }
    // 15. KOMUT: !gif-engelleme
    else if (command === 'gif-engelleme') {
    
    // 1. İZİN KONTROLÜ
    if (!message.member.permissions.has('Administrator')) {
        return message.reply({ content: 'Bu komutu kullanmak için **Yönetici** iznine sahip olmalısın.' });
    }

    // 🚨 HEDEF KANALI BELİRLEME: Etiketlenen kanal yoksa, komutun yazıldığı kanalı kullan
    const targetChannel = message.mentions.channels.first() || message.channel;
    const targetChannelId = targetChannel.id;

    // 2. YENİ DURUMU AYARLAMA VE KAYDETME (Channel ID ile)
    const mevcutDurum = gifEngellemeDurumu.get(targetChannelId) || false;
    const yeniDurum = !mevcutDurum;
    gifEngellemeDurumu.set(targetChannelId, yeniDurum); // Artık Channel ID'yi anahtar olarak kullanıyor!

    // 3. KULLANICIYA BİLDİRİM GÖNDERME
    const durumMetni = yeniDurum ? '✅ **AÇIK**' : '❌ **KAPALI**';
    
    // Eğer etiketlenen kanal mesajın yazıldığı kanal değilse özel isim kullan
    const hedefMetni = targetChannel.id === message.channel.id ? '**bu kanalda**' : `**#${targetChannel.name}** kanalında`;

    const engellemeEmbed = new EmbedBuilder()
        .setColor(yeniDurum ? 0x00FF00 : 0xFF0000) 
        .setTitle('🚫 GIF Engelleme Sistemi')
        .setDescription(`GIF Engelleme artık ${hedefMetni} **${durumMetni}**.\n(Gönderilen GIF içeren mesajlar anında silinecektir.)`)
        .setTimestamp();
        
    return message.channel.send({ embeds: [engellemeEmbed] });
}
    // 16. KOMUT: !çekiliş
    else if (command === 'çekiliş' || command === 'cekilis') {
        // Kullanım: !çekiliş [süre] [ödül]
        if (args.length < 2) {
            return message.reply('Çekiliş komutunu doğru kullanmalısın: `!çekiliş [süre (ör: 10s/5m/1h)] [ödül]`');
            }
            const sureString = args[0];
            const odul = args.slice(1).join(' ');
            // Süre hesaplama ve başlatma komutları buraya gelecek
            const cekilisEmbed = new EmbedBuilder()
                .setColor(0x371d5d)
                .setTitle('🎉 Çekiliş Başladı! 🎉')
                .setDescription(`**Ödül:** ${odul}\n**Süre:** ${sureString}`)
                .addFields(
                    { name: 'Nasıl Katılırım?', value: 'Aşağıdaki 🎉 reaksiyonuna tıkla!', inline: false }
                )
                .setTimestamp()
                .setFooter({ text: `Çekilişi Başlatan: ${message.author.tag}` });
                message.channel.send({ embeds: [cekilisEmbed] }).then(msg => {
                    msg.react('🎉'); // Reaksiyon ekler
                });
    }
}); // <-- BU PARANTEZ, client.on('messageCreate', ...) olayını kapatır.


// Düğme etkileşimlerini dinlemek için event listener
client.on('interactionCreate', async interaction => {
    // Sadece düğme etkileşimlerini dinle
    if (!interaction.isButton()) return;

    // Düğmenin ID'sine göre işlem yap
    if (interaction.customId === 'open_ticket') {
        
        // BU SATIR, KANAL KONTROLÜNDEN ÖNCE GELMELİ! 
        // Discord'a hemen "İsteği aldım" mesajını gönderir.
        await interaction.deferReply({ ephemeral: true }); 

        // --- AKTİF TICKET KONTROLÜ BURADAN SONRA GELMELİ ---
        const activeTicket = interaction.guild.channels.cache.find(c => 
            c.name.startsWith('ticket-') && c.topic?.includes(interaction.user.id)
        );
        
        if (activeTicket) {
            // Eğer aktif ticket varsa, cevabı `editReply` ile düzenle.
            return interaction.editReply({
                content: `Zaten aktif bir destek talebin bulunuyor: ${activeTicket}. Lütfen önce o ticket'ı kapat.`,
                ephemeral: true
            });
        }
        
        // 1. Ticket Kanalının Adını Belirle
        // Ticket kanal adını benzersiz yapmak için sonuna zaman damgası (timestamp) ekleyelim.
        const timestamp = Date.now().toString().slice(-5); // Son 5 haneyi al
const ticketChannelName = `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}-${timestamp}`;

// 2. Kanalı Oluştur
const channel = await interaction.guild.channels.create({
    name: ticketChannelName,
    type: ChannelType.GuildText,
    parent: null, // Kategori belirtilmedi, sunucunun en üstüne oluşturulur
    topic: `Ticket ID: ${interaction.user.id}`, 
    permissionOverwrites: [
        {
            // @everyone: Kanali GÖRMESİN
            id: interaction.guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
        },
        {
            // Ticket Açan Kullanıcı: Kanali GÖRSÜN ve Mesaj GÖNDERSİN
            id: interaction.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        },
        {
            // Botun kendisi: Kanala erişebilmeli ve mesaj gönderebilmeli
            id: client.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
        },
        // İsteğe bağlı: Belirli bir moderatör rolüne de izin ver
        // {
        //     id: 'MODERATOR_ROL_ID', 
        //     allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        // },
    ],
});


        // 3. Kullanıcıya Bildirim Gönder (kalan kodun devamı...)
        await interaction.editReply({
            content: `Destek talebin açıldı! Lütfen yeni kanalın olan ${channel} adresine git.`,
            ephemeral: true
        });

        // Kapat Düğmesini Oluştur ve Hoş Geldiniz Mesajını Gönder (kalan kodun devamı...)
        const closeButtonRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket') 
                    .setLabel('❌ Ticket Kapat')
                    .setStyle(ButtonStyle.Danger),
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

// Botu Discord'a bağlamak için tokeni kullanır
client.login(BOT_TOKEN);