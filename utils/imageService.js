/**
 * imageService.js
 * -----------------------------------------------------------------------
 * Professional Welcome & Goodbye Image System (Vishwa Bot v2.0)
 *
 * Implements high-performance canvas-based image card rendering using
 * @napi-rs/canvas. Supports themes, gradients, backgrounds, rounded
 * corners, circular avatars, glassmorphism, and custom text options.
 * -----------------------------------------------------------------------
 */

const { createCanvas, loadImage } = require('@napi-rs/canvas');

class ImageService {
  constructor() {
    // Theme accent colors for borders and pills
    this.themeAccents = {
      gaming: '#00F0FF',   // Neon Cyan
      anime: '#FF73B9',    // Sakura Pink
      discord: '#5865F2',  // Blurple
      minimal: '#8E9297',  // Slate Gray
      neon: '#FF007F',     // Electric Pink
      premium: '#D4AF37'   // Gold
    };
  }

  /**
   * Generates a welcome card buffer.
   */
  async generateWelcomeCard(user, guild, options = {}) {
    return this.generateCard(user, guild, {
      ...options,
      cardType: 'WELCOME',
      defaultTagline: `Welcome to the server!`
    });
  }

  /**
   * Generates a goodbye card buffer.
   */
  async generateGoodbyeCard(user, guild, options = {}) {
    return this.generateCard(user, guild, {
      ...options,
      cardType: 'GOODBYE',
      defaultTagline: `Hope to see you again!`
    });
  }

  /**
   * Generates a dynamic card canvas buffer.
   */
  async generateCard(user, guild, options = {}) {
    const {
      cardType = 'WELCOME',
      theme = 'minimal',
      bgType = 'theme',
      bgValue = 'discord',
      customText = '',
      mode = 'dark',
      defaultTagline = 'Welcome!'
    } = options;

    const width = 700;
    const height = 350;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Draw Background
    await this._drawBackground(ctx, width, height, bgType, bgValue, theme, mode);

    // 2. Draw Glassmorphic Accent Overlay Box
    this._drawGlassOverlay(ctx, width, height, mode);

    // 3. Draw Avatar
    await this._drawAvatar(ctx, user, theme);

    // 4. Draw Typography (WELCOME / GOODBYE, username, server, member count)
    this._drawTypography(ctx, width, height, cardType, user, guild, theme, customText || defaultTagline, mode);

    // 5. Apply Rounded Corners Clipping on Output if desired (border radius = 16)
    const roundedCanvas = createCanvas(width, height);
    const rCtx = roundedCanvas.getContext('2d');
    
    rCtx.beginPath();
    rCtx.roundRect(0, 0, width, height, 16);
    rCtx.clip();
    rCtx.drawImage(canvas, 0, 0);

    return roundedCanvas.toBuffer('image/png');
  }

  /**
   * Draws the background layer based on type.
   */
  async _drawBackground(ctx, w, h, bgType, bgValue, theme, mode) {
    if (bgType === 'color') {
      ctx.fillStyle = bgValue.startsWith('#') ? bgValue : '#2F3136';
      ctx.fillRect(0, 0, w, h);
    } else if (bgType === 'gradient') {
      const parts = bgValue.split(',');
      const color1 = parts[0] || '#2F3136';
      const color2 = parts[1] || '#1E1F22';
      
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, color1);
      grad.addColorStop(1, color2);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else if (bgType === 'upload' && bgValue) {
      try {
        const img = await loadImage(bgValue);
        ctx.drawImage(img, 0, 0, w, h);
      } catch (err) {
        console.error('[ImageService] Failed to load custom background image, falling back to theme.', err.message);
        this._drawThemeBg(ctx, w, h, theme, mode);
      }
    } else {
      // Default type is theme
      this._drawThemeBg(ctx, w, h, theme, mode);
    }
  }

