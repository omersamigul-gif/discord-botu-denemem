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

const fs = require('fs'); // Dosya okuma/yazma modülünü ekle

// Log kanalı verilerini log.json dosyasından yükle
let GUILD_LOG_CHANNELS = {}; 
try {
    const data = fs.readFileSync('./log.json', 'utf8');
    GUILD_LOG_CHANNELS = JSON.parse(data);
} catch (e) {
    console.error('log.json okunamadı veya bulunamadı. Boş Log Objesi ile başlanıyor.');
}

// Log kanalı verilerini log.json dosyasına kalıcı olarak kaydetme fonksiyonu
function saveLogChannels() {
    try {
        // Veriyi güzelleştirerek (null, 4) kaydet
        fs.writeFileSync('./log.json', JSON.stringify(GUILD_LOG_CHANNELS, null, 4));
    } catch (e) {
        console.error('Log kanalı verileri log.json dosyasına yazılamadı:', e);
    }
}


// ---------------------- PREFIX AYARLARI ----------------------
let GUILD_PREFIXES = {};
const DEFAULT_PREFIX = '!'; // Varsayılan Prefix
try {
    const data = fs.readFileSync('./prefix.json', 'utf8');
    GUILD_PREFIXES = JSON.parse(data);
} catch (e) {
    console.log('prefix.json bulunamadı. Varsayılan prefix (!) kullanılıyor.');
}

function savePrefixes() {
    try {
        fs.writeFileSync('./prefix.json', JSON.stringify(GUILD_PREFIXES, null, 4));
    } catch (e) {
        console.error('Prefix verileri prefix.json dosyasına yazılamadı:', e);
    }
}

// ---------------------- GENEL SUNUCU AYARLARI (Gelen/Giden İçin) ----------------------
let GUILD_SETTINGS = {};
try {
    const data = fs.readFileSync('./settings.json', 'utf8');
    GUILD_SETTINGS = JSON.parse(data);
} catch (e) {
    console.log('settings.json bulunamadı. Boş ayar objesi ile başlanıyor.');
}

function saveSettings() {
    try {
        fs.writeFileSync('./settings.json', JSON.stringify(GUILD_SETTINGS, null, 4));
    } catch (e) {
        console.error('Sunucu ayarları settings.json dosyasına yazılamadı:', e);
    }
}

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
      { name: '!h | v3.1', type: 0 } // Oynuyor
    ],
    status: 'online'
  });
});


// ILK KOMUTLAR VE ONLARIN ORTAK TANIMLARI (PREFİX)
const prefix = '!';

client.on('messageCreate', async message => {
    // Botun kendisini veya diğer botları dinleme
    if (message.author.bot) return;

    // SUNUCUYA ÖZEL PREFIX BELİRLEME
    const guildId = message.guild.id;
    // Eğer sunucunun prefix'i yoksa varsayılanı kullan
    const prefix = GUILD_PREFIXES[guildId] || DEFAULT_PREFIX; 

    // 🚨 HATA DÜZELTME: channelId'yi burada tanımlıyoruz
    const channelId = message.channel.id; 

    // 🚨 MANTIK DÜZELTMESİ: GIF kontrolünü, prefix kontrolünden önceye taşıdık
    if (gifEngellemeDurumu.get(channelId)) { 
        
        // GÜÇLENDİRİLMİŞ GIF KONTROLÜ
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
                return; // GIF mesajıydı, bu yüzden komut işlemeye devam etme
            }
        }
    }

    // Eğer mesaj prefix ile başlamıyorsa, yoksay. (GIF kontrolünden sonra)
    if (!message.content.startsWith(prefix)) return;

    // Komut ve argümanları ayırma
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

