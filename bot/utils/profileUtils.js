const { calculateLevel } = require('./core');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
// Note: registerFont is replaced with GlobalFonts.registerFromPath in @napi-rs/canvas
const fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');
const { getLogger } = require('./logging');

async function generateAndCacheProfileImage(profile) {
    const now = DateTime.now().setZone('America/New_York');
    const shouldUpdate = !profile.settings.profileImageLastUpdate || (now - new Date(profile.settings.profileImageLastUpdate) > 1800000) || (profile.xp - profile.lastCachedXp > 100);
    //logger.debug('Should update profile image:' + shouldUpdate + ' | Last update: ' + profile.settings.profileImageLastUpdate + ' | XP diff: ' + (profile.xp - profile.lastCachedXp));
    // Disabled caching for testing
    //if (!shouldUpdate && profile.settings.profileImage) {
    //    logger.debug('Returning cached profile image.');
    //    return profile.settings.profileImage; // Return the cached image if no update is needed
    //}

    try {
        const width = 800;
        const height = 300;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        const backgroundColor = profile.settings.backgroundColor || '#808080';
        const xpColor = profile.settings.xpColor || '#99ECBE';
        const borderColor = profile.settings.borderColor || '#000000';
        const usernameColor = '#ffffff'; //getContrastColor(backgroundColor);

        if (profile.settings.customImage) {
            const image = await loadImage(profile.settings.customImage);
            ctx.drawImage(image, 0, 0, width, height);
        } else {
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, width, height);
        }

        const levelInfo = calculateLevel(profile.xp);
        const barWidth = 600;
        const barHeight = 30;
        const barX = (width - barWidth) / 2;
        const barY = height - 50;
        const progressWidth = barWidth * levelInfo.progress;
        const remainingWidth = barWidth - progressWidth;
    
        ctx.fillStyle = 'rgba(68, 68, 68, 0.8)';
        ctx.fillRect(barX-5, barY-5, barWidth+10, barHeight+10);
    
        ctx.fillStyle = xpColor;
        ctx.fillRect(barX, barY, progressWidth, barHeight);
    
        ctx.fillStyle = '#8E8E8E';
        ctx.fillRect(barX + progressWidth, barY, remainingWidth, barHeight);

        const fontSize = 18;
        ctx.font = `${fontSize}px Arial`;
        const textColor = getContrastColor(backgroundColor);
        ctx.fillStyle = textColor;

        ctx.fillText(`Lvl ${levelInfo.level}`, barX - 65, barY + barHeight / 2 + fontSize / 3);
        ctx.fillText(`Lvl ${levelInfo.level + 1}`, barX + barWidth + 20, barY + barHeight / 2 + fontSize / 3);


        ctx.font = '48px Arial';
        const username = profile.username;
        const textMetrics = ctx.measureText(username);
        const textWidth = textMetrics.width;
        const padding = 20;
        const usernameBackgroundWidth = textWidth + 2 * padding;
        const usernameBackgroundHeight = 55;
        const usernameBackgroundX = 30;
        const usernameBackgroundY = 30;
        const borderRadius = 10;

        ctx.fillStyle = 'rgba(68, 68, 68, 0.8)';
        roundRect(ctx, usernameBackgroundX, usernameBackgroundY, usernameBackgroundWidth, usernameBackgroundHeight, borderRadius);
        ctx.fill();

        ctx.fillStyle = usernameColor;
        ctx.fillText(username, usernameBackgroundX + padding, usernameBackgroundY + 45);

        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 8;
        ctx.strokeRect(5, 5, width - 10, height - 10);
        const buffer = canvas.toBuffer('image/png');
        profile.settings.profileImage = buffer;
        profile.settings.profileImageLastUpdate = now;
        profile.lastCachedXp = profile.xp;
        await profile.save();

        return buffer;
    } catch (error) {
        logger.error(profile.userId+' | generateAndCacheProfileImage: '+error);
        throw error;
    }
}

function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function getContrastColor(bgColor) {
    const color = (bgColor.charAt(0) === '#') ? bgColor.substring(1, 7) : bgColor;
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    const uicolors = [r / 255, g / 255, b / 255];
    const c = uicolors.map((col) => {
        if (col <= 0.03928) {
            return col / 12.92;
        }
        return Math.pow((col + 0.055) / 1.055, 2.4);
    });
    const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return (l > 0.179) ? '#000000' : '#FFFFFF';
}

module.exports = { generateAndCacheProfileImage };

