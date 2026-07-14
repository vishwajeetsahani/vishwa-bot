const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const container = require('../../../utils/container');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eco-config')
    .setDescription('Configure economy admin settings.')
    .addSubcommand(sub =>
      sub.setName('community')
        .setDescription('Set the server Community Hub channel.')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('The text channel to configure')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('logs')
        .setDescription('Set the Economy Log Channel.')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('The text channel to configure')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('role')
        .setDescription('Set the Economy Manager role.')
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('The role allowed to modify balances and XP')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('show')
        .setDescription('Show current economy admin configurations.')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  modOnly: true,

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const db = container.resolve('db');
    const embeds = container.resolve('embeds');
    const guildId = interaction.guild.id;

    console.log(`[TRACE_CMD] /eco-config executed. Guild ID: ${guildId}, Subcommand: ${subcommand}`);

    if (subcommand === 'community') {
      const channel = interaction.options.getChannel('channel');
      console.log(`[TRACE_CMD] Option channel ID received from Discord: ${channel.id}`);
      
      const updateObj = { communityChannel: channel.id };
      console.log(`[TRACE_CMD] Immediately before calling db.configs.update(). Guild ID: ${guildId}, Update Object:`, updateObj);
      console.log(`[TRACE_CMD] Invoking db.configs.update().`);
      db.configs.update(guildId, updateObj);

      const reloaded = db.configs.get(guildId);
      console.log(`[TRACE_CMD] Immediately after db.configs.update(). Returned configuration:`, reloaded);

      const embed = embeds.create('success')
        .setTitle('🔧 Community Hub Configured')
        .setDescription(`Community channel has been successfully set to ${channel}.`);
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'logs') {
      const channel = interaction.options.getChannel('channel');
      console.log(`[TRACE_CMD] Option channel ID received from Discord: ${channel.id}`);
      
      const updateObj = { economyLogChannel: channel.id };
      console.log(`[TRACE_CMD] Immediately before calling db.configs.update(). Guild ID: ${guildId}, Update Object:`, updateObj);
      console.log(`[TRACE_CMD] Invoking db.configs.update().`);
      db.configs.update(guildId, updateObj);

      const reloaded = db.configs.get(guildId);
      console.log(`[TRACE_CMD] Immediately after db.configs.update(). Returned configuration:`, reloaded);

      const embed = embeds.create('success')
        .setTitle('🔧 Economy Logs Channel Configured')
        .setDescription(`Economy modifications log channel has been successfully set to ${channel}.`);
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'role') {
      const role = interaction.options.getRole('role');
      console.log(`[TRACE_CMD] Option role ID received from Discord: ${role.id}`);
      
      const updateObj = { economyManagerRole: role.id };
      console.log(`[TRACE_CMD] Immediately before calling db.configs.update(). Guild ID: ${guildId}, Update Object:`, updateObj);
      console.log(`[TRACE_CMD] Invoking db.configs.update().`);
      db.configs.update(guildId, updateObj);

      const reloaded = db.configs.get(guildId);
      console.log(`[TRACE_CMD] Immediately after db.configs.update(). Returned configuration:`, reloaded);

      const embed = embeds.create('success')
        .setTitle('🔧 Economy Manager Role Configured')
        .setDescription(`Economy Manager role has been successfully set to **${role.name}**.`);
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'show') {
      const config = db.configs.get(guildId);
      console.log(`[TRACE_CMD] /eco-config show. Loaded configuration:`, config);
      const communityChan = config.communityChannel ? `<#${config.communityChannel}>` : '*None*';
      const logChan = config.economyLogChannel ? `<#${config.economyLogChannel}>` : '*None*';
      const managerRole = config.economyManagerRole ? `<@&${config.economyManagerRole}>` : '*None*';

      const embed = embeds.create('info')
        .setTitle('🔧 Economy Admin Settings')
        .setDescription('Current server configuration for economy and levels:')
        .addFields(
          { name: '💬 Community Channel', value: communityChan, inline: true },
          { name: '📜 Economy Log Channel', value: logChan, inline: true },
          { name: '💼 Economy Manager Role', value: managerRole, inline: true }
        );
      return interaction.reply({ embeds: [embed] });
    }
  }
};
