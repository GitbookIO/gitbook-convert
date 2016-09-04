/* eslint-disable no-console */

// Normalize an HTML id
function normalizeId(id) {
    // Replace any non alpha-numeric character by an hyphen
    id = id.replace(/[^a-zA-Z\d]+/g, '-');
    // Trim first and last hyphens if any
    id = id.replace(/^-|-$/g, '');
    // Make lowercase
    id = id.toLowerCase();
    return id;
}

// Return ref link from an id attribute
function refFromId(id) {
    return '#' + id;
}

// Return an id from a href link attribute
function idFromRef(ref) {
    return ref.slice(1);
}

// Pad n with zeros until its length is l
function zeroPad(n, l) {
    n = n.toString();
    l = l.toString();

    while (n.length < l.length) {
        n = `0${n}`;
    }
    return n;
}

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
    zeroPad,
    Logger
};
