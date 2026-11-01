"""Compatibility entry point for the replacement Preview/Live Preview check.

The old Explore editor and background-wall picker are intentionally removed.
"""
import runpy
from pathlib import Path
runpy.run_path(str(Path(__file__).with_name('browser-preview-modes.py')),run_name='__main__')
