/**
 * Remove all children. Usefull method found at MDN:
 * https://developer.mozilla.org/en-US/docs/Web/API/Node#Remove_all_children_nested_within_a_node
 */
Element.prototype.removeAll = function() {
  while (this.firstChild) {
    this.removeChild(this.firstChild);
  }
  return this;
}

/*
 * Some utility functions for dealing with iterators of "cells"
 */
function *filter(iter, fn) {
  for (let item of iter) {
    if (fn(item)) {
      yield item;
    }
  }
}

function ne(row, col) {
  return (l) => (l[0] !== row || l[1] !== col);
}

function *transpose(iter) {
  for (let [row, col] of iter)
    yield [col, row];
}

function *map(iter, f) {
  for (let x of iter)
    yield f(x);
}

function any(iter, fn) {
  for (let x of iter)
    if (fn(x))
      return true;
  return false;
}

function emap(iter, f) {
  for (let x of iter) {
    f(x);
  }
}

const SOLVERS = [];

/**
 * A Sudoku game display. It is responsible for creating and updating games,
 * managing solvers, handling user-input, and of course, displaying the game to
 * some UI. Hypothetically, we could swap this out with an implementation for
 * CLI :)
 */
class Display {
  /**
   * Create a new display.
   * @param {number} degree The base size of the game (2 -> 4x4, 3 -> 9x9, etc)
   * @param {*} id Prefix for all the element IDs used
   */
  constructor(degree, id) {
    let self = this;
    this.table = document.getElementById(id + "-table");
    this.jsonText = document.getElementById(id + "-json-text");
    this.load = document.getElementById(id + "-load");
    this.step = document.getElementById(id + "-step");

    this.degree = degree;
    this.grid = []
    this.game = null;
    this.solvers = [];

    this.table.removeAll();
    this.load.onclick = () => self.loadGame();
    this.step.onclick = () => self.doStep();
    this.initCells();
  }

  /**
   * Initialize the table which actually contains the sudoku cells.
   */
  initCells() {
    for (let rowIdx = 0; rowIdx < this.degree * this.degree; rowIdx++) {
      let row = this.table.insertRow();
      this.grid.push([]);
      for (let colIdx = 0; colIdx < this.degree * this.degree; colIdx++) {
        let cell = row.insertCell();
        this.grid[rowIdx].push(cell);
        cell.classList.add("sudoku-cell");

        // add sudoku-top, sudoku-bottom, sudoku-left, sudoku-right CSS classes
        function setEdgeClasses(idx, degree, firstSuffix, lastSuffix) {
          if (idx % degree === 0)
            cell.classList.add("sudoku-" + firstSuffix);
          else if (idx % degree === degree - 1)
            cell.classList.add("sudoku-" + lastSuffix);
        }
        setEdgeClasses(rowIdx, this.degree, "top", "bottom");
        setEdgeClasses(colIdx, this.degree, "left", "right");
      }
    }
  }

  /**
   * When the "Load" button is pressed, read the JSON blob and pull out cell
   * values, and start up a game!
   */
  loadGame() {
    // Create an empty game object and update the possibilities display
    this.game = new Sudoku(this.degree);
    this.solvers = [];
    for (let Ctor of SOLVERS)
      this.solvers.push(new Ctor(this.game))
    for (let [row, col] of this.game.iterAll())
      // it says handleRemovePossibility() but really it will just display any
      // possibility array
      this.handleRemovePossibility(row, col, this.game.poss[row][col]);

    // Connect our event handler to deal with further UI updates from loading
    // the game data
    this.game.addHandler("display", (evt) => this.handler(evt));

    // And load the data
    const puzzle = JSON.parse(this.jsonText.value);
    for (let square of puzzle.squares)
      this.game.setDigit(square.y, square.x, square.value);
  }

