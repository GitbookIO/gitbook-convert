const path = require('path');

const converters = require('./converters');

/**
 * Return the correct converter based on <opts.filename> extension
 *
 * @param  {Object}    opts    Program options
 * @return {Converter}
 */
function pickConverter(opts) {
    const ALLOWED_FORMATS = converters.ALLOWED_FORMATS.map(format => format.ext);

    const filetype = path.extname(opts.filename).slice(1);
    if (!ALLOWED_FORMATS.includes(filetype)) {
        throw new Error('Unable to convert this file to a GitBook. Accepted formats can be displayed using gitbook-convert -h.');
    }

    const Converter = converters[filetype];
    return new Converter(opts);
}

module.exports = {
    pickConverter
};
