import sys
import io
import os
import ast
import json
import time
import traceback
import multiprocessing
import queue
import inspect

def check_code_safety(code_str: str):
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

def inspect_variable(v, visited=None, depth=0, max_depth=6, oid_map=None, alive_keeper=None):
    if visited is None:
        visited = set()
    if oid_map is None:
        oid_map = {}
    if alive_keeper is None:
        alive_keeper = []

    if isinstance(v, (int, float, str, bool, type(None))):
        return {"type": type(v).__name__, "value": v}

    v_id = id(v)
    
    # Assign synthetic ID if first time seeing this memory address
    if v_id not in oid_map:
        oid_map[v_id] = f"oid_{len(oid_map) + 1}"
        alive_keeper.append(v)  # Keep reference alive to prevent GC address recycling during trace!
        
    synth_id = oid_map[v_id]

    if v_id in visited:
        return {"type": "reference", "class": type(v).__name__, "id": synth_id, "raw_id": v_id}
        
    if depth >= max_depth:
        return {"type": "truncated", "class": type(v).__name__, "value": "..."}
        
    visited.add(v_id)
    try:
        if isinstance(v, list):
            if len(v) > 50:
                truncated_vals = [inspect_variable(x, visited, depth + 1, max_depth, oid_map, alive_keeper) for x in v[:50]]
                truncated_vals.append({"type": "truncated", "value": f"... {len(v) - 50} more items"})
                return {"type": "list", "id": synth_id, "raw_id": v_id, "value": truncated_vals}
            return {"type": "list", "id": synth_id, "raw_id": v_id, "value": [inspect_variable(x, visited, depth + 1, max_depth, oid_map, alive_keeper) for x in v]}
        elif isinstance(v, tuple):
            if len(v) > 50:
                truncated_vals = [inspect_variable(x, visited, depth + 1, max_depth, oid_map, alive_keeper) for x in v[:50]]
                truncated_vals.append({"type": "truncated", "value": f"... {len(v) - 50} more items"})
                return {"type": "tuple", "id": synth_id, "raw_id": v_id, "value": truncated_vals}
            return {"type": "tuple", "id": synth_id, "raw_id": v_id, "value": [inspect_variable(x, visited, depth + 1, max_depth, oid_map, alive_keeper) for x in v]}
        elif isinstance(v, set):
            v_list = list(v)
            if len(v_list) > 50:
                truncated_vals = [inspect_variable(x, visited, depth + 1, max_depth, oid_map, alive_keeper) for x in v_list[:50]]
                truncated_vals.append({"type": "truncated", "value": f"... {len(v_list) - 50} more items"})
                return {"type": "set", "id": synth_id, "raw_id": v_id, "value": truncated_vals}
            return {"type": "set", "id": synth_id, "raw_id": v_id, "value": [inspect_variable(x, visited, depth + 1, max_depth, oid_map, alive_keeper) for x in v_list]}
        elif isinstance(v, dict):
            if len(v) > 50:
                truncated_dict = {str(k): inspect_variable(val, visited, depth + 1, max_depth, oid_map, alive_keeper) for k, val in list(v.items())[:50]}
                truncated_dict["..."] = {"type": "truncated", "value": f"{len(v) - 50} more items"}
                return {"type": "dict", "id": synth_id, "raw_id": v_id, "value": truncated_dict}
            return {"type": "dict", "id": synth_id, "raw_id": v_id, "value": {str(k): inspect_variable(val, visited, depth + 1, max_depth, oid_map, alive_keeper) for k, val in v.items()}}
        elif hasattr(v, '__dict__'):
            obj_dict = {}
            for k, val in v.__dict__.items():
                if not k.startswith('_'):
                    obj_dict[k] = inspect_variable(val, visited, depth + 1, max_depth, oid_map, alive_keeper)
            return {"type": "object", "class": type(v).__name__, "id": synth_id, "raw_id": v_id, "value": obj_dict}
        else:
            return {"type": type(v).__name__, "id": synth_id, "raw_id": v_id, "value": str(v)}
    except Exception as e:
        return {"type": "unknown", "value": str(v)}

