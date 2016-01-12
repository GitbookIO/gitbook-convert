var _ = require('lodash');
var brightml = require('brightml');
var cheerio = require('cheerio');
var toMarkdown = require('to-markdown');
var utils = require('./utils');

var Chapter = function(content) {
    this.content = content;
};

Chapter.prototype.getTitleAttributes = function(title) {
    this.title = title.title;
    this.titleId = title.titleId;
    this.filename = title.filename;
    this.content = title.titleHTML + this.content;
};

Chapter.prototype.cleanHTML = function() {
    brightml.parse(this.content);
    brightml.setAnchorsId();
    brightml.cleanElements();
    brightml.removeNestedTables();
    brightml.formatTables();
    brightml.cleanTableCells();

    this.content = brightml.render();
};

Chapter.prototype.replaceLinksRefs = function(oldId, newId) {
    if (!oldId) return;

    var oldRef = utils.refFromId(oldId);
    var newRef = utils.refFromId(newId);

    var $ = cheerio.load(this.content);
    $('*[href="'+oldRef+'"]').each(function() {
        $(this).attr('href', newRef);
    });

    this.content = $.html();
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

    var $ = cheerio.load(this.content);
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
                    link = './'+sibling.filename;
                }
                // Link to an element inside a chapter
                else if (sibling.hasReference(href)) {
                    link = './'+sibling.filename+href;
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

    this.content = $.html();
};

Chapter.prototype.toMarkdown = function() {
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
                var reference;
                // Origin only contains an <a> tag
                if (/A/.test(node.firstChild.tagName) && node.children.length === 1) {
                    // Reference is the content of the <a> tag
                    reference = node.firstChild.textContent;
                    reference = reference.replace(/[^a-zA-Z\d]/g, '');
                    return '[^'+reference+']';
                }
                else {
                    // No id attribute, keep as-is
                    if (!node.id) {
                        return node.outerHTML;
                    }
                    // Delete back-to-origin <a> link from <sup> tag
                    content = content.replace(/\[[^\]]*\]\(.*\)\s*$/, '');
                    // In footnotes, reference is the first "word"
                    content = content.split(' ');
                    reference = content.shift();
                    reference = reference.replace(/[^a-zA-Z\d]/g, '');
                    return '[^'+reference+']: '+content.join(' ').trim();
                }
            }
        },
        {
            filter: ['section', 'div', 'span'],
            replacement: function(content, node) {
                return content;
            }
        },
        // Treat <dl> as <ul>/<ol>
        {
            filter: 'dl',
            replacement: function (content, node) {
                var strings = [];
                for (var i = 0; i < node.childNodes.length; i++) {
                    strings.push(node.childNodes[i]._replacement);
                }

                if (/dt|dd/i.test(node.parentNode.nodeName)) {
                    return '\n' + strings.join('\n');
                }

                return '\n\n' + strings.join('\n') + '\n\n';
            }
        },
        // Process <dt>/<dd> as <li>
        {
            filter: ['dt', 'dd'],
            replacement: function (content, node) {
                content = content.replace(/^\s+/, '').replace(/\n/gm, '\n    ');
                var prefix = '*   ';
                var parent = node.parentNode;
                var index = Array.prototype.indexOf.call(parent.children, node) + 1;

                prefix = /ol/i.test(parent.nodeName) ? index + '.  ' : '*   ';
                return prefix + content;
            }
        }
    ];

    this.markdown = toMarkdown(this.content, { gfm: true, converters: converters });
};

module.exports = Chapter;