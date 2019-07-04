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

/**
 * Similar to Python's dict.get() method, providing a default if the key is not
 * present in the map.
 */
Map.prototype.getOr = function(key, orElse) {
  if (this.has(key)) {
    return this.get(key);
  } else {
    return orElse;
  }
}

/**
 * Helper to return the first item in an iterable
 */
function first(iter) {
  for (let val of iter)
    return val;
}

/*
 * Generic filter function for iterators. Return elements of iter where
 * fn(element) is truthy.
 */
function *filter(iter, fn) {
  for (let item of iter) {
    if (fn(item)) {
      yield item;
    }
  }
}

/**
 * "Not equal" function for cell tuples
 */
function ne(row, col) {
  return (l) => (l[0] !== row || l[1] !== col);
}

/**
 * Given an iterator of cell tuples, yield transposed tuples (i.e. the row and
 * column are swapped).
 */
function *transpose(iter) {
  for (let [row, col] of iter)
    yield [col, row];
}

/**
 * Map a function over an iterable, lazily
 */
function *map(iter, f) {
  for (let x of iter)
    yield f(x);
}

/**
 * Return true if any element of iter satisfies the condition specified by fn.
 */
function any(iter, fn) {
  for (let x of iter)
    if (fn(x))
      return true;
  return false;
}

/**
 * Map a function over an iterator, and exhaust the iterator. This doesn't
 * return the result. Maybe it would be better named foreach.
 */
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
    this.updateButton = document.getElementById(id + "-update");
    this.solverIndicators = document.getElementById(id + "-solver-indicators");
    this.output = document.getElementById(id + "-output");

    this.degree = degree;
    this.grid = []
    this.game = null;
    this.possVisible = false;
    this.updateButton.classList.add("hidden");
    this.solverIndicators.classList.add("hidden");

    this.table.removeAll();
    this.load.onclick = () => self.loadGame();
    this.step.onclick = () => self.doStep();
    this.updateButton.onclick = () => self.doUpdate();

    this.initCells();
    this.initSolvers();
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

  initSolvers() {
    this.solvers = new Map();
    this.solverToButton = new Map();
    this.solverToMoves = new Map();
    this.solverIndicators.removeAll();
    for (let cls of SOLVERS) {
      this.solvers.set(cls.name, new cls(this.game));
      let btn = document.createElement('button');
      btn.innerText = `${cls.name}: ??`;
      btn.onclick = () => this.doIndicatorClick(cls.name);
      this.solverIndicators.appendChild(btn);
      this.solverToButton.set(cls.name, btn);
    }
  }

  /**
   * When the "Load" button is pressed, read the JSON blob and pull out cell
   * values, and start up a game!
   */
  loadGame() {
    // Create an empty game object and update the possibilities display
    this.game = new Sudoku(this.degree);
    if (this.possVisible)
      this.toggleVisibility();
    this.initSolvers();
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

    this.output.value = "";
  }

  print(msg) {
    this.output.value = msg + '\n' + this.output.value;
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
    else if (event.event == "initiateGuess")
      this.handleInitiateGuess(event);
    else if (event.event == "changeGuess")
      this.handleChangeGuess(event);
  }

  handleInitiateGuess(event) {
    this.print(event.help);
  }

  handleChangeGuess(event) {
    this.print(event.help);
    this.changeHintHighlight(event.row, event.col);
    for (let [row, col] of this.game.iterAll()) {
      if (this.game.values[row][col] != 0)
        this.handleSetDigit(row, col, this.game.values[row][col]);
      else
        this.handleRemovePossibility(row, col, this.game.poss[row][col])
    }
  }

  handleSetDigit(row, col, digit) {
    this.grid[row][col].removeAll();
    this.grid[row][col].textContent = digit;
    this.grid[row][col].classList.remove("hidden");
  }

  handleRemovePossibility(rowIdx, colIdx, possibilities) {
    const cell = this.grid[rowIdx][colIdx];
    cell.removeAll();
    if (!this.possVisible)
      cell.classList.add("hidden");
    const table = document.createElement("table");
    table.classList.add("sudoku-possoibility-table");
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

  changeHintHighlight(row, col) {
    if (this.hint !== undefined) {
      let [row, col] = this.hint;
      this.grid[row][col].classList.remove("sudoku-highlight");
    }
    if (row !== undefined) {
      this.grid[row][col].classList.add("sudoku-highlight");
      this.hint = [row, col];
    }
  }

  applyMove(event) {
    this.changeHintHighlight(event.row, event.col);

    if (event.help !== undefined) {
      this.print(event.help);
    }

    this.game.applyMove(event);
    this.solverToMoves.clear();
    for (let [name, btn] of this.solverToButton.entries()) {
      btn.innerText = `${name}: ??`;
    }
  }

  doUpdate() {
    console.log("Running update");
    for (let [name, solver] of this.solvers.entries()) {
      let moves = Array.from(solver.generateMoves())
      this.solverToMoves.set(name, moves);
      this.solverToButton.get(name).innerText = `${name}: ${moves.length}`
    }
  }

  doIndicatorClick(name) {
    console.log(`Indicator for ${name} clicked`);
    const moves = this.solverToMoves.getOr(name, []);
    let move;
    if (moves.length > 0) {
      console.log("Had a cached move");
      move = moves[0];
    } else {
      console.log("No cached moves, trying to get a move from the solver");
      move = first(this.solvers.get(name).generateMoves());
    }
    if (move !== undefined)
      this.applyMove(move);
    else
      this.print(`Sorry, ${name} has no moves at the moment.`);
  }

  doStep() {
    if (!this.possVisible) {
      this.print("Revealing all the possibilities.")
      this.toggleVisibility();
      return;
    }
    console.log("Doing a step...")
    for (let [name, moveList] of this.solverToMoves.entries()) {
      for (let move of moveList) {
        console.log(`Used cached move from ${name}!`);
        this.applyMove(move);
        return;
      }
    }
    for (let [name, solver] of this.solvers.entries()) {
      for (let move of solver.generateMoves()) {
        console.log(`Got a move from ${name}!`);
        this.applyMove(move);
        return;
      }
    }
    console.log("Needs more work.");
    this.print(`Sorry, no solvers have any moves at the moment.`);
  }

  toggleVisibility() {
    this.possVisible = !this.possVisible;
    for (let [row, col] of this.game.iterAll()) {
      if (this.game.val[row][col] == 0)
        this.grid[row][col].classList.toggle('hidden');
    }
    this.updateButton.classList.toggle("hidden");
    this.solverIndicators.classList.toggle("hidden");
    if (this.possVisible) {
      this.showButton.innerText = "Hide";
    } else {
      this.showButton.innerText = "Reveal";
    }
  }
}

