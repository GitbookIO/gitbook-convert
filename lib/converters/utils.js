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
    return '#'+id;
}

// Return an id from a href link attribute
function idFromRef(ref) {
    return ref.slice(1);
}

// Pad n with zeros until its length is l
function zeroPad(n, l) {
    n = n.toString();
    l = l.toString();
    while (n.length < l.length) { n = '0'+n; }
    return n;
}

module.exports = {
    normalizeId: normalizeId,
    refFromId: refFromId,
    idFromRef: idFromRef,
    zeroPad: zeroPad
};