import json
import subprocess
import os

code = """
board = [
    ["5","3",".",".","7",".",".",".","."],
    ["6",".",".","1","9","5",".",".","."],
    [".","9","8",".",".",".",".","6","."],
    ["8",".",".",".","6",".",".",".","3"],
    ["4",".",".","8",".","3",".",".","1"],
    ["7",".",".",".","2",".",".",".","6"],
    [".","6",".",".",".",".","2","8","."],
    [".",".",".","4","1","9",".",".","5"],
    [".",".",".",".","8",".",".","7","9"]
]

def isValid(row, col, num):
    for c in range(9):
        if board[row][c] == num:
            return False
    for r in range(9):
        if board[r][col] == num:
            return False
    startRow = (row // 3) * 3
    startCol = (col // 3) * 3
    for r in range(startRow, startRow + 3):
        for c in range(startCol, startCol + 3):
            if board[r][c] == num:
                return False
    return True

def solve():
    for r in range(9):
        for c in range(9):
            if board[r][c] == ".":
                for num in "123456789":
                    if isValid(r, c, num):
                        board[r][c] = num
                        if solve():
                            return True
                        board[r][c] = "."
                return False
    return True

solve()
"""

payload = {
    "code": code,
    "function_name": "solve",
    "args": []
}

with open("test_payload_sudoku.json", "w") as f:
    json.dump(payload, f)

