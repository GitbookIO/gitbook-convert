var fs = require('fs');
var util = require('util');

var _ = require('lodash');
var Q = require('q');
var cheerio = require('cheerio');

var HTMLBaseConverter = require('./html-base');

// Inherit HTMLBaseConverter
function HTMLConverter(opts) {
    HTMLConverter.super_.call(this, opts);
}

util.inherits(HTMLConverter, HTMLBaseConverter);

// Implement toHTML()
HTMLBaseConverter.prototype.toHTML = function() {
    var that = this;
    var d = Q.defer();

    fs.readFile(that.filepath, 'utf-8', function(err, data) {
        if (err) d.reject(err);

        // Return HTML from <body> if tag exists, whole HTML otherwise
        var $ = cheerio.load(data);
        var $body = $('body');

        if (!_.size($body)) that._html = data;
        else that._html = $body.html();

        d.resolve();
    });

    return d.promise;
};

module.exports = HTMLConverter;