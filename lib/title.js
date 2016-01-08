var cheerio = require('cheerio');
var normall = require('normall');
var utils = require('./utils');

var Title = function(opts) {
    this.title = opts.title;
    this.titleId = opts.id;
    this.titleHTML = opts.html;
    this.filename = opts.filename;
};

Title.fromHTML = function(html) {
    var $ = cheerio.load(html);
    var title = $('h1').text();
    var opts = {
        title: title,
        id: utils.normalizeId(title),
        html: html
    };

    return new Title(opts);
};

Title.prototype.generateFilename = function(inc, total) {
    var paddedIndex = utils.zeroPad(inc, total);
    var normalizedName = normall.filename(this.title);

    this.filename = paddedIndex+'-'+normalizedName+'.md';
};

module.exports = Title;