  /**
   * Handle a game event by updating the UI
   * @param {object} event 
   */
  handler(event) {
    console.log(event)
    if (event.event === "setDigit")
      this.handleSetDigit(event.row, event.col, event.digit);
    else if (event.event == "removePossibility")
      this.handleRemovePossibility(
        event.row, event.col, this.game.poss[event.row][event.col]);
  }

  handleSetDigit(row, col, digit) {
    this.grid[row][col].removeAll();
    this.grid[row][col].textContent = digit;
  }

  handleRemovePossibility(rowIdx, colIdx, possibilities) {
    const cell = this.grid[rowIdx][colIdx];
    cell.removeAll();
    const table = document.createElement("table");
    table.classList.add("sudoku-possibility-table");
    cell.appendChild(table);
    let digit = 1;
    for (let r = 0; r < this.degree; r++) {
      let row = table.insertRow();
      for (let c = 0; c < this.degree; c++) {
        let possibilityCell = row.insertCell();
        possibilityCell.classList.add("sudoku-possibility");
        if (possibilities[digit]) {
          possibilityCell.textContent = digit.toString();
        }
        digit++;
      }
    }
  }

  doStep() {
    console.log("Doing a step...")
    for (let solver of this.solvers) {
      for (let move of solver.generateMoves()) {
        console.log("Got move!")
        this.game.applyMove(move);
        return;
      }
    }
    console.log("Needs more work.");
  }
}

class Sudoku {
  constructor(degree, display, cells) {
    this.degree = degree;
    this.handlers = new Map();
    this.initPossibilities();
    this.initValues();
  }

  /*
   * Initialize the "value" matrix. This is a 2d array which maps row, col to
   * the actual value of the cell. 0 is used as the placeholder "empty" value.
   */
  initValues() {
    this.val = [];
    for (let row = 0; row < this.degree * this.degree; row++) {
      this.val.push([]);
      for (let col = 0; col < this.degree * this.degree; col++) {
        this.val[row].push(0);
      }
    }
  }

  /**
   * Initialize the "possibility" matrix. This is a 3d array indexed by:
   *  - first, the row index
   *  - second, the column index
   *  - finally, the digit (we include 0 for padding)
   *
   * If this.poss[row][col][5] is true, then a 5 may exist at row, col.
   *
   * This function initializes the possibility to all true, so that digits may
   * be entered into the game.
   */
  initPossibilities() {
    this.poss = [];
    for (let row = 0; row < this.degree * this.degree; row++) {
      this.poss.push([]);
      for (let col = 0; col < this.degree * this.degree; col++) {
        this.poss[row].push([]);
        for (let digit = 0; digit < this.degree * this.degree + 1; digit++) {
          this.poss[row][col].push(true);
        }
      }
    }
  }

  /**
   * Enter a digit into a cell.
   */
  setDigit(row, col, digit) {
    /* 1. set cell value and update display */
    console.log(`Set (${row}, ${col}) to ${digit}.`);
    this.val[row][col] = digit;
    this.sendEvent({
      event: "setDigit",
      row: row, col: col, digit: digit
    });

    /* 2. update possibilities for this cell. This is bookkeeping to simplify
     * calling code. We don't create events for this. */
    this.poss[row][col][digit] = true;
    for (let digitToClear of this.iterOtherDigits(digit)) {
      this.poss[row][col][digitToClear] = false;
    }

    /* 3. remove digit from row, col, block possibilities */
    const clearIt = this.digitClearer(digit);
    emap(this.iterOthersInRow(row, col), clearIt);
    emap(this.iterOthersInCol(row, col), clearIt);
    emap(this.iterOthersInBlock(row, col), clearIt);
  }

  removePossibility(row, col, digit) {
    if (this.poss[row][col][digit]) {
      this.poss[row][col][digit] = false;
      this.sendEvent({
        event: "removePossibility",
        row: row, col: col, digit: digit
      });
    }
  }

  sendEvent(event) {
    for (let [id, handler] of this.handlers) {
      handler(event);
    }
  }

