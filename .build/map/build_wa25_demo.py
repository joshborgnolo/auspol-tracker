#!/usr/bin/env python3
"""data/wa25-demo.json — see build_wa_demo_common.py's header (2026-11-05).

usage: python3 -I .build/map/build_wa25_demo.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_wa_demo_common

build_wa_demo_common.demo_main("wa25")
