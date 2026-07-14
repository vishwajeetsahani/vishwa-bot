const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Displays a list of all available commands.'),

  async execute(interaction, client) {
    // Group commands by plugin
    const categories = {};

    for (const command of client.commands.values()) {
      if (!command.data) continue; // Include only slash commands
      const category = command.plugin || 'utility';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(command);
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📖 Vishwa Bot — Command List')
      .setDescription('Here is a list of all available Slash commands grouped by module.\nCommands marked 🛡️ require moderator permissions.')
      .setThumbnail(client.user.displayAvatarURL())
      .setTimestamp();

    const categoryNames = {
      moderation: '🛡️ Moderation',
      setup: '⚙️ Setup',
      utility: '🔧 Utility'
    };

    for (const [catKey, cmds] of Object.entries(categories)) {
      if (cmds.length === 0) continue;
      const title = categoryNames[catKey] || `📦 ${catKey.charAt(0).toUpperCase() + catKey.slice(1)}`;
      
      const val = cmds
        .map((c) => {
          const modIndicator = c.modOnly || c.data.default_member_permissions ? ' 🛡️' : '';
          return `\`/${c.data.name}\`${modIndicator} — ${c.data.description}`;
        })
        .join('\n');

      embed.addFields({ name: title, value: val });
    }

    await interaction.reply({ embeds: [embed] });
  }
};
