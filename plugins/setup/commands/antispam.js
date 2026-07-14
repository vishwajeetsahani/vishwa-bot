const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const container = require('../../../utils/container');
const { parseDuration, formatDuration } = require('../../../utils/duration');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antispam')
    .setDescription('Configure the anti-spam AutoMod system.')
    .addBooleanOption(option =>
      option.setName('enabled')
        .setDescription('Whether anti-spam should be active')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('threshold')
        .setDescription('Max messages allowed before triggering warn/delete (default: 5)')
        .setRequired(false)
        .setMinValue(2)
        .setMaxValue(20))
    .addStringOption(option =>
      option.setName('interval')
        .setDescription('Interval duration window (e.g. 5s, 10s; default: 5s)')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  modOnly: true,

  async execute(interaction, client) {
    const enabled = interaction.options.getBoolean('enabled');
    const threshold = interaction.options.getInteger('threshold');
    const intervalArg = interaction.options.getString('interval');

    const db = container.resolve('db');
    const embeds = container.resolve('embeds');

    const currentConfig = db.configs.get(interaction.guild.id);
    const updates = { antiSpam: enabled };

    if (threshold !== null) {
      updates.spamThreshold = threshold;
    }

    if (intervalArg !== null) {
      const intervalMs = parseDuration(intervalArg);
      if (!intervalMs || intervalMs < 1000 || intervalMs > 60000) {
        return interaction.reply({
          content: '⚠️ Invalid interval. Use a duration between `1s` and `60s` (e.g. `5s`, `10s`).',
          ephemeral: true
        });
      }
      updates.spamInterval = intervalMs;
    }

    db.configs.update(interaction.guild.id, updates);
    const newConfig = db.configs.get(interaction.guild.id);

    const embed = embeds.create('success')
      .setTitle('🔧 Anti-Spam Settings Updated')
      .setDescription(`Anti-spam has been successfully **${enabled ? 'enabled' : 'disabled'}** for this server.`)
      .addFields(
        { name: 'Threshold', value: `\`${newConfig.spamThreshold}\` messages`, inline: true },
        { name: 'Interval', value: `\`${formatDuration(newConfig.spamInterval)}\``, inline: true }
      );

    await interaction.reply({ embeds: [embed] });
  }
};
