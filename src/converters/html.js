const fs      = require('fs');
const _       = require('lodash');
const Promise = require('q');
const cheerio = require('cheerio');

const HTMLBaseConverter = require('./html-base');

// Implement toHTML()
class HTMLConverter extends HTMLBaseConverter {
    toHTML() {
        const d = Promise.defer();

        fs.readFile(this.originalDoc.path, { encoding: 'utf-8' }, (err, data) => {
            if (err) {
                d.reject(err);
            }

            // Return HTML from <body> if tag exists, whole HTML otherwise
            const $     = cheerio.load(data);
            const $body = $('body');

            if (!_.size($body)) {
                this._html = data;
            }
            else {
                this._html = $body.html();
            }

            d.resolve();
        });

        return d.promise;
    }
}

module.exports = HTMLConverter;
