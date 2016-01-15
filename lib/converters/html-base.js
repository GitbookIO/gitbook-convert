var fs = require('fs');
var path = require('path');

var _ = require('lodash');
var Q = require('q');

var cheerio = require('cheerio');
var normall = require('normall');

var utils = require('./utils');
var Chapter = require('./types/chapter');

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

    // Get two highest title tags
    that.detectTitleTags();
    // Create README
    var readme = Chapter.generateReadme('md');

    // Actually parse chapters
    that.chapters = that.parseHTML(that._html, 0, readme);

    // Flatten list of chapters
    that.chapters = _.chain(that.chapters)
        .map(function(chapter, i) {
            return [chapter].concat(chapter.getChildrenDeep());
        })
        .flatten(true)
        .value();

    // Generate chapters filenames
    that.chapters.forEach(function(chapter) {
        chapter.generateFilename('md');
    });

    that.chapters.unshift(readme);
};

HTMLBaseConverter.prototype.detectTitleTags = function() {
    var tags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    var titleTags = [];
    var $ = cheerio.load(this._html);

    tags.forEach(function(tag) {
        if (titleTags.length === 2) return;
        if (!!$(tag).length) titleTags.push(tag);
    });

    this.titleTags = titleTags;
};

// Parse HTML content and render the chapters tree
HTMLBaseConverter.prototype.parseHTML = function(html, level, parent) {
    var that = this;
    // Call recursively based on titleTags length
    if (level+1 > that.titleTags.length) return [];

    var chapters = [];

    var tag = that.titleTags[level];
    var tagLevel = tag.slice(-1);
    var tagSplitter = new RegExp('(\\<'+tag+'.*?'+tag+'\\>)', 'g');
    var tagDetector = new RegExp('\\<'+tag);

    var parts = html.split(tagSplitter);

    // Grab first part if not a title as content of parent
    if (!tagDetector.test(parts[0])) {
        var preface = parts.shift();
        parent.content = preface.trim();
    }

    var chapter;
    parts.forEach(function(part) {
        // Match a current level title
        if (tagDetector.test(part)) {
            // Create a new chapter
            chapter = new Chapter();

            var info = parseTitleInfo(part, tagLevel);
            chapter.level = level;
            chapter.title = info.title;
            chapter.titleId = info.titleId;

            chapter.parent = (level > 0) ? parent : null;
            chapter.titleHTML = part;
        }
        // Match a current level content
        else {
            // Get subchapters
            chapter.children = that.parseHTML(part, level+1, chapter);

            if (!chapter.children.length) chapter.content = part;
            chapter.content = chapter.titleHTML + chapter.content;
            chapter.content = chapter.content.trim();

            delete chapter.titleHTML;
            chapters.push(chapter);
        }
    });

    return chapters;
};

// Format parsed HTML
HTMLBaseConverter.prototype.processChapters = function() {
    var that = this;

    console.log('Processing chapters...');
    // Set titles and footnotes
    that.chapters.forEach(function(chapter, index) {
        // Don't erase footnotes for other chapters
        var footnotes = _.cloneDeep(that.footnotes);
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

// Override wirteSummary() to properly write each chapter
HTMLBaseConverter.prototype.writeSummary = function() {
    console.log('Writing summary...');
    var that = this;

    that.chapters.forEach(function(chapter) {
        // Create padding for subchapters
        var padding = '';
        while (padding.length < chapter.level * 2) { padding += ' '; }

        // Add summary entry
        var entry = padding+'* ['+normall(chapter.title)+']('+chapter.filepath+')\n';

        Q.nfcall(fs.appendFile, that._summaryFile, entry)
        .fail(function(err) {
            console.log(err.stack);
            throw err;
        });
    });
};

// Override writeFiles to properly create files
HTMLBaseConverter.prototype.writeFiles = function(first_argument) {
    var that = this;

    // Create a file for each book part
    that.chapters.forEach(function(chapter) {
        var filepath = path.join(that._projectFolder, chapter.filepath);
        console.log('Writing file: '+filepath);

        // Try to create directory
        var fileDir = path.join(that._projectFolder, chapter.path);
        Q.nfcall(fs.stat, fileDir)
        .fail(function function_name(argument) {
            return Q.nfcall(fs.mkdir, fileDir);
        })
        .fin(function() {
            // Write converted file
            Q.nfcall(fs.writeFile, filepath, chapter.markdown)
            .fail(function(err) {
                console.log(err.stack);
                throw err;
            });
        });
    });
};

function parseTitleInfo(title, level) {
    var $ = cheerio.load(title);
    var $h = $('h'+level);
    var id = $h.attr('id') || utils.normalizeId($h.text());
    return {
        titleId: id,
        title: $h.text()
    };
}

// Return the tag attributes
function getTagAttributes(el) {
    return el.get(0).attribs;
}

module.exports = HTMLBaseConverter;