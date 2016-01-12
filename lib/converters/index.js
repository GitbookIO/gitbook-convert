var docx = require('./docx');
var html = require('./html');
var xml = require('./xml');

module.exports = {
    allowedFormats: [
        {
            description: 'Microsoft Office Open XML Document',
            ext: 'docx'
        },
        {
            description: 'HyperText Markup Language',
            ext: 'html'
        },
        {
            description: 'Docbook Markup Language',
            ext: 'xml'
        }
    ],
    docx: docx,
    html: html,
    xml: xml
};