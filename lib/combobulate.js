'use babel';

import { CompositeDisposable } from 'atom';

export default {
  subscriptions: null,

  /**
   * Configuration for logical navigation within specific languages. Different
   * tree-sitter parsers use different names for the same kinds of things. This
   * abstracts over that so that we can treat all supported languages similarly.
   *
   * `functionDeclaration` should include any way that functions can be declared, which can be many.
   *
   * @type {Object}
   * @see https://github.com/search?q=repo%3Amickeynp%2Fcombobulate%20combobulate-navigation-defun-nodes&type=code
   */
  languages: {
    'source.js': {
      functionDeclaration: [
        // arrow functions, obviously
        'arrow_function',
        // anonymous functions , eg `const a = function() {}`
        'function',
        // "regular" functions, eg `function a() {}`
        'function_declaration',
        // methods
        'method_definition',
      ],
    },

    'source.rust': {
      functionDeclaration: ['function_item', 'closure_expression'],
    },

    'source.shell': {
      functionDeclaration: ['function_definition'],
    },

    'text.html.php': {
      functionDeclaration: [
        'arrow_function',
        'anonymous_function_creation_expression',
        'function_definition',
        'method_declaration',
      ],
    },
  },

  activate() {
    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(
      atom.commands.add('atom-workspace', {
        'combobulate:add-cursor-to-all-siblings': () =>
          this.addCursorToAllSiblings(),
        'combobulate:add-cursor-to-next-sibling': () =>
          this.addCursorToNextSibling(),
        'combobulate:add-cursor-to-previous-sibling': () =>
          this.addCursorToPreviousSibling(),
        'combobulate:move-to-current-function': () =>
          this.moveToCurrentFunction(),
        'combobulate:move-to-current-function-end': () =>
          this.moveToCurrentFunctionEnd(),
        'combobulate:move-to-larger-syntax-node': () =>
          this.moveToLargerSyntaxNode(),
        'combobulate:move-to-smaller-syntax-node': () =>
          this.moveToSmallerSyntaxNode(),
        'combobulate:move-to-next-sibling': () => this.moveToNextSibling(),
        'combobulate:move-to-previous-sibling': () =>
          this.moveToPreviousSibling(),
        'combobulate:select-current-function': () =>
          this.selectCurrentFunction(),
        'combobulate:select-current-node': () => this.selectCurrentNode(),
        'combobulate:select-next-sibling': () => this.selectNextSibling(),
        'combobulate:select-previous-sibling': () =>
          this.selectPreviousSibling(),
        'combobulate:swap-with-next-sibling': () => this.swapWithNextSibling(),
        'combobulate:swap-with-previous-sibling': () =>
          this.swapWithPreviousSibling(),
        'combobulate:transpose-nodes': () => this.transposeNodes(),
      }),
    );
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  serialize() {
    return {};
  },

  // Cheatsheet:
  // SyntaxNode properties and methods:
  // see https://github.com/tree-sitter/tree-sitter/blob/master/lib/binding_web/tree-sitter-web.d.ts#L57
  // Pulsar also adds a `range` property
  //
  // useful: mode.getSyntaxNodeAtPosition()
  // useful: mode.getSyntaxNodeContainingRange()

  /**
   * @return {{editor: Editor, node: SyntaxNode|null}}
   */
  getCurrentNode() {
    const editor = atom.workspace.getActiveTextEditor();
    const languageMode = editor.getBuffer().getLanguageMode();
    return {
      editor,
      node: this.getSyntaxNodeAtPosition(
        languageMode,
        editor.getCursorBufferPosition(),
      ),
    };
  },

  /**
   * Get the largest node that starts at the current position. If the current
   * position is not the start of a node, returns the current node.
   * @return {{editor: Editor, node: SyntaxNode|null}}
   */
  getLargestCurrentNode() {
    let { editor, node } = this.getCurrentNode();

    // The node will always be "in front" of the cursor, and since we (almost)
    // always want to be working w/ named nodes, if we're currently looking at
    // an anonymous node and there is a named node just behind us, use it
    // instead.
    if (!node.isNamed() && node.previousNamedSibling) {
      node = node.previousNamedSibling;
    }

    return { editor, node: this.getLargestNodeStartingAt(node) };
  },

  /**
   * Like `getLargestCurrentNode()`, but works on the first cursor based on its
   * buffer position, not when it was added.
   *
   * @return {{editor: Editor, node: SyntaxNode|null}}
   */
  getLargestNodeForFirstCursor() {
    const editor = atom.workspace.getActiveTextEditor();
    const languageMode = editor.getBuffer().getLanguageMode();
    const firstCursor = this.getFirstBufferCursor(editor);

    return {
      editor,
      node: this.getLargestNodeStartingAt(
        this.getSyntaxNodeAtPosition(
          languageMode,
          firstCursor.getBufferPosition(),
        ),
      ),
    };
  },

  /**
   * Like `getLargestCurrentNode()`, but works on the last cursor based on its
   * buffer position, not when it was added.
   *
   * @return {{editor: Editor, node: SyntaxNode|null}}
   */
  getLargestNodeForLastCursor() {
    const editor = atom.workspace.getActiveTextEditor();
    const languageMode = editor.getBuffer().getLanguageMode();
    const lastCursor = this.getLastBufferCursor(editor);

    return {
      editor,
      node: this.getLargestNodeStartingAt(
        this.getSyntaxNodeAtPosition(
          languageMode,
          lastCursor.getBufferPosition(),
        ),
      ),
    };
  },

  /**
   * Get the next largest *named* node at the current position.
   *
   * @return {{editor: Editor, node: SyntaxNode|null}}
   */
  getNextLargestNode() {
    let { editor, node } = this.getLargestCurrentNode();

    if (!node || !node.parent) {
      return { editor, node };
    }

    return { editor, node: this.getFirstNamedAncestor(node.parent) };
  },

  /**
   * Get the function or method that contains the current cursor.
   *
   * @return {{editor: Editor, node: SyntaxNode|null}}
   */
  getCurrentFunctionNode() {
    let { editor, node } = this.getLargestCurrentNode();

    const languageScope = editor
      .getBuffer()
      .getLanguageMode()
      .getGrammar().scopeName;

    if (!this.languages[languageScope]?.functionDeclaration) {
      console.warn(`Combobulate: unsupported language '${scopeName}'`);
      return { editor, node: null };
    }

    const nodeTypes = this.languages[languageScope].functionDeclaration;
    while (node && !nodeTypes.includes(node.type)) {
      node = node.parent;
    }

    return { editor, node };
  },

  //
  // UTIL
  //

  describeNode(node) {
    if (!node) {
      return 'Bad node!';
    }

    return {
      text: node.text,
      type: node.type,
      range: node.range,
      isNamed: node.isNamed(),
    };
  },

  /**
   * @param  {Point} a
   * @param  {Point} b
   * @return {bool}
   */
  pointsAreEqual(a, b) {
    return a.row === b.row && a.column === b.column;
  },

  /**
   * Get the first named ancestor of `node`, possibly including `node`.
   * @param  {SyntaxNode} node
   * @return {SyntaxNode|null}
   */
  getFirstNamedAncestor(node) {
    while (node && !node.isNamed()) {
      node = node.parent;
    }
    return node;
  },

  /**
   * Wrapper around Editor::getSyntaxNodeAtPosition() that does some error
   * checking and node filtering.
   *
   * @return {SyntaxNode|null}
   */
  getSyntaxNodeAtPosition(languageMode, position) {
    if (!languageMode.getSyntaxNodeAtPosition) {
      console.warn('Combobulate: not in a tree-sitter buffer');
      return null;
    }

    return languageMode.getSyntaxNodeAtPosition(
      position,
      // reject root nodes; not only do we not really care about root nodes in
      // practice, but but nodes that have been injected may appear to be a root
      // node. This primarily affects traversal of sibling nodes; nodes that are
      // fully inside the injection boundary  will still be includeded as
      // expected.
      (node, _grammar) => node.parent !== null,
    );
  },

  /**
   * Get the largest node that starts at the same position as the given node,
   * excluding root nodes.
   *
   * @param  {SyntaxNode} node
   * @return {SyntaxNode|null}
   */
  getLargestNodeStartingAt(node) {
    while (
      node &&
      node.parent &&
      !node.parent.equals(node.tree.rootNode) &&
      this.pointsAreEqual(node.startPosition, node.parent.startPosition)
    ) {
      node = node.parent;
    }
    return node;
  },

  /**
   * Get the first Cursor in the buffer, based on buffer position, not when it
   * was added.
   *
   * @param  {TextEditor} editor
   * @return {Cursor}
   */
  getFirstBufferCursor(editor) {
    return editor.getCursors().reduce((min, cursor) => {
      if (cursor.getBufferRow() < min.getBufferRow()) {
        return cursor;
      }

      if (
        cursor.getBufferRow() === min.getBufferRow() &&
        cursor.getBufferColumn() < min.getBufferColumn()
      ) {
        return cursor;
      }

      return min;
    });
  },

  /**
   * Get the last Cursor in the buffer, based on buffer position, not when it
   * was added.
   *
   * @param  {TextEditor} editor
   * @return {Cursor}
   */
  getLastBufferCursor(editor) {
    return editor.getCursors().reduce((max, cursor) => {
      if (cursor.getBufferRow() > max.getBufferRow()) {
        return cursor;
      }

      if (
        cursor.getBufferRow() === max.getBufferRow() &&
        cursor.getBufferColumn() > max.getBufferColumn()
      ) {
        return cursor;
      }

      return max;
    });
  },

  /**
   * [moveToLargerSyntaxNode description]
   */
  moveToLargerSyntaxNode() {
    let { editor, node } = this.getNextLargestNode();

    if (!node) return;

    editor.setCursorBufferPosition(node.startPosition);
  },

  /**
   * [moveToSmallerSyntaxNode description]
   */
  moveToSmallerSyntaxNode() {
    let { editor, node } = this.getLargestCurrentNode();

    if (!node) return;

    // yes I yoinked this BFS from wikipedia
    const q = [node];
    while (q.length) {
      // I don't know how JS deals with constantly changing arrays, but if
      // memory reallocation and perf become an issue, we could prabably just
      // reimplement this as an append-only array where we iterate over it until
      // we reach the end
      const n = q.shift();
      if (!this.pointsAreEqual(node.startPosition, n.startPosition)) {
        node = n;
        break;
      }
      n.namedChildren.forEach((c) => q.push(c));
    }

    if (node) {
      editor.setCursorBufferPosition(node.startPosition);
    }
  },

  /**
   * [moveToNextSibling description]
   */
  moveToNextSibling() {
    const { editor, node } = this.getLargestCurrentNode();

    if (!node || node.nextNamedSibling === null) return;

    editor.setCursorBufferPosition(node.nextNamedSibling.startPosition);
  },

  /**
   * [moveToPreviousSibling description]
   */
  moveToPreviousSibling() {
    const { editor, node } = this.getLargestCurrentNode();

    if (!node || node.previousNamedSibling === null) return;

    editor.setCursorBufferPosition(node.previousNamedSibling.startPosition);
  },

  /**
   * [moveToCurrentFunction description]
   */
  moveToCurrentFunction() {
    let { editor, node } = this.getCurrentFunctionNode();

    if (!node) return;

    editor.setCursorBufferPosition(node.startPosition);
  },

  /**
   * [moveToCurrentFunctionEnd description]
   */
  moveToCurrentFunctionEnd() {
    let { editor, node } = this.getCurrentFunctionNode();

    if (!node) return;

    editor.setCursorBufferPosition(node.endPosition);
  },

  /**
   * [selectCurrentFunction description]
   */
  selectCurrentFunction() {
    let { editor, node } = this.getCurrentFunctionNode();

    if (!node) return;

    editor.setSelectedBufferRange(node.range);
  },

  /**
   * [selectCurrentFunction description]
   */
  selectCurrentNode() {
    let { editor, node } = this.getLargestCurrentNode();

    if (!node) return;

    // expand to named node
    node = this.getFirstNamedAncestor(node);

    if (!node) return;

    // try to mimic `find-and-replace:select-next`: if no selection, select
    // current node, otherwise extend selection to next sibling
    if (editor.getLastSelection().isEmpty()) {
      editor.setSelectedBufferRange(node.range);
    } else if (node.nextNamedSibling) {
      editor.addSelectionForBufferRange(node.nextNamedSibling.range);
    }
  },

  /**
   * [selectNextSibling description]
   */
  selectNextSibling() {
    const { editor, node } = this.getLargestCurrentNode();

    if (!node || node.nextNamedSibling === null) return;

    // this is the same technique used by `find-and-replace:select-next`
    if (editor.getLastSelection().isEmpty()) {
      editor.setSelectedBufferRange(node.nextNamedSibling.range);
    } else {
      editor.addSelectionForBufferRange(node.nextNamedSibling.range);
    }
  },

  /**
   * [selectPreviousSibling description]
   */
  selectPreviousSibling() {
    const { editor, node } = this.getLargestCurrentNode();

    if (!node || node.previousNamedSibling === null) return;

    if (editor.getLastSelection().isEmpty()) {
      editor.setSelectedBufferRange(node.previousNamedSibling.range);
    } else {
      editor.addSelectionForBufferRange(node.previousNamedSibling.range);
    }
  },

  /**
   * [cursorForAllSiblings description]
   */
  addCursorToNextSibling() {
    const { editor, node } = this.getLargestNodeForLastCursor();

    if (!node || node.nextNamedSibling === null) return;

    editor.addCursorAtBufferPosition(node.nextNamedSibling.startPosition);
  },

  /**
   * [cursorForAllSiblings description]
   */
  addCursorToPreviousSibling() {
    const { editor, node } = this.getLargestNodeForFirstCursor();

    if (!node || node.previousNamedSibling === null) return;

    editor.addCursorAtBufferPosition(node.previousNamedSibling.startPosition);
  },

  /**
   * [cursorForAllSiblings description]
   */
  addCursorToAllSiblings() {
    const { editor, node } = this.getLargestCurrentNode();

    if (!node || node.parent === null) return;

    node.parent.namedChildren.forEach((node) =>
      editor.addCursorAtBufferPosition(node.startPosition),
    );
  },

  /**
   * [swapWithNextSibling description]
   */
  swapWithNextSibling(opts = { moveCursorWithNode: true }) {
    const { editor, node } = this.getLargestCurrentNode();

    if (!node || node.nextNamedSibling === null) return;

    // save the current text/range values because they are updates as soon as we
    // make any updates
    // FIXME the transaction works to make "undo" atomic, but it didn't keep the
    // parse/reparse atomic
    const currentText = node.text,
      currentRange = node.range,
      nextText = node.nextNamedSibling.text,
      nextRange = node.nextNamedSibling.range;
    editor.transact(() => {
      editor.setTextInBufferRange(nextRange, currentText);
      editor.setTextInBufferRange(currentRange, nextText);
      // attempt to use the updated/reparsed node positioning
      opts.moveCursorWithNode &&
        editor.setCursorBufferPosition(node.nextNamedSibling.startPosition);
    });
  },

  /**
   * [swapWithPreviousSibling description]
   */
  swapWithPreviousSibling(opts = { moveCursorWithNode: true }) {
    const { editor, node } = this.getLargestCurrentNode();

    if (!node || node.previousNamedSibling === null) return;

    const currentText = node.text,
      currentRange = node.range,
      previousText = node.previousNamedSibling.text,
      previousRange = node.previousNamedSibling.range;
    editor.transact(() => {
      editor.setTextInBufferRange(currentRange, previousText);
      editor.setTextInBufferRange(previousRange, currentText);
      opts.moveCursorWithNode &&
        editor.setCursorBufferPosition(previousRange.start);
    });
  },

  /**
   * [transposeNodes description]
   */
  transposeNodes() {
    const { editor, node } = this.getLargestCurrentNode();
    if (
      this.pointsAreEqual(editor.getCursorBufferPosition(), node.endPosition)
    ) {
      this.swapWithNextSibling({ moveCursorWithNode: false });
    } else {
      this.swapWithPreviousSibling({ moveCursorWithNode: false });
    }
  },
};
