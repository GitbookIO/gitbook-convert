const Promise  = require('q');
const odt2html = require('odt2html');

const HTMLBaseConverter = require('./html-base');
const utils             = require('./utils');

const logger = new utils.Logger('log');

// Implement toHTML()
class OdtConverter extends HTMLBaseConverter {
    toHTML() {
        const that = this;
        const d = Promise.defer();

        // Set odt2html options
        const odt2htmlOpts = {
            path:      that.originalDoc.path,
            imgFolder: that._assetsFolder,
            trim:      true
        };

        // Convert to HTML
        logger.log('Converting odt file to HTML...');
        odt2html.toHTML(odt2htmlOpts)
        .then((html) => {
            logger.log('Done.');

            // Set generated HTML
            this._html = html;
            d.resolve();
        })
        .fail(err => d.reject(err));

        return d.promise;
    }
}

module.exports = OdtConverter;
