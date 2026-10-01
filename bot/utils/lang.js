const fs = require('fs');
const path = require('path');

const langCache = {};
const DEFAULT_LANG = 'en';

function normalizeLangCode(locale) {
    return locale.split('-')[0];
}

function loadLanguage(lang = DEFAULT_LANG) {
    lang = normalizeLangCode(lang);

    if (!langCache[lang]) {
        try {
            const filePath = path.join(__dirname, `../lang/${lang}.json`);
            langCache[lang] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (error) {
            console.warn(`Language file for ${lang} not found. Falling back to ${DEFAULT_LANG}.`);

            if (lang !== DEFAULT_LANG) {
                return loadLanguage(DEFAULT_LANG);
            }

            langCache[lang] = {};
        }
    }

    return langCache[lang];
}

/**
 * Translates a key with optional replacements, with English fallback
 * @param {string} key - The translation key
 * @param {string} lang - The language code
 * @param {Object} replacements - Key-value pairs for placeholders
 * @returns {string} - Translated and formatted string
 */
function t(key, locale = DEFAULT_LANG, replacements = {}) {
    const lang = normalizeLangCode(locale);
    let translations = loadLanguage(lang);

    let text = translations[key];

    if (!text) {
        translations = loadLanguage(DEFAULT_LANG);
        text = translations[key] || key;
    }

    Object.keys(replacements).forEach(placeholder => {
        text = text.replace(`{${placeholder}}`, replacements[placeholder]);
    });

    return text;
}

module.exports = { t };

