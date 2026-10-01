const { ComponentType, MessageFlags } = require('discord.js');

function isUnknownOrExpiredInteractionError(err) {
  const code = err?.code;
  const message = String(err?.message || '');
  // DiscordAPIError[10062]: Unknown interaction
  if (code === 10062) return true;
  // discord.js sometimes wraps these with a generic Error message
  if (message.includes('Unknown interaction')) return true;
  return false;
}

function isAlreadyRepliedError(err) {
  const name = String(err?.name || '');
  const message = String(err?.message || '');
  return name === 'InteractionAlreadyReplied' || message.includes('InteractionAlreadyReplied');
}

/**
 * Safely defers a reply to an interaction if needed.
 * Avoids "This interaction failed" errors if processing takes >3s.
 * @param {Interaction} i
 * @param {Object} options
 */
  async function safeDeferReply(i, forceEphemeral = null) {
    try {
      if (!i.deferred && !i.replied) {
        const options = {};
        if (forceEphemeral !== null) {
          options.ephemeral = !!forceEphemeral;
        }
        //console.log('Defer options:', options);
        await i.deferReply(options);
      }
    } catch (err) {
      // Avoid spamming logs for expired interactions (common when users spam commands/buttons)
      if (isUnknownOrExpiredInteractionError(err) || isAlreadyRepliedError(err)) return null;
      console.error('safeDeferReply error:', err);
    }
  }
  
/**
 * Safely replies to an interaction.
 * Automatically follow-ups if already replied/deferred.
 * @param {Interaction} i
 * @param {Object} options
 * @param {boolean} [forceEphemeral] - Force override of ephemeral flag.
 */
async function safeReply(i, options, forceEphemeral = null) {
  try {

    // Allow passing a simple string instead of an options object.
    if (typeof options === 'string') {
      options = { content: options };
    }

    if (!options || typeof options !== 'object') {
      options = { content: 'Something went wrong responding.' };
    }

    // Determine response method before mutating options.
    const isComponent = typeof i.isMessageComponent === 'function' && i.isMessageComponent();
    const willEditReply = (!isComponent && i.deferred && !i.replied) || (isComponent && i.deferred);
    const willUpdate = isComponent && !i.deferred;

    // Ephemeral is only valid on reply/followUp, not editReply/update.
    if (willEditReply || willUpdate) {
      if ('ephemeral' in options) delete options.ephemeral;
      if ('flags' in options) delete options.flags;
    } else if (forceEphemeral !== null) {
      options.ephemeral = !!forceEphemeral;
      if ('flags' in options) delete options.flags;
    }

    //console.log('Options:', options);

    if (!i.deferred && !i.replied) {
      return await i.reply(options);
    }

    if (isComponent) {
      if (i.deferred) {
        return await i.editReply(options);
      }
      return await i.update(options);
    }

    // Slash command interactions: after deferReply, edit the deferred reply.
    if (i.deferred && !i.replied) {
      return await i.editReply(options);
    }

    return await i.followUp(options);
  } catch (err) {
    if (isUnknownOrExpiredInteractionError(err)) return null;
    console.error('safeReply error:', err);
    try {
      return await i.followUp({ content: 'Something went wrong responding.', ephemeral: true });
    } catch (followUpError) {
      if (isUnknownOrExpiredInteractionError(followUpError)) return null;
      console.error('safeReply followUp failed:', followUpError);
    }
    return null;
  }
}



/**
 * Creates a safe button collector that auto-defers and passes the interaction cleanly.
 * @param {Interaction} interaction - The original interaction to edit
 * @param {Message} message - The message to listen for buttons on
 * @param {Object} options - { time, allowedIds, onCollect, onEnd }
 */
  function safeButtonCollector(interaction, message, options = {}) {
    const {
      time = 15000,
      allowedIds = [],
      onCollect,
      onEnd
    } = options;
  
    const filter = (i) => {
      if (allowedIds.length > 0 && !allowedIds.includes(i.user.id)) return false;
      return true;
    };
  
    if (!message || typeof message.createMessageComponentCollector !== 'function') {
      return null;
    }

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time,
      filter
    });
  
    collector.on('collect', async (i) => {
      try {
        await i.deferUpdate();
        if (onCollect) await onCollect(i);
      } catch (err) {
        if (isUnknownOrExpiredInteractionError(err)) return;
        console.error('safeButtonCollector collect error:', err);
      }
    });
  
    collector.on('end', async (collected, reason) => {
      if (onEnd) await onEnd(collected, reason);
    });
  
    return collector;
  }

  /**
 * Creates a safe select menu collector that auto-defers and passes the interaction cleanly.
 */
function safeSelectMenuCollector(interaction, message, options = {}) {
    const {
      time = 15000,
      allowedIds = [],
      onCollect,
      onEnd
    } = options;
  
    const filter = (i) => {
      if (allowedIds.length > 0 && !allowedIds.includes(i.user.id)) return false;
      return true;
    };
  
    if (!message || typeof message.createMessageComponentCollector !== 'function') {
      return null;
    }

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time,
      filter
    });
  
    collector.on('collect', async (i) => {
      try {
        await i.deferUpdate();
        if (onCollect) await onCollect(i);
      } catch (err) {
        if (isUnknownOrExpiredInteractionError(err)) return;
        console.error('safeSelectMenuCollector collect error:', err);
      }
    });
  
    collector.on('end', async (collected, reason) => {
      if (onEnd) await onEnd(collected, reason);
    });
  
    return collector;
  }

  async function safeHandleButton(interaction, options) {
    try {
        if (interaction.deferred) {
            return await interaction.editReply(options);
        } else {
            await interaction.deferUpdate();
            return await interaction.editReply(options);
        }
    } catch (error) {
      if (isUnknownOrExpiredInteractionError(error)) return null;
      console.error('safeHandleButton error:', error);
    }
}

  
  module.exports = {
    safeDeferReply,
    safeReply,
    safeButtonCollector,
    safeSelectMenuCollector,
    safeHandleButton
  };
  

