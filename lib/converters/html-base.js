var fs = require('fs');
var path = require('path');

var _ = require('lodash');
var Q = require('q');

var cheerio = require('cheerio');
var normall = require('normall');

var utils = require('./utils');
var Chapter = require('./types/chapter');
var Title = require('./types/title');

// Interface for HTML-based converters
// The inheriting converter must implement .toHMTL()

function HTMLBaseConverter(opts) {
    this.filename = opts.filename;
    this.filetype = path.extname(this.filename);
    this.documentTitle = path.basename(this.filename, this.filetype);
    this.filepath = path.resolve(process.cwd(), this.filename);

    // Set working directories
    this.rootDirectory = opts.root || 'export';
    this.assetsDirectory = opts.assetsDirectory || 'assets';

    this._projectName = normall.filename(this.documentTitle);
    this._projectFolder = path.resolve(process.cwd(), path.join(this.rootDirectory, this._projectName));
    this._assetsFolder = path.join(this._projectFolder, this.assetsDirectory);
    this._summaryFile = path.join(this._projectFolder, 'SUMMARY.md');
}

HTMLBaseConverter.prototype.convert = function() {
    var that = this;

    // Check that file exists
    Q.nfcall(fs.stat, that.filename)
    .then(function() {
        // Create folders
        that.createDirectories()
        .fin(function() {
        // Actually convert to HTML
            that.toHTML()
            .then(function() {
                that.extractFootnotes();
                that.parseChapters();
                that.processChapters();
                that.toMarkdown();
                that.writeSummary();
                that.writeFiles();
                console.log('Done.');
            });
        });
    })
    .fail(function(err) {
        console.log(err.stack);
        throw err;
    });
};

// Create project directories
HTMLBaseConverter.prototype.createDirectories = function() {
    var that = this;

    console.log('Creating export folder...');
    return Q.nfcall(fs.mkdir, that.rootDirectory)
    .fin(function() {
        console.log('Creating project folder...');
        return Q.nfcall(fs.mkdir, that._projectFolder);
    })
    .fin(function() {
        console.log('Creating assets folder...');
        return Q.nfcall(fs.mkdir, that._assetsFolder);
    })
    .fin(function() {
        console.log('Creating summary file...');
        return Q.nfcall(fs.writeFile, that._summaryFile, '# Summary\n\n');
    })
    .fin(function() {
        console.log('Done.');
        return Q();
    });
};

// Extract footnotes from HTML and store in Converter.footnotes
HTMLBaseConverter.prototype.extractFootnotes = function() {
    var that = this;
    that.footnotes = {};

    var $ = cheerio.load(this._html);

    console.log('Extracting footnotes...');
    $('a').each(function() {
        // Ensure <a> tag is the only child
        var $parent = $(this).parent();
        if (!$parent.length) return;
        if (!$parent.is('sup')) return;
        if ($parent.contents().length !== 1) return;

        // Get origin id and href attributes
        var originHref = $(this).attr('href');
        var originId = $(this).attr('id');

        // originId could also be set on parent <sup> tag
        if (!originId) {
            originId = $parent.attr('id');
        }

        // Both id and href must be set in a footnote origin link
        if (!originHref || !originId) return;

        // Check if href is an id-like link
        if (_.startsWith(originHref, '#')) {
            // Get referenced element
            var referencedId = utils.idFromRef(originHref);
            var $referencedTag = $('*[id="'+referencedId+'"]').first();
            if (!$referencedTag.length) return;

            // Check that referred element has a link back to origin
            var $linkToOrigin = $('a[href="#'+originId+'"]');
            if (!$referencedTag.has($linkToOrigin)) return;

            // Change referred element to a <p> tag
            var $replacement;
            if ($referencedTag.children().length === 1 && $referencedTag.children().first().is('p')) {
                $replacement = $referencedTag.children().first();
            }
            else {
                $replacement = $('<p>'+$referencedTag.html()+'</p>');
            }

            // Wrap content in a <sup> tag if not already and prepend content with origin link text
            var prefix;
            var content;
            if ($replacement.children().first().is('sup')) {
                content = $replacement.children().first().html().trim();
                prefix = _.startsWith(content, $(this).text())? '' : $(this).text();
                content = (prefix+' '+content).trim();

                $replacement.children().first().html(content);
            }
            else {
                content = $replacement.html().trim();
                prefix = _.startsWith(content, $(this).text())? '' : $(this).text();
                content = (prefix+' '+content).trim();

                $replacement.html('<sup>'+content+'</sup>');
            }

            // Copy attributes
            var referencedTagAttributes = getTagAttributes($referencedTag);
            for (var attr in referencedTagAttributes) {
                $replacement.children().first().attr(attr, referencedTagAttributes[attr]);
            }

            // Save footnote by reference and remove from DOM
            that.footnotes[originHref] = $replacement.html();
            $referencedTag.remove();
        }
    });

    that._html = $.html();
};

