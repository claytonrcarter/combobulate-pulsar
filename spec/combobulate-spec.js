'use babel';

import dedent from 'dedent';
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

    describe('function declarations', () => {
      it('moves to enclosing function', async () => {
        await setText(
          editor,
          dedent`
                function foo() {
                    const a = 1;
                }
            `,
        );
        editor.setCursorBufferPosition([1, 4]);

        expect(getNodeAtCursor(editor).text).toBe('const');

        Combobulate.moveToCurrentFunction();

        expect(editor.getCursorBufferPosition().row).toBe(0);
        expect(editor.getCursorBufferPosition().column).toBe(0);
        expect(getNodeAtCursor(editor).text).toBe('function');
      });
    });
  });

  describe('selecting nodes', () => {
    describe('current node', () => {
      it('works at the beginning of a node', async () => {
        await setText(editor, 'let a = foo.bar();');
        editor.setCursorBufferPosition([0, 8]);

        Combobulate.selectCurrentNode();

        const range = editor.getLastSelection().getBufferRange();
        expect(
          range.isEqual([
            [0, 8],
            [0, 17],
          ]),
        ).toBe(true);
      });

      it('works in the middle of a node', async () => {
        await setText(editor, 'let a = foo.bar();');
        editor.setCursorBufferPosition([0, 10]);

        Combobulate.selectCurrentNode();

        const range = editor.getLastSelection().getBufferRange();
        expect(
          range.isEqual([
            [0, 8],
            [0, 17],
          ]),
        ).toBe(true);
      });

      it('works at the end of a node', async () => {
        await setText(editor, 'let a = foo.bar();');
        editor.setCursorBufferPosition([0, 17]);

        Combobulate.selectCurrentNode();

        const range = editor.getLastSelection().getBufferRange();
        // NB not the same same range as previous tests, but that's intended
        expect(
          range.isEqual([
            [0, 4],
            [0, 17],
          ]),
        ).toBe(true);
      });
    });

    describe('sibling nodes', () => {
      describe('next siblings', () => {
        it('selects from start', async () => {
          await setText(editor, '[abc, def, ghi]');
          editor.setCursorBufferPosition([0, 1]);

          Combobulate.selectNextSibling();

          const range = editor.getLastSelection().getBufferRange();
          expect(editor.getSelectedText()).toBe('def');
        });

        it('selects from middle', async () => {
          await setText(editor, '[abc, def, ghi]');
          editor.setCursorBufferPosition([0, 2]);

          Combobulate.selectNextSibling();

          const range = editor.getLastSelection().getBufferRange();
          expect(editor.getSelectedText()).toBe('def');
        });

        it('selects from end', async () => {
          await setText(editor, '[abc, def, ghi]');
          editor.setCursorBufferPosition([0, 4]);

          Combobulate.selectNextSibling();

          const range = editor.getLastSelection().getBufferRange();
          expect(editor.getSelectedText()).toBe('def');
        });

        it('expands selection', async () => {
          await setText(editor, '[abc, def, ghi]');
          editor.setCursorBufferPosition([0, 1]);

          Combobulate.selectNextSibling();
          Combobulate.selectNextSibling();

          const selections = editor.getSelections();
          expect(selections.length).toBe(2);
          expect(selections[0]?.getText()).toBe('def');
          expect(selections[1]?.getText()).toBe('ghi');
        });
      });

      describe('previous siblings', () => {
        it('selects from start', async () => {
          await setText(editor, '[abc, def, ghi]');
          editor.setCursorBufferPosition([0, 6]);

          Combobulate.selectPreviousSibling();

          const range = editor.getLastSelection().getBufferRange();
          expect(editor.getSelectedText()).toBe('abc');
        });

        it('selects from middle', async () => {
          await setText(editor, '[abc, def, ghi]');
          editor.setCursorBufferPosition([0, 7]);

          Combobulate.selectPreviousSibling();

          const range = editor.getLastSelection().getBufferRange();
          expect(editor.getSelectedText()).toBe('abc');
        });

        it('selects from end', async () => {
          await setText(editor, '[abc, def, ghi]');
          editor.setCursorBufferPosition([0, 9]);

          Combobulate.selectPreviousSibling();

          const range = editor.getLastSelection().getBufferRange();
          expect(editor.getSelectedText()).toBe('abc');
        });
      });
    });

    describe('function declarations', () => {
      it('selects from top level of function', async () => {
        await setText(
          editor,
          dedent`
                function foo() {
                    const a = 1;
                }
            `,
        );
        // just inside `function`
        editor.setCursorBufferPosition([0, 5]);
        expect(getNodeAtCursor(editor).text).toBe('function');

        Combobulate.selectCurrentFunction();

        const range = editor.getLastSelection().getBufferRange();
        expect(
          range.isEqual([
            [0, 0],
            [2, 1],
          ]),
        ).toBe(true);
      });

      it('selects from cursor inside function', async () => {
        await setText(
          editor,
          dedent`
                function foo() {
                    const a = 1;
                }
            `,
        );
        // just inside `const`
        editor.setCursorBufferPosition([1, 5]);
        expect(getNodeAtCursor(editor).text).toBe('const');

        Combobulate.selectCurrentFunction();

        const range = editor.getLastSelection().getBufferRange();
        expect(
          range.isEqual([
            [0, 0],
            [2, 1],
          ]),
        ).toBe(true);
      });

      it('selects from selection inside function', async () => {
        await setText(
          editor,
          dedent`
                function foo() {
                    const a = 1;
                }
            `,
        );
        // any "unbalanced" selection; spans nodes, but not inclusively
        editor.setSelectedBufferRange([
          [1, 7],
          [1, 13],
        ]);
        expect(editor.getSelectedText()).toBe('st a =');

        Combobulate.selectCurrentFunction();

        const range = editor.getLastSelection().getBufferRange();
        expect(
          range.isEqual([
            [0, 0],
            [2, 1],
          ]),
        ).toBe(true);
      });
    });

    describe('method declarations', () => {
      it('selects from top level of method', async () => {
        await setText(
          editor,
          dedent`
                class Foo {
                    bar() {
                        const a = 1;
                    }
                }
            `,
        );
        // just inside `bar`
        editor.setCursorBufferPosition([1, 5]);
        expect(getNodeAtCursor(editor).text).toBe('bar');

        Combobulate.selectCurrentFunction();

        const range = editor.getLastSelection().getBufferRange();
        expect(
          range.isEqual([
            [1, 4],
            [3, 5],
          ]),
        ).toBe(true);
      });

      it('selects from cursor inside method', async () => {
        await setText(
          editor,
          dedent`
                class Foo {
                    bar() {
                        const a = 1;
                    }
                }
            `,
        );
        // just inside `const`
        editor.setCursorBufferPosition([2, 9]);
        expect(getNodeAtCursor(editor).text).toBe('const');

        Combobulate.selectCurrentFunction();

        const range = editor.getLastSelection().getBufferRange();
        expect(
          range.isEqual([
            [1, 4],
            [3, 5],
          ]),
        ).toBe(true);
      });

      it('selects from selection inside method', async () => {
        await setText(
          editor,
          dedent`
                class Foo {
                    bar() {
                        const a = 1;
                    }
                }
            `,
        );
        // any "unbalanced" selection; spans nodes, but not inclusively
        editor.setSelectedBufferRange([
          [2, 11],
          [2, 17],
        ]);
        expect(editor.getSelectedText()).toBe('st a =');

        Combobulate.selectCurrentFunction();

        const range = editor.getLastSelection().getBufferRange();
        expect(
          range.isEqual([
            [1, 4],
            [3, 5],
          ]),
        ).toBe(true);
      });
    });
  });

  describe('multiple cursors', () => {
    describe('sibling nodes', () => {
      it('places cursors at next siblings', async () => {
        await setText(editor, '[1, 2, 3];');
        editor.setCursorBufferPosition([0, 1]);

        expect(getNodeAtCursor(editor).text).toBe('1');

        // call once to add cursor
        Combobulate.addCursorToNextSibling();

        let cursors = editor.getCursors();
        expect(cursors.length).toBe(2);
        expect(cursors[0].getBufferColumn()).toBe(1);
        expect(cursors[1].getBufferColumn()).toBe(4);

        // call again to add another cursor
        Combobulate.addCursorToNextSibling();

        cursors = editor.getCursors();
        expect(cursors.length).toBe(3);
        expect(cursors[0].getBufferColumn()).toBe(1);
        expect(cursors[1].getBufferColumn()).toBe(4);
        expect(cursors[2].getBufferColumn()).toBe(7);

        // call one more time, no changes
        Combobulate.addCursorToNextSibling();

        cursors = editor.getCursors();
        expect(cursors.length).toBe(3);
        expect(cursors[0].getBufferColumn()).toBe(1);
        expect(cursors[1].getBufferColumn()).toBe(4);
        expect(cursors[2].getBufferColumn()).toBe(7);
      });

      it('places cursors at previous siblings', async () => {
        await setText(editor, '[1, 2, 3];');
        editor.setCursorBufferPosition([0, 7]);

        expect(getNodeAtCursor(editor).text).toBe('3');

        // call once to add cursor
        Combobulate.addCursorToPreviousSibling();

        let cursors = editor.getCursors();
        expect(cursors.length).toBe(2);
        expect(cursors[0].getBufferColumn()).toBe(7);
        expect(cursors[1].getBufferColumn()).toBe(4);

        // call again to add another cursor
        Combobulate.addCursorToPreviousSibling();

        cursors = editor.getCursors();
        expect(cursors.length).toBe(3);
        expect(cursors[0].getBufferColumn()).toBe(7);
        expect(cursors[1].getBufferColumn()).toBe(4);
        expect(cursors[2].getBufferColumn()).toBe(1);

        // call one more time, no changes
        Combobulate.addCursorToPreviousSibling();

        cursors = editor.getCursors();
        expect(cursors.length).toBe(3);
        expect(cursors[0].getBufferColumn()).toBe(7);
        expect(cursors[1].getBufferColumn()).toBe(4);
        expect(cursors[2].getBufferColumn()).toBe(1);
      });

      it('places cursors at all siblings', async () => {
        await setText(editor, '[1, 2, 3];');
        editor.setCursorBufferPosition([0, 1]);

        expect(getNodeAtCursor(editor).text).toBe('1');

        Combobulate.addCursorToAllSiblings();

        const cursors = editor.getCursors();
        expect(cursors.length).toBe(3);
        expect(cursors[0].getBufferColumn()).toBe(1);
        expect(cursors[1].getBufferColumn()).toBe(4);
        expect(cursors[2].getBufferColumn()).toBe(7);

        // just a sanity check
        expect(cursors[0].getBufferRow()).toBe(0);
        expect(cursors[1].getBufferRow()).toBe(0);
        expect(cursors[2].getBufferRow()).toBe(0);
      });

      it('traverses injected siblings', async () => {
        // By default, getSyntaxNodeAtPosition() will return a node in an
        // injected grammar if one exists. Make sure that we handle that.
        await setText(
          editor,
          dedent`
            function foo() {}
            /** @return void */
            function bar() {}
        `,
        );
        editor.setCursorBufferPosition([0, 0]);
        expect(getNodeAtCursor(editor).text).toBe('function');

        Combobulate.addCursorToNextSibling();

        // NB This ensures that the injections are loaded and ready, because
        // that's the whole point of this test.  If this assertion fails with
        // `type === comment`, then the injections haven't loaded and the test
        // would otherwise pass as a false positive. This seems to be the case
        // when this test is run by itself, but doesn't seem to be an issue when
        // run with other tests.
        //
        // Now, having said that, and have just put this in place, I can no
        // longer reproduce the issue when running this test in isolation.
        // Perhaps the other code changes in Combobulate nudged things enough to
        // "fix" it. ¯\_(ツ)_/¯
        expect(getNodeAtCursor(editor).type).toBe('document');

        Combobulate.addCursorToNextSibling();

        cursors = editor.getCursors();
        expect(cursors.length).toBe(3);
        expect(cursors[0].getBufferRow()).toBe(0);
        expect(cursors[1].getBufferRow()).toBe(1);
        expect(cursors[2].getBufferRow()).toBe(2);

        expect(cursors[0].getBufferColumn()).toBe(0);
        expect(cursors[1].getBufferColumn()).toBe(0);
        expect(cursors[2].getBufferColumn()).toBe(0);
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
