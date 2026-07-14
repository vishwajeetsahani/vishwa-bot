const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig } = require('../../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription("Displays the server's current bot configuration.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  modOnly: true,

  async execute(interaction, client) {
    const config = getGuildConfig(interaction.guild.id);

    const formatChannel = (id) => (id ? `<#${id}>` : '*Not set*');
    const formatRole = (id) => (id ? `<@&${id}>` : '*Not set*');
    const formatToggle = (val) => (val ? '✅ Enabled' : '❌ Disabled');

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`⚙️ Settings — ${interaction.guild.name}`)
      .addFields(
        { name: 'Prefix', value: `\`${config.prefix}\``, inline: true },
        { name: 'Anti-Link', value: formatToggle(config.antiLink), inline: true },
        { name: 'Anti-Invite', value: formatToggle(config.antiInvite), inline: true },
        { name: 'Anti-Spam', value: formatToggle(config.antiSpam), inline: true },
        { name: 'Welcome Channel', value: formatChannel(config.welcomeChannel), inline: true },
        { name: 'Goodbye Channel', value: formatChannel(config.goodbyeChannel), inline: true },
        { name: 'Log Channel', value: formatChannel(config.logChannel), inline: true },
        { name: 'Auto-Role', value: formatRole(config.autoRole), inline: true },
        { name: 'Spam Threshold', value: `${config.spamThreshold} msgs / ${config.spamInterval / 1000}s`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
