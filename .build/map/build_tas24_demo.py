#!/usr/bin/env python3
"""data/tas24-demo.json — see build_tas_demo_common.py's header.

usage: python3 -I .build/map/build_tas24_demo.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_tas_demo_common

build_tas_demo_common.demo_main("tas24")
