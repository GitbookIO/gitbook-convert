const fs      = require('fs');
const path    = require('path');
const _       = require('lodash');
const Promise = require('q');
const cheerio = require('cheerio');

const utils   = require('./utils');
const Chapter = require('./types/chapter');
const Readme  = require('./types/readme');

const logger = new utils.Logger('log');

// Interface for HTML-based converters
// The inheriting converter must implement .toHMTL()

class HTMLBaseConverter {
    constructor(opts) {
        // Informations about original document file
        this.originalDoc = {
            name: opts.filename,
            ext:  path.extname(opts.filename),
            path: path.resolve(process.cwd(), opts.filename)
        };

        this.documentTitle = opts.documentTitle || path.basename(this.originalDoc.name, this.originalDoc.ext);

        // Set working directories;
        this._projectFolder = path.resolve(process.cwd(), opts.exportDir);

        this.assetsDirectory = opts.assetsDirectory;
        this._assetsFolder   = path.join(this._projectFolder, this.assetsDirectory);

        this._summaryFile = path.join(this._projectFolder, 'SUMMARY.md');

        // Other options
        this.titleDepth      = opts.titleDepth;
        this.debug           = opts.debug;
        this.prefixFilenames = opts.prefix;
    }

    /**
     * Launch conversion
     * @return {Promise}
     */
    convert() {
        // Check that file exists
        return Promise.nfcall(fs.stat, this.originalDoc.path)
        // Create folders
        .then(() => this.createDirectories())
        // Actually convert to HTML
        .fin(() => this.toHTML())
        // Manipulate HTML
        .then(() => this.extractFootnotes())
        .then(() => this.parseChapters())
        .then(() => this.processChapters())
        .then(() => this.toMarkdown())
        .then(() => this.writeSummary())
        .then(() => this.writeFiles())
        .then(() => logger.log('Done.'))
        .fail(this.handleError);
    }

    /**
     * Create project directories
     * @return {Promise}
     */
    createDirectories() {
        logger.log('Creating export folder...');
        return Promise.nfcall(fs.mkdir, this._projectFolder)
        .then(
            () => {},
            (err) => {}
        )
        .then(() => {
            logger.log('Creating assets folder...');
            return Promise.nfcall(fs.mkdir, this._assetsFolder)
            .then(
                () => {},
                (err) => {}
            );
        })
        .then(() => {
            logger.log('Creating summary file...');
            return Promise.nfcall(fs.writeFile, this._summaryFile, '# Summary\n\n')
            .then(
                () => {},
                (err) => {}
            );
        })
        .then(() => logger.log('Done.'));
    }

    /**
     * Extract footnotes from HTML and store in Converter.footnotes
     */
    extractFootnotes() {
        logger.log('Extracting footnotes...');
        this.footnotes = {};

        const $ = cheerio.load(this._html);
        $('a').each((i, link) => {
            // Ensure <a> tag is the only child
            const $parent = $(link).parent();
            if (!$parent.length) {
                return;
            }

            if (!$parent.is('sup')) {
                return;
            }

            if ($parent.contents().length !== 1) {
                return;
            }

            // Get origin id and href attributes
            const originHref = $(link).attr('href');
            let originId = $(link).attr('id');
            // originId could also be set on parent <sup> tag
            if (!originId) {
                originId = $parent.attr('id');
            }

            // Both id and href must be set in a footnote origin link
            if (!originHref || !originId) {
                return;
            }

            // Check if href is an id-like link
            if (_.startsWith(originHref, '#')) {
                // Get referenced element
                const referencedId   = utils.idFromRef(originHref);
                const $referencedTag = $(`*[id="${referencedId}"]`).first();
                if (!$referencedTag.length) {
                    return;
                }

                // Check that referred element has a link back to origin
                const $linkToOrigin = $(`a[href="#${originId}"]`);
                if (!$referencedTag.has($linkToOrigin)) {
                    return;
                }

                // Change referred element to a <p> tag
                let $replacement;
                if ($referencedTag.children().length === 1 && $referencedTag.children().first().is('p')) {
                    $replacement = $referencedTag.children().first();
                }
                else {
                    $replacement = $(`<p>${$referencedTag.html()}</p>`);
                }

                // Wrap content in a <sup> tag if not already and prepend content with origin link text
                let prefix;
                let content;
                if ($replacement.children().first().is('sup')) {
                    content = $replacement.children().first().html().trim();
                    prefix  = _.startsWith(content, $(link).text()) ? '' : $(link).text();
                    content = `${prefix} ${content}`.trim();

                    $replacement.children().first().html(content);
                }
                else {
                    content = $replacement.html().trim();
                    prefix  = _.startsWith(content, $(link).text()) ? '' : $(link).text();
                    content = `${prefix} ${content}`.trim();

                    $replacement.html(`<sup>${content}</sup>`);
                }

                // Copy attributes
                const referencedTagAttributes = getTagAttributes($referencedTag);
                for (const attr in referencedTagAttributes) {
                    $replacement.children().first().attr(attr, referencedTagAttributes[attr]);
                }

                // Save footnote by reference and remove from DOM
                this.footnotes[originHref] = $replacement.html();
                $referencedTag.remove();
            }
        });

        this._html = $.html();
    }