// 2. KOMUT: !zar
else if (command === 'zar') {
    const zar = Math.floor(Math.random() * 6) + 1; 
    message.channel.send(`${message.author.username}, zarın **${zar}** geldi!`);
}

    // 3. KOMUT: !ping 
    else if (command === 'ping') {
        const latency = Math.round(client.ws.ping);
        message.channel.send(`Pong! Gecikme süresi: **${latency}ms.**`)
    }
    
    // 4. KOMUT: !sil [miktar] - LOG SİSTEMİ EKLENDİ
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
            .setColor(0x371d5d) // Mor
            .setDescription(`🗑 **${messages.size - 1}** adet mesaj başarıyla silindi.`)
            .setFooter({ text: `Yetkili: ${message.author.tag}` });
            
        const sentMessage = await message.channel.send({ embeds: [deleteEmbed] });
        setTimeout(async () => {
            try {
                await sentMessage.delete();
            } catch (e) {
                // Mesaj zaten silinmiş olabilir, hatayı yoksay.
            }
        }, 5000);

    } catch (error) {
        console.error('Mesaj silme hatası:', error);
        message.channel.send('Mesajları silerken bir hata oluştu. (Mesajlar 14 günden eski olabilir.)');
    }
}

    // 5. KOMUT: !mute @kullanıcı [süre] (TIMEOUT KULLANIR)
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

    // 6. KOMUT: !kick @kullanıcı [sebep]
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

    // 7. KOMUT: !ban @kullanıcı [sebep]
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

    // 8. KOMUT: !yardım (Tüm komutları gösterir)
    else if (command === 'yardim'|| command === 'help' || command === 'h' || command === 'y') {
        
        const helpEmbed = new EmbedBuilder()
            .setColor(0x371d5d) 
            .setTitle('メッド#4452 Bot Komutları')
            .setDescription('İşte bu sunucuda kullanabileceğin tüm komutlar ve yetkileri:')
            .setThumbnail(message.guild.iconURL())
            .addFields(
                // Temel Komutlar
                { name: '🌐 Temel Komutlar', value: '-------------------------------', inline: false },
                { name: '`!merhaba`', value: 'Bot size selam verir.', inline: true },
                { name: '`!kimim`', value: 'Kendiniz hakkındaki bilgileri gösterir.', inline: true },
                { name: '`!zar`', value: '1 ile 6 arasında rastgele zar atar.', inline: true },
                { name: '`!ping`', value: 'Botun gecikme süresini gösterir.', inline: true },
                { name: '`!sunucu`', value: 'Sunucu hakkında temel bilgileri gösterir.', inline: true },
                { name: '`!y/!h/!yardim`', value: 'Bu yardım menüsünü gösterir.', inline: true },
                { name: '`!botlink`', value: 'Botun davet linkini gönderir.', inline: true },
                { name: '`!admin-yardim/!admin-help`', value: 'Moderasyon komutlarını gösterir. (Bu komutu kullanmak için en az **Mesajları Yönet** yetkisine sahip olmalısın.)', inline: true },
                // Sosyal ve etkileşim komutları
                { name: '\n✨ Sosyal & Etkileşim Komutları', value: '-------------------------------', inline: false },
                { name: '`!çekiliş [süre] [ödül]`', value: 'Süreli bir çekiliş başlatır (**Sunucuyu Yönet** izni gerekir).', inline: true },
                { name: '`!anket [soru]`', value: 'Basit bir anket başlatır (**Mesajları Yönet** izni gerekir).', inline: true },
            )
            .setTimestamp()
            .setFooter({ text: `Komut İsteyen: ${message.author.tag}` });

        message.channel.send({ embeds: [helpEmbed] });
    }
    
    // 9. KOMUT: !nick [@kullanıcı] [Yeni Ad]
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

    // 10. KOMUT: !rol @kullanıcı [Rol Adı]
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

