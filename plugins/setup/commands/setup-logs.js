const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const container = require('../../../utils/container');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-logs')
    .setDescription('Configure the moderation audit logs channel.')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The channel where moderation actions should be logged')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  modOnly: true,

  async execute(interaction, client) {
    const channel = interaction.options.getChannel('channel');
    const db = container.resolve('db');
    const embeds = container.resolve('embeds');

    db.configs.update(interaction.guild.id, { logChannel: channel.id });

    const embed = embeds.create('success')
      .setTitle('🔧 Moderation Logs Configured')
      .setDescription(`Audit logs channel has been successfully set to ${channel}.`);

    await interaction.reply({ embeds: [embed] });
  }
};