class Sudoku {
  constructor(degree, display, cells) {
    this.degree = degree;
    this.handlers = new Map();
    this.initPossibilities();
    this.initValues();
    this.guesses = [];
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
    let self=this;
    if (!any(this.iterOtherDigits(digit), (x) => self.poss[row][col][x]))
      this.change = true;
  }

  /**
   * Guessing allows us to copy the game state and try guessing a particular
   * solution for a cell. If the result gets us to a situation which is
   * unsolvable, we can roll back the guess to the next possibility.
   * 
   * Once initiated, guesses work as follows. Incorrect guesses always involve
   * a cell ending up with 0 possibilities after you set a digit (or possibly
   * remove possibilities). When this happens, applyMove will call changeGuess()
   * move to the next guess.
   */
  initiateGuess(row, col, digit) {
    // Figure out what else this cell could be so we know what else to guess in
    // case this goes wrong.
    let remaining = [];
    for (let poss in this.iterOtherDigits(digit))
      remaining.push(poss);

    this.guesses.push({
      "row": row,
      "col": col,
      "guessed": digit,
      "remaining": remaining,
      "values": JSON.stringify(this.values),
      "poss": JSON.stringify(this.poss)
    });

    this.sendEvent({
      "event": "initiateGuess",
      "row": row, "col": col, "digit": digit,
      "help": `Starting a guess that (${row}, ${col}) is ${digit}`
    })
    this.setDigit(row, col, digit);
  }

  changeGuess() {
    if (this.guesses.length <= 0)
      console.log("OOPS - rolled back when there are no guesses");

    const guess = this.guesses.pop();
    const oldGuess = guess.guessed;

    if (guess.remaining.length <= 0)
      console.log("OOPS - no more remaining choices in our guess");

    guess.guessed = guess.remaining.shift();
    this.values = JSON.parse(guess.values);
    this.poss = JSON.parse(guess.values);
    this.setDigit(guess.guessed);
    this.guesses.push(guess);
    this.sendEvent({
      "event": "changeGuess",
      "row": guess.row, "col": guess.col, "digit": guess.guessed,
      "help": `The previous guess of ${oldGuess} for (${guess.row}, ${guess.col}) was incorrect, trying ${guess.guessed}`,
    })
    this.change = false;
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
      case "initiateGuess":
        this.initiateGuess(event.row, event.col, event.digit);
        break;
      case "changeGuess":
        this.changeGuess();
        break;
    }
    if (this.change)
      this.changeGuess();
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

