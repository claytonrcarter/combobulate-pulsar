'use babel';

import Combobulate from '../lib/combobulate';

async function setText(editor, text) {
  editor.setText(text);
  await editor.languageMode.ready;
}

function getNodeAtCursor(editor) {
  return editor
    .getBuffer()
    .getLanguageMode()
    .getSyntaxNodeAtPosition(editor.getCursorBufferPosition());
}

describe('CombobulatePulsar', () => {
  let workspaceElement, editor;

  beforeEach(async () => {
    atom.config.set('core.useTreeSitterParsers', true);
    atom.config.set('core.useLegacyTreeSitter', false);
    workspaceElement = atom.views.getView(atom.workspace);
    atom.packages.activatePackage('combobulate');
    await atom.packages.activatePackage('language-javascript');
    editor = await atom.workspace.open('foo.js');
  });

  describe('moving between', () => {
    describe('sibling nodes', () => {
      it('moves between simple nodes', async () => {
        await setText(editor, '[1, 2, 3];');
        editor.setCursorBufferPosition([0, 1]);

        expect(getNodeAtCursor(editor).text).toBe('1');

        Combobulate.moveToNextSibling();

        expect(editor.getCursorBufferPosition().column).toBe(4);
        expect(getNodeAtCursor(editor).text).toBe('2');

        Combobulate.moveToNextSibling();

        expect(editor.getCursorBufferPosition().column).toBe(7);
        expect(getNodeAtCursor(editor).text).toBe('3');

        Combobulate.moveToPreviousSibling();

        expect(editor.getCursorBufferPosition().column).toBe(4);
        expect(getNodeAtCursor(editor).text).toBe('2');

        Combobulate.moveToPreviousSibling();

        expect(editor.getCursorBufferPosition().column).toBe(1);
        expect(getNodeAtCursor(editor).text).toBe('1');
      });

      it('moves between complex nodes', async () => {
        await setText(editor, '["abc", {foo: 1}, Math.abs(-1)];');
        editor.setCursorBufferPosition([0, 1]);

        expect(getNodeAtCursor(editor).text).toBe('"');

        Combobulate.moveToNextSibling();

        expect(editor.getCursorBufferPosition().column).toBe(8);
        expect(getNodeAtCursor(editor).text).toBe('{');

        Combobulate.moveToNextSibling();

        expect(editor.getCursorBufferPosition().column).toBe(18);
        expect(getNodeAtCursor(editor).text).toBe('Math');

        Combobulate.moveToPreviousSibling();

        expect(editor.getCursorBufferPosition().column).toBe(8);
        expect(getNodeAtCursor(editor).text).toBe('{');

        Combobulate.moveToPreviousSibling();

        expect(editor.getCursorBufferPosition().column).toBe(1);
        expect(getNodeAtCursor(editor).text).toBe('"');
      });

      it('doesnt move to previous when at first node', async () => {
        await setText(editor, 'let foo = [1, 2, 3];');
        editor.setCursorBufferPosition([0, 11]);

        expect(getNodeAtCursor(editor).text).toBe('1');

        Combobulate.moveToPreviousSibling();

        expect(editor.getCursorBufferPosition().column).toBe(11);
        expect(getNodeAtCursor(editor).text).toBe('1');
      });

      it('doesnt move to next when at last node', async () => {
        await setText(editor, 'let foo = [1, 2, 3];');
        editor.setCursorBufferPosition([0, 17]);

        expect(getNodeAtCursor(editor).text).toBe('3');

        Combobulate.moveToNextSibling();

        expect(editor.getCursorBufferPosition().column).toBe(17);
        expect(getNodeAtCursor(editor).text).toBe('3');
      });
    });

    describe('larger and smaller nodes', () => {
      it('moves to larger nodes', async () => {
        await setText(editor, 'foo(["bar"]);');
        editor.setCursorBufferPosition([0, 7]);

        expect(getNodeAtCursor(editor).text).toBe('bar');

        Combobulate.moveToLargerSyntaxNode();

        expect(editor.getCursorBufferPosition().column).toBe(5);
        expect(getNodeAtCursor(editor).text).toBe('"');

        Combobulate.moveToLargerSyntaxNode();

        expect(editor.getCursorBufferPosition().column).toBe(4);
        expect(getNodeAtCursor(editor).text).toBe('[');

        Combobulate.moveToLargerSyntaxNode();

        expect(editor.getCursorBufferPosition().column).toBe(3);
        expect(getNodeAtCursor(editor).text).toBe('(');

        Combobulate.moveToLargerSyntaxNode();

        expect(editor.getCursorBufferPosition().column).toBe(0);
        expect(getNodeAtCursor(editor).text).toBe('foo');
      });

      it('moves to smaller nodes', async () => {
        await setText(editor, 'foo(["bar"]);');
        editor.setCursorBufferPosition([0, 0]);

        expect(getNodeAtCursor(editor).text).toBe('foo');

        Combobulate.moveToSmallerSyntaxNode();

        expect(editor.getCursorBufferPosition().column).toBe(3);
        expect(getNodeAtCursor(editor).text).toBe('(');

        Combobulate.moveToSmallerSyntaxNode();

        expect(editor.getCursorBufferPosition().column).toBe(4);
        expect(getNodeAtCursor(editor).text).toBe('[');

        Combobulate.moveToSmallerSyntaxNode();

        expect(editor.getCursorBufferPosition().column).toBe(5);
        expect(getNodeAtCursor(editor).text).toBe('"');

        Combobulate.moveToSmallerSyntaxNode();

        expect(editor.getCursorBufferPosition().column).toBe(6);
        expect(getNodeAtCursor(editor).text).toBe('bar');
      });
    });
  });

  describe('swapping nodes', () => {
    describe('sibling nodes', () => {
      it('swaps simple nodes', async () => {
        await setText(editor, '[1, 2, 3]');
        editor.setCursorBufferPosition([0, 4]);

        expect(getNodeAtCursor(editor).text).toBe('2');
        expect(getNodeAtCursor(editor).nextNamedSibling.text).toBe('3');

        Combobulate.swapWithNextSibling();

        expect(editor.getCursorBufferPosition().column).toBe(7);
        expect(editor.getText()).toBe('[1, 3, 2]');

        Combobulate.swapWithPreviousSibling();

        expect(editor.getCursorBufferPosition().column).toBe(4);
        expect(editor.getText()).toBe('[1, 2, 3]');
      });

      it('swaps nodes of different length', async () => {
        await setText(editor, '[a, bc, def]');
        editor.setCursorBufferPosition([0, 4]);

        Combobulate.swapWithNextSibling();

        expect(editor.getCursorBufferPosition().column).toBe(9);
        expect(editor.getText()).toBe('[a, def, bc]');

        Combobulate.swapWithPreviousSibling();

        expect(editor.getCursorBufferPosition().column).toBe(4);
        expect(editor.getText()).toBe('[a, bc, def]');
      });

      it('swaps complex nodes', async () => {
        await setText(editor, '["abc", {foo: 1}, Math.abs(-1)]');
        editor.setCursorBufferPosition([0, 8]);

        Combobulate.swapWithNextSibling();

        expect(editor.getCursorBufferPosition().column).toBe(22);
        expect(editor.getText()).toBe('["abc", Math.abs(-1), {foo: 1}]');

        Combobulate.swapWithPreviousSibling();

        expect(editor.getCursorBufferPosition().column).toBe(8);
        expect(editor.getText()).toBe('["abc", {foo: 1}, Math.abs(-1)]');
      });

      it('doesnt swap with next when at last node', async () => {
        await setText(editor, '[1, 2, 3]');
        editor.setCursorBufferPosition([0, 7]);

        expect(getNodeAtCursor(editor).text).toBe('3');

        Combobulate.swapWithNextSibling();

        expect(editor.getCursorBufferPosition().column).toBe(7);
        expect(getNodeAtCursor(editor).text).toBe('3');
      });

      it('doesnt swap with previous when at first node', async () => {
        await setText(editor, '[1, 2, 3]');
        editor.setCursorBufferPosition([0, 1]);

        expect(getNodeAtCursor(editor).text).toBe('1');

        Combobulate.swapWithPreviousSibling();

        expect(editor.getCursorBufferPosition().column).toBe(1);
        expect(getNodeAtCursor(editor).text).toBe('1');
      });

      it('undoes transpositions in a single action', async () => {
        await setText(editor, '[1, 2, 3]');
        editor.setCursorBufferPosition([0, 1]);

        expect(getNodeAtCursor(editor).text).toBe('1');
        expect(getNodeAtCursor(editor).nextNamedSibling.text).toBe('2');

        Combobulate.swapWithNextSibling();

        expect(editor.getCursorBufferPosition().column).toBe(4);
        expect(editor.getText()).toBe('[2, 1, 3]');

        editor.undo();

        expect(editor.getCursorBufferPosition().column).toBe(1);
        expect(editor.getText()).toBe('[1, 2, 3]');
      });
    });

    describe('transposing nodes', () => {
      it('transposes previous node when at start of node', async () => {
        await setText(editor, '[a, bcd, ef]');
        editor.setCursorBufferPosition([0, 4]);

        Combobulate.transposeNodes();

        expect(editor.getCursorBufferPosition().column).toBe(6);
        expect(editor.getText()).toBe('[bcd, a, ef]');
      });

      it('transposes previous node when in middle of node', async () => {
        await setText(editor, '[a, bcd, ef]');
        editor.setCursorBufferPosition([0, 6]);

        Combobulate.transposeNodes();

        // FIXME is this correct? the cursor is moving to the end of the second
        // node
        expect(editor.getCursorBufferPosition().column).toBe(7);
        expect(editor.getText()).toBe('[bcd, a, ef]');
      });

      it('transposes next node when at end of node', async () => {
        await setText(editor, '[a, bcd, ef]');
        editor.setCursorBufferPosition([0, 7]);

        Combobulate.transposeNodes();

        expect(editor.getCursorBufferPosition().column).toBe(6);
        expect(editor.getText()).toBe('[a, ef, bcd]');
      });
    });
  });
});
