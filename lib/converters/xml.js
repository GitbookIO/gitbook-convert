var spawn = require('child_process').spawn;
var fs = require('fs');
var path = require('path');
var util = require('util');

var _ = require('lodash');
var Q = require('q');
var cheerio = require('cheerio');

var HTMLBaseConverter = require('./html-base');
var Chapter = require('./types/chapter');
var utils = require('./utils');

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
        if (that.debug) console.log(data.toString());
    });

    xsltproc.on('close', function(code) {
        if (code !== 0) d.reject('xsltproc failed with exit code '+code);

        fs.readFile(output, 'utf8', function(err, data) {
            if (err) d.reject(err);

            var $ = cheerio.load(data);
            var html = $('body').html();
            that._html = processHTML(html);

            // Delete created .html file
            fs.unlink(output);

            d.resolve();
        });
    });

    return d.promise;
};

// Override parseChapters() to extract Table of Contents
DocbookConverter.prototype.parseChapters = function() {
    console.log('Parsing chapters...');
    var that = this;

    that.chapters = [];
    that.titles = [];

    var $ = cheerio.load(that._html);

    // Get TOC and remove from HTML
    var $toc = $('div.toc');
    $toc.remove();
    that._html = $.html();

    // Get list of titles
    var $tocList = $toc.children('ul.toc');

    that.chapters = that.parseList($tocList);

    // Flatten list of chapters
    that.chapters = _.chain(that.chapters)
        .map(function(chapter) {
            return [chapter].concat(chapter.getChildrenDeep());
        })
        .flatten(true)
        .value();

    // Generate chapters filenames
    that.chapters.forEach(function(chapter) {
        chapter.generateFilename('md');
    });

    // Create README from remaining HTML
    var readme = Chapter.generateReadme('md', that.documentTitle, that._projectFolder, that._html);

    // Add to list of chapters
    that.chapters.unshift(readme);
    that.setTitlesId();
};

DocbookConverter.prototype.parseList = function($ul, level, parent) {
    var that = this;
    var chapters = [];

    level = level || 0;
    parent = parent || null;

    var $ = cheerio.load(that._html);
    $ul.children('li').each(function() {
        var $li = $(this);
        var chapter = new Chapter(that._projectFolder);
        chapter.level = level;
        chapter.parent = parent;

        // Gather informations from TOC
        var info = extractTOCTitleInfo($li);
        chapter.type = info.type;
        chapter.titleId = info.titleId;
        chapter.title = info.title;

        // Sub chapters
        var $sub = $li.children('ul');
        chapter.children = that.parseList($sub, level+1, chapter);

        // Get chapter HTML
        var selector = getChapterSelector(chapter);
        chapter.content = that.extractHTML(selector);

        chapters.push(chapter);
    });

    // Set siblings
    chapters.map(function(chapter, index) {
        if (index > 0)
            chapter.previous = chapters[index-1];
        if ((index+1) < chapters.length)
            chapter.next = chapters[index+1];
        return chapter;
    });

    return chapters;
};

DocbookConverter.prototype.extractHTML = function(selector) {
    var $ = cheerio.load(this._html);
    var $element = $(selector);
    var elementHTML = $.html(selector);

    $element.remove();
    this._html = $.html();
    return elementHTML;
};

DocbookConverter.prototype.setTitlesId = function() {
    // Pass <section> id to its first <h>
    this.chapters = this.chapters.map(function(chapter) {
        var $ = cheerio.load(chapter.content);
        $('section').each(function() {
            var sectionId = $(this).attr('id');
            if (!sectionId) return;

            var $h = $(this).find(':header').first();
            if (!$h.attr('id')) {
                $h.attr('id', sectionId);
                $(this).removeAttr('id');
            }
        });
        chapter.content = $.html();
        return chapter;
    });
};

// Returns all the infos from an <li> TOC element
function extractTOCTitleInfo($li) {
    var $span = $li.children('span');
    var $link = $span.children('a');
    return {
        type: $span.attr('class'),
        titleId: utils.idFromRef($link.attr('href')),
        title: $link.text()
    };
}

// Returns formatted selector from titleInfo
function getChapterSelector(titleInfo) {
    return '*[id="'+titleInfo.titleId+'"]';
}

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

    // Create a <h6> title for <example> tags
    $('div.example').each(function() {
        // Get id and remove from parent
        var id = $(this).attr('id');
        $(this).removeAttr('id');

        // Create <h6> tag with id
        var $h6 = $('<h6></h6>');
        $h6.attr('id', id);

        // Replace <div> tag by <h6>
        var $divTitle = $(this).find('div.example-title');
        $h6.html($divTitle.html());
        $divTitle.replaceWith($h6);
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

    return $.html();
}

module.exports = DocbookConverter;