// 11. KOMUT: !unmute @kullanıcı (TIMEOUT SIFIRLAR)
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
// 12. KOMUT: !sunucu (Temel Sunucu Bilgileri)
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

    // 13. KOMUT: !kullanıcı @kullanıcı
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
    // 14. KOMUT: !gif-engelleme
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
    const durumMetni = yeniDurum ? '✅ AÇIK' : '❌ KAPALI';
    
    // Eğer etiketlenen kanal mesajın yazıldığı kanal değilse özel isim kullan
    const hedefMetni = targetChannel.id === message.channel.id ? '**bu kanalda**' : `**#${targetChannel.name}** kanalında`;

    const engellemeEmbed = new EmbedBuilder()
        .setColor(yeniDurum ? 0x00FF00 : 0xFF0000) 
        .setTitle('🚫 GIF Engelleme Sistemi')
        .setDescription(`GIF Engelleme artık ${hedefMetni} **${durumMetni}**.\n(Gönderilen GIF içeren mesajlar anında silinecektir.)`)
        .setTimestamp();
        
    return message.channel.send({ embeds: [engellemeEmbed] });
}
    
    // 15. KOMUT: !çekiliş (SÜRELİ VE OTOMATİK BİTEN VERSİYON)
    else if (command === 'çekiliş' || command === 'cekilis') {
        
        // 1. İzin Kontrolü (Sunucuyu Yönet izni gerek)
        if (!message.member.permissions.has('ManageGuild')) {
            return message.reply('Bu komutu kullanmak için **Sunucuyu Yönet** iznine sahip olmalısın.');
        }

        // 2. Format Kontrolü
        if (args.length < 2) {
            return message.reply('Çekiliş formatı: `!çekiliş [süre (ör: 10s, 5m, 1h)] [ödül]`');
        }

        const sureString = args[0].toLowerCase();
        const odul = args.slice(1).join(' ');

        // 3. SÜRE HESAPLAMA (Parsing)
        let sureMs = 0;
        const sureRegex = sureString.match(/^(\d+)([smhd])$/); 

        if (!sureRegex) {
            return message.reply('Geçerli bir süre birimi kullanmalısın (ör: 10s, 5m, 1h, 1d).');
        }

        const miktar = parseInt(sureRegex[1]);
        const birim = sureRegex[2];
        
        // SÜRE METNİ HAZIRLAMA VE MS HESAPLAMA
        let sureMetni; 
        switch (birim) {
            case 's': 
                sureMs = miktar * 1000; 
                sureMetni = `${miktar} Saniye`; 
                break; // Saniye
            case 'm': 
                sureMs = miktar * 60 * 1000; 
                sureMetni = `${miktar} Dakika`; 
                break; // Dakika
            case 'h': 
                sureMs = miktar * 60 * 60 * 1000; 
                sureMetni = `${miktar} Saat`; 
                break; // Saat
            case 'd': 
                sureMs = miktar * 24 * 60 * 60 * 1000; 
                sureMetni = `${miktar} Gün`; 
                break; // Gün
            default: return message.reply('Geçersiz süre birimi.');
        }
        
        // Bitiş zamanını Discord formatında hesapla
        const bitisTimestamp = Math.floor((Date.now() + sureMs) / 1000); 

        // 4. Çekiliş Başlangıç Embed'i
        const cekilisEmbed = new EmbedBuilder()
            .setColor(0x371d5d)
            .setTitle('🎉 ÇEKİLİŞ BAŞLADI! 🎉')
            // BURADA DÜZELTİLDİ: Sadece net süre ve TAM bitiş zamanı (göreli zaman etiketi yok).
            .setDescription(`**Ödül:** ${odul}\n**Süre:** ${sureMetni}\n**Bitiş:** <t:${bitisTimestamp}:f>\n\n**Katılım:** Aşağıdaki 🎉 reaksiyonuna tıkla!`)
            .setTimestamp()
            .setFooter({ text: `Başlatan: ${message.author.tag}` });
        
        // Başlangıç mesajını sil (temizlik için)
        message.delete().catch(() => {});

        message.channel.send({ embeds: [cekilisEmbed] }).then(msg => {
            msg.react('🎉');

            // 5. ZAMANLAYICI BAŞLATMA VE BİTİRME MANTIĞI
            setTimeout(() => {
                
                // Reaksiyonları güncellemek için mesajı tekrar çek (fetch)
                msg.reactions.cache.get('🎉')?.users.fetch().then(users => {
                    
                    // Botu ve mesajı göndereni katılımcı listesinden çıkar
                    const katilimcilar = users.filter(user => !user.bot && user.id !== message.author.id); 
                    
                    if (katilimcilar.size === 0) {
                        // Yeterli katılımcı yoksa
                        msg.edit({
                            embeds: [new EmbedBuilder()
                                .setColor(0x371d5d)
                                .setTitle('🚫 ÇEKİLİŞ BİTTİ!')
                                .setDescription(`**Ödül:** ${odul}\nYeterli katılımcı yoktu.`)
                                .setFooter({ text: 'Kazanan yok' })
                                .setTimestamp()]
                        });
                        return message.channel.send(`Üzgünüm, çekilişe yeterli katılım olmadı.`);
                    }

                    // Rastgele Kazanan Seçme
                    const kazanan = katilimcilar.random();
                    
                    // Kazananı Duyurma Embed'i Düzenleme
                    msg.edit({
                        embeds: [new EmbedBuilder()
                            .setColor(0x371d5d)
                            .setTitle('🏆 ÇEKİLİŞ BİTTİ! 🏆')
                            .setDescription(`**Ödül:** ${odul}\n**Kazanan:** ${kazanan} tebrikler!`)
                            .setFooter({ text: `Çekilişi ${message.author.tag} başlattı.` })
                            .setTimestamp()]
                    });
                    
                    // Kanalda Kazananı Etiketleme
                    message.channel.send(`🎉 Tebrikler, ${kazanan}! **${odul}** kazandın!`);

                }).catch(e => {
                    console.error('Çekiliş bitiş hatası:', e);
                    message.channel.send('Çekiliş sonlandırma sırasında bir hata oluştu.');
                });

            }, sureMs); // Belirlenen süre sonunda çalış

        }).catch(e => console.error('Çekiliş başlangıç hatası:', e));
    }
   
    // 16. KOMUT: !admin-yardim/admin-help
    else if (command === 'admin-yardim' || command === 'admin-help') {

        // Bu komutu herkesin değil, sadece Yönetici/Moderatör rolündekilerin görmesi daha uygundur.
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
             return message.reply('Bu komutu kullanmak için en az **Mesajları Yönet** yetkisine sahip olmalısın.');
        }

        const adminHelpEmbed = new EmbedBuilder()
            .setColor(0x371d5d)
            .setTitle('🚨 YÖNETİCİ/MODERASYON KOMUTLARI')
            .setDescription('Bu komutları kullanmak için gerekli izinlere sahip olmalısın.')
            .setThumbnail(message.guild.iconURL())
            .addFields(
                { name: '⚔ Moderasyon Komutları', value: '-------------------------------', inline: false },
                { name: '`!sil [miktar]`', value: 'Mesajları siler (**Mesajları Yönet**).', inline: true },
                { name: '`!mute @kullanıcı [süre]`', value: 'Kullanıcıyı süreli susturur (**Üyeleri Denetle**).', inline: true },
                { name: '`!unmute @kullanıcı`', value: 'Susturmayı kaldırır (**Üyeleri Denetle**).', inline: true },
                { name: '`!kick @kullanıcı [sebep]`', value: 'Kullanıcıyı atar (**Üyeleri At**).', inline: true },
                { name: '`!ban @kullanıcı [sebep]`', value: 'Kullanıcıyı kalıcı yasaklar (**Üyeleri Yasakla**).', inline: true },
                { name: '`!nick @kullanıcı [Yeni Ad]`', value: 'Takma ad değiştirir (**Takma Adları Yönet**).', inline: true },
                { name: '`!rol @kullanıcı @[Rol Adı]`', value: 'Kullanıcıya rol verir (**Rolleri Yönet**).', inline: true },
                { name: '`!gif-engelleme #[kanal]`', value: 'Belirtilen kanalda GIF silmeyi aç/kapat (**Yönetici**).', inline: true},
                { name: '`!kanal-kilitle #[kanal]`', value: 'Belirtilen kanalı kilitle/aç (**Kanalları Yönet**).', inline: true },
                { name: '`!unban [Kullanıcı ID\'si]`', value: 'Belirtilen kullanıcının yasağını kaldırır (**Üyeleri Yasakla**).', inline: true},
                { name: '`!ticket-setup`', value: 'Yazılan kanalda destek bileti (ticket) sistemini kurar (**Yönetici**).', inline: true },
                { name: '`!log #[kanal]`', value: 'Log kanalını ayarlar (**Yönetici**).', inline: true },
                { name: '`!prefix`', value: 'Prefixi değiştirir (**Yönetici**).', inline: true },
                { name: '`!gelen-giden`', value: 'Gelen-giden mesajlarını açar/kapatır (**Yönetici**).', inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Komut İsteyen: ${message.author.tag}` });

        message.channel.send({ embeds: [adminHelpEmbed] });
    }

    // 18. KOMUT: !kanal-kilitle #[kanal]
else if (command === 'kanal-kilitle' || command === 'lock') {

    // 1. İzin Kontrolü (Kanalları Yönet izni gerek)
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
        return message.reply('Bu komutu kullanmak için **Kanalları Yönet** yetkisine sahip olmalısın.');
    }

    // 2. Hedef Kanalı Belirle (Etiketlenmiş kanal yoksa, komutun yazıldığı kanalı kullan)
    const targetChannel = message.mentions.channels.first() || message.channel;
    
    // @everyone rolünü al
    const everyoneRole = message.guild.roles.everyone;

    // Şu anki izinleri al
    const currentPermissions = targetChannel.permissionOverwrites.cache.get(everyoneRole.id);
    
    // Mesaj Gönderme izninin şu anki durumunu kontrol et
    const isLocked = currentPermissions?.deny.has(PermissionsBitField.Flags.SendMessages) || false;

    let successMessage;

    try {
        if (isLocked) {
            // KİLİT AÇMA İŞLEMİ
            await targetChannel.permissionOverwrites.edit(everyoneRole, {
                SendMessages: null // İzni sıfırla (varsayılana geri dön)
            });
            successMessage = `🔓 **#${targetChannel.name}** kanalının kilidi **açıldı**. Herkes tekrar mesaj gönderebilir.`;

        } else {
            // KİLİTLEME İŞLEMİ
            await targetChannel.permissionOverwrites.edit(everyoneRole, {
                SendMessages: false // Mesaj gönderme iznini Reddet
            });
            successMessage = `🔒 **#${targetChannel.name}** kanalı **kilitlendi**. Hiç kimse mesaj gönderemez.`;
        }

        // 1. İŞLEM KANALINA BİLDİRİM
        const lockEmbed = new EmbedBuilder()
            .setColor(isLocked ? 0x00FF00 : 0xFF0000) // Açılırsa yeşil, kilitlenirse kırmızı
            .setTitle('🚨 KANAL İZİN DEĞİŞİKLİĞİ')
            .setDescription(successMessage)
            .setTimestamp()
            .setFooter({ text: `Yetkili: ${message.author.tag}` });
            
        message.channel.send({ embeds: [lockEmbed] });

        // 2. LOG KAYDI OLUŞTURMA (YENİ EKLENEN KISIM)
        const actionType = isLocked ? 'KİLİDİ AÇILDI' : 'KİLİTLENDİ';
        const logColor = isLocked ? 0x00FF00 : 0xFF0000;
        
        const logEmbed = new EmbedBuilder()
            .setColor(0x371d5d)
            .setTitle(`🔒 KANAL ${actionType}`)
            .addFields(
                { name: 'Kanal', value: `#${targetChannel.name}`, inline: true },
                { name: 'Yetkili', value: `${message.author.tag} (${message.author.id})`, inline: true },
                { name: 'Eylem', value: actionType, inline: false }
            )
            .setTimestamp();
            
        await sendLog(logEmbed); // Logu Log Kanalına gönder

        // Komut mesajını sil
        message.delete().catch(() => {});

    } catch (error) {
        console.error('Kanal kilitleme/açma hatası:', error);
        message.reply('İzinleri ayarlarken bir hata oluştu. Botun rol hiyerarşisinin kanallardan yüksek olduğundan emin olun.');
    }
}
        // 19. KOMUT: !unban [Kullanıcı ID'si]
        else if (command === 'unban') {

    // 1. İzin Kontrolü (Üyeleri Yasakla izni gerek)
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        return message.reply('Bu komutu kullanmak için **Üyeleri Yasaklama** yetkisine sahip olmalısın.');
    }

    // 2. Argüman Kontrolü (ID veya Etiket)
    const userId = args[0];
    if (!userId) {
        return message.reply('Lütfen yasağı kaldırılacak kullanıcının ID\'sini veya etiketini girin.');
    }

    const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi.';

    try {
        // 3. Yasağı Kaldırma İşlemi
        // fetchBan, kullanıcının yasaklı olup olmadığını kontrol eder
        await message.guild.bans.fetch(userId); // Yasaklı kullanıcıyı bul
        await message.guild.bans.remove(userId, reason); // Yasağı kaldır

        // 4. Başarı Mesajı
        const unbanEmbed = new EmbedBuilder()
            .setColor(0x371d5d)
            .setTitle('✅ KULLANICI YASAĞI KALDIRILDI (UNBAN)')
            .addFields(
                { name: 'Kullanıcı ID', value: userId, inline: true },
                { name: 'Yetkili', value: `${message.author.tag}`, inline: true },
                { name: 'Sebep', value: reason, inline: false }
            )
            .setTimestamp();
        
        message.channel.send({ embeds: [unbanEmbed] });

        // Komut mesajını sil
        message.delete().catch(() => {});

        // Loglama (Daha önce tanımlanan sendLog fonksiyonunu kullanır)
        await sendLog(unbanEmbed);

    } catch (error) {
        // Eğer kullanıcı yasaklı değilse veya ID hatalıysa
        if (error.code === 10026 || error.code === 50013) {
             return message.reply(`Hata: **${userId}** ID'li kullanıcı bu sunucuda yasaklı değil veya ID hatalı.`);
        }
        console.error("UNBAN HATASI:", error);
        message.reply('Yasağı kaldırma sırasında bir hata oluştu: ' + error.message);
    }
}

    // 20. komut: !botlink
    else if (command === 'botlink') {
    
    // Botun ID'sini ve istenen izinleri al
    const clientId = client.user.id;
    const permissions = '8'; // Yönetici (Administrator) izni kodu.

    // Davet linkini oluştur
    const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=bot`;

    // Embed oluştur
    const linkEmbed = new EmbedBuilder()
        .setColor(0x371d5d)
        .setTitle('🔗 BOTU SUNUCUNA EKLE!')
        .setDescription('メッド#4452 botunu kendi sunucuna davet etmek için aşağıdaki linki kullanabilirsin. Bot, yönetici izniyle davet edilir.')
        .addFields(
            { name: 'Davet Linki', value: `[Bana Tıkla ve Sunucuna Ekle!](${inviteLink})`, inline: false }
        )
        .setThumbnail(client.user.displayAvatarURL())
        .setTimestamp();
        
    // Embed'i gönderme
    message.channel.send({ embeds: [linkEmbed] });

    // Komut mesajını sil
    try {
        await message.delete();
    } catch (e) {
        console.error('!botlink komut mesajı silinemedi.');
    }
}

    // 21. komut: !log #[kanal]
    else if (command === 'log') {
    
    // 1. İzin Kontrolü (Sadece Yönetici izni)
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply('Bu komutu kullanmak için **Yönetici** yetkisine sahip olmalısın.');
    }

    // 2. Hedef Kanalı Belirle
    const newLogChannel = message.mentions.channels.first();

    if (!newLogChannel || newLogChannel.type !== ChannelType.GuildText) {
        return message.reply('Lütfen log kanalı olarak ayarlanacak geçerli bir metin kanalı etiketleyin. Örn: `!log #sunucu-log`');
    }
    
    // 3. Başarı Mesajı ve KAYDETME İŞLEMİ
    const guildId = message.guild.id;
    const logChannelId = newLogChannel.id;

    // VERİYİ IN-MEMORY (RAM) ÜZERİNDE GÜNCELLE
    GUILD_LOG_CHANNELS[guildId] = logChannelId;
    
    // VERİYİ DOSYAYA KALICI OLARAK KAYDET
    saveLogChannels(); 
    
    const logEmbed = new EmbedBuilder()
        .setColor(0x371d5d)
        .setTitle('✅ LOG KANALI KALICI OLARAK AYARLANDI')
        .setDescription(`Bundan sonra sunucu logları **#${newLogChannel.name}** kanalına gönderilecektir.`)
        .addFields(
            { name: 'Kanal ID', value: logChannelId, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: `Yetkili: ${message.author.tag}` });
        
    message.channel.send({ embeds: [logEmbed] });

    // Komut mesajını sil
    message.delete().catch(() => {});
}

    // 21. KOMUT: !prefix [Yeni Prefix]
