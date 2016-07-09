var fs = require('fs');
var path = require('path');
var util = require('util');

var Q = require('q');
var odt2html = require('odt2html');

var HTMLBaseConverter = require('./html-base');

// Inherit HTMLBaseConverter
function OdtConverter(opts) {
    OdtConverter.super_.call(this, opts);
}

util.inherits(OdtConverter, HTMLBaseConverter);

// Implement toHTML()
OdtConverter.prototype.toHTML = function() {
    var that = this;
    var d = Q.defer();

    // Set odt2html options
    var odt2htmlOpts = {
        path:      that.filepath,
        imgFolder: that._assetsFolder,
        trim:      true
    };

    // Convert to HTML
    console.log('Converting odt file to HTML...');
    odt2html.toHTML(odt2htmlOpts)
    .then(function(html) {
        console.log('Done.');

        // Set generated HTML
        that._html = html;
        d.resolve();
    })
    .fail(function(err) {
        d.reject(err);
    });

    return d.promise;
};

module.exports = OdtConverter;