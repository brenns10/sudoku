/*
 * Remove all children. Usefull method found at MDN:
 * https://developer.mozilla.org/en-US/docs/Web/API/Node#Remove_all_children_nested_within_a_node
 */
Element.prototype.removeAll = function() {
  while (this.firstChild) {
    this.removeChild(this.firstChild);
  }
  return this;
}

/* an easy default game to play */
default_cells = [
  [0, 2, 7],
  [0, 3, 4],
  [1, 0, 1],
  [1, 8, 7],
  [2, 3, 9],
  [2, 7, 8],
  [3, 7, 9],
  [3, 8, 8],
  [4, 1, 4],
  [4, 4, 6],
  [4, 5, 5],
  [4, 7, 3],
  [5, 0, 3],
  [5, 2, 8],
  [5, 4, 2],
  [6, 0, 4],
  [7, 0, 2],
  [7, 3, 5],
  [7, 6, 3],
  [8, 2, 1],
  [8, 3, 7],
  [8, 5, 3],
  [8, 7, 5]
]


/**
 * Contains all display logic.
 *
 * Hypothetically, we could swap this out with an implementation for CLI.
 */
class SudokuDisplay {
  constructor(degree, id) {
    this.table = document.getElementById(id);
    this.table.removeAll();
    this.degree = degree;
    this.grid = []

    for (let rowIdx = 0; rowIdx < this.degree * this.degree; rowIdx++) {
      let row = this.table.insertRow();
      this.grid.push([]);
      for (let colIdx = 0; colIdx < this.degree * this.degree; colIdx++) {
        let cell = row.insertCell();
        this.grid[rowIdx].push(cell);
        cell.classList.add("sudoku-cell");

        // add sudoku-top, sudoku-bottom, sudoku-left, sudoku-right
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

  setCellValue(rowIdx, colIdx, value) {
    this.grid[rowIdx][colIdx].textContent = value;
  }

  setCellPossibilities(rowIdx, colIdx, possibilities) {
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
}

class Sudoku {
  constructor(degree, display, cells) {
    this.degree = degree;
    this.display = display;
    this.initPossibilities();
    this.initValues();

    if (cells.length === 0) {
      cells = default_cells;
    }
    this.applyMoves(cells);
  }

  /**
   * Return a list of the obvious moves:
   * (a) the only thing that can be done with a cell
   * (b) there is only one cell which can be digit in a row/col/block
   */
  findObviousMoves() {
    let moves = [];
    for (let [r, c] of this.iterAll()) {
      if (this.val[r][c] !== 0)
        continue;

      let possibleDigits = []
      for (let d of this.iterDigits()) {
        if (this.poss[r][c][d]) {
          possibleDigits.push(d);
        }
      }

      if (possibleDigits.length === 1) {
        moves.push([r, c, possibleDigits[0], "this was the only option for this cell"]);
        console.log('Add move (' + r + ', ' + c + ') = ' + possibleDigits[0] + ' (only option)');
        continue;
      }

      for (let d of possibleDigits) {
        let checker = this.digitChecker(d);
        let msg = "this digit was only possible here for this:"
        let rowPoss = this.any(this.iterOthersInRow(r, c), checker);
        if (!rowPoss) msg += " row";
        let colPoss = this.any(this.iterOthersInCol(r, c), checker);
        if (!colPoss) msg += " col";
        let blockPoss = this.any(this.iterOthersInBlock(r, c), checker);
        if (!blockPoss) msg += " block";
        if (!rowPoss || !colPoss || !blockPoss) {
          moves.push([r, c, d, msg])
          console.log('Add move (' + r + ', ' + c + ') = ' + d + ' ' + msg);
        }
      }
    }
    return moves;
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
   * Given an array of moves [[r, c, d, optional message], ...],
   * apply them!
   */
  applyMoves(moves) {
    for (let cell of moves) {
      this.setCellValue(cell[0], cell[1], cell[2]);
    }
  }

  /**
   * Enter a digit into a cell. Performs the following tasks:
   * 1. set the cell value (update display)
   * 2. clear all possibilities but "digit" for that cell
   * 3. for the row, col, and block, update the possibilities (update display)
   */
  setCellValue(row, col, digit) {
    /* 1. set cell value and update display */
    console.log('Set ' + row + ', ' + col + ' to ' + digit);
    this.val[row][col] = digit;
    this.display.setCellValue(row, col, digit);

    /* 2. update possibilities for this cell but don't update display */
    this.poss[row][col][digit] = true;
    for (let digitToClear of this.iterOtherDigits(digit)) {
      this.poss[row][col][digitToClear] = false;
    }

    /* 3. remove digit from row, col, block possibilities */
    const clearIt = this.digitClearer(digit);
    this.emap(this.iterOthersInRow(row, col), clearIt);
    this.emap(this.iterOthersInCol(row, col), clearIt);
    this.emap(this.iterOthersInBlock(row, col), clearIt);
  }

  /**
   * Return a function of (row, col) which will set digit to impossible, and
   * update the display (if necessary).
   */
  digitClearer(digit) {
    return (cell) => {
      let [r, c] = cell;
      if (this.poss[r][c][digit]) {
        this.poss[r][c][digit] = false;
        this.display.setCellPossibilities(r, c, this.poss[r][c]);
      }
    }
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
        this.display.setCellPossibilities(row, col, this.poss[row][col]);
      }
    }
  }

  *iterRow(row) {
    for (let col = 0; col < this.degree * this.degree; col++)
      yield [row, col];
  }

  *transpose(iter) {
    for (let [row, col] of iter)
      yield [col, row];
  }

  *iterCol(col) {
    yield *this.transpose(this.iterRow(col));
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

  *filter(iter, fn) {
    for (let item of iter) {
      if (fn(item)) {
        yield item;
      }
    }
  }

  ne(row, col) {
    return (l) => (l[0] !== row || l[1] !== col);
  }

  *iterOthersInRow(row, col) {
    yield *this.filter(this.iterRow(row), this.ne(row, col));
  }

  *iterOthersInCol(row, col) {
    yield *this.filter(this.iterCol(col), this.ne(row, col));
  }

  *iterOthersInBlock(row, col) {
    yield *this.filter(this.iterBlock(row, col), this.ne(row, col));
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
    yield *this.filter(this.iterDigits(), (x) => x !== d);
  }

  *map(iter, f) {
    for (let x of iter)
      yield f(x);
  }

  emap(iter, f) {
    for (let x of iter) {
      f(x);
    }
  }

  any(iter, fn) {
    for (let x of iter)
      if (fn(x))
        return true;
    return false;
  }

  step() {
    console.log("Stepping...")
    if (this.moves === undefined || this.moves.length === 0) {
      console.log("Adding moves...");
      this.moves = this.findObviousMoves();
    }
    if (this.moves.length === 0) {
      console.log("need to do some further logic");
    } else {
      console.log("Applying first move.");
      this.applyMoves([this.moves.pop()]);
    }
  }
}

let disp = new SudokuDisplay(3, "sudoku");
let sud = new Sudoku(3, disp, []);
document.getElementById("step").onclick = () => sud.step();
