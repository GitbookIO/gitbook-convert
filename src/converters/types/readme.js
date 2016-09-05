const path = require('path');

const Chapter = require('./chapter');

// Default content to use for README file
const DEFAULT_CONTENT = '<p>This file serves as your book\'s preface, a great place to describe your book\'s content and ideas.</p>';

class Readme extends Chapter {

    /**
     * Generate a new Readme
     *
     * @param  {String} ext             Extension for README file
     * @param  {String} documentTitle   README title
     * @param  {String} rootDir         Base path of the README
     * @param  {String} content         HTML content to use instead of default
     */
    constructor(ext, documentTitle, rootDir, content) {
        super(rootDir);

        this.titleHTML = `<h1>${documentTitle}</h1>`;
        this.content   = content || DEFAULT_CONTENT;

        this.title    = documentTitle;
        this.level    = 0;
        this.children = [];

        this.path        = '';
        this.filename    = `README.${ext}`;
        this.summaryPath = path.join(this.path, this.filename);
        this.filepath    = path.join(this.rootDir, this.filename);
    }

    /**
     * Prefix Readme content with HTML title and delete titleHTML property
     */
    addTitleToContent() {
        this.content = this.titleHTML + this.content;
        delete this.titleHTML;
    }
}

module.exports = Readme;
