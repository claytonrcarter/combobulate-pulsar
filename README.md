# Combobulate, for Pulsar

Structural navigation and editing in Pulsar, powered by tree-sitter.

Inspired by https://github.com/mickeynp/combobulate, for Emacs.

## Introduction

Flexing the syntax awareness and robust parsing provided by tree-sitter,
Combobulate allows for things like:

- move between "sibling" nodes: hop from one function parameter to the next, or
  between function or method declarations
- add cursors to "sibling" nodes: 
- move up or down the syntax tree: eg from variable declaration, to a loop, to a
  method body, to the method declaration, etc.
- swap nodes: walk or drag an array element forward or backward in a list, or
  move an entire function up or down in a file
- select nodes: eg the current, previous or next syntax nodes; or the current
  function declaration

Many of these features exist in Pulsar for words, selections or lines, and
Combobulate aims to extend common patterns of movement and editing to logical
syntax nodes in your code.

### Status

This is still very much experimental. Bugs exist; edge cases aren't all handled;
he UX hasn't been hammered out and behavior will probably change; command names
will probably change; etc.

### Goals

- Provide commands to complement and supplement those already in Pulsar.
- Provide enough commands and "building blocks" to support common usage and
  custom scripting.
- To resist the urge to add an exhaustive suite of commands and "building
  blocks" just because we can. _This will probably be hard,_ because there's a
  lot that we could do!

### tree-sitter?

For a more on what tree-sitter is or what it gives us, check out:

- The blog post for [the Emacs that package that inspired this
  package](https://www.masteringemacs.org/article/combobulate-structured-movement-editing-treesitter).
  - An excellent series of blog posts [about tree-sitter and what is means for
    Pulsar](https://pulsar-edit.dev/tag/tree-sitter/)

## Keybindings

No keybindings are installed or provided by default, but we do offer some suggestions.

Out of the box, Pulsar only offers 2 tree-sitter powered navigation functions:
`editor:select-larger-syntax-node` and `editor:select-smaller-syntax-node`, and
these are bound to `alt-up` and `alt-down`, by default. But wait! Doesn't
`shift` normally select things? And how do you add cursors to the line
above/below? Well, that's `ctrl-shift-up/down`. OK, let's bring some order to
this:

```cson
# ~/.pulsar/keymap.cson

'atom-workspace atom-text-editor:not([mini])':
  'ctrl-up': 'combobulate:move-to-larger-syntax-node'
  'ctrl-down': 'combobulate:move-to-smaller-syntax-node'
  'crtl-shift-up': 'editor:select-larger-syntax-node'
  'crtl-shift-down': 'editor:select-smaller-syntax-node'

  'ctrl-left': 'combobulate:move-to-previous-sibling'
  'ctrl-right': 'combobulate:move-to-next-sibling'
  'ctrl-shift-left': 'combobulate:add-cursor-to-previous-sibling'
  'ctrl-shift-right': 'combobulate:add-cursor-to-next-sibling'
  'ctrl-cmd-shift-left': 'combobulate:transpose-with-previous-sibling'
  'ctrl-cmd-shift-right': 'combobulate:transpose-with-next-sibling'
  # 'ctrl-cmd-d': 'combobulate:select-node'
  # 'ctrl-cmd-t': 'combobulate:transpose-nodes'
```

Note that this changes a few default key bindings:

- `editor:select-(larger|smaller)-syntax-node` is added to `ctrl-shift-(up|down)`
- `pane:move-item-(left|right)` is shadowed by `ctrl-shift-(left|right)`
