/**
 * componentBuilder.js
 * -----------------------------------------------------------------------
 * Reusable Components Builder Module (Vishwa Bot v2.0)
 *
 * Provides central abstraction logic to construct buttons, select menus,
 * modals, and pagination controls cleanly.
 * -----------------------------------------------------------------------
 */

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

class ComponentBuilder {
  /**
   * Creates a basic Discord Button.
   * @param {string} customId 
   * @param {string} label 
   * @param {number} style ButtonStyle (Primary, Secondary, Success, Danger, Link)
   * @param {boolean} disabled 
   * @param {string} [emoji] optional emoji
   * @returns {import('discord.js').ButtonBuilder}
   */
  createButton(customId, label, style = ButtonStyle.Primary, disabled = false, emoji = null) {
    const builder = new ButtonBuilder()
      .setCustomId(customId)
      .setLabel(label)
      .setStyle(style)
      .setDisabled(disabled);

    if (emoji) builder.setEmoji(emoji);
    return builder;
  }

  /**
   * Creates a Select Menu.
   * @param {string} customId 
   * @param {string} placeholder 
   * @param {Array<object>} options Array of select options { label, value, description, emoji }
   * @returns {import('discord.js').StringSelectMenuBuilder}
   */
  createSelectMenu(customId, placeholder, options) {
    return new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(options);
  }

  /**
   * Constructs an Action Row container wrapping UI elements.
   * @param {Array<any>} components 
   * @returns {import('discord.js').ActionRowBuilder}
   */
  createRow(components) {
    return new ActionRowBuilder().addComponents(components);
  }

  /**
   * Standardized pagination bar buttons row generator.
   * @param {number} currentPage 
   * @param {number} totalPages 
   * @returns {import('discord.js').ActionRowBuilder}
   */
  createPaginationRow(currentPage, totalPages) {
    const prevBtn = this.createButton('page_prev', '◀', ButtonStyle.Secondary, currentPage <= 1);
    const labelBtn = this.createButton('page_num', `Page ${currentPage}/${totalPages}`, ButtonStyle.Secondary, true);
    const nextBtn = this.createButton('page_next', '▶', ButtonStyle.Secondary, currentPage >= totalPages);

    return this.createRow([prevBtn, labelBtn, nextBtn]);
  }

  /**
   * Creates a Modal input popup.
   * @param {string} customId 
   * @param {string} title 
   * @param {Array<{customId:string, label:string, style:number, required:boolean}>} fields 
   * @returns {import('discord.js').ModalBuilder}
   */
  createModal(customId, title, fields) {
    const modal = new ModalBuilder()
      .setCustomId(customId)
      .setTitle(title);

    const rows = fields.map(f => {
      const input = new TextInputBuilder()
        .setCustomId(f.customId)
        .setLabel(f.label)
        .setStyle(f.style || TextInputStyle.Short)
        .setRequired(f.required !== false);

      return new ActionRowBuilder().addComponents(input);
    });

    modal.addComponents(rows);
    return modal;
  }
}

module.exports = new ComponentBuilder();