else if (command === 'prefix') {
    
    // Yöneticilik izni kontrolü
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply('Bu komutu kullanmak için **Yönetici** yetkisine sahip olmalısın.');
    }

    const newPrefix = args[0];

    if (!newPrefix) {
        // Kullanıcıya mevcut prefix'i ve kullanım şeklini göster.
        return message.reply(`Lütfen yeni bir prefix girin. Örn: \`${prefix}prefix !\` veya \`${prefix}prefix $\`. Mevcut prefix: **${prefix}**`);
    }

    if (newPrefix.length > 5) {
        return message.reply('Prefix en fazla 5 karakter olabilir.');
    }
    
    const oldPrefix = GUILD_PREFIXES[message.guild.id] || DEFAULT_PREFIX;

    // Prefix'i güncelle ve kaydet
    GUILD_PREFIXES[message.guild.id] = newPrefix;
    savePrefixes();

    // 1. İşlem Kanalına Bildirim Embed'i
    const prefixEmbed = new EmbedBuilder()
        .setColor(0x371d5d)
        .setTitle('✅ PREFIX GÜNCELLENDİ')
        .setDescription(`Sunucunun komut prefixi **\`${oldPrefix}\`** 'den **\`${newPrefix}\`** 'e ayarlandı.`)
        .setTimestamp()
        .setFooter({ text: `Yetkili: ${message.author.tag}` });
        
    message.channel.send({ embeds: [prefixEmbed] });
    
    // 2. LOG KAYDI OLUŞTURMA
    const logEmbed = new EmbedBuilder()
        .setColor(0x371d5d) // Turuncu renk (Uyarı/Ayarlar için)
        .setTitle('⚙️ SUNUCU AYARI DEĞİŞTİ')
        .addFields(
            { name: 'Eylem', value: 'Prefix Güncelleme', inline: false },
            { name: 'Eski Prefix', value: `\`${oldPrefix}\``, inline: true },
            { name: 'Yeni Prefix', value: `\`${newPrefix}\``, inline: true },
            { name: 'Yetkili', value: `${message.author.tag} (${message.author.id})`, inline: false }
        )
        .setTimestamp();
        
    await sendLog(logEmbed); // Logu Log Kanalına gönder

    message.delete().catch(() => {});
}

    // 22. KOMUT: !gelen-giden #[kanal]
