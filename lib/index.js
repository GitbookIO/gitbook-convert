var path = require('path');
var _ = require('lodash');

var converters = require('./converters');

function pickConverter(opts) {
    var filetype = path.extname(opts.filename).slice(1);
    var allowedTypes = _.pluck(converters.allowedFormats, 'ext');

    if (!_.includes(allowedTypes, filetype)) {
        throw new Error('Unable to convert this file to a GitBook. Accepted formats can be displayed using gitbook-convert -h.');
    }

    var Converter = converters[filetype];
    return new Converter(opts);
}

module.exports = {
    pickConverter: pickConverter
};