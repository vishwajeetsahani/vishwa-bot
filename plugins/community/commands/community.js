const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ButtonStyle,
  ComponentType,
  ChannelSelectMenuBuilder
} = require('discord.js');
const container = require('../../../utils/container');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('community')
    .setDescription('Manage community logging and notification framework.')
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Configure notification channels, active states, and ping settings.')
        // 8 Channel Options
        .addChannelOption(o => o.setName('community-channel').setDescription('Channel for general community notifications.').addChannelTypes(ChannelType.GuildText))
        .addChannelOption(o => o.setName('level-channel').setDescription('Channel for Level Up notifications.').addChannelTypes(ChannelType.GuildText))
        .addChannelOption(o => o.setName('economy-log-channel').setDescription('Channel for Economy Log notifications.').addChannelTypes(ChannelType.GuildText))
        .addChannelOption(o => o.setName('quest-channel').setDescription('Channel for Quest notifications.').addChannelTypes(ChannelType.GuildText))
        .addChannelOption(o => o.setName('achievement-channel').setDescription('Channel for Achievement notifications.').addChannelTypes(ChannelType.GuildText))
        .addChannelOption(o => o.setName('event-channel').setDescription('Channel for Event notifications.').addChannelTypes(ChannelType.GuildText))
        .addChannelOption(o => o.setName('rare-drop-channel').setDescription('Channel for Rare Drop notifications.').addChannelTypes(ChannelType.GuildText))
        .addChannelOption(o => o.setName('shop-channel').setDescription('Channel for Shop notifications.').addChannelTypes(ChannelType.GuildText))
        // 6 Toggle Options
        .addBooleanOption(o => o.setName('level-enabled').setDescription('Enable/Disable Level Up notifications.'))
        .addBooleanOption(o => o.setName('achievement-enabled').setDescription('Enable/Disable Achievement notifications.'))
        .addBooleanOption(o => o.setName('quest-enabled').setDescription('Enable/Disable Quest notifications.'))
        .addBooleanOption(o => o.setName('economy-enabled').setDescription('Enable/Disable Economy notifications.'))
        .addBooleanOption(o => o.setName('rare-drop-enabled').setDescription('Enable/Disable Rare Drop notifications.'))
        .addBooleanOption(o => o.setName('shop-enabled').setDescription('Enable/Disable Shop notifications.'))
        // 6 Mention Options
        .addStringOption(o => o.setName('level-mention').setDescription('Mention setting for Level Up.').addChoices(
          { name: 'User', value: 'user' },
          { name: 'Here', value: 'here' },
          { name: 'Everyone', value: 'everyone' },
          { name: 'No Mention', value: 'none' }
        ))
        .addStringOption(o => o.setName('achievement-mention').setDescription('Mention setting for Achievement.').addChoices(
          { name: 'User', value: 'user' },
          { name: 'Here', value: 'here' },
          { name: 'Everyone', value: 'everyone' },
          { name: 'No Mention', value: 'none' }
        ))
        .addStringOption(o => o.setName('quest-mention').setDescription('Mention setting for Quest.').addChoices(
          { name: 'User', value: 'user' },
          { name: 'Here', value: 'here' },
          { name: 'Everyone', value: 'everyone' },
          { name: 'No Mention', value: 'none' }
        ))
        .addStringOption(o => o.setName('economy-mention').setDescription('Mention setting for Economy.').addChoices(
          { name: 'User', value: 'user' },
          { name: 'Here', value: 'here' },
          { name: 'Everyone', value: 'everyone' },
          { name: 'No Mention', value: 'none' }
        ))
        .addStringOption(o => o.setName('rare-drop-mention').setDescription('Mention setting for Rare Drop.').addChoices(
          { name: 'User', value: 'user' },
          { name: 'Here', value: 'here' },
          { name: 'Everyone', value: 'everyone' },
          { name: 'No Mention', value: 'none' }
        ))
        .addStringOption(o => o.setName('shop-mention').setDescription('Mention setting for Shop.').addChoices(
          { name: 'User', value: 'user' },
          { name: 'Here', value: 'here' },
          { name: 'Everyone', value: 'everyone' },
          { name: 'No Mention', value: 'none' }
        ))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  modOnly: true,

  async execute(interaction, client) {
    const db = container.resolve('db');
    const embeds = container.resolve('embeds');
    const components = container.resolve('components');
    const guildId = interaction.guild.id;

    // -------------------------------------------------------------
    // Apply slash command option parameters if supplied
    // -------------------------------------------------------------
    const channelUpdates = {};
    const configMap = {
      'community-channel': 'communityChannel',
      'level-channel': 'levelChannel',
      'economy-log-channel': 'economyLogChannel',
      'quest-channel': 'questChannel',
      'achievement-channel': 'achievementChannel',
      'event-channel': 'eventChannel',
      'rare-drop-channel': 'rareDropChannel',
      'shop-channel': 'shopChannel'
    };

    for (const [optionName, dbKey] of Object.entries(configMap)) {
      const channelObj = interaction.options.getChannel(optionName);
      if (channelObj) {
        channelUpdates[dbKey] = channelObj.id;
      }
    }

    if (Object.keys(channelUpdates).length > 0) {
      db.configs.update(guildId, channelUpdates);
    }

    const typeMap = {
      'level': { dbKey: 'level_up', fallbackName: 'Level Up' },
      'achievement': { dbKey: 'achievement', fallbackName: 'Achievement' },
      'quest': { dbKey: 'quest', fallbackName: 'Quest' },
      'economy': { dbKey: 'economy', fallbackName: 'Economy' },
      'rare-drop': { dbKey: 'rare_drop', fallbackName: 'Rare Drop' },
      'shop': { dbKey: 'shop', fallbackName: 'Shop' }
    };

    let settingsAppliedCount = 0;
    for (const [optPrefix, info] of Object.entries(typeMap)) {
      const enabledVal = interaction.options.getBoolean(`${optPrefix}-enabled`);
      const mentionVal = interaction.options.getString(`${optPrefix}-mention`);

      if (enabledVal !== null || mentionVal !== null) {
        const current = db.notificationSettings.get(guildId, info.dbKey);
        const nextEnabled = enabledVal !== null ? enabledVal : current.enabled;
        const nextMention = mentionVal !== null ? mentionVal : current.mentionType;

        db.notificationSettings.set(guildId, info.dbKey, nextEnabled, nextMention);
        settingsAppliedCount++;
      }
    }

    const wasOptionsUsed = Object.keys(channelUpdates).length > 0 || settingsAppliedCount > 0;

    // -------------------------------------------------------------
    // Dashboard Rendering State
    // -------------------------------------------------------------
    let currentEditType = null; // null = Main Dashboard, string = specific type config

    const formatMention = (type) => {
      switch (type) {
        case 'user': return '👤 User involved';
        case 'here': return '🔔 @here';
        case 'everyone': return '📢 @everyone';
        default: return '❌ No Mention';
      }
    };

    const getChannelMention = (channelId) => {
      return channelId ? `<#${channelId}>` : '*Not Configured*';
    };

    // Helper: Build the dashboard overview embed
    const buildDashboardEmbed = () => {
      const config = db.configs.get(guildId);
      const settings = db.notificationSettings.getAll(guildId);

      // Default helper if DB entries are uninitialized
      const getSet = (type) => settings[type] || { enabled: true, mentionType: 'none' };

      return embeds.create('info')
        .setTitle('🔧 Community Setup Dashboard')
        .setDescription('Use the controls below to configure notifications, channels, active states, and pings for server events.')
        .addFields(
          { name: '👥 General Community Channel', value: getChannelMention(config.communityChannel) },
          { name: '⚡ Level Up Notifications', value: `Channel: ${getChannelMention(config.levelChannel)}\nStatus: ${getSet('level_up').enabled ? '🟢 Enabled' : '🔴 Disabled'}\nMention: ${formatMention(getSet('level_up').mentionType)}` },
          { name: '🏆 Achievement Alerts', value: `Channel: ${getChannelMention(config.achievementChannel)}\nStatus: ${getSet('achievement').enabled ? '🟢 Enabled' : '🔴 Disabled'}\nMention: ${formatMention(getSet('achievement').mentionType)}` },
          { name: '🗺️ Quest Announcements', value: `Channel: ${getChannelMention(config.questChannel)}\nStatus: ${getSet('quest').enabled ? '🟢 Enabled' : '🔴 Disabled'}\nMention: ${formatMention(getSet('quest').mentionType)}` },
          { name: '💰 Economy & Audit Logs', value: `Channel: ${getChannelMention(config.economyLogChannel)}\nStatus: ${getSet('economy').enabled ? '🟢 Enabled' : '🔴 Disabled'}\nMention: ${formatMention(getSet('economy').mentionType)}` },
          { name: '✨ Rare Drop Broadcasts', value: `Channel: ${getChannelMention(config.rareDropChannel)}\nStatus: ${getSet('rare_drop').enabled ? '🟢 Enabled' : '🔴 Disabled'}\nMention: ${formatMention(getSet('rare_drop').mentionType)}` },
          { name: '🛒 Shop Purchase Alerts', value: `Channel: ${getChannelMention(config.shopChannel)}\nStatus: ${getSet('shop').enabled ? '🟢 Enabled' : '🔴 Disabled'}\nMention: ${formatMention(getSet('shop').mentionType)}` },
          { name: '📅 Event Announcements', value: `Channel: ${getChannelMention(config.eventChannel)}\nStatus: 🟢 Always Enabled\nMention: ${formatMention(getSet('event').mentionType)}` }
        );
    };

    // Helper: Build components for main dashboard view
    const buildDashboardComponents = () => {
      const typeSelect = components.createSelectMenu('setup_edit_type', 'Choose notification to edit...', [
        { label: 'General Community', value: 'community', description: 'Configure fallback community notifications.' },
        { label: 'Level Up', value: 'level_up', description: 'Configure level-up alerts.' },
        { label: 'Achievements', value: 'achievement', description: 'Configure achievement alerts.' },
        { label: 'Quests', value: 'quest', description: 'Configure quest created and completed logs.' },
        { label: 'Economy', value: 'economy', description: 'Configure economy balance logs.' },
        { label: 'Rare Drops', value: 'rare_drop', description: 'Configure rare drop logs.' },
        { label: 'Shop Purchases', value: 'shop', description: 'Configure shop purchase logs.' },
        { label: 'Event Announcements', value: 'event', description: 'Configure special event announcements.' }
      ]);

      const doneBtn = components.createButton('btn_dashboard_done', '💾 Done', ButtonStyle.Success);

      return [
        components.createRow([typeSelect]),
        components.createRow([doneBtn])
      ];
    };

    // Helper: Build sub-editor for specific type
    const buildSubEditor = (type) => {
      const config = db.configs.get(guildId);
      const settings = db.notificationSettings.get(guildId, type);

      const typeLabels = {
        'community': 'General Community Fallback',
        'level_up': 'Level Up Alerts',
        'achievement': 'Achievement Alerts',
        'quest': 'Quest Logs',
        'economy': 'Economy Audit Logs',
        'rare_drop': 'Rare Drop Broadcasts',
        'shop': 'Shop Purchase Logs',
        'event': 'Event Announcements'
      };

      const typeChannelKeys = {
        'community': 'communityChannel',
        'level_up': 'levelChannel',
        'achievement': 'achievementChannel',
        'quest': 'questChannel',
        'economy': 'economyLogChannel',
        'rare_drop': 'rareDropChannel',
        'shop': 'shopChannel',
        'event': 'eventChannel'
      };

      const chKey = typeChannelKeys[type];
      const activeCh = config[chKey];

      const embed = embeds.create('info')
        .setTitle(`🔧 Edit Notification: ${typeLabels[type]}`)
        .setDescription(`Assign channels, toggle enabled/disabled status, or modify pings for **${typeLabels[type]}**.`)
        .addFields(
          { name: 'Active Channel', value: getChannelMention(activeCh) },
          { name: 'Toggled State', value: settings.enabled ? '🟢 Enabled' : '🔴 Disabled' },
          { name: 'Mention Setting', value: formatMention(settings.mentionType) }
        );

      // Create a Channel Select Menu component to pick channels directly
      const selectChannel = new ChannelSelectMenuBuilder()
        .setCustomId('setup_sub_channel')
        .setPlaceholder('Select destination channel...')
        .setChannelTypes([ChannelType.GuildText]);

      const toggleBtn = components.createButton(
        'btn_sub_toggle',
        settings.enabled ? '🟢 Enabled: ON' : '🔴 Enabled: OFF',
        settings.enabled ? ButtonStyle.Success : ButtonStyle.Danger,
        type === 'community' // Community fallback channel cannot be disabled this way
      );

      const mentionBtn = components.createButton(
        'btn_sub_mention',
        `Cycle Ping: ${formatMention(settings.mentionType)}`,
        ButtonStyle.Secondary
      );

      const backBtn = components.createButton('btn_sub_back', '◀ Back', ButtonStyle.Secondary);

      return {
        embed,
        components: [
          components.createRow([selectChannel]),
          components.createRow([toggleBtn, mentionBtn, backBtn])
        ]
      };
    };

    // Respond with initial view
    const initialContent = wasOptionsUsed ? '✅ Settings applied! Review or edit below:' : '🔧 Configure community setup settings:';
    
    const reply = await interaction.reply({
      content: initialContent,
      embeds: [buildDashboardEmbed()],
      components: buildDashboardComponents(),
      fetchReply: true
    });

    const collector = reply.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 240000 // 4 minutes
    });

    collector.on('collect', async i => {
      try {
        const config = db.configs.get(guildId);
        
        // Define channel keys lookup
        const typeChannelKeys = {
          'community': 'communityChannel',
          'level_up': 'levelChannel',
          'achievement': 'achievementChannel',
          'quest': 'questChannel',
          'economy': 'economyLogChannel',
          'rare_drop': 'rareDropChannel',
          'shop': 'shopChannel',
          'event': 'eventChannel'
        };

        if (i.isStringSelectMenu() && i.customId === 'setup_edit_type') {
          currentEditType = i.values[0];
          const editor = buildSubEditor(currentEditType);
          await i.update({
            content: `Editing settings for **${currentEditType}**:`,
            embeds: [editor.embed],
            components: editor.components
          });
        } else if (i.isChannelSelectMenu() && i.customId === 'setup_sub_channel') {
          const selectedChId = i.values[0];
          const chKey = typeChannelKeys[currentEditType];
          
          db.configs.update(guildId, { [chKey]: selectedChId });
          
          const editor = buildSubEditor(currentEditType);
          await i.update({
            embeds: [editor.embed],
            components: editor.components
          });
        } else if (i.isButton()) {
          if (i.customId === 'btn_dashboard_done') {
            collector.stop('saved');
            await i.update({
              content: '✅ Community notification configurations updated successfully!',
              embeds: [],
              components: []
            });
          } else if (i.customId === 'btn_sub_back') {
            currentEditType = null;
            await i.update({
              content: '🔧 Configure community setup settings:',
              embeds: [buildDashboardEmbed()],
              components: buildDashboardComponents()
            });
          } else if (i.customId === 'btn_sub_toggle') {
            const settings = db.notificationSettings.get(guildId, currentEditType);
            db.notificationSettings.set(guildId, currentEditType, !settings.enabled, settings.mentionType);
            
            const editor = buildSubEditor(currentEditType);
            await i.update({
              embeds: [editor.embed],
              components: editor.components
            });
          } else if (i.customId === 'btn_sub_mention') {
            const settings = db.notificationSettings.get(guildId, currentEditType);
            const cycle = ['none', 'user', 'here', 'everyone'];
            const nextIdx = (cycle.indexOf(settings.mentionType) + 1) % cycle.length;
            const nextMention = cycle[nextIdx];
            
            db.notificationSettings.set(guildId, currentEditType, settings.enabled, nextMention);
            
            const editor = buildSubEditor(currentEditType);
            await i.update({
              embeds: [editor.embed],
              components: editor.components
            });
          }
        }
      } catch (err) {
        console.error('[community cmd] Interaction error:', err);
      }
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time') {
        await interaction.editReply({
          content: '⚠️ Configuration session timed out (4 minutes). Run `/community setup` again to configure.',
          embeds: [],
          components: []
        }).catch(() => {});
      }
    });
  }
};
