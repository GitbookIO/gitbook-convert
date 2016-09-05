const Promise  = require('q');
const odt2html = require('odt2html');

const HTMLBaseConverter = require('./html-base');
const utils             = require('./utils');

const logger = new utils.Logger('log');

class OdtConverter extends HTMLBaseConverter {
    // Implement toHTML()
    toHTML() {
        const d = Promise.defer();

        // Set odt2html options
        const odt2htmlOpts = {
            path:      this.originalDoc.path,
            imgFolder: this._assetsFolder,
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