else if (command === 'gelen-giden' || command === 'welcome-channel') {
    
    // Yöneticilik izni kontrolü
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply('Bu komutu kullanmak için **Yönetici** yetkisine sahip olmalısın.');
    }

    const newChannel = message.mentions.channels.first();
    const subCommand = args[0] ? args[0].toLowerCase() : null;

    if (!newChannel) {
        // Eğer etiketleme yapılmadıysa ve sıfırlama komutu varsa
        if (subCommand === 'kapat' || subCommand === 'sıfırla') {
            // Ayarı sil
            if (GUILD_SETTINGS[message.guild.id]) {
                delete GUILD_SETTINGS[message.guild.id].welcomeChannel;
                saveSettings();
                return message.reply('👋 Gelen/Giden mesaj kanalı ayarı **sıfırlandı**. Yeni üyeler için mesaj gönderilmeyecektir.');
            } else {
                return message.reply('Zaten ayarlanmış bir gelen/giden kanalı yok.');
            }
        }
        return message.reply('Lütfen gelen/giden mesajlarının gönderileceği bir metin kanalı etiketleyin. Örn: `!gelen-giden #hoş-geldiniz`');
    }
    
    // Geçerli bir metin kanalı mı kontrolü
    if (newChannel.type !== ChannelType.GuildText) {
        return message.reply('Lütfen geçerli bir metin kanalı etiketleyin.');
    }

    // Ayarı güncelle ve kaydet
    if (!GUILD_SETTINGS[message.guild.id]) {
        GUILD_SETTINGS[message.guild.id] = {};
    }
    GUILD_SETTINGS[message.guild.id].welcomeChannel = newChannel.id;
    saveSettings();

    const welcomeEmbed = new EmbedBuilder()
        .setColor(0x371d5d)
        .setTitle('👋 GELEN/GİDEN KANALI AYARLANDI')
        .setDescription(`Yeni üyeler için karşılama ve ayrılan üyeler için veda mesajları artık **#${newChannel.name}** kanalına gönderilecektir.`)
        .setTimestamp()
        .setFooter({ text: `Yetkili: ${message.author.tag}` });
        
    message.channel.send({ embeds: [welcomeEmbed] });
    message.delete().catch(() => {});
}
});// <-- BU PARANTEZ, client.on('messageCreate', ...) olayını kapatır.

