const path = require('path');

const Chapter = require('./chapter');

class Readme extends Chapter {
    constructor(ext, documentTitle, rootDir, content) {
        super(rootDir);

        const defaultContent = '<p>This file serves as your book\'s preface, a great place to describe your book\'s content and ideas.</p>';

        this.titleHTML = '<h1>' + documentTitle + '</h1>';
        this.content   = content || defaultContent;

        this.title    = documentTitle;
        this.level    = 0;
        this.children = [];

        this.path        = '';
        this.filename    = 'README.' + ext;
        this.summaryPath = path.join(this.path, this.filename);
        this.filepath    = path.join(this.rootDir, this.filename);
    }

    setTitle() {
        this.content = this.titleHTML + this.content;
        delete this.titleHTML;
    }
}

module.exports = Readme;
