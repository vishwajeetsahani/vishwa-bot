const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const container = require('../../../utils/container');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antiinvite')
    .setDescription('Toggles the anti-invite AutoMod system on or off.')
    .addBooleanOption(option =>
      option.setName('enabled')
        .setDescription('Whether anti-invite should be active')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  modOnly: true,

  async execute(interaction, client) {
    const enabled = interaction.options.getBoolean('enabled');
    const db = container.resolve('db');
    const embeds = container.resolve('embeds');

    db.configs.update(interaction.guild.id, { antiInvite: enabled });

    const embed = embeds.create('success')
      .setTitle('🔧 Anti-Invite Settings Updated')
      .setDescription(`Anti-invite has been successfully **${enabled ? 'enabled' : 'disabled'}** for this server.`);

    await interaction.reply({ embeds: [embed] });
  }
};
