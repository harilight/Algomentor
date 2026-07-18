# Forwarder for backward compatibility with scripts/tools referencing root trace_engine.py
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'visualizationEngine'))
import trace_engine

if __name__ == '__main__':
    trace_engine.main()
