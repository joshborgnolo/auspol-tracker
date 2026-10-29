#!/usr/bin/env python3
"""data/qld20-demo.json for the /map/ Queensland frame (the emitter is
build_qld_demo_common.py; see its header)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_qld_demo_common import FRAMES, demo_main

demo_main("qld20", FRAMES["qld20"])
