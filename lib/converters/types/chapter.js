var path = require('path');

var _ = require('lodash');
var brightml = require('brightml');
var cheerio = require('cheerio');
var normall = require('normall');
var toMarkdown = require('to-markdown');

var utils = require('../utils');
var markdownFilters = require('../markdown-filters');

function Chapter(rootDir) {
    this.rootDir = rootDir;
    this.content = '';
}

Chapter.prototype.generateFilename = function(ext) {
    this.path = '';

    var parent = this.parent;
    while (!!parent) {
        this.path = path.join(normall.filename(parent.title), this.path);
        parent = parent.parent;
    }

    if (!!this.children.length) {
        this.path = path.join(this.path, normall.filename(this.title));
        this.filename = 'README';
    }
    else {
        this.filename = normall.filename(this.title);
    }

    // Keep filename short
    this.filename = this.filename.slice(0, 50);
    this.filename = this.filename+'.'+ext;

    // Keep local reference for summary
    this.summaryPath = path.join(this.path, this.filename);
    // Actual paths on FS
    this.path = path.join(this.rootDir, this.path);
    this.filepath = path.join(this.path, this.filename);
};

Chapter.prototype.getChildrenDeep = function() {
    return this.children.map(function(sub) {
        return _.flatten([sub].concat(sub.getChildrenDeep()), true);
    });
};

Chapter.prototype.getTitleAttributes = function(title) {
    if (!title) return;

    this.title = title.title;
    this.titleId = title.titleId;
    this.filename = title.filename;
    this.content = (title.titleHTML || '') + this.content;
};

Chapter.prototype.cleanHTML = function() {
    brightml.parse(this.content);
    brightml.setAnchorsId();
    brightml.cleanElements();
    brightml.cleanImagesInTitles();
    brightml.removeNestedTables();
    brightml.formatTables();
    brightml.cleanTableCells();

    this.content = brightml.render();
};

Chapter.prototype.replaceLinksRefs = function(oldId, newId) {
    if (!oldId) return;

    var oldRef = utils.refFromId(oldId);
    var newRef = utils.refFromId(newId);

    // Replace in HTML
    var $ = cheerio.load(this.content);
    $('*[href="'+oldRef+'"]').each(function() {
        $(this).attr('href', newRef);
    });

    this.content = $.html();

    // Replace titleId
    if (this.titleId === oldId)
        this.titleId = newId;
};

// Normalize titles id
Chapter.prototype.normalizeTitlesId = function(siblings) {
    var that = this;
    var titleTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    var ids = [];
    var counter;

    var $ = cheerio.load(that.content);

    titleTags.forEach(function(titleTag) {
        $(titleTag).each(function() {
            // Compute new id
            var oldId = $(this).attr('id');
            var textId = utils.normalizeId($(this).text());

            // Prevent obtaining the same id twice
            var newId = textId;
            counter = 0;
            while (_.includes(_.pluck(ids, 'newId'), newId)) {
                newId = textId+'-'+counter;
                counter++;
            }
            ids.push({ oldId: oldId, newId: newId });

            // Replace id in href links in other chapters
            siblings.forEach(function(chapter) {
                chapter.replaceLinksRefs(oldId, newId);
            });

            // Replace current title id
            $(this).attr('id', newId);
        });
    });

    that.content = $.html();

    // Replace ids in href links of current chapter
    ids.forEach(function(id) {
        that.replaceLinksRefs(id.oldId, id.newId);
    });
};

Chapter.prototype.setFootnotes = function(footnotes) {
    var $ = cheerio.load(this.content);

    $('sup').each(function() {
        if ($(this).children().first().is('a')) {
            var footnoteId = $(this).children().first().attr('href');

            if (!!footnotes[footnoteId]) {
                var footnoteHTML = footnotes[footnoteId];
                var $footnote = $('<p>'+footnoteHTML+'</p>');

                var $lastTag = $('*').first();
                while (!!$lastTag.next().length) {
                    $lastTag = $lastTag.next();
                }
                $lastTag.after($footnote);

                delete footnotes[footnoteId];
            }
        }
    });

    this.content = $.html();
};

Chapter.prototype.hasReference = function(ref) {
    var $ = cheerio.load(this.content);
    var id = utils.idFromRef(ref);
    return !!$('*[id="'+id+'"]').length;
};

Chapter.prototype.resolveLinks = function(siblings) {
    var that = this;

    var $ = cheerio.load(that.content);
    $('a').each(function() {
        // Check href attribute is local
        var href = $(this).attr('href');
        if (!href || !_.startsWith(href, '#')) return;

        var link = null;
        // Link exists in this chapter
        if (that.hasReference(href)) {
            link = href;
        }
        // Else look in other chapters
        else {
            siblings.forEach(function(sibling) {
                // Link to the sibling filename
                var id = utils.idFromRef(href);
                if (id === sibling.titleId) {
                    link = path.relative(that.path, sibling.filepath);
                }
                // Link to an element inside a chapter
                else if (sibling.hasReference(href)) {
                    link = path.relative(that.path, sibling.filepath)+href;
                }
            });
        }

        // If link was found in document, replace href attribute
        if (!!link) $(this).attr('href', link);
        // Otherwise, replace by a <p> tag
        else {
            var $replacement = $('<p></p>');
            $replacement.attr('id', $(this).attr('id'));
            $replacement.html($(this).html());
            $(this).replaceWith($replacement);
        }
    });

    that.content = $.html();
};

Chapter.prototype.resolveAssetsLinks = function() {
    var that = this;

    var $ = cheerio.load(that.content);
    $('img').each(function() {
        // Check that img src attribute points to a file on FS
        var src = $(this).attr('src');
        if (!src || !_.startsWith(src, '/')) return;

        var newSrc = path.relative(that.path, src);
        $(this).attr('src', newSrc);
    });

    that.content = $.html();
};

Chapter.prototype.toMarkdown = function() {
    var markdown = toMarkdown(this.content, { gfm: true, converters: markdownFilters });
    // Replace non-breaking spaces
    this.markdown = markdown.replace(/\u00A0/g, ' ');
};

module.exports = Chapter;