import sys
import os
import unittest
import asyncio

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from main import check_code_safety, inspect_variable, generate_trace, CodePayload

class TestBackendSafety(unittest.IsolatedAsyncioTestCase):
    def test_ast_safety_check_blocks_imports(self):
        code_with_import = "import os\ndef my_func(): pass"
        with self.assertRaises(PermissionError) as context:
            check_code_safety(code_with_import)
        self.assertIn("Import statements are blocked", str(context.exception))

    def test_ast_safety_check_blocks_dunder(self):
        code_with_dunder = "def my_func():\n    return x.__class__"
        with self.assertRaises(PermissionError) as context:
            check_code_safety(code_with_dunder)
        self.assertIn("dunder attribute", str(context.exception))

    def test_ast_safety_check_blocks_malicious_calls(self):
        code_with_eval = "def my_func():\n    eval('2+2')"
        with self.assertRaises(PermissionError) as context:
            check_code_safety(code_with_eval)
        self.assertIn("blocked for safety", str(context.exception))

    def test_inspect_variable_depth_limit(self):
        # Deeply nested list
        deep_list = []
        curr = deep_list
        for _ in range(10):
            new_list = []
            curr.append(new_list)
            curr = new_list
        
        res = inspect_variable(deep_list, max_depth=5)
        # Validate that it truncates at depth 5
        curr_res = res
        for _ in range(5):
            curr_res = curr_res["value"][0]
        self.assertEqual(curr_res["type"], "truncated")
        self.assertEqual(curr_res["value"], "...")

    def test_inspect_variable_shared_references(self):
        class Node:
            def __init__(self, val):
                self.val = val
                self.next = None
                
        n1 = Node(10)
        n2 = Node(20)
        n2.next = n1
        
        variables = {
            "n1": n1,
            "n2": n2
        }
        
        visited = set()
        snapshot = {k: inspect_variable(v, visited) for k, v in variables.items()}
        
        n1_id = id(n1)
        self.assertEqual(snapshot["n1"]["type"], "object")
        self.assertEqual(snapshot["n2"]["value"]["next"]["type"], "reference")
        self.assertEqual(snapshot["n2"]["value"]["next"]["id"], n1_id)

    async def test_endpoint_trace_simple(self):
        code = """def solve(a, b):
    c = a + b
    return c
"""
        payload = CodePayload(code=code, function_name="solve", args=[10, 20])
        res_data = await generate_trace(payload)
        self.assertTrue(res_data["success"])
        self.assertTrue(len(res_data["trace"]) > 0)
        final_step = res_data["trace"][-1]
        self.assertEqual(final_step["event"], "return")
        self.assertEqual(final_step["return_value"]["value"], 30)

    async def test_endpoint_trace_timeout(self):
        code = """import time
def slow_loop():
    while True:
        pass
"""
        payload = CodePayload(code=code, function_name="slow_loop", args=[])
        res_data = await generate_trace(payload)
        self.assertFalse(res_data["success"])
        self.assertEqual(res_data["error_type"], "SecurityError")

    async def test_endpoint_trace_loop_timeout(self):
        code = """def infinite_loop():
    x = 0
    while True:
        x += 1
"""
        payload = CodePayload(code=code, function_name="infinite_loop", args=[])
        res_data = await generate_trace(payload)
        self.assertFalse(res_data["success"])
        self.assertIn(res_data["error_type"], ("ValueError", "TimeoutError"))

if __name__ == "__main__":
    unittest.main()
