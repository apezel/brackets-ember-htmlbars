/* jslint devel:true */
/* global define, brackets */

define(function (require, exports, module) {
  'use strict';

  var LanguageManager = brackets.getModule("language/LanguageManager");
  var codeMirror = brackets.getModule("thirdparty/CodeMirror2/lib/codemirror");

  // Include `overlayMode` code mirror plugin
  if (!codeMirror.overlayMode) {
    codeMirror.overlayMode = function (base, overlay, combine) {
      return {
        startState: function () {
          return {
            base: codeMirror.startState(base),
            overlay: codeMirror.startState(overlay),
            basePos: 0,
            baseCur: null,
            overlayPos: 0,
            overlayCur: null
          };
        },
        copyState: function (state) {
          return {
            base: codeMirror.copyState(base, state.base),
            overlay: codeMirror.copyState(overlay, state.overlay),
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
          }
          return state.overlayCur;
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

  codeMirror.defineMode("handlebars", function (config, parserConfig) {
    var mustacheOverlay = {
      startState: function () {
        return {
          moustacheStack: [],
          hasError: false,
          errorTerminatesOn: null,
          opening: false,
          closing: false,
          helperName: false,
          comment: false,
          safeComment: false,
          doNotEscape: false
        };
      },
      token: function (stream, state) {
        /*jslint regexp:true */
        stream.eatSpace();
        if (!state.inHandlebar) {
          if (stream.match('{{')) {
            stream.eatSpace();
            state.inHandlebar = true;
            state.helperName = true;
            state.closing = false;
            state.opening = false;
            state.doNotEscape = false;
            state.comment = false;

            if (stream.eat('{')) {
              //output HTML
              state.doNotEscape = true;
              stream.eatSpace();
              return "operator";
            }
            if (stream.eat('!')) {
              stream.backUp(1);
              state.comment = true;
              if (stream.match('!--')) {
                stream.backUp(3);
                state.safeComment = true;
              }
              return "comment";
            }
            if (stream.eat('#')) {
              //tag start
              state.opening = true;
            } else if (stream.eat("/")) {
              //tag end
              state.closing = true;
            }
            stream.eatSpace();
            return "bracket";
          }
          if (stream.next() === null && state.moustacheStack.length > 0) {
            console.log("Unclosed tags: ", state.moustacheStack);
            return "invalidchar";
          }
          return null;
        }
        // Since comments can contain }} it needs to be processed first
        if(state.comment) {
          if((state.safeComment === true && stream.match('--}}')) || (state.safeComment === false && stream.match('}}'))) {
            state.comment = false;
            state.inHandlebar = false;
            state.helperName = false;
            state.safeComment = false;
          } else {
            stream.next();
          }

          return "comment";
        }
        if (state.helperName) {
          state.helperName = false;

          if (!state.opening && !state.closing && stream.match(/^[\w\d\-\_\$\.\/\@]+\s*\}\}/, false)) {
            stream.match(/^[\w\d\-\_\$\.\/\@]+/, true);
            stream.eatSpace();
            return "variable";
          }
          if (stream.match(/^[\w\d\-\_\$]+/, false)) {
            stream.match(/^[\w\d\-\_\$]+/, true);
            state.helperName = false;
            if (state.closing) {
              state.closing = false;
              state.endOnly = true;
              if (state.moustacheStack.pop() !== stream.current()) {
                console.log('Mismatched tags');
                return "invalidchar";
              }
              return "tag";
            }
            if (state.opening) {
              stream.opening = false;
              state.moustacheStack.push(stream.current());
            }
            state.argumentList = true;
            return "tag";
          }
          stream.next();
          return "invalidchar";
        }
        if (state.endOnly) {
          state.endOnly = false;
          if (stream.match('}}', true)) {
            stream.eatSpace();
            state.inHandlebar = false;
            return "bracket";
          }
          console.log("Bad end char");
          stream.next();
          return "invalidchar";
        }
        if (state.doNotEscape && stream.match('}}}', true)) {
          state.argumentList = false;
          state.inHandlebar = false;
          state.doNotEscape = false;
          return "operator";
        }
        if (stream.match('}}', true)) {
          state.argumentList = false;
          state.inHandlebar = false;
          return "bracket";
        }
        if (!state.attributeKeyword && !state.attributeAssignment && !state.attributeValue && stream.match(/^[\w\d\-\_\$]+\s*=/, false)) {
          state.argumentList = false;
          stream.match(/^[\w\d\-\_\$]+/, true);
          if (/Binding$/.test(stream.current())) {
            stream.backUp(7);
            state.attributeKeyword = true;
            return "number";
          }
          stream.eatSpace();
          state.attributeAssignment = true;
          return "number";
        }
        if (state.attributeKeyword) {
          stream.skipTo("=");
          state.attributeKeyword = false;
          state.attributeAssignment = true;
          return "keyword";
        }
        if (state.attributeAssignment) {
          state.attributeAssignment = false;
          state.attributeValue = true;
          if (stream.next() !== '=') {
            console.log("Expected =");
            return "invalidchar";
          }
          return "operator";
        }
        if (state.attributeValue) {
          state.attributeValue = false;
          if (stream.match(/^"([^\\"]|\\\\|\\")*"/, false)) {
            stream.match(/^"([^\\"]|\\\\|\\")*"/, true);
            stream.eatSpace();
            return "atom";
          }
          if (stream.match(/^'([^\\']|\\\\|\\')*'/, true)) {
            stream.eatSpace();
            return "atom";
          }
          stream.match(/^[^\s]+/, true);
          console.log("Invalid attribute value");
          return "invalidchar";
        }
        if (state.argumentList) {
          if (stream.match(/^"([^\\"]|\\\\|\\")*"/, false)) {
            stream.match(/^"([^\\"]|\\\\|\\")*"/, true);
            stream.eatSpace();
            return "atom";
          }
          if (stream.match(/^'([^\\']|\\\\|\\')*'/, true)) {
            stream.eatSpace();
            return "atom";
          }
          if (stream.match(/^[A-Za-z0-9\._$]+/, true)) {
            stream.eatSpace();
            return "variable";
          }
        }

        console.log("Bad data: ", stream.next(), state);
        return "invalidchar";
      }
    };
    return codeMirror.overlayMode(codeMirror.getMode(config, parserConfig.backdrop || "text/html"), mustacheOverlay);
  });

  fileExtensions = ["handlebars", "hbs"];
  var htmlLanguage = LanguageManager.getLanguage("html");

  if(htmlLanguage !== null) {
    htmlLanguage.removeFileExtension("hbr");
    htmlLanguage.removeFileExtension("hbs");
    htmlLanguage.removeFileExtension("handlebars");    
  }

  LanguageManager.defineLanguage("handlebars", {
    "name": "handlebars",
    "mode": "handlebars",
    "fileExtensions": fileExtensions,
    "blockComment": ["{{!--", "--}}"]
  });
});