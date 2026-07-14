/**
 * guildMemberRemove.js
 * -----------------------------------------------------------------------
 * Member Leave Event Listener for Setup Plugin (Vishwa Bot v2.0)
 *
 * Dispatches customized goodbye notifications to designated leaving
 * notification channels.
 * -----------------------------------------------------------------------
 */

const container = require('../../../utils/container');

module.exports = {
  name: 'guildMemberRemove',

  async execute(member, client) {
    const db = container.resolve('db');
    const errors = container.resolve('errors');
    
    const guild = member.guild;

    try {
      const config = db.configs.get(guild.id);

      if (config.goodbyeChannel) {
        const goodbyeChannel = guild.channels.cache.get(config.goodbyeChannel);
        if (goodbyeChannel) {
          const rawMessage = config.goodbyeMessage || '{user} has left **{server}**. We are now at {membercount} members.';
          const formattedMessage = rawMessage
            .replace(/{user}/g, `**${member.user.tag}**`)
            .replace(/{server}/g, guild.name)
            .replace(/{membercount}/g, guild.memberCount.toString());

          // Render goodbye card image using ImageService
          const cardConfig = db.cards.get(guild.id);
          const imageService = container.resolve('image');
          let fileAttachment = null;

          try {
            const buffer = await imageService.generateGoodbyeCard(member.user, guild, {
              theme: cardConfig.goodbyeTheme,
              bgType: cardConfig.goodbyeBgType,
              bgValue: cardConfig.goodbyeBgValue,
              customText: cardConfig.goodbyeCustomText,
              mode: cardConfig.goodbyeMode
            });
            const { AttachmentBuilder } = require('discord.js');
            fileAttachment = new AttachmentBuilder(buffer, { name: 'goodbye.png' });
          } catch (canvasErr) {
            errors.log(canvasErr, `guildMemberRemove:goodbye_image_render:${guild.id}`);
          }

          const sendPayload = { content: formattedMessage };
          if (fileAttachment) {
            sendPayload.files = [fileAttachment];
          }

          await goodbyeChannel.send(sendPayload).catch(err => {
            errors.log(err, `guildMemberRemove:goodbye_send:${guild.id}`);
          });
        }
      }
    } catch (err) {
      errors.log(err, `guildMemberRemove:main:${guild.id}`);
    }
  }
};
