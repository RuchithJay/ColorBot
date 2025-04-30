const { Client, IntentsBitField, Attachment } = require('discord.js');
const Vibrant = require('node-vibrant');
const sharp = require('sharp');

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ]
});

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
  // Ignore messages from bots
  if (message.author.bot) return;

  // Check if message has an image attachment
  const imageAttachment = message.attachments.first();
  if (!imageAttachment || !imageAttachment.contentType.startsWith('image/')) return;

  try {
    // Send initial response
    const reply = await message.reply('🖌️ Analyzing image for color palette...');

    // Download the image
    const response = await fetch(imageAttachment.url);
    const imageBuffer = await response.arrayBuffer();

    // Use sharp to resize the image for faster processing
    const resizedImage = await sharp(Buffer.from(imageBuffer))
      .resize(200, 200, { fit: 'inside' })
      .toBuffer();

    // Extract colors using Vibrant.js
    const palette = await Vibrant.from(resizedImage).getPalette();

    // Filter and sort the colors
    const colors = Object.values(palette)
      .filter(swatch => swatch && swatch.getHex())
      .sort((a, b) => b.getPopulation() - a.getPopulation())
      .slice(0, 6); // Get top 6 colors

    if (colors.length === 0) {
      await reply.edit('❌ Could not extract colors from this image.');
      return;
    }

    // Create a color palette image
    const colorSwatches = colors.map(color => {
      return {
        input: Buffer.from(`<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="100" fill="${color.getHex()}"/>
        </svg>`),
        top: 0,
        left: colors.indexOf(color) * 100
      };
    });

    const paletteImage = await sharp({
      create: {
        width: colors.length * 100,
        height: 100,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
    .composite(colorSwatches)
    .toBuffer();

    // Create response message
    const hexCodes = colors.map(c => c.getHex()).join(', ');
    const colorFields = colors.map(c => {
      return {
        name: c.getHex(),
        value: `RGB: ${c.getRgb().join(', ')}`,
        inline: true
      };
    });

    await reply.edit({
      content: `🎨 **Color Palette Extracted** (${hexCodes})`,
      files: [new Attachment(paletteImage, 'palette.png')],
      embeds: [{
        title: 'Dominant Colors',
        description: 'Here are the main colors from your image:',
        color: parseInt(colors[0].getHex().substring(1), 16),
        fields: colorFields,
        image: { url: 'attachment://palette.png' }
      }]
    });

  } catch (error) {
    console.error('Error processing image:', error);
    if (reply) {
      reply.edit('❌ An error occurred while processing the image.');
    } else {
      message.reply('❌ An error occurred while processing the image.');
    }
  }
});

// Replace 'YOUR_BOT_TOKEN' with your actual bot token
client.login('');