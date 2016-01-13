var spawn = require('child_process').spawn;
var fs = require('fs');
var path = require('path');
var util = require('util');

var _ = require('lodash');
var Q = require('q');
var cheerio = require('cheerio');

var HTMLBaseConverter = require('./html-base');

// Inherit HTMLBaseConverter
function DocbookConverter(opts) {
    DocbookConverter.super_.call(this, opts);
}

util.inherits(DocbookConverter, HTMLBaseConverter);

// Implement toHTML()
DocbookConverter.prototype.toHTML = function() {
    var that = this;
    var d = Q.defer();

    console.log('Converting Docbook to HTML...');

    // HTML output filename
    var output = path.resolve(path.dirname(that.filename), path.basename(that.filename, '.xml'))+'.html';
    var resources = path.resolve(__dirname, '../../resources/docbook/xhtml5/docbook.xsl');

    var xsltproc = spawn('xsltproc', [
        '--output', output,
        resources,
        that.filename
    ]);

    xsltproc.stdout.on('data', function(data) {
        console.log(data.toString());
    });

    xsltproc.stderr.on('data', function(data) {
        console.log(data.toString());
    });

    xsltproc.on('close', function(code) {
        if (code !== 0) d.reject('xsltproc failed with exit code '+code);

        fs.readFile(output, 'utf8', function(err, data) {
            if (err) d.reject(err);

            that._html = processHTML(data);
            d.resolve();
        });
    });

    return d.promise;
};

function processHTML(html) {
    var $ = cheerio.load(html);

    // Docbook <literallayout> are converted as <div class=literallayout><p>...</p></div>
    // Use <pre><code>...</code></pre> instead
    $('.literallayout').each(function() {
        var $code = $('<code></code>');
        $code.html($(this).find('p').first().html().trim());
        var $pre = $('<pre></pre>');
        $code.wrap($pre);
        $(this).replaceWith($pre);
    });

    // Convert <pre class="programlisting"> to <pre><code>...
    $('pre.programlisting, pre.screen').each(function() {
        var $code = $('<code></code>');
        $code.html($(this).html());
        $(this).html('');
        $(this).append($code);
    });

    // Format footnotes origins
    $('a.footnote, a.footnoteref').each(function() {
        // Check link has only one child
        var $children = $(this).children();
        if (_.size($children) !== 1) return;

        // Check that child is a <sup>
        var $sup = $children.first();
        if (!$sup.is('sup')) return;

        // Make <sup> parent of <a>
        $sup.insertBefore($(this));
        // $(this).remove();
        $sup = $(this).prev();
        $(this).html($sup.html());
        $sup.text('');
        $sup.append($(this));
    });

    // Format footnotes
    $('div.footnote').each(function() {
        // Get tags
        var $p = $(this).find('p').first();
        var $a = $(this).find('a').first();
        var $sup = $(this).find('sup').first();

        // Move <div> id to <sup>
        var id = $(this).attr('id');
        $sup.attr('id', id);
        $(this).removeAttr('id');

        // Remove <a> tag
        $a.remove();

        // Move <sup> at beginning of <p>
        $sup.html($sup.html()+$p.html());
        $p.html('');
        $p.prepend($sup);

        // Move <a> at the end of <sup> tag
        $a.html('&#8593;');
        $sup.append($a);
    });

    // Pass <section> id to its first <h>
    $('section').each(function() {
        var sectionId = $(this).attr('id');
        if (!sectionId) return;

        var $h = $(this).find(':header').first();
        if (!$h.attr('id')) {
            $h.attr('id', sectionId);
            $(this).removeAttr('id');
        }
    });

    return $('body').html();
}

module.exports = DocbookConverter;