  /**
   * Renders built-in procedural patterns for themes.
   */
  _drawThemeBg(ctx, w, h, theme, mode) {
    const isDark = mode === 'dark';
    
    // Core color schemes
    const themes = {
      gaming: { bg: '#0D0E11', accent: '#00F0FF', second: '#9A00FF' },
      anime: { bg: '#FFF0F5', accent: '#FF73B9', second: '#FFC0CB' },
      discord: { bg: '#36393F', accent: '#5865F2', second: '#404EED' },
      minimal: { bg: isDark ? '#1E1F22' : '#F2F3F5', accent: '#4F545C', second: '#8E9297' },
      neon: { bg: '#05050A', accent: '#FF007F', second: '#00FFFF' },
      premium: { bg: '#111111', accent: '#D4AF37', second: '#1E1E1E' }
    };

    const scheme = themes[theme] || themes.minimal;

    // Fill background
    ctx.fillStyle = scheme.bg;
    ctx.fillRect(0, 0, w, h);

    // Render theme patterns
    if (theme === 'gaming') {
      // Grid lines pattern
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    } else if (theme === 'anime') {
      // Gentle dots and pink soft gradients
      const grad = ctx.createRadialGradient(w/2, h/2, 50, w/2, h/2, w/2);
      grad.addColorStop(0, 'rgba(255, 115, 217, 0.15)');
      grad.addColorStop(1, 'rgba(255, 240, 245, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else if (theme === 'neon') {
      // Glowing circles
      ctx.fillStyle = 'rgba(255, 0, 127, 0.08)';
      ctx.beginPath();
      ctx.arc(100, 100, 150, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.arc(w - 100, h - 100, 180, 0, Math.PI * 2);
      ctx.fill();
    } else if (theme === 'premium') {
      // Golden diagonal accent lines
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.05)';
      ctx.lineWidth = 20;
      ctx.beginPath();
      ctx.moveTo(-100, h);
      ctx.lineTo(w, -100);
      ctx.stroke();
      
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(-20, h + 50);
      ctx.lineTo(w + 100, 0);
      ctx.stroke();
    }
  }

  /**
   * Draws a centered glassmorphic overlay card.
   */
  _drawGlassOverlay(ctx, w, h, mode) {
    const isDark = mode === 'dark';
    ctx.fillStyle = isDark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.7)';
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
    ctx.lineWidth = 1.5;

    const padding = 20;
    ctx.beginPath();
    ctx.roundRect(padding, padding, w - padding * 2, h - padding * 2, 12);
    ctx.fill();
    ctx.stroke();
  }

  /**
   * Renders the user's avatar.
   */
  async _drawAvatar(ctx, user, theme) {
    const avatarX = 80;
    const avatarY = 175;
    const radius = 65;

    // Outer glow ring
    const accent = this.themeAccents[theme] || '#8E9297';
    ctx.shadowColor = accent;
    ctx.shadowBlur = theme === 'neon' || theme === 'gaming' ? 15 : 0;

    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, radius + 4, 0, Math.PI * 2);
    ctx.stroke();

    // Reset shadow
    ctx.shadowBlur = 0;

    // Draw circular image
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, radius, 0, Math.PI * 2);
    ctx.clip();

    try {
      const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });
      const avatarImg = await loadImage(avatarUrl);
      ctx.drawImage(avatarImg, avatarX - radius, avatarY - radius, radius * 2, radius * 2);
    } catch {
      // Fallback letter rendering if avatar fetch fails
      ctx.fillStyle = '#4F545C';
      ctx.fillRect(avatarX - radius, avatarY - radius, radius * 2, radius * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 50px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const initial = user.username ? user.username.charAt(0).toUpperCase() : '?';
      ctx.fillText(initial, avatarX, avatarY);
    }

    ctx.restore();
  }

  /**
   * Draws name, titles, server description, and metadata.
   */
  _drawTypography(ctx, w, h, cardType, user, guild, theme, taglineText, mode) {
    const isDark = mode === 'dark';
    const accent = this.themeAccents[theme] || '#8E9297';
    const textStartX = 175;

    // Sans-serif font stacks
    const fontStack = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

    // 1. WELCOME / GOODBYE header tag
    ctx.fillStyle = accent;
    ctx.font = `bold 24px ${fontStack}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(cardType, textStartX, 115);

    // 2. Username
    ctx.fillStyle = isDark ? '#FFFFFF' : '#0F1419';
    ctx.font = `bold 32px ${fontStack}`;
    
    // Sanitize and limit username rendering length
    const username = user.username.length > 15 ? user.username.slice(0, 15) + '...' : user.username;
    ctx.fillText(username, textStartX, 145);

    // 3. Custom Tagline Text
    ctx.fillStyle = isDark ? '#B9BBBE' : '#5C6E7E';
    ctx.font = `italic 18px ${fontStack}`;
    const sanitizedTagline = taglineText.length > 45 ? taglineText.slice(0, 45) + '...' : taglineText;
    ctx.fillText(sanitizedTagline, textStartX, 190);

    // 4. Server stats pill (e.g. "Member #42" in a rounded container)
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)';
    const text = `Member #${guild.memberCount}`;
    ctx.font = `bold 14px ${fontStack}`;
    const textWidth = ctx.measureText(text).width;
    
    const pillX = textStartX;
    const pillY = 225;
    const pillW = textWidth + 24;
    const pillH = 30;

    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 15);
    ctx.fill();

    ctx.fillStyle = isDark ? '#FFFFFF' : '#0F1419';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, pillX + pillW/2, pillY + pillH/2);
  }
}

module.exports = new ImageService();
