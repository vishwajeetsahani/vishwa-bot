const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ButtonStyle,
  ComponentType,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder
} = require('discord.js');
const container = require('../../../utils/container');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('community')
    .setDescription('Manage community logging and notification framework.')
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Configure notification channels, active states, and ping settings.')
        // 9 Channel Options
        .addChannelOption(o => o.setName('announcement-channel').setDescription('Channel for announcements (e.g. Level Up).').addChannelTypes(ChannelType.GuildText))
        .addChannelOption(o => o.setName('economy-log-channel').setDescription('Channel for Economy Log notifications.').addChannelTypes(ChannelType.GuildText))
        .addChannelOption(o => o.setName('quest-channel').setDescription('Channel for Quest notifications.').addChannelTypes(ChannelType.GuildText))
        .addChannelOption(o => o.setName('shop-channel').setDescription('Channel for Shop notifications.').addChannelTypes(ChannelType.GuildText))
        .addChannelOption(o => o.setName('rare-drop-channel').setDescription('Channel for Rare Drop notifications.').addChannelTypes(ChannelType.GuildText))
        .addChannelOption(o => o.setName('achievement-channel').setDescription('Channel for Achievement notifications.').addChannelTypes(ChannelType.GuildText))
        .addChannelOption(o => o.setName('event-channel').setDescription('Channel for Event notifications.').addChannelTypes(ChannelType.GuildText))
        .addChannelOption(o => o.setName('leaderboard-channel').setDescription('Channel for Leaderboard notifications.').addChannelTypes(ChannelType.GuildText))
        .addChannelOption(o => o.setName('admin-log-channel').setDescription('Channel for Admin Log notifications.').addChannelTypes(ChannelType.GuildText))
        // 9 Toggle Options
        .addBooleanOption(o => o.setName('level-enabled').setDescription('Enable/Disable Level Up notifications.'))
        .addBooleanOption(o => o.setName('economy-enabled').setDescription('Enable/Disable Economy notifications.'))
        .addBooleanOption(o => o.setName('quest-enabled').setDescription('Enable/Disable Quest notifications.'))
        .addBooleanOption(o => o.setName('shop-enabled').setDescription('Enable/Disable Shop notifications.'))
        .addBooleanOption(o => o.setName('rare-drop-enabled').setDescription('Enable/Disable Rare Drop notifications.'))
        .addBooleanOption(o => o.setName('achievement-enabled').setDescription('Enable/Disable Achievement notifications.'))
        .addBooleanOption(o => o.setName('event-enabled').setDescription('Enable/Disable Event notifications.'))
        .addBooleanOption(o => o.setName('leaderboard-enabled').setDescription('Enable/Disable Leaderboard notifications.'))
        .addBooleanOption(o => o.setName('admin-enabled').setDescription('Enable/Disable Admin Log notifications.'))
        // 9 Mention Options
        .addStringOption(o => o.setName('level-mention').setDescription('Mention setting for Level Up.').addChoices(
          { name: 'User', value: 'user' },
          { name: 'Here', value: 'here' },
          { name: 'Everyone', value: 'everyone' },
          { name: 'Custom Role', value: 'role' },
          { name: 'No Mention', value: 'none' }
        ))
        .addStringOption(o => o.setName('economy-mention').setDescription('Mention setting for Economy.').addChoices(
          { name: 'User', value: 'user' },
          { name: 'Here', value: 'here' },
          { name: 'Everyone', value: 'everyone' },
          { name: 'Custom Role', value: 'role' },
          { name: 'No Mention', value: 'none' }
        ))
        .addStringOption(o => o.setName('quest-mention').setDescription('Mention setting for Quests.').addChoices(
          { name: 'User', value: 'user' },
          { name: 'Here', value: 'here' },
          { name: 'Everyone', value: 'everyone' },
          { name: 'Custom Role', value: 'role' },
          { name: 'No Mention', value: 'none' }
        ))
        .addStringOption(o => o.setName('shop-mention').setDescription('Mention setting for Shop.').addChoices(
          { name: 'User', value: 'user' },
          { name: 'Here', value: 'here' },
          { name: 'Everyone', value: 'everyone' },
          { name: 'Custom Role', value: 'role' },
          { name: 'No Mention', value: 'none' }
        ))
        .addStringOption(o => o.setName('rare-drop-mention').setDescription('Mention setting for Rare Drops.').addChoices(
          { name: 'User', value: 'user' },
          { name: 'Here', value: 'here' },
          { name: 'Everyone', value: 'everyone' },
          { name: 'Custom Role', value: 'role' },
          { name: 'No Mention', value: 'none' }
        ))
        .addStringOption(o => o.setName('achievement-mention').setDescription('Mention setting for Achievements.').addChoices(
          { name: 'User', value: 'user' },
          { name: 'Here', value: 'here' },
          { name: 'Everyone', value: 'everyone' },
          { name: 'Custom Role', value: 'role' },
          { name: 'No Mention', value: 'none' }
        ))
        .addStringOption(o => o.setName('event-mention').setDescription('Mention setting for Events.').addChoices(
          { name: 'User', value: 'user' },
          { name: 'Here', value: 'here' },
          { name: 'Everyone', value: 'everyone' },
          { name: 'Custom Role', value: 'role' },
          { name: 'No Mention', value: 'none' }
        ))
        .addStringOption(o => o.setName('leaderboard-mention').setDescription('Mention setting for Leaderboards.').addChoices(
          { name: 'User', value: 'user' },
          { name: 'Here', value: 'here' },
          { name: 'Everyone', value: 'everyone' },
          { name: 'Custom Role', value: 'role' },
          { name: 'No Mention', value: 'none' }
        ))
        .addStringOption(o => o.setName('admin-mention').setDescription('Mention setting for Admin Logs.').addChoices(
          { name: 'User', value: 'user' },
          { name: 'Here', value: 'here' },
          { name: 'Everyone', value: 'everyone' },
          { name: 'Custom Role', value: 'role' },
          { name: 'No Mention', value: 'none' }
        ))
        // Generic custom role option if configuration pings are role-bound
        .addRoleOption(o => o.setName('mention-role').setDescription('Custom role to ping when mention setting is set to Custom Role.'))
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
      'announcement-channel': 'announcementChannel',
      'economy-log-channel': 'economyLogChannel',
      'quest-channel': 'questChannel',
      'shop-channel': 'shopChannel',
      'rare-drop-channel': 'rareDropChannel',
      'achievement-channel': 'achievementChannel',
      'event-channel': 'eventChannel',
      'leaderboard-channel': 'leaderboardChannel',
      'admin-log-channel': 'adminLogChannel'
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
      'level': { dbKey: 'level_up', label: 'Level Up' },
      'economy': { dbKey: 'economy_log', label: 'Economy Log' },
      'quest': { dbKey: 'quest', label: 'Quest' },
      'shop': { dbKey: 'shop', label: 'Shop' },
      'rare-drop': { dbKey: 'rare_drop', label: 'Rare Drop' },
      'achievement': { dbKey: 'achievement', label: 'Achievement' },
      'event': { dbKey: 'event', label: 'Event' },
      'leaderboard': { dbKey: 'leaderboard', label: 'Leaderboard' },
      'admin': { dbKey: 'admin_log', label: 'Admin Log' }
    };

    const mentionRole = interaction.options.getRole('mention-role');
    let settingsAppliedCount = 0;
    
    for (const [optPrefix, info] of Object.entries(typeMap)) {
      const enabledVal = interaction.options.getBoolean(`${optPrefix}-enabled`);
      const mentionVal = interaction.options.getString(`${optPrefix}-mention`);

      if (enabledVal !== null || mentionVal !== null) {
        const current = db.notificationSettings.get(guildId, info.dbKey);
        const nextEnabled = enabledVal !== null ? enabledVal : current.enabled;
        const nextMention = mentionVal !== null ? mentionVal : current.mentionType;
        const nextRoleId = (nextMention === 'role' && mentionRole) ? mentionRole.id : current.mentionRoleId;

        db.notificationSettings.set(guildId, info.dbKey, nextEnabled, nextMention, nextRoleId);
        settingsAppliedCount++;
      }
    }

    const wasOptionsUsed = Object.keys(channelUpdates).length > 0 || settingsAppliedCount > 0;

    // -------------------------------------------------------------
    // Dashboard Rendering State
    // -------------------------------------------------------------
    let currentEditType = null; // null = Main Dashboard, string = specific type config

    const formatMention = (type, roleId) => {
      switch (type) {
        case 'user': return '👤 User involved';
        case 'here': return '🔔 @here';
        case 'everyone': return '📢 @everyone';
        case 'role': return roleId ? `🛡️ Custom Role (<@&${roleId}>)` : '🛡️ Custom Role (Not Selected)';
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

      const getSet = (type) => settings[type] || { enabled: true, mentionType: 'none', mentionRoleId: null };

      return embeds.create('info')
        .setTitle('🔧 Vishwa Bot - Final Notification setup')
        .setDescription('Configure optional text channels, toggles, and mention styles for all community activities. Non-active features will fail-safe.')
        .addFields(
          { name: '⚡ Level Up Announcements (HIGH)', value: `Channel: ${getChannelMention(config.announcementChannel)}\nStatus: ${getSet('level_up').enabled ? '🟢 Enabled' : '🔴 Disabled'}\nMention: ${formatMention(getSet('level_up').mentionType, getSet('level_up').mentionRoleId)}` },
          { name: '💰 Economy & Audit Logs (LOW)', value: `Channel: ${getChannelMention(config.economyLogChannel)}\nStatus: ${getSet('economy_log').enabled ? '🟢 Enabled' : '🔴 Disabled'}\nMention: ${formatMention(getSet('economy_log').mentionType, getSet('economy_log').mentionRoleId)}` },
          { name: '🛡️ Admin Log Audits (ADMIN)', value: `Channel: ${getChannelMention(config.adminLogChannel)}\nStatus: ${getSet('admin_log').enabled ? '🟢 Enabled' : '🔴 Disabled'}\nMention: ${formatMention(getSet('admin_log').mentionType, getSet('admin_log').mentionRoleId)}` },
          { name: '🗺️ Quests Channel (Future)', value: `Channel: ${getChannelMention(config.questChannel)}\nStatus: ${getSet('quest').enabled ? '🟢 Enabled' : '🔴 Disabled'}\nMention: ${formatMention(getSet('quest').mentionType, getSet('quest').mentionRoleId)}` },
          { name: '🛒 Shop Channel (Future)', value: `Channel: ${getChannelMention(config.shopChannel)}\nStatus: ${getSet('shop').enabled ? '🟢 Enabled' : '🔴 Disabled'}\nMention: ${formatMention(getSet('shop').mentionType, getSet('shop').mentionRoleId)}` },
          { name: '💎 Rare Drop Channel (Future)', value: `Channel: ${getChannelMention(config.rareDropChannel)}\nStatus: ${getSet('rare_drop').enabled ? '🟢 Enabled' : '🔴 Disabled'}\nMention: ${formatMention(getSet('rare_drop').mentionType, getSet('rare_drop').mentionRoleId)}` },
          { name: '🏆 Achievement Channel (Future)', value: `Channel: ${getChannelMention(config.achievementChannel)}\nStatus: ${getSet('achievement').enabled ? '🟢 Enabled' : '🔴 Disabled'}\nMention: ${formatMention(getSet('achievement').mentionType, getSet('achievement').mentionRoleId)}` },
          { name: '📊 Leaderboard Channel (Future)', value: `Channel: ${getChannelMention(config.leaderboardChannel)}\nStatus: ${getSet('leaderboard').enabled ? '🟢 Enabled' : '🔴 Disabled'}\nMention: ${formatMention(getSet('leaderboard').mentionType, getSet('leaderboard').mentionRoleId)}` },
          { name: '📅 Event Channel (Future)', value: `Channel: ${getChannelMention(config.eventChannel)}\nStatus: ${getSet('event').enabled ? '🟢 Enabled' : '🔴 Disabled'}\nMention: ${formatMention(getSet('event').mentionType, getSet('event').mentionRoleId)}` }
        );
    };

    // Helper: Build components for main dashboard view
    const buildDashboardComponents = () => {
      const typeSelect = components.createSelectMenu('setup_edit_type', 'Choose notification to edit...', [
        { label: 'Level Up', value: 'level_up', description: 'Configure Level Up announcements.' },
        { label: 'Economy Log', value: 'economy_log', description: 'Configure Economy balance logs.' },
        { label: 'Admin Log', value: 'admin_log', description: 'Configure Admin audit logs.' },
        { label: 'Quests (Future)', value: 'quest', description: 'Configure Quest notifications.' },
        { label: 'Shop (Future)', value: 'shop', description: 'Configure Shop logs.' },
        { label: 'Rare Drops (Future)', value: 'rare_drop', description: 'Configure Rare Drop broadcasts.' },
        { label: 'Achievements (Future)', value: 'achievement', description: 'Configure Achievement logs.' },
        { label: 'Leaderboard (Future)', value: 'leaderboard', description: 'Configure Leaderboard logs.' },
        { label: 'Events (Future)', value: 'event', description: 'Configure Event announcements.' }
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
        'level_up': 'Level Up Announcements',
        'economy_log': 'Economy Log Notifications',
        'admin_log': 'Admin Log Audits',
        'quest': 'Quests Channel Logs',
        'shop': 'Shop Purchases Channel Logs',
        'rare_drop': 'Rare Drops Broadcasts',
        'achievement': 'Achievements Channel Logs',
        'leaderboard': 'Leaderboard Channel Logs',
        'event': 'Events Channel Logs'
      };

      const typeChannelKeys = {
        'level_up': 'announcementChannel',
        'economy_log': 'economyLogChannel',
        'admin_log': 'adminLogChannel',
        'quest': 'questChannel',
        'shop': 'shopChannel',
        'rare_drop': 'rareDropChannel',
        'achievement': 'achievementChannel',
        'leaderboard': 'leaderboardChannel',
        'event': 'eventChannel'
      };

      const chKey = typeChannelKeys[type];
      const activeCh = config[chKey];

      const embed = embeds.create('info')
        .setTitle(`🔧 Edit Notification: ${typeLabels[type]}`)
        .setDescription(`Assign active text channel, toggle notifications, or configure custom role pings for **${typeLabels[type]}**.`)
        .addFields(
          { name: 'Active Channel', value: getChannelMention(activeCh) },
          { name: 'Toggled State', value: settings.enabled ? '🟢 Enabled' : '🔴 Disabled' },
          { name: 'Mention Setting', value: formatMention(settings.mentionType, settings.mentionRoleId) }
        );

      const selectChannel = new ChannelSelectMenuBuilder()
        .setCustomId('setup_sub_channel')
        .setPlaceholder('Select destination channel...')
        .setChannelTypes([ChannelType.GuildText]);

      const selectRole = new RoleSelectMenuBuilder()
        .setCustomId('setup_sub_role')
        .setPlaceholder('Select custom ping role...');

      const toggleBtn = components.createButton(
        'btn_sub_toggle',
        settings.enabled ? '🟢 Enabled: ON' : '🔴 Enabled: OFF',
        settings.enabled ? ButtonStyle.Success : ButtonStyle.Danger
      );

      const mentionBtn = components.createButton(
        'btn_sub_mention',
        `Cycle Ping Mode`,
        ButtonStyle.Secondary
      );

      const backBtn = components.createButton('btn_sub_back', '◀ Back', ButtonStyle.Secondary);

      // Only show Role Picker row if mention type is custom role
      const compRows = [
        components.createRow([selectChannel])
      ];

      if (settings.mentionType === 'role') {
        compRows.push(components.createRow([selectRole]));
      }

      compRows.push(components.createRow([toggleBtn, mentionBtn, backBtn]));

      return {
        embed,
        components: compRows
      };
    };

    // Initial respond
    const initialContent = wasOptionsUsed ? '✅ Setup options applied! Review or edit below:' : '🔧 Configure community setup settings:';
    
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
        const typeChannelKeys = {
          'level_up': 'announcementChannel',
          'economy_log': 'economyLogChannel',
          'admin_log': 'adminLogChannel',
          'quest': 'questChannel',
          'shop': 'shopChannel',
          'rare_drop': 'rareDropChannel',
          'achievement': 'achievementChannel',
          'leaderboard': 'leaderboardChannel',
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
        } else if (i.isRoleSelectMenu() && i.customId === 'setup_sub_role') {
          const selectedRoleId = i.values[0];
          const settings = db.notificationSettings.get(guildId, currentEditType);
          
          db.notificationSettings.set(guildId, currentEditType, settings.enabled, 'role', selectedRoleId);
          
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
            db.notificationSettings.set(guildId, currentEditType, !settings.enabled, settings.mentionType, settings.mentionRoleId);
            
            const editor = buildSubEditor(currentEditType);
            await i.update({
              embeds: [editor.embed],
              components: editor.components
            });
          } else if (i.customId === 'btn_sub_mention') {
            const settings = db.notificationSettings.get(guildId, currentEditType);
            const cycle = ['none', 'user', 'here', 'everyone', 'role'];
            const nextIdx = (cycle.indexOf(settings.mentionType) + 1) % cycle.length;
            const nextMention = cycle[nextIdx];
            
            db.notificationSettings.set(guildId, currentEditType, settings.enabled, nextMention, settings.mentionRoleId);
            
            const editor = buildSubEditor(currentEditType);
            await i.update({
              embeds: [editor.embed],
              components: editor.components
            });
          }
        }
      } catch (err) {
        console.error('[community setup cmd] Interaction error:', err);
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
