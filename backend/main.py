import sys
import ast
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Any

app = FastAPI()

# Enable CORS cross-origin resource sharing for frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CodePayload(BaseModel):
    code: str
    function_name: str
    args: List[Any]

def check_code_safety(code_str: str):
    # Parse code into AST tree (raises SyntaxError for invalid python code)
    tree = ast.parse(code_str)
    
    blocked_functions = {"eval", "exec", "open", "__import__", "compile", "globals", "locals"}
    
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            raise PermissionError("Security Error: Import statements are blocked for safety.")
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            if node.func.id in blocked_functions:
                raise PermissionError(f"Security Error: Function call '{node.func.id}' is blocked for safety.")
        if isinstance(node, ast.Attribute):
            if node.attr.startswith("__"):
                raise PermissionError(f"Security Error: Access to dunder attribute '{node.attr}' is blocked for safety.")
        if isinstance(node, ast.Name):
            if node.id in blocked_functions:
                raise PermissionError(f"Security Error: Use of name '{node.id}' is blocked for safety.")

def inspect_variable(v, visited=None, depth=0, max_depth=5):
    if visited is None:
        visited = set()
    
    if isinstance(v, (int, float, str, bool, type(None))):
        return {"type": type(v).__name__, "value": v}
    
    v_id = id(v)
    if v_id in visited:
        return {"type": "reference", "class": type(v).__name__, "id": v_id}
    
    if depth >= max_depth:
        return {"type": "truncated", "class": type(v).__name__, "value": "..."}
        
    visited.add(v_id)
    
    try:
        if isinstance(v, list):
            if len(v) > 50:
                truncated_vals = [inspect_variable(x, visited, depth + 1, max_depth) for x in v[:50]]
                truncated_vals.append({"type": "truncated", "value": f"... {len(v) - 50} more items"})
                return {"type": "list", "id": v_id, "value": truncated_vals}
            return {"type": "list", "id": v_id, "value": [inspect_variable(x, visited, depth + 1, max_depth) for x in v]}
        elif isinstance(v, tuple):
            if len(v) > 50:
                truncated_vals = [inspect_variable(x, visited, depth + 1, max_depth) for x in v[:50]]
                truncated_vals.append({"type": "truncated", "value": f"... {len(v) - 50} more items"})
                return {"type": "tuple", "id": v_id, "value": truncated_vals}
            return {"type": "tuple", "id": v_id, "value": [inspect_variable(x, visited, depth + 1, max_depth) for x in v]}
        elif isinstance(v, set):
            v_list = list(v)
            if len(v_list) > 50:
                truncated_vals = [inspect_variable(x, visited, depth + 1, max_depth) for x in v_list[:50]]
                truncated_vals.append({"type": "truncated", "value": f"... {len(v_list) - 50} more items"})
                return {"type": "set", "id": v_id, "value": truncated_vals}
            return {"type": "set", "id": v_id, "value": [inspect_variable(x, visited, depth + 1, max_depth) for x in v_list]}
        elif isinstance(v, dict):
            if len(v) > 50:
                truncated_dict = {str(k): inspect_variable(val, visited, depth + 1, max_depth) for k, val in list(v.items())[:50]}
                truncated_dict["..."] = {"type": "truncated", "value": f"{len(v) - 50} more items"}
                return {"type": "dict", "id": v_id, "value": truncated_dict}
            return {"type": "dict", "id": v_id, "value": {str(k): inspect_variable(val, visited, depth + 1, max_depth) for k, val in v.items()}}
        elif hasattr(v, '__dict__'):
            obj_dict = {}
            for k, val in v.__dict__.items():
                if not k.startswith('_'):
                    obj_dict[k] = inspect_variable(val, visited, depth + 1, max_depth)
            return {
                "type": "object",
                "class": type(v).__name__,
                "id": v_id,
                "value": obj_dict
            }
        else:
            return {"type": type(v).__name__, "id": v_id, "value": str(v)}
    except Exception as e:
        return {"type": "unknown", "value": str(v)}

import os
from fastapi.responses import FileResponse

@app.get("/")
async def serve_index():
    index_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend/index.html"))
    return FileResponse(index_path)

