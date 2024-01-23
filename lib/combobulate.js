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
      }),
    );
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  serialize() {
    return {};
  },

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

  // move to next larger node
  // select next smaller (in core)
  // selecet next larger
  // add cursor at next sibling
  // transpose with next sibling
  // move to next/prev function/param/element/etc?

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
};
