#! /usr/bin/env node
/* eslint-disable no-console */

const _       = require('lodash');
const program = require('commander');

const gitbookConvert = require('../lib/index');

const ALLOWED_FORMATS = require('../lib/converters').ALLOWED_FORMATS;
const pkg             = require('../package.json');

// Describe program options
program
    .version(pkg.version)
    .usage('[options] <file>')
    .option('-t, --document-title [string]', 'Name used for the main document title', null)
    .option('-a, --assets-dir [dirname]', 'Name of the document\'s assets export directory', 'assets')
    .option('-m, --max-depth [integer]', 'Maximum title depth to use to split your original document into sub-chapters', 2)
    .option('-p, --prefix', 'Prefix filenames by an incremental counter')
    .option('-d, --debug', 'Log stack trace when an error occurs');

// Customize --help flag
program.on('--help', () => {
    console.log('  gitbook-convert accepts the following formats:');
    console.log('');
    ALLOWED_FORMATS.forEach(format => console.log(`    .${format.ext}: ${format.description}`));
    console.log('');
    console.log('  After converting your document, the corresponding GitBook files will be placed in ./export/<file>/.');
});

// Parse passed arguments
program.parse(process.argv);

// Parse and fallback to help if no args
if (_.isEmpty(program.parse(process.argv).args) && process.argv.length === 2) {
    program.help();
}

// Construct converters options
const opts = {
    filename:        program.args[0],
    exportDir:       program.args[1] || 'export',
    documentTitle:   program.documentTitle,
    assetsDirectory: program.assetsDir,
    titleDepth:      parseInt(program.maxDepth, 10),
    prefix:          program.prefix,
    debug:           program.debug
};

// Get a converter based on filename
let converter;
try {
    converter = gitbookConvert.pickConverter(opts);
}
catch (err) {
    console.log(err.message);
    if (program.debug) {
        console.log(err.stack);
    }

    process.exit(1);
}

// Launch conversion to a GitBook
converter.convert();
