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
  });
});
