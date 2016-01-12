var fs = require('fs');

var _ = require('lodash');
var Q = require('q');
var cheerio = require('cheerio');

function convert(opts) {
    var d = Q.defer();

    fs.readFile(opts.filename, 'utf-8', function(err, data) {
        if (err) d.reject(err);

        // Return HTML from <body> if tag exists, whole HTML otherwise
        var $ = cheerio.load(data);
        var $body = $('body');

        if (!!_.size($body))
            d.resolve($body.html());
        else
            d.resolve(data);
    });

    return d.promise;
}

module.exports = {
    convert: convert
};