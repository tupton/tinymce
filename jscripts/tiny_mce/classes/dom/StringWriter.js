/**
 * StringWriter.js
 *
 * Copyright 2009, Moxiecode Systems AB
 * Released under LGPL License.
 *
 * License: http://tinymce.moxiecode.com/license
 * Contributing: http://tinymce.moxiecode.com/contributing
 */

tinymce.dom.StringWriter = function(settings) {
	var encode, content = [], indentBefore, indentAfter, prevIndent, depth = 0;

	encode = tinymce.dom.Entities.getEncodeFunc(
		settings.entity_encoding || 'named',
		settings.entities
	);

	indentBefore = tinymce.makeMap(settings.indent_before);
	indentAfter = tinymce.makeMap(settings.indent_after);

	return {
		writeStartElement : function(name) {
			if (indentBefore[name] && !prevIndent)
				content[content.length] = '\n';

			content[content.length] = '<' + name;
			prevIndent = false;
			depth++;
		},

		writeAttribute : function(name, value) {
			content[content.length] = ' ' + encode(name, true) + '="' + encode(value, true) + '"';
		},

		writeAttributesEnd : function(close) {
			if (close) {
				depth--;
				content[content.length] = ' />';

				if (indentAfter[name]) {
					content[content.length] = '\n';
					prevIndent = true;
				}
			} else
				content[content.length] = '>';
		},

		writeEndElement : function(name) {
			depth--;
			content[content.length] = '</' + name + '>';

			if (indentAfter[name]) {
				content[content.length] = '\n';
				prevIndent = true;
			}
		},

		writeText : function(text) {
			content[content.length] = encode(text);
			prevIndent = false;
		},

		writeComment : function(text) {
			content[content.length] = '<!--' + text + '-->';
			prevIndent = false;
		},

		writeCdata : function(text) {
			content[content.length] = '<![CDATA[' + text + ']]>';
			prevIndent = false;
		},

		writeRaw : function(text) {
			content[content.length] = text;
			prevIndent = false;
		},

		getContent : function() {
			return content.join('');
		},

		rollback : function(num) {
			content.length -= num || 1;
		},

		reset : function() {
			content = [];
		}
	};
};