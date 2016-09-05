const path = require('path');

const _          = require('lodash');
const brightml   = require('brightml');
const cheerio    = require('cheerio');
const normall    = require('normall');
const toMarkdown = require('to-markdown');

const utils = require('../utils');
const markdownFilters = require('../markdown-filters');

class Chapter {
    constructor(rootDir) {
        this.rootDir = rootDir;
        this.path    = '';

        this.content = '';
    }

    /**
     * Set the different paths for this chapter
     * @param  {String} ext                 Extension for the file
     * @param  {Boolean} prefixFilenames    Should the chapter filename be prefixed by '<chapter.num>'
     */
    generateFilename(ext, prefixFilenames) {
        let parent     = this.parent;
        const siblings = parent ? _.without(parent.children, this) : [];

        // Add parent folder to path
        while (Boolean(parent)) {
            this.path = path.join(normalizeFilename(parent, prefixFilenames), this.path);
            parent    = parent.parent;
        }

        // Chapter has children, name it README at base of folder
        if (Boolean(this.children.length)) {
            this.path     = path.join(this.path, normalizeFilename(this, prefixFilenames));
            this.filename = 'README';
        }
        // Or generate the chapter filename
        else {
            this.filename = normalizeFilename(this, prefixFilenames);
        }

        // Suffix filename if a sibling has the same name
        siblings.forEach((sibling) => {
            // Return if sibling doesn't have a filename yet
            if (!sibling.filename) {
                return;
            }

            // Update current chapter filename
            const siblingFilename = path.basename(sibling.filename, '.' + ext);
            if (siblingFilename === this.filename) {
                this.filename += '.' + this.num;
            }
        });

        // Add extension
        this.filename = this.filename + '.' + ext;

        // Keep local reference for summary
        this.summaryPath = path.join(this.path, this.filename);
        // Actual paths on FS
        this.path     = path.join(this.rootDir, this.path);
        this.filepath = path.join(this.path, this.filename);
    }

    /**
     * Returns a flattened list of chapter's children
     * @return {Array<Chapter>}
     */
    getChildrenDeep() {
        return this.children
        .map(sub => _.flatten([sub].concat(sub.getChildrenDeep()), true));
    }

    /**
     * Sanitize chapter's HTML content
     */
    cleanHTML() {
        brightml.parse(this.content);
        brightml.setAnchorsId();
        brightml.cleanElements();
        brightml.cleanImagesInTitles();
        brightml.removeNestedTables();
        brightml.formatTables();
        brightml.cleanTableCells();

        this.content = brightml.render();
    }

    /**
     * Replace all references to <oldId> by <newId> in chapter
     * @param  {String} oldId   HTML id to replace
     * @param  {String} newId   HTML id replacement
     */
    replaceLinksRefs(oldId, newId) {
        if (!oldId) {
            return;
        }

        const oldRef = utils.refFromId(oldId);
        const newRef = utils.refFromId(newId);

        // Replace in HTML
        const $ = cheerio.load(this.content);
        $(`*[href="${oldRef}"]`).each((i, link) => {
            $(link).attr('href', newRef);
        });

        this.content = $.html();

        // Replace titleId
        if (this.titleId === oldId) {
            this.titleId = newId;
        }
    }

    /**
     * Normalize title ids in this chapter
     * and replace references in siblings
     *
     * @param  {Array<Chapter>} siblings
     */
    normalizeTitlesId(siblings) {
        const titleTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
        const ids       = [];
        let counter;

        const $ = cheerio.load(this.content);

        titleTags.forEach((titleTag) => {
            $(titleTag).each((i, title) => {
                // Compute new id
                const oldId  = $(title).attr('id');
                const textId = utils.normalizeId($(title).text());

                // Prevent obtaining the same id twice
                let newId = textId;

                counter = 0;
                while (_.includes(_.pluck(ids, 'newId'), newId)) {
                    newId = textId + '-' + counter;
                    counter++;
                }

                ids.push({ oldId, newId });

                // Replace id in href links in other chapters
                siblings.forEach(chapter => chapter.replaceLinksRefs(oldId, newId));

                // Replace current title id
                $(title).attr('id', newId);
            });
        });

        this.content = $.html();

        // Replace ids in href links of current chapter
        ids.forEach(id => this.replaceLinksRefs(id.oldId, id.newId));
    }