  addHandler(id, hdlr) {
    this.handlers.set(id, hdlr);
  }

  applyMove(event) {
    switch (event.event) {
      case "setDigit":
        this.setDigit(event.row, event.col, event.digit);
        break;
      case "removePossibility":
        this.removePossibility(event.row, event.col, event.digit);
        break;
    }
  }

  /**
   * A function which will return true if the digit is possible for a cell.
   */
  digitChecker(digit) {
    return (cell) => {
      let [r, c] = cell;
      if (this.poss[r][c][digit])
        return true;
      return false;
    }
  }

  /**
   * Return a function of (row, col) which will set digit to impossible, and
   * update the event handlers (if necessary).
   */
  digitClearer(digit) {
    return (cell) => {
      let [r, c] = cell;
      this.removePossibility(r, c, digit);
    }
  }

  *iterRow(row) {
    for (let col = 0; col < this.degree * this.degree; col++)
      yield [row, col];
  }

  *iterCol(col) {
    yield *transpose(this.iterRow(col));
  }

  *iterBlock(row, col) {
    let topRow = Math.floor(row / this.degree) * this.degree;
    let leftCol = Math.floor(col / this.degree) * this.degree;

    for (let rowRv = topRow; rowRv < topRow + this.degree; rowRv++) {
      for (let colRv = leftCol; colRv < leftCol + this.degree; colRv++) {
        yield [rowRv, colRv];
      }
    }
  }

  *iterOthersInRow(row, col) {
    yield *filter(this.iterRow(row), ne(row, col));
  }

  *iterOthersInCol(row, col) {
    yield *filter(this.iterCol(col), ne(row, col));
  }

  *iterOthersInBlock(row, col) {
    yield *filter(this.iterBlock(row, col), ne(row, col));
  }

  *iterAll(row, col) {
    for (let row = 0; row < this.degree * this.degree; row++)
      for (let col = 0; col < this.degree * this.degree; col++)
        yield [row, col];
  }

  *iterDigits() {
    for (let digit = 1; digit < this.degree * this.degree + 1; digit++)
      yield digit;
  }

  *iterOtherDigits(d) {
    yield *filter(this.iterDigits(), (x) => x !== d);
  }
}

class ObviousSolver {
  constructor(game) {
    this.game = game;
  }

  /**
   * Return a list of the obvious moves:
   * (a) the only thing that can be done with a cell
   * (b) there is only one cell which can be digit in a row/col/block
   */
  *generateMoves() {
    for (let [r, c] of this.game.iterAll()) {
      if (this.game.val[r][c] !== 0)
        continue;

      let possibleDigits = []
      for (let d of this.game.iterDigits()) {
        if (this.game.poss[r][c][d]) {
          possibleDigits.push(d);
        }
      }

      if (possibleDigits.length === 1) {
        let msg = "This was the only digit it could be!"
        console.log(`Yield move (${r}, ${c}) = ${possibleDigits[0]} (${msg})`);
        yield {
          "event": "setDigit", "row": r, "col": c,
          "digit": possibleDigits[0], "help": msg};
        continue;
      }

      for (let d of possibleDigits) {
        let checker = this.game.digitChecker(d);
        let domains = [];
        if (!any(this.game.iterOthersInRow(r, c), checker))
          domains.push("row");
        if (!any(this.game.iterOthersInCol(r, c), checker))
          domains.push("column");
        if (!any(this.game.iterOthersInBlock(r, c), checker))
          domains.push("block");
        if (domains.length > 0) {
          let msg = `In the ${domains.join("+")}, only this cell could hold ${d}`
          console.log(`Yield move (${r}, ${c}) = ${d} (${msg})`);
          yield {
            "event": "setDigit", "row": r, "col": c, "digit": d, "help": msg
          }
        }
      }
    }
  }
}

SOLVERS.push(ObviousSolver);
const disp = new Display(3, "sudoku");