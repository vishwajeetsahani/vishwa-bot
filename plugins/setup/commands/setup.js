/**
 * setup.js
 * -----------------------------------------------------------------------
 * Setup Image Cards Slash Command (Vishwa Bot v2.0)
 *
 * Implements interactive dashboards for Welcome and Goodbye image settings.
 * Uses select menus, buttons, modals, and dynamic canvas previews.
 * -----------------------------------------------------------------------
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ButtonStyle,
  AttachmentBuilder,
  TextInputStyle
} = require('discord.js');
const container = require('../../../utils/container');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure welcome and goodbye image cards.')
    .addSubcommand(sub =>
      sub.setName('welcome')
        .setDescription('Configure welcome cards for joining members.'))
    .addSubcommand(sub =>
      sub.setName('goodbye')
        .setDescription('Configure goodbye cards for leaving members.'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  modOnly: true,

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const db = container.resolve('db');
    const embeds = container.resolve('embeds');
    const components = container.resolve('components');
    const imageService = container.resolve('image');

    const guildId = interaction.guild.id;
    const cardType = subcommand; // 'welcome' or 'goodbye'

    // Fetch initial card settings from SQLite
    const initialConfig = db.cards.get(guildId);

    // Create session state
    const session = {
      theme: cardType === 'welcome' ? initialConfig.welcomeTheme : initialConfig.goodbyeTheme,
      bgType: cardType === 'welcome' ? initialConfig.welcomeBgType : initialConfig.goodbyeBgType,
      bgValue: cardType === 'welcome' ? initialConfig.welcomeBgValue : initialConfig.goodbyeBgValue,
      customText: cardType === 'welcome' ? initialConfig.welcomeCustomText : initialConfig.goodbyeCustomText,
      mode: cardType === 'welcome' ? initialConfig.welcomeMode : initialConfig.goodbyeMode
    };

    // Helper: Build dashboard components array
    const buildDashboardComponents = (sess) => {
      const themeSelect = components.createSelectMenu('setup_theme', 'Select Theme Card Style...', [
        { label: 'Minimal (Clean)', value: 'minimal', description: 'Simple slate style.', default: sess.theme === 'minimal' },
        { label: 'Discord', value: 'discord', description: 'Classic blurple layout.', default: sess.theme === 'discord' },
        { label: 'Neon (Glow)', value: 'neon', description: 'Electric colors grid.', default: sess.theme === 'neon' },
        { label: 'Gaming', value: 'gaming', description: 'Dark high-tech theme.', default: sess.theme === 'gaming' },
        { label: 'Anime', value: 'anime', description: 'Pastel colors canvas.', default: sess.theme === 'anime' },
        { label: 'Premium (Luxury)', value: 'premium', description: 'Sleek gold stripes.', default: sess.theme === 'premium' }
      ]);

      const bgSelect = components.createSelectMenu('setup_bg', 'Select Background Mode...', [
        { label: 'Match Theme Preset', value: 'theme:preset', description: 'Standard backdrop for chosen theme.', default: sess.bgType === 'theme' },
        { label: 'Solid Slate Gray', value: 'color:#2F3136', description: 'Clean dark slate color.', default: sess.bgType === 'color' && sess.bgValue === '#2F3136' },
        { label: 'Solid Blurple', value: 'color:#5865F2', description: 'Bright discord brand color.', default: sess.bgType === 'color' && sess.bgValue === '#5865F2' },
        { label: 'Gradient Sunset', value: 'gradient:#FF7E5F,#FEB47B', description: 'Linear warm orange gradient.', default: sess.bgType === 'gradient' && sess.bgValue === '#FF7E5F,#FEB47B' },
        { label: 'Gradient Neon', value: 'gradient:#FF007F,#00FFFF', description: 'Pink to cyan gradient.', default: sess.bgType === 'gradient' && sess.bgValue === '#FF007F,#00FFFF' }
      ]);

      const rowButtons1 = components.createRow([
        components.createButton('btn_preview', '👁️ Preview Card', ButtonStyle.Secondary),
        components.createButton('btn_text', '✏️ Edit Tagline Text', ButtonStyle.Primary),
        components.createButton('btn_mode', `Toggle Mode (${sess.mode === 'dark' ? 'Dark' : 'Light'})`, ButtonStyle.Secondary)
      ]);

      const rowButtons2 = components.createRow([
        components.createButton('btn_save', '💾 Save Configuration', ButtonStyle.Success),
        components.createButton('btn_cancel', '❌ Cancel', ButtonStyle.Danger)
      ]);

      return [
        components.createRow([themeSelect]),
        components.createRow([bgSelect]),
        rowButtons1,
        rowButtons2
      ];
    };

    // Helper: Build description embed
    const buildEmbed = (sess) => {
      return embeds.create('info')
        .setTitle(`🔧 Customize ${cardType.toUpperCase()} Image Card`)
        .setDescription(`Use the menus and buttons below to configure your joining cards dynamically. Use **Preview** to verify the image rendering.`)
        .addFields(
          { name: 'Selected Theme', value: `\`${sess.theme}\``, inline: true },
          { name: 'Background Type', value: `\`${sess.bgType}\``, inline: true },
          { name: 'Background Value', value: `\`${sess.bgValue}\``, inline: true },
          { name: 'Custom Tagline', value: `"${sess.customText}"` },
          { name: 'Text Colors Mode', value: `\`${sess.mode.toUpperCase()}\``, inline: true }
        );
    };

    const reply = await interaction.reply({
      embeds: [buildEmbed(session)],
      components: buildDashboardComponents(session),
      fetchReply: true
    });

    const collector = reply.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 180000 // 3 minutes timeout
    });

    collector.on('collect', async i => {
      try {
        if (i.isStringSelectMenu()) {
          if (i.customId === 'setup_theme') {
            session.theme = i.values[0];
            // If background is theme-bound, update it to align
            if (session.bgType === 'theme') {
              session.bgValue = i.values[0];
            }
          } else if (i.customId === 'setup_bg') {
            const rawVal = i.values[0];
            if (rawVal.startsWith('color:')) {
              session.bgType = 'color';
              session.bgValue = rawVal.replace('color:', '');
            } else if (rawVal.startsWith('gradient:')) {
              session.bgType = 'gradient';
              session.bgValue = rawVal.replace('gradient:', '');
            } else {
              session.bgType = 'theme';
              session.bgValue = session.theme;
            }
          }
          await i.update({
            embeds: [buildEmbed(session)],
            components: buildDashboardComponents(session)
          });
        } else if (i.isButton()) {
          if (i.customId === 'btn_mode') {
            session.mode = session.mode === 'dark' ? 'light' : 'dark';
            await i.update({
              embeds: [buildEmbed(session)],
              components: buildDashboardComponents(session)
            });
          } else if (i.customId === 'btn_preview') {
            await i.deferReply({ ephemeral: true });
            
            // Build temporary preview buffer using ImageService
            const renderOptions = {
              theme: session.theme,
              bgType: session.bgType,
              bgValue: session.bgValue,
              customText: session.customText,
              mode: session.mode
            };

            let buffer;
            if (cardType === 'welcome') {
              buffer = await imageService.generateWelcomeCard(i.user, i.guild, renderOptions);
            } else {
              buffer = await imageService.generateGoodbyeCard(i.user, i.guild, renderOptions);
            }

            const attachment = new AttachmentBuilder(buffer, { name: 'preview.png' });
            await i.editReply({
              content: '🔍 Here is a preview of your image card:',
              files: [attachment]
            });
          } else if (i.customId === 'btn_text') {
            // Show custom tagline input Modal
            const modal = components.createModal('setup_text_modal', 'Custom Tagline Text', [
              {
                customId: 'tagline_input',
                label: 'Tagline text (Max 45 chars)',
                style: TextInputStyle.Short,
                required: true,
                value: session.customText
              }
            ]);

            await i.showModal(modal);

            // Wait for modal submit
            const submitted = await i.awaitModalSubmit({
              time: 60000,
              filter: mi => mi.user.id === interaction.user.id && mi.customId === 'setup_text_modal'
            }).catch(() => null);

            if (submitted) {
              const textVal = submitted.fields.getTextInputValue('tagline_input');
              session.customText = textVal.slice(0, 45); // Sanitize and truncate

              await submitted.update({
                embeds: [buildEmbed(session)],
                components: buildDashboardComponents(session)
              });
            }
          } else if (i.customId === 'btn_save') {
            // Commit to SQLite database card tables
            const updates = {};
            if (cardType === 'welcome') {
              updates.welcomeTheme = session.theme;
              updates.welcomeBgType = session.bgType;
              updates.welcomeBgValue = session.bgValue;
              updates.welcomeCustomText = session.customText;
              updates.welcomeMode = session.mode;
            } else {
              updates.goodbyeTheme = session.theme;
              updates.goodbyeBgType = session.bgType;
              updates.goodbyeBgValue = session.bgValue;
              updates.goodbyeCustomText = session.customText;
              updates.goodbyeMode = session.mode;
            }

            db.cards.update(guildId, updates);
            collector.stop('saved');

            await i.update({
              content: `✅ Successfully saved **${cardType.toUpperCase()}** image card settings!`,
              embeds: [],
              components: []
            });
          } else if (i.customId === 'btn_cancel') {
            collector.stop('cancelled');
            await i.update({
              content: '❌ Configuration cancelled.',
              embeds: [],
              components: []
            });
          }
        }
      } catch (err) {
        console.error('[setup cmd] Interaction collect error:', err);
      }
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time') {
        await interaction.editReply({
          content: '⚠️ Configuration session timed out (3 minutes). Please run `/setup` again.',
          embeds: [],
          components: []
        }).catch(() => {});
      }
    });
  }
};
