sudoku
======

This project is meant to allow interactively working through a sudoku puzzle
with a custom solver algorithm, so that a user can watch each step the solver
takes and understand why.

We have three components here, with different "interfaces":

1. Sudoku class. This holds the whole game state and allows it to be updated
   by the other components. It also contains lots of useful generator-based
   functions for iterating over game cells, which are useful for the other
   components.
2. Solver class. This guy simply takes a game and produces a list of moves to
   make. It should not directly edit the game, simply yield events which can be
   applied to the game.
3. Display class. This owns a reference to the game and any solvers which we
   want to use. It sets game event handlers and updates the display when things
   change. It also allows the user to make changes to the game state, or request
   a new move from a solver.

Sudoku methods
--------------
* `constructor(degree)`: return new instance of that degree
* `setDigit(row, column, digit)`
  - Sets the digit at row and column, raises an error if it was already set.
  - Updates the possibilities of its row + column + block to adjust for the new
    digit. If this results in a cell having empty possibilities, errors.
  - Corresponds to `setDigit` event.
* `erasePossibility(row, column, digit)`
  - Mark that `digit` isn't possible at row, column.
  - Corresponds to `erasePossibility` event.
* `addHandler(id, fn)`
  - Add `fn` as a handler for game events, using `id` as a name.
  - Use `removeHandler()` to unregister.
  - Handlers receive events, which are objects having a field `event` which
    contains an event name, as well as other fields corresponding to the args
    for that event type. EG `setDigit` events look like:
        {
            "event": "setDigit",
            "row": 0,
            "column": 5,
            "digit": 3
        }
* `removeHandler(id)` - remove handler with given id

Attributes:
* `degree`: degree of the game
* `val`: 2D row,column indexed value array
* `poss`: 3D row,column,digit indexed boolean array of possibilities
* must *never* be modified except via methods!

Events:
* Event handling by solvers & displays should not modify (or call any methods
  which modify) the game. 
* Solvers will be called by the display when a new solution is requested.