  /**
   * Iterate over the top left corner of each block in the game.
   */
  *iterBlocks() {
    for (let row = 0; row < this.degree; row++) {
      for (let col = 0; col < this.degree; col++) {
        yield [row * this.degree, col * this.degree];
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

/**
 * The ObviousSolver looks for cell which either can only be one value, or
 * cells which are the only possible instance of a value in their row, column,
 * or block.
 */
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
        let msg = `${possibleDigits[0]} was the only digit this cell could be!`
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

/**
 * The OnlyColRowSolver looks for blocks where a digit is possible only in one
 * row, or only one column. When that is the case, all other cells in that row
 * or column (outside the block) may not be the digit.
 *
 * Graphically, let X denote a cell which may be a digit, O denote a cell which
 * cannot. We aim to detect the following:
 * 
 *     |X0X|00X|XX0|
 *     |0XX|X00|000|
 *     |0X0|XX0|000|
 *     +---+---+---+
 * 
 * In the above example, the rightmost block can have the digit in only the top
 * row, and so the middle and left block must not have the X in that row. So we
 * can translate the above situation into:
 *
 *     |000|000|XX0|
 *     |0XX|X00|000|
 *     |0X0|XX0|000|
 *     +---+---+---+
 */
class OnlyColRowSolver {
  constructor(game) {
    this.game = game;
  }

  *generateMoves() {
    for (let [tlRow, tlCol] of this.game.iterBlocks()) {
      // First, we need to find out whether there are any digits which are only
      // possible in one row. The condition for this is that the possible count
      // must be greater than 1 (otherwise, we should probably just set that
      // cell's digit), and either the row count or column count should be 0.
      const digitToCount = new Map();
      const digitToRows = new Map();
      const digitToCols = new Map();
      for (let [r, c] of this.game.iterBlock(tlRow, tlCol)) {
        for (let d of this.game.iterDigits()) {
          if (!this.game.poss[r][c][d])
            continue;
          digitToCount.set(d, 1 + digitToCount.getOr(d, 0));

          let rows = digitToRows.getOr(d, new Set());
          rows.add(r);
          digitToRows.set(d, rows);

          let cols = digitToCols.getOr(d, new Set());
          cols.add(c);
          digitToCols.set(d, cols);
        }
      }

      // Now, for any digit which satisfies the above condition, we "clear" any
      // other cell in the row/col which is also possible for this digit.
      const degree = this.game.degree;
      function notInBlock(cell) {
        let [r, c] = cell;
        return (r < tlRow) || (r >= tlRow+degree) || (c < tlCol) || (c >= tlCol+degree);
      }
      const game = this.game;
      function *clearDigitFromGroup(digit, group, type) {
        for (let [r, c] of filter(group, notInBlock)) {
          if (game.poss[r][c][digit]) {
            console.log(`Remove possibility of digit ${digit} from (${r}, ${c})`)
            yield {
              "event": "removePossibility",
              "row": r, "col": c, "digit": digit,
              "help": `${digit} is not possible since others in its ${type} are the only ${digit} in their block`
            };
          }
        }
      }
      for (let d of this.game.iterDigits()) {
        if (digitToCount.get(d) <= 1)
          continue;
        if (digitToRows.get(d).size == 1) {
          console.log(`In block (${tlRow}, ${tlCol}), digit ${d} is present only in one row!`);
          yield *clearDigitFromGroup(d, this.game.iterRow(first(digitToRows.get(d))), "row");
        }
        if (digitToCols.get(d).size == 1) {
          console.log(`In block (${tlRow}, ${tlCol}), digit ${d} is present only in one col!`);
          yield *clearDigitFromGroup(d, this.game.iterCol(first(digitToCols.get(d))), "column");
        }
      }
    }
  }
}

class FirstCellGuesser {
  constructor(game) {
    this.game = game;
  }

  *generateMoves() {
    for (let [row, col] of this.game.iterAll()) {
      let possible = Array.from(filter(this.game.iterDigits(), (x) => this.game.poss[row][col][x]));
      if (possible.length > 1)
      yield {
        "event": "initiateGuess",
        "row": row, "col": col, "digit": possible[0],
        "help": "Randomly guessing the first guessable cell."
      }
    }
  }
}

SOLVERS.push(ObviousSolver);
SOLVERS.push(OnlyColRowSolver);
SOLVERS.push(FirstCellGuesser);
const disp = new Display(3, "sudoku");