// YENİ EVENT: Sunucuya üye katıldığında
client.on('guildMemberAdd', member => {
    const guildId = member.guild.id;
    const settings = GUILD_SETTINGS[guildId];

    // Ayar yapılmış mı kontrol et
    if (settings && settings.welcomeChannel) {
        const channelId = settings.welcomeChannel;
        const channel = member.guild.channels.cache.get(channelId);

        if (channel) {
            const welcomeEmbed = new EmbedBuilder()
                .setColor(0x371d5d)
                .setTitle('👋 HOŞ GELDİNİZ!')
                .setDescription(`**${member.user.tag}**, sunucumuza hoş geldin! Seni aramızda görmekten mutluluk duyuyoruz.`)
                .setThumbnail(member.user.displayAvatarURL())
                .addFields(
                    { name: 'Üye Sayısı', value: `${member.guild.memberCount}`, inline: true }
                )
                .setTimestamp();

            // Etiketlemeden sonra mesajı gönder
            channel.send({ content: `<@${member.user.id}>`, embeds: [welcomeEmbed] }).catch(console.error);
        }
    }
});

// YENİ EVENT: Sunucudan üye ayrıldığında
client.on('guildMemberRemove', member => {
    const guildId = member.guild.id;
    const settings = GUILD_SETTINGS[guildId];

    // Ayar yapılmış mı kontrol et
    if (settings && settings.welcomeChannel) {
        const channelId = settings.welcomeChannel;
        const channel = member.guild.channels.cache.get(channelId);

        if (channel) {
            const farewellEmbed = new EmbedBuilder()
                .setColor(0x371d5d)
                .setTitle('🚶 VEDA VAKTİ')
                .setDescription(`**${member.user.tag}** aramızdan ayrıldı. Görüşmek üzere!`)
                .setThumbnail(member.user.displayAvatarURL())
                .addFields(
                    { name: 'Kalan Üye Sayısı', value: `${member.guild.memberCount}`, inline: true }
                )
                .setTimestamp();

            channel.send({ embeds: [farewellEmbed] }).catch(console.error);
        }
    }
});

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