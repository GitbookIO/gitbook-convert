const docx = require('./docx');
const html = require('./html');
const xml  = require('./xml');
const odt  = require('./odt');

module.exports = {
    ALLOWED_FORMATS: [
        {
            description: 'Microsoft Office Open XML Document',
            ext:         'docx'
        },
        {
            description: 'HyperText Markup Language',
            ext:         'html'
        },
        {
            description: 'Docbook Markup Language',
            ext:         'xml'
        },
        {
            description: 'OpenOffice / Open Document Format',
            ext:         'odt'
        }
    ],
    docx,
    html,
    xml,
    odt
};
