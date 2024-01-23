'use babel';

import { CompositeDisposable } from 'atom';

export default {
  subscriptions: null,

  activate() {
    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(
      atom.commands.add('atom-workspace', {
        'combobulate:move-to-next-sibling': () => this.moveToNextSibling(),
        'combobulate:move-to-previous-sibling': () =>
          this.moveToPreviousSibling(),
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
      node:
        languageMode.getSyntaxNodeAtPosition &&
        languageMode.getSyntaxNodeAtPosition(editor.getCursorBufferPosition()),
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

    while (
      node &&
      node.parent &&
      this.pointsAreEqual(node.startPosition, node.parent.startPosition)
    ) {
      node = node.parent;
    }
    return { editor, node };
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
   * [moveToNextSibling description]
   */
  moveToNextSibling() {
    const { editor, node } = this.getLargestCurrentNode();

    if (!node || node.nextNamedSibling === null) return;

    editor.setCursorBufferPosition(node.nextNamedSibling.range.start);
  },

  /**
   * [moveToPreviousSibling description]
   */
  moveToPreviousSibling() {
    const { editor, node } = this.getLargestCurrentNode();

    if (!node || node.previousNamedSibling === null) return;

    editor.setCursorBufferPosition(node.previousNamedSibling.range.start);
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
