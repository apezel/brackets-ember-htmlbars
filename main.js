var define, brackets, CodeMirror;
define(function (require, exports, module) {
	'use strict';

	var LanguageManager = brackets.getModule("language/LanguageManager");

	// Include `overlayMode` code mirror plugin
	if (!CodeMirror.overlayMode) {
		CodeMirror.overlayMode = function (base, overlay, combine) {
			return {
				startState: function () {
					return {
						base: CodeMirror.startState(base),
						overlay: CodeMirror.startState(overlay),
						basePos: 0,
						baseCur: null,
						overlayPos: 0,
						overlayCur: null
					};
				},
				copyState: function (state) {
					return {
						base: CodeMirror.copyState(base, state.base),
						overlay: CodeMirror.copyState(overlay, state.overlay),
						basePos: state.basePos,
						baseCur: null,
						overlayPos: state.overlayPos,
						overlayCur: null
					};
				},

				token: function (stream, state) {
					if (stream.start === state.basePos) {
						state.baseCur = base.token(stream, state.base);
						state.basePos = stream.pos;
					}
					if (stream.start === state.overlayPos) {
						stream.pos = stream.start;
						state.overlayCur = overlay.token(stream, state.overlay);
						state.overlayPos = stream.pos;
					}
					stream.pos = Math.min(state.basePos, state.overlayPos);
					if (stream.eol()) {
						state.basePos = state.overlayPos = 0;
					}

					if (state.overlayCur === null) {
						return state.baseCur;
					}
					if (state.baseCur !== null && combine) {
						return state.baseCur + " " + state.overlayCur;
					} else {
						return state.overlayCur;
					}
				},

				indent: base.indent && function (state, textAfter) {
					return base.indent(state.base, textAfter);
				},
				electricChars: base.electricChars,

				innerMode: function (state) {
					return {
						state: state.base,
						mode: base
					};
				},

				blankLine: function (state) {
					if (base.blankLine) {
						base.blankLine(state.base);
					}
					if (overlay.blankLine) {
						overlay.blankLine(state.overlay);
					}
				}
			};
		};
	}

	CodeMirror.defineMode("handlebars", function (config, parserConfig) {
		var mustacheOverlay = {
			token: function (stream, state) {
				/*jslint regexp:true */
				var ch;
				if (state.hasError) {
					return null;
				}
				if (!state.moustacheStack) {
					state.moustacheStack = [];
				}
				if (!state.inMoustache) {
					if (stream.match(/\{\{/, true)) {
						state.inMoustache = true;
						state.helperName = true;
						state.checkForTag = true;
						return "bracket";
					}
				} else {
					if (state.checkForTag) {
						state.checkForTag = false;
						if (stream.match(/#/, true)) {
							stream.next();
							state.opening = true;
							return "keyword";
						} else if (stream.match(/\//, true)) {
							stream.next();
							state.closing = true;
							return "keyword";
						}
					} else if (state.helperName) {
						state.helperName = false;
						ch = (stream.match(/[a-zA-Z0-9\-\_\$]+/, true) || []).join('');
						if (ch) {
							if (state.opening) {
								state.moustacheStack.push(ch);
								return "tag";
							} else if (state.closing) {
								if (state.moustacheStack[state.moustacheStack.length - 1] !== ch) {
									state.hasError = true;
									return "invalidchar";
								}
								state.moustacheStack.pop();
								return "tag";
							}
						}
					} else if (state.attributeNamed) {
						if (stream.next() !== '=') {
							state.hasError = true;
							return "invalidchar";
						}
						state.attributeNamed = false;
						state.attributeAssigned = true;
						return "operator";
					} else if (state.attributeAssigned) {
						state.attributeAssigned = false;
						stream.match(/\s+/, true);
						if (!state.attributeValue) {
							if (stream.peek() === '"') {
								stream.eat('"');
								state.attributeValue = true;
								state.attributeDoubleQuote = true;
								return "quote";
							} else if (stream.peek() === "'") {
								stream.eat("'");
								state.attributeValue = true;
								state.attributeDoubleQuote = false;
								return "quote";
							} else {
								stream.match(/\S+/, true);
								return "quote";
							}
						} else if (state.attributeCloseQuote && stream.peek() === (state.attributeDoubleQuote ? '"' : "'")) {
							state.attributeCloseQuote = false;
							state.attributeDoubleQuote = false;
							return "quote";
						} else {
							state.match(state.attributeDoubleQuote ? /[^"]+/ : /[^']+/, true);
							state.attributeValue = false;
							state.attributeCloseQuote = true;
							return "quote";
						}
					} else {
						if (stream.match(/[a-zA-Z0-9\-\_\$]+\s+/, true)) {
							if (stream.peek() === '=') {
								state.attributeNamed = true;
								return "variable";
							} else {
								return "quote";
							}
						} else if (stream.peek() === '"') {
							if (!state.argumentValue) {
								if (stream.peek() === '"') {
									stream.eat('"');
									state.argumentValue = true;
									state.argumentDoubleQuote = true;
									return "quote";
								} else if (stream.peek() === "'") {
									stream.eat("'");
									state.argumentValue = true;
									state.argumentDoubleQuote = false;
									return "quote";
								} else {
									stream.match(/\S+/, true);
									return "quote";
								}
							} else if (state.argumentCloseQuote && stream.peek() === (state.argumentDoubleQuote ? '"' : "'")) {
								state.argumentCloseQuote = false;
								state.argumentDoubleQuote = false;
								return "quote";
							} else {
								state.match(state.argumentDoubleQuote ? /[^"]+/ : /[^']+/, true);
								state.argumentValue = false;
								state.argumentCloseQuote = true;
								return "quote";
							}

						} else {
							if (stream.match(/\}\}/, true)) {
								state.inMoustache = false;
								return "bracket";
							}
						}
					}

					while (stream.next() !== null) {
						if (stream.match("{{", false)) {
							break;
						}
					}
					return null;
				}
			}
		};
		return CodeMirror.overlayMode(CodeMirror.getMode(config, parserConfig.backdrop || "text/html"), mustacheOverlay);
	});

	LanguageManager.defineLanguage("handlebars", {
		"name": "handlebars",
		"mode": "handlebars",
		"fileExtensions": ["hbr"],
		"blockComment": ["<!--", "-->"]
	});
});