def run_trace_in_process(payload_code, payload_function_name, payload_args, trace_queue):
    captured_stdout = io.StringIO()
    old_stdout = sys.stdout
    sys.stdout = captured_stdout
    try:
        class TraceComplete(Exception): pass
        data_scope = {}
        trace_data = []
        start_time = time.time()
        max_steps = 1000
        max_duration = 3.0
        
        # Global lifecycle maps for this entire trace run
        oid_map = {}
        alive_keeper = []

        def trace_calls(frame, event, arg):
            if time.time() - start_time > max_duration:
                raise TimeoutError("Execution timed out (max 3.0 seconds limit reached).")
            if len(trace_data) >= max_steps:
                sys.settrace(None)
                raise TraceComplete()
            
            if frame.f_code.co_filename == '<string>':
                if event in ('line', 'return'):
                    current_stack = []
                    f = frame
                    while f and f.f_code.co_filename == '<string>':
                        current_stack.append({
                            "func": f.f_code.co_name,
                            "line": f.f_lineno
                        })
                        f = f.f_back
                    current_stack.reverse()
                    
                    current_vars = {}
                    step_visited = set()
                    
                    # Capture user-defined global variables (like global grids/dp tables)
                    for k, v in frame.f_globals.items():
                        if not k.startswith('_') and not callable(v) and not inspect.ismodule(v):
                            current_vars[k] = inspect_variable(v, step_visited, 0, 6, oid_map, alive_keeper)
                            
                    # Capture local variables (overrides globals if shadowed)
                    for k, v in frame.f_locals.items():
                        if not k.startswith('_') and k != '__builtins__':
                            if k in current_vars and current_vars[k].get("raw_id") == id(v):
                                continue
                            current_vars[k] = inspect_variable(v, step_visited, 0, 6, oid_map, alive_keeper)
                    
                    step_data = {
                        "line": frame.f_lineno,
                        "lineno": frame.f_lineno,
                        "function": frame.f_code.co_name,
                        "func_name": frame.f_code.co_name,
                        "call_stack": current_stack,
                        "variables": current_vars,
                        "locals": current_vars,
                        "event": event
                    }
                    if event == 'return':
                        step_data["return_value"] = inspect_variable(arg, step_visited, 0, 6, oid_map, alive_keeper)
                    trace_data.append(step_data)
            return trace_calls

        # Step 1: Trace the entire global execution seamlessly
        sys.settrace(trace_calls)
        try:
            exec(payload_code, data_scope, data_scope)
        except TraceComplete:
            pass
        finally:
            sys.settrace(None)

        # Step 2: Intelligent Fallback
        # If the trace only captured module definitions (< 5 steps inside functions), 
        # it means the user only provided functions but didn't execute anything globally.
        execution_steps = len([s for s in trace_data if s.get('function') != '<module>'])
        if execution_steps < 5:
            # Re-initialize trace state
            trace_data.clear()
            start_time = time.time()
            
            func = data_scope.get(payload_function_name)
            if not func or not callable(func):
                for k, v in data_scope.items():
                    if callable(v) and k.lower() == str(payload_function_name).lower() and not k.startswith('_'):
                        func = v
                        break
            if not func:
                for k, v in data_scope.items():
                    if callable(v) and hasattr(v, '__code__') and v.__code__.co_filename == '<string>' and not k.startswith('_'):
                        func = v
                        break
            if not func or not callable(func):
                raise ValueError(f"Function '{payload_function_name}' not found.")
            
            evaluated_args = []
            for arg in payload_args:
                if isinstance(arg, str):
                    try:
                        arg = eval(arg, data_scope, data_scope)
                    except Exception:
                        pass
                evaluated_args.append(arg)
            
            try:
                sig = inspect.signature(func)
                param_names = list(sig.parameters.keys())
                if len(evaluated_args) < len(param_names):
                    for name in param_names[len(evaluated_args):]:
                        if name in data_scope:
                            evaluated_args.append(data_scope[name])
                        else:
                            found_obj = None
                            if name in ('head', 'root', 'node', 'start', 'first', 'list_head'):
                                for k, v in data_scope.items():
                                    if not k.startswith('_') and hasattr(v, '__dict__') and not isinstance(v, type):
                                        found_obj = v
                                        break
                            if found_obj is not None:
                                evaluated_args.append(found_obj)
            except Exception:
                pass
            
            sys.settrace(trace_calls)
            try:
                func(*evaluated_args)
            except TraceComplete:
                pass
            finally:
                sys.settrace(None)

        trace_queue.put({
            "success": True,
            "status": "success",
            "trace": trace_data
        })
    except Exception as e:
        import traceback
        trace_queue.put({
            "success": False,
            "status": "error",
            "error_type": type(e).__name__,
            "detail": str(e),
            "message": str(e),
            "traceback": traceback.format_exc()
        })
    finally:
        sys.stdout = old_stdout

def main():
    try:
        if len(sys.argv) > 1 and os.path.exists(sys.argv[1]):
            with open(sys.argv[1], 'r', encoding='utf-8') as f:
                payload = json.load(f)
        else:
            payload = json.load(sys.stdin)
            
        code = payload.get("code", "")
        func_name = payload.get("function_name") or payload.get("func_name") or "two_sum"
        args = payload.get("args", [])
        if isinstance(args, str):
            try:
                parsed = ast.literal_eval(f"[{args}]")
                if isinstance(parsed, list):
                    args = parsed
            except Exception:
                pass
        if not isinstance(args, list):
            args = [args]
            
        try:
            check_code_safety(code)
        except Exception as e:
            print(json.dumps({
                "success": False,
                "status": "error",
                "error_type": type(e).__name__,
                "detail": str(e),
                "message": str(e)
            }))
            return

        trace_queue = multiprocessing.Queue()
        p = multiprocessing.Process(target=run_trace_in_process, args=(code, func_name, args, trace_queue))
        p.start()
        
        result = None
        start_wait = time.time()
        
        while True:
            try:
                result = trace_queue.get(timeout=0.1)
                break
            except queue.Empty:
                if not p.is_alive():
                    break
                if time.time() - start_wait > 3.5:
                    break

        if p.is_alive():
            p.terminate()
            p.join()

        if result is None:
            if time.time() - start_wait > 3.5:
                print(json.dumps({
                    "success": False,
                    "status": "error",
                    "error_type": "TimeoutError",
                    "detail": "Execution exceeded maximum allowed time limit of 3.5 seconds.",
                    "message": "Execution timed out."
                }))
            else:
                print(json.dumps({
                    "success": False,
                    "status": "error",
                    "error_type": "ProcessError",
                    "detail": "The tracing process terminated unexpectedly.",
                    "message": "Process crash."
                }))
            return

        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({
            "success": False,
            "status": "error",
            "error_type": type(e).__name__,
            "detail": str(e),
            "message": str(e)
        }))

if __name__ == '__main__':
    main()
