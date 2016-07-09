var docx = require('./docx');
var html = require('./html');
var xml = require('./xml');
var odt = require('./odt');

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
        },
        {
            description: 'OpenOffice / Open Document Format',
            ext: 'odt'
        }
    ],
    docx: docx,
    html: html,
    xml: xml,
    odt: odt
};