def run_trace_in_process(payload_code, payload_function_name, payload_args, trace_queue):
    import sys
    import ast
    import time
    import traceback
    
    try:
        # Unified single dictionary scope so recursive lookups succeed
        data_scope = {}
        exec(payload_code, data_scope, data_scope)
        
        func = data_scope.get(payload_function_name)
        if not func:
            raise ValueError(f"Function '{payload_function_name}' not found.")
            
        trace_data = []
        start_time = time.time()
        max_steps = 1000
        max_duration = 2.0
        
        def trace_calls(frame, event, arg):
            if time.time() - start_time > max_duration:
                raise TimeoutError("Execution timed out (max 2.0 seconds limit reached).")
            if len(trace_data) >= max_steps:
                raise ValueError("Execution exceeded maximum limit of 1000 steps.")
                
            # Scope tracing to user code only
            if frame.f_code.co_filename == '<string>':
                if event in ('line', 'return'):
                    current_stack = []
                    f = frame
                    while f:
                        if f.f_code.co_name != '<module>' and f.f_code.co_filename == '<string>':
                            current_stack.append(f.f_code.co_name)
                        f = f.f_back
                    current_stack.reverse()
                    
                    current_vars = {}
                    step_visited = set()
                    for k, v in frame.f_locals.items():
                        if k != '__builtins__':
                            current_vars[k] = inspect_variable(v, step_visited)
                            
                    step_data = {
                        "line": frame.f_lineno,
                        "function": frame.f_code.co_name,
                        "call_stack": current_stack,
                        "variables": current_vars,
                        "event": event
                    }
                    if event == 'return':
                        step_data["return_value"] = inspect_variable(arg, step_visited)
                    trace_data.append(step_data)
            return trace_calls

        sys.settrace(trace_calls)
        try:
            func(*payload_args)
        finally:
            sys.settrace(None)
            
        trace_queue.put({
            "success": True,
            "trace": trace_data
        })
    except Exception as e:
        trace_queue.put({
            "success": False,
            "error_type": type(e).__name__,
            "detail": str(e),
            "traceback": traceback.format_exc()
        })

import queue
import asyncio
import multiprocessing

@app.post("/trace")
async def generate_trace(payload: CodePayload):
    try:
        # 1. AST Validation
        check_code_safety(payload.code)
    except PermissionError as pe:
        return {
            "success": False,
            "error_type": "SecurityError",
            "detail": str(pe)
        }
    except SyntaxError as se:
        return {
            "success": False,
            "error_type": "SyntaxError",
            "detail": f"Syntax Error: {se.msg} at line {se.lineno}"
        }
    except Exception as e:
        return {
            "success": False,
            "error_type": "ParseError",
            "detail": str(e)
        }

    # 2. Spawn Subprocess to isolate execution
    trace_queue = multiprocessing.Queue()
    proc = multiprocessing.Process(
        target=run_trace_in_process,
        args=(payload.code, payload.function_name, payload.args, trace_queue)
    )
    proc.start()
    
    # 3. External Async Timeout Monitor (Hard kill after 3.0s)
    timeout_duration = 3.0
    start_time = asyncio.get_event_loop().time()
    
    while proc.is_alive():
        if asyncio.get_event_loop().time() - start_time > timeout_duration:
            proc.terminate()
            proc.join(timeout=0.5)
            if proc.is_alive():
                proc.kill()
            return {
                "success": False,
                "error_type": "TimeoutError",
                "detail": "Execution exceeded hard timeout limit (3.0 seconds)."
            }
        await asyncio.sleep(0.05)
        
    # Check queue contents
    try:
        result = trace_queue.get_nowait()
    except queue.Empty:
        return {
            "success": False,
            "error_type": "RuntimeError",
            "detail": "Subprocess terminated unexpectedly without returning trace data."
        }
        
    if not result.get("success"):
        return result
        
    # 4. Compile layout metadata
    try:
        tree = ast.parse(payload.code)
        code_lines = payload.code.splitlines()
        line_metadata = {}
        valid_lines = set()
        
        for node in ast.walk(tree):
            if hasattr(node, 'lineno'):
                lineno = node.lineno
                if isinstance(node, (ast.FunctionDef, ast.Module)):
                    continue
                valid_lines.add(lineno)
                node_type = type(node).__name__
                code_text = code_lines[lineno - 1] if 0 < lineno <= len(code_lines) else ""
                
                if lineno not in line_metadata:
                    line_metadata[lineno] = {
                        "line": lineno,
                        "type": node_type,
                        "code": code_text.strip()
                    }
                else:
                    existing_type = line_metadata[lineno]["type"]
                    if node_type in ("For", "While", "If", "Return", "Assign", "Call") or existing_type in ("Name", "Constant", "Load", "Store", "Expr"):
                        line_metadata[lineno]["type"] = node_type
                        
        layout_lines = sorted(list(valid_lines))
        layout_metadata = [line_metadata[line] for line in sorted(line_metadata.keys())]
        
        return {
            "success": True,
            "trace": result["trace"],
            "layout_lines": layout_lines,
            "layout_metadata": layout_metadata
        }
    except Exception as e:
        return {
            "success": False,
            "error_type": "MetadataError",
            "detail": f"Failed compiling layout metadata: {str(e)}"
        }

# Auto-start configuration block for VS Code play/debug button compatibility
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)