// Create HTML tree
HTMLBaseConverter.prototype.parseChapters = function() {
    var that = this;
    that.chapters = [];
    that.titles = [];

    // Split book by main titles
    console.log('Parsing chapters...');
    var parts = that._html.split(/(\<h1.*?h1\>)/g);

    parts.forEach(function(html) {
        // Is a title
        if (/\<h1/.test(html)) {
            // Get title
            var title = Title.fromHTML(html, 'h1');
            that.titles.push(title);
        }
        // Is a chapter
        else {
            var chapter = new Chapter(html);
            that.chapters.push(chapter);
        }
    });

    // Resolve filenames
    var nbTitles = that.titles.length + 1;
    that.titles.forEach(function(title, index) {
        title.generateFilename(index + 1, nbTitles);
    });

    // Add README
    var readmeOpts = {
        title: 'Introduction',
        html: '<h1>'+that.documentTitle+'</h1>',
        filename: 'README.md'
    };
    var readmeTitle = new Title(readmeOpts);
    that.titles.unshift(readmeTitle);

    // If there are more titles than chapters
    // The first chapter will be used as content
    if (that.titles.length > that.chapters.length) {
        var content = '<p>This file serves as your book\'s preface, a great place to describe your book\'s content and ideas.</p>';
        var readme = new Chapter(content);
        that.chapters.unshift(readme);
    }
};

// Format parsed HTML
HTMLBaseConverter.prototype.processChapters = function() {
    var that = this;

    console.log('Processing chapters...');
    // Set titles and footnotes
    that.chapters.forEach(function(chapter, index) {
        // Don't erase footnotes for other chapters
        var footnotes = _.cloneDeep(that.footnotes);
        // Mixin title and chapter
        chapter.getTitleAttributes(that.titles[index]);
        // Reset footnotes in each correct chapter
        chapter.setFootnotes(footnotes);
    });

    // Clean and resolve links
    that.chapters.forEach(function(chapter) {
        // Clean HTML
        chapter.cleanHTML();
    });

    // Normalize titles id
    that.chapters.forEach(function(chapter, index) {
        var siblings = that.chapters.filter(function(c, pos) {
            return pos !== index;
        });
        chapter.normalizeTitlesId(siblings);
    });

    // Resolve links
    that.chapters.forEach(function(chapter, index) {
        var siblings = that.chapters.filter(function(c, pos) {
            return pos !== index;
        });
        chapter.resolveLinks(siblings);
    });
};

// Convert HTML to markdown
HTMLBaseConverter.prototype.toMarkdown = function() {
    console.log('Converting chapters to markdown...');

    this.chapters.forEach(function(chapter) {
        chapter.toMarkdown();
    });
};

HTMLBaseConverter.prototype.writeSummary = function() {
    var that = this;

    this.chapters.forEach(function(chapter) {
        // Add summary entry
        var summary_line = '* ['+normall(chapter.title)+']('+chapter.filename+')\n';
        Q.nfcall(fs.appendFile, that._summaryFile, summary_line)
        .fail(function(err) {
            console.log(err.stack);
            throw err;
        });
    });
};

// Write each chapter to a .md file
HTMLBaseConverter.prototype.writeFiles = function() {
    var that = this;

    // Create a file for each book part
    this.chapters.forEach(function(chapter) {
        var filepath = path.join(that._projectFolder, chapter.filename);
        console.log('Writing file: '+filepath);
        // Write md file
        Q.nfcall(fs.writeFile, filepath, chapter.markdown)
        .fail(function(err) {
            console.log(err.stack);
            throw err;
        });
    });
};

// Return the tag attributes
function getTagAttributes(el) {
    return el.get(0).attribs;
}

module.exports = HTMLBaseConverter;