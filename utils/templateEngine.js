/**
 * templateEngine.js
 * -----------------------------------------------------------------------
 * Reusable Template Engine (Vishwa Bot v2.0)
 *
 * Provides a clean and safe interface for placeholder replacement in strings.
 * Supports standard placeholders and coerces complex objects (e.g. Discord entities)
 * by invoking their .toString() method automatically.
 * -----------------------------------------------------------------------
 */

class TemplateEngine {
  /**
   * Replaces placeholders in a template string with context values.
   * Placeholders: {user}, {server}, {coins}, {xp}, {level}, {rank}, {item}, {badge}, {title}, {quest}, {reward}
   * @param {string} template The raw template string
   * @param {object} context The variables dictionary
   * @returns {string} The parsed message content
   */
  parse(template, context = {}) {
    if (!template) return '';
    
    // Normalize context keys to match placeholders case-insensitively, but keep exact match prioritized
    const normalizedContext = {};
    for (const [key, val] of Object.entries(context)) {
      normalizedContext[key.toLowerCase()] = val;
    }

    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
      const lowerKey = key.toLowerCase();
      // Check exact match first, then normalized lowercase key
      const val = context[key] !== undefined ? context[key] : normalizedContext[lowerKey];

      if (val === undefined || val === null) {
        return match;
      }
      
      if (typeof val === 'object' && val.toString) {
        return val.toString();
      }
      
      return String(val);
    });
  }
}

module.exports = new TemplateEngine();