    /**
     * Generate the list of chapters from HTML
     */
    parseChapters() {
        logger.log('Parsing chapters...');
        // Detect maximum title tags depth to split content
        this.detectTitleTags();

        // Create README file
        const readme = new Readme('md', this.documentTitle ,this._projectFolder);

        // Actually parse chapters
        this.chapters = this.parseHTML(this._html, 0, readme);

        // If no chapters are created, the README should contain the whole document
        if (!this.chapters.length) {
            readme.content = this._html;
        }

        // Flatten list of chapters
        this.chapters = _.chain(this.chapters)
            .map((chapter, i) => [chapter].concat(chapter.getChildrenDeep()))
            .flatten(true)
            .value();

        // Generate chapters filenames
        this.chapters.forEach(chapter => chapter.generateFilename('md', this.prefixFilenames));

        // Insert Readme at the beginning of chapters array
        readme.addTitleToContent();
        this.chapters.unshift(readme);
    }

    /**
     * Get the list of header tags that should be parsed as chapters
     */
    detectTitleTags() {
        const tags      = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
        const titleTags = [];

        const $ = cheerio.load(this._html);
        tags.forEach((tag) => {
            // Maximum depth reached
            if (titleTags.length === this.titleDepth) {
                return;
            }

            // Found at list a title for current <tag>
            if (Boolean($(tag).length)) {
                titleTags.push(tag);
            }
        });

        this.titleTags = titleTags;
    }

    /**
     * Parse HTML content and render the chapters tree recursively
     *
     * @param  {String}  html       HTML content string
     * @param  {Number}  level      Current tree level
     * @param  {Chapter} parent     Chapter to use as parent of parsed chapters
     * @return {Array<Chapter>}
     */
    parseHTML(html, level, parent) {
        // Call recursively based on titleTags length
        const chapters = [];
        if (level + 1 > this.titleTags.length) {
            return chapters;
        }

        const tag         = this.titleTags[level];
        const tagLevel    = tag.slice(-1);
        const tagSplitter = new RegExp(`(\\<${tag}.*?${tag}\\>)`, 'g');
        const tagDetector = new RegExp(`\\<${tag}`);

        const parts = html.split(tagSplitter);

        // Grab first part if not a title as content of parent
        if (!tagDetector.test(parts[0])) {
            let preface = parts.shift();
            preface     = preface.trim();

            if (Boolean(preface)) {
                parent.content = preface;
            }
        }

        let chapter;
        parts.forEach((part) => {
            // Match a current level title
            if (tagDetector.test(part)) {
                // Create a new chapter
                chapter = new Chapter(this._projectFolder);

                const info = parseTitleInfo(part, tagLevel);

                chapter.level   = level;
                chapter.title   = info.title;
                chapter.titleId = info.titleId;

                chapter.parent    = (level > 0) ? parent : null;
                chapter.titleHTML = part;
            }
            // Match a current level content
            else {
                // Get subchapters
                chapter.children = this.parseHTML(part, level + 1, chapter);
                if (!chapter.children.length) {
                    chapter.content = part;
                }

                chapter.content = chapter.titleHTML + chapter.content;
                chapter.content = chapter.content.trim();
                chapter.num     = chapters.length + 1;

                delete chapter.titleHTML;
                chapters.push(chapter);
            }
        });

        return chapters;
    }

