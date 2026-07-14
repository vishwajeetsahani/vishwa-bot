/**
 * embedBuilder.js
 * -----------------------------------------------------------------------
 * Reusable Embed Builder Module (Vishwa Bot v2.0)
 *
 * Implements a central layout builder for Embed creation to enforce
 * consistent styles, branding, and color palettes.
 * -----------------------------------------------------------------------
 */

const { EmbedBuilder } = require('discord.js');

class ReusableEmbedBuilder {
  constructor() {
    this.colors = {
      warn: 0xFFA500,     // Orange
      kick: 0xFF8C00,     // Dark Orange
      ban: 0xFF0000,      // Red
      timeout: 0xFFD700,  // Gold
      untimeout: 0x00BFFF,// Deep Sky Blue
      clear: 0x808080,    // Gray
      automod: 0x9B59B6,  // Purple
      info: 0x5865F2,     // Blurple
      success: 0x2ECC71,  // Green
      error: 0xE74C3C     // Red Alert
    };
  }

  /**
   * Generates a template builder instance with predefined color styles.
   * @param {string} type 
   * @returns {import('discord.js').EmbedBuilder}
   */
  create(type = 'info') {
    const color = this.colors[type] || this.colors.info;
    return new EmbedBuilder()
      .setColor(color)
      .setTimestamp();
  }
}

module.exports = new ReusableEmbedBuilder();
