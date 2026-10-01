const { createLogger, format, transports } = require('winston');
const Transport = require('winston-transport');
require('winston-daily-rotate-file');
const { WebhookClient } = require('discord.js');
const { DateTime } = require('luxon');

class WebhookTransport extends Transport {
    constructor(opts) {
        super(opts);
        this.errorWebhook = new WebhookClient({ url: opts.errorWebhookURL });
        this.generalWebhook = new WebhookClient({ url: opts.generalWebhookURL });
        this.systemWebhook = new WebhookClient({ url: opts.systemWebhookURL });
        this.buffer = [];
        this.flushInterval = 10000;
        setInterval(() => this.flushBuffer(), this.flushInterval);
    }

    log(info, callback) {
        setImmediate(() => this.emit('logged', info));
        this.buffer.push(info);
        callback();
    }

    flushBuffer() {
        if (this.buffer.length === 0) return;
        const groupedMessages = this.buffer.reduce((acc, msg) => {
            const now = DateTime.now().setZone('America/New_York').toFormat('yyyy-MM-dd HH:mm:ss');
            const formattedMsg = `**[${msg.level.toUpperCase()}]**: \`${now} - ${msg.message}\``;
            if (!acc[msg.level]) acc[msg.level] = [];
            acc[msg.level].push(formattedMsg);
            return acc;
        }, {});

        for (const [level, messages] of Object.entries(groupedMessages)) {
            let webhook = this.generalWebhook;
            if (level === 'error') webhook = this.errorWebhook;
            if (level === 'system') webhook = this.systemWebhook;

            if (webhook) {
                webhook.send({ content: messages.join('\n') }).catch(console.error);
            }
        }

        this.buffer = [];
    }
}

let logger = null;

function parseBool(value, defaultValue = false) {
    if (value === undefined || value === null) return defaultValue;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
    return defaultValue;
}

async function setupLogger() {
    const errorWebhookURL = process.env.ERROR_WEBHOOK_URL;
    const generalWebhookURL = process.env.GENERAL_WEBHOOK_URL;
    const systemWebhookURL = process.env.SYSTEM_WEBHOOK_URL;
    const debugEnabled = parseBool(process.env.DEBUG_LOGGING_ENABLED, false);

    const activeTransports = [
        new transports.Console(),
        new transports.DailyRotateFile({
            filename: debugEnabled ? 'logs/%DATE%-debug.log' : 'logs/%DATE%-info.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
            level: debugEnabled ? 'debug' : 'info'
        })
    ];

    if (errorWebhookURL && generalWebhookURL && systemWebhookURL) {
        activeTransports.splice(1, 0, new WebhookTransport({ errorWebhookURL, generalWebhookURL, systemWebhookURL }));
    }

    logger = createLogger({
        level: debugEnabled ? 'debug' : 'info',
        format: format.combine(
            format.timestamp(),
            format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
        ),
        transports: activeTransports
    });

    return logger;
}

async function getLogger() {
    if (!logger) {
        logger = await setupLogger();
    }
    return logger;
}

module.exports = {
    getLogger,
    setupLogger
};

