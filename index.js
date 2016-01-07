var Importer = require('./importer');

var filename = process.argv[2];
var rootDirectory = process.argv[3] || null;
var assetsDirectory = process.argv[4] || null;

var opts = {
    filename: filename,
    rootDirectory: rootDirectory,
    assetsDirectory: assetsDirectory
};

var importer = new Importer(opts);
// importer.convert();