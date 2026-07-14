/**
 * guildMemberAdd.js
 * -----------------------------------------------------------------------
 * Member Join Event Listener for Setup Plugin (Vishwa Bot v2.0)
 *
 * Automatically assigns configured auto-roles and dispatches customized
 * welcome alerts to designated greeting channels.
 * -----------------------------------------------------------------------
 */

const container = require('../../../utils/container');

module.exports = {
  name: 'guildMemberAdd',

  async execute(member, client) {
    const db = container.resolve('db');
    const errors = container.resolve('errors');
    
    const guild = member.guild;

    try {
      const config = db.configs.get(guild.id);

      // -----------------------------------------------------------------
      // Dispatch Welcome Alert Message
      // -----------------------------------------------------------------
      if (config.welcomeChannel) {
        const welcomeChannel = guild.channels.cache.get(config.welcomeChannel);
        if (welcomeChannel) {
          const rawMessage = config.welcomeMessage || 'Welcome {user} to **{server}**! We are now at {membercount} members.';
          const formattedMessage = rawMessage
            .replace(/{user}/g, member.toString())
            .replace(/{server}/g, guild.name)
            .replace(/{membercount}/g, guild.memberCount.toString());

          // Render welcome card image using ImageService
          const cardConfig = db.cards.get(guild.id);
          const imageService = container.resolve('image');
          let fileAttachment = null;

          try {
            const buffer = await imageService.generateWelcomeCard(member.user, guild, {
              theme: cardConfig.welcomeTheme,
              bgType: cardConfig.welcomeBgType,
              bgValue: cardConfig.welcomeBgValue,
              customText: cardConfig.welcomeCustomText,
              mode: cardConfig.welcomeMode
            });
            const { AttachmentBuilder } = require('discord.js');
            fileAttachment = new AttachmentBuilder(buffer, { name: 'welcome.png' });
          } catch (canvasErr) {
            errors.log(canvasErr, `guildMemberAdd:welcome_image_render:${guild.id}`);
          }

          const sendPayload = { content: formattedMessage };
          if (fileAttachment) {
            sendPayload.files = [fileAttachment];
          }

          await welcomeChannel.send(sendPayload).catch(err => {
            errors.log(err, `guildMemberAdd:welcome_send:${guild.id}`);
          });
        }
      }

      // -----------------------------------------------------------------
      // Assign Configured Auto-Role
      // -----------------------------------------------------------------
      if (config.autoRole) {
        const role = guild.roles.cache.get(config.autoRole);
        if (role) {
          const botMe = guild.members.me;
          
          // Verify role hierarchy before attempting to add role
          if (botMe && botMe.roles.highest.position > role.position) {
            await member.roles.add(role, 'Auto-role on member join').catch(err => {
              errors.log(err, `guildMemberAdd:autorole_assign:${guild.id}`);
            });
          } else {
            console.warn(`[Auto-Role] Skipped assigning "${role.name}" in "${guild.name}" — role position exceeds bot hierarchy.`);
          }
        }
      }
    } catch (err) {
      errors.log(err, `guildMemberAdd:main:${guild.id}`);
    }
  }
};
