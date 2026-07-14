const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const container = require('../../../utils/container');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-autorole')
    .setDescription('Configure a default role assigned automatically to new members on join.')
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('The role to assign automatically')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  modOnly: true,

  async execute(interaction, client) {
    const role = interaction.options.getRole('role');
    const db = container.resolve('db');
    const embeds = container.resolve('embeds');

    const botMember = interaction.guild.members.me;
    const invoker = interaction.member;

    // -----------------------------------------------------------------
    // Role Hierarchy & Managed Role validations
    // -----------------------------------------------------------------
    if (role.managed) {
      return interaction.reply({
        content: '⚠️ That role is managed by an integration/bot and cannot be assigned as an auto-role.',
        ephemeral: true
      });
    }

    if (role.id === interaction.guild.id) {
      return interaction.reply({
        content: '⚠️ You cannot set the `@everyone` role as an auto-role.',
        ephemeral: true
      });
    }

    // Check if bot can manage the role
    if (botMember.roles.highest.position <= role.position) {
      return interaction.reply({
        content: `🚫 I cannot configure this role as an auto-role. Its position is equal to or higher than my highest role (**${botMember.roles.highest.name}**).`,
        ephemeral: true
      });
    }

    // Check if executor can manage the role (hierarchy safety check)
    if (interaction.guild.ownerId !== invoker.id && invoker.roles.highest.position <= role.position) {
      return interaction.reply({
        content: `🚫 You cannot configure this role as an auto-role. Its position is equal to or higher than your highest role (**${invoker.roles.highest.name}**).`,
        ephemeral: true
      });
    }

    db.configs.update(interaction.guild.id, { autoRole: role.id });

    const embed = embeds.create('success')
      .setTitle('🔧 Auto-Role Configured')
      .setDescription(`Default joining role has been successfully set to ${role}.`);

    await interaction.reply({ embeds: [embed] });
  }
};