    /**
     * Format parsed HTML
     */
    processChapters() {
        logger.log('Processing chapters...');
        // Set titles and footnotes
        this.chapters.forEach((chapter, index) => {
            // Don't erase footnotes for other chapters
            const footnotes = _.cloneDeep(this.footnotes);
            // Reset footnotes in each correct chapter
            chapter.setFootnotes(footnotes);
        });

        // Clean and resolve links
        this.chapters.forEach((chapter) => {
            // Clean HTML
            try {
                chapter.cleanHTML();
            }
            catch (err) {
                this.handleError(err);
            }
        });

        // Normalize titles id
        this.chapters.forEach((chapter, index) => {
            const siblings = this.chapters.filter((c, pos) => pos !== index);
            chapter.normalizeTitlesId(siblings);
        });

        // Resolve links
        this.chapters.forEach((chapter, index) => {
            const siblings = this.chapters.filter((c, pos) => pos !== index);

            chapter.resolveLinks(siblings);
            chapter.resolveAssetsLinks();
        });
    }

    /**
     * Convert HTML to markdown
     */
    toMarkdown() {
        logger.log('Converting chapters to markdown...');
        this.chapters.forEach(chapter => chapter.toMarkdown());
    }

    /**
     * Add each chapter to SUMMARY
     * @return {Promise}
     */
    writeSummary() {
        logger.log('Writing summary...');

        return this.chapters.reduce((prev, chapter) => {
            return prev.then(() => {
                // Create padding for subchapters
                let padding = '';
                while (padding.length < chapter.level * 2) {
                    padding += ' ';
                }

                // Add summary entry
                const entry = `${padding}* [${chapter.title}](${chapter.summaryPath})\n`;

                return Promise.nfcall(fs.appendFile, this._summaryFile, entry)
                .fail(this.handleError);
            });
        }, Promise());
    }

    /**
     * Write each chapter to a file on FS
     * @return {Promise}
     */
    writeFiles() {
        // Create a file for each book part
        return this.chapters.reduce((prev, chapter) => {
            return prev.then(() => {
                logger.log(`Writing file: ${chapter.filepath}`);
                // Try to create directory
                return Promise.nfcall(fs.stat, chapter.path)
                .fail((err) => Promise.nfcall(fs.mkdir, chapter.path))
                // Directory exists
                .fail((err) => {})
                .then(() => {
                    // Write converted file
                    return Promise.nfcall(fs.writeFile, chapter.filepath, chapter.markdown)
                    .fail(this.handleError);
                });
            });
        }, Promise());
    }

    handleError(err) {
        logger.error(err.message);
        logger.error(err.stack);

        process.exit(1);
    }
}

/**
 * Extract the text and id from a header <h*> tag
 * and returns as an object:
 *     - titleId: id attribute to use
 *     - title:   text for this title
 *
 * @param  {String} title   HTML string for the title
 * @param  {String} level   Header tag level (i.e. 1 for <h1>)
 * @return {Object}
 */
function parseTitleInfo(title, level) {
    const $ = cheerio.load(title);

    const $h      = $(`h${level}`);
    // Use existing id attribute or normalize text
    const titleId = $h.attr('id') || utils.normalizeId($h.text());

    return {
        titleId,
        title:   $h.text()
    };
}

/**
 * Return a tag attributes
 * @param  {jQuery Element} el
 * @return {Object}
 */
function getTagAttributes(el) {
    return el.get(0).attribs;
}

module.exports = HTMLBaseConverter;
