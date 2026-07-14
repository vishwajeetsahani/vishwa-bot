const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const container = require('../../../utils/container');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antilink')
    .setDescription('Toggles the anti-link AutoMod system on or off.')
    .addBooleanOption(option =>
      option.setName('enabled')
        .setDescription('Whether anti-link should be active')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  modOnly: true,

  async execute(interaction, client) {
    const enabled = interaction.options.getBoolean('enabled');
    const db = container.resolve('db');
    const embeds = container.resolve('embeds');

    db.configs.update(interaction.guild.id, { antiLink: enabled });

    const embed = embeds.create('success')
      .setTitle('🔧 Anti-Link Settings Updated')
      .setDescription(`Anti-link has been successfully **${enabled ? 'enabled' : 'disabled'}** for this server.`);

    await interaction.reply({ embeds: [embed] });
  }
};
