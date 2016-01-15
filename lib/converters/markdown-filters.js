module.exports = [
    // Handle titles links
    {
        filter: ['h1', 'h2', 'h3', 'h4','h5', 'h6'],
        replacement: function(content, node) {
            var hLevel = node.nodeName.charAt(1);
            var hPrefix = '';
            for(var i = 0; i < hLevel; i++) {
                hPrefix += '#';
            }

            var id = '';
            if (!!node.id) {
                id = ' {#'+node.id+'}';
            }
            return '\n\n' + hPrefix + ' ' + content + id + '\n\n';
        }
    },
    // Handle footnotes
    {
        filter: 'sup',
        replacement: function(content, node) {
            var reference;
            // Origin only contains an <a> tag
            if (/A/.test(node.firstChild.tagName) && node.children.length === 1) {
                // Reference is the content of the <a> tag
                reference = node.firstChild.textContent;
                reference = reference.replace(/[^a-zA-Z\d]/g, '');
                return '[^'+reference+']';
            }
            else {
                // No id attribute, keep as-is
                if (!node.id) {
                    return node.outerHTML;
                }
                // Delete back-to-origin <a> link from <sup> tag
                content = content.replace(/\[[^\]]*\]\(.*\)\s*$/, '');
                // In footnotes, reference is the first "word"
                content = content.split(' ');
                reference = content.shift();
                reference = reference.replace(/[^a-zA-Z\d]/g, '');
                return '[^'+reference+']: '+content.join(' ').trim();
            }
        }
    },
    {
        filter: ['section', 'div', 'span'],
        replacement: function(content, node) {
            return content;
        }
    },
    // Treat <dl> as <ul>/<ol>
    {
        filter: 'dl',
        replacement: function(content, node) {
            var strings = [];
            for (var i = 0; i < node.childNodes.length; i++) {
                strings.push(node.childNodes[i]._replacement);
            }

            if (/dt|dd/i.test(node.parentNode.nodeName)) {
                return '\n' + strings.join('\n');
            }

            return '\n\n' + strings.join('\n') + '\n\n';
        }
    },
    // Process <dt>/<dd> as <li>
    {
        filter: ['dt', 'dd'],
        replacement: function(content, node) {
            content = content.replace(/^\s+/, '').replace(/\n/gm, '\n    ');
            var prefix = '*   ';
            var parent = node.parentNode;
            var index = Array.prototype.indexOf.call(parent.children, node) + 1;

            prefix = /ol/i.test(parent.nodeName) ? index + '.  ' : '*   ';
            return prefix + content;
        }
    },
    // Process all links
    {
        filter: 'a',
        replacement: function(content, node) {
            if (node.getAttribute('href')) {
                return '[' + content + '](' + node.getAttribute('href') + ')';
            }
            // Suppress link if no href provided
            else {
                return content;
            }
        }
    },
    // Convert <abbr> to emphasis
    {
        filter: 'abbr',
        replacement: function(content, node) {
            return '_' + content + '_';
        }
    }
];