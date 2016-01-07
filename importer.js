var fs = require('fs');
var path = require('path');

var _ = require('lodash');
var Q = require('q');

var brightml = require('brightml');
var cheerio = require('cheerio');
var normall = require('normall');
var toMarkdown = require('../to-markdown/index');

var converters = require('./converters');

var Importer = function(opts) {
    var that = this;

    that.filename = opts.filename;
    that.filetype = path.extname(that.filename);

    // Set working directories
    that.rootDirectory = opts.root || 'export';
    that.assetsDirectory = opts.assetsDirectory || 'assets';

    that._projectName = path.basename(that.filename, that.filetype);
    that._projectFolder = path.join(that.rootDirectory, that._projectName);
    that._assetsFolder = path.join(that._projectFolder, that.assetsDirectory);
    that._summaryFile = path.join(that._projectFolder, 'SUMMARY.md');

    // Check that file exists
    Q.nfcall(fs.stat, that.filename)
    .then(function() {
        // Pick a to-HTML converter
        that.pickConverter(that.filetype.slice(1));

        // Create folders
        that.createDirectories()
        .then(function() {
        // Actually convert to HTML
            that.convert()
            .then(function() {
                that.clean();
                that.parseChapters();
                that.toMarkdown();
                that.writeFiles();
            });
        })
        .fail(function(err) {
            console.log(err.stack);
            throw err;
        });
    })
    .fail(function(err) {
        console.log(err.stack);
        throw err;
    });
};

// Set the correct to-HTML converter for filetype
Importer.prototype.pickConverter = function(filetype) {
    var allowedTypes = ['docx'];

    if (!_.includes(allowedTypes, filetype)) {
        throw new Error('Unable to convert this file to a GitBook.');
    }

    this.converter = converters[filetype];
};

// Create project directories
Importer.prototype.createDirectories = function() {
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
        return Q.nfcall(fs.appendFile, that._summaryFile, '# Summary\n\n');
    })
    .fin(function() {
        console.log('Done.');
    });
};

// Convert file to HTML using selected converter
Importer.prototype.convert = function() {
    var that = this;
    var d = Q.defer();

    this.converter.convert({
        filename: this.filename,
        assetsFolder: this._assetsFolder
    })
    .then(function(html) {
        that._html = html;
        d.resolve();
    })
    .fail(function(err) {
        d.reject(err);
    });

    return d.promise;
};

// Clean converted HTML
Importer.prototype.clean = function() {
    console.log('Cleaning up HTML...');
    this._html = brightml.clean(this._html);
    console.log('Done.');
};

// Create HTML tree
Importer.prototype.parseChapters = function() {
    console.log('Parsing chapters...');

    var parts = this._html.split(/(\<h1.*?h1\>)/g);
    var titles = [];
    var chapters = [];

    parts.forEach(function(html) {
        // Is a title
        if (/\<h1/.test(html)) {
            // Get title
            $ = cheerio.load(html);
            var title = $('h1').text();
            var id = $('h1').attr('id');
            var el = {
                type: 'title',
                title: title,
                titleId: id,
                titleHTML: html
            };
            titles.push(el);
        }
        // Is a chapter
        else {
            var el = {
                type: 'chapter',
                content: html
            };
            chapters.push(el);
        }
    });

    // Normalize titles
    titles = titles.map(function(el, index) {
        var paddedIndex = zeroPad(index+1, titles.length+1);
        el.filename = paddedIndex+'-'+normall.filename(el.title)+'.md';
        return el;
    });

    // Add README
    titles.unshift({
        type: 'title',
        title: 'README',
        titleHTML: '<h1>My Awesome Book</h1>',
        filename: 'README.md'
    });

    // If there are more titles than chapters
    // The first chapter will be used as content
    if (titles.length > chapters.length) {
        chapters.unshift({
            type: 'chapter',
            content: '<p>This file file serves as your book\'s preface, a great place to describe your book\'s content and ideas.</p>'
        });
    }

    // Join title / content
    chapters = chapters.map(function(c, index) {
        c = _.defaults(c, titles[index]);
        c.content = c.titleHTML+c.content;
        delete c.titleHTML;
        return c;
    });

    // Resolve links
    console.log('Resolving links...');
    this.chapters = chapters.map(function(c, i) {
        $ = cheerio.load(c.content);
        $('a').each(function() {
            // Check href attribute is local
            var href = $(this).attr('href');
            if (!href || !_.startsWith(href, '#')) return;

            var link = null;
            chapters.forEach(function(chapter, index) {
                // In the same chapter, check that link destination exists
                if (i === index) {
                    if (!!$(href).length) link = href;
                    return;
                }

                // Link to a filename
                if (href.slice(1) === chapter.titleId) {
                    link = './'+chapter.filename;
                }
                // Link to an element inside a chapter
                else {
                    $chapter = cheerio.load(chapter.content);
                    if (!!$chapter(href).length) {
                        link = './'+chapter.filename+href;
                    }
                }
            });

            // Replace found link
            if (!!link) $(this).attr('href', link);
            // Replace by a <p> tag if no reference exists
            else {
                var $replacement = $('<p></p>');
                $replacement.attr('id', $(this).attr('id'));
                $replacement.html($(this).html());
                $(this).replaceWith($replacement);
            }
        });

        c.content = $.html();
        return c;
    });

    console.log('Done.');
};

