/**
 * Serializer.js
 *
 * Copyright 2009, Moxiecode Systems AB
 * Released under LGPL License.
 *
 * License: http://tinymce.moxiecode.com/license
 * Contributing: http://tinymce.moxiecode.com/contributing
 */

(function(tinymce) {
	tinymce.dom.Serializer = function(settings) {
		var onPreProcess, onPostProcess, closed,
			attrRegExp, allWhiteSpaceRegExp,
			leftWhiteSpaceRegExp, rightWhiteSpaceRegExp, elmStartEndRegExp, invalidAttrPrefixesRegExp,
			isIE = tinymce.isIE, Dispatcher = tinymce.util.Dispatcher, schema = settings.schema || new tinymce.dom.Schema(settings), whiteSpaceElements,
			dom = settings.dom || tinymce.DOM, isBlock = tinymce.DOM.isBlock, filters = {}, undef, protectedRegExp;

		// Precompile various regexps
		allWhiteSpaceRegExp = /\s+/g;
		leftWhiteSpaceRegExp = /^\s+/;
		rightWhiteSpaceRegExp = /\s+$/;
		attrRegExp = /([\w:]+)(?:\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+)))?/g;
		invalidAttrPrefixesRegExp = /^(_mce_|_moz_|sizset|sizcache)/;
		protectedRegExp = /^mce:protected\((.*)\)$/;
		elmStartEndRegExp = /^\s*<[^\s]+|(<[^>]+>|>)$/g;
		closed = tinymce.makeMap('br,hr,input,meta,img,link,param,area');
		boolAttrMap = tinymce.makeMap('checked,compact,declare,defer,disabled,ismap,multiple,nohref,noresize,noshade,nowrap,readonly,selected');
		whiteSpaceElements = tinymce.makeMap('pre,script');
		onPreProcess = new Dispatcher(self);
		onPostProcess = new Dispatcher(self);

		if (settings.fix_list_elements) {
			onPreProcess.add(function(se, o) {
				var nl, x, a = ['ol', 'ul'], i, n, p, r = /^(OL|UL)$/, np;

				function prevNode(e, n) {
					var a = n.split(','), i;

					while ((e = e.previousSibling) != null) {
						for (i=0; i<a.length; i++) {
							if (e.nodeName == a[i])
								return e;
						}
					}

					return null;
				};

				for (x=0; x<a.length; x++) {
					nl = dom.select(a[x], o.node);

					for (i=0; i<nl.length; i++) {
						n = nl[i];
						p = n.parentNode;

						if (r.test(p.nodeName)) {
							np = prevNode(n, 'LI');

							if (!np) {
								np = dom.create('li');
								np.innerHTML = '&nbsp;';
								np.appendChild(n);
								p.insertBefore(np, p.firstChild);
							} else
								np.appendChild(n);
						}
					}
				}
			});
		}

		if (settings.fix_table_elements) {
			onPreProcess.add(function(se, o) {
				// Since Opera will crash if you attach the node to a dynamic document we need to brrowser sniff a specific build
				// so Opera users with an older version will have to live with less compaible output not much we can do here
				if (!tinymce.isOpera || opera.buildNumber() >= 1767) {
					tinymce.each(dom.select('p table', o.node).reverse(), function(n) {
						var parent = dom.getParent(n.parentNode, 'table,p');

						if (parent.nodeName != 'TABLE') {
							try {
								dom.split(parent, n);
							} catch (ex) {
								// IE can sometimes fire an unknown runtime error so we just ignore it
							}
						}
					});
				}
			});
		}

		function getAttribs(node) {
			var attribs = {}, i, attrNode, attrNodeList, undef, attrValue;

			if (tinymce.isIE) {
				if (node.nodeName === 'OPTION' && node.selected)
					attribs.selected = 'selected';

				if (node.nodeName === 'INPUT') {
					if (node.checked)
						attribs.checked = 'checked';

					if (attrValue = node.getAttribute('text', 2))
						attribs.text = '' + attrValue;

					if (attrValue = node.getAttribute('value', 2))
						attribs.value = '' + attrValue;

					if (attrValue = node.getAttribute('maxlength', 2)) {
						if (attrValue != 2147483647)
							attribs.maxlength = '' + attrValue;
					}

					if (attrValue = node.getAttribute('length', 2))
						attribs.length = '' + attrValue;

					attribs.type = node.type;
				}
			}

			if (!tinymce.isIE || document.documentMode === 8) {
				attrNodeList = node.attributes;
				i = attrNodeList.length;
				while (i--) {
					attrNode = attrNodeList[i];

					if (attrNode && attrNode.specified)
						attribs[attrNode.nodeName.toLowerCase()] = attrNode.nodeValue;
				}
			} else {
				node.cloneNode(false).outerHTML.replace(elmStartEndRegExp, '').replace(attrRegExp, function(a, name, value, value2, value3) {
					name = name.toLowerCase();

					if (boolAttrMap[name])
						attribs[name] = name;
					else
						attribs[name] = value || value2 || value3 || '';
				});
			}

			if (attribs._mce_src)
				attribs.src = attribs._mce_src;

			if (attribs._mce_href)
				attribs.href = attribs._mce_href;

			if (attribs._mce_style)
				attribs.style = attribs._mce_style;

			if (attribs['class']) {
				attribs['class'] = attribs['class'].replace(/\s?mceItem\w+\s?/g, '');

				if (!attribs['class'])
					delete attribs['class'];
			}

			return attribs;
		}

		function executeFilters(node_name, args) {
			var i, l, list;

			list = filters[node_name];
			if (list) {
				for (i = 0, l = list.length; i < l; i++) {
					if (list[i](node_name, args) === false)
						return false;
				}
			}

			return true;
		}

		function writeAttrib(writer, rule, name, value) {
			var undef, outValue;

			if (invalidAttrPrefixesRegExp.test(name))
				return;

			if (rule.validValues && !rule.validValues[value])
				return;

			outValue = rule.forcedValue;
			if (rule.forcedValue !== undef) {
				if (outValue === '{$uid}')
					outValue = dom.uniqueId();

				writer.writeAttribute(name, outValue);
				return;
			}


			if (value !== undef) {
				writer.writeAttribute(name, value);
				return;
			}

			outValue = rule.defaultValue;
			if (outValue !== undef) {
				if (outValue === '{$uid}')
					outValue = dom.uniqueId();

				writer.writeAttribute(name, outValue);
				return;
			}
		};

		function serializeDom(node, args, writer, first) {
			var i, l, nodeName, nodeType, attrName, attrValue, attrRule, attribs,
				children, elementRule, attributeList, hasChildNodes;

			nodeName = node.nodeName.toLowerCase();
			nodeType = node.nodeType;
			args.node = args;

			if (nodeType === 1) {
				nodeName = node.getAttribute('_mce_name') || nodeName;

				// Add correct prefix on IE
				if (isIE) {
					if (node.scopeName !== 'HTML' && node.scopeName !== 'html' && nodeName.indexOf(':') == -1)
						nodeName = node.scopeName + ':' + nodeName;
				}

				// Remove mce prefix
				if (nodeName.indexOf('mce:') === 0)
					nodeName = nodeName.substring(4);

				elementRule = first ? null : schema.getElementRule(nodeName);
				hasChildNodes = node.hasChildNodes();

				// Element filters
				args.elementRule = elementRule;
				args.node = node;
				args.attribs = attribs = getAttribs(node);
				if (!executeFilters(nodeName, args))
					elementRule = null;

				if (elementRule && elementRule.removeEmpty && !hasChildNodes)
					elementRule = null;

				if (elementRule) {
					nodeName = elementRule.outputName || nodeName;

					// Validate required attributes
					attributeList = elementRule.attributesRequired;
					if (attributeList) {
						for (i = 0, l = attributeList.length; i < l; i++) {
							if (attribs[attributeList[i]])
								break;
						}

						if (i === l)
							elementRule = null;
					}

					// Still valid
					if (elementRule) {
						// Write start element
						writer.writeStartElement(nodeName);

						// Write ordered attributes
						attributeList = elementRule.attributesOrder;
						if (attributeList) {
							for (i = 0, l = attributeList.length; i < l; i++) {
								attrName = attributeList[i];
								writeAttrib(writer, elementRule.attributes[attrName], attrName, attribs[attrName]);
							}
						}

						// Write pattern attributes
						attributeList = elementRule.attributePatterns;
						if (attributeList) {
							for (attrName in attribs) {
								for (i = 0, l = attributeList.length; i < l; i++) {
									attrRule = attributeList[i];

									if (attrRule.pattern.test(attrName)) {
										writeAttrib(writer, attrRule, attrName, attribs[attrName]);
										break;
									}
								}
							}
						}

						// Close specific elements such as <br />
						if (closed[nodeName]) {
							writer.writeAttributesEnd(true);
							return;
						}

						writer.writeAttributesEnd();
					}
				}

				// Process children
				if (hasChildNodes) {
					children = node.childNodes;
					for (i = 0, l = children.length; i < l; i++)
						serializeDom(children[i], args, writer);
				} else if (elementRule) {
					if (elementRule.paddEmpty)
						writer.writeText('\u00a0');
				}

				// Write end if the element is valid
				if (elementRule)
					writer.writeEndElement(nodeName);
			} else if (nodeType === 3) {
				writer.writeText(node.nodeValue);
			} else if (nodeType === 4) {
				writer.writeCdata(node.nodeValue);
			} else if (nodeType === 8) {
				// Handle protected items
				if (protectedRegExp.test(node.nodeValue))
					writer.writeRaw(unescape(node.nodeValue.replace(protectedRegExp, '$1')));
				else
					writer.writeComment(node.nodeValue);
			}
		};

		function addFilter(name, func) {
			tinymce.each(name.split(','), function(name) {
				var filterFuncs = filters[name] || [];

				filterFuncs.push(func);
				filters[name] = filterFuncs;
			});
		};

		addFilter('br', function(name, args) {
			var node = args.node, parentNode = node.parentNode;

			if (args._mce_bogus)
				return false;

			if (isBlock(parentNode) && node == parentNode.lastChild)
				return false;

			if (node.getAttribute('type') === '_moz')
				return false;
		});

		// Return public methods
		return {
			onPreProcess : onPreProcess,

			onPostProcess : onPostProcess,

			serialize : function(node, args, writer) {
				args = args || {};
				args.format = args.format || 'html';
				writer = args.writer = writer || new tinymce.dom.StringWriter(settings);

				// Pre process
				if (!args.no_events) {
					args.node = node;
					onPreProcess.dispatch(self, args);
				}

				// Serialize DOM to String
				serializeDom(node, args, writer, args.getInner);
				args.content = writer.getContent();

				// Post process
				if (!args.no_events)
					onPostProcess.dispatch(self, args);

				return args.content;
			},

			addRules : function(rules) {
				schema.addValidElements(rules);
			},

			/**
			 * Sets the valid elements rules of the serializer this enables you to specify things like what elements should be
			 * outputted and what attributes specific elements might have.
			 * Consult the Wiki for more details on this format.
			 *
			 * @method setRules
			 * @param {String} s Valid elements rules string.
			 */
			setRules : function(rules) {
				schema = new tinymce.dom.Schema(tinymce.extend(settings, {
					valid_elements : rules
				}));
			},

			addFilter : addFilter
		};
	};
})(tinymce);