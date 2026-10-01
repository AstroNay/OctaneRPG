const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { getAssetBuffer, getAssetText } = require('./assetLoader');

const SPRITE_SHEET_PATH = 'sprites/sprite_sheet.png';
const SPRITE_META_PATH = 'sprites/sprite_sheet.json';
const UI_PANEL_PATH = 'ui_panel.png';
const VEHICLE_PLACEHOLDER_PATH = 'vehicles/placeholder2.png';

let spriteSheetImage = null;
let spriteMeta = null;
let uiPanelImage = null;

async function loadAssets() {
    if (!spriteSheetImage) {
        const buf = await getAssetBuffer(SPRITE_SHEET_PATH);
        spriteSheetImage = await loadImage(buf);
    }
    if (!spriteMeta) {
        const metaText = await getAssetText(SPRITE_META_PATH);
        spriteMeta = JSON.parse(metaText);
    }
    if (!uiPanelImage) {
        const buf = await getAssetBuffer(UI_PANEL_PATH);
        uiPanelImage = await loadImage(buf);
    }
    //console.log('Assets loaded successfully');
}

function getSpritePosition(fileName) {
    return spriteMeta.sprites.find(s => s.fileName === fileName);
}

function getRarityFromLevel(level) {
    if (level >= 25) return 'ultra';
    if (level >= 10) return 'rare';
    if (level >= 5) return 'uncommon';
    return 'common';
}

async function generatePartsGrid(vehicle, upgrades, levelInfo, profile) {
    await loadAssets();    
    const canvas = createCanvas(600, 300);
    const ctx = canvas.getContext('2d');

    const panelWidth = uiPanelImage.width;
    const panelHeight = uiPanelImage.height;
    const barWidth = panelWidth;
    const barHeight = 20;
    const barX = (canvas.width - barWidth) / 2;
    const barY = 0;

    const xpColor = profile.settings && profile.settings.xpColor ? profile.settings.xpColor : '#FFD700';
    const xpBackgroundColor = profile.settings && profile.settings.backgroundColor ? profile.settings.backgroundColor : '#454545';
    const progressWidth = barWidth * levelInfo.progress;
    const remainingWidth = barWidth - progressWidth;

    // Background box
    ctx.fillStyle = xpBackgroundColor;
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // XP Progress fill
    ctx.fillStyle = xpColor;
    ctx.fillRect(barX, barY, progressWidth, barHeight);

    // Empty portion
    ctx.fillStyle = xpBackgroundColor;
    ctx.fillRect(barX + progressWidth, barY, remainingWidth, barHeight);

    // Level markers
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#000';
    ctx.fillText(`Lvl ${levelInfo.level}`, barX + 6, barY + 15);
    ctx.fillText(`Lvl ${levelInfo.level + 1}`, barX + barWidth - 50, barY + 15);

    // Username text
    const username = profile.username || 'Player';
    const crewTag = profile.crew ? `[${profile.crew}] ` : '';
    const nameText = crewTag + username;
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#000';
    const textMetrics = ctx.measureText(nameText);
    const textX = barX + (barWidth - textMetrics.width) / 2;
    ctx.fillText(nameText, textX, barY + 15);


    ctx.drawImage(uiPanelImage, (canvas.width - panelWidth) / 2, 20);

    // Safe vehicle image loading with fallback - use vehicle.image field directly
    try {
        const carBuf = await getAssetBuffer(`vehicles/${vehicle.image || 'placeholder.png'}`);
        const carImage = await loadImage(carBuf);
        ctx.drawImage(carImage, 285, 198, 200, 96);
    } catch (err) {
        console.warn(`Could not load vehicle image: ${vehicle.image}`);
        // Try to load placeholder if specific image fails
        try {
            const placeholderBuf = await getAssetBuffer(VEHICLE_PLACEHOLDER_PATH);
            const placeholderImage = await loadImage(placeholderBuf);
            ctx.drawImage(placeholderImage, 285, 198, 200, 96);
        } catch (placeholderErr) {
            console.warn('Could not load placeholder image either');
        }
    }

    const parts = [
        'engine','transmission','intake','intercooler','exhaust',
        'nitrous','turbo','coilovers','wheels','tires',
        'brakes','aero'
    ];

    const iconSize = 76;
    const spacing = 15;
    const startX = 75;
    const startY = 40;
    const columns = 5;

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const upgrade = (upgrades || []).find(u => u.type === part);
        const level = upgrade?.level || 0;
        //if (level === 0) continue;
        const rarity = level === 0 ? 'empty' : getRarityFromLevel(level);
        const fileName = `${part}_${rarity}.png`;

        const sprite = getSpritePosition(fileName);
        if (!sprite) {
            console.warn(`Missing sprite: ${fileName}`);
            continue;
        }

        const col = i % columns;
        const row = Math.floor(i / columns);
        const x = startX + col * (iconSize + spacing);
        const y = startY + row * (iconSize + spacing);

        ctx.drawImage(
            spriteSheetImage,
            sprite.x, sprite.y, sprite.width, sprite.height,
            x, y, iconSize, iconSize
        );

        // Draw level number
        if (level > 0) {
            ctx.font = 'bold 10px Arial';
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            const label = `Lv.${level}`;
            ctx.strokeText(label, x + 4, y + iconSize - 4);
            ctx.fillText(label, x + 4, y + iconSize - 4);
        }
    }

        // Draw border around the canvas
    const borderColor = profile.settings && profile.settings.borderColor ? profile.settings.borderColor : '#FFD700';
    ctx.save();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    const panelX = (canvas.width - panelWidth) / 2;
    ctx.strokeRect(panelX, 20, panelWidth, panelHeight);
    ctx.restore();

    return canvas.toBuffer('image/png');
}

module.exports = {
    generatePartsGrid
};