    /**
     * Reset extracted footnotes in this chapter
     */
    setFootnotes(footnotes) {
        const $ = cheerio.load(this.content);

        $('sup').each((i, sup) => {
            if ($(sup).children().first().is('a')) {
                const footnoteId = $(sup).children().first().attr('href');

                if (Boolean(footnotes[footnoteId])) {
                    const footnoteHTML = footnotes[footnoteId];
                    const $footnote    = $(`<p>${footnoteHTML}</p>`);

                    let $lastTag = $('*').first();
                    while (Boolean($lastTag.next().length)) {
                        $lastTag = $lastTag.next();
                    }

                    $lastTag.after($footnote);

                    delete footnotes[footnoteId];
                }
            }
        });

        this.content = $.html();
    }

    /**
     * Returns true if this chapter contains the id <ref>
     *
     * @param  {String}  ref    HTML id to look for
     * @return {Boolean}
     */
    hasReference(ref) {
        const $  = cheerio.load(this.content);
        const id = utils.idFromRef(ref);

        return Boolean($(`*[id="${id}"]`).length);
    }

    /**
     * Resolve <a> tags links referencing parts in siblings
     *
     * @param  {Array<Chapter>} siblings
     */
    resolveLinks(siblings) {
        const $ = cheerio.load(this.content);

        $('a').each((i, linkEl) => {
            // Check href attribute is local
            const href = $(linkEl).attr('href');
            if (!href || !_.startsWith(href, '#')) {
                return;
            }

            let link = null;
            // Link exists in this chapter
            if (this.hasReference(href)) {
                link = href;
            }
            // Else look in other chapters
            else {
                siblings.forEach((sibling) => {
                    // Link to the sibling filename
                    const id = utils.idFromRef(href);
                    if (id === sibling.titleId) {
                        link = path.relative(this.path, sibling.filepath);
                    }
                    // Link to an element inside a chapter
                    else if (sibling.hasReference(href)) {
                        link = path.relative(this.path, sibling.filepath) + href;
                    }
                });
            }

            // If link was found in document, replace href attribute
            if (Boolean(link)) {
                $(linkEl).attr('href', link);
            }
            // Otherwise, replace by a <p> tag
            else {
                const $replacement = $('<p></p>');
                $replacement.attr('id', $(linkEl).attr('id'));
                $replacement.html($(linkEl).html());
                $(linkEl).replaceWith($replacement);
            }
        });

        this.content = $.html();
    }

    /**
     * Resolve links to images to the assets folder
     */
    resolveAssetsLinks() {
        const $ = cheerio.load(this.content);

        $('img').each((i, img) => {
            // Check that img src attribute points to a file on FS
            const src = $(img).attr('src');
            if (!src || !_.startsWith(src, '/')) {
                return;
            }

            // Make src attribute relative to current chapter
            const newSrc = path.relative(this.path, src);
            $(img).attr('src', newSrc);
        });

        this.content = $.html();
    }

    /**
     * Convert chapter.content HTML to markdown
     */
    toMarkdown() {
        // Use GitHub Flavored Markdown
        const gfm = true;
        // Set filters
        const converters = markdownFilters;
        // Convert
        const markdown = toMarkdown(this.content, { gfm, converters });
        // Replace non-breaking spaces
        this.markdown = markdown.replace(/\u00A0/g, ' ');
    }
}

/**
 * Return a normalized filename for a chapter
 *
 * @param  {Chapter} chapter
 * @param  {Boolean} prefixFilename    Prefix filename by '<chapter.num>-'
 * @return {String}
 */
function normalizeFilename(chapter, prefixFilename) {
    let prefix = '';
    if (Boolean(prefixFilename)) {
        prefix = chapter.num + '-';
    }

    return prefix + normall.filename(chapter.title).slice(0, 50);
}

module.exports = Chapter;