// Convert HTML to markdown
Importer.prototype.toMarkdown = function() {
    console.log('Converting chapters to markdown...');
    // Add links to titles with id attribute
    var converters = [
        // Handle titles links
        {
            filter: ['h1', 'h2', 'h3', 'h4','h5', 'h6'],
            replacement: function(content, node) {
                var hLevel = node.nodeName.charAt(1);
                var hPrefix = '';
                for(var i = 0; i < hLevel; i++) {
                    hPrefix += '#';
                }

                var id = '';
                if (!!node.id) {
                    id = ' {#'+node.id+'}';
                }
                return '\n\n' + hPrefix + ' ' + content + id + '\n\n';
            }
        },
        // Handle footnotes
        {
            filter: 'sup',
            replacement: function(content, node) {
                // No id attribute, keep as-is
                if (!node.id) return node.outerHTML;
                // Origin only contains an <a> tag
                if (/A/.test(node.firstChild.tagName)) {
                    // Reference is the content of the <a> tag
                    var reference = node.firstChild.textContent;
                    reference = reference.replace(/[^a-zA-Z\d]/g, '');
                    return '[^'+reference+']';
                }
                else {
                    // Delete back-to-origin <a> link from <sup> tag
                    content = content.replace(/\[[^\]]*\]\(.*\)\s*$/, '');
                    // In footnotes, reference is the first "word"
                    content = content.split(' ');
                    var reference = content.shift();
                    reference = reference.replace(/[^a-zA-Z\d]/g, '');
                    return '[^'+reference+']: '+content.join(' ').trim();
                }
            }
        }
    ];

    this.chapters = this.chapters.map(function(chapter) {
        chapter.markdown = toMarkdown(chapter.content, { gfm: true, converters: converters });
        return chapter;
    });

    console.log('Done.');
};

Importer.prototype.writeFiles = function() {
    var that = this;

    // Create a file for each book part
    this.chapters.forEach(function(chapter, index) {
        // Add summary entry
        var summary_line = '* ['+normall(chapter.title)+']('+chapter.filename+')\n';
        Q.nfcall(fs.appendFile, that._summaryFile, summary_line)
        .fail(function(err) {
            console.log(err.stack);
            throw err;
        });

        var filepath = path.join(that._projectFolder, chapter.filename);
        console.log('Writing file: '+filepath);
        // Write md file
        Q.nfcall(fs.writeFile, filepath, chapter.markdown)
        .fail(function(err) {
            console.log(err.stack);
            throw err;
        });
    });

    console.log('Done.');
};

function zeroPad(n, l) {
    n = n.toString();
    l = l.toString();
    while (n.length < l.length) { n = '0'+n; }
    return n;
}

module.exports = Importer;