/* eslint-disable no-console */

/**
 * Normalize an HTML id
 *
 * @param  {String} id  Original id
 * @return {String}     Normalized id
 */
function normalizeId(id) {
    // Replace any non alpha-numeric character by an hyphen
    id = id.replace(/[^a-zA-Z\d]+/g, '-');
    // Trim first and last hyphens if any
    id = id.replace(/^-|-$/g, '');
    // Make lowercase
    id = id.toLowerCase();
    return id;
}

/**
 * Return an HTML href from an id attribute
 *
 * @param  {String} id
 * @return {String}
 */
function refFromId(id) {
    return `#${id}`;
}

/**
 * Return an HTML id attribute from an HTML href
 *
 * @param  {String} href
 * @return {String}
 */
function idFromRef(href) {
    return href.slice(1);
}

/**
 * Logger rendering a message as JSON if possible
 */
class Logger {
    constructor(id) {
        this.id = id;
    }

    log(msg) {
        let consoleMsg;
        try {
            consoleMsg = JSON.stringify(msg, null, 2);
        } catch (err) {
            consoleMsg = msg;
        }

        console.log(`[${this.id}]: ${consoleMsg}`);
    }

    error(msg) {
        this.log(`ERROR: ${msg}`);
    }
}

module.exports = {
    normalizeId,
    refFromId,
    idFromRef,